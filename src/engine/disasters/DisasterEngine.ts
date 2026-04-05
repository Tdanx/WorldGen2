import type { GodCommand } from '../../types/simulation';
import type { WorldState } from '../../types/world';
import { applyVolcanicEruption } from './VolcanicEruption';
import { applyMeteorImpact } from './MeteorImpact';
import { applyFlood } from './FloodSimulator';
import { applyDrought } from './DroughtSimulator';

/** Applies a disaster GodCommand and returns the updated WorldState. */
export function applyDisaster(cmd: GodCommand, state: WorldState): WorldState {
  switch (cmd.type) {
    case 'VOLCANIC_ERUPTION': return applyVolcanicEruption(state, cmd.epicenter, cmd.magnitude);
    case 'METEOR_IMPACT':     return applyMeteorImpact(state, cmd.epicenter, cmd.radius);
    case 'FLOOD':             return applyFlood(state, cmd.region, cmd.severity);
    case 'DROUGHT':           return applyDrought(state, cmd.region, cmd.duration);
    default:                  return state;
  }
}
