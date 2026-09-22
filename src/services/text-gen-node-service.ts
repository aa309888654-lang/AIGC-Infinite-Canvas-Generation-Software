/**
 * 文本生成节点 — 快速创建上下游节点并同步文本
 */

import { generateId } from '@/lib/utils';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { buildDefaultNodeData, getDefaultTargetHandle } from '@/services/node-handle-adjacency';
import {
  findSatelliteNode,
  spawnOrFocusSatelliteNode,
} from '@/services/aicg-satellite-node-service';
import { toast } from 'sonner';

const SPAWN_GAP_X = 500;
const SPAWN_GAP_Y = 40;

export const AICG_TEXT_WORKSPACE_TABS = [
  { id: 'generate', label: '生成文本' },
  { id: 'script', label: '剧本解析' },
] as const;

export type AICGTextWorkspace = (typeof AICG_TEXT_WORKSPACE_TABS)[number]['id'];

export function selectAICGTextWorkspace(nodeId: string, workspace: AICGTextWorkspace) {
  if (workspace === 'generate') {
    canvasStoreApi.updateNodeData(nodeId, { textWorkspace: 'generate' });
  }
}

export function activateAICGTextWorkspaceTab(nodeId: string, workspace: AICGTextWorkspace) {
  if (workspace === 'generate') {
    canvasStoreApi.updateNodeData(nodeId, { textWorkspace: 'generate' });
    return;
  }
  canvasStoreApi.updateNodeData(nodeId, { textWorkspace: 'script' });
}

export function hasAICGTextSatellite(nodeId: string): boolean {
  return Boolean(findSatelliteNode(nodeId, 'script'));
}

export const DEFAULT_SCRIPT_PARAMS = {
  script: '',
  scenes: [] as any[],
  style: '摄影写真',
  model: 'doubao-seedream-5-0-lite',
  scriptType: 'cinematic',
  tone: 'casual',
};

export interface SpawnTextToolOptions {
  initialData?: Record<string, unknown>;
  sourceHandle?: string;
  targetHandle?: string;
  offsetY?: number;
  label?: string;
  /** 新建节点相对源节点的水平方向 */
  direction?: 'left' | 'right';
}

export function spawnTextGenToolNode(
  sourceNodeId: string,
  nodeType: string,
  options: SpawnTextToolOptions = {},
): string | null {
  const source = canvasStoreApi.getNodes().find((n) => n.id === sourceNodeId);
  if (!source) return null;

  const direction = options.direction ?? 'right';
  const stackIndex = canvasStoreApi
    .getEdges()
    .filter((e) => e.source === sourceNodeId || e.target === sourceNodeId).length;

  const newNodeId = generateId();
  const dx = direction === 'left' ? -SPAWN_GAP_X : SPAWN_GAP_X;

  canvasStoreApi.addNode({
    id: newNodeId,
    type: nodeType,
    position: {
      x: source.position.x + dx,
      y: source.position.y + (options.offsetY ?? stackIndex * SPAWN_GAP_Y),
    },
    data: buildDefaultNodeData(nodeType, options.initialData),
  } as never);

  if (direction === 'left') {
    canvasStoreApi.addEdge({
      id: `edge-${newNodeId}-${sourceNodeId}-${Date.now()}`,
      source: newNodeId,
      sourceHandle: nodeType === 'imageInput' ? 'imageOutput' : 'textOutput',
      target: sourceNodeId,
      targetHandle: options.targetHandle || 'promptInput',
      animated: true,
      type: 'comfyui',
    });
  } else {
    canvasStoreApi.addEdge({
      id: `edge-${sourceNodeId}-${newNodeId}-${Date.now()}`,
      source: sourceNodeId,
      sourceHandle: options.sourceHandle || 'textOutput',
      target: newNodeId,
      targetHandle: options.targetHandle || getDefaultTargetHandle(nodeType, 'aiGenText'),
      animated: true,
      type: 'comfyui',
    });
    syncDownstreamFromNode(sourceNodeId);
  }

  toast.success(options.label ? `已创建「${options.label}」并连接` : '已创建节点');
  return newNodeId;
}
