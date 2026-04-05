/**
 * Camera — manages pan, zoom and maps to mapgen4 render params.
 *
 * mapgen4 world space is 0–1000 on both axes.
 * The render shader applies:  NDC_x = (world_x - camera.x) * (zoom/100)
 *                              NDC_y = -(world_y - camera.y) * (zoom/100)
 *
 * So to show the full 1000×1000 world (±500 units from center):
 *   (zoom/100) * 500 = 1  →  zoom = 0.2
 */

export interface RenderViewParam {
  zoom: number;
  x: number;
  y: number;
  light_angle_deg: number;
  slope: number;
  flat: number;
  ambient: number;
  overhead: number;
  tilt_deg: number;
  rotate_deg: number;
  mountain_height: number;
  outline_depth: number;
  outline_strength: number;
  outline_threshold: number;
  outline_coast: number;
  outline_water: number;
  biome_colors: number;
}

export class Camera {
  x = 500;
  y = 500;
  zoom = 0.2;   // 0.2 = full 1000×1000 world visible; larger = more zoomed in

  /**
   * Pan by screen pixel delta.
   * Formula: delta_world = 200 * delta_pixels / (canvas_size * zoom)
   */
  pan(dxPx: number, dyPx: number, canvasW: number, canvasH: number): void {
    this.x -= (200 * dxPx) / (canvasW * this.zoom);
    this.y -= (200 * dyPx) / (canvasH * this.zoom);
  }

  /**
   * Zoom toward/away from a screen-pixel pivot point.
   * Keeps the world coordinate under the pivot fixed.
   */
  zoomBy(factor: number, pivotPx: number, pivotPy: number, canvasW: number, canvasH: number): void {
    // NDC coordinates of pivot (-1 to 1)
    const ndcX =  2 * pivotPx / canvasW - 1;
    const ndcY =  1 - 2 * pivotPy / canvasH;

    // World coordinate under pivot before zoom
    const worldPx = this.x + ndcX * (100 / this.zoom);
    const worldPy = this.y - ndcY * (100 / this.zoom);

    this.zoom = Math.max(0.1, Math.min(10, this.zoom * factor));

    // Restore pivot to same screen position after zoom
    this.x = worldPx - ndcX * (100 / this.zoom);
    this.y = worldPy + ndcY * (100 / this.zoom);
  }

  toRenderParam(base: RenderViewParam): RenderViewParam {
    return { ...base, zoom: this.zoom, x: this.x, y: this.y };
  }
}
