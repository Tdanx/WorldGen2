import { describe, it, expect, beforeEach } from 'vitest';
import { TechTreeEngine, ERA_BY_TECH_LEVEL, TECH_THRESHOLDS } from '../TechTreeEngine';
import type { Civilization } from '../../../types/civilization';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCiv(overrides: Partial<Civilization> = {}): Civilization {
  return {
    id: 'civ-0', name: 'Test Kingdom', speciesId: 'human', color: '#e63946',
    capitalTile: 0, territory: [0], population: 100, treasury: 50,
    era: 'Stone', techLevel: 0, faithId: null,
    military: { baseStrength: 10, morale: 1.0, supplyLine: 1.0, effectiveStrength: 10 },
    lifecycle: { phase: 'founding', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: [], collapseRisk: 0 },
    foundedTick: 0,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TechTreeEngine', () => {
  let engine: TechTreeEngine;

  beforeEach(() => {
    engine = new TechTreeEngine();
  });

  describe('initCiv', () => {
    it('initCiv on existing civ does not reset accumulated progress', () => {
      // Accumulate 299 ticks of progress (gain=1/tick for pop=1,human), then re-init, then advance on tick 300
      const civ = makeCiv({ population: 1, speciesId: 'human' });
      const civs = new Map([['civ-0', civ]]);

      // Accumulate 299 ticks
      let current = civ;
      for (let i = 0; i < 299; i++) {
        const result = engine.tick(new Map([['civ-0', current]]));
        current = result.civs.get('civ-0')!;
      }
      // Verify still at level 0 (need 300 total)
      expect(current.techLevel).toBe(0);

      // Re-init should not reset
      engine.initCiv('civ-0');

      // Tick 300: should advance to level 1
      const finalResult = engine.tick(new Map([['civ-0', current]]));
      expect(finalResult.civs.get('civ-0')!.techLevel).toBe(1);
    });
  });

  describe('progress accumulation', () => {
    it('does not advance on small pop after one tick (1 point/tick, threshold=300)', () => {
      // pop=1, human (techAffinity=0.7): gain = Math.max(1, floor(1*0.7*0.002)) = 1
      const civ = makeCiv({ population: 1, speciesId: 'human' });
      const result = engine.tick(new Map([['civ-0', civ]]));
      expect(result.civs.get('civ-0')!.techLevel).toBe(0);
      expect(result.advances).toHaveLength(0);
    });

    it('advances to level 1 on first tick with large population dwarven civ', () => {
      // pop=200000, dwarven (techAffinity=0.9): gain = floor(200000*0.9*0.002) = 360 >= 300
      const civ = makeCiv({ population: 200000, speciesId: 'dwarven', era: 'Stone', techLevel: 0 });
      const result = engine.tick(new Map([['civ-0', civ]]));
      expect(result.civs.get('civ-0')!.techLevel).toBe(1);
      expect(result.advances).toHaveLength(1);
    });

    it('progress resets to 0 after an advance', () => {
      // Advance on tick 1 (large pop), then confirm no double-advance on tick 2
      const civ = makeCiv({ population: 200000, speciesId: 'dwarven', era: 'Stone', techLevel: 0 });
      const result1 = engine.tick(new Map([['civ-0', civ]]));
      const advancedCiv = result1.civs.get('civ-0')!;
      expect(advancedCiv.techLevel).toBe(1);

      // Next tick: need 800 to reach level 2; 360 is not enough
      const result2 = engine.tick(new Map([['civ-0', advancedCiv]]));
      expect(result2.civs.get('civ-0')!.techLevel).toBe(1);
      expect(result2.advances).toHaveLength(0);
    });
  });

  describe('era mapping', () => {
    it('techLevel 0 maps to Stone', () => {
      expect(ERA_BY_TECH_LEVEL[0]).toBe('Stone');
    });

    it('techLevel 1 maps to Stone', () => {
      expect(ERA_BY_TECH_LEVEL[1]).toBe('Stone');
    });

    it('techLevel 2 maps to Bronze', () => {
      expect(ERA_BY_TECH_LEVEL[2]).toBe('Bronze');
    });

    it('techLevel 3 maps to Iron', () => {
      expect(ERA_BY_TECH_LEVEL[3]).toBe('Iron');
    });

    it('tech does not advance past level 8', () => {
      // Create a civ already at level 8
      const civ = makeCiv({ population: 999999, speciesId: 'dwarven', era: 'Modern', techLevel: 8 });
      const result = engine.tick(new Map([['civ-0', civ]]));
      expect(result.civs.get('civ-0')!.techLevel).toBe(8);
      expect(result.advances).toHaveLength(0);
    });
  });

  describe('species affinity', () => {
    it('dwarven (techAffinity=0.9) accumulates faster than lizardfolk (0.3) at same population', () => {
      const pop = 1000;
      const dwarven = makeCiv({ id: 'civ-dw', population: pop, speciesId: 'dwarven' });
      const lizard = makeCiv({ id: 'civ-lz', population: pop, speciesId: 'lizardfolk' });

      // After one tick, dwarven gain should be higher
      const engDw = new TechTreeEngine();
      const engLz = new TechTreeEngine();
      engDw.tick(new Map([['civ-dw', dwarven]]));
      engLz.tick(new Map([['civ-lz', lizard]]));

      // Dwarven: floor(1000*0.9*0.002) = floor(1.8) = 1, but max(1,...) = 1
      // Lizardfolk: floor(1000*0.3*0.002) = floor(0.6) = 0, max(1,...) = 1
      // Actually both get 1 gain at pop=1000. Let's use larger pop.
      const pop2 = 100000;
      const dwarven2 = makeCiv({ id: 'civ-dw2', population: pop2, speciesId: 'dwarven' });
      const lizard2 = makeCiv({ id: 'civ-lz2', population: pop2, speciesId: 'lizardfolk' });
      // dwarven: floor(100000*0.9*0.002) = floor(180) = 180
      // lizard:  floor(100000*0.3*0.002) = floor(60) = 60
      const engDw2 = new TechTreeEngine();
      const engLz2 = new TechTreeEngine();
      engDw2.tick(new Map([['civ-dw2', dwarven2]]));
      engLz2.tick(new Map([['civ-lz2', lizard2]]));

      // Run enough ticks so dwarven advances but lizardfolk does not
      // dwarven needs 300/180 = 2 ticks; lizardfolk needs 300/60 = 5 ticks
      let dCiv = dwarven2;
      let lCiv = lizard2;
      for (let i = 0; i < 3; i++) {
        dCiv = engDw2.tick(new Map([['civ-dw2', dCiv]])).civs.get('civ-dw2')!;
        lCiv = engLz2.tick(new Map([['civ-lz2', lCiv]])).civs.get('civ-lz2')!;
      }
      expect(dCiv.techLevel).toBeGreaterThan(lCiv.techLevel);
    });

    it('unseen civs are auto-initialized on first tick', () => {
      const civ = makeCiv({ id: 'new-civ', population: 100 });
      // Should not throw; should process civ without prior initCiv call
      expect(() => engine.tick(new Map([['new-civ', civ]]))).not.toThrow();
    });
  });
});
