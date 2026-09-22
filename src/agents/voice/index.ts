/**
 * Voice Agent
 * AI配音 Agent
 *
 * 职责：语音合成和配音节点开发
 * 能力：文字转语音、音色选择、情感调节
 * 集成：TTS API
 */

import { BaseAgent, AgentExecutor, AgentConfig as FrameworkAgentConfig } from '@/services/agents/agent-framework';
import { LLMToolCall } from '@/services/llm-adapters/base-llm-adapter';
import { audioMCPServer } from '@/mcp/audio-mcp';
import type { VoiceAgentConfig, VoiceTask, VoiceConfig, CharacterVoiceMapping } from './types';
import { VOICE_SYSTEM_PROMPT } from './prompts';
import type { VoiceProvider, VoiceParams, AgentTool } from '@/types/agent';

/** 默认配置 */
const DEFAULT_CONFIG: VoiceAgentConfig = {
  id: 'voice-agent',
  name: 'Voice Agent',
  role: 'voice',
  description: 'AI配音专家',
  capabilities: [
    { id: 'text-to-speech', name: '文字转语音', description: '文字转语音合成', category: 'synthesis' },
    { id: 'voice-clone', name: '语音克隆', description: '克隆声音特征', category: 'advanced' },
    { id: 'emotion-adjust', name: '情感调节', description: '调节语音情感', category: 'adjustment' },
    { id: 'multi-voice', name: '多角色配音', description: '多角色配音合成', category: 'synthesis' },
    { id: 'sync-video', name: '视频同步', description: '配音与视频同步', category: 'sync' },
  ],
  tools: [],
  model: 'ark-code-latest',
  temperature: 0.2,
  maxTokens: 8192,
  maxIterations: 10,
  systemPrompt: VOICE_SYSTEM_PROMPT,
  enabled: true,
  defaultProvider: 'minimax',
  enabledProviders: ['azure', 'elevenlabs', 'baidu', 'aliyun', 'minimax'],
  defaultVoiceConfigs: [
    { voiceId: 'minimax-zh-female', name: '中文女声', language: 'zh-CN', gender: 'female', age: 'young' },
    { voiceId: 'minimax-zh-male', name: '中文男声', language: 'zh-CN', gender: 'male', age: 'young' },
  ],
  maxConcurrentTasks: 5,
};

/**
 * Voice Agent
 */
export class VoiceAgent extends BaseAgent {
  private defaultProvider: VoiceProvider;
  private enabledProviders: VoiceProvider[];
  private defaultVoiceConfigs: VoiceConfig[];
  private maxConcurrentTasks: number;
  private activeTasks: Map<string, VoiceTask>;
  private characterMappings: Map<string, CharacterVoiceMapping[]>;

  constructor(executor: AgentExecutor, config?: Partial<VoiceAgentConfig>) {
    const mergedConfig: VoiceAgentConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      tools: audioMCPServer.getToolDefinitions() as any as AgentTool[],
    };

    const baseConfig: FrameworkAgentConfig = {
      name: mergedConfig.name,
      description: mergedConfig.description,
      model: mergedConfig.model,
      temperature: mergedConfig.temperature,
      maxTokens: mergedConfig.maxTokens,
      maxIterations: mergedConfig.maxIterations,
      systemPrompt: mergedConfig.systemPrompt,
      tools: mergedConfig.tools as FrameworkAgentConfig['tools'],
    };

    super(baseConfig, executor);

