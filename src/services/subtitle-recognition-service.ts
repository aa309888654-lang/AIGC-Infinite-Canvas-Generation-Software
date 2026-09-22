/**
 * 智能字幕识别服务
 * 提供浏览器端语音识别和字幕生成功能
 * 优先走后端真实 ASR (StepFun stepaudio-2.5-asr / MiniMax)，失败返回空结果
 */

import { formatSRTTime, formatVTTTime } from '@/lib/subtitle-utils';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface SubtitleTrack {
  language: string;
  cues: SubtitleCue[];
  duration: number;
}

export interface RecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  model?: 'offline' | 'online';
  allowDemoFallback?: boolean;
}

class SubtitleRecognitionService {
  private recognition: any = null;
  private isSupported: boolean = false;
  private useWebSpeech: boolean = false;

  constructor() {
    this.checkSupport();
  }

  private checkSupport(): void {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || 
                               (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
        this.isSupported = true;
        this.useWebSpeech = true;
        // console.log('[字幕识别] Web Speech API 支持');
      } else {
        // console.log('[字幕识别] Web Speech API 不支持，使用模拟模式');
        this.isSupported = false;
      }
    }
  }

  checkBrowserSupport(): boolean {
    return this.isSupported;
  }

  async recognizeFromVideo(
    videoFile: File,
    options: RecognitionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<SubtitleTrack> {
    onProgress?.(10);

    // 优先走后端真实 ASR。默认不会返回演示字幕，避免把演示内容当成识别结果写入时间线。
    try {
      const track = await this.recognizeWithBackendAsr(videoFile, options, onProgress);
      if (track.cues.length > 0) {
        return track;
      }
      logger.warn('[字幕识别] 后端 ASR 返回空结果');
      toast.warning('ASR 未识别到语音内容，未生成字幕');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[字幕识别] 后端 ASR 失败', error);
      toast.warning(`真实 ASR 调用失败，未生成示例字幕：${message}`);
    }

    if (options.allowDemoFallback) {
      logger.warn('[字幕识别] allowDemoFallback 已开启，返回演示字幕');
      return this.recognizeSimulated(videoFile, options, onProgress);
    }

    onProgress?.(100);
    return {
      language: options.language || 'zh-CN',
      cues: [],
      duration: await this.readMediaDuration(videoFile),
    };
  }

  /**
   * 后端真实 ASR 路径：
   * 1. 上传文件到 /api/v1/files/upload 拿 fileUrl
   * 2. 调用 /api/v1/audio/asr (provider=stepfun, model=stepaudio-2.5-asr)
   * 3. 按 `。！？.!?` 切分句子，按总时长均分时间戳
   */
  private async recognizeWithBackendAsr(
    mediaFile: File,
    options: RecognitionOptions,
    onProgress?: (progress: number) => void
  ): Promise<SubtitleTrack> {
    onProgress?.(20);

    // 1. 上传文件到后端，获取可访问 URL
    const uploadedUrl = await this.uploadFileForAsr(mediaFile);
    onProgress?.(40);

    // 2. 读取媒体时长（用于按句均分时间戳）
    const duration = await this.readMediaDuration(mediaFile);

    // 3. 调用 ASR
    const recognizedText = await this.callBackendAsr(uploadedUrl, options.language);
    onProgress?.(75);

    if (!recognizedText.trim()) {
      return {
        language: options.language || 'zh-CN',
        cues: [],
        duration,
      };
    }

    // 4. 切分句子并均分时间戳
    const cues = this.splitTextToCues(recognizedText, duration);
    onProgress?.(95);

    return {
      language: options.language || 'zh-CN',
      cues,
      duration,
    };
  }

  private async uploadFileForAsr(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', file.type.startsWith('video') ? 'videos' : 'audio');

    const response = await fetch(`${API_BASE_URL}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAuthToken() || ''}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`文件上传失败: ${response.status} ${errText.slice(0, 120)}`);
    }

    const data = await response.json();
    const fileUrl = data?.fileUrl || data?.cosUrl || data?.localUrl;
    if (!fileUrl) {
      throw new Error('上传响应缺少 fileUrl');
    }
    return fileUrl;
  }

  private async readMediaDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const media = document.createElement(file.type.startsWith('video') ? 'video' : 'audio');
        media.preload = 'metadata';
        media.onloadedmetadata = () => {
          const d = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 0;
          URL.revokeObjectURL(url);
          resolve(d);
        };
        media.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(0);
        };
        media.src = url;
      } catch {
        resolve(0);
      }
    });
  }

  private async callBackendAsr(audioUrl: string, language?: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/audio/asr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken() || ''}`,
      },
      body: JSON.stringify({
        audioUrl,
        language: language || 'auto',
        provider: 'stepfun',
        model: 'stepaudio-2.5-asr',
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`ASR 请求失败: ${response.status} ${errText.slice(0, 160)}`);
    }

    const data = await response.json();
    // 后端返回结构: { success: true, result: { text, data, provider, model } }
    const result = data?.result;
    if (!result) return '';
    return typeof result.text === 'string'
      ? result.text
      : typeof result.data?.text === 'string'
        ? result.data.text
        : '';
  }

  private splitTextToCues(text: string, totalDuration: number): SubtitleCue[] {
    const sentences = text
      .split(/[。！？!?\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (sentences.length === 0) return [];

    const duration = totalDuration > 0 ? totalDuration : Math.max(8, sentences.length * 3);
    const avg = duration / sentences.length;

    return sentences.map((sentence, index) => ({
      id: `asr_${index + 1}`,
      startTime: index * avg,
      endTime: index === sentences.length - 1 ? duration : (index + 1) * avg,
      text: sentence,
      confidence: 0.9,
    }));
  }

  private async recognizeWithWebSpeech(
    videoFile: File,
    options: RecognitionOptions,
    onProgress?: (progress: number) => void
  ): Promise<SubtitleTrack> {
    const language = options.language || 'zh-CN';
    
    this.recognition.lang = language;
    this.recognition.continuous = options.continuous ?? true;
    this.recognition.interimResults = options.interimResults ?? false;

    return new Promise((resolve, reject) => {
      const cues: SubtitleCue[] = [];
      let currentCue: SubtitleCue | null = null;
      let startTime = 0;
      let cueId = 0;

      onProgress?.(20);

      this.recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript.trim();
        const isFinal = result.isFinal;

        if (isFinal && transcript) {
          const endTime = (event.timeStamp / 1000);
          
          if (currentCue) {
            currentCue.endTime = endTime;
            currentCue.text = transcript;
            currentCue.confidence = result[0].confidence;
          } else {
            currentCue = {
              id: `cue_${cueId++}`,
              startTime,
              endTime,
              text: transcript,
              confidence: result[0].confidence
            };
            cues.push(currentCue);
          }
          
          currentCue = null;
          startTime = endTime;
          
          onProgress?.(50 + cues.length * 2);
        } else if (transcript) {
          if (!currentCue) {
            currentCue = {
              id: `cue_${cueId++}`,
              startTime,
              endTime: 0,
              text: transcript,
              confidence: 0
            };
          } else {
            currentCue.text = transcript;
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('[字幕识别] 错误:', event.error);
        if (event.error !== 'no-speech') {
          reject(new Error(event.error));
        }
      };

      this.recognition.onend = () => {
        if (currentCue && currentCue.text) {
          cues.push(currentCue);
        }
        
        const duration = cues.length > 0 
          ? Math.max(...cues.map(c => c.endTime))
          : 0;
        
        onProgress?.(100);
        
        resolve({
          language,
          cues,
          duration
        });
      };

      this.recognition.start();
      
      setTimeout(() => {
        if (this.recognition) {
          this.recognition.stop();
        }
      }, 60000);
    });
  }

  /**
   * 演示兜底：仅在 allowDemoFallback 显式开启时返回示例字幕
   */
  private async recognizeSimulated(
    videoFile: File,
    options: RecognitionOptions,
    onProgress?: (progress: number) => void
  ): Promise<SubtitleTrack> {
    onProgress?.(20);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    onProgress?.(40);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    onProgress?.(60);
    
    const cues: SubtitleCue[] = [
      {
        id: 'cue_1',
        startTime: 0,
        endTime: 3.5,
        text: '欢迎使用智能剪辑系统',
        confidence: 0.95
      },
      {
        id: 'cue_2',
        startTime: 3.5,
        endTime: 7.2,
        text: '这里提供了强大的AI功能',
        confidence: 0.92
      },
      {
        id: 'cue_3',
        startTime: 7.2,
        endTime: 10.8,
        text: '包括智能字幕识别和自动剪辑',
        confidence: 0.94
      },
      {
        id: 'cue_4',
        startTime: 10.8,
        endTime: 14.5,
        text: '让视频创作变得更加简单高效',
        confidence: 0.91
      }
    ];
    
    onProgress?.(80);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    onProgress?.(100);
    
    return {
      language: options.language || 'zh-CN',
      cues,
      duration: 14.5
    };
  }

  async recognizeFromAudio(
    audioFile: File,
    options: RecognitionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<SubtitleTrack> {
    return this.recognizeFromVideo(audioFile as File, options, onProgress);
  }

  exportToSRT(track: SubtitleTrack): string {
    return track.cues.map((cue, index) => {
      const start = formatSRTTime(cue.startTime);
      const end = formatSRTTime(cue.endTime);
      const text = cue.text;
      
      return `${index + 1}\n${start} --> ${end}\n${text}\n`;
    }).join('\n');
  }

  exportToVTT(track: SubtitleTrack): string {
    const header = 'WEBVTT\n\n';
    const cues = track.cues.map(cue => {
      const start = formatVTTTime(cue.startTime);
      const end = formatVTTTime(cue.endTime);
      const text = cue.text;
      
      return `${cue.id}\n${start} --> ${end}\n${text}\n`;
    }).join('\n');
    
    return header + cues;
  }

  exportToJSON(track: SubtitleTrack): string {
    return JSON.stringify(track, null, 2);
  }

  importFromSRT(srtContent: string): SubtitleTrack {
    const cues: SubtitleCue[] = [];
    const blocks = srtContent.trim().split(/\n\n+/);
    
    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const timeLine = lines[1];
        const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        
        if (timeMatch) {
          const startTime = parseInt(timeMatch[1]) * 3600 + 
                           parseInt(timeMatch[2]) * 60 + 
                           parseInt(timeMatch[3]) + 
                           parseInt(timeMatch[4]) / 1000;
          const endTime = parseInt(timeMatch[5]) * 3600 + 
                         parseInt(timeMatch[6]) * 60 + 
                         parseInt(timeMatch[7]) + 
                         parseInt(timeMatch[8]) / 1000;
          
          cues.push({
            id: `cue_${cues.length + 1}`,
            startTime,
            endTime,
            text: lines.slice(2).join('\n')
          });
        }
      }
    }
    
    return {
      language: 'unknown',
      cues,
      duration: cues.length > 0 ? Math.max(...cues.map(c => c.endTime)) : 0
    };
  }

  async translateSubtitles(
    track: SubtitleTrack,
    targetLanguage: string,
    onProgress?: (progress: number) => void
  ): Promise<SubtitleTrack> {
    onProgress?.(10);

    // 批量调用 LLM 翻译，减少请求次数与 token 成本
    const sourceTexts = track.cues.map((cue) => cue.text);
    let translatedTexts: string[];

    try {
      translatedTexts = await this.batchTranslateWithLLM(sourceTexts, targetLanguage);
      onProgress?.(90);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[字幕翻译] LLM 批量翻译失败，降级到字典', error);
      toast.warning(`LLM 翻译失败，已降级到示例字典：${message}`);
      translatedTexts = await Promise.all(
        sourceTexts.map((text) => this.fallbackTranslateWithDict(text, targetLanguage))
      );
    }

    const translatedCues: SubtitleCue[] = track.cues.map((cue, index) => ({
      id: `translated_${cue.id}`,
      startTime: cue.startTime,
      endTime: cue.endTime,
      text: translatedTexts[index] ?? cue.text,
      confidence: cue.confidence,
    }));

    onProgress?.(100);

    return {
      language: targetLanguage,
      cues: translatedCues,
      duration: track.duration,
    };
  }

  /**
   * 调用 /api/v1/ai/chat 让 LLM 批量翻译字幕
   * 返回顺序与入参 texts 一一对应
   */
  private async batchTranslateWithLLM(texts: string[], targetLang: string): Promise<string[]> {
    if (texts.length === 0) return [];

    const langName = this.languageCodeToName(targetLang);
    const userPrompt = [
      '请将以下字幕文本翻译为' + langName + '，保持原意、口语化。',
      '只输出翻译后的文本，每条一行，顺序与输入一致，不要附加序号或解释。',
      '输入：',
      ...texts.map((t, i) => `[${i + 1}] ${t}`),
      '输出：',
    ].join('\n');

    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken() || ''}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content:
              '你是专业字幕翻译引擎。严格按用户给出的条目数量输出，每条一行，不要序号，不要解释，不要引号。',
          },
          { role: 'user', content: userPrompt },
        ],
        provider: 'deepseek',
        model: 'deepseek-chat',
        temperature: 0.2,
        maxTokens: Math.max(512, texts.length * 64),
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`LLM 翻译请求失败: ${response.status} ${errText.slice(0, 160)}`);
    }

    const data = await response.json();
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.content ??
      data?.message?.content ??
      data?.result ??
      '';

    const lines = String(content)
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\d+[.)\]-]\s*/, '').trim())
      .filter((line) => line.length > 0);

    if (lines.length < texts.length) {
      // LLM 输出条数不足，按位置对齐填充原文，避免错位
      const padded = texts.map((_, i) => lines[i] ?? texts[i]);
      return padded;
    }

    return lines.slice(0, texts.length);
  }

  private languageCodeToName(code: string): string {
    const map: Record<string, string> = {
      'zh-CN': '简体中文',
      'zh-TW': '繁体中文',
      zh: '中文',
      en: 'English',
      ja: '日本語',
      ko: '한국어',
      fr: 'Français',
      es: 'Español',
      de: 'Deutsch',
      ru: 'Русский',
      ar: 'العربية',
    };
    return map[code] || code;
  }

  /**
   * 降级兜底：硬编码字典翻译，仅在 LLM 不可用时使用
   */
  private async fallbackTranslateWithDict(text: string, targetLang: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 50));

    const translations: Record<string, Record<string, string>> = {
      en: {
        欢迎使用智能剪辑系统: 'Welcome to Smart Editing System',
        这里提供了强大的AI功能: 'Powerful AI features are provided here',
        包括智能字幕识别和自动剪辑: 'Including intelligent subtitle recognition and auto editing',
        让视频创作变得更加简单高效: 'Making video creation simpler and more efficient',
      },
    };

    if (translations[targetLang] && translations[targetLang][text]) {
      return translations[targetLang][text];
    }

    return `[${targetLang}] ${text}`;
  }

  mergeSubtitleTracks(tracks: SubtitleTrack[]): SubtitleTrack {
    const allCues: SubtitleCue[] = [];
    
    for (const track of tracks) {
      allCues.push(...track.cues);
    }
    
    allCues.sort((a, b) => a.startTime - b.startTime);
    
    let id = 1;
    for (const cue of allCues) {
      cue.id = `cue_${id++}`;
    }
    
    return {
      language: 'multi',
      cues: allCues,
      duration: allCues.length > 0 ? Math.max(...allCues.map(c => c.endTime)) : 0
    };
  }

  splitSubtitleBySentence(track: SubtitleTrack): SubtitleTrack {
    const newCues: SubtitleCue[] = [];
    
    for (const cue of track.cues) {
      const sentences = cue.text.split(/[。！？；\n]+/).filter(s => s.trim());
      const duration = cue.endTime - cue.startTime;
      const avgDuration = duration / sentences.length;
      
      let currentTime = cue.startTime;
      
      for (let i = 0; i < sentences.length; i++) {
        const text = sentences[i].trim();
        if (text) {
          newCues.push({
            id: `split_${cue.id}_${i}`,
            startTime: currentTime,
            endTime: currentTime + avgDuration,
            text: this.correctHomophones(text),
            confidence: cue.confidence
          });
          currentTime += avgDuration;
        }
      }
    }
    
    return {
      ...track,
      cues: newCues
    };
  }

  correctHomophones(text: string): string {
    let corrected = text;

    const HOMOPHONE_RULES: [RegExp, string][] = [
      [/(?<![在])再吗/g, '在吗'],
      [/起程/g, '启程'],
      [/蜜月已发送/g, '密钥已发送'],
      [/在妈/g, '在吗'],
      [/的得/g, '地得'],
      [/(?<=[很得])的(?=[很快好慢多])/, '得'],
      [/(?<=[认真高兴快乐激动])的(?=[跑走说唱])/, '地'],
      [/密月/g, '密钥'],
      [/帐号/g, '账号'],
      [/登陆/g, '登录'],
      [/暴光/g, '曝光'],
      [/象限/g, '像限'],
      [/按装/g, '安装'],
      [/既使/g, '即使'],
      [/凑和/g, '凑合'],
      [/迫不急待/g, '迫不及待'],
      [/一愁莫展/g, '一筹莫展'],
      [/再接再历/g, '再接再厉'],
      [/走头无路/g, '走投无路'],
      [/融汇贯通/g, '融会贯通'],
    ];

    for (const [pattern, replacement] of HOMOPHONE_RULES) {
      corrected = corrected.replace(pattern, replacement);
    }

    return corrected;
  }

  correctTrack(track: SubtitleTrack): SubtitleTrack {
    return {
      ...track,
      cues: track.cues.map(cue => ({
        ...cue,
        text: this.correctHomophones(cue.text),
      })),
    };
  }
}

export const subtitleRecognitionService = new SubtitleRecognitionService();
