/**
 * TerrainGenerator — orchestrates the full mapgen4 pipeline.
 *
 * Returns the mesh and map objects (kept by MapRenderer) plus
 * the flat Tile[] array that forms WorldState.tiles.
 */

import { createNoise2D } from 'simplex-noise';
import { makeRandFloat } from '@redblobgames/prng';
import { makeMesh } from './mapgen4/mesh';
import MapGen4Map from './mapgen4/map';
import param from './mapgen4/config.js';
import type { WorldConfig } from '../../types/world';
import type { Tile } from '../../types/world';
import type { Mesh } from './mapgen4/types.d.ts';
import { bridgeMapGen4ToTiles } from './MapGen4Bridge';

export interface TerrainResult {
  tiles: Tile[];
  mesh: Mesh;
  map: MapGen4Map;
}

/**
 * Build the 2D constraint grid that drives assignTriangleElevation.
 *
 * Uses 5-octave FBM for continental shapes + a mountain-boost pass
 * (from mapgen4's painting.ts). seaLevel shifts the land/ocean ratio:
 *   0.3 → more land (+0.2 bias), 0.7 → more ocean (−0.2 bias).
 *
 * Exported so unit tests can exercise it without constructing a full mesh.
 */
export function buildConstraintGrid(
  seed: number,
  seaLevel: number,
  size: number = 128,
): Float32Array {
  const noise2D = createNoise2D(makeRandFloat(seed));

  function fbm(nx: number, ny: number): number {
    let sum = 0, amp = 1, total = 0;
    for (let octave = 0; octave < 5; octave++) {
      const freq = 1 << octave;
      sum += amp * noise2D(nx * freq, ny * freq);
      total += amp;
      amp *= 0.5;
    }
    return sum / total;
  }

  // seaLevel=0.3 → seaBias=+0.2 (more land); seaLevel=0.7 → seaBias=−0.2 (more ocean)
  const seaBias = 0.5 - seaLevel;
  const data = new Float32Array(size * size);

  for (let cy = 0; cy < size; cy++) {
    for (let cx = 0; cx < size; cx++) {
      const nx = 2 * cx / size - 1;
      const ny = 2 * cy / size - 1;
      let e = Math.max(-1, Math.min(1, 0.5 * fbm(nx, ny) + seaBias));
      if (e > 0) {
        const m = 0.5 * noise2D(nx + 30, ny + 50)
                + 0.5 * noise2D(2 * nx + 33, 2 * ny + 55);
        const mountain = Math.min(1.0, e * 5.0) * (1 - Math.abs(m) / 0.5);
        if (mountain > 0.0) {
          e = Math.max(e, Math.min(e * 3, mountain));
        }
      }
      data[cy * size + cx] = e;
    }
  }

  return data;
}

export class TerrainGenerator {
  async generate(config: WorldConfig): Promise<TerrainResult> {
    const { seed, spacing, mountainSpacing, seaLevel } = config;

    // 1. Build Voronoi/Delaunay dual mesh (point generation is synchronous)
    const { mesh, t_peaks } = await makeMesh(seed, spacing);

    // 2. Build the mapgen4 Map and run terrain algorithms
    const map = new MapGen4Map(mesh, t_peaks, { ...param, spacing, mountainSpacing });

    const elevationParam = {
      seed,
      noisy_coastlines: param.elevation.noisy_coastlines ?? 0.01,
      hill_height: param.elevation.hill_height ?? 0.15,
      mountain_jagged: param.elevation.mountain_jagged ?? 0,
      mountain_sharpness: param.elevation.mountain_sharpness ?? 4,
      mountain_folds: param.elevation.mountain_folds ?? 3,
      ocean_depth: param.elevation.ocean_depth ?? 1.5,
    };

    const constraintSize = 128;
    const constraintData = buildConstraintGrid(seed, seaLevel, constraintSize);
    const constraints = { size: constraintSize, constraints: constraintData };

    map.assignElevation(elevationParam, constraints);
    map.assignRainfall({
      wind_angle_deg: param.biomes.wind_angle_deg ?? 0,
      raininess:      param.biomes.raininess      ?? 0.9,
      evaporation:    param.biomes.evaporation    ?? 0.5,
      rain_shadow:    param.biomes.rain_shadow    ?? 0.5,
    });
    map.assignRivers({
      flow: param.rivers.flow ?? 0.2,
    });
    map.assignRegionElevation();

    // 3. Convert dual-mesh regions → Tile[]
    const tiles = bridgeMapGen4ToTiles(mesh, map);

    return { tiles, mesh, map };
  }
}
