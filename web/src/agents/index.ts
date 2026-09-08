/**
 * Agents Index
 * 统一导出所有 Agent
 */

// Node Development Agent
export { NodeDevAgent, createNodeDevAgent, DEFAULT_NODE_DEV_CONFIG } from './node-dev/index';
export type { NodeDevAgentConfig, NodeDevTask, NodeDevResult, NodeTemplate } from './node-dev/types';

// Programming Agent
export { ProgrammingAgent, createProgrammingAgent } from './programming/index';
export type { ProgrammingAgentConfig, ProgrammingTask, ProgrammingResult } from './programming/types';

// Video Agent
export { VideoAgent, createVideoAgent } from './video/index';
export type { VideoAgentConfig, VideoTask, VideoCapability } from './video/types';

// Voice Agent
export { VoiceAgent, createVoiceAgent } from './voice/index';
export type { VoiceAgentConfig, VoiceTask, VoiceConfig, CharacterVoiceMapping } from './voice/types';

// Music Agent
export { MusicAgent, createMusicAgent } from './music/index';
export type { MusicAgentConfig, MusicTask, MusicTrack, MixConfig } from './music/types';

// Search Agent
export { SearchAgent, createSearchAgent } from './search/index';
export type { SearchAgentConfig, SearchTask, SearchResultItem, SearchFilters, GithubRepoInfo, NpmPackageInfo } from './search/types';

// Agent Registry
import { NodeDevAgent } from './node-dev/index';
import { ProgrammingAgent } from './programming/index';
import { VideoAgent } from './video/index';
import { VoiceAgent } from './voice/index';
import { MusicAgent } from './music/index';
import { SearchAgent } from './search/index';
import { BaseAgent, type AgentExecutor } from '@/services/agents/agent-framework';

export type AgentType =
  | 'node-dev'
  | 'programming'
  | 'video'
  | 'voice'
  | 'music'
  | 'search';

/** Agent 工厂函数类型 */
export type AgentFactory = (executor: AgentExecutor) => BaseAgent;

/** Agent 注册表 */
export const agentRegistry: Record<AgentType, AgentFactory> = {
  'node-dev': (executor) => new NodeDevAgent(executor),
  programming: (executor) => new ProgrammingAgent(executor),
  video: (executor) => new VideoAgent(executor),
  voice: (executor) => new VoiceAgent(executor),
  music: (executor) => new MusicAgent(executor),
  search: (executor) => new SearchAgent(executor),
};

/** Agent 信息 */
export interface AgentInfo {
  id: AgentType;
  name: string;
  description: string;
  icon: string;
  color: string;
}

/** Agent 信息列表 */
export const agentInfos: AgentInfo[] = [
  {
    id: 'node-dev',
    name: 'Node Dev',
    description: '设计和开发 React Flow 节点组件',
    icon: '🧩',
    color: '#6366f1',
  },
  {
    id: 'programming',
    name: 'Programming',
    description: '编写节点逻辑和交互代码',
    icon: '💻',
    color: '#8b5cf6',
  },
  {
    id: 'video',
    name: 'Video',
    description: '视频生成和处理相关节点开发',
    icon: '🎬',
    color: '#ec4899',
  },
  {
    id: 'voice',
    name: 'Voice',
    description: '语音合成和配音节点开发',
    icon: '🎙️',
    color: '#9CA3AF',
  },
  {
    id: 'music',
    name: 'Music',
    description: '背景音乐和音效节点开发',
    icon: '🎵',
    color: '#ef4444',
  },
  {
    id: 'search',
    name: 'Search',
    description: '搜索和整合开源节点库',
    icon: '🔍',
    color: '#64748b',
  },
];

/**
 * 创建 Agent 实例
 */
export function createAgent(type: AgentType, executor: AgentExecutor): BaseAgent {
  const factory = agentRegistry[type];
  if (!factory) {
    throw new Error(`Unknown agent type: ${type}`);
  }
  return factory(executor);
}

/**
 * 获取 Agent 信息
 */
export function getAgentInfo(type: AgentType): AgentInfo | undefined {
  return agentInfos.find((info) => info.id === type);
}

/**
 * 获取所有 Agent 信息
 */
export function getAllAgentInfos(): AgentInfo[] {
  return [...agentInfos];
}
