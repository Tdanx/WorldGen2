/**
 * LifecycleModel — pure functions for civ stability and collapse.
 *
 * Called after GrowthModel so famine flags are current, and before
 * ConflictEngine so stability affects war pressure calculations.
 */

import type { Civilization, CivId, InstabilityFlag } from '../../types/civilization';
import type { WorldState } from '../../types/world';
import { SpeciesRegistry } from '../../registries/SpeciesRegistry';

// Stability deltas applied every tick
const FAMINE_PENALTY          = -3;
const OVERSTRETCH_PENALTY     = -1;
const MILITARY_DEFEAT_PENALTY = -3;  // was -5; applied for up to DEFEAT_DECAY_TICKS ticks
const ACTIVE_WAR_PENALTY      = -2;
const PEACE_BONUS             = +2;  // was +1
const TECH_ADVANCE_BONUS      = +2;
const OVERSTRETCH_THRESHOLD   = 50;  // territory tiles that triggers overstretched flag
const DEFEAT_DECAY_TICKS      = 10;  // was 20; max total defeat impact = -30

export function updateStability(
  civ: Civilization,
  state: WorldState,
  techAdvancedThisTick: boolean,
): Civilization {
  if (civ.lifecycle.phase === 'collapse' || civ.lifecycle.phase === 'extinct') {
    return civ;
  }

  let { stabilityScore, instabilityFlags } = civ.lifecycle;
  // Work with a mutable copy of flags
  const flags = new Set<InstabilityFlag>(instabilityFlags);

  // Resilience trait reduces all penalties (range 0.6–1.0 multiplier)
  const speciesDef  = SpeciesRegistry.get(civ.speciesId);
  const resilience  = speciesDef?.traits.resilience ?? 0;
  const penaltyMult = 1 - resilience * 0.4;

  // ── Penalties ────────────────────────────────────────────────────────────

  // Famine
  if (flags.has('famine')) {
    stabilityScore += Math.round(FAMINE_PENALTY * penaltyMult);
  }

  // Overstretched borders
  if (civ.territory.length > OVERSTRETCH_THRESHOLD) {
    flags.add('overstretched_borders');
    stabilityScore += Math.round(OVERSTRETCH_PENALTY * penaltyMult);
  } else {
    flags.delete('overstretched_borders');
  }

  // Military defeat (decays after DEFEAT_DECAY_TICKS from when flag was stamped)
  if (flags.has('military_defeat')) {
    const ticksSinceDefeat = civ.lifecycle.defeatTick !== undefined
      ? state.tick - civ.lifecycle.defeatTick
      : DEFEAT_DECAY_TICKS + 1; // treat as expired if no timestamp (legacy safety)
    if (ticksSinceDefeat <= DEFEAT_DECAY_TICKS) {
      stabilityScore += Math.round(MILITARY_DEFEAT_PENALTY * penaltyMult);
    } else {
      flags.delete('military_defeat'); // flag expires
    }
  }

  // Active war
  const atWar = state.wars.some(
    w => !w.endedTick &&
      (w.aggressorId === civ.id || w.defenderId === civ.id),
  );
  if (atWar) {
    stabilityScore += Math.round(ACTIVE_WAR_PENALTY * penaltyMult);
  }

  // ── Bonuses ──────────────────────────────────────────────────────────────

  if (techAdvancedThisTick) {
    stabilityScore += TECH_ADVANCE_BONUS;
  }

  // Peace bonus: no active war, above minimum threshold.
  // Full bonus when completely stable; reduced bonus (+1) when only overstretch flag present
  // so an expanding civ stays neutral (-1 overstretch + 1 peace = 0) rather than spiralling down.
  const onlyOverstretched = flags.size === 1 && flags.has('overstretched_borders');
  if (!atWar && (flags.size === 0 || onlyOverstretched) && stabilityScore > 20) {
    stabilityScore += flags.size === 0 ? PEACE_BONUS : 1;
  }

  // Clamp to [0, 100]
  stabilityScore = Math.max(0, Math.min(100, stabilityScore));

  // Collapse risk: inverse of stability
  const collapseRisk = parseFloat((1 - stabilityScore / 100).toFixed(2));

  return {
    ...civ,
    lifecycle: {
      ...civ.lifecycle,
      stabilityScore,
      instabilityFlags: Array.from(flags),
      collapseRisk,
    },
  };
}

/**
 * Apply collapse: clear territory, set phase to 'collapse'.
 * Returns updated civ + the set of tile indices that became unowned.
 */
export function applyCollapse(civ: Civilization): {
  civ: Civilization;
  freedTiles: Set<number>;
} {
  const freedTiles = new Set(civ.territory);
  return {
    civ: {
      ...civ,
      territory: [],
      population: 0,
      lifecycle: {
        ...civ.lifecycle,
        phase: 'collapse',
        collapseRisk: 1,
      },
    },
    freedTiles,
  };
}

/**
 * Run stability updates and collapse detection on all civs.
 * Returns updated civs map, freed tile indices, and ids of civs that collapsed.
 */
export function tickLifecycle(
  civs: ReadonlyMap<CivId, Civilization>,
  state: WorldState,
  techAdvancedIds: Set<CivId>,
): {
  civs: Map<CivId, Civilization>;
  collapsedIds: CivId[];
  freedTiles: Set<number>;
} {
  const updated    = new Map<CivId, Civilization>();
  const collapsedIds: CivId[] = [];
  const freedTiles = new Set<number>();

  for (const civ of civs.values()) {
    const advanced = techAdvancedIds.has(civ.id);
    let next = updateStability(civ, state, advanced);

    if (next.lifecycle.stabilityScore <= 0 && next.lifecycle.phase !== 'collapse') {
      const result = applyCollapse(next);
      next = result.civ;
      for (const ti of result.freedTiles) freedTiles.add(ti);
      collapsedIds.push(civ.id);
    }

    updated.set(civ.id, next);
  }

  return { civs: updated, collapsedIds, freedTiles };
}
