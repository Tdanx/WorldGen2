import { describe, it, expect, beforeEach } from 'vitest';
import { worldEngine, simulationLoop } from '../useEngine';
import { useWorldStore } from '../../store/useWorldStore';
import { useSimulationStore } from '../../store/useSimulationStore';
import type { WorldState } from '../../types/world';

function makeState(): WorldState {
  return {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick: 0, tiles: [], civilizations: new Map(), wars: [], chronicle: [], diplomacyMatrix: new Map(),
  };
}

beforeEach(() => {
  useWorldStore.setState({ worldState: null, isGenerating: false });
  useSimulationStore.setState({ paused: true, speed: 1 });
});

describe('useEngine', () => {
  it('worldEngine has tick and initialize methods', () => {
    expect(typeof worldEngine.tick).toBe('function');
    expect(typeof worldEngine.initialize).toBe('function');
  });

  it('onTick listener pushes state into worldStore', () => {
    worldEngine.initialize(makeState());
    worldEngine.tick();
    expect(useWorldStore.getState().worldState?.tick).toBe(1);
  });

  it('simulationLoop does not call engine.tick() when paused=true', () => {
    worldEngine.initialize(makeState());
    useSimulationStore.setState({ paused: true, speed: 1 });
    simulationLoop._stepForTesting(1100); // > 1000ms tick interval at speed=1
    expect(worldEngine.getState()?.tick).toBe(0);
  });

  it('simulationLoop calls engine.tick() when paused=false', () => {
    worldEngine.initialize(makeState());
    useSimulationStore.setState({ paused: false, speed: 1 });
    simulationLoop._stepForTesting(1100);
    expect(worldEngine.getState()?.tick).toBe(1);
  });
});
