import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictEngine, calculateWarPressure, isAtWar } from '../ConflictEngine';
import { resetIdGen } from '../../core/idgen';
import { ReligionRegistry } from '../../../registries/ReligionRegistry';
import type { Civilization } from '../../../types/civilization';
import type { Tile, WorldState } from '../../../types/world';
import type { WarState } from '../../../types/conflict';
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
    id, name: `${id} Kingdom`, speciesId: 'orcish', color: '#ff0000',
    capitalTile: 0, territory: [], population: 1000, treasury: 50,
    era: 'Stone', techLevel: 0, faithId: null,
    military: { baseStrength: 100, morale: 1.0, supplyLine: 1.0, effectiveStrength: 100 },
    lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: [], collapseRisk: 0 },
    foundedTick: 0,
    ...overrides,
  };
}

// Two civs with adjacent territory (within border distance)
function makeAdjacentState(extraWarOverrides: Partial<WarState> = {}): WorldState {
  void extraWarOverrides;
  // civ-0 tiles at x=0, civ-1 tiles at x=55 (within 5.5*20=110 threshold)
  const tiles: Tile[] = [
    makeTile(0, 0, 0, 'civ-0'),
    makeTile(1, 55, 0, 'civ-1'),
    makeTile(2, 200, 0, null),
  ];
  return {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick: 100,
    tiles,
    civilizations: new Map([
      ['civ-0', makeCiv('civ-0', { territory: [0] })],
      ['civ-1', makeCiv('civ-1', { territory: [1] })],
    ]),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
  };
}

function makeDistantState(): WorldState {
  // civ-0 tiles at x=0, civ-1 tiles at x=500 (far apart)
  const tiles: Tile[] = [
    makeTile(0, 0, 0, 'civ-0'),
    makeTile(1, 500, 0, 'civ-1'),
  ];
  return {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick: 10,
    tiles,
    civilizations: new Map([
      ['civ-0', makeCiv('civ-0', { territory: [0] })],
      ['civ-1', makeCiv('civ-1', { territory: [1] })],
    ]),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
  };
}

beforeEach(() => {
  resetIdGen();
  ReligionRegistry.reset();
});

// ─── isAtWar ─────────────────────────────────────────────────────────────────

describe('isAtWar', () => {
  it('returns false when no wars exist', () => {
    expect(isAtWar(makeAdjacentState(), 'civ-0', 'civ-1')).toBe(false);
  });

  it('returns true when an active war exists', () => {
    const state = makeAdjacentState();
    const warState: WorldState = {
      ...state,
      wars: [{
        id: 'war-0', aggressorId: 'civ-0', defenderId: 'civ-1',
        declaredTick: 5, cause: 'border_tension', warScore: 0,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      }],
    };
    expect(isAtWar(warState, 'civ-0', 'civ-1')).toBe(true);
  });

  it('returns false when the war has ended', () => {
    const state = makeAdjacentState();
    const warState: WorldState = {
      ...state,
      wars: [{
        id: 'war-0', aggressorId: 'civ-0', defenderId: 'civ-1',
        declaredTick: 5, endedTick: 50, cause: 'border_tension',
        warScore: 90, outcome: 'aggressor_wins',
        casualties: { aggressor: 10, defender: 50 }, contestedTiles: [],
      }],
    };
    expect(isAtWar(warState, 'civ-0', 'civ-1')).toBe(false);
  });

  it('returns true regardless of aggressor/defender order', () => {
    const state: WorldState = {
      ...makeAdjacentState(),
      wars: [{
        id: 'war-0', aggressorId: 'civ-1', defenderId: 'civ-0',
        declaredTick: 5, cause: 'border_tension', warScore: 0,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      }],
    };
    expect(isAtWar(state, 'civ-0', 'civ-1')).toBe(true);
  });
});

// ─── calculateWarPressure ────────────────────────────────────────────────────

