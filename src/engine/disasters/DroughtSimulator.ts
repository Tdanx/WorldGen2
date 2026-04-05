import type { WorldState } from '../../types/world';
import { assignBiome } from '../terrain/MapGen4Bridge';
import { makeEntryId } from '../core/idgen';
import { damageTerritory } from './disasterUtils';

export function applyDrought(
  state: WorldState,
  region: number[],
  duration: number,
): WorldState {
  const affectedSet = new Set(region);

  const newTiles = state.tiles.map(t => {
    if (!affectedSet.has(t.index)) return t;
    const moisture = Math.max(0, t.moisture - 0.3);
    return { ...t, moisture, biome: assignBiome(t.elevation, moisture, t.temperature) };
  });

  const newCivs = damageTerritory(state, affectedSet, 0.2);

  const entry = {
    id: makeEntryId('disaster'),
    tick: state.tick,
    severity: 'major' as const,
    eventType: 'natural_disaster' as const,
    civIds: [],
    description: `A drought lasting ${duration} years grips the land.`,
    data: { duration },
  };

  return { ...state, tiles: newTiles, civilizations: newCivs, chronicle: [...state.chronicle, entry] };
}
