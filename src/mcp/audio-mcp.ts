/**
 * Audio Processing MCP Server
 * 音频处理 MCP 服务器
 * 提供语音合成、音乐生成、音效处理等能力
 */

import { LLMToolDefinition } from '@/services/llm-adapters/base-llm-adapter';
import type { VoiceProvider, VoiceParams, MusicParams } from '@/types/agent';

export interface AudioMCPServerConfig {
  enabled: boolean;
  providers: VoiceProvider[];
  defaultProvider: VoiceProvider;
  apiKeys?: Record<string, string>;
}

export interface AudioGenerationResult {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  error?: string;
  metadata?: {
    duration?: number;
    format?: string;
    generationTime?: number;
  };
}

export interface AudioTool {
  name: string;
  description: string;
  definition: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  handler: (args: Record<string, unknown>) => Promise<AudioToolResult>;
}

export interface AudioToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
  metadata?: {
    executionTime?: number;
    provider?: string;
  };
}

async function textToSpeech(args: Record<string, unknown>): Promise<AudioToolResult> {
  const params = args as any as VoiceParams;

  if (!params.provider || !params.text) {
    return {
      success: false,
      error: 'Missing required parameters: provider, text',
    };
  }

  const startTime = Date.now();

  try {
    let result: AudioGenerationResult;

    switch (params.provider) {
      case 'azure':
        result = await generateWithAzure(params);
        break;
      case 'elevenlabs':
        result = await generateWithElevenLabs(params);
        break;
      case 'baidu':
        result = await generateWithBaidu(params);
        break;
      case 'aliyun':
        result = await generateWithAliyun(params);
        break;
      case 'minimax':
        result = await generateWithMiniMax(params);
        break;
      default:
        return {
          success: false,
          error: `Unsupported provider: ${params.provider}`,
        };
    }

    return {
      success: true,
      result,
      metadata: {
        executionTime: Date.now() - startTime,
        provider: params.provider,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        executionTime: Date.now() - startTime,
      },
    };
  }
}

// TODO: 以下 Provider 为 mock 实现，实际 TTS 请通过 realAPIExecutor.executeAudioGen 或后端 /audio/generate 接口调用
async function generateWithAzure(params: VoiceParams): Promise<AudioGenerationResult> {
  const taskId = `azure_tts_${Date.now()}`;
  return {
    taskId,
    status: 'pending',
    metadata: {
      format: 'mp3',
      duration: Math.ceil(params.text.length / 5),
    },
  };
}

async function generateWithElevenLabs(params: VoiceParams): Promise<AudioGenerationResult> {
  const taskId = `elevenlabs_tts_${Date.now()}`;
  return {
    taskId,
    status: 'pending',
    metadata: {
      format: 'mp3',
      duration: Math.ceil(params.text.length / 5),
    },
  };
}

async function generateWithBaidu(params: VoiceParams): Promise<AudioGenerationResult> {
  const taskId = `baidu_tts_${Date.now()}`;
  return {
    taskId,
    status: 'pending',
    metadata: {
      format: 'mp3',
      duration: Math.ceil(params.text.length / 5),
    },
  };
}

async function generateWithAliyun(params: VoiceParams): Promise<AudioGenerationResult> {
  const taskId = `aliyun_tts_${Date.now()}`;
  return {
    taskId,
    status: 'pending',
    metadata: {
      format: 'mp3',
      duration: Math.ceil(params.text.length / 5),
    },
  };
}

async function generateWithMiniMax(params: VoiceParams): Promise<AudioGenerationResult> {
  const taskId = `minimax_tts_${Date.now()}`;
  return {
    taskId,
    status: 'pending',
    metadata: {
      format: 'mp3',
      duration: Math.ceil(params.text.length / 5),
    },
  };
}

async function selectVoice(args: Record<string, unknown>): Promise<AudioToolResult> {
  const { provider, language, gender, style } = args as {
    provider?: VoiceProvider;
    language?: string;
    gender?: 'male' | 'female';
    style?: string;
  };

  const voicePresets: Record<string, unknown> = {
    azure: {
      'zh-CN-XiaoxiaoNeural': { language: 'zh-CN', gender: 'female', style: 'cheerful' },
      'zh-CN-YunxiNeural': { language: 'zh-CN', gender: 'male', style: 'narration' },
      'en-US-JennyNeural': { language: 'en-US', gender: 'female', style: 'conversational' },
      'en-US-GuyNeural': { language: 'en-US', gender: 'male', style: 'narration' },
    },
    elevenlabs: {
      rachel: { language: 'en-US', gender: 'female', style: 'conversational' },
      drew: { language: 'en-US', gender: 'male', style: 'narration' },
    },
  };

  const providerVoices = voicePresets[provider || 'azure'] || voicePresets.azure;

  return {
    success: true,
    result: {
      provider: provider || 'azure',
      voices: providerVoices,
      selected: language || gender || style
        ? Object.entries(providerVoices as Record<string, Record<string, string>>)
            .filter(([, v]) => {
              if (language && v.language !== language) return false;
              if (gender && v.gender !== gender) return false;
              if (style && v.style !== style) return false;
              return true;
            })
            .map(([id, v]) => ({ id, ...v }))
        : Object.entries(providerVoices as Record<string, Record<string, string>>)
            .map(([id, v]) => ({ id, ...v })),
    },
  };
}

