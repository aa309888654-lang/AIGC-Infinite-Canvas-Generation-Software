/**
 * Music Agent
 * AI音乐 Agent
 *
 * 职责：背景音乐和音效节点开发
 * 能力：音乐生成、音效匹配、混音处理
 * 集成：音乐生成API
 */

import { BaseAgent, AgentExecutor, AgentConfig as FrameworkAgentConfig } from '@/services/agents/agent-framework';
import { LLMToolCall } from '@/services/llm-adapters/base-llm-adapter';
import { audioMCPServer } from '@/mcp/audio-mcp';
import type { MusicAgentConfig, MusicTask, MixConfig} from './types';
import { MUSIC_SYSTEM_PROMPT } from './prompts';
import type { MusicStyle, MusicParams, AgentTool } from '@/types/agent';

/** 默认配置 */
const DEFAULT_CONFIG: MusicAgentConfig = {
  id: 'music-agent',
  name: 'Music Agent',
  role: 'music',
  description: 'AI音乐专家',
  capabilities: [
    { id: 'music-generate', name: '音乐生成', description: '生成背景音乐', category: 'generation' },
    { id: 'sfx-generate', name: '音效生成', description: '生成音效', category: 'generation' },
    { id: 'audio-mix', name: '音频混音', description: '多轨混音', category: 'mixing' },
    { id: 'mood-match', name: '情感匹配', description: '匹配场景情绪', category: 'matching' },
    { id: 'loop-create', name: '循环创建', description: '创建音乐循环', category: 'loop' },
  ],
  tools: [],
  model: 'ark-code-latest',
  temperature: 0.3,
  maxTokens: 8192,
  maxIterations: 10,
  systemPrompt: MUSIC_SYSTEM_PROMPT,
  enabled: true,
  defaultStyle: 'peaceful',
  defaultMood: 'neutral',
  maxDuration: 180,
  supportedFormats: ['mp3', 'wav', 'aac'],
};

/**
 * Music Agent
 */
export class MusicAgent extends BaseAgent {
  private defaultStyle: MusicStyle;
  private defaultMood: 'upbeat' | 'downbeat' | 'neutral';
  private maxDuration: number;
  private supportedFormats: string[];
  private activeTasks: Map<string, MusicTask>;

  constructor(executor: AgentExecutor, config?: Partial<MusicAgentConfig>) {
    const mergedConfig: MusicAgentConfig = {
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

    this.defaultStyle = mergedConfig.defaultStyle;
    this.defaultMood = mergedConfig.defaultMood;
    this.maxDuration = mergedConfig.maxDuration;
    this.supportedFormats = mergedConfig.supportedFormats;
    this.activeTasks = new Map();
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
   * 生成背景音乐
   */
  public async generateMusic(params?: Partial<MusicParams>): Promise<MusicTask> {
    const taskId = `music_${Date.now()}`;
    const style = params?.style || this.defaultStyle;
    const mood = params?.mood || this.defaultMood;
    const duration = Math.min(params?.duration || 60, this.maxDuration);

    const task: MusicTask = {
      id: taskId,
      type: 'background-music',
      params: { style, mood, duration },
      status: 'pending',
      createdAt: new Date(),
    };

    this.activeTasks.set(taskId, task);

    const result = await audioMCPServer.executeTool('generate_music', {
      style,
      mood,
      duration,
      instruments: params?.instruments,
      prompt: params?.prompt,
    });

    task.status = result.success ? 'processing' : 'failed';
    if (result.success) {
      const res = result.result as { taskId: string };
      task.result = res;
    } else {
      task.error = result.error;
    }

    return task;
  }

  /**
   * 生成音效
   */
  public async generateSoundEffect(
    type: 'transition' | 'notification' | 'ambient' | 'impact' | 'ui',
    duration?: number,
    intensity?: number
  ): Promise<MusicTask> {
    const taskId = `sfx_${Date.now()}`;

    const task: MusicTask = {
      id: taskId,
      type: 'sfx',
      params: { style: type, duration, mood: 'neutral' } as any as MusicParams,
      status: 'pending',
      createdAt: new Date(),
    };

    this.activeTasks.set(taskId, task);

    const result = await audioMCPServer.executeTool('generate_sound_effect', {
      type,
      duration: duration || 1.0,
      intensity: intensity || 0.8,
    });

    task.status = result.success ? 'processing' : 'failed';
    if (!result.success) {
      task.error = result.error;
    }

    return task;
  }

  /**
   * 混音
   */
  public async mixAudio(config: MixConfig): Promise<MusicTask> {
    const taskId = `mix_${Date.now()}`;

    const task: MusicTask = {
      id: taskId,
      type: 'mix',
      params: { style: 'mixed', duration: 0, mood: 'neutral' } as any as MusicParams,
      status: 'pending',
      createdAt: new Date(),
    };

    this.activeTasks.set(taskId, task);

    const tracks = config.tracks.map((t) => ({
      url: t.url,
      volume: t.volume,
      startTime: t.startTime,
      duration: t.duration,
      fadeIn: t.fadeIn,
      fadeOut: t.fadeOut,
    }));

    const result = await audioMCPServer.executeTool('mix_audio', {
      tracks,
      outputFormat: config.outputFormat,
    });

    task.status = result.success ? 'processing' : 'failed';
    if (!result.success) {
      task.error = result.error;
    }

    return task;
  }

  /**
   * 获取支持的格式
   */
  public getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }

  /**
   * 获取任务
   */
  public getTask(taskId: string): MusicTask | undefined {
    return this.activeTasks.get(taskId);
  }
}

/**
 * 创建 MusicAgent 实例
 */
export function createMusicAgent(executor: AgentExecutor, config?: Partial<MusicAgentConfig>): MusicAgent {
  return new MusicAgent(executor, config);
}
