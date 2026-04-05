import type { Civilization, CivId, Era } from '../../types/civilization';
import { SpeciesRegistry } from '../../registries/SpeciesRegistry';

export const ERA_BY_TECH_LEVEL: ReadonlyArray<Era> = [
  'Stone',        // 0
  'Stone',        // 1
  'Bronze',       // 2
  'Iron',         // 3
  'Classical',    // 4
  'Medieval',     // 5
  'Renaissance',  // 6
  'Industrial',   // 7
  'Modern',       // 8
];

export const TECH_THRESHOLDS: ReadonlyArray<number> = [
  0,      // level 0 → already at 0
  300,    // level 0 → 1
  800,    // level 1 → 2
  1800,   // level 2 → 3
  4000,   // level 3 → 4
  8000,   // level 4 → 5
  15000,  // level 5 → 6
  25000,  // level 6 → 7
  40000,  // level 7 → 8
];

export class TechTreeEngine {
  private progress = new Map<CivId, number>();

  /** Idempotent: no-op if civId already has accumulated progress. */
  initCiv(civId: CivId): void {
    if (!this.progress.has(civId)) {
      this.progress.set(civId, 0);
    }
  }

  tick(civs: ReadonlyMap<CivId, Civilization>): {
    civs: Map<CivId, Civilization>;
    advances: Array<{ civId: CivId; newTechLevel: number; newEra: Era }>;
  } {
    const updatedCivs = new Map<CivId, Civilization>();
    const advances: Array<{ civId: CivId; newTechLevel: number; newEra: Era }> = [];

    for (const civ of civs.values()) {
      // Auto-init unseen civs
      this.initCiv(civ.id);

      const species = SpeciesRegistry.get(civ.speciesId);
      const techAffinity = species?.traits.techAffinity ?? 0.5;

      const gain = Math.max(1, Math.floor(civ.population * techAffinity * 0.002));
      const current = this.progress.get(civ.id)!;
      this.progress.set(civ.id, current + gain);

      let techLevel = civ.techLevel;
      let era = civ.era;

      if (techLevel < 8 && this.progress.get(civ.id)! >= TECH_THRESHOLDS[techLevel + 1]) {
        techLevel += 1;
        era = ERA_BY_TECH_LEVEL[techLevel];
        this.progress.set(civ.id, 0);
        advances.push({ civId: civ.id, newTechLevel: techLevel, newEra: era });
      }

      updatedCivs.set(civ.id, { ...civ, techLevel, era });
    }

    return { civs: updatedCivs, advances };
  }
}
