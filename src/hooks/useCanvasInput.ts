import { useEffect } from 'react';
import type React from 'react';
import { mapRenderer } from '../renderer/instance';
import { useSelectionStore } from '../store/useSelectionStore';
import { useGodStore } from '../store/useGodStore';
import { worldEngine } from './useEngine';

/**
 * Attaches mouse listeners to the map canvas.
 *
 * - Click (no drag): selects tile, or paints terrain if a god tool is active.
 * - Click-and-drag: paints terrain continuously across tiles while mouse is held.
 * - ESC: cancels the active god tool.
 * - Cursor: changes to crosshair when a god tool is armed.
 *
 * Drag detection: tracks total pixel movement between mousedown and mouseup.
 * If movement exceeds DRAG_THRESHOLD pixels the event is treated as a pan/paint, not a selection.
 */

const DRAG_THRESHOLD = 5; // pixels

export function useCanvasInput(canvasRef: React.RefObject<HTMLCanvasElement | null>): void {
  // Cursor feedback — subscribe to god store outside the main effect so it
  // reacts to tool changes without re-attaching all mouse listeners.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const apply = (activeTool: string | null) => {
      canvas.style.cursor = activeTool ? 'crosshair' : 'default';
    };
    apply(useGodStore.getState().activeTool);

    const unsub = useGodStore.subscribe(s => apply(s.activeTool));
    return () => {
      unsub();
      canvas.style.cursor = 'default';
    };
  }, [canvasRef]);

  // Mouse interaction — click-select, drag-paint, ESC cancel.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let downX = 0;
    let downY = 0;
    let isDrag = false;
    let isMouseDown = false;
    let lastPaintedTile: number | null = null;

    function paintTile(clientX: number, clientY: number) {
      if (!mapRenderer) return;
      const activeTool = useGodStore.getState().activeTool;
      if (!activeTool) return;
      const rect = canvas!.getBoundingClientRect();
      const tileIndex = mapRenderer.screenToTile(clientX - rect.left, clientY - rect.top);
      if (tileIndex === null || tileIndex === lastPaintedTile) return;
      lastPaintedTile = tileIndex;
      if (activeTool === 'raise') {
        worldEngine.queueCommand({ type: 'RAISE_TERRAIN', tiles: [tileIndex], amount: 0.1 });
        worldEngine.flushCommands();
      } else if (activeTool === 'lower') {
        worldEngine.queueCommand({ type: 'LOWER_TERRAIN', tiles: [tileIndex], amount: 0.1 });
        worldEngine.flushCommands();
      }
    }

    function onMouseDown(e: MouseEvent) {
      downX = e.clientX;
      downY = e.clientY;
      isDrag = false;
      isMouseDown = true;
      lastPaintedTile = null;
    }

    function onMouseMove(e: MouseEvent) {
      if (
        Math.abs(e.clientX - downX) > DRAG_THRESHOLD ||
        Math.abs(e.clientY - downY) > DRAG_THRESHOLD
      ) {
        isDrag = true;
      }
      if (isMouseDown) paintTile(e.clientX, e.clientY);
    }

    function onMouseUp() {
      isMouseDown = false;
      lastPaintedTile = null;
    }

    function onClick(e: MouseEvent) {
      if (isDrag) return;
      if (!mapRenderer) return;

      const rect = canvas!.getBoundingClientRect();
      const tileIndex = mapRenderer.screenToTile(e.clientX - rect.left, e.clientY - rect.top);
      if (tileIndex === null) return;

      const activeTool = useGodStore.getState().activeTool;
      if (activeTool) {
        // Single click paint (drag paint handled in onMouseMove)
        paintTile(e.clientX, e.clientY);
      } else {
        useSelectionStore.getState().setSelectedTile(tileIndex);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        useGodStore.getState().setActiveTool(null);
      }
    }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [canvasRef]);
}
