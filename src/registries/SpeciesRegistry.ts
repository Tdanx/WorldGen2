import type { SpeciesDef, SpeciesId } from '../types/civilization';
import { BiomeType } from '../types/terrain';

class SpeciesRegistryClass {
  private entries = new Map<SpeciesId, SpeciesDef>();

  constructor() {
    // Built-in species templates
    this.register({
      id: 'human',
      name: 'Humans',
      traits: { aggression: 0.5, expansion: 0.6, religiosity: 0.5, techAffinity: 0.7, diplomacy: 0.6, resilience: 0.5 },
      preferredBiomes: [BiomeType.Grassland, BiomeType.TemperateForest, BiomeType.Savanna],
      description: 'Adaptable and ambitious. Masters of agriculture and diplomacy.',
    });
    this.register({
      id: 'dwarven',
      name: 'Dwarves',
      traits: { aggression: 0.6, expansion: 0.3, religiosity: 0.4, techAffinity: 0.9, diplomacy: 0.4, resilience: 0.8 },
      preferredBiomes: [BiomeType.Mountain, BiomeType.BorealForest],
      description: 'Industrious mountain-dwellers. Exceptional engineers and miners.',
    });
    this.register({
      id: 'elven',
      name: 'Elves',
      traits: { aggression: 0.3, expansion: 0.4, religiosity: 0.7, techAffinity: 0.6, diplomacy: 0.8, resilience: 0.6 },
      preferredBiomes: [BiomeType.TemperateForest, BiomeType.TropicalRainforest],
      description: 'Long-lived forest people. Skilled in magic and diplomacy.',
    });
    this.register({
      id: 'orcish',
      name: 'Orcs',
      traits: { aggression: 0.9, expansion: 0.8, religiosity: 0.5, techAffinity: 0.4, diplomacy: 0.2, resilience: 0.7 },
      preferredBiomes: [BiomeType.Desert, BiomeType.Savanna, BiomeType.Tundra],
      description: 'Fierce and expansionist. Fearsome warriors who thrive in harsh lands.',
    });
    this.register({
      id: 'lizardfolk',
      name: 'Lizardfolk',
      traits: { aggression: 0.6, expansion: 0.5, religiosity: 0.8, techAffinity: 0.3, diplomacy: 0.4, resilience: 0.6 },
      preferredBiomes: [BiomeType.TropicalRainforest, BiomeType.Beach, BiomeType.ShallowSea],
      description: 'Ancient and spiritual. Rulers of swamps and tropical coasts.',
    });
  }

  register(def: SpeciesDef): void {
    this.entries.set(def.id, def);
  }

  get(id: SpeciesId): SpeciesDef | undefined {
    return this.entries.get(id);
  }

  getAll(): SpeciesDef[] {
    return Array.from(this.entries.values());
  }
}

export const SpeciesRegistry = new SpeciesRegistryClass();
