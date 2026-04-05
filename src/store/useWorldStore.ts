import { create } from 'zustand';
import type { WorldState } from '../types/world';

interface WorldStore {
  worldState: WorldState | null;
  isGenerating: boolean;
  setWorldState: (s: WorldState) => void;
  setGenerating: (b: boolean) => void;
}

export const useWorldStore = create<WorldStore>((set) => ({
  worldState: null,
  isGenerating: false,
  setWorldState: (worldState) => set({ worldState }),
  setGenerating: (isGenerating) => set({ isGenerating }),
}));
