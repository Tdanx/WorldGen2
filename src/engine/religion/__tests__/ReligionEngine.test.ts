import { describe, it, expect, beforeEach } from 'vitest';
import { ReligionEngine, getHolyWarPressure } from '../ReligionEngine';
import { ReligionRegistry } from '../../../registries/ReligionRegistry';
import { resetIdGen } from '../../core/idgen';
import type { Civilization } from '../../../types/civilization';
import type { Tile, WorldState } from '../../../types/world';
import { BiomeType } from '../../../types/terrain';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTile(index: number, x: number, y: number, ownerId: string | null = null): Tile {
  return {
    index, x, y,
    elevation: 0.4, moisture: 0.5, temperature: 0.2,
    biome: BiomeType.Grassland,
    isWater: false, isRiver: false, riverFlow: null,
    ownerId, religionId: null,
  };
}

function makeCiv(id: string, overrides: Partial<Civilization> = {}): Civilization {
  return {
    id, name: `${id} Kingdom`, speciesId: 'lizardfolk', color: '#0f0',
    capitalTile: 0, territory: [0], population: 1000, treasury: 50,
    era: 'Stone', techLevel: 0, faithId: null,
    military: { baseStrength: 100, morale: 1, supplyLine: 1, effectiveStrength: 100 },
    lifecycle: {
      phase: 'growth', phaseEnteredTick: 0,
      stabilityScore: 80, instabilityFlags: [], collapseRisk: 0,
    },
    foundedTick: 0,
    ...overrides,
  };
}

// lizardfolk has religiosity=0.8 → above the 0.7 threshold for founding
function makeHighReligiosityCiv(id: string, overrides: Partial<Civilization> = {}): Civilization {
  return makeCiv(id, { speciesId: 'lizardfolk', ...overrides });
}

function makeState(tick: number, civs: Civilization[], tileOverrides: Partial<Tile>[] = []): WorldState {
  const tiles: Tile[] = civs.map((c, i) => ({
    ...makeTile(i, i * 55, 0, c.id),
    ...tileOverrides[i],
  }));
  return {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick,
    tiles,
    civilizations: new Map(civs.map(c => [c.id, c])),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
  };
}

beforeEach(() => {
  ReligionRegistry.reset();
  resetIdGen();
});

// ─── Religion founding ────────────────────────────────────────────────────────

describe('ReligionEngine — founding', () => {
  it('founds a religion on a multiple-of-50 tick for eligible civ', () => {
    const engine = new ReligionEngine();
    const civ = makeHighReligiosityCiv('civ-0', { lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: [], collapseRisk: 0 } });
    const state = makeState(50, [civ]);
    const result = engine.tick(state);
    const updatedCiv = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
    expect(updatedCiv.faithId).not.toBeNull();
  });

  it('does NOT found a religion on a non-multiple-of-50 tick', () => {
    const engine = new ReligionEngine();
    const civ = makeHighReligiosityCiv('civ-0');
    const state = makeState(51, [civ]);
    const result = engine.tick(state);
    const updatedCiv = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
    expect(updatedCiv.faithId).toBeNull();
  });

  it('does NOT found a religion for a civ that already has one', () => {
    const engine = new ReligionEngine();
    const existingFaithId = ReligionRegistry.found({
      name: 'Old Faith', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['pacifist'], splitFrom: null, extinctTick: null,
      color: '#fff', followerCivIds: new Set(['civ-0']),
    });
    const civ = makeHighReligiosityCiv('civ-0', { faithId: existingFaithId });
    const state = makeState(50, [civ]);
    engine.tick(state);
    // Only the pre-existing faith should exist
    expect(ReligionRegistry.getActive()).toHaveLength(1);
  });

  it('does NOT found for low-religiosity species (human religiosity=0.5)', () => {
    const engine = new ReligionEngine();
    const civ = makeCiv('civ-0', { speciesId: 'human' });
    const state = makeState(50, [civ]);
    const result = engine.tick(state);
    const updatedCiv = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
    expect(updatedCiv.faithId).toBeNull();
  });

  it('does NOT found when stability is too low', () => {
    const engine = new ReligionEngine();
    const civ = makeHighReligiosityCiv('civ-0', {
      lifecycle: { phase: 'decline', phaseEnteredTick: 0, stabilityScore: 40, instabilityFlags: [], collapseRisk: 0.5 },
    });
    const state = makeState(50, [civ]);
    const result = engine.tick(state);
    const updatedCiv = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
    expect(updatedCiv.faithId).toBeNull();
  });

  it('does NOT found for a collapsing civ', () => {
    const engine = new ReligionEngine();
    const civ = makeHighReligiosityCiv('civ-0', {
      lifecycle: { phase: 'collapse', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: [], collapseRisk: 1 },
    });
    const state = makeState(50, [civ]);
    const result = engine.tick(state);
    const updatedCiv = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
    expect(updatedCiv.faithId).toBeNull();
  });

  it('adds a chronicle entry when founding', () => {
    const engine = new ReligionEngine();
    const civ = makeHighReligiosityCiv('civ-0');
    const state = makeState(50, [civ]);
    const result = engine.tick(state);
    expect(result.chronicle.length).toBeGreaterThan(0);
  });

  it('registers the new religion in ReligionRegistry', () => {
    const engine = new ReligionEngine();
    const civ = makeHighReligiosityCiv('civ-0');
    const state = makeState(50, [civ]);
    engine.tick(state);
    expect(ReligionRegistry.getActive()).toHaveLength(1);
  });
});

