import type { MapRenderer } from './MapRenderer';

export let mapRenderer: MapRenderer | null = null;

export function setMapRenderer(r: MapRenderer | null): void {
  mapRenderer = r;
  // DEBUG: expose on window so browser eval can inspect
  (window as any).__mapRenderer = r;
}
