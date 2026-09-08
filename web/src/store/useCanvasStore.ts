import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { Node, Edge } from '@xyflow/react';
import { generateId } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { resolveAssetUrl } from '@/services/canvas-asset-url-resolver';
import { getCanvasAssetRepositoryForCurrentProject } from '@/services/canvas-asset-actions';
import {
  resolveNonOverlappingCanvasNode,
  resolveNonOverlappingCanvasNodes,
} from '@/lib/canvas-node-dimensions';
import { nodeTaskRegistry } from '@/services/node-task-registry';
import { stripRuntimeFields } from '@/utils/node-utils';
import { edgeIndexApi } from '@/store/useEdgeIndexStore';

const IMG_REF_PREFIX = '__IDB_IMG__:';
const VIDEO_REF_PREFIX = '__VIDEO_REF__:';
const LARGE_DATA_THRESHOLD = 50 * 1024;
const IDB_NAME = 'AICG_NodeImages_DB';
const IDB_STORE = 'node_images';
const IDB_VERSION = 1;
const ACTIVE_PROJECT_KEY_FOR_PERSIST = 'canvas-active-project-id';

let idbInstance: IDBDatabase | null = null;
let idbInitPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (idbInstance) return Promise.resolve(idbInstance);
  if (idbInitPromise) return idbInitPromise;
  
  idbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    
    request.onsuccess = () => {
      idbInstance = request.result;
      resolve(idbInstance);
    };
    
    request.onerror = () => {
      console.error('[CanvasStore] IDB 打开失败:', request.error);
      idbInitPromise = null;
      reject(request.error);
    };
  });
  
  return idbInitPromise;
}

async function saveToIDB(key: string, data: string): Promise<boolean> {
  try {
    const db = await getIDB();
    return new Promise((resolve, _reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(data, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => { console.warn('[CanvasStore] IDB写入失败:', key); resolve(false); };
    });
  } catch (e) {
    console.warn('[CanvasStore] saveToIDB error:', e);
    return false;
  }
}

async function loadFromIDB(key: string): Promise<string | null> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => { console.warn('[CanvasStore] IDB读取失败:', key); resolve(null); };
    });
  } catch (e) {
    console.warn('[CanvasStore] loadFromIDB error:', e);
    return null;
  }
}

function sanitizeEdges(edges: Edge[], nodes: Node[]): Edge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  return edges.filter((edge) => {
    if (String(edge.id).startsWith('matting-result-')) return false;
    return nodeIds.has(edge.source) && nodeIds.has(edge.target);
  });
}

function isLargeImageData(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return (value.startsWith('data:') || value.startsWith('blob:')) && value.length > LARGE_DATA_THRESHOLD;
}

function isBlobUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('blob:');
}

function collectBlobUrls(value: unknown, output: Set<string>): void {
  if (isBlobUrl(value)) {
    output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectBlobUrls(item, output));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectBlobUrls(item, output));
  }
}

function sanitizePersistedRuntimeBlobUrls(value: unknown): unknown {
  if (isBlobUrl(value)) return undefined;
  if (Array.isArray(value)) return value.map((item) => sanitizePersistedRuntimeBlobUrls(item));
  if (!value || typeof value !== 'object') return value;

  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const sanitized = sanitizePersistedRuntimeBlobUrls(item);
    if (sanitized !== undefined) next[key] = sanitized;
  }
  return next;
}

function sanitizePersistedNodeRuntimeBlobs(node: Node): Node {
  if (!node?.data) return node;
  const nextData: Record<string, unknown> = {};
  let changed = false;

  for (const [key, value] of Object.entries(node.data as Record<string, unknown>)) {
    if (isBlobUrl(value)) {
      changed = true;
      if (key === 'videoUrl') nextData[key] = `${VIDEO_REF_PREFIX}${node.id}`;
      continue;
    }

    const sanitized = sanitizePersistedRuntimeBlobUrls(value);
    if (!valuesEquivalent(sanitized, value)) changed = true;
    if (sanitized !== undefined) nextData[key] = sanitized;
  }

  return changed ? { ...node, data: nextData } : node;
}

function queueBlobUrlRevoke(urls: string[]): void {
  if (urls.length === 0 || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  queueMicrotask(() => {
    urls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // best effort cleanup
      }
    });
  });
}

function notifyCanvasStorageQuota(detail: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('canvas-storage-quota-warning', { detail }));
}

function getActiveProjectIdForPersist(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY_FOR_PERSIST);
  } catch {
    return null;
  }
}

