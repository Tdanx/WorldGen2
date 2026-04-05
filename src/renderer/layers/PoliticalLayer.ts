import type { Mesh } from '../../engine/terrain/mapgen4/types.d.ts';
import type { WorldState } from '../../types/world';

/**
 * Pure world-to-screen transform.
 * World space is 0–1000 on both axes.
 * Matches the WebGL shader formula documented in Camera.ts.
 */
export function worldToScreen(
  wx: number,
  wy: number,
  canvasW: number,
  canvasH: number,
  camX: number,
  camY: number,
  camZoom: number,
): [number, number] {
  const ndcX = (wx - camX) * (camZoom / 100);
  const ndcY = -(wy - camY) * (camZoom / 100);
  return [
    (ndcX + 1) * canvasW / 2,
    (1 - ndcY) * canvasH / 2,
  ];
}

export class PoliticalLayer {
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
    // Sync overlay pixel buffer to WebGL canvas display size
    const w = this.webglCanvas.clientWidth;
    const h = this.webglCanvas.clientHeight;
    if (this.overlay.width !== w || this.overlay.height !== h) {
      this.overlay.width = w;
      this.overlay.height = h;
    }

    const ctx = this.overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    if (!enabled || !state || state.civilizations.size === 0) return;

    // Build civId → fill color lookup once per frame (#RRGGBBAA, 50% alpha)
    const colorMap = new Map<string, string>();
    for (const [id, civ] of state.civilizations) {
      colorMap.set(id, civ.color + '80');
    }

    const cW = this.overlay.width;
    const cH = this.overlay.height;

    for (const tile of state.tiles) {
      if (!tile.ownerId) continue;
      const fillColor = colorMap.get(tile.ownerId);
      if (!fillColor) continue;

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
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
  }
}
