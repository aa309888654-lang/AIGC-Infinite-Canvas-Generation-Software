import React, {
  useCallback,
  useRef,
  useEffect,
  useState,
  useMemo,
  memo,
  Suspense,
  lazy,
} from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  addEdge,
  Connection,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  NodeChange,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  useOnViewportChange,
  BackgroundVariant,
  HandleType,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import FocusEditMode from './FocusEditMode';

import DragDropOverlay from './DragDropOverlay';
import ComfyUIEdge from './ComfyUIEdge';
import WorkflowManager from './WorkflowManager';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useFileStore } from '@/store/useFileStore';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { useAppPanelStore } from '@/store/useAppPanelStore';
import { generateId, cn } from '@/lib/utils';
import { nodeEventBus } from '@/lib/nodeEventBus';
import { createImageThumbnail, createVideoThumbnail } from '@/services/enhanced-file-processor';
import { buildNodeDataFromDefinition, NodeTypeDefinition, getPortType } from '@/types/node-system';
import { resolveNodeDefinition } from '@/core/node-registry';
import {
  resolveQuickAddNodeType,
  getQuickAddOptions,
  buildDefaultNodeData,
  getDefaultTargetHandle,
  type HandleQuickAddOption,
} from '@/services/node-handle-adjacency';
import VirtualizedFlow from './VirtualizedFlow';
import WorkflowDebuggerPanel from '../ui/WorkflowDebuggerPanel';
import { canvasProjectService } from '@/services/canvas-project-service';
import { shouldApplyLoadedCanvasProject } from './canvas-project-load-guard';
import ProjectManagerPanel from './ProjectManagerPanel';
import PerformanceMonitorPanel from '../ui/PerformanceMonitorPanel';
import { useVirtualRenderStore, checkAutoEnableVirtualRender } from '@/store/useVirtualRenderStore';
import { validateConnection } from '@/store/workflow-graph';
import { toast } from 'sonner';
import RightPanel from '@/components/layout/RightPanel';
import CommandPalette, { useCommandPaletteCommands } from '@/components/ui/CommandPalette';
import {
  Camera,
  Video,
  Image as ImageIcon,
  Box,
  Globe,
  Clapperboard,
  Bot,
  BotOff,
  Gauge,
  X,
} from 'lucide-react';
import { workflowDebuggerService } from '@/services/workflow-debugger-service';
import { DebugState } from '@/types/workflow-debugger';
import { persistImportedCanvasFile } from '@/services/canvas-asset-actions';
import { flowNodeTypes, preloadCommonNodeTypes } from './flow-node-types';

import { useKeyboardManager, KeyboardShortcut } from '@/hooks/useKeyboardManager';
import { userSettingsManager, USER_SETTINGS_UPDATED_EVENT } from '@/services/user-settings';
import { useSnapshots } from '@/hooks/useSnapshots';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useNodeAlignment } from '@/hooks/useNodeAlignment';
import { usePanelManager } from '@/hooks/usePanelManager';
import { useAutoLayout } from '@/hooks/useAutoLayout';
import FlowContextMenu from './FlowContextMenu';
import SnapshotsPanel from './SnapshotsPanel';
import BookmarksPanel from './BookmarksPanel';
import NodeSearchPanel from './NodeSearchPanel';
import AlignToolbar from './AlignToolbar';
import QuickAddNodePanel from './QuickAddNodePanel';
import CanvasLeftToolbar from './CanvasLeftToolbar';
import { getCanvasNodeColor } from './node-color';
import HistoryPanel from './HistoryPanel';
import AICGPaneQuickAdd from './AICGPaneQuickAdd';
import AICGToolboxPanel from './AICGToolboxPanel';
import AICGGroupOverlay from './AICGGroupOverlay';
import StoryboardPanel from '@/components/storyboard/StoryboardPanel';
import { aicgGroupService, executeAICGGroup } from '@/services/aicg-group-service';
import {
  instantiateAICGWorkflow,
  type AICGWorkflowTemplate,
} from '@/services/aicg-workflow-service';
import { createShotNodeGroup } from '@/services/shot-node-factory';
import { executeShot, executeShots } from '@/services/shot-execution-service';
import {
  syncAllShotResultsFromNodes,
  syncShotResultFromNode,
} from '@/services/shot-result-sync-service';
import { useShotStore } from '@/store/useShotStore';
import type { Shot } from '@/types/shot-system';
import realAPIExecutor from '@/store/real-api-executor';
import {
  CANVAS_NODE_HORIZONTAL_GAP,
  CANVAS_NODE_VERTICAL_GAP,
  getCanvasNodeDimensions,
  getCanvasNodeDimensionsFromNode,
  resolveNonOverlappingCanvasNode,
  resolveNonOverlappingCanvasNodeInViewport,
  withCanvasNodeDefaultSize,
} from '@/lib/canvas-node-dimensions';
import {
  STORYBOARD_FOCUS_SHOT_EVENT,
  consumePendingStoryboardNavigation,
  type StoryboardNavigateDetail,
} from '@/services/storyboard-navigation-service';
import { deleteSelectedEdge, toggleEdgeSelection } from './edge-selection';
import {
  pulseEdgeSignal,
  pulseNodeEdgeSignals,
  scheduleClearEdgeFlow,
} from './edge-signal-service';
import { withEdgeSignalPulse } from './aicg-port-visuals';

const edgeTypes = {
  comfyui: ComfyUIEdge,
  default: ComfyUIEdge,
};

const BackgroundDot = memo(function BackgroundDot() {
  return (
    <Background
      color="rgba(255,255,255,0.15)"
      gap={20}
      size={1.5}
      variant={BackgroundVariant.Dots}
      style={{ opacity: 1 }}
    />
  );
});
const FIT_VIEW_OPTIONS = { padding: 0.1, duration: 800 };
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };
const PAN_ON_DRAG: number[] = [2];
const SNAP_GRID: [number, number] = [15, 15];
const KEYBOARD_ZOOM_ANIMATION_MS = 120;
const RESET_ZOOM_ANIMATION_MS = 220;
const FLOW_PRO_OPTIONS = { hideAttribution: true } as const;
const createConfiguredKeyboardShortcut = (
  binding: string | undefined,
  fallback: string,
  shortcut: Omit<KeyboardShortcut, 'key' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>
): KeyboardShortcut | null => {
  const value = String(binding || fallback).trim();
  if (!value || /mouse|wheel|pinch/i.test(value)) return null;
  const parts = value === '+' ? ['+'] : value.split(/\s*\+\s*/).filter(Boolean);
  const normalized = parts.map((part) => part.trim().toLowerCase());
  const has = (key: string) => normalized.includes(key);
  const primary = parts.find(
    (part) =>
      !['ctrl', 'control', 'cmd', 'meta', 'shift', 'alt', 'option'].includes(
        part.trim().toLowerCase()
      )
  );
  if (!primary) return null;
  const lowerPrimary = primary.toLowerCase();
  const shiftKey = has('shift');
  const key =
    lowerPrimary === 'space'
      ? ' '
      : primary.length === 1
        ? shiftKey
          ? primary.toUpperCase()
          : primary.toLowerCase()
        : primary;
  return {
    ...shortcut,
    key,
    ctrlKey: has('ctrl') || has('control') || has('cmd') || has('meta'),
    shiftKey,
    altKey: has('alt') || has('option'),
  };
};

const bindingContains = (binding: string | undefined, token: string) =>
  String(binding || '')
    .toLowerCase()
    .includes(token.toLowerCase());
const FLOW_CANVAS_PERF_PROPS = {
  onlyRenderVisibleElements: true,
  nodesFocusable: false,
  edgesFocusable: false,
  autoPanOnNodeFocus: false,
  zoomOnScroll: true,
  zoomOnPinch: true,
  panOnScroll: false,
  preventScrolling: true,
  noWheelClassName: 'nowheel',
  noDragClassName: 'nodrag',
  elevateNodesOnSelect: false,
  nodeDragThreshold: 3,
  proOptions: FLOW_PRO_OPTIONS,
  selectNodesOnDrag: true,
} as const;

function didFlowNodeActuallyChange(prevNode: Node | undefined, node: Node | undefined) {
  if (!prevNode || !node) return true;
  return (
    prevNode.id !== node.id ||
    prevNode.type !== node.type ||
    prevNode.selected !== node.selected ||
    prevNode.dragging !== node.dragging ||
    prevNode.hidden !== node.hidden ||
    prevNode.width !== node.width ||
    prevNode.height !== node.height ||
    prevNode.position?.x !== node.position?.x ||
    prevNode.position?.y !== node.position?.y
  );
}

function didFlowNodesActuallyChange(
  prevNodes: Node[],
  nextNodes: Node[],
  changedNodeIds: readonly string[],
  nodeIndex: ReadonlyMap<string, number>
) {
  if (prevNodes.length !== nextNodes.length) return true;

  return changedNodeIds.some((nodeId) => {
    const index = nodeIndex.get(nodeId);
    if (index === undefined) return true;
    return didFlowNodeActuallyChange(prevNodes[index], nextNodes[index]);
  });
}

// FlowEditor module loaded

interface FlowEditorProps {
  onAddNode?: (nodeType: unknown) => void;
  onOpenSaveModal?: () => void;
  isBackgroundLayer?: boolean;
}

