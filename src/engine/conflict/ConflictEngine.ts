import type { Civilization, CivId } from '../../types/civilization';
import type { WarState, WarPressureRecord, WarOutcome } from '../../types/conflict';
import type { WorldState, Tile } from '../../types/world';
import { distance2D } from '../../utils/math';
import { getBiomeDef } from '../../registries/BiomeRegistry';
import { SpeciesRegistry } from '../../registries/SpeciesRegistry';
import { ReligionRegistry } from '../../registries/ReligionRegistry';
import { makeEntryId } from '../core/idgen';
import { makeWarDeclaredEntry, makeWarEndedEntry } from '../civilization/EventGenerator';
import { WAR_THRESHOLD } from '../../utils/constants';
import { mulberry32 } from '../../utils/rng';

// Two civs are considered neighbours if any owned tile is within this distance.
// At spacing=5.5, cells are ~55 world-units wide; 20× = ~110 units ≈ 2 cells.
const BORDER_DISTANCE_FACTOR = 20;

// War resolves when |warScore| exceeds this
const RESOLUTION_THRESHOLD = 80;

// Maximum border-tension score component
const MAX_COMPONENT = 20;

export function isAtWar(state: WorldState, civA: CivId, civB: CivId): boolean {
  return state.wars.some(
    w => !w.endedTick &&
      ((w.aggressorId === civA && w.defenderId === civB) ||
       (w.aggressorId === civB && w.defenderId === civA)),
  );
}

// ─── War pressure ─────────────────────────────────────────────────────────────

function borderTension(civA: Civilization, civB: Civilization, tiles: ReadonlyArray<Tile>, spacing: number): number {
  const threshold = spacing * BORDER_DISTANCE_FACTOR;
  const tilesA = tiles.filter(t => t.ownerId === civA.id);
  const tilesB = tiles.filter(t => t.ownerId === civB.id);
  if (tilesA.length === 0 || tilesB.length === 0) return 0;

  let closePairs = 0;
  for (const a of tilesA) {
    for (const b of tilesB) {
      if (distance2D(a.x, a.y, b.x, b.y) <= threshold) {
        closePairs++;
        if (closePairs >= MAX_COMPONENT) return MAX_COMPONENT;
      }
    }
  }
  return Math.min(closePairs, MAX_COMPONENT);
}

function religiousConflict(civA: Civilization, civB: Civilization): number {
  if (!civA.faithId || !civB.faithId || civA.faithId === civB.faithId) return 0;
  const faithA = ReligionRegistry.get(civA.faithId);
  const faithB = ReligionRegistry.get(civB.faithId);
  if (!faithA || !faithB) return 5;

  const aggressiveTenets = new Set(['militant', 'proselytizing']);
  const peacefulTenets   = new Set(['pacifist', 'isolationist']);

  const aAggressive = faithA.tenets.some(t => aggressiveTenets.has(t));
  const bPeaceful   = faithB.tenets.some(t => peacefulTenets.has(t));

  if (aAggressive && bPeaceful) return MAX_COMPONENT;
  return 10; // different faiths, neutral tenet match
}

function resourceScarcity(civA: Civilization, civB: Civilization): number {
  const aFamine = civA.lifecycle.instabilityFlags.includes('famine');
  const bFamine = civB.lifecycle.instabilityFlags.includes('famine');
  if (aFamine && bFamine) return MAX_COMPONENT;
  if (aFamine || bFamine) return 10;
  return 0;
}

function grievanceScore(civA: Civilization, civB: Civilization, state: WorldState): number {
  const GRIEVANCE_WINDOW = 200;
  const recentLoss = state.wars.find(
    w => w.endedTick !== undefined &&
      state.tick - w.endedTick <= GRIEVANCE_WINDOW &&
      w.aggressorId === civA.id && w.defenderId === civB.id &&
      (w.outcome === 'defender_wins' || w.outcome === 'white_peace'),
  );
  return recentLoss ? 15 : 5;
}

function powerImbalance(civA: Civilization, civB: Civilization): number {
  const sA = civA.military.effectiveStrength;
  const sB = civB.military.effectiveStrength;
  if (sA === 0 && sB === 0) return 0;
  const stronger = Math.max(sA, sB);
  const weaker   = Math.min(sA, sB);
  const ratio = stronger / (weaker + 1);
  // Extreme imbalance (≥5:1) → aggressor (the stronger one) scores MAX
  if (sA >= sB && ratio >= 5) return MAX_COMPONENT;
  if (sA >= sB && ratio >= 2) return 10;
  return 0;
}

