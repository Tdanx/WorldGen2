import React from 'react';
import { useWorldStore } from '../../../store/useWorldStore';
import { useSelectionStore } from '../../../store/useSelectionStore';

export function CivsTab() {
  const worldState = useWorldStore(s => s.worldState);
  const { selectedCiv, setSelectedCiv } = useSelectionStore();

  const civs = worldState ? [...worldState.civilizations.values()] : [];

  if (civs.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.5 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>
          CIVILIZATIONS
        </div>
        <span>No civilizations yet.</span>
      </div>
    );
  }

  const selected = selectedCiv ? worldState!.civilizations.get(selectedCiv) : null;

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 6 }}>
        CIVILIZATIONS ({civs.length})
      </div>

      {civs.map(civ => (
        <div
          key={civ.id}
          onClick={() => setSelectedCiv(civ.id === selectedCiv ? null : civ.id)}
          style={{
            cursor: 'pointer',
            borderLeft: `3px solid ${civ.color}`,
            padding: '5px 8px',
            borderRadius: '0 4px 4px 0',
            background: civ.id === selectedCiv ? 'var(--border)' : 'transparent',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{civ.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {civ.population.toLocaleString()} pop · {civ.era} Age · {civ.territory.length} tiles
          </div>
        </div>
      ))}

      {selected && (
        <div style={{ marginTop: 8, padding: 8, background: 'var(--border)', borderRadius: 4, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{selected.name}</div>
          <div>Era: {selected.era} (Tech {selected.techLevel})</div>
          <div>Population: {selected.population.toLocaleString()}</div>
          <div>Territory: {selected.territory.length} tiles</div>
          <div>Founded: Year {selected.foundedTick}</div>
        </div>
      )}
    </div>
  );
}