async function adjustEmotion(args: Record<string, unknown>): Promise<AudioToolResult> {
  const { emotion, intensity } = args as {
    emotion?: string;
    intensity?: number;
  };

  if (!emotion) {
    return {
      success: false,
      error: 'emotion is required',
    };
  }

  return {
    success: true,
    result: {
      emotion,
      intensity: intensity || 1.0,
      adjusted: true,
    },
  };
}

async function generateMusic(args: Record<string, unknown>): Promise<AudioToolResult> {
  const params = args as any as MusicParams;

  if (!params.style) {
    return {
      success: false,
      error: 'style is required',
    };
  }

  const startTime = Date.now();
  const taskId = `music_${Date.now()}`;

  return {
    success: true,
    result: {
      taskId,
      status: 'pending',
      style: params.style,
      mood: params.mood || 'neutral',
      duration: params.duration || 30,
      instruments: params.instruments || [],
    },
    metadata: {
      executionTime: Date.now() - startTime,
    },
  };
}

async function generateSoundEffect(args: Record<string, unknown>): Promise<AudioToolResult> {
  const { type, duration, intensity } = args as {
    type?: string;
    duration?: number;
    intensity?: number;
  };

  if (!type) {
    return {
      success: false,
      error: 'type is required',
    };
  }

  const taskId = `sfx_${Date.now()}`;

  return {
    success: true,
    result: {
      taskId,
      status: 'pending',
      type,
      duration: duration || 1.0,
      intensity: intensity || 0.8,
    },
  };
}

async function mixAudio(args: Record<string, unknown>): Promise<AudioToolResult> {
  const { tracks, outputFormat } = args as {
    tracks?: Array<{ url: string; volume?: number; offset?: number }>;
    outputFormat?: string;
  };

  if (!tracks || tracks.length === 0) {
    return {
      success: false,
      error: 'tracks are required',
    };
  }

  const taskId = `mix_${Date.now()}`;

  return {
    success: true,
    result: {
      taskId,
      status: 'pending',
      trackCount: tracks.length,
      outputFormat: outputFormat || 'mp3',
    },
  };
}

async function trimAudio(args: Record<string, unknown>): Promise<AudioToolResult> {
  const { audioUrl, startTime, endTime, fadeOut } = args as {
    audioUrl?: string;
    startTime?: number;
    endTime?: number;
    fadeOut?: boolean;
  };

  if (!audioUrl) {
    return {
      success: false,
      error: 'audioUrl is required',
    };
  }

  const taskId = `trim_${Date.now()}`;

  return {
    success: true,
    result: {
      taskId,
      status: 'pending',
      audioUrl,
      startTime: startTime || 0,
      endTime: endTime || undefined,
      fadeOut: fadeOut || false,
    },
  };
}

async function getAudioTaskStatus(args: Record<string, unknown>): Promise<AudioToolResult> {
  const { taskId } = args as { taskId?: string };

  if (!taskId) {
    return {
      success: false,
      error: 'taskId is required',
    };
  }

  return {
    success: true,
    result: {
      taskId,
      status: 'processing',
      progress: 0,
    },
  };
}

