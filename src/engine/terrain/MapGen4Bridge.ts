/**
 * MapGen4Bridge — converts mapgen4's dual-mesh output into our Tile[] array.
 *
 * mapgen4 stores data per-region (r) and per-triangle (t) in typed arrays.
 * Each "region" (Voronoi cell) becomes one Tile. TileIndex == region index.
 */

import type { Tile } from '../../types/world';
import { BiomeType } from '../../types/terrain';
import type { Mesh } from './mapgen4/types.d.ts';
import type MapGen4Map from './mapgen4/map';
import { SEA_LEVEL, BEACH_LEVEL, MOUNTAIN_LEVEL, SNOW_LEVEL } from '../../utils/constants';
import { clamp } from '../../utils/math';

/** Estimate temperature from latitude (y position) and elevation. */
export function computeTemperature(y: number, elevation: number): number {
  // y=0 is top (cold), y=1000 is bottom (warm) in mapgen4 space
  const latitude = 1 - (y / 1000); // 0=equator, 1=pole
  const base = 1 - latitude * 1.5; // warm equator, cold poles
  const altitudeCooling = Math.max(0, elevation - SEA_LEVEL) * 2.0;
  return clamp(base - altitudeCooling, -1, 1);
}

/** Whittaker-inspired biome assignment. */
export function assignBiome(elevation: number, moisture: number, temperature: number): BiomeType {
  if (elevation < SEA_LEVEL) {
    return elevation < SEA_LEVEL - 0.15 ? BiomeType.DeepOcean : BiomeType.ShallowSea;
  }
  if (elevation < BEACH_LEVEL) return BiomeType.Beach;
  if (elevation >= SNOW_LEVEL)  return BiomeType.Snow;
  if (elevation >= MOUNTAIN_LEVEL) return BiomeType.Mountain;

  // Land biomes: matrix of temperature × moisture
  if (temperature < -0.3) {
    return moisture > 0.4 ? BiomeType.BorealForest : BiomeType.Tundra;
  }
  if (temperature < 0.1) {
    return moisture > 0.5 ? BiomeType.TemperateForest : BiomeType.Grassland;
  }
  if (temperature < 0.5) {
    if (moisture > 0.6) return BiomeType.TemperateForest;
    if (moisture > 0.3) return BiomeType.Grassland;
    return BiomeType.Desert;
  }
  // Hot
  if (moisture > 0.6) return BiomeType.TropicalRainforest;
  if (moisture > 0.3) return BiomeType.Savanna;
  return BiomeType.Desert;
}

/** Check if any side adjacent to region r carries significant river flow. */
function isRiverRegion(r: number, mesh: Mesh, map: MapGen4Map): boolean {
  const MIN_RIVER_FLOW = 0.01;
  for (const s of mesh.s_around_r(r)) {
    if (map.flow_s[s] > MIN_RIVER_FLOW) return true;
  }
  return false;
}

export function bridgeMapGen4ToTiles(mesh: Mesh, map: MapGen4Map): Tile[] {
  const tiles: Tile[] = [];

  for (let r = 0; r < mesh.numSolidRegions; r++) {
    const elevation  = map.elevation_r[r];
    const moisture   = map.humidity_r[r] ?? map.rainfall_r[r];
    const x          = mesh.x_of_r(r);
    const y          = mesh.y_of_r(r);
    const isWater    = elevation < SEA_LEVEL;
    const temperature = computeTemperature(y, elevation);
    const biome      = assignBiome(elevation, moisture, temperature);
    const isRiver    = !isWater && isRiverRegion(r, mesh, map);

    tiles.push({
      index: r,
      x,
      y,
      elevation,
      moisture,
      temperature,
      biome,
      isWater,
      isRiver,
      riverFlow: null,
      ownerId: null,
      religionId: null,
    });
  }

  return tiles;
}
