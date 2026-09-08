import * as ort from 'onnxruntime-web';

const logger = {
  info: (...args: unknown[]) => console.log('[BiRefNet]', ...args),
  warn: (...args: unknown[]) => console.warn('[BiRefNet]', ...args),
  error: (...args: unknown[]) => console.error('[BiRefNet]', ...args),
};

export const LOCAL_BIREFNET_MODEL_URL = '/models/matting/birefnet/onnx/model_fp16.onnx';
export const LOCAL_ONNX_WASM_PATH = '/models/matting/onnxruntime-web/';
const MODEL_URL = LOCAL_BIREFNET_MODEL_URL;
const INPUT_SIZE = 1024;
const IMAGE_MEAN = [0.485, 0.456, 0.406];
const IMAGE_STD = [0.229, 0.224, 0.225];

interface BiRefNetResult {
  success: boolean;
  imageUrl?: string;
  maskUrl?: string;
  maskAlpha?: Uint8Array;
  processingTime?: number;
  timing?: { preprocess: number; inference: number; postprocess: number; composite: number };
  executionProvider?: string;
  error?: string;
}

type ProgressCallback = (progress: number, message?: string) => void;

class BiRefNetMattingService {
  private session: ort.InferenceSession | null = null;
  private loading = false;
  private loaded = false;
  private executionProvider: 'webgpu' | 'wasm' = 'wasm';
  private preprocessBuffer: Float32Array | null = null;
  private guideCanvas: HTMLCanvasElement | null = null;
  private guideCtx: CanvasRenderingContext2D | null = null;

  getLocalExecutionPolicy() {
    return {
      modelUrl: LOCAL_BIREFNET_MODEL_URL,
      wasmRuntimePath: LOCAL_ONNX_WASM_PATH,
      executionProvider: 'wasm' as const,
      allowRemoteFallback: false,
    };
  }

  private configureWasmRuntime(): void {
    const origin = typeof globalThis.location?.origin === 'string'
      ? globalThis.location.origin
      : '';
    ort.env.wasm.wasmPaths = origin
      ? new URL(LOCAL_ONNX_WASM_PATH, origin).href
      : LOCAL_ONNX_WASM_PATH;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const resp = await fetch(MODEL_URL, { method: 'HEAD' });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async detectExecutionProvider(): Promise<'webgpu' | 'wasm'> {
    // Firefox can leave session creation pending indefinitely for this 489 MB
    // model. The bundled WASM runtime is the stable production backend.
    this.executionProvider = 'wasm';
    logger.info('Using WASM execution provider');
    return 'wasm';
  }

  async preload(onProgress?: ProgressCallback): Promise<void> {
    if (this.loaded || this.loading) return;
    this.loading = true;
    try {
      onProgress?.(0, '检测推理后端...');
      await this.detectExecutionProvider();

      onProgress?.(10, '加载 BiRefNet 模型...');
      const ep = this.executionProvider === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];

      this.configureWasmRuntime();
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

      this.session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ep as ort.ExecutionProviderName[],
        graphOptimizationLevel: 'all',
      });