function valuesEquivalent(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

class CanvasStateStorage implements StateStorage {
  getItem(name: string): string | null {
    try {
      const stored = localStorage.getItem(name);
      if (!stored) return stored;

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed?.state?.nodes)) return stored;

      const cleanedNodes = parsed.state.nodes.map((node: Node) => sanitizePersistedNodeRuntimeBlobs(node));
      if (cleanedNodes.every((node: Node, index: number) => node === parsed.state.nodes[index])) return stored;

      parsed.state.nodes = cleanedNodes;
      const cleaned = JSON.stringify(parsed);
      localStorage.setItem(name, cleaned);
      return cleaned;
    } catch {
      return localStorage.getItem(name);
    }
  }

  async setItem(name: string, value: string): Promise<void> {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.state?.nodes && Array.isArray(parsed.state.nodes)) {
        const savePromises: Promise<boolean>[] = [];

        const cleanedNodes = parsed.state.nodes.map((node: Node) => {
          if (!node?.data) return node;
          const newData = { ...node.data };
          for (const k of Object.keys(newData)) {
            const val = newData[k];
            if (isLargeImageData(val)) {
              const idbKey = `img_${node.id}_${k}`;
              savePromises.push(saveToIDB(idbKey, val));
              newData[k] = `${IMG_REF_PREFIX}${idbKey}`;
            } else if (typeof val === 'string' && val.startsWith('blob:') && (k === 'videoUrl' || k === 'imageUrl' || k === 'resultUrl')) {
              newData[k] = k === 'videoUrl'
                ? `${VIDEO_REF_PREFIX}${node.id}`
                : `${IMG_REF_PREFIX}runtime_${node.id}_${k}`;
            }
          }
          return { ...node, data: newData };
        });

        const finalNodes = cleanedNodes.map((node: Node) => {
          if (!node?.data) return node;
          const finalData: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(node.data as Record<string, unknown>)) {
            finalData[k] = typeof v === 'string' ? v : (node.data as Record<string, unknown>)[k];
          }
          return { ...node, data: finalData };
        });
        parsed.state.nodes = finalNodes;

        await Promise.allSettled(savePromises);
        value = JSON.stringify(parsed);
      }
      localStorage.setItem(name, value);
    } catch (quotaError) {
      if (quotaError instanceof DOMException && quotaError.name === 'QuotaExceededError') {
        console.error('[CanvasStore] ⚠️ localStorage 配额溢出!');
        try {
          const parsed = JSON.parse(value);
          if (parsed.state) {
            notifyCanvasStorageQuota({
              storageKey: name,
              nodeCount: Array.isArray(parsed.state.nodes) ? parsed.state.nodes.length : undefined,
              action: 'history_pruned',
            });
            parsed.state.history = { past: [], future: [] };
          }
          const reduced = JSON.stringify(parsed);
          try {
            localStorage.setItem(name, reduced);
            logger.info('[CanvasStore] ✅ 清理history后保存成功');
          } catch (e2) {
            const canvasKeys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith('canvas-storage')) canvasKeys.push(k);
            }
            canvasKeys.forEach(k => localStorage.removeItem(k));
            try {
              localStorage.setItem(name, reduced);
              logger.info('[CanvasStore] ✅ 清理旧canvas数据后保存成功');
            } catch (e3) {
              console.error('[CanvasStore] ❌ 保存失败:', e3);
              notifyCanvasStorageQuota({
                storageKey: name,
                nodeCount: Array.isArray(parsed?.state?.nodes) ? parsed.state.nodes.length : undefined,
                action: 'persist_failed',
              });
              throw e3;
            }
          }
        } catch (e) {
          console.error('[CanvasStore] ❌ 降级保存失败:', e);
          throw e;
        }
      } else {
        throw quotaError;
      }
    }
  }

  removeItem(name: string): void {
    localStorage.removeItem(name);
  }
}

export interface CanvasState {
  persistedProjectId: string | null;
  nodes: Node[];
  edges: Edge[];
  /** nodeId → nodes 数组索引，O(1) 查找（P1-3 结构共享） */
  nodeIndex: Map<string, number>;
  history: {
    past: { nodes: Node<Record<string, unknown>>[]; edges: Edge[] }[];
    future: { nodes: Node<Record<string, unknown>>[]; edges: Edge[] }[];
  };
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  localPrompt: string;
  setLocalPrompt: (prompt: string) => void;
  addNode: (node: Node<Record<string, unknown>>) => void;
  updateNodeData: (nodeId: string, data: Partial<Record<string, unknown>>) => void;
  deleteNode: (nodeId: string) => void;
  setNodes: (nodes: Node<Record<string, unknown>>[]) => void;
  /** 仅用于位置/选择态更新；节点拓扑不变时复用索引和边，避免拖拽热路径重复全量构建。 */
  setNodesTransient: (nodes: Node<Record<string, unknown>>[], changedNodeIds: readonly string[]) => void;
  addEdge: (edge: Edge) => void;
  setEdges: (edges: Edge[]) => void;
  /** ✅ P2-3：断开指定句柄级别的单条边 */
  disconnectEdge: (sourceNodeId: string, targetNodeId: string, targetHandle?: string) => void;
  /** ✅ P2-3：替换句柄级别的连接（断开旧源，连接新源） */
  replaceEdgeConnection: (
    oldSourceNodeId: string,
    newSourceNodeId: string,
    targetNodeId: string,
    targetHandle?: string,
    newSourceHandle?: string,
  ) => boolean;
  commitCanvasState: (state: {
    nodes?: Node<Record<string, unknown>>[];
    edges?: Edge[];
    selectedNodeId?: string | null;
    selectedNodeIds?: string[];
  }) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  selectAllNodes: () => void;
  clearSelection: () => void;
  deleteSelectedNodes: () => void;
  duplicateSelectedNodes: () => void;
  moveSelectedNodes: (deltaX: number, deltaY: number) => void;
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;
  resetCanvas: () => void;
  rehydrateAssetBackedMedia: () => Promise<void>;
}

