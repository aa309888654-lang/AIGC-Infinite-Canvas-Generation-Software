import { useState, useCallback } from 'react';
import { Node, Edge } from '@xyflow/react';
import { hierarchicalLayout, forceDirectedLayout, equalSpacingLayout, gridEqualLayout, circularLayout } from '@/lib/node-layout';
import { CANVAS_NODE_BASE_WIDTH, CANVAS_NODE_HORIZONTAL_GAP, CANVAS_NODE_VERTICAL_GAP, getCanvasNodeDimensionsFromNode } from '@/lib/canvas-node-dimensions';

export type AutoLayoutType =
  | 'horizontal'
  | 'vertical'
  | 'force'
  | 'equal-h'
  | 'equal-v'
  | 'grid'
  | 'circular'
  | 'flow-smart'
  | 'type-zones'
  | 'compact'
  | 'standard'
  | 'relaxed';

const SPACING_SCALE: Record<'compact' | 'standard' | 'relaxed', number> = {
  compact: 0.55,
  standard: 1,
  relaxed: 1.65,
};

function getNodeTypeRank(node: Node): number {
  const dataType = String((node.data as { type?: unknown } | undefined)?.type || node.type || '').toLowerCase();
  if (dataType.includes('prompt') || dataType.includes('text') || dataType.includes('input')) return 0;
  if (dataType.includes('image') || dataType.includes('img')) return 1;
  if (dataType.includes('video')) return 2;
  if (dataType.includes('audio') || dataType.includes('voice')) return 3;
  if (dataType.includes('output') || dataType.includes('preview')) return 4;
  return 5;
}

function layoutNodesByTypeZones(nodes: Node[], scale = 1): Node[] {
  if (nodes.length === 0) return nodes;
  const ordered = [...nodes].sort((a, b) => {
    const rankDiff = getNodeTypeRank(a) - getNodeTypeRank(b);
    if (rankDiff !== 0) return rankDiff;
    const yDiff = a.position.y - b.position.y;
    return Math.abs(yDiff) > 8 ? yDiff : a.position.x - b.position.x;
  });
  const groups = new Map<number, Node[]>();
  ordered.forEach((node) => {
    const rank = getNodeTypeRank(node);
    groups.set(rank, [...(groups.get(rank) || []), node]);
  });

  const horizontalGap = Math.round(CANVAS_NODE_HORIZONTAL_GAP * scale);
  const verticalGap = Math.round(CANVAS_NODE_VERTICAL_GAP * scale);
  let cursorX = Math.min(...nodes.map((node) => node.position.x));
  const originY = Math.min(...nodes.map((node) => node.position.y));
  const positions = new Map<string, { x: number; y: number }>();

  [...groups.entries()].sort((a, b) => a[0] - b[0]).forEach(([, group]) => {
    let cursorY = originY;
    let maxWidth = 0;
    group.forEach((node) => {
      const size = getCanvasNodeDimensionsFromNode(node);
      positions.set(node.id, { x: Math.round(cursorX), y: Math.round(cursorY) });
      cursorY += size.height + verticalGap;
      maxWidth = Math.max(maxWidth, size.width);
    });
    cursorX += maxWidth + horizontalGap;
  });

  return nodes.map((node) => ({ ...node, position: positions.get(node.id) || node.position }));
}

export const useAutoLayout = (
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[]) => void,
  saveToHistory: () => void,
  fitView: (options?: { padding?: number; duration?: number }) => void,
  selectedNodeIds: string[] = []
) => {
  const [isLayouting, setIsLayouting] = useState(false);

  const handleAutoLayout = useCallback((type: AutoLayoutType) => {
    if (nodes.length === 0) return;
    setIsLayouting(true);

    setTimeout(() => {
      const selectedIdSet = new Set(selectedNodeIds);
      const layoutTargetNodes = selectedNodeIds.length >= 2
        ? nodes.filter((node) => selectedIdSet.has(node.id))
        : nodes;
      const layoutTargetIdSet = new Set(layoutTargetNodes.map((node) => node.id));
      const layoutTargetEdges = edges.filter((edge) => layoutTargetIdSet.has(edge.source) && layoutTargetIdSet.has(edge.target));
      const originX = Math.min(...layoutTargetNodes.map((node) => node.position.x));
      const originY = Math.min(...layoutTargetNodes.map((node) => node.position.y));

      const spacingScale = type === 'compact' || type === 'standard' || type === 'relaxed'
        ? SPACING_SCALE[type]
        : 1;
      const horizontalGap = Math.round(CANVAS_NODE_HORIZONTAL_GAP * spacingScale);
      const verticalGap = Math.round(CANVAS_NODE_VERTICAL_GAP * spacingScale);

      let layoutedNodes: Node[];
      if (type === 'horizontal' || type === 'flow-smart' || type === 'compact' || type === 'standard' || type === 'relaxed') {
        layoutedNodes = hierarchicalLayout(layoutTargetNodes, layoutTargetEdges, {
          direction: 'LR',
          nodeSpacing: verticalGap,
          rankSpacing: horizontalGap,
        });
      } else if (type === 'vertical') {
        layoutedNodes = hierarchicalLayout(layoutTargetNodes, layoutTargetEdges, {
          direction: 'TB',
          nodeSpacing: horizontalGap,
          rankSpacing: verticalGap,
        });
      } else if (type === 'type-zones') {
        layoutedNodes = layoutNodesByTypeZones(layoutTargetNodes, spacingScale);
      } else if (type === 'equal-h') {
        layoutedNodes = equalSpacingLayout(layoutTargetNodes, { direction: 'horizontal', spacing: horizontalGap });
      } else if (type === 'equal-v') {
        layoutedNodes = equalSpacingLayout(layoutTargetNodes, { direction: 'vertical', spacing: verticalGap });
      } else if (type === 'grid') {
        layoutedNodes = gridEqualLayout(layoutTargetNodes, {
          horizontalSpacing: horizontalGap,
          verticalSpacing: verticalGap,
        });
      } else if (type === 'circular') {
        layoutedNodes = circularLayout(layoutTargetNodes, {});
      } else {
        layoutedNodes = forceDirectedLayout(layoutTargetNodes, layoutTargetEdges, {
          iterations: 150,
          springLength: CANVAS_NODE_BASE_WIDTH + horizontalGap,
          springStrength: 0.08,
          repulsion: Math.round(8000 * spacingScale),
          damping: 0.85,
        });
      }

      const layoutMinX = Math.min(...layoutedNodes.map((node) => node.position.x));
      const layoutMinY = Math.min(...layoutedNodes.map((node) => node.position.y));
      const offsetX = originX - layoutMinX;
      const offsetY = originY - layoutMinY;
      const layoutedNodeMap = new Map(layoutedNodes.map((node) => [node.id, {
        ...node,
        position: {
          x: Math.round(node.position.x + offsetX),
          y: Math.round(node.position.y + offsetY),
        },
      }]));

      setNodes(nodes.map((node) => layoutedNodeMap.get(node.id) || node));
      saveToHistory();
      setIsLayouting(false);

      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 50);
    }, 50);
  }, [nodes, edges, selectedNodeIds, setNodes, saveToHistory, fitView]);

  return {
    isLayouting,
    handleAutoLayout,
  };
};
