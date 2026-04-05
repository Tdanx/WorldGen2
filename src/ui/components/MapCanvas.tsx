import React, { useEffect, useRef } from 'react';
import { MapRenderer } from '../../renderer/MapRenderer';
import { mapRenderer, setMapRenderer } from '../../renderer/instance';
import { useWorldStore } from '../../store/useWorldStore';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useCanvasInput } from '../../hooks/useCanvasInput';
import { worldEngine } from '../../hooks/useEngine';
import { useGodStore } from '../../store/useGodStore';
import type { LayerType } from '../../types/simulation';

export function MapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isGenerating = useWorldStore(s => s.isGenerating);
  const worldState = useWorldStore(s => s.worldState);
  const layers = useSimulationStore(s => s.layers);
  const activeTool = useGodStore(s => s.activeTool);

  useCanvasInput(canvasRef);

  // Subscribe to disaster events and forward to the renderer for visual markers
  useEffect(() => {
    return worldEngine.bus.on('disaster:fired', ({ disasterType, epicenter }) => {
      mapRenderer?.addEventMarker(epicenter, disasterType);
    });
  }, []);

  // Subscribe to terrain:modified — rebake WebGL geometry so painted tiles are visible
  useEffect(() => {
    return worldEngine.bus.on('terrain:modified', () => {
      const state = worldEngine.getState();
      if (state) mapRenderer?.rebakeTerrainElevation(state);
    });
  }, []);

  useEffect(() => {
    if (worldState) mapRenderer?.render(worldState);
  }, [worldState]);

  // Sync layer toggles to the renderer's LayerManager and re-render
  useEffect(() => {
    if (!mapRenderer) return;
    (Object.keys(layers) as LayerType[]).forEach(key => {
      mapRenderer.layers.setEnabled(key, layers[key]);
    });
    mapRenderer.render();
  }, [layers]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new MapRenderer(canvasRef.current);
    // Sync layer state at creation time via getState() to avoid timing race
    // (the `layers` effect above fires before this effect, when mapRenderer is still null)
    const initialLayers = useSimulationStore.getState().layers;
    (Object.keys(initialLayers) as LayerType[]).forEach(key => {
      renderer.layers.setEnabled(key, initialLayers[key]);
    });
    setMapRenderer(renderer);

    // Keep overlay layers in sync when the canvas container resizes (e.g. DevTools, sidebar)
    const resizeObserver = new ResizeObserver(() => {
      renderer.render();
    });
    resizeObserver.observe(canvasRef.current);

    return () => {
      resizeObserver.disconnect();
      renderer.dispose();
      setMapRenderer(null);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {isGenerating && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16,
          color: 'var(--accent)', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em',
        }}>
          <div className="generating-spinner" />
          Generating world…
        </div>
      )}
      {activeTool && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.72)',
          color: 'var(--accent)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          padding: '6px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          pointerEvents: 'none',
        }}>
          <span>{activeTool === 'raise' ? '▲ RAISE MODE' : '▼ LOWER MODE'} — click or drag map to paint</span>
          <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>ESC to cancel</span>
        </div>
      )}
    </div>
  );
}
