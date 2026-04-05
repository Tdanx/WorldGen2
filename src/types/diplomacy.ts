import type { CivId } from './civilization';

export type DiplomaticStatus = 'peace' | 'cold_war' | 'war' | 'alliance' | 'vassal' | 'overlord';

export type TreatyType =
  | 'non_aggression_pact'
  | 'trade_agreement'
  | 'military_alliance'
  | 'defensive_pact'
  | 'tribute_obligation'
  | 'border_agreement';

export interface DiplomaticPact {
  id: string;
  typeOf: TreatyType;
  civA: CivId;
  civB: CivId;
  formedTick: number;
  expiryTick?: number;
  terms: {
    annualTribute?: number;
    militaryAccess: boolean;
    tradeBenefit: number;
  };
  violated: boolean;
  violatedBy?: CivId;
  violatedTick?: number;
}

export interface OpinionModifier {
  source: string;
  value: number;
  expiryTick: number;
}

export interface OpinionRecord {
  civA: CivId;
  civB: CivId;
  score: number; // -100 to +100
  modifiers: OpinionModifier[];
}

export interface DiplomacyEntry {
  status: DiplomaticStatus;
  opinion: OpinionRecord;
  pacts: DiplomaticPact[];
}

// Keyed as `${civA}:${civB}` where civA < civB lexicographically
export type DiplomacyMatrix = Map<string, DiplomacyEntry>;
