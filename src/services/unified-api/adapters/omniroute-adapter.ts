/**
 * OmniRoute 网关适配器
 * 角色：资深技术选型专家 + 开源软件顾问
 * 
 * OmniRoute 是一个 AI 智能路由器，支持 36+ 提供商的统一 API 调用
 * 支持图像生成、视频生成、LLM 等多种任务类型
 * 
 * 文档：https://github.com/diegosouzapw/OmniRoute
 */

import { logger } from '@/lib/logger';

// OmniRoute 默认配置。密钥必须由后端管理，前端不读取 Vite API Key。
const OMNIROUTE_BASE_URL = import.meta.env.VITE_OMNIROUTE_URL || 'http://localhost:20128';
const OMNIROUTE_API_KEY = '';

// 支持的图像提供商
export const IMAGE_PROVIDERS = [
  'openai',        // DALL-E 3
  'stability',     // SDXL, SD 3.5
  'minimax',       //  minimax
  'fireworks',     // SSD-1B, Playground-v2.5
  'together',      // Playground-v2.5
  'replicate',     // Flux, SDXL
  'fal',           // Flux, SSD
  'civitai',       // 自定义模型
  'comfyui',       // ComfyUI 工作流
  'nebius',        // Studio, Anime
  'hyperbolic',    // Various models
] as const;

export type ImageProvider = typeof IMAGE_PROVIDERS[number];

// 支持的视频提供商
export const VIDEO_PROVIDERS = [
  'runway',        // Gen-3, Gen-4
  'pika',          // Pika 1.5
  'luma',          // Dream Machine
  'minimax',       // minimax视频
  'comfyui',       // AnimateDiff, SVD
  'sd-webui',      // Deforum
] as const;

export type VideoProvider = typeof VIDEO_PROVIDERS[number];

// 统一图像参数
export interface OmniRouteImageParams {
  provider: ImageProvider;
  model: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  style?: string;
  referenceImage?: string; // Base64 或 URL (图生图)
  strength?: number;       // 变换强度 (0-1)
  n?: number;             // 生成数量
}

// 统一视频参数
export interface OmniRouteVideoParams {
  provider: VideoProvider;
  model: string;
  prompt: string;
  negativePrompt?: string;
  duration?: number;
  fps?: number;
  resolution?: string;
  referenceImage?: string; // 图生视频
  motionMode?: 'camera' | 'character' | 'auto';
}

// OmniRoute 响应格式
export interface OmniRouteResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    provider?: string;
  };
  metadata?: {
    provider: string;
    model: string;
    generationTime: number;
    tokens?: number;
  };
}

// OmniRoute 图像生成响应
export interface OmniRouteImageResponse {
  url?: string;
  base64?: string;
  revised_prompt?: string;
  seed?: number;
  dimensions?: { width: number; height: number };
}

// OmniRoute 视频生成响应
export interface OmniRouteVideoResponse {
  url?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  duration?: number;
}

/**
 * OmniRoute 网关客户端
 */
export class OmniRouteAdapter {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  
  constructor(config?: {
    baseUrl?: string;
    apiKey?: string;
    timeout?: number;
  }) {
    this.baseUrl = config?.baseUrl || OMNIROUTE_BASE_URL;
    this.apiKey = config?.apiKey || OMNIROUTE_API_KEY;
    this.timeout = config?.timeout || 120000; // 2分钟超时（生成任务可能较慢）
    
    logger.info('[OmniRouteAdapter] 初始化 OmniRoute 网关适配器', {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
    });
  }

