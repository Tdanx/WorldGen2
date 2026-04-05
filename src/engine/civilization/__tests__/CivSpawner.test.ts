import { describe, it, expect } from 'vitest';
import { spawnCivilizations } from '../CivSpawner';
import type { Tile } from '../../../types/world';
import { BiomeType } from '../../../types/terrain';

// ─── Tile grid fixtures ──────────────────────────────────────────────────────

/**
 * 20×20 grassland grid. Tiles are 55 world-units apart.
 * Grid spans 0–1045 in both x and y (mapgen4 0–1000 space).
 * 400 tiles, all habitability 0.9 — well above MIN_HABITABILITY (0.3).
 * 3-step spacing (3 × 55 = 165) exceeds MIN_SPAWN_DISTANCE (150), so
 * 6 well-separated capitals can always be placed.
 */
function makeGrasslandGrid(): Tile[] {
  const GRID_SIZE = 20;
  const SPACING = 55;
  const tiles: Tile[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      tiles.push({
        index: row * GRID_SIZE + col,
        x: col * SPACING,
        y: row * SPACING,
        elevation: 0.3, moisture: 0.6, temperature: 0.2,
        biome: BiomeType.Grassland,
        isWater: false, isRiver: false, riverFlow: null,
        ownerId: null, religionId: null,
      });
    }
  }
  return tiles;
}

/** Only the first 3 tiles are land; the rest are water. */
function makeSparseGrid(): Tile[] {
  return makeGrasslandGrid().map((t, i) =>
    i < 3 ? t : { ...t, isWater: true },
  );
}

/** All tiles are Desert (habitability 0.2 < MIN_HABITABILITY 0.3 → zero candidates). */
function makeDesertGrid(): Tile[] {
  return makeGrasslandGrid().map(t => ({ ...t, biome: BiomeType.Desert }));
}

/** All tiles are Beach (habitability exactly 0.3 — at threshold, valid but no species prefers it). */
function makeBeachGrid(): Tile[] {
  return makeGrasslandGrid().map(t => ({ ...t, biome: BiomeType.Beach }));
}

