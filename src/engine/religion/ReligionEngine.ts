import type { Civilization, CivId } from '../../types/civilization';
import type { ReligionId } from '../../types/religion';
import type { WorldState, Tile } from '../../types/world';
import { ReligionRegistry } from '../../registries/ReligionRegistry';
import { SpeciesRegistry } from '../../registries/SpeciesRegistry';
import { makeEntryId } from '../core/idgen';
import { mulberry32 } from '../../utils/rng';

// Only check for religion founding every N ticks (prevents spamming)
const FOUND_CHECK_INTERVAL = 50;

// Probability a border tile converts per tick for proselytizing faiths
const SPREAD_PROBABILITY = 0.10;

// World-unit radius for religion spread (2× cell width at spacing=5.5)
const SPREAD_DISTANCE_FACTOR = 20;

// Tenet sets for quick lookup
const PROSELYTIZING_TENETS = new Set(['militant', 'proselytizing']);
const FOUNDING_RELIGIOSITY_THRESHOLD = 0.7;
const FOUNDING_STABILITY_THRESHOLD   = 60;

function civName(state: WorldState, civId: CivId): string {
  return state.civilizations.get(civId)?.name ?? civId;
}

/** Pick tenets for a newly founded religion based on the founder's species traits. */
function pickTenets(civ: Civilization): import('../../types/religion').ReligiousTenet[] {
  const species = SpeciesRegistry.get(civ.speciesId);
  const tenets: import('../../types/religion').ReligiousTenet[] = [];

  if (!species) return ['nature_worship'];

  const { aggression, religiosity, diplomacy } = species.traits;
  if (aggression > 0.6)   tenets.push('militant');
  else if (diplomacy > 0.6) tenets.push('pacifist');

  if (religiosity > 0.6)  tenets.push('proselytizing');
  else                    tenets.push('isolationist');

  tenets.push(religiosity > 0.5 ? 'monotheistic' : 'polytheistic');

  return tenets;
}

/** Generate a religion name from the founding civ's name. */
function faithName(civ: Civilization): string {
  const words = civ.name.split(' ');
  const core  = words[Math.floor(words.length / 2)] ?? words[0];
  const suffixes = ['ism', 'ism', 'ite Faith', ' Doctrine', ' Way', ' Path'];
  const idx = civ.id.charCodeAt(civ.id.length - 1) % suffixes.length;
  return `${core}${suffixes[idx]}`;
}

// ─── Founding ─────────────────────────────────────────────────────────────────

function maybeFounded(civ: Civilization, state: WorldState): {
  civs: ReadonlyMap<CivId, Civilization>;
  chronicle: WorldState['chronicle'];
} {
  if (
    civ.faithId !== null ||
    state.tick % FOUND_CHECK_INTERVAL !== 0 ||
    civ.lifecycle.phase === 'collapse' ||
    civ.lifecycle.phase === 'extinct'
  ) {
    return { civs: state.civilizations, chronicle: state.chronicle };
  }

  const species = SpeciesRegistry.get(civ.speciesId);
  if (!species) return { civs: state.civilizations, chronicle: state.chronicle };

  if (
    species.traits.religiosity <= FOUNDING_RELIGIOSITY_THRESHOLD ||
    civ.lifecycle.stabilityScore <= FOUNDING_STABILITY_THRESHOLD
  ) {
    return { civs: state.civilizations, chronicle: state.chronicle };
  }

  const religionId = ReligionRegistry.found({
    name: faithName(civ),
    founderCivId: civ.id,
    foundedTick: state.tick,
    tenets: pickTenets(civ),
    splitFrom: null,
    extinctTick: null,
    color: `hsl(${(civ.id.charCodeAt(civ.id.length - 1) * 37) % 360}, 70%, 55%)`,
    followerCivIds: new Set([civ.id]),
  });

  const updatedCiv: Civilization = { ...civ, faithId: religionId };
  const newCivs = new Map(state.civilizations);
  newCivs.set(civ.id, updatedCiv);

  const faith = ReligionRegistry.get(religionId)!;
  const entry = {
    id: makeEntryId('religion'),
    tick: state.tick,
    severity: 'major' as const,
    eventType: 'divine_intervention' as const, // closest event type; religion_founded not in enum
    civIds: [civ.id],
    description: `${civ.name} founds ${faith.name}.`,
    data: { faithId: religionId, faithName: faith.name },
  };

  return { civs: newCivs, chronicle: [...state.chronicle, entry] };
}

// ─── Spread ───────────────────────────────────────────────────────────────────

