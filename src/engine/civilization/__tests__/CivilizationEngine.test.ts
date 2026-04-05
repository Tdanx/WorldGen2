import { describe, it, expect, beforeEach } from 'vitest';
import { CivilizationEngine } from '../CivilizationEngine';
import type { Civilization } from '../../../types/civilization';
import type { Tile, WorldState } from '../../../types/world';
import { BiomeType } from '../../../types/terrain';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCiv(overrides: Partial<Civilization> = {}): Civilization {
  return {
    id: 'civ-0', name: 'Test Kingdom', speciesId: 'human', color: '#e63946',
    capitalTile: 0, territory: [0], population: 100, treasury: 50,
    era: 'Stone', techLevel: 0, faithId: null,
    military: { baseStrength: 10, morale: 1.0, supplyLine: 1.0, effectiveStrength: 10 },
    lifecycle: { phase: 'founding', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: [], collapseRisk: 0 },
    foundedTick: 0,
    ...overrides,
  };
}

function makeGrasslandGrid(): Tile[] {
  const GRID_SIZE = 20;
  const SPACING = 55;
  const tiles: Tile[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const index = row * GRID_SIZE + col;
      tiles.push({
        index, x: col * SPACING, y: row * SPACING,
        elevation: 0.3, moisture: 0.6, temperature: 0.2,
        biome: BiomeType.Grassland,
        isWater: false, isRiver: false, riverFlow: null,
        ownerId: null, religionId: null,
      });
    }
  }
  return tiles;
}

function makeWorldState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    config: { seed: 42, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick: 0,
    tiles: makeGrasslandGrid().map((t, i) =>
      i === 0 ? { ...t, ownerId: 'civ-0' } : t,
    ),
    civilizations: new Map([['civ-0', makeCiv()]]),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CivilizationEngine', () => {
  let engine: CivilizationEngine;

  beforeEach(() => {
    engine = new CivilizationEngine();
  });

  it('tick() returns a new WorldState (not the same reference)', () => {
    const state = makeWorldState();
    const result = engine.tick(state);
    expect(result).not.toBe(state);
  });

  it('tick() does not mutate the input WorldState', () => {
    const state = makeWorldState();
    const originalTick = state.tick;
    const originalChronicleLength = state.chronicle.length;
    engine.tick(state);
    expect(state.tick).toBe(originalTick);
    expect(state.chronicle.length).toBe(originalChronicleLength);
  });

  it('tick() adds a civ_founded entry per civ on the first call', () => {
    const state = makeWorldState();
    const result = engine.tick(state);
    const foundedEntries = result.chronicle.filter(e => e.eventType === 'civ_founded');
    expect(foundedEntries).toHaveLength(1);
  });

  it('tick() does NOT re-emit civ_founded on the second call', () => {
    const state = makeWorldState();
    const state2 = engine.tick(state);
    const state3 = engine.tick(state2);
    const foundedEntries = state3.chronicle.filter(e => e.eventType === 'civ_founded');
    expect(foundedEntries).toHaveLength(1);
  });

  it('population increases after multiple ticks on fertile land', () => {
    let state = makeWorldState();
    const initialPop = (state.civilizations as Map<string, Civilization>).get('civ-0')!.population;
    for (let i = 0; i < 5; i++) {
      state = engine.tick(state);
    }
    const finalPop = (state.civilizations as Map<string, Civilization>).get('civ-0')!.population;
    expect(finalPop).toBeGreaterThan(initialPop);
  });

  it('territory grows over multiple ticks', () => {
    let state = makeWorldState();
    for (let i = 0; i < 3; i++) {
      state = engine.tick(state);
    }
    const territory = (state.civilizations as Map<string, Civilization>).get('civ-0')!.territory;
    expect(territory.length).toBeGreaterThan(1);
  });

  it('tech advances on first tick with pop=200000 dwarven civ', () => {
    const tiles = makeGrasslandGrid().map((t, i) =>
      i === 0 ? { ...t, ownerId: 'civ-0' } : t,
    );
    const civ = makeCiv({ population: 200000, speciesId: 'dwarven' });
    const state: WorldState = {
      config: { seed: 42, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
      tick: 0, tiles, civilizations: new Map([['civ-0', civ]]), wars: [], chronicle: [], diplomacyMatrix: new Map(),
    };
    const result = engine.tick(state);
    const updatedCiv = (result.civilizations as Map<string, Civilization>).get('civ-0')!;
    expect(updatedCiv.techLevel).toBe(1);
    expect(result.chronicle.some(e => e.eventType === 'golden_age_begun')).toBe(true);
  });

  it('chronicle accumulates entries across ticks (never shrinks)', () => {
    let state = makeWorldState();
    const lengths: number[] = [];
    for (let i = 0; i < 5; i++) {
      state = engine.tick(state);
      lengths.push(state.chronicle.length);
    }
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1]);
    }
  });

  it('chronicle entries have unique ids', () => {
    let state = makeWorldState();
    for (let i = 0; i < 3; i++) {
      state = engine.tick(state);
    }
    const ids = state.chronicle.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
