import type { CivId } from './civilization';

export type ReligionId = string;

export type ReligiousTenet =
  | 'pacifist'
  | 'militant'
  | 'proselytizing'
  | 'isolationist'
  | 'nature_worship'
  | 'ancestor_worship'
  | 'monotheistic'
  | 'polytheistic';

export interface FaithDef {
  id: ReligionId;
  name: string;
  founderCivId: CivId;
  foundedTick: number;
  tenets: ReligiousTenet[];
  splitFrom: ReligionId | null;
  extinctTick: number | null;
  color: string;
  followerCivIds: Set<CivId>;
}
