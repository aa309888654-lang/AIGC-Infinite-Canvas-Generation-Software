/**
 * 边索引缓存 Store（P1-4）
 *
 * 维护 targetIndex: Map<targetNodeId, Edge[]> 与 sourceIndex: Map<sourceNodeId, Edge[]>，
 * 避免 resolveInputConnections / getNodeDependencies / collectConnectedImageUrls
 * 每次执行 edges.filter 全量扫描。
 *
 * 设计：
 * 1. 被动缓存 — 不导出 subscribe，组件不订阅，避免额外渲染
 * 2. 阈值控制 — edgeCount < 50 时 getIncomingEdges 直接 fallback 到传入的 edges.filter
 * 3. 由 useCanvasStore 的 setEdges/addEdge/deleteNode/commitCanvasState 调用 rebuild
 */

import { create } from 'zustand';
import type { Edge } from '@xyflow/react';

const INDEX_THRESHOLD = 50;

interface EdgeIndexState {
  targetIndex: Map<string, Edge[]>;
  sourceIndex: Map<string, Edge[]>;
  edgeCount: number;
  rebuild(edges: Edge[]): void;
  getIncomingEdges(nodeId: string, edges: Edge[]): Edge[];
  getOutgoingEdges(nodeId: string, edges: Edge[]): Edge[];
}

function buildTargetIndex(edges: Edge[]): Map<string, Edge[]> {
  const index = new Map<string, Edge[]>();
  for (const edge of edges) {
    const target = edge.target;
    const list = index.get(target);
    if (list) {
      list.push(edge);
    } else {
      index.set(target, [edge]);
    }
  }
  return index;
}

function buildSourceIndex(edges: Edge[]): Map<string, Edge[]> {
  const index = new Map<string, Edge[]>();
  for (const edge of edges) {
    const source = edge.source;
    const list = index.get(source);
    if (list) {
      list.push(edge);
    } else {
      index.set(source, [edge]);
    }
  }
  return index;
}

export const useEdgeIndexStore = create<EdgeIndexState>((set, get) => ({
  targetIndex: new Map(),
  sourceIndex: new Map(),
  edgeCount: 0,

  rebuild(edges: Edge[]): void {
    set({
      targetIndex: buildTargetIndex(edges),
      sourceIndex: buildSourceIndex(edges),
      edgeCount: edges.length,
    });
  },

  getIncomingEdges(nodeId: string, edges: Edge[]): Edge[] {
    const state = get();
    if (state.edgeCount < INDEX_THRESHOLD) {
      return edges.filter((e) => e.target === nodeId);
    }
    return state.targetIndex.get(nodeId) ?? [];
  },

  getOutgoingEdges(nodeId: string, edges: Edge[]): Edge[] {
    const state = get();
    if (state.edgeCount < INDEX_THRESHOLD) {
      return edges.filter((e) => e.source === nodeId);
    }
    return state.sourceIndex.get(nodeId) ?? [];
  },
}));

/**
 * 非响应式 API（供非组件代码使用，避免引入 React hooks）
 */
export const edgeIndexApi = {
  rebuild: (edges: Edge[]) => useEdgeIndexStore.getState().rebuild(edges),
  getIncomingEdges: (nodeId: string, edges: Edge[]): Edge[] =>
    useEdgeIndexStore.getState().getIncomingEdges(nodeId, edges),
  getOutgoingEdges: (nodeId: string, edges: Edge[]): Edge[] =>
    useEdgeIndexStore.getState().getOutgoingEdges(nodeId, edges),
};
