/**
 * 增强版视频特征分析服务
 * 优化检测准确性：人脸、文字、情感等
 */

import { videoFeatureAnalyzer, VideoAnalysisResult } from './video-feature-analyzer';

export interface EnhancedFrameFeatures {
  timestamp: number;
  motion: number;
  brightness: number;
  contrast: number;
  sharpness: number;
  saturation: number;
  histogram: number[];
  edgeDensity: number;
  faceLikelihood: number;
  textLikelihood: number;
  skinTone: number;
  dominantColor: { r: number; g: number; b: number };
  complexity: number;
  quality: number;
}

export interface EnhancedSegmentFeatures {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  features: EnhancedFrameFeatures[];
  aggregatedMotion: number;
  aggregatedBrightness: number;
  aggregatedContrast: number;
  aggregatedSharpness: number;
  aggregatedSaturation: number;
  faceDetected: boolean;
  faceCount: number;
  faceConfidence: number;
  textDetected: boolean;
  textArea: number;
  textConfidence: number;
  significantMotion: boolean;
  silenceRatio: number;
  speechRatio: number;
  musicDetected: boolean;
  emotion: 'positive' | 'neutral' | 'negative';
  emotionConfidence: number;
  quality: number;
  complexity: number;
  highlights: Array<{
    type: 'face' | 'text' | 'motion' | 'action';
    timestamp: number;
    confidence: number;
  }>;
}

export class EnhancedVideoFeatureAnalyzer {
  private static instance: EnhancedVideoFeatureAnalyzer;

  private constructor() { /* noop */ }

  public static getInstance(): EnhancedVideoFeatureAnalyzer {
    if (!EnhancedVideoFeatureAnalyzer.instance) {
      EnhancedVideoFeatureAnalyzer.instance = new EnhancedVideoFeatureAnalyzer();
    }
    return EnhancedVideoFeatureAnalyzer.instance;
  }

  /**
   * 分析视频文件（增强版）
   */
  async analyzeVideoEnhanced(
    videoFile: File,
    options?: {
      enableFaceDetection?: boolean;
      enableOCR?: boolean;
      enableAudioAnalysis?: boolean;
      confidenceThreshold?: number;
      onProgress?: (progress: number) => void;
    }
  ): Promise<VideoAnalysisResult> {
    const baseResult = await videoFeatureAnalyzer.analyzeVideo(videoFile, {
      enableFaceDetection: options?.enableFaceDetection ?? true,
      enableOCR: options?.enableOCR ?? true,
      enableAudioAnalysis: options?.enableAudioAnalysis ?? true,
      onProgress: options?.onProgress,
    });

    if (!baseResult.success) {
      return baseResult;
    }

    const enhancedSegments = this.enhanceSegments(baseResult, options);

    return {
      ...baseResult,
      segments: enhancedSegments as any,
    };
  }

  /**
   * 增强片段分析
   */
  private enhanceSegments(
    baseResult: VideoAnalysisResult,
    _options?: { confidenceThreshold?: number }
  ): EnhancedSegmentFeatures[] {

    return baseResult.segments.map(segment => {
      const features = this.analyzeFramesEnhanced((segment as any).features);
      const faceResult = this.detectFacesEnhanced(features);
      const textResult = this.detectTextEnhanced(features);
      const emotionResult = this.inferEmotionEnhanced(features);
      const qualityResult = this.assessQuality(features);

      return {
        id: segment.id,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.duration,
        features,
        aggregatedMotion: this.calculateAverage(features.map(f => f.motion)),
        aggregatedBrightness: this.calculateAverage(features.map(f => f.brightness)),
        aggregatedContrast: this.calculateAverage(features.map(f => f.contrast)),
        aggregatedSharpness: this.calculateAverage(features.map(f => f.sharpness)),
        aggregatedSaturation: this.calculateAverage(features.map(f => f.saturation)),
        faceDetected: faceResult.detected,
        faceCount: faceResult.count,
        faceConfidence: faceResult.confidence,
        textDetected: textResult.detected,
        textArea: textResult.area,
        textConfidence: textResult.confidence,
        significantMotion: this.calculateAverage(features.map(f => f.motion)) > 0.3,
        silenceRatio: segment.silenceRatio || 0,
        speechRatio: segment.speechRatio || 0,
        musicDetected: segment.musicDetected || false,
        emotion: emotionResult.emotion,
        emotionConfidence: emotionResult.confidence,
        quality: qualityResult,
        complexity: this.calculateComplexity(features),
        highlights: this.extractHighlights(features, faceResult, textResult),
      };
    });
  }

