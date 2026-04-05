import { EventBus } from '../engine/core/EventBus';
import { WorldEngine } from '../engine/core/WorldEngine';
import { SimulationLoop } from '../engine/core/SimulationLoop';
import { useSimulationStore } from '../store/useSimulationStore';
import { useWorldStore } from '../store/useWorldStore';

const bus = new EventBus();
export const worldEngine = new WorldEngine(bus);
// DEBUG: expose singleton on window for browser eval testing
if (typeof window !== 'undefined') (window as any).__worldEngine = worldEngine;
export const simulationLoop = new SimulationLoop(
  worldEngine,
  useSimulationStore.getState,
);

// Wire: every engine tick pushes new state into the React store and updates history length
worldEngine.onTick((state) => {
  useWorldStore.getState().setWorldState(state);
  useSimulationStore.getState().setHistoryLength(worldEngine.getHistory().getSnapshotCount());
});

export function useEngine(): WorldEngine {
  return worldEngine;
}
