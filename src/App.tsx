import React, { useState, useEffect } from 'react';
import { AppShell } from './ui/layout/AppShell';
import { TopBar } from './ui/components/TopBar';
import { LayerSidebar } from './ui/components/LayerSidebar';
import { MapCanvas } from './ui/components/MapCanvas';
import { TimeBar } from './ui/components/TimeBar';
import { RightPanel } from './ui/components/RightPanel';
import { WorldGenWizard } from './ui/components/WorldGenWizard';
import { useWorldStore } from './store/useWorldStore';
import { useSimulationStore } from './store/useSimulationStore';
import { TerrainGenerator } from './engine/terrain/TerrainGenerator';
import { spawnCivilizations } from './engine/civilization/CivSpawner';
import { mapRenderer } from './renderer/instance';
import { useEngine, simulationLoop, worldEngine } from './hooks/useEngine';
import type { WorldConfig } from './types/world';
import { parseSave, saveWorld, applyLoadedState } from './utils/serialization';

// TerrainGenerator is stateless — one instance is fine
const terrainGen = new TerrainGenerator();

export default function App() {
  const [showWizard, setShowWizard] = useState(true);
  const { setWorldState, setGenerating } = useWorldStore();
  const { layers, toggleLayer } = useSimulationStore();

  useEngine(); // ensure engine singleton is initialized
  useEffect(() => {
    simulationLoop.start();
    return () => simulationLoop.stop();
  }, []);

  async function handleLoad(): Promise<boolean> {
    const data = parseSave();
    if (!data) return false;
    setShowWizard(false);
    setGenerating(true);
    try {
      // Regenerate terrain mesh from the saved config (deterministic — same seed)
      const result = await terrainGen.generate(data.state.config);
      // Restore engine + registries, then initialize the renderer with the fresh mesh
      applyLoadedState(data);
      setWorldState(data.state);
      mapRenderer?.initialize(result.mesh, result.map);
      mapRenderer?.render(data.state);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setGenerating(false);
    }
    return true;
  }

  async function handleGenerate(config: WorldConfig) {
    setShowWizard(false);
    setGenerating(true);
    try {
      const result = await terrainGen.generate(config);
      const { civilizations, tiles } = spawnCivilizations(result.tiles, config.seed);
      const worldState = {
        config,
        tick: 0,
        tiles,
        civilizations,
        wars: [],
        chronicle: [],
        diplomacyMatrix: new Map(),
      };
      setWorldState(worldState);
      worldEngine.initialize(worldState);
      mapRenderer?.initialize(result.mesh, result.map);
      mapRenderer?.render(worldState);
    } catch (err) {
      console.error('Generation error:', err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <AppShell
        topBar={<TopBar onNew={() => setShowWizard(true)} onSave={saveWorld} onLoad={handleLoad} />}
        sidebar={<LayerSidebar layers={layers} onToggle={toggleLayer} />}
        canvas={<MapCanvas />}
        rightPanel={<RightPanel />}
        timeBar={<TimeBar />}
      />
      {showWizard && <WorldGenWizard onGenerate={handleGenerate} />}
    </>
  );
}