export const audioMCPTools: AudioTool[] = [
  {
    name: 'text_to_speech',
    description: 'Convert text to speech using TTS providers',
    definition: {
      name: 'text_to_speech',
      description: 'Convert text to speech',
      parameters: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: ['azure', 'elevenlabs', 'baidu', 'aliyun', 'minimax'],
            description: 'TTS provider',
          },
          text: { type: 'string', description: 'Text to convert to speech' },
          voiceId: { type: 'string', description: 'Voice ID' },
          speed: { type: 'number', description: 'Speech speed' },
          pitch: { type: 'number', description: 'Speech pitch' },
          volume: { type: 'number', description: 'Speech volume' },
          emotion: {
            type: 'string',
            enum: ['neutral', 'happy', 'sad', 'angry', 'excited'],
            description: 'Speech emotion',
          },
        },
        required: ['provider', 'text'],
      },
    },
    handler: textToSpeech,
  },
  {
    name: 'select_voice',
    description: 'Select a voice for TTS',
    definition: {
      name: 'select_voice',
      description: 'Select voice',
      parameters: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'TTS provider' },
          language: { type: 'string', description: 'Language code' },
          gender: { type: 'string', enum: ['male', 'female'], description: 'Voice gender' },
          style: { type: 'string', description: 'Voice style' },
        },
      },
    },
    handler: selectVoice,
  },
  {
    name: 'adjust_emotion',
    description: 'Adjust speech emotion',
    definition: {
      name: 'adjust_emotion',
      description: 'Adjust emotion',
      parameters: {
        type: 'object',
        properties: {
          emotion: { type: 'string', description: 'Target emotion' },
          intensity: { type: 'number', description: 'Emotion intensity 0-1' },
        },
        required: ['emotion'],
      },
    },
    handler: adjustEmotion,
  },
  {
    name: 'generate_music',
    description: 'Generate background music',
    definition: {
      name: 'generate_music',
      description: 'Generate music',
      parameters: {
        type: 'object',
        properties: {
          style: {
            type: 'string',
            enum: ['epic', 'peaceful', 'dramatic', 'romantic', 'comedic', 'action', 'ambient'],
            description: 'Music style',
          },
          mood: { type: 'string', enum: ['upbeat', 'downbeat', 'neutral'], description: 'Mood' },
          duration: { type: 'number', description: 'Duration in seconds' },
          instruments: { type: 'array', items: { type: 'string' }, description: 'Instruments' },
          prompt: { type: 'string', description: 'Music description prompt' },
        },
        required: ['style'],
      },
    },
    handler: generateMusic,
  },
  {
    name: 'generate_sound_effect',
    description: 'Generate sound effects',
    definition: {
      name: 'generate_sound_effect',
      description: 'Generate sound effect',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Sound effect type' },
          duration: { type: 'number', description: 'Duration in seconds' },
          intensity: { type: 'number', description: 'Intensity 0-1' },
        },
        required: ['type'],
      },
    },
    handler: generateSoundEffect,
  },
  {
    name: 'mix_audio',
    description: 'Mix multiple audio tracks',
    definition: {
      name: 'mix_audio',
      description: 'Mix audio tracks',
      parameters: {
        type: 'object',
        properties: {
          tracks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                volume: { type: 'number' },
                offset: { type: 'number' },
              },
            },
            description: 'Audio tracks to mix',
          },
          outputFormat: { type: 'string', description: 'Output format' },
        },
        required: ['tracks'],
      },
    },
    handler: mixAudio,
  },
  {
    name: 'trim_audio',
    description: 'Trim audio to specific time range',
    definition: {
      name: 'trim_audio',
      description: 'Trim audio',
      parameters: {
        type: 'object',
        properties: {
          audioUrl: { type: 'string', description: 'Audio URL' },
          startTime: { type: 'number', description: 'Start time in seconds' },
          endTime: { type: 'number', description: 'End time in seconds' },
          fadeOut: { type: 'boolean', description: 'Apply fade out' },
        },
        required: ['audioUrl'],
      },
    },
    handler: trimAudio,
  },
  {
    name: 'get_audio_task_status',
    description: 'Get audio generation task status',
    definition: {
      name: 'get_audio_task_status',
      description: 'Get task status',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID' },
        },
        required: ['taskId'],
      },
    },
    handler: getAudioTaskStatus,
  },
];

export class AudioMCPServer {
  private static instance: AudioMCPServer;
  private config: AudioMCPServerConfig;
  private tools: Map<string, AudioTool> = new Map();

  private constructor() {
    this.config = {
      enabled: true,
      providers: ['azure', 'elevenlabs', 'baidu', 'aliyun', 'minimax'],
      defaultProvider: 'azure',
    };

    this.registerTools();
  }

  public static getInstance(): AudioMCPServer {
    if (!AudioMCPServer.instance) {
      AudioMCPServer.instance = new AudioMCPServer();
    }
    return AudioMCPServer.instance;
  }

  private registerTools(): void {
    audioMCPTools.forEach((tool) => {
      this.tools.set(tool.name, tool);
    });
  }

  public getTools(): AudioTool[] {
    return Array.from(this.tools.values());
  }

  public getTool(name: string): AudioTool | undefined {
    return this.tools.get(name);
  }

  public async executeTool(name: string, args: Record<string, unknown>): Promise<AudioToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`,
      };
    }

    return tool.handler(args);
  }

  public getToolDefinitions(): LLMToolDefinition[] {
    return this.getTools().map((t): LLMToolDefinition => {
      const def = t.definition;
      return {
        type: 'function',
        function: {
          name: def.name || t.name,
          description: def.description || t.description,
          parameters: def.parameters,
        },
      };
    });
  }

  public updateConfig(config: Partial<AudioMCPServerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): AudioMCPServerConfig {
    return { ...this.config };
  }
}

export const audioMCPServer = AudioMCPServer.getInstance();
