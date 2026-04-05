import type { CivId } from './civilization';
import type { TileIndex } from './world';

export type EventSeverity = 'minor' | 'major' | 'epoch';

export type ChronicleEventType =
  | 'war_declared'
  | 'war_ended'
  | 'battle_result'
  | 'treaty_formed'
  | 'treaty_violated'
  | 'civ_founded'
  | 'civ_collapsed'
  | 'civ_extinct'
  | 'holy_war_declared'
  | 'golden_age_begun'
  | 'succession_crisis'
  | 'vassal_created'
  | 'annexation'
  | 'natural_disaster'
  | 'divine_intervention'
  | 'plague'
  | 'famine';

export interface ChronicleEntry {
  id: string;
  tick: number;
  severity: EventSeverity;
  eventType: ChronicleEventType;
  civIds: CivId[];
  description: string;
  location?: TileIndex;
  data?: Record<string, unknown>;
}
