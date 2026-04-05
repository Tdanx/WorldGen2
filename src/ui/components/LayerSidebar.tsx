import React, { useMemo } from 'react';
import type { LayerType } from '../../types/simulation';
import type { LayerState } from '../../renderer/layers/LayerManager';
import { worldEngine } from '../../hooks/useEngine';
import { useWorldStore } from '../../store/useWorldStore';

interface LayerEntry {
  key: LayerType;
  label: string;
}

const OVERLAY_LAYERS: LayerEntry[] = [
  { key: 'climate',   label: 'Climate'       },
  { key: 'political', label: 'Political'      },
  { key: 'religion',  label: 'Religion'       },
  { key: 'events',    label: 'Event Markers'  },
];

const LAYER_TOOLTIPS: Partial<Record<LayerType, string>> = {
  climate:   'Temperature heatmap overlaid on terrain',
  political: 'Civilization territory boundaries — visible once civilizations exist',
  religion:  'Active faith spread across tiles — visible once religions exist',
  events:    'Disaster and event icons that appear on the map',
};

interface LayerSidebarProps {
  layers: LayerState;
  onToggle: (layer: LayerType) => void;
}

export function LayerSidebar({ layers, onToggle }: LayerSidebarProps) {
  const [tectonics, setTectonics] = React.useState(true);
  const [erosion, setErosion]     = React.useState(true);
  const worldState = useWorldStore(s => s.worldState);
  const hasWorld   = worldState !== null;
  const hasCivs    = (worldState?.civilizations.size ?? 0) > 0;
  const hasFaiths  = useMemo(
    () => worldState?.tiles.some(t => t.religionId !== null) ?? false,
    [worldState],
  );

  function handleTectonics(enabled: boolean) {
    setTectonics(enabled);
    worldEngine.setTectonicsEnabled(enabled);
  }

  function handleErosion(enabled: boolean) {
    setErosion(enabled);
    worldEngine.setErosionEnabled(enabled);
  }

  return (
    <div style={{ padding: '12px 8px' }}>

      {/* BASE section — always-on WebGL layers */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 8 }}>
        BASE
      </div>
      <div
        title="Terrain mesh, biome colors, and river geometry — always rendered"
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', opacity: 0.5 }}
      >
        <span style={{ fontSize: 11 }}>&#x2588;</span>
        <span style={{ flex: 1, fontSize: 13 }}>Terrain, Biomes, Rivers</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>always on</span>
      </div>

      {/* OVERLAYS section — togglable canvas layers */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', marginTop: 14, marginBottom: 8 }}>
        OVERLAYS
      </div>
      {OVERLAY_LAYERS.map(({ key, label }) => (
        <label
          key={key}
          title={LAYER_TOOLTIPS[key]}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 4px', cursor: 'pointer', borderRadius: 4,
          }}
        >
          <input
            type="checkbox"
            checked={layers[key]}
            onChange={() => onToggle(key)}
            style={{ accentColor: 'var(--accent)' }}
          />
          <span style={{ flex: 1 }}>{label}</span>
          {key === 'political' && layers.political && !hasCivs && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>no civs yet</span>
          )}
          {key === 'religion' && layers.religion && !hasFaiths && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>no faiths yet</span>
          )}
        </label>
      ))}

      {/* GEOLOGY section — simulation toggles */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', marginTop: 16, marginBottom: 8 }}>
        GEOLOGY
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: hasWorld ? 'pointer' : 'not-allowed', opacity: hasWorld ? 1 : 0.45, borderRadius: 4 }}>
        <input
          type="checkbox"
          checked={tectonics}
          disabled={!hasWorld}
          onChange={e => handleTectonics(e.target.checked)}
          style={{ accentColor: 'var(--accent)' }}
        />
        <span style={{ flex: 1 }}>Tectonics</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: hasWorld ? 'pointer' : 'not-allowed', opacity: hasWorld ? 1 : 0.45, borderRadius: 4 }}>
        <input
          type="checkbox"
          checked={erosion}
          disabled={!hasWorld}
          onChange={e => handleErosion(e.target.checked)}
          style={{ accentColor: 'var(--accent)' }}
        />
        <span style={{ flex: 1 }}>Erosion</span>
      </label>
    </div>
  );
}
