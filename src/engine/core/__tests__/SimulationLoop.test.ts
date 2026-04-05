import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimulationLoop } from '../SimulationLoop';
import { WorldEngine } from '../WorldEngine';
import { EventBus } from '../EventBus';
import type { WorldState } from '../../../types/world';

function makeEngine(): WorldEngine {
  const bus = new EventBus();
  const engine = new WorldEngine(bus);
  const state: WorldState = {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick: 0,
    tiles: [],
    civilizations: new Map(),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
  };
  engine.initialize(state);
  return engine;
}

// Minimal rAF/cAF stubs so SimulationLoop.start()/stop() don't throw in node
beforeEach(() => {
  let id = 0;
  globalThis.requestAnimationFrame = vi.fn(() => ++id) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = vi.fn() as typeof cancelAnimationFrame;
  globalThis.performance = { now: vi.fn(() => 0) } as unknown as Performance;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SimulationLoop', () => {
  describe('start / stop', () => {
    it('running is false before start()', () => {
      const loop = new SimulationLoop(makeEngine(), () => ({ paused: false, speed: 1 }));
      expect(loop.running).toBe(false);
    });

    it('running is true after start()', () => {
      const loop = new SimulationLoop(makeEngine(), () => ({ paused: false, speed: 1 }));
      loop.start();
      expect(loop.running).toBe(true);
    });

    it('running is false after stop()', () => {
      const loop = new SimulationLoop(makeEngine(), () => ({ paused: false, speed: 1 }));
      loop.start();
      loop.stop();
      expect(loop.running).toBe(false);
    });

    it('calling start() twice does not double-register', () => {
      const loop = new SimulationLoop(makeEngine(), () => ({ paused: false, speed: 1 }));
      loop.start();
      loop.start();
      expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    });

    it('calling stop() before start() does not throw', () => {
      const loop = new SimulationLoop(makeEngine(), () => ({ paused: false, speed: 1 }));
      expect(() => loop.stop()).not.toThrow();
    });
  });

  describe('tick driving via _stepForTesting', () => {
    it('does not call engine.tick() when paused=true', () => {
      const engine = makeEngine();
      const tickSpy = vi.spyOn(engine, 'tick');
      const loop = new SimulationLoop(engine, () => ({ paused: true, speed: 1 }));
      loop._stepForTesting(1000);
      expect(tickSpy).not.toHaveBeenCalled();
    });

    it('calls engine.tick() once when deltaMs >= tickInterval and not paused', () => {
      const engine = makeEngine();
      const tickSpy = vi.spyOn(engine, 'tick');
      const loop = new SimulationLoop(engine, () => ({ paused: false, speed: 1 }));
      loop._stepForTesting(1000); // speed=1 → tickInterval=1000ms → exactly 1 tick
      expect(tickSpy).toHaveBeenCalledOnce();
    });

    it('calls engine.tick() multiple times when deltaMs >> tickInterval', () => {
      const engine = makeEngine();
      const tickSpy = vi.spyOn(engine, 'tick');
      const loop = new SimulationLoop(engine, () => ({ paused: false, speed: 1 }));
      loop._stepForTesting(3000); // 3 × 1000ms ticks expected
      expect(tickSpy).toHaveBeenCalledTimes(3);
    });

    it('does not overflow: caps accumulator to one tickInterval after large delta', () => {
      const engine = makeEngine();
      const tickSpy = vi.spyOn(engine, 'tick');
      const loop = new SimulationLoop(engine, () => ({ paused: false, speed: 1 }));
      // Very large delta — should fire several ticks but accumulator is capped after
      loop._stepForTesting(100_000);
      // After the step the accumulator ≤ tickInterval (1000ms), so the next small step
      // won't fire an extra tick immediately
      tickSpy.mockClear();
      loop._stepForTesting(1); // well below tickInterval — should fire 0 ticks
      expect(tickSpy).not.toHaveBeenCalled();
    });

    it('speed=2 fires twice as many ticks as speed=1 for the same delta', () => {
      const engine1 = makeEngine();
      const engine2 = makeEngine();
      const spy1 = vi.spyOn(engine1, 'tick');
      const spy2 = vi.spyOn(engine2, 'tick');

      const loop1 = new SimulationLoop(engine1, () => ({ paused: false, speed: 1 }));
      const loop2 = new SimulationLoop(engine2, () => ({ paused: false, speed: 2 }));

      loop1._stepForTesting(2000); // speed=1 → 2 ticks
      loop2._stepForTesting(2000); // speed=2 → 4 ticks

      expect(spy2.mock.calls.length).toBe(spy1.mock.calls.length * 2);
    });

    it('speed=10 fires 10 ticks per second worth of delta', () => {
      const engine = makeEngine();
      const tickSpy = vi.spyOn(engine, 'tick');
      const loop = new SimulationLoop(engine, () => ({ paused: false, speed: 10 }));
      loop._stepForTesting(1000); // speed=10 → tickInterval=100ms → 10 ticks in 1000ms
      expect(tickSpy).toHaveBeenCalledTimes(10);
    });
  });
});
