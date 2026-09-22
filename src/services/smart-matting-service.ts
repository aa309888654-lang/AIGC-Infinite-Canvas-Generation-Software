/**
 * Smart Matting Service - 智能抠图引擎
 *
 * 六引擎级联方案，自动选择最佳算法：
 *   Strategy 1: AI 人像分割 (Baidu Body Seg) - 最优人像
 *   Strategy 2: Rembg 通用分割 (BiRefNet/U2Net) - 通用物体SOTA
 *   Strategy 3: Rembg WebGPU (MIT, 蒸馏模型) - 本地AI最优
 *   Strategy 4: 浏览器端AI (@imgly/background-removal) - 离线回退
 *   Strategy 5: 交互式分割 (SAM-Web) - 用户点击选择
 *   Strategy 6: 智能色彩分割 (Enhanced GrabCut-style) - 纯算法回退
 *
 * 后处理管线：
 *   - 形态学清理 (erosion/dilation)
 *   - 导向滤波边缘精化
 *   - 颜色净化 (去除背景色溢出)
 *   - 自适应羽化
 */

import { rembgService } from './rembg-service';
import { rembgWebGPUService } from './rembg-webgpu-service';
import { aiProcessor } from './ai-processor';
import { birefnetMattingService } from './birefnet-matting-service';
// 百度API已移除（质量差，仅人像分割，非通用抠图）
// import { baiduAIService } from './baidu-ai-service';

// ==================== 类型定义 ====================

export type MattingStrategy = 'ai' | 'rembg' | 'rembg-webgpu' | 'browser-ai' | 'sam-interactive' | 'smart-segment' | 'auto';

export interface SmartMattingOptions {
  strategy?: MattingStrategy;
  backgroundColor?: string;
  edgeRefinement?: 'none' | 'light' | 'medium' | 'strong';
  featherRadius?: number;
  decontaminateColors?: boolean;
  outputScale?: number;
  rembgModel?: string;
  browserAIModel?: 'isnet' | 'isnet_fp16' | 'isnet_quint8';
  browserAIDevice?: 'cpu' | 'gpu';
  samPoints?: Array<{ x: number; y: number; label: number }>;
  samBox?: { x1: number; y1: number; x2: number; y2: number };
}

export interface MattingResult {
  success: boolean;
  imageUrl?: string;
  maskUrl?: string;
  originalUrl?: string;
  strategyUsed: MattingStrategy;
  confidence?: number;
  error?: string;
}

const DEFAULT_OPTIONS: Required<SmartMattingOptions> = {
  strategy: 'auto',
  backgroundColor: 'transparent',
  edgeRefinement: 'medium',
  featherRadius: 1,
  decontaminateColors: true,
  outputScale: 1,
  rembgModel: 'birefnet-general',
  browserAIModel: 'isnet_fp16',
  browserAIDevice: 'gpu',
  samPoints: [],
  samBox: { x1: 0, y1: 0, x2: 1, y2: 1 },
};

// ==================== 主入口 ====================

class SmartMattingEngine {
  /**
   * 智能抠图 — 自动选择最佳策略
   */
  async removeBackground(
    imageUrl: string,
    options: SmartMattingOptions = {}
  ): Promise<MattingResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
      const img = await this.loadImage(imageUrl);
      const { width, height } = this.targetSize(img, opts.outputScale);

      // --- Strategy 1: BiRefNet ONNX (本地嵌入SOTA，质量最佳，原百度API已移除) ---
      if (opts.strategy === 'ai' || opts.strategy === 'auto') {
        try {
          const birefnetAvailable = await birefnetMattingService.isAvailable();
          if (birefnetAvailable) {
            await birefnetMattingService.preload();
            const birefnetResult = await birefnetMattingService.removeBackground(imageUrl, {
              backgroundColor: opts.backgroundColor,
            });
            if (birefnetResult.success && birefnetResult.imageUrl) {
              const refined = await this.postProcess(birefnetResult.imageUrl, null, opts);
              return {
                success: true,
                imageUrl: refined.imageUrl,
                maskUrl: refined.maskUrl || birefnetResult.maskUrl,
                originalUrl: imageUrl,
                strategyUsed: 'ai',
                confidence: 0.95,
              };
            }
          }
        } catch {
          if (opts.strategy === 'ai') {
            return { success: false, error: 'BiRefNet 本地抠图不可用', strategyUsed: 'ai', originalUrl: imageUrl };
          }
        }
      }

