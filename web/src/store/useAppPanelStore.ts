import { create } from 'zustand';

type SettingsTab = 'interface' | 'performance' | 'api-config' | 'llm-config' | 'shortcuts' | 'paths' | 'storage';

export type AssetLibraryTab =
  | 'all'
  | 'project'
  | 'image'
  | 'video'
  | 'audio'
  | 'character'
  | 'voice'
  | 'favorite'
  | 'recent'
  | 'trash';

interface AppPanelState {
  isFileManagerOpen: boolean;
  isCachePanelOpen: boolean;
  isSettingsOpen: boolean;
  settingsActiveTab: SettingsTab;
  isTestRunnerOpen: boolean;
  isVersionControlOpen: boolean;
  isRealtimePreviewOpen: boolean;
  isMiniMaxConfigOpen: boolean;
  isMembershipCenterOpen: boolean;
  isApiKeyManagementOpen: boolean;
  isWorkflowMarketplaceOpen: boolean;
  isWorkflowDebuggerOpen: boolean;
  isContinuousVideoOpen: boolean;
  isModelMarketplaceOpen: boolean;
  isAPIMonitorOpen: boolean;
  isSaveModalOpen: boolean;
  isLoadModalOpen: boolean;
  isBatchGenerationOpen: boolean;
  isMusicGenerationOpen: boolean;
  isAIDubbingOpen: boolean;
  isAIClipOpen: boolean;
  aiClipActiveTab?: 'suggest' | 'one-click' | 'subtitle' | 'audio' | 'transition' | 'export';
  isAssetLibraryOpen: boolean;
  assetLibraryInitialTab?: AssetLibraryTab;
  setFileManagerOpen: (open: boolean) => void;
  setCachePanelOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean, tab?: SettingsTab) => void;
  setTestRunnerOpen: (open: boolean) => void;
  setVersionControlOpen: (open: boolean) => void;
  setRealtimePreviewOpen: (open: boolean) => void;
  setMiniMaxConfigOpen: (open: boolean) => void;
  setMembershipCenterOpen: (open: boolean) => void;
  setApiKeyManagementOpen: (open: boolean) => void;
  setWorkflowMarketplaceOpen: (open: boolean) => void;
  setWorkflowDebuggerOpen: (open: boolean) => void;
  setContinuousVideoOpen: (open: boolean) => void;
  setModelMarketplaceOpen: (open: boolean) => void;
  setAPIMonitorOpen: (open: boolean) => void;
  setSaveModalOpen: (open: boolean) => void;
  setLoadModalOpen: (open: boolean) => void;
  setBatchGenerationOpen: (open: boolean) => void;
  setMusicGenerationOpen: (open: boolean) => void;
  setAIDubbingOpen: (open: boolean) => void;
  setAIClipOpen: (open: boolean, tab?: 'suggest' | 'one-click' | 'subtitle' | 'audio' | 'transition' | 'export') => void;
  setAssetLibraryOpen: (open: boolean, tab?: AssetLibraryTab) => void;
}

export const useAppPanelStore = create<AppPanelState>()((set) => ({
  isFileManagerOpen: false,
  isCachePanelOpen: false,
  isSettingsOpen: false,
  settingsActiveTab: 'interface',
  isTestRunnerOpen: false,
  isVersionControlOpen: false,
  isRealtimePreviewOpen: false,
  isMiniMaxConfigOpen: false,
  isMembershipCenterOpen: false,
  isApiKeyManagementOpen: false,
  isWorkflowMarketplaceOpen: false,
  isWorkflowDebuggerOpen: false,
  isContinuousVideoOpen: false,
  isModelMarketplaceOpen: false,
  isAPIMonitorOpen: false,
  isSaveModalOpen: false,
  isLoadModalOpen: false,
  isBatchGenerationOpen: false,
  isMusicGenerationOpen: false,
  isAIDubbingOpen: false,
  isAIClipOpen: false,
  aiClipActiveTab: undefined,
  isAssetLibraryOpen: false,
  assetLibraryInitialTab: undefined,

  setFileManagerOpen: (open) => set({ isFileManagerOpen: open }),
  setCachePanelOpen: (open) => set({ isCachePanelOpen: open }),
  setSettingsOpen: (open, tab) => set((s) => ({
    isSettingsOpen: open,
    settingsActiveTab: tab ?? s.settingsActiveTab,
  })),
  setTestRunnerOpen: (open) => set({ isTestRunnerOpen: open }),
  setVersionControlOpen: (open) => set({ isVersionControlOpen: open }),
  setRealtimePreviewOpen: (open) => set({ isRealtimePreviewOpen: open }),
  setMiniMaxConfigOpen: (open) => set({ isMiniMaxConfigOpen: open }),
  setMembershipCenterOpen: (open) => set({ isMembershipCenterOpen: open }),
  setApiKeyManagementOpen: (open) => set({ isApiKeyManagementOpen: open }),
  setWorkflowMarketplaceOpen: (open) => set({ isWorkflowMarketplaceOpen: open }),
  setWorkflowDebuggerOpen: (open) => set({ isWorkflowDebuggerOpen: open }),
  setContinuousVideoOpen: (open) => set({ isContinuousVideoOpen: open }),
  setModelMarketplaceOpen: (open) => set({ isModelMarketplaceOpen: open }),
  setAPIMonitorOpen: (open) => set({ isAPIMonitorOpen: open }),
  setSaveModalOpen: (open) => set({ isSaveModalOpen: open }),
  setLoadModalOpen: (open) => set({ isLoadModalOpen: open }),
  setBatchGenerationOpen: (open) => set({ isBatchGenerationOpen: open }),
  setMusicGenerationOpen: (open) => set((s) => ({
    isMusicGenerationOpen: open,
    isAIDubbingOpen: open ? false : s.isAIDubbingOpen,
  })),
  setAIDubbingOpen: (open) => set((s) => ({
    isAIDubbingOpen: open,
    isMusicGenerationOpen: open ? false : s.isMusicGenerationOpen,
  })),
  setAIClipOpen: (open, tab) => set((s) => ({
    isAIClipOpen: open,
    aiClipActiveTab: tab ?? s.aiClipActiveTab,
    isMusicGenerationOpen: open ? false : s.isMusicGenerationOpen,
    isAIDubbingOpen: open ? false : s.isAIDubbingOpen,
  })),
  setAssetLibraryOpen: (open, tab) => set((s) => ({
    isAssetLibraryOpen: open,
    assetLibraryInitialTab: tab ?? s.assetLibraryInitialTab,
  })),
}));
