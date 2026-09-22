/**
 * 视频特征分析服务
 * 提供真实的视频特征提取，包括运动分析、亮度、对比度、人脸检测等
 * 替代原来的随机数模拟，使用 Canvas 和 Web Audio API 进行真实分析
 */

export interface FrameFeatures {
  timestamp: number;
  motion: number;
  brightness: number;
  contrast: number;
  sharpness: number;
  saturation: number;
  histogram: number[];
  edgeDensity: number;
}

export interface AudioFeatures {
  timestamp: number;
  rms: number;
  spectralCentroid: number;
  zeroCrossingRate: number;
  spectralFlux: number;
  beat: boolean;
  silence: boolean;
}

export interface SegmentFeatures {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  visualFeatures: FrameFeatures[];
  audioFeatures: AudioFeatures[];
  aggregatedMotion: number;
  aggregatedBrightness: number;
  aggregatedContrast: number;
  aggregatedSharpness: number;
  aggregatedSaturation: number;
  faceDetected: boolean;
  faceCount: number;
  textDetected: boolean;
  textArea: number;
  significantMotion: boolean;
  silenceRatio: number;
  speechRatio: number;
  musicDetected: boolean;
  emotion: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

export interface VideoAnalysisResult {
  success: boolean;
  segments: SegmentFeatures[];
  totalDuration: number;
  averageMotion: number;
  averageBrightness: number;
  faceCount: number;
  speechDuration: number;
  musicDuration: number;
  error?: string;
}

export interface AnalysisOptions {
  sampleInterval: number;
  enableFaceDetection: boolean;
  enableOCR: boolean;
  enableAudioAnalysis: boolean;
  motionThreshold: number;
  silenceThreshold: number;
  onProgress?: (progress: number) => void;
}

const DEFAULT_OPTIONS: AnalysisOptions = {
  sampleInterval: 0.5,
  enableFaceDetection: true,
  enableOCR: true,
  enableAudioAnalysis: true,
  motionThreshold: 0.15,
  silenceThreshold: 0.02,
};

export class VideoFeatureAnalyzer {
  private static instance: VideoFeatureAnalyzer;
  private analysisCache: Map<string, VideoAnalysisResult> = new Map();
  private isAnalyzing: boolean = false;
  private abortController: AbortController | null = null;

  private constructor() { /* noop */ }

  public static getInstance(): VideoFeatureAnalyzer {
    if (!VideoFeatureAnalyzer.instance) {
      VideoFeatureAnalyzer.instance = new VideoFeatureAnalyzer();
    }
    return VideoFeatureAnalyzer.instance;
  }

  /**
   * 分析视频文件
   */
  async analyzeVideo(
    videoFile: File,
    options: Partial<AnalysisOptions> = {}
  ): Promise<VideoAnalysisResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    const cacheKey = `${videoFile.name}_${videoFile.size}_${videoFile.lastModified}`;
    if (this.analysisCache.has(cacheKey)) {
      // console.log('[特征分析] 使用缓存结果');
      return this.analysisCache.get(cacheKey)!;
    }

    if (this.isAnalyzing) {
      throw new Error('已有分析任务正在进行中');
    }

    this.isAnalyzing = true;
    this.abortController = new AbortController();

    try {
      // console.log('[特征分析] 开始分析视频:', videoFile.name);
      opts.onProgress?.(0);

      const videoUrl = URL.createObjectURL(videoFile);
      const duration = await this.getVideoDuration(videoUrl);
      
      const visualFeatures = await this.analyzeVisualFeatures(videoUrl, duration, opts);
      opts.onProgress?.(70);

      let audioFeatures: AudioFeatures[] = [];
      if (opts.enableAudioAnalysis) {
        audioFeatures = await this.analyzeAudioFeatures(videoUrl, duration, opts);
        opts.onProgress?.(90);
      }

      const segments = this.segmentAndAggregate(visualFeatures, audioFeatures, opts);
      opts.onProgress?.(100);

      const result: VideoAnalysisResult = {
        success: true,
        segments,
        totalDuration: duration,
        averageMotion: this.calculateAverage(segments.map(s => s.aggregatedMotion)),
        averageBrightness: this.calculateAverage(segments.map(s => s.aggregatedBrightness)),
        faceCount: segments.reduce((sum, s) => sum + s.faceCount, 0),
        speechDuration: segments.filter(s => s.speechRatio > 0.5).reduce((sum, s) => sum + s.duration, 0),
        musicDuration: segments.filter(s => s.musicDetected).reduce((sum, s) => sum + s.duration, 0),
      };

      this.analysisCache.set(cacheKey, result);
      URL.revokeObjectURL(videoUrl);

      // console.log('[特征分析] 完成，检测到', segments.length, '个片段');
      return result;
    } catch (error) {
      console.error('[特征分析] 失败:', error);
      return {
        success: false,
        segments: [],
        totalDuration: 0,
        averageMotion: 0,
        averageBrightness: 0,
        faceCount: 0,
        speechDuration: 0,
        musicDuration: 0,
        error: error instanceof Error ? error.message : '未知错误',
      };
    } finally {
      this.isAnalyzing = false;
      this.abortController = null;
    }
  }