      this.loaded = true;
      onProgress?.(100, 'BiRefNet 模型加载完成');
      logger.info('Model loaded, EP:', this.executionProvider);
    } catch (error) {
      this.loading = false;
      throw error;
    }
  }

  async removeBackground(
    imageUrl: string,
    options?: {
      backgroundColor?: string;
    },
    onProgress?: ProgressCallback
  ): Promise<BiRefNetResult> {
    const startTime = Date.now();
    const timing = { preprocess: 0, inference: 0, postprocess: 0, composite: 0 };

    try {
      if (!this.loaded) {
        await this.preload(onProgress);
      }

      onProgress?.(20, '加载图片...');
      const img = await this.loadImage(imageUrl);
      if (!img) throw new Error('无法加载图片');

      const origW = img.naturalWidth;
      const origH = img.naturalHeight;

      const t0 = Date.now();
      onProgress?.(30, '预处理...');
      const inputTensor = this.preprocess(img);
      timing.preprocess = Date.now() - t0;

      const t1 = Date.now();
      onProgress?.(40, 'BiRefNet 推理中 (' + this.executionProvider.toUpperCase() + ')...');
      const feeds: Record<string, ort.Tensor> = {};
      const inputNames = this.session!.inputNames;
      feeds[inputNames[0]] = inputTensor;

      const results = await this.session!.run(feeds);
      const outputTensor = results[this.session!.outputNames[0]];
      const maskData = outputTensor.data as Float32Array;
      timing.inference = Date.now() - t1;

      const t2 = Date.now();
      onProgress?.(70, '后处理（引导滤波）...');
      const guide = this.extractGuide(img, INPUT_SIZE, INPUT_SIZE);
      const alphaMask = this.postprocess(maskData, INPUT_SIZE, INPUT_SIZE, origW, origH, guide);
      timing.postprocess = Date.now() - t2;

      const t3 = Date.now();
      onProgress?.(80, '合成结果...');
      const resultUrl = this.compositeImage(
        imageUrl,
        alphaMask,
        origW,
        origH,
        options?.backgroundColor
      );
      timing.composite = Date.now() - t3;

      let maskUrl: string | undefined;
      try {
        maskUrl = this.maskToDataUrl(alphaMask, origW, origH);
      } catch {
        // Mask previews are optional; keep the cutout result when encoding fails.
      }

      onProgress?.(100, '完成');
      return {
        success: true,
        imageUrl: resultUrl,
        maskUrl,
        maskAlpha: alphaMask,
        processingTime: Date.now() - startTime,
        timing,
        executionProvider: this.executionProvider,
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : (() => {
              try {
                return JSON.stringify(error);
              } catch {
                return String(error);
              }
            })();
      logger.error('Background removal failed:', error);
      return {
        success: false,
        error: errorMessage || 'BiRefNet 推理失败（未知错误）',
        processingTime: Date.now() - startTime,
        timing,
      };
    }
  }

  private preprocess(img: HTMLImageElement): ort.Tensor {
    if (!this.guideCanvas) {
      this.guideCanvas = document.createElement('canvas');
      this.guideCtx = this.guideCanvas.getContext('2d', { willReadFrequently: true })!;
    }
    const canvas = this.guideCanvas;
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const ctx = this.guideCtx!;
    ctx.drawImage(img, 0, 0, INPUT_SIZE, INPUT_SIZE);

    const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const pixels = imageData.data;

    if (!this.preprocessBuffer) {
      this.preprocessBuffer = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    }
    const float32Data = this.preprocessBuffer;
    const hw = INPUT_SIZE * INPUT_SIZE;

    for (let i = 0; i < hw; i++) {
      float32Data[i] = (pixels[i * 4] / 255 - IMAGE_MEAN[0]) / IMAGE_STD[0];
      float32Data[i + hw] = (pixels[i * 4 + 1] / 255 - IMAGE_MEAN[1]) / IMAGE_STD[1];
      float32Data[i + 2 * hw] = (pixels[i * 4 + 2] / 255 - IMAGE_MEAN[2]) / IMAGE_STD[2];
    }

    return new ort.Tensor('float32', float32Data.slice(), [1, 3, INPUT_SIZE, INPUT_SIZE]);
  }

  private postprocess(
    rawOutput: Float32Array,
    maskW: number,
    maskH: number,
    origW: number,
    origH: number,
    guide?: Float32Array
  ): Uint8Array {
    const n = maskW * maskH;
    const sigmoid = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      sigmoid[i] = 1 / (1 + Math.exp(-rawOutput[i]));
    }

    let filtered: Float32Array;
    if (guide) {
      filtered = this.guidedFilter(guide, sigmoid, maskW, maskH, 6, 0.001);
    } else {
      filtered = this.boxSmooth(sigmoid, maskW, maskH, 2);
    }

    const upscaled = this.bilinearInterpolate(filtered, maskW, maskH, origW, origH);

    const alpha = new Uint8Array(origW * origH);
    for (let i = 0; i < alpha.length; i++) {
      let v = upscaled[i];
      if (v < 0.03) v = 0;
      else if (v > 0.97) v = 1;
      else {
        v = (v - 0.03) / 0.94;
        v = v * v * (3 - 2 * v);
      }
      alpha[i] = Math.round(v * 255);
    }

    return alpha;
  }

  private extractGuide(img: HTMLImageElement, w: number, h: number): Float32Array {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;
    const guide = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      guide[i] =
        (0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2]) / 255;
    }
    return guide;
  }

  private buildIntegralImage(input: Float32Array, w: number, h: number): Float64Array {
    const wp1 = w + 1;
    const integral = new Float64Array(wp1 * (h + 1));
    for (let y = 1; y <= h; y++) {
      let rowSum = 0;
      for (let x = 1; x <= w; x++) {
        rowSum += input[(y - 1) * w + (x - 1)];
        integral[y * wp1 + x] = rowSum + integral[(y - 1) * wp1 + x];
      }
    }
    return integral;
  }

  private queryIntegral(
    integral: Float64Array,
    w: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): number {
    const wp1 = w + 1;
    return (
      integral[(y1 + 1) * wp1 + (x1 + 1)] -
      integral[y0 * wp1 + (x1 + 1)] -
      integral[(y1 + 1) * wp1 + x0] +
      integral[y0 * wp1 + x0]
    );
  }

  private boxFilter(input: Float32Array, w: number, h: number, radius: number): Float32Array {
    const integral = this.buildIntegralImage(input, w, h);
    const output = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(h - 1, y + radius);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - radius);
        const x1 = Math.min(w - 1, x + radius);
        const count = (y1 - y0 + 1) * (x1 - x0 + 1);
        output[y * w + x] = this.queryIntegral(integral, w, x0, y0, x1, y1) / count;
      }
    }
    return output;
  }

  private boxSmooth(src: Float32Array, w: number, h: number, radius: number): Float32Array {
    return this.boxFilter(src, w, h, radius);
  }

  private guidedFilter(
    guide: Float32Array,
    src: Float32Array,
    w: number,
    h: number,
    radius: number,
    eps: number
  ): Float32Array {
    const n = w * h;
    const meanI = this.boxFilter(guide, w, h, radius);
    const meanP = this.boxFilter(src, w, h, radius);

    const Ip = new Float32Array(n);
    const II = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      Ip[i] = guide[i] * src[i];
      II[i] = guide[i] * guide[i];
    }

    const meanIp = this.boxFilter(Ip, w, h, radius);
    const meanII = this.boxFilter(II, w, h, radius);

    const a = new Float32Array(n);
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const varI = meanII[i] - meanI[i] * meanI[i];
      const covIp = meanIp[i] - meanI[i] * meanP[i];
      a[i] = covIp / (varI + eps);
      b[i] = meanP[i] - a[i] * meanI[i];
    }

    const meanA = this.boxFilter(a, w, h, radius);
    const meanB = this.boxFilter(b, w, h, radius);

    const output = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      output[i] = Math.max(0, Math.min(1, meanA[i] * guide[i] + meanB[i]));
    }
    return output;
  }

  private bilinearInterpolate(
    src: Float32Array,
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number
  ): Float32Array {
    const dst = new Float32Array(dstW * dstH);
    const scaleX = srcW / dstW;
    const scaleY = srcH / dstH;

    for (let y = 0; y < dstH; y++) {
      const sy = y * scaleY;
      const y0 = Math.min(Math.floor(sy), srcH - 2);
      const fy = sy - y0;

      for (let x = 0; x < dstW; x++) {
        const sx = x * scaleX;
        const x0 = Math.min(Math.floor(sx), srcW - 2);
        const fx = sx - x0;

        const v00 = src[y0 * srcW + x0];
        const v10 = src[y0 * srcW + x0 + 1];
        const v01 = src[(y0 + 1) * srcW + x0];
        const v11 = src[(y0 + 1) * srcW + x0 + 1];

        dst[y * dstW + x] =
          v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
      }
    }
    return dst;
  }

  private compositeImage(
    imageUrl: string,
    alpha: Uint8Array,
    w: number,
    h: number,
    backgroundColor?: string
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    if (backgroundColor && backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, w, h);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(img, 0, 0, w, h);
    const imgData = tempCtx.getImageData(0, 0, w, h);

    for (let i = 0; i < alpha.length; i++) {
      imgData.data[i * 4 + 3] = alpha[i];
    }

    if (backgroundColor && backgroundColor !== 'transparent') {
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = w;
      bgCanvas.height = h;
      const bgCtx = bgCanvas.getContext('2d')!;
      bgCtx.fillStyle = backgroundColor;
      bgCtx.fillRect(0, 0, w, h);
      bgCtx.putImageData(imgData, 0, 0);
      return bgCanvas.toDataURL('image/png');
    }

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.putImageData(imgData, 0, 0);
    return outCanvas.toDataURL('image/png');
  }

  private maskToDataUrl(alpha: Uint8Array, w: number, h: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(w, h);
    for (let i = 0; i < alpha.length; i++) {
      imageData.data[i * 4] = alpha[i];
      imageData.data[i * 4 + 1] = alpha[i];
      imageData.data[i * 4 + 2] = alpha[i];
      imageData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
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

  isReady(): boolean {
    return this.loaded;
  }

  getExecutionProvider(): string {
    return this.executionProvider;
  }

  dispose(): void {
    if (this.session) {
      this.session.release();
      this.session = null;
      this.loaded = false;
    }
    this.preprocessBuffer = null;
    this.guideCanvas = null;
    this.guideCtx = null;
  }
}

export const birefnetMattingService = new BiRefNetMattingService();
export type { BiRefNetResult };
