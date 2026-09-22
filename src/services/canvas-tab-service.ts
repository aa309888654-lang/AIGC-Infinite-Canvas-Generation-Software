/**
 * 同项目多画布 Tab — 每个 Tab 独立 nodes/edges/viewport
 */

import { generateId } from '@/lib/utils';
import { canvasStoreApi } from '@/store/useCanvasStore';
import type { Edge, Node, Viewport } from '@xyflow/react';

const STORAGE_KEY = 'aicg_canvas_tabs_v1';

export interface CanvasTabSnapshot {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  updatedAt: string;
}

interface CanvasTabState {
  tabs: CanvasTabSnapshot[];
  activeTabId: string;
}

function loadState(): CanvasTabState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CanvasTabState;
  } catch {
    /* ignore */
  }
  return {
    tabs: [{ id: 'default', name: '画布 1', nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 }, updatedAt: new Date().toISOString() }],
    activeTabId: 'default',
  };
}

function saveState(state: CanvasTabState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

const memory = loadState();

function persist() {
  saveState(memory);
}

export const canvasTabService = {
  list(): CanvasTabSnapshot[] {
    return memory.tabs;
  },

  activeId(): string {
    return memory.activeTabId;
  },

  /** 保存当前 store 到 active tab */
  saveCurrent(viewport: Viewport) {
    const nodes = canvasStoreApi.getNodes();
    const edges = canvasStoreApi.getEdges();
    memory.tabs = memory.tabs.map((t) =>
      t.id === memory.activeTabId
        ? { ...t, nodes, edges, viewport, updatedAt: new Date().toISOString() }
        : t,
    );
    persist();
  },

  /** 切换 tab：先存当前，再载入目标（调用方负责先 saveCurrent） */
  switchTab(tabId: string, applyViewport: (vp: Viewport) => void) {
    const target = memory.tabs.find((t) => t.id === tabId);
    if (!target) return;
    memory.activeTabId = tabId;
    persist();
    canvasStoreApi.setNodes(target.nodes);
    canvasStoreApi.setEdges(target.edges);
    applyViewport(target.viewport || { x: 0, y: 0, zoom: 1 });
  },

  createTab(name?: string): CanvasTabSnapshot {
    this.saveCurrent({ x: 0, y: 0, zoom: 1 });
    const tab: CanvasTabSnapshot = {
      id: generateId(),
      name: name || `画布 ${memory.tabs.length + 1}`,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      updatedAt: new Date().toISOString(),
    };
    memory.tabs.push(tab);
    memory.activeTabId = tab.id;
    persist();
    canvasStoreApi.setNodes([]);
    canvasStoreApi.setEdges([]);
    return tab;
  },

  renameTab(tabId: string, name: string) {
    memory.tabs = memory.tabs.map((t) => (t.id === tabId ? { ...t, name } : t));
    persist();
  },

  closeTab(tabId: string): string | null {
    if (memory.tabs.length <= 1) return memory.activeTabId;
    memory.tabs = memory.tabs.filter((t) => t.id !== tabId);
    if (memory.activeTabId === tabId) {
      memory.activeTabId = memory.tabs[0].id;
    }
    persist();
    return memory.activeTabId;
  },
};
