import type { WorldState } from '../../types/world';
import { assignBiome } from '../terrain/MapGen4Bridge';
import { makeEntryId } from '../core/idgen';
import { tileDist, tilesInRadius, damageTerritory } from './disasterUtils';

export function applyMeteorImpact(
  state: WorldState,
  epicenter: number,
  radius: number,
): WorldState {
  const epi = state.tiles[epicenter];
  if (!epi) return state;

  const { spacing } = state.config;
  const affected = tilesInRadius(epi, state.tiles, radius, spacing);
  const affectedSet = new Set(affected.map(t => t.index));
  const threshold = radius * spacing * 10;

  const newTiles = state.tiles.map(t => {
    if (!affectedSet.has(t.index)) return t;
    const dist = tileDist(epi, t);
    const intensity = 1 - dist / (threshold + 1);
    const elevation = Math.max(0, t.elevation - intensity * 0.3);
    return { ...t, elevation, biome: assignBiome(elevation, t.moisture, t.temperature) };
  });

  const newCivs = damageTerritory(state, affectedSet, 0.6);

  const entry = {
    id: makeEntryId('disaster'),
    tick: state.tick,
    severity: 'epoch' as const,
    eventType: 'natural_disaster' as const,
    civIds: [],
    description: 'A meteor strikes, devastating the region.',
    location: epicenter,
    data: { radius },
  };

  return { ...state, tiles: newTiles, civilizations: newCivs, chronicle: [...state.chronicle, entry] };
}
