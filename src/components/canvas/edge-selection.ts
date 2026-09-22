import { Edge } from '@xyflow/react';

export function toggleEdgeSelection(args: {
  selectedEdgeId: string | null;
  clickedEdgeId: string;
  edges: Edge[];
}) {
  if (args.selectedEdgeId === args.clickedEdgeId) {
    return {
      selectedEdgeId: null,
      edges: args.edges.filter((edge) => edge.id !== args.clickedEdgeId),
      removed: true,
    };
  }

  return {
    selectedEdgeId: args.clickedEdgeId,
    edges: args.edges,
    removed: false,
  };
}

export function deleteSelectedEdge(args: {
  selectedEdgeId: string | null;
  edges: Edge[];
}) {
  if (!args.selectedEdgeId) {
    return {
      selectedEdgeId: null,
      edges: args.edges,
      removed: false,
    };
  }

  return {
    selectedEdgeId: null,
    edges: args.edges.filter((edge) => edge.id !== args.selectedEdgeId),
    removed: true,
  };
}
