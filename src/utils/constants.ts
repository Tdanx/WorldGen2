import type { WorldConfig } from '../types/world';

// Default world generation config
export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  seed: 12345,
  spacing: 5.5,       // ~25k Voronoi cells — good balance of detail vs performance
  seaLevel: 0.5,
  mountainSpacing: 35,
};

// World size presets (spacing controls cell density — smaller = more cells = more detail)
export const WORLD_SIZE_PRESETS = {
  Small:  { spacing: 9,   label: 'Small  (~8k cells)' },
  Medium: { spacing: 5.5, label: 'Medium (~25k cells)' },
  Large:  { spacing: 3,   label: 'Large  (~80k cells)' },
} as const;

// Biome assignment thresholds (used in MapGen4Bridge)
// mapgen4 elevation is in [-1, +1] where 0 = coastline / sea boundary
export const SEA_LEVEL      = 0.0;
export const BEACH_LEVEL    = 0.02;
export const MOUNTAIN_LEVEL = 0.30;
export const SNOW_LEVEL     = 0.55;

// War pressure threshold
export const WAR_THRESHOLD = 65;

// Simulation
export const ATTRITION_RATE = 0.05;
export const SOLDIER_TO_POP_RATIO = 0.1;
