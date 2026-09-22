import React, { useEffect, useState, useCallback, lazy, Suspense, useRef } from 'react';
import './styles/responsive.css';
import { useResumeVideoTasks } from '@/hooks/useResumeVideoTasks';
import { useTaskHydration } from '@/hooks/useTaskHydration';
import StatusIndicator from './components/ui/StatusIndicator';
import DragDropErrorToast from './components/ui/DragDropErrorToast';
import UpdateNotification from './components/ui/UpdateNotification';
import WindowEdgeResizer from './components/ui/WindowEdgeResizer';
import { initCanvasCore } from './core/init-canvas-core';
import { GlobalConfirmDialogHost } from './components/ui/GlobalConfirmDialogHost';

type LazyModule<T extends React.ComponentType<any>> = { default: T };

const DYNAMIC_IMPORT_ERROR_TOKENS = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'failed to load module script',
  'chunkloaderror',
];
const CHUNK_RELOAD_STORAGE_KEY = 'app_chunk_reload_at';
const CHUNK_RELOAD_PARAM = '__app_asset_reload';

const isDynamicImportError = (error: unknown) => {
  const message = String((error as { message?: unknown })?.message ?? error ?? '').toLowerCase();
  return DYNAMIC_IMPORT_ERROR_TOKENS.some((token) => message.includes(token));
};

const reloadForFreshAssetsAfterChunkError = () => {
  try {
    const now = Date.now();
    const lastReloadAt = Number(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) || 0);
    if (now - lastReloadAt < 15000) return false;

    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
    const url = new URL(window.location.href);
    url.searchParams.set(CHUNK_RELOAD_PARAM, String(now));
    window.location.replace(url.toString());
    return true;
  } catch {
    window.location.reload();
    return true;
  }
};

const lazyWithChunkRecovery = <T extends React.ComponentType<any>>(
  loader: () => Promise<LazyModule<T>>
) =>
  lazy(() =>
    loader().catch((error) => {
      if (isDynamicImportError(error) && typeof window !== 'undefined') {
        console.warn('[App] 动态模块加载失败，尝试刷新最新资源:', error);
        if (reloadForFreshAssetsAfterChunkError()) {
          return new Promise<LazyModule<T>>(() => undefined);
        }
      }
      throw error;
    })
  );

const TopToolbar = lazyWithChunkRecovery(() => import('./components/layout/TopToolbar'));
const FlowEditor = lazyWithChunkRecovery(() => import('./components/canvas/FlowEditor'));
const WorkflowSaveModalLazy = lazyWithChunkRecovery(() =>
  import('./components/canvas/WorkflowModals').then((mod) => ({ default: mod.WorkflowSaveModal }))
);
const WorkflowLoadModalLazy = lazyWithChunkRecovery(() =>
  import('./components/canvas/WorkflowModals').then((mod) => ({ default: mod.WorkflowLoadModal }))
);
const QuickToolbar = lazyWithChunkRecovery(() => import('./components/ui/QuickToolbar'));
const TaskQueuePanel = lazyWithChunkRecovery(() => import('./components/ui/TaskQueuePanel'));
const UnifiedAssetLibrary = lazyWithChunkRecovery(
  () => import('./components/asset-library/UnifiedAssetLibrary')
);
const UnifiedCachePanel = lazyWithChunkRecovery(
  () => import('./components/cache/UnifiedCachePanel')
);
const SettingsPanel = lazyWithChunkRecovery(() => import('./components/settings/SettingsPanel'));
const TestRunnerPanel = lazyWithChunkRecovery(() => import('./components/ui/TestRunnerPanel'));
const VersionControlPanel = lazyWithChunkRecovery(
  () => import('./components/ui/VersionControlPanel')
);
const RealtimePreviewPanel = lazyWithChunkRecovery(
  () => import('./components/ui/RealtimePreviewPanel')
);
const WorkflowDebuggerPanel = lazyWithChunkRecovery(
  () => import('./components/ui/WorkflowDebuggerPanel')
);
const ContinuousVideoPanel = lazyWithChunkRecovery(
  () => import('./components/ui/ContinuousVideoPanel')
);
const APIMonitorPanel = lazyWithChunkRecovery(() => import('./components/ui/APIMonitorPanel'));
const BatchGenerationPanel = lazyWithChunkRecovery(
  () => import('./components/ui/BatchGenerationPanel')
);
const loadMusicGenerationPanel = () => import('./components/panels/MusicGenerationPanel');
const loadAIDubbingPanel = () => import('./components/panels/AIDubbingPanel');
const MusicGenerationPanel = lazyWithChunkRecovery(loadMusicGenerationPanel);
const AIDubbingPanel = lazyWithChunkRecovery(loadAIDubbingPanel);
const MiniMaxConfigModal = lazyWithChunkRecovery(
  () => import('./components/ui/MiniMaxConfigModal')
);
const ApiKeyManagementPanel = lazyWithChunkRecovery(() =>
  import('./components/settings/ApiKeyManagementPanel').then((mod) => ({
    default: mod.ApiKeyManagementPanel,
  }))
);
import { useCanvasStore } from './store/useCanvasStore';
import { useFileStore } from './store/useFileStore';
import { createVideoThumbnail } from './services/enhanced-file-processor';
import { usePanelStore } from './store/usePanelStore';
import { useWorkflowStore } from './store/useWorkflowStore';
import { useVirtualRenderStore } from './store/useVirtualRenderStore';
import { useAppPanelStore } from './store/useAppPanelStore';
import { ReactFlowProvider, useReactFlow, Node, Edge } from '@xyflow/react';
import { generateId } from './lib/utils';
import { stripRuntimeFields } from './utils/node-utils';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { initTauriDragDrop, enhancedDragDropManager } from './services/tauri-drag-drop';
import { useLayout } from './services/layout-manager';
import { unifiedCacheService } from './services/unified-cache-service';
import { ToastProvider } from './components/ui/Toast';
import { SkeletonLoading } from './components/ui/SkeletonLoading';
import { useDeepLink } from './hooks/useDeepLink';
import {
  initializeMinimaxAPIKey,
  ensureMinimaxConfig,
  initializeDoubaoAPIKey,
  initializeViduQ2APIKey,
} from './services/minimax-initializer';
import { communicationManager, webSocketService } from './lib/api-core';
import { initializeTaskProgressWebSocket } from '@/services/task-progress-websocket';
import { API_BASE_URL } from './lib/api-config';
import { modelRegistry } from './services/model-registry';
import useUnifiedAPIConfigStore from './store/useUnifiedAPIConfigStore';
import { videoStorage } from '@/lib/video-storage';
import {
  STORYBOARD_NAVIGATE_REQUEST_EVENT,
  dispatchStoryboardShotFocus,
  setPendingStoryboardNavigation,
  type StoryboardNavigateDetail,
} from '@/services/storyboard-navigation-service';

