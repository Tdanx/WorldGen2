import type { Civilization, CivId } from '../../types/civilization';
import type { Tile, TileIndex } from '../../types/world';
import { SpeciesRegistry } from '../../registries/SpeciesRegistry';
import { getBiomeDef } from '../../registries/BiomeRegistry';
import { distance2D } from '../../utils/math';

const EXPANSION_RADIUS = 100;       // world-units
const MIN_POP_TO_EXPAND = 50;
const MAX_POP_PER_TILE = 500;
const FAMINE_FERTILITY_THRESHOLD = 0.05;
const FAMINE_DEATH_RATE = 0.005;    // 0.5% population loss per tick during famine
const BASE_GROWTH_RATE = 0.02;      // 2% base growth per tick
const EXPANSION_TRAIT_WEIGHT = 0.5;

export function tickGrowth(
  civs: ReadonlyMap<CivId, Civilization>,
  tiles: ReadonlyArray<Tile>,
): { civs: Map<CivId, Civilization>; tiles: Tile[]; famineEvents: CivId[] } {
  // Index tiles by TileIndex for O(1) lookup
  const tileByIndex = new Map<TileIndex, Tile>();
  for (const tile of tiles) {
    tileByIndex.set(tile.index, tile);
  }

  // Track ownership changes locally (never mutate input)
  const ownerByIndex = new Map<TileIndex, CivId | null>();
  for (const tile of tiles) {
    ownerByIndex.set(tile.index, tile.ownerId);
  }

  const updatedCivs = new Map<CivId, Civilization>();
  const famineEvents: CivId[] = [];

  for (const civ of civs.values()) {
    const species = SpeciesRegistry.get(civ.speciesId);
    const expansionTrait = species?.traits.expansion ?? 0.5;

    // Average fertility across territory
    let totalFertility = 0;
    for (const tileIdx of civ.territory) {
      const t = tileByIndex.get(tileIdx);
      totalFertility += t ? getBiomeDef(t.biome).fertility : 0;
    }
    const avgFertility = civ.territory.length > 0
      ? totalFertility / civ.territory.length
      : 0;

    let population = civ.population;
    const maxPop = civ.territory.length * MAX_POP_PER_TILE;

    if (avgFertility < FAMINE_FERTILITY_THRESHOLD) {
      // Famine
      population -= Math.ceil(population * FAMINE_DEATH_RATE);
      if (population < 0) population = 0;
      famineEvents.push(civ.id);
    } else if (population > 0 && population < maxPop) {
      // Growth
      const gain = Math.max(
        1,
        Math.floor(population * BASE_GROWTH_RATE * avgFertility * (1 + expansionTrait * EXPANSION_TRAIT_WEIGHT)),
      );
      population = Math.min(population + gain, maxPop);
    }

    // Territory expansion
    let territory = civ.territory;
    if (population >= MIN_POP_TO_EXPAND) {
      let bestTile: Tile | null = null;
      let bestScore = -Infinity;

      for (const tile of tiles) {
        if (tile.isWater) continue;
        if (ownerByIndex.get(tile.index) !== null) continue;
        // Skip mesh boundary sentinel tiles (coordinates outside 0–1000 world space)
        if (tile.x < 0 || tile.x > 1000 || tile.y < 0 || tile.y > 1000) continue;

        // Check proximity: at least one territory tile within EXPANSION_RADIUS
        let inRange = false;
        for (const tileIdx of civ.territory) {
          const t = tileByIndex.get(tileIdx);
          if (t && distance2D(tile.x, tile.y, t.x, t.y) <= EXPANSION_RADIUS) {
            inRange = true;
            break;
          }
        }
        if (!inRange) continue;

        const biomeDef = getBiomeDef(tile.biome);
        const score = biomeDef.habitability + biomeDef.fertility;
        if (score > bestScore) {
          bestScore = score;
          bestTile = tile;
        }
      }

      if (bestTile !== null) {
        ownerByIndex.set(bestTile.index, civ.id);
        territory = [...civ.territory, bestTile.index];
      }
    }

    updatedCivs.set(civ.id, { ...civ, population, territory });
  }

  // Build output tiles: only copy tiles whose ownerId changed
  const outputTiles: Tile[] = tiles.map(tile => {
    const newOwner = ownerByIndex.get(tile.index);
    return newOwner !== tile.ownerId ? { ...tile, ownerId: newOwner ?? null } : tile;
  });

  return { civs: updatedCivs, tiles: outputTiles, famineEvents };
}
