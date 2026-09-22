import {
  memo,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ReactFlow,
  ReactFlowProps,
  Node,
  Edge,
  useOnViewportChange,
  Viewport,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import { useVirtualRenderStore, getVisibleNodes } from '@/store/useVirtualRenderStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Activity, Layers, Zap, Monitor, Settings2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VirtualizedFlowProps extends ReactFlowProps {
  children?: React.ReactNode;
}

const PRO_OPTIONS = { hideAttribution: true };

function isSameViewport(a: Viewport, b: Viewport) {
  return (
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.zoom - b.zoom) < 0.01
  );
}

interface PerformanceStatsPanelProps {
  showStats: boolean;
  shouldUseVirtualRender: boolean;
  visibleNodeCount: number;
  totalNodeCount: number;
  visibleEdgeCount: number;
  totalEdgeCount: number;
  zoom: number;
  enabled: boolean;
  onClose: () => void;
  onEnabledChange: (enabled: boolean) => void;
}

const PerformanceStatsPanel = memo(({
  showStats,
  shouldUseVirtualRender,
  visibleNodeCount,
  totalNodeCount,
  visibleEdgeCount,
  totalEdgeCount,
  zoom,
  enabled,
  onClose,
  onEnabledChange,
}: PerformanceStatsPanelProps) => {
  if (!showStats) return null;

  return (
    <Panel position="top-right" className="top-16 right-4">
      <div className="bg-[#1A1A1D]/95 backdrop-blur-xl border border-[#3A3A42] rounded-lg shadow-2xl p-4 min-w-64">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" />
            性能监控
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded text-white/60 hover:text-white"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-white/60">虚拟渲染</span>
            <span className={cn(
              "font-medium",
              shouldUseVirtualRender ? "text-green-400" : "text-yellow-400"
            )}>
              {shouldUseVirtualRender ? "已启用" : "未启用"}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/60 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              可见节点
            </span>
            <span className="text-white font-medium">
              {visibleNodeCount} / {totalNodeCount}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/60 flex items-center gap-1">
              <Monitor className="w-3 h-3" />
              边数量
            </span>
            <span className="text-white font-medium">
              {visibleEdgeCount} / {totalEdgeCount}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/60 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              视口缩放
            </span>
            <span className="text-white font-medium">
              {(zoom * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="virtual-render-toggle"
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
              className="w-3 h-3 rounded border-[#4A4A4E] bg-[#1A1A1E] text-[#6610F2] focus:ring-[#6610F2]"
            />
            <label htmlFor="virtual-render-toggle" className="text-xs text-white/70 cursor-pointer">
              启用虚拟渲染
            </label>
          </div>
        </div>
      </div>
    </Panel>
  );
});

PerformanceStatsPanel.displayName = 'PerformanceStatsPanel';

const VirtualizedFlow = memo(({
  nodes,
  edges,
  children,
  ...props
}: VirtualizedFlowProps) => {
  const enabled = useVirtualRenderStore((s) => s.enabled);
  const nodeThreshold = useVirtualRenderStore((s) => s.nodeThreshold);
  const viewportBuffer = useVirtualRenderStore((s) => s.viewportBuffer);
  const initialSavedViewportRef = useRef(useVirtualRenderStore.getState().savedViewport);
  const savedViewport = initialSavedViewportRef.current;
  const recentlyAddedNodesRaw = useVirtualRenderStore((s) => s.recentlyAddedNodes);
  const setEnabled = useVirtualRenderStore((s) => s.setEnabled);
  const saveViewport = useVirtualRenderStore((s) => s.saveViewport);
  const updatePerformanceStats = useVirtualRenderStore((s) => s.updatePerformanceStats);

  // Convert Set to stable array reference
  const recentlyAddedNodes = useMemo(() => {
    return Array.from(recentlyAddedNodesRaw);
  }, [recentlyAddedNodesRaw.size]);

  // 选中节点始终渲染（安全网：避免选中节点被虚拟渲染过滤后无法操作）
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  // ReactFlow 会在初次挂载时回写节点尺寸；这里必须透传最新节点，
  // 否则旧引用会让尺寸更新反复丢失，触发 StoreUpdater 死循环。
  const stableNodes = nodes ?? [];
  const stableEdges = edges ?? [];

  const containerRef = useRef<HTMLDivElement>(null);
  const [currentViewport, setCurrentViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  });
  const [showStats, setShowStats] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const initialFitDoneRef = useRef(false);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 600;
        setContainerSize(prev => {
          if (prev.width === width && prev.height === height) return prev;
          return { width, height };
        });
        setIsReady(true);
      }
    };

    updateSize();
    const timer = setTimeout(updateSize, 100);
    return () => clearTimeout(timer);
  }, []);
  const { setViewport, fitView } = useReactFlow();

  const effectiveNodeThreshold = Math.min(nodeThreshold, 8);
  const shouldUseVirtualRender = useMemo(() => {
    return enabled && stableNodes.length > effectiveNodeThreshold;
  }, [enabled, stableNodes.length, effectiveNodeThreshold]);

  const visibleNodes = useMemo(() => {
    try {
      if (!shouldUseVirtualRender) {
        return stableNodes;
      }

      if (containerSize.width === 0 || containerSize.height === 0) {
        return stableNodes;
      }

      const visible = getVisibleNodes(
        stableNodes,
        currentViewport,
        containerSize.width,
        containerSize.height,
        viewportBuffer
      );

      // 安全网：合并 recentlyAdded、selected、dragging 节点，确保它们始终渲染
      const visibleNodeIds = new Set(visible.map((n) => n.id));
      const extraKeepIds = new Set<string>();

      // 1) 新创建节点（宽限期内强制可见）
      for (const id of recentlyAddedNodes) extraKeepIds.add(id);
      // 2) 选中节点（用户当前操作的节点不能消失）
      for (const id of selectedNodeIdSet) extraKeepIds.add(id);
      // 3) 正在拖拽的节点
      for (const node of stableNodes) {
        if (node.dragging) extraKeepIds.add(node.id);
      }

      if (extraKeepIds.size === 0) return visible;

      const additionalNodes = stableNodes.filter(
        (node) => extraKeepIds.has(node.id) && !visibleNodeIds.has(node.id)
      );

      if (additionalNodes.length === 0) return visible;
      return [...visible, ...additionalNodes];
    } catch (error) {
      console.error('[VirtualizedFlow] 计算可见节点时出错:', error);
      return stableNodes;
    }
  }, [
    stableNodes,
    shouldUseVirtualRender,
    currentViewport,
    containerSize,
    viewportBuffer,
    recentlyAddedNodes,
    selectedNodeIdSet,
  ]);

  const visibleEdges = useMemo(() => {
    try {
      if (!shouldUseVirtualRender) {
        return stableEdges;
      }

      const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
      return stableEdges.filter(
        (edge) =>
          visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
      );
    } catch (error) {
      console.error('[VirtualizedFlow] 计算可见边时出错:', error);
      return stableEdges;
    }
  }, [stableEdges, visibleNodes, shouldUseVirtualRender]);

  // Use refs to maintain stable references
  const finalNodesRef = useRef<Node[]>([]);
  const finalEdgesRef = useRef<Edge[]>([]);

  const finalNodes = useMemo(() => {
    // 保持数组引用稳定，但节点对象变化时必须同步，避免虚拟渲染下数据/状态不刷新。
    if (visibleNodes.length !== finalNodesRef.current.length ||
        visibleNodes.some((n, i) => n !== finalNodesRef.current[i])) {
      finalNodesRef.current = visibleNodes;
    }
    return finalNodesRef.current;
  }, [visibleNodes]);

  const finalEdges = useMemo(() => {
    if (visibleEdges.length !== finalEdgesRef.current.length ||
        visibleEdges.some((e, i) => e !== finalEdgesRef.current[i])) {
      finalEdgesRef.current = visibleEdges;
    }
    return finalEdgesRef.current;
  }, [visibleEdges]);

  const saveViewportRef = useRef(saveViewport);
  saveViewportRef.current = saveViewport;

  const viewportDebounceRef = useRef<number>(0);
  const pendingViewportRef = useRef<Viewport | null>(null);
  useOnViewportChange({
    onChange: useCallback((viewport: Viewport) => {
      if (!shouldUseVirtualRender) return;

      pendingViewportRef.current = viewport;

      const now = Date.now();
      if (now - viewportDebounceRef.current < 100) return;
      viewportDebounceRef.current = now;

      setCurrentViewport((prev) => {
        if (isSameViewport(prev, viewport)) {
          return prev;
        }
        return viewport;
      });
    }, [shouldUseVirtualRender]),
    onEnd: useCallback((viewport: Viewport) => {
      if (!shouldUseVirtualRender) return;
      const latestViewport = pendingViewportRef.current ?? viewport;
      pendingViewportRef.current = null;
      saveViewportRef.current(latestViewport);
    }, [shouldUseVirtualRender]),
  });

  useEffect(() => {
    if (!containerRef.current) return;

    let resizeTimer: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver((entries) => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            setContainerSize(prev => {
              if (prev.width === width && prev.height === height) return prev;
              return { width, height };
            });
            setIsReady(true);
          }
        }
      }, 50);
    });

    resizeObserver.observe(containerRef.current);
    return () => {
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
    };
  }, []);

  const viewportRestoredRef = useRef(false);
  const setViewportRef = useRef(setViewport);
  setViewportRef.current = setViewport;
  const fitViewRef = useRef(fitView);
  fitViewRef.current = fitView;

  useEffect(() => {
    if (!shouldUseVirtualRender) return;

    if (savedViewport && !viewportRestoredRef.current && isReady) {
      viewportRestoredRef.current = true;
      // 同步 currentViewport state，避免可见性判断仍用初始 {0,0,1} 误过滤节点
      setCurrentViewport(savedViewport);
      const timer = setTimeout(() => {
        setViewportRef.current(savedViewport);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [savedViewport, isReady, shouldUseVirtualRender]);

  useEffect(() => {
    if (isReady && !initialFitDoneRef.current && !savedViewport) {
      initialFitDoneRef.current = true;
      const timer = setTimeout(() => {
        fitViewRef.current({ padding: 0.1, duration: 300 });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isReady, savedViewport]);

  useEffect(() => {
    if (!shouldUseVirtualRender) return;

    const updateStats = () => {
      const stats = {
        visibleNodeCount: visibleNodes.length,
        totalNodeCount: stableNodes.length,
      };
      updatePerformanceStats(stats);
    };

    updateStats();
  }, [
    shouldUseVirtualRender,
    visibleNodes.length,
    stableNodes.length,
    updatePerformanceStats,
  ]);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ minWidth: 400, minHeight: 300 }}>
      {!isReady ? (
        <div className="w-full h-full flex items-center justify-center bg-[#1A1A1D]">
          <div className="text-white/40 text-sm">加载画布...</div>
        </div>
      ) : (
        <ReactFlow
          nodes={finalNodes}
          edges={finalEdges}
          {...props}
          proOptions={PRO_OPTIONS}
        >
          {children}
        
        {/* 性能统计面板切换按钮 */}
        <Panel position="top-right" className="top-4 right-4">
          <button
            onClick={() => setShowStats(!showStats)}
            className="bg-[#1A1A1D]/95 backdrop-blur-xl border border-[#3A3A42] rounded-lg p-2 hover:bg-[#2A2A2D] transition-colors"
            title={showStats ? "隐藏性能统计" : "显示性能统计"}
          >
            <Settings2 className={cn("w-4 h-4", showStats ? "text-gray-400" : "text-white/60")} />
          </button>
        </Panel>
        
        {/* 性能统计面板 */}
        <PerformanceStatsPanel
          showStats={showStats}
          shouldUseVirtualRender={shouldUseVirtualRender}
          visibleNodeCount={visibleNodes.length}
          totalNodeCount={stableNodes.length}
          visibleEdgeCount={visibleEdges.length}
          totalEdgeCount={stableEdges.length}
          zoom={currentViewport.zoom}
          enabled={enabled}
          onClose={() => setShowStats(false)}
          onEnabledChange={setEnabled}
        />

        </ReactFlow>
      )}
    </div>
  );
});

VirtualizedFlow.displayName = 'VirtualizedFlow';

export default VirtualizedFlow;