const initialCreativePanel =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('panel') : null;

if (initialCreativePanel === 'music') {
  void loadMusicGenerationPanel().catch(() => undefined);
} else if (initialCreativePanel === 'dubbing') {
  void loadAIDubbingPanel().catch(() => undefined);
}

const LoadingSpinner = () => (
  <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-[#1F1F1F] rounded-lg p-6 flex flex-col items-center">
      <div className="w-8 h-8 border-4 border-[#9CA3AF] border-t-transparent rounded-full animate-spin mb-3"></div>
      <p className="text-white text-sm">加载中...</p>
    </div>
  </div>
);

interface AppContentProps {
  currentView: 'workflow';
  onViewChange: (view: 'workflow') => void;
}

type SettingsTab =
  | 'interface'
  | 'performance'
  | 'api-config'
  | 'llm-config'
  | 'shortcuts'
  | 'paths'
  | 'storage';
const SETTINGS_TABS: readonly string[] = [
  'interface',
  'performance',
  'api-config',
  'llm-config',
  'shortcuts',
  'paths',
  'storage',
];

function AppContent({
  currentView,
  onViewChange,
}: AppContentProps) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { openPanel, closePanel, togglePanel: layoutTogglePanel } = useLayout();

  const isFileManagerOpen = useAppPanelStore((s) => s.isFileManagerOpen);
  const isAssetLibraryOpen = useAppPanelStore((s) => s.isAssetLibraryOpen);
  const assetLibraryInitialTab = useAppPanelStore((s) => s.assetLibraryInitialTab);
  const isCachePanelOpen = useAppPanelStore((s) => s.isCachePanelOpen);
  const isSettingsOpen = useAppPanelStore((s) => s.isSettingsOpen);
  const settingsActiveTab = useAppPanelStore((s) => s.settingsActiveTab);
  const settingsTarget = useAppPanelStore((s) => s.settingsTarget);
  const isTestRunnerOpen = useAppPanelStore((s) => s.isTestRunnerOpen);
  const isVersionControlOpen = useAppPanelStore((s) => s.isVersionControlOpen);
  const isRealtimePreviewOpen = useAppPanelStore((s) => s.isRealtimePreviewOpen);
  const isMiniMaxConfigOpen = useAppPanelStore((s) => s.isMiniMaxConfigOpen);
  const isApiKeyManagementOpen = useAppPanelStore((s) => s.isApiKeyManagementOpen);
  const isWorkflowDebuggerOpen = useAppPanelStore((s) => s.isWorkflowDebuggerOpen);
  const isContinuousVideoOpen = useAppPanelStore((s) => s.isContinuousVideoOpen);
  const isAPIMonitorOpen = useAppPanelStore((s) => s.isAPIMonitorOpen);
  const isSaveModalOpen = useAppPanelStore((s) => s.isSaveModalOpen);
  const isLoadModalOpen = useAppPanelStore((s) => s.isLoadModalOpen);
  const isBatchGenerationOpen = useAppPanelStore((s) => s.isBatchGenerationOpen);
  const isMusicGenerationOpen = useAppPanelStore((s) => s.isMusicGenerationOpen);
  const isAIDubbingOpen = useAppPanelStore((s) => s.isAIDubbingOpen);
  const [hasMountedFlowEditor, setHasMountedFlowEditor] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let deferredTimer: number | undefined;
    let idleId: number | undefined;

    const scheduleWhenIdle = (callback: () => void, timeout: number) => {
      if (window.requestIdleCallback) {
        idleId = window.requestIdleCallback(callback, { timeout });
        return;
      }
      callback();
    };

    if (isMusicGenerationOpen || isAIDubbingOpen) {
      const activePanelLoader = isMusicGenerationOpen
        ? loadMusicGenerationPanel
        : loadAIDubbingPanel;
      const preloadInactivePanels = () => {
        if (cancelled) return;
        void Promise.allSettled([
          isMusicGenerationOpen ? loadAIDubbingPanel() : loadMusicGenerationPanel(),
        ]);
      };

      void activePanelLoader()
        .then(() => {
          if (cancelled) return;
          deferredTimer = window.setTimeout(
            () => scheduleWhenIdle(preloadInactivePanels, 5000),
            2500
          );
        })
        .catch(() => undefined);

      return () => {
        cancelled = true;
        if (deferredTimer !== undefined) window.clearTimeout(deferredTimer);
        if (idleId !== undefined) window.cancelIdleCallback(idleId);
      };
    }

    const preloadSecondaryCreativePanels = () => {
      void Promise.allSettled([loadMusicGenerationPanel(), loadAIDubbingPanel()]);
    };

    if (window.requestIdleCallback) {
      const idleId = window.requestIdleCallback(preloadSecondaryCreativePanels, { timeout: 2500 });
      return () => {
        window.cancelIdleCallback(idleId);
      };
    }

    const secondaryTimer = window.setTimeout(preloadSecondaryCreativePanels, 1200);
    return () => {
      window.clearTimeout(secondaryTimer);
    };
  }, [currentView, isAIDubbingOpen, isMusicGenerationOpen]);

  const setIsFileManagerOpen = useAppPanelStore((s) => s.setFileManagerOpen);
  const setIsAssetLibraryOpen = useAppPanelStore((s) => s.setAssetLibraryOpen);
  const setIsCachePanelOpen = useAppPanelStore((s) => s.setCachePanelOpen);
  const setIsSettingsOpen = useAppPanelStore((s) => s.setSettingsOpen);
  const setIsTestRunnerOpen = useAppPanelStore((s) => s.setTestRunnerOpen);
  const setIsVersionControlOpen = useAppPanelStore((s) => s.setVersionControlOpen);
  const setIsRealtimePreviewOpen = useAppPanelStore((s) => s.setRealtimePreviewOpen);
  const setIsMiniMaxConfigOpen = useAppPanelStore((s) => s.setMiniMaxConfigOpen);
  const setIsApiKeyManagementOpen = useAppPanelStore((s) => s.setApiKeyManagementOpen);
  const setIsWorkflowDebuggerOpen = useAppPanelStore((s) => s.setWorkflowDebuggerOpen);
  const setIsContinuousVideoOpen = useAppPanelStore((s) => s.setContinuousVideoOpen);
  const setIsAPIMonitorOpen = useAppPanelStore((s) => s.setAPIMonitorOpen);
  const setIsSaveModalOpen = useAppPanelStore((s) => s.setSaveModalOpen);
  const setIsLoadModalOpen = useAppPanelStore((s) => s.setLoadModalOpen);
  const setIsBatchGenerationOpen = useAppPanelStore((s) => s.setBatchGenerationOpen);
  const setIsMusicGenerationOpen = useAppPanelStore((s) => s.setMusicGenerationOpen);
  const setIsAIDubbingOpen = useAppPanelStore((s) => s.setAIDubbingOpen);

  const [dragDropErrors, setDragDropErrors] = useState<
    Array<{
      id: string;
      type: 'error' | 'success' | 'warning';
      message: string;
      fileName?: string;
    }>
  >([]);

  const nodes = useCanvasStore((s) => s.nodes);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const deleteSelectedNodes = useCanvasStore((s) => s.deleteSelectedNodes);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const addNode = useCanvasStore((s) => s.addNode);
  const storeEdges = useCanvasStore((s) => s.edges);
  const executeWorkflow = useWorkflowStore((s) => s.executeWorkflow);
  const setWorkflowPanelOpen = usePanelStore((s) => s.setWorkflowPanelOpen);

  const handleDeepLink = useCallback(
    (urls: string[]) => {
      urls.forEach((url) => {
        try {
          const parsedUrl = new URL(url);
          if (parsedUrl.protocol === 'aicg:') {
            const action = parsedUrl.pathname.replace(/^\/+/, '');
            switch (action) {
              case 'open':
                break;
              case 'workflow':
                setWorkflowPanelOpen(true);
                break;
              case 'settings':
                setIsSettingsOpen(true, 'api-config');
                break;
            }
          }
        } catch (error) {
          console.error('Error parsing deep link URL:', error);
        }
      });
    },
    [setWorkflowPanelOpen, setIsSettingsOpen]
  );

  useDeepLink(handleDeepLink);


  const handleSaveWorkflow = useCallback(() => {
    setIsSaveModalOpen(true);
  }, [setIsSaveModalOpen]);

  const [clipboard, setClipboard] = useState<Node[]>([]);

  const [cacheClearFeedback, setCacheClearFeedback] = useState<{
    show: boolean;
    success: boolean;
    message: string;
    caches: string[];
  }>({ show: false, success: false, message: '', caches: [] });

  const handleUpdatePanelState = useCallback(
    (panelId: string, isOpen: boolean) => {
      if (isOpen) {
        openPanel(panelId);
      } else {
        closePanel(panelId);
      }
    },
    [openPanel, closePanel]
  );

  const handleViewModeChange = useCallback(
    (mode: 'workflow') => {
      onViewChange(mode);
      setIsMusicGenerationOpen(false);
      setIsAIDubbingOpen(false);
    },
    [
      onViewChange,
      setIsAIDubbingOpen,
      setIsMusicGenerationOpen,
    ]
  );

  const removeDragDropError = useCallback((id: string) => {
    setDragDropErrors((prev) => prev.filter((err) => err.id !== id));
  }, []);

  const fitViewRef = useRef(fitView);
  fitViewRef.current = fitView;

  const addDragDropToast = useCallback(
    (type: 'error' | 'success' | 'warning', message: string, fileName?: string) => {
      const id = generateId();
      setDragDropErrors((prev) => [...prev, { id, type, message, fileName }]);
    },
    []
  );

  const getCanvasViewportCenter = useCallback(() => {
    let centerX = Math.floor(window.innerWidth / 2);
    let centerY = Math.floor(window.innerHeight / 2);
    try {
      const rfViewport = document.querySelector('.react-flow__viewport');
      if (rfViewport) {
        const transform = window.getComputedStyle(rfViewport).transform;
        const match = transform.match(/matrix\(([^)]+)\)/);
        if (match) {
          const vals = match[1].split(',').map(Number);
          const zoom = vals[0] || 1;
          const tx = vals[4] || 0;
          const ty = vals[5] || 0;
          centerX = (-tx + window.innerWidth / 2) / zoom;
          centerY = (-ty + window.innerHeight / 2) / zoom;
        }
      }
    } catch {
      // keep screen center fallback
    }
    return { x: centerX, y: centerY };
  }, []);

  const addDragDropToastRef = useRef(addDragDropToast);
  addDragDropToastRef.current = addDragDropToast;

  const copyNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const nodesToCopy = nodes.filter((n) => selectedNodeIds.includes(n.id));
    setClipboard(nodesToCopy);
  }, [selectedNodeIds, nodes]);

  const pasteNodes = useCallback(() => {
    if (clipboard.length === 0) return;
    clipboard.forEach((node) => {
      const newNode = {
        ...node,
        id: generateId(),
        position: { x: node.position.x + 50, y: node.position.y + 50 },
        data: node.data ? stripRuntimeFields(node.data) : {},
      };
      addNode(newNode);
    });
  }, [clipboard, addNode]);

  const alignNodes = useCallback(
    (direction: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => {
      if (selectedNodeIds.length < 2) return;
      const selectedNodesList = nodes.filter((n) => selectedNodeIds.includes(n.id));
      const updateNodeData = useCanvasStore.getState().updateNodeData;
      switch (direction) {
        case 'left': {
          const minX = Math.min(...selectedNodesList.map((n) => n.position.x));
          selectedNodesList.forEach((n) =>
            updateNodeData(n.id, { position: { ...n.position, x: minX } })
          );
          break;
        }
        case 'right': {
          const maxX = Math.max(...selectedNodesList.map((n) => n.position.x));
          selectedNodesList.forEach((n) =>
            updateNodeData(n.id, { position: { ...n.position, x: maxX } })
          );
          break;
        }
        case 'top': {
          const minY = Math.min(...selectedNodesList.map((n) => n.position.y));
          selectedNodesList.forEach((n) =>
            updateNodeData(n.id, { position: { ...n.position, y: minY } })
          );
          break;
        }
        case 'bottom': {
          const maxY = Math.max(...selectedNodesList.map((n) => n.position.y));
          selectedNodesList.forEach((n) =>
            updateNodeData(n.id, { position: { ...n.position, y: maxY } })
          );
          break;
        }
        case 'centerH': {
          const avgX =
            selectedNodesList.reduce((sum, n) => sum + n.position.x, 0) / selectedNodesList.length;
          selectedNodesList.forEach((n) =>
            updateNodeData(n.id, { position: { ...n.position, x: avgX } })
          );
          break;
        }
        case 'centerV': {
          const avgY =
            selectedNodesList.reduce((sum, n) => sum + n.position.y, 0) / selectedNodesList.length;
          selectedNodesList.forEach((n) =>
            updateNodeData(n.id, { position: { ...n.position, y: avgY } })
          );
          break;
        }
      }
    },
    [selectedNodeIds, nodes]
  );

  const cacheClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAllCaches = useCallback(async () => {
    if (cacheClearTimerRef.current) clearTimeout(cacheClearTimerRef.current);
    try {
      const result = await unifiedCacheService.clearAll();
      setCacheClearFeedback({
        show: true,
        success: result.success,
        message: result.success
          ? `成功清理 ${result.clearedCaches.length} 个缓存，释放 ${unifiedCacheService.formatSize(result.freedSize)}`
          : `清理失败: ${result.errors.join(', ')}`,
        caches: result.clearedCaches,
      });
    } catch (error) {
      setCacheClearFeedback({
        show: true,
        success: false,
        message: `清理出错: ${error}`,
        caches: [],
      });
    }
    cacheClearTimerRef.current = setTimeout(() => {
      setCacheClearFeedback((prev) => ({ ...prev, show: false }));
    }, 3000);
  }, []);

  const handlersRef = useRef({
    undo,
    redo,
    executeWorkflow,
    handleUpdatePanelState,
    layoutTogglePanel,
    deleteSelectedNodes,
    copyNodes,
    pasteNodes,
    alignNodes,
    fitView,
    zoomIn,
    zoomOut,
    clearAllCaches,
  });
  handlersRef.current = {
    undo,
    redo,
    executeWorkflow,
    handleUpdatePanelState,
    layoutTogglePanel,
    deleteSelectedNodes,
    copyNodes,
    pasteNodes,
    alignNodes,
    fitView,
    zoomIn,
    zoomOut,
    clearAllCaches,
  };

  const isFileManagerOpenRef = useRef(isFileManagerOpen);
  isFileManagerOpenRef.current = isFileManagerOpen;
  const isTestRunnerOpenRef = useRef(isTestRunnerOpen);
  isTestRunnerOpenRef.current = isTestRunnerOpen;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      const key = e.key.toLowerCase();
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[data-node-text-input="true"]'))
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        h.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        h.redo();
      }
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        h.handleUpdatePanelState('workflow', true);
      }
      if ((e.ctrlKey || e.metaKey) && key === 'f') {
        e.preventDefault();
        h.handleUpdatePanelState('fileManager', true);
      }
      if ((e.ctrlKey || e.metaKey) && key === 'c') {
        e.preventDefault();
        h.copyNodes();
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && key === 'v') {
        e.preventDefault();
        h.pasteNodes();
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        h.alignNodes('left');
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        h.alignNodes('right');
      }
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        h.alignNodes('top');
      }
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        h.alignNodes('bottom');
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && key === 'h') {
        e.preventDefault();
        h.alignNodes('centerH');
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && key === 'v') {
        e.preventDefault();
        h.alignNodes('centerV');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        h.fitView({ duration: 300 });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault();
        h.zoomIn({ duration: 200 });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        h.zoomOut({ duration: 200 });
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setIsFileManagerOpen(!isFileManagerOpenRef.current);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        h.layoutTogglePanel('presetPanel');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Delete') {
        e.preventDefault();
        h.clearAllCaches();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        h.layoutTogglePanel('connectionStatus');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setIsSettingsOpen(true, 'api-config');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        h.layoutTogglePanel('batchGeneration');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'U') {
        e.preventDefault();
        h.layoutTogglePanel('unifiedManager');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        h.layoutTogglePanel('workflowControl');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
        e.preventDefault();
        h.layoutTogglePanel('cacheClear');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        h.layoutTogglePanel('canvasEnhancement');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        h.layoutTogglePanel('aiGenerationEnhancement');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setIsTestRunnerOpen(!isTestRunnerOpenRef.current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsFileManagerOpen, setIsSettingsOpen, setIsTestRunnerOpen]);

  useEffect(() => {
    const handleOpenSettings = () => {
      setIsSettingsOpen(true, 'interface');
    };
    window.addEventListener('open-settings', handleOpenSettings);
    return () => {
      window.removeEventListener('open-settings', handleOpenSettings);
    };
  }, [setIsSettingsOpen]);

  useEffect(() => {
    const handleNavigateToFeature = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.action) return;
      const { action } = detail;
      switch (action) {
        case 'music':
          setIsMusicGenerationOpen(true);
          break;
        case 'workflow':
          onViewChange('workflow');
          break;
      }
    };
    window.addEventListener('navigate-to-feature', handleNavigateToFeature);
    return () => {
      window.removeEventListener('navigate-to-feature', handleNavigateToFeature);
    };
  }, [onViewChange, setIsMusicGenerationOpen]);

  useEffect(() => {
    enhancedDragDropManager.setCallbacks({
      onProgress: () => undefined,
      onComplete: (item) => {
        addDragDropToastRef.current(
          'success',
          `成功添加 ${item.type === 'image' ? '图片' : '视频'}`,
          item.name
        );
      },
      onError: (item, error) => {
        addDragDropToastRef.current('error', error, item.name);
      },
    });
  }, []);

  useEffect(() => {
    initTauriDragDrop().catch(console.error);
  }, []);

  useEffect(() => {
    initializeMinimaxAPIKey();
    ensureMinimaxConfig();
    initializeDoubaoAPIKey();
    initializeViduQ2APIKey();
    import('./store/useCanvasStore').then(({ restoreNodeImages }) => {
      restoreNodeImages().catch(console.error);
    });
    // 会员系统已移除 — 前端同步服务不再需要
  }, []);

  useEffect(() => {
    // 无论是否登录都获取 provider 配置（未登录时从公共 API 获取）
    useUnifiedAPIConfigStore
      .getState()
      .fetchProviderConfigs()
      .catch((e: Error) => console.warn('[App] 获取提供商配置失败:', e));
  }, []);

  useEffect(() => {
    const handleOpenSaveModal = () => {
      setIsSaveModalOpen(true);
    };
    const handleOpenLoadModal = () => {
      setIsLoadModalOpen(true);
    };
    window.addEventListener('open-save-modal', handleOpenSaveModal);
    window.addEventListener('open-load-modal', handleOpenLoadModal);
    return () => {
      window.removeEventListener('open-save-modal', handleOpenSaveModal);
      window.removeEventListener('open-load-modal', handleOpenLoadModal);
    };
  }, [setIsLoadModalOpen, setIsSaveModalOpen]);



  const dropUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const shouldHandleGlobalFileDrop = (e: DragEvent) => {
      const types = Array.from(e.dataTransfer?.types ?? []);
      return types.includes('Files') || (e.dataTransfer?.files?.length ?? 0) > 0;
    };
    const handleDragOver = (e: DragEvent) => {
      if (!shouldHandleGlobalFileDrop(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const handleDragEnter = (e: DragEvent) => {
      if (!shouldHandleGlobalFileDrop(e)) return;
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.add('file-dragging');
    };
    const handleDragLeave = (e: DragEvent) => {
      if (!shouldHandleGlobalFileDrop(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.relatedTarget === null) {
        document.body.classList.remove('file-dragging');
      }
    };
    const handleDrop = async (e: DragEvent) => {
      if (!shouldHandleGlobalFileDrop(e)) return;
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.remove('file-dragging');
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const { addFile } = useFileStore.getState();
      const { addNode } = useCanvasStore.getState();
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) {
          addDragDropToastRef.current('error', `不支持的文件类型: ${file.type}`, file.name);
          continue;
        }
        try {
          const fileType = isImage ? 'image' : 'video';
          let url: string;
          let thumbnailUrl: string = '';
          if (fileType === 'image') {
            url = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = (error) => reject(error);
              reader.readAsDataURL(file);
            });
            thumbnailUrl = url;
          } else {
            url = URL.createObjectURL(file);
            dropUrlsRef.current.push(url);
            thumbnailUrl = await createVideoThumbnail(file).catch(() => '');
          }
          void addFile({
            id: generateId(),
            name: file.name,
            type: fileType,
            size: file.size,
            url,
            thumbnailUrl,
            createdAt: new Date().toISOString(),
          });
          const nodeId = `image-input-${generateId()}`;
          if (fileType === 'image') {
            addNode({
              id: nodeId,
              type: 'imageInput',
              position: { x: 200 + Math.random() * 300, y: 50 + Math.random() * 150 },
              data: { type: 'imageInput', imageUrl: url, fileName: file.name },
            });
          } else {
            const videoNodeId = `video-input-${generateId()}`;
            videoStorage
              .saveVideo(videoNodeId, file, {
                fileName: file.name,
                duration: 0,
                width: 0,
                height: 0,
                fileSize: file.size,
                createdAt: Date.now(),
              })
              .then(() => undefined)
              .catch((err) => {
                console.warn('[App] 视频保存到IDB失败:', err);
              });
            addNode({
              id: videoNodeId,
              type: 'videoInput',
              position: { x: 200 + Math.random() * 300, y: 50 + Math.random() * 150 },
              data: { type: 'videoInput', videoUrl: url, fileName: file.name },
            });
          }
          addDragDropToastRef.current(
            'success',
            `成功导入 ${fileType === 'image' ? '图片' : '视频'} (按 1 键查看全部)`,
            file.name
          );
        } catch (error) {
          console.error('[App] Import error:', error);
          addDragDropToastRef.current('error', `导入失败: ${error}`, file.name);
        }
      }
      setTimeout(() => {
        fitViewRef.current({ padding: 0.5, duration: 500 });
      }, 300);
    };
    document.addEventListener('dragover', handleDragOver, true);
    document.addEventListener('dragenter', handleDragEnter, true);
    document.addEventListener('dragleave', handleDragLeave, true);
    document.addEventListener('drop', handleDrop, true);
    return () => {
      document.removeEventListener('dragover', handleDragOver, true);
      document.removeEventListener('dragenter', handleDragEnter, true);
      document.removeEventListener('dragleave', handleDragLeave, true);
      document.removeEventListener('drop', handleDrop, true);
      dropUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          console.warn('[App] 释放Blob URL失败:', e);
        }
      });
      dropUrlsRef.current = [];
    };
  }, []);

  const isWorkflowView = !isMusicGenerationOpen && !isAIDubbingOpen;
  const isCreativeSurfaceActive = !isWorkflowView;

  return (
    <>
      <Suspense fallback={<LoadingSpinner />}>
        <TopToolbar
          onOpenFileManager={() => setIsFileManagerOpen(true)}
          onOpenCacheClearPanel={() => setIsCachePanelOpen(true)}
          onOpenSettings={(tab) => {
            const validTab =
              tab && SETTINGS_TABS.includes(tab) ? (tab as SettingsTab) : 'interface';
            setIsSettingsOpen(true, validTab);
          }}
          onOpenVersionControl={() => setIsVersionControlOpen(true)}
          onOpenMiniMaxConfig={() => setIsMiniMaxConfigOpen(true)}
          onOpenApiKeyManagement={() => setIsApiKeyManagementOpen(true)}
          onOpenWorkflowDebugger={() => setIsWorkflowDebuggerOpen(true)}
          onOpenAPIMonitor={() => setIsAPIMonitorOpen(true)}
          onOpenMusicGeneration={() => setIsMusicGenerationOpen(true)}
          onCloseMusicGeneration={() => setIsMusicGenerationOpen(false)}
          onOpenAIDubbing={() => setIsAIDubbingOpen(true)}
          onCloseAIDubbing={() => setIsAIDubbingOpen(false)}
          currentView={currentView}
          isMusicGenerationOpen={isMusicGenerationOpen}
          isAIDubbingOpen={isAIDubbingOpen}
          onViewModeChange={handleViewModeChange}
          onSave={handleSaveWorkflow}
          onGoBack={() => handleViewModeChange('workflow')}
        />
      </Suspense>

      {isFileManagerOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <UnifiedAssetLibrary
            isOpen={isFileManagerOpen}
            onClose={() => setIsFileManagerOpen(false)}
            initialTab="all"
          />
        </Suspense>
      )}
      {isAssetLibraryOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <UnifiedAssetLibrary
            isOpen={isAssetLibraryOpen}
            onClose={() => setIsAssetLibraryOpen(false)}
            initialTab={assetLibraryInitialTab}
          />
        </Suspense>
      )}
      {isCachePanelOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <UnifiedCachePanel isOpen={isCachePanelOpen} onClose={() => setIsCachePanelOpen(false)} />
        </Suspense>
      )}
      {isSettingsOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <SettingsPanel
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            initialTab={settingsActiveTab}
            settingsTarget={settingsTarget}
          />
        </Suspense>
      )}
      {isTestRunnerOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <TestRunnerPanel />
        </Suspense>
      )}
      {isVersionControlOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <VersionControlPanel
            isOpen={isVersionControlOpen}
            onClose={() => setIsVersionControlOpen(false)}
          />
        </Suspense>
      )}
      {isRealtimePreviewOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <RealtimePreviewPanel
            isOpen={isRealtimePreviewOpen}
            onClose={() => setIsRealtimePreviewOpen(false)}
          />
        </Suspense>
      )}
      {isMiniMaxConfigOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <MiniMaxConfigModal
            isOpen={isMiniMaxConfigOpen}
            onClose={() => setIsMiniMaxConfigOpen(false)}
          />
        </Suspense>
      )}
      {isApiKeyManagementOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <ApiKeyManagementPanel
            isOpen={isApiKeyManagementOpen}
            onClose={() => setIsApiKeyManagementOpen(false)}
          />
        </Suspense>
      )}
      {isWorkflowDebuggerOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <WorkflowDebuggerPanel
            isOpen={isWorkflowDebuggerOpen}
            onClose={() => setIsWorkflowDebuggerOpen(false)}
          />
        </Suspense>
      )}
      {isSaveModalOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <WorkflowSaveModalLazy
            nodes={nodes}
            edges={storeEdges}
            onClose={() => setIsSaveModalOpen(false)}
          />
        </Suspense>
      )}
      {isLoadModalOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <WorkflowLoadModalLazy
            onLoad={(workflow: { nodes: Node[]; edges: Edge[] }) => {
              useCanvasStore.getState().setNodes(workflow.nodes);
              useCanvasStore.getState().setEdges(workflow.edges);
              setIsLoadModalOpen(false);
            }}
            onClose={() => setIsLoadModalOpen(false)}
          />
        </Suspense>
      )}
      {isContinuousVideoOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <ContinuousVideoPanel
            isOpen={isContinuousVideoOpen}
            onClose={() => setIsContinuousVideoOpen(false)}
          />
        </Suspense>
      )}
      {isAPIMonitorOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <APIMonitorPanel isOpen={isAPIMonitorOpen} onClose={() => setIsAPIMonitorOpen(false)} />
        </Suspense>
      )}
      {isBatchGenerationOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <BatchGenerationPanel
            isOpen={isBatchGenerationOpen}
            onClose={() => setIsBatchGenerationOpen(false)}
          />
        </Suspense>
      )}

      {isWorkflowView && !isFileManagerOpen && (
        <Suspense fallback={null}>
          <TaskQueuePanel />
        </Suspense>
      )}

      {cacheClearFeedback.show && (
        <div className={`fixed top-20 right-4 z-50 animate-pulse`}>
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${cacheClearFeedback.success ? 'bg-[#10B981]/20 border-[#10B981]/50' : 'bg-[#EF4444]/20 border-[#EF4444]/50'}`}
          >
            {cacheClearFeedback.success ? (
              <CheckCircle className="w-5 h-5 text-[#10B981]" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[#EF4444]" />
            )}
            <div>
              <p className="text-white font-medium text-sm">
                {cacheClearFeedback.success ? '缓存清理成功' : '缓存清理失败'}
              </p>
              <p className="text-white/70 text-xs">{cacheClearFeedback.message}</p>
              {cacheClearFeedback.caches.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {cacheClearFeedback.caches.map((cache, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/60"
                    >
                      {cache}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DragDropErrorToast errors={dragDropErrors} onRemove={removeDragDropError} />

      <div className="absolute inset-0 flex z-40" style={{ top: '56px' }}>
        <div className="relative flex-1 h-full overflow-hidden">
          {hasMountedFlowEditor && (
            <Suspense fallback={<LoadingSpinner />}>
              <FlowEditor
                onOpenSaveModal={handleSaveWorkflow}
                isBackgroundLayer={isCreativeSurfaceActive}
              />
            </Suspense>
          )}

          {isCreativeSurfaceActive && (
            <div className="absolute inset-0 z-[60]">
              {isAIDubbingOpen ? (
                <Suspense fallback={<LoadingSpinner />}>
                  <AIDubbingPanel
                    isOpen={isAIDubbingOpen}
                    onClose={() => setIsAIDubbingOpen(false)}
                  />
                </Suspense>
              ) : isMusicGenerationOpen ? (
                <Suspense fallback={<LoadingSpinner />}>
                  <MusicGenerationPanel
                    isOpen={isMusicGenerationOpen}
                    onClose={() => setIsMusicGenerationOpen(false)}
                  />
                </Suspense>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {isWorkflowView && !isFileManagerOpen && (
        <Suspense fallback={null}>
          <QuickToolbar className="quick-toolbar" />
        </Suspense>
      )}

      <StatusIndicator />
      <UpdateNotification />

    </>
  );
}

function App() {
  useResumeVideoTasks();
  useTaskHydration();
  const [currentView, setCurrentView] = useState<'workflow'>(() => {
    return 'workflow';
  });
  const [isAppLoading, setIsAppLoading] = useState(true);
  const handleViewChange = useCallback((view: 'workflow') => {
    setCurrentView(view);
  }, []);
  const setIsMusicGenerationOpen = useAppPanelStore((s) => s.setMusicGenerationOpen);
  const setIsAIDubbingOpen = useAppPanelStore((s) => s.setAIDubbingOpen);

  useEffect(() => {
    initCanvasCore();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const panel = urlParams.get('panel');
    const autoEdit = urlParams.get('autoEdit');
    if (panel === 'dubbing') {
      setIsAIDubbingOpen(true);
    } else if (panel === 'music') {
      setIsMusicGenerationOpen(true);
    }
    if (panel) {
      const url = new URL(window.location.href);
      url.searchParams.delete('panel');
      url.searchParams.delete('autoEdit');
      url.searchParams.delete('videoUrl');
      url.searchParams.delete('prompt');
      url.searchParams.delete('template');
      url.searchParams.delete('ultraLong');
      window.history.replaceState({}, '', url.pathname);
    }
  }, [setIsAIDubbingOpen, setIsMusicGenerationOpen]);





  useEffect(() => {
    const onNavigateToStoryboard = (e: Event) => {
      const detail = (e as CustomEvent<StoryboardNavigateDetail>).detail;
      if (!detail?.shotId) return;
      setPendingStoryboardNavigation(detail);
      setCurrentView('workflow');
      window.setTimeout(() => dispatchStoryboardShotFocus(detail), 160);
    };

    window.addEventListener(
      STORYBOARD_NAVIGATE_REQUEST_EVENT,
      onNavigateToStoryboard as EventListener
    );
    return () =>
      window.removeEventListener(
        STORYBOARD_NAVIGATE_REQUEST_EVENT,
        onNavigateToStoryboard as EventListener
      );
  }, []);

  useEffect(() => {
    const initApp = async () => {
      try {
        communicationManager.setUnauthorizedHandler(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('authToken');
          communicationManager.clearAuthToken();
          // 会员系统已移除 — 不再重定向到登录页，刷新当前页即可
          window.location.reload();
        });

        try {
          await initializeTaskProgressWebSocket();

          // 订阅后端配置更新通知：管理员发布配置后，前端自动刷新模型注册表
          webSocketService.subscribe('app_config_updated', () => {
            modelRegistry.refreshFromBackend().catch((err) => {
              console.warn('[App] 收到配置更新通知但刷新模型注册表失败:', err);
            });
          });
        } catch (wsErr) {
          console.warn('[App] WebSocket 连接失败，任务进度将无法实时更新:', wsErr);
        }

        setIsAppLoading(false);
      } catch (error) {
        console.error('[App] 初始化失败:', error);
        setIsAppLoading(false);
      }
    };
    initApp();
  }, []);

  if (isAppLoading) {
    return <SkeletonLoading />;
  }

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <GlobalConfirmDialogHost />
      <ReactFlowProvider>
        <AppContent
          currentView={currentView}
          onViewChange={handleViewChange}
        />
      </ReactFlowProvider>
    </div>
  );
}

export default App;
