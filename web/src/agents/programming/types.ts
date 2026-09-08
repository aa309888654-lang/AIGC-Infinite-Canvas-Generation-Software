/**
 * Programming Agent Types
 * 节点编程 Agent 类型定义
 */

import type { AgentConfig, AgentCapability} from '@/types/agent';

/** 编程 Agent 标识 */
export const PROGRAMMING_AGENT_ID = 'programming-agent';

/** 编程能力 */
export interface ProgrammingCapability extends AgentCapability {
  id: 'state-management' | 'event-handling' | 'data-flow' | 'api-integration' | 'error-handling';
}

/** 编程任务 */
export interface ProgrammingTask {
  id: string;
  type: 'implement' | 'refactor' | 'debug' | 'optimize';
  targetNodeId?: string;
  description: string;
  code?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  result?: ProgrammingResult;
  error?: string;
}

/** 编程结果 */
export interface ProgrammingResult {
  code: string;
  language: string;
  framework: string;
  tests?: string[];
  documentation?: string;
}

/** 编程语言 */
export type ProgrammingLanguage = 'typescript' | 'javascript' | 'python' | 'rust';

/** 框架 */
export type Framework = 'react' | 'vue' | 'svelte' | 'vanilla';

/** 状态管理库 */
export type StateManagement = 'zustand' | 'redux' | 'jotai' | 'valtio' | 'react-context';

/** 编程 Agent 配置 */
export interface ProgrammingAgentConfig extends Omit<AgentConfig, 'role'> {
  id: typeof PROGRAMMING_AGENT_ID;
  role: 'programming';
  language: ProgrammingLanguage;
  framework: Framework;
  stateManagement: StateManagement;
  lintingRules: string[];
  formattingRules: string[];
}
