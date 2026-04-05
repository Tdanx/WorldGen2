import { describe, it, expect, beforeEach } from 'vitest';
import { ErosionSimulator, EROSION_INTERVAL } from '../ErosionSimulator';
import { BiomeType } from '../../../types/terrain';
import type { WorldState, Tile, WorldConfig } from '../../../types/world';

const config: WorldConfig = { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 };

function makeTile(index: number, x: number, y: number, elevation: number): Tile {
  const isWater = elevation < 0.0;
  return {
    index, x, y, elevation, moisture: 0.5, temperature: 0,
    biome: isWater ? BiomeType.ShallowSea : BiomeType.Mountain,
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

describe('ErosionSimulator', () => {
  let sim: ErosionSimulator;

  beforeEach(() => {
    sim = new ErosionSimulator();
  });

  it('does nothing when tiles array is empty', () => {
    const state = makeState(EROSION_INTERVAL, []);
    expect(sim.tick(state)).toBe(state);
  });

  it('returns state unchanged when not at erosion interval', () => {
    const tiles = [makeTile(0, 0, 0, 0.5), makeTile(1, 10, 0, 0.1)];
    const state = makeState(EROSION_INTERVAL - 1, tiles);
    expect(sim.tick(state)).toBe(state);
  });

  it('smooths an elevation difference larger than TALUS_ANGLE', () => {
    // High tile next to a low tile — erosion should transfer sediment
    const highTile = makeTile(0, 0, 0, 0.8);
    const lowTile  = makeTile(1, 5, 0, 0.1); // close enough to be neighbors
    const state = makeState(EROSION_INTERVAL, [highTile, lowTile]);
    const next = sim.tick(state);
    expect(next.tiles[0].elevation).toBeLessThan(highTile.elevation);
    expect(next.tiles[1].elevation).toBeGreaterThan(lowTile.elevation);
  });

  it('does NOT erode tiles that are far apart', () => {
    const highTile = makeTile(0, 0, 0, 0.8);
    const farTile  = makeTile(1, 5000, 0, 0.1); // very far away
    const state = makeState(EROSION_INTERVAL, [highTile, farTile]);
    const next = sim.tick(state);
    // No neighbor interaction — should return the same state reference
    expect(next).toBe(state);
  });

  it('water tiles are not eroded as sources', () => {
    const waterTile = { ...makeTile(0, 0, 0, -0.05), isWater: true, biome: BiomeType.ShallowSea };
    const landTile  = makeTile(1, 5, 0, 0.4);
    const state = makeState(EROSION_INTERVAL, [waterTile, landTile]);
    const next = sim.tick(state);
    // Water tile should not lose elevation (water tiles are skipped as erosion sources)
    expect(next.tiles[0].elevation).toBeGreaterThanOrEqual(waterTile.elevation);
  });

  it('never produces elevation outside [-1, 1]', () => {
    const tiles: Tile[] = [];
    for (let i = 0; i < 5; i++) {
      tiles.push(makeTile(i, i * 5, 0, i === 0 ? 0.99 : 0.01));
    }
    const state = makeState(EROSION_INTERVAL, tiles);
    const next = sim.tick(state);
    for (const t of next.tiles) {
      expect(t.elevation).toBeGreaterThanOrEqual(-1);
      expect(t.elevation).toBeLessThanOrEqual(1);
    }
  });

  it('does not add chronicle entries', () => {
    const highTile = makeTile(0, 0, 0, 0.8);
    const lowTile  = makeTile(1, 5, 0, 0.1);
    const state = makeState(EROSION_INTERVAL, [highTile, lowTile]);
    const next = sim.tick(state);
    expect(next.chronicle.length).toBe(0);
  });

  it('recalculates biome when elevation changes significantly', () => {
    // A mountain tile (high elevation) next to a sea-level tile
    // After erosion the high tile elevation may drop, changing biome
    const highTile = { ...makeTile(0, 0, 0, 0.55), biome: BiomeType.Snow };
    const lowTile  = makeTile(1, 5, 0, 0.05);
    const state = makeState(EROSION_INTERVAL, [highTile, lowTile]);
    const next = sim.tick(state);
    // Biome should still be consistent with the new elevation
    const result = next.tiles[0];
    expect(result.isWater).toBe(result.elevation < 0.0);
  });

  it('returns same state reference when no tiles changed', () => {
    // Two tiles with elevation diff exactly at TALUS_ANGLE — no transfer
    const a = makeTile(0, 0, 0, 0.3);
    const b = makeTile(1, 5, 0, 0.25); // diff = 0.05 = TALUS_ANGLE exactly (no transfer)
    const state = makeState(EROSION_INTERVAL, [a, b]);
    const next = sim.tick(state);
    expect(next).toBe(state);
  });
});