const MAX_HISTORY_SIZE = 20;
const HISTORY_DEBOUNCE_MS = 300;

let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingHistorySnapshot: { nodes: Node[]; edges: Edge[] } | null = null;

/** 构建 nodeId → 数组索引的 Map（P1-3 结构共享） */
function buildNodeIndex(nodes: Node[]): Map<string, number> {
  const index = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    index.set(nodes[i].id, i);
  }
  return index;
}

async function moveNodeAssetsToTrash(node: Node<Record<string, unknown>> | undefined): Promise<void> {
  if (!node?.data) return;

  const nestedAssetIds: string[] = [];
  const scenes = Array.isArray(node.data.scenes) ? node.data.scenes : [];
  const cellResults = Array.isArray(node.data.cellResults) ? node.data.cellResults : [];
  const params = node.data.params as Record<string, unknown> | undefined;
  const sceneObjects = Array.isArray(params?.objects) ? params.objects : [];

  for (const scene of scenes) {
    if (!scene || typeof scene !== 'object') continue;
    const typedScene = scene as Record<string, unknown>;
    if (typeof typedScene.imageAssetId === 'string') nestedAssetIds.push(typedScene.imageAssetId);
    if (typeof typedScene.videoAssetId === 'string') nestedAssetIds.push(typedScene.videoAssetId);
  }

  for (const cell of cellResults) {
    if (!cell || typeof cell !== 'object') continue;
    const typedCell = cell as Record<string, unknown>;
    if (typeof typedCell.imageAssetId === 'string') nestedAssetIds.push(typedCell.imageAssetId);
  }

  for (const object of sceneObjects) {
    if (!object || typeof object !== 'object') continue;
    const typedObject = object as Record<string, unknown>;
    if (typeof typedObject.modelAssetId === 'string') nestedAssetIds.push(typedObject.modelAssetId);
  }

  if (typeof params?.panoramaAssetId === 'string') nestedAssetIds.push(params.panoramaAssetId);
  if (typeof params?.environmentHDRAssetId === 'string') nestedAssetIds.push(params.environmentHDRAssetId);
  if (typeof params?.resultAssetId === 'string') nestedAssetIds.push(params.resultAssetId);
  if (params?.extractedAngleAssetIds && typeof params.extractedAngleAssetIds === 'object') {
    Object.values(params.extractedAngleAssetIds as Record<string, unknown>).forEach((assetId) => {
      if (typeof assetId === 'string') nestedAssetIds.push(assetId);
    });
  }

  const assetIds = [
    node.data.imageAssetId,
    node.data.videoAssetId,
    node.data.thumbnailAssetId,
    node.data.resultAssetId,
    node.data.gridImageAssetId,
    node.data.panoramaAssetId,
    node.data.environmentHDRAssetId,
    ...nestedAssetIds,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (assetIds.length === 0) return;

  const repo = getCanvasAssetRepositoryForCurrentProject();

  await Promise.all(
    assetIds.map(async (assetId) => {
      await repo.unmarkNodeAssetUsage(node.id, assetId);
      await repo.moveUnusedAssetToTrash(assetId);
    })
  );
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      persistedProjectId: null,
      nodes: [],
      edges: [],
      nodeIndex: new Map(),
      selectedNodeId: null,
      selectedNodeIds: [],
      localPrompt: '',
      setLocalPrompt: (prompt) => set({ localPrompt: prompt }),
      history: {
        past: [],
        future: [],
      },

      addNode: (node) =>
        set((state) => {
          if (state.nodes.some((n) => n.id === node.id)) return state;
          const positionedNode = resolveNonOverlappingCanvasNode(node, state.nodes);
          const nextNodes = [...state.nodes, positionedNode];
          return {
            nodes: nextNodes,
            nodeIndex: buildNodeIndex(nextNodes),
          };
        }),
      
      updateNodeData: (nodeId, data) =>
        set((state) => {
          // ✅ P1-3：用 nodeIndex O(1) 查找替代 findIndex O(n)
          const targetIndex = state.nodeIndex.get(nodeId);
          if (targetIndex === undefined) return state;

          const node = state.nodes[targetIndex];
          const newData = { ...node.data, ...data };
          const oldBlobUrls = new Set<string>();
          const nextBlobUrls = new Set<string>();
          Object.keys(data).forEach((key) => {
            collectBlobUrls((node.data as Record<string, unknown>)[key], oldBlobUrls);
            collectBlobUrls((newData as Record<string, unknown>)[key], nextBlobUrls);
          });
          let anyChanged = false;
          let changedKey = '';
          for (const key of Object.keys(data)) {
            const newVal = (newData as any)[key];
            const oldVal = (node.data as any)[key];
            if (newVal === oldVal) continue;
            if (newVal && oldVal && typeof newVal === 'object' && typeof oldVal === 'object') {
              try {
                if (JSON.stringify(newVal) === JSON.stringify(oldVal)) continue;
              } catch { /* circular ref, treat as changed */ }
            }
            anyChanged = true;
            changedKey = key;
            break;
          }

          if (!anyChanged) {
            if (Object.keys(data).some((k) => k === 'frameResults' || k === 'gridImageUrl' || k === 'coverImageUrl')) {
              console.warn('[updateNodeData] ⚠️ No change detected for nodeId:', nodeId, 'data keys:', Object.keys(data));
            }
            return state;
          }

          if (changedKey === 'frameResults' || changedKey === 'gridImageUrl' || changedKey === 'coverImageUrl') {
            console.log('[updateNodeData] ✅ Updating nodeId:', nodeId, 'changedKey:', changedKey);
          }

          // ✅ P1-3：slice() 替代 [...] spread，仅替换目标索引引用，其余引用不变
          const newNodes = state.nodes.slice();
          newNodes[targetIndex] = { ...node, data: newData };
          const replacedBlobUrls = [...oldBlobUrls].filter((url) => {
            if (nextBlobUrls.has(url)) return false;
            return !newNodes.some((candidate, index) => {
              if (index === targetIndex) return false;
              const urls = new Set<string>();
              collectBlobUrls(candidate.data, urls);
              return urls.has(url);
            });
          });
          queueBlobUrlRevoke(replacedBlobUrls);
          // nodeIndex 不变（id 与位置都没变）
          return { nodes: newNodes };
        }),
      
      deleteNode: (nodeId) =>
        {
          const node = get().nodes.find((entry) => entry.id === nodeId);
          void moveNodeAssetsToTrash(node);

          // ✅ 架构 2.2 / P0-1：取消该节点的所有进行中任务（轮询、提交锁等）
          // 避免删除节点后轮询继续消耗 API 配额
          nodeTaskRegistry.cancelAll(nodeId);

          set((state) => {
            const nextNodes = state.nodes.filter((entry) => entry.id !== nodeId);
            return {
              nodes: nextNodes,
              nodeIndex: buildNodeIndex(nextNodes),
              edges: state.edges.filter(
                (edge) => edge.source !== nodeId && edge.target !== nodeId
              ),
            };
          });
        },

      setNodes: (nodes) => set((state) => ({
        nodes,
        nodeIndex: buildNodeIndex(nodes),
        edges: sanitizeEdges(state.edges, nodes),
      })),

      setNodesTransient: (nodes, changedNodeIds) => set((state) => {
        const topologyStable =
          nodes.length === state.nodes.length &&
          changedNodeIds.every((nodeId) => {
            const index = state.nodeIndex.get(nodeId);
            return index !== undefined && nodes[index]?.id === nodeId;
          });

        if (!topologyStable) {
          return {
            nodes,
            nodeIndex: buildNodeIndex(nodes),
            edges: sanitizeEdges(state.edges, nodes),
          };
        }

        return { nodes };
      }),
      
      addEdge: (edge) =>
        set((state) => ({ edges: sanitizeEdges([...state.edges, edge], state.nodes) })),
      
      setEdges: (edges) => set((state) => ({ edges: sanitizeEdges(edges, state.nodes) })),

      // ✅ P2-3：断开指定句柄级别的单条边（不影响同句柄其他连接）
      disconnectEdge: (sourceNodeId, targetNodeId, targetHandle) => {
        set((state) => {
          const nextEdges = state.edges.filter(
            (e) =>
              !(
                e.source === sourceNodeId &&
                e.target === targetNodeId &&
                (targetHandle ? e.targetHandle === targetHandle : true)
              ),
          );
          return { edges: nextEdges };
        });
        get().saveToHistory();
      },

      // ✅ P2-3：替换句柄级别的连接（断开旧源，连接新源）
      replaceEdgeConnection: (oldSourceNodeId, newSourceNodeId, targetNodeId, targetHandle, newSourceHandle) => {
        const state = get();
        // 先断开旧边
        const filteredEdges = state.edges.filter(
          (e) =>
            !(
              e.source === oldSourceNodeId &&
              e.target === targetNodeId &&
              (targetHandle ? e.targetHandle === targetHandle : true)
            ),
        );

        // 校验新连接是否合法
        const newSource = state.nodes.find((n) => n.id === newSourceNodeId);
        const targetNode = state.nodes.find((n) => n.id === targetNodeId);
        if (!newSource || !targetNode) return false;

        const newEdge: Edge = {
          id: generateId(),
          source: newSourceNodeId,
          target: targetNodeId,
          sourceHandle: newSourceHandle,
          targetHandle,
        };

        set({ edges: sanitizeEdges([...filteredEdges, newEdge], state.nodes) });
        get().saveToHistory();
        return true;
      },

      commitCanvasState: (nextState) =>
        set((state) => {
          const nodes = nextState.nodes ?? state.nodes;
          const edges = nextState.edges ? sanitizeEdges(nextState.edges, nodes) : state.edges;
          return {
            ...(nextState.nodes ? { nodes, nodeIndex: buildNodeIndex(nodes) } : {}),
            ...(nextState.edges ? { edges } : {}),
            ...(Object.prototype.hasOwnProperty.call(nextState, 'selectedNodeId')
              ? { selectedNodeId: nextState.selectedNodeId ?? null }
              : {}),
            ...(nextState.selectedNodeIds ? { selectedNodeIds: nextState.selectedNodeIds } : {}),
          };
        }),
      
      setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
      
      setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
      
      selectAllNodes: () => {
        const { nodes } = get();
        set({
          selectedNodeIds: nodes.map(n => n.id),
          selectedNodeId: nodes.length > 0 ? nodes[0].id : null,
        });
      },
      
      clearSelection: () => {
        set({
          selectedNodeIds: [],
          selectedNodeId: null,
        });
      },
      
      deleteSelectedNodes: () => {
        const { selectedNodeIds, nodes, edges, saveToHistory } = get();

        if (selectedNodeIds.length === 0) return;

        const idsToDelete = selectedNodeIds;

        idsToDelete.forEach((nodeId) => {
          nodeTaskRegistry.cancelAll(nodeId);
        });
        
        const newNodes = nodes.filter(n => !idsToDelete.includes(n.id));
        const newEdges = edges.filter(
          e => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target)
        );
        
        set({
          nodes: newNodes,
          nodeIndex: buildNodeIndex(newNodes),
          edges: newEdges,
          selectedNodeIds: [],
          selectedNodeId: null
        });
        saveToHistory();
      },

      duplicateSelectedNodes: () => {
        const { selectedNodeIds, nodes, saveToHistory } = get();
        if (selectedNodeIds.length === 0) return;

        const nodesToDuplicate = nodes.filter(n => selectedNodeIds.includes(n.id));
        const newNodes = nodesToDuplicate.map(node => ({
          ...node,
          id: generateId(),
          position: { x: node.position.x + 50, y: node.position.y + 50 },
          data: node.data ? stripRuntimeFields(node.data) : {},
        }));
        const positionedNodes = resolveNonOverlappingCanvasNodes(newNodes, nodes);

        set((state) => {
          const nextNodes = [...state.nodes, ...positionedNodes];
          return {
            nodes: nextNodes,
            nodeIndex: buildNodeIndex(nextNodes),
            selectedNodeIds: positionedNodes.map(n => n.id),
          };
        });
        saveToHistory();
      },
      
      moveSelectedNodes: (deltaX: number, deltaY: number) => {
        const { selectedNodeIds, nodes } = get();
        if (selectedNodeIds.length === 0) return;
        
        const newNodes = nodes.map(node => {
          if (selectedNodeIds.includes(node.id)) {
            return {
              ...node,
              position: {
                x: node.position.x + deltaX,
                y: node.position.y + deltaY,
              },
            };
          }
          return node;
        });
        
        set({ nodes: newNodes });
      },
      
      saveToHistory: () => {
        const { nodes, edges } = get();
        pendingHistorySnapshot = { nodes, edges };
        
        if (historyDebounceTimer) {
          clearTimeout(historyDebounceTimer);
        }
        
        historyDebounceTimer = setTimeout(() => {
          if (!pendingHistorySnapshot) return;
          const snapshot = pendingHistorySnapshot;
          pendingHistorySnapshot = null;
          historyDebounceTimer = null;
          
          set((state) => {
            const past = state.history.past;
            const lastEntry = past[past.length - 1];
            if (lastEntry) {
              const nodesChanged = lastEntry.nodes.length !== snapshot.nodes.length ||
                lastEntry.nodes.some((n, i) => n.id !== snapshot.nodes[i]?.id || n.position.x !== snapshot.nodes[i]?.position.x || n.position.y !== snapshot.nodes[i]?.position.y);
              const edgesChanged = lastEntry.edges.length !== snapshot.edges.length ||
                lastEntry.edges.some((e, i) => e.id !== snapshot.edges[i]?.id);
              if (!nodesChanged && !edgesChanged) return state;
            }
            
            return {
              history: {
                past: [...past.slice(-(MAX_HISTORY_SIZE - 1)), snapshot],
                future: [],
              }
            };
          });
        }, HISTORY_DEBOUNCE_MS);
      },
      
      undo: () => set((state) => {
        if (state.history.past.length === 0) return state;
        const previous = state.history.past[state.history.past.length - 1];
        return {
          nodes: previous.nodes,
          nodeIndex: buildNodeIndex(previous.nodes),
          edges: previous.edges,
          history: {
            past: state.history.past.slice(0, -1),
            future: [{ nodes: state.nodes, edges: state.edges }, ...state.history.future],
          }
        };
      }),

      redo: () => set((state) => {
        if (state.history.future.length === 0) return state;
        const next = state.history.future[0];
        return {
          nodes: next.nodes,
          nodeIndex: buildNodeIndex(next.nodes),
          edges: next.edges,
          history: {
            past: [...state.history.past, { nodes: state.nodes, edges: state.edges }],
            future: state.history.future.slice(1),
          }
        };
      }),
      
      resetCanvas: () => {
        const nodes = get().nodes;
        nodes.forEach((node) => {
          nodeTaskRegistry.cancelAll(node.id);
          void moveNodeAssetsToTrash(node);
        });
        set({
          nodes: [],
          nodeIndex: new Map(),
          edges: [],
          selectedNodeId: null,
          selectedNodeIds: [],
          history: { past: [], future: [] },
        });
      },

      rehydrateAssetBackedMedia: async () => {
        const nodes = get().nodes;
        // 旧的 /storage/aicg-files/... 路径迁移：Nginx proxy_pass 已自动追加 bucket 名，
        // 旧 URL /storage/aicg-files/X 实际请求 /aicg-files/aicg-files/X → 404，需改为 /storage/X
        const migrateLegacyStorageUrl = (url: string | undefined): string | undefined => {
          if (typeof url !== 'string') return url;
          return url.replace(/\/storage\/aicg-files\//g, '/storage/');
        };
        const isStaleUrl = (url: string | undefined): boolean => {
          if (!url) return true;
          if (url.startsWith('blob:')) return true;
          // 旧 /storage/aicg-files/ 路径已失效
          if (/\/storage\/aicg-files\//.test(url)) return true;
          // 已废弃的跨域资源自动跳过
          if (/sudu\.sqxw\.cn|aicgxt\.xyz/i.test(url)) return true;
          return false;
        };
        const hydratedNodes = await Promise.all(
          nodes.map(async (node) => {
            if (!node?.data) return node;

            const nextData = { ...node.data } as Record<string, unknown>;
            let changed = false;

            // 先做旧路径原地迁移（不需要 resolveAssetUrl）
            const fieldsToMigrate = ['imageUrl', 'videoUrl', 'resultUrl'] as const;
            for (const field of fieldsToMigrate) {
              const v = nextData[field];
              if (typeof v === 'string') {
                const migrated = migrateLegacyStorageUrl(v);
                if (migrated !== v) {
                  nextData[field] = migrated;
                  changed = true;
                }
              }
            }
            // 数组字段
            if (Array.isArray(nextData.resultUrls)) {
              const migrated = (nextData.resultUrls as string[]).map(u => migrateLegacyStorageUrl(u));
              if (migrated.some((u, i) => u !== (nextData.resultUrls as string[])[i])) {
                nextData.resultUrls = migrated;
                changed = true;
              }
            }
            // task 内部字段
            const task = nextData.task as Record<string, unknown> | undefined;
            if (task) {
              for (const field of fieldsToMigrate) {
                const v = task[field];
                if (typeof v === 'string') {
                  const migrated = migrateLegacyStorageUrl(v);
                  if (migrated !== v) {
                    nextData.task = { ...task, [field]: migrated };
                    changed = true;
                  }
                }
              }
              if (Array.isArray(task.resultUrls)) {
                const migrated = (task.resultUrls as string[]).map(u => migrateLegacyStorageUrl(u));
                if (migrated.some((u, i) => u !== (task.resultUrls as string[])[i])) {
                  nextData.task = { ...(nextData.task as Record<string, unknown>), resultUrls: migrated };
                  changed = true;
                }
              }
            }

            // 恢复图片 URL
            if (typeof nextData.imageAssetId === 'string') {
              const currentUrl = nextData.imageUrl as string | undefined;
              // 如果 URL 为空，或者是已失效的 URL，则重新解析
              if (isStaleUrl(currentUrl)) {
                const imageUrl = await resolveAssetUrl(nextData.imageAssetId);
                if (imageUrl) {
                  nextData.imageUrl = imageUrl;
                  changed = true;
                }
              }
            }

            // 恢复视频 URL
            if (typeof nextData.videoAssetId === 'string') {
              const currentUrl = nextData.videoUrl as string | undefined;
              if (isStaleUrl(currentUrl)) {
                const videoUrl = await resolveAssetUrl(nextData.videoAssetId);
                if (videoUrl) {
                  nextData.videoUrl = videoUrl;
                  changed = true;
                }
              }
            }

            // 恢复生成结果 URL（含 resultUrls 数组中的失效 URL）
            if (typeof nextData.resultAssetId === 'string') {
              const currentUrl = nextData.resultUrl as string | undefined;
              const currentResultUrls = Array.isArray(nextData.resultUrls) ? (nextData.resultUrls as string[]) : [];
              const hasStale = isStaleUrl(currentUrl) ||
                currentResultUrls.some((u) => isStaleUrl(u));
              if (hasStale) {
                const resultUrl = await resolveAssetUrl(nextData.resultAssetId as string);
                if (resultUrl) {
                  nextData.resultUrl = resultUrl;
                  if (currentResultUrls.length > 0) {
                    nextData.resultUrls = currentResultUrls.map((u) =>
                      (typeof u === 'string' && u.startsWith('blob:')) ? resultUrl : u
                    );
                  }
                  const taskInner = nextData.task as Record<string, unknown> | undefined;
                  if (taskInner) {
                    const taskResultUrl = taskInner.resultUrl as string | undefined;
                    const taskResultUrls = Array.isArray(taskInner.resultUrls) ? (taskInner.resultUrls as string[]) : [];
                    const taskHasStale = isStaleUrl(taskResultUrl) ||
                      taskResultUrls.some((u) => isStaleUrl(u));
                    if (taskHasStale) {
                      nextData.task = {
                        ...taskInner,
                        resultUrl,
                        ...(taskResultUrls.length > 0
                          ? { resultUrls: taskResultUrls.map((u) => (typeof u === 'string' && u.startsWith('blob:')) ? resultUrl : u) }
                          : {}),
                      };
                    }
                  }
                  changed = true;
                }
              }
            }

            return changed ? { ...node, data: nextData } : node;
          })
        );

        const hydrationPatches = new Map<string, {
          beforeData: Record<string, unknown>;
          hydratedData: Record<string, unknown>;
        }>();

        nodes.forEach((sourceNode, index) => {
          const hydratedNode = hydratedNodes[index];
          if (!sourceNode?.data || !hydratedNode?.data || hydratedNode === sourceNode) return;
          hydrationPatches.set(sourceNode.id, {
            beforeData: sourceNode.data as Record<string, unknown>,
            hydratedData: hydratedNode.data as Record<string, unknown>,
          });
        });

        if (hydrationPatches.size > 0) {
          set((state) => {
            let changed = false;
            const nextNodes = state.nodes.map((currentNode) => {
              const patch = hydrationPatches.get(currentNode.id);
              if (!patch || !currentNode?.data) return currentNode;

              const currentData = currentNode.data as Record<string, unknown>;
              const nextData = { ...currentData };
              let nodeChanged = false;

              for (const [key, hydratedValue] of Object.entries(patch.hydratedData)) {
                const beforeValue = patch.beforeData[key];
                if (valuesEquivalent(hydratedValue, beforeValue)) continue;
                if (!valuesEquivalent(currentData[key], beforeValue)) continue;
                nextData[key] = hydratedValue;
                nodeChanged = true;
              }

              if (!nodeChanged) return currentNode;
              changed = true;
              return { ...currentNode, data: nextData };
            });

            return changed ? { nodes: nextNodes } : {};
          });
        }
      },
    }),
    {
      name: 'infinite-flow-canvas',
      version: 2,
      storage: createJSONStorage(() => new CanvasStateStorage() as StateStorage<Promise<void>>),
      partialize: (state) => ({
        persistedProjectId: getActiveProjectIdForPersist(),
        nodes: state.nodes,
        edges: sanitizeEdges(state.edges, state.nodes),
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<CanvasState> | undefined) || {};
        const activeProjectId = getActiveProjectIdForPersist();
        const persistedProjectId = typeof persisted.persistedProjectId === 'string'
          ? persisted.persistedProjectId
          : null;
        const canUsePersistedCanvas = !activeProjectId || !persistedProjectId || activeProjectId === persistedProjectId;
        const rawNodes = canUsePersistedCanvas && Array.isArray(persisted.nodes)
          ? persisted.nodes
          : currentState.nodes;
        const nodes = rawNodes.map((node) => sanitizePersistedNodeRuntimeBlobs(node as Node));
        const edges = canUsePersistedCanvas && Array.isArray(persisted.edges)
          ? sanitizeEdges(persisted.edges, nodes)
          : currentState.edges;
        return {
          ...currentState,
          ...(canUsePersistedCanvas ? persisted : {}),
          persistedProjectId: activeProjectId,
          nodes,
          nodeIndex: buildNodeIndex(nodes),
          edges,
        };
      },
      onRehydrateStorage: () => (state) => {
        logger.info('[CanvasStore] 📦 状态已恢复');
        void state?.rehydrateAssetBackedMedia?.();
      },
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown> | undefined;
        if (version < 2 && state?.state && (state.state as Record<string, unknown>)?.nodes) {
          logger.info('[CanvasStore] 迁移 v1 → v2: 清理旧格式');
          return persistedState;
        }
        return persistedState;
      },
    }
  )
);