  /**
   * 增强帧分析
   */
  private analyzeFramesEnhanced(frames: any[]): EnhancedFrameFeatures[] {
    return frames.map(frame => ({
      ...frame,
      faceLikelihood: this.calculateFaceLikelihood(frame),
      textLikelihood: this.calculateTextLikelihood(frame),
      skinTone: this.calculateSkinTone(frame),
      dominantColor: this.calculateDominantColor(frame),
      complexity: this.calculateFrameComplexity(frame),
      quality: this.calculateFrameQuality(frame),
    }));
  }

  /**
   * 计算人脸可能性（增强版）
   * 基于多个特征综合判断
   */
  private calculateFaceLikelihood(frame: any): number {
    const brightness = frame.brightness || 0;
    const contrast = frame.contrast || 0;
    const sharpness = frame.sharpness || 0;
    const edgeDensity = frame.edgeDensity || 0;
    const saturation = frame.saturation || 0;

    let likelihood = 0;

    // 理想的人脸区域通常有适中的亮度
    const brightnessScore = 1 - Math.abs(brightness - 0.5) * 2;

    // 较高的锐度和边缘密度表明可能有人脸
    const sharpnessScore = sharpness * 0.4;

    // 中等对比度和饱和度对人脸有利
    const contrastScore = contrast * 0.3 * (1 - Math.abs(saturation - 0.4) * 2);

    // 边缘密度适中（太多边缘可能是噪声，太少可能是平滑背景）
    const edgeScore = Math.min(1, edgeDensity * 10) * (1 - Math.min(1, Math.abs(edgeDensity - 0.15) * 5));

    likelihood = (brightnessScore * 0.3 + sharpnessScore + contrastScore + edgeScore * 0.2);

    return Math.min(1, Math.max(0, likelihood));
  }

  /**
   * 增强人脸检测
   */
  private detectFacesEnhanced(features: EnhancedFrameFeatures[]): {
    detected: boolean;
    count: number;
    confidence: number;
  } {
    const likelihoods = features.map(f => f.faceLikelihood);
    const avgLikelihood = this.calculateAverage(likelihoods);
    const maxLikelihood = Math.max(...likelihoods);
    const highLikelihoodCount = likelihoods.filter(l => l > 0.7).length;

    const detected = avgLikelihood > 0.5 || maxLikelihood > 0.8;
    const count = detected ? Math.min(3, Math.floor(maxLikelihood * 3 + highLikelihoodCount * 0.5)) : 0;
    const confidence = detected ? avgLikelihood * 0.7 + maxLikelihood * 0.3 : avgLikelihood;

    return { detected, count, confidence };
  }

  /**
   * 计算文字可能性（增强版）
   */
  private calculateTextLikelihood(frame: any): number {
    const edgeDensity = frame.edgeDensity || 0;
    const contrast = frame.contrast || 0;
    const sharpness = frame.sharpness || 0;
    const brightness = frame.brightness || 0;

    let likelihood = 0;

    // 文字通常有高边缘密度
    const edgeScore = Math.min(1, edgeDensity * 8);

    // 高对比度对文字识别有利
    const contrastScore = contrast;

    // 清晰的边缘（高锐度）对文字有利
    const sharpnessScore = sharpness * 0.5;

    // 中等亮度对文字有利（太暗或太亮都不好）
    const brightnessScore = 1 - Math.abs(brightness - 0.5) * 2;

    likelihood = edgeScore * 0.4 + contrastScore * 0.3 + sharpnessScore * 0.2 + brightnessScore * 0.1;

    return Math.min(1, Math.max(0, likelihood));
  }

  /**
   * 增强文字检测
   */
  private detectTextEnhanced(features: EnhancedFrameFeatures[]): {
    detected: boolean;
    area: number;
    confidence: number;
  } {
    const likelihoods = features.map(f => f.textLikelihood);
    const avgLikelihood = this.calculateAverage(likelihoods);
    const maxLikelihood = Math.max(...likelihoods);
    const stableHigh = likelihoods.filter(l => l > 0.6).length / likelihoods.length;

    const detected = avgLikelihood > 0.4 || (maxLikelihood > 0.7 && stableHigh > 0.5);
    const area = detected ? avgLikelihood * 0.5 + maxLikelihood * 0.5 : 0;
    const confidence = detected ? avgLikelihood * 0.6 + maxLikelihood * 0.4 : avgLikelihood;

    return { detected, area: Math.min(1, area), confidence };
  }

