/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@/lib/logger';
import { getAuthToken } from '@/lib/auth-check';
import { BACKEND_URL as BACKEND_URL_CONFIG } from '@/lib/api-config';

export interface AudioAgentAnalysis {
  emotion: string;
  emotionConfidence: number;
  suggestedSpeed: number;
  suggestedPitch: number;
  suggestedVoiceId: string;
  pausePoints: number[];
  emphasisWords: string[];
  sentimentScore: number;
  languageDetected: string;
  readabilityScore: number;
}

export interface AudioAgentSuggestion {
  type: 'voice' | 'emotion' | 'speed' | 'pitch' | 'effect' | 'text';
  priority: 'high' | 'medium' | 'low';
  message: string;
  applyPatch?: Record<string, any>;
}

export interface AudioWaveformData {
  peaks: number[];
  duration: number;
  sampleRate: number;
}

export interface AudioBPMDetection {
  bpm: number;
  confidence: number;
  beatPositions: number[];
}

export interface AudioNoiseProfile {
  noiseLevel: number;
  snr: number;
  noiseType: 'white' | 'pink' | 'brown' | 'hum' | 'none';
}

export interface AudioLoudness {
  integrated: number;
  shortTerm: number;
  truePeak: number;
  lufs: number;
}

class AudioAgentService {
  private static instance: AudioAgentService;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: AudioBufferSourceNode | MediaElementAudioSourceNode | null = null;

  private constructor() {
    logger.info('[AudioAgent] 音频Agent服务已初始化');
  }

  static getInstance(): AudioAgentService {
    if (!AudioAgentService.instance) {
      AudioAgentService.instance = new AudioAgentService();
    }
    return AudioAgentService.instance;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  async analyzeText(text: string): Promise<AudioAgentAnalysis> {
    const emotion = this.detectEmotion(text);
    const language = this.detectLanguage(text);
    const pausePoints = this.detectPausePoints(text);
    const emphasisWords = this.detectEmphasis(text);
    const readability = this.calculateReadability(text);

    const emotionVoiceMap: Record<string, string> = {
      happy: 'female-shaonv',
      sad: 'female-yujie',
      angry: 'male-xiaogang',
      fear: 'female-yujie',
      surprise: 'female-shaonv',
      neutral: 'male-xiaobai',
    };

    const emotionSpeedMap: Record<string, number> = {
      happy: 1.1,
      sad: 0.85,
      angry: 1.15,
      fear: 0.9,
      surprise: 1.2,
      neutral: 1.0,
    };

    const emotionPitchMap: Record<string, number> = {
      happy: 2,
      sad: -3,
      angry: -1,
      fear: 1,
      surprise: 3,
      neutral: 0,
    };

    return {
      emotion,
      emotionConfidence: 0.8,
      suggestedSpeed: emotionSpeedMap[emotion] ?? 1.0,
      suggestedPitch: emotionPitchMap[emotion] ?? 0,
      suggestedVoiceId: emotionVoiceMap[emotion] ?? 'male-xiaobai',
      pausePoints,
      emphasisWords,
      sentimentScore: this.calculateSentiment(text),
      languageDetected: language,
      readabilityScore: readability,
    };
  }

  async generateSuggestions(
    text: string,
    currentParams: Record<string, any>
  ): Promise<AudioAgentSuggestion[]> {
    const suggestions: AudioAgentSuggestion[] = [];
    const analysis = await this.analyzeText(text);

    if (currentParams.voiceId !== analysis.suggestedVoiceId) {
      suggestions.push({
        type: 'voice',
        priority: 'high',
        message: `检测到${analysis.emotion}情感，推荐使用「${analysis.suggestedVoiceId}」音色`,
        applyPatch: { voiceId: analysis.suggestedVoiceId },
      });
    }

    if (Math.abs(currentParams.speed - analysis.suggestedSpeed) > 0.2) {
      suggestions.push({
        type: 'speed',
        priority: 'medium',
        message: `建议语速调整为 ${analysis.suggestedSpeed}x 以匹配${analysis.emotion}情感`,
        applyPatch: { speed: analysis.suggestedSpeed },
      });
    }

    if (Math.abs(currentParams.pitch - analysis.suggestedPitch) > 2) {
      suggestions.push({
        type: 'pitch',
        priority: 'medium',
        message: `建议音调调整为 ${analysis.suggestedPitch} 以增强表现力`,
        applyPatch: { pitch: analysis.suggestedPitch },
      });
    }

    if (analysis.pausePoints.length > 0 && currentParams.speed > 1.1) {
      suggestions.push({
        type: 'text',
        priority: 'low',
        message: `文本含${analysis.pausePoints.length}个停顿点，高速朗读可能影响节奏`,
      });
    }

    if (analysis.readabilityScore < 50) {
      suggestions.push({
        type: 'text',
        priority: 'high',
        message: '文本可读性较低，建议简化长句或拆分段落',
      });
    }

    if (text.length > 500 && !currentParams.emotion) {
      suggestions.push({
        type: 'emotion',
        priority: 'low',
        message: '长文本建议指定情感参数以增强表现力',
      });
    }

    return suggestions;
  }

  async extractWaveform(audioUrl: string, samples: number = 200): Promise<AudioWaveformData> {
    try {
      const ctx = this.getAudioContext();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const channelData = audioBuffer.getChannelData(0);
      const blockSize = Math.floor(channelData.length / samples);
      const peaks: number[] = [];

      for (let i = 0; i < samples; i++) {
        let max = 0;
        for (let j = 0; j < blockSize; j++) {
          const abs = Math.abs(channelData[i * blockSize + j]);
          if (abs > max) max = abs;
        }
        peaks.push(max);
      }

      return {
        peaks,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
      };
    } catch (error: any) {
      logger.warn('[AudioAgent] 波形提取失败:', (error instanceof Error ? error.message : String(error)));
      return { peaks: new Array(samples).fill(0), duration: 0, sampleRate: 44100 };
    }
  }

  async detectBPM(audioUrl: string): Promise<AudioBPMDetection> {
    try {
      const ctx = this.getAudioContext();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const windowSize = Math.floor(sampleRate * 0.01);

      const energies: number[] = [];
      for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
        let energy = 0;
        for (let j = 0; j < windowSize; j++) {
          energy += channelData[i + j] ** 2;
        }
        energies.push(energy / windowSize);
      }

      const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
      const beats: number[] = [];
      let lastBeat = -Infinity;

      for (let i = 1; i < energies.length - 1; i++) {
        const time = (i * windowSize) / sampleRate;
        if (
          energies[i] > avgEnergy * 1.5 &&
          energies[i] > energies[i - 1] &&
          energies[i] > energies[i + 1] &&
          time - lastBeat > 0.3
        ) {
          beats.push(time);
          lastBeat = time;
        }
      }

      if (beats.length < 2) {
        return { bpm: 0, confidence: 0, beatPositions: beats };
      }

      const intervals: number[] = [];
      for (let i = 1; i < beats.length; i++) {
        intervals.push(beats[i] - beats[i - 1]);
      }

      const medianInterval = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
      const bpm = Math.round(60 / medianInterval);
      const clampedBPM = Math.max(40, Math.min(240, bpm));
      const confidence = Math.min(1, beats.length / 20);

      return { bpm: clampedBPM, confidence, beatPositions: beats };
    } catch (error: any) {
      logger.warn('[AudioAgent] BPM检测失败:', (error instanceof Error ? error.message : String(error)));
      return { bpm: 0, confidence: 0, beatPositions: [] };
    }
  }

