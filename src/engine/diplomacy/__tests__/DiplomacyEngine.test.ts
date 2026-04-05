import { describe, it, expect, beforeEach } from 'vitest';
import { DiplomacyEngine, matrixKey } from '../DiplomacyEngine';
import { resetIdGen } from '../../core/idgen';
import type { Civilization } from '../../../types/civilization';
import type { DiplomacyEntry, DiplomaticPact, OpinionModifier } from '../../../types/diplomacy';
import type { WarState } from '../../../types/conflict';
import type { WorldState } from '../../../types/world';
import { BiomeType } from '../../../types/terrain';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCiv(id: string, name: string): Civilization {
  return {
    id, name, speciesId: 'human', color: '#fff',
    capitalTile: 0, territory: [0], population: 1000, treasury: 50,
    era: 'Stone', techLevel: 0, faithId: null,
    military: { baseStrength: 100, morale: 1, supplyLine: 1, effectiveStrength: 100 },
    lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: [], collapseRisk: 0 },
    foundedTick: 0,
  };
}

function makeState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick: 100,
    tiles: [{ index: 0, x: 0, y: 0, elevation: 0.4, moisture: 0.5, temperature: 0.2, biome: BiomeType.Grassland, isWater: false, isRiver: false, riverFlow: null, ownerId: null, religionId: null }],
    civilizations: new Map([
      ['civ-0', makeCiv('civ-0', 'Alpha Kingdom')],
      ['civ-1', makeCiv('civ-1', 'Beta Empire')],
    ]),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
    ...overrides,
  };
}

function makeWar(overrides: Partial<WarState> = {}): WarState {
  return {
    id: 'war-0', aggressorId: 'civ-0', defenderId: 'civ-1',
    declaredTick: 50, cause: 'border_tension', warScore: 90,
    casualties: { aggressor: 10, defender: 50 }, contestedTiles: [],
    ...overrides,
  };
}

beforeEach(() => {
  resetIdGen();
});

// ─── matrixKey ────────────────────────────────────────────────────────────────

describe('matrixKey', () => {
  it('produces the same key regardless of argument order', () => {
    expect(matrixKey('civ-0', 'civ-1')).toBe(matrixKey('civ-1', 'civ-0'));
  });

  it('puts the lexicographically smaller id first', () => {
    expect(matrixKey('civ-0', 'civ-1')).toBe('civ-0:civ-1');
    expect(matrixKey('civ-1', 'civ-0')).toBe('civ-0:civ-1');
  });
});

// ─── DiplomacyEngine.tick ────────────────────────────────────────────────────

