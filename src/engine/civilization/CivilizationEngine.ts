import type { CivId } from '../../types/civilization';
import type { WorldState } from '../../types/world';
import { tickGrowth } from './GrowthModel';
import { TechTreeEngine } from './TechTreeEngine';
import { tickLifecycle } from './LifecycleModel';
import { makeCivFoundedEntry, makeFamineEntry, makeEraBegunEntry } from './EventGenerator';
import { makeEntryId } from '../core/idgen';

export class CivilizationEngine {
  private readonly techTree = new TechTreeEngine();
  private readonly knownCivIds = new Set<CivId>();
  private entryCounter = 0;

  private nextId(): string {
    return `entry-${this.entryCounter++}`;
  }

  tick(state: WorldState): WorldState {
    const newEntries = [];

    // Step 1: detect new civs → emit civ_founded
    for (const civ of state.civilizations.values()) {
      if (!this.knownCivIds.has(civ.id)) {
        this.knownCivIds.add(civ.id);
        newEntries.push(makeCivFoundedEntry(civ, state.tick, this.nextId()));
      }
    }

    // Step 2: growth
    const growthResult = tickGrowth(state.civilizations, state.tiles);

    // Step 3: tech (on post-growth civs)
    const techResult = this.techTree.tick(growthResult.civs);

    // Step 4: famine entries
    for (const civId of growthResult.famineEvents) {
      const civ = growthResult.civs.get(civId);
      if (civ) newEntries.push(makeFamineEntry(civ, state.tick, this.nextId()));
    }

    // Step 5: era advance entries
    for (const advance of techResult.advances) {
      const civ = techResult.civs.get(advance.civId);
      if (civ) newEntries.push(makeEraBegunEntry(civ, state.tick, this.nextId()));
    }

    // Step 6: stability + collapse (uses current wars from state)
    const techAdvancedIds = new Set(techResult.advances.map(a => a.civId));
    const stateForLifecycle = { ...state, civilizations: techResult.civs, tiles: growthResult.tiles };
    const lifecycleResult = tickLifecycle(techResult.civs, stateForLifecycle, techAdvancedIds);

    // Emit civ_collapsed entries
    for (const civId of lifecycleResult.collapsedIds) {
      const civ = lifecycleResult.civs.get(civId);
      if (civ) {
        newEntries.push({
          id: makeEntryId('lifecycle'),
          tick: state.tick,
          severity: 'epoch' as const,
          eventType: 'civ_collapsed' as const,
          civIds: [civId],
          description: `${civ.name} collapses under the weight of instability.`,
        });
      }
    }

    // Clear freed tiles
    let tiles = growthResult.tiles;
    if (lifecycleResult.freedTiles.size > 0) {
      tiles = tiles.map(t =>
        lifecycleResult.freedTiles.has(t.index) ? { ...t, ownerId: null } : t,
      );
    }

    return {
      ...state,
      civilizations: lifecycleResult.civs,
      tiles,
      chronicle: [...state.chronicle, ...newEntries],
    };
  }
}
