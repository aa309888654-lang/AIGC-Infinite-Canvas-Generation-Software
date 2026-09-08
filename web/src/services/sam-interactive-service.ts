/**
 * SAM Interactive Segmentation Service
 * 
 * 优先调用真实 SAM2 后端（backend/models/sam2/），失败时回退到本地 BiRefNet + GrabCut 精炼
 */

import { birefnetMattingService } from './birefnet-matting-service';
import { sam2Service } from './sam2-service';
import { logger } from '@/lib/logger';

export interface SAMPoint {
  x: number;
  y: number;
  label: 1 | 0; // 1 = foreground, 0 = background
}

export interface SAMBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SAMInteractiveOptions {
  points?: SAMPoint[];
  box?: SAMBox;
  useAutoMask?: boolean;
  edgeRefinement?: 'none' | 'light' | 'medium' | 'strong';
}

export interface SAMResult {
  success: boolean;
  maskUrl?: string;
  maskData?: Float32Array;
  imageUrl?: string;
  width?: number;
  height?: number;
  processingTime?: number;
  error?: string;
}

class SAMInteractiveService {
  private lastMask: Float32Array | null = null;
  private lastImageUrl: string | null = null;
  private lastWidth = 0;
  private lastHeight = 0;

  /**
   * 执行交互式分割
   * 优先调用真实 SAM2 后端，失败时回退到本地 BiRefNet + GrabCut
   */
  async segment(
    imageUrl: string,
    options: SAMInteractiveOptions = {}
  ): Promise<SAMResult> {
    const startTime = performance.now();

    try {
      // === 优先：调用真实 SAM2 后端 ===
      const sam2Available = await sam2Service.isAvailable();
      if (sam2Available) {
        logger.info('[SAMInteractive] 使用真实 SAM2 后端分割');
        const sam2Result = await sam2Service.segment(imageUrl, {
          model: 'sam2_hiera_large',
          points: options.points,
          box: options.box,
        });
        if (sam2Result.success && sam2Result.imageUrl) {
          return {
            success: true,
            imageUrl: sam2Result.imageUrl,
            maskUrl: sam2Result.maskUrl,
            processingTime: performance.now() - startTime,
          };
        }
        logger.warn('[SAMInteractive] SAM2 后端失败，回退到本地:', sam2Result.error);
      }

      // === 回退：本地 BiRefNet + GrabCut 精炼 ===
      const img = await this.loadImage(imageUrl);
      const { width, height } = this.getImageSize(img);

      if (options.box || (options.points && options.points.length > 0)) {
        return await this.interactiveSegment(img, imageUrl, width, height, options);
      }

      return await this.autoSegment(img, imageUrl, width, height, options);
    } catch (error) {
      logger.error('[SAMInteractive] 分割失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '分割失败',
        processingTime: performance.now() - startTime,
      };
    }
  }

