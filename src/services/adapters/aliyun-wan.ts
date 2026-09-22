// @ts-nocheck
/**
 * 阿里云通义万相视频生成适配器
 * 支持 Wan2.6 系列模型
 * API文档: https://help.aliyun.com/zh/model-studio/
 */

import { BaseGenerator, GeneratorConfig } from '@/services/adapters/base';
import { apiProxy, isTauriAvailable } from '@/lib/api-proxy';
import {
  ImageParams,
  VideoParams,
  TaskStatusParams,
} from '@/types/adapter';
import { GenerationResult, TaskStatusResult } from '@/types/ai-models';

interface WanVideoResponse {
  request_id?: string;
  task_id?: string;
  status?: string;
  code?: string;
  message?: string;
  output?: {
    task_id?: string;
    video_url?: string;
    videos?: Array<{ url?: string }>;
    status?: string;
  };
}

export class AliyunWanAdapter extends BaseGenerator {
  private modelId: string;
  
  private static readonly MODE_MAPPING: Record<string, Record<string, string>> = {
    'wanx-all-in-one': {
      text_to_video: 'wan2.6-t2v',
      image_to_video: 'wan2.6-i2v',
      reference_to_video: 'wan2.6-r2v',
      text_to_video_flash: 'wan2.6-t2v-flash',
      image_to_video_flash: 'wan2.6-i2v-flash',
      reference_to_video_flash: 'wan2.6-r2v-flash'
    }
  };

  constructor(
    config: string | { apiKey: string },
    modelId: string = 'wanx-all-in-one'
  ) {
    const isDev = import.meta.env.DEV;
    // 所有环境统一走后端代理，不暴露外部API地址
    const baseUrl = '/dashscope/api/v1';
    const apiKey = typeof config === 'string' ? config : config.apiKey;

    const generatorConfig: GeneratorConfig = {
      apiKey,
      baseUrl,
      providerName: 'aliyunWan'
    };

    super(generatorConfig);
    this.modelId = modelId;
  }

  setModel(modelId: string) {
    this.modelId = modelId;
  }
  
  private resolveApiModel(generationMode: string, isFlash: boolean = false): string {
    const modeMapping = AliyunWanAdapter.MODE_MAPPING['wanx-all-in-one'];
    const modeKey = isFlash ? `${generationMode}_flash` : generationMode;
    
    if (modeMapping && modeMapping[modeKey]) {
      return modeMapping[modeKey];
    }
    
    const fallbackMap: Record<string, string> = {
      text_to_video: 'wan2.6-t2v',
      image_to_video: 'wan2.6-i2v',
      reference_to_video: 'wan2.6-r2v',
      first_last_frame: 'wan2.6-i2v',
      video_to_video: 'wan2.6-i2v'
    };
    
    return fallbackMap[generationMode] || 'wan2.6-t2v';
  }

