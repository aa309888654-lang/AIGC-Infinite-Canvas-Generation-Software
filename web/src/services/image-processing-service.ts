/**
 * 图像处理服务
 * 提供抠图、去背景、人物提取、自定义背景、边缘优化等功能
 */

import { getProxiedImageUrl } from '@/lib/utils';

export interface ImageProcessingOptions {
  mode: 'none' | 'remove-background' | 'remove-person' | 'extract-subject' | 'inpaint';
  customBackground?: string;
  edgeFeathering?: number;
  edgeSmoothing?: number;
  quality?: number;
  outputFormat?: 'png' | 'jpeg' | 'webp';
  /** Inpainting: mask 图片 URL（白色=重绘区域，黑色=保留区域） */
  maskImageUrl?: string;
  /** Inpainting: 描述重绘内容的提示词 */
  inpaintPrompt?: string;
  /** Inpainting: AI 服务商 */
  inpaintProvider?: string;
}

export interface ProcessingResult {
  success: boolean;
  imageUrl?: string;
  originalImageUrl?: string;
  error?: string;
}

export interface BatchProcessingResult {
  total: number;
  success: number;
  failed: number;
  results: Array<ProcessingResult & { index: number }>;
}

class ImageProcessingService {
  private static instance: ImageProcessingService;

  private constructor() { /* noop */ }

  public static getInstance(): ImageProcessingService {
    if (!ImageProcessingService.instance) {
      ImageProcessingService.instance = new ImageProcessingService();
    }
    return ImageProcessingService.instance;
  }

  /**
   * 动态获取后端 API URL
   */
  private getBackendApiUrl(): string | null {
    try {
      const stored = localStorage.getItem('backend-api-url');
      if (stored) return stored;
    } catch { /* ignored */ }

    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return 'http://localhost:3200';
    }

    if (typeof window !== 'undefined' && !['5173', '5174', '5175', '5176', '5177', '5178', '5179', '5180'].includes(window.location.port || '')) {
      return window.location.origin;
    }

