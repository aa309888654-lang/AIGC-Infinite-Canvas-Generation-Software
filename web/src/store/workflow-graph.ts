import type { Edge, Node } from '@xyflow/react';

import { validatePortTypes, isMultiplePort, validateNodeConnection } from '@/types/node-system';
import { edgeIndexApi } from '@/store/useEdgeIndexStore';

interface ConnectionValidationResult {
  valid: boolean;
  error?: string;
}

function getNodeType(node: Node): string {
  const dataType = (node.data as { type?: string } | undefined)?.type;
  return dataType || (node.type as string) || '';
}

export function getNodeDependencies(nodeId: string, edges: Edge[]): string[] {
  // ✅ P1-4：优先使用边索引缓存（50 边以上启用）
  const incoming = edgeIndexApi.getIncomingEdges(nodeId, edges);
  return incoming.map((edge) => edge.source);
}

export function validateConnection(
  sourceNode: Node,
  targetNode: Node,
  sourceHandle?: string,
  targetHandle?: string,
  edges: Edge[] = []
): ConnectionValidationResult {
  if (sourceNode.id === targetNode.id) {
    return { valid: false, error: '节点不能连接到自身' };
  }

  const hasDuplicateEdge = edges.some(
    (edge) =>
      edge.source === sourceNode.id &&
      edge.target === targetNode.id &&
      (edge.sourceHandle || undefined) === sourceHandle &&
      (edge.targetHandle || undefined) === targetHandle
  );

  if (hasDuplicateEdge) {
    return { valid: false, error: '相同连接已存在' };
  }

  const isMultiple = targetHandle ? isMultiplePort(getNodeType(targetNode), targetHandle, 'target') : false;

  const targetHandleOccupied =
    !isMultiple &&
    !!targetHandle &&
    edges.some(
      (edge) =>
        edge.target === targetNode.id &&
        (edge.targetHandle || undefined) === targetHandle
    );

  if (targetHandleOccupied) {
    return { valid: false, error: '目标输入端口已被占用' };
  }

  if (!sourceHandle || !targetHandle) {
    return { valid: false, error: '端口句柄不能为空，无法进行类型验证' };
  }

  const portTypeResult = validatePortTypes(
    getNodeType(sourceNode),
    sourceHandle,
    getNodeType(targetNode),
    targetHandle
  );
  if (!portTypeResult.valid) return portTypeResult;

  const nodeRuleResult = validateNodeConnection(
    getNodeType(sourceNode),
    getNodeType(targetNode),
    targetNode.id,
    edges,
  );
  if (!nodeRuleResult.valid) return nodeRuleResult;

  return { valid: true };
}