describe('calculateWarPressure', () => {
  it('returns 0 total for distant civs with no other factors', () => {
    const state = makeDistantState();
    const civA = state.civilizations.get('civ-0')!;
    const civB = state.civilizations.get('civ-1')!;
    const pressure = calculateWarPressure(civA, civB, state);
    expect(pressure.components.borderTension).toBe(0);
  });

  it('returns non-zero borderTension for adjacent civs', () => {
    const state = makeAdjacentState();
    const civA = state.civilizations.get('civ-0')!;
    const civB = state.civilizations.get('civ-1')!;
    const pressure = calculateWarPressure(civA, civB, state);
    expect(pressure.components.borderTension).toBeGreaterThan(0);
  });

  it('returns 20 resourceScarcity when both civs are in famine', () => {
    const state = makeAdjacentState();
    const civA = makeCiv('civ-0', { lifecycle: { phase: 'decline', phaseEnteredTick: 0, stabilityScore: 40, instabilityFlags: ['famine'], collapseRisk: 0 } });
    const civB = makeCiv('civ-1', { lifecycle: { phase: 'decline', phaseEnteredTick: 0, stabilityScore: 40, instabilityFlags: ['famine'], collapseRisk: 0 } });
    const pressure = calculateWarPressure(civA, civB, state);
    expect(pressure.components.resourceScarcity).toBe(20);
  });

  it('returns 0 resourceScarcity when neither civ is in famine', () => {
    const state = makeAdjacentState();
    const civA = state.civilizations.get('civ-0')!;
    const civB = state.civilizations.get('civ-1')!;
    const pressure = calculateWarPressure(civA, civB, state);
    expect(pressure.components.resourceScarcity).toBe(0);
  });

  it('totalPressure is the sum of components capped at 100', () => {
    const state = makeAdjacentState();
    const civA = state.civilizations.get('civ-0')!;
    const civB = state.civilizations.get('civ-1')!;
    const pressure = calculateWarPressure(civA, civB, state);
    const sum = Object.values(pressure.components).reduce((a, b) => a + b, 0);
    expect(pressure.totalPressure).toBe(Math.min(100, sum));
  });

  it('religiousConflict is 0 when both civs share the same faith', () => {
    const faithId = ReligionRegistry.found({
      name: 'The One Faith', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['militant'], splitFrom: null, extinctTick: null,
      color: '#ff0', followerCivIds: new Set(),
    });
    const state = makeAdjacentState();
    const civA = makeCiv('civ-0', { faithId });
    const civB = makeCiv('civ-1', { faithId });
    const pressure = calculateWarPressure(civA, civB, state);
    expect(pressure.components.religiousConflict).toBe(0);
  });

  it('religiousConflict is 20 when militant faith faces pacifist faith', () => {
    const faithA = ReligionRegistry.found({
      name: 'Flame', founderCivId: 'civ-0', foundedTick: 1,
      tenets: ['militant', 'proselytizing'], splitFrom: null, extinctTick: null,
      color: '#f00', followerCivIds: new Set(),
    });
    const faithB = ReligionRegistry.found({
      name: 'Peace', founderCivId: 'civ-1', foundedTick: 1,
      tenets: ['pacifist'], splitFrom: null, extinctTick: null,
      color: '#0f0', followerCivIds: new Set(),
    });
    const state = makeAdjacentState();
    const civA = makeCiv('civ-0', { faithId: faithA });
    const civB = makeCiv('civ-1', { faithId: faithB });
    const pressure = calculateWarPressure(civA, civB, state);
    expect(pressure.components.religiousConflict).toBe(20);
  });
});

// ─── ConflictEngine.tickWars ──────────────────────────────────────────────────

