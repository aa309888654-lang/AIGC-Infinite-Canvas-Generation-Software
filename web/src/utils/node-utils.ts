/**
 * 统一Node工具函数
 * 
 * 合并所有重复的Node操作工具函数
 * 提供唯一的、权威的Node操作实现
 */

import { generateId } from '@/components/canvas/nodes/timeline/types';

// ==================== 类型定义 ====================

export interface BaseNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  [key: string]: unknown;
}

// ==================== 运行时字段隔离 ====================

/**
 * 节点运行时字段：复制/粘贴时必须剥离，避免新节点继承旧节点的运行状态。
 * - task：旧任务对象（含状态、进度、taskId）
 * - isSubmitting/isProcessing/displayProgress：UI 运行态
 * - generatedAt/mockGeneration/mockGeneratedAt/mockMetadata：mock 生成标记
 */
export const RUNTIME_FIELDS: ReadonlyArray<string> = [
  'task',
  'isSubmitting',
  'isProcessing',
  'displayProgress',
  'generatedAt',
  'mockGeneration',
  'mockGeneratedAt',
  'mockMetadata',
  'generationPaused',
  'activeMediaType',
];

/**
 * 剥离节点的运行时字段，返回干净的可用于复制/粘贴的数据副本。
 */
export function stripRuntimeFields<T extends Record<string, unknown>>(data: T | undefined): T {
  if (!data) return {} as T;
  const cleaned: Record<string, unknown> = { ...data };
  for (const field of RUNTIME_FIELDS) {
    delete cleaned[field];
  }
  return cleaned as T;
}

// ==================== 核心工具函数 ====================

/**
 * 复制节点
 * @param node 要复制的节点
 * @param offset 位置偏移量
 * @returns 新的节点副本
 */
export function duplicateNode<T extends BaseNode>(node: T, offset: { x: number; y: number } = { x: 50, y: 50 }): T {
  return {
    ...node,
    id: generateId(),
    position: {
      x: node.position.x + offset.x,
      y: node.position.y + offset.y,
    },
    data: node.data ? stripRuntimeFields(node.data) : {},
  };
}

/**
 * 批量复制节点
 * @param nodes 要复制的节点数组
 * @param offset 位置偏移量
 * @returns 新的节点数组
 */
export function duplicateNodes<T extends BaseNode>(nodes: T[], offset: { x: number; y: number } = { x: 50, y: 50 }): T[] {
  return nodes.map(node => duplicateNode(node, offset));
}

/**
 * 复制并移动节点到指定位置
 */
export function duplicateAndPositionNode<T extends BaseNode>(
  node: T,
  newPosition: { x: number; y: number }
): T {
  return {
    ...node,
    id: generateId(),
    position: newPosition,
    data: node.data ? stripRuntimeFields(node.data) : {},
  };
}

/**
 * 更新节点数据
 */
export function updateNodeData<T extends BaseNode>(
  node: T,
  updates: Partial<T['data']>
): T {
  return {
    ...node,
    data: {
      ...node.data,
      ...updates,
    },
  };
}

/**
 * 查找节点在指定位置的连接
 */
export function findNodeConnections(
  nodeId: string,
  edges: Array<{ source: string; target: string; [key: string]: unknown }>
): Array<{ source: string; target: string }> {
  return edges.filter(edge => edge.source === nodeId || edge.target === nodeId);
}

/**
 * 获取节点的入边
 */
export function getIncomingEdges(
  nodeId: string,
  edges: Array<{ target: string; [key: string]: unknown }>
): typeof edges {
  return edges.filter(edge => edge.target === nodeId);
}

/**
 * 获取节点的出边
 */
export function getOutgoingEdges(
  nodeId: string,
  edges: Array<{ source: string; [key: string]: unknown }>
): typeof edges {
  return edges.filter(edge => edge.source === nodeId);
}
