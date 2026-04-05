import type { WorldState, Tile, WorldConfig } from '../types/world';
import type { Civilization, CivId } from '../types/civilization';
import type { WarState } from '../types/conflict';
import type { ChronicleEntry } from '../types/events';
import type { DiplomacyEntry } from '../types/diplomacy';
import type { FaithDef } from '../types/religion';
import { worldEngine } from '../hooks/useEngine';
import { ReligionRegistry } from '../registries/ReligionRegistry';

const SAVE_KEY = 'worldgen2_save';

// ─── Serialized shapes ────────────────────────────────────────────────────────

interface SerializedFaith extends Omit<FaithDef, 'followerCivIds'> {
  followerCivIds: CivId[];   // Set<CivId> → array
}

interface SaveFile {
  version: 1;
  savedAt: string;
  state: {
    config: WorldConfig;
    tick: number;
    tiles: Tile[];
    civilizations: [CivId, Civilization][];      // Map → entries
    wars: WarState[];
    chronicle: ChronicleEntry[];
    diplomacyMatrix: [string, DiplomacyEntry][]; // Map → entries
  };
  religions: SerializedFaith[];
}

export interface SaveData {
  state: WorldState;
  religions: FaithDef[];   // Set already reconstructed
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Serialize current world to localStorage. Returns `{ ok: true }` on success or `{ ok: false, error }` on failure. */
export function saveWorld(): { ok: boolean; error?: string } {
  const state = worldEngine.getState();
  if (!state) return { ok: false };

  const save: SaveFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    state: {
      config: state.config,
      tick: state.tick,
      tiles: [...state.tiles],
      civilizations: [...state.civilizations.entries()],
      wars: [...state.wars],
      chronicle: [...state.chronicle],
      diplomacyMatrix: [...state.diplomacyMatrix.entries()],
    },
    religions: ReligionRegistry.getAll().map(f => ({
      ...f,
      followerCivIds: [...f.followerCivIds],
    })),
  };

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('saveWorld failed:', err);
    return { ok: false, error: `Save failed: ${msg}` };
  }
}

/**
 * Parse save data from localStorage — pure data, no side effects.
 * Returns null if no save exists or the data is corrupt.
 * Caller is responsible for re-initializing the engine and renderer.
 */
export function parseSave(): SaveData | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  try {
    const save = JSON.parse(raw) as SaveFile;
    if (save.version !== 1) return null;

    const state: WorldState = {
      config: save.state.config,
      tick: save.state.tick,
      tiles: save.state.tiles,
      civilizations: new Map(save.state.civilizations),
      wars: save.state.wars,
      chronicle: save.state.chronicle,
      diplomacyMatrix: new Map(save.state.diplomacyMatrix),
    };

    const religions: FaithDef[] = save.religions.map(sf => ({
      ...sf,
      followerCivIds: new Set<CivId>(sf.followerCivIds),
    }));

    return { state, religions };
  } catch (e) {
    console.error('parseSave failed:', e);
    return null;
  }
}

/**
 * Restore engine state + ReligionRegistry from a parsed save.
 * Call AFTER mapRenderer.initialize() so the renderer is ready.
 */
export function applyLoadedState(data: SaveData): void {
  // initialize() calls ReligionRegistry.reset() internally; restore religions after.
  worldEngine.initialize(data.state);
  for (const faith of data.religions) {
    ReligionRegistry._restoreEntry(faith);
  }
}

/** Returns true if a save exists in localStorage. */
export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}
