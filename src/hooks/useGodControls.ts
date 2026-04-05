import { useGodStore, type GodToolType } from '../store/useGodStore';

/**
 * React hook for god-tool state.
 * Exposes the active tool and a toggle function (clicking an active tool deactivates it).
 */
export function useGodControls() {
  const activeTool = useGodStore(s => s.activeTool);
  const setActiveTool = useGodStore(s => s.setActiveTool);

  function toggleTool(tool: GodToolType) {
    setActiveTool(activeTool === tool ? null : tool);
  }

  function clearTool() {
    setActiveTool(null);
  }

  return { activeTool, toggleTool, clearTool };
}
