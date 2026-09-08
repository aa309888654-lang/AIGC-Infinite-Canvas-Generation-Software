import { ParamValidationError } from './errors';

export interface ImageGenParams {
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  prompt: string;
  [key: string]: unknown;
}

export interface VideoGenParams {
  fps: number;
  duration: number; // in seconds
  width: number;
  height: number;
  prompt: string;
  [key: string]: unknown;
}

export class ApiValidator {
  /**
   * 校验图片生成参数
   * 强制校验 width/height<=2048, steps∈[10-50], cfg_scale∈[1-30]
   */
  static validateImageParams(params: Partial<ImageGenParams>): void {
    if (!params.width || params.width > 2048 || params.width <= 0) {
      throw new ParamValidationError(`Invalid width: ${params.width}. Must be > 0 and <= 2048`);
    }
    if (!params.height || params.height > 2048 || params.height <= 0) {
      throw new ParamValidationError(`Invalid height: ${params.height}. Must be > 0 and <= 2048`);
    }
    if (!params.steps || params.steps < 10 || params.steps > 50) {
      throw new ParamValidationError(`Invalid steps: ${params.steps}. Must be between 10 and 50`);
    }
    if (!params.cfgScale || params.cfgScale < 1 || params.cfgScale > 30) {
      throw new ParamValidationError(`Invalid cfg_scale: ${params.cfgScale}. Must be between 1 and 30`);
    }
    if (!params.prompt || params.prompt.trim() === '') {
      throw new ParamValidationError(`Prompt cannot be empty`);
    }
  }

  /**
   * 校验视频生成参数
   * 强制校验 fps∈[8-30], duration<=5s, resolution<=1024x1024
   */
  static validateVideoParams(params: Partial<VideoGenParams>): void {
    if (!params.fps || params.fps < 8 || params.fps > 30) {
      throw new ParamValidationError(`Invalid fps: ${params.fps}. Must be between 8 and 30`);
    }
    if (!params.duration || params.duration <= 0 || params.duration > 5) {
      throw new ParamValidationError(`Invalid duration: ${params.duration}s. Must be > 0 and <= 5s`);
    }
    if (!params.width || !params.height) {
      throw new ParamValidationError(`Width and height are required`);
    }
    const resolution = params.width * params.height;
    if (resolution > 1024 * 1024) {
      throw new ParamValidationError(`Invalid resolution: ${params.width}x${params.height} (${resolution}). Must be <= 1024x1024`);
    }
    if (!params.prompt || params.prompt.trim() === '') {
      throw new ParamValidationError(`Prompt cannot be empty`);
    }
  }
}
