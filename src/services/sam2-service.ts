import { logger } from '@/lib/logger';

export interface SAM2Model {
  id: string;
  name: string;
  desc: string;
  file: string;
}

export interface SAM2Point {
  x: number;
  y: number;
  label: 1 | 0;
}

export interface SAM2Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SAM2SegmentOptions {
  model?: string;
  points?: SAM2Point[];
  box?: SAM2Box;
}

export interface SAM2Result {
  success: boolean;
  imageUrl?: string;
  maskUrl?: string;
  error?: string;
  processingTime?: number;
}

class SAM2Service {
  private baseUrl = '/api/v1/sam2';
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

  async getModels(): Promise<SAM2Model[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      const data = await response.json();
      return data.models || [];
    } catch {
      return [];
    }
  }

  async segment(imageUrl: string, options: SAM2SegmentOptions = {}): Promise<SAM2Result> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          model: options.model,
          points: options.points,
          box: options.box,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        return { success: false, error: data.error || 'SAM2 分割失败' };
      }

      const resultImageUrl = `data:image/${data.format || 'png'};base64,${data.image}`;

      return {
        success: true,
        imageUrl: resultImageUrl,
        maskUrl: resultImageUrl,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('[SAM2Service] segment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SAM2 服务调用失败',
      };
    }
  }
}

export const sam2Service = new SAM2Service();
