import { useState, useCallback } from 'react';

export type PanelType =
  | 'debugger'
  | 'performance'
  | 'rightPanel'
  | 'snapshots'
  | 'bookmarks'
  | 'commandPalette'
  | 'focusEdit'
  | 'search'
  | 'miniMap'
  | 'projectManager'
  | 'history';

interface PanelState {
  [key: string]: boolean;
}

const initialPanelState: PanelState = {
  debugger: false,
  performance: false,
  rightPanel: false,
  snapshots: false,
  bookmarks: false,
  commandPalette: false,
  focusEdit: false,
  search: false,
  miniMap: true,
  projectManager: false,
  history: false,
};

export const usePanelManager = () => {
  const [panels, setPanels] = useState<PanelState>({ ...initialPanelState });

  const showPanel = useCallback((panelType: PanelType) => {
    setPanels(prev => ({ ...prev, [panelType]: true }));
  }, []);

  const hidePanel = useCallback((panelType: PanelType) => {
    setPanels(prev => ({ ...prev, [panelType]: false }));
  }, []);

  const togglePanel = useCallback((panelType: PanelType) => {
    setPanels(prev => ({ ...prev, [panelType]: !prev[panelType] }));
  }, []);

  const hideAllPanels = useCallback(() => {
    setPanels({ ...initialPanelState });
  }, []);

  return {
    panels,
    showPanel,
    hidePanel,
    togglePanel,
    hideAllPanels,
  };
};
