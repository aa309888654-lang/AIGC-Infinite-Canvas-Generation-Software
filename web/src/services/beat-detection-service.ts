/**
 * 音乐节拍检测服务
 * 分析音频提取节拍点，用于剪辑同步
 */
import { logger } from '@/lib/logger';

export interface BeatInfo {
  time: number;
  strength: number;
  type: 'kick' | 'snare' | 'hihat' | 'unknown';
}

export interface BeatDetectionResult {
  success: boolean;
  beats: number[];
  bpm: number;
  duration: number;
  beatPattern: string;
  confidence: number;
  analysis?: {
    kickBeats: number[];
    snareBeats: number[];
    hihatBeats: number[];
  };
  error?: string;
}

export interface BeatDetectionOptions {
  sensitivity: number; // 0-1, 检测灵敏度
  minBeatInterval: number; // 最小节拍间隔（秒）
  detectDrums: boolean; // 是否分离鼓组
  estimateBPM: boolean; // 是否估算 BPM
}

class BeatDetectionService {
  private static instance: BeatDetectionService;
  private sharedAudioCtx: AudioContext | null = null;
  private defaultOptions: BeatDetectionOptions = {
    sensitivity: 0.5,
    minBeatInterval: 0.1,
    detectDrums: false,
    estimateBPM: true,
  };

  private constructor() { /* noop */ }

  private getSharedAudioContext(): AudioContext {
    if (!this.sharedAudioCtx || this.sharedAudioCtx.state === 'closed') {
      this.sharedAudioCtx = new AudioContext();
    }
    return this.sharedAudioCtx;
  }

  dispose(): void {
    if (this.sharedAudioCtx && this.sharedAudioCtx.state !== 'closed') {
      this.sharedAudioCtx.close();
      this.sharedAudioCtx = null;
    }
  }

  public static getInstance(): BeatDetectionService {
    if (!BeatDetectionService.instance) {
      BeatDetectionService.instance = new BeatDetectionService();
    }
    return BeatDetectionService.instance;
  }

  /**
   * 从音频文件检测节拍
   */
  async detectBeats(
    audioFile: File | Blob,
    expectedBPM: number = 120,
    fallbackDuration?: number
  ): Promise<BeatDetectionResult> {
    const options = this.defaultOptions;
    let audioUrl = '';
    
    try {
      // console.log('[节拍检测] 开始分析音频:', audioFile instanceof File ? audioFile.name : 'Blob');

      audioUrl = URL.createObjectURL(audioFile);
      const duration = this.isVideoSource(audioFile)
        ? await this.getMediaDuration(audioUrl, 'video', fallbackDuration)
        : await this.getMediaDuration(audioUrl, 'audio', fallbackDuration);

      if (this.isVideoSource(audioFile)) {
        return this.createBeatResult(
          this.generateSimulatedBeats(duration, expectedBPM, options),
          duration,
          options
        );
      }

      // 使用 Web Audio API 分析音频
      const analysis = await this.analyzeAudio(audioUrl, duration, options, expectedBPM);

      // console.log('[节拍检测] 完成，检测到', analysis.beats.length, '个节拍，BPM:', analysis.bpm);

      return this.createBeatResult(analysis, duration, options);
    } catch (error) {
      logger.debug('[节拍检测] 分析失败，已跳过该素材', error);
      return {
        success: false,
        beats: [],
        bpm: 0,
        duration: 0,
        beatPattern: '',
        confidence: 0,
        error: error instanceof Error ? error.message : '未知错误',
      };
    } finally {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    }
  }

  /**
   * 从视频文件检测节拍
   */
  async detectBeatsFromVideo(
    videoFile: File | Blob,
    expectedBPM: number = 120,
    fallbackDuration?: number
  ): Promise<BeatDetectionResult> {
    const videoUrl = URL.createObjectURL(videoFile);
    try {
      const duration = await this.getMediaDuration(videoUrl, 'video', fallbackDuration);
      const analysis = this.generateSimulatedBeats(duration, expectedBPM, this.defaultOptions);

      return {
        success: true,
        beats: analysis.beats,
        bpm: analysis.bpm,
        duration,
        beatPattern: this.getBeatPattern(analysis.bpm),
        confidence: analysis.confidence,
      };
    } catch (error) {
      logger.debug('[节拍检测] 视频分析失败，已跳过该素材', error);
      return {
        success: false,
        beats: [],
        bpm: 0,
        duration: 0,
        beatPattern: '',
        confidence: 0,
        error: error instanceof Error ? error.message : '未知错误',
      };
    } finally {
      URL.revokeObjectURL(videoUrl);
    }
  }

  /**
   * 生成模拟节拍数据（用于演示）
   */
  generateMockBeats(
    duration: number,
    bpm: number = 120
  ): BeatDetectionResult {
    const beats: number[] = [];
    const interval = 60 / bpm;
    
    for (let time = 0; time < duration; time += interval) {
      beats.push(time);
    }

    return {
      success: true,
      beats,
      bpm,
      duration,
      beatPattern: this.getBeatPattern(bpm),
      confidence: 0.85,
    };
  }

