/**
 * TectonicSimulator — autonomous geological uplift and volcanic activity.
 *
 * Fires every TECTONIC_INTERVAL ticks. On each tectonic event, one or two
 * volcanic hotspots are chosen and a Gaussian elevation bump is applied to
 * nearby tiles. Biomes and water flags are recomputed for any affected tile.
 *
 * KNOWN LIMITATION: Tile.elevation drives game-logic (biome, habitability,
 * war modifiers) and the overlay layers. It does NOT update the baked WebGL
 * terrain mesh from mapgen4 — the 3D shaded landscape is static after world
 * generation. Geological elevation changes are therefore visible in overlays
 * (PoliticalLayer, ClimateLayer) and in tile data (InfoTab) but not in the
 * base terrain rendering.
 */

import type { WorldState, Tile } from '../../types/world';
import type { ChronicleEntry } from '../../types/events';
import { BiomeType } from '../../types/terrain';
import { SEA_LEVEL, MOUNTAIN_LEVEL } from '../../utils/constants';
import { assignBiome } from './MapGen4Bridge';
import { mulberry32 } from '../../utils/rng';
import { makeEntryId } from '../core/idgen';
import { clamp } from '../../utils/math';

export const TECTONIC_INTERVAL = 200; // ticks between tectonic events
const MAX_EVENTS_PER_TICK = 2;
const UPLIFT_MAGNITUDE = 0.03;
const GAUSSIAN_SIGMA_WORLD = 55; // world-unit spread of the Gaussian bump

export class TectonicSimulator {
  tick(state: WorldState): WorldState {
    if (state.tiles.length === 0) return state;
    if (state.tick % TECTONIC_INTERVAL !== 0) return state;

    // Deterministic PRNG: unique per world-seed and tectonic epoch
    const epochSeed = (state.config.seed ^ ((state.tick * 2654435761) >>> 0)) >>> 0;
    const rng = mulberry32(epochSeed);

    const numEvents = 1 + Math.floor(rng() * MAX_EVENTS_PER_TICK);
    const landTiles = state.tiles.filter(t => !t.isWater);
    if (landTiles.length === 0) return state;

    // Build a mutable copy of tiles we'll mutate; share unchanged tiles by reference
    const tilesCopy: Tile[] = state.tiles.slice() as Tile[];
    const chronicle: ChronicleEntry[] = [];

    for (let e = 0; e < numEvents; e++) {
      // Prefer high-elevation land tiles as hotspot candidates
      const highLand = landTiles.filter(t => t.elevation >= MOUNTAIN_LEVEL);
      const candidates = highLand.length > 0 ? highLand : landTiles;
      const epicenter = candidates[Math.floor(rng() * candidates.length)];
      const uplift = UPLIFT_MAGNITUDE * (0.5 + rng() * 0.5); // 50–100% of max
      const sigma2 = GAUSSIAN_SIGMA_WORLD * GAUSSIAN_SIGMA_WORLD;

      for (let i = 0; i < tilesCopy.length; i++) {
        const tile = tilesCopy[i];
        const dx = tile.x - epicenter.x;
        const dy = tile.y - epicenter.y;
        const dist2 = dx * dx + dy * dy;
        const delta = uplift * Math.exp(-dist2 / sigma2);
        if (delta < 0.0005) continue; // negligible — skip

        const newElevation = clamp(tile.elevation + delta, -1, 1);
        const newIsWater = newElevation < SEA_LEVEL;

        // Epicenter tile may become volcanic
        const newBiome =
          tile === epicenter && newElevation > 0.45
            ? BiomeType.Volcano
            : assignBiome(newElevation, tile.moisture, tile.temperature);

        tilesCopy[i] = { ...tile, elevation: newElevation, isWater: newIsWater, biome: newBiome };
      }

      chronicle.push({
        id: makeEntryId('tectonic'),
        tick: state.tick,
        severity: 'epoch',
        eventType: 'natural_disaster',
        civIds: [],
        description: 'Tectonic forces reshape the land.',
        location: epicenter.index,
      });
    }

    return {
      ...state,
      tiles: tilesCopy,
      chronicle: [...state.chronicle, ...chronicle],
    };
  }
}
