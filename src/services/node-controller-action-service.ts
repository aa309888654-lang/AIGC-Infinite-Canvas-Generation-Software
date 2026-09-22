import type { Edge, Node } from '@xyflow/react';
import { generateId } from '@/lib/utils';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { useVirtualRenderStore } from '@/store/useVirtualRenderStore';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { buildDefaultNodeData, getDefaultTargetHandle } from '@/services/node-handle-adjacency';
import { NODE_TYPES } from '@/types/node-system';
import {
  CANVAS_NODE_HORIZONTAL_GAP,
  CANVAS_NODE_VERTICAL_GAP,
  getCanvasNodeDimensions,
  getCanvasNodeDimensionsFromNode,
} from '@/lib/canvas-node-dimensions';
import { toast } from 'sonner';
import type { NodeControllerAction } from '@/components/canvas/nodes/NodeControllerCapabilityPanel';

const DEFAULT_GAP_X = Math.min(CANVAS_NODE_HORIZONTAL_GAP, 24);
const DEFAULT_GAP_Y = Math.min(CANVAS_NODE_VERTICAL_GAP, 24);
const SPAWN_COLLISION_PADDING = 8;
const VISIBLE_SPAWN_PADDING = 32;
const MAX_SPAWN_COLUMNS = 6;
const MAX_SPAWN_ROWS = 18;

export interface SpawnControllerToolNodeOptions {
  controllerActionId?: string;
  label?: string;
  initialData?: Record<string, unknown>;
  sourceHandle?: string;
  targetHandle?: string;
  offsetX?: number;
  offsetY?: number;
  toastLabel?: string;
  select?: boolean;
  replaceExisting?: boolean;
}

export interface ControllerActionConnection {
  edgeId: string;
  nodeId: string;
  nodeType: string;
  label: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface ControllerActionConnectionBinding {
  actionId: string;
  nodeType: string;
  onReplace?: () => void;
}

export interface WithControllerActionConnectionOptions {
  sourceNodeId: string;
  action: NodeControllerAction;
  binding?: ControllerActionConnectionBinding;
  fallbackConnectedLabel?: string;
  graph?: ControllerActionGraphSnapshot;
}

interface ControllerActionGraphSnapshot {
  edges: Edge[];
  nodes: Node[];
}

interface CanvasNodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getDefaultSourceHandle(sourceType?: string): string {
  const explicit: Record<string, string> = {
    aiGenText: 'textOutput',
    textInput: 'textOutput',
    prompt: 'promptOutput',
    script: 'scenes',
    imageInput: 'imageOutput',
    videoInput: 'videoOutput',
    audioGen: 'audioOutput',
    audioInput: 'audioOutput',
    audioController: 'audioOutput',
  };

  if (sourceType && explicit[sourceType]) {
    return explicit[sourceType];
  }

  if (sourceType === 'aicgVideoGen' || sourceType === 'advancedVideoGen' || sourceType === 'aiVideo') {
    return 'output';
  }

  const definition = NODE_TYPES.find((nodeType) => nodeType.id === sourceType);
  if (definition?.outputPorts[0]?.id) {
    return definition.outputPorts[0].id;
  }

