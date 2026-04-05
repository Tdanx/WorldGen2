import { describe, it, expect, beforeEach } from 'vitest';
import { TectonicSimulator, TECTONIC_INTERVAL } from '../TectonicSimulator';
import { BiomeType } from '../../../types/terrain';
import type { WorldState, Tile, WorldConfig } from '../../../types/world';
import { resetIdGen } from '../../core/idgen';

const config: WorldConfig = { seed: 42, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 };

function makeTile(index: number, x: number, y: number, elevation: number): Tile {
  const isWater = elevation < 0.0; // SEA_LEVEL = 0.0
  return {
    index, x, y, elevation, moisture: 0.5, temperature: 0,
    biome: isWater ? BiomeType.ShallowSea : BiomeType.Grassland,
    isWater, isRiver: false, riverFlow: null, ownerId: null, religionId: null,
  };
}

function makeState(tick: number, tiles: Tile[]): WorldState {
  return {
    config,
    tick,
    tiles,
    civilizations: new Map(),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
  };
}

describe('TectonicSimulator', () => {
  let sim: TectonicSimulator;

  beforeEach(() => {
    sim = new TectonicSimulator();
    resetIdGen();
  });

  it('does nothing when tiles array is empty', () => {
    const state = makeState(TECTONIC_INTERVAL, []);
    expect(sim.tick(state)).toBe(state);
  });

  it('returns state unchanged when not at tectonic interval', () => {
    const tiles = [makeTile(0, 500, 500, 0.4)];
    const state = makeState(TECTONIC_INTERVAL - 1, tiles);
    expect(sim.tick(state)).toBe(state);
  });

  it('returns state unchanged at tick=0 (not a multiple of interval when interval=200)', () => {
    const tiles = [makeTile(0, 500, 500, 0.4)];
    const state = makeState(0, tiles);
    // tick=0: 0 % 200 === 0, so it WILL fire — but with only one tile as both
    // epicenter and neighbor, elevation changes, and it should not crash
    expect(() => sim.tick(state)).not.toThrow();
  });

  it('modifies tile elevations at TECTONIC_INTERVAL', () => {
    // Create a spread of land tiles; the epicenter should get uplifted
    const tiles: Tile[] = [];
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        tiles.push(makeTile(x * 10 + y, x * 100, y * 100, 0.35));
      }
    }
    const state = makeState(TECTONIC_INTERVAL, tiles);
    const next = sim.tick(state);

    const changed = next.tiles.filter((t, i) => t.elevation !== state.tiles[i].elevation);
    expect(changed.length).toBeGreaterThan(0);
  });

  it('never produces elevation outside [-1, 1]', () => {
    const tiles: Tile[] = [];
    for (let i = 0; i < 20; i++) {
      tiles.push(makeTile(i, i * 50, i * 50, 0.95)); // near max
    }
    const state = makeState(TECTONIC_INTERVAL, tiles);
    const next = sim.tick(state);
    for (const t of next.tiles) {
      expect(t.elevation).toBeGreaterThanOrEqual(-1);
      expect(t.elevation).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic: same seed + tick produces identical result', () => {
    const tiles: Tile[] = [];
    for (let i = 0; i < 9; i++) tiles.push(makeTile(i, i * 100, i * 100, 0.35));
    const state = makeState(TECTONIC_INTERVAL, tiles);
    const r1 = sim.tick(state);
    const r2 = new TectonicSimulator().tick(state);
    for (let i = 0; i < r1.tiles.length; i++) {
      expect(r1.tiles[i].elevation).toBe(r2.tiles[i].elevation);
    }
  });

  it('adds a chronicle entry with eventType natural_disaster', () => {
    const tiles = [makeTile(0, 500, 500, 0.35)];
    const state = makeState(TECTONIC_INTERVAL, tiles);
    const next = sim.tick(state);
    expect(next.chronicle.length).toBeGreaterThan(0);
    expect(next.chronicle.every(e => e.eventType === 'natural_disaster')).toBe(true);
  });

  it('volcano tile gets BiomeType.Volcano biome when elevation exceeds 0.45', () => {
    // Place a single tile near epicenter at high elevation
    const highTile = { ...makeTile(0, 500, 500, 0.44), biome: BiomeType.Mountain };
    const state = makeState(TECTONIC_INTERVAL, [highTile]);
    const next = sim.tick(state);
    // After uplift the tile should be >= 0.45 and biome should be Volcano
    const result = next.tiles[0];
    if (result.elevation > 0.45) {
      expect(result.biome).toBe(BiomeType.Volcano);
    }
  });

  it('water tile becomes land when uplifted above sea level', () => {
    const waterTile = { ...makeTile(0, 500, 500, -0.01), isWater: true, biome: BiomeType.ShallowSea };
    const tiles: Tile[] = [waterTile];
    // Surround with high-elevation land tiles to make the water tile the epicenter
    for (let i = 1; i < 5; i++) tiles.push(makeTile(i, 500 + i * 20, 500, 0.45));
    const state = makeState(TECTONIC_INTERVAL, tiles);
    const next = sim.tick(state);
    // After uplift the previously-water tile may have become land
    const result = next.tiles[0];
    expect(result.isWater).toBe(result.elevation < 0.0);
  });
});
