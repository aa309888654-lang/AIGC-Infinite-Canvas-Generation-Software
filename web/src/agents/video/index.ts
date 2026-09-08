/**
 * Video Agent
 * 影视视频 Agent
 *
 * 职责：视频生成和处理相关节点开发
 * 能力：视频参数配置、预览播放、格式转换
 * 集成：Seedance, Vidu, MiniMax, Doubao API
 */

import { BaseAgent, AgentExecutor, AgentConfig as FrameworkAgentConfig } from '@/services/agents/agent-framework';
import { LLMToolCall } from '@/services/llm-adapters/base-llm-adapter';
import { videoMCPServer } from '@/mcp/video-mcp';
import type { VideoAgentConfig, VideoTask} from './types';
import { VIDEO_SYSTEM_PROMPT} from './prompts';
import type { VideoProvider, VideoGenParams, AgentTool } from '@/types/agent';

/** 默认配置 */
const DEFAULT_CONFIG: VideoAgentConfig = {
  id: 'video-agent',
  name: 'Video Agent',
  role: 'video',
  description: '视频生成和处理相关节点开发',
  capabilities: [
    { id: 'video-generation', name: '视频生成', description: '使用 AI 模型生成视频', category: 'generation' },
    { id: 'video-config', name: '视频配置', description: '配置视频生成参数', category: 'configuration' },
    { id: 'video-preview', name: '视频预览', description: '预览生成的视频', category: 'preview' },
    { id: 'video-convert', name: '视频转换', description: '转换视频格式', category: 'conversion' },
    { id: 'format-transcode', name: '格式转码', description: '视频编码转换', category: 'conversion' },
  ],
  tools: [],
  model: 'ark-code-latest',
  temperature: 0.2,
  maxTokens: 8192,
  maxIterations: 10,
  systemPrompt: VIDEO_SYSTEM_PROMPT,
  enabled: true,
  defaultProvider: 'doubao',
  enabledProviders: ['seedance', 'vidu', 'minimax', 'doubao'],
  maxConcurrentTasks: 3,
  defaultResolution: '1080p',
  defaultAspectRatio: '16:9',
};

/**
 * Video Agent
 */
export class VideoAgent extends BaseAgent {
  private defaultProvider: VideoProvider;
  private enabledProviders: VideoProvider[];
  private maxConcurrentTasks: number;
  private activeTasks: Map<string, VideoTask>;

  constructor(executor: AgentExecutor, config?: Partial<VideoAgentConfig>) {
    const mergedConfig: VideoAgentConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      tools: videoMCPServer.getToolDefinitions() as any as AgentTool[],
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
    this.maxConcurrentTasks = mergedConfig.maxConcurrentTasks;
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
   * 生成视频
   */
  public async generateVideo(params: Partial<VideoGenParams>): Promise<VideoTask> {
    if (this.activeTasks.size >= this.maxConcurrentTasks) {
      throw new Error(`Maximum concurrent tasks (${this.maxConcurrentTasks}) reached`);
    }

    const taskId = `video_${Date.now()}`;
    const task: VideoTask = {
      id: taskId,
      type: 'generate',
      provider: params.provider || this.defaultProvider,
      params: {
        provider: params.provider || this.defaultProvider,
        prompt: params.prompt || '',
        duration: params.duration || 5,
        resolution: params.resolution || this.getConfig().defaultResolution,
        aspectRatio: params.aspectRatio || this.getConfig().defaultAspectRatio,
      } as VideoGenParams,
      status: 'pending',
      createdAt: new Date(),
    };

    this.activeTasks.set(taskId, task);

    // 调用 MCP 工具
    const result = await videoMCPServer.executeTool('generate_video', {
      provider: task.provider,
      prompt: task.params.prompt,
      duration: task.params.duration,
      resolution: task.params.resolution,
      aspectRatio: task.params.aspectRatio,
    });

    if (result.success) {
      task.status = 'processing';
    } else {
      task.status = 'failed';
      task.error = result.error;
    }

    return task;
  }

  /**
   * 配置视频参数
   */
  public async configureVideoParams(params: {
    provider?: VideoProvider;
    resolution?: string;
    aspectRatio?: string;
    duration?: number;
  }): Promise<Record<string, unknown>> {
    const result = await videoMCPServer.executeTool('configure_video_params', {
      provider: params.provider,
      resolution: params.resolution,
      aspectRatio: params.aspectRatio,
      duration: params.duration,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to configure video params');
    }

    return result.result as Record<string, unknown>;
  }

  /**
   * 预览视频
   */
  public async previewVideo(videoUrl: string, startTime?: number, endTime?: number): Promise<string> {
    const result = await videoMCPServer.executeTool('preview_video', {
      videoUrl,
      startTime,
      endTime,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to preview video');
    }

    return (result.result as { url: string }).url;
  }

  /**
   * 转换视频格式
   */
  public async convertVideo(
    inputUrl: string,
    outputFormat: string,
    resolution?: string
  ): Promise<{ taskId: string; status: string }> {
    const result = await videoMCPServer.executeTool('convert_video_format', {
      inputUrl,
      outputFormat,
      resolution,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to convert video');
    }

    return result.result as { taskId: string; status: string };
  }

  /**
   * 获取任务状态
   */
  public async getTaskStatus(taskId: string): Promise<VideoTask | undefined> {
    const cached = this.activeTasks.get(taskId);
    if (cached) {
      const result = await videoMCPServer.executeTool('get_video_task_status', { taskId });
      if (result.success) {
        const statusResult = result.result as { status: string; progress?: number; resultUrl?: string };
        cached.status = statusResult.status as VideoTask['status'];
        cached.progress = statusResult.progress;
        if (statusResult.resultUrl) {
          cached.resultUrl = statusResult.resultUrl;
        }
      }
    }
    return cached;
  }

  /**
   * 获取活跃任务
   */
  public getActiveTasks(): VideoTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * 获取可用提供商
   */
  public getEnabledProviders(): VideoProvider[] {
    return [...this.enabledProviders];
  }

  /**
   * 获取配置
   */
  public getConfig(): VideoAgentConfig {
    return {
      defaultProvider: this.defaultProvider,
      enabledProviders: this.enabledProviders,
      maxConcurrentTasks: this.maxConcurrentTasks,
      defaultResolution: this.getConfig()?.defaultResolution || '1080p',
      defaultAspectRatio: this.getConfig()?.defaultAspectRatio || '16:9',
    } as VideoAgentConfig;
  }
}

/**
 * 创建 VideoAgent 实例
 */
export function createVideoAgent(executor: AgentExecutor, config?: Partial<VideoAgentConfig>): VideoAgent {
  return new VideoAgent(executor, config);
}