/** All tiles are water. */
function makeAllWaterGrid(): Tile[] {
  return makeGrasslandGrid().map(t => ({ ...t, isWater: true }));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('spawnCivilizations', () => {
  describe('result count', () => {
    it('returns exactly 6 civs by default', () => {
      const { civilizations } = spawnCivilizations(makeGrasslandGrid(), 42);
      expect(civilizations.size).toBe(6);
    });

    it('returns exactly N civs when numCivs is specified', () => {
      const { civilizations } = spawnCivilizations(makeGrasslandGrid(), 42, 3);
      expect(civilizations.size).toBe(3);
    });

    it('returns 0 civs when numCivs is 0', () => {
      const { civilizations } = spawnCivilizations(makeGrasslandGrid(), 42, 0);
      expect(civilizations.size).toBe(0);
    });
  });

  describe('capital tile constraints', () => {
    it('no two civs share the same capital tile', () => {
      const { civilizations } = spawnCivilizations(makeGrasslandGrid(), 42);
      const capitals = [...civilizations.values()].map(c => c.capitalTile);
      expect(new Set(capitals).size).toBe(capitals.length);
    });

    it('all capitals are on non-water tiles', () => {
      const tiles = makeGrasslandGrid();
      const { civilizations } = spawnCivilizations(tiles, 42);
      const tileByIndex = new Map(tiles.map(t => [t.index, t]));
      for (const civ of civilizations.values()) {
        expect(tileByIndex.get(civ.capitalTile)!.isWater).toBe(false);
      }
    });

    it('all capitals are on tiles with habitability >= 0.3 (Grassland = 0.9)', () => {
      const tiles = makeGrasslandGrid();
      const { civilizations } = spawnCivilizations(tiles, 42);
      const tileByIndex = new Map(tiles.map(t => [t.index, t]));
      for (const civ of civilizations.values()) {
        expect(tileByIndex.get(civ.capitalTile)!.biome).toBe(BiomeType.Grassland);
      }
    });

    it('all capitals are at least 150 world-units apart from each other', () => {
      const tiles = makeGrasslandGrid();
      const { civilizations } = spawnCivilizations(tiles, 42);
      const civList = [...civilizations.values()];
      const tileByIndex = new Map(tiles.map(t => [t.index, t]));

      for (let i = 0; i < civList.length; i++) {
        for (let j = i + 1; j < civList.length; j++) {
          const tA = tileByIndex.get(civList[i].capitalTile)!;
          const tB = tileByIndex.get(civList[j].capitalTile)!;
          const dist = Math.sqrt((tA.x - tB.x) ** 2 + (tA.y - tB.y) ** 2);
          expect(dist).toBeGreaterThanOrEqual(150);
        }
      }
    });
  });

  describe('tile ownerId assignment', () => {
    it('capital tiles have ownerId set to the civ id', () => {
      const inputTiles = makeGrasslandGrid();
      const { civilizations, tiles } = spawnCivilizations(inputTiles, 42);
      const tileByIndex = new Map(tiles.map(t => [t.index, t]));
      for (const civ of civilizations.values()) {
        expect(tileByIndex.get(civ.capitalTile)!.ownerId).toBe(civ.id);
      }
    });

    it('non-capital tiles have ownerId === null', () => {
      const inputTiles = makeGrasslandGrid();
      const { civilizations, tiles } = spawnCivilizations(inputTiles, 42);
      const capitalIndices = new Set([...civilizations.values()].map(c => c.capitalTile));
      for (const tile of tiles) {
        if (!capitalIndices.has(tile.index)) {
          expect(tile.ownerId).toBeNull();
        }
      }
    });

    it('output tiles array has the same length as input', () => {
      const inputTiles = makeGrasslandGrid();
      const { tiles } = spawnCivilizations(inputTiles, 42);
      expect(tiles.length).toBe(inputTiles.length);
    });

    it('original input tiles are NOT mutated (ownerId stays null)', () => {
      const inputTiles = makeGrasslandGrid();
      spawnCivilizations(inputTiles, 42);
      for (const tile of inputTiles) {
        expect(tile.ownerId).toBeNull();
      }
    });
  });

  describe('determinism', () => {
    it('same seed produces identical capital tile indices and civ ids', () => {
      const tiles = makeGrasslandGrid();
      const resultA = spawnCivilizations(tiles, 99);
      const resultB = spawnCivilizations(tiles, 99);
      const sort = (civs: Map<string, { id: string; capitalTile: number }>) =>
        [...civs.values()].sort((a, b) => a.id.localeCompare(b.id));

      const civsA = sort(resultA.civilizations);
      const civsB = sort(resultB.civilizations);
      expect(civsA.map(c => c.capitalTile)).toEqual(civsB.map(c => c.capitalTile));
      expect(civsA.map(c => c.id)).toEqual(civsB.map(c => c.id));
    });

    it('different seeds produce different civ names (species shuffle + RNG state diverges)', () => {
      // On a uniform biome grid, tile positions are score-tied so the same tiles are
      // always chosen. Seed variation shows up in species shuffle order and subsequent
      // RNG draws for prefix/suffix/population, which change civ names.
      const tiles = makeGrasslandGrid();
      const namesA = [...spawnCivilizations(tiles, 1).civilizations.values()]
        .map(c => c.name).sort().join('|');
      const namesB = [...spawnCivilizations(tiles, 9999).civilizations.values()]
        .map(c => c.name).sort().join('|');
      expect(namesA).not.toBe(namesB);
    });
  });

  describe('graceful degradation', () => {
    it('returns fewer civs without throwing when valid tiles are scarce', () => {
      expect(() => spawnCivilizations(makeSparseGrid(), 42, 6)).not.toThrow();
      const { civilizations } = spawnCivilizations(makeSparseGrid(), 42, 6);
      expect(civilizations.size).toBeLessThanOrEqual(3);
    });

    it('returns 0 civs without throwing when all tiles are water', () => {
      expect(() => spawnCivilizations(makeAllWaterGrid(), 42)).not.toThrow();
      const { civilizations } = spawnCivilizations(makeAllWaterGrid(), 42);
      expect(civilizations.size).toBe(0);
    });

    it('returns 0 civs without throwing when all land tiles are below MIN_HABITABILITY', () => {
      expect(() => spawnCivilizations(makeDesertGrid(), 42)).not.toThrow();
      const { civilizations } = spawnCivilizations(makeDesertGrid(), 42);
      expect(civilizations.size).toBe(0);
    });

    it('all output tiles have ownerId null when 0 civs spawn', () => {
      const { tiles } = spawnCivilizations(makeDesertGrid(), 42);
      expect(tiles.every(t => t.ownerId === null)).toBe(true);
    });

    it('output tiles array length is preserved even when 0 civs spawn', () => {
      const desertTiles = makeDesertGrid();
      const { tiles } = spawnCivilizations(desertTiles, 42);
      expect(tiles).toHaveLength(desertTiles.length);
    });
  });

  describe('species preference', () => {
    it('all 6 civs spawn on a Beach-only grid (species adapt when no preferred biome exists)', () => {
      // Beach habitability = 0.3, exactly at threshold. No species prefers Beach,
      // but the tiles are still valid candidates. Expect all 6 to be placed.
      const { civilizations } = spawnCivilizations(makeBeachGrid(), 42, 6);
      expect(civilizations.size).toBe(6);
    });
  });

  describe('civilization shape', () => {
    it('each civ has era "Stone" and techLevel 0', () => {
      const { civilizations } = spawnCivilizations(makeGrasslandGrid(), 42);
      for (const civ of civilizations.values()) {
        expect(civ.era).toBe('Stone');
        expect(civ.techLevel).toBe(0);
      }
    });

    it('each civ has lifecycle.phase "founding"', () => {
      const { civilizations } = spawnCivilizations(makeGrasslandGrid(), 42);
      for (const civ of civilizations.values()) {
        expect(civ.lifecycle.phase).toBe('founding');
      }
    });

    it('each civ id matches pattern "civ-N"', () => {
      const { civilizations } = spawnCivilizations(makeGrasslandGrid(), 42);
      for (const civ of civilizations.values()) {
        expect(civ.id).toMatch(/^civ-\d+$/);
      }
    });

    it('map keys match civ.id values', () => {
      const { civilizations } = spawnCivilizations(makeGrasslandGrid(), 42);
      for (const [key, civ] of civilizations) {
        expect(key).toBe(civ.id);
      }
    });
  });
});
