import type { CivId } from '../../types/civilization';
import type { WorldState } from '../../types/world';

export type EngineEventMap = {
  'world:tick':      WorldState;
  'world:generated': WorldState;
  'civ:founded':     { civId: CivId; tick: number };
  'civ:extinct':     { civId: CivId; tick: number };
  'war:declared':    { aggressorId: CivId; defenderId: CivId; tick: number };
  'war:ended':       { warId: string; outcome: string; tick: number };
  'disaster:fired':  { disasterType: string; epicenter: number };
  'terrain:modified': Record<string, never>;
};

type Handler<T> = (data: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<Handler<unknown>>>();

  on<K extends keyof EngineEventMap>(
    event: K,
    handler: Handler<EngineEventMap[K]>,
  ): () => void {
    let set = this.handlers.get(event as string);
    if (!set) {
      set = new Set();
      this.handlers.set(event as string, set);
    }
    set.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  off<K extends keyof EngineEventMap>(
    event: K,
    handler: Handler<EngineEventMap[K]>,
  ): void {
    this.handlers.get(event as string)?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof EngineEventMap>(event: K, data: EngineEventMap[K]): void {
    const set = this.handlers.get(event as string);
    if (!set) return;
    // Iterate a copy so handlers added during emit are not called this cycle
    for (const h of [...set]) {
      (h as Handler<EngineEventMap[K]>)(data);
    }
  }
}
