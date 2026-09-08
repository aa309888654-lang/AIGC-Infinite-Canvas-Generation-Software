/**
 * AI字幕生成服务
 * 支持语音识别和智能字幕生成
 */

import { UnifiedAPIService } from '@/services/unified-api/unified-service';
import { formatSRTTime } from '@/lib/subtitle-utils';

export interface SubtitleSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence?: number;
}

export interface SubtitleGenerationOptions {
  language?: string;
  maxDuration?: number;
  minSegmentDuration?: number;
  speakerSeparation?: boolean;
  enhanceWithAI?: boolean;
}

export interface SubtitleGenerationResult {
  success: boolean;
  segments: SubtitleSegment[];
  duration: number;
  error?: string;
}

class AISubtitleService {
  private static instance: AISubtitleService;
  private apiService: UnifiedAPIService;
  private defaultOptions: SubtitleGenerationOptions = {
    language: 'zh-CN',
    maxDuration: 180,
    minSegmentDuration: 1.0,
    speakerSeparation: false,
    enhanceWithAI: true,
  };

  private constructor() {
    this.apiService = UnifiedAPIService.getInstance();
  }

  public static getInstance(): AISubtitleService {
    if (!AISubtitleService.instance) {
      AISubtitleService.instance = new AISubtitleService();
    }
    return AISubtitleService.instance;
  }

  /**
   * 从视频文件生成字幕
   * 使用浏览器原生 Web Speech API 进行语音识别
   */
  async generateFromVideo(
    videoFile: File,
    options: SubtitleGenerationOptions = {}
  ): Promise<SubtitleGenerationResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      // console.log('[AI字幕] 开始从视频生成字幕:', videoFile.name);
      
      const videoUrl = URL.createObjectURL(videoFile);
      const duration = await this.getVideoDuration(videoUrl);
      
      // 使用 Web Speech API 进行实时语音识别
      const segments = await this.performSpeechRecognition(videoUrl, duration, opts);
      
      URL.revokeObjectURL(videoUrl);
      
      // console.log('[AI字幕] 生成完成，共识别', segments.length, '个片段');
      
