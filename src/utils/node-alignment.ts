import type { Node } from '@xyflow/react';
import { getCanvasNodeDimensionsFromNode } from '@/lib/canvas-node-dimensions';

export type AlignmentType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export interface AlignmentResult {
  alignedNodes: Node[];
  referenceNode: Node | null;
  alignmentType: AlignmentType;
}

const getNodeWidth = (node: Node): number => getCanvasNodeDimensionsFromNode(node).width;
const getNodeHeight = (node: Node): number => getCanvasNodeDimensionsFromNode(node).height;

export function alignNodes(
  nodes: Node[],
  nodeIds: string[],
  alignmentType: AlignmentType
): AlignmentResult {
  if (nodeIds.length < 2) {
    throw new Error('[NodeAlignment] 至少需要选择 2 个节点进行对齐');
  }

  const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
  if (selectedNodes.length < 2) {
    // 过滤后不足 2 个时返回 null 引用节点，避免访问 undefined
    return { alignedNodes: nodes, referenceNode: selectedNodes[0] ?? null, alignmentType };
  }

  const referenceNode = selectedNodes[0];
  const refWidth = getNodeWidth(referenceNode);
  const refHeight = getNodeHeight(referenceNode);

  const alignedNodes = nodes.map(node => {
    if (!nodeIds.includes(node.id) || node.id === referenceNode.id) {
      return node;
    }

    const newPosition = { ...node.position };
    const nodeWidth = getNodeWidth(node);
    const nodeHeight = getNodeHeight(node);

    switch (alignmentType) {
      case 'left':
        newPosition.x = referenceNode.position.x;
        break;
      case 'center':
        newPosition.x = referenceNode.position.x + refWidth / 2 - nodeWidth / 2;
        break;
      case 'right':
        newPosition.x = referenceNode.position.x + refWidth - nodeWidth;
        break;
      case 'top':
        newPosition.y = referenceNode.position.y;
        break;
      case 'middle':
        newPosition.y = referenceNode.position.y + refHeight / 2 - nodeHeight / 2;
        break;
      case 'bottom':
        newPosition.y = referenceNode.position.y + refHeight - nodeHeight;
        break;
    }

    return { ...node, position: newPosition };
  });

  return { alignedNodes, referenceNode, alignmentType };
}
