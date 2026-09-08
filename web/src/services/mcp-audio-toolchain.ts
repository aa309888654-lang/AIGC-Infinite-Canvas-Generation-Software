/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@/lib/logger';
import { getAuthToken } from '@/lib/auth-check';
import { BACKEND_URL } from '@/lib/api-config';

const API_BASE = `${BACKEND_URL}/api/v1`;

export type MCPAudioTool =
  | 'tts_generate'
  | 'asr_transcribe'
  | 'audio_separate'
  | 'noise_reduce'
  | 'voice_clone'
  | 'voice_design'
  | 'sound_effect'
  | 'music_generate'
  | 'audio_enhance'
  | 'beat_detect'
  | 'loudness_normalize'
  | 'format_convert';

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  toolName: MCPAudioTool;
  executionTime: number;
}

export interface ASRTranscriptionResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
  language: string;
  duration: number;
}

export interface AudioSeparationResult {
  vocals: string | null;
  drums: string | null;
  bass: string | null;
  other: string | null;
}

export interface NoiseReductionResult {
  cleanedUrl: string;
  noiseReductionDb: number;
  originalSnr: number;
  improvedSnr: number;
}

export interface AudioEnhanceResult {
  enhancedUrl: string;
  improvements: string[];
  loudnessChange: number;
}

class MCPAudioToolChain {
  private static instance: MCPAudioToolChain;
  private toolRegistry: Map<MCPAudioTool, (params: any) => Promise<MCPToolResult>> = new Map();
  private toolMetadata: Map<MCPAudioTool, { name: string; description: string; category: string }> = new Map();

  private constructor() {
    this.registerTools();
    logger.info(`[MCPAudio] MCP音频工具链已初始化，共 ${this.toolRegistry.size} 个工具`);
  }

  static getInstance(): MCPAudioToolChain {
    if (!MCPAudioToolChain.instance) {
      MCPAudioToolChain.instance = new MCPAudioToolChain();
    }
    return MCPAudioToolChain.instance;
  }

  private registerTools(): void {
    this.toolRegistry.set('tts_generate', this.executeTTS.bind(this));
    this.toolMetadata.set('tts_generate', {
      name: 'TTS语音合成',
      description: '将文本转换为自然语音，支持多音色、情感、语速控制',
      category: 'generation',
    });

    this.toolRegistry.set('asr_transcribe', this.executeASR.bind(this));
    this.toolMetadata.set('asr_transcribe', {
      name: 'ASR语音识别',
      description: '将音频文件转录为文本，支持多语言和说话人分离',
      category: 'recognition',
    });

    this.toolRegistry.set('audio_separate', this.executeSeparation.bind(this));
    this.toolMetadata.set('audio_separate', {
      name: '音频分离',
      description: '将混合音频分离为人声、鼓、贝斯、其他音轨',
      category: 'processing',
    });

    this.toolRegistry.set('noise_reduce', this.executeNoiseReduction.bind(this));
    this.toolMetadata.set('noise_reduce', {
      name: '智能降噪',
      description: '自动检测并消除音频中的背景噪声',
      category: 'processing',
    });

    this.toolRegistry.set('voice_clone', this.executeVoiceClone.bind(this));
    this.toolMetadata.set('voice_clone', {
      name: '声音克隆',
      description: '基于上传的音频样本克隆说话人音色',
      category: 'generation',
    });

    this.toolRegistry.set('voice_design', this.executeVoiceDesign.bind(this));
    this.toolMetadata.set('voice_design', {
      name: '声音设计',
      description: '通过文本描述创建全新音色',
      category: 'generation',
    });

    this.toolRegistry.set('sound_effect', this.executeSoundEffect.bind(this));
    this.toolMetadata.set('sound_effect', {
      name: '音效生成',
      description: '生成环境音效、UI音效、转场音效等',
      category: 'generation',
    });

    this.toolRegistry.set('music_generate', this.executeMusicGenerate.bind(this));
    this.toolMetadata.set('music_generate', {
      name: '音乐生成',
      description: '根据描述生成背景音乐，支持风格和时长控制',
      category: 'generation',
    });

    this.toolRegistry.set('audio_enhance', this.executeAudioEnhance.bind(this));
    this.toolMetadata.set('audio_enhance', {
      name: '音频增强',
      description: '自动优化音频质量，包括响度归一化、EQ调整',
      category: 'processing',
    });

    this.toolRegistry.set('beat_detect', this.executeBeatDetect.bind(this));
    this.toolMetadata.set('beat_detect', {
      name: '节拍检测',
      description: '检测音频的BPM和节拍位置',
      category: 'analysis',
    });

    this.toolRegistry.set('loudness_normalize', this.executeLoudnessNormalize.bind(this));
    this.toolMetadata.set('loudness_normalize', {
      name: '响度归一化',
      description: '将音频响度调整到目标LUFS标准',
      category: 'processing',
    });

    this.toolRegistry.set('format_convert', this.executeFormatConvert.bind(this));
    this.toolMetadata.set('format_convert', {
      name: '格式转换',
      description: '在MP3/WAV/OGG/FLAC/AAC之间转换音频格式',
      category: 'utility',
    });
  }

