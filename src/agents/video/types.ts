/**
 * Video Agent Types
 * 影视视频 Agent 类型定义
 */

import type { AgentConfig, AgentCapability} from '@/types/agent';
import type { VideoProvider, VideoGenParams } from '@/types/agent';

/** 视频 Agent 标识 */
export const VIDEO_AGENT_ID = 'video-agent';

/** 视频 Agent 能力 */
export interface VideoCapability extends AgentCapability {
  id: 'video-generation' | 'video-config' | 'video-preview' | 'video-convert' | 'format-transcode';
  parameters?: Record<string, unknown>;
}

/** 视频任务 */
export interface VideoTask {
  id: string;
  type: 'generate' | 'preview' | 'convert' | 'transcode' | 'edit';
  provider: VideoProvider;
  params: Partial<VideoGenParams>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  progress?: number;
  error?: string;
  createdAt: Date;
}

/** 视频预览配置 */
export interface VideoPreviewConfig {
  videoUrl: string;
  startTime?: number;
  endTime?: number;
  quality?: 'low' | 'medium' | 'high';
}

/** 视频格式 */
export type VideoFormat = 'mp4' | 'webm' | 'gif' | 'mov' | 'avi';

/** 视频分辨率 */
export type VideoResolution = '480p' | '720p' | '1080p' | '4k';

/** 视频 Agent 配置 */
export interface VideoAgentConfig extends Omit<AgentConfig, 'role'> {
  id: typeof VIDEO_AGENT_ID;
  role: 'video';
  defaultProvider: VideoProvider;
  enabledProviders: VideoProvider[];
  maxConcurrentTasks: number;
  defaultResolution: VideoResolution;
  defaultAspectRatio: string;
}