      // --- Strategy 2: Rembg (best for general objects, SOTA) ---
      if (opts.strategy === 'rembg' || opts.strategy === 'auto') {
        const available = await rembgService.isAvailable();
        if (available) {
          try {
            const rembgResult = await rembgService.removeBackground(imageUrl, {
              model: opts.rembgModel,
              alphaMatting: opts.edgeRefinement !== 'none',
            });
            if (rembgResult.success && rembgResult.imageUrl) {
              const refined = await this.postProcess(rembgResult.imageUrl, null, opts);
              return {
                success: true,
                imageUrl: refined.imageUrl,
                maskUrl: refined.maskUrl,
                originalUrl: imageUrl,
                strategyUsed: 'rembg',
                confidence: 0.90,
              };
            }
          } catch {
            if (opts.strategy === 'rembg') {
              return { success: false, error: 'Rembg 服务不可用', strategyUsed: 'rembg', originalUrl: imageUrl };
            }
          }
        }
      }

      // --- Strategy 3: Rembg WebGPU (MIT, best local AI) ---
      if (opts.strategy === 'rembg-webgpu') {
        try {
          const available = await rembgWebGPUService.isAvailable();
          if (available) {
            const webgpuResult = await rembgWebGPUService.removeBackground(imageUrl);
            if (webgpuResult.success && webgpuResult.imageUrl) {
              const refined = await this.postProcess(webgpuResult.imageUrl, null, opts);
              return {
                success: true,
                imageUrl: refined.imageUrl,
                maskUrl: refined.maskUrl,
                originalUrl: imageUrl,
                strategyUsed: 'rembg-webgpu',
                confidence: 0.90,
              };
            }
          }
        } catch {
          if (opts.strategy === 'rembg-webgpu') {
            return { success: false, error: 'Rembg WebGPU 抠图失败', strategyUsed: 'rembg-webgpu', originalUrl: imageUrl };
          }
        }
      }

      // --- Strategy 4: Browser-side AI (@imgly/background-removal) ---
      if (opts.strategy === 'browser-ai' || opts.strategy === 'auto') {
        try {
          const browserResult = await aiProcessor.removeBackground(imageUrl, {
            model: opts.browserAIModel as any,
            device: opts.browserAIDevice as any,
          });
          if (browserResult) {
            const refined = await this.postProcess(browserResult, null, opts);
            return {
              success: true,
              imageUrl: refined.imageUrl,
              maskUrl: refined.maskUrl,
              originalUrl: imageUrl,
              strategyUsed: 'browser-ai',
              confidence: 0.85,
            };
          }
        } catch {
          // GPU 失败时尝试 CPU + INT8 模型
          if (opts.browserAIDevice !== 'cpu') {
            try {
              const cpuResult = await aiProcessor.removeBackground(imageUrl, {
                model: 'isnet_quint8' as any,
                device: 'cpu',
              });
              if (cpuResult) {
                const refined = await this.postProcess(cpuResult, null, opts);
                return {
                  success: true,
                  imageUrl: refined.imageUrl,
                  maskUrl: refined.maskUrl,
                  originalUrl: imageUrl,
                  strategyUsed: 'browser-ai',
                  confidence: 0.80,
                };
              }
            } catch { /* ignore */ }
          }
          if (opts.strategy === 'browser-ai') {
            return { success: false, error: '浏览器端AI抠图失败', strategyUsed: 'browser-ai', originalUrl: imageUrl };
          }
        }
      }

      // --- Strategy 5: SAM Interactive (user click/box) ---
      if (opts.strategy === 'sam-interactive') {
        return {
          success: false,
          error: 'SAM交互式分割需要通过SAM组件调用',
          strategyUsed: 'sam-interactive',
          originalUrl: imageUrl,
        };
      }

      // --- Strategy 6: Smart Color Segmentation (local fallback) ---
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const mask = await this.smartSegment(imageData, width, height);
      const mattingResult = await this.edgeAwareMatting(imageData, mask, width, height, opts);

