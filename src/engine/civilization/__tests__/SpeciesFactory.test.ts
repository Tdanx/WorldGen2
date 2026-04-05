import { describe, it, expect } from 'vitest';
import { createCiv } from '../SpeciesFactory';
import { mulberry32 } from '../../../utils/rng';
import type { Tile } from '../../../types/world';
import type { SpeciesDef } from '../../../types/civilization';
import { BiomeType } from '../../../types/terrain';

// ─── Shared fixtures ────────────────────────────────────────────────────────

const HUMAN_SPECIES: SpeciesDef = {
  id: 'human',
  name: 'Humans',
  traits: {
    aggression: 0.5, expansion: 0.6, religiosity: 0.5,
    techAffinity: 0.7, diplomacy: 0.6, resilience: 0.5,
  },
  preferredBiomes: [BiomeType.Grassland, BiomeType.TemperateForest],
  description: 'Test species',
};

const DWARVEN_SPECIES: SpeciesDef = {
  id: 'dwarven',
  name: 'Dwarves',
  traits: {
    aggression: 0.6, expansion: 0.3, religiosity: 0.4,
    techAffinity: 0.9, diplomacy: 0.4, resilience: 0.8,
  },
  preferredBiomes: [BiomeType.Mountain, BiomeType.BorealForest],
  description: 'Test dwarves',
};

const CAPITAL_TILE: Tile = {
  index: 42,
  x: 500, y: 500,
  elevation: 0.3, moisture: 0.6, temperature: 0.2,
  biome: BiomeType.Grassland,
  isWater: false, isRiver: false, riverFlow: null,
  ownerId: null, religionId: null,
};

