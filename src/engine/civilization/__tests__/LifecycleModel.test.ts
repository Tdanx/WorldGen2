import { describe, it, expect } from 'vitest';
import { updateStability, applyCollapse, tickLifecycle } from '../LifecycleModel';
import type { Civilization } from '../../../types/civilization';
import type { Tile, WorldState } from '../../../types/world';
import { BiomeType } from '../../../types/terrain';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCiv(id: string, overrides: Partial<Civilization> = {}): Civilization {
  return {
    id, name: `${id} Kingdom`, speciesId: 'human', color: '#fff',
    capitalTile: 0, territory: [0], population: 1000, treasury: 50,
    era: 'Stone', techLevel: 0, faithId: null,
    military: { baseStrength: 100, morale: 1, supplyLine: 1, effectiveStrength: 100 },
    lifecycle: {
      phase: 'growth', phaseEnteredTick: 0,
      stabilityScore: 80, instabilityFlags: [], collapseRisk: 0.2,
    },
    foundedTick: 0,
    ...overrides,
  };
}

function makeTile(index: number): Tile {
  return {
    index, x: index * 55, y: 0,
    elevation: 0.4, moisture: 0.5, temperature: 0.2,
    biome: BiomeType.Grassland,
    isWater: false, isRiver: false, riverFlow: null,
    ownerId: null, religionId: null,
  };
}

function makeState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick: 10,
    tiles: [makeTile(0), makeTile(1), makeTile(2)],
    civilizations: new Map([['civ-0', makeCiv('civ-0')]]),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
    ...overrides,
  };
}

// ─── updateStability ──────────────────────────────────────────────────────────

describe('updateStability', () => {
  it('reduces stabilityScore when civ has famine flag', () => {
    const civ = makeCiv('civ-0', {
      lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: ['famine'], collapseRisk: 0 },
    });
    const result = updateStability(civ, makeState(), false);
    expect(result.lifecycle.stabilityScore).toBeLessThan(80);
  });

  it('adds overstretched_borders flag when territory > 50 tiles', () => {
    const territory = Array.from({ length: 51 }, (_, i) => i);
    const civ = makeCiv('civ-0', { territory });
    const result = updateStability(civ, makeState(), false);
    expect(result.lifecycle.instabilityFlags).toContain('overstretched_borders');
  });

  it('reduces stabilityScore for overstretched_borders', () => {
    const territory = Array.from({ length: 51 }, (_, i) => i);
    const civ = makeCiv('civ-0', { territory });
    const result = updateStability(civ, makeState(), false);
    expect(result.lifecycle.stabilityScore).toBeLessThan(80);
  });

  it('removes overstretched_borders flag when territory shrinks below 50', () => {
    const civ = makeCiv('civ-0', {
      territory: [0],
      lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: ['overstretched_borders'], collapseRisk: 0 },
    });
    const result = updateStability(civ, makeState(), false);
    expect(result.lifecycle.instabilityFlags).not.toContain('overstretched_borders');
  });

  it('reduces stability when civ is in an active war', () => {
    const state = makeState({
      wars: [{
        id: 'war-0', aggressorId: 'civ-0', defenderId: 'civ-1',
        declaredTick: 5, cause: 'border_tension', warScore: 0,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      }],
    });
    const civ = makeCiv('civ-0');
    const result = updateStability(civ, state, false);
    expect(result.lifecycle.stabilityScore).toBeLessThan(80);
  });

  it('increases stability when tech advances this tick', () => {
    const civ = makeCiv('civ-0', {
      lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 60, instabilityFlags: [], collapseRisk: 0 },
    });
    const result = updateStability(civ, makeState(), true);
    expect(result.lifecycle.stabilityScore).toBeGreaterThan(60);
  });

  it('grants peace bonus when stable, no flags, no war', () => {
    const civ = makeCiv('civ-0', {
      lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 75, instabilityFlags: [], collapseRisk: 0 },
    });
    const result = updateStability(civ, makeState(), false);
    expect(result.lifecycle.stabilityScore).toBeGreaterThan(75);
  });

  it('does NOT grant peace bonus when stability is 60 or below', () => {
    const civ = makeCiv('civ-0', {
      lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 60, instabilityFlags: [], collapseRisk: 0 },
    });
    const result = updateStability(civ, makeState(), false);
    // peace bonus requires > 60; exactly 60 should not get it
    expect(result.lifecycle.stabilityScore).toBe(60);
  });

  it('clamps stabilityScore to 0 minimum', () => {
    const civ = makeCiv('civ-0', {
      lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 2, instabilityFlags: ['famine'], collapseRisk: 0.8 },
    });
    const result = updateStability(civ, makeState(), false);
    expect(result.lifecycle.stabilityScore).toBeGreaterThanOrEqual(0);
  });

  it('clamps stabilityScore to 100 maximum', () => {
    const civ = makeCiv('civ-0', {
      lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 99, instabilityFlags: [], collapseRisk: 0 },
    });
    const result = updateStability(civ, makeState(), true);
    expect(result.lifecycle.stabilityScore).toBeLessThanOrEqual(100);
  });

  it('is a no-op for collapsed civs', () => {
    const civ = makeCiv('civ-0', {
      lifecycle: { phase: 'collapse', phaseEnteredTick: 0, stabilityScore: 0, instabilityFlags: [], collapseRisk: 1 },
    });
    const result = updateStability(civ, makeState(), false);
    expect(result).toBe(civ); // same reference — no changes
  });

  it('is a no-op for extinct civs', () => {
    const civ = makeCiv('civ-0', {
      lifecycle: { phase: 'extinct', phaseEnteredTick: 0, stabilityScore: 0, instabilityFlags: [], collapseRisk: 1 },
    });
    const result = updateStability(civ, makeState(), false);
    expect(result).toBe(civ);
  });

  it('updates collapseRisk as inverse of stabilityScore', () => {
    const civ = makeCiv('civ-0', {
      lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 80, instabilityFlags: [], collapseRisk: 0 },
    });
    const result = updateStability(civ, makeState(), false); // peace bonus → 81
    expect(result.lifecycle.collapseRisk).toBeCloseTo(1 - result.lifecycle.stabilityScore / 100, 2);
  });
});