describe('DiplomacyEngine.tick', () => {
  it('returns a new WorldState reference', () => {
    const engine = new DiplomacyEngine();
    const state = makeState();
    expect(engine.tick(state)).not.toBe(state);
  });

  it('does not mutate the input diplomacyMatrix', () => {
    const engine = new DiplomacyEngine();
    const state = makeState();
    const originalMatrix = state.diplomacyMatrix;
    engine.tick(state);
    expect(state.diplomacyMatrix).toBe(originalMatrix);
  });

  it('returns a new Map for diplomacyMatrix (not the same reference)', () => {
    const engine = new DiplomacyEngine();
    const state = makeState();
    const result = engine.tick(state);
    expect(result.diplomacyMatrix).not.toBe(state.diplomacyMatrix);
  });

  describe('opinion modifier aging', () => {
    it('removes expired opinion modifiers', () => {
      const engine = new DiplomacyEngine();
      const expiredMod: OpinionModifier = { source: 'old_grievance', value: -20, expiryTick: 50 };
      const entry: DiplomacyEntry = {
        status: 'peace',
        opinion: { civA: 'civ-0', civB: 'civ-1', score: -20, modifiers: [expiredMod] },
        pacts: [],
      };
      const state = makeState({ diplomacyMatrix: new Map([[matrixKey('civ-0', 'civ-1'), entry]]) });
      // tick=100, mod expires at tick=50 → should be removed
      const result = engine.tick(state);
      const updatedEntry = result.diplomacyMatrix.get(matrixKey('civ-0', 'civ-1'));
      expect(updatedEntry?.opinion.modifiers).toHaveLength(0);
    });

    it('retains non-expired opinion modifiers', () => {
      const engine = new DiplomacyEngine();
      const activeMod: OpinionModifier = { source: 'recent_trade', value: 15, expiryTick: 200 };
      const entry: DiplomacyEntry = {
        status: 'peace',
        opinion: { civA: 'civ-0', civB: 'civ-1', score: 15, modifiers: [activeMod] },
        pacts: [],
      };
      const state = makeState({ diplomacyMatrix: new Map([[matrixKey('civ-0', 'civ-1'), entry]]) });
      const result = engine.tick(state);
      const updatedEntry = result.diplomacyMatrix.get(matrixKey('civ-0', 'civ-1'));
      expect(updatedEntry?.opinion.modifiers).toHaveLength(1);
    });

    it('recalculates score after removing expired modifiers', () => {
      const engine = new DiplomacyEngine();
      const expiredMod: OpinionModifier = { source: 'old', value: -20, expiryTick: 50 };
      const activeMod: OpinionModifier = { source: 'active', value: 10, expiryTick: 200 };
      const entry: DiplomacyEntry = {
        status: 'peace',
        opinion: { civA: 'civ-0', civB: 'civ-1', score: -10, modifiers: [expiredMod, activeMod] },
        pacts: [],
      };
      const state = makeState({ diplomacyMatrix: new Map([[matrixKey('civ-0', 'civ-1'), entry]]) });
      const result = engine.tick(state);
      const updatedEntry = result.diplomacyMatrix.get(matrixKey('civ-0', 'civ-1'));
      expect(updatedEntry?.opinion.score).toBe(10);
    });
  });

  describe('post-war pact formation', () => {
    it('creates a non_aggression_pact when a war ended on the previous tick', () => {
      const engine = new DiplomacyEngine();
      const endedWar: WarState = makeWar({ endedTick: 99, outcome: 'white_peace' }); // tick-1 = 99
      const state = makeState({ wars: [endedWar] });
      const result = engine.tick(state);
      const entry = result.diplomacyMatrix.get(matrixKey('civ-0', 'civ-1'));
      expect(entry?.pacts.some(p => p.typeOf === 'non_aggression_pact')).toBe(true);
    });

    it('adds a treaty_formed chronicle entry for post-war pact', () => {
      const engine = new DiplomacyEngine();
      const endedWar: WarState = makeWar({ endedTick: 99, outcome: 'defender_wins' });
      const state = makeState({ wars: [endedWar] });
      const result = engine.tick(state);
      expect(result.chronicle.some(e => e.eventType === 'treaty_formed')).toBe(true);
    });

    it('does not create a pact for annihilation outcome', () => {
      const engine = new DiplomacyEngine();
      const endedWar: WarState = makeWar({ endedTick: 99, outcome: 'annihilation' });
      const state = makeState({ wars: [endedWar] });
      const result = engine.tick(state);
      const entry = result.diplomacyMatrix.get(matrixKey('civ-0', 'civ-1'));
      expect(entry?.pacts ?? []).toHaveLength(0);
    });

    it('does not create a pact for vassalage outcome', () => {
      const engine = new DiplomacyEngine();
      const endedWar: WarState = makeWar({ endedTick: 99, outcome: 'vassalage' });
      const state = makeState({ wars: [endedWar] });
      const result = engine.tick(state);
      const entry = result.diplomacyMatrix.get(matrixKey('civ-0', 'civ-1'));
      expect(entry?.pacts ?? []).toHaveLength(0);
    });

    it('does not create a duplicate pact if one already exists', () => {
      const engine = new DiplomacyEngine();
      const existingPact: DiplomaticPact = {
        id: 'pact-existing', typeOf: 'non_aggression_pact',
        civA: 'civ-0', civB: 'civ-1', formedTick: 80,
        expiryTick: 400,
        terms: { militaryAccess: false, tradeBenefit: 5 },
        violated: false,
      };
      const existingEntry: DiplomacyEntry = {
        status: 'peace',
        opinion: { civA: 'civ-0', civB: 'civ-1', score: 0, modifiers: [] },
        pacts: [existingPact],
      };
      const endedWar: WarState = makeWar({ endedTick: 99, outcome: 'white_peace' });
      const state = makeState({
        wars: [endedWar],
        diplomacyMatrix: new Map([[matrixKey('civ-0', 'civ-1'), existingEntry]]),
      });
      const result = engine.tick(state);
      const entry = result.diplomacyMatrix.get(matrixKey('civ-0', 'civ-1'));
      const nagPacts = entry?.pacts.filter(p => p.typeOf === 'non_aggression_pact');
      expect(nagPacts).toHaveLength(1);
    });
  });

  describe('treaty violation detection', () => {
    it('marks military_alliance pact as violated when ally fails to join war', () => {
      const engine = new DiplomacyEngine();

      // civ-0 is at war with civ-2; civ-1 is allied with civ-0 but not at war with civ-2
      const alliancePact: DiplomaticPact = {
        id: 'pact-alliance', typeOf: 'military_alliance',
        civA: 'civ-0', civB: 'civ-1', formedTick: 10,
        terms: { militaryAccess: true, tradeBenefit: 10 },
        violated: false,
      };
      const allianceEntry: DiplomacyEntry = {
        status: 'alliance',
        opinion: { civA: 'civ-0', civB: 'civ-1', score: 30, modifiers: [] },
        pacts: [alliancePact],
      };
      const activeWar: WarState = {
        id: 'war-1', aggressorId: 'civ-0', defenderId: 'civ-2',
        declaredTick: 80, cause: 'border_tension', warScore: 10,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      };
      const state: WorldState = {
        ...makeState(),
        civilizations: new Map([
          ['civ-0', makeCiv('civ-0', 'Alpha Kingdom')],
          ['civ-1', makeCiv('civ-1', 'Beta Empire')],
          ['civ-2', makeCiv('civ-2', 'Gamma Realm')],
        ]),
        wars: [activeWar],
        diplomacyMatrix: new Map([[matrixKey('civ-0', 'civ-1'), allianceEntry]]),
      };

      const result = engine.tick(state);
      const entry = result.diplomacyMatrix.get(matrixKey('civ-0', 'civ-1'));
      const pact = entry?.pacts.find(p => p.id === 'pact-alliance');
      expect(pact?.violated).toBe(true);
      expect(pact?.violatedBy).toBe('civ-1');
    });

    it('adds a treaty_violated chronicle entry', () => {
      const engine = new DiplomacyEngine();
      const alliancePact: DiplomaticPact = {
        id: 'pact-a', typeOf: 'military_alliance',
        civA: 'civ-0', civB: 'civ-1', formedTick: 10,
        terms: { militaryAccess: true, tradeBenefit: 10 },
        violated: false,
      };
      const allianceEntry: DiplomacyEntry = {
        status: 'alliance',
        opinion: { civA: 'civ-0', civB: 'civ-1', score: 30, modifiers: [] },
        pacts: [alliancePact],
      };
      const activeWar: WarState = {
        id: 'war-1', aggressorId: 'civ-0', defenderId: 'civ-2',
        declaredTick: 80, cause: 'border_tension', warScore: 10,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      };
      const state: WorldState = {
        ...makeState(),
        civilizations: new Map([
          ['civ-0', makeCiv('civ-0', 'Alpha Kingdom')],
          ['civ-1', makeCiv('civ-1', 'Beta Empire')],
          ['civ-2', makeCiv('civ-2', 'Gamma Realm')],
        ]),
        wars: [activeWar],
        diplomacyMatrix: new Map([[matrixKey('civ-0', 'civ-1'), allianceEntry]]),
      };
      const result = engine.tick(state);
      expect(result.chronicle.some(e => e.eventType === 'treaty_violated')).toBe(true);
    });

    it('adds a large negative opinion modifier on violation', () => {
      const engine = new DiplomacyEngine();
      const alliancePact: DiplomaticPact = {
        id: 'pact-b', typeOf: 'military_alliance',
        civA: 'civ-0', civB: 'civ-1', formedTick: 10,
        terms: { militaryAccess: true, tradeBenefit: 10 },
        violated: false,
      };
      const allianceEntry: DiplomacyEntry = {
        status: 'alliance',
        opinion: { civA: 'civ-0', civB: 'civ-1', score: 0, modifiers: [] },
        pacts: [alliancePact],
      };
      const activeWar: WarState = {
        id: 'war-2', aggressorId: 'civ-0', defenderId: 'civ-2',
        declaredTick: 80, cause: 'border_tension', warScore: 10,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      };
      const state: WorldState = {
        ...makeState(),
        civilizations: new Map([
          ['civ-0', makeCiv('civ-0', 'Alpha Kingdom')],
          ['civ-1', makeCiv('civ-1', 'Beta Empire')],
          ['civ-2', makeCiv('civ-2', 'Gamma Realm')],
        ]),
        wars: [activeWar],
        diplomacyMatrix: new Map([[matrixKey('civ-0', 'civ-1'), allianceEntry]]),
      };
      const result = engine.tick(state);
      const entry = result.diplomacyMatrix.get(matrixKey('civ-0', 'civ-1'));
      expect(entry?.opinion.score).toBeLessThan(0);
    });

    it('does not mark already-violated pacts again', () => {
      const engine = new DiplomacyEngine();
      const alreadyViolated: DiplomaticPact = {
        id: 'pact-c', typeOf: 'military_alliance',
        civA: 'civ-0', civB: 'civ-1', formedTick: 10,
        terms: { militaryAccess: true, tradeBenefit: 10 },
        violated: true, violatedBy: 'civ-1', violatedTick: 90,
      };
      const entry: DiplomacyEntry = {
        status: 'alliance',
        opinion: { civA: 'civ-0', civB: 'civ-1', score: -40, modifiers: [] },
        pacts: [alreadyViolated],
      };
      const activeWar: WarState = {
        id: 'war-3', aggressorId: 'civ-0', defenderId: 'civ-2',
        declaredTick: 80, cause: 'border_tension', warScore: 10,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      };
      const state: WorldState = {
        ...makeState(),
        civilizations: new Map([
          ['civ-0', makeCiv('civ-0', 'Alpha Kingdom')],
          ['civ-1', makeCiv('civ-1', 'Beta Empire')],
          ['civ-2', makeCiv('civ-2', 'Gamma Realm')],
        ]),
        wars: [activeWar],
        diplomacyMatrix: new Map([[matrixKey('civ-0', 'civ-1'), entry]]),
      };
      const result = engine.tick(state);
      // No new treaty_violated events should be added
      expect(result.chronicle.filter(e => e.eventType === 'treaty_violated')).toHaveLength(0);
    });
  });
});

