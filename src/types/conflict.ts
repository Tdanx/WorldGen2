import type { CivId } from './civilization';
import type { TileIndex } from './world';

export type WarCause =
  | 'border_tension'
  | 'holy_war'
  | 'resource_scarcity'
  | 'grievance'
  | 'power_imbalance'
  | 'god_command'
  | 'treaty_violation';

export type WarOutcome =
  | 'white_peace'
  | 'aggressor_wins'
  | 'defender_wins'
  | 'vassalage'
  | 'annihilation';

export interface WarPressureComponents {
  borderTension: number;     // 0–20
  religiousConflict: number; // 0–20
  resourceScarcity: number;  // 0–20
  grievance: number;         // 0–20
  powerImbalance: number;    // 0–20
}

export interface WarPressureRecord {
  aggressor: CivId;
  target: CivId;
  totalPressure: number; // 0–100; WAR_THRESHOLD = 65
  components: WarPressureComponents;
  lastUpdatedTick: number;
}

export interface WarState {
  id: string;
  aggressorId: CivId;
  defenderId: CivId;
  declaredTick: number;
  endedTick?: number;
  cause: WarCause;
  warScore: number; // -100 to +100
  casualties: { aggressor: number; defender: number };
  contestedTiles: TileIndex[];
  outcome?: WarOutcome;
}

export interface BattleResult {
  warId: string;
  tick: number;
  aggressorLosses: number;
  defenderLosses: number;
  terrainModifier: number;
  warScoreDelta: number;
  contestedTileWon?: TileIndex;
}
