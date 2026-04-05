import React from 'react';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { useWorldStore } from '../../../store/useWorldStore';

export function InfoTab() {
  const selectedTile = useSelectionStore(s => s.selectedTile);
  const worldState = useWorldStore(s => s.worldState);

  if (!worldState) {
    return <Placeholder>No world generated yet.</Placeholder>;
  }
  if (selectedTile === null) {
    return <Placeholder>Click a tile on the map to inspect it.</Placeholder>;
  }

  const tile = worldState.tiles[selectedTile];
  if (!tile) return null;

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 4 }}>
        TILE #{selectedTile}
      </div>
      <Row label="Biome"     value={tile.biome} />
      <Row label="Elevation" value={`${(tile.elevation * 100).toFixed(1)}%`} />
      <Row label="Moisture"  value={`${(tile.moisture  * 100).toFixed(1)}%`} />
      <Row label="Temp"      value={`${(tile.temperature * 100).toFixed(1)}%`} />
      <Row label="Water"     value={tile.isWater ? 'Yes' : 'No'} />
      <Row label="River"     value={tile.isRiver ? 'Yes' : 'No'} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 16, color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}