  /**
   * 计算肤色比例
   */
  private calculateSkinTone(frame: any): number {
    // 基于亮度和饱和度估算肤色可能性
    const brightness = frame.brightness || 0;
    const saturation = frame.saturation || 0;

    // 肤色通常在中等亮度、中低饱和度范围
    const brightnessScore = 1 - Math.abs(brightness - 0.6) * 2;
    const saturationScore = 1 - saturation * 2;

    return brightnessScore * 0.6 + saturationScore * 0.4;
  }

  /**
   * 计算主色调
   */
  private calculateDominantColor(frame: any): { r: number; g: number; b: number } {
    const brightness = frame.brightness || 0.5;
    const saturation = frame.saturation || 0;

    // 估算 RGB 值
    const value = brightness * 255;
    const s = saturation;

    return {
      r: Math.round(value * (1 - s * 0.3)),
      g: Math.round(value * (1 - s * 0.1)),
      b: Math.round(value * (1 - s * 0.5)),
    };
  }

  /**
   * 计算帧复杂度
   */
  private calculateFrameComplexity(frame: any): number {
    const edgeDensity = frame.edgeDensity || 0;
    const contrast = frame.contrast || 0;
    const motion = frame.motion || 0;

    return (edgeDensity * 0.4 + contrast * 0.3 + motion * 0.3);
  }

  /**
   * 计算帧质量
   */
  private calculateFrameQuality(frame: any): number {
    const brightness = frame.brightness || 0;
    const contrast = frame.contrast || 0;
    const sharpness = frame.sharpness || 0;

    // 理想的质量：亮度适中、对比度适中、锐度高
    const brightnessScore = 1 - Math.abs(brightness - 0.5) * 2;
    const contrastScore = contrast > 0.3 && contrast < 0.8 ? 1 : contrast * 0.5;

    return (brightnessScore * 0.3 + contrastScore * 0.3 + sharpness * 0.4);
  }

  /**
   * 计算片段复杂度
   */
  private calculateComplexity(features: EnhancedFrameFeatures[]): number {
    if (features.length === 0) return 0;

    const complexities = features.map(f => f.complexity);
    return this.calculateAverage(complexities);
  }

  /**
   * 增强情感推断
   */
  private inferEmotionEnhanced(features: EnhancedFrameFeatures[]): {
    emotion: 'positive' | 'neutral' | 'negative';
    confidence: number;
  } {
    const brightness = this.calculateAverage(features.map(f => f.brightness));
    const saturation = this.calculateAverage(features.map(f => f.saturation));
    const motion = this.calculateAverage(features.map(f => f.motion));
    const contrast = this.calculateAverage(features.map(f => f.contrast));

    let score = 0;
    const reasons: string[] = [];

    // 亮度：明亮通常与积极情绪相关
    if (brightness > 0.5) {
      score += (brightness - 0.5) * 2;
      reasons.push('bright');
    } else {
      score -= (0.5 - brightness) * 2;
      reasons.push('dark');
    }

    // 饱和度：高饱和度通常更情绪化
    if (saturation > 0.4) {
      score += (saturation - 0.4) * 2;
      reasons.push('vibrant');
    } else {
      score -= (0.4 - saturation) * 1.5;
      reasons.push('muted');
    }

    // 运动：适度的运动表示活力
    if (motion > 0.2 && motion < 0.6) {
      score += 0.5;
      reasons.push('active');
    } else if (motion > 0.6) {
      score += 0.2;
      reasons.push('dynamic');
    } else {
      score -= 0.3;
      reasons.push('still');
    }

    // 对比度：高对比度更引人注目
    if (contrast > 0.4) {
      score += 0.3;
      reasons.push('high_contrast');
    }

    // 归一化到 -1 到 1 之间
    const normalizedScore = Math.max(-1, Math.min(1, score / 3));

    let emotion: 'positive' | 'neutral' | 'negative';
    let confidence: number;

    if (normalizedScore > 0.3) {
      emotion = 'positive';
      confidence = normalizedScore;
    } else if (normalizedScore < -0.3) {
      emotion = 'negative';
      confidence = -normalizedScore;
    } else {
      emotion = 'neutral';
      confidence = 1 - Math.abs(normalizedScore) / 0.3;
    }

    return { emotion, confidence: Math.min(1, confidence) };
  }

  /**
   * 评估质量
   */
  private assessQuality(features: EnhancedFrameFeatures[]): number {
    if (features.length === 0) return 0;

    const qualities = features.map(f => f.quality);
    const avgQuality = this.calculateAverage(qualities);
    const minQuality = Math.min(...qualities);

    // 质量 = 平均质量 * 0.7 + 最低质量 * 0.3
    return avgQuality * 0.7 + minQuality * 0.3;
  }