    this.defaultProvider = mergedConfig.defaultProvider;
    this.enabledProviders = mergedConfig.enabledProviders;
    this.defaultVoiceConfigs = mergedConfig.defaultVoiceConfigs;
    this.maxConcurrentTasks = mergedConfig.maxConcurrentTasks;
    this.activeTasks = new Map();
    this.characterMappings = new Map();
  }

  protected async step(): Promise<{
    toolCalls?: LLMToolCall[];
    finalResult?: string;
    metadata?: Record<string, unknown>;
  }> {
    const params = this.buildLLMParams();
    const response = await this.executor.complete(params);

    const content = response.choices[0]?.message?.content || '';
    const toolCalls = this.extractToolCalls(response);

    if (toolCalls.length > 0) {
      return { toolCalls };
    }

    const finalResult = this.extractFinalResult(content);
    if (finalResult) {
      return { finalResult };
    }

    this.addMessage('assistant', content);
    return { finalResult: content };
  }

  /**
   * 文字转语音
   */
  public async textToSpeech(
    text: string,
    voiceConfig?: Partial<VoiceConfig>,
    params?: Partial<VoiceParams>
  ): Promise<VoiceTask> {
    if (this.activeTasks.size >= this.maxConcurrentTasks) {
      throw new Error(`Maximum concurrent tasks (${this.maxConcurrentTasks}) reached`);
    }

    const taskId = `voice_${Date.now()}`;
    const provider = params?.provider || this.defaultProvider;

    const voiceConfigFull: VoiceConfig = {
      voiceId: voiceConfig?.voiceId || this.defaultVoiceConfigs[0].voiceId,
      name: voiceConfig?.name || 'Default',
      language: voiceConfig?.language || 'zh-CN',
      gender: voiceConfig?.gender || 'female',
      age: voiceConfig?.age,
      emotion: voiceConfig?.emotion,
    };

    const task: VoiceTask = {
      id: taskId,
      type: 'tts',
      provider,
      params: {
        provider,
        text,
        voiceId: voiceConfigFull.voiceId,
        speed: params?.speed,
        pitch: params?.pitch,
        volume: params?.volume,
        emotion: params?.emotion,
      },
      status: 'pending',
      createdAt: new Date(),
    };

    this.activeTasks.set(taskId, task);

    const result = await audioMCPServer.executeTool('text_to_speech', {
      provider,
      text,
      voiceId: voiceConfigFull.voiceId,
      speed: params?.speed || 1.0,
      pitch: params?.pitch || 0,
      volume: params?.volume || 1.0,
      emotion: params?.emotion || 'neutral',
    });

    // TODO: 当前 audio-mcp 的 TTS Provider 为 mock 实现，返回 status 始终为 pending。
    // 实际使用时应在此处降级调用 realAPIExecutor.executeAudioGen 或后端 /audio/generate 接口，
    // 以获取真实的音频生成结果，而非依赖空壳 MCP。
    task.status = result.success ? 'processing' : 'failed';
    if (!result.success) {
      task.error = result.error;
    }

    return task;
  }

  /**
   * 选择音色
   */
  public async selectVoice(config: {
    gender?: 'male' | 'female' | 'neutral';
    age?: 'child' | 'young' | 'adult' | 'senior';
    language?: string;
  }): Promise<VoiceConfig> {
    const result = await audioMCPServer.executeTool('select_voice', {
      provider: this.defaultProvider,
      gender: config.gender,
      age: config.age,
      language: config.language,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to select voice');
    }

    const res = result.result as { voice: VoiceConfig };
    return res.voice;
  }

  /**
   * 调节情感
   */
  public async adjustEmotion(
    emotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited' | 'scared',
    intensity: number = 1.0
  ): Promise<Record<string, unknown>> {
    const result = await audioMCPServer.executeTool('adjust_emotion', {
      emotion,
      intensity,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to adjust emotion');
    }

    return result.result as Record<string, unknown>;
  }

  /**
   * 添加角色配音映射
   */
  public addCharacterVoiceMapping(projectId: string, mapping: CharacterVoiceMapping): void {
    const existing = this.characterMappings.get(projectId) || [];
    existing.push(mapping);
    this.characterMappings.set(projectId, existing);
  }

  /**
   * 获取角色配音映射
   */
  public getCharacterVoiceMappings(projectId: string): CharacterVoiceMapping[] {
    return this.characterMappings.get(projectId) || [];
  }

  /**
   * 获取可用音色
   */
  public getAvailableVoices(): VoiceConfig[] {
    return [...this.defaultVoiceConfigs];
  }

  /**
   * 获取任务状态
   */
  public getTask(taskId: string): VoiceTask | undefined {
    return this.activeTasks.get(taskId);
  }
}

/**
 * 创建 VoiceAgent 实例
 */
export function createVoiceAgent(executor: AgentExecutor, config?: Partial<VoiceAgentConfig>): VoiceAgent {
  return new VoiceAgent(executor, config);
}