  async analyzeLoudness(audioUrl: string): Promise<AudioLoudness> {
    try {
      const ctx = this.getAudioContext();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const channelData = audioBuffer.getChannelData(0);
      let sumSquares = 0;
      let truePeak = 0;

      for (let i = 0; i < channelData.length; i++) {
        sumSquares += channelData[i] ** 2;
        const abs = Math.abs(channelData[i]);
        if (abs > truePeak) truePeak = abs;
      }

      const rms = Math.sqrt(sumSquares / channelData.length);
      const lufs = 20 * Math.log10(rms) - 0.691;

      return {
        integrated: rms,
        shortTerm: rms,
        truePeak: 20 * Math.log10(truePeak),
        lufs: Math.round(lufs * 10) / 10,
      };
    } catch (error: any) {
      logger.warn('[AudioAgent] 响度分析失败:', (error instanceof Error ? error.message : String(error)));
      return { integrated: 0, shortTerm: 0, truePeak: 0, lufs: -70 };
    }
  }

  async analyzeNoiseProfile(audioUrl: string): Promise<AudioNoiseProfile> {
    try {
      const ctx = this.getAudioContext();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const channelData = audioBuffer.getChannelData(0);
      const segmentLength = Math.floor(audioBuffer.sampleRate * 0.5);
      const segment = channelData.slice(0, Math.min(segmentLength, channelData.length));

      let noiseEnergy = 0;
      let signalEnergy = 0;

      for (let i = 0; i < segment.length; i++) {
        const val = segment[i];
        noiseEnergy += val ** 2;
      }

      const midPoint = Math.floor(channelData.length / 2);
      const midSegment = channelData.slice(midPoint, midPoint + segmentLength);
      for (let i = 0; i < midSegment.length; i++) {
        signalEnergy += midSegment[i] ** 2;
      }

      const noiseLevel = Math.sqrt(noiseEnergy / segment.length);
      const signalLevel = Math.sqrt(signalEnergy / midSegment.length);
      const snr = signalLevel > 0 ? 20 * Math.log10(signalLevel / Math.max(noiseLevel, 1e-10)) : 0;

      let noiseType: AudioNoiseProfile['noiseType'] = 'none';
      if (noiseLevel > 0.05) {
        noiseType = snr < 10 ? 'white' : snr < 20 ? 'pink' : 'hum';
      }

      return { noiseLevel, snr: Math.round(snr), noiseType };
    } catch (error: any) {
      logger.warn('[AudioAgent] 噪声分析失败:', (error instanceof Error ? error.message : String(error)));
      return { noiseLevel: 0, snr: 0, noiseType: 'none' };
    }
  }

