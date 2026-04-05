import type { WorldState } from '../../types/world';

const MAX_SNAPSHOTS = 600;

/**
 * Bounded ring buffer of WorldState snapshots for undo/time-replay.
 *
 * States are stored by reference — no deep copies. This is safe because
 * WorldState is treated as immutable throughout the engine: every tick
 * returns a new state object, and only the changed tile slice is a new
 * allocation. The ring buffer just holds references to those immutable
 * snapshots.
 */
export class StateHistory {
  private readonly buffer: Array<WorldState | null> = new Array(MAX_SNAPSHOTS).fill(null);
  private head = 0;   // index where the NEXT push will write
  private count = 0;  // number of valid snapshots stored (≤ MAX_SNAPSHOTS)

  push(state: WorldState): void {
    this.buffer[this.head % MAX_SNAPSHOTS] = state;
    this.head = (this.head + 1) % MAX_SNAPSHOTS;
    if (this.count < MAX_SNAPSHOTS) this.count++;
  }

  canUndo(steps = 1): boolean {
    return steps >= 1 && steps <= this.count;
  }

  /**
   * Return the snapshot `steps` ticks before the most recent push.
   * `steps = 1` returns the last pushed state.
   */
  undo(steps = 1): WorldState | null {
    if (!this.canUndo(steps)) return null;
    const idx = (this.head - steps + MAX_SNAPSHOTS * 2) % MAX_SNAPSHOTS;
    return this.buffer[idx];
  }

  /**
   * Return the snapshot with the highest tick that is ≤ `tick`.
   * Scans backward from the most recent snapshot.
   */
  seekTo(tick: number): WorldState | null {
    for (let i = 1; i <= this.count; i++) {
      const idx = (this.head - i + MAX_SNAPSHOTS * 2) % MAX_SNAPSHOTS;
      const snap = this.buffer[idx];
      if (snap && snap.tick <= tick) return snap;
    }
    return null;
  }

  getOldestTick(): number | null {
    if (this.count === 0) return null;
    const idx = (this.head - this.count + MAX_SNAPSHOTS * 2) % MAX_SNAPSHOTS;
    return this.buffer[idx]?.tick ?? null;
  }

  getNewestTick(): number | null {
    if (this.count === 0) return null;
    const idx = (this.head - 1 + MAX_SNAPSHOTS) % MAX_SNAPSHOTS;
    return this.buffer[idx]?.tick ?? null;
  }

  getSnapshotCount(): number {
    return this.count;
  }

  clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.count = 0;
  }
}