// ─── applyCollapse ────────────────────────────────────────────────────────────

describe('applyCollapse', () => {
  it('sets phase to collapse', () => {
    const civ = makeCiv('civ-0', { territory: [0, 1, 2] });
    const { civ: collapsed } = applyCollapse(civ);
    expect(collapsed.lifecycle.phase).toBe('collapse');
  });

  it('clears territory', () => {
    const civ = makeCiv('civ-0', { territory: [0, 1, 2] });
    const { civ: collapsed } = applyCollapse(civ);
    expect(collapsed.territory).toHaveLength(0);
  });

  it('sets population to 0', () => {
    const civ = makeCiv('civ-0', { population: 5000 });
    const { civ: collapsed } = applyCollapse(civ);
    expect(collapsed.population).toBe(0);
  });

  it('returns the freed tile indices', () => {
    const civ = makeCiv('civ-0', { territory: [3, 7, 12] });
    const { freedTiles } = applyCollapse(civ);
    expect(freedTiles.has(3)).toBe(true);
    expect(freedTiles.has(7)).toBe(true);
    expect(freedTiles.has(12)).toBe(true);
  });
});

// ─── tickLifecycle ────────────────────────────────────────────────────────────

describe('tickLifecycle', () => {
  it('returns updated civs without mutating input', () => {
    const civ = makeCiv('civ-0');
    const civs = new Map([['civ-0', civ]]);
    const state = makeState();
    const result = tickLifecycle(civs, state, new Set());
    expect(result.civs).not.toBe(civs);
  });

  it('detects collapse when stabilityScore drops to 0', () => {
    const civ = makeCiv('civ-0', {
      lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 1, instabilityFlags: ['famine'], collapseRisk: 0.99 },
    });
    const state = makeState({ wars: [{ id: 'w', aggressorId: 'civ-0', defenderId: 'civ-1', declaredTick: 5, cause: 'border_tension', warScore: 0, casualties: { aggressor: 0, defender: 0 }, contestedTiles: [] }] });
    const result = tickLifecycle(new Map([['civ-0', civ]]), state, new Set());
    expect(result.collapsedIds).toContain('civ-0');
    expect(result.civs.get('civ-0')!.lifecycle.phase).toBe('collapse');
  });

  it('returns freed tile indices when civ collapses', () => {
    const civ = makeCiv('civ-0', {
      territory: [1, 2, 3],
      lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 1, instabilityFlags: ['famine'], collapseRisk: 0.99 },
    });
    const state = makeState({ wars: [{ id: 'w', aggressorId: 'civ-0', defenderId: 'civ-1', declaredTick: 5, cause: 'border_tension', warScore: 0, casualties: { aggressor: 0, defender: 0 }, contestedTiles: [] }] });
    const result = tickLifecycle(new Map([['civ-0', civ]]), state, new Set());
    expect(result.freedTiles.has(1)).toBe(true);
    expect(result.freedTiles.has(2)).toBe(true);
    expect(result.freedTiles.has(3)).toBe(true);
  });

  it('marks tech-advancing civs with a stability bonus', () => {
    const civ = makeCiv('civ-0', {
      lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 60, instabilityFlags: [], collapseRisk: 0.4 },
    });
    const state = makeState();
    const result = tickLifecycle(new Map([['civ-0', civ]]), state, new Set(['civ-0']));
    expect(result.civs.get('civ-0')!.lifecycle.stabilityScore).toBeGreaterThan(60);
  });
});

// ─── CivilizationEngine integration ──────────────────────────────────────────

describe('CivilizationEngine + LifecycleModel integration', () => {
  it('emits civ_collapsed entry when a civ reaches stabilityScore 0', async () => {
    const { CivilizationEngine } = await import('../CivilizationEngine');
    const engine = new CivilizationEngine();

    // Civ with stability=1, famine flag, at war → will drop to 0
    const civ = makeCiv('civ-0', {
      lifecycle: { phase: 'growth', phaseEnteredTick: 0, stabilityScore: 1, instabilityFlags: ['famine'], collapseRisk: 0.99 },
    });
    const state = makeState({
      civilizations: new Map([['civ-0', civ]]),
      wars: [{
        id: 'w-0', aggressorId: 'civ-0', defenderId: 'civ-1',
        declaredTick: 5, cause: 'border_tension', warScore: 0,
        casualties: { aggressor: 0, defender: 0 }, contestedTiles: [],
      }],
    });

    const result = engine.tick(state);
    expect(result.chronicle.some(e => e.eventType === 'civ_collapsed')).toBe(true);
    expect((result.civilizations as Map<string, Civilization>).get('civ-0')!.lifecycle.phase).toBe('collapse');
  });
});
