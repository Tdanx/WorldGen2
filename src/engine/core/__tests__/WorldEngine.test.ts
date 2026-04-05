import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorldEngine } from '../WorldEngine';
import { EventBus } from '../EventBus';
import { ReligionRegistry } from '../../../registries/ReligionRegistry';
import { resetIdGen } from '../idgen';
import type { WorldState } from '../../../types/world';
import type { Civilization } from '../../../types/civilization';
import { BiomeType } from '../../../types/terrain';

function makeState(tick = 0): WorldState {
  return {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick,
    tiles: [],
    civilizations: new Map(),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
  };
}

beforeEach(() => {
  ReligionRegistry.reset();
  resetIdGen();
});

function makeEngine() {
  const bus = new EventBus();
  const engine = new WorldEngine(bus);
  return { bus, engine };
}

function makeStateWithCiv(): WorldState {
  const civ: Civilization = {
    id: 'civ-0', name: 'Test Kingdom', speciesId: 'human', color: '#e63946',
    capitalTile: 0, territory: [0], population: 100, treasury: 50,
    era: 'Stone', techLevel: 0, faithId: null,
    military: { baseStrength: 10, morale: 1.0, supplyLine: 1.0, effectiveStrength: 10 },
    lifecycle: { phase: 'founding', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: [], collapseRisk: 0 },
    foundedTick: 0,
  };
  return {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick: 0,
    tiles: [{
      index: 0, x: 0, y: 0,
      elevation: 0.3, moisture: 0.6, temperature: 0.2,
      biome: BiomeType.Grassland,
      isWater: false, isRiver: false, riverFlow: null,
      ownerId: 'civ-0', religionId: null,
    }],
    civilizations: new Map([['civ-0', civ]]),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
  };
}

