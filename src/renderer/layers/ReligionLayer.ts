import type { Mesh } from '../../engine/terrain/mapgen4/types.d.ts';
import type { WorldState } from '../../types/world';
import { ReligionRegistry } from '../../registries/ReligionRegistry';
import { worldToScreen } from './PoliticalLayer';

export class ReligionLayer {
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
      this.overlay.width  = w;
      this.overlay.height = h;
    }

    const ctx = this.overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    if (!enabled || !state) return;

    // Build religionId → fill color (#RRGGBB99 = 60% alpha)
    const colorMap = new Map<string, string>();
    for (const faith of ReligionRegistry.getActive()) {
      colorMap.set(faith.id, faith.color + '99');
    }
    if (colorMap.size === 0) return;

    const cW = this.overlay.width;
    const cH = this.overlay.height;

    for (const tile of state.tiles) {
      if (!tile.religionId) continue;
      const fillColor = colorMap.get(tile.religionId);
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
