/**
 * 后端代理适配器
 * 统一的AI生成适配器，通过后端API代理所有AI服务商请求
 * 核心安全特性：
 * 1. API密钥存储在后端，不在前端暴露
 * 2. 自动处理认证和配额检查
 * 3. 所有请求通过HTTPS传输
 * 4. 后端统一管理和审计
 */

import { BaseGenerator, GeneratorConfig } from './base';
import { ImageParams, VideoParams, TaskStatusParams } from '@/types/adapter';
import { AudioGenerationParams, GenerationResult, TaskStatusResult } from '@/types/ai-models';
import { API_BASE_URL, DIRECT_API_URL, transformLocalhostUrl } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';
import { checkPromptSafety } from '@/services/prompt-firewall';
import { toast } from 'sonner';
import { buildVideoSubmissionIdentity } from './backend-proxy-video-request';

/* eslint-disable @typescript-eslint/no-explicit-any */

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload) {
    return fallback;
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (payload instanceof Error) {
    if (payload.name === 'TypeError' && /fetch|network|load failed/i.test(payload.message)) {
      return '网络请求失败：前端无法连接到后端图片生成服务，请确认后端服务已启动且代理配置正常';
    }
    return payload.message || fallback;
  }

  if (typeof payload === 'object') {
    const errorPayload = payload as {
      message?: string;
      error?: string | { message?: string };
      details?: Array<{ message?: string; path?: string }>;
    };

    if (typeof errorPayload.message === 'string' && errorPayload.message) {
      return errorPayload.message;
    }

    if (typeof errorPayload.error === 'string' && errorPayload.error) {
      return errorPayload.error;
    }

    if (
      errorPayload.error &&
      typeof errorPayload.error === 'object' &&
      typeof errorPayload.error.message === 'string'
    ) {
      return errorPayload.error.message;
    }

    if (Array.isArray(errorPayload.details) && errorPayload.details.length > 0) {
      const firstDetail = errorPayload.details[0];
      if (firstDetail?.path && firstDetail?.message) {
        return `${firstDetail.path}: ${firstDetail.message}`;
      }
      if (firstDetail?.message) {
        return firstDetail.message;
      }
    }
  }

  return fallback;
}

export interface BackendProxyConfig {
  backendUrl?: string;
  apiKey?: string;
}

export interface GenerationRequest {
  provider: string;
  type: 'image' | 'video' | 'audio';
  params: ImageParams | VideoParams;
}

export interface GenerationResponse {
  success: boolean;
  data?: {
    taskId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'payment_pending';
    resultUrl?: string;
    resultUrls?: string[];
    thumbnailUrl?: string;
    cosUrl?: string;
    error?: string;
    points?: number;
    audioUrl?: string;
    voiceId?: string;
  };
  error?: string;
}

export class BackendProxyAdapter extends BaseGenerator {
  private backendUrl: string;
  private token: string | null = null;

  constructor(config: string | BackendProxyConfig = {}) {
    const backendUrl = typeof config === 'string' ? config : config.backendUrl || API_BASE_URL;

    const proxyConfig: GeneratorConfig = {
      apiKey: typeof config === 'string' ? config : config.apiKey || '',
      baseUrl: backendUrl,
      providerName: 'backend-proxy',
    };

    super(proxyConfig);

    this.backendUrl = backendUrl;
    this.token = null;
  }

