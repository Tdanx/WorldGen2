import React from 'react';
import './AppShell.css';

interface AppShellProps {
  topBar: React.ReactNode;
  sidebar: React.ReactNode;
  canvas: React.ReactNode;
  rightPanel: React.ReactNode;
  timeBar: React.ReactNode;
}

export function AppShell({ topBar, sidebar, canvas, rightPanel, timeBar }: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-topbar">{topBar}</div>
      <div className="app-sidebar">{sidebar}</div>
      <div className="app-canvas">{canvas}</div>
      <div className="app-right-panel">{rightPanel}</div>
      <div className="app-timebar">{timeBar}</div>
    </div>
  );
}
