import type { BiomeType, FlowDirection } from './terrain';
import type { CivId } from './civilization';
import type { ReligionId } from './religion';
import type { DiplomacyMatrix } from './diplomacy';

// TileIndex is a region index in the dual Voronoi/Delaunay mesh (0 to numSolidRegions).
// Not a grid coordinate — do NOT use y*width+x.
export type TileIndex = number;

export interface Tile {
  index: TileIndex;
  x: number;        // world coordinate (0–1000 in mapgen4 space)
  y: number;
  elevation: number;   // 0–1
  moisture: number;    // 0–1
  temperature: number; // -1–1
  biome: BiomeType;
  isWater: boolean;
  isRiver: boolean;
  riverFlow: FlowDirection | null;
  ownerId: CivId | null;
  religionId: ReligionId | null;
}

export interface WorldConfig {
  seed: number;
  spacing: number;          // Voronoi cell spacing: 2=fine, 5.5=medium, 9=coarse
  seaLevel: number;         // 0.0–1.0 elevation threshold for water
  mountainSpacing: number;  // spacing between mountain peaks
}

export interface WorldState {
  config: WorldConfig;
  tick: number;
  tiles: ReadonlyArray<Tile>;
  civilizations: ReadonlyMap<CivId, import('./civilization').Civilization>;
  wars: ReadonlyArray<import('./conflict').WarState>;
  chronicle: ReadonlyArray<import('./events').ChronicleEntry>;
  diplomacyMatrix: DiplomacyMatrix;
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  seed: 12345,
  spacing: 5.5,
  seaLevel: 0.5,
  mountainSpacing: 35,
};
