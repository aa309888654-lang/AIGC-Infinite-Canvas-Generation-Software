/**
 * Flow Store 选择器
 * 提供优化的状态选择函数
 */

import type { Node, Edge } from '@xyflow/react';

// Flow Store 状态类型
interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  apiKeys?: Record<string, unknown>;
  tasks?: Record<string, unknown>;
  executionProgress?: number;
  isRunning?: boolean;
  files?: unknown[];
  storagePath?: string;
  isWorkflowPanelOpen?: boolean;
  isFileManagerOpen?: boolean;
  errors?: unknown[];
  history?: unknown[];
  nodePresets?: unknown[];
}

// 基础选择器类型
type Selector<T> = (state: FlowState) => T;

/**
 * 节点相关选择器
 */
export const selectNodes: Selector<Node[]> = (state) => state.nodes;
export const selectEdges: Selector<Edge[]> = (state) => state.edges;
export const selectSelectedNodeId: Selector<string | null> = (state) => state.selectedNodeId;
export const selectSelectedNodeIds: Selector<string[]> = (state) => state.selectedNodeIds;

/**
 * API 密钥选择器
 */
export const selectApiKeys = (state: FlowState) => state.apiKeys;

/**
 * 任务相关选择器
 */
export const selectTasks = (state: FlowState) => state.tasks;
export const selectExecutionProgress = (state: FlowState) => state.executionProgress;
export const selectIsRunning: Selector<boolean> = (state) => state.isRunning ?? false;

/**
 * 文件相关选择器
 */
export const selectFiles = (state: FlowState) => state.files;
export const selectStoragePath: Selector<string> = (state) => state.storagePath ?? '';

/**
 * UI 状态选择器
 */
export const selectIsWorkflowPanelOpen: Selector<boolean> = (state) => state.isWorkflowPanelOpen ?? false;
export const selectIsFileManagerOpen: Selector<boolean> = (state) => state.isFileManagerOpen ?? false;

/**
 * 错误相关选择器
 */
export const selectErrors = (state: FlowState) => state.errors;

/**
 * 历史记录选择器
 */
export const selectHistory = (state: FlowState) => state.history;

/**
 * 节点预设选择器
 */
export const selectNodePresets = (state: FlowState) => state.nodePresets;

/**
 * 根据节点ID获取节点
 */
export const makeSelectNodeById = (nodeId: string) =>
  (state: FlowState): Node | undefined => state.nodes.find((n: Node) => n.id === nodeId);

/**
 * 根据类型获取可执行节点
 */
export const makeSelectExecutableNodes = () =>
  (state: FlowState): Node[] => {
    const executableTypes = ['aiVideo', 'aiImage', 'advancedVideoGen', 'aicgVideoGen', 'videoGen', 'imageGen', 'unifiedImageStudio', 'aicgImageGen', 'doubaoVideoGen', 'imageToVideo'];
    return state.nodes.filter((n: Node) => executableTypes.includes(n.data?.type as string));
  };

/**
 * 根据节点ID获取输入边
 */
export const makeSelectInputEdges = (nodeId: string) =>
  (state: FlowState): Edge[] => state.edges.filter((e: Edge) => e.target === nodeId);

/**
 * 根据节点ID获取输出边
 */
export const makeSelectOutputEdges = (nodeId: string) =>
  (state: FlowState): Edge[] => state.edges.filter((e: Edge) => e.source === nodeId);