// ─── DiplomacyEngine.formAlliance ────────────────────────────────────────────

describe('DiplomacyEngine.formAlliance', () => {
  it('creates a military_alliance pact', () => {
    const engine = new DiplomacyEngine();
    const state = makeState();
    const result = engine.formAlliance(state, 'civ-0', 'civ-1');
    const entry = result.diplomacyMatrix.get(matrixKey('civ-0', 'civ-1'));
    expect(entry?.pacts.some(p => p.typeOf === 'military_alliance')).toBe(true);
  });

  it('sets status to alliance', () => {
    const engine = new DiplomacyEngine();
    const state = makeState();
    const result = engine.formAlliance(state, 'civ-0', 'civ-1');
    const entry = result.diplomacyMatrix.get(matrixKey('civ-0', 'civ-1'));
    expect(entry?.status).toBe('alliance');
  });

  it('adds a positive opinion modifier', () => {
    const engine = new DiplomacyEngine();
    const state = makeState();
    const result = engine.formAlliance(state, 'civ-0', 'civ-1');
    const entry = result.diplomacyMatrix.get(matrixKey('civ-0', 'civ-1'));
    expect(entry?.opinion.score).toBeGreaterThan(0);
  });

  it('adds a treaty_formed chronicle entry', () => {
    const engine = new DiplomacyEngine();
    const state = makeState();
    const result = engine.formAlliance(state, 'civ-0', 'civ-1');
    expect(result.chronicle.some(e => e.eventType === 'treaty_formed')).toBe(true);
  });

  it('does not mutate the input state', () => {
    const engine = new DiplomacyEngine();
    const state = makeState();
    engine.formAlliance(state, 'civ-0', 'civ-1');
    expect(state.diplomacyMatrix.size).toBe(0);
    expect(state.chronicle).toHaveLength(0);
  });
});