const FlowEditor: React.FC<FlowEditorProps> = ({ onOpenSaveModal, isBackgroundLayer = false }) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const {
    zoomIn,
    zoomOut,
    fitView,
    getViewport,
    setCenter,
    screenToFlowPosition,
    setViewport: rfSetViewport,
  } = useReactFlow();

  const { panels, showPanel, hidePanel, togglePanel } = usePanelManager();
  const setFileManagerOpen = useAppPanelStore((s) => s.setFileManagerOpen);
  const isAssetLibraryOpen = useAppPanelStore((s) => s.isAssetLibraryOpen);
  const assetLibraryInitialTab = useAppPanelStore((s) => s.assetLibraryInitialTab);
  const setAssetLibraryOpen = useAppPanelStore((s) => s.setAssetLibraryOpen);
  const { snapshots, createSnapshot, restoreSnapshot, deleteSnapshot } = useSnapshots();
  const { bookmarks, addBookmark, goToBookmark, deleteBookmark } = useBookmarks(rfSetViewport);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(
    null
  );
  const contextMenuRef = useRef<{ x: number; y: number; nodeId?: string } | null>(null);
  const closeContextMenu = useCallback(() => {
    contextMenuRef.current = null;
    setContextMenu(null);
  }, []);
  const openContextMenu = useCallback((menu: { x: number; y: number; nodeId?: string }) => {
    contextMenuRef.current = menu;
    setContextMenu(menu);
  }, []);
  const isAltDraggingRef = useRef(false);
  const connectingSourceRef = useRef<{ nodeId: string; handleId: string; nodeType: string } | null>(
    null
  );
  const [connectEndQuickAdd, setConnectEndQuickAdd] = useState<{
    x: number;
    y: number;
    flowX: number;
    flowY: number;
    sourceNodeId: string;
    sourceHandleId: string;
    sourceNodeType: string;
    options: HandleQuickAddOption[];
  } | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCanvasInteracting, setIsCanvasInteracting] = useState(false);
  const dragActiveRef = useRef(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddAnchorRect, setQuickAddAnchorRect] = useState<DOMRect | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [uploadAnchorRect, setUploadAnchorRect] = useState<DOMRect | null>(null);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [layoutAnchorRect, setLayoutAnchorRect] = useState<DOMRect | null>(null);
  const [showToolbox, setShowToolbox] = useState(false);
  const [showWorkflowManager, setShowWorkflowManager] = useState(false);
  const [showStoryboard, setShowStoryboard] = useState(false);
  const lastStoryboardNavigationTsRef = useRef(0);
  const [groupRefreshKey, setGroupRefreshKey] = useState(0);
  const [paneQuickAdd, setPaneQuickAdd] = useState<{
    x: number;
    y: number;
    flowX: number;
    flowY: number;
  } | null>(null);
  const localViewportRef = useRef({ x: 0, y: 0, zoom: 1 });
  const debugStateRef = useRef<DebugState>({
    isPaused: false,
    currentNodeId: null,
    pausedAt: null,
    callStack: [],
    variables: {},
    executionHistory: [],
  });
  const [frames, setFrames] = useState<
    Array<{
      id: string;
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
    }>
  >([]);
  const [shortcutSettings, setShortcutSettings] = useState(
    () => userSettingsManager.getAllSettings().shortcuts
  );
  const [heldCanvasKeys, setHeldCanvasKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    document.documentElement.toggleAttribute('data-canvas-interacting', isCanvasInteracting);
    return () => {
      document.documentElement.removeAttribute('data-canvas-interacting');
    };
  }, [isCanvasInteracting]);

  useEffect(() => {
    const syncShortcuts = () => setShortcutSettings(userSettingsManager.getAllSettings().shortcuts);
    window.addEventListener(USER_SETTINGS_UPDATED_EVENT, syncShortcuts);
    return () => window.removeEventListener(USER_SETTINGS_UPDATED_EVENT, syncShortcuts);
  }, []);

  useEffect(() => {
    const updateHeldKeys = (event: KeyboardEvent, pressed: boolean) => {
      const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
      setHeldCanvasKeys((current) => {
        const next = new Set(current);
        if (pressed) next.add(key);
        else next.delete(key);
        return next;
      });
    };
    const onKeyDown = (event: KeyboardEvent) => updateHeldKeys(event, true);
    const onKeyUp = (event: KeyboardEvent) => updateHeldKeys(event, false);
    const clearHeldKeys = () => setHeldCanvasKeys(new Set());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeldKeys);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeldKeys);
    };
  }, []);

  const copiedCanvasNodesRef = useRef<Node[]>([]);

  const onOpenSaveModalRef = useRef(onOpenSaveModal);

  const {
    storeNodes,
    storeEdges,
    selectedNodeIds,
    setStoreNodes,
    setStoreNodesTransient,
    setStoreEdges,
    setSelectedNodeId,
    saveToHistory,
    deleteSelectedNodes,
    duplicateSelectedNodes,
    moveSelectedNodes,
    selectAllNodes,
    clearSelection,
    resetCanvas,
    undo,
    redo,
  } = useCanvasStore(
    useShallow((s) => ({
      storeNodes: s.nodes,
      storeEdges: s.edges,
      selectedNodeIds: s.selectedNodeIds,
      setStoreNodes: s.setNodes,
      setStoreNodesTransient: s.setNodesTransient,
      setStoreEdges: s.setEdges,
      setSelectedNodeId: s.setSelectedNodeId,
      saveToHistory: s.saveToHistory,
      deleteSelectedNodes: s.deleteSelectedNodes,
      duplicateSelectedNodes: s.duplicateSelectedNodes,
      moveSelectedNodes: s.moveSelectedNodes,
      selectAllNodes: s.selectAllNodes,
      clearSelection: s.clearSelection,
      resetCanvas: s.resetCanvas,
      undo: s.undo,
      redo: s.redo,
    }))
  );
  const virtualRenderEnabled = useVirtualRenderStore((s) => s.enabled);
  const virtualRenderThreshold = useVirtualRenderStore((s) => s.nodeThreshold);

  const safeSetStoreNodes = useCallback(
    (nodes: Node[]) => {
      setStoreNodes(nodes);
    },
    [setStoreNodes]
  );

  const copySelectedNodesToClipboard = useCallback(() => {
    const copied = storeNodes
      .filter((node) => selectedNodeIds.includes(node.id))
      .map((node) => ({
        ...node,
        data: { ...node.data },
        position: { ...node.position },
        selected: false,
      }));
    copiedCanvasNodesRef.current = copied;
    toast[copied.length > 0 ? 'success' : 'info'](
      copied.length > 0 ? `已复制 ${copied.length} 个节点` : '请先选择要复制的节点'
    );
  }, [storeNodes, selectedNodeIds]);

  const pasteCopiedNodesFromClipboard = useCallback(() => {
    const copied = copiedCanvasNodesRef.current;
    if (copied.length === 0) {
      toast.info('剪贴板中没有可粘贴的节点');
      return;
    }
    const pasted = copied.map((node) => ({
      ...node,
      id: generateId(),
      data: { ...node.data },
      position: { x: node.position.x + 48, y: node.position.y + 48 },
      selected: true,
    }));
    saveToHistory();
    safeSetStoreNodes([...storeNodes.map((node) => ({ ...node, selected: false })), ...pasted]);
    copiedCanvasNodesRef.current = pasted.map((node) => ({ ...node, selected: false }));
    toast.success(`已粘贴 ${pasted.length} 个节点`);
  }, [storeNodes, saveToHistory, safeSetStoreNodes]);
  const { alignLeft, alignCenter, alignRight, alignTop, alignMiddle, alignBottom } =
    useNodeAlignment(storeNodes, selectedNodeIds, safeSetStoreNodes, saveToHistory);

  const { handleAutoLayout } = useAutoLayout(
    storeNodes,
    storeEdges,
    safeSetStoreNodes,
    saveToHistory,
    fitView,
    selectedNodeIds
  );

  const effectiveVirtualRenderThreshold = Math.min(virtualRenderThreshold, 8);
  const shouldUseVirtualizedFlow =
    virtualRenderEnabled && storeNodes.length > effectiveVirtualRenderThreshold;
  const FlowCanvasComponent = shouldUseVirtualizedFlow ? VirtualizedFlow : ReactFlow;
  const displayEdges = useMemo(() => {
    if (selectedEdgeId === null) return storeEdges;
    return storeEdges.map((edge) =>
      edge.id === selectedEdgeId
        ? { ...edge, selected: true }
        : edge.selected
          ? { ...edge, selected: false }
          : edge
    );
  }, [storeEdges, selectedEdgeId]);

  // ==================== 事件监听 ====================

  useEffect(() => {
    const timer = setTimeout(() => {
      preloadCommonNodeTypes();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleOpenPerformanceMonitor = () => {
      showPanel('performance');
    };
    const handleOpenSearchPanel = () => {
      showPanel('search');
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'openPerformanceMonitor' && e.newValue === 'true') {
        localStorage.removeItem('openPerformanceMonitor');
        handleOpenPerformanceMonitor();
      }
    };
    const handleCustom = () => {
      handleOpenPerformanceMonitor();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('open-performance-monitor', handleCustom);
    window.addEventListener('open-search-panel', handleOpenSearchPanel);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('open-performance-monitor', handleCustom);
      window.removeEventListener('open-search-panel', handleOpenSearchPanel);
    };
  }, [showPanel]);

  useOnViewportChange({
    onChange: useCallback((vp: { x: number; y: number; zoom: number }) => {
      localViewportRef.current = vp;
    }, []),
  });

  useEffect(() => {
    const unsubState = workflowDebuggerService.subscribeToDebugState((state: DebugState) => {
      debugStateRef.current = state;
    });
    const unsubBps = workflowDebuggerService.subscribeToBreakpoints(() => {
      /* noop */
    });
    return () => {
      unsubState();
      unsubBps();
    };
  }, []);

  useEffect(() => {
    onOpenSaveModalRef.current = onOpenSaveModal;
  }, [onOpenSaveModal]);

  // ==================== 工程自动保存 ====================
  const projectInitRef = useRef(false);

  useEffect(() => {
    if (projectInitRef.current) return;
    projectInitRef.current = true;

    const getCurrentCanvasData = () => {
      const state = useCanvasStore.getState();
      const vp = localViewportRef.current;
      return { nodes: state.nodes, edges: state.edges, viewport: vp };
    };

    canvasProjectService.startAutoSave(getCurrentCanvasData);

    const { nodes: rehydratedNodes } = useCanvasStore.getState();
    const hasRehydratedState = rehydratedNodes.length > 0;

    const activeId = canvasProjectService.getCurrentProjectId();
    if (activeId) {
      if (hasRehydratedState) {
        canvasProjectService.saveNow();
      } else {
        canvasProjectService
          .loadProject(activeId)
          .then((project) => {
            if (project && project.nodes && project.nodes.length > 0) {
              const currentState = useCanvasStore.getState();
              const currentProjectId = canvasProjectService.getCurrentProjectId();
              if (
                !shouldApplyLoadedCanvasProject({
                  requestedProjectId: activeId,
                  currentProjectId,
                  currentNodeCount: currentState.nodes.length,
                })
              ) {
                if (currentProjectId === activeId && currentState.nodes.length > 0) {
                  canvasProjectService.saveNow();
                }
                return;
              }
              const { setNodes, setEdges } = currentState;
              setNodes(project.nodes as any as Node[]);
              if (project.edges) setEdges(project.edges as any as Edge[]);
              if (project.viewport) {
                rfSetViewport(project.viewport);
              }
            }
          })
          .catch(() => {
            /* noop */
          });
      }
    } else {
      if (hasRehydratedState) {
        canvasProjectService.saveNow();
      }
    }

    const saveOnUnload = () => {
      canvasProjectService.flushDebouncedSave();
      const state = useCanvasStore.getState();
      const vp = localViewportRef.current;
      let projectId = canvasProjectService.getCurrentProjectId();
      if (!projectId && state.nodes.length > 0) {
        projectId = canvasProjectService.initProject();
      }
      if (!projectId) return;
      const existing = canvasProjectService.loadLocal(projectId);
      const timestamp = new Date().toISOString();
      canvasProjectService.saveLocal({
        id: projectId,
        name: existing?.name ?? '未命名项目',
        description: existing?.description,
        thumbnail: existing?.thumbnail,
        isFavorite: existing?.isFavorite ?? false,
        nodeCount: state.nodes.length,
        nodes: state.nodes,
        edges: state.edges,
        viewport: vp,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
    };

    const saveOnVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveOnUnload();
      }
    };

    window.addEventListener('beforeunload', saveOnUnload);
    document.addEventListener('visibilitychange', saveOnVisibilityChange);

    return () => {
      canvasProjectService.stopAutoSave();
      window.removeEventListener('beforeunload', saveOnUnload);
      document.removeEventListener('visibilitychange', saveOnVisibilityChange);
    };
  }, [rfSetViewport]);

  const prevNodeCountRef = useRef(storeNodes.length);
  const prevEdgeCountRef = useRef(storeEdges.length);
  useEffect(() => {
    const nodeCountChanged = storeNodes.length !== prevNodeCountRef.current;
    const edgeCountChanged = storeEdges.length !== prevEdgeCountRef.current;
    prevNodeCountRef.current = storeNodes.length;
    prevEdgeCountRef.current = storeEdges.length;
    if (nodeCountChanged || edgeCountChanged) {
      canvasProjectService.scheduleDebouncedSave();
    }
  }, [storeNodes.length, storeEdges.length]);

  // execute-node 事件监听：将节点执行请求转发给 realAPIExecutor
  // 原 CanvasToolbar 已从 UI 移除，监听器迁移至此
  useEffect(() => {
    const handleNodeExecute = (e: Event) => {
      const detail = (e as CustomEvent<{ nodeId?: string }>).detail;
      const nodeId = detail?.nodeId;
      void (async () => {
        if (nodeId) {
          await realAPIExecutor.executeSingleNode(nodeId);
        } else {
          await realAPIExecutor.executeWithRealAPI();
        }
      })();
    };
    window.addEventListener('execute-node', handleNodeExecute as EventListener);
    return () => {
      window.removeEventListener('execute-node', handleNodeExecute as EventListener);
    };
  }, []);

  // ==================== 节点/边变更 ====================
  // 使用 ref 保存最新状态，避免闭包问题
  const storeNodesRef = useRef(storeNodes);
  storeNodesRef.current = storeNodes;

  const storeEdgesRef = useRef(storeEdges);
  storeEdgesRef.current = storeEdges;

  // 拖拽节流：使用 rAF 合并高频 position 变更
  const dragRafRef = useRef<number>(0);
  const pendingDragChangesRef = useRef<NodeChange[]>([]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // 节点只能通过显式删除按钮/工具栏删除。React Flow 的隐式 remove
      // 事件可能在文件选择、拖放或重挂载期间误删当前节点。
      const filteredChanges = changes.filter((c) => c.type !== 'dimensions' && c.type !== 'remove');
      if (filteredChanges.length === 0) return;

      const draggingNow = filteredChanges.some(
        (c) => c.type === 'position' && 'dragging' in c && c.dragging
      );
      const dragEnded = filteredChanges.some(
        (c) => c.type === 'position' && 'dragging' in c && c.dragging === false
      );

      // 拖拽中：收集变更，用 rAF 合并更新，减少 store 写入频率
      if (draggingNow && !dragEnded) {
        dragActiveRef.current = true;
        pendingDragChangesRef.current.push(...filteredChanges);
        if (!dragRafRef.current) {
          dragRafRef.current = requestAnimationFrame(() => {
            dragRafRef.current = 0;
            const pending = pendingDragChangesRef.current;
            pendingDragChangesRef.current = [];
            if (pending.length === 0) return;
            const currentState = useCanvasStore.getState();
            const currentNodes = currentState.nodes;
            const updatedNodes = applyNodeChanges(pending, currentNodes);
            const changedNodeIds = pending.flatMap((change) => ('id' in change ? [change.id] : []));
            if (
              !didFlowNodesActuallyChange(
                currentNodes,
                updatedNodes,
                changedNodeIds,
                currentState.nodeIndex
              )
            )
              return;
            storeNodesRef.current = updatedNodes;
            setStoreNodesTransient(updatedNodes, changedNodeIds);
          });
        }
        return;
      }

      // 非拖拽或拖拽结束：立即处理
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = 0;
      }
      const allChanges: NodeChange[] =
        pendingDragChangesRef.current.length > 0
          ? [...pendingDragChangesRef.current, ...filteredChanges]
          : filteredChanges;
      pendingDragChangesRef.current = [];

      const currentState = useCanvasStore.getState();
      const currentNodes = currentState.nodes;
      const updatedNodes = applyNodeChanges(allChanges, currentNodes);
      const changedNodeIds = allChanges.flatMap((change) => ('id' in change ? [change.id] : []));
      if (
        !didFlowNodesActuallyChange(
          currentNodes,
          updatedNodes,
          changedNodeIds,
          currentState.nodeIndex
        )
      ) {
        return;
      }

      storeNodesRef.current = updatedNodes;
      const topologyPreserving = allChanges.every(
        (change) => change.type === 'position' || change.type === 'select'
      );
      if (topologyPreserving) {
        setStoreNodesTransient(updatedNodes, changedNodeIds);
      } else {
        setStoreNodes(updatedNodes);
      }

      const hasOnlySelect = filteredChanges.every((c) => c.type === 'select');
      if (hasOnlySelect) return;

      if (dragActiveRef.current && dragEnded) {
        dragActiveRef.current = false;
        saveToHistory();
        checkAutoEnableVirtualRender(updatedNodes.length);
        canvasProjectService.scheduleDebouncedSave();
        return;
      }

      const hasSignificant = filteredChanges.some((c) => c.type === 'position' || c.type === 'add');
      if (hasSignificant) {
        saveToHistory();
        checkAutoEnableVirtualRender(updatedNodes.length);
        canvasProjectService.scheduleDebouncedSave();
      }
    },
    [setStoreNodes, setStoreNodesTransient, saveToHistory]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const hasOnlySelect = changes.every((c) => c.type === 'select');
      if (hasOnlySelect) return;

      const updatedEdges = applyEdgeChanges(changes, storeEdgesRef.current);
      setStoreEdges(updatedEdges);
      const hasSignificantChange = changes.some((c) => c.type !== 'select');
      if (hasSignificantChange) {
        saveToHistory();
        canvasProjectService.scheduleDebouncedSave();
      }
    },
    [setStoreEdges, saveToHistory]
  );

  useEffect(() => {
    const unsubscribe = nodeEventBus.subscribe('node:added', (data: unknown) => {
      if ((data as { node?: Node })?.node) {
        const node = (data as { node: Node }).node;
        const currentNodes = useCanvasStore.getState().nodes;
        if (currentNodes.some((n) => n.id === node.id)) {
          return;
        }
        const positionedNode = resolveNonOverlappingCanvasNode(node, currentNodes);
        safeSetStoreNodes([...currentNodes, positionedNode]);
        saveToHistory();
        canvasProjectService.scheduleDebouncedSave();
      }
    });
    return unsubscribe;
  }, [safeSetStoreNodes, saveToHistory]);

  useEffect(() => {
    const unsubscribe = nodeEventBus.subscribe('node:deleted', (data: unknown) => {
      if ((data as { nodeId?: string })?.nodeId) {
        const nid = (data as { nodeId: string }).nodeId;
        const deletedNode = useCanvasStore.getState().nodes.find((n) => n.id === nid);
        if (deletedNode) {
          const urlsToRevoke: string[] = [];
          const d = deletedNode.data || {};
          if (typeof d.imageUrl === 'string' && d.imageUrl.startsWith('blob:'))
            urlsToRevoke.push(d.imageUrl);
          if (typeof d.videoUrl === 'string' && d.videoUrl.startsWith('blob:'))
            urlsToRevoke.push(d.videoUrl);
          if (typeof d.thumbnailUrl === 'string' && d.thumbnailUrl.startsWith('blob:'))
            urlsToRevoke.push(d.thumbnailUrl);
          urlsToRevoke.forEach((u) => URL.revokeObjectURL(u));
        }
        const { nodes, edges } = useCanvasStore.getState();
        safeSetStoreNodes(nodes.filter((n) => n.id !== nid));
        setStoreEdges(edges.filter((e) => e.source !== nid && e.target !== nid));
        saveToHistory();
        canvasProjectService.scheduleDebouncedSave();
      }
    });
    return unsubscribe;
  }, [safeSetStoreNodes, setStoreEdges, saveToHistory]);

  // ==================== 节点打组 ====================

  const handleGroupNodes = useCallback(() => {
    if (selectedNodes.length < 2) return;
    const group = aicgGroupService.createGroup(selectedNodes);
    if (group) setGroupRefreshKey((k) => k + 1);
  }, [selectedNodes]);

  const handleUngroupNodes = useCallback(() => {
    if (selectedNodes.length === 0) return;
    aicgGroupService.ungroupSelection(selectedNodes);
    setGroupRefreshKey((k) => k + 1);
  }, [selectedNodes]);

  const handleInsertAICGWorkflow = useCallback(
    (template: AICGWorkflowTemplate, at?: { x: number; y: number }) => {
      let origin = at;
      if (!origin) {
        try {
          const vp = getViewport();
          const rect = reactFlowWrapper.current?.getBoundingClientRect();
          if (rect && vp?.zoom > 0) {
            origin = screenToFlowPosition({
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            });
          }
        } catch {
          origin = { x: 120, y: 120 };
        }
      }
      const { nodes, edges } = instantiateAICGWorkflow(template, origin || { x: 120, y: 120 });
      for (const n of nodes) canvasStoreApi.addNode(n as never);
      for (const e of edges) canvasStoreApi.addEdge(e);
      toast.success(`已插入工作流「${template.name}」`);
    },
    [getViewport, screenToFlowPosition]
  );

  const getCanvasCenter = useCallback(() => {
    try {
      const rect = reactFlowWrapper.current?.getBoundingClientRect();
      if (rect) {
        return screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }
    } catch {
      // Fall through to stable default.
    }
    return { x: 120, y: 120 };
  }, [screenToFlowPosition]);

  const handleCreateShotNodes = useCallback(
    (shot: Shot, origin?: { x: number; y: number }) => {
      const group = createShotNodeGroup(shot, { origin: origin || getCanvasCenter() });
      for (const node of group.nodes) {
        canvasStoreApi.addNode(node);
      }
      for (const edge of group.edges) {
        canvasStoreApi.addEdge(edge);
      }
      useShotStore.getState().updateShot(shot.id, {
        status: 'nodes_created',
        nodeLinks: group.nodeLinks,
      });
      canvasProjectService.scheduleDebouncedSave();
      saveToHistory();
      toast.success(`已为「${shot.title}」创建 ${group.nodes.length} 个节点`);
    },
    [getCanvasCenter, saveToHistory]
  );

  const handleCreateAllShotNodes = useCallback(
    (shots: Shot[]) => {
      const origin = getCanvasCenter();
      for (const shot of shots) {
        handleCreateShotNodes(shot, origin);
      }
      setTimeout(() => fitView({ padding: 0.18, duration: 500 }), 50);
    },
    [fitView, getCanvasCenter, handleCreateShotNodes]
  );

  const handleFocusShotNodes = useCallback(
    (shot: Shot) => {
      const ids = Object.values(shot.nodeLinks || {}).filter((id): id is string => Boolean(id));
      if (ids.length === 0) return;
      const nodes = storeNodesRef.current.filter((node) => ids.includes(node.id));
      if (nodes.length === 0) return;
      const first = nodes[0];
      canvasStoreApi.setSelectedNodeIds(ids);
      setSelectedNodes(ids);
      setCenter(first.position.x + 420, first.position.y + 140, { zoom: 0.7, duration: 320 });
    },
    [setCenter]
  );

  const handleStoryboardNavigation = useCallback(
    (detail: StoryboardNavigateDetail | null) => {
      if (!detail?.shotId) return;
      if (detail.ts <= lastStoryboardNavigationTsRef.current) return;
      lastStoryboardNavigationTsRef.current = detail.ts;

      const shot = useShotStore.getState().shots.find((item) => item.id === detail.shotId);
      setShowStoryboard(true);

      if (!shot) {
        toast.warning('未找到对应分镜，已打开分镜导演');
        return;
      }

      useShotStore.getState().selectShot(detail.shotId);
      if (detail.focusNodes !== false) {
        window.setTimeout(() => handleFocusShotNodes(shot), 80);
      }
      toast.success(`已定位到「${shot.title}」`);
    },
    [handleFocusShotNodes]
  );

  useEffect(() => {
    const pending = consumePendingStoryboardNavigation();
    if (pending) {
      window.setTimeout(() => handleStoryboardNavigation(pending), 60);
    }

    const onFocusShot = (e: Event) => {
      handleStoryboardNavigation((e as CustomEvent<StoryboardNavigateDetail>).detail);
    };

    window.addEventListener(STORYBOARD_FOCUS_SHOT_EVENT, onFocusShot as EventListener);
    return () =>
      window.removeEventListener(STORYBOARD_FOCUS_SHOT_EVENT, onFocusShot as EventListener);
  }, [handleStoryboardNavigation]);

  const handleSyncShotResults = useCallback(() => {
    const summary = syncAllShotResultsFromNodes(
      useCanvasStore.getState().nodes as Node<Record<string, unknown>>[]
    );
    return summary.syncedCount;
  }, []);

  const handleExecuteShot = useCallback((shot: Shot) => {
    void executeShot(shot);
  }, []);

  const handleExecuteAllShots = useCallback((shots: Shot[]) => {
    void executeShots(shots);
  }, []);

  const handleExecuteSelectedGroup = useCallback(async () => {
    const groups = aicgGroupService.getGroupsForSelection(selectedNodes);
    if (groups.length === 0) {
      toast.info('请先 Ctrl+G 将选中节点打组');
      return;
    }
    await executeAICGGroup(groups[0].id);
  }, [selectedNodes]);

  // ==================== 快捷键 ====================

  const handleAddNodeInternal = useCallback(
    (nodeType: NodeTypeDefinition, atFlowPosition?: { x: number; y: number }) => {
      try {
        if (!nodeType?.id) return;
        const resolvedId = resolveQuickAddNodeType(nodeType.id);
        const resolvedDef = resolveNodeDefinition(resolvedId) || nodeType;
        let viewportBounds: { x: number; y: number; width: number; height: number } | null = null;
        let nodeX = atFlowPosition?.x ?? 0;
        let nodeY = atFlowPosition?.y ?? 0;
        if (!atFlowPosition) {
          if (lastMouseFlowPosRef.current) {
            nodeX = lastMouseFlowPosRef.current.x;
            nodeY = lastMouseFlowPosRef.current.y;
          }
          if (nodeX === 0 && nodeY === 0) {
            try {
              const rect = reactFlowWrapper.current?.getBoundingClientRect();
              if (rect) {
                const topLeft = screenToFlowPosition({ x: rect.left, y: rect.top });
                const bottomRight = screenToFlowPosition({ x: rect.right, y: rect.bottom });
                viewportBounds = {
                  x: Math.min(topLeft.x, bottomRight.x),
                  y: Math.min(topLeft.y, bottomRight.y),
                  width: Math.abs(bottomRight.x - topLeft.x),
                  height: Math.abs(bottomRight.y - topLeft.y),
                };
                nodeX = viewportBounds.x + viewportBounds.width / 2;
                nodeY = viewportBounds.y + viewportBounds.height / 2;
              } else {
                const vp = getViewport();
                if (vp?.zoom > 0) {
                  const containerWidth = window.innerWidth;
                  const containerHeight = window.innerHeight;
                  nodeX = (-vp.x + containerWidth / 2) / vp.zoom;
                  nodeY = (-vp.y + containerHeight / 2) / vp.zoom;
                }
              }
            } catch {
              /* use default */
            }
          }
        }

        const newNode: Node = {
          id: generateId(),
          type: resolvedId,
          position: { x: Math.round(nodeX), y: Math.round(nodeY) },
          data: withCanvasNodeDefaultSize(resolvedId, buildNodeDataFromDefinition(resolvedDef)),
        };
        const collisionResolvedNode = viewportBounds
          ? resolveNonOverlappingCanvasNodeInViewport(
              newNode,
              storeNodesRef.current || [],
              viewportBounds
            )
          : resolveNonOverlappingCanvasNode(newNode, storeNodesRef.current || []);
        const displacementFromPointer = Math.hypot(
          collisionResolvedNode.position.x - nodeX,
          collisionResolvedNode.position.y - nodeY
        );
        const positionedNode =
          displacementFromPointer > 360
            ? {
                ...newNode,
                position: { x: Math.round(nodeX + 28), y: Math.round(nodeY + 28) },
              }
            : collisionResolvedNode;
        safeSetStoreNodes([...(storeNodesRef.current || []), positionedNode]);
        setSelectedNodeId(positionedNode.id);
        setSelectedNodes([positionedNode.id]);
        canvasStoreApi.setSelectedNodeIds([positionedNode.id]);
        saveToHistory();
        canvasProjectService.scheduleDebouncedSave();
        try {
          useVirtualRenderStore.getState().addRecentlyAddedNode(positionedNode.id);
        } catch {
          /* ignore */
        }
        // 防遮挡可能把新节点推到视口外，导致用户看不到刚创建的节点。
        // 检查最终位置是否在当前视口内，不在则平滑居中视野到该节点。
        try {
          const vp = getViewport();
          const rect = reactFlowWrapper.current?.getBoundingClientRect();
          if (rect && vp?.zoom > 0) {
            const vLeft = -vp.x / vp.zoom;
            const vTop = -vp.y / vp.zoom;
            const vRight = vLeft + rect.width / vp.zoom;
            const vBottom = vTop + rect.height / vp.zoom;
            const size = getCanvasNodeDimensionsFromNode(positionedNode);
            const nx = positionedNode.position.x;
            const ny = positionedNode.position.y;
            const inViewport =
              nx + size.width > vLeft && nx < vRight && ny + size.height > vTop && ny < vBottom;
            if (!inViewport) {
              setCenter(nx + size.width / 2, ny + size.height / 2, {
                zoom: vp.zoom,
                duration: 320,
              });
            }
          }
        } catch {
          /* viewport check best-effort */
        }
      } catch (error) {
        console.error('[FlowEditor] 添加节点时出错:', error);
      }
    },
    [
      safeSetStoreNodes,
      saveToHistory,
      getViewport,
      screenToFlowPosition,
      setSelectedNodeId,
      setCenter,
    ]
  );

  const handleAddNode = handleAddNodeInternal;

  useEffect(() => {
    if (isBackgroundLayer) return;
    const raw = window.sessionStorage.getItem('aicg:home-launch-node');
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as {
        nodeType?: string;
        prompt?: string;
        script?: string;
        storyboardOutputMode?: string;
        storyboardPanelCount?: number;
        storyboardSegments?: Array<{ id?: string; title?: string; script?: string; sourceBlockCount?: number }>;
        storyboardExecutionPolicy?: string;
        imageUrl?: string;
        title?: string;
        source?: string;
        openPromptOnCreate?: boolean;
        autoExpandPrompt?: boolean;
        createdAt?: number;
      };
      window.sessionStorage.removeItem('aicg:home-launch-node');
      const nodeType =
        payload.nodeType === 'storyboardMaker'
          ? 'storyboardMaker'
          : payload.nodeType === 'aiVideo'
            ? 'aiVideo'
            : 'aiImage';
      const prompt = String(payload.prompt || '').trim();
      const imageUrl = typeof payload.imageUrl === 'string' ? payload.imageUrl.trim() : '';
      if (!prompt || Date.now() - Number(payload.createdAt || 0) > 5 * 60 * 1000) return;

      const def = resolveNodeDefinition(nodeType);
      if (!def) return;
      const baseData = withCanvasNodeDefaultSize(nodeType, buildNodeDataFromDefinition(def));
      const center = getCanvasCenter();
      const nodeSize = getCanvasNodeDimensions(nodeType);
      const centeredPosition = {
        x: Math.round(center.x - nodeSize.width / 2),
        y: Math.round(center.y - nodeSize.height / 2),
      };
      const referencePatch =
        nodeType === 'aiImage' && imageUrl
          ? {
              imageUrl,
              resultUrl: imageUrl,
              resultUrls: [imageUrl],
              receivedImageUrl: imageUrl,
              task: { status: 'completed', progress: 100, resultUrl: imageUrl },
              references: {
                style: [
                  {
                    id: `home-preset-${Date.now()}`,
                    url: imageUrl,
                    name: payload.title || '首页图片预设',
                    weight: 0.75,
                    source: 'input',
                  },
                ],
              },
            }
          : {};
      const shouldOpenPromptOnCreate = Boolean(
        nodeType === 'aiImage' && (payload.openPromptOnCreate || payload.autoExpandPrompt)
      );
      const storyboardSegments = nodeType === 'storyboardMaker' && Array.isArray(payload.storyboardSegments)
        ? payload.storyboardSegments
            .filter((segment) => typeof segment?.script === 'string' && segment.script.trim())
            .slice(0, 20)
        : [];
      const launchItems = storyboardSegments.length > 0
        ? storyboardSegments
        : [{ id: 'storyboard-segment-1', title: '', script: String(payload.script || prompt) }];
      const newNodes: Node[] = launchItems.map((segment, segmentIndex) => ({
        id: generateId(),
        type: nodeType,
        position: nodeType === 'storyboardMaker' && launchItems.length > 1
          ? {
              x: centeredPosition.x + (segmentIndex % 4) * (nodeSize.width + 48),
              y: centeredPosition.y + Math.floor(segmentIndex / 4) * (nodeSize.height + 48),
            }
          : centeredPosition,
        data: {
          ...baseData,
          ...referencePatch,
          ...(nodeType === 'storyboardMaker'
            ? {
                type: 'storyboardMaker',
                script: String(segment.script || payload.script || prompt),
                storyboardSegmentId: segment.id || `storyboard-segment-${segmentIndex + 1}`,
                storyboardSegmentTitle: segment.title || `12宫格分镜段落 ${segmentIndex + 1}`,
                storyboardSegmentIndex: segmentIndex,
                storyboardSegmentCount: launchItems.length,
                storyboardExecutionPolicy: payload.storyboardExecutionPolicy || 'manual-single',
                storyboardOutputMode: payload.storyboardOutputMode || 'director_storyboard_sheet',
                storyboardPanelCount: Number(payload.storyboardPanelCount || 12),
                storyboardOutputSize: '1672x941',
                aspectRatio: '16:9',
              }
            : {}),
          prompt: segment.title ? `${segment.title}\n${prompt}` : prompt,
          source: payload.source,
          openPromptOnCreate: shouldOpenPromptOnCreate,
          autoExpandPrompt: shouldOpenPromptOnCreate,
          params: {
            ...((baseData.params as Record<string, unknown> | undefined) || {}),
            prompt: segment.title ? `${segment.title}\n${prompt}` : prompt,
            openPromptOnCreate: shouldOpenPromptOnCreate,
            autoExpandPrompt: shouldOpenPromptOnCreate,
            ...(nodeType === 'storyboardMaker'
              ? {
                  script: String(segment.script || payload.script || prompt),
                  storyboardSegmentId: segment.id || `storyboard-segment-${segmentIndex + 1}`,
                  storyboardSegmentTitle: segment.title || `12宫格分镜段落 ${segmentIndex + 1}`,
                  storyboardSegmentIndex: segmentIndex,
                  storyboardSegmentCount: launchItems.length,
                  storyboardExecutionPolicy: payload.storyboardExecutionPolicy || 'manual-single',
                  storyboardOutputMode: payload.storyboardOutputMode || 'director_storyboard_sheet',
                  storyboardPanelCount: Number(payload.storyboardPanelCount || 12),
                  storyboardOutputSize: '1672x941',
                  aspectRatio: '16:9',
                }
              : {}),
            ...(nodeType === 'aiImage' && imageUrl
              ? {
                  generationMode: 'reference',
                  referenceImage: imageUrl,
                }
              : {}),
          },
        },
      }));
      const firstNode = newNodes[0];
      safeSetStoreNodes([...(storeNodesRef.current || []), ...newNodes]);
      setSelectedNodeId(firstNode.id);
      setSelectedNodes([firstNode.id]);
      canvasStoreApi.setSelectedNodeIds([firstNode.id]);
      saveToHistory();
      canvasProjectService.scheduleDebouncedSave();
      try {
        newNodes.forEach((node) => useVirtualRenderStore.getState().addRecentlyAddedNode(node.id));
      } catch {
        /* ignore */
      }
    } catch {
      window.sessionStorage.removeItem('aicg:home-launch-node');
    }
  }, [
    isBackgroundLayer,
    safeSetStoreNodes,
    saveToHistory,
    setSelectedNodeId,
    getCanvasCenter,
  ]);

  const handleClearCanvas = useCallback(() => {
    resetCanvas();
    canvasProjectService.saveNow();
  }, [resetCanvas]);

  const handleCreateSnapshot = useCallback(() => {
    createSnapshot(storeNodesRef.current, storeEdgesRef.current);
  }, [createSnapshot]);

  const handleRestoreSnapshot = useCallback(
    (snapshot: { id: string }) => {
      const data = restoreSnapshot(snapshot.id);
      if (data) {
        safeSetStoreNodes(data.nodes);
        setStoreEdges(data.edges);
        saveToHistory();
        canvasProjectService.scheduleDebouncedSave();
        hidePanel('snapshots');
        setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
      }
    },
    [restoreSnapshot, safeSetStoreNodes, setStoreEdges, saveToHistory, fitView, hidePanel]
  );

  const handleAddBookmark = useCallback(() => {
    addBookmark(getViewport());
  }, [getViewport, addBookmark]);

  const handleGoToBookmark = useCallback(
    (bookmark: { id: string }) => {
      goToBookmark(bookmark.id);
      hidePanel('bookmarks');
    },
    [goToBookmark, hidePanel]
  );

  const jumpToNode = useCallback(
    (nodeId: string) => {
      const node = storeNodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        setCenter(node.position.x + 200, node.position.y + 100, { zoom: 1, duration: 300 });
        setSelectedNodeId(nodeId);
      }
      hidePanel('search');
    },
    [setCenter, setSelectedNodeId, hidePanel]
  );

  const paletteCommands = useCommandPaletteCommands(
    handleAddNode,
    () => {
      if (onOpenSaveModal) onOpenSaveModal();
    },
    () => {
      window.dispatchEvent(new CustomEvent('open-load-modal'));
    },
    handleClearCanvas,
    () => handleAutoLayout('horizontal'),
    handleCreateSnapshot
  );

  const shortcuts: KeyboardShortcut[] = useMemo(() => {
    const configured = (
      id: string,
      fallback: string,
      handler: KeyboardShortcut['handler'],
      description: string,
      priority = 10,
      options: Pick<KeyboardShortcut, 'allowInInput' | 'preventDefault'> = {}
    ) =>
      createConfiguredKeyboardShortcut(shortcutSettings[id], fallback, {
        handler,
        description,
        priority,
        ...options,
      });

    return [
      configured(
        'saveWorkflow',
        'Ctrl+S',
        () => window.dispatchEvent(new CustomEvent('open-save-modal')),
        '保存工作流',
        100,
        { allowInInput: true }
      ),
      configured(
        'openWorkflow',
        'Ctrl+O',
        () => window.dispatchEvent(new CustomEvent('open-load-modal')),
        '打开工作流',
        100,
        { allowInInput: true }
      ),
      configured('newWorkflow', 'Ctrl+N', handleClearCanvas, '新建工作流', 100),
      configured(
        'exportWorkflow',
        'Ctrl+E',
        () => window.dispatchEvent(new CustomEvent('export-workflow')),
        '导出工作流',
        100
      ),
      configured(
        'runWorkflow',
        'Ctrl+Enter',
        () => {
          void handleExecuteSelectedGroup();
        },
        '执行所选节点组',
        10
      ),
      configured('undo', 'Ctrl+Z', undo, '撤销', 100),
      configured('redo', 'Ctrl+Y', redo, '重做', 100),
      configured('delete', 'Delete', deleteSelectedNodes, '删除所选节点', 20),
      configured('copy', 'Ctrl+C', copySelectedNodesToClipboard, '复制所选节点', 20),
      configured('paste', 'Ctrl+V', pasteCopiedNodesFromClipboard, '粘贴节点', 20),
      configured('duplicate', 'Ctrl+D', duplicateSelectedNodes, '复制所选节点', 20),
      configured('selectAll', 'Ctrl+A', selectAllNodes, '全选节点', 20),
      configured(
        'cancel',
        'Escape',
        () => {
          if (panels.search) hidePanel('search');
          else if (contextMenuRef.current) closeContextMenu();
          else clearSelection();
        },
        '取消 / 关闭',
        20
      ),
      configured('nodeSearch', 'Ctrl+Space', () => showPanel('search'), '打开节点搜索', 20),
      configured('commandPalette', 'Ctrl+K', () => showPanel('commandPalette'), '打开命令面板', 20),
      configured('groupNodes', 'Ctrl+G', handleGroupNodes, '节点打组', 20),
      configured('ungroupNodes', 'Ctrl+Shift+G', handleUngroupNodes, '取消打组', 20),
      configured('autoLayout', 'Ctrl+L', () => handleAutoLayout('horizontal'), '自动水平布局', 20),
      configured(
        'zoomIn',
        '+',
        () => zoomIn({ duration: KEYBOARD_ZOOM_ANIMATION_MS }),
        '放大画布',
        5
      ),
      configured(
        'zoomOut',
        '-',
        () => zoomOut({ duration: KEYBOARD_ZOOM_ANIMATION_MS }),
        '缩小画布',
        5
      ),
      configured(
        'fitView',
        'Shift+F',
        () => fitView({ padding: 0.2, duration: 300 }),
        '适应全部视图',
        5
      ),
      configured(
        'resetZoom',
        '0',
        () => fitView({ duration: RESET_ZOOM_ANIMATION_MS }),
        '重置缩放',
        5
      ),
      configured('moveNodeUp', 'ArrowUp', () => moveSelectedNodes(0, -1), '所选节点上移', 5),
      configured('moveNodeDown', 'ArrowDown', () => moveSelectedNodes(0, 1), '所选节点下移', 5),
      configured('moveNodeLeft', 'ArrowLeft', () => moveSelectedNodes(-1, 0), '所选节点左移', 5),
      configured('moveNodeRight', 'ArrowRight', () => moveSelectedNodes(1, 0), '所选节点右移', 5),
    ].filter((shortcut): shortcut is KeyboardShortcut => shortcut !== null);
  }, [
    shortcutSettings,
    showPanel,
    hidePanel,
    panels.search,
    closeContextMenu,
    clearSelection,
    handleClearCanvas,
    handleExecuteSelectedGroup,
    handleGroupNodes,
    handleUngroupNodes,
    handleAutoLayout,
    undo,
    redo,
    deleteSelectedNodes,
    copySelectedNodesToClipboard,
    pasteCopiedNodesFromClipboard,
    duplicateSelectedNodes,
    selectAllNodes,
    zoomIn,
    zoomOut,
    fitView,
    moveSelectedNodes,
  ]);

  const isBindingModifierHeld = useCallback(
    (binding: string | undefined) => {
      const value = String(binding || '').toLowerCase();
      return (
        (!/\b(ctrl|control|cmd|meta)\b/.test(value) ||
          heldCanvasKeys.has('control') ||
          heldCanvasKeys.has('meta')) &&
        (!/\bshift\b/.test(value) || heldCanvasKeys.has('shift')) &&
        (!/\b(alt|option)\b/.test(value) || heldCanvasKeys.has('alt')) &&
        (!/\bspace\b/.test(value) || heldCanvasKeys.has('space'))
      );
    },
    [heldCanvasKeys]
  );

  const canvasPanButtons = useMemo(() => {
    const buttons = new Set<number>();
    const panBinding = shortcutSettings.panCanvas;
    const mousePanBinding = shortcutSettings.panWithMiddleMouse;
    if (bindingContains(panBinding, 'Left Mouse') && isBindingModifierHeld(panBinding))
      buttons.add(0);
    if (bindingContains(mousePanBinding, 'Left Mouse') && isBindingModifierHeld(mousePanBinding))
      buttons.add(0);
    if (bindingContains(mousePanBinding, 'Middle Mouse') && isBindingModifierHeld(mousePanBinding))
      buttons.add(1);
    if (bindingContains(mousePanBinding, 'Right Mouse') && isBindingModifierHeld(mousePanBinding))
      buttons.add(2);
    return Array.from(buttons);
  }, [shortcutSettings.panCanvas, shortcutSettings.panWithMiddleMouse, isBindingModifierHeld]);

  const boxSelectEnabled =
    bindingContains(shortcutSettings.boxSelect, 'Left Mouse') &&
    isBindingModifierHeld(shortcutSettings.boxSelect);
  const multiSelectionKeyCode = bindingContains(shortcutSettings.multiSelect, 'Ctrl')
    ? 'Control'
    : bindingContains(shortcutSettings.multiSelect, 'Alt')
      ? 'Alt'
      : 'Shift';

  const activeShortcuts = useMemo(
    () => (isBackgroundLayer ? [] : shortcuts),
    [isBackgroundLayer, shortcuts]
  );
  useKeyboardManager(activeShortcuts);

  // ==================== 连接处理 ====================

  const isValidConnection = useCallback((connection: Connection): boolean => {
    if (!connection.source || !connection.target) return false;
    if (connection.source === connection.target) return false;
    const sourceNode = storeNodesRef.current.find((n) => n.id === connection.source);
    const targetNode = storeNodesRef.current.find((n) => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;
    const validation = validateConnection(
      sourceNode,
      targetNode,
      connection.sourceHandle || undefined,
      connection.targetHandle || undefined,
      storeEdgesRef.current
    );
    return validation.valid;
  }, []);

  const createValidatedEdge = useCallback(
    (params: Connection) => {
      const sourceNode = storeNodesRef.current.find((n) => n.id === params.source);
      const sourceNodeType = sourceNode?.data?.type as string | undefined;
      const portType =
        sourceNodeType && params.sourceHandle
          ? getPortType(sourceNodeType, params.sourceHandle, 'source')
          : null;

      const newEdgeId = generateId();
      const newEdge: Edge = {
        ...params,
        id: newEdgeId,
        animated: true,
        type: 'comfyui',
        data: withEdgeSignalPulse({
          portType: portType || undefined,
          sourceNodeType: sourceNodeType || undefined,
        }),
      };

      setStoreEdges(addEdge(newEdge, storeEdgesRef.current));
      scheduleClearEdgeFlow([newEdgeId], () => useCanvasStore.getState().edges, setStoreEdges);
      canvasProjectService.scheduleDebouncedSave();
    },
    [setStoreEdges]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source === params.target && params.sourceHandle === params.targetHandle) {
        setStoreEdges(
          storeEdgesRef.current.filter(
            (e) => !(e.source === params.source && e.sourceHandle === params.sourceHandle)
          )
        );
        return;
      }
      if (!isValidConnection(params)) {
        const sourceNode = storeNodesRef.current.find((n) => n.id === params.source);
        const targetNode = storeNodesRef.current.find((n) => n.id === params.target);
        if (sourceNode && targetNode) {
          const validation = validateConnection(
            sourceNode,
            targetNode,
            params.sourceHandle || undefined,
            params.targetHandle || undefined,
            storeEdgesRef.current
          );
          toast.error(validation.error || '连接无效');
        } else {
          toast.error('连接无效');
        }
        return;
      }

      createValidatedEdge(params);
      connectingSourceRef.current = null;
    },
    [createValidatedEdge, isValidConnection, setStoreEdges]
  );

  const onConnectStart = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      params: { nodeId: string | null; handleId: string | null; handleType: HandleType | null }
    ) => {
      if (params.nodeId && params.handleId) {
        const sourceNode = storeNodesRef.current.find((n) => n.id === params.nodeId);
        const sourceNodeType =
          (sourceNode?.data?.type as string) || (sourceNode?.type as string) || '';
        let handleId = params.handleId;
        const options = getQuickAddOptions(sourceNodeType, handleId);
        if (options.length === 0) {
          const fallbackHandle = sourceNode?.type === 'gridSplitter' ? 'output' : handleId;
          handleId = fallbackHandle;
        }
        connectingSourceRef.current = {
          nodeId: params.nodeId,
          handleId,
          nodeType: sourceNodeType,
        };
      } else {
        connectingSourceRef.current = null;
      }
    },
    []
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const source = connectingSourceRef.current;
      connectingSourceRef.current = null;

      if (!source) return;

      const options = getQuickAddOptions(source.nodeType, source.handleId);
      if (options.length === 0) return;

      const clientX = 'clientX' in event ? event.clientX : 0;
      const clientY = 'clientY' in event ? event.clientY : 0;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });

      setConnectEndQuickAdd({
        x: clientX,
        y: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
        sourceNodeId: source.nodeId,
        sourceHandleId: source.handleId,
        sourceNodeType: source.nodeType,
        options,
      });
    },
    [screenToFlowPosition]
  );

  const handleConnectEndCreateNode = useCallback(
    (option: HandleQuickAddOption) => {
      if (!connectEndQuickAdd) return;

      const { sourceNodeId, sourceHandleId, sourceNodeType, flowX, flowY } = connectEndQuickAdd;
      const newNodeId = generateId();
      const resolvedNodeType = resolveQuickAddNodeType(option.nodeType);
      const targetHandle =
        option.targetHandle || getDefaultTargetHandle(option.nodeType, sourceNodeType);
      const newNode: Node = {
        id: newNodeId,
        type: resolvedNodeType,
        position: { x: flowX, y: flowY },
        data: buildDefaultNodeData(option.nodeType, option.initialData),
      };

      const sourceNode = storeNodesRef.current.find((node) => node.id === sourceNodeId);
      if (!sourceNode) {
        setConnectEndQuickAdd(null);
        toast.error('源节点不存在，无法自动连接');
        return;
      }

      const validation = validateConnection(
        sourceNode,
        newNode,
        sourceHandleId,
        targetHandle,
        storeEdgesRef.current
      );
      if (!validation.valid) {
        setConnectEndQuickAdd(null);
        toast.error(validation.error || '端口不兼容，无法自动连接');
        return;
      }

      canvasStoreApi.addNode(newNode as never);

      requestAnimationFrame(() => {
        setTimeout(() => {
          createValidatedEdge({
            source: sourceNodeId,
            sourceHandle: sourceHandleId,
            target: newNodeId,
            targetHandle,
          });
        }, 50);
      });

      setConnectEndQuickAdd(null);
      toast.success(`已创建「${option.label}」并连接`);
    },
    [connectEndQuickAdd, createValidatedEdge]
  );

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (event.shiftKey) {
        setStoreEdges(storeEdgesRef.current.filter((e) => e.id !== edge.id));
        setSelectedEdgeId(null);
        canvasProjectService.scheduleDebouncedSave();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const result = toggleEdgeSelection({
        selectedEdgeId,
        clickedEdgeId: edge.id,
        edges: storeEdgesRef.current,
      });
      setSelectedEdgeId(result.selectedEdgeId);
      if (result.removed) {
        setStoreEdges(result.edges);
        canvasProjectService.scheduleDebouncedSave();
      } else {
        pulseEdgeSignal(edge.id, () => useCanvasStore.getState().edges, setStoreEdges);
      }
    },
    [selectedEdgeId, setStoreEdges]
  );

  useEffect(() => {
    const pulseFromNode = (nodeId: string) => {
      pulseNodeEdgeSignals(nodeId, () => useCanvasStore.getState().edges, setStoreEdges);
    };
    const unsubExec = nodeEventBus.subscribe('node:executed', ({ nodeId, success }) => {
      pulseFromNode(nodeId);
      const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId);
      syncShotResultFromNode(node as Node<Record<string, unknown>> | undefined, success);
    });
    const unsubSync = nodeEventBus.subscribe('downstream:synced', ({ sourceNodeId }) =>
      pulseFromNode(sourceNodeId)
    );
    return () => {
      unsubExec();
      unsubSync();
    };
  }, [setStoreEdges]);

  // ==================== 节点拖拽 ====================

  const onNodeDragStart = useCallback((event: any, _node: Node) => {
    isAltDraggingRef.current = event.altKey;
    dragActiveRef.current = true;
    setIsCanvasInteracting(true);
  }, []);

  const onNodeDragStop = useCallback(
    (_event: any, node: Node) => {
      dragActiveRef.current = false;
      setIsCanvasInteracting(false);
      if (isAltDraggingRef.current) {
        isAltDraggingRef.current = false;
        const connectedEdges = storeEdgesRef.current.filter(
          (e) => e.source === node.id || e.target === node.id
        );
        const newNodeId = generateId();
        const newNode: Node = {
          ...node,
          id: newNodeId,
          position: { x: node.position.x + 50, y: node.position.y + 50 },
          data: { ...node.data },
          selected: true,
        };
        const positionedNode = resolveNonOverlappingCanvasNode(newNode, storeNodesRef.current);
        const newEdges = connectedEdges.map((edge) => ({
          ...edge,
          id: generateId(),
          source: edge.source === node.id ? newNodeId : edge.source,
          target: edge.target === node.id ? newNodeId : edge.target,
        }));
        safeSetStoreNodes([...storeNodesRef.current, positionedNode]);
        if (newEdges.length > 0) setStoreEdges([...storeEdgesRef.current, ...newEdges]);
        safeSetStoreNodes(
          storeNodesRef.current.map((n) => ({
            ...n,
            selected: n.id === node.id ? false : n.selected,
          }))
        );
        canvasProjectService.scheduleDebouncedSave();
      }
    },
    [safeSetStoreNodes, setStoreEdges]
  );

  const onCanvasMoveStart = useCallback(() => {
    setIsCanvasInteracting(true);
  }, []);

  const onCanvasMoveEnd = useCallback(() => {
    setIsCanvasInteracting(false);
  }, []);

  // ==================== 选择处理 ====================

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedEdgeId(null);
      if (event.ctrlKey || event.metaKey) {
        setSelectedNodes((prev) =>
          prev.includes(node.id) ? prev.filter((id) => id !== node.id) : [...prev, node.id]
        );
      } else {
        setSelectedNodeId(node.id);
        setSelectedNodes([node.id]);
      }
    },
    [setSelectedNodeId]
  );

  const onSelectionChange = useCallback(
    ({ nodes: selNodes }: { nodes: Node[] }) => {
      setSelectedEdgeId(null);
      const ids = selNodes.map((n) => n.id);
      canvasStoreApi.setSelectedNodeIds(ids);
      setSelectedNodeId(ids[0] || null);
      setSelectedNodes(ids);
      if (ids.length > 0) {
      }
    },
    [setSelectedNodeId]
  );

  const paneClickRef = useRef({ time: 0, x: 0, y: 0 });
  const lastMouseFlowPosRef = useRef<{ x: number; y: number } | null>(null);

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      setSelectedEdgeId(null);
      setSelectedNodeId(null);
      setSelectedNodes([]);
      setContextMenu(null);

      const now = Date.now();
      const prev = paneClickRef.current;
      const isDoubleClick =
        now - prev.time < 350 &&
        Math.abs(event.clientX - prev.x) < 12 &&
        Math.abs(event.clientY - prev.y) < 12;

      if (isDoubleClick) {
        event.preventDefault();
        event.stopPropagation();
        const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        setPaneQuickAdd({
          x: event.clientX,
          y: event.clientY,
          flowX: flowPos.x,
          flowY: flowPos.y,
        });
        setShowQuickAdd(false);
        paneClickRef.current = { time: 0, x: 0, y: 0 };
        return;
      }

      paneClickRef.current = { time: now, x: event.clientX, y: event.clientY };
      setPaneQuickAdd(null);
    },
    [screenToFlowPosition, setSelectedNodeId]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.react-flow__handle, [data-aicg-handle]')) {
        return;
      }
      event.preventDefault();
      openContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [openContextMenu]
  );

  const onPaneMouseMove = useCallback(
    (event: React.MouseEvent) => {
      try {
        lastMouseFlowPosRef.current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      } catch {
        /* ignore */
      }
    },
    [screenToFlowPosition]
  );

  useEffect(() => {
    const trackPointer = (event: PointerEvent) => {
      const rect = reactFlowWrapper.current?.getBoundingClientRect();
      if (!rect) return;
      try {
        lastMouseFlowPosRef.current = screenToFlowPosition({
          x: Math.min(rect.right, Math.max(rect.left, event.clientX)),
          y: Math.min(rect.bottom, Math.max(rect.top, event.clientY)),
        });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointermove', trackPointer, { passive: true });
    return () => window.removeEventListener('pointermove', trackPointer);
  }, [screenToFlowPosition]);

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const clientX = (event as MouseEvent).clientX || (event as React.MouseEvent).clientX;
      const clientY = (event as MouseEvent).clientY || (event as React.MouseEvent).clientY;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setContextMenu(null);
      setShowQuickAdd(false);
      setPaneQuickAdd({
        x: clientX,
        y: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });
    },
    [screenToFlowPosition]
  );

  // ==================== 文件拖放 ====================

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length === 0) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const adjustedPosition = { x: position.x - 160, y: position.y - 100 };
      const { addNode } = useCanvasStore.getState();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) continue;

        try {
          const nodeId = generateId();
          const persisted = await persistImportedCanvasFile({
            nodeId,
            kind: isImage ? 'image' : 'video',
            file,
          });
          const thumbnailUrl = isImage
            ? await createImageThumbnail(file)
            : await createVideoThumbnail(file);

          if (isImage) {
            addNode({
              id: nodeId,
              type: 'imageInput',
              position: {
                x:
                  adjustedPosition.x +
                  i * (getCanvasNodeDimensions('imageInput').width + CANVAS_NODE_HORIZONTAL_GAP),
                y: adjustedPosition.y + i * CANVAS_NODE_VERTICAL_GAP,
              },
              data: withCanvasNodeDefaultSize('imageInput', {
                type: 'imageInput',
                imageAssetId: persisted.asset.id,
                imageUrl: persisted.runtimeUrl || '',
                thumbnailUrl: thumbnailUrl || persisted.runtimeUrl || '',
                fileName: file.name,
              }),
            });
          } else {
            addNode({
              id: nodeId,
              type: 'videoInput',
              position: {
                x:
                  adjustedPosition.x +
                  i * (getCanvasNodeDimensions('videoInput').width + CANVAS_NODE_HORIZONTAL_GAP),
                y: adjustedPosition.y + i * CANVAS_NODE_VERTICAL_GAP,
              },
              data: withCanvasNodeDefaultSize('videoInput', {
                type: 'videoInput',
                videoAssetId: persisted.asset.id,
                videoUrl: persisted.runtimeUrl || '',
                thumbnailUrl: thumbnailUrl || '',
                fileName: file.name,
              }),
            });
          }
        } catch (error) {
          console.error('[FlowEditor] Error processing file:', error);
        }
      }
      canvasProjectService.scheduleDebouncedSave();
    },
    [screenToFlowPosition]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const items = Array.from(event.dataTransfer.items);
    if (items.some((item) => item.kind === 'file')) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (event.currentTarget === event.target) setIsDragging(false);
  }, []);

  // ==================== 辅助函数 ====================

  const getNodeColor = useCallback((node: Node) => getCanvasNodeColor(node), []);

  const handleAddFrame = useCallback(() => {
    const vp = getViewport();
    const colors = ['#6610F2', '#007AFF', '#10B981', '#F97316', '#EC4899', '#06B6D4'];
    setFrames((prev) => [
      ...prev,
      {
        id: `frame-${Date.now()}`,
        name: `场景 ${prev.length + 1}`,
        x: -vp.x / vp.zoom + 100,
        y: -vp.y / vp.zoom + 100,
        width: 600,
        height: 400,
        color: colors[prev.length % colors.length],
      },
    ]);
  }, [getViewport]);

  // ==================== 右键菜单稳定回调 ====================
  const handleContextMenuAddNode = useCallback(
    (nodeType: NodeTypeDefinition) => {
      handleAddNode(nodeType);
    },
    [handleAddNode]
  );

  const handleContextMenuAlignNodes = useCallback(
    (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      const alignMap: Record<string, () => void> = {
        left: alignLeft,
        center: alignCenter,
        right: alignRight,
        top: alignTop,
        middle: alignMiddle,
        bottom: alignBottom,
      };
      alignMap[alignment]?.();
    },
    [alignLeft, alignCenter, alignRight, alignTop, alignMiddle, alignBottom]
  );

  const handleContextMenuFitView = useCallback(() => {
    fitView({ duration: 300 });
  }, [fitView]);

  const handleContextMenuClearFrames = useCallback(() => {
    setFrames([]);
  }, []);

  const handleContextMenuExecuteGroup = useCallback(() => {
    void handleExecuteSelectedGroup();
  }, [handleExecuteSelectedGroup]);

  const handleContextMenuOpenToolbox = useCallback(() => {
    setShowToolbox(true);
  }, []);

  // ==================== 渲染 ====================

  return (
    <>
      {panels.focusEdit && (
        <FocusEditMode
          onClose={() => hidePanel('focusEdit')}
          onExtractElement={(_element: unknown) => {
            hidePanel('focusEdit');
          }}
        />
      )}

      <div
        className={cn(
          'flex w-full h-full relative',
          isBackgroundLayer && 'pointer-events-none select-none opacity-0'
        )}
        aria-hidden={isBackgroundLayer}
      >
        <div
          ref={reactFlowWrapper}
          className={cn(
            'flex-1 relative bg-[#1e1e20]',
            isCanvasInteracting && 'canvas-interacting'
          )}
          onMouseMove={onPaneMouseMove}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          {!isBackgroundLayer && (
            <div className="pointer-events-none absolute left-4 right-4 top-3 z-[70] flex min-w-0 items-center gap-2"></div>
          )}

          <Suspense
            fallback={
              <div className="flex items-center justify-center w-full h-full bg-[#1e1e20]">
                <div className="w-6 h-6 border-2 border-white/20 border-t-[#D4AF37] rounded-full animate-spin" />
              </div>
            }
          >
            <FlowCanvasComponent
              {...FLOW_CANVAS_PERF_PROPS}
              nodes={storeNodes}
              edges={displayEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectStart={onConnectStart}
              onConnectEnd={onConnectEnd}
              onEdgeClick={onEdgeClick}
              onNodeDragStart={onNodeDragStart}
              onNodeDragStop={onNodeDragStop}
              onMoveStart={onCanvasMoveStart}
              onMoveEnd={onCanvasMoveEnd}
              isValidConnection={isValidConnection}
              onNodeClick={onNodeClick}
              onNodeContextMenu={onNodeContextMenu}
              onPaneClick={onPaneClick}
              onPaneContextMenu={onPaneContextMenu}
              onSelectionChange={onSelectionChange}
              nodeTypes={flowNodeTypes}
              edgeTypes={edgeTypes}
              fitViewOptions={FIT_VIEW_OPTIONS}
              className="!bg-transparent"
              minZoom={0.1}
              maxZoom={10}
              defaultViewport={DEFAULT_VIEWPORT}
              selectionOnDrag={boxSelectEnabled}
              selectionMode={SelectionMode.Partial}
              panOnDrag={canvasPanButtons}
              zoomOnDoubleClick={false}
              zoomOnScroll={bindingContains(shortcutSettings.zoomWithWheel, 'Wheel')}
              zoomOnPinch={bindingContains(shortcutSettings.zoomWithPinch, 'Pinch')}
              multiSelectionKeyCode={multiSelectionKeyCode}
              snapToGrid
              snapGrid={SNAP_GRID}
              connectionRadius={50}
              connectOnClick={true}
              onSelectionDragStart={undefined}
              onSelectionDrag={undefined}
              onSelectionDragStop={undefined}
            >
              <BackgroundDot />
              <AICGGroupOverlay refreshKey={groupRefreshKey} />

              {selectedNodeIds.length > 1 && (
                <AlignToolbar
                  onAlignLeft={alignLeft}
                  onAlignCenter={alignCenter}
                  onAlignRight={alignRight}
                  onAlignTop={alignTop}
                  onAlignMiddle={alignMiddle}
                  onAlignBottom={alignBottom}
                />
              )}

              {!isReviewMode &&
                frames.map((frame) => (
                  <div
                    key={frame.id}
                    className="absolute pointer-events-none"
                    style={{
                      left: frame.x,
                      top: frame.y,
                      width: frame.width,
                      height: frame.height,
                      border: `2px solid ${frame.color}`,
                      backgroundColor: `${frame.color}10`,
                      borderRadius: 8,
                    }}
                  >
                    <div
                      className="absolute -top-6 left-2 px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: frame.color, color: '#fff' }}
                    >
                      {frame.name}
                    </div>
                  </div>
                ))}

              {panels.search && (
                <NodeSearchPanel
                  nodes={storeNodes}
                  onJumpToNode={jumpToNode}
                  onClose={() => hidePanel('search')}
                />
              )}

              {panels.miniMap && (
                <MiniMap
                  className="bg-[#1A1A1D] border border-[#3A3A42] rounded-lg cursor-grab active:cursor-grabbing"
                  nodeColor={getNodeColor}
                  style={{ height: 80, width: 120, background: '#1A1A1D' }}
                  nodeStrokeWidth={0}
                  maskColor="rgba(0, 0, 0, 0.6)"
                />
              )}
            </FlowCanvasComponent>
          </Suspense>

          {!isBackgroundLayer && (
            <DragDropOverlay
              isDragging={isDragging}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          )}
        </div>

        {!isBackgroundLayer && panels.rightPanel && <RightPanel />}
      </div>

      {!isBackgroundLayer && (
        <CanvasLeftToolbar
          addActive={showQuickAdd}
          onAddNode={(anchorRect) => {
            setQuickAddAnchorRect(anchorRect);
            setShowQuickAdd((v) => !v);
          }}
          onConnect={() => setShowToolbox((v) => !v)}
          connectActive={showToolbox}
          onUpload={(anchorRect) => {
            setUploadAnchorRect(anchorRect);
            setShowUploadMenu((v) => !v);
            setShowQuickAdd(false);
          }}
          onLayout={(anchorRect) => {
            setLayoutAnchorRect(anchorRect);
            setShowLayoutMenu((v) => !v);
            setShowQuickAdd(false);
            setShowUploadMenu(false);
          }}
          onAssetLibrary={() => setAssetLibraryOpen(!isAssetLibraryOpen, 'all')}
          assetLibraryActive={isAssetLibraryOpen}
          onList={() => {
            showPanel('history');
          }}
        />
      )}

      {!isBackgroundLayer && showQuickAdd && quickAddAnchorRect && (
        <QuickAddNodePanel
          variant="toolbar"
          anchorRect={quickAddAnchorRect}
          onAddNode={handleAddNode}
          onOpenToolbox={() => setShowToolbox(true)}
          onOpenAssets={() => setFileManagerOpen(true)}
          onClose={() => {
            setShowQuickAdd(false);
            setQuickAddAnchorRect(null);
          }}
        />
      )}

      {!isBackgroundLayer && showUploadMenu && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowUploadMenu(false)} />
          <div
            className={cn(
              'z-[9999] w-[200px] overflow-hidden rounded-[15px] border border-white/[0.08]',
              'bg-[#252525] py-3 shadow-[0_18px_50px_rgba(0,0,0,0.52)] backdrop-blur-2xl',
              'animate-in fade-in zoom-in-95 duration-150'
            )}
            style={{
              position: 'fixed',
              left: uploadAnchorRect ? uploadAnchorRect.right + 8 : 76,
              top: uploadAnchorRect
                ? Math.max(20, Math.min(uploadAnchorRect.top - 30, window.innerHeight - 200))
                : '50%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
              添加输入资源
            </div>
            <div className="space-y-0.5 px-4 pb-1">
              <button
                type="button"
                onClick={() => {
                  handleAddNode({ id: 'videoInput' } as NodeTypeDefinition);
                  setShowUploadMenu(false);
                }}
                className="nodrag flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.07]"
              >
                <Video className="h-4 w-4 text-white/55" />
                <span className="text-[11px] text-white">视频输入</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAddNode({ id: 'imageInput' } as NodeTypeDefinition);
                  setShowUploadMenu(false);
                }}
                className="nodrag flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.07]"
              >
                <ImageIcon className="h-4 w-4 text-white/55" />
                <span className="text-[11px] text-white">图片输入</span>
              </button>
            </div>
          </div>
        </>
      )}

      {!isBackgroundLayer && showLayoutMenu && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowLayoutMenu(false)} />
          <div
            className={cn(
              'z-[9999] w-[200px] overflow-hidden rounded-[15px] border border-white/[0.08]',
              'bg-[#252525] py-3 shadow-[0_18px_50px_rgba(0,0,0,0.52)] backdrop-blur-2xl',
              'animate-in fade-in zoom-in-95 duration-150'
            )}
            style={{
              position: 'fixed',
              left: layoutAnchorRect ? layoutAnchorRect.right + 8 : 76,
              top: layoutAnchorRect
                ? Math.max(20, Math.min(layoutAnchorRect.top - 30, window.innerHeight - 200))
                : '50%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
              导演台
            </div>
            <div className="space-y-0.5 px-4 pb-1">
              <button
                type="button"
                onClick={() => {
                  handleAddNode({ id: 'director3D' } as NodeTypeDefinition);
                  setShowLayoutMenu(false);
                }}
                className="nodrag flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.07]"
              >
                <Box className="h-4 w-4 text-violet-300" />
                <span className="text-[11px] text-white">3D 导演台</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAddNode({ id: 'panorama360' } as NodeTypeDefinition);
                  setShowLayoutMenu(false);
                }}
                className="nodrag flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.07]"
              >
                <Globe className="h-4 w-4 text-cyan-300" />
                <span className="text-[11px] text-white">360 全景图</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAddNode({ id: 'gridDirector' } as NodeTypeDefinition);
                  setShowLayoutMenu(false);
                }}
                className="nodrag flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.07]"
              >
                <Clapperboard className="h-4 w-4 text-amber-300" />
                <span className="text-[11px] text-white">分镜导演</span>
              </button>
            </div>
            <div className="border-t border-white/[0.08] pt-2">
              <div className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
                节点排序
              </div>
              <div className="grid grid-cols-2 gap-1 px-4 pb-2">
                {[
                  ['horizontal', '水平'],
                  ['vertical', '垂直'],
                  ['flow-smart', '连线层级'],
                  ['type-zones', '类型分区'],
                  ['compact', '紧凑'],
                  ['standard', '标准'],
                  ['relaxed', '宽松'],
                  ['grid', '网格'],
                ].map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      handleAutoLayout(type as Parameters<typeof handleAutoLayout>[0]);
                      setShowLayoutMenu(false);
                    }}
                    className="nodrag rounded-lg px-2 py-2 text-center text-[11px] text-white/82 transition-colors hover:bg-white/[0.07] hover:text-white"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {!isBackgroundLayer && panels.history && (
        <HistoryPanel isOpen={panels.history} onClose={() => hidePanel('history')} />
      )}

      {!isBackgroundLayer && contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onContextMenu={(e) => {
              e.preventDefault();
              closeContextMenu();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              closeContextMenu();
            }}
          />
          <FlowContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeId={contextMenu.nodeId}
            selectedNodeIds={selectedNodeIds}
            onJumpToNode={jumpToNode}
            onDuplicateNodes={duplicateSelectedNodes}
            onDeleteNodes={deleteSelectedNodes}
            onSelectAllNodes={selectAllNodes}
            onAddNode={handleContextMenuAddNode}
            onAlignNodes={handleContextMenuAlignNodes}
            onAutoLayout={handleAutoLayout}
            onFitView={handleContextMenuFitView}
            onClearSelection={clearSelection}
            onAddFrame={handleAddFrame}
            onClearFrames={handleContextMenuClearFrames}
            onClose={closeContextMenu}
            onGroupNodes={handleGroupNodes}
            onExecuteGroup={handleContextMenuExecuteGroup}
            onOpenToolbox={handleContextMenuOpenToolbox}
          />
        </>
      )}

      {!isBackgroundLayer && paneQuickAdd && (
        <AICGPaneQuickAdd
          x={paneQuickAdd.x}
          y={paneQuickAdd.y}
          onClose={() => setPaneQuickAdd(null)}
          onAddNode={(nodeType) => {
            handleAddNodeInternal(nodeType, { x: paneQuickAdd.flowX, y: paneQuickAdd.flowY });
            setPaneQuickAdd(null);
          }}
          onAutoLayout={(type) => {
            handleAutoLayout(type);
            setPaneQuickAdd(null);
          }}
        />
      )}

      {!isBackgroundLayer && connectEndQuickAdd && connectEndQuickAdd.options.length > 0 && (
        <>
          <div
            className="fixed inset-0 z-[200]"
            onClick={() => setConnectEndQuickAdd(null)}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div
            className="fixed z-[201] min-w-[172px] rounded-xl border border-white/10 bg-[#1a1a1e] py-1.5"
            style={{ left: connectEndQuickAdd.x, top: connectEndQuickAdd.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 border-b border-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
              快速新建并连接
            </div>
            {connectEndQuickAdd.options.map((opt, i) => (
              <button
                key={`${opt.nodeType}-${i}`}
                type="button"
                className="nodrag flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-violet-500/20"
                onClick={() => handleConnectEndCreateNode(opt)}
              >
                <span className="text-[11px] text-white">{opt.label}</span>
                {opt.description && (
                  <span className="text-[9px] text-white/40">{opt.description}</span>
                )}
                {opt.workflowTag && opt.workflowTag !== '—' && (
                  <span className="text-[8px] text-cyan-400/50">AICG · {opt.workflowTag}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {!isBackgroundLayer && (
        <AICGToolboxPanel
          isOpen={showToolbox}
          onClose={() => setShowToolbox(false)}
          selectedNodeIds={selectedNodes}
          onInsertWorkflow={handleInsertAICGWorkflow}
        />
      )}

      <WorkflowManager isOpen={showWorkflowManager} onClose={() => setShowWorkflowManager(false)} />

      {!isBackgroundLayer && (
        <StoryboardPanel
          isOpen={showStoryboard}
          onClose={() => setShowStoryboard(false)}
          onCreateShotNodes={handleCreateShotNodes}
          onCreateAllShotNodes={handleCreateAllShotNodes}
          onExecuteShot={handleExecuteShot}
          onExecuteAllShots={handleExecuteAllShots}
          onFocusShotNodes={handleFocusShotNodes}
          onSyncShotResults={handleSyncShotResults}
        />
      )}

      {!isBackgroundLayer && (
        <>
          <WorkflowDebuggerPanel isOpen={panels.debugger} onClose={() => hidePanel('debugger')} />
          <PerformanceMonitorPanel
            isOpen={panels.performance}
            onClose={() => hidePanel('performance')}
          />
        </>
      )}

      {!isBackgroundLayer && panels.projectManager && (
        <ProjectManagerPanel onClose={() => hidePanel('projectManager')} />
      )}

      {!isBackgroundLayer && panels.snapshots && (
        <SnapshotsPanel
          snapshots={snapshots}
          onCreateSnapshot={handleCreateSnapshot}
          onRestoreSnapshot={handleRestoreSnapshot}
          onDeleteSnapshot={deleteSnapshot}
          onClose={() => hidePanel('snapshots')}
        />
      )}

      {!isBackgroundLayer && panels.bookmarks && (
        <BookmarksPanel
          bookmarks={bookmarks}
          onAddBookmark={handleAddBookmark}
          onGoToBookmark={handleGoToBookmark}
          onDeleteBookmark={deleteBookmark}
          onClose={() => hidePanel('bookmarks')}
        />
      )}

      {!isBackgroundLayer && (
        <CommandPalette
          isOpen={panels.commandPalette}
          onClose={() => hidePanel('commandPalette')}
          commands={paletteCommands}
        />
      )}
    </>
  );
};

export default memo(FlowEditor);
