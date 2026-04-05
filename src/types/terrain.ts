export enum BiomeType {
  DeepOcean = 'DeepOcean',
  ShallowSea = 'ShallowSea',
  Beach = 'Beach',
  Desert = 'Desert',
  Savanna = 'Savanna',
  TropicalRainforest = 'TropicalRainforest',
  Grassland = 'Grassland',
  TemperateForest = 'TemperateForest',
  BorealForest = 'BorealForest',
  Tundra = 'Tundra',
  Snow = 'Snow',
  Mountain = 'Mountain',
  Volcano = 'Volcano',
}

export enum FlowDirection {
  N = 'N', NE = 'NE', E = 'E', SE = 'SE',
  S = 'S', SW = 'SW', W = 'W', NW = 'NW',
}

export interface ClimateData {
  temperature: number;  // -1 to 1
  rainfall: number;     // 0 to 1
  humidity: number;     // 0 to 1
}
