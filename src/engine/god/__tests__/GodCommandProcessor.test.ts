import { describe, it, expect, beforeEach } from 'vitest';
import { processGodCommands } from '../GodCommandProcessor';
import { resetIdGen } from '../../core/idgen';
import type { Civilization } from '../../../types/civilization';
import type { Tile, WorldState } from '../../../types/world';
import { BiomeType } from '../../../types/terrain';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTile(index: number, overrides: Partial<Tile> = {}): Tile {
  return {
    index, x: index * 55, y: 0,
    elevation: 0.4, moisture: 0.5, temperature: 0.2,
    biome: BiomeType.Grassland,
    isWater: false, isRiver: false, riverFlow: null,
    ownerId: null, religionId: null,
    ...overrides,
  };
}

function makeCiv(id: string, overrides: Partial<Civilization> = {}): Civilization {
  return {
    id, name: `${id} Kingdom`, speciesId: 'human', color: '#e63946',
    capitalTile: 0, territory: [0], population: 1000, treasury: 50,
    era: 'Stone', techLevel: 0, faithId: null,
    military: { baseStrength: 100, morale: 1.0, supplyLine: 1.0, effectiveStrength: 100 },
    lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: [], collapseRisk: 0 },
    foundedTick: 0,
    ...overrides,
  };
}

function makeState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick: 10,
    tiles: [makeTile(0), makeTile(1), makeTile(2)],
    civilizations: new Map([['civ-0', makeCiv('civ-0')]]),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
    ...overrides,
  };
}