  async generateSoundEffect(
    effectType: string,
    params: Record<string, any>
  ): Promise<string | null> {
    try {
      const token = getAuthToken();
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || BACKEND_URL_CONFIG;
      const res = await fetch(`${BACKEND_URL}/api/v1/audio/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          modelProvider: 'minimax',
          modelId: 'speech-02-hd',
          mode: 'sound_effect',
          prompt: `Generate ${effectType} sound effect`,
          ...params,
        }),
      });
      const data = await res.json();
      if (data.success) {
        return data.result?.audioUrl || data.audioUrl || null;
      }
      return null;
    } catch (error: any) {
      logger.error('[AudioAgent] 音效生成失败:', (error instanceof Error ? error.message : String(error)));
      return null;
    }
  }

  async generateMusic(
    prompt: string,
    duration: number = 30,
    style?: string
  ): Promise<string | null> {
    try {
      const token = getAuthToken();
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || BACKEND_URL_CONFIG;
      const res = await fetch(`${BACKEND_URL}/api/v1/audio/music-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt, lyrics: '', duration, style }),
      });
      const data = await res.json();
      if (data.success) {
        return data.result?.audioUrl || data.audioUrl || null;
      }
      return null;
    } catch (error: any) {
      logger.error('[AudioAgent] 音乐生成失败:', (error instanceof Error ? error.message : String(error)));
      return null;
    }
  }

  private detectEmotion(text: string): string {
    const emotionKeywords: Record<string, string[]> = {
      happy: ['开心', '快乐', '幸福', '哈哈', '棒', '好', '太好了', 'happy', 'joy', 'great', 'wonderful', 'love'],
      sad: ['难过', '伤心', '悲伤', '哭', '泪', '遗憾', 'sad', 'cry', 'sorry', 'miss', 'lost'],
      angry: ['生气', '愤怒', '可恶', '混蛋', '该死', 'angry', 'hate', 'fury', 'damn'],
      fear: ['害怕', '恐惧', '可怕', '危险', 'fear', 'scared', 'danger', 'horror'],
      surprise: ['惊讶', '意外', '天哪', '不可思议', 'surprise', 'wow', 'amazing', 'incredible'],
    };

    let maxScore = 0;
    let detectedEmotion = 'neutral';

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (text.toLowerCase().includes(keyword)) score++;
      }
      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion;
      }
    }

    return detectedEmotion;
  }

  private detectLanguage(text: string): string {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length;

    const total = chineseChars + englishChars + koreanChars;
    if (total === 0) return 'any';

    if (chineseChars / total > 0.5) return 'Chinese';
    if (englishChars / total > 0.5) return 'English';
    if (koreanChars / total > 0.5) return 'Korean';
    return 'mixed';
  }

  private detectPausePoints(text: string): number[] {
    const pauses: number[] = [];
    const pauseMarkers = /[。！？；.!?;，,\n]/g;
    let match: RegExpExecArray | null;

    while ((match = pauseMarkers.exec(text)) !== null) {
      pauses.push(match.index);
    }

    return pauses;
  }

  private detectEmphasis(text: string): string[] {
    const emphasisPatterns = [
      /「([^」]+)」/g,
      /"([^"]+)"/g,
      /【([^】]+)】/g,
      /\*\*([^*]+)\*\*/g,
    ];

    const words: string[] = [];
    for (const pattern of emphasisPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        words.push(match[1]);
      }
    }

    return words;
  }

  private calculateSentiment(text: string): number {
    const positiveWords = ['好', '棒', '美', '爱', '乐', '喜', '福', '赞', '优', '妙', 'good', 'great', 'love', 'happy', 'best'];
    const negativeWords = ['坏', '差', '丑', '恨', '苦', '悲', '祸', '骂', '劣', '糟', 'bad', 'hate', 'sad', 'worst', 'ugly'];

    let score = 0;
    for (const w of positiveWords) {
      if (text.includes(w)) score++;
    }
    for (const w of negativeWords) {
      if (text.includes(w)) score--;
    }

    return Math.max(-1, Math.min(1, score / 3));
  }

  private calculateReadability(text: string): number {
    const sentences = text.split(/[。！？.!?]/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return 0;

    const avgSentenceLength = text.length / sentences.length;
    const longSentences = sentences.filter((s) => s.length > 50).length;
    const longRatio = longSentences / sentences.length;

    let score = 100;
    score -= (avgSentenceLength - 20) * 2;
    score -= longRatio * 30;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  destroy(): void {
    if (this.sourceNode) {
      try { (this.sourceNode as any).disconnect(); } catch { /* ignored */ }
      this.sourceNode = null;
    }
    if (this.analyserNode) {
      try { this.analyserNode.disconnect(); } catch { /* ignored */ }
      this.analyserNode = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch { /* ignored */ }
      this.audioContext = null;
    }
  }
}

export const audioAgentService = AudioAgentService.getInstance();
