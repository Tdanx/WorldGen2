import type { Civilization, SpeciesDef } from '../../types/civilization';
import type { Tile } from '../../types/world';

// 12 visually distinct civ colors; none conflict with the BiomeRegistry terrain palette
// (which uses deep blues, sandy beiges, greens, greys, and dark reds).
const CIV_PALETTE: readonly string[] = [
  '#e63946', // vivid red
  '#f77f00', // deep orange
  '#fcbf49', // amber
  '#9b5de5', // purple
  '#f15bb5', // hot pink
  '#00bbf9', // sky cyan
  '#00f5d4', // seafoam teal
  '#ff6b6b', // coral
  '#c77dff', // lavender
  '#ff9f1c', // tangerine
  '#e9c46a', // warm gold
  '#8338ec', // electric violet
];

const PREFIXES: readonly string[] = [
  'Iron', 'Golden', 'Silver', 'Ancient', 'Blazing', 'Frozen',
  'Stone', 'Shadow', 'Storm', 'Crimson', 'Verdant', 'Sacred',
];

const SUFFIXES: readonly string[] = [
  'Kingdom', 'Empire', 'Republic', 'Dominion', 'Hold', 'Realm',
  'Confederation', 'Sovereignty', 'League', 'Pact', 'Theocracy', 'Horde',
];

/**
 * Creates a new Civilization from a species template and a chosen capital tile.
 *
 * RNG draw order (fixed — tests depend on this sequence):
 *   Draw 1 → prefix index
 *   Draw 2 → suffix index
 *   Draw 3 → population offset (100–299)
 */
export function createCiv(
  species: SpeciesDef,
  capitalTile: Tile,
  rng: () => number,
  foundedTick: number,
  civIndex: number,
): Civilization {
  const prefix = PREFIXES[Math.floor(rng() * PREFIXES.length)];
  const suffix = SUFFIXES[Math.floor(rng() * SUFFIXES.length)];
  const population = 100 + Math.floor(rng() * 200);
  const baseStrength = Math.floor(population * 0.1);

  return {
    id: `civ-${civIndex}`,
    name: `${prefix} ${species.name} ${suffix}`,
    speciesId: species.id,
    color: CIV_PALETTE[civIndex % CIV_PALETTE.length],
    capitalTile: capitalTile.index,
    territory: [capitalTile.index],
    population,
    treasury: 50,
    era: 'Stone',
    techLevel: 0,
    faithId: null,
    military: {
      baseStrength,
      morale: 1.0,
      supplyLine: 1.0,
      // Assigned directly to avoid float drift from multiplying 1.0 × 1.0
      effectiveStrength: baseStrength,
    },
    lifecycle: {
      phase: 'founding',
      phaseEnteredTick: foundedTick,
      stabilityScore: 80,
      instabilityFlags: [],
      collapseRisk: 0,
    },
    foundedTick,
  };
}
