import type { GodCommand } from '../../types/simulation';
import type { WorldState } from '../../types/world';
import type { WarState } from '../../types/conflict';
import { mulberry32 } from '../../utils/rng';
import { makeEntryId } from '../core/idgen';
import { SpeciesRegistry } from '../../registries/SpeciesRegistry';
import { createCiv } from '../civilization/SpeciesFactory';

/** Applies a non-disaster divine intervention command and returns the updated WorldState. */
export function applyDivineIntervention(cmd: GodCommand, state: WorldState): WorldState {
  switch (cmd.type) {
    case 'FORCE_WAR': return applyForceWar(cmd, state);
    case 'DIVINE_BLESSING': return applyBlessing(cmd, state);
    case 'SPAWN_CIVILIZATION': return applySpawn(cmd, state);
    case 'PLAGUE': return applyPlague(cmd, state);
    default: return state;
  }
}

function applyForceWar(
  cmd: Extract<GodCommand, { type: 'FORCE_WAR' }>,
  state: WorldState,
): WorldState {
  const already = state.wars.some(
    w => !w.endedTick &&
      ((w.aggressorId === cmd.aggressor && w.defenderId === cmd.defender) ||
       (w.aggressorId === cmd.defender  && w.defenderId === cmd.aggressor)),
  );
  if (already) return state;
  const war: WarState = {
    id: makeEntryId('war'),
    aggressorId: cmd.aggressor,
    defenderId: cmd.defender,
    declaredTick: state.tick,
    cause: 'god_command',
    warScore: 0,
    casualties: { aggressor: 0, defender: 0 },
    contestedTiles: [],
  };
  return { ...state, wars: [...state.wars, war] };
}

function applyBlessing(
  cmd: Extract<GodCommand, { type: 'DIVINE_BLESSING' }>,
  state: WorldState,
): WorldState {
  const civ = state.civilizations.get(cmd.targetCiv);
  if (!civ) return state;
  let updated = { ...civ };
  switch (cmd.boost) {
    case 'military':
      updated = {
        ...updated,
        military: {
          ...updated.military,
          effectiveStrength: Math.round(updated.military.effectiveStrength * 1.5),
          baseStrength: Math.round(updated.military.baseStrength * 1.5),
        },
      };
      break;
    case 'food':
      updated = { ...updated, population: Math.round(updated.population * 1.3) };
      break;
    case 'stability':
      updated = {
        ...updated,
        lifecycle: {
          ...updated.lifecycle,
          stabilityScore: Math.min(100, updated.lifecycle.stabilityScore + 30),
          instabilityFlags: [],
        },
      };
      break;
    case 'tech':
      updated = { ...updated, techLevel: Math.min(10, updated.techLevel + 1) };
      break;
    case 'faith':
      break;
  }
  const newCivs = new Map(state.civilizations);
  newCivs.set(cmd.targetCiv, updated);
  const entry = {
    id: makeEntryId('god'),
    tick: state.tick,
    severity: 'major' as const,
    eventType: 'divine_intervention' as const,
    civIds: [cmd.targetCiv],
    description: `The gods bless ${civ.name} with ${cmd.boost}.`,
  };
  return { ...state, civilizations: newCivs, chronicle: [...state.chronicle, entry] };
}

function applySpawn(
  cmd: Extract<GodCommand, { type: 'SPAWN_CIVILIZATION' }>,
  state: WorldState,
): WorldState {
  const tile = state.tiles[cmd.tile];
  if (!tile) return state;
  const species = SpeciesRegistry.get(cmd.speciesId);
  if (!species) return state;
  const civIndex = state.civilizations.size;
  const rng = mulberry32(state.config.seed ^ (state.tick * 997) ^ civIndex);
  const newCiv = createCiv(species, tile, rng, state.tick, civIndex);
  const newCivs = new Map(state.civilizations);
  newCivs.set(newCiv.id, newCiv);
  const newTiles = state.tiles.map(t => t.index === tile.index ? { ...t, ownerId: newCiv.id } : t);
  const entry = {
    id: makeEntryId('god'),
    tick: state.tick,
    severity: 'major' as const,
    eventType: 'divine_intervention' as const,
    civIds: [newCiv.id],
    description: `The gods breathe life into ${newCiv.name}.`,
    location: tile.index,
  };
  return { ...state, civilizations: newCivs, tiles: newTiles, chronicle: [...state.chronicle, entry] };
}

function applyPlague(
  cmd: Extract<GodCommand, { type: 'PLAGUE' }>,
  state: WorldState,
): WorldState {
  const civ = state.civilizations.get(cmd.targetCiv);
  if (!civ) return state;
  const newCivs = new Map(state.civilizations);
  newCivs.set(cmd.targetCiv, {
    ...civ,
    population: Math.max(1, Math.floor(civ.population * (1 - cmd.severity * 0.5))),
    lifecycle: {
      ...civ.lifecycle,
      stabilityScore: Math.max(0, civ.lifecycle.stabilityScore - 20),
    },
  });
  const entry = {
    id: makeEntryId('disaster'),
    tick: state.tick,
    severity: 'major' as const,
    eventType: 'plague' as const,
    civIds: [cmd.targetCiv],
    description: `A plague sweeps through ${civ.name}, killing thousands.`,
    data: { severity: cmd.severity },
  };
  return { ...state, civilizations: newCivs, chronicle: [...state.chronicle, entry] };
}