  if (sourceType === 'aiGenText' || sourceType === 'textInput') {
    return 'textOutput';
  }
  return 'output';
}

function focusNode(nodeId: string) {
  canvasStoreApi.commitCanvasState({
    selectedNodeIds: [nodeId],
    selectedNodeId: nodeId,
  });
}

function getNodeLabel(data: Record<string, unknown> | undefined, fallback: string) {
  const label = data?.label || data?.title || data?.toolLabel || data?.name;
  return typeof label === 'string' && label.trim() ? label.trim() : fallback;
}

function getNodeRect(node: Node): CanvasNodeRect {
  const dimensions = getCanvasNodeDimensionsFromNode(node);
  return {
    x: node.position.x,
    y: node.position.y,
    width: dimensions.width,
    height: dimensions.height,
  };
}

function rectsOverlap(a: CanvasNodeRect, b: CanvasNodeRect): boolean {
  return (
    a.x < b.x + b.width + SPAWN_COLLISION_PADDING &&
    a.x + a.width + SPAWN_COLLISION_PADDING > b.x &&
    a.y < b.y + b.height + SPAWN_COLLISION_PADDING &&
    a.y + a.height + SPAWN_COLLISION_PADDING > b.y
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getVisibleCanvasRect() {
  if (typeof window === 'undefined') return null;
  const viewport = useVirtualRenderStore.getState().savedViewport;
  if (!viewport?.zoom) return null;

  const left = -viewport.x / viewport.zoom;
  const top = -viewport.y / viewport.zoom;
  return {
    left,
    top,
    right: left + window.innerWidth / viewport.zoom,
    bottom: top + window.innerHeight / viewport.zoom,
  };
}

function fitsVisibleRect(candidate: CanvasNodeRect, visibleRect: ReturnType<typeof getVisibleCanvasRect>): boolean {
  if (!visibleRect) return false;
  return (
    candidate.x >= visibleRect.left + VISIBLE_SPAWN_PADDING &&
    candidate.y >= visibleRect.top + VISIBLE_SPAWN_PADDING &&
    candidate.x + candidate.width <= visibleRect.right - VISIBLE_SPAWN_PADDING &&
    candidate.y + candidate.height <= visibleRect.bottom - VISIBLE_SPAWN_PADDING
  );
}

function findAvailableSpawnPosition(
  baseX: number,
  baseY: number,
  nodeType: string,
  nodes: Node[],
): { x: number; y: number } {
  const dimensions = getCanvasNodeDimensions(nodeType);
  const stepX = dimensions.width + DEFAULT_GAP_X;
  const stepY = dimensions.height + DEFAULT_GAP_Y;
  const occupied = nodes.map(getNodeRect);
  const visibleRect = getVisibleCanvasRect();
  const isFree = (candidate: CanvasNodeRect) => !occupied.some((rect) => rectsOverlap(candidate, rect));

  if (visibleRect) {
    const minX = visibleRect.left + VISIBLE_SPAWN_PADDING;
    const minY = visibleRect.top + VISIBLE_SPAWN_PADDING;
    const maxX = visibleRect.right - VISIBLE_SPAWN_PADDING - dimensions.width;
    const maxY = visibleRect.bottom - VISIBLE_SPAWN_PADDING - dimensions.height;

    if (maxX >= minX && maxY >= minY) {
      const columns = Math.max(1, Math.floor((maxX - minX) / stepX) + 1);
      const rows = Math.max(1, Math.floor((maxY - minY) / stepY) + 1);
      const candidates: CanvasNodeRect[] = [];

      const originX = clamp(baseX, minX, maxX);
      const originY = clamp(baseY, minY, maxY);

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          for (const xDirection of [-1, 1]) {
            for (const yDirection of [-1, 1]) {
              candidates.push({
                x: originX + column * stepX * xDirection,
                y: originY + row * stepY * yDirection,
                width: dimensions.width,
                height: dimensions.height,
              });
            }
          }
        }
      }

      candidates.sort((a, b) =>
        Math.hypot(a.x - baseX, a.y - baseY) - Math.hypot(b.x - baseX, b.y - baseY)
      );

      const visibleCandidate = candidates.find((candidate) => fitsVisibleRect(candidate, visibleRect) && isFree(candidate));
      if (visibleCandidate) return { x: visibleCandidate.x, y: visibleCandidate.y };
    }
  }

  for (let row = 0; row < MAX_SPAWN_ROWS; row += 1) {
    const candidate = {
      x: baseX,
      y: baseY + row * stepY,
      width: dimensions.width,
      height: dimensions.height,
    };
    if (isFree(candidate)) {
      return { x: candidate.x, y: candidate.y };
    }
  }

  for (let column = 1; column < MAX_SPAWN_COLUMNS; column += 1) {
    for (let row = 0; row < MAX_SPAWN_ROWS; row += 1) {
      const candidate = {
        x: baseX + column * stepX,
        y: baseY + row * stepY,
        width: dimensions.width,
        height: dimensions.height,
      };
      if (isFree(candidate)) {
        return { x: candidate.x, y: candidate.y };
      }
    }
  }

  return {
    x: baseX,
    y: baseY + MAX_SPAWN_ROWS * stepY,
  };
}

interface ControllerActionLink {
  edge: Edge;
  node: Node;
}

function findControllerActionLink(
  sourceNodeId: string,
  nodeType: string,
  controllerActionId?: string,
): ControllerActionLink | null {
  const nodes = canvasStoreApi.getNodes();
  const candidates = canvasStoreApi.getEdges()
    .filter((edge) => edge.source === sourceNodeId)
    .map((edge) => ({
      edge,
      node: nodes.find((node) => node.id === edge.target),
    }))
    .filter((link): link is ControllerActionLink => !!link.node && link.node.type === nodeType);

  if (!controllerActionId) return candidates[0] || null;
  return candidates.find(({ node }) => {
    const data = (node.data || {}) as Record<string, unknown>;
    return data._controllerActionId === controllerActionId;
  }) || null;
}

function controllerActionEdgeHasHandles(
  edge: Edge,
  sourceHandle: string,
  targetHandle: string,
): boolean {
  return (edge.sourceHandle || undefined) === sourceHandle && (edge.targetHandle || undefined) === targetHandle;
}

function repairControllerActionEdge(
  edgeId: string,
  sourceNodeId: string,
  targetNodeId: string,
  sourceHandle: string,
  targetHandle: string,
): void {
  canvasStoreApi.setEdges(
    canvasStoreApi.getEdges().map((edge) => {
      if (edge.id !== edgeId) return edge;
      return {
        ...edge,
        source: sourceNodeId,
        sourceHandle,
        target: targetNodeId,
        targetHandle,
        animated: true,
        type: edge.type || 'comfyui',
      };
    }),
  );
}

export function getControllerActionConnection(
  sourceNodeId: string,
  nodeType: string,
  controllerActionId?: string,
  graph?: ControllerActionGraphSnapshot,
): ControllerActionConnection | null {
  const edges = graph?.edges ?? canvasStoreApi.getEdges();
  const nodes = graph?.nodes ?? canvasStoreApi.getNodes();

  for (const edge of edges) {
    if (edge.source !== sourceNodeId) continue;
    const node = nodes.find((entry) => entry.id === edge.target);
    if (!node || node.type !== nodeType) continue;
    const data = (node.data || {}) as Record<string, unknown>;
    if (controllerActionId && data._controllerActionId !== controllerActionId) continue;

    return {
      edgeId: edge.id,
      nodeId: node.id as string,
      nodeType: node.type || nodeType,
      label: getNodeLabel(data, node.type || nodeType),
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    };
  }

  return null;
}

export function focusControllerActionNode(
  sourceNodeId: string,
  nodeType: string,
  controllerActionId?: string,
): boolean {
  const connection = getControllerActionConnection(sourceNodeId, nodeType, controllerActionId);
  if (!connection) return false;
  focusNode(connection.nodeId);
  toast.info(`已聚焦「${connection.label}」`);
  return true;
}

export function disconnectControllerActionNode(
  sourceNodeId: string,
  nodeType: string,
  controllerActionId?: string,
): boolean {
  const connection = getControllerActionConnection(sourceNodeId, nodeType, controllerActionId);
  if (!connection) return false;
  canvasStoreApi.setEdges(canvasStoreApi.getEdges().filter((edge) => edge.id !== connection.edgeId));
  syncDownstreamFromNode(sourceNodeId);
  toast.success(`已断开「${connection.label}」`);
  return true;
}

export function withControllerActionConnection({
  sourceNodeId,
  action,
  binding,
  fallbackConnectedLabel,
  graph,
}: WithControllerActionConnectionOptions): NodeControllerAction {
  if (!binding) {
    return fallbackConnectedLabel
      ? {
          ...action,
          state: 'connected',
          connectedLabel: fallbackConnectedLabel,
          title: `${action.title || action.label} · 已接入：${fallbackConnectedLabel}`,
        }
      : action;
  }

  const connection = getControllerActionConnection(
    sourceNodeId,
    binding.nodeType,
    binding.actionId,
    graph,
  );
  const connectedLabel = connection?.label || fallbackConnectedLabel;

  if (!connectedLabel) return action;

  return {
    ...action,
    state: 'connected',
    connectedLabel,
    title: `${action.title || action.label} · 已接入：${connectedLabel}`,
    onFocusConnection: connection
      ? () => focusControllerActionNode(sourceNodeId, binding.nodeType, binding.actionId)
      : action.onFocusConnection,
    onDisconnectConnection: connection
      ? () => disconnectControllerActionNode(sourceNodeId, binding.nodeType, binding.actionId)
      : action.onDisconnectConnection,
    onReplaceConnection: connection
      ? binding.onReplace || action.onReplaceConnection
      : action.onReplaceConnection,
  };
}

export function spawnControllerToolNode(
  sourceNodeId: string,
  nodeType: string,
  options: SpawnControllerToolNodeOptions = {},
): string | null {
  const source = canvasStoreApi.getNodes().find((node) => node.id === sourceNodeId);
  if (!source) return null;

  const sourceType = source.type || String((source.data as Record<string, unknown> | undefined)?.type || '');
  const sourceHandle = options.sourceHandle || getDefaultSourceHandle(sourceType);
  const targetHandle = options.targetHandle || getDefaultTargetHandle(nodeType, sourceType);
  const existingLink = findControllerActionLink(sourceNodeId, nodeType, options.controllerActionId);
  const existing = existingLink?.node;

  if (existing && options.replaceExisting) {
    canvasStoreApi.setEdges(
      canvasStoreApi.getEdges().filter((edge) => edge.id !== existingLink?.edge.id)
    );
  } else if (existing) {
    const repairedExistingEdge =
      !!options.controllerActionId &&
      !!existingLink &&
      !controllerActionEdgeHasHandles(existingLink.edge, sourceHandle, targetHandle);

    if (repairedExistingEdge && existingLink) {
      repairControllerActionEdge(
        existingLink.edge.id,
        sourceNodeId,
        existing.id as string,
        sourceHandle,
        targetHandle,
      );
    }

    if (options.initialData) {
      canvasStoreApi.updateNodeData(existing.id as string, options.initialData);
    }

    if (options.initialData || repairedExistingEdge) {
      syncDownstreamFromNode(sourceNodeId);
    }
    focusNode(existing.id as string);
    toast.info(options.toastLabel ? `已切换到「${options.toastLabel}」` : '已聚焦关联节点');
    return existing.id as string;
  }

  const newNodeId = generateId();
  const sourceDimensions = getCanvasNodeDimensionsFromNode(source);
  const label = options.label || options.toastLabel;
  const defaultOffsetX = sourceDimensions.width + DEFAULT_GAP_X;
  const defaultOffsetY = 0;
  const baseX = source.position.x + (options.offsetX ?? defaultOffsetX);
  const baseY = source.position.y + (options.offsetY ?? defaultOffsetY);
  const position = findAvailableSpawnPosition(baseX, baseY, nodeType, canvasStoreApi.getNodes());

  const newNode: Node = {
    id: newNodeId,
    type: nodeType,
    position,
    data: buildDefaultNodeData(nodeType, {
      spawnedFrom: sourceNodeId,
      spawnedFromType: sourceType,
      ...(options.controllerActionId ? { _controllerActionId: options.controllerActionId } : {}),
      ...(label ? { label, title: label, toolLabel: label } : {}),
      ...options.initialData,
    }),
  } as Node;

  const newEdge: Edge = {
    id: `edge-${sourceNodeId}-${newNodeId}-${Date.now()}`,
    source: sourceNodeId,
    sourceHandle,
    target: newNodeId,
    targetHandle,
    animated: true,
    type: 'comfyui',
  };

  const nextNodes = [...canvasStoreApi.getNodes(), newNode];
  const nextEdges = [...canvasStoreApi.getEdges(), newEdge];
  canvasStoreApi.commitCanvasState({
    nodes: nextNodes,
    edges: nextEdges,
    ...(options.select === false
      ? {}
      : {
          selectedNodeIds: [newNodeId],
          selectedNodeId: newNodeId,
        }),
  });

  syncDownstreamFromNode(sourceNodeId);
  toast.success(options.toastLabel
    ? `已${options.replaceExisting ? '替换' : '创建'}「${options.toastLabel}」并连接`
    : `已${options.replaceExisting ? '替换' : '创建'}关联节点`);
  return newNodeId;
}