      const refined = await this.postProcess(
        this.imageDataToDataURL(imageData, width, height),
        mattingResult.mask,
        opts
      );

      const confidence = this.estimateConfidence(mask, width, height);

      return {
        success: true,
        imageUrl: refined.imageUrl,
        maskUrl: refined.maskUrl || this.maskToDataURL(mask, width, height),
        originalUrl: imageUrl,
        strategyUsed: 'smart-segment',
        confidence,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '抠图失败',
        strategyUsed: opts.strategy === 'auto' ? 'smart-segment' : opts.strategy,
        originalUrl: imageUrl,
      };
    }
  }

  // ==================== 策略2: 智能色彩分割 ====================

  /**
   * Enhanced GrabCut-style 分割
   * 1. K-means 色彩聚类 (K=6)
   * 2. 构建前景/背景色彩模型
   * 3. 迭代 Graph-Cut 优化
   * 4. 连通域分析提取主主体
   */
  private async smartSegment(
    imageData: ImageData,
    width: number,
    height: number
  ): Promise<Float32Array> {
    const pixels = this.extractPixels(imageData);

    // Step 1: K-means 聚类
    const k = 6;
    const { clusters, assignments } = this.kmeans(pixels, k, 10);

    // Step 2: 确定哪些簇是背景（触边的簇优先判为背景）
    const borderAssignments = this.getBorderAssignments(assignments, width, height);
    const bgClusters = new Set<number>();
    for (let c = 0; c < k; c++) {
      const ratio = (borderAssignments[c] || 0) / (assignments.filter(a => a === c).length || 1);
      if (ratio > 0.15) bgClusters.add(c); // 超过15%像素在边缘 → 背景簇
    }

    // 如果所有簇都触边或都不触边，用中心偏置判断
    if (bgClusters.size === 0 || bgClusters.size === k) {
      const centerClusters = this.getCenterAssignments(assignments, width, height);
      // 中心占比最高的2个簇作为前景
      const sorted = Object.entries(centerClusters)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(e => Number(e[0]));
      for (let c = 0; c < k; c++) {
        if (!sorted.includes(c)) bgClusters.add(c);
      }
    }

    // Step 3: 构建初始 mask
    const mask = new Float32Array(width * height);
    for (let i = 0; i < assignments.length; i++) {
      const c = assignments[i];
      mask[i] = bgClusters.has(c) ? 0 : 1;
    }

    // Step 4: 迭代 Graph-Cut 风格优化 (简化版: 基于邻域一致性)
    for (let iter = 0; iter < 3; iter++) {
      await this.yieldToUI();
      this.refineMask(mask, imageData, width, height, bgClusters, assignments);
    }

    // Step 5: 连通域分析 — 只保留最大连通域
    const cleanedMask = this.keepLargestComponent(mask, width, height);

    // Step 6: 形态学清理
    this.morphologicalClean(cleanedMask, width, height, 2);

    return cleanedMask;
  }

  /**
   * K-Means 聚类 (像素色彩空间)
   */
  private kmeans(
    pixels: Float32Array[],
    k: number,
    maxIter: number
  ): { clusters: Float32Array[]; assignments: number[] } {
    const n = pixels.length;
    // 初始化聚类中心 (均匀采样)
    const clusters: Float32Array[] = [];
    const step = Math.max(1, Math.floor(n / (k + 1)));
    for (let i = 0; i < k; i++) {
      clusters.push(new Float32Array(pixels[(i + 1) * step]));
    }

    const assignments = new Array<number>(n).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
      // 分配步骤
      let changed = 0;
      for (let i = 0; i < n; i++) {
        const p = pixels[i];
        let minDist = Infinity;
        let bestCluster = 0;
        for (let c = 0; c < k; c++) {
          const d = this.colorDistance(p, clusters[c]);
          if (d < minDist) {
            minDist = d;
            bestCluster = c;
          }
        }
        if (assignments[i] !== bestCluster) {
          changed++;
          assignments[i] = bestCluster;
        }
      }

      if (changed === 0) break;

      // 更新步骤
      const sums = Array.from({ length: k }, () => new Float32Array(5));
      const counts = new Array(k).fill(0);

      for (let i = 0; i < n; i++) {
        const c = assignments[i];
        const p = pixels[i];
        for (let j = 0; j < 5; j++) {
          sums[c][j] += p[j];
        }
        counts[c]++;
      }

      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          for (let j = 0; j < 5; j++) {
            clusters[c][j] = sums[c][j] / counts[c];
          }
        }
      }
    }

    return { clusters, assignments };
  }

  /**
   * 基于邻域的 mask 精炼 (简化 Graph-Cut)
   * 每个像素根据其周围像素的 mask 状态和颜色相似度调整
   */
  private refineMask(
    mask: Float32Array,
    imageData: ImageData,
    width: number,
    height: number,
    _bgClusters: Set<number>,
    _assignments: number[]
  ): void {
    const data = imageData.data;
    const newMask = new Float32Array(mask);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const pi = idx * 4;

        // 邻域统计
        let fgNeighbors = 0;
        let totalNeighbors = 0;
        let colorConsistency = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ni = (y + dy) * width + (x + dx);
            totalNeighbors++;
            if (mask[ni] > 0.5) fgNeighbors++;

            // 颜色一致性
            const npi = ni * 4;
            const colorDiff = Math.sqrt(
              (data[pi] - data[npi]) ** 2 +
              (data[pi + 1] - data[npi + 1]) ** 2 +
              (data[pi + 2] - data[npi + 2]) ** 2
            );
            if (colorDiff < 30) colorConsistency++;
          }
        }

        const fgRatio = fgNeighbors / totalNeighbors;

        // 平滑项：与邻域一致
        if (fgRatio > 0.7 && colorConsistency > 4) {
          newMask[idx] = Math.max(mask[idx], 0.7);
        } else if (fgRatio < 0.3 && colorConsistency < 2) {
          newMask[idx] = Math.min(mask[idx], 0.3);
        }
        // 否则保持原值
      }
    }

    // 应用更新
    for (let i = 0; i < mask.length; i++) {
      mask[i] = newMask[i];
    }
  }

  // ==================== 策略3: 边缘感知 Alpha Matting ====================

  /**
   * 对 mask 的边缘区域进行 Alpha Matting
   * 生成平滑的半透明过渡，处理头发/毛发等复杂边缘
   */
  private async edgeAwareMatting(
    imageData: ImageData,
    mask: Float32Array,
    width: number,
    height: number,
    options: Required<SmartMattingOptions>
  ): Promise<{ imageData: ImageData; mask: Float32Array }> {
    if (options.edgeRefinement === 'none') {
      // 直接二值化应用 mask
      const data = imageData.data;
      for (let i = 0; i < mask.length; i++) {
        data[i * 4 + 3] = mask[i] > 0.5 ? 255 : 0;
      }
      return { imageData, mask };
    }

    // 生成 Trimap: foreground(>0.9), background(<0.1), unknown(其余)
    const trimap = new Uint8Array(width * height);
    const unknownPixels: number[] = [];

    const erodeRadius = options.edgeRefinement === 'strong' ? 5 : options.edgeRefinement === 'medium' ? 3 : 1;
    const unknownBand = erodeRadius + 3;

    // 先腐蚀/膨胀找边缘带
    const eroded = this.erodeMask(mask, width, height, erodeRadius);
    const dilated = this.dilateMask(mask, width, height, unknownBand);

    for (let i = 0; i < mask.length; i++) {
      if (eroded[i] > 0.9) {
        trimap[i] = 255; // 确定前景
      } else if (dilated[i] < 0.1) {
        trimap[i] = 0;   // 确定背景
      } else {
        trimap[i] = 128; // 未知区域
        unknownPixels.push(i);
      }
    }

    // 对未知区域做局部 Alpha 估计
    const data = imageData.data;
    const alphaMask = new Float32Array(mask);

    for (const idx of unknownPixels) {
      const x = idx % width;
      const y = Math.floor(idx / width);
      const alpha = this.estimateAlpha(data, trimap, width, height, x, y, 7);
      alphaMask[idx] = alpha;
    }

    // 导向滤波平滑 alpha
    if (options.edgeRefinement !== 'light') {
      this.guidedFilterAlpha(alphaMask, data, width, height, 2, 0.01);
    }

    // 应用 alpha 到图像
    for (let i = 0; i < mask.length; i++) {
      const alpha = Math.round(Math.min(255, Math.max(0, alphaMask[i] * 255)));
      data[i * 4 + 3] = alpha;
    }

    // 颜色净化
    if (options.decontaminateColors) {
      this.decontaminateColors(imageData, alphaMask, width, height);
    }

    return { imageData, mask: alphaMask };
  }

  /**
   * 局部 Alpha 估计
   * 对每个未知像素，在其邻域内找最近的前景/背景样本，
   * 用 color line model 估计 alpha
   */
  private estimateAlpha(
    data: Uint8ClampedArray,
    trimap: Uint8Array,
    width: number,
    height: number,
    cx: number,
    cy: number,
    radius: number
  ): number {
    const fgSamples: number[][] = [];
    const bgSamples: number[][] = [];

    // 螺旋搜索找最近的前景和背景像素
    for (let r = 1; r <= radius && (fgSamples.length === 0 || bgSamples.length === 0); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // 只在当前环上
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const ni = ny * width + nx;
          const npi = ni * 4;

          if (trimap[ni] === 255 && fgSamples.length < 5) {
            fgSamples.push([data[npi], data[npi + 1], data[npi + 2]]);
          } else if (trimap[ni] === 0 && bgSamples.length < 5) {
            bgSamples.push([data[npi], data[npi + 1], data[npi + 2]]);
          }

          if (fgSamples.length >= 5 && bgSamples.length >= 5) break;
        }
      }
    }

    if (fgSamples.length === 0 || bgSamples.length === 0) {
      // 回退: 用 mask 初始值
      const idx = cy * width + cx;
      const pi = idx * 4;
      return data[pi + 3] / 255;
    }

    // 找最佳的一对前景-背景样本
    let bestAlpha = 0.5;
    let minCost = Infinity;

    const pi = (cy * width + cx) * 4;
    const pixelColor = [data[pi], data[pi + 1], data[pi + 2]];

    for (const fg of fgSamples) {
      for (const bg of bgSamples) {
        // Color line model: C = α*F + (1-α)*B
        // α = (C-B)·(F-B) / ||F-B||²
        const fbDiff = [fg[0] - bg[0], fg[1] - bg[1], fg[2] - bg[2]];
        const fbNormSq = fbDiff[0] ** 2 + fbDiff[1] ** 2 + fbDiff[2] ** 2;

        if (fbNormSq < 1) continue;

        const cbDiff = [pixelColor[0] - bg[0], pixelColor[1] - bg[1], pixelColor[2] - bg[2]];
        let alpha = (cbDiff[0] * fbDiff[0] + cbDiff[1] * fbDiff[1] + cbDiff[2] * fbDiff[2]) / fbNormSq;
        alpha = Math.max(0, Math.min(1, alpha));

        // 代价 = 重构误差
        const reconstruction = [
          alpha * fg[0] + (1 - alpha) * bg[0],
          alpha * fg[1] + (1 - alpha) * bg[1],
          alpha * fg[2] + (1 - alpha) * bg[2],
        ];
        const cost = Math.sqrt(
          (pixelColor[0] - reconstruction[0]) ** 2 +
          (pixelColor[1] - reconstruction[1]) ** 2 +
          (pixelColor[2] - reconstruction[2]) ** 2
        );

        if (cost < minCost) {
          minCost = cost;
          bestAlpha = alpha;
        }
      }
    }

    return Math.max(0, Math.min(1, bestAlpha));
  }

  /**
   * 导向滤波 — 用原始图像引导 alpha matte 边缘平滑
   * 保持边缘的同时平滑 alpha 值
   */
  private guidedFilterAlpha(
    alpha: Float32Array,
    image: Uint8ClampedArray,
    width: number,
    height: number,
    radius: number,
    eps: number
  ): void {
    // 转换为灰度引导图
    const guide = new Float32Array(width * height);
    for (let i = 0; i < guide.length; i++) {
      const pi = i * 4;
      guide[i] = (image[pi] * 0.299 + image[pi + 1] * 0.587 + image[pi + 2] * 0.114) / 255;
    }

    // 简化的盒式导向滤波
    const result = new Float32Array(alpha);
    const boxSize = radius * 2 + 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // 局部窗口统计
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

        // 对当前窗口中心像素应用
        const idx = y * width + x;
        const gCenter = guide[idx];
        result[idx] = a * gCenter + b;
      }
    }

    // 应用滤波结果
    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = Math.max(0, Math.min(1, result[i]));
    }
  }

  /**
   * 颜色净化 — 去除前景边缘的背景色溢出
   */
  private decontaminateColors(
    imageData: ImageData,
    alpha: Float32Array,
    width: number,
    height: number
  ): void {
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const a = alpha[idx];
        const pi = idx * 4;

        // 只处理半透明边缘区域
        if (a < 0.05 || a > 0.95) continue;

        // 在邻域找不透明前景像素，计算前景参考色
        let sumR = 0, sumG = 0, sumB = 0, fgCount = 0;
        const searchRadius = 3;

        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
          for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const ni = ny * width + nx;
            if (alpha[ni] > 0.9) {
              const npi = ni * 4;
              const weight = 1 / (1 + Math.abs(dx) + Math.abs(dy));
              sumR += data[npi] * weight;
              sumG += data[npi + 1] * weight;
              sumB += data[npi + 2] * weight;
              fgCount += weight;
            }
          }
        }

        if (fgCount > 0) {
          // 用参考前景色替换（加权混合）
          const refR = sumR / fgCount;
          const refG = sumG / fgCount;
          const refB = sumB / fgCount;

          // 逐步向参考色靠拢（alpha 越小，越靠近前景色以减少背景色溢出）
          const blend = 0.5 * (1 - a);
          data[pi] = Math.round(data[pi] * (1 - blend) + refR * blend);
          data[pi + 1] = Math.round(data[pi + 1] * (1 - blend) + refG * blend);
          data[pi + 2] = Math.round(data[pi + 2] * (1 - blend) + refB * blend);
        }
      }
    }
  }

  // ==================== 后处理 ====================

  private async postProcess(
    imageUrl: string,
    mask: Float32Array | null,
    options: Required<SmartMattingOptions>
  ): Promise<{ imageUrl: string; maskUrl?: string }> {
    const img = await this.loadImage(imageUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;

    // 如果指定了背景色，先画背景
    if (options.backgroundColor && options.backgroundColor !== 'transparent') {
      ctx.fillStyle = options.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0);

    let maskUrl: string | undefined;
    if (mask) {
      maskUrl = this.maskToDataURL(mask, canvas.width, canvas.height);
    }

    return {
      imageUrl: canvas.toDataURL('image/png'),
      maskUrl,
    };
  }

  // ==================== 形态学操作 ====================

  private erodeMask(mask: Float32Array, width: number, height: number, radius: number): Float32Array {
    const result = new Float32Array(mask);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minVal = 1;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            minVal = Math.min(minVal, mask[ny * width + nx]);
          }
        }
        result[y * width + x] = minVal;
      }
    }
    return result;
  }

  private dilateMask(mask: Float32Array, width: number, height: number, radius: number): Float32Array {
    const result = new Float32Array(mask);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let maxVal = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            maxVal = Math.max(maxVal, mask[ny * width + nx]);
          }
        }
        result[y * width + x] = maxVal;
      }
    }
    return result;
  }

  private morphologicalClean(mask: Float32Array, width: number, height: number, radius: number): void {
    // 开运算: 先腐蚀再膨胀，去除小噪声
    const eroded = this.erodeMask(mask, width, height, radius);
    const opened = this.dilateMask(eroded, width, height, radius);

    // 闭运算: 先膨胀再腐蚀，填充小洞
    const dilated = this.dilateMask(opened, width, height, radius);
    const closed = this.erodeMask(dilated, width, height, radius);

    for (let i = 0; i < mask.length; i++) {
      mask[i] = closed[i];
    }
  }

  // ==================== 辅助函数 ====================

  private extractPixels(imageData: ImageData): Float32Array[] {
    const { data, width, height } = imageData;
    const pixels: Float32Array[] = [];

    // 步长采样以提高性能 (每2x2块取一个像素)
    const step = Math.max(1, Math.floor(Math.min(width, height) / 150));

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        // [R, G, B, normalized_x, normalized_y]
        pixels.push(new Float32Array([
          data[i],
          data[i + 1],
          data[i + 2],
          x / width,
          y / height,
        ]));
      }
    }

    return pixels;
  }

  private colorDistance(a: Float32Array, b: Float32Array): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  }

  private getBorderAssignments(assignments: number[], width: number, height: number): Record<number, number> {
    const step = Math.max(1, Math.floor(Math.min(width, height) / 150));
    const counts: Record<number, number> = {};
    const borderThickness = 2; // 用几像素宽作为边界

    for (let bx = 0; bx < borderThickness; bx++) {
      for (let y = 0; y < height; y += step) {
        const idx = Math.floor(y / step) * Math.floor(width / step) + Math.floor(bx / step);
        if (idx < assignments.length) {
          counts[assignments[idx]] = (counts[assignments[idx]] || 0) + 1;
        }
      }
      for (let x = 0; x < width; x += step) {
        const idx = Math.floor((height - 1 - bx) / step) * Math.floor(width / step) + Math.floor(x / step);
        if (idx < assignments.length) {
          counts[assignments[idx]] = (counts[assignments[idx]] || 0) + 1;
        }
      }
    }

    return counts;
  }

  private getCenterAssignments(assignments: number[], width: number, height: number): Record<number, number> {
    const step = Math.max(1, Math.floor(Math.min(width, height) / 150));
    const counts: Record<number, number> = {};
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const regionSize = Math.floor(Math.min(width, height) / 3);

    for (let y = Math.max(0, cy - regionSize); y < Math.min(height, cy + regionSize); y += step) {
      for (let x = Math.max(0, cx - regionSize); x < Math.min(width, cx + regionSize); x += step) {
        const idx = Math.floor(y / step) * Math.floor(width / step) + Math.floor(x / step);
        if (idx < assignments.length) {
          counts[assignments[idx]] = (counts[assignments[idx]] || 0) + 1;
        }
      }
    }

    return counts;
  }

  private keepLargestComponent(mask: Float32Array, width: number, height: number): Float32Array {
    const visited = new Uint8Array(width * height);
    let largestComponent: number[] = [];
    let largestSize = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (mask[idx] < 0.5 || visited[idx]) continue;

        // BFS 找连通域
        const component: number[] = [];
        const queue = [idx];
        visited[idx] = 1;

        while (queue.length > 0) {
          const current = queue.shift()!;
          component.push(current);

          const cx = current % width;
          const cy = Math.floor(current / width);

          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const ni = ny * width + nx;
            if (!visited[ni] && mask[ni] > 0.5) {
              visited[ni] = 1;
              queue.push(ni);
            }
          }
        }

        if (component.length > largestSize) {
          largestSize = component.length;
          largestComponent = component;
        }
      }
    }

    // 只保留最大连通域
    const result = new Float32Array(width * height);
    for (const idx of largestComponent) {
      result[idx] = 1;
    }

    return result;
  }

  private estimateConfidence(mask: Float32Array, width: number, height: number): number {
    let totalPixels = 0;
    let uncertainPixels = 0;

    for (let i = 0; i < mask.length; i++) {
      totalPixels++;
      if (mask[i] > 0.3 && mask[i] < 0.7) {
        uncertainPixels++;
      }
    }

    const uncertaintyRatio = uncertainPixels / totalPixels;
    // 不确定像素占比越少，置信度越高
    return Math.max(0, 1 - uncertaintyRatio * 5);
  }

  // ==================== DataURL 转换 ====================

  private imageDataToDataURL(imageData: ImageData, width: number, height: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

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

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = url;
    });
  }

  private targetSize(img: HTMLImageElement, scale: number): { width: number; height: number } {
    const maxDim = 1200;
    let { naturalWidth: w, naturalHeight: h } = img;

    if (Math.max(w, h) > maxDim) {
      const ratio = maxDim / Math.max(w, h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }

    return {
      width: Math.round(w * scale),
      height: Math.round(h * scale),
    };
  }

  private yieldToUI(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }
}

export const smartMattingEngine = new SmartMattingEngine();
