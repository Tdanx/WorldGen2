import type { WorldState } from '../../types/world';
import type { GodCommand } from '../../types/simulation';
import { EventBus } from './EventBus';
import { StateHistory } from './StateHistory';
import { CivilizationEngine } from '../civilization/CivilizationEngine';
import { ReligionEngine } from '../religion/ReligionEngine';
import { ConflictEngine } from '../conflict/ConflictEngine';
import { DiplomacyEngine } from '../diplomacy/DiplomacyEngine';
import { ClimateSimulator } from '../climate/ClimateSimulator';
import { TectonicSimulator } from '../terrain/TectonicSimulator';
import { ErosionSimulator } from '../terrain/ErosionSimulator';
import { processGodCommands } from '../god/GodCommandProcessor';
import { ReligionRegistry } from '../../registries/ReligionRegistry';

type TickListener = (state: WorldState) => void;

export class WorldEngine {
  private state: WorldState | null = null;
  private pendingCommands: GodCommand[] = [];
  private tickListeners = new Set<TickListener>();

  private readonly civEngine        = new CivilizationEngine();
  private readonly religionEngine   = new ReligionEngine();
  private readonly conflictEngine   = new ConflictEngine();
  private readonly diplomacyEngine  = new DiplomacyEngine();
  private readonly climateEngine    = new ClimateSimulator();
  private readonly tectonicEngine   = new TectonicSimulator();
  private readonly erosionEngine    = new ErosionSimulator();
  private readonly history          = new StateHistory();

  private tectonicsEnabled = true;
  private erosionEnabled   = true;

  constructor(public readonly bus: EventBus) {}

  initialize(state: WorldState): void {
    // Reset global singletons so a new world starts clean
    ReligionRegistry.reset();
    this.state = state;
    this.history.clear();
    this.bus.emit('world:generated', state);
  }

  getState(): WorldState | null {
    return this.state;
  }

  tick(): void {
    if (!this.state) return;

    // Capture and clear pending commands before running the tick
    const cmds = [...this.pendingCommands];
    this.pendingCommands = [];

    let next: WorldState = { ...this.state, tick: this.state.tick + 1 };

    // 1. Civilization: growth → tech → stability/collapse
    next = this.civEngine.tick(next);

    // 2. Religion: founding → schism → spread → extinction
    next = this.religionEngine.tick(next);

    // 3. Conflict: war pressure → auto-declaration → battle → resolution
    const prevWarIds = new Set(next.wars.filter(w => !w.endedTick).map(w => w.id));
    next = this.conflictEngine.tickWars(next);

    // Emit bus events for newly declared and newly ended wars
    for (const war of next.wars) {
      if (!prevWarIds.has(war.id) && !war.endedTick) {
        this.bus.emit('war:declared', {
          aggressorId: war.aggressorId,
          defenderId: war.defenderId,
          tick: next.tick,
        });
      }
      if (war.endedTick === next.tick) {
        this.bus.emit('war:ended', {
          warId: war.id,
          outcome: war.outcome ?? 'white_peace',
          tick: next.tick,
        });
      }
    }

    // 4. Diplomacy: age opinions → post-war pacts → treaty violations
    next = this.diplomacyEngine.tick(next);

    // 5. Climate: seasonal temperature and moisture cycles
    next = this.climateEngine.tick(next);

    // 6a. Tectonic activity (every TECTONIC_INTERVAL ticks)
    if (this.tectonicsEnabled) {
      next = this.tectonicEngine.tick(next);
    }

    // 6b. Erosion (every EROSION_INTERVAL ticks)
    if (this.erosionEnabled) {
      next = this.erosionEngine.tick(next);
    }

    // 6. God commands (applied last so they see the fully simulated state)
    if (cmds.length > 0) {
      next = processGodCommands(cmds, next);
      // Emit events for disaster commands so the renderer can show visual markers
      for (const cmd of cmds) {
        if (cmd.type === 'VOLCANIC_ERUPTION' || cmd.type === 'METEOR_IMPACT') {
          this.bus.emit('disaster:fired', { disasterType: cmd.type, epicenter: cmd.epicenter });
        } else if (cmd.type === 'FLOOD' || cmd.type === 'DROUGHT') {
          this.bus.emit('disaster:fired', { disasterType: cmd.type, epicenter: cmd.region[0] ?? -1 });
        }
      }
    }

    this.state = next;
    this.history.push(next);
    this.bus.emit('world:tick', next);
    for (const cb of this.tickListeners) cb(next);
  }

  queueCommand(cmd: GodCommand): void {
    this.pendingCommands.push(cmd);
  }

  /**
   * Immediately apply all pending god commands without running the full simulation
   * tick (no civ/religion/conflict/diplomacy). Useful when the sim is paused and the
   * player wants instant feedback from terrain painting or other god tools.
   */
  flushCommands(): void {
    if (!this.state || this.pendingCommands.length === 0) return;

    const cmds = [...this.pendingCommands];
    this.pendingCommands = [];

    const next = processGodCommands(cmds, this.state);
    this.state = next;

    // Notify React stores so UI reflects the change
    this.bus.emit('world:tick', next);
    for (const cb of this.tickListeners) cb(next);

    // Signal renderer to rebake geometry if any terrain commands were applied
    const hasTerrainCmd = cmds.some(
      c => c.type === 'RAISE_TERRAIN' || c.type === 'LOWER_TERRAIN' || c.type === 'SET_BIOME',
    );
    if (hasTerrainCmd) {
      this.bus.emit('terrain:modified', {});
    }
  }

  /** Returns an unsubscribe function. */
  onTick(cb: TickListener): () => void {
    this.tickListeners.add(cb);
    return () => this.tickListeners.delete(cb);
  }

  // --- StateHistory API ---

  getHistory(): StateHistory {
    return this.history;
  }

  /**
   * Rewind the simulation by `steps` ticks (default 1).
   * Pauses-in-place — callers should pause the SimulationLoop first if desired.
   */
  stepBack(steps = 1): void {
    // undo(1) returns the most recently pushed state (= current), so
    // we need steps+1 to actually land on the state *before* the current one.
    const snapshot = this.history.undo(steps + 1);
    if (!snapshot) return;
    this.state = snapshot;
    this.bus.emit('world:tick', snapshot);
    for (const cb of this.tickListeners) cb(snapshot);
  }

  /**
   * Seek to the snapshot at or before the given tick.
   */
  seekToTick(tick: number): void {
    const snapshot = this.history.seekTo(tick);
    if (!snapshot) return;
    this.state = snapshot;
    this.bus.emit('world:tick', snapshot);
    for (const cb of this.tickListeners) cb(snapshot);
  }

  // --- Geology feature flags ---

  setTectonicsEnabled(enabled: boolean): void {
    this.tectonicsEnabled = enabled;
  }

  setErosionEnabled(enabled: boolean): void {
    this.erosionEnabled = enabled;
  }
}
