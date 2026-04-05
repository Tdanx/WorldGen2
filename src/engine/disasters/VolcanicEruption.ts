import type { WorldState } from '../../types/world';
import type { BiomeType } from '../../types/terrain';
import { makeEntryId } from '../core/idgen';
import { tilesInRadius, damageTerritory } from './disasterUtils';

const RADIUS = 3;

export function applyVolcanicEruption(
  state: WorldState,
  epicenter: number,
  magnitude: number,
): WorldState {
  const epi = state.tiles[epicenter];
  if (!epi) return state;

  const { spacing } = state.config;
  const affected = tilesInRadius(epi, state.tiles, RADIUS, spacing);
  const affectedSet = new Set(affected.map(t => t.index));

  const newTiles = state.tiles.map(t => {
    if (t.index === epi.index) return { ...t, biome: 'Volcano' as BiomeType };
    if (affectedSet.has(t.index)) return { ...t, elevation: Math.min(1, t.elevation + 0.1 * magnitude) };
    return t;
  });

  const newCivs = damageTerritory(state, affectedSet, magnitude * 0.4);

  const entry = {
    id: makeEntryId('disaster'),
    tick: state.tick,
    severity: 'epoch' as const,
    eventType: 'natural_disaster' as const,
    civIds: [],
    description: 'A volcano erupts, reshaping the land.',
    location: epicenter,
    data: { magnitude },
  };

  return { ...state, tiles: newTiles, civilizations: newCivs, chronicle: [...state.chronicle, entry] };
}