export function calculateWarPressure(
  civA: Civilization,
  civB: Civilization,
  state: WorldState,
): WarPressureRecord {
  const components = {
    borderTension:    borderTension(civA, civB, state.tiles, state.config.spacing),
    religiousConflict: religiousConflict(civA, civB),
    resourceScarcity:  resourceScarcity(civA, civB),
    grievance:         grievanceScore(civA, civB, state),
    powerImbalance:    powerImbalance(civA, civB),
  };
  const totalPressure = Math.min(100,
    components.borderTension +
    components.religiousConflict +
    components.resourceScarcity +
    components.grievance +
    components.powerImbalance,
  );
  return { aggressor: civA.id, target: civB.id, totalPressure, components, lastUpdatedTick: state.tick };
}

// ─── War resolution ───────────────────────────────────────────────────────────

function resolveWar(state: WorldState, war: WarState): { state: WorldState; outcome: WarOutcome } {
  let outcome: WarOutcome;
  if (war.warScore >= RESOLUTION_THRESHOLD) {
    outcome = 'aggressor_wins';
  } else if (war.warScore <= -RESOLUTION_THRESHOLD) {
    outcome = 'defender_wins';
  } else {
    outcome = 'white_peace';
  }

  const newCivs = new Map(state.civilizations);

  if (outcome === 'aggressor_wins') {
    const aggressor = newCivs.get(war.aggressorId);
    const defender  = newCivs.get(war.defenderId);
    if (aggressor && defender) {
      // Transfer ~20% of defender's territory to aggressor
      const transferCount = Math.max(1, Math.floor(defender.territory.length * 0.2));
      const transferred   = defender.territory.slice(0, transferCount);
      const newDefTerritory = defender.territory.slice(transferCount);
      newCivs.set(war.aggressorId, {
        ...aggressor,
        territory: [...aggressor.territory, ...transferred],
      });
      newCivs.set(war.defenderId, {
        ...defender,
        territory: newDefTerritory,
        lifecycle: {
          ...defender.lifecycle,
          stabilityScore: Math.max(0, defender.lifecycle.stabilityScore - 30),
          instabilityFlags: [...new Set([...defender.lifecycle.instabilityFlags, 'military_defeat' as const])],
        },
      });
      // Update tile ownership for transferred tiles
      const transferSet = new Set(transferred);
      const newTiles = state.tiles.map(t =>
        transferSet.has(t.index) ? { ...t, ownerId: war.aggressorId } : t,
      );
      state = { ...state, tiles: newTiles };
    }
  } else if (outcome === 'defender_wins') {
    const aggressor = newCivs.get(war.aggressorId);
    if (aggressor) {
      newCivs.set(war.aggressorId, {
        ...aggressor,
        lifecycle: {
          ...aggressor.lifecycle,
          instabilityFlags: [...new Set([...aggressor.lifecycle.instabilityFlags, 'military_defeat' as const])],
        },
      });
    }
  }

  const endedWar: WarState = { ...war, endedTick: state.tick, outcome };
  const newWars = state.wars.map(w => w.id === war.id ? endedWar : w);
  const entry = makeWarEndedEntry(endedWar, outcome, state.tick, makeEntryId('conflict'));

  return {
    state: { ...state, civilizations: newCivs, wars: newWars, chronicle: [...state.chronicle, entry] },
    outcome,
  };
}

// ─── Battle tick ──────────────────────────────────────────────────────────────

