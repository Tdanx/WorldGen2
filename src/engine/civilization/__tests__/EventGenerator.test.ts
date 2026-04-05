import { describe, it, expect } from 'vitest';
import {
  makeCivFoundedEntry, makeFamineEntry, makeEraBegunEntry,
  makeWarDeclaredEntry, makeWarEndedEntry, makeTreatyEntry,
  makeHolyWarEntry, makeDivineInterventionEntry,
} from '../EventGenerator';
import type { Civilization } from '../../../types/civilization';
import type { WarState } from '../../../types/conflict';
import type { DiplomaticPact } from '../../../types/diplomacy';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCiv(overrides: Partial<Civilization> = {}): Civilization {
  return {
    id: 'civ-0', name: 'Test Kingdom', speciesId: 'human', color: '#e63946',
    capitalTile: 42, territory: [42], population: 100, treasury: 50,
    era: 'Stone', techLevel: 0, faithId: null,
    military: { baseStrength: 10, morale: 1.0, supplyLine: 1.0, effectiveStrength: 10 },
    lifecycle: { phase: 'founding', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: [], collapseRisk: 0 },
    foundedTick: 0,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('EventGenerator', () => {
  describe('makeCivFoundedEntry', () => {
    it('eventType is civ_founded', () => {
      expect(makeCivFoundedEntry(makeCiv(), 0, 'e-0').eventType).toBe('civ_founded');
    });

    it('severity is major', () => {
      expect(makeCivFoundedEntry(makeCiv(), 0, 'e-0').severity).toBe('major');
    });

    it('civIds contains civ.id', () => {
      const entry = makeCivFoundedEntry(makeCiv({ id: 'civ-7' }), 0, 'e-0');
      expect(entry.civIds).toContain('civ-7');
    });

    it('description contains civ.name', () => {
      const civ = makeCiv({ name: 'Golden Humans Kingdom' });
      expect(makeCivFoundedEntry(civ, 0, 'e-0').description).toContain('Golden Humans Kingdom');
    });

    it('location equals civ.capitalTile', () => {
      const entry = makeCivFoundedEntry(makeCiv({ capitalTile: 42 }), 0, 'e-0');
      expect(entry.location).toBe(42);
    });
  });

  describe('makeFamineEntry', () => {
    it('eventType is famine', () => {
      expect(makeFamineEntry(makeCiv(), 5, 'e-1').eventType).toBe('famine');
    });

    it('severity is minor', () => {
      expect(makeFamineEntry(makeCiv(), 5, 'e-1').severity).toBe('minor');
    });
  });

  describe('makeEraBegunEntry', () => {
    it('eventType is golden_age_begun', () => {
      expect(makeEraBegunEntry(makeCiv(), 10, 'e-2').eventType).toBe('golden_age_begun');
    });

    it('severity is epoch', () => {
      expect(makeEraBegunEntry(makeCiv(), 10, 'e-2').severity).toBe('epoch');
    });
  });

  describe('makeWarDeclaredEntry', () => {
    const war: WarState = {
      id: 'war-0', aggressorId: 'civ-0', defenderId: 'civ-1',
      declaredTick: 5, cause: 'border_tension', warScore: 0,
      casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
    };

    it('eventType is war_declared for non-holy wars', () => {
      const entry = makeWarDeclaredEntry(war, 'Alpha', 'Beta', 5, 'e-3');
      expect(entry.eventType).toBe('war_declared');
    });

    it('eventType is holy_war_declared for holy wars', () => {
      const holyWar: WarState = { ...war, cause: 'holy_war' };
      const entry = makeWarDeclaredEntry(holyWar, 'Alpha', 'Beta', 5, 'e-3');
      expect(entry.eventType).toBe('holy_war_declared');
    });

    it('civIds contains both aggressor and defender', () => {
      const entry = makeWarDeclaredEntry(war, 'Alpha', 'Beta', 5, 'e-3');
      expect(entry.civIds).toContain('civ-0');
      expect(entry.civIds).toContain('civ-1');
    });

    it('description contains both civ names', () => {
      const entry = makeWarDeclaredEntry(war, 'Alpha Kingdom', 'Beta Empire', 5, 'e-3');
      expect(entry.description).toContain('Alpha Kingdom');
      expect(entry.description).toContain('Beta Empire');
    });

    it('severity is major', () => {
      expect(makeWarDeclaredEntry(war, 'A', 'B', 5, 'e-3').severity).toBe('major');
    });
  });

  describe('makeWarEndedEntry', () => {
    const war: WarState = {
      id: 'war-0', aggressorId: 'civ-0', defenderId: 'civ-1',
      declaredTick: 5, cause: 'border_tension', warScore: 90,
      casualties: { aggressor: 50, defender: 200 }, contestedTiles: [],
    };

    it('eventType is war_ended', () => {
      expect(makeWarEndedEntry(war, 'aggressor_wins', 20, 'e-4').eventType).toBe('war_ended');
    });

    it('severity is major', () => {
      expect(makeWarEndedEntry(war, 'white_peace', 20, 'e-4').severity).toBe('major');
    });

    it('data contains outcome', () => {
      const entry = makeWarEndedEntry(war, 'defender_wins', 20, 'e-4');
      expect(entry.data?.outcome).toBe('defender_wins');
    });

    it('civIds contains both parties', () => {
      const entry = makeWarEndedEntry(war, 'white_peace', 20, 'e-4');
      expect(entry.civIds).toContain('civ-0');
      expect(entry.civIds).toContain('civ-1');
    });
  });

  describe('makeTreatyEntry', () => {
    const pact: DiplomaticPact = {
      id: 'pact-0', typeOf: 'non_aggression_pact',
      civA: 'civ-0', civB: 'civ-1', formedTick: 10,
      terms: { militaryAccess: false, tradeBenefit: 0 },
      violated: false,
    };

    it('eventType is treaty_formed when not violated', () => {
      expect(makeTreatyEntry(pact, 'Alpha', 'Beta', 10, 'e-5').eventType).toBe('treaty_formed');
    });

    it('eventType is treaty_violated when violated', () => {
      const violated: DiplomaticPact = { ...pact, violated: true, violatedBy: 'civ-0' };
      expect(makeTreatyEntry(violated, 'Alpha', 'Beta', 15, 'e-5').eventType).toBe('treaty_violated');
    });

    it('severity is minor', () => {
      expect(makeTreatyEntry(pact, 'A', 'B', 10, 'e-5').severity).toBe('minor');
    });

    it('civIds contains both parties', () => {
      const entry = makeTreatyEntry(pact, 'Alpha', 'Beta', 10, 'e-5');
      expect(entry.civIds).toContain('civ-0');
      expect(entry.civIds).toContain('civ-1');
    });
  });

  describe('makeHolyWarEntry', () => {
    const war: WarState = {
      id: 'war-0', aggressorId: 'civ-0', defenderId: 'civ-1',
      declaredTick: 5, cause: 'holy_war', warScore: 0,
      casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
    };

    it('eventType is holy_war_declared', () => {
      expect(makeHolyWarEntry(war, 'The Eternal Flame', 5, 'e-6').eventType).toBe('holy_war_declared');
    });

    it('description contains the faith name', () => {
      const entry = makeHolyWarEntry(war, 'The Eternal Flame', 5, 'e-6');
      expect(entry.description).toContain('The Eternal Flame');
    });

    it('data contains faithName', () => {
      const entry = makeHolyWarEntry(war, 'The Eternal Flame', 5, 'e-6');
      expect(entry.data?.faithName).toBe('The Eternal Flame');
    });
  });

  describe('makeDivineInterventionEntry', () => {
    it('eventType is divine_intervention', () => {
      const entry = makeDivineInterventionEntry({ type: 'PLAGUE', targetCiv: 'civ-0', severity: 0.5 }, 10, 'e-7');
      expect(entry.eventType).toBe('divine_intervention');
    });

    it('severity is epoch', () => {
      const entry = makeDivineInterventionEntry({ type: 'FLOOD', region: [0], severity: 0.7 }, 10, 'e-7');
      expect(entry.severity).toBe('epoch');
    });

    it('data contains commandType', () => {
      const entry = makeDivineInterventionEntry({ type: 'FORCE_WAR', aggressor: 'civ-0', defender: 'civ-1' }, 10, 'e-7');
      expect(entry.data?.commandType).toBe('FORCE_WAR');
    });

    it('produces a description for every known command type', () => {
      const cmds: Array<import('../../../types/simulation').GodCommand> = [
        { type: 'RAISE_TERRAIN', tiles: [], amount: 0.1 },
        { type: 'LOWER_TERRAIN', tiles: [], amount: 0.1 },
        { type: 'SET_BIOME', tiles: [], biome: 'Grassland' as import('../../../types/terrain').BiomeType },
        { type: 'VOLCANIC_ERUPTION', epicenter: 0, magnitude: 0.8 },
        { type: 'METEOR_IMPACT', epicenter: 0, radius: 3 },
        { type: 'FLOOD', region: [], severity: 0.5 },
        { type: 'DROUGHT', region: [], duration: 10 },
        { type: 'PLAGUE', targetCiv: 'civ-0', severity: 0.5 },
        { type: 'FORCE_WAR', aggressor: 'civ-0', defender: 'civ-1' },
        { type: 'DIVINE_BLESSING', targetCiv: 'civ-0', boost: 'food' },
        { type: 'SPAWN_CIVILIZATION', tile: 0, speciesId: 'human' },
      ];
      for (const cmd of cmds) {
        const entry = makeDivineInterventionEntry(cmd, 10, 'e-x');
        expect(entry.description.length).toBeGreaterThan(0);
      }
    });
  });
});