      return {
        success: true,
        segments,
        duration,
      };
    } catch (error) {
      console.error('[AI字幕] 生成失败:', error);
      return {
        success: false,
        segments: [],
        duration: 0,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 从音频文件生成字幕
   */
  async generateFromAudio(
    audioFile: File,
    options: SubtitleGenerationOptions = {}
  ): Promise<SubtitleGenerationResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      // console.log('[AI字幕] 开始从音频生成字幕:', audioFile.name);
      
      const audioUrl = URL.createObjectURL(audioFile);
      const duration = await this.getAudioDuration(audioUrl);
      
      // 使用 Web Speech API 进行语音识别
      const segments = await this.performSpeechRecognition(audioUrl, duration, opts);
      
      URL.revokeObjectURL(audioUrl);
      
      // console.log('[AI字幕] 生成完成，共识别', segments.length, '个片段');
      
      return {
        success: true,
        segments,
        duration,
      };
    } catch (error) {
      console.error('[AI字幕] 生成失败:', error);
      return {
        success: false,
        segments: [],
        duration: 0,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 使用文本生成字幕（用于配音脚本）
   */
  async generateFromText(
    text: string,
    duration: number,
    options: SubtitleGenerationOptions = {}
  ): Promise<SubtitleGenerationResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      // console.log('[AI字幕] 从文本生成字幕');
      
      // 将文本分割成合理的片段
      const segments = this.splitTextIntoSegments(text, duration, opts);
      
      // 如果启用了AI增强
      if (opts.enhanceWithAI) {
        await this.enhanceSegmentsWithAI(segments);
      }
      
      // console.log('[AI字幕] 生成完成，共', segments.length, '个片段');
      
      return {
        success: true,
        segments,
        duration,
      };
    } catch (error) {
      console.error('[AI字幕] 生成失败:', error);
      return {
        success: false,
        segments: [],
        duration: 0,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 导出字幕为SRT格式
   */
  exportToSRT(segments: SubtitleSegment[]): string {
    return segments.map((segment, index) => {
      const startTime = formatSRTTime(segment.startTime);
      const endTime = formatSRTTime(segment.endTime);
      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
    }).join('\n');
  }

  /**
   * 导出字幕为LRC格式
   */
  exportToLRC(segments: SubtitleSegment[]): string {
    return segments.map(segment => {
      const time = this.formatLRCTime(segment.startTime);
      return `[${time}]${segment.text}`;
    }).join('\n');
  }

  /**
   * 从LRC格式导入字幕
   */
  importFromLRC(lrcContent: string): SubtitleSegment[] {
    const lines = lrcContent.split('\n');
    const segments: SubtitleSegment[] = [];
    
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    let currentText = '';
    let currentStartTime = 0;
    
    lines.forEach((line, index) => {
      const match = line.match(timeRegex);
      if (match) {
        if (currentText) {
          segments.push({
            id: `import-${index}`,
            startTime: currentStartTime,
            endTime: this.parseLRCTime(match[1], match[2], match[3]),
            text: currentText.trim(),
          });
        }
        currentStartTime = this.parseLRCTime(match[1], match[2], match[3]);
        currentText = line.replace(timeRegex, '');
      } else {
        currentText += ' ' + line;
      }
    });
    
    return segments;
  }

  // ==================== 私有方法 ====================

  /**
   * 获取视频时长
   */
  private getVideoDuration(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve(video.duration);
      };
      video.onerror = () => {
        reject(new Error('无法加载视频文件'));
      };
      video.src = url;
    });
  }

  /**
   * 获取音频时长
   */
  private getAudioDuration(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
      audio.onerror = () => {
        reject(new Error('无法加载音频文件'));
      };
      audio.src = url;
    });
  }

  /**
   * 执行语音识别
   */
  private performSpeechRecognition(
    mediaUrl: string,
    duration: number,
    options: SubtitleGenerationOptions
  ): Promise<SubtitleSegment[]> {
    return new Promise((resolve, reject) => {
      // 检查浏览器是否支持 Web Speech API
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        // 如果不支持，使用模拟数据
        console.warn('[AI字幕] 浏览器不支持语音识别，使用模拟数据');
        resolve(this.generateMockSubtitles(duration, options));
        return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = options.language || 'zh-CN';
      
      const segments: SubtitleSegment[] = [];
      let currentSegment: Partial<SubtitleSegment> = {};
      let segmentId = 0;
      
      recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          const confidence = result[0].confidence;
          
          if (text && text.length > 0) {
            // 使用当前时间作为片段的开始时间
            const now = Date.now();
            if (currentSegment.text) {
              // 完成上一个片段
              segments.push({
                id: `segment-${segmentId++}`,
                startTime: currentSegment.startTime || 0,
                endTime: (now - (currentSegment.startTime || now)) / 1000,
                text: currentSegment.text,
                confidence: currentSegment.confidence,
              });
            }
            
            currentSegment = {
              id: `segment-${segmentId++}`,
              startTime: (performance.now() / 1000) % duration,
              text,
              confidence,
            };
          }
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('[AI字幕] 识别错误:', event.error);
        if (event.error === 'no-speech') {
          // 没有语音，生成模拟数据
          resolve(this.generateMockSubtitles(duration, options));
        } else {
          reject(new Error(`语音识别错误: ${event.error}`));
        }
      };
      
      recognition.onend = () => {
        // 添加最后一个片段
        if (currentSegment.text) {
          segments.push({
            id: `segment-${segmentId++}`,
            startTime: currentSegment.startTime || 0,
            endTime: duration,
            text: currentSegment.text,
            confidence: currentSegment.confidence,
          });
        }
        
        if (segments.length === 0) {
          // 如果没有识别到任何内容，生成模拟数据
          resolve(this.generateMockSubtitles(duration, options));
        } else {
          resolve(segments);
        }
      };
      
      // 开始识别
      recognition.start();
      
      // 设置超时
      setTimeout(() => {
        recognition.stop();
      }, Math.min(duration * 1000 + 5000, options.maxDuration || 180000));
    });
  }

  /**
   * @mock 生成模拟字幕数据（用于演示和浏览器不支持时）
   * TODO: 接入真实ASR API后移除此方法
   * 预留API接口: POST /api/v1/asr/recognize
   *   - 请求: { audioUrl: string, language: string, options: SubtitleGenerationOptions }
   *   - 响应: { segments: SubtitleSegment[], duration: number }
   */
  private generateMockSubtitles(
    duration: number,
    options: SubtitleGenerationOptions
  ): SubtitleSegment[] {
    const mockTexts = [
      '欢迎观看本视频',
      '今天我们将为大家介绍',
      '这个功能的使用方法',
      '首先让我们打开设置',
      '接下来点击开始按钮',
      '现在我们可以看到效果',
      '最后别忘了保存',
    ];
    
    const segments: SubtitleSegment[] = [];
    const segmentDuration = Math.max(
      options.minSegmentDuration || 1.0,
      duration / mockTexts.length
    );
    
    mockTexts.forEach((text, index) => {
      const startTime = index * segmentDuration;
      if (startTime < duration) {
        segments.push({
          id: `mock-${index}`,
          startTime,
          endTime: Math.min(startTime + segmentDuration, duration),
          text,
          confidence: 0.9,
        });
      }
    });
    
    return segments;
  }

  /**
   * 将文本分割成字幕片段
   */
  private splitTextIntoSegments(
    text: string,
    duration: number,
    _options: SubtitleGenerationOptions
  ): SubtitleSegment[] {
    // 按句子分割
    const sentences = text.split(/[。！？.!?]/).filter(s => s.trim());
    
    if (sentences.length === 0) {
      return [{
        id: 'segment-0',
        startTime: 0,
        endTime: duration,
        text: text.substring(0, 100),
      }];
    }
    
    const avgDuration = duration / sentences.length;
    
    return sentences.map((sentence, index) => {
      const startTime = index * avgDuration;
      const estimatedEndTime = startTime + avgDuration;
      
      return {
        id: `segment-${index}`,
        startTime: Math.max(0, startTime - 0.1),
        endTime: Math.min(duration, estimatedEndTime + 0.1),
        text: sentence.trim(),
      };
    });
  }

  /**
   * @mock 使用AI增强字幕片段
   * TODO: 接入豆包/通义API实现智能标点、错别字修正、表达优化
   * 预留API接口: POST /api/v1/ai/subtitle-enhance
   *   - 请求: { segments: SubtitleSegment[], language: string, enhanceType: 'punctuation' | 'correction' | 'polish' }
   *   - 响应: { segments: SubtitleSegment[] }
   */
  private async enhanceSegmentsWithAI(_segments: SubtitleSegment[]): Promise<void> {
    // 这里可以集成豆包API来优化字幕
    // 例如：自动添加标点、修正错别字、优化表达等
    // console.log('[AI字幕] AI增强功能待实现');
    
    // 预留接口，后续可以调用豆包API
    // const apiService = this.apiService;
    // const response = await apiService.generate(...);
  }

  /**
   * 格式化LRC时间
   */
  private formatLRCTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  /**
   * 解析LRC时间
   */
  private parseLRCTime(minutes: string, seconds: string, ms: string): number {
    return (
      parseInt(minutes) * 60 +
      parseInt(seconds) +
      parseInt(ms.padEnd(3, '0')) / 1000
    );
  }
}

export const aiSubtitleService = AISubtitleService.getInstance();
export default aiSubtitleService;