// ✅ P1-4：订阅 edges 引用变化，自动重建边索引缓存
let _lastEdgesRef: Edge[] | null = null;
useCanvasStore.subscribe((state) => {
  if (state.edges !== _lastEdgesRef) {
    _lastEdgesRef = state.edges;
    edgeIndexApi.rebuild(state.edges);
  }
});

export const canvasStoreApi = {
  addNode(node: Node<Record<string, unknown>>) {
    useCanvasStore.getState().addNode(node);
  },
  updateNodeData(nodeId: string, data: Partial<Record<string, unknown>>) {
    useCanvasStore.getState().updateNodeData(nodeId, data);
  },
  deleteNode(nodeId: string) {
    useCanvasStore.getState().deleteNode(nodeId);
  },
  setNodes(nodes: Node<Record<string, unknown>>[]) {
    useCanvasStore.getState().setNodes(nodes);
  },
  addEdge(edge: Edge) {
    useCanvasStore.getState().addEdge(edge);
  },
  setEdges(edges: Edge[]) {
    useCanvasStore.getState().setEdges(edges);
  },
  disconnectEdge(sourceNodeId: string, targetNodeId: string, targetHandle?: string) {
    useCanvasStore.getState().disconnectEdge(sourceNodeId, targetNodeId, targetHandle);
  },
  replaceEdgeConnection(
    oldSourceNodeId: string,
    newSourceNodeId: string,
    targetNodeId: string,
    targetHandle?: string,
    newSourceHandle?: string,
  ): boolean {
    return useCanvasStore.getState().replaceEdgeConnection(
      oldSourceNodeId,
      newSourceNodeId,
      targetNodeId,
      targetHandle,
      newSourceHandle,
    );
  },
  commitCanvasState(state: {
    nodes?: Node<Record<string, unknown>>[];
    edges?: Edge[];
    selectedNodeId?: string | null;
    selectedNodeIds?: string[];
  }) {
    useCanvasStore.getState().commitCanvasState(state);
  },
  getNodes() {
    return useCanvasStore.getState().nodes;
  },
  getEdges() {
    return useCanvasStore.getState().edges;
  },
  setSelectedNodeId(nodeId: string | null) {
    useCanvasStore.getState().setSelectedNodeId(nodeId);
  },
  setSelectedNodeIds(ids: string[]) {
    useCanvasStore.getState().setSelectedNodeIds(ids);
  },
};

