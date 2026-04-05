import { create } from 'zustand';
import type { TileIndex } from '../types/world';
import type { CivId } from '../types/civilization';

interface SelectionStore {
  selectedTile: TileIndex | null;
  selectedCiv: CivId | null;
  setSelectedTile: (t: TileIndex | null) => void;
  setSelectedCiv: (c: CivId | null) => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  selectedTile: null,
  selectedCiv: null,
  setSelectedTile: (selectedTile) => set({ selectedTile }),
  setSelectedCiv: (selectedCiv) => set({ selectedCiv }),
}));