  /**
   * 交互式分割 - 基于用户点击/框选
   */
  private async interactiveSegment(
    img: HTMLImageElement,
    imageUrl: string,
    width: number,
    height: number,
    options: SAMInteractiveOptions
  ): Promise<SAMResult> {
    const startTime = performance.now();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    let initialMask: Float32Array;
    if (this.lastMask && this.lastImageUrl === imageUrl) {
      initialMask = new Float32Array(this.lastMask);
    } else {
      const autoResult = await this.autoSegment(img, imageUrl, width, height, { useAutoMask: true });
      if (!autoResult.success || !autoResult.maskData) {
        throw new Error('自动分割失败');
      }
      initialMask = autoResult.maskData;
    }

    if (options.box) {
      initialMask = this.applyBoxConstraint(initialMask, width, height, options.box);
    }

    if (options.points && options.points.length > 0) {
      initialMask = this.applyPointConstraints(initialMask, imageData, width, height, options.points);
    }

    const refinedMask = this.refineMask(initialMask, imageData, width, height);

    const maskUrl = this.maskToDataURL(refinedMask, width, height);
    const resultImageUrl = this.applyMaskToImage(imageData, refinedMask, width, height);

    this.lastMask = refinedMask;
    this.lastImageUrl = imageUrl;
    this.lastWidth = width;
    this.lastHeight = height;

    return {
      success: true,
      maskUrl,
      maskData: refinedMask,
      imageUrl: resultImageUrl,
      width,
      height,
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * 自动分割 - 使用 BiRefNet
   */
  private async autoSegment(
    img: HTMLImageElement,
    imageUrl: string,
    width: number,
    height: number,
    _options: SAMInteractiveOptions
  ): Promise<SAMResult> {
    const startTime = performance.now();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/png');

    const result = await birefnetMattingService.removeBackground(dataUrl);

    if (!result.success || !result.maskUrl) {
      throw new Error('BiRefNet 分割失败');
    }

    const maskImg = await this.loadImage(result.maskUrl);
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d')!;
    maskCtx.drawImage(maskImg, 0, 0, width, height);
    const maskImageData = maskCtx.getImageData(0, 0, width, height);

    const maskData = new Float32Array(width * height);
    for (let i = 0; i < maskData.length; i++) {
      maskData[i] = maskImageData.data[i * 4] / 255;
    }

    this.lastMask = maskData;
    this.lastImageUrl = imageUrl;
    this.lastWidth = width;
    this.lastHeight = height;

    return {
      success: true,
      maskUrl: result.maskUrl,
      maskData,
      imageUrl: result.imageUrl,
      width,
      height,
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * 应用框选约束 - 只保留框选区域内的前景
   */
  private applyBoxConstraint(
    mask: Float32Array,
    width: number,
    height: number,
    box: SAMBox
  ): Float32Array {
    const result = new Float32Array(width * height);
    const x1 = Math.max(0, Math.min(width - 1, Math.round(box.x1 * width)));
    const y1 = Math.max(0, Math.min(height - 1, Math.round(box.y1 * height)));
    const x2 = Math.max(0, Math.min(width - 1, Math.round(box.x2 * width)));
    const y2 = Math.max(0, Math.min(height - 1, Math.round(box.y2 * height)));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
          result[idx] = mask[idx];
        } else {
          result[idx] = 0;
        }
      }
    }

    return result;
  }

  /**
   * 应用点击约束 - 基于颜色相似性扩展/收缩选区
   */
  private applyPointConstraints(
    mask: Float32Array,
    imageData: ImageData,
    width: number,
    height: number,
    points: SAMPoint[]
  ): Float32Array {
    const result = new Float32Array(mask);
    const data = imageData.data;

    for (const point of points) {
      const px = Math.round(point.x * width);
      const py = Math.round(point.y * height);
      const pidx = py * width + px;

      if (px < 0 || px >= width || py < 0 || py >= height) continue;

      const targetColor = [data[pidx * 4], data[pidx * 4 + 1], data[pidx * 4 + 2]];

      // 使用洪水填充算法扩展选区
      const visited = new Uint8Array(width * height);
      const queue: number[] = [pidx];
      let head = 0;
      visited[pidx] = 1;

      while (head < queue.length) {
        const current = queue[head++];
        const cx = current % width;
        const cy = Math.floor(current / width);

        if (point.label === 1) {
          result[current] = Math.max(result[current], 0.8);
        } else {
          result[current] = Math.min(result[current], 0.2);
        }

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const ni = ny * width + nx;
          if (visited[ni]) continue;

          const nidx = ni * 4;
          const colorDiff = Math.sqrt(
            (data[nidx] - targetColor[0]) ** 2 +
            (data[nidx + 1] - targetColor[1]) ** 2 +
            (data[nidx + 2] - targetColor[2]) ** 2
          );

          if (colorDiff < 40) {
            visited[ni] = 1;
            queue.push(ni);
          }
        }
      }
    }

    return result;
  }

  /**
   * 形态学精炼 mask
   */
  private refineMask(
    mask: Float32Array,
    imageData: ImageData,
    width: number,
    height: number
  ): Float32Array {
    // 腐蚀
    const eroded = this.erode(mask, width, height, 1);
    // 膨胀
    const dilated = this.dilate(eroded, width, height, 2);
    // 再次腐蚀平滑
    const refined = this.erode(dilated, width, height, 1);

    // 使用导向滤波平滑边缘
    return this.guidedFilter(refined, imageData, width, height, 3, 0.01);
  }