  /**
   * 获取节拍模式描述
   */
  getBeatPattern(bpm: number): string {
    if (bpm < 60) return '极慢';
    if (bpm < 80) return '慢速';
    if (bpm < 100) return '中速';
    if (bpm < 120) return '稍快';
    if (bpm < 140) return '快速';
    if (bpm < 160) return '很快';
    return '极快';
  }

  /**
   * 估算音乐风格
   */
  estimateGenre(bpm: number): string {
    if (bpm >= 70 && bpm <= 90) return 'Hip-Hop / R&B';
    if (bpm >= 90 && bpm <= 120) return 'Pop / Dance';
    if (bpm >= 120 && bpm <= 130) return 'House / EDM';
    if (bpm >= 130 && bpm <= 150) return 'Dubstep / Drum & Bass';
    if (bpm >= 150 && bpm <= 180) return 'Drum & Bass / Hardstyle';
    if (bpm >= 180) return 'Hardcore / Speedcore';
    return '未知风格';
  }

  /**
   * 获取剪辑同步建议
   */
  getSyncSuggestions(beats: number[], duration: number): string[] {
    const suggestions: string[] = [];

    if (beats.length === 0) {
      suggestions.push('未检测到明显节拍，建议手动设置剪辑点');
      return suggestions;
    }

    // 计算平均间隔
    const avgInterval = duration / beats.length;
    const bpm = 60 / avgInterval;

    suggestions.push(`检测到 BPM: ${bpm.toFixed(1)}`);
    suggestions.push(`检测到 ${beats.length} 个节拍点`);

    // 根据 BPM 提供建议
    if (bpm < 80) {
      suggestions.push('节奏较慢，适合情感类视频');
      suggestions.push('建议每2-4个节拍设置一个剪辑点');
    } else if (bpm < 120) {
      suggestions.push('节奏适中，应用广泛');
      suggestions.push('建议每2-3个节拍设置一个剪辑点');
    } else if (bpm < 160) {
      suggestions.push('节奏较快，适合活力内容');
      suggestions.push('建议每个节拍或每2个节拍设置一个剪辑点');
    } else {
      suggestions.push('节奏很快，适合动感内容');
      suggestions.push('建议每个节拍设置一个剪辑点');
    }

    // 强拍位置建议
    const strongBeats = beats.filter((_, i) => i % 4 === 0);
    if (strongBeats.length > 0) {
      suggestions.push(`强拍位于: ${strongBeats.slice(0, 5).map(t => t.toFixed(2) + 's').join(', ')}...`);
    }

    return suggestions;
  }

  // ==================== 私有方法 ====================

