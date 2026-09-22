/**
 * AICG「我的工具箱」— 保存 / 加载工作流片段模板
 */

import type { Edge, Node } from '@xyflow/react';
import { generateId } from '@/lib/utils';

const STORAGE_KEY = 'aicg_my_toolbox';

export interface AICGToolboxItem {
  id: string;
  name: string;
  description: string;
  tags: string[];
  nodes: Node[];
  edges: Edge[];
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

function loadAll(): AICGToolboxItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AICGToolboxItem[]) : [];
  } catch {
    return [];
  }
}

function persist(items: AICGToolboxItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const aicgToolboxService = {
  list(): AICGToolboxItem[] {
    return loadAll().sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  },

  saveFromSelection(
    name: string,
    nodes: Node[],
    edges: Edge[],
    selectedNodeIds: string[],
    description = '',
  ): AICGToolboxItem | null {
    const idSet = new Set(selectedNodeIds);
    if (idSet.size === 0) {
      return null;
    }

    const subNodes = nodes.filter((n) => idSet.has(n.id));
    const subEdges = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));

    const item: AICGToolboxItem = {
      id: generateId(),
      name,
      description,
      tags: ['AICG', '工具箱'],
      nodes: subNodes,
      edges: subEdges,
      nodeCount: subNodes.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const all = loadAll();
    all.unshift(item);
    persist(all.slice(0, 50));
    return item;
  },

  remove(id: string) {
    persist(loadAll().filter((i) => i.id !== id));
  },

  /** 将模板插入画布（重新生成 id，保持相对位置） */
  instantiate(
    item: AICGToolboxItem,
    offset: { x: number; y: number },
  ): { nodes: Node[]; edges: Edge[] } {
    const idMap = new Map<string, string>();
    for (const n of item.nodes) {
      idMap.set(n.id, generateId());
    }

    const minX = Math.min(...item.nodes.map((n) => n.position.x));
    const minY = Math.min(...item.nodes.map((n) => n.position.y));

    const nodes = item.nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      position: {
        x: n.position.x - minX + offset.x,
        y: n.position.y - minY + offset.y,
      },
      selected: false,
    }));

    const edges = item.edges.map((e) => ({
      ...e,
      id: `edge-${idMap.get(e.source)}-${idMap.get(e.target)}-${Date.now()}`,
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
    }));

    return { nodes, edges };
  },
};
