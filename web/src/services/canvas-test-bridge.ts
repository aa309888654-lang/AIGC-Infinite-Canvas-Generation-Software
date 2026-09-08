/**
 * 开发 / E2E 测试用画布 API（仅 DEV 挂载到 window）
 */
import { generateId } from '@/lib/utils';
import { canvasStoreApi, useCanvasStore } from '@/store/useCanvasStore';
import {
  getActiveNodeDefinitions,
  getRegistrySummary,
} from '@/services/canvas-node-registry-validator';
import {
  NODE_INTERACTION_SPECS,
  validateInteractionSpecCoverage,
  type NodeInteractionSpec,
} from '@/services/canvas-node-interaction-specs';
import { resolveNodeDefinition, nodeRegistry } from '@/core/node-registry';
import { mcpClientHub } from '@/core/mcp-client-hub';
import { canvasExecutionEngine } from '@/core/canvas-execution-engine';
import { buildNodeDataFromDefinition } from '@/types/node-system';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { useTimelineStore } from '@/store/editmaster/useTimelineStore';
import type { Clip } from '@/store/editmaster/types';
import {
  getCanvasNodeOverlapPairs,
  layoutCanvasNodesInRows,
} from '@/lib/canvas-node-dimensions';

export interface MountAllResult {
  mounted: string[];
  failed: Array<{ type: string; error: string }>;
}

export interface MountSingleResult {
  nodeId: string;
  nodeType: string;
  name: string;
}

