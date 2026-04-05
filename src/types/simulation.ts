import type { TileIndex } from './world';
import type { BiomeType } from './terrain';
import type { CivId, SpeciesId } from './civilization';

export type BlessingType = 'military' | 'food' | 'stability' | 'tech' | 'faith';

export type GodCommand =
  | { type: 'RAISE_TERRAIN';      tiles: TileIndex[]; amount: number }
  | { type: 'LOWER_TERRAIN';      tiles: TileIndex[]; amount: number }
  | { type: 'SET_BIOME';          tiles: TileIndex[]; biome: BiomeType }
  | { type: 'VOLCANIC_ERUPTION';  epicenter: TileIndex; magnitude: number }
  | { type: 'METEOR_IMPACT';      epicenter: TileIndex; radius: number }
  | { type: 'FLOOD';              region: TileIndex[]; severity: number }
  | { type: 'DROUGHT';            region: TileIndex[]; duration: number }
  | { type: 'FORCE_WAR';          aggressor: CivId; defender: CivId }
  | { type: 'PLAGUE';             targetCiv: CivId; severity: number }
  | { type: 'DIVINE_BLESSING';    targetCiv: CivId; boost: BlessingType }
  | { type: 'SPAWN_CIVILIZATION'; tile: TileIndex; speciesId: SpeciesId };

export type LayerType =
  | 'terrain'
  | 'biome'
  | 'rivers'
  | 'climate'
  | 'political'
  | 'religion'
  | 'culture';
