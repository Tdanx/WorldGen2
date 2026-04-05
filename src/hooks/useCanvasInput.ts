import { useEffect } from 'react';
import type React from 'react';
import { mapRenderer } from '../renderer/instance';
import { useSelectionStore } from '../store/useSelectionStore';
import { useGodStore } from '../store/useGodStore';
import { worldEngine } from './useEngine';

/**
 * Attaches a click listener to the map canvas.
 * On click (not drag), finds the nearest tile under the cursor
 * and writes it to useSelectionStore.
 *
 * Drag detection: tracks total pixel movement between mousedown and mouseup.
 * If movement exceeds DRAG_THRESHOLD pixels the click is treated as a pan, not a selection.
 */

const DRAG_THRESHOLD = 5; // pixels

export function useCanvasInput(canvasRef: React.RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let downX = 0;
    let downY = 0;
    let isDrag = false;

    function onMouseDown(e: MouseEvent) {
      downX = e.clientX;
      downY = e.clientY;
      isDrag = false;
    }

    function onMouseMove(e: MouseEvent) {
      if (
        Math.abs(e.clientX - downX) > DRAG_THRESHOLD ||
        Math.abs(e.clientY - downY) > DRAG_THRESHOLD
      ) {
        isDrag = true;
      }
    }

    function onClick(e: MouseEvent) {
      if (isDrag) return;
      if (!mapRenderer) return;

      const rect = canvas.getBoundingClientRect();
      const tileIndex = mapRenderer.screenToTile(e.clientX - rect.left, e.clientY - rect.top);
      if (tileIndex === null) return;

      // If a terrain tool is active, apply it; otherwise select the tile.
      const activeTool = useGodStore.getState().activeTool;
      if (activeTool === 'raise') {
        worldEngine.queueCommand({ type: 'RAISE_TERRAIN', tiles: [tileIndex], amount: 0.1 });
        worldEngine.flushCommands();
      } else if (activeTool === 'lower') {
        worldEngine.queueCommand({ type: 'LOWER_TERRAIN', tiles: [tileIndex], amount: 0.1 });
        worldEngine.flushCommands();
      } else {
        useSelectionStore.getState().setSelectedTile(tileIndex);
      }
    }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
    };
  }, [canvasRef]);
}
