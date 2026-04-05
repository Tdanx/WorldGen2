/**
 * LifecycleModel — pure functions for civ stability and collapse.
 *
 * Called after GrowthModel so famine flags are current, and before
 * ConflictEngine so stability affects war pressure calculations.
 */

import type { Civilization, CivId, InstabilityFlag } from '../../types/civilization';
import type { WorldState } from '../../types/world';

// Stability deltas applied every tick
const FAMINE_PENALTY        = -3;
const OVERSTRETCH_PENALTY   = -1;
const MILITARY_DEFEAT_PENALTY = -5;  // applied for up to DEFEAT_DECAY_TICKS ticks
const ACTIVE_WAR_PENALTY    = -2;
const PEACE_BONUS           = +1;
const TECH_ADVANCE_BONUS    = +2;
const OVERSTRETCH_THRESHOLD = 50;    // territory tiles that triggers overstretched flag
const DEFEAT_DECAY_TICKS    = 20;    // how long military_defeat keeps dealing -5/tick

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

  // ── Penalties ────────────────────────────────────────────────────────────

  // Famine
  if (flags.has('famine')) {
    stabilityScore += FAMINE_PENALTY;
  }

  // Overstretched borders
  if (civ.territory.length > OVERSTRETCH_THRESHOLD) {
    flags.add('overstretched_borders');
    stabilityScore += OVERSTRETCH_PENALTY;
  } else {
    flags.delete('overstretched_borders');
  }

  // Military defeat (decays after DEFEAT_DECAY_TICKS)
  if (flags.has('military_defeat')) {
    const ticksInDefeat = state.tick - civ.lifecycle.phaseEnteredTick;
    if (ticksInDefeat <= DEFEAT_DECAY_TICKS) {
      stabilityScore += MILITARY_DEFEAT_PENALTY;
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
    stabilityScore += ACTIVE_WAR_PENALTY;
  }

  // ── Bonuses ──────────────────────────────────────────────────────────────

  if (techAdvancedThisTick) {
    stabilityScore += TECH_ADVANCE_BONUS;
  }

  // Peace bonus: no flags, no active war, already reasonably stable
  if (!atWar && flags.size === 0 && stabilityScore > 60) {
    stabilityScore += PEACE_BONUS;
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
