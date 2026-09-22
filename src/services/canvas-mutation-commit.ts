import type { Edge, Node } from '@xyflow/react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { canvasProjectService } from '@/services/canvas-project-service';

const MAX_COMMITTED_HISTORY_SIZE = 20;

interface CanvasMutationOptions {
  history?: boolean;
  flush?: boolean;
}

function cloneNodes(nodes: Node[]): Node<Record<string, unknown>>[] {
  return nodes.map((node) => ({
    ...node,
    data: { ...((node.data || {}) as Record<string, unknown>) },
  }));
}

function cloneEdges(edges: Edge[]): Edge[] {
  return edges.map((edge) => ({ ...edge }));
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function hasSameShape(
  a: { nodes: Node[]; edges: Edge[] },
  b: { nodes: Node[]; edges: Edge[] },
): boolean {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;
  return (
    a.nodes.every((node, index) => {
      const other = b.nodes[index];
      return other?.id === node.id
        && other?.type === node.type
        && other?.position?.x === node.position?.x
        && other?.position?.y === node.position?.y
        && valuesEqual(other?.data, node.data);
    })
    && a.edges.every((edge, index) => {
      const other = b.edges[index];
      return other?.id === edge.id
        && other?.source === edge.source
        && other?.target === edge.target
        && other?.sourceHandle === edge.sourceHandle
        && other?.targetHandle === edge.targetHandle
        && valuesEqual(other?.data, edge.data);
    })
  );
}

export function recordCanvasMutationSnapshot(): void {
  const state = useCanvasStore.getState();
  const snapshot = {
    nodes: cloneNodes(state.nodes),
    edges: cloneEdges(state.edges),
  };

  useCanvasStore.setState((current) => {
    const past = current.history.past;
    const last = past[past.length - 1];
    if (last && hasSameShape(last, snapshot)) return {};
    return {
      history: {
        past: [...past.slice(-(MAX_COMMITTED_HISTORY_SIZE - 1)), snapshot],
        future: [],
      },
    };
  });
}

export function scheduleCanvasPersistence(options: Pick<CanvasMutationOptions, 'flush'> = {}): void {
  if (options.flush) {
    canvasProjectService.flushDebouncedSave();
  } else {
    canvasProjectService.scheduleDebouncedSave();
  }
}

export function commitCanvasMutation<T>(
  mutate: () => T,
  options: CanvasMutationOptions = {},
): T {
  if (options.history !== false) {
    recordCanvasMutationSnapshot();
  }
  const result = mutate();
  scheduleCanvasPersistence(options);
  return result;
}
