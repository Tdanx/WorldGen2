import React, { useState } from 'react';
import { InfoTab } from './tabs/InfoTab';
import { CivsTab } from './tabs/CivsTab';
import { GodTab } from './tabs/GodTab';
import { HistoryTab } from './tabs/HistoryTab';

const TABS = ['Info', 'Civs', 'God', 'History'] as const;
type TabName = typeof TABS[number];

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<TabName>('Info');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.06em', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-dim)',
              cursor: 'pointer', transition: 'color 0.15s',
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'Info'    && <InfoTab />}
        {activeTab === 'Civs'   && <CivsTab />}
        {activeTab === 'God'    && <GodTab />}
        {activeTab === 'History' && <HistoryTab />}
      </div>
    </div>
  );
}
