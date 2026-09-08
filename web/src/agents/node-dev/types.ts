/**
 * Node Development Agent Types
 * 节点开发专家 Agent 类型定义
 */

import type { AgentConfig, AgentCapability, AgentRole} from '@/types/agent';
import type { FlowNodeType, NodeDevConfig, NodePortConfig, NodeParameterConfig } from '@/types/agent';

/** 节点开发 Agent 标识 */
export const NODE_DEV_AGENT_ID = 'node-dev-agent';

/** 节点开发 Agent 角色 */
export type NodeDevAgentRole = AgentRole;

/** 节点开发能力 */
export interface NodeDevCapability extends AgentCapability {
  id: 'create-node' | 'configure-node' | 'generate-code' | 'validate-node' | 'manage-ports';
  parameters?: {
    nodeType?: FlowNodeType;
    inputs?: NodePortConfig[];
    outputs?: NodePortConfig[];
    parameters?: NodeParameterConfig[];
  };
}

/** 节点开发任务 */
export interface NodeDevTask {
  id: string;
  type: 'create' | 'update' | 'delete' | 'validate';
  nodeType: FlowNodeType;
  config?: Partial<NodeDevConfig>;
  code?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  result?: NodeDevResult;
  error?: string;
  createdAt: Date;
}

/** 节点开发结果 */
export interface NodeDevResult {
  nodeId: string;
  config: NodeDevConfig;
  code?: string;
  componentPath?: string;
  tests?: string[];
}

/** 节点模板 */
export interface NodeTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodeType: FlowNodeType;
  icon: string;
  color: string;
  defaultConfig: NodeDevConfig;
  code?: string;
}

/** 节点开发 Agent 配置 */
export interface NodeDevAgentConfig extends Omit<AgentConfig, 'role'> {
  id: typeof NODE_DEV_AGENT_ID;
  role: 'node-dev';
  templates: NodeTemplate[];
  customCategories: string[];
}

/** 节点端口类型 */
export type PortType = 'string' | 'number' | 'boolean' | 'image' | 'video' | 'audio' | 'any';

/** 节点开发工具 */
export interface NodeDevTool {
  id: string;
  name: string;
  description: string;
  category: 'node-creation' | 'code-generation' | 'validation' | 'management';
}

/** 节点开发工作流状态 */
export interface NodeDevWorkflowState {
  currentTask?: NodeDevTask;
  tasks: NodeDevTask[];
  templates: NodeTemplate[];
  lastGeneratedCode?: string;
}
