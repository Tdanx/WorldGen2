import type { WorldState, Tile } from '../../types/world';
import type { Civilization } from '../../types/civilization';

export function tileDist(a: Tile, b: Tile): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function tilesInRadius(
  epicenter: Tile,
  allTiles: ReadonlyArray<Tile>,
  radiusCells: number,
  spacing: number,
): Tile[] {
  const threshold = radiusCells * spacing * 10;
  return allTiles.filter(t => tileDist(epicenter, t) <= threshold);
}

export function damageTerritory(
  state: WorldState,
  affectedIndices: Set<number>,
  damageFraction: number,
): ReadonlyMap<string, Civilization> {
  const newCivs = new Map(state.civilizations);
  for (const [id, civ] of newCivs) {
    const overlap = civ.territory.filter(ti => affectedIndices.has(ti)).length;
    if (overlap > 0) {
      const fraction = Math.min(1, (overlap / civ.territory.length) * damageFraction);
      newCivs.set(id, {
        ...civ,
        population: Math.max(1, Math.floor(civ.population * (1 - fraction))),
      });
    }
  }
  return newCivs;
}
