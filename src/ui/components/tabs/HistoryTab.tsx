import React from 'react';
import { useWorldStore } from '../../../store/useWorldStore';

export function HistoryTab() {
  const worldState = useWorldStore(s => s.worldState);

  if (!worldState || worldState.chronicle.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.5 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>CHRONICLE</div>
        <span>No events recorded yet.</span>
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 4 }}>
        CHRONICLE
      </div>
      {[...worldState.chronicle].reverse().map((entry, i) => (
        <div key={i} style={{ fontSize: 11, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          <span style={{ color: 'var(--accent)', marginRight: 6 }}>Year {entry.tick}</span>
          <span>{entry.description}</span>
        </div>
      ))}
    </div>
  );
}
