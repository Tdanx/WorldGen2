import React, { useState } from 'react';
import type { LayerType } from '../../types/simulation';
import type { LayerState } from '../../renderer/layers/LayerManager';
import { worldEngine } from '../../hooks/useEngine';

interface LayerEntry {
  key: LayerType;
  label: string;
  phase?: number;
}

const LAYERS: LayerEntry[] = [
  { key: 'terrain',   label: 'Terrain'   },
  { key: 'biome',     label: 'Biomes'    },
  { key: 'rivers',    label: 'Rivers'    },
  { key: 'climate',   label: 'Climate'  },
  { key: 'political', label: 'Political' },
  { key: 'religion',  label: 'Religion' },
  { key: 'culture',   label: 'Culture',  phase: 3 },
];

interface LayerSidebarProps {
  layers: LayerState;
  onToggle: (layer: LayerType) => void;
}

export function LayerSidebar({ layers, onToggle }: LayerSidebarProps) {
  const [tectonics, setTectonics] = useState(true);
  const [erosion, setErosion]     = useState(true);

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
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 8 }}>
        LAYERS
      </div>
      {LAYERS.map(({ key, label, phase }) => (
        <label
          key={key}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 4px', cursor: phase ? 'not-allowed' : 'pointer',
            opacity: phase ? 0.45 : 1,
            borderRadius: 4,
          }}
        >
          <input
            type="checkbox"
            checked={layers[key]}
            disabled={!!phase}
            onChange={() => onToggle(key)}
            style={{ accentColor: 'var(--accent)' }}
          />
          <span style={{ flex: 1 }}>{label}</span>
          {phase && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>
              Ph{phase}
            </span>
          )}
        </label>
      ))}

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', marginTop: 16, marginBottom: 8 }}>
        GEOLOGY
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer', borderRadius: 4 }}>
        <input
          type="checkbox"
          checked={tectonics}
          onChange={e => handleTectonics(e.target.checked)}
          style={{ accentColor: 'var(--accent)' }}
        />
        <span style={{ flex: 1 }}>Tectonics</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer', borderRadius: 4 }}>
        <input
          type="checkbox"
          checked={erosion}
          onChange={e => handleErosion(e.target.checked)}
          style={{ accentColor: 'var(--accent)' }}
        />
        <span style={{ flex: 1 }}>Erosion</span>
      </label>
    </div>
  );
}
