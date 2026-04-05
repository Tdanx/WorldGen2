import { BiomeType } from '../types/terrain';

export interface BiomeDef {
  id: BiomeType;
  name: string;
  color: string;
  habitability: number;   // 0–1
  fertility: number;      // 0–1
  movementCost: number;   // 1 = normal; higher = harder terrain
}

const BIOME_REGISTRY: Record<BiomeType, BiomeDef> = {
  [BiomeType.DeepOcean]: {
    id: BiomeType.DeepOcean, name: 'Deep Ocean',
    color: '#1a3a6e', habitability: 0, fertility: 0, movementCost: 999,
  },
  [BiomeType.ShallowSea]: {
    id: BiomeType.ShallowSea, name: 'Shallow Sea',
    color: '#2a5a9e', habitability: 0, fertility: 0, movementCost: 5,
  },
  [BiomeType.Beach]: {
    id: BiomeType.Beach, name: 'Beach',
    color: '#e8d5a3', habitability: 0.3, fertility: 0.1, movementCost: 1.2,
  },
  [BiomeType.Desert]: {
    id: BiomeType.Desert, name: 'Desert',
    color: '#d9a84b', habitability: 0.2, fertility: 0.05, movementCost: 1.5,
  },
  [BiomeType.Savanna]: {
    id: BiomeType.Savanna, name: 'Savanna',
    color: '#c8b560', habitability: 0.6, fertility: 0.4, movementCost: 1.0,
  },
  [BiomeType.TropicalRainforest]: {
    id: BiomeType.TropicalRainforest, name: 'Tropical Rainforest',
    color: '#2d6a2d', habitability: 0.5, fertility: 0.8, movementCost: 2.0,
  },
  [BiomeType.Grassland]: {
    id: BiomeType.Grassland, name: 'Grassland',
    color: '#91c46c', habitability: 0.9, fertility: 0.7, movementCost: 1.0,
  },
  [BiomeType.TemperateForest]: {
    id: BiomeType.TemperateForest, name: 'Temperate Forest',
    color: '#4a7c4a', habitability: 0.7, fertility: 0.6, movementCost: 1.5,
  },
  [BiomeType.BorealForest]: {
    id: BiomeType.BorealForest, name: 'Boreal Forest',
    color: '#2e5e2e', habitability: 0.4, fertility: 0.3, movementCost: 1.8,
  },
  [BiomeType.Tundra]: {
    id: BiomeType.Tundra, name: 'Tundra',
    color: '#8fada8', habitability: 0.15, fertility: 0.1, movementCost: 1.8,
  },
  [BiomeType.Snow]: {
    id: BiomeType.Snow, name: 'Snow',
    color: '#ddeeff', habitability: 0.05, fertility: 0, movementCost: 2.5,
  },
  [BiomeType.Mountain]: {
    id: BiomeType.Mountain, name: 'Mountain',
    color: '#8a8a8a', habitability: 0.1, fertility: 0, movementCost: 3.0,
  },
  [BiomeType.Volcano]: {
    id: BiomeType.Volcano, name: 'Volcano',
    color: '#5a1a00', habitability: 0, fertility: 0, movementCost: 999,
  },
};

export function getBiomeDef(biome: BiomeType): BiomeDef {
  return BIOME_REGISTRY[biome];
}

export function getAllBiomeDefs(): BiomeDef[] {
  return Object.values(BIOME_REGISTRY);
}

export { BIOME_REGISTRY };
