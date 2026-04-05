import type { WorldEngine } from './WorldEngine';

export interface StoreSnapshot {
  paused: boolean;
  speed: number; // ticks per second
}

export class SimulationLoop {
  private rafHandle: ReturnType<typeof requestAnimationFrame> | null = null;
  private lastTime = 0;
  private accumulator = 0;

  constructor(
    private engine: WorldEngine,
    private getStore: () => StoreSnapshot,
  ) {}

  get running(): boolean {
    return this.rafHandle !== null;
  }

  start(): void {
    if (this.rafHandle !== null) return;
    this.lastTime = performance.now();
    this.accumulator = 0;
    const loop = (now: number) => {
      this.rafHandle = requestAnimationFrame(loop);
      this._step(now);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafHandle === null) return;
    cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
  }

  /**
   * Exposed for unit testing. Advances the internal accumulator by deltaMs
   * and fires engine.tick() as many times as the current speed dictates.
   */
  _stepForTesting(deltaMs: number): void {
    this._advance(deltaMs);
  }

  private _step(now: number): void {
    const deltaMs = Math.min(now - this.lastTime, 200); // cap to prevent spiral-of-death
    this.lastTime = now;
    this._advance(deltaMs);
  }

  private _advance(deltaMs: number): void {
    const { paused, speed } = this.getStore();
    if (paused) return;

    const tickInterval = 1000 / speed;
    this.accumulator += deltaMs;

    while (this.accumulator >= tickInterval) {
      this.engine.tick();
      this.accumulator -= tickInterval;
    }

    // Prevent unbounded accumulator growth (e.g. after tab comes back from suspension)
    this.accumulator = Math.min(this.accumulator, tickInterval);
  }
}
