import { logger } from '@/lib/logger';
import { removeBackground, segmentForeground } from '@imgly/background-removal';

export interface LocalMattingOptions {
  modelType: 'sam' | 'bria' | 'rvm' | 'xmem';
  inferenceEngine: 'onnx' | 'tflite' | 'openvino';
  edgeRefinement: 'none' | 'light' | 'medium' | 'strong';
  featherRadius: number;
  decontaminateColors: boolean;
  outputScale: number;
  backgroundColor: string;
}

export interface MattingResult {
  success: boolean;
  imageUrl?: string;
  maskUrl?: string;
  strategyUsed: string;
  confidence?: number;
  error?: string;
  processingTime?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  modelType: 'sam' | 'bria' | 'rvm' | 'xmem';
  isnetVariant: 'isnet_fp16' | 'isnet_quint8';
  inputSize: { width: number; height: number };
  modelSize: string;
  loaded: boolean;
  embedded?: boolean;
}

const APP_BASE_URL = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const LOCAL_MODEL_PUBLIC_PATH = `${globalThis.location?.origin || ''}${APP_BASE_URL}/models/matting/`;
const CDN_MODEL_PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

function isWasmLoadingError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('no available backend') ||
    lower.includes('dynamically imported module') ||
    lower.includes('blob:') ||
    lower.includes('wasm') ||
    lower.includes('failed to fetch') ||
    lower.includes('load failed') ||
    lower.includes('network') ||
    lower.includes('resource metadata not found')
  );
}

const MODEL_REGISTRY: ModelInfo[] = [
  {
    id: 'isnet_fp16',
    name: 'ISNet FP16',
    description: '高精度本地模型，FP16精度，需WebGPU shader-f16支持',
    modelType: 'bria',
    isnetVariant: 'isnet_fp16',
    inputSize: { width: 1024, height: 1024 },
    modelSize: '~84MB',
    loaded: false,
    embedded: true,
  },
  {
    id: 'isnet_quint8',
    name: 'ISNet INT8',
    description: '轻量本地模型，INT8量化，兼容CPU/WASM',
    modelType: 'bria',
    isnetVariant: 'isnet_quint8',
    inputSize: { width: 1024, height: 1024 },
    modelSize: '~42MB',
    loaded: false,
    embedded: true,
  },
];

class LocalMattingService {
  private modelInfo: ModelInfo | null = null;
  private isInitialized = false;
  private inferenceEngine: 'onnx' | 'tflite' | 'openvino' = 'onnx';
  private modelCache = new Map<string, boolean>();
  private webgpuF16Supported: boolean | null = null;
  private resourcesAvailableCache: boolean | null = null;
  private crossOriginIsolatedWarned = false;
  private activePublicPath: string = LOCAL_MODEL_PUBLIC_PATH;

