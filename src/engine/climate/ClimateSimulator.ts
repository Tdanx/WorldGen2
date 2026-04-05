/**
 * ClimateSimulator — tick-driven seasonal climate cycles.
 *
 * Each tick, recalculates per-tile temperature using:
 *   1. Latitude (y position in world space: y=0 = north/cold, y=1000 = south/warm)
 *   2. Seasonal sinusoidal offset driven by tick % YEAR_LENGTH
 *   3. Elevation cooling (high land is colder regardless of season)
 *
 * Moisture is updated with a mild seasonal signal:
 *   - Summer: inland tiles lose a little moisture (evaporation)
 *   - Winter: moisture stabilises near baseline
 *   - Ocean/river tiles are unaffected (always saturated)
 *
 * The simulation does NOT reassign biomes on every tick — biomes are
 * geological and only change via god commands. Climate is a separate
 * overlay that drives the ClimateLayer renderer.
 */

import type { WorldState, Tile } from '../../types/world';
import { clamp } from '../../utils/math';

export const YEAR_LENGTH = 400; // ticks per simulated year
export const SEASONAL_AMPLITUDE = 0.25; // max ±temperature swing

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** Returns the season name for a given tick. */
export function getSeason(tick: number): Season {
  const phase = (tick % YEAR_LENGTH) / YEAR_LENGTH;
  if (phase < 0.25) return 'spring';
  if (phase < 0.5)  return 'summer';
  if (phase < 0.75) return 'autumn';
  return 'winter';
}

/** Returns the year number (1-indexed) for a given tick. */
export function getYear(tick: number): number {
  return Math.floor(tick / YEAR_LENGTH) + 1;
}

/** 0..1 progress through the current year (0 = spring start, 1 = next spring). */
export function getSeasonPhase(tick: number): number {
  return (tick % YEAR_LENGTH) / YEAR_LENGTH;
}

function computeTemperature(tile: Tile, seasonalOffset: number): number {
  // Latitude gradient: y=0 (north/cold) → y=1000 (south/warm equator)
  const latitudeFactor = tile.y / 1000; // 0 = north pole, 1 = tropics
  const baseTemp = latitudeFactor * 1.5 - 0.5; // range: -0.5 (pole) to +1.0 (tropics)
  const elevCooling = Math.max(0, tile.elevation) * 2.0;
  return clamp(baseTemp + seasonalOffset - elevCooling, -1, 1);
}

export class ClimateSimulator {
  /**
   * Recalculate per-tile temperature for the new tick.
   * Temperature is computed from first principles (latitude + elevation + season)
   * so it is stable and never drifts over time.
   *
   * Moisture is intentionally left unchanged — mapgen4's hydraulic simulation
   * provides a good static baseline; seasonal moisture cycles would require a
   * dedicated `baseMoisture` field to avoid per-tick drift.
   *
   * Pure function — does not mutate inputs.
   */
  tick(state: WorldState): WorldState {
    const phase = getSeasonPhase(state.tick);

    // sin(0) = spring (rising), sin(π/2) = summer (peak warm),
    // sin(π) = autumn (falling), sin(3π/2) = winter (peak cold)
    const seasonalOffset = Math.sin(2 * Math.PI * phase) * SEASONAL_AMPLITUDE;

    const newTiles = state.tiles.map(tile => {
      const temperature = computeTemperature(tile, seasonalOffset);

      // Skip object allocation when temperature hasn't changed meaningfully
      // (common case when the simulation runs ahead by a tick at the same phase)
      if (Math.abs(temperature - tile.temperature) < 0.001) return tile;

      return { ...tile, temperature };
    });

    return { ...state, tiles: newTiles };
  }
}
