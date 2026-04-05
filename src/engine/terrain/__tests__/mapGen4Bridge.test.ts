import { describe, it, expect } from 'vitest';
import { computeTemperature, assignBiome } from '../MapGen4Bridge';
import { BiomeType } from '../../../types/terrain';
import { SEA_LEVEL, BEACH_LEVEL, MOUNTAIN_LEVEL, SNOW_LEVEL } from '../../../utils/constants';

describe('computeTemperature', () => {
  it('returns a value in [-1, 1]', () => {
    const cases: [number, number][] = [
      [0, 0], [500, 0], [1000, 0],
      [0, 0.8], [500, -0.5], [1000, 1.0],
    ];
    for (const [y, elevation] of cases) {
      const t = computeTemperature(y, elevation);
      expect(t).toBeGreaterThanOrEqual(-1);
      expect(t).toBeLessThanOrEqual(1);
    }
  });

  it('equator (y=1000) is warmer than pole (y=0) at the same elevation', () => {
    const equator = computeTemperature(1000, 0);
    const pole    = computeTemperature(0,    0);
    expect(equator).toBeGreaterThan(pole);
  });

  it('high elevation is colder than low elevation at the same latitude', () => {
    const low  = computeTemperature(500, SEA_LEVEL + 0.01);
    const high = computeTemperature(500, 0.9);
    expect(high).toBeLessThan(low);
  });

  it('sea-level elevation produces no altitude cooling', () => {
    // altitudeCooling = max(0, elevation - SEA_LEVEL) * 2; at SEA_LEVEL it's 0
    const atSea   = computeTemperature(500, SEA_LEVEL);
    const belowSea = computeTemperature(500, SEA_LEVEL - 0.1);
    // both should be the same (no cooling below sea level)
    expect(atSea).toBe(belowSea);
  });
});

describe('assignBiome', () => {
  it('deep ocean: elevation well below SEA_LEVEL', () => {
    expect(assignBiome(SEA_LEVEL - 0.2, 0.5, 0)).toBe(BiomeType.DeepOcean);
  });

  it('shallow sea: elevation just below SEA_LEVEL', () => {
    expect(assignBiome(SEA_LEVEL - 0.05, 0.5, 0)).toBe(BiomeType.ShallowSea);
  });

  it('beach: elevation between SEA_LEVEL and BEACH_LEVEL', () => {
    const mid = SEA_LEVEL + (BEACH_LEVEL - SEA_LEVEL) / 2;
    expect(assignBiome(mid, 0.5, 0)).toBe(BiomeType.Beach);
  });

  it('snow: elevation at or above SNOW_LEVEL', () => {
    expect(assignBiome(SNOW_LEVEL, 0.5, 0)).toBe(BiomeType.Snow);
    expect(assignBiome(1.0, 0.5, 0)).toBe(BiomeType.Snow);
  });

  it('mountain: elevation in [MOUNTAIN_LEVEL, SNOW_LEVEL)', () => {
    const mid = MOUNTAIN_LEVEL + (SNOW_LEVEL - MOUNTAIN_LEVEL) / 2;
    expect(assignBiome(mid, 0.5, 0)).toBe(BiomeType.Mountain);
  });

  it('desert: hot + dry land', () => {
    // temperature > 0.5, moisture < 0.3, mid-range elevation
    expect(assignBiome(BEACH_LEVEL + 0.05, 0.1, 0.8)).toBe(BiomeType.Desert);
  });

  it('tropical rainforest: hot + wet land', () => {
    expect(assignBiome(BEACH_LEVEL + 0.05, 0.8, 0.8)).toBe(BiomeType.TropicalRainforest);
  });

  it('savanna: hot + moderate moisture', () => {
    expect(assignBiome(BEACH_LEVEL + 0.05, 0.4, 0.8)).toBe(BiomeType.Savanna);
  });

  it('temperate forest: moderate temperature + high moisture', () => {
    expect(assignBiome(BEACH_LEVEL + 0.05, 0.7, 0.3)).toBe(BiomeType.TemperateForest);
  });

  it('grassland: moderate temperature + moderate moisture', () => {
    expect(assignBiome(BEACH_LEVEL + 0.05, 0.4, 0.3)).toBe(BiomeType.Grassland);
  });

  it('boreal forest: cold + high moisture', () => {
    expect(assignBiome(BEACH_LEVEL + 0.05, 0.5, -0.5)).toBe(BiomeType.BorealForest);
  });

  it('tundra: cold + dry', () => {
    expect(assignBiome(BEACH_LEVEL + 0.05, 0.2, -0.5)).toBe(BiomeType.Tundra);
  });
});
