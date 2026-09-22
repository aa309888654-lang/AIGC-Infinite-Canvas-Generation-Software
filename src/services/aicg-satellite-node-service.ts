/**
 * 卫星节点 — 由基础节点按钮创建、自动连线，不出现在节点资源库
 * （AICG：主节点集成入口，功能在独立子节点执行）
 */

import type { Node } from '@xyflow/react';
import { generateId } from '@/lib/utils';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { buildDefaultNodeData, getDefaultTargetHandle } from '@/services/node-handle-adjacency';
import { toast } from 'sonner';

const SPAWN_GAP_X = 520;
const SPAWN_GAP_Y = 56;

/** 仅允许通过父节点 / 句柄 / 指令创建，不在节点库展示 */
export const SATELLITE_NODE_TYPES = new Set([
  'imageCollage',
  'gridSplitter',
  'script',
]);

export type SatelliteNodeType = 'imageCollage' | 'gridSplitter' | 'script';

export interface SpawnSatelliteOptions {
  label?: string;
  initialData?: Record<string, unknown>;
  sourceHandle?: string;
  targetHandle?: string;
  offsetY?: number;
  forceNew?: boolean;
}

export function isSatelliteNodeType(type: string | undefined): boolean {
  return Boolean(type && SATELLITE_NODE_TYPES.has(type));
}

/** 查找已从 source 连出的指定类型卫星节点 */
export function findSatelliteNode(sourceNodeId: string, satelliteType: string): Node | undefined {
  const edges = canvasStoreApi.getEdges();
  const nodes = canvasStoreApi.getNodes();
  for (const edge of edges) {
    if (edge.source !== sourceNodeId) continue;
    const target = nodes.find((n) => n.id === edge.target);
    if (target?.type === satelliteType) return target;
  }
  return undefined;
}

function focusNode(nodeId: string) {
  canvasStoreApi.setSelectedNodeIds([nodeId]);
  canvasStoreApi.setSelectedNodeId(nodeId);
}

/** 聚焦已有卫星节点，否则新建并连线 */
export function spawnOrFocusSatelliteNode(
  sourceNodeId: string,
  satelliteType: SatelliteNodeType,
  options: SpawnSatelliteOptions = {},
): string | null {
  const existing = options.forceNew ? undefined : findSatelliteNode(sourceNodeId, satelliteType);
  if (existing) {
    if (options.initialData) {
      canvasStoreApi.updateNodeData(existing.id as string, options.initialData);
      syncDownstreamFromNode(sourceNodeId);
    }
    focusNode(existing.id as string);
    toast.info(options.label ? `已切换到「${options.label}」` : '已聚焦关联节点');
    return existing.id as string;
  }

  const source = canvasStoreApi.getNodes().find((n) => n.id === sourceNodeId);
  if (!source) return null;

  const stackIndex = canvasStoreApi.getEdges().filter((e) => e.source === sourceNodeId).length;
  const newNodeId = generateId();
  const defaultSourceHandle =
    source.type === 'aicgImageGen' || source.type === 'unifiedImageStudio' || source.type === 'imageGen'
      ? 'output'
      : source.type === 'aiGenText' || source.type === 'textInput'
        ? 'textOutput'
        : 'imageOutput';

  canvasStoreApi.addNode({
    id: newNodeId,
    type: satelliteType,
    position: {
      x: source.position.x + SPAWN_GAP_X,
      y: source.position.y + (options.offsetY ?? stackIndex * SPAWN_GAP_Y),
    },
    data: buildDefaultNodeData(satelliteType, {
      spawnedFrom: sourceNodeId,
      spawnedFromType: source.type,
      ...options.initialData,
    }),
  } as never);

  window.setTimeout(() => {
    canvasStoreApi.addEdge({
      id: `edge-${sourceNodeId}-${newNodeId}-${Date.now()}`,
      source: sourceNodeId,
      sourceHandle: options.sourceHandle || defaultSourceHandle,
      target: newNodeId,
      targetHandle:
        options.targetHandle || getDefaultTargetHandle(satelliteType, source.type || 'imageInput'),
      animated: true,
      type: 'comfyui',
    });

    syncDownstreamFromNode(sourceNodeId);
  }, 250);

  focusNode(newNodeId);
  toast.success(options.label ? `已创建「${options.label}」并连接` : '已创建关联节点');
  return newNodeId;
}
