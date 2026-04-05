import type { CivId } from '../../types/civilization';
import type { DiplomacyMatrix, DiplomacyEntry, DiplomaticPact, OpinionModifier } from '../../types/diplomacy';
import type { WorldState } from '../../types/world';
import { makeEntryId } from '../core/idgen';
import { makeTreatyEntry } from '../civilization/EventGenerator';

// ─── Key helper ───────────────────────────────────────────────────────────────

/** Canonical matrix key: civA < civB lexicographically. */
export function matrixKey(a: CivId, b: CivId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Get or create a blank entry for a civ pair. */
function getOrCreate(matrix: DiplomacyMatrix, a: CivId, b: CivId): DiplomacyEntry {
  const key = matrixKey(a, b);
  if (!matrix.has(key)) {
    matrix.set(key, {
      status: 'peace',
      opinion: { civA: a < b ? a : b, civB: a < b ? b : a, score: 0, modifiers: [] },
      pacts: [],
    });
  }
  return matrix.get(key)!;
}

// ─── Opinion helpers ──────────────────────────────────────────────────────────

function recalcScore(modifiers: OpinionModifier[]): number {
  const raw = modifiers.reduce((sum, m) => sum + m.value, 0);
  return Math.max(-100, Math.min(100, Math.round(raw)));
}

function ageModifiers(modifiers: OpinionModifier[], tick: number): OpinionModifier[] {
  return modifiers.filter(m => m.expiryTick > tick);
}

// ─── Post-war pacts ───────────────────────────────────────────────────────────

/**
 * For any war that ended on the previous tick with a non-terminal outcome,
 * auto-create a non-aggression pact between the parties.
 */
function formPostWarPacts(state: WorldState, matrix: DiplomacyMatrix): {
  matrix: DiplomacyMatrix;
  chronicle: WorldState['chronicle'];
} {
  let chronicle = state.chronicle;
  const TERMINAL: Set<string> = new Set(['annihilation', 'vassalage']);

  for (const war of state.wars) {
    if (war.endedTick !== state.tick - 1) continue;
    if (TERMINAL.has(war.outcome ?? '')) continue;

    const key = matrixKey(war.aggressorId, war.defenderId);
    const entry = getOrCreate(matrix, war.aggressorId, war.defenderId);

    // Skip if a non-aggression pact already exists and is active
    const alreadyHasPact = entry.pacts.some(
      p => p.typeOf === 'non_aggression_pact' && !p.violated && (!p.expiryTick || p.expiryTick > state.tick),
    );
    if (alreadyHasPact) continue;

    const pact: DiplomaticPact = {
      id: makeEntryId('pact'),
      typeOf: 'non_aggression_pact',
      civA: war.aggressorId,
      civB: war.defenderId,
      formedTick: state.tick,
      expiryTick: state.tick + 300,
      terms: { militaryAccess: false, tradeBenefit: 5 },
      violated: false,
    };

    const civA = state.civilizations.get(war.aggressorId);
    const civB = state.civilizations.get(war.defenderId);
    const nameA = civA?.name ?? war.aggressorId;
    const nameB = civB?.name ?? war.defenderId;

    const updatedEntry: DiplomacyEntry = { ...entry, pacts: [...entry.pacts, pact] };
    matrix.set(key, updatedEntry);

    const chronicleEntry = makeTreatyEntry(pact, nameA, nameB, state.tick, makeEntryId('diplomacy'));
    chronicle = [...chronicle, chronicleEntry];
  }

  return { matrix, chronicle };
}

// ─── Treaty violation detection ───────────────────────────────────────────────

/**
 * If a civ with a military_alliance pact is at war but its ally is NOT
 * also at war with the same enemy, mark the pact violated.
 */
function checkTreatyViolations(
  state: WorldState,
  matrix: DiplomacyMatrix,
  chronicle: WorldState['chronicle'],
): { matrix: DiplomacyMatrix; chronicle: WorldState['chronicle'] } {

  for (const [key, entry] of matrix) {
    const activePacts = entry.pacts.filter(p => !p.violated && p.typeOf === 'military_alliance');
    if (activePacts.length === 0) continue;

    for (const pact of activePacts) {
      const [civAId, civBId] = [pact.civA, pact.civB];

      // Find if civA is at war with someone civB is not
      const civAWars = state.wars.filter(
        w => !w.endedTick && (w.aggressorId === civAId || w.defenderId === civAId),
      );
      for (const war of civAWars) {
        const enemyId = war.aggressorId === civAId ? war.defenderId : war.aggressorId;
        const alliedAlsoAtWar = state.wars.some(
          w => !w.endedTick &&
            (w.aggressorId === civBId || w.defenderId === civBId) &&
            (w.aggressorId === enemyId || w.defenderId === enemyId),
        );
        if (alliedAlsoAtWar) continue;

        // Violation: ally is not fighting the same enemy
        const violatedPact: DiplomaticPact = {
          ...pact,
          violated: true,
          violatedBy: civBId,
          violatedTick: state.tick,
        };

        // Add opinion penalty
        const penaltyMod: OpinionModifier = {
          source: 'treaty_violation',
          value: -40,
          expiryTick: state.tick + 500,
        };
        const updatedOpinion = {
          ...entry.opinion,
          modifiers: [...entry.opinion.modifiers, penaltyMod],
          score: recalcScore([...entry.opinion.modifiers, penaltyMod]),
        };
        const updatedEntry: DiplomacyEntry = {
          ...entry,
          opinion: updatedOpinion,
          pacts: entry.pacts.map(p => p.id === pact.id ? violatedPact : p),
        };
        matrix.set(key, updatedEntry);

        const civA = state.civilizations.get(civAId);
        const civB = state.civilizations.get(civBId);
        const chronicleEntry = makeTreatyEntry(
          violatedPact,
          civA?.name ?? civAId,
          civB?.name ?? civBId,
          state.tick,
          makeEntryId('diplomacy'),
        );
        chronicle = [...chronicle, chronicleEntry];
        break; // one violation per pact per tick
      }
    }
  }

  return { matrix, chronicle };
}

// ─── Main engine ─────────────────────────────────────────────────────────────

export class DiplomacyEngine {
  /**
   * Per-tick update: age opinion modifiers, form post-war pacts, check violations.
   */
  tick(state: WorldState): WorldState {
    // Copy matrix (never mutate input)
    const matrix: DiplomacyMatrix = new Map(state.diplomacyMatrix);

    // 1. Age all opinion modifiers
    for (const [key, entry] of matrix) {
      const fresh = ageModifiers(entry.opinion.modifiers, state.tick);
      if (fresh.length !== entry.opinion.modifiers.length) {
        matrix.set(key, {
          ...entry,
          opinion: { ...entry.opinion, modifiers: fresh, score: recalcScore(fresh) },
        });
      }
    }

    // 2. Form post-war non-aggression pacts
    const afterPacts = formPostWarPacts(state, matrix);
    let chronicle = afterPacts.chronicle;

    // 3. Check treaty violations (pass accumulated chronicle forward)
    const afterViolations = checkTreatyViolations(state, matrix, chronicle);
    chronicle = afterViolations.chronicle;

    return { ...state, diplomacyMatrix: matrix, chronicle };
  }

  /**
   * Form a military alliance between two civs.
   */
  formAlliance(state: WorldState, civAId: CivId, civBId: CivId): WorldState {
    const matrix: DiplomacyMatrix = new Map(state.diplomacyMatrix);
    const key = matrixKey(civAId, civBId);
    const entry = getOrCreate(matrix, civAId, civBId);

    const pact: DiplomaticPact = {
      id: makeEntryId('pact'),
      typeOf: 'military_alliance',
      civA: civAId,
      civB: civBId,
      formedTick: state.tick,
      terms: { militaryAccess: true, tradeBenefit: 10 },
      violated: false,
    };

    const friendMod: OpinionModifier = {
      source: 'alliance_formed',
      value: 30,
      expiryTick: state.tick + 1000,
    };
    const updatedEntry: DiplomacyEntry = {
      ...entry,
      status: 'alliance',
      pacts: [...entry.pacts, pact],
      opinion: {
        ...entry.opinion,
        modifiers: [...entry.opinion.modifiers, friendMod],
        score: recalcScore([...entry.opinion.modifiers, friendMod]),
      },
    };
    matrix.set(key, updatedEntry);

    const civA = state.civilizations.get(civAId);
    const civB = state.civilizations.get(civBId);
    const chronicleEntry = makeTreatyEntry(
      pact,
      civA?.name ?? civAId,
      civB?.name ?? civBId,
      state.tick,
      makeEntryId('diplomacy'),
    );

    return { ...state, diplomacyMatrix: matrix, chronicle: [...state.chronicle, chronicleEntry] };
  }
}
