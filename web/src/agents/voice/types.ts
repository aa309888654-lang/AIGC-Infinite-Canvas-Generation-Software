/**
 * Voice Agent Types
 * AI配音 Agent 类型定义
 */

import type { AgentConfig, AgentCapability} from '@/types/agent';
import type { VoiceProvider, VoiceParams } from '@/types/agent';

/** 配音 Agent 标识 */
export const VOICE_AGENT_ID = 'voice-agent';

/** 配音能力 */
export interface VoiceCapability extends AgentCapability {
  id: 'text-to-speech' | 'voice-clone' | 'emotion-adjust' | 'multi-voice' | 'sync-video';
}

/** 配音任务 */
export interface VoiceTask {
  id: string;
  type: 'tts' | 'voiceover' | 'dubbing' | 'voice-clone';
  provider: VoiceProvider;
  params: Partial<VoiceParams>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  progress?: number;
  error?: string;
  createdAt: Date;
}

/** 音色配置 */
export interface VoiceConfig {
  voiceId: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  age?: 'child' | 'young' | 'adult' | 'senior';
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited';
}

/** 角色配音映射 */
export interface CharacterVoiceMapping {
  characterId: string;
  characterName: string;
  voiceConfig: VoiceConfig;
  volume: number;
}

/** 配音合成参数 */
export interface VoiceoverSynthesisParams {
  text: string;
  voiceConfig: VoiceConfig;
  speed?: number;
  pitch?: number;
  volume?: number;
  emotion?: string;
}

/** 多语言配音 */
export interface MultiLanguageDubbingParams {
  sourceText: string;
  sourceLanguage: string;
  targetLanguages: string[];
  voiceConfigs: Record<string, VoiceConfig>;
}

/** 配音 Agent 配置 */
export interface VoiceAgentConfig extends Omit<AgentConfig, 'role'> {
  id: typeof VOICE_AGENT_ID;
  role: 'voice';
  defaultProvider: VoiceProvider;
  enabledProviders: VoiceProvider[];
  defaultVoiceConfigs: VoiceConfig[];
  maxConcurrentTasks: number;
}