  public setToken(token: string): void {
    this.token = token;
  }

  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isLongRunning = endpoint.includes('/generate') || endpoint.includes('/task') || endpoint.includes('/poll');
    const baseUrl = (isLongRunning && DIRECT_API_URL) ? DIRECT_API_URL : this.backendUrl;
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const effectiveToken = this.token || getAuthToken();

    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorPayload = await response
        .json()
        .catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
      const message = extractErrorMessage(
        errorPayload,
        `HTTP ${response.status}: ${response.statusText}`
      );
      throw new Error(message);
    }

    return response.json();
  }

  public async generateImage(params: ImageParams): Promise<GenerationResult> {
    try {
      // 提示词内容安全预检：海报场景不拦截，其余场景拦截违规提示词并弹窗提示
      const isPosterSource = (params as any).source === 'poster';
      if (!isPosterSource) {
        const safety = checkPromptSafety(params.prompt || '');
        if (!safety.passed) {
          toast.error(safety.message, { duration: 5000 });
          return {
            taskId: '',
            status: 'failed' as const,
            success: false,
            error: safety.message,
          };
        }
      }

      // 保障：有参考图时确保 generationMode 不是 text_to_image
      let effectiveMode = params.generationMode;
      const hasReferenceImage = !!(params.referenceImage || (params.referenceImages && params.referenceImages.length > 0));
      const provider = (params as any as Record<string, any>).modelProvider;
      if (hasReferenceImage) {
        if (provider === 'minimax' && (!effectiveMode || effectiveMode === 'text_to_image' || effectiveMode === 'reference')) {
          effectiveMode = 'character_reference';
        } else if (!effectiveMode || effectiveMode === 'text_to_image') {
          effectiveMode = 'image_to_image';
        }
      }

      const response = await this.request<GenerationResponse>('/image/generate', {
        method: 'POST',
        body: JSON.stringify({
          // 先展开 params 透传所有字段（包括 UnifiedStudioParams 高级字段），
          // 再用显式字段覆盖，确保关键字段优先级正确
          ...(params as any),
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          aspectRatio: params.aspectRatio,
          resolution: params.resolution,
          imageSize: params.imageSize,
          pixelResolution: params.pixelResolution,
          quality: params.quality || 'standard',
          style: params.style,
          referenceImage: params.referenceImage,
          referenceImages: params.referenceImages,
          generationMode: effectiveMode,
          characterConsistency: (params as any as Record<string, any>).characterConsistency,
          provider: (params as any as Record<string, any>).modelProvider,
          model: (params as any as Record<string, any>).modelId || (params as any as Record<string, any>).model,
          imageCount: (params as any as Record<string, any>).imageCount || 1,
          n: (params as any as Record<string, any>).n,
          promptOptimizer: (params as any as Record<string, any>).promptOptimizer,
          promptEnhancer: (params as any as Record<string, any>).promptEnhancer,
          seed: (params as any as Record<string, any>).seed,
          steps: (params as any as Record<string, any>).steps,
          cfgScale: (params as any as Record<string, any>).cfgScale,
          strength: (params as any as Record<string, any>).strength,
          hdMode: (params as any as Record<string, any>).hdMode,
          watermark: (params as any as Record<string, any>).watermark,
        }),
      });

      if (response.success && response.data) {
        return {
          taskId: response.data.taskId,
          status: response.data.status,
          resultUrl: response.data.resultUrl ? transformLocalhostUrl(response.data.resultUrl) : undefined,
          resultUrls: response.data.resultUrls,
          output: response.data.resultUrl ? transformLocalhostUrl(response.data.resultUrl) : undefined,
          success: response.data.status !== 'failed',
          error: response.data.error,
        };
      }

      return {
        taskId: '',
        status: 'failed' as const,
        success: false,
        error: response.error || 'Image generation failed',
      };
    } catch (error: unknown) {
      return {
        taskId: '',
        status: 'failed' as const,
        success: false,
        error: extractErrorMessage(error, 'Image generation error'),
      };
    }
  }

  public async generateVideo(params: VideoParams): Promise<GenerationResult> {
    try {
      // 提示词内容安全预检：拦截违规提示词并弹窗提示
      const safety = checkPromptSafety(params.prompt || '');
      if (!safety.passed) {
        toast.error(safety.message, { duration: 5000 });
        return {
          taskId: '',
          status: 'failed' as const,
          success: false,
          error: safety.message,
        };
      }
      const response = await this.request<GenerationResponse>('/video/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          duration: params.duration ? `${params.duration}s` : '10s',
          resolution: params.resolution || '720p',
          aspectRatio: params.aspectRatio,
          referenceImage: params.referenceImage,
          referenceImages: params.referenceImages,
          referenceVideos: params.referenceVideos,
          referenceAudios: params.referenceAudios,
          startImage: params.startImage,
          endImage: params.endImage,
          generationMode: params.generationMode,
          generateAudio: params.generateAudio,
          // BUG-6 修复：同时传递 audioGeneration 原字段，供后端 doubao-provider fallback
          audioGeneration: (params as any).audioGeneration,
          returnLastFrame: params.returnLastFrame,
          enableWebSearch: params.enableWebSearch,
          // BUG-11 修复：同时传递 webSearch，与 enableWebSearch 保持一致
          webSearch: (params as any).webSearch,
          seed: (params as any).seed,
          cfgScale: (params as any).cfgScale,
          cameraMovement: (params as any).cameraMovement,
          motionStrength: (params as any).motionStrength,
          style: params.style,
          viduStyle: (params as any).viduStyle,
          creativeStyle: (params as any).creativeStyle,
          motionAmplitude: (params as any).motionAmplitude,
          minimaxMotionLevel: (params as any).minimaxMotionLevel,
          filmEmulation: (params as any).filmEmulation,
          grainSize: (params as any).grainSize,
          promptEnhancer: (params as any).promptEnhancer,
          bgm: params.bgm,
          offPeak: params.offPeak,
          watermark: params.watermark,
          wmPosition: params.wmPosition,
          wmUrl: params.wmUrl,
          metaData: params.metaData,
          callbackUrl: params.callbackUrl,
          payload: params.payload,
          templateMode: params.templateMode,
          templateStory: params.templateStory,
          templateName: params.templateName,
          templateArea: params.templateArea,
          templateBeast: params.templateBeast,
          templateBgm: params.templateBgm,
          cameraFixed: (params as VideoParams & { cameraFixed?: boolean }).cameraFixed,
          motion: (params as VideoParams & { motion?: number }).motion,
          provider: (params as any).modelProvider,
          model: (params as any).modelId || (params as any).model || 'agnes-video-v2.0',
          enableDraft: (params as any).enableDraft !== false,
          multiShot: (params as any).multiShot,
          referenceType: (params as any).referenceType,
          director3DView: (params as any).director3DView,
          director3DObjects: (params as any).director3DObjects,
          director3DCameras: (params as any).director3DCameras,
          director3DCameraPresets: (params as any).director3DCameraPresets,
          director3DEnvironment: (params as any).director3DEnvironment,
          characterConsistency: (params as any).characterConsistency,
          styleStrength: (params as any).styleStrength,
          keepOriginalSound: (params as any).keepOriginalSound,
          videoPreset: (params as any).videoPreset,
          clipCount: (params as any).clipCount,
          videoCount: (params as any).videoCount || (params as any).clipCount,
          fps: (params as any).fps,
          steps: (params as any).steps,
          motionIntensity: (params as any).motionIntensity,
          quality: (params as any).quality,
          pixelResolution: (params as any).pixelResolution,
          // nodeId 防运行中重复提交；每次主动生成使用新的 idempotencyKey。
          ...buildVideoSubmissionIdentity(params),
          apiKey: (params as any).apiKey
        }),
      });

      if (response.success && response.data) {
        const resultUrls = Array.isArray(response.data.resultUrls)
          ? response.data.resultUrls.map((url) => transformLocalhostUrl(url))
          : undefined;
        return {
          taskId: response.data.taskId,
          status: response.data.status,
          resultUrl: response.data.resultUrl ? transformLocalhostUrl(response.data.resultUrl) : undefined,
          resultUrls,
          thumbnailUrl: response.data.thumbnailUrl ? transformLocalhostUrl(response.data.thumbnailUrl) : undefined,
          output: response.data.resultUrl ? transformLocalhostUrl(response.data.resultUrl) : undefined,
          success: response.data.status !== 'failed',
          error: response.data.error,
        };
      }

      return {
        taskId: '',
        status: 'failed' as const,
        success: false,
        error: response.error || 'Video generation failed',
      };
    } catch (error: unknown) {
      return {
        taskId: '',
        status: 'failed' as const,
        success: false,
        error: extractErrorMessage(error, 'Video generation error'),
      };
    }
  }

  public async generateAudio(params: AudioGenerationParams): Promise<GenerationResult> {
    try {
      const response = await this.request<GenerationResponse>('/audio/generate', {
        method: 'POST',
        body: JSON.stringify({
          provider: (params as any).modelProvider,
          model: params.modelId,
          text: params.text,
          mode: params.mode,
          voiceId: params.voiceId,
          speed: params.speed,
          volume: params.vol,
          pitch: params.pitch,
          emotion: params.emotion,
          sampleRate: params.sampleRate,
          bitrate: params.bitrate,
          audioFormat: params.format,
          channel: params.channel,
          languageBoost: params.languageBoost,
          subtitleEnable: params.subtitleEnable,
          outputFormat: params.outputFormat,
          aigcWatermark: params.aigcWatermark,
          instruction: (params as AudioGenerationParams & { instruction?: string }).instruction,
          prompt: params.prompt,
          lyrics: params.lyrics,
          cloneFileId: params.cloneFileId,
          clonePromptText: params.clonePromptText,
          voiceDesignPrompt: params.voiceDesignPrompt,
          voiceDesignGender: params.voiceDesignGender,
          voiceDesignAccent: params.voiceDesignAccent,
          voiceDesignAge: params.voiceDesignAge,
          voiceModify: params.voiceModify,
          timbreWeights: params.timbreWeights?.map((item) => ({
            voice_id: item.voiceId,
            weight: item.weight,
          })),
          pronunciationDict: params.pronunciationDict,
        }),
      });

      if (response.success && response.data) {
        const resultUrl = response.data.audioUrl
          ? transformLocalhostUrl(response.data.audioUrl)
          : response.data.resultUrl
            ? transformLocalhostUrl(response.data.resultUrl)
            : undefined;

        return {
          taskId: response.data.taskId,
          status: response.data.status,
          resultUrl,
          output: resultUrl || response.data.voiceId,
          success: response.data.status !== 'failed',
          error: response.data.error,
          provider: 'backend-proxy',
        };
      }

      return {
        taskId: '',
        status: 'failed' as const,
        success: false,
        error: response.error || 'Audio generation failed',
      };
    } catch (error: unknown) {
      return {
        taskId: '',
        status: 'failed' as const,
        success: false,
        error: extractErrorMessage(error, 'Audio generation error'),
      };
    }
  }

  public async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      const taskResponse = await this.request<any>(`/tasks/${params.taskId}`, { method: 'GET' });

      let queryEndpoint = `/video/query/${params.taskId}`;
      if (taskResponse.success && taskResponse.data && taskResponse.data.type) {
        if (taskResponse.data.type === 'image') {
          queryEndpoint = `/image/query/${params.taskId}`;
        }
      }

      const response = await this.request<any>(queryEndpoint, {
        method: 'GET',
      });

      if (response.success) {
        return {
          taskId: params.taskId,
          status: response.data?.status || 'processing',
          progress: response.data?.progress || 0,
          resultUrl: response.data?.resultUrl ? transformLocalhostUrl(response.data.resultUrl) : undefined,
          resultUrls: response.data?.resultUrls,
          thumbnailUrl: response.data?.thumbnailUrl ? transformLocalhostUrl(response.data.thumbnailUrl) : undefined,
          cosUrl: response.data?.cosUrl,
          error: response.data?.error,
        };
      }

      const errorMessage = response.error || 'Failed to get task status';
      console.warn(`[BackendProxy] Task status query failed for ${params.taskId}: ${errorMessage}`);
      return {
        taskId: params.taskId,
        status: 'failed',
        progress: 0,
        error: errorMessage,
      };
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error, 'Task status error');
      console.error(`[BackendProxy] Error getting task status for ${params.taskId}:`, error);

      if (errorMessage.includes('404')) {
        try {
          const fallbackResponse = await this.request<any>(`/image/query/${params.taskId}`, {
            method: 'GET',
          });
          if (fallbackResponse.success) {
            return {
              taskId: params.taskId,
              status: fallbackResponse.data?.status || 'processing',
              progress: fallbackResponse.data?.progress || 0,
              resultUrl: fallbackResponse.data?.resultUrl ? transformLocalhostUrl(fallbackResponse.data.resultUrl) : undefined,
              resultUrls: fallbackResponse.data?.resultUrls,
              thumbnailUrl: fallbackResponse.data?.thumbnailUrl ? transformLocalhostUrl(fallbackResponse.data.thumbnailUrl) : undefined,
              cosUrl: fallbackResponse.data?.cosUrl,
              error: fallbackResponse.data?.error,
            };
          }
        } catch (e) {
          console.warn('[BackendProxy] Fallback to image endpoint also failed:', e);
        }
      }

      return {
        taskId: params.taskId,
        status: 'failed',
        progress: 0,
        error: errorMessage,
      };
    }
  }

  public getModels(): { id: string; name: string }[] {
    return [{ id: 'backend-proxy', name: '后端代理服务' }];
  }

  public async cancelTask(taskId: string): Promise<boolean> {
    try {
      const response = await this.request<{ success: boolean }>(`/tasks/${taskId}/cancel`, {
        method: 'POST',
      });
      return !!response.success;
    } catch (error) {
      console.warn(`[BackendProxy] Failed to cancel task ${taskId}:`, error);
      return false;
    }
  }

  /**
   * ✅ P1-9：取消视频生成任务，释放后端密钥租约
   * 调用 /api/v1/video/cancel/:taskId 端点
   */
  public async cancelVideoTask(taskId: string): Promise<boolean> {
    try {
      const response = await this.request<{ success: boolean }>(`/video/cancel/${taskId}`, {
        method: 'POST',
      });
      return !!response.success;
    } catch (error) {
      console.warn(`[BackendProxy] Failed to cancel video task ${taskId}:`, error);
      return false;
    }
  }

  /**
   * Sprint 3: 重试已结束（failed/cancelled/completed）的后端任务。
   * 后端会创建一条新的 Task 记录（status=pending），返回 newTaskId。
   * 前端需用 newTaskId 更新 backendTaskId，WS 桥接器将推送后续进度。
   */
  public async retryTask(taskId: string): Promise<{ success: boolean; newTaskId?: string }> {
    try {
      const response = await this.request<{ success: boolean; data?: { taskId?: string } }>(`/tasks/${taskId}/retry`, {
        method: 'POST',
      });
      return {
        success: !!response.success,
        newTaskId: response.data?.taskId,
      };
    } catch (error) {
      console.warn(`[BackendProxy] Failed to retry task ${taskId}:`, error);
      return { success: false };
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.request<any>('/health', { method: 'GET' });
      return true;
    } catch {
      return false;
    }
  }
}

export const backendProxyAdapter = new BackendProxyAdapter();