export function mountAllActiveNodes(): MountAllResult {
  const mounted: string[] = [];
  const failed: Array<{ type: string; error: string }> = [];
  const defs = getActiveNodeDefinitions();
  const nodes = layoutCanvasNodesInRows(
    defs.map((def, index) => ({
      id: `test-${def.id}-${index}`,
      type: def.id,
      position: { x: 20, y: 20 },
      data: buildNodeDataFromDefinition(def),
    })),
    {
      columns: 4,
      origin: { x: 20, y: 20 },
    },
  );

  canvasStoreApi.setNodes([]);
  canvasStoreApi.setEdges([]);
  try {
    canvasStoreApi.setNodes(nodes as never);
    mounted.push(...nodes.map((node) => node.type as string));
  } catch (err) {
    failed.push({
      type: 'canvas',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { mounted, failed };
}

export function mountSingleNode(nodeType: string): MountSingleResult | null {
  const def = resolveNodeDefinition(nodeType);
  if (!def || def.deprecated) return null;

  const nodeId = `e2e-${nodeType}-${generateId()}`;
  canvasStoreApi.setNodes([]);
  canvasStoreApi.setEdges([]);
  canvasStoreApi.addNode({
    id: nodeId,
    type: nodeType,
    position: { x: 120, y: 120 },
    data: buildNodeDataFromDefinition(def),
  });
  useCanvasStore.getState().setSelectedNodeId(nodeId);
  useCanvasStore.getState().setSelectedNodeIds([nodeId]);

  return { nodeId, nodeType, name: def.name };
}

export function clearTestCanvas() {
  canvasStoreApi.setNodes([]);
  canvasStoreApi.setEdges([]);
  useCanvasStore.getState().setSelectedNodeId(null);
  useCanvasStore.getState().setSelectedNodeIds([]);
}

export function getCanvasNodeCount() {
  return canvasStoreApi.getNodes().length;
}

export function getCanvasSnapshot() {
  return {
    nodes: canvasStoreApi.getNodes(),
    edges: canvasStoreApi.getEdges(),
  };
}

export function getCanvasOverlapReport() {
  return getCanvasNodeOverlapPairs(canvasStoreApi.getNodes()).map((pair) => ({
    aId: pair.a.id,
    bId: pair.b.id,
    aType: String(pair.a.type || pair.a.data?.type || 'unknown'),
    bType: String(pair.b.type || pair.b.data?.type || 'unknown'),
  }));
}

export function setCanvasSnapshotForTest(snapshot: {
  nodes?: Parameters<typeof canvasStoreApi.setNodes>[0];
  edges?: Parameters<typeof canvasStoreApi.setEdges>[0];
}) {
  canvasStoreApi.setNodes(snapshot.nodes || []);
  canvasStoreApi.setEdges(snapshot.edges || []);
}

export function updateNodeDataForTest(nodeId: string, data: Partial<Record<string, unknown>>) {
  canvasStoreApi.updateNodeData(nodeId, data);
}

export function syncDownstreamFromNodeForTest(nodeId: string) {
  return syncDownstreamFromNode(nodeId);
}

export function getTimelineSnapshotForTest() {
  const state = useTimelineStore.getState();
  return {
    assets: state.assets,
    sequences: state.sequences,
    activeSequenceId: state.activeSequenceId,
    currentFrame: state.currentFrame,
  };
}

export function resetTimelineForTest() {
  const state = useTimelineStore.getState();
  state.assets.forEach((asset) => state.removeAsset(asset.id));

  const nextState = useTimelineStore.getState();
  const activeSequence = nextState.sequences.find((sequence) => sequence.id === nextState.activeSequenceId);
  activeSequence?.tracks.forEach((track) => {
    track.clips.forEach((clip) => nextState.removeClip(clip.id));
  });
  activeSequence?.markers?.forEach((marker) => nextState.removeMarker(marker.id));
  nextState.setCurrentFrame(0);
}

export function addAllTimelineAssetsToClipsForTest() {
  const state = useTimelineStore.getState();
  const sequence = state.sequences.find((item) => item.id === state.activeSequenceId);
  if (!sequence) return { added: 0, reason: 'active sequence missing' };

  const videoTrack = sequence.tracks.find((track) => track.type === 'video' && !track.locked);
  const audioTrack = sequence.tracks.find((track) => track.type === 'audio' && !track.locked);
  if (!videoTrack && !audioTrack) return { added: 0, reason: 'editable tracks missing' };

  let visualCursor = 0;
  let audioCursor = 0;
  let added = 0;
  const fps = state.fps || 30;

  state.assets.forEach((asset) => {
    const isAudio = asset.type === 'audio';
    const targetTrack = isAudio ? audioTrack : videoTrack;
    if (!targetTrack) return;

    const durationSeconds =
      typeof asset.duration === 'number' && Number.isFinite(asset.duration) && asset.duration > 0
        ? asset.duration
        : asset.type === 'image'
          ? 3
          : 5;
    const durationFrames = Math.max(fps, Math.round(durationSeconds * fps));
    const kind: Clip['kind'] = isAudio ? 'audio' : asset.type === 'image' ? 'image' : 'video';
    const startFrame = isAudio ? audioCursor : visualCursor;

    state.addClip(
      targetTrack.id,
      kind,
      startFrame,
      durationFrames,
      asset.name,
      asset.id,
      undefined,
      undefined,
      asset.storyboard,
    );

    if (isAudio) audioCursor += durationFrames;
    else visualCursor += durationFrames;
    added += 1;
  });

  return { added };
}

export function getInteractionSpecs(): NodeInteractionSpec[] {
  return NODE_INTERACTION_SPECS;
}

export function getInteractionCoverageGaps(): string[] {
  return validateInteractionSpecCoverage();
}

export function installCanvasTestBridge() {
  if (typeof window === 'undefined') return;
  (window as any as { __xiaotianCanvasTest?: Record<string, unknown> }).__xiaotianCanvasTest = {
    getRegistrySummary,
    mountAllActiveNodes,
    mountSingleNode,
    clearCanvas: clearTestCanvas,
    getNodeCount: getCanvasNodeCount,
    getCanvasSnapshot,
    getCanvasOverlapReport,
    setCanvasSnapshot: setCanvasSnapshotForTest,
    updateNodeData: updateNodeDataForTest,
    syncDownstreamFromNode: syncDownstreamFromNodeForTest,
    getTimelineSnapshot: getTimelineSnapshotForTest,
    resetTimeline: resetTimelineForTest,
    addAllTimelineAssetsToClips: addAllTimelineAssetsToClipsForTest,
    getInteractionSpecs,
    getInteractionCoverageGaps,
    generateId,
    nodeRegistry,
    mcpClientHub,
    canvasExecutionEngine,
  };
}