  async generateImage(_params: ImageParams): Promise<GenerationResult> {
    return this.createFailedResult(new Error('阿里云万相暂不支持图片生成'));
  }

  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    try {
      const endpoint = '/services/aigc/video-generation/video-synthesis';
      
      const extendedParams = params as VideoParams & { 
        generationMode?: string; 
        audio_url?: string; 
        watermark?: boolean; 
        prompt_extend?: boolean; 
        shot_type?: string;
        quality?: string;
      };
      
      const generationMode = extendedParams.generationMode || 'text_to_video';
      const hasReferenceImage = params.referenceImages && params.referenceImages.length > 0;
      const isFlash = extendedParams.quality === 'fast' || extendedParams.quality === 'flash';
      
      const modelToUse = this.resolveApiModel(generationMode, isFlash);

      const body: Record<string, any> = {
        model: modelToUse,
        input: {
          prompt: params.prompt || ''
        }
      };

      if (hasReferenceImage) {
        body.input.img_url = params.referenceImages[0];
      }

      if (extendedParams.audio_url) {
        body.input.audio_url = extendedParams.audio_url;
      }

      if (params.duration || params.resolution || params.seed !== undefined) {
        body.parameters = {};
        
        if (params.duration) {
          body.parameters.duration = params.duration;
        }

        if (params.resolution) {
          const sizeMap: Record<string, string> = {
            '480p': '832*480',
            '720p': '1280*720',
            '1080p': '1920*1080',
            '832x480': '832*480',
            '1280x720': '1280*720',
            '1920x1080': '1920*1080',
          };
          body.parameters.size = sizeMap[params.resolution] || '1280*720';
        }

        if (params.seed !== undefined && params.seed !== -1) {
          body.parameters.seed = params.seed;
        }

        if (extendedParams.watermark !== undefined) {
          body.parameters.watermark = extendedParams.watermark;
        }

        if (extendedParams.prompt_extend) {
          body.parameters.prompt_extend = true;
          body.parameters.shot_type = 'multi';
        }
      }

      const headers: Record<string, string> = {
        'X-DashScope-Async': 'enable',
        'Content-Type': 'application/json'
      };

      const response = await this.postRequestWithHeaders<WanVideoResponse>(endpoint, body, headers);

      if (response.code || response.message) {
        const errorMsg = response.message || response.code || '未知错误';
        console.error('[AliyunWanAdapter.generateVideo] API返回错误:', errorMsg);
        return this.createFailedResult(new Error(errorMsg));
      }

      const taskId = response.output?.task_id || response.task_id || response.request_id || '';

      return this.createPendingResult(taskId);
    } catch (error) {
      console.error('[AliyunWanAdapter.generateVideo] 视频生成失败:', error);
      return this.createFailedResult(error);
    }
  }

  async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      const taskId = params.taskId;
      const endpoint = `/tasks/${taskId}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      const response = await this.getRequestWithHeaders<WanVideoResponse>(endpoint, headers);

      const status = this.mapStatus(
        response.status || 
        response.output?.status || 
        response.output?.task_id || 
        'PENDING'
      );

      let outputUrl = '';
      if (status === 'completed') {
        if (response.output?.videos && response.output.videos.length > 0) {
          outputUrl = response.output.videos[0].url || '';
        } else if (response.output?.video_url) {
          outputUrl = response.output.video_url;
        }
      }

      const progress = status === 'processing' ? 50 : status === 'completed' ? 100 : status === 'failed' ? 0 : 10;

      return {
        status,
        progress,
        message: this.getStatusMessage(status),
        timestamp: new Date(),
        output: outputUrl
      };
    } catch (error) {
      console.error('[AliyunWanAdapter.getTaskStatus] 获取状态失败:', error);
      return {
        status: 'failed',
        progress: 0,
        message: error instanceof Error ? error.message : '获取状态失败',
        timestamp: new Date()
      };
    }
  }

  private mapStatus(status: string): TaskStatusResult['status'] {
    const statusMap: Record<string, TaskStatusResult['status']> = {
      PENDING: 'pending',
      QUEUED: 'pending',
      RUNNING: 'processing',
      PROCESSING: 'processing',
      SUCCEEDED: 'completed',
      COMPLETED: 'completed',
      SUCCESS: 'completed',
      FAILED: 'failed',
      FAIL: 'failed',
      ERROR: 'failed',
      any: 'failed'
    };
    return statusMap[(status || '').toUpperCase()] || 'pending';
  }

  private getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      pending: '任务等待中...',
      queued: '任务排队中...',
      processing: '视频生成中...',
      running: '视频生成中...',
      completed: '生成完成',
      succeeded: '生成完成',
      success: '生成完成',
      failed: '生成失败'
    };
    return messages[status] || '状态: ' + status;
  }

  async pollTaskStatus(
    taskId: string,
    onProgress?: (progress: number) => void
  ): Promise<GenerationResult> {
    const maxRetries = 60;
    const intervalMs = 5000;
    let retries = 0;

    while (retries < maxRetries) {
      const statusResult = await this.getTaskStatus({ taskId });

      if (onProgress && statusResult.progress !== undefined) {
        onProgress(statusResult.progress);
      }

      switch (statusResult.status) {
        case 'completed':
          return {
            taskId,
            status: 'completed',
            success: true,
            resultUrl: statusResult.output
          };
        case 'failed':
          return {
            taskId,
            status: 'failed',
            success: false,
            error: statusResult.message
          };
        case 'pending':
        case 'processing':
        default:
          retries++;
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }
          break;
      }
    }

    return {
      taskId,
      status: 'timeout',
      success: false,
      error: '任务超时'
    };
  }

  private async postRequestWithHeaders<T>(
    endpoint: string,
    body: Record<string, any>,
    headers: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const allHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...headers
    };

    return this.request<T>(endpoint, {
      method: 'POST',
      headers: allHeaders,
      body,
    });
  }

  private async getRequestWithHeaders<T>(
    endpoint: string,
    headers: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const allHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...headers
    };

    // 优先使用Tauri代理，避免CORS问题
    if (isTauriAvailable()) {
      try {
        const response = await apiProxy(
          url,
          'GET',
          allHeaders
        );
        
        if (response.status >= 400) {
          throw new Error(`HTTP ${response.status}: ${response.body}`);
        }
        
        return JSON.parse(response.body);
      } catch (error) {
        console.warn('[AliyunWanAdapter] 代理请求失败:', error);
        // 如果代理失败，尝试直接调用
      }
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: allHeaders
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  getModels(): { id: string; name: string }[] {
    return [
      { id: 'wanx-video-01', name: '通义万相视频 (Wanx Video)' }
    ];
  }
}