function makeCiv(civIndex = 0, seed = 42) {
  return createCiv(HUMAN_SPECIES, CAPITAL_TILE, mulberry32(seed), 0, civIndex);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('createCiv', () => {
  describe('identity fields', () => {
    it('id is "civ-0" when civIndex is 0', () => {
      expect(makeCiv(0).id).toBe('civ-0');
    });

    it('id is "civ-7" when civIndex is 7', () => {
      expect(makeCiv(7).id).toBe('civ-7');
    });

    it('speciesId matches the provided species.id', () => {
      expect(makeCiv().speciesId).toBe('human');
    });

    it('capitalTile matches the tile index', () => {
      expect(makeCiv().capitalTile).toBe(42);
    });

    it('foundedTick is stored correctly', () => {
      const civ = createCiv(HUMAN_SPECIES, CAPITAL_TILE, mulberry32(1), 99, 0);
      expect(civ.foundedTick).toBe(99);
    });
  });

  describe('economic and tech fields', () => {
    it('treasury is exactly 50', () => {
      expect(makeCiv().treasury).toBe(50);
    });

    it('era is "Stone"', () => {
      expect(makeCiv().era).toBe('Stone');
    });

    it('techLevel is 0', () => {
      expect(makeCiv().techLevel).toBe(0);
    });

    it('faithId is null', () => {
      expect(makeCiv().faithId).toBeNull();
    });
  });

  describe('population', () => {
    it('population is in range [100, 299]', () => {
      const pop = makeCiv().population;
      expect(pop).toBeGreaterThanOrEqual(100);
      expect(pop).toBeLessThanOrEqual(299);
    });

    it('population is an integer', () => {
      expect(Number.isInteger(makeCiv().population)).toBe(true);
    });
  });

  describe('territory', () => {
    it('territory contains exactly one element', () => {
      expect(makeCiv().territory).toHaveLength(1);
    });

    it('territory[0] is the capital tile index', () => {
      expect(makeCiv().territory[0]).toBe(42);
    });
  });

  describe('lifecycle', () => {
    it('lifecycle.phase is "founding"', () => {
      expect(makeCiv().lifecycle.phase).toBe('founding');
    });

    it('lifecycle.stabilityScore is 80', () => {
      expect(makeCiv().lifecycle.stabilityScore).toBe(80);
    });

    it('lifecycle.collapseRisk is 0', () => {
      expect(makeCiv().lifecycle.collapseRisk).toBe(0);
    });

    it('lifecycle.instabilityFlags is an empty array', () => {
      expect(makeCiv().lifecycle.instabilityFlags).toEqual([]);
    });

    it('lifecycle.phaseEnteredTick matches foundedTick', () => {
      const civ = createCiv(HUMAN_SPECIES, CAPITAL_TILE, mulberry32(1), 55, 0);
      expect(civ.lifecycle.phaseEnteredTick).toBe(55);
    });
  });

  describe('military', () => {
    it('military.morale is 1.0', () => {
      expect(makeCiv().military.morale).toBe(1.0);
    });

    it('military.supplyLine is 1.0', () => {
      expect(makeCiv().military.supplyLine).toBe(1.0);
    });

    it('military.effectiveStrength equals military.baseStrength', () => {
      const { military } = makeCiv();
      expect(military.effectiveStrength).toBe(military.baseStrength);
    });

    it('military.baseStrength is Math.floor(population * 0.1)', () => {
      const civ = makeCiv();
      expect(civ.military.baseStrength).toBe(Math.floor(civ.population * 0.1));
    });

    it('military.baseStrength is a non-negative integer', () => {
      const { military } = makeCiv();
      expect(Number.isInteger(military.baseStrength)).toBe(true);
      expect(military.baseStrength).toBeGreaterThanOrEqual(0);
    });
  });

  describe('name generation', () => {
    it('name is a non-empty string', () => {
      const name = makeCiv().name;
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('name contains the species name as a substring', () => {
      expect(makeCiv().name).toContain('Humans');
    });

    it('name has at least 3 space-separated parts (prefix + species + suffix)', () => {
      expect(makeCiv().name.split(' ').length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('color', () => {
    it('color is a valid 7-character hex string', () => {
      expect(makeCiv().color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('civIndex 0 and civIndex 12 produce the same color (palette cycles)', () => {
      expect(makeCiv(0).color).toBe(makeCiv(12).color);
    });

    it('civIndex 0 and civIndex 1 produce different colors', () => {
      expect(makeCiv(0).color).not.toBe(makeCiv(1).color);
    });
  });

  describe('determinism', () => {
    it('same seed produces identical name on two calls', () => {
      const a = createCiv(HUMAN_SPECIES, CAPITAL_TILE, mulberry32(42), 0, 0);
      const b = createCiv(HUMAN_SPECIES, CAPITAL_TILE, mulberry32(42), 0, 0);
      expect(a.name).toBe(b.name);
    });

    it('same seed produces identical population on two calls', () => {
      const a = createCiv(HUMAN_SPECIES, CAPITAL_TILE, mulberry32(42), 0, 0);
      const b = createCiv(HUMAN_SPECIES, CAPITAL_TILE, mulberry32(42), 0, 0);
      expect(a.population).toBe(b.population);
    });

    it('20 different seeds produce more than 1 distinct population value', () => {
      const pops = new Set<number>();
      for (let seed = 0; seed < 20; seed++) {
        pops.add(createCiv(HUMAN_SPECIES, CAPITAL_TILE, mulberry32(seed), 0, 0).population);
      }
      expect(pops.size).toBeGreaterThan(1);
    });
  });

  describe('different species', () => {
    it('dwarven civ has speciesId "dwarven"', () => {
      const civ = createCiv(DWARVEN_SPECIES, CAPITAL_TILE, mulberry32(1), 0, 1);
      expect(civ.speciesId).toBe('dwarven');
    });

    it('dwarven civ name contains "Dwarves"', () => {
      const civ = createCiv(DWARVEN_SPECIES, CAPITAL_TILE, mulberry32(1), 0, 1);
      expect(civ.name).toContain('Dwarves');
    });
  });
});
