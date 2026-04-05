import type { FaithDef, ReligionId } from '../types/religion';
import type { CivId } from '../types/civilization';
import type { ReligiousTenet } from '../types/religion';

let _nextId = 1;

class ReligionRegistryClass {
  private entries = new Map<ReligionId, FaithDef>();

  found(def: Omit<FaithDef, 'id'>): ReligionId {
    const id = `faith_${_nextId++}`;
    this.entries.set(id, { ...def, id });
    return id;
  }

  schism(parentId: ReligionId, schismTick: number, founderCivId: CivId): ReligionId {
    const parent = this.entries.get(parentId);
    if (!parent) throw new Error(`Unknown religion: ${parentId}`);
    const tenets: ReligiousTenet[] = [...parent.tenets];
    // Flip one tenet to differentiate the schism
    const colors = ['#e05050', '#50a0e0', '#a050e0', '#e0a050', '#50e0a0'];
    return this.found({
      name: `Reformed ${parent.name}`,
      founderCivId,
      foundedTick: schismTick,
      tenets,
      splitFrom: parentId,
      extinctTick: null,
      color: colors[_nextId % colors.length],
      followerCivIds: new Set<CivId>(),
    });
  }

  extinguish(id: ReligionId, tick: number): void {
    const faith = this.entries.get(id);
    if (faith) faith.extinctTick = tick;
  }

  get(id: ReligionId): FaithDef | undefined {
    return this.entries.get(id);
  }

  getActive(): FaithDef[] {
    return Array.from(this.entries.values()).filter(f => f.extinctTick === null);
  }

  getAll(): FaithDef[] {
    return Array.from(this.entries.values());
  }

  reset(): void {
    this.entries.clear();
    _nextId = 1;
  }

  /**
   * Restore a previously serialized faith entry verbatim.
   * Used only by deserialization — bypasses found() so IDs and tick stamps are preserved.
   * Also advances _nextId so subsequent found() calls don't clash.
   */
  _restoreEntry(faith: FaithDef): void {
    this.entries.set(faith.id, faith);
    const numeric = parseInt(faith.id.replace('faith_', ''), 10);
    if (!isNaN(numeric) && numeric >= _nextId) _nextId = numeric + 1;
  }
}

export const ReligionRegistry = new ReligionRegistryClass();
