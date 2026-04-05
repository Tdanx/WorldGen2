import { create } from 'zustand';

/** Tools that remain active across map clicks (terrain painting mode). */
export type GodToolType = 'raise' | 'lower';

interface GodStore {
  activeTool: GodToolType | null;
  setActiveTool: (tool: GodToolType | null) => void;
}

export const useGodStore = create<GodStore>((set) => ({
  activeTool: null,
  setActiveTool: (activeTool) => set({ activeTool }),
}));