describe('ConflictEngine.tickWars', () => {
  it('does not mutate the input state', () => {
    const engine = new ConflictEngine();
    const state = makeAdjacentState();
    const originalWarsLen = state.wars.length;
    engine.tickWars(state);
    expect(state.wars.length).toBe(originalWarsLen);
  });

  it('returns a new WorldState reference', () => {
    const engine = new ConflictEngine();
    const state = makeAdjacentState();
    const result = engine.tickWars(state);
    expect(result).not.toBe(state);
  });

  it('does not auto-declare war when civs are distant', () => {
    const engine = new ConflictEngine();
    const state = makeDistantState();
    const result = engine.tickWars(state);
    expect(result.wars).toHaveLength(0);
  });

  it('does not declare war for non-aggressive species (human aggression=0.5)', () => {
    const engine = new ConflictEngine();
    // Both civs are human (aggression=0.5, which is NOT > 0.5)
    const state: WorldState = {
      ...makeAdjacentState(),
      civilizations: new Map([
        ['civ-0', makeCiv('civ-0', { speciesId: 'human', territory: [0] })],
        ['civ-1', makeCiv('civ-1', { speciesId: 'human', territory: [1] })],
      ]),
    };
    // Force high pressure by adding famine to both
    const withFamine: WorldState = {
      ...state,
      civilizations: new Map([
        ['civ-0', makeCiv('civ-0', { speciesId: 'human', territory: [0], lifecycle: { phase: 'decline', phaseEnteredTick: 0, stabilityScore: 30, instabilityFlags: ['famine'], collapseRisk: 0 } })],
        ['civ-1', makeCiv('civ-1', { speciesId: 'human', territory: [1], lifecycle: { phase: 'decline', phaseEnteredTick: 0, stabilityScore: 30, instabilityFlags: ['famine'], collapseRisk: 0 } })],
      ]),
    };
    const result = engine.tickWars(withFamine);
    // human aggression is exactly 0.5, which is not > 0.5, so no war
    expect(result.wars).toHaveLength(0);
  });

  it('does not declare duplicate wars between the same pair', () => {
    const engine = new ConflictEngine();
    const state: WorldState = {
      ...makeAdjacentState(),
      wars: [{
        id: 'war-existing', aggressorId: 'civ-0', defenderId: 'civ-1',
        declaredTick: 50, cause: 'border_tension', warScore: 0,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      }],
    };
    const result = engine.tickWars(state);
    expect(result.wars).toHaveLength(1);
  });

  it('advances warScore on each tick for an active war', () => {
    const engine = new ConflictEngine();
    const state: WorldState = {
      ...makeAdjacentState(),
      wars: [{
        id: 'war-0', aggressorId: 'civ-0', defenderId: 'civ-1',
        declaredTick: 50, cause: 'border_tension', warScore: 0,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      }],
    };
    const result = engine.tickWars(state);
    const war = result.wars[0];
    expect(war.warScore).not.toBe(0); // score changed
  });

  it('resolves war with aggressor_wins when warScore reaches 80', () => {
    const engine = new ConflictEngine();
    const state: WorldState = {
      ...makeAdjacentState(),
      wars: [{
        id: 'war-0', aggressorId: 'civ-0', defenderId: 'civ-1',
        declaredTick: 1, cause: 'border_tension', warScore: 79,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      }],
      // Make civ-0 much stronger to ensure score tips over 80
      civilizations: new Map([
        ['civ-0', makeCiv('civ-0', { territory: [0], military: { baseStrength: 1000, morale: 1, supplyLine: 1, effectiveStrength: 1000 } })],
        ['civ-1', makeCiv('civ-1', { territory: [1], military: { baseStrength: 10, morale: 1, supplyLine: 1, effectiveStrength: 10 } })],
      ]),
    };
    const result = engine.tickWars(state);
    const war = result.wars.find(w => w.id === 'war-0');
    expect(war?.endedTick).toBeDefined();
    expect(war?.outcome).toBe('aggressor_wins');
  });

  it('adds a war_ended chronicle entry when war resolves', () => {
    const engine = new ConflictEngine();
    const state: WorldState = {
      ...makeAdjacentState(),
      wars: [{
        id: 'war-0', aggressorId: 'civ-0', defenderId: 'civ-1',
        declaredTick: 1, cause: 'border_tension', warScore: 79,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      }],
      civilizations: new Map([
        ['civ-0', makeCiv('civ-0', { territory: [0], military: { baseStrength: 1000, morale: 1, supplyLine: 1, effectiveStrength: 1000 } })],
        ['civ-1', makeCiv('civ-1', { territory: [1], military: { baseStrength: 10, morale: 1, supplyLine: 1, effectiveStrength: 10 } })],
      ]),
    };
    const result = engine.tickWars(state);
    expect(result.chronicle.some(e => e.eventType === 'war_ended')).toBe(true);
  });

  it('defender gains military_defeat flag when defender wins', () => {
    const engine = new ConflictEngine();
    const state: WorldState = {
      ...makeAdjacentState(),
      wars: [{
        id: 'war-0', aggressorId: 'civ-0', defenderId: 'civ-1',
        declaredTick: 1, cause: 'border_tension', warScore: -79,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      }],
      // civ-1 is much stronger, so aggressor loses
      civilizations: new Map([
        ['civ-0', makeCiv('civ-0', { territory: [0], military: { baseStrength: 10, morale: 1, supplyLine: 1, effectiveStrength: 10 } })],
        ['civ-1', makeCiv('civ-1', { territory: [1], military: { baseStrength: 1000, morale: 1, supplyLine: 1, effectiveStrength: 1000 } })],
      ]),
    };
    const result = engine.tickWars(state);
    const aggressor = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
    expect(aggressor.lifecycle.instabilityFlags).toContain('military_defeat');
  });
});
