import type { Edge } from '@xyflow/react';
import { withEdgeFlowOff, withEdgeSignalPulse } from './aicg-port-visuals';

const FLOW_DURATION_MS = 1400;

export function applyEdgeSignalPulse(edges: Edge[], edgeId: string): Edge[] {
  return edges.map((edge) =>
    edge.id === edgeId
      ? { ...edge, data: withEdgeSignalPulse(edge.data as Record<string, unknown> | undefined) }
      : edge,
  );
}

export function applyNodeEdgesSignalPulse(edges: Edge[], nodeId: string): Edge[] {
  const now = Date.now();
  return edges.map((edge) =>
    edge.source === nodeId || edge.target === nodeId
      ? {
          ...edge,
          data: {
            ...(edge.data as Record<string, unknown> | undefined),
            signalPulse: now,
            flowing: true,
          },
        }
      : edge,
  );
}

export function clearEdgesFlowing(edges: Edge[], edgeIds: Set<string>): Edge[] {
  if (edgeIds.size === 0) return edges;
  return edges.map((edge) =>
    edgeIds.has(edge.id)
      ? { ...edge, data: withEdgeFlowOff(edge.data as Record<string, unknown> | undefined) }
      : edge,
  );
}

export function scheduleClearEdgeFlow(
  edgeIds: string[],
  getEdges: () => Edge[],
  setEdges: (edges: Edge[]) => void,
): void {
  if (edgeIds.length === 0) return;
  const idSet = new Set(edgeIds);
  window.setTimeout(() => {
    setEdges(clearEdgesFlowing(getEdges(), idSet));
  }, FLOW_DURATION_MS);
}

export function pulseEdgeSignal(
  edgeId: string,
  getEdges: () => Edge[],
  setEdges: (edges: Edge[]) => void,
): void {
  setEdges(applyEdgeSignalPulse(getEdges(), edgeId));
  scheduleClearEdgeFlow([edgeId], getEdges, setEdges);
}

export function pulseNodeEdgeSignals(
  nodeId: string,
  getEdges: () => Edge[],
  setEdges: (edges: Edge[]) => void,
): void {
  const relatedIds = getEdges()
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => e.id);
  if (relatedIds.length === 0) return;
  setEdges(applyNodeEdgesSignalPulse(getEdges(), nodeId));
  scheduleClearEdgeFlow(relatedIds, getEdges, setEdges);
}