function spreadReligion(state: WorldState): {
  tiles: ReadonlyArray<Tile>;
  civs: ReadonlyMap<CivId, Civilization>;
} {
  const threshold = state.config.spacing * SPREAD_DISTANCE_FACTOR;
  const tiles = [...state.tiles] as Tile[];
  const civs  = new Map(state.civilizations);

  // Build owner→faithId lookup once
  const ownerFaith = new Map<CivId, ReligionId | null>();
  for (const [id, civ] of civs) ownerFaith.set(id, civ.faithId);

  for (const civ of civs.values()) {
    if (!civ.faithId) continue;
    const faith = ReligionRegistry.get(civ.faithId);
    if (!faith || faith.extinctTick !== null) continue;
    if (!faith.tenets.some(t => PROSELYTIZING_TENETS.has(t))) continue;

    // Tiles owned by this civ that could spread
    const sourceTiles = tiles.filter(t => t.ownerId === civ.id);

    for (const target of tiles) {
      if (target.ownerId === civ.id) continue;          // same civ — skip
      if (target.ownerId === null) continue;            // unowned — skip
      if (target.religionId === civ.faithId) continue;  // already converted
      if (target.isWater) continue;

      // Check distance to any source tile
      const close = sourceTiles.some(src => {
        const dx = src.x - target.x;
        const dy = src.y - target.y;
        return Math.sqrt(dx * dx + dy * dy) <= threshold;
      });
      if (!close) continue;

      // Deterministic probability check
      const rng = mulberry32(state.tick * 1000 + target.index);
      if (rng() >= SPREAD_PROBABILITY) continue;

      // Convert tile
      tiles[target.index] = { ...target, religionId: civ.faithId };

      // Update follower set: add target civ, potentially remove old faith civ
      if (target.ownerId) {
        const targetCiv = civs.get(target.ownerId);
        if (targetCiv && targetCiv.faithId && targetCiv.faithId !== civ.faithId) {
          const oldFaith = ReligionRegistry.get(targetCiv.faithId);
          if (oldFaith) {
            // Remove if this was the last tile of that civ with old faith
            // (approximate: only used for extinction check downstream)
          }
        }
        // Add target civ as follower
        const updatedFaith = ReligionRegistry.get(civ.faithId);
        if (updatedFaith) {
          updatedFaith.followerCivIds.add(target.ownerId);
        }
      }
    }
  }

  return { tiles, civs };
}

// ─── Schism ───────────────────────────────────────────────────────────────────

function processSchisms(state: WorldState): ReadonlyMap<CivId, Civilization> {
  const civs = new Map(state.civilizations);

  for (const [id, civ] of civs) {
    if (!civ.faithId) continue;
    if (!civ.lifecycle.instabilityFlags.includes('religious_schism')) continue;

    const newFaithId = ReligionRegistry.schism(civ.faithId, state.tick, id);
    const newFaith   = ReligionRegistry.get(newFaithId)!;
    newFaith.followerCivIds.add(id);

    // Remove civ from old faith's followers
    const oldFaith = ReligionRegistry.get(civ.faithId);
    if (oldFaith) oldFaith.followerCivIds.delete(id);

    // Clear the schism flag and update faithId
    const updatedFlags = civ.lifecycle.instabilityFlags.filter(f => f !== 'religious_schism');
    civs.set(id, {
      ...civ,
      faithId: newFaithId,
      lifecycle: { ...civ.lifecycle, instabilityFlags: updatedFlags },
    });
  }

  return civs;
}

// ─── Extinction ───────────────────────────────────────────────────────────────

function checkExtinction(state: WorldState, civs: ReadonlyMap<CivId, Civilization>): void {
  const livingCivIds = new Set(
    Array.from(civs.values())
      .filter(c => c.lifecycle.phase !== 'extinct')
      .map(c => c.id),
  );

  for (const faith of ReligionRegistry.getActive()) {
    const hasLivingFollower = Array.from(faith.followerCivIds).some(id => livingCivIds.has(id));
    if (!hasLivingFollower) {
      ReligionRegistry.extinguish(faith.id, state.tick);
    }
  }
}

// ─── Holy war pressure ────────────────────────────────────────────────────────

export interface HolyWarPressureResult {
  civA: CivId;
  civB: CivId;
  pressure: number;
}

/**
 * Returns pairs of civs where religious tension adds holy war pressure.
 * Consumed by ConflictEngine when calculating war pressure components.
 */
export function getHolyWarPressure(state: WorldState): HolyWarPressureResult[] {
  const results: HolyWarPressureResult[] = [];
  const civList = Array.from(state.civilizations.values());
  const threshold = state.config.spacing * SPREAD_DISTANCE_FACTOR;

  for (let i = 0; i < civList.length; i++) {
    for (let j = i + 1; j < civList.length; j++) {
      const civA = civList[i];
      const civB = civList[j];
      if (!civA.faithId || !civB.faithId || civA.faithId === civB.faithId) continue;

      const faithA = ReligionRegistry.get(civA.faithId);
      if (!faithA) continue;

      const isAggressiveFaith =
        faithA.tenets.includes('militant') && faithA.tenets.includes('proselytizing');
      if (!isAggressiveFaith) continue;

      // Check proximity
      const tilesA = state.tiles.filter(t => t.ownerId === civA.id);
      const tilesB = state.tiles.filter(t => t.ownerId === civB.id);
      const adjacent = tilesA.some(a =>
        tilesB.some(b => {
          const dx = a.x - b.x, dy = a.y - b.y;
          return Math.sqrt(dx * dx + dy * dy) <= threshold;
        }),
      );
      if (adjacent) results.push({ civA: civA.id, civB: civB.id, pressure: 15 });
    }
  }
  return results;
}

// ─── Main engine ─────────────────────────────────────────────────────────────

export class ReligionEngine {
  tick(state: WorldState): WorldState {
    let civs  = state.civilizations;
    let chronicle = state.chronicle;

    // 1. Found new religions
    for (const civ of Array.from(civs.values())) {
      const result = maybeFounded(civ, { ...state, civilizations: civs, chronicle });
      civs      = result.civs;
      chronicle = result.chronicle;
    }

    // 2. Process schisms (clear religious_schism instability flag)
    civs = processSchisms({ ...state, civilizations: civs });

    // 3. Spread religion to adjacent tiles
    const spread = spreadReligion({ ...state, civilizations: civs });
    const tiles  = spread.tiles;
    civs = spread.civs;

    // 4. Check for extinctions
    checkExtinction(state, civs);

    return { ...state, civilizations: civs, tiles, chronicle };
  }
}
