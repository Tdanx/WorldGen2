import type { GodCommand } from '../../types/simulation';
import type { WorldState } from '../../types/world';
import { assignBiome } from '../terrain/MapGen4Bridge';
import { applyDisaster } from '../disasters/DisasterEngine';
import { applyDivineIntervention } from './DivineIntervention';

/**
 * Process a batch of GodCommands and return an updated WorldState.
 * Pure function — never mutates its inputs.
 */
export function processGodCommands(commands: GodCommand[], state: WorldState): WorldState {
  let next = state;
  for (const cmd of commands) {
    next = applyCommand(cmd, next);
  }
  return next;
}

function applyCommand(cmd: GodCommand, state: WorldState): WorldState {
  switch (cmd.type) {
    case 'RAISE_TERRAIN':
    case 'LOWER_TERRAIN': {
      const delta = cmd.type === 'RAISE_TERRAIN' ? cmd.amount : -cmd.amount;
      const affected = new Set(cmd.tiles);
      const newTiles = state.tiles.map(t => {
        if (!affected.has(t.index)) return t;
        // mapgen4 elevation range is [-1, 1] where 0 = sea level
        const elevation = Math.min(1, Math.max(-1, t.elevation + delta));
        const isWater = elevation < 0;
        const biome = assignBiome(elevation, t.moisture, t.temperature);
        return { ...t, elevation, isWater, biome };
      });
      return { ...state, tiles: newTiles };
    }

    case 'SET_BIOME': {
      const affected = new Set(cmd.tiles);
      const newTiles = state.tiles.map(t =>
        affected.has(t.index) ? { ...t, biome: cmd.biome } : t,
      );
      return { ...state, tiles: newTiles };
    }

    case 'VOLCANIC_ERUPTION':
    case 'METEOR_IMPACT':
    case 'FLOOD':
    case 'DROUGHT':
      return applyDisaster(cmd, state);

    case 'FORCE_WAR':
    case 'DIVINE_BLESSING':
    case 'SPAWN_CIVILIZATION':
    case 'PLAGUE':
      return applyDivineIntervention(cmd, state);

    default:
      return state;
  }
}