  /**
   * 检测当前浏览器/GPU 是否支持 WebGPU shader-f16 扩展
   * 结果会缓存，避免重复检测
   */
  async checkWebGpuF16Support(): Promise<boolean> {
    if (this.webgpuF16Supported !== null) return this.webgpuF16Supported;
    try {
      if (!navigator.gpu) {
        this.webgpuF16Supported = false;
        return false;
      }
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        this.webgpuF16Supported = false;
        return false;
      }
      this.webgpuF16Supported = adapter.features.has('shader-f16');
      logger.info('[LocalMatting] WebGPU shader-f16 支持: ' + this.webgpuF16Supported);
      return this.webgpuF16Supported;
    } catch {
      this.webgpuF16Supported = false;
      return false;
    }
  }

  /**
   * 根据硬件能力选择最佳模型：f16 支持时用 isnet_fp16，否则用 isnet_quint8
   */
  async selectBestModel(): Promise<string> {
    const f16 = await this.checkWebGpuF16Support();
    return f16 ? 'isnet_fp16' : 'isnet_quint8';
  }

  /**
   * 预检模型资源是否可访问（resources.json + 必需模型文件）
   * 本地路径失败时自动回退到 CDN
   */
  async ensureResourcesAvailable(): Promise<{ ok: boolean; error?: string }> {
    if (this.resourcesAvailableCache === true) return { ok: true };

    const checkPath = async (publicPath: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const response = await fetch(publicPath + 'resources.json', { method: 'GET' });
        if (!response.ok) {
          return { ok: false, error: `HTTP ${response.status}` };
        }
        const data = await response.json().catch(() => null);
        if (!data || typeof data !== 'object') {
          return { ok: false, error: 'resources.json 格式异常' };
        }
        const requiredKeys = [
          '/models/isnet_fp16',
          '/models/isnet_quint8',
          '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
        ];
        const missing = requiredKeys.filter((k) => !data[k]);
        if (missing.length > 0) {
          return { ok: false, error: `资源清单缺失: ${missing.join(', ')}` };
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, error: (error as Error).message };
      }
    };

    const localResult = await checkPath(LOCAL_MODEL_PUBLIC_PATH);
    if (localResult.ok) {
      this.resourcesAvailableCache = true;
      this.activePublicPath = LOCAL_MODEL_PUBLIC_PATH;
      logger.info('[LocalMatting] 资源预检通过 (本地): ' + LOCAL_MODEL_PUBLIC_PATH);
      return { ok: true };
    }

    logger.warn('[LocalMatting] 本地资源不可用 (' + localResult.error + ')，回退到 CDN');
    const cdnResult = await checkPath(CDN_MODEL_PUBLIC_PATH);
    if (cdnResult.ok) {
      this.resourcesAvailableCache = true;
      this.activePublicPath = CDN_MODEL_PUBLIC_PATH;
      logger.info('[LocalMatting] 资源预检通过 (CDN): ' + CDN_MODEL_PUBLIC_PATH);
      return { ok: true };
    }

    return {
      ok: false,
      error: `本地: ${localResult.error}; CDN: ${cdnResult.error}`,
    };
  }

  /**
   * 检测当前页面是否处于 crossOriginIsolated 状态
   * onnxruntime-web 多线程需要 COOP/COEP 头，未启用时会降级为单线程
   */
  private checkCrossOriginIsolated(): boolean {
    return typeof window !== 'undefined' && (window as Window).crossOriginIsolated === true;
  }

  /**
   * 获取当前模型资源路径（供外部诊断用）
   */
  getResourcePath(): string {
    return this.activePublicPath;
  }

  async initialize(
    modelId: string = 'isnet_fp16',
    engine: 'onnx' | 'tflite' | 'openvino' = 'onnx'
  ): Promise<boolean> {
    if (this.isInitialized && this.modelInfo?.id === modelId) {
      return true;
    }

    try {
      this.inferenceEngine = engine;
      this.modelInfo = MODEL_REGISTRY.find((m) => m.id === modelId) || null;

      if (!this.modelInfo) {
        logger.error('[LocalMatting] 模型未找到: ' + modelId);
        return false;
      }

      logger.info('[LocalMatting] 初始化模型: ' + this.modelInfo.name + ', 引擎: ' + engine);

      this.isInitialized = true;
      this.modelInfo.loaded = true;
      logger.info('[LocalMatting] 模型就绪: ' + this.modelInfo.name);
      return true;
    } catch (error) {
      logger.error('[LocalMatting] 模型初始化失败: ' + (error as Error).message);
      return false;
    }
  }

  async removeBackground(
    imageUrl: string,
    options: Partial<LocalMattingOptions> = {},
    onProgress?: (progress: number, message?: string) => void
  ): Promise<MattingResult> {
    const startTime = Date.now();

    onProgress?.(2, '预检模型资源...');

    const resourceCheck = await this.ensureResourcesAvailable();
    if (!resourceCheck.ok) {
      return {
        success: false,
        strategyUsed: 'local-matting',
        error: resourceCheck.error,
        processingTime: Date.now() - startTime,
      };
    }

    const isIsolated = this.checkCrossOriginIsolated();
    if (!isIsolated && !this.crossOriginIsolatedWarned) {
      logger.warn('[LocalMatting] crossOriginIsolated=false，onnxruntime 将使用单线程模式。请在服务器配置 COOP/COEP 头以启用多线程');
      this.crossOriginIsolatedWarned = true;
    }

    // 自动选择最佳模型：f16 支持时用 isnet_fp16，否则用 isnet_quint8
    const bestModel = await this.selectBestModel();
    const modelId = bestModel;

    if (!this.isInitialized || this.modelInfo?.id !== modelId) {
      const ok = await this.initialize(modelId, options.inferenceEngine || 'onnx');
      if (!ok) {
        return {
          success: false,
          strategyUsed: 'local-matting',
          error: '模型初始化失败',
          processingTime: Date.now() - startTime,
        };
      }
    }

    try {
      onProgress?.(5, '加载图像...');
      const img = await this.loadImage(imageUrl);
      if (!img) {
        throw new Error('图像加载失败');
      }

      onProgress?.(10, 'AI 推理中...');

      const modelVariant = this.modelInfo!.isnetVariant;
      const f16Supported = await this.checkWebGpuF16Support();
      const cacheKey = `${modelVariant}_${this.inferenceEngine}`;
      const isCached = this.modelCache.has(cacheKey);

      const createConfig = (device: 'gpu' | 'cpu', overrideModel?: string, publicPath?: string): Record<string, unknown> => ({
        model: overrideModel || modelVariant,
        device,
        publicPath: publicPath || this.activePublicPath,
        output: { format: 'image/png' as const, quality: 0.95 },
        progress: (_key: string, current: number, total: number) => {
          const modelProgress = (current / total) * 100;
          const overallProgress = 10 + modelProgress * 0.6;
          onProgress?.(overallProgress, isCached ? '本地推理中...' : '加载本地模型并推理中...');
        },
      });

      const removeBackgroundWithFallback = async (
        imageUrl: string,
        config: Record<string, unknown>,
      ): Promise<Blob> => {
        try {
          return await removeBackground(imageUrl, config);
        } catch (error) {
          const msg = (error as Error).message || '';
          if (this.activePublicPath !== CDN_MODEL_PUBLIC_PATH && isWasmLoadingError(msg)) {
            logger.warn('[LocalMatting] 本地 WASM 加载失败 (' + msg + ')，切换 CDN 重试');
            this.activePublicPath = CDN_MODEL_PUBLIC_PATH;
            const cdnConfig = { ...config, publicPath: CDN_MODEL_PUBLIC_PATH };
            return await removeBackground(imageUrl, cdnConfig);
          }
          throw error;
        }
      };

      let activeDevice: 'gpu' | 'cpu' = 'gpu';
      let config = createConfig(activeDevice);
      let foregroundBlob: Blob;
      let maskBlob: Blob | null = null;

      if (!f16Supported) {
        // f16 不支持，直接使用 CPU + isnet_quint8
        logger.info('[LocalMatting] WebGPU f16 不支持，使用 CPU + isnet_quint8');
        activeDevice = 'cpu';
        config = createConfig('cpu', 'isnet_quint8');
        onProgress?.(15, '使用 INT8 模型 CPU 推理中...');
        foregroundBlob = await removeBackgroundWithFallback(imageUrl, config);
      } else {
        try {
          foregroundBlob = await removeBackgroundWithFallback(imageUrl, config);
        } catch (gpuError) {
          logger.warn('[LocalMatting] GPU 推理失败，切换 CPU + isnet_quint8: ' + ((gpuError as Error).message || gpuError));
          activeDevice = 'cpu';
          config = createConfig('cpu', 'isnet_quint8');
          onProgress?.(20, 'GPU 不可用，切换 INT8 CPU 推理中...');
          foregroundBlob = await removeBackgroundWithFallback(imageUrl, config);
        }
      }

      this.modelCache.set(cacheKey, true);

      onProgress?.(85, '后处理...');
      const foregroundUrl = URL.createObjectURL(foregroundBlob);
      const fgImg = await this.loadImage(foregroundUrl);
      if (!fgImg) {
        throw new Error('结果图像加载失败');
      }

      const outCanvas = document.createElement('canvas');
      outCanvas.width = fgImg.width;
      outCanvas.height = fgImg.height;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) {
        throw new Error('结果画布创建失败');
      }

      if (options.backgroundColor && options.backgroundColor !== 'transparent') {
        outCtx.fillStyle = options.backgroundColor;
        outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
      }

      // Check if the removal result actually has meaningful alpha variation.
      // If nearly all pixels are opaque, derive alpha from segmentForeground.
      const probeCtx = document.createElement('canvas').getContext('2d');
      let hasTransparentAlpha = false;
      if (probeCtx) {
        probeCtx.canvas.width = fgImg.width;
        probeCtx.canvas.height = fgImg.height;
        probeCtx.drawImage(fgImg, 0, 0);
        const probeData = probeCtx.getImageData(0, 0, fgImg.width, fgImg.height);
        let transparentCount = 0;
        const total = probeData.data.length / 4;
        for (let i = 3; i < probeData.data.length; i += 4) {
          if (probeData.data[i] < 128) transparentCount++;
        }
        hasTransparentAlpha = transparentCount > total * 0.02; // >2% transparent pixels
      }

      if (hasTransparentAlpha) {
        if (options.edgeRefinement && options.edgeRefinement !== 'none') {
          const fgData = this.imageToMaskData(fgImg);
          const refined = this.postprocess(fgData, {
            edgeRefinement: options.edgeRefinement,
            featherRadius: options.featherRadius || 1,
            decontaminateColors: options.decontaminateColors ?? true,
          });
          if (options.backgroundColor && options.backgroundColor !== 'transparent') {
            const refinedCanvas = document.createElement('canvas');
            refinedCanvas.width = refined.width;
            refinedCanvas.height = refined.height;
            const refinedCtx = refinedCanvas.getContext('2d');
            if (!refinedCtx) throw new Error('边缘精化画布创建失败');
            refinedCtx.putImageData(refined, 0, 0);
            outCtx.drawImage(refinedCanvas, 0, 0);
          } else {
            outCtx.putImageData(refined, 0, 0);
          }
        } else {
          outCtx.drawImage(fgImg, 0, 0);
        }
      } else {
        logger.warn('[LocalMatting] 前景输出缺少透明区域，尝试使用蒙版合成透明 PNG');
        onProgress?.(90, '生成透明蒙版...');
        maskBlob = await segmentForeground(imageUrl, { ...config, publicPath: this.activePublicPath });
        const maskUrl = URL.createObjectURL(maskBlob);
        const maskImg = await this.loadImage(maskUrl);
        URL.revokeObjectURL(maskUrl);
        if (!maskImg) {
          throw new Error('蒙版图像加载失败');
        }

        const composited = this.composeTransparentForeground(img, maskImg, {
          edgeRefinement: options.edgeRefinement || 'medium',
          featherRadius: options.featherRadius || 1,
        });
        outCtx.putImageData(composited, 0, 0);
      }
      const finalUrl = outCanvas.toDataURL('image/png');

      const finalMaskUrl = finalUrl;
      URL.revokeObjectURL(foregroundUrl);

      const processingTime = Date.now() - startTime;
      onProgress?.(100, '完成');

      logger.info('[LocalMatting] 抠图完成: ' + this.modelInfo?.name + ', 耗时: ' + processingTime + 'ms');

      return {
        success: true,
        imageUrl: finalUrl,
        maskUrl: finalMaskUrl,
        strategyUsed: `${this.modelInfo?.name} (${this.inferenceEngine}/${activeDevice})`,
        confidence: 0.95,
        processingTime,
      };
    } catch (error) {
      const rawMsg = (error as Error).message || '抠图失败';
      let classifiedError = rawMsg;

      const lowerMsg = rawMsg.toLowerCase();
      if (lowerMsg.includes('failed to fetch') || lowerMsg.includes('network') || lowerMsg.includes('load failed')) {
        classifiedError = `模型文件下载失败: ${rawMsg}。本地与 CDN 均不可用，请检查网络连接`;
      } else if (lowerMsg.includes('webgpu') || lowerMsg.includes('gpu')) {
        classifiedError = `GPU 推理失败: ${rawMsg}。建议刷新重试，将自动降级 CPU 推理`;
      } else if (lowerMsg.includes('onnx') || lowerMsg.includes('session') || lowerMsg.includes('inference')) {
        classifiedError = `模型推理失败: ${rawMsg}。本地与 CDN 均不可用，可能是浏览器版本不兼容`;
      } else if (lowerMsg.includes('wasm') || lowerMsg.includes('simd') || lowerMsg.includes('dynamically imported module') || lowerMsg.includes('blob:')) {
        classifiedError = `WASM 运行时不可用: ${rawMsg}。本地与 CDN 均不可用，请使用支持 SIMD 的现代浏览器 (Chrome 91+/Edge 91+/Firefox 89+)`;
      }

      logger.error('[LocalMatting] 抠图失败: ' + classifiedError);
      return {
        success: false,
        strategyUsed: this.modelInfo?.name || 'local-matting',
        error: classifiedError,
        processingTime: Date.now() - startTime,
      };
    }
  }

  private imageToMaskData(img: HTMLImageElement): ImageData {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  private composeTransparentForeground(
    source: HTMLImageElement,
    mask: HTMLImageElement,
    options: { edgeRefinement: 'none' | 'light' | 'medium' | 'strong'; featherRadius: number }
  ): ImageData {
    const width = source.width;
    const height = source.height;

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) throw new Error('源图画布创建失败');
    sourceCtx.drawImage(source, 0, 0, width, height);
    const sourceData = sourceCtx.getImageData(0, 0, width, height);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) throw new Error('蒙版画布创建失败');
    maskCtx.drawImage(mask, 0, 0, width, height);
    const maskData = maskCtx.getImageData(0, 0, width, height);

    const out = new ImageData(new Uint8ClampedArray(sourceData.data), width, height);
    for (let i = 0; i < out.data.length; i += 4) {
      const r = maskData.data[i];
      const g = maskData.data[i + 1];
      const b = maskData.data[i + 2];
      const a = maskData.data[i + 3];
      out.data[i + 3] = Math.round(((r + g + b) / 3) * (a / 255));
    }

    if (options.edgeRefinement === 'none') return out;
    return this.gaussianBlurAlpha(out, options.featherRadius);
  }

  private loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  private postprocess(
    mask: ImageData,
    options: { edgeRefinement: string; featherRadius: number; decontaminateColors: boolean }
  ): ImageData {
    let result = mask;

    if (options.edgeRefinement !== 'none') {
      const featherStrength: Record<string, number> = {
        light: 1,
        medium: 2,
        strong: 4,
      };
      const strength = featherStrength[options.edgeRefinement] || 2;
      result = this.gaussianBlurAlpha(result, strength * options.featherRadius);
    }

    return result;
  }

  private gaussianBlurAlpha(imageData: ImageData, radius: number): ImageData {
    const w = imageData.width;
    const h = imageData.height;
    const src = imageData.data;
    const dst = new Uint8ClampedArray(src.length);

    const kernelSize = Math.ceil(radius * 2) + 1;
    const kernel = new Float32Array(kernelSize);
    const sigma = radius / 2;
    let sum = 0;
    for (let i = 0; i < kernelSize; i++) {
      const x = i - Math.floor(kernelSize / 2);
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      sum += kernel[i];
    }
    for (let i = 0; i < kernelSize; i++) kernel[i] /= sum;

    const temp = new Uint8ClampedArray(src.length);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let val = 0;
        for (let k = 0; k < kernelSize; k++) {
          const nx = Math.min(w - 1, Math.max(0, x + k - Math.floor(kernelSize / 2)));
          val += src[(y * w + nx) * 4 + 3] * kernel[k];
        }
        const idx = (y * w + x) * 4;
        temp[idx] = src[idx];
        temp[idx + 1] = src[idx + 1];
        temp[idx + 2] = src[idx + 2];
        temp[idx + 3] = Math.round(val);
      }
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let val = 0;
        for (let k = 0; k < kernelSize; k++) {
          const ny = Math.min(h - 1, Math.max(0, y + k - Math.floor(kernelSize / 2)));
          val += temp[(ny * w + x) * 4 + 3] * kernel[k];
        }
        const idx = (y * w + x) * 4;
        dst[idx] = temp[idx];
        dst[idx + 1] = temp[idx + 1];
        dst[idx + 2] = temp[idx + 2];
        dst[idx + 3] = Math.round(val);
      }
    }

    return new ImageData(dst, w, h);
  }

  getAvailableModels(): ModelInfo[] {
    return MODEL_REGISTRY;
  }

  getCurrentModel(): ModelInfo | null {
    return this.modelInfo;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  isEmbedded(): boolean {
    return this.modelInfo?.embedded ?? false;
  }

  async checkLocalModelsAvailable(): Promise<boolean> {
    const result = await this.ensureResourcesAvailable();
    return result.ok;
  }

  dispose(): void {
    this.modelInfo = null;
    this.isInitialized = false;
    this.modelCache.clear();
    this.webgpuF16Supported = null;
    this.resourcesAvailableCache = null;
    this.crossOriginIsolatedWarned = false;
    logger.info('[LocalMatting] 服务已释放');
  }
}

export const localMattingService = new LocalMattingService();
