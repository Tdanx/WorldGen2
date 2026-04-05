import type { WorldState } from '../../types/world';
import { worldToScreen } from './PoliticalLayer';

const MARKER_TTL = 120;  // frames a marker stays visible (~2s at 60fps)

const DISASTER_STYLE: Record<string, { color: string; label: string }> = {
  VOLCANIC_ERUPTION: { color: '#ff4400', label: '🌋' },
  METEOR_IMPACT:     { color: '#ff9900', label: '☄' },
  FLOOD:             { color: '#2299ff', label: '🌊' },
  DROUGHT:           { color: '#cc8800', label: '☀' },
};

interface EventMarker {
  tileIndex: number;
  disasterType: string;
  age: number;  // frames since spawned
}

export class EventMarkerLayer {
  private markers: EventMarker[] = [];

  constructor(
    private readonly overlay: HTMLCanvasElement,
    private readonly webglCanvas: HTMLCanvasElement,
  ) {}

  addMarker(tileIndex: number, disasterType: string): void {
    // Replace an existing marker at the same tile rather than stacking
    const existing = this.markers.findIndex(m => m.tileIndex === tileIndex);
    if (existing >= 0) {
      this.markers[existing] = { tileIndex, disasterType, age: 0 };
    } else {
      this.markers.push({ tileIndex, disasterType, age: 0 });
    }
  }

  render(
    state: WorldState | null,
    camX: number,
    camY: number,
    camZoom: number,
    enabled = true,
  ): void {
    // Sync overlay to canvas display size
    const w = this.webglCanvas.clientWidth;
    const h = this.webglCanvas.clientHeight;
    if (this.overlay.width !== w || this.overlay.height !== h) {
      this.overlay.width = w;
      this.overlay.height = h;
    }

    const ctx = this.overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    if (!enabled || !state || this.markers.length === 0) {
      this.ageMarkers();
      return;
    }

    for (const marker of this.markers) {
      const tile = state.tiles[marker.tileIndex];
      if (!tile) continue;

      const alpha = 1 - marker.age / MARKER_TTL;
      const style = DISASTER_STYLE[marker.disasterType] ?? { color: '#ffffff', label: '!' };
      const [sx, sy] = worldToScreen(tile.x, tile.y, w, h, camX, camY, camZoom);

      // Expanding ring that fades out
      const ringRadius = 8 + marker.age * 0.4;
      ctx.beginPath();
      ctx.arc(sx, sy, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = style.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = 2;
      ctx.stroke();

      // Icon — only while fresh (first half of TTL)
      if (marker.age < MARKER_TTL * 0.5) {
        ctx.globalAlpha = alpha * 2;  // fade faster
        ctx.font = '14px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(style.label, sx, sy - 18);
        ctx.globalAlpha = 1;
      }
    }

    this.ageMarkers();
  }

  private ageMarkers(): void {
    for (const m of this.markers) m.age++;
    this.markers = this.markers.filter(m => m.age < MARKER_TTL);
  }
}
