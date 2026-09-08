/**
 * Music Agent Types
 * AI音乐 Agent 类型定义
 */

import type { AgentConfig, AgentCapability} from '@/types/agent';
import type { MusicStyle, MusicParams } from '@/types/agent';

/** 音乐 Agent 标识 */
export const MUSIC_AGENT_ID = 'music-agent';

/** 音乐能力 */
export interface MusicCapability extends AgentCapability {
  id: 'music-generate' | 'sfx-generate' | 'audio-mix' | 'mood-match' | 'loop-create';
}

/** 音乐任务 */
export interface MusicTask {
  id: string;
  type: 'background-music' | 'sfx' | 'mix' | 'loop';
  params: Partial<MusicParams>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  result?: { taskId: string };
  progress?: number;
  error?: string;
  createdAt: Date;
}

/** 音乐轨道 */
export interface MusicTrack {
  id: string;
  url: string;
  type: 'music' | 'sfx' | 'voiceover' | 'ambient';
  volume: number;
  startTime: number;
  duration?: number;
  fadeIn?: number;
  fadeOut?: number;
}

/** 混音配置 */
export interface MixConfig {
  tracks: MusicTrack[];
  outputFormat: 'mp3' | 'wav' | 'aac';
  bitrate?: number;
  normalize?: boolean;
}

/** 音乐片段 */
export interface MusicSegment {
  id: string;
  url: string;
  startTime: number;
  endTime: number;
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';
  energy: number;
  mood: string;
}

/** 循环配置 */
export interface LoopConfig {
  segmentId: string;
  repeatCount: number;
  crossfadeDuration?: number;
}

/** 音乐 Agent 配置 */
export interface MusicAgentConfig extends Omit<AgentConfig, 'role'> {
  id: typeof MUSIC_AGENT_ID;
  role: 'music';
  defaultStyle: MusicStyle;
  defaultMood: 'upbeat' | 'downbeat' | 'neutral';
  maxDuration: number;
  supportedFormats: string[];
}