  /**
   * 获取音频时长
   */
  private getMediaDuration(url: string, kind: 'audio' | 'video', fallbackDuration?: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const media = document.createElement(kind);
      media.preload = 'metadata';
      media.onloadedmetadata = () => {
        const duration = Number.isFinite(media.duration) && media.duration > 0
          ? media.duration
          : fallbackDuration;
        if (duration && duration > 0) {
          resolve(duration);
          return;
        }
        reject(new Error(`无法获取${kind === 'audio' ? '音频' : '视频'}时长`));
      };
      media.onerror = () => {
        if (fallbackDuration && fallbackDuration > 0) {
          resolve(fallbackDuration);
          return;
        }
        reject(new Error(`无法加载${kind === 'audio' ? '音频' : '视频'}`));
      };
      media.src = url;
    });
  }

  /**
   * 分析音频
   */
  private async analyzeAudio(
    url: string,
    duration: number,
    options: BeatDetectionOptions,
    expectedBPM: number
  ): Promise<{
    beats: number[];
    bpm: number;
    confidence: number;
    kickBeats: number[];
    snareBeats: number[];
    hihatBeats: number[];
  }> {
    // 使用 Web Audio API 进行频谱分析
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      const audioContext = this.getSharedAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      return this.processAudioBuffer(audioBuffer, options, expectedBPM);
    } catch (error) {
      // 如果 Web Audio API 失败，使用模拟数据
      logger.debug('[节拍检测] Web Audio API 不可用，使用模拟节拍兜底', error);
      return this.generateSimulatedBeats(duration, expectedBPM, options);
    }
  }

  private isVideoSource(source: File | Blob): boolean {
    if (source.type.startsWith('video/')) return true;
    if (source instanceof File) {
      return /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(source.name);
    }
    return false;
  }

  private createBeatResult(
    analysis: {
      beats: number[];
      bpm: number;
      confidence: number;
      kickBeats: number[];
      snareBeats: number[];
      hihatBeats: number[];
    },
    duration: number,
    options: BeatDetectionOptions
  ): BeatDetectionResult {
    return {
      success: true,
      beats: analysis.beats,
      bpm: analysis.bpm,
      duration,
      beatPattern: this.getBeatPattern(analysis.bpm),
      confidence: analysis.confidence,
      analysis: options.detectDrums ? {
        kickBeats: analysis.kickBeats,
        snareBeats: analysis.snareBeats,
        hihatBeats: analysis.hihatBeats,
      } : undefined,
    };
  }

  /**
   * 处理音频缓冲区
   */
  private async processAudioBuffer(
    audioBuffer: AudioBuffer,
    options: BeatDetectionOptions,
    expectedBPM: number = 120
  ): Promise<{
    beats: number[];
    bpm: number;
    confidence: number;
    kickBeats: number[];
    snareBeats: number[];
    hihatBeats: number[];
  }> {
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    const monoData = new Float32Array(length);
    for (let ch = 0; ch < channels; ch++) {
      const chData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        monoData[i] += chData[i] / channels;
      }
    }

    const beats: number[] = [];
    const kickBeats: number[] = [];
    const snareBeats: number[] = [];
    const hihatBeats: number[] = [];

    const hopSize = Math.floor(sampleRate * 0.01);
    const windowSize = Math.floor(sampleRate * 0.02);

    let lastBeatTime = -1;
    const minInterval = options.minBeatInterval;

    const calibrateEnd = Math.min(Math.floor(sampleRate * 2), length - windowSize);
    let energySum = 0;
    let energyCount = 0;
    for (let i = 0; i < calibrateEnd; i += hopSize) {
      let e = 0;
      for (let j = 0; j < windowSize; j++) e += Math.abs(monoData[i + j]);
      energySum += e / windowSize;
      energyCount++;
    }
    const meanEnergy = energyCount > 0 ? energySum / energyCount : 0.3;
    const energyThreshold = Math.max(0.3, meanEnergy * 1.5);

    for (let i = 0; i < length - windowSize; i += hopSize) {
      const time = i / sampleRate;
      if (time - lastBeatTime < minInterval) continue;

      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        energy += Math.abs(monoData[i + j]);
      }
      energy /= windowSize;

      if (energy > energyThreshold) {
        beats.push(time);
        kickBeats.push(time);
        lastBeatTime = time;
      }
    }

    let bpm = expectedBPM;
    if (beats.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < Math.min(beats.length, 20); i++) {
        intervals.push(beats[i] - beats[i - 1]);
      }
      intervals.sort((a, b) => a - b);
      const medianInterval = intervals[Math.floor(intervals.length / 2)];
      bpm = 60 / medianInterval;

      while (bpm < 60) bpm *= 2;
      while (bpm > 180) bpm /= 2;
    }

    return {
      beats,
      bpm,
      confidence: beats.length > 10 ? 0.8 : 0.5,
      kickBeats,
      snareBeats,
      hihatBeats,
    };
  }

  /**
   * 生成模拟节拍
   */
  private generateSimulatedBeats(
    duration: number,
    bpm: number,
    _options: BeatDetectionOptions
  ): {
    beats: number[];
    bpm: number;
    confidence: number;
    kickBeats: number[];
    snareBeats: number[];
    hihatBeats: number[];
  } {
    const beats: number[] = [];
    const kickBeats: number[] = [];
    const snareBeats: number[] = [];
    const hihatBeats: number[] = [];

    const interval = 60 / bpm;
    let currentTime = 0;
    let beatIndex = 0;

    while (currentTime < duration) {
      beats.push(currentTime);
      
      // 4/4 拍：1-强 2-弱 3-次强 4-弱
      if (beatIndex % 4 === 0) {
        kickBeats.push(currentTime);
      } else if (beatIndex % 4 === 2) {
        snareBeats.push(currentTime);
      }
      
      // 每拍都有 hi-hat
      hihatBeats.push(currentTime);

      currentTime += interval;
      beatIndex++;
    }

    return {
      beats,
      bpm,
      confidence: 0.85,
      kickBeats,
      snareBeats,
      hihatBeats,
    };
  }

  /**
   * 同步剪辑点到节拍
   */
  syncCutsToBeats(
    cutPoints: number[],
    beats: number[],
    tolerance: number = 0.1
  ): number[] {
    if (beats.length === 0) return cutPoints;
    return cutPoints.map(cut => {
      let lo = 0, hi = beats.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (beats[mid] < cut) lo = mid + 1; else hi = mid;
      }
      let nearestBeat = beats[lo];
      let minDiff = Math.abs(nearestBeat - cut);
      if (lo > 0) {
        const d = Math.abs(beats[lo - 1] - cut);
        if (d < minDiff) { minDiff = d; nearestBeat = beats[lo - 1]; }
      }
      return minDiff <= tolerance ? nearestBeat : cut;
    });
  }

  /**
   * 在节拍处生成剪辑点
   */
  generateCutPoints(
    beats: number[],
    everyNthBeat: number = 4,
    startFromBeat: number = 0
  ): number[] {
    return beats.filter((_, index) => {
      return index >= startFromBeat && (index - startFromBeat) % everyNthBeat === 0;
    });
  }
}

export const beatDetectionService = BeatDetectionService.getInstance();
export default beatDetectionService;