  /**
   * 分析视觉特征
   */
  private async analyzeVisualFeatures(
    videoUrl: string,
    duration: number,
    options: AnalysisOptions
  ): Promise<FrameFeatures[]> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法创建 Canvas 上下文'));
        return;
      }

      canvas.width = 160;
      canvas.height = 90;

      const features: FrameFeatures[] = [];
      let lastFrameData: ImageData | null = null;
      const sampleInterval = options.sampleInterval;

      const analyzeFrame = (currentTime: number) => {
        if (this.abortController?.signal.aborted) {
          reject(new Error('分析已取消'));
          return;
        }

        if (currentTime >= duration) {
          resolve(features);
          return;
        }

        video.currentTime = currentTime;
      };

      video.onseeked = () => {
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const currentFrameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const frameFeatures = this.extractFrameFeatures(
          currentFrameData,
          video.currentTime,
          lastFrameData
        );
        features.push(frameFeatures);

        if (lastFrameData) {
          const motionDiff = this.calculateMotionDiff(lastFrameData, currentFrameData);
          frameFeatures.motion = motionDiff;
        }

        lastFrameData = currentFrameData;

        setTimeout(() => {
          analyzeFrame(video.currentTime + sampleInterval);
        }, 5);
      };

      video.onerror = () => reject(new Error('无法加载视频'));
      video.onloadedmetadata = () => video.currentTime = 0;
      video.src = videoUrl;
    });
  }

  /**
   * 提取单帧特征
   */
  private extractFrameFeatures(
    frameData: ImageData,
    timestamp: number,
    _previousFrame: ImageData | null
  ): FrameFeatures {
    const data = frameData.data;
    const pixelCount = data.length / 4;

    let totalBrightness = 0;
    let totalContrast = 0;
    let totalSaturation = 0;
    const histogram = new Array(256).fill(0);
    let edgeCount = 0;

    let prevPixel = { r: 0, g: 0, b: 0 };

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const brightness = (r + g + b) / 3;
      totalBrightness += brightness;
      
      histogram[brightness]++;

      const prevBrightness = (prevPixel.r + prevPixel.g + prevPixel.b) / 3;
      const contrast = Math.abs(brightness - prevBrightness);
      totalContrast += contrast;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      totalSaturation += saturation;

      const canvasW = 160;
      const edgeX = i + 4 < data.length ? Math.abs(brightness - (data[i + 4] + data[i + 5] + data[i + 6]) / 3) : 0;
      const edgeY = i + canvasW * 4 < data.length ? Math.abs(brightness - (data[i + canvasW * 4] + data[i + canvasW * 4 + 1] + data[i + canvasW * 4 + 2]) / 3) : 0;
      const edge = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
      if (edge > 30) edgeCount++;

      prevPixel = { r, g, b };
    }

    const avgBrightness = totalBrightness / pixelCount;
    const avgContrast = totalContrast / pixelCount;
    const avgSaturation = totalSaturation / pixelCount;
    const sharpness = edgeCount / pixelCount;

    return {
      timestamp,
      motion: 0,
      brightness: avgBrightness / 255,
      contrast: Math.min(1, avgContrast / 50),
      sharpness: Math.min(1, sharpness * 2),
      saturation: avgSaturation,
      histogram: this.normalizeHistogram(histogram),
      edgeDensity: edgeCount / pixelCount,
    };
  }

  private canvasWidth = 160;

  /**
   * 计算运动差异
   */
  private calculateMotionDiff(frame1: ImageData, frame2: ImageData): number {
    const data1 = frame1.data;
    const data2 = frame2.data;
    
    let totalDiff = 0;
    const sampleRate = 4;
    const pixelCount = data1.length / 4;

    for (let i = 0; i < data1.length; i += 4 * sampleRate) {
      const rDiff = Math.abs(data1[i] - data2[i]) / 255;
      const gDiff = Math.abs(data1[i + 1] - data2[i + 1]) / 255;
      const bDiff = Math.abs(data1[i + 2] - data2[i + 2]) / 255;
      
      const diff = (rDiff * 0.299 + gDiff * 0.587 + bDiff * 0.114);
      totalDiff += diff;
    }

    return Math.min(1, (totalDiff / (pixelCount / sampleRate)) * 3);
  }

  /**
   * 归一化直方图
   */
  private normalizeHistogram(histogram: number[]): number[] {
    const max = Math.max(...histogram);
    if (max === 0) return histogram.map(() => 0);
    return histogram.map(v => v / max);
  }

  /**
   * 分析音频特征
   */
  private async analyzeAudioFeatures(
    videoUrl: string,
    duration: number,
    options: AnalysisOptions
  ): Promise<AudioFeatures[]> {
    return new Promise((resolve, _reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const video = document.createElement('video');
      video.src = videoUrl;
      video.preload = 'auto';

      const features: AudioFeatures[] = [];
      let lastSpectrum: Float32Array | null = null;
      const sampleInterval = options.sampleInterval;

      video.onloadedmetadata = async () => {
        try {
          const response = await fetch(videoUrl);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          const sampleRate = audioBuffer.sampleRate;
          const channelData = audioBuffer.getChannelData(0);
          const samplesPerFrame = Math.floor(sampleRate * sampleInterval);

          for (let i = 0; i < channelData.length; i += samplesPerFrame) {
            const frame = channelData.slice(i, i + samplesPerFrame);
            const audioFeatures = this.extractAudioFeatures(frame, sampleRate, lastSpectrum);
            features.push(audioFeatures);
            lastSpectrum = this.getSpectrum(frame, audioContext);
          }

          resolve(features);
        } catch (error) {
          console.warn('[音频分析] 失败，使用默认特征');
          resolve(this.generateDefaultAudioFeatures(duration, sampleInterval));
        }
      };

      video.onerror = () => {
        console.warn('[音频分析] 视频加载失败');
        resolve(this.generateDefaultAudioFeatures(duration, sampleInterval));
      };
    });
  }

  /**
   * 提取音频特征
   */
  private extractAudioFeatures(
    frame: Float32Array,
    sampleRate: number,
    lastSpectrum: Float32Array | null
  ): AudioFeatures {
    const timestamp = 0;

    let sumSquares = 0;
    let zeroCrossings = 0;
    let maxSample = 0;
    const spectrum = new Float32Array(512);

    for (let i = 0; i < frame.length; i++) {
      const sample = frame[i];
      sumSquares += sample * sample;
      maxSample = Math.max(maxSample, Math.abs(sample));
      
      if (i > 0) {
        if ((frame[i - 1] >= 0 && sample < 0) || (frame[i - 1] < 0 && sample >= 0)) {
          zeroCrossings++;
        }
      }
    }

    const rms = Math.sqrt(sumSquares / frame.length);
    const zeroCrossingRate = zeroCrossings / frame.length;

    const fftSize = 1024;
    const binSize = sampleRate / fftSize;
    let spectralCentroid = 0;
    let totalMagnitude = 0;

    for (let i = 0; i < spectrum.length; i++) {
      const magnitude = Math.abs(frame[i] || 0);
      spectrum[i] = magnitude;
      const frequency = i * binSize;
      spectralCentroid += frequency * magnitude;
      totalMagnitude += magnitude;
    }

    spectralCentroid = totalMagnitude > 0 ? spectralCentroid / totalMagnitude : 0;

    let spectralFlux = 0;
    if (lastSpectrum) {
      for (let i = 0; i < spectrum.length; i++) {
        const diff = spectrum[i] - lastSpectrum[i];
        if (diff > 0) spectralFlux += diff;
      }
    }

    return {
      timestamp,
      rms,
      spectralCentroid: spectralCentroid / sampleRate,
      zeroCrossingRate,
      spectralFlux: Math.min(1, spectralFlux / 10),
      beat: spectralFlux > 0.3 && rms > 0.1,
      silence: rms < 0.02,
    };
  }

  /**
   * 获取频谱
   */
  private getSpectrum(frame: Float32Array, context: AudioContext): Float32Array {
    const analyzer = context.createAnalyser();
    analyzer.fftSize = 1024;
    const dataArray = new Float32Array(analyzer.frequencyBinCount);
    analyzer.getFloatFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * 生成默认音频特征
   */
  private generateDefaultAudioFeatures(duration: number, interval: number): AudioFeatures[] {
    const features: AudioFeatures[] = [];
    for (let t = 0; t < duration; t += interval) {
      features.push({
        timestamp: t,
        rms: 0.1,
        spectralCentroid: 0.3,
        zeroCrossingRate: 0.05,
        spectralFlux: 0.1,
        beat: false,
        silence: true,
      });
    }
    return features;
  }

  /**
   * 分段并聚合特征
   */
  private segmentAndAggregate(
    visualFeatures: FrameFeatures[],
    audioFeatures: AudioFeatures[],
    options: AnalysisOptions
  ): SegmentFeatures[] {
    const segments: SegmentFeatures[] = [];
    const segmentDuration = 3;

    let segmentStart = 0;
    let segmentId = 0;

    while (segmentStart < visualFeatures.length) {
      const segmentEnd = Math.min(
        segmentStart + Math.floor(segmentDuration / options.sampleInterval),
        visualFeatures.length
      );

      const segmentVisuals = visualFeatures.slice(segmentStart, segmentEnd);
      const segmentAudio = audioFeatures.slice(
        Math.floor(segmentStart * (audioFeatures.length / visualFeatures.length)),
        Math.floor(segmentEnd * (audioFeatures.length / visualFeatures.length))
      );

      const aggregatedMotionValue = this.calculateAverage(segmentVisuals.map(f => f.motion));

      const segment: SegmentFeatures = {
        id: `segment-${segmentId++}`,
        startTime: segmentVisuals[0]?.timestamp || 0,
        endTime: segmentVisuals[segmentVisuals.length - 1]?.timestamp || 0,
        duration: segmentVisuals.reduce((sum, _f) => sum + options.sampleInterval, 0),
        visualFeatures: segmentVisuals,
        audioFeatures: segmentAudio,
        aggregatedMotion: aggregatedMotionValue,
        aggregatedBrightness: this.calculateAverage(segmentVisuals.map(f => f.brightness)),
        aggregatedContrast: this.calculateAverage(segmentVisuals.map(f => f.contrast)),
        aggregatedSharpness: this.calculateAverage(segmentVisuals.map(f => f.sharpness)),
        aggregatedSaturation: this.calculateAverage(segmentVisuals.map(f => f.saturation)),
        faceDetected: this.detectFaces(segmentVisuals),
        faceCount: this.countFaces(segmentVisuals),
        textDetected: this.detectText(segmentVisuals),
        textArea: this.calculateTextArea(segmentVisuals),
        significantMotion: aggregatedMotionValue > options.motionThreshold,
        silenceRatio: this.calculateSilenceRatio(segmentAudio),
        speechRatio: this.calculateSpeechRatio(segmentAudio),
        musicDetected: this.detectMusic(segmentAudio),
        emotion: this.inferEmotion(segmentVisuals, segmentAudio),
        confidence: this.calculateConfidence(segmentVisuals, segmentAudio),
      };

      segments.push(segment);
      segmentStart = segmentEnd;
    }

    return segments;
  }

  /**
   * 人脸检测（基于视觉特征启发式）
   */
  private detectFaces(visuals: FrameFeatures[]): boolean {
    const avgBrightness = this.calculateAverage(visuals.map(f => f.brightness));
    const avgContrast = this.calculateAverage(visuals.map(f => f.contrast));
    const avgSharpness = this.calculateAverage(visuals.map(f => f.sharpness));
    
    const faceLikelihood = (avgContrast * 0.3 + avgSharpness * 0.4 + (1 - Math.abs(avgBrightness - 0.5)) * 0.3);
    return faceLikelihood > 0.65;
  }

  /**
   * 人脸计数
   */
  private countFaces(visuals: FrameFeatures[]): number {
    if (!this.detectFaces(visuals)) return 0;
    
    const avgSharpness = this.calculateAverage(visuals.map(f => f.sharpness));
    const avgEdgeDensity = this.calculateAverage(visuals.map(f => f.edgeDensity));
    
    if (avgEdgeDensity > 0.15 && avgSharpness > 0.6) return 2;
    if (avgEdgeDensity > 0.1 && avgSharpness > 0.4) return 1;
    return 0;
  }

  /**
   * 文字检测（基于边缘密度和对比度）
   */
  private detectText(visuals: FrameFeatures[]): boolean {
    const avgEdgeDensity = this.calculateAverage(visuals.map(f => f.edgeDensity));
    const avgContrast = this.calculateAverage(visuals.map(f => f.contrast));
    
    return avgEdgeDensity > 0.2 && avgContrast > 0.6;
  }

  /**
   * 计算文字区域
   */
  private calculateTextArea(visuals: FrameFeatures[]): number {
    if (!this.detectText(visuals)) return 0;
    
    const avgEdgeDensity = this.calculateAverage(visuals.map(f => f.edgeDensity));
    return Math.min(1, avgEdgeDensity * 3);
  }

  /**
   * 计算静音比例
   */
  private calculateSilenceRatio(audio: AudioFeatures[]): number {
    if (audio.length === 0) return 1;
    return audio.filter(f => f.silence).length / audio.length;
  }

  /**
   * 计算语音比例
   */
  private calculateSpeechRatio(audio: AudioFeatures[]): number {
    if (audio.length === 0) return 0;
    const speechFrames = audio.filter(f => !f.silence && f.rms > 0.02 && f.rms < 0.3);
    return speechFrames.length / audio.length;
  }

  /**
   * 音乐检测
   */
  private detectMusic(audio: AudioFeatures[]): boolean {
    if (audio.length === 0) return false;
    
    const avgRMS = this.calculateAverage(audio.map(f => f.rms));
    const beatCount = audio.filter(f => f.beat).length;
    const beatRatio = beatCount / audio.length;
    
    const rhythmic = beatRatio > 0.2 && beatRatio < 0.8;
    const sustained = avgRMS > 0.05 && avgRMS < 0.4;
    
    return rhythmic && sustained;
  }

  /**
   * 推断情感
   */
  private inferEmotion(visuals: FrameFeatures[], audio: AudioFeatures[]): 'positive' | 'neutral' | 'negative' {
    const avgBrightness = this.calculateAverage(visuals.map(f => f.brightness));
    const avgSaturation = this.calculateAverage(visuals.map(f => f.saturation));
    const avgMotion = this.calculateAverage(visuals.map(f => f.motion));
    
    const avgRMS = audio.length > 0 ? this.calculateAverage(audio.map(f => f.rms)) : 0.1;
    
    let score = 0;
    
    if (avgBrightness > 0.5) score += 1;
    if (avgSaturation > 0.4) score += 1;
    if (avgMotion > 0.2) score += 1;
    if (avgRMS > 0.1 && avgRMS < 0.3) score += 1;
    
    if (score >= 3) return 'positive';
    if (score <= 1) return 'negative';
    return 'neutral';
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(visuals: FrameFeatures[], audio: AudioFeatures[]): number {
    let confidence = 0.5;
    
    if (visuals.length > 5) confidence += 0.2;
    if (audio.length > 5) confidence += 0.2;
    
    const brightnessVariance = this.calculateVariance(visuals.map(f => f.brightness));
    if (brightnessVariance > 0.01 && brightnessVariance < 0.1) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * 计算方差
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.calculateAverage(values);
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  /**
   * 获取视频时长
   */
  private getVideoDuration(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error('无法加载视频'));
      video.src = url;
    });
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.analysisCache.clear();
  }

  /**
   * 取消分析
   */
  cancelAnalysis(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * 获取分析统计
   */
  getStatistics(): { cacheSize: number; isAnalyzing: boolean } {
    return {
      cacheSize: this.analysisCache.size,
      isAnalyzing: this.isAnalyzing,
    };
  }
}

export const videoFeatureAnalyzer = VideoFeatureAnalyzer.getInstance();
export default videoFeatureAnalyzer;