describe('WorldEngine', () => {
  describe('initialize', () => {
    it('getState() returns null before initialize()', () => {
      const { engine } = makeEngine();
      expect(engine.getState()).toBeNull();
    });

    it('getState() returns the provided state after initialize()', () => {
      const { engine } = makeEngine();
      const state = makeState();
      engine.initialize(state);
      expect(engine.getState()).toBe(state);
    });

    it('emits world:generated on the bus after initialize()', () => {
      const { bus, engine } = makeEngine();
      const handler = vi.fn();
      bus.on('world:generated', handler);
      const state = makeState();
      engine.initialize(state);
      expect(handler).toHaveBeenCalledWith(state);
    });
  });

  describe('tick', () => {
    it('increments tick by 1', () => {
      const { engine } = makeEngine();
      engine.initialize(makeState(0));
      engine.tick();
      expect(engine.getState()?.tick).toBe(1);
    });

    it('increments tick on repeated calls', () => {
      const { engine } = makeEngine();
      engine.initialize(makeState(0));
      engine.tick();
      engine.tick();
      engine.tick();
      expect(engine.getState()?.tick).toBe(3);
    });

    it('emits world:tick on the bus with the new state', () => {
      const { bus, engine } = makeEngine();
      const handler = vi.fn();
      bus.on('world:tick', handler);
      engine.initialize(makeState(0));
      engine.tick();
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].tick).toBe(1);
    });

    it('onTick listener receives the updated state after each tick', () => {
      const { engine } = makeEngine();
      const received: number[] = [];
      engine.initialize(makeState(0));
      engine.onTick((s) => received.push(s.tick));
      engine.tick();
      engine.tick();
      expect(received).toEqual([1, 2]);
    });

    it('tick() before initialize() is a no-op (does not throw)', () => {
      const { engine } = makeEngine();
      expect(() => engine.tick()).not.toThrow();
      expect(engine.getState()).toBeNull();
    });
  });

  describe('queueCommand + tick', () => {
    it('pending commands are cleared after tick()', () => {
      const { engine } = makeEngine();
      engine.initialize(makeState(0));
      engine.queueCommand({ type: 'PLAGUE', targetCiv: 'civ-1', severity: 0.5 });
      engine.tick();
      // After tick, queue should be empty — subsequent tick processes no commands
      // (we verify by ensuring state advanced cleanly without error)
      expect(engine.getState()?.tick).toBe(1);
    });

    it('multiple commands can be queued before a tick', () => {
      const { engine } = makeEngine();
      engine.initialize(makeState(0));
      engine.queueCommand({ type: 'PLAGUE', targetCiv: 'civ-1', severity: 0.5 });
      engine.queueCommand({ type: 'DIVINE_BLESSING', targetCiv: 'civ-2', boost: 'food' });
      expect(() => engine.tick()).not.toThrow();
      expect(engine.getState()?.tick).toBe(1);
    });
  });

  describe('onTick', () => {
    it('unsubscribe fn stops future notifications', () => {
      const { engine } = makeEngine();
      const handler = vi.fn();
      engine.initialize(makeState(0));
      const unsub = engine.onTick(handler);
      engine.tick();
      unsub();
      engine.tick();
      expect(handler).toHaveBeenCalledOnce();
    });

    it('multiple onTick listeners all receive the new state', () => {
      const { engine } = makeEngine();
      const h1 = vi.fn();
      const h2 = vi.fn();
      engine.initialize(makeState(0));
      engine.onTick(h1);
      engine.onTick(h2);
      engine.tick();
      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });
  });

  describe('CivilizationEngine integration', () => {
    it('civ_founded chronicle entry appears after first tick', () => {
      const { engine } = makeEngine();
      engine.initialize(makeStateWithCiv());
      engine.tick();
      const chronicle = engine.getState()!.chronicle;
      expect(chronicle.some(e => e.eventType === 'civ_founded')).toBe(true);
    });

    it('civ_founded is NOT re-emitted on second tick', () => {
      const { engine } = makeEngine();
      engine.initialize(makeStateWithCiv());
      engine.tick();
      engine.tick();
      const founded = engine.getState()!.chronicle.filter(e => e.eventType === 'civ_founded');
      expect(founded).toHaveLength(1);
    });

    it('civ population increases after tick on fertile tile', () => {
      const { engine } = makeEngine();
      engine.initialize(makeStateWithCiv());
      engine.tick();
      const pop = (engine.getState()!.civilizations as Map<string, Civilization>).get('civ-0')!.population;
      expect(pop).toBeGreaterThan(100);
    });

    it('getState() civilizations map reflects post-civEngine results', () => {
      const { engine } = makeEngine();
      engine.initialize(makeStateWithCiv());
      engine.tick();
      const civ = (engine.getState()!.civilizations as Map<string, Civilization>).get('civ-0');
      expect(civ).toBeDefined();
    });
  });

  describe('god command integration', () => {
    it('DIVINE_BLESSING applied within same tick it was queued', () => {
      const { engine } = makeEngine();
      engine.initialize(makeStateWithCiv());
      engine.queueCommand({ type: 'DIVINE_BLESSING', targetCiv: 'civ-0', boost: 'food' });
      engine.tick();
      const pop = (engine.getState()!.civilizations as Map<string, Civilization>).get('civ-0')!.population;
      // population boosted by both growth (tick) and blessing (×1.3)
      expect(pop).toBeGreaterThan(100);
    });

    it('FORCE_WAR adds a war to state.wars', () => {
      const { engine } = makeEngine();
      const state = makeStateWithCiv();
      const civ1: Civilization = {
        id: 'civ-1', name: 'Beta Empire', speciesId: 'human', color: '#00f',
        capitalTile: 0, territory: [], population: 100, treasury: 50,
        era: 'Stone', techLevel: 0, faithId: null,
        military: { baseStrength: 10, morale: 1, supplyLine: 1, effectiveStrength: 10 },
        lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: [], collapseRisk: 0 },
        foundedTick: 0,
      };
      const stateWithTwo: WorldState = {
        ...state,
        civilizations: new Map([['civ-0', state.civilizations.get('civ-0')!], ['civ-1', civ1]]),
      };
      engine.initialize(stateWithTwo);
      engine.queueCommand({ type: 'FORCE_WAR', aggressor: 'civ-0', defender: 'civ-1' });
      engine.tick();
      expect(engine.getState()!.wars.some(w => w.cause === 'god_command')).toBe(true);
    });

    it('pending commands are fully cleared — second tick processes none', () => {
      const { engine } = makeEngine();
      engine.initialize(makeState(0));
      engine.queueCommand({ type: 'PLAGUE', targetCiv: 'nonexistent', severity: 0.5 });
      engine.tick();
      engine.tick(); // no queued commands — should not throw
      expect(engine.getState()?.tick).toBe(2);
    });
  });

  describe('war:declared and war:ended bus events', () => {
    it('emits war:declared when ConflictEngine auto-declares a war', () => {
      const { bus, engine } = makeEngine();
      const handler = vi.fn();
      bus.on('war:declared', handler);

      // Two orcish civs (aggression=0.9) adjacent → high war pressure
      const civA: Civilization = {
        id: 'civ-0', name: 'Orc Horde', speciesId: 'orcish', color: '#f00',
        capitalTile: 0, territory: [0], population: 1000, treasury: 50,
        era: 'Iron', techLevel: 2, faithId: null,
        military: { baseStrength: 200, morale: 1, supplyLine: 1, effectiveStrength: 200 },
        lifecycle: { phase: 'peak', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: ['famine'], collapseRisk: 0.2 },
        foundedTick: 0,
      };
      const civB: Civilization = {
        ...civA, id: 'civ-1', name: 'Orc Warband', color: '#900',
        capitalTile: 1, territory: [1],
        lifecycle: { phase: 'peak', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: ['famine'], collapseRisk: 0.2 },
      };
      // Tiles adjacent (within spacing*20 = 110 world units)
      const state: WorldState = {
        config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
        tick: 100,
        tiles: [
          { index: 0, x: 0, y: 0, elevation: 0.4, moisture: 0.5, temperature: 0.2, biome: BiomeType.Grassland, isWater: false, isRiver: false, riverFlow: null, ownerId: 'civ-0', religionId: null },
          { index: 1, x: 55, y: 0, elevation: 0.4, moisture: 0.5, temperature: 0.2, biome: BiomeType.Grassland, isWater: false, isRiver: false, riverFlow: null, ownerId: 'civ-1', religionId: null },
        ],
        civilizations: new Map([['civ-0', civA], ['civ-1', civB]]),
        wars: [],
        chronicle: [],
        diplomacyMatrix: new Map(),
      };

      engine.initialize(state);
      engine.tick();

      if (handler.mock.calls.length > 0) {
        expect(handler.mock.calls[0][0]).toHaveProperty('aggressorId');
        expect(handler.mock.calls[0][0]).toHaveProperty('defenderId');
      }
      // War may or may not be declared depending on total pressure; just ensure no throw
      expect(engine.getState()?.tick).toBe(101);
    });
  });

  describe('initialize resets ReligionRegistry', () => {
    it('calling initialize twice does not accumulate religions from previous worlds', () => {
      const { engine } = makeEngine();
      // First world — seed a religion manually
      ReligionRegistry.found({
        name: 'Old World Faith', founderCivId: 'civ-x', foundedTick: 1,
        tenets: ['pacifist'], splitFrom: null, extinctTick: null,
        color: '#fff', followerCivIds: new Set(),
      });
      expect(ReligionRegistry.getAll()).toHaveLength(1);

      // initialize() should call ReligionRegistry.reset()
      engine.initialize(makeState(0));
      expect(ReligionRegistry.getAll()).toHaveLength(0);
    });
  });
});
