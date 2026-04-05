import type { TileIndex } from './world';
import type { BiomeType } from './terrain';
import type { ReligionId } from './religion';

export type CivId = string;
export type SpeciesId = string;

export type Era = 'Stone' | 'Bronze' | 'Iron' | 'Classical' | 'Medieval' | 'Renaissance' | 'Industrial' | 'Modern';

export type CivLifecyclePhase = 'founding' | 'growth' | 'peak' | 'decline' | 'collapse' | 'extinct';

export type InstabilityFlag =
  | 'overstretched_borders'
  | 'famine'
  | 'succession_crisis'
  | 'military_defeat'
  | 'religious_schism'
  | 'economic_collapse'
  | 'plague';

export interface SpeciesTraits {
  aggression: number;    // 0–1
  expansion: number;     // 0–1
  religiosity: number;   // 0–1
  techAffinity: number;  // 0–1
  diplomacy: number;     // 0–1
  resilience: number;    // 0–1
}

export interface MilitaryStrength {
  baseStrength: number;
  morale: number;            // 0–1
  supplyLine: number;        // 0–1
  effectiveStrength: number; // baseStrength * morale * supplyLine
}

export interface CivLifecycleState {
  phase: CivLifecyclePhase;
  phaseEnteredTick: number;
  stabilityScore: number;      // 0–100
  instabilityFlags: InstabilityFlag[];
  collapseRisk: number;        // 0–1
}

export interface Civilization {
  id: CivId;
  name: string;
  speciesId: SpeciesId;
  color: string;             // hex color for map rendering
  capitalTile: TileIndex;
  territory: TileIndex[];
  population: number;
  treasury: number;
  era: Era;
  techLevel: number;         // 0–10
  faithId: ReligionId | null;
  military: MilitaryStrength;
  lifecycle: CivLifecycleState;
  foundedTick: number;
}

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  traits: SpeciesTraits;
  preferredBiomes: BiomeType[];
  description: string;
}
