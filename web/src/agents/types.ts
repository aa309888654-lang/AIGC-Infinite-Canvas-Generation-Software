/**
 * 通用 Agent 类型定义
 * 用于所有 Agent 模块
 */

/** Agent 能力接口 */
export interface AgentCapability {
  type: string;
  description: string;
  features?: string[];
  models?: string[];
}

/** Agent 执行输入 */
export interface AgentInput {
  type: string;
  params?: Record<string, unknown>;
  effectId?: string;
}

/** Agent 执行输出 */
export interface AgentOutput {
  success: boolean;
  [key: string]: unknown;
}

/** Agent 核心接口 */
export interface Agent {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilities: AgentCapability[];
  tools: string[];
  nodeTypes?: string[];
  execute: (input: AgentInput, context?: Record<string, unknown>) => Promise<AgentOutput>;
}

/** Agent 工厂函数类型 */
export type AgentFactory = () => Agent;