    return null;
  }

  public async processImage(
    imageUrl: string,
    options: ImageProcessingOptions
  ): Promise<ProcessingResult> {
    if (options.mode === 'none') {
      return { success: true, imageUrl, originalImageUrl: imageUrl };
    }

    const cleanedUrl = this.cleanImageUrl(imageUrl);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return { success: false, error: '无法创建画布上下文', originalImageUrl: imageUrl };
      }

      const img = await this.loadImage(cleanedUrl);
      canvas.width = img.width;
      canvas.height = img.height;

      let result: ProcessingResult;

      switch (options.mode) {
        case 'remove-background':
          result = await this.removeBackground(img, canvas, ctx, options);
          break;
        case 'remove-person':
          result = await this.removePerson(img, canvas, ctx, options);
          break;
        case 'extract-subject':
          result = await this.extractSubject(img, canvas, ctx, options);
          break;
        case 'inpaint':
          result = await this.inpaint(img, canvas, ctx, options);
          break;
        default:
          result = { success: true, imageUrl, originalImageUrl: imageUrl };
      }

      if (result.success && result.imageUrl && options.customBackground) {
        result = await this.addCustomBackground(result.imageUrl, options.customBackground, ctx);
      }

      return {
        ...result,
        originalImageUrl: cleanedUrl
      };
    } catch (error) {
      let errorMessage = '处理失败';
      if (error instanceof Error) {
        if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
          errorMessage = '图片加载失败：跨域问题，请尝试使用相同域名的图片或先将图片下载到本地';
        } else if (error.message.includes('图片加载失败') || error.message.includes('Failed to load')) {
          errorMessage = '图片加载失败，请检查图片链接是否有效';
        } else {
          errorMessage = error.message;
        }
      }
      return {
        success: false,
        error: errorMessage,
        originalImageUrl: cleanedUrl
      };
    }
  }

  public async processImagesBatch(
    images: string[],
    options: ImageProcessingOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<BatchProcessingResult> {
    const results: Array<ProcessingResult & { index: number }> = [];
    let success = 0;
    let failed = 0;

    for (let i = 0; i < images.length; i++) {
      const result = await this.processImage(images[i], options);
      
      if (result.success) {
        success++;
      } else {
        failed++;
      }

      results.push({ ...result, index: i });

      if (onProgress) {
        onProgress(i + 1, images.length);
      }
    }

    return {
      total: images.length,
      success,
      failed,
      results
    };
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const proxiedUrl = getProxiedImageUrl(url);
      if (proxiedUrl === url) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = proxiedUrl;
    });
  }

  private cleanImageUrl(url: string): string {
    if (!url) return url;

    const cleaned = url.trim();

    if (cleaned.startsWith('data:')) {
      return cleaned;
    }

    try {
      const urlObj = new URL(cleaned);
      let pathname = urlObj.pathname;

      const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
      const lastDotIndex = pathname.lastIndexOf('.');
      const secondLastDotIndex = pathname.lastIndexOf('.', lastDotIndex - 1);

      if (lastDotIndex > 0 && secondLastDotIndex > 0) {
        const lastExtension = pathname.slice(lastDotIndex).toLowerCase();
        if (validExtensions.includes(lastExtension)) {
          const beforeSecondLastDot = pathname.slice(0, secondLastDotIndex);
          pathname = beforeSecondLastDot + lastExtension;
        }
      }

      urlObj.pathname = pathname;
      return urlObj.toString();
    } catch {
      return cleaned;
    }
  }

  private async removeBackground(
    img: HTMLImageElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    options: ImageProcessingOptions
  ): Promise<ProcessingResult> {
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const cornerColors = this.getCornerColors(data, canvas.width, canvas.height);
    const edgeFeathering = options.edgeFeathering || 2;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      let isBackground = false;
      let minDiff = Infinity;

      for (const cornerColor of cornerColors) {
        const diff = Math.sqrt(
          Math.pow(r - cornerColor.r, 2) +
          Math.pow(g - cornerColor.g, 2) +
          Math.pow(b - cornerColor.b, 2)
        );
        minDiff = Math.min(minDiff, diff);
        if (diff < 50) {
          isBackground = true;
          break;
        }
      }

      if (!isBackground) {
        const neighbors = this.getNeighborColors(data, i, canvas.width, canvas.height);
        let edgeScore = 0;
        for (const neighbor of neighbors) {
          const diff = Math.sqrt(
            Math.pow(r - neighbor.r, 2) +
            Math.pow(g - neighbor.g, 2) +
            Math.pow(b - neighbor.b, 2)
          );
          if (diff > 60) edgeScore++;
        }

        if (edgeScore >= 3) {
          const alpha = Math.max(0, a - edgeFeathering * 30);
          data[i + 3] = alpha;
        }
      }

      if (isBackground) {
        if (minDiff < 20) {
          data[i + 3] = 0;
        } else {
          data[i + 3] = Math.max(0, a - 150);
        }
      }
    }

    if (options.edgeSmoothing && options.edgeSmoothing > 0) {
      this.applyEdgeSmoothing(imageData, canvas.width, canvas.height, options.edgeSmoothing);
    }

    ctx.putImageData(imageData, 0, 0);
    const processedUrl = canvas.toDataURL('image/png');
    
    return {
      success: true,
      imageUrl: processedUrl
    };
  }

  private async removePerson(
    img: HTMLImageElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    _options: ImageProcessingOptions
  ): Promise<ProcessingResult> {
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const skinRegions: number[] = [];
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (this.isSkinColor(r, g, b)) {
        const pixelIndex = i / 4;
        skinRegions.push(pixelIndex);
      }
    }

    const blurRadius = 15;
    for (const region of skinRegions) {
      const neighbors = this.getNeighborPixels(data, region, canvas.width, canvas.height, blurRadius);
      if (neighbors.length > 0) {
        const avgR = neighbors.reduce((sum, n) => sum + n.r, 0) / neighbors.length;
        const avgG = neighbors.reduce((sum, n) => sum + n.g, 0) / neighbors.length;
        const avgB = neighbors.reduce((sum, n) => sum + n.b, 0) / neighbors.length;
        
        const i = region * 4;
        data[i] = avgR;
        data[i + 1] = avgG;
        data[i + 2] = avgB;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const processedUrl = canvas.toDataURL('image/png');
    
    return {
      success: true,
      imageUrl: processedUrl
    };
  }

  private async extractSubject(
    img: HTMLImageElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    options: ImageProcessingOptions
  ): Promise<ProcessingResult> {
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const cornerColors = this.getCornerColors(data, canvas.width, canvas.height);
    const avgBgColor = {
      r: cornerColors.reduce((s, c) => s + c.r, 0) / cornerColors.length,
      g: cornerColors.reduce((s, c) => s + c.g, 0) / cornerColors.length,
      b: cornerColors.reduce((s, c) => s + c.b, 0) / cornerColors.length,
    };

    const threshold = 35;
    const edgeFeathering = options.edgeFeathering || 3;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const diff = Math.sqrt(
        Math.pow(r - avgBgColor.r, 2) +
        Math.pow(g - avgBgColor.g, 2) +
        Math.pow(b - avgBgColor.b, 2)
      );

      if (diff > threshold) {
        const alpha = Math.min(255, 180 + (diff / 2));
        data[i + 3] = alpha;
        
        data[i] = Math.min(255, r * 1.15);
        data[i + 1] = Math.min(255, g * 1.15);
        data[i + 2] = Math.min(255, b * 1.15);
      } else if (diff > threshold - edgeFeathering) {
        const fadeRatio = (diff - (threshold - edgeFeathering)) / edgeFeathering;
        data[i + 3] = Math.floor(255 * fadeRatio);
      } else {
        data[i + 3] = 0;
      }
    }

    if (options.edgeSmoothing && options.edgeSmoothing > 0) {
      this.applyEdgeSmoothing(imageData, canvas.width, canvas.height, options.edgeSmoothing);
    }

    ctx.putImageData(imageData, 0, 0);
    const processedUrl = canvas.toDataURL('image/png');
    
    return {
      success: true,
      imageUrl: processedUrl
    };
  }

  /**
   * 局部重绘（Inpainting）
   * 优先尝试 AI 服务（通过后端代理），失败时回退到浏览器端内容感知填充
   */
  private async inpaint(
    img: HTMLImageElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    options: ImageProcessingOptions
  ): Promise<ProcessingResult> {
    const originalDataUrl = canvas.toDataURL('image/png');

    // 如果没有提供 mask，无法进行局部重绘
    if (!options.maskImageUrl && !options.inpaintPrompt) {
      return { success: false, error: '局部重绘需要提供 mask 图片或提示词', originalImageUrl: originalDataUrl };
    }

    // 1. 尝试 AI 服务重绘
    if (options.inpaintPrompt) {
      try {
        const aiResult = await this.inpaintViaAI(originalDataUrl, options);
        if (aiResult.success && aiResult.imageUrl) {
          return aiResult;
        }
      } catch {
        // AI 服务不可用，回退到浏览器端处理
      }
    }

    // 2. 浏览器端内容感知填充回退
    if (options.maskImageUrl) {
      return this.inpaintBrowserFallback(img, canvas, ctx, options);
    }

    return { success: false, error: '局部重绘失败：无可用的 AI 服务且未提供 mask', originalImageUrl: originalDataUrl };
  }

  /**
   * 通过 AI 服务进行局部重绘
   */
  private async inpaintViaAI(
    imageBase64: string,
    options: ImageProcessingOptions
  ): Promise<ProcessingResult> {
    const provider = options.inpaintProvider || 'stability-ai';

    try {
      // 动态解析后端 URL（与 aiAssistantService 保持一致）
      const baseUrl = this.getBackendApiUrl();
      if (!baseUrl) {
        throw new Error('后端服务不可用，无法使用 AI 局部重绘');
      }

      const response = await fetch(`${baseUrl}/api/v1/ai/inpaint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          mask: options.maskImageUrl || '',
          prompt: options.inpaintPrompt || '',
          provider,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'AI 重绘请求失败' }));
        throw new Error(err.error || `请求失败: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.imageUrl) {
        return { success: true, imageUrl: result.imageUrl, originalImageUrl: imageBase64 };
      }
      throw new Error(result.error || 'AI 重绘返回无效结果');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 局部重绘失败',
        originalImageUrl: imageBase64,
      };
    }
  }

  /**
   * 浏览器端内容感知填充：使用 mask 标记区域，从周围像素插值填充
   */
  private async inpaintBrowserFallback(
    img: HTMLImageElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    options: ImageProcessingOptions
  ): Promise<ProcessingResult> {
    ctx.drawImage(img, 0, 0);

    // 加载 mask 图片
    let maskImg: HTMLImageElement;
    try {
      maskImg = await this.loadImage(options.maskImageUrl!);
    } catch {
      return { success: false, error: 'Mask 图片加载失败', originalImageUrl: canvas.toDataURL('image/png') };
    }

    // 确保 mask 与原图同尺寸
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext('2d')!;
    maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const mData = maskData.data;
    const width = canvas.width;
    const height = canvas.height;

    // 收集需要填充的像素（mask 白色区域 = 需要重绘）
    const inpaintPixels = new Set<number>();
    for (let i = 0; i < mData.length; i += 4) {
      const brightness = (mData[i] + mData[i + 1] + mData[i + 2]) / 3;
      if (brightness > 128) {
        inpaintPixels.add(i / 4);
      }
    }

    if (inpaintPixels.size === 0) {
      return { success: true, imageUrl: canvas.toDataURL('image/png'), originalImageUrl: canvas.toDataURL('image/png') };
    }

    // 迭代式边界扩散填充：从 inpaint 区域的边界开始，逐步用周围非 mask 像素的均值填充
    const maxIterations = 50;
    const filled = new Uint8Array(width * height); // 标记已填充
    const toFill = new Uint8Array(width * height); // 标记需要填充
    for (const idx of inpaintPixels) {
      toFill[idx] = 1;
    }

    for (let iter = 0; iter < maxIterations; iter++) {
      let filledThisRound = 0;
      const boundaryPixels: number[] = [];

      // 找到边界像素：需要填充且相邻有非 mask / 已填充的像素
      for (const idx of inpaintPixels) {
        if (filled[idx]) continue;
        const x = idx % width;
        const y = Math.floor(idx / width);
        let hasNeighbor = false;
        const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dy] of offsets) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (!toFill[nIdx] || filled[nIdx]) {
              hasNeighbor = true;
              break;
            }
          }
        }
        if (hasNeighbor) boundaryPixels.push(idx);
      }

      if (boundaryPixels.length === 0) break;

      for (const idx of boundaryPixels) {
        const x = idx % width;
        const y = Math.floor(idx / width);
        let sumR = 0, sumG = 0, sumB = 0, count = 0;

        // 采样周围非 mask / 已填充像素
        const sampleRadius = 3;
        for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
          for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (!toFill[nIdx] || filled[nIdx]) {
                const pi = nIdx * 4;
                const weight = 1 / (Math.abs(dx) + Math.abs(dy)); // 距离权重
                sumR += data[pi] * weight;
                sumG += data[pi + 1] * weight;
                sumB += data[pi + 2] * weight;
                count += weight;
              }
            }
          }
        }

        if (count > 0) {
          const pi = idx * 4;
          data[pi] = Math.round(sumR / count);
          data[pi + 1] = Math.round(sumG / count);
          data[pi + 2] = Math.round(sumB / count);
          data[pi + 3] = 255;
          filled[idx] = 1;
          filledThisRound++;
        }
      }

      if (filledThisRound === 0) break;
    }

    // 对填充区域做高斯模糊平滑过渡
    this.smoothInpaintRegion(data, filled, toFill, width, height, 2);

    ctx.putImageData(imageData, 0, 0);
    const processedUrl = canvas.toDataURL('image/png');

    return { success: true, imageUrl: processedUrl, originalImageUrl: processedUrl };
  }

  /**
   * 对 inpaint 填充区域进行平滑处理
   */
  private smoothInpaintRegion(
    data: Uint8ClampedArray,
    filled: Uint8Array,
    toFill: Uint8Array,
    width: number,
    height: number,
    radius: number
  ): void {
    const smoothed = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) smoothed[i] = data[i];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (!toFill[idx] || !filled[idx]) continue;

        // 只对边界像素（邻近非 fill 区域）进行平滑
        let isBoundary = false;
        const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dy] of offsets) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (!toFill[ny * width + nx]) { isBoundary = true; break; }
          }
        }
        if (!isBoundary) continue;

        let sumR = 0, sumG = 0, sumB = 0, totalWeight = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const w = 1 / (1 + Math.abs(dx) + Math.abs(dy));
            const pi = (ny * width + nx) * 4;
            sumR += data[pi] * w;
            sumG += data[pi + 1] * w;
            sumB += data[pi + 2] * w;
            totalWeight += w;
          }
        }
        const pi = idx * 4;
        smoothed[pi] = sumR / totalWeight;
        smoothed[pi + 1] = sumG / totalWeight;
        smoothed[pi + 2] = sumB / totalWeight;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (!toFill[idx] || !filled[idx]) continue;
        const pi = idx * 4;
        data[pi] = Math.round(smoothed[pi]);
        data[pi + 1] = Math.round(smoothed[pi + 1]);
        data[pi + 2] = Math.round(smoothed[pi + 2]);
      }
    }
  }

  private async addCustomBackground(
    imageUrl: string,
    backgroundColor: string,
    _ctx: CanvasRenderingContext2D
  ): Promise<ProcessingResult> {
    try {
      const cleanedUrl = this.cleanImageUrl(imageUrl);
      const img = await this.loadImage(cleanedUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const newCtx = canvas.getContext('2d');
      
      if (!newCtx) {
        return { success: false, error: '无法创建画布', imageUrl: cleanedUrl };
      }

      newCtx.fillStyle = backgroundColor;
      newCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      newCtx.drawImage(img, 0, 0);
      
      const processedUrl = canvas.toDataURL('image/png');
      
      return {
        success: true,
        imageUrl: processedUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '添加背景失败',
        imageUrl
      };
    }
  }

  private getCornerColors(data: Uint8ClampedArray, width: number, height: number): Array<{r: number, g: number, b: number}> {
    const corners = [
      { x: 0, y: 0 },
      { x: width - 1, y: 0 },
      { x: 0, y: height - 1 },
      { x: width - 1, y: height - 1 },
      { x: Math.floor(width / 2), y: 0 },
      { x: 0, y: Math.floor(height / 2) },
      { x: width - 1, y: Math.floor(height / 2) },
      { x: Math.floor(width / 2), y: height - 1 },
    ];

    return corners.map(({ x, y }) => {
      const i = (y * width + x) * 4;
      return { r: data[i], g: data[i + 1], b: data[i + 2] };
    });
  }

  private getNeighborColors(data: Uint8ClampedArray, index: number, width: number, height: number): Array<{r: number, g: number, b: number}> {
    const neighbors: Array<{r: number, g: number, b: number}> = [];
    const x = (index / 4) % width;
    const y = Math.floor((index / 4) / width);

    const offsets = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0], [1, 0],
      [-1, 1], [0, 1], [1, 1]
    ];

    for (const [dx, dy] of offsets) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const ni = (ny * width + nx) * 4;
        neighbors.push({
          r: data[ni],
          g: data[ni + 1],
          b: data[ni + 2]
        });
      }
    }

    return neighbors;
  }

  private getNeighborPixels(
    data: Uint8ClampedArray,
    pixelIndex: number,
    width: number,
    height: number,
    radius: number
  ): Array<{r: number, g: number, b: number}> {
    const neighbors: Array<{r: number, g: number, b: number}> = [];
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    for (let dy = -radius; dy <= radius; dy += 2) {
      for (let dx = -radius; dx <= radius; dx += 2) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const ni = (ny * width + nx) * 4;
          neighbors.push({
            r: data[ni],
            g: data[ni + 1],
            b: data[ni + 2]
          });
        }
      }
    }

    return neighbors;
  }

  private getConnectedRegion(skinMap: Map<number, number[]>, pixelIndex: number, x: number, y: number, width: number, height: number): number[] {
    if (skinMap.has(pixelIndex)) {
      return skinMap.get(pixelIndex)!;
    }

    const region: number[] = [pixelIndex];
    const visited = new Set<number>();
    const queue: Array<{x: number, y: number, idx: number}> = [{x, y, idx: pixelIndex}];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = current.y * width + current.x;
      
      if (visited.has(key)) continue;
      visited.add(key);

      const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dx, dy] of offsets) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nidx = ny * width + nx;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(nidx)) {
          region.push(nidx);
          queue.push({x: nx, y: ny, idx: nidx});
        }
      }
    }

    skinMap.set(pixelIndex, region);
    return region;
  }

  private isSkinColor(r: number, g: number, b: number): boolean {
    if (r < 50 || g < 50 || b < 50) return false;
    if (r > 240 && g > 240 && b > 240) return false;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    if (diff < 10) return false;

    const isSkin =
      (r > 95 && g > 40 && b > 20) &&
      (max - min > 15) &&
      (Math.abs(r - g) > 15) &&
      (r > g && r > b);

    const h = max === min ? 0 : max === r ? 60 * ((g - b) / diff) :
              max === g ? 60 * (2 + (b - r) / diff) :
              60 * (4 + (r - g) / diff);
    const s = max === 0 ? 0 : diff / max;
    const v = max / 255;

    const hsvSkin = h >= 0 && h <= 50 && s >= 0.1 && s <= 0.9 && v >= 0.2 && v <= 0.95;

    return isSkin || hsvSkin;
  }

  private applyEdgeSmoothing(
    imageData: ImageData,
    width: number,
    height: number,
    iterations: number
  ): void {
    const data = imageData.data;
    
    for (let iter = 0; iter < iterations; iter++) {
      const alphaChanges = new Map<number, number>();
      
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = (y * width + x) * 4;
          const alpha = data[i + 3];
          
          if (alpha > 0 && alpha < 255) {
            const neighbors = [
              (y - 1) * width + x,
              (y + 1) * width + x,
              y * width + (x - 1),
              y * width + (x + 1)
            ];
            
            let alphaSum = 0;
            let count = 0;
            
            for (const ni of neighbors) {
              const nAlpha = data[ni * 4 + 3];
              if (nAlpha !== alpha) {
                alphaSum += nAlpha;
                count++;
              }
            }
            
            if (count > 0) {
              const avgAlpha = alphaSum / count;
              if (Math.abs(avgAlpha - alpha) > 10) {
                alphaChanges.set(i, Math.round((alpha + avgAlpha) / 2));
              }
            }
          }
        }
      }
      
      for (const [i, newAlpha] of alphaChanges) {
        data[i + 3] = newAlpha;
      }
      
      if (alphaChanges.size === 0) break;
    }
  }

  public getProcessingModes(): Array<{
    id: ImageProcessingOptions['mode'];
    name: string;
    icon: string;
    description: string;
  }> {
    return [
      {
        id: 'none',
        name: '原图',
        icon: '🖼️',
        description: '保持原始图片不变'
      },
      {
        id: 'remove-background',
        name: '去背景',
        icon: '🎨',
        description: '自动识别并去除背景，保留主体'
      },
      {
        id: 'remove-person',
        name: '去人物',
        icon: '👤',
        description: '识别人物区域并进行模糊处理'
      },
      {
        id: 'extract-subject',
        name: '抠图',
        icon: '✂️',
        description: '精细提取主体，生成透明背景'
      },
      {
        id: 'inpaint',
        name: '局部重绘',
        icon: '🖌️',
        description: '用 mask 标记区域，AI 或插值算法填充重绘'
      }
    ];
  }

  public getPresetBackgrounds(): Array<{ id: string; name: string; color: string }> {
    return [
      { id: 'none', name: '透明', color: 'transparent' },
      { id: 'white', name: '白色', color: '#FFFFFF' },
      { id: 'black', name: '黑色', color: '#000000' },
      { id: 'gray', name: '灰色', color: '#808080' },
      { id: 'red', name: '红色', color: '#FF0000' },
      { id: 'blue', name: '蓝色', color: '#0000FF' },
      { id: 'green', name: '绿色', color: '#00FF00' },
      { id: 'yellow', name: '黄色', color: '#FFFF00' },
    ];
  }

  public getEdgeFeatheringOptions(): Array<{ value: number; name: string }> {
    return [
      { value: 0, name: '无' },
      { value: 2, name: '轻微' },
      { value: 3, name: '中等' },
      { value: 5, name: '强烈' },
    ];
  }

  public getEdgeSmoothingOptions(): Array<{ value: number; name: string }> {
    return [
      { value: 0, name: '无' },
      { value: 1, name: '轻微' },
      { value: 2, name: '中等' },
      { value: 3, name: '平滑' },
    ];
  }
}

export const imageProcessingService = ImageProcessingService.getInstance();