  /**
   * 提取高光片段
   */
  private extractHighlights(
    features: EnhancedFrameFeatures[],
    _faceResult: { detected: boolean; count: number; confidence: number },
    _textResult: { detected: boolean; area: number; confidence: number }
  ): Array<{ type: 'face' | 'text' | 'motion' | 'action'; timestamp: number; confidence: number }> {
    const highlights: Array<{ type: 'face' | 'text' | 'motion' | 'action'; timestamp: number; confidence: number }> = [];

    features.forEach((frame, index) => {
      const timestamp = frame.timestamp || index * 0.5;

      // 人脸高光
      if (frame.faceLikelihood > 0.8) {
        highlights.push({
          type: 'face',
          timestamp,
          confidence: frame.faceLikelihood,
        });
      }

      // 文字高光
      if (frame.textLikelihood > 0.7) {
        highlights.push({
          type: 'text',
          timestamp,
          confidence: frame.textLikelihood,
        });
      }

      // 运动高光
      if (frame.motion > 0.7) {
        highlights.push({
          type: 'motion',
          timestamp,
          confidence: frame.motion,
        });
      }

      // 动作高光（高运动 + 高锐度）
      if (frame.motion > 0.6 && frame.sharpness > 0.7) {
        highlights.push({
          type: 'action',
          timestamp,
          confidence: (frame.motion + frame.sharpness) / 2,
        });
      }
    });

    return highlights.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * 生成分析报告
   */
  generateAnalysisReport(segments: EnhancedSegmentFeatures[]): {
    totalSegments: number;
    avgDuration: number;
    faceCount: number;
    textCount: number;
    avgQuality: number;
    emotionDistribution: Record<string, number>;
    highlightCount: number;
    recommendations: string[];
  } {
    const emotionDistribution: Record<string, number> = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    let highlightCount = 0;
    let totalQuality = 0;
    let totalDuration = 0;

    segments.forEach(segment => {
      emotionDistribution[segment.emotion]++;
      highlightCount += segment.highlights.length;
      totalQuality += segment.quality;
      totalDuration += segment.duration;
    });

    const recommendations: string[] = [];

    if (emotionDistribution.positive > segments.length * 0.6) {
      recommendations.push('视频整体情绪积极，适合分享和推广');
    }

    if (highlightCount > segments.length) {
      recommendations.push('视频包含多个精彩片段，建议进行智能剪辑');
    }

    const avgQuality = totalQuality / segments.length;
    if (avgQuality > 0.7) {
      recommendations.push('视频质量较高，可以直接使用');
    } else if (avgQuality < 0.5) {
      recommendations.push('视频质量较低，建议进行降噪和增强处理');
    }

    if (segments.some(s => s.faceCount > 1)) {
      recommendations.push('检测到多人场景，可以添加群组镜头效果');
    }

    return {
      totalSegments: segments.length,
      avgDuration: totalDuration / segments.length,
      faceCount: segments.reduce((sum, s) => sum + s.faceCount, 0),
      textCount: segments.filter(s => s.textDetected).length,
      avgQuality,
      emotionDistribution,
      highlightCount,
      recommendations,
    };
  }
}

export const enhancedVideoFeatureAnalyzer = EnhancedVideoFeatureAnalyzer.getInstance();
export default enhancedVideoFeatureAnalyzer;

class TestHelper {
  private analyzer = EnhancedVideoFeatureAnalyzer.getInstance();

  calculateFaceLikelihood(frame: any) {
    return this.analyzer['calculateFaceLikelihood'](frame);
  }

  detectFacesEnhanced(features: any[]) {
    return this.analyzer['detectFacesEnhanced'](features);
  }

  calculateTextLikelihood(frame: any) {
    return this.analyzer['calculateTextLikelihood'](frame);
  }

  detectTextEnhanced(features: any[]) {
    return this.analyzer['detectTextEnhanced'](features);
  }

  inferEmotionEnhanced(features: any[]) {
    return this.analyzer['inferEmotionEnhanced'](features);
  }

  extractHighlights(features: any[], faceResult: any, textResult: any) {
    return this.analyzer['extractHighlights'](features, faceResult, textResult);
  }

  generateAnalysisReport(segments: any[]) {
    return this.analyzer['generateAnalysisReport'](segments);
  }

  calculateAverage(values: number[]) {
    return this.analyzer['calculateAverage'](values);
  }
}

export const testHelper = new TestHelper();
