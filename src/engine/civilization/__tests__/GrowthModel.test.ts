import { describe, it, expect } from 'vitest';
import { tickGrowth } from '../GrowthModel';
import type { Civilization } from '../../../types/civilization';
import type { Tile } from '../../../types/world';
import { BiomeType } from '../../../types/terrain';

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

function makeTile(index: number, x: number, y: number, biome: BiomeType, ownerId: string | null = null): Tile {
  return {
    index, x, y,
    elevation: 0.3, moisture: 0.6, temperature: 0.2,
    biome,
    isWater: false, isRiver: false, riverFlow: null,
    ownerId, religionId: null,
  };
}

/** 20×20 Grassland grid, spacing=55. */
function makeGrasslandGrid(): Tile[] {
  const GRID_SIZE = 20;
  const SPACING = 55;
  const tiles: Tile[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const index = row * GRID_SIZE + col;
      tiles.push(makeTile(index, col * SPACING, row * SPACING, BiomeType.Grassland));
    }
  }
  return tiles;
}

/** Single Snow tile at (0,0) owned by civ-0, plus unclaimed adjacent tiles. */
function makeSnowGrid(): Tile[] {
  return makeGrasslandGrid().map(t => ({ ...t, biome: BiomeType.Snow }));
}

/** Single TropicalRainforest tile at (0,0) owned by civ-0. */
function makeTropicalGrid(): Tile[] {
  return makeGrasslandGrid().map(t => ({ ...t, biome: BiomeType.TropicalRainforest }));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('tickGrowth', () => {
  describe('population growth', () => {
    it('population increases each tick on fertile land (Grassland)', () => {
      const tiles = makeGrasslandGrid().map((t, i) =>
        i === 0 ? { ...t, ownerId: 'civ-0' } : t,
      );
      const civ = makeCiv({ population: 100 });
      const civs = new Map([['civ-0', civ]]);
      const { civs: result } = tickGrowth(civs, tiles);
      expect(result.get('civ-0')!.population).toBeGreaterThan(100);
    });

    it('tropical produces more growth per tick than grassland at same population', () => {
      const makeGridWith = (biome: BiomeType) =>
        makeGrasslandGrid().map((t, i) =>
          i === 0 ? { ...t, biome, ownerId: 'civ-0' } : { ...t, biome },
        );

      const civ = makeCiv({ population: 200 });
      const civs = new Map([['civ-0', civ]]);

      const { civs: grassResult } = tickGrowth(civs, makeGridWith(BiomeType.Grassland));
      const { civs: tropResult } = tickGrowth(civs, makeGridWith(BiomeType.TropicalRainforest));

      expect(tropResult.get('civ-0')!.population).toBeGreaterThan(grassResult.get('civ-0')!.population);
    });

    it('population caps at territory.length × 500', () => {
      // With 1 tile, cap = 500
      const tiles = makeGrasslandGrid().map((t, i) =>
        i === 0 ? { ...t, ownerId: 'civ-0' } : t,
      );
      const civ = makeCiv({ population: 499 });
      const civs = new Map([['civ-0', civ]]);
      const { civs: result } = tickGrowth(civs, tiles);
      expect(result.get('civ-0')!.population).toBeLessThanOrEqual(500);
    });

    it('emits famine flag when avgFertility < 0.1 (Snow fertility = 0)', () => {
      const tiles = makeSnowGrid().map((t, i) =>
        i === 0 ? { ...t, ownerId: 'civ-0' } : t,
      );
      const civ = makeCiv({ population: 100 });
      const civs = new Map([['civ-0', civ]]);
      const { famineEvents } = tickGrowth(civs, tiles);
      expect(famineEvents).toContain('civ-0');
    });

    it('population declines during famine (Snow)', () => {
      const tiles = makeSnowGrid().map((t, i) =>
        i === 0 ? { ...t, ownerId: 'civ-0' } : t,
      );
      const civ = makeCiv({ population: 100 });
      const civs = new Map([['civ-0', civ]]);
      const { civs: result } = tickGrowth(civs, tiles);
      expect(result.get('civ-0')!.population).toBeLessThan(100);
    });

    it('no growth when population is 0', () => {
      const tiles = makeGrasslandGrid().map((t, i) =>
        i === 0 ? { ...t, ownerId: 'civ-0' } : t,
      );
      const civ = makeCiv({ population: 0 });
      const civs = new Map([['civ-0', civ]]);
      const { civs: result } = tickGrowth(civs, tiles);
      // population should stay 0 (no Math.max(1,...) exploit)
      expect(result.get('civ-0')!.population).toBe(0);
    });
  });

  describe('territory expansion', () => {
    it('territory grows by exactly 1 tile per tick when pop >= 50', () => {
      const tiles = makeGrasslandGrid().map((t, i) =>
        i === 0 ? { ...t, ownerId: 'civ-0' } : t,
      );
      const civ = makeCiv({ population: 100 });
      const civs = new Map([['civ-0', civ]]);
      const { civs: result } = tickGrowth(civs, tiles);
      expect(result.get('civ-0')!.territory).toHaveLength(2);
    });

    it('territory does NOT grow when pop < 50 (post-growth)', () => {
      // Start at pop=30; gain=1 → ends at 31, still < 50 → no expansion
      const tiles = makeGrasslandGrid().map((t, i) =>
        i === 0 ? { ...t, ownerId: 'civ-0' } : t,
      );
      const civ = makeCiv({ population: 30 });
      const civs = new Map([['civ-0', civ]]);
      const { civs: result } = tickGrowth(civs, tiles);
      expect(result.get('civ-0')!.territory).toHaveLength(1);
    });

    it('expanded tile has ownerId set to civ.id', () => {
      const tiles = makeGrasslandGrid().map((t, i) =>
        i === 0 ? { ...t, ownerId: 'civ-0' } : t,
      );
      const civ = makeCiv({ population: 100 });
      const civs = new Map([['civ-0', civ]]);
      const { civs: resultCivs, tiles: resultTiles } = tickGrowth(civs, tiles);
      const newTile = resultCivs.get('civ-0')!.territory[1];
      expect(resultTiles.find(t => t.index === newTile)!.ownerId).toBe('civ-0');
    });

    it('expanded tile is not water', () => {
      const tiles = makeGrasslandGrid().map((t, i) =>
        i === 0 ? { ...t, ownerId: 'civ-0' } : t,
      );
      const civ = makeCiv({ population: 100 });
      const civs = new Map([['civ-0', civ]]);
      const { civs: resultCivs, tiles: resultTiles } = tickGrowth(civs, tiles);
      const newTileIdx = resultCivs.get('civ-0')!.territory[1];
      expect(resultTiles.find(t => t.index === newTileIdx)!.isWater).toBe(false);
    });

    it('expanded tile is within 100 world-units of existing territory', () => {
      const tiles = makeGrasslandGrid().map((t, i) =>
        i === 0 ? { ...t, ownerId: 'civ-0' } : t,
      );
      const civ = makeCiv({ population: 100 });
      const civs = new Map([['civ-0', civ]]);
      const { civs: resultCivs, tiles: resultTiles } = tickGrowth(civs, tiles);
      const capitalTile = resultTiles.find(t => t.index === 0)!;
      const newTileIdx = resultCivs.get('civ-0')!.territory[1];
      const newTile = resultTiles.find(t => t.index === newTileIdx)!;
      const dist = Math.sqrt((newTile.x - capitalTile.x) ** 2 + (newTile.y - capitalTile.y) ** 2);
      expect(dist).toBeLessThanOrEqual(100);
    });

    it('territory does NOT expand into already-owned tiles', () => {
      // Mark tile 1 as owned by another civ; verify civ-0 never claims it
      const tiles = makeGrasslandGrid().map((t, i) => {
        if (i === 0) return { ...t, ownerId: 'civ-0' };
        if (i === 1) return { ...t, ownerId: 'civ-1' };
        return t;
      });
      const civ0 = makeCiv({ id: 'civ-0', population: 100 });
      const civ1 = makeCiv({ id: 'civ-1', territory: [1], population: 100 });
      const civs = new Map([['civ-0', civ0], ['civ-1', civ1]]);
      const { civs: result } = tickGrowth(civs, tiles);
      const civ0Territory = result.get('civ-0')!.territory;
      expect(civ0Territory).not.toContain(1);
    });
  });

  describe('immutability', () => {
    it('input tiles array is not mutated', () => {
      const tiles = makeGrasslandGrid().map((t, i) =>
        i === 0 ? { ...t, ownerId: 'civ-0' } : t,
      );
      const originalOwnerIds = tiles.map(t => t.ownerId);
      const civ = makeCiv({ population: 100 });
      const civs = new Map([['civ-0', civ]]);
      tickGrowth(civs, tiles);
      expect(tiles.map(t => t.ownerId)).toEqual(originalOwnerIds);
    });

    it('input civ map is not mutated', () => {
      const tiles = makeGrasslandGrid().map((t, i) =>
        i === 0 ? { ...t, ownerId: 'civ-0' } : t,
      );
      const civ = makeCiv({ population: 100 });
      const civs = new Map([['civ-0', civ]]);
      const originalPop = civ.population;
      tickGrowth(civs, tiles);
      expect(civs.get('civ-0')!.population).toBe(originalPop);
    });
  });
});