// ─── Schism ───────────────────────────────────────────────────────────────────

describe('ReligionEngine — schism', () => {
  it('creates a new derived religion when civ has religious_schism flag', () => {
    const engine = new ReligionEngine();
    const faithId = ReligionRegistry.found({
      name: 'Old Faith', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['pacifist'], splitFrom: null, extinctTick: null,
      color: '#ccc', followerCivIds: new Set(['civ-0']),
    });
    const civ = makeHighReligiosityCiv('civ-0', {
      faithId,
      lifecycle: { phase: 'decline', phaseEnteredTick: 0, stabilityScore: 30, instabilityFlags: ['religious_schism'], collapseRisk: 0.4 },
    });
    const state = makeState(60, [civ]); // tick not multiple of 50 → no founding
    engine.tick(state);
    // The schism creates a new religion; the original loses its only follower → extinct.
    // Total religions = 2 (1 original extinct + 1 new schism active).
    expect(ReligionRegistry.getAll()).toHaveLength(2);
    expect(ReligionRegistry.getActive()).toHaveLength(1);
    expect(ReligionRegistry.getActive()[0].splitFrom).toBe(faithId);
  });

  it('clears the religious_schism instability flag after processing', () => {
    const engine = new ReligionEngine();
    const faithId = ReligionRegistry.found({
      name: 'Old Faith', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['pacifist'], splitFrom: null, extinctTick: null,
      color: '#ccc', followerCivIds: new Set(['civ-0']),
    });
    const civ = makeHighReligiosityCiv('civ-0', {
      faithId,
      lifecycle: { phase: 'decline', phaseEnteredTick: 0, stabilityScore: 30, instabilityFlags: ['religious_schism'], collapseRisk: 0.4 },
    });
    const state = makeState(60, [civ]);
    const result = engine.tick(state);
    const updatedCiv = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
    expect(updatedCiv.lifecycle.instabilityFlags).not.toContain('religious_schism');
  });

  it('updates the civ faithId to the new schism religion', () => {
    const engine = new ReligionEngine();
    const faithId = ReligionRegistry.found({
      name: 'Old Faith', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['pacifist'], splitFrom: null, extinctTick: null,
      color: '#ccc', followerCivIds: new Set(['civ-0']),
    });
    const civ = makeHighReligiosityCiv('civ-0', {
      faithId,
      lifecycle: { phase: 'decline', phaseEnteredTick: 0, stabilityScore: 30, instabilityFlags: ['religious_schism'], collapseRisk: 0.4 },
    });
    const state = makeState(60, [civ]);
    const result = engine.tick(state);
    const updatedCiv = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
    expect(updatedCiv.faithId).not.toBe(faithId);
    expect(updatedCiv.faithId).not.toBeNull();
  });
});

// ─── Extinction ───────────────────────────────────────────────────────────────

describe('ReligionEngine — extinction', () => {
  it('marks a religion extinct when all follower civs are gone', () => {
    const engine = new ReligionEngine();
    const faithId = ReligionRegistry.found({
      name: 'Lost Faith', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['pacifist'], splitFrom: null, extinctTick: null,
      color: '#888', followerCivIds: new Set(), // no followers
    });
    const civ = makeCiv('civ-0'); // no faithId
    const state = makeState(10, [civ]);
    engine.tick(state);
    const faith = ReligionRegistry.get(faithId)!;
    expect(faith.extinctTick).not.toBeNull();
  });

  it('does not extinguish a religion that still has living followers', () => {
    const engine = new ReligionEngine();
    const faithId = ReligionRegistry.found({
      name: 'Living Faith', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['pacifist'], splitFrom: null, extinctTick: null,
      color: '#aaf', followerCivIds: new Set(['civ-0']),
    });
    const civ = makeCiv('civ-0', { faithId });
    const state = makeState(10, [civ]);
    engine.tick(state);
    const faith = ReligionRegistry.get(faithId)!;
    expect(faith.extinctTick).toBeNull();
  });
});

// ─── Spread ───────────────────────────────────────────────────────────────────

