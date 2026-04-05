import type { LayerType } from '../../types/simulation';

export interface LayerState {
  terrain: boolean;
  biome: boolean;
  rivers: boolean;
  climate: boolean;
  political: boolean;
  religion: boolean;
  culture: boolean;
}

export const DEFAULT_LAYER_STATE: LayerState = {
  terrain: true,
  biome: true,
  rivers: true,
  climate: false,
  political: false,
  religion: false,
  culture: false,
};

export class LayerManager {
  private state: LayerState = { ...DEFAULT_LAYER_STATE };

  toggle(layer: LayerType): void {
    this.state[layer] = !this.state[layer];
  }

  setEnabled(layer: LayerType, enabled: boolean): void {
    this.state[layer] = enabled;
  }

  isEnabled(layer: LayerType): boolean {
    return this.state[layer];
  }

  getState(): Readonly<LayerState> {
    return this.state;
  }
}
