import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Node, Viewport } from '@xyflow/react';
import { getCanvasNodeDimensionsFromNode } from '@/lib/canvas-node-dimensions';

interface VirtualRenderState {
  // 配置选项
  enabled: boolean;
  nodeThreshold: number;
  viewportBuffer: number;
  preloadMargin: number;
  
  // 性能统计
  performanceStats: {
    fps: number;
    visibleNodeCount: number;
    totalNodeCount: number;
    lastFrameTime: number;
    frameCount: number;
  };
  
  // 滚动位置记忆
  savedViewport: Viewport | null;
  
  // 新节点跟踪
  recentlyAddedNodes: Set<string>;
  
  // 动作
  setEnabled: (enabled: boolean) => void;
  setNodeThreshold: (threshold: number) => void;
  setViewportBuffer: (buffer: number) => void;
  setPreloadMargin: (margin: number) => void;
  saveViewport: (viewport: Viewport) => void;
  clearSavedViewport: () => void;
  updatePerformanceStats: (stats: Partial<VirtualRenderState['performanceStats']>) => void;
  addRecentlyAddedNode: (nodeId: string) => void;
  clearRecentlyAddedNodes: () => void;
}

let recentlyAddedClearTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_RECENTLY_ADDED_RENDER_NODES = 20;
const RECENTLY_ADDED_NODE_TTL_MS = 5000;

export const useVirtualRenderStore = create<VirtualRenderState>()(
  persist(
    (set) => ({
      enabled: true,
      nodeThreshold: 8,
      viewportBuffer: 0.12,
      preloadMargin: 0.2,
      
      performanceStats: {
        fps: 60,
        visibleNodeCount: 0,
        totalNodeCount: 0,
        lastFrameTime: performance.now(),
        frameCount: 0,
      },
      
      savedViewport: null,
      recentlyAddedNodes: new Set(),
      
      setEnabled: (enabled) => set({ enabled }),
      setNodeThreshold: (threshold) => set({ nodeThreshold: threshold }),
      setViewportBuffer: (buffer) => set({ viewportBuffer: buffer }),
      setPreloadMargin: (margin) => set({ preloadMargin: margin }),
      
      saveViewport: (viewport) => {
        set((state) => {
          const prev = state.savedViewport;
          if (
            prev &&
            Math.abs(prev.x - viewport.x) < 1 &&
            Math.abs(prev.y - viewport.y) < 1 &&
            Math.abs(prev.zoom - viewport.zoom) < 0.01
          ) {
            return state;
          }
          return { savedViewport: viewport };
        });
      },
      clearSavedViewport: () => set({ savedViewport: null }),
      
      updatePerformanceStats: (stats) =>
        set((state) => ({
          performanceStats: { ...state.performanceStats, ...stats }
        })),
        
      addRecentlyAddedNode: (nodeId) =>
        set((state) => {
          const newSet = new Set(state.recentlyAddedNodes);
          newSet.add(nodeId);

          while (newSet.size > MAX_RECENTLY_ADDED_RENDER_NODES) {
            const oldest = newSet.values().next().value;
            if (!oldest) break;
            newSet.delete(oldest);
          }

          if (recentlyAddedClearTimer) {
            clearTimeout(recentlyAddedClearTimer);
          }
          recentlyAddedClearTimer = setTimeout(() => {
            recentlyAddedClearTimer = null;
            set({ recentlyAddedNodes: new Set() });
          }, RECENTLY_ADDED_NODE_TTL_MS);

          return { recentlyAddedNodes: newSet };
        }),
        
      clearRecentlyAddedNodes: () => {
        if (recentlyAddedClearTimer) {
          clearTimeout(recentlyAddedClearTimer);
          recentlyAddedClearTimer = null;
        }
        set({ recentlyAddedNodes: new Set() });
      },
    }),
    {
      name: 'virtual-render-storage',
      partialize: (state) => ({
        enabled: state.enabled,
        nodeThreshold: state.nodeThreshold,
        viewportBuffer: state.viewportBuffer,
        preloadMargin: state.preloadMargin,
        savedViewport: state.savedViewport,
      }),
    }
  )
);

// 虚拟渲染辅助函数
export interface NodeBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class NodeHeightCache {
  private heights: Map<string, number> = new Map();
  private defaultHeight: number = 200;

