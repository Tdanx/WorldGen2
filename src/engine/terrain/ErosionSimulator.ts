/**
 * ErosionSimulator — thermal erosion of terrain over geological time.
 *
 * Fires every EROSION_INTERVAL ticks. On each erosion pass, tile pairs whose
 * elevation difference exceeds TALUS_ANGLE have sediment transferred from
 * the higher tile to the lower tile, smoothing the landscape over time.
 *
 * A spatial grid is built each erosion tick to find neighbors efficiently
 * without requiring a stored adjacency list. The grid is discarded after use.
 *
 * KNOWN LIMITATION: Same as TectonicSimulator — elevation changes affect
 * game logic and overlay layers but not the static base WebGL terrain mesh.
 */

import type { WorldState, Tile } from '../../types/world';
import { SEA_LEVEL } from '../../utils/constants';
import { assignBiome } from './MapGen4Bridge';
import { clamp } from '../../utils/math';

export const EROSION_INTERVAL = 50;    // ticks between erosion passes
const TALUS_ANGLE  = 0.05;             // minimum elevation diff to trigger transfer
const EROSION_RATE = 0.003;            // fraction of excess slope transferred per pass

export class ErosionSimulator {
  tick(state: WorldState): WorldState {
    if (state.tiles.length === 0) return state;
    if (state.tick % EROSION_INTERVAL !== 0) return state;

    // Build a spatial grid for neighbor lookup.
    // Cell size is chosen so each tile has a small number of grid-neighbors
    // to check. Spacing=5.5 → typical tile separation ~5.5 world units;
    // a cell of 82 world units (~15× spacing) keeps the bucket count manageable.
    const cellSize = state.config.spacing * 15;
    const grid = new Map<string, number[]>(); // "cx,cy" → tile indices

    for (let i = 0; i < state.tiles.length; i++) {
      const tile = state.tiles[i];
      const cx = Math.floor(tile.x / cellSize);
      const cy = Math.floor(tile.y / cellSize);
      const key = `${cx},${cy}`;
      const bucket = grid.get(key);
      if (bucket) bucket.push(i);
      else grid.set(key, [i]);
    }

    // Accumulate elevation deltas rather than mutating tiles in-place
    // so each pass is based on the original state (no order dependency).
    const deltas = new Float64Array(state.tiles.length);

    for (let i = 0; i < state.tiles.length; i++) {
      const tile = state.tiles[i];
      if (tile.isWater) continue; // water tiles are not eroded

      const cx = Math.floor(tile.x / cellSize);
      const cy = Math.floor(tile.y / cellSize);

      // Check 3×3 neighborhood of grid cells
      for (let nx = cx - 1; nx <= cx + 1; nx++) {
        for (let ny = cy - 1; ny <= cy + 1; ny++) {
          const bucket = grid.get(`${nx},${ny}`);
          if (!bucket) continue;
          for (const j of bucket) {
            if (j <= i) continue; // process each pair once
            const neighbor = state.tiles[j];
            const diff = tile.elevation - neighbor.elevation;
            if (Math.abs(diff) <= TALUS_ANGLE) continue;

            const transfer = (Math.abs(diff) - TALUS_ANGLE) * EROSION_RATE * 0.5;
            if (diff > 0) {
              // tile is higher → loses elevation, neighbor gains
              deltas[i] -= transfer;
              deltas[j] += transfer;
            } else {
              // neighbor is higher → neighbor loses, tile gains
              deltas[i] += transfer;
              deltas[j] -= transfer;
            }
          }
        }
      }
    }

    // Apply deltas; only allocate new tile objects where elevation changed
    let changed = false;
    const newTiles: Tile[] = state.tiles.slice() as Tile[];
    for (let i = 0; i < newTiles.length; i++) {
      if (Math.abs(deltas[i]) < 0.0001) continue;
      const tile = newTiles[i];
      const newElevation = clamp(tile.elevation + deltas[i], -1, 1);

      changed = true;
      const newIsWater = newElevation < SEA_LEVEL;
      const newBiome = assignBiome(newElevation, tile.moisture, tile.temperature);
      newTiles[i] = { ...tile, elevation: newElevation, isWater: newIsWater, biome: newBiome };
    }

    if (!changed) return state;
    return { ...state, tiles: newTiles };
  }
}
