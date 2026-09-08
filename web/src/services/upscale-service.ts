import { logger } from '@/lib/logger';

export interface UpscaleModel {
  id: string;
  name: string;
  desc: string;
  file: string;
  scale: number;
}

export interface UpscaleOptions {
  model?: string;
  scale?: number;
  tile?: number;
  faceEnhance?: boolean;
}

export interface UpscaleResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  processingTime?: number;
}

class UpscaleService {
  private baseUrl = '/api/v1/upscale';
  private healthCache: { online: boolean; timestamp: number } | null = null;
  private cacheTTL = 60000;

  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.healthCache && now - this.healthCache.timestamp < this.cacheTTL) {
      return this.healthCache.online;
    }
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      const online = data.success && data.enabled && data.status === 'online';
      this.healthCache = { online, timestamp: now };
      return online;
    } catch {
      this.healthCache = { online: false, timestamp: now };
      return false;
    }
  }

  async getModels(): Promise<UpscaleModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      const data = await response.json();
      return data.models || [];
    } catch {
      return [];
    }
  }

  async upscale(imageUrl: string, options: UpscaleOptions = {}): Promise<UpscaleResult> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/realesrgan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          model: options.model,
          scale: options.scale,
          tile: options.tile,
          face_enhance: options.faceEnhance,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        return { success: false, error: data.error || '超分处理失败' };
      }

      const resultImageUrl = `data:image/${data.format || 'png'};base64,${data.image}`;

      return {
        success: true,
        imageUrl: resultImageUrl,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('[UpscaleService] upscale error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '超分服务调用失败',
      };
    }
  }
}

export const upscaleService = new UpscaleService();
