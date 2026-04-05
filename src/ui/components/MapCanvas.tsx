import React, { useEffect, useRef } from 'react';
import { MapRenderer } from '../../renderer/MapRenderer';
import { mapRenderer, setMapRenderer } from '../../renderer/instance';
import { useWorldStore } from '../../store/useWorldStore';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useCanvasInput } from '../../hooks/useCanvasInput';
import { worldEngine } from '../../hooks/useEngine';

export function MapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isGenerating = useWorldStore(s => s.isGenerating);
  const worldState = useWorldStore(s => s.worldState);
  const layers = useSimulationStore(s => s.layers);

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
    return () => {
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
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent)', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em',
        }}>
          Generating world...
        </div>
      )}
    </div>
  );
}
