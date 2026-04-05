/**
 * MapRenderer — wraps mapgen4's Renderer.
 *
 * Owns the WebGL canvas lifecycle. Initialized once after world generation.
 * Call render() each time the view should update (camera move, layer toggle, tick).
 */

import Renderer from '../engine/terrain/mapgen4/render';
import Geometry from '../engine/terrain/mapgen4/geometry';
import param from '../engine/terrain/mapgen4/config.js';
import type { Mesh } from '../engine/terrain/mapgen4/types.d.ts';
import type MapGen4Map from '../engine/terrain/mapgen4/map';
import type { WorldState } from '../types/world';
import type { LayerType } from '../types/simulation';
import { Camera, type RenderViewParam } from './Camera';
import { LayerManager } from './layers/LayerManager';
import { PoliticalLayer } from './layers/PoliticalLayer';
import { ReligionLayer } from './layers/ReligionLayer';
import { EventMarkerLayer } from './layers/EventMarkerLayer';
import { ClimateLayer } from './layers/ClimateLayer';

const DEFAULT_RENDER_PARAM: RenderViewParam = {
  zoom: 0.2,
  x: 500,
  y: 500,
  light_angle_deg: 315,
  slope: 2,
  flat: 1.5,
  ambient: 0.25,
  overhead: 30,
  tilt_deg: 0,
  rotate_deg: 0,
  mountain_height: 50,
  outline_depth: 1,
  outline_strength: 15,
  outline_threshold: 0.01,
  outline_coast: 1,
  outline_water: 1,
  biome_colors: 1,
};

export class MapRenderer {
  readonly camera = new Camera();
  readonly layers = new LayerManager();

  private canvas: HTMLCanvasElement;
  private renderer: Renderer | null = null;
  private mesh: Mesh | null = null;
  private map: MapGen4Map | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private religionOverlayCanvas: HTMLCanvasElement | null = null;
  private eventMarkerOverlayCanvas: HTMLCanvasElement | null = null;
  private climateOverlayCanvas: HTMLCanvasElement | null = null;
  private politicalLayer: PoliticalLayer | null = null;
  private religionLayer: ReligionLayer | null = null;
  private eventMarkerLayer: EventMarkerLayer | null = null;
  private climateLayer: ClimateLayer | null = null;
  private currentState: WorldState | null = null;

  // Stored so they can be removed in dispose()
  private readonly _onMouseDown: (e: MouseEvent) => void;
  private readonly _onMouseMove: (e: MouseEvent) => void;
  private readonly _onMouseUp: () => void;
  private readonly _onMouseLeave: () => void;
  private readonly _onWheel: (e: WheelEvent) => void;
  private readonly _onResize: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this._onMouseDown = (e) => {
      this._isDragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    };

    this._onMouseMove = (e) => {
      if (!this._isDragging) return;
      const dx = e.clientX - this._lastX;
      const dy = e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this.camera.pan(dx, dy, canvas.clientWidth, canvas.clientHeight);
      this.render();
    };

    this._onMouseUp = () => { this._isDragging = false; };
    this._onMouseLeave = () => { this._isDragging = false; };

