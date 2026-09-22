/**
 * MiniMax TTS 音频生成适配器
 * 完整支持 MiniMax Speech API v2 规范
 * API 文档: https://platform.minimaxi.com/docs/api-reference/speech-t2a-http
 * 支持功能: 同步/异步语音合成、音色复刻、音色设计、音色管理
 */
import { GenerationResult, TaskStatusResult } from '@/types/ai-models';
import { logger } from '@/lib/logger';

// ===== 类型定义 =====

export type MiniMaxTTSModel =
  | 'speech-2.8-hd'
  | 'speech-02-hd'
  | 'speech-02-turbo'
  | 'speech-01-hd'
  | 'speech-01-turbo';

export type AudioFormat = 'mp3' | 'wav' | 'flac' | 'pcm';
export type OutputFormat = 'url' | 'hex';
export type LanguageBoost =
  | null
  | 'auto'
  | 'Chinese'
  | 'Chinese,Yue'
  | 'English'
  | 'Arabic'
  | 'Russian'
  | 'Spanish'
  | 'French'
  | 'Portuguese'
  | 'German'
  | 'Turkish'
  | 'Dutch'
  | 'Ukrainian'
  | 'Vietnamese'
  | 'Indonesian'
  | 'Italian'
  | 'Korean'
  | 'Thai'
  | 'Polish'
  | 'Romanian'
  | 'Greek'
  | 'Czech'
  | 'Finnish'
  | 'Hindi'
  | 'Bulgarian'
  | 'Danish'
  | 'Hebrew'
  | 'Malay'
  | 'Persian'
  | 'Slovak'
  | 'Swedish'
  | 'Croatian'
  | 'Filipino'
  | 'Hungarian'
  | 'Norwegian'
  | 'Slovenian'
  | 'Catalan'
  | 'Nynorsk'
  | 'Tamil'
  | 'Afrikaans';

export type SoundEffect =
  | ''
  | 'spacious_echo'
  | 'studio_reverb'
  | 'telephone'
  | 'radio';

export interface VoiceSetting {
  voice_id: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  emotion?: string;
}

export interface AudioSetting {
  sample_rate?: number;
  bitrate?: number;
  format?: AudioFormat;
  channel?: number;
}

export interface VoiceModify {
  pitch?: number;
  intensity?: number;
  timbre?: number;
  sound_effects?: SoundEffect;
}

export interface TimbreWeight {
  voice_id: string;
  weight: number;
}

export interface PronunciationDict {
  tone?: string[];
}

export interface StreamOptions {
  retry_interval?: number;
}

export interface MiniMaxTTSParams {
  model?: MiniMaxTTSModel;
  text: string;
  stream?: boolean;
  stream_options?: StreamOptions;
  voice_setting?: VoiceSetting;
  audio_setting?: AudioSetting;
  voice_modify?: VoiceModify;
  pronunciation_dict?: PronunciationDict;
  timbre_weights?: TimbreWeight[];
  language_boost?: LanguageBoost;
  subtitle_enable?: boolean;
  output_format?: OutputFormat;
  aigc_watermark?: boolean;
}

export interface MiniMaxTTSResponse {
  id?: string;
  model?: string;
  audio_file_id?: string;
  task_id?: string;
  task_status?: string;
  base_resp?: {
    status_code: number;
    status_msg: string;
  };
  data?: {
    audio?: string;
    audio_url?: string;
    audio_file_id?: string;
    status?: number;
    subtitle?: any;
    task_id?: string;
    voice_id?: string;
    trial_audio?: string;
    trial_audio_url?: string;
  };
  output?: {
    audio_url?: string;
    audio_file_id?: string;
  };
  extra_info?: {
    audio_length?: number;
    audio_channel?: number;
    audio_sample_rate?: number;
    audio_size?: number;
    bitrate?: number;
    audio_format?: string;
    usage_characters?: number;
    word_count?: number;
    invisible_character_ratio?: number;
  };
  trace_id?: string;
  voice_id?: string;
}

export interface VoiceCloneParams {
  voice_id: string;
  file_id: number;
  prompt_audio?: {
    file_id: number;
    prompt_text?: string;
  };
  text?: string;
  model?: MiniMaxTTSModel;
  need_noise_reduction?: boolean;
  need_volume_normalization?: boolean;
  aigc_watermark?: boolean;
}

export interface VoiceDesignParams {
  prompt: string;
  preview_text: string;
  voice_id?: string;
  aigc_watermark?: boolean;
}

