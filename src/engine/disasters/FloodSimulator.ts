import type { WorldState } from '../../types/world';
import { assignBiome } from '../terrain/MapGen4Bridge';
import { makeEntryId } from '../core/idgen';
import { damageTerritory } from './disasterUtils';

export function applyFlood(
  state: WorldState,
  region: number[],
  severity: number,
): WorldState {
  const affectedSet = new Set(region);

  const newTiles = state.tiles.map(t => {
    if (!affectedSet.has(t.index)) return t;
    const elevation = Math.max(0, t.elevation - severity * 0.15);
    const moisture = Math.min(1, t.moisture + 0.3);
    return { ...t, elevation, biome: assignBiome(elevation, moisture, t.temperature) };
  });

  const newCivs = damageTerritory(state, affectedSet, severity * 0.3);

  const entry = {
    id: makeEntryId('disaster'),
    tick: state.tick,
    severity: 'major' as const,
    eventType: 'natural_disaster' as const,
    civIds: [],
    description: 'Devastating floods wash over the land.',
    data: { severity },
  };

  return { ...state, tiles: newTiles, civilizations: newCivs, chronicle: [...state.chronicle, entry] };
}