    this._onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const rect = canvas.getBoundingClientRect();
      this.camera.zoomBy(factor, e.clientX - rect.left, e.clientY - rect.top, canvas.clientWidth, canvas.clientHeight);
      this.render();
    };

    this._onResize = () => {
      if (this.renderer) { this.renderer.resizeCanvas(); this.render(); }
    };

    canvas.addEventListener('mousedown',  this._onMouseDown);
    canvas.addEventListener('mousemove',  this._onMouseMove);
    canvas.addEventListener('mouseup',    this._onMouseUp);
    canvas.addEventListener('mouseleave', this._onMouseLeave);
    canvas.addEventListener('wheel',      this._onWheel, { passive: false });
    window.addEventListener('resize',     this._onResize);

    const overlay = document.createElement('canvas');
    overlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;width:100%;height:100%';
    canvas.parentElement?.appendChild(overlay);
    this.overlayCanvas = overlay;

    const religionOverlay = document.createElement('canvas');
    religionOverlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;width:100%;height:100%';
    canvas.parentElement?.appendChild(religionOverlay);
    this.religionOverlayCanvas = religionOverlay;

    const eventMarkerOverlay = document.createElement('canvas');
    eventMarkerOverlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;width:100%;height:100%';
    canvas.parentElement?.appendChild(eventMarkerOverlay);
    this.eventMarkerOverlayCanvas = eventMarkerOverlay;
    this.eventMarkerLayer = new EventMarkerLayer(eventMarkerOverlay, canvas);

    const climateOverlay = document.createElement('canvas');
    climateOverlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;width:100%;height:100%';
    canvas.parentElement?.appendChild(climateOverlay);
    this.climateOverlayCanvas = climateOverlay;
  }

  private _initCount = 0;

  /** Call once after TerrainGenerator.generate() returns. */
  initialize(mesh: Mesh, map: MapGen4Map): void {
    this._initCount++;
    const initId = this._initCount;
    console.log(`[MapRenderer.initialize #${initId}] start`);

    this.mesh = mesh;
    this.map = map;
    this.renderer = new Renderer(mesh, this.canvas);
    console.log(`[MapRenderer.initialize #${initId}] Renderer created`);

    const mountain_folds = (param.elevation as Record<string, number>).mountain_folds ?? 3;
    Geometry.setMapGeometry(map, mountain_folds, this.renderer.quad_elements, this.renderer.a_quad_em);
    const riversRenderParam = {
      lg_min_flow:    (param.rivers as Record<string, number>).lg_min_flow    ?? -2.7,
      lg_river_width: (param.rivers as Record<string, number>).lg_river_width ?? -2.7,
    };
    const numRiverTriangles = Geometry.setRiverGeometry(map, param.spacing, riversRenderParam, this.renderer.a_river_xyww);
    this.renderer.numRiverTriangles = numRiverTriangles;
    this.renderer.updateMap();
    console.log(`[MapRenderer.initialize #${initId}] updateMap done, calling render`);
    this.render();
    if (this.overlayCanvas) {
      this.politicalLayer = new PoliticalLayer(this.mesh!, this.overlayCanvas, this.canvas);
    }
    if (this.religionOverlayCanvas) {
      this.religionLayer = new ReligionLayer(this.mesh!, this.religionOverlayCanvas, this.canvas);
    }
    if (this.climateOverlayCanvas) {
      this.climateLayer = new ClimateLayer(this.mesh!, this.climateOverlayCanvas, this.canvas);
    }
    console.log(`[MapRenderer.initialize #${initId}] render called, renderParam set`);
  }

  /** Trigger a redraw with current camera state. */
  render(state?: WorldState, _activeLayer?: LayerType): void {
    if (!this.renderer) return;
    if (state !== undefined) this.currentState = state;
    this.renderer.updateView(this.camera.toRenderParam(DEFAULT_RENDER_PARAM));
    this.politicalLayer?.render(
      this.currentState,
      this.layers.isEnabled('political'),
      this.camera.x,
      this.camera.y,
      this.camera.zoom,
    );
    this.religionLayer?.render(
      this.currentState,
      this.layers.isEnabled('religion'),
      this.camera.x,
      this.camera.y,
      this.camera.zoom,
    );
    this.eventMarkerLayer?.render(
      this.currentState,
      this.camera.x,
      this.camera.y,
      this.camera.zoom,
    );
    this.climateLayer?.render(
      this.currentState,
      this.layers.isEnabled('climate'),
      this.camera.x,
      this.camera.y,
      this.camera.zoom,
    );
  }

  /** Called by MapCanvas when a disaster fires — adds a temporary visual marker. */
  addEventMarker(tileIndex: number, disasterType: string): void {
    this.eventMarkerLayer?.addMarker(tileIndex, disasterType);
  }

  /**
   * Sync WorldState tile elevations back into the mapgen4 map arrays and
   * re-bake the WebGL geometry. Call after RAISE_TERRAIN / LOWER_TERRAIN /
   * SET_BIOME commands so the visual terrain updates immediately.
   */
  rebakeTerrainElevation(state: WorldState): void {
    if (!this.renderer || !this.mesh || !this.map) return;

    // 1. Sync per-region elevation from tile data
    for (const tile of state.tiles) {
      this.map.elevation_r[tile.index] = tile.elevation;
    }

    // 2. Recompute per-triangle elevation as the average of its 3 corner regions
    for (let t = 0; t < this.mesh.numTriangles; t++) {
      const regions = this.mesh.r_around_t(t);
      let sum = 0;
      for (const r of regions) sum += this.map.elevation_r[r];
      this.map.elevation_t[t] = sum / regions.length;
    }

    // 3. Rebake GPU geometry and re-render
    const mountain_folds = (param.elevation as Record<string, number>).mountain_folds ?? 3;
    Geometry.setMapGeometry(this.map, mountain_folds, this.renderer.quad_elements, this.renderer.a_quad_em);
    this.renderer.updateMap();
    this.render(state);
  }

  /** Convert screen pixel coords to nearest tile (region) index. */
  screenToTile(screenX: number, screenY: number): number | null {
    if (!this.renderer || !this.mesh) return null;
    const [wx, wy] = this.renderer.screenToWorld([screenX, screenY]);
    return this.findNearestRegion(wx, wy);
  }

  private findNearestRegion(wx: number, wy: number): number | null {
    if (!this.mesh) return null;
    let bestR = -1;
    let bestDist = Infinity;
    for (let r = 0; r < this.mesh.numSolidRegions; r++) {
      const dx = this.mesh.x_of_r(r) - wx;
      const dy = this.mesh.y_of_r(r) - wy;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) { bestDist = dist; bestR = r; }
    }
    return bestR >= 0 ? bestR : null;
  }

  private _isDragging = false;
  private _lastX = 0;
  private _lastY = 0;

  dispose(): void {
    this.canvas.removeEventListener('mousedown',  this._onMouseDown);
    this.canvas.removeEventListener('mousemove',  this._onMouseMove);
    this.canvas.removeEventListener('mouseup',    this._onMouseUp);
    this.canvas.removeEventListener('mouseleave', this._onMouseLeave);
    this.canvas.removeEventListener('wheel',      this._onWheel);
    window.removeEventListener('resize',          this._onResize);
    if (this.overlayCanvas?.parentElement) {
      this.overlayCanvas.parentElement.removeChild(this.overlayCanvas);
    }
    if (this.religionOverlayCanvas?.parentElement) {
      this.religionOverlayCanvas.parentElement.removeChild(this.religionOverlayCanvas);
    }
    if (this.eventMarkerOverlayCanvas?.parentElement) {
      this.eventMarkerOverlayCanvas.parentElement.removeChild(this.eventMarkerOverlayCanvas);
    }
    if (this.climateOverlayCanvas?.parentElement) {
      this.climateOverlayCanvas.parentElement.removeChild(this.climateOverlayCanvas);
    }
    this.overlayCanvas = null;
    this.religionOverlayCanvas = null;
    this.eventMarkerOverlayCanvas = null;
    this.climateOverlayCanvas = null;
    this.politicalLayer = null;
    this.religionLayer = null;
    this.eventMarkerLayer = null;
    this.climateLayer = null;
    this.renderer = null;
    this.mesh = null;
  }
}