describe('ReligionEngine — spread', () => {
  it('converts a neighbouring tile when proselytizing faith is adjacent', () => {
    // Use seed and tick that produce rng() < 0.10 for tile index 1
    // We'll try multiple ticks and confirm at least one conversion happens
    const engine = new ReligionEngine();
    const faithId = ReligionRegistry.found({
      name: 'Spread Faith', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['proselytizing', 'militant'], splitFrom: null, extinctTick: null,
      color: '#f0f', followerCivIds: new Set(['civ-0']),
    });
    const civA = makeCiv('civ-0', { faithId });
    const civB = makeCiv('civ-1', { faithId: null });

    let converted = false;
    for (let tick = 1; tick <= 100; tick++) {
      const state = makeState(tick, [civA, civB]);
      const result = engine.tick(state);
      if (result.tiles[1].religionId === faithId) {
        converted = true;
        break;
      }
    }
    expect(converted).toBe(true);
  });

  it('does not spread non-proselytizing faiths', () => {
    const engine = new ReligionEngine();
    const faithId = ReligionRegistry.found({
      name: 'Isolate Faith', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['isolationist', 'pacifist'], splitFrom: null, extinctTick: null,
      color: '#555', followerCivIds: new Set(['civ-0']),
    });
    const civA = makeCiv('civ-0', { faithId });
    const civB = makeCiv('civ-1', { faithId: null });
    let anyConverted = false;
    for (let tick = 1; tick <= 100; tick++) {
      const state = makeState(tick, [civA, civB]);
      const result = engine.tick(state);
      if (result.tiles[1].religionId !== null) {
        anyConverted = true;
        break;
      }
    }
    expect(anyConverted).toBe(false);
  });

  it('does not spread to water tiles', () => {
    const engine = new ReligionEngine();
    const faithId = ReligionRegistry.found({
      name: 'Sea Test', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['proselytizing', 'militant'], splitFrom: null, extinctTick: null,
      color: '#00f', followerCivIds: new Set(['civ-0']),
    });
    const civA = makeCiv('civ-0', { faithId });
    const civB = makeCiv('civ-1');
    for (let tick = 1; tick <= 100; tick++) {
      const state = makeState(tick, [civA, civB], [
        {},
        { isWater: true, biome: BiomeType.ShallowSea },
      ]);
      const result = engine.tick(state);
      expect(result.tiles[1].religionId).toBeNull();
    }
  });
});

// ─── getHolyWarPressure ───────────────────────────────────────────────────────

describe('getHolyWarPressure', () => {
  it('returns pressure for adjacent militant+proselytizing vs different-faith civ', () => {
    const faithA = ReligionRegistry.found({
      name: 'Flame', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['militant', 'proselytizing'], splitFrom: null, extinctTick: null,
      color: '#f00', followerCivIds: new Set(['civ-0']),
    });
    const faithB = ReligionRegistry.found({
      name: 'Water', founderCivId: 'civ-1', foundedTick: 2,
      tenets: ['pacifist'], splitFrom: null, extinctTick: null,
      color: '#00f', followerCivIds: new Set(['civ-1']),
    });
    const civA = makeCiv('civ-0', { faithId: faithA });
    const civB = makeCiv('civ-1', { faithId: faithB });
    const state = makeState(10, [civA, civB]); // tiles at x=0 and x=55 — adjacent
    const results = getHolyWarPressure(state);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].pressure).toBe(15);
  });

  it('returns no pressure when civs share the same faith', () => {
    const faithId = ReligionRegistry.found({
      name: 'Shared', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['militant', 'proselytizing'], splitFrom: null, extinctTick: null,
      color: '#ff0', followerCivIds: new Set(['civ-0', 'civ-1']),
    });
    const civA = makeCiv('civ-0', { faithId });
    const civB = makeCiv('civ-1', { faithId });
    const state = makeState(10, [civA, civB]);
    expect(getHolyWarPressure(state)).toHaveLength(0);
  });

  it('returns no pressure when aggressor faith lacks both tenets', () => {
    const faithA = ReligionRegistry.found({
      name: 'Peaceful', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['pacifist', 'proselytizing'], // militant missing
      splitFrom: null, extinctTick: null,
      color: '#0f0', followerCivIds: new Set(['civ-0']),
    });
    const faithB = ReligionRegistry.found({
      name: 'Other', founderCivId: 'civ-1', foundedTick: 2,
      tenets: ['monotheistic'], splitFrom: null, extinctTick: null,
      color: '#fff', followerCivIds: new Set(['civ-1']),
    });
    const civA = makeCiv('civ-0', { faithId: faithA });
    const civB = makeCiv('civ-1', { faithId: faithB });
    const state = makeState(10, [civA, civB]);
    expect(getHolyWarPressure(state)).toHaveLength(0);
  });
});

// ─── General tick contract ────────────────────────────────────────────────────

describe('ReligionEngine.tick — contract', () => {
  it('returns a new WorldState reference', () => {
    const engine = new ReligionEngine();
    const civ = makeCiv('civ-0');
    const state = makeState(1, [civ]);
    expect(engine.tick(state)).not.toBe(state);
  });

  it('does not mutate input civilizations map', () => {
    const engine = new ReligionEngine();
    const civ = makeHighReligiosityCiv('civ-0');
    const state = makeState(50, [civ]);
    const originalCiv = state.civilizations.get('civ-0')!;
    engine.tick(state);
    expect(state.civilizations.get('civ-0')).toBe(originalCiv);
  });
});