beforeEach(() => {
  resetIdGen();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('processGodCommands', () => {
  it('returns the same state for an empty command array', () => {
    const state = makeState();
    const result = processGodCommands([], state);
    expect(result).toBe(state);
  });

  describe('RAISE_TERRAIN', () => {
    it('increases tile elevation by the given amount', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'RAISE_TERRAIN', tiles: [0], amount: 0.1 }], state);
      expect(result.tiles[0].elevation).toBeCloseTo(0.5);
    });

    it('clamps elevation to 1.0', () => {
      const state = makeState({ tiles: [makeTile(0, { elevation: 0.95 }), makeTile(1), makeTile(2)] });
      const result = processGodCommands([{ type: 'RAISE_TERRAIN', tiles: [0], amount: 0.2 }], state);
      expect(result.tiles[0].elevation).toBe(1);
    });

    it('does not mutate the input state', () => {
      const state = makeState();
      processGodCommands([{ type: 'RAISE_TERRAIN', tiles: [0], amount: 0.1 }], state);
      expect(state.tiles[0].elevation).toBe(0.4);
    });

    it('recalculates biome after elevation change', () => {
      // Raise a tile above sea level (0.5) enough to become beach or higher
      const state = makeState({ tiles: [makeTile(0, { elevation: 0.48, biome: BiomeType.ShallowSea }), makeTile(1), makeTile(2)] });
      const result = processGodCommands([{ type: 'RAISE_TERRAIN', tiles: [0], amount: 0.05 }], state);
      expect(result.tiles[0].biome).not.toBe(BiomeType.ShallowSea);
    });
  });

  describe('LOWER_TERRAIN', () => {
    it('decreases tile elevation by the given amount', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'LOWER_TERRAIN', tiles: [0], amount: 0.1 }], state);
      expect(result.tiles[0].elevation).toBeCloseTo(0.3);
    });

    it('clamps elevation to -1 (deep ocean floor)', () => {
      const state = makeState({ tiles: [makeTile(0, { elevation: -0.9 }), makeTile(1), makeTile(2)] });
      const result = processGodCommands([{ type: 'LOWER_TERRAIN', tiles: [0], amount: 0.5 }], state);
      expect(result.tiles[0].elevation).toBe(-1);
    });

    it('sets isWater true when elevation drops below 0', () => {
      const state = makeState({ tiles: [makeTile(0, { elevation: 0.05, isWater: false }), makeTile(1), makeTile(2)] });
      const result = processGodCommands([{ type: 'LOWER_TERRAIN', tiles: [0], amount: 0.2 }], state);
      expect(result.tiles[0].isWater).toBe(true);
      expect(result.tiles[0].elevation).toBeCloseTo(-0.15);
    });

    it('only affects specified tiles', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'LOWER_TERRAIN', tiles: [0], amount: 0.1 }], state);
      expect(result.tiles[1].elevation).toBe(0.4);
    });
  });

  describe('SET_BIOME', () => {
    it('sets the biome of specified tiles', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'SET_BIOME', tiles: [0, 1], biome: BiomeType.Desert }], state);
      expect(result.tiles[0].biome).toBe(BiomeType.Desert);
      expect(result.tiles[1].biome).toBe(BiomeType.Desert);
    });

    it('does not change unspecified tiles', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'SET_BIOME', tiles: [0], biome: BiomeType.Desert }], state);
      expect(result.tiles[2].biome).toBe(BiomeType.Grassland);
    });
  });

  describe('FORCE_WAR', () => {
    it('adds a WarState to state.wars', () => {
      const state = makeState({
        civilizations: new Map([['civ-0', makeCiv('civ-0')], ['civ-1', makeCiv('civ-1')]]),
      });
      const result = processGodCommands([{ type: 'FORCE_WAR', aggressor: 'civ-0', defender: 'civ-1' }], state);
      expect(result.wars).toHaveLength(1);
      expect(result.wars[0].cause).toBe('god_command');
      expect(result.wars[0].aggressorId).toBe('civ-0');
      expect(result.wars[0].defenderId).toBe('civ-1');
    });

    it('does not add a duplicate war if already at war', () => {
      const state = makeState({
        wars: [{
          id: 'war-0', aggressorId: 'civ-0', defenderId: 'civ-1',
          declaredTick: 5, cause: 'border_tension', warScore: 0,
          casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
        }],
      });
      const result = processGodCommands([{ type: 'FORCE_WAR', aggressor: 'civ-0', defender: 'civ-1' }], state);
      expect(result.wars).toHaveLength(1);
    });
  });

  describe('DIVINE_BLESSING', () => {
    it('military boost increases effectiveStrength', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'DIVINE_BLESSING', targetCiv: 'civ-0', boost: 'military' }], state);
      const civ = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
      expect(civ.military.effectiveStrength).toBeGreaterThan(100);
    });

    it('food boost increases population', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'DIVINE_BLESSING', targetCiv: 'civ-0', boost: 'food' }], state);
      const civ = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
      expect(civ.population).toBeGreaterThan(1000);
    });

    it('stability boost increases stabilityScore and clears flags', () => {
      const state = makeState({
        civilizations: new Map([['civ-0', makeCiv('civ-0', {
          lifecycle: { phase: 'decline', phaseEnteredTick: 0, stabilityScore: 30, instabilityFlags: ['famine'], collapseRisk: 0.5 },
        })]]),
      });
      const result = processGodCommands([{ type: 'DIVINE_BLESSING', targetCiv: 'civ-0', boost: 'stability' }], state);
      const civ = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
      expect(civ.lifecycle.stabilityScore).toBe(60);
      expect(civ.lifecycle.instabilityFlags).toHaveLength(0);
    });

    it('tech boost increases techLevel by 1', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'DIVINE_BLESSING', targetCiv: 'civ-0', boost: 'tech' }], state);
      const civ = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
      expect(civ.techLevel).toBe(1);
    });

    it('adds a divine_intervention chronicle entry', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'DIVINE_BLESSING', targetCiv: 'civ-0', boost: 'food' }], state);
      expect(result.chronicle.some(e => e.eventType === 'divine_intervention')).toBe(true);
    });

    it('does nothing when targetCiv does not exist', () => {
      const state = makeState();
      expect(() =>
        processGodCommands([{ type: 'DIVINE_BLESSING', targetCiv: 'nonexistent', boost: 'food' }], state),
      ).not.toThrow();
      expect(state.civilizations.size).toBe(1);
    });
  });

  describe('PLAGUE', () => {
    it('reduces civ population', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'PLAGUE', targetCiv: 'civ-0', severity: 0.5 }], state);
      const civ = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
      expect(civ.population).toBeLessThan(1000);
    });

    it('adds a plague chronicle entry', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'PLAGUE', targetCiv: 'civ-0', severity: 0.5 }], state);
      expect(result.chronicle.some(e => e.eventType === 'plague')).toBe(true);
    });

    it('does nothing when targetCiv does not exist', () => {
      const state = makeState();
      expect(() =>
        processGodCommands([{ type: 'PLAGUE', targetCiv: 'nobody', severity: 0.5 }], state),
      ).not.toThrow();
    });
  });

  describe('SPAWN_CIVILIZATION', () => {
    it('adds a new civilization to the map', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'SPAWN_CIVILIZATION', tile: 0, speciesId: 'human' }], state);
      expect(result.civilizations.size).toBe(2);
    });

    it('sets the tile ownerId to the new civ', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'SPAWN_CIVILIZATION', tile: 0, speciesId: 'human' }], state);
      const newCivId = Array.from(result.civilizations.keys()).find(k => k !== 'civ-0')!;
      expect(result.tiles[0].ownerId).toBe(newCivId);
    });

    it('adds a divine_intervention chronicle entry', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'SPAWN_CIVILIZATION', tile: 0, speciesId: 'human' }], state);
      expect(result.chronicle.some(e => e.eventType === 'divine_intervention')).toBe(true);
    });
  });

  describe('disaster commands', () => {
    it('VOLCANIC_ERUPTION adds a natural_disaster chronicle entry', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'VOLCANIC_ERUPTION', epicenter: 0, magnitude: 0.8 }], state);
      expect(result.chronicle.some(e => e.eventType === 'natural_disaster')).toBe(true);
    });

    it('METEOR_IMPACT adds a natural_disaster chronicle entry', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'METEOR_IMPACT', epicenter: 0, radius: 2 }], state);
      expect(result.chronicle.some(e => e.eventType === 'natural_disaster')).toBe(true);
    });

    it('FLOOD reduces moisture and adds a chronicle entry', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'FLOOD', region: [0], severity: 0.7 }], state);
      expect(result.tiles[0].elevation).toBeLessThan(state.tiles[0].elevation);
      expect(result.chronicle.some(e => e.eventType === 'natural_disaster')).toBe(true);
    });

    it('DROUGHT reduces moisture on affected tiles', () => {
      const state = makeState();
      const result = processGodCommands([{ type: 'DROUGHT', region: [0], duration: 10 }], state);
      expect(result.tiles[0].moisture).toBeLessThan(state.tiles[0].moisture);
    });
  });

  describe('multiple commands', () => {
    it('applies commands sequentially', () => {
      const state = makeState();
      const result = processGodCommands([
        { type: 'RAISE_TERRAIN', tiles: [0], amount: 0.1 },
        { type: 'RAISE_TERRAIN', tiles: [0], amount: 0.1 },
      ], state);
      expect(result.tiles[0].elevation).toBeCloseTo(0.6);
    });
  });
});
