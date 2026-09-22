/**
 * AICG 节点打组 + 整组执行
 */

import type { Edge, Node } from '@xyflow/react';
import { generateId } from '@/lib/utils';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { canvasExecutionEngine } from '@/core/canvas-execution-engine';
import { nodeRegistry } from '@/core/node-registry';
import { toast } from 'sonner';

const STORAGE_KEY = 'aicg_canvas_groups';

export interface AICGNodeGroup {
  id: string;
  name: string;
  nodeIds: string[];
  color: string;
  createdAt: string;
}

const GROUP_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];

function loadGroups(): AICGNodeGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AICGNodeGroup[]) : [];
  } catch {
    return [];
  }
}

function saveGroups(groups: AICGNodeGroup[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

export const aicgGroupService = {
  getAll(): AICGNodeGroup[] {
    return loadGroups();
  },

  getById(groupId: string): AICGNodeGroup | undefined {
    return loadGroups().find((g) => g.id === groupId);
  },

  getGroupsContainingNode(nodeId: string): AICGNodeGroup[] {
    return loadGroups().filter((g) => g.nodeIds.includes(nodeId));
  },

  getGroupsForSelection(nodeIds: string[]): AICGNodeGroup[] {
    if (nodeIds.length === 0) return [];
    return loadGroups().filter((g) => g.nodeIds.some((id) => nodeIds.includes(id)));
  },

  createGroup(nodeIds: string[], name?: string): AICGNodeGroup | null {
    const unique = [...new Set(nodeIds)].filter(Boolean);
    if (unique.length < 2) {
      toast.error('请至少选择 2 个节点再打组');
      return null;
    }

    const groups = loadGroups();
    const group: AICGNodeGroup = {
      id: generateId(),
      name: name || `编组 ${groups.length + 1}`,
      nodeIds: unique,
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
      createdAt: new Date().toISOString(),
    };

    groups.push(group);
    saveGroups(groups);

    for (const nodeId of unique) {
      canvasStoreApi.updateNodeData(nodeId, {
        aicgGroupId: group.id,
        aicgGroupName: group.name,
      });
    }

    toast.success(`已创建「${group.name}」(${unique.length} 个节点)`);
    return group;
  },

  renameGroup(groupId: string, name: string) {
    const groups = loadGroups().map((g) => (g.id === groupId ? { ...g, name } : g));
    saveGroups(groups);
  },

  deleteGroup(groupId: string) {
    saveGroups(loadGroups().filter((g) => g.id !== groupId));
    toast.success('已解散编组');
  },

  removeNodesFromAllGroups(nodeIds: string[]) {
    const set = new Set(nodeIds);
    const groups = loadGroups()
      .map((g) => ({ ...g, nodeIds: g.nodeIds.filter((id) => !set.has(id)) }))
      .filter((g) => g.nodeIds.length >= 2);
    saveGroups(groups);
  },

  ungroupSelection(nodeIds: string[]) {
    if (nodeIds.length === 0) return;
    for (const nodeId of nodeIds) {
      canvasStoreApi.updateNodeData(nodeId, { aicgGroupId: undefined, aicgGroupName: undefined });
    }
    this.removeNodesFromAllGroups(nodeIds);
  },
};

const EXECUTABLE_TYPES = new Set([
  'unifiedImageStudio',
  'imageGen',
  'advancedVideoGen',
  'aicgVideoGen',
  'aicgImageGen',
  'videoGen',
  'localMatting',
  'gridSplitter',
  'gridDirector',
  'aiGenText',
  'audioGen',
  'characterConsistency',
  'batchProcess',
]);

function getDependencies(nodeId: string, edges: Edge[], scope: Set<string>): string[] {
  return edges
    .filter((e) => e.target === nodeId && scope.has(e.source))
    .map((e) => e.source);
}

function topologicalOrder(nodeIds: string[], edges: Edge[]): string[] {
  const scope = new Set(nodeIds);
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) return;
    visiting.add(id);
    for (const dep of getDependencies(id, edges, scope)) {
      visit(dep);
    }
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  };

  for (const id of nodeIds) visit(id);
  return order;
}

/** 按依赖顺序整组执行（AICG Ctrl+G 编组后一键重跑） */
export async function executeAICGGroup(groupId: string): Promise<void> {
  const group = aicgGroupService.getById(groupId);
  if (!group) {
    toast.error('编组不存在');
    return;
  }

  const nodes = canvasStoreApi.getNodes();
  const edges = canvasStoreApi.getEdges();
  const groupNodes = nodes.filter((n) => group.nodeIds.includes(n.id));
  nodeRegistry.init();
  const executable = groupNodes.filter((n) => {
    const typeKey = ((n.data as { type?: string })?.type || n.type) as string;
    return nodeRegistry.isExecutable(typeKey);
  });

  if (executable.length === 0) {
    toast.warning('编组内没有可执行的 AI 节点');
    return;
  }

  toast.info(`开始执行「${group.name}」(${executable.length} 个节点)`);

  const result = await canvasExecutionEngine.run(nodes, edges, {
    workflowId: `group-${groupId}`,
    maxParallel: 2,
    filterExecutable: (n) => group.nodeIds.includes(n.id) && executable.some((e) => e.id === n.id),
  });

  if (result.success) {
    toast.success(`编组「${group.name}」执行完成`);
  } else {
    toast.error(result.error || `编组「${group.name}」部分节点执行失败`);
  }
}

export function getExecutableNodesInGroup(group: AICGNodeGroup, nodes: Node[]): Node[] {
  nodeRegistry.init();
  return nodes.filter((n) => {
    if (!group.nodeIds.includes(n.id)) return false;
    const typeKey = ((n.data as { type?: string })?.type || n.type) as string;
    return nodeRegistry.isExecutable(typeKey);
  });
}
