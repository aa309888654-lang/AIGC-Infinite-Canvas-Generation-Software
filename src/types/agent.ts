/**
 * Agent System Core Types
 * 漫剧生成系统 Agent 核心类型定义
 */

import type { Node } from '@xyflow/react';
import type { UnifiedNodeData} from './core';

// ==================== Agent 系统基础类型 ====================

/** Agent 标识符 */
export type AgentId = string;

/** Agent 角色类型 */
export type AgentRole =
  | 'video'
  | 'editing'
  | 'manga'
  | 'voice'
  | 'music'
  | 'node-dev'
  | 'programming'
  | 'search';

/** Agent 执行状态 */
export type AgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

/** Agent 能力接口 */
export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters?: Record<string, unknown>;
}

/** Agent 配置接口 */
export interface AgentConfig {
  id: AgentId;
  name: string;
  role: AgentRole;
  description: string;
  capabilities: AgentCapability[];
  tools: AgentTool[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
  systemPrompt?: string;
  enabled: boolean;
}

/** Agent 工具接口 */
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  definition: AgentToolDefinition;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
  metadata?: {
    executionTime?: number;
    tokens?: number;
  };
}

/** 工具类别 */
export type ToolCategory =
  | 'video-generation'
  | 'video-editing'
  | 'manga-production'
  | 'voice-synthesis'
  | 'music-generation'
  | 'node-development'
  | 'code-generation'
  | 'search'
  | 'api-integration'
  | 'file-operation';

/** Agent 消息接口 */
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  timestamp: Date;
}

/** Agent 执行结果 */
export interface AgentExecutionResult {
  success: boolean;
  message: string;
  toolCalls?: AgentToolCall[];
  finalResult?: unknown;
  iterations: number;
  metadata?: Record<string, unknown>;
}

export interface AgentToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ==================== 节点开发 Agent 类型 ====================

/** 节点类型 */
export type FlowNodeType =
  | 'videoGen'
  | 'advancedVideoGen'
  | 'aicgVideoGen'
  | 'aiVideo'
  | 'imageGen'
  | 'unifiedImageStudio'
  | 'aicgImageGen'
  | 'aiImage'
  | 'audioGen'
  | 'mangaGen'
  | 'textInput'
  | 'aiGenText'
  | 'videoInput'
  | 'frameExtractor'
  | 'imageInput'
  | 'output'
  | 'script'
  | 'scriptStoryboard'
  | 'storyboardMaker'
  | 'adCopyText'
  | 'brandCopyText'
  | 'storyboardEdit'
  | 'vr360Preview'
  | 'multiAngle'
  | 'panorama360'
  | 'director3D'
  | 'characterLibrary'
  | 'characterConsistency'
  | 'prompt'
  | 'imageAnalysis'
  | 'inpainting'
  | 'outpainting'
  | 'custom';

/** 节点开发配置 */
export interface NodeDevConfig {
  nodeType: FlowNodeType;
  label: string;
  category: string;
  icon?: string;
  color?: string;
  inputs?: NodePortConfig[];
  outputs?: NodePortConfig[];
  parameters?: NodeParameterConfig[];
  styles?: NodeStyleConfig;
}

/** 节点端口配置 */
export interface NodePortConfig {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'image' | 'video' | 'audio' | 'any';
  required?: boolean;
  defaultValue?: unknown;
}

/** 节点参数配置 */
export interface NodeParameterConfig {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'slider' | 'color' | 'file';
  label: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

/** 节点样式配置 */
export interface NodeStyleConfig {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  width?: number;
  height?: number;
}

/** React Flow 节点数据 */
export interface FlowNodeData extends UnifiedNodeData {
  agentId?: AgentId;
  nodeConfig?: NodeDevConfig;
  params?: Record<string, unknown>;
  task?: TaskInfo;
}

/** React Flow 节点 */
export type FlowNode = Node<FlowNodeData>;

/** 任务信息 */
export interface TaskInfo {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  resultUrl?: string;
  error?: string;
  createdAt: Date;
}

// ==================== 视频生成 Agent 类型 ====================

/** 视频生成提供商 */
export type VideoProvider = 'seedance' | 'vidu' | 'minimax' | 'doubao';

/** 视频生成参数 */
export interface VideoGenParams {
  provider: VideoProvider;
  prompt: string;
  negativePrompt?: string;
  duration?: number;
  resolution?: '720p' | '1080p' | '4k';
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  startImage?: string;
  endImage?: string;
  referenceImage?: string;
  motionStrength?: number;
  seed?: number;
}

/** 视频生成任务 */
export interface VideoGenTask extends TaskInfo {
  type: 'video';
  params: VideoGenParams;
  resultUrls?: string[];
  duration?: number;
}

/** 角色配置 */
export interface CharacterConfig {
  id: string;
  name: string;
  description: string;
  appearance?: string;
  voice?: string;
  color?: string;
}

// ==================== 配音 Agent 类型 ====================

/** 语音提供商 */
export type VoiceProvider = 'azure' | 'elevenlabs' | 'baidu' | 'aliyun' | 'minimax';

/** 语音参数 */
export interface VoiceParams {
  provider: VoiceProvider;
  text: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited';
}

/** 配音任务 */
export interface VoiceoverTask extends TaskInfo {
  type: 'voiceover';
  params: VoiceParams;
  resultUrl?: string;
  duration?: number;
}

// ==================== 音乐 Agent 类型 ====================

/** 音乐风格 */
export type MusicStyle =
  | 'epic'
  | 'peaceful'
  | 'dramatic'
  | 'romantic'
  | 'comedic'
  | 'action'
  | 'ambient';

/** 音乐参数 */
export interface MusicParams {
  style: MusicStyle;
  mood?: 'upbeat' | 'downbeat' | 'neutral';
  duration?: number;
  instruments?: string[];
  prompt?: string;
}

/** 音乐任务 */
export interface MusicTask extends TaskInfo {
  type: 'music';
  params: MusicParams;
  resultUrl?: string;
  duration?: number;
}

// ==================== 工作流集成 ====================

/** Agent 工作流状态 */
export interface AgentWorkflowState {
  activeAgentId: AgentId | null;
  status: AgentStatus;
  currentTask?: string;
  progress: number;
  output?: unknown;
  error?: string;
}

/** 工作流节点映射 */
export interface WorkflowNodeMapping {
  workflowNodeId: string;
  agentId: AgentId;
  nodeType: FlowNodeType;
  config?: NodeDevConfig;
}
