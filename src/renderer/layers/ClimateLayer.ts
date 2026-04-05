/**
 * ClimateLayer — canvas 2D temperature heatmap overlay.
 *
 * Renders each solid Voronoi region as a colored polygon based on
 * the tile's current temperature value (-1 to +1):
 *
 *   -1.0  →  deep blue    (polar)
 *    0.0  →  teal/green   (temperate)
 *   +1.0  →  deep red     (tropical/hot)
 *
 * Alpha is 55% so the underlying terrain shading remains visible.
 * Ocean tiles are skipped — water biomes have inherent visual cues.
 *
 * Uses the same canvas overlay + worldToScreen pattern as PoliticalLayer.
 */

import { worldToScreen } from './PoliticalLayer';
import type { Mesh } from '../../engine/terrain/mapgen4/types.d.ts';
import type { WorldState } from '../../types/world';

const OVERLAY_ALPHA = 0.55;

/**
 * Map temperature (-1..1) to an HSL color string.
 *
 *  cold  (-1)  →  hue 240 (blue)
 *  cool  (-0.3)→  hue 180 (cyan)
 *  mild  ( 0)  →  hue 120 (green)
 *  warm  (+0.5)→  hue  60 (yellow)
 *  hot   (+1)  →  hue   0 (red)
 */
function temperatureToHSL(temperature: number): string {
  // Map [-1, 1] → [240, 0] degrees of hue (blue → red)
  const hue = 120 - temperature * 120; // -1→240 … 0→120 … +1→0
  // Saturation and lightness tweak for visual clarity
  const sat = 70;
  const lit = temperature < 0 ? 40 + temperature * -10 : 45;
  return `hsla(${hue.toFixed(0)},${sat}%,${lit.toFixed(0)}%,${OVERLAY_ALPHA})`;
}

export class ClimateLayer {
  constructor(
    private readonly mesh: Mesh,
    private readonly overlay: HTMLCanvasElement,
    private readonly webglCanvas: HTMLCanvasElement,
  ) {}

  render(
    state: WorldState | null,
    enabled: boolean,
    camX: number,
    camY: number,
    camZoom: number,
  ): void {
    // Sync overlay resolution to WebGL canvas display size
    const w = this.webglCanvas.clientWidth;
    const h = this.webglCanvas.clientHeight;
    if (this.overlay.width !== w || this.overlay.height !== h) {
      this.overlay.width  = w;
      this.overlay.height = h;
    }

    const ctx = this.overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    if (!enabled || !state) return;

    const cW = this.overlay.width;
    const cH = this.overlay.height;

    for (const tile of state.tiles) {
      // Skip ocean — water already carries implicit color cues in the WebGL pass
      if (tile.isWater) continue;

      const triangles = this.mesh.t_around_r(tile.index);
      const pts: [number, number][] = [];
      for (const t of triangles) {
        const tx = this.mesh.x_of_t(t);
        const ty = this.mesh.y_of_t(t);
        if (!isFinite(tx) || !isFinite(ty)) continue;
        pts.push(worldToScreen(tx, ty, cW, cH, camX, camY, camZoom));
      }
      if (pts.length < 3) continue;

      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = temperatureToHSL(tile.temperature);
      ctx.fill();
    }
  }
}
