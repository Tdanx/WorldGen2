import { create } from 'zustand';
import type { LayerType } from '../types/simulation';
import type { LayerState } from '../renderer/layers/LayerManager';
import { DEFAULT_LAYER_STATE } from '../renderer/layers/LayerManager';

interface SimulationStore {
  paused: boolean;
  speed: number;          // ticks per second
  layers: LayerState;
  historyLength: number;  // snapshot count in StateHistory ring buffer
  canRewind: boolean;     // true when historyLength > 1
  setPaused: (p: boolean) => void;
  setSpeed: (s: number) => void;
  toggleLayer: (layer: LayerType) => void;
  setHistoryLength: (n: number) => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  paused: true,
  speed: 1,
  layers: { ...DEFAULT_LAYER_STATE },
  historyLength: 0,
  canRewind: false,
  setPaused: (paused) => set({ paused }),
  setSpeed: (speed) => set({ speed }),
  toggleLayer: (layer) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] },
    })),
  setHistoryLength: (historyLength) => set({ historyLength, canRewind: historyLength > 1 }),
}));