function tickBattle(state: WorldState, war: WarState): { war: WarState; state: WorldState } {
  const aggressor = state.civilizations.get(war.aggressorId);
  const defender  = state.civilizations.get(war.defenderId);
  if (!aggressor || !defender) return { war, state };

  // Terrain modifier: average movement cost of contested tiles (defender advantage)
  let terrainMod = 1.0;
  if (war.contestedTiles.length > 0) {
    const tileMap = new Map(state.tiles.map(t => [t.index, t]));
    const costs = war.contestedTiles
      .map(ti => tileMap.get(ti))
      .filter(Boolean)
      .map(t => getBiomeDef(t!.biome).movementCost);
    if (costs.length > 0) {
      terrainMod = costs.reduce((a, b) => a + b, 0) / costs.length;
    }
  }

  const aStr = aggressor.military.effectiveStrength / terrainMod;
  const dStr = defender.military.effectiveStrength;

  // Deterministic variance seeded per war+tick
  const rng = mulberry32(state.tick * 997 + war.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const variance = rng() * 10 - 5; // -5 to +5

  const rawDiff   = aStr - dStr;
  const direction = rawDiff !== 0 ? Math.sign(rawDiff) : (rng() > 0.5 ? 1 : -1);
  const scoreDelta = Math.round(direction * (5 + Math.abs(variance)));
  const newScore   = Math.max(-100, Math.min(100, war.warScore + scoreDelta));

  // Casualties proportional to opposing strength
  const aLosses = Math.round(dStr * 0.01);
  const dLosses = Math.round(aStr * 0.01);

  // Contested tiles: border tiles between the two civs
  const threshold = state.config.spacing * BORDER_DISTANCE_FACTOR;
  const tilesA = state.tiles.filter(t => t.ownerId === war.aggressorId);
  const tilesB = state.tiles.filter(t => t.ownerId === war.defenderId);
  const contested: number[] = [];
  for (const tb of tilesB) {
    if (tilesA.some(ta => distance2D(ta.x, ta.y, tb.x, tb.y) <= threshold)) {
      contested.push(tb.index);
      if (contested.length >= 5) break;
    }
  }

  const updatedWar: WarState = {
    ...war,
    warScore: newScore,
    casualties: {
      aggressor: war.casualties.aggressor + aLosses,
      defender:  war.casualties.defender  + dLosses,
    },
    contestedTiles: contested,
  };

  // Apply casualties to populations
  const newCivs = new Map(state.civilizations);
  if (aggressor) newCivs.set(war.aggressorId, { ...aggressor, population: Math.max(1, aggressor.population - aLosses) });
  if (defender)  newCivs.set(war.defenderId,  { ...defender,  population: Math.max(1, defender.population  - dLosses) });

  return { war: updatedWar, state: { ...state, civilizations: newCivs } };
}

// ─── Main tick ────────────────────────────────────────────────────────────────

export class ConflictEngine {
  /**
   * For every pair of civs, compute war pressure and auto-declare wars when
   * threshold is exceeded. Then advance all active wars by one battle tick.
   */
  tickWars(state: WorldState): WorldState {
    let next = { ...state };

    // 1. Check war pressure for all civ pairs
    const civList = Array.from(next.civilizations.values()).filter(
      c => c.lifecycle.phase !== 'collapse' && c.lifecycle.phase !== 'extinct',
    );

    for (let i = 0; i < civList.length; i++) {
      for (let j = i + 1; j < civList.length; j++) {
        const civA = civList[i];
        const civB = civList[j];
        if (isAtWar(next, civA.id, civB.id)) continue;

        const pressure = calculateWarPressure(civA, civB, next);
        if (pressure.totalPressure < WAR_THRESHOLD) continue;

        const speciesA = SpeciesRegistry.get(civA.speciesId);
        if (!speciesA || speciesA.traits.aggression <= 0.5) continue;

        // Declare war
        const war: WarState = {
          id: makeEntryId('war'),
          aggressorId: civA.id,
          defenderId:  civB.id,
          declaredTick: next.tick,
          cause: pressure.components.religiousConflict >= 15 ? 'holy_war' : 'border_tension',
          warScore: 0,
          casualties: { aggressor: 0, defender: 0 },
          contestedTiles: [],
        };
        const entry = makeWarDeclaredEntry(war, civA.name, civB.name, next.tick, makeEntryId('conflict'));
        next = { ...next, wars: [...next.wars, war], chronicle: [...next.chronicle, entry] };
      }
    }

    // 2. Advance all active wars
    const activeWars = next.wars.filter(w => !w.endedTick);
    let updatedWars = [...next.wars];

    for (const war of activeWars) {
      const { war: battledWar, state: afterBattle } = tickBattle(next, war);
      next = afterBattle;

      if (Math.abs(battledWar.warScore) >= RESOLUTION_THRESHOLD) {
        const { state: resolved } = resolveWar(next, battledWar);
        next = resolved;
        updatedWars = next.wars as WarState[];
      } else {
        updatedWars = updatedWars.map(w => w.id === battledWar.id ? battledWar : w) as WarState[];
        next = { ...next, wars: updatedWars };
      }
    }

    return next;
  }
}