  getAvailableTools(): Array<{ id: MCPAudioTool; name: string; description: string; category: string }> {
    const tools: Array<{ id: MCPAudioTool; name: string; description: string; category: string }> = [];
    this.toolMetadata.forEach((meta, id) => {
      tools.push({ id, ...meta });
    });
    return tools;
  }

  async executeTool(toolName: MCPAudioTool, params: any): Promise<MCPToolResult> {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `工具 ${toolName} 未注册`,
        toolName,
        executionTime: 0,
      };
    }

    const startTime = Date.now();
    try {
      const result = await tool(params);
      result.executionTime = Date.now() - startTime;
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
        toolName,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async ensureToken(): Promise<string | null> {
    return getAuthToken();
  }

  private async executeTTS(params: any): Promise<MCPToolResult> {
    const token = await this.ensureToken();
    try {
      const res = await fetch(`${API_BASE}/audio/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          modelProvider: 'minimax',
          modelId: params.modelId || 'speech-02-hd',
          text: params.text,
          voiceId: params.voiceId || 'female-tianmei',
          speed: params.speed || 1.0,
          pitch: params.pitch || 0,
          emotion: params.emotion,
          languageBoost: params.languageBoost || 'auto',
        }),
      });
      const data = await res.json();
      return {
        success: data.success,
        data: { audioUrl: data.result?.audioUrl || data.audioUrl },
        toolName: 'tts_generate',
        executionTime: 0,
      };
    } catch (error: any) {
      return { success: false, error: (error instanceof Error ? error.message : String(error)), toolName: 'tts_generate', executionTime: 0 };
    }
  }

  private async executeASR(params: any): Promise<MCPToolResult> {
    const token = await this.ensureToken();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/audio/asr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ audioUrl: params.audioUrl, language: params.language || 'auto' }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json();
      return {
        success: data.success,
        data: data.result as ASRTranscriptionResult,
        toolName: 'asr_transcribe',
        executionTime: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
        toolName: 'asr_transcribe',
        executionTime: 0,
      };
    }
  }

  private async executeSeparation(params: any): Promise<MCPToolResult> {
    const token = await this.ensureToken();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/audio/separate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ audioUrl: params.audioUrl, stems: params.stems || ['vocals', 'drums', 'bass', 'other'] }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json();
      return {
        success: data.success,
        data: data.result as AudioSeparationResult,
        toolName: 'audio_separate',
        executionTime: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
        toolName: 'audio_separate',
        executionTime: 0,
      };
    }
  }

  private async executeNoiseReduction(params: any): Promise<MCPToolResult> {
    const token = await this.ensureToken();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/audio/noise-reduce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ audioUrl: params.audioUrl, level: params.level || 'medium' }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json();
      return {
        success: data.success,
        data: data.result as NoiseReductionResult,
        toolName: 'noise_reduce',
        executionTime: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
        toolName: 'noise_reduce',
        executionTime: 0,
      };
    }
  }

  private async executeVoiceClone(params: any): Promise<MCPToolResult> {
    const token = await this.ensureToken();
    try {
      const res = await fetch(`${API_BASE}/audio/voice-clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileId: params.cloneFileId,
          voiceId: params.voiceId,
          promptText: params.clonePromptText,
        }),
      });
      const data = await res.json();
      return {
        success: data.success,
        data: { voiceId: data.voiceId },
        toolName: 'voice_clone',
        executionTime: 0,
      };
    } catch (error: any) {
      return { success: false, error: (error instanceof Error ? error.message : String(error)), toolName: 'voice_clone', executionTime: 0 };
    }
  }

  private async executeVoiceDesign(params: any): Promise<MCPToolResult> {
    const token = await this.ensureToken();
    try {
      const res = await fetch(`${API_BASE}/audio/voice-design`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: params.prompt,
          voiceId: params.voiceId,
          previewText: params.text || '这是一段测试语音',
        }),
      });
      const data = await res.json();
      return {
        success: data.success,
        data: { voiceId: data.voiceId },
        toolName: 'voice_design',
        executionTime: 0,
      };
    } catch (error: any) {
      return { success: false, error: (error instanceof Error ? error.message : String(error)), toolName: 'voice_design', executionTime: 0 };
    }
  }

  private async executeSoundEffect(params: any): Promise<MCPToolResult> {
    const token = await this.ensureToken();
    try {
      const res = await fetch(`${API_BASE}/audio/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          modelProvider: 'minimax',
          modelId: 'speech-02-hd',
          text: params.prompt,
          mode: 'sound_effect',
        }),
      });
      const data = await res.json();
      return {
        success: data.success,
        data: { audioUrl: data.result?.audioUrl || data.audioUrl },
        toolName: 'sound_effect',
        executionTime: 0,
      };
    } catch (error: any) {
      return { success: false, error: (error instanceof Error ? error.message : String(error)), toolName: 'sound_effect', executionTime: 0 };
    }
  }

  private async executeMusicGenerate(params: any): Promise<MCPToolResult> {
    const token = await this.ensureToken();
    try {
      const res = await fetch(`${API_BASE}/audio/music-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: params.prompt,
          lyrics: params.lyrics || '',
          duration: params.duration || 30,
          style: params.style,
        }),
      });
      const data = await res.json();
      return {
        success: data.success,
        data: { audioUrl: data.result?.audioUrl || data.audioUrl },
        toolName: 'music_generate',
        executionTime: 0,
      };
    } catch (error: any) {
      return { success: false, error: (error instanceof Error ? error.message : String(error)), toolName: 'music_generate', executionTime: 0 };
    }
  }

  private async executeAudioEnhance(params: any): Promise<MCPToolResult> {
    const token = await this.ensureToken();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/audio/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ audioUrl: params.audioUrl, targetLufs: params.targetLufs || -16 }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json();
      return {
        success: data.success,
        data: data.result as AudioEnhanceResult,
        toolName: 'audio_enhance',
        executionTime: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
        toolName: 'audio_enhance',
        executionTime: 0,
      };
    }
  }

  private async executeBeatDetect(params: any): Promise<MCPToolResult> {
    const { audioAgentService } = await import('./audio-agent-service');
    const result = await audioAgentService.detectBPM(params.audioUrl);
    return {
      success: true,
      data: result,
      toolName: 'beat_detect',
      executionTime: 0,
    };
  }

  private async executeLoudnessNormalize(params: any): Promise<MCPToolResult> {
    const token = await this.ensureToken();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/audio/normalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ audioUrl: params.audioUrl, targetLufs: params.targetLufs || -16 }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json();
      return {
        success: data.success,
        data: data.result,
        toolName: 'loudness_normalize',
        executionTime: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
        toolName: 'loudness_normalize',
        executionTime: 0,
      };
    }
  }

  private async executeFormatConvert(params: any): Promise<MCPToolResult> {
    const token = await this.ensureToken();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/audio/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          audioUrl: params.audioUrl,
          targetFormat: params.targetFormat || 'mp3',
          bitrate: params.bitrate || 128000,
          sampleRate: params.sampleRate || 44100,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json();
      return {
        success: data.success,
        data: data.result,
        toolName: 'format_convert',
        executionTime: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
        toolName: 'format_convert',
        executionTime: 0,
      };
    }
  }
}

export const mcpAudioToolChain = MCPAudioToolChain.getInstance();