  /**
   * 腐蚀操作
   */
  private erode(mask: Float32Array, width: number, height: number, radius: number): Float32Array {
    const result = new Float32Array(mask.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minVal = 1;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              minVal = Math.min(minVal, mask[ny * width + nx]);
            }
          }
        }
        result[y * width + x] = minVal;
      }
    }
    return result;
  }

  /**
   * 膨胀操作
   */
  private dilate(mask: Float32Array, width: number, height: number, radius: number): Float32Array {
    const result = new Float32Array(mask.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let maxVal = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              maxVal = Math.max(maxVal, mask[ny * width + nx]);
            }
          }
        }
        result[y * width + x] = maxVal;
      }
    }
    return result;
  }

  /**
   * 导向滤波
   */
  private guidedFilter(
    alpha: Float32Array,
    imageData: ImageData,
    width: number,
    height: number,
    radius: number,
    eps: number
  ): Float32Array {
    const guide = new Float32Array(width * height);
    const data = imageData.data;
    for (let i = 0; i < guide.length; i++) {
      const pi = i * 4;
      guide[i] = (data[pi] * 0.299 + data[pi + 1] * 0.587 + data[pi + 2] * 0.114) / 255;
    }

    const result = new Float32Array(alpha);
    const boxSize = radius * 2 + 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sumGuide = 0, sumGuideSq = 0, sumAlpha = 0, sumGuideAlpha = 0;
        let count = 0;

        const yStart = Math.max(0, y - radius);
        const yEnd = Math.min(height - 1, y + radius);
        const xStart = Math.max(0, x - radius);
        const xEnd = Math.min(width - 1, x + radius);

        for (let wy = yStart; wy <= yEnd; wy++) {
          for (let wx = xStart; wx <= xEnd; wx++) {
            const wi = wy * width + wx;
            const g = guide[wi];
            const a = alpha[wi];
            sumGuide += g;
            sumGuideSq += g * g;
            sumAlpha += a;
            sumGuideAlpha += g * a;
            count++;
          }
        }

        const meanGuide = sumGuide / count;
        const meanGuideSq = sumGuideSq / count;
        const meanAlpha = sumAlpha / count;
        const meanGuideAlpha = sumGuideAlpha / count;

        const covGuideAlpha = meanGuideAlpha - meanGuide * meanAlpha;
        const varGuide = meanGuideSq - meanGuide * meanGuide;

        const a = covGuideAlpha / (varGuide + eps);
        const b = meanAlpha - a * meanGuide;

        const idx = y * width + x;
        result[idx] = Math.max(0, Math.min(1, a * guide[idx] + b));
      }
    }

    return result;
  }

  /**
   * 将 mask 转换为 DataURL
   */
  private maskToDataURL(mask: Float32Array, width: number, height: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);

    for (let i = 0; i < mask.length; i++) {
      const alpha = Math.round(mask[i] * 255);
      imageData.data[i * 4] = alpha;
      imageData.data[i * 4 + 1] = alpha;
      imageData.data[i * 4 + 2] = alpha;
      imageData.data[i * 4 + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  /**
   * 将 mask 应用到图像
   */
  private applyMaskToImage(
    imageData: ImageData,
    mask: Float32Array,
    width: number,
    height: number
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const resultData = ctx.createImageData(width, height);

    for (let i = 0; i < mask.length; i++) {
      const alpha = mask[i];
      const pi = i * 4;
      resultData.data[pi] = imageData.data[pi];
      resultData.data[pi + 1] = imageData.data[pi + 1];
      resultData.data[pi + 2] = imageData.data[pi + 2];
      resultData.data[pi + 3] = Math.round(alpha * 255);
    }

    ctx.putImageData(resultData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  /**
   * 加载图片
   */
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = url;
    });
  }

  /**
   * 获取图片尺寸（限制最大尺寸）
   */
  private getImageSize(img: HTMLImageElement): { width: number; height: number } {
    const maxDim = 1024;
    let { naturalWidth: w, naturalHeight: h } = img;

    if (Math.max(w, h) > maxDim) {
      const ratio = maxDim / Math.max(w, h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }

    return { width: w, height: h };
  }

  /**
   * 重置缓存
   */
  reset(): void {
    this.lastMask = null;
    this.lastImageUrl = null;
    this.lastWidth = 0;
    this.lastHeight = 0;
  }
}

export const samInteractiveService = new SAMInteractiveService();
