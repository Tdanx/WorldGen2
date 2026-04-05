import type { Tile } from '../../types/world';
import type { Civilization, CivId } from '../../types/civilization';
import { SpeciesRegistry } from '../../registries/SpeciesRegistry';
import { getBiomeDef } from '../../registries/BiomeRegistry';
import { mulberry32 } from '../../utils/rng';
import { distance2D } from '../../utils/math';
import { createCiv } from './SpeciesFactory';

const MIN_HABITABILITY = 0.3;
const MIN_SPAWN_DISTANCE = 100; // mapgen4 world-coordinate units (0–1000 range)

export interface SpawnResult {
  civilizations: Map<CivId, Civilization>;
  /** Full tiles array; only capital tiles have ownerId set. */
  tiles: Tile[];
}

/**
 * Places `numCivs` civilizations on the best available land tiles, ensuring
 * they are spread at least MIN_SPAWN_DISTANCE apart. Species are shuffled
 * and cycled deterministically from the provided seed.
 *
 * Gracefully returns fewer civs than requested if valid tiles run out.
 */
export function spawnCivilizations(
  tiles: ReadonlyArray<Tile>,
  seed: number,
  numCivs = 10,
): SpawnResult {
  const rng = mulberry32(seed);

  // --- Step 1: shuffle all species (Fisher-Yates), then cycle to fill numCivs slots ---
  const allSpecies = SpeciesRegistry.getAll();
  const shuffled = [...allSpecies];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // --- Step 2: filter candidate tiles ---
  // Exclude boundary sentinel tiles (x/y outside 0–1000) that mapgen4 adds
  // at the mesh convex hull — these appear as land but have no valid Voronoi cells.
  const candidates: Tile[] = tiles.filter(
    t => !t.isWater &&
         getBiomeDef(t.biome).habitability >= MIN_HABITABILITY &&
         t.x > 0 && t.x < 1000 && t.y > 0 && t.y < 1000,
  );

  // --- Step 3: iteratively pick capitals ---
  const chosenCapitals: Tile[] = [];
  const civilizations = new Map<CivId, Civilization>();

  for (let civIndex = 0; civIndex < numCivs; civIndex++) {
    const species = shuffled[civIndex % shuffled.length];

    // Remove candidates too close to already-chosen capitals
    const available = candidates.filter(tile =>
      chosenCapitals.every(
        cap => distance2D(tile.x, tile.y, cap.x, cap.y) >= MIN_SPAWN_DISTANCE,
      ),
    );

    if (available.length === 0) break; // graceful degradation

    // Score: base habitability + species biome preference bonus
    const scored = available.map(tile => ({
      tile,
      score: getBiomeDef(tile.biome).habitability +
             (species.preferredBiomes.includes(tile.biome) ? 0.3 : 0),
    }));
    scored.sort((a, b) => b.score - a.score);

    const chosenTile = scored[0].tile;
    chosenCapitals.push(chosenTile);

    const civ = createCiv(species, chosenTile, rng, 0, civIndex);
    civilizations.set(civ.id, civ);
  }

  // --- Step 4: build output tiles (shallow-copy only capital tiles) ---
  const civByCapital = new Map<number, CivId>();
  for (const civ of civilizations.values()) {
    civByCapital.set(civ.capitalTile, civ.id);
  }

  const outputTiles: Tile[] = tiles.map(tile => {
    const ownerId = civByCapital.get(tile.index);
    return ownerId !== undefined ? { ...tile, ownerId } : tile;
  });

  return { civilizations, tiles: outputTiles };
}