export interface VoiceInfo {
  voice_id: string;
  name?: string;
  description?: string[];
  voice_name?: string;
  created_time?: string;
}

export interface VoiceListResponse {
  system_voice?: VoiceInfo[];
  voice_cloning?: VoiceInfo[];
  voice_generation?: VoiceInfo[];
  base_resp?: {
    status_code: number;
    status_msg: string;
  };
}

// ===== 适配器 =====

export class MiniMaxTTSAdapter {
  private apiKey: string;
  // 所有环境统一走后端代理，不暴露外部API地址
  private baseUrl: string = '/minimax-api';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method || 'GET';

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    logger.info(`[MiniMaxTTSAdapter] ${method} ${url}`);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body,
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(responseText);
          if (errorJson.base_resp?.status_msg) {
            errorMessage = errorJson.base_resp.status_msg;
          } else if (errorJson.error?.message) {
            errorMessage = errorJson.error.message;
          } else if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch {
          if (responseText) {
            errorMessage = responseText.substring(0, 500);
          }
        }
        logger.error(`[MiniMaxTTSAdapter] API 错误:`, errorMessage);
        throw new Error(errorMessage);
      }

      return JSON.parse(responseText) as T;
    } catch (error) {
      logger.error(`[MiniMaxTTSAdapter] 请求失败:`, error);
      throw error;
    }
  }

  async generateAudio(params: MiniMaxTTSParams): Promise<GenerationResult> {
    try {
      const requestBody: Record<string, any> = {
        model: params.model || 'speech-2.8-hd',
        text: params.text,
        stream: params.stream ?? false,
        voice_setting: {
          voice_id: params.voice_setting?.voice_id || 'female-tianmei',
          speed: params.voice_setting?.speed ?? 1.0,
          vol: params.voice_setting?.vol ?? 1.0,
          pitch: params.voice_setting?.pitch ?? 0,
        },
        audio_setting: {
          sample_rate: params.audio_setting?.sample_rate ?? 32000,
          bitrate: params.audio_setting?.bitrate ?? 128000,
          format: params.audio_setting?.format ?? 'mp3',
          channel: params.audio_setting?.channel ?? 1,
        },
      };

      if (params.voice_setting?.emotion) {
        requestBody.voice_setting.emotion = params.voice_setting.emotion;
      }

      if (params.stream_options) {
        requestBody.stream_options = params.stream_options;
      }

      if (params.voice_modify && (params.voice_modify.sound_effects || params.voice_modify.pitch || params.voice_modify.intensity || params.voice_modify.timbre)) {
        requestBody.voice_modify = {
          pitch: params.voice_modify.pitch ?? 0,
          intensity: params.voice_modify.intensity ?? 0,
          timbre: params.voice_modify.timbre ?? 0,
          ...(params.voice_modify.sound_effects ? { sound_effects: params.voice_modify.sound_effects } : {}),
        };
      }

      if (params.pronunciation_dict?.tone && params.pronunciation_dict.tone.length > 0) {
        requestBody.pronunciation_dict = params.pronunciation_dict;
      }

      if (params.timbre_weights && params.timbre_weights.length > 0) {
        requestBody.timbre_weights = params.timbre_weights;
      }

      if (params.language_boost) {
        requestBody.language_boost = params.language_boost;
      }

      if (params.subtitle_enable) {
        requestBody.subtitle_enable = true;
      }

      if (params.output_format) {
        requestBody.output_format = params.output_format;
      }

      if (params.aigc_watermark) {
        requestBody.aigc_watermark = true;
      }

      const response = await this.request<MiniMaxTTSResponse>('/v1/t2a_v2', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (response.base_resp && response.base_resp.status_code !== 0) {
        const errorMsg = response.base_resp.status_msg || '未知错误';
        return {
          taskId: response.id || response.task_id || '',
          status: 'failed',
          error: `API 错误: ${errorMsg} (代码: ${response.base_resp.status_code})`,
        };
      }

      let audioUrl: string | undefined;

      if (response.data?.audio_url) {
        audioUrl = response.data.audio_url;
      } else if (response.data?.audio) {
        // When output_format is 'url', data.audio is a URL string, not hex data
        if (typeof response.data.audio === 'string' && response.data.audio.startsWith('http')) {
          audioUrl = response.data.audio;
        } else {
          audioUrl = await this.convertHexToAudioUrl(
            response.data.audio,
            response.extra_info?.audio_format || params.audio_setting?.format || 'mp3'
          );
        }
      } else if (response.audio_file_id) {
        audioUrl = await this.getAudioUrl(response.audio_file_id);
      } else if (response.output?.audio_url) {
        audioUrl = response.output.audio_url;
      } else if (response.id || response.task_id) {
        return {
          taskId: response.id || response.task_id,
          status: 'pending',
        };
      }

      if (audioUrl) {
        return {
          taskId: response.id || response.task_id || `task-${Date.now()}`,
          status: 'completed',
          resultUrl: audioUrl,
          progress: 100,
        };
      }

      return {
        taskId: response.id || response.task_id || '',
        status: 'pending',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'MiniMax TTS 生成失败';
      return {
        taskId: '',
        status: 'failed',
        error: errorMessage,
      };
    }
  }

  async createAsyncTask(params: MiniMaxTTSParams): Promise<GenerationResult> {
    try {
      const requestBody: Record<string, any> = {
        model: params.model || 'speech-2.8-hd',
        text: params.text,
        voice_setting: {
          voice_id: params.voice_setting?.voice_id || 'female-tianmei',
          speed: params.voice_setting?.speed ?? 1.0,
          vol: params.voice_setting?.vol ?? 1.0,
          pitch: params.voice_setting?.pitch ?? 0,
        },
        audio_setting: {
          sample_rate: params.audio_setting?.sample_rate ?? 32000,
          bitrate: params.audio_setting?.bitrate ?? 128000,
          format: params.audio_setting?.format ?? 'mp3',
          channel: params.audio_setting?.channel ?? 1,
        },
      };

      if (params.language_boost) requestBody.language_boost = params.language_boost;
      if (params.subtitle_enable) requestBody.subtitle_enable = true;
      if (params.pronunciation_dict) requestBody.pronunciation_dict = params.pronunciation_dict;
      if (params.voice_modify) requestBody.voice_modify = params.voice_modify;
      if (params.timbre_weights) requestBody.timbre_weights = params.timbre_weights;
      if (params.output_format) requestBody.output_format = params.output_format;
      if (params.aigc_watermark) requestBody.aigc_watermark = true;

      const response = await this.request<MiniMaxTTSResponse>('/v1/t2a_async_v2', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (response.base_resp && response.base_resp.status_code !== 0) {
        return {
          taskId: '',
          status: 'failed',
          error: response.base_resp.status_msg || '异步任务创建失败',
        };
      }

      const taskId = response.data?.task_id || response.task_id;
      return {
        taskId: taskId || '',
        status: 'processing',
        progress: 0,
      };
    } catch (error) {
      return {
        taskId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : '异步任务创建失败',
      };
    }
  }

  async queryAsyncTask(taskId: string): Promise<TaskStatusResult> {
    try {
      const response = await this.request<MiniMaxTTSResponse>(
        `/v1/query/t2a_async_query_v2?task_id=${taskId}`,
        { method: 'GET' }
      );

      const rawStatus = response.data?.status ?? response.task_status ?? 'pending';
      const status = String(rawStatus).toLowerCase();

      if (status === 'success' || status === 'completed') {
        let audioUrl: string | undefined;
        if (response.data?.audio_url) {
          audioUrl = response.data.audio_url;
        } else if (response.data?.audio) {
          if (typeof response.data.audio === 'string' && response.data.audio.startsWith('http')) {
            audioUrl = response.data.audio;
          } else {
            audioUrl = await this.convertHexToAudioUrl(response.data.audio, response.extra_info?.audio_format || 'mp3');
          }
        } else if (response.output?.audio_url) {
          audioUrl = response.output.audio_url;
        }

        if (audioUrl) {
          return {
            status: 'completed',
            progress: 100,
            output: { audioUrl },
          };
        }
      }

      if (status === 'failed' || status === 'error') {
        return {
          status: 'failed',
          progress: 0,
          error: response.base_resp?.status_msg || '任务失败',
        };
      }

      if (status === 'processing' || status === 'running' || status === 'processing') {
        return {
          status: 'processing',
          progress: 50,
          message: '正在处理中...',
        };
      }

      return {
        status: 'pending',
        progress: 0,
        message: '等待处理...',
      };
    } catch (error) {
      return {
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : '查询状态失败',
      };
    }
  }

  async uploadFile(file: File, purpose: 'voice_clone' | 'prompt_audio' = 'voice_clone'): Promise<{ file_id: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose);

    const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('accessToken');
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${this.baseUrl}/v1/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`文件上传失败: ${response.status}`);
    }

    const result = await response.json();
    if (result.base_resp?.status_code !== 0) {
      throw new Error(result.base_resp?.status_msg || '文件上传失败');
    }

    return { file_id: result.file?.file_id || result.data?.file_id };
  }

  async cloneVoice(params: VoiceCloneParams): Promise<{ voice_id: string; audio_url?: string }> {
    try {
      const requestBody: Record<string, any> = {
        voice_id: params.voice_id,
        file_id: params.file_id,
        need_noise_reduction: params.need_noise_reduction ?? false,
        need_volume_normalization: params.need_volume_normalization ?? false,
      };

      if (params.prompt_audio) {
        requestBody.prompt_audio = {
          file_id: params.prompt_audio.file_id,
          prompt_text: params.prompt_audio.prompt_text || '',
        };
      }

      if (params.text) {
        requestBody.text = params.text;
        requestBody.model = params.model || 'speech-2.8-hd';
      }

      if (params.aigc_watermark) {
        requestBody.aigc_watermark = true;
      }

      const response = await this.request<MiniMaxTTSResponse>('/v1/voice_clone', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (response.base_resp && response.base_resp.status_code !== 0) {
        throw new Error(response.base_resp.status_msg || '音色复刻失败');
      }

      return {
        voice_id: params.voice_id,
        audio_url: response.data?.audio_url || response.output?.audio_url,
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error('音色复刻失败');
    }
  }

  async designVoice(params: VoiceDesignParams): Promise<{ voice_id: string; trial_audio?: string }> {
    try {
      const requestBody: Record<string, any> = {
        prompt: params.prompt,
        preview_text: params.preview_text,
      };

      if (params.voice_id) {
        requestBody.voice_id = params.voice_id;
      }

      if (params.aigc_watermark) {
        requestBody.aigc_watermark = true;
      }

      const response = await this.request<MiniMaxTTSResponse>('/v1/voice_design', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (response.base_resp && response.base_resp.status_code !== 0) {
        throw new Error(response.base_resp.status_msg || '音色设计失败');
      }

      const voiceId = response.data?.voice_id || response.voice_id || '';
      const trialAudio = response.data?.trial_audio || response.data?.audio_url || '';

      return {
        voice_id: voiceId,
        trial_audio: trialAudio,
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error('音色设计失败');
    }
  }

  async getVoices(): Promise<VoiceListResponse> {
    try {
      const response = await this.request<VoiceListResponse>('/v1/voice_clone', {
        method: 'POST',
        body: JSON.stringify({ voice_type: 'all' }),
      });

      return response;
    } catch (error) {
      return {
        system_voice: [],
        voice_cloning: [],
        voice_generation: [],
        base_resp: { status_code: -1, status_msg: '获取音色列表失败' },
      };
    }
  }

  async deleteVoice(voiceId: string, voiceType: 'voice_cloning' | 'voice_generation'): Promise<boolean> {
    try {
      const response = await this.request<MiniMaxTTSResponse>('/v1/voice_clone/delete', {
        method: 'POST',
        body: JSON.stringify({ voice_id: voiceId, voice_type: voiceType }),
      });

      return response.base_resp?.status_code === 0;
    } catch {
      return false;
    }
  }

  private async convertHexToAudioUrl(hexAudio: string, format: string = 'mp3'): Promise<string> {
    try {
      const bytes = new Uint8Array(hexAudio.length / 2);
      for (let i = 0; i < hexAudio.length; i += 2) {
        bytes[i / 2] = parseInt(hexAudio.substr(i, 2), 16);
      }

      const mimeType =
        format === 'mp3' ? 'audio/mpeg' :
        format === 'wav' ? 'audio/wav' :
        format === 'flac' ? 'audio/flac' :
        format === 'pcm' ? 'audio/pcm' :
        'audio/mpeg';

      const blob = new Blob([bytes], { type: mimeType });
      return URL.createObjectURL(blob);
    } catch {
      throw new Error('音频数据转换失败');
    }
  }

  private async getAudioUrl(audioFileId: string): Promise<string> {
    try {
      const response = await this.request<MiniMaxTTSResponse>(`/v1/audio_files/${audioFileId}`, {
        method: 'GET',
      });

      if (response.data?.audio_url) return response.data.audio_url;
      if (response.output?.audio_url) return response.output.audio_url;
      return audioFileId;
    } catch {
      return audioFileId;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.generateAudio({
        text: '测试',
        voice_setting: { voice_id: 'female-tianmei', speed: 1.0 },
        stream: false,
        output_format: 'url',
      });
      return true;
    } catch {
      return false;
    }
  }
}
