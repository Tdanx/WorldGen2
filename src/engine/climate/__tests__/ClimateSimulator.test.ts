import { describe, it, expect } from 'vitest';
import { ClimateSimulator, getSeason, getYear, YEAR_LENGTH } from '../ClimateSimulator';
import { BiomeType } from '../../../types/terrain';
import type { Tile, WorldState } from '../../../types/world';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTile(index: number, overrides: Partial<Tile> = {}): Tile {
  return {
    index,
    x: 500, y: 500, // mid-world (temperate latitude)
    elevation: 0.1, // low land
    moisture: 0.5,
    temperature: 0.0,
    biome: BiomeType.Grassland,
    isWater: false,
    isRiver: false,
    riverFlow: null,
    ownerId: null,
    religionId: null,
    ...overrides,
  };
}

function makeState(tick: number, tiles: Tile[]): WorldState {
  return {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick,
    tiles,
    civilizations: new Map(),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
  };
}

const sim = new ClimateSimulator();

// ─── getSeason ────────────────────────────────────────────────────────────────

describe('getSeason', () => {
  it('tick 0 is spring', () => expect(getSeason(0)).toBe('spring'));
  it('tick YEAR_LENGTH*0.25 is summer', () => expect(getSeason(YEAR_LENGTH * 0.25)).toBe('summer'));
  it('tick YEAR_LENGTH*0.5 is autumn', () => expect(getSeason(YEAR_LENGTH * 0.5)).toBe('autumn'));
  it('tick YEAR_LENGTH*0.75 is winter', () => expect(getSeason(YEAR_LENGTH * 0.75)).toBe('winter'));
  it('wraps correctly at second year', () => expect(getSeason(YEAR_LENGTH)).toBe('spring'));
});

// ─── getYear ──────────────────────────────────────────────────────────────────

describe('getYear', () => {
  it('tick 0 → year 1', () => expect(getYear(0)).toBe(1));
  it('tick YEAR_LENGTH-1 → still year 1', () => expect(getYear(YEAR_LENGTH - 1)).toBe(1));
  it('tick YEAR_LENGTH → year 2', () => expect(getYear(YEAR_LENGTH)).toBe(2));
  it('tick YEAR_LENGTH*10 → year 11', () => expect(getYear(YEAR_LENGTH * 10)).toBe(11));
});

// ─── ClimateSimulator.tick ────────────────────────────────────────────────────

describe('ClimateSimulator.tick', () => {
  it('does not mutate the input state', () => {
    const tile = makeTile(0);
    const state = makeState(0, [tile]);
    const origTemp = tile.temperature;
    sim.tick(state);
    expect(tile.temperature).toBe(origTemp);
  });

  it('returns a new state object', () => {
    const state = makeState(0, [makeTile(0)]);
    const next = sim.tick(state);
    expect(next).not.toBe(state);
  });

  it('summer tick produces higher temperature than winter tick (same tile)', () => {
    const tile = makeTile(0, { y: 500 });
    const summerTick = Math.floor(YEAR_LENGTH * 0.375); // mid-summer
    const winterTick = Math.floor(YEAR_LENGTH * 0.875); // mid-winter

    const summerState  = sim.tick(makeState(summerTick, [{ ...tile }]));
    const winterState  = sim.tick(makeState(winterTick, [{ ...tile }]));

    expect(summerState.tiles[0].temperature).toBeGreaterThan(winterState.tiles[0].temperature);
  });

  it('northern tile (y=0) is colder than southern tile (y=1000) in same tick', () => {
    const northTile = makeTile(0, { y: 0 });
    const southTile = makeTile(1, { y: 1000 });
    const state = makeState(0, [northTile, southTile]);
    const next = sim.tick(state);
    expect(next.tiles[0].temperature).toBeLessThan(next.tiles[1].temperature);
  });

  it('high elevation tile is colder than low elevation tile at same latitude', () => {
    const lowTile  = makeTile(0, { y: 500, elevation: 0.0 });
    const highTile = makeTile(1, { y: 500, elevation: 0.7 });
    const state = makeState(0, [lowTile, highTile]);
    const next = sim.tick(state);
    expect(next.tiles[0].temperature).toBeGreaterThan(next.tiles[1].temperature);
  });

  it('temperature is always within [-1, 1]', () => {
    const tiles = [
      makeTile(0, { y: 0,    elevation: 1.0 }), // extreme cold
      makeTile(1, { y: 1000, elevation: -1.0 }), // extreme warm
    ];
    // Test across several ticks including summer and winter peaks
    const ticks = [0, 50, 100, 150, 200, 300];
    for (const tick of ticks) {
      const next = sim.tick(makeState(tick, tiles));
      for (const t of next.tiles) {
        expect(t.temperature).toBeGreaterThanOrEqual(-1);
        expect(t.temperature).toBeLessThanOrEqual(1);
      }
    }
  });

  it('moisture is not modified by climate tick (stable baseline)', () => {
    const tile = makeTile(0, { moisture: 0.7 });
    const state = makeState(Math.floor(YEAR_LENGTH * 0.375), [tile]); // mid-summer
    const next = sim.tick(state);
    expect(next.tiles[0].moisture).toBe(0.7);
  });

  it('biome is not changed by climate tick', () => {
    const tile = makeTile(0, { biome: BiomeType.Desert });
    const state = makeState(0, [tile]);
    const next = sim.tick(state);
    expect(next.tiles[0].biome).toBe(BiomeType.Desert);
  });

  it('skips tile object allocation when temperature is already current', () => {
    // After one tick, the tile has the correct temperature for tick=50.
    // Running tick again with the same tick number should return the same tile reference.
    const tile = makeTile(0);
    const state1 = sim.tick(makeState(50, [tile]));
    const tileAfter1 = state1.tiles[0];
    // Build a new state that still has tick=50 but already has the updated tile
    const state2 = sim.tick({ ...state1, tick: 50 });
    expect(state2.tiles[0]).toBe(tileAfter1);
  });
});