  constructor(defaultHeight: number = 200) {
    this.defaultHeight = defaultHeight;
  }

  setHeight(nodeId: string, height: number): void {
    this.heights.set(nodeId, height);
  }

  getHeight(nodeId: string): number {
    return this.heights.get(nodeId) || this.defaultHeight;
  }

  hasHeight(nodeId: string): boolean {
    return this.heights.has(nodeId);
  }

  clear(): void {
    this.heights.clear();
  }
}

const globalNodeHeightCache = new NodeHeightCache();

export function getNodeDimensionsCache(): NodeHeightCache {
  return globalNodeHeightCache;
}

// 统一尺寸来源：优先 measured → width/height → data.canvasNodeWidth/Height → 字典 fallback
// 这样能正确处理新创建节点（width/height 为 undefined，但 data.canvasNodeWidth 已设置）
function resolveNodeSize(node: Node): { width: number; height: number } {
  const measured = globalNodeHeightCache.hasHeight(node.id)
    ? { width: node.width, height: globalNodeHeightCache.getHeight(node.id) }
    : { width: node.width, height: node.height };
  if (typeof measured.width === 'number' && typeof measured.height === 'number') {
    return { width: measured.width, height: measured.height };
  }
  // 回退到 canvas-node-dimensions 的统一字典（含 data.canvasNodeWidth/Height）
  return getCanvasNodeDimensionsFromNode(node);
}

export function calculateNodeBounds(node: Node): NodeBounds {
  const { width, height } = resolveNodeSize(node);
  return {
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  };
}

// 检查节点是否在视口中（含缓冲区）- 内联计算，避免创建对象
export function isNodeInViewport(
  node: Node,
  viewport: Viewport,
  containerWidth: number,
  containerHeight: number,
  buffer: number = 0.2
): boolean {
  const { width: nodeWidth, height: nodeHeight } = resolveNodeSize(node);
  const nodeX = node.position.x;
  const nodeY = node.position.y;

  const zoom = viewport.zoom;
  const viewportLeft = -viewport.x / zoom;
  const viewportTop = -viewport.y / zoom;
  const viewportRight = viewportLeft + containerWidth / zoom;
  const viewportBottom = viewportTop + containerHeight / zoom;

  const bufferWidth = containerWidth * buffer / zoom;
  const bufferHeight = containerHeight * buffer / zoom;

  return (
    nodeX + nodeWidth > viewportLeft - bufferWidth &&
    nodeX < viewportRight + bufferWidth &&
    nodeY + nodeHeight > viewportTop - bufferHeight &&
    nodeY < viewportBottom + bufferHeight
  );
}

// 获取可见节点
export function getVisibleNodes(
  nodes: Node[],
  viewport: Viewport,
  containerWidth: number,
  containerHeight: number,
  buffer: number = 0.2
): Node[] {
  return nodes.filter((node) =>
    isNodeInViewport(node, viewport, containerWidth, containerHeight, buffer)
  );
}

// 性能监控类
export class PerformanceMonitor {
  private frameCount: number = 0;
  private lastFpsUpdate: number = performance.now();
  private frameTimes: number[] = [];
  private maxFrameTimes: number = 60;
  
  constructor() {
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.frameTimes = [];
  }
  
  startFrame(): number {
    return performance.now();
  }
  
  endFrame(startTime: number): { fps: number; frameTime: number } {
    const endTime = performance.now();
    const frameTime = endTime - startTime;
    
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxFrameTimes) {
      this.frameTimes.shift();
    }
    
    this.frameCount++;
    const now = performance.now();
    
    let fps = 60;
    if (now - this.lastFpsUpdate >= 1000) {
      fps = Math.round(this.frameCount * 1000 / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
    
    return { fps, frameTime };
  }
  
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }
  
  reset(): void {
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.frameTimes = [];
  }
}

export function checkAutoEnableVirtualRender(nodeCount: number): void {
  const store = useVirtualRenderStore.getState();
  if (store.enabled) return;
  
  if (nodeCount >= store.nodeThreshold) {
    // console.log(`[VirtualRender] 节点数 ${nodeCount} 达到阈值 ${store.nodeThreshold}，自动启用虚拟渲染`);
    store.setEnabled(true);
  }
}