  /**
   * 检查 OmniRoute 网关是否可用
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels(_type: 'image' | 'video' | 'chat'): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      logger.error('[OmniRouteAdapter] 获取模型列表失败:', error);
      return [];
    }
  }

  /**
   * 图像生成 (图生图/文生图)
   */
  async generateImage(params: OmniRouteImageParams): Promise<OmniRouteResponse<OmniRouteImageResponse>> {
    const startTime = Date.now();
    
    logger.info('[OmniRouteAdapter] 图像生成请求:', {
      provider: params.provider,
      model: params.model,
      promptLength: params.prompt.length,
      hasReference: !!params.referenceImage,
      strength: params.strength,
    });

    try {
      // 构建请求体 - OmniRoute 使用 OpenAI 兼容格式
      const requestBody: Record<string, unknown> = {
        model: params.model,
        prompt: params.prompt,
        n: params.n || 1,
      };

      // 尺寸参数
      if (params.width || params.height) {
        requestBody.size = `${params.width || 1024}x${params.height || 1024}`;
      }

      // 负提示词 (部分提供商支持)
      if (params.negativePrompt) {
        requestBody.negative_prompt = params.negativePrompt;
      }

      // 采样参数
      if (params.steps) {
        requestBody.num_inference_steps = params.steps;
      }

      if (params.cfgScale) {
        requestBody.guidance_scale = params.cfgScale;
      }

      // 种子
      if (params.seed !== undefined) {
        requestBody.seed = params.seed;
      }

      // 风格
      if (params.style) {
        requestBody.style = params.style;
      }

      // 图生图模式 - OmniRoute 支持多种方式
      if (params.referenceImage) {
        // OmniRoute 支持 reference_image 参数
        if (params.referenceImage.startsWith('data:')) {
          // Base64 图片
          requestBody.reference_image_base64 = params.referenceImage.split(',')[1];
        } else {
          // URL
          requestBody.reference_image_url = params.referenceImage;
        }
        
        // 设置变换强度
        if (params.strength !== undefined) {
          requestBody.strength = params.strength;
        }
        
        // OmniRoute 图生图模式
        requestBody.image_generation_mode = 'image-to-image';
      }

      // 发送请求到 OmniRoute
      const response = await fetch(`${this.baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: this.getHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const generationTime = Date.now() - startTime;

      logger.info('[OmniRouteAdapter] 图像生成成功:', {
        provider: params.provider,
        model: params.model,
        generationTime,
        hasUrl: !!data.data?.[0]?.url,
      });

      return {
        success: true,
        data: {
          url: data.data?.[0]?.url,
          base64: data.data?.[0]?.b64_json,
          revised_prompt: data.data?.[0]?.revised_prompt,
          seed: data.data?.[0]?.seed,
        },
        metadata: {
          provider: params.provider,
          model: params.model,
          generationTime,
        },
      };

    } catch (error: unknown) {
      const generationTime = Date.now() - startTime;
      
      logger.error('[OmniRouteAdapter] 图像生成失败:', {
        provider: params.provider,
        model: params.model,
        error: (error instanceof Error ? error.message : String(error)),
        generationTime,
      });

      return {
        success: false,
        error: {
          code: error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'GENERATION_ERROR',
          message: (error instanceof Error ? error.message : String(error)),
          provider: params.provider,
        },
        metadata: {
          provider: params.provider,
          model: params.model,
          generationTime,
        },
      };
    }
  }

  /**
   * 视频生成 (图生视频/文生视频)
   */
  async generateVideo(params: OmniRouteVideoParams): Promise<OmniRouteResponse<OmniRouteVideoResponse>> {
    const startTime = Date.now();
    
    logger.info('[OmniRouteAdapter] 视频生成请求:', {
      provider: params.provider,
      model: params.model,
      promptLength: params.prompt.length,
      hasReference: !!params.referenceImage,
      duration: params.duration,
    });

    try {
      // OmniRoute 视频生成请求体
      const requestBody: Record<string, unknown> = {
        model: params.model,
        prompt: params.prompt,
      };

      // 负提示词
      if (params.negativePrompt) {
        requestBody.negative_prompt = params.negativePrompt;
      }

      // 视频参数
      if (params.duration) {
        requestBody.duration = params.duration;
      }

      if (params.fps) {
        requestBody.fps = params.fps;
      }

      if (params.resolution) {
        requestBody.resolution = params.resolution;
      }

      // 图生视频
      if (params.referenceImage) {
        if (params.referenceImage.startsWith('data:')) {
          requestBody.reference_image_base64 = params.referenceImage.split(',')[1];
        } else {
          requestBody.reference_image_url = params.referenceImage;
        }
      }

      // 运动模式
      if (params.motionMode) {
        requestBody.motion_mode = params.motionMode;
      }

      // 发送请求到 OmniRoute
      const response = await fetch(`${this.baseUrl}/v1/videos/generations`, {
        method: 'POST',
        headers: this.getHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const generationTime = Date.now() - startTime;

      logger.info('[OmniRouteAdapter] 视频生成成功:', {
        provider: params.provider,
        model: params.model,
        generationTime,
        hasUrl: !!data.data?.url,
      });

      return {
        success: true,
        data: {
          url: data.data?.url,
          status: data.data?.status,
          duration: data.data?.duration,
        },
        metadata: {
          provider: params.provider,
          model: params.model,
          generationTime,
        },
      };

    } catch (error: unknown) {
      const generationTime = Date.now() - startTime;
      
      logger.error('[OmniRouteAdapter] 视频生成失败:', {
        provider: params.provider,
        model: params.model,
        error: (error instanceof Error ? error.message : String(error)),
        generationTime,
      });

      return {
        success: false,
        error: {
          code: error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'GENERATION_ERROR',
          message: (error instanceof Error ? error.message : String(error)),
          provider: params.provider,
        },
        metadata: {
          provider: params.provider,
          model: params.model,
          generationTime,
        },
      };
    }
  }

  /**
   * 获取请求头
   */
  private getHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      ...extraHeaders,
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return headers;
  }
}

// 导出单例
let omnirouteInstance: OmniRouteAdapter | null = null;

export function getOmniRouteAdapter(): OmniRouteAdapter {
  if (!omnirouteInstance) {
    omnirouteInstance = new OmniRouteAdapter();
  }
  return omnirouteInstance;
}

export default OmniRouteAdapter;