export async function restoreNodeImages(): Promise<void> {
  const { nodes } = useCanvasStore.getState();
  const idbKeys: string[] = [];
  const videoRefKeys: string[] = [];
  
  nodes.forEach((node) => {
    if (!node?.data) return;
    for (const key of Object.keys(node.data)) {
      const val = (node.data as Record<string, unknown>)[key];
      if (typeof val === 'string') {
        if (val.startsWith(IMG_REF_PREFIX) && !val.startsWith(VIDEO_REF_PREFIX)) {
          idbKeys.push(val.substring(IMG_REF_PREFIX.length));
        } else if (val.startsWith(VIDEO_REF_PREFIX)) {
          videoRefKeys.push(node.id);
        }
      }
    }
  });
  
  // 恢复图片数据
  if (idbKeys.length > 0) {
    const imageMap = new Map<string, string>();
    await Promise.allSettled(
      idbKeys.map(async (key) => {
        const data = await loadFromIDB(key);
        if (data) imageMap.set(key, data);
      })
    );
    
    const latestNodes = useCanvasStore.getState().nodes;
    const restoredNodes = latestNodes.map((node) => {
      if (!node?.data) return node;
      const newData = { ...node.data };
      let changed = false;
      for (const key of Object.keys(newData)) {
        const val = newData[key];
        if (typeof val === 'string' && val.startsWith(IMG_REF_PREFIX) && !val.startsWith(VIDEO_REF_PREFIX)) {
          const idbKey = val.substring(IMG_REF_PREFIX.length);
          const realData = imageMap.get(idbKey);
          if (realData) {
            newData[key] = realData;
            changed = true;
          }
        }
      }
      return changed ? { ...node, data: newData } : node;
    });
    
    useCanvasStore.setState({ nodes: restoredNodes }, false);
    logger.info(`[CanvasStore] ✅ 恢复了 ${imageMap.size} 张图片`);
  }
  
  // 恢复视频数据 - 从 videoStorage 加载并重新创建 blob URL
  if (videoRefKeys.length > 0) {
    try {
      const { videoStorage } = await import('@/lib/video-storage');
      
      const videoRestorations = await Promise.allSettled(
        videoRefKeys.map(async (nodeId) => {
          const storedVideo = await videoStorage.getVideo(nodeId);
          if (storedVideo && storedVideo.blob.size > 0) {
            return { nodeId, blobUrl: URL.createObjectURL(storedVideo.blob), metadata: storedVideo.metadata };
          }
          return null;
        })
      );
      
      const currentNodes = useCanvasStore.getState().nodes;
      const updatedNodes = currentNodes.map((node) => {
        if (!node?.data || !videoRefKeys.includes(node.id)) return node;
        const stillHasVideoRef = Object.values(node.data as Record<string, unknown>).some(
          (value) => typeof value === 'string' && value.startsWith(VIDEO_REF_PREFIX)
        );
        if (!stillHasVideoRef) return node;
        
        const restoration = videoRestorations.find(r => 
          r.status === 'fulfilled' && r.value?.nodeId === node.id
        );
        
        if (restoration && restoration.status === 'fulfilled' && restoration.value) {
          logger.debug(`[CanvasStore] 🎬 恢复视频节点: ${node.id}`, restoration.value.metadata.fileName);
          return {
            ...node,
            data: {
              ...node.data,
              videoUrl: restoration.value.blobUrl,
              fileName: restoration.value.metadata.fileName,
              duration: restoration.value.metadata.duration,
              width: restoration.value.metadata.width,
              height: restoration.value.metadata.height,
            }
          };
        }
        return node;
      });
      
      useCanvasStore.setState({ nodes: updatedNodes }, false);
      logger.info(`[CanvasStore] ✅ 恢复了 ${videoRestorations.filter(r => r.status === 'fulfilled' && r.value).length} 个视频`);
    } catch (error) {
      console.error('[CanvasStore] ❌ 视频恢复失败:', error);
    }
  }
}
