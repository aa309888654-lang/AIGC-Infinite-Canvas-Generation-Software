import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { BaseProvider } from './base-provider';
import { ImageParams, AudioParams, GenerationResult, ApiProviderConfig } from '../types/api';
import { logger } from '../utils/logger';

const DEFAULT_ENDPOINT = 'https://api.stepfun.com/step_plan/v1';
const STANDARD_ENDPOINT = 'https://api.stepfun.com/v1';
const DEFAULT_IMAGE_MODEL = 'step-image-edit-2';
const DEFAULT_TTS_MODEL = 'stepaudio-2.5-tts';
const DEFAULT_TTS_VOICE = 'cixingnansheng';
const DEFAULT_ASR_MODEL = 'stepaudio-2.5-asr';

type StepFunImageData = {
  url?: string;
  b64_json?: string;
  finish_reason?: string;
  seed?: number;
};

type StepFunTTSModel = 'step-tts-mini' | 'step-tts-2' | 'stepaudio-2.5-tts';

const STEPFUN_TTS_MODELS = new Set<string>([
  'step-tts-mini',
  'step-tts-2',
  'stepaudio-2.5-tts',
]);

const MIME_TO_AUDIO_EXT: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/pcm': 'pcm',
  'application/octet-stream': 'mp3',
};

const FFMPEG_BINARY = process.env.FFMPEG_PATH || ffmpegInstaller.path || 'ffmpeg';

/**
 * StepAudio's ASR endpoint expects a real WAV/PCM payload for browser
 * recordings. MediaRecorder commonly emits WebM/Opus, so normalize those
 * bytes before building the JSON request. The temporary directory is removed
 * in all cases, including ffmpeg failures.
 */
export async function transcodeAudioBufferToWav(
  buffer: Buffer,
  sourceExtension = '.webm',
  ffmpegPath = FFMPEG_BINARY
): Promise<Buffer> {
  if (!buffer.length) throw new Error('音频文件为空');

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stepfun-asr-'));
  const safeExtension = /^\.[a-z0-9]+$/iu.test(sourceExtension) ? sourceExtension.toLowerCase() : '.webm';
  const inputPath = path.join(tempDir, `input${safeExtension}`);
  const outputPath = path.join(tempDir, 'output.wav');

  try {
    await fs.promises.writeFile(inputPath, buffer);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        ffmpegPath,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-nostdin',
          '-y',
          '-i',
          inputPath,
          '-vn',
          '-map',
          '0:a:0',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-sample_fmt',
          's16',
          '-c:a',
          'pcm_s16le',
          '-f',
          'wav',
          outputPath,
        ],
        { windowsHide: true }
      );
      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.once('error', (error) => reject(error));
      child.once('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`音频转码失败（ffmpeg ${code ?? 'unknown'}）: ${stderr.slice(0, 500)}`));
        }
      });
    });

    const wav = await fs.promises.readFile(outputPath);
    if (!wav.length) throw new Error('音频转码结果为空');
    return wav;
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export class StepFunProvider extends BaseProvider {
  readonly name = 'stepfun';
  readonly supportedModes = [
    'text_to_image',
    'image_to_image',
    'image_edit',
    'text_to_audio',
    'audio-generation',
    'asr',
    'chat',
    'realtime',
  ];

  protected getDefaultEndpoint(): string {
    return DEFAULT_ENDPOINT;
  }

  private getBaseEndpoint(config: ApiProviderConfig): string {
    return this.getEndpoint(config).replace(/\/+$/, '');
  }

  private toStepPlanEndpoint(baseEndpoint: string): string {
    const normalized = baseEndpoint.replace(/\/+$/, '');
    if (normalized.endsWith('/step_plan/v1')) return normalized;
    if (normalized.endsWith('/v1')) return normalized.replace(/\/v1$/, '/step_plan/v1');
    return `${normalized}/step_plan/v1`;
  }

  private toStandardEndpoint(baseEndpoint: string): string {
    const normalized = baseEndpoint.replace(/\/+$/, '');
    if (normalized.endsWith('/step_plan/v1')) return normalized.replace(/\/step_plan\/v1$/, '/v1');
    if (normalized.endsWith('/v1')) return normalized;
    return `${normalized}/v1`;
  }

  private getStepPlanEndpoint(config: ApiProviderConfig): string {
    return this.toStepPlanEndpoint(this.getBaseEndpoint(config));
  }

  private getStandardEndpoint(config: ApiProviderConfig): string {
    const configuredEndpoint = this.getBaseEndpoint(config);
    if (configuredEndpoint.endsWith('/step_plan/v1') || configuredEndpoint.endsWith('/v1')) {
      return this.toStandardEndpoint(configuredEndpoint);
    }
    return STANDARD_ENDPOINT;
  }

  private getTTSBaseEndpoint(model: StepFunTTSModel, config: ApiProviderConfig): string {
    return model === 'stepaudio-2.5-tts'
      ? this.getStepPlanEndpoint(config)
      : this.getStandardEndpoint(config);
  }

  private resolveSize(params: ImageParams): string | undefined {
    const raw = String((params as any).imageSize || params.pixelResolution || '').trim();
    const supportedSizes = new Set(['1024x1024', '768x1360', '896x1184', '1360x768', '1184x896']);
    if (supportedSizes.has(raw)) return raw;

    const aspectRatio = String(params.resolution || '').trim();
    const tier = raw.toLowerCase();
    const sizeMap: Record<string, Record<string, string>> = {
      '1:1': { '1k': '1024x1024', '2k': '1024x1024' },
      '16:9': { '1k': '768x1360', '2k': '768x1360' },
      '9:16': { '1k': '1360x768', '2k': '1360x768' },
      '9:21': { '1k': '1360x768', '2k': '1360x768' },
      '21:9': { '1k': '768x1360', '2k': '768x1360' },
      '4:3': { '1k': '896x1184', '2k': '896x1184' },
      '3:4': { '1k': '1184x896', '2k': '1184x896' },
    };

    if (aspectRatio && sizeMap[aspectRatio]) {
      return sizeMap[aspectRatio][tier] || sizeMap[aspectRatio]['1k'];
    }

    return undefined;
  }

  private buildJsonBody(params: ImageParams): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: params.model || DEFAULT_IMAGE_MODEL,
      prompt: params.prompt,
      response_format: 'url',
    };

    const size = this.resolveSize(params);
    if (size) body.size = size;
    // StepFun step-image-edit-2 当前单次请求只允许生成 1 张；多张由 UnifiedApiService 拆分。
    body.n = 1;
    if (params.seed !== undefined && params.seed !== -1) body.seed = params.seed;
    if (params.steps) body.steps = params.steps;
    // step-image-edit-2 不支持 cfg_scale 参数（API 会返回 guidance_scale not valid 错误）
    // if (params.cfgStrength) body.cfg_scale = params.cfgStrength;
    if (params.negativePrompt) body.negative_prompt = params.negativePrompt;

    return body;
  }

  private async requestJson(endpoint: string, body: Record<string, unknown>, config: ApiProviderConfig): Promise<any> {
    return this.apiPost(endpoint, body, this.getAuthHeaders(config), 120000);
  }

  private async resolveReferenceImage(reference: string): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const dataMatch = reference.match(/^data:(image\/[^;]+);base64,(.+)$/u);
    if (dataMatch?.[2]) {
      const ext = dataMatch[1].split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      return {
        buffer: Buffer.from(dataMatch[2], 'base64'),
        contentType: dataMatch[1],
        filename: `reference.${ext}`,
      };
    }

    if (/^https?:\/\//iu.test(reference)) {
      const response = await axios.get(reference, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'image/*,*/*;q=0.8',
        },
      });
      const contentType = String(response.headers['content-type'] || 'image/png').split(';')[0] || 'image/png';
      const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      return {
        buffer: Buffer.from(response.data),
        contentType,
        filename: `reference.${ext}`,
      };
    }

    throw new Error('StepFun 图片编辑需要可读取的参考图');
  }

  private async requestMultipart(endpoint: string, params: ImageParams, config: ApiProviderConfig): Promise<any> {
    const form = new FormData();
    form.append('model', params.model || DEFAULT_IMAGE_MODEL);
    form.append('prompt', params.prompt);
    form.append('response_format', 'url');
    if (params.seed !== undefined && params.seed !== -1) form.append('seed', String(params.seed));
    if (params.steps) form.append('steps', String(params.steps));
    // step-image-edit-2 不支持 cfg_scale 参数（API 会返回 guidance_scale not valid 错误）
    // if (params.cfgStrength) form.append('cfg_scale', String(params.cfgStrength));
    if (params.negativePrompt) form.append('negative_prompt', params.negativePrompt);
    if ((params as any).textMode !== undefined) form.append('text_mode', String(Boolean((params as any).textMode)));

    const reference = await this.resolveReferenceImage(params.referenceImageUrl || '');

    form.append('image', reference.buffer, {
      filename: reference.filename,
      contentType: reference.contentType,
    });

    const response = await axios.post(endpoint, form, {
      headers: {
        ...form.getHeaders(),
        ...this.getAuthHeaders(config),
      },
      timeout: 120000,
    });

    return response.data;
  }

  private extractImageUrl(data: any): string | undefined {
    const first = Array.isArray(data?.data) ? data.data[0] as StepFunImageData : undefined;
    const value = first?.url || first?.b64_json || data?.url || data?.imageUrl;
    return typeof value === 'string' && value ? value : undefined;
  }

  private normalizeTTSModel(model?: string): StepFunTTSModel {
    const normalized = String(model || DEFAULT_TTS_MODEL).trim();
    if (STEPFUN_TTS_MODELS.has(normalized)) return normalized as StepFunTTSModel;
    return DEFAULT_TTS_MODEL;
  }

  private normalizeAudioFormat(format?: string): 'mp3' | 'wav' | 'flac' | 'opus' | 'pcm' {
    const normalized = String(format || 'mp3').toLowerCase();
    if (normalized === 'wav' || normalized === 'flac' || normalized === 'opus' || normalized === 'pcm') {
      return normalized;
    }
    return 'mp3';
  }

  private buildTTSBody(params: AudioParams): Record<string, unknown> {
    const raw = params as AudioParams & Record<string, unknown>;
    const model = this.normalizeTTSModel(params.model);
    const text = String(params.text || raw.previewText || raw.designPreviewText || '').trim();
    if (!text) throw new Error('请输入要合成的文本');

    // StepFun 仅支持 8000/16000/22050/24000/44100/48000
    const VALID_SAMPLE_RATES = [8000, 16000, 22050, 24000, 44100, 48000];
    const requestedRate = typeof params.sampleRate === 'number' ? params.sampleRate : 24000;
    const sampleRate = VALID_SAMPLE_RATES.includes(requestedRate) ? requestedRate : 24000;

    const body: Record<string, unknown> = {
      model,
      input: text.slice(0, 1000),
      voice: params.voiceId || raw.voice || DEFAULT_TTS_VOICE,
      response_format: this.normalizeAudioFormat(params.format),
      speed: typeof params.speed === 'number' ? params.speed : 1,
      volume: typeof params.vol === 'number' ? Math.min(2, Math.max(0.1, params.vol)) : 1,
      sample_rate: sampleRate,
    };

    const instruction = String(raw.instruction || params.prompt || '').trim();
    if (model === 'stepaudio-2.5-tts' && instruction) {
      body.instruction = instruction.slice(0, 200);
    }

    if (params.pronunciationDict?.tone?.length) {
      body.pronunciation_map = {
        tone: params.pronunciationDict.tone,
      };
    }

    if (raw.returnUrl === true) {
      body.return_url = true;
    }

    return body;
  }

  private saveAudioBuffer(buffer: Buffer, format?: string, contentType?: string): string {
    if (!buffer.length) throw new Error('StepFun 返回的音频数据为空');

    const audioDir = path.join(process.cwd(), 'public', 'audio');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

    const contentMime = String(contentType || '').split(';')[0].toLowerCase();
    const ext = this.normalizeAudioFormat(format || MIME_TO_AUDIO_EXT[contentMime] || 'mp3');
    const filename = `stepfun_tts_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    fs.writeFileSync(path.join(audioDir, filename), buffer);
    logger.info('[StepFun] 音频已保存', {
      file: filename,
      sizeKb: Number((buffer.length / 1024).toFixed(1)),
    });
    return `/audio/${filename}`;
  }

  private extractReturnedAudioUrl(data: any): string | undefined {
    const value =
      data?.url ||
      data?.audio_url ||
      data?.data?.url ||
      data?.data?.audio_url ||
      data?.data?.[0]?.url;
    return typeof value === 'string' && value ? value : undefined;
  }

  private mimeFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.mp3' || ext === '.mpeg') return 'audio/mpeg';
    if (ext === '.wav') return 'audio/wav';
    if (ext === '.flac') return 'audio/flac';
    if (ext === '.ogg') return 'audio/ogg';
    if (ext === '.opus') return 'audio/opus';
    if (ext === '.webm') return 'audio/webm';
    if (ext === '.m4a') return 'audio/mp4';
    if (ext === '.aac') return 'audio/aac';
    if (ext === '.pcm') return 'audio/pcm';
    return 'audio/wav';
  }

  private normalizeMimeType(mimeType: string): string {
    return String(mimeType || 'audio/wav').split(';')[0].trim().toLowerCase();
  }

  private shouldTranscodeForAsr(mimeType: string): boolean {
    const cleanMime = this.normalizeMimeType(mimeType);
    return cleanMime === 'audio/webm' || cleanMime === 'video/webm' || cleanMime === 'audio/opus';
  }

  private audioExtensionForMime(mimeType: string, input?: string): string {
    const cleanMime = this.normalizeMimeType(mimeType);
    const mapped = MIME_TO_AUDIO_EXT[cleanMime];
    if (mapped) return `.${mapped}`;
    const ext = input ? path.extname(input).toLowerCase() : '';
    return /^\.[a-z0-9]+$/iu.test(ext) ? ext : '.webm';
  }

  private resolveLocalAudioPath(input: string): string {
    const normalized = input.replace(/^\/+/, '');
    const uploadRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const candidates = [
      path.isAbsolute(input) ? input : '',
      normalized.startsWith('uploads/') ? path.join(uploadRoot, normalized.slice('uploads/'.length)) : '',
      path.join(process.cwd(), 'public', normalized),
      path.join(process.cwd(), normalized),
    ].filter(Boolean);
    const filePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!filePath) throw new Error('未找到本地音频文件');
    return filePath;
  }

  private async resolveAudioData(input: string): Promise<{ base64: string; mimeType: string }> {
    const dataMatch = input.match(/^data:((?:audio|video)\/[^;,]+)(?:;[^;,]*)*;base64,([\s\S]+)$/u);
    let sourceInput = input;
    let sourceExtension = path.extname(input);
    if (dataMatch?.[2]) {
      const sourceMimeType = this.normalizeMimeType(dataMatch[1]);
      const inputBuffer = Buffer.from(dataMatch[2].replace(/[\r\n\s]/gu, ''), 'base64');
      if (!inputBuffer.length) throw new Error('音频文件为空');
      if (this.shouldTranscodeForAsr(sourceMimeType)) {
        const wavBuffer = await transcodeAudioBufferToWav(
          inputBuffer,
          this.audioExtensionForMime(sourceMimeType, sourceInput)
        );
        return { base64: wavBuffer.toString('base64'), mimeType: 'audio/wav' };
      }
      return { base64: inputBuffer.toString('base64'), mimeType: sourceMimeType };
    }

    let buffer: Buffer;
    let mimeType = this.mimeFromPath(input);

    if (/^https?:\/\//iu.test(input)) {
      const response = await axios.get<ArrayBuffer>(input, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      buffer = Buffer.from(response.data);
      const responseMimeType = response.headers['content-type'];
      mimeType = Array.isArray(responseMimeType)
        ? String(responseMimeType[0] || mimeType)
        : responseMimeType
          ? String(responseMimeType)
          : mimeType;
      sourceInput = input;
      sourceExtension = path.extname(new URL(input).pathname);
    } else {
      const filePath = this.resolveLocalAudioPath(input);
      buffer = fs.readFileSync(filePath);
      mimeType = this.mimeFromPath(filePath);
      sourceInput = filePath;
      sourceExtension = path.extname(filePath);
    }

    if (buffer.length === 0) throw new Error('音频文件为空');
    mimeType = this.normalizeMimeType(mimeType);
    if (this.shouldTranscodeForAsr(mimeType)) {
      buffer = await transcodeAudioBufferToWav(
        buffer,
        this.audioExtensionForMime(mimeType, sourceExtension || sourceInput)
      );
      mimeType = 'audio/wav';
    }
    return {
      base64: buffer.toString('base64'),
      mimeType,
    };
  }

  private getASRFormat(mimeType: string): Record<string, unknown> {
    const cleanMime = mimeType.split(';')[0].toLowerCase();
    if (cleanMime.includes('mpeg') || cleanMime.includes('mp3')) return { type: 'mp3' };
    if (cleanMime.includes('ogg')) return { type: 'ogg' };
    if (cleanMime.includes('pcm')) {
      return {
        type: 'pcm',
        codec: 'pcm_s16le',
        rate: 16000,
        bits: 16,
        channel: 1,
      };
    }
    return { type: 'wav' };
  }

  private extractSSEPayloads(sseText: string): any[] {
    return sseText
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace(/^data:\s*/u, ''))
      .filter((payload) => payload && payload !== '[DONE]')
      .map((payload) => {
        try {
          return JSON.parse(payload);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  private extractASRTextFromEvents(events: any[]): string {
    const doneText = events
      .filter((event) => event?.type === 'transcript.text.done' && typeof event.text === 'string')
      .map((event) => event.text)
      .pop();
    if (doneText) return doneText;

    return events
      .filter((event) => event?.type === 'transcript.text.delta' && typeof event.delta === 'string')
      .map((event) => event.delta)
      .join('');
  }

  async recognizeAudio(
    audioUrl: string,
    language: string | undefined,
    config: ApiProviderConfig,
    model?: string
  ): Promise<GenerationResult> {
    try {
      const asrModel = String(model || DEFAULT_ASR_MODEL).trim() || DEFAULT_ASR_MODEL;
      const endpoint = `${this.getStepPlanEndpoint(config)}/audio/asr/sse`;
      const audio = await this.resolveAudioData(audioUrl);
      const body = {
        audio: {
          data: audio.base64,
          input: {
            transcription: {
              model: asrModel,
              language: language && language !== 'auto' ? language : 'zh',
              enable_itn: true,
              enable_timestamp: false,
            },
            format: this.getASRFormat(audio.mimeType),
          },
        },
      };

      const response = await axios.post(endpoint, body, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...this.getAuthHeaders(config),
        },
        responseType: 'text',
        timeout: 120000,
        validateStatus: () => true,
      });

      const textResponse = typeof response.data === 'string' ? response.data : String(response.data || '');
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`StepFun ASR 调用失败: HTTP ${response.status} ${textResponse.substring(0, 500)}`);
      }

      const events = this.extractSSEPayloads(textResponse);
      const errorEvent = events.find((event) => event?.type === 'error' || event?.type === 'transcript.text.error');
      if (errorEvent) {
        throw new Error(errorEvent.message || errorEvent.error?.message || 'StepFun ASR 返回错误事件');
      }

      const text = this.extractASRTextFromEvents(events);
      return {
        taskId: events[0]?.meta?.session_id || `stepfun_asr_${Date.now()}`,
        status: 'completed',
        provider: this.name,
        model: 'stepaudio-2.5-asr',
        result: {
          metadata: {
            text,
            events,
          },
        },
      };
    } catch (error: unknown) {
      logger.error('[StepFun] 语音识别失败:', error);
      return this.handleProviderError(error);
    }
  }

  async generateAudio(params: AudioParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const model = this.normalizeTTSModel(params.model);
      const endpoint = `${this.getTTSBaseEndpoint(model, config)}/audio/speech`;
      const body = this.buildTTSBody({ ...params, model });
      const response = await axios.post(endpoint, body, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(config),
        },
        responseType: 'arraybuffer',
        timeout: 120000,
        validateStatus: () => true,
      });

      const contentType = String(response.headers['content-type'] || '');
      const buffer = Buffer.from(response.data);

      if (response.status < 200 || response.status >= 300) {
        const errorText = buffer.toString('utf8').substring(0, 500);
        throw new Error(`StepFun TTS 调用失败: HTTP ${response.status} ${errorText}`);
      }

      if (contentType.includes('application/json')) {
        const data = JSON.parse(buffer.toString('utf8'));
        const returnedUrl = this.extractReturnedAudioUrl(data);
        if (returnedUrl) {
          return {
            taskId: data.id || `stepfun_tts_${Date.now()}`,
            status: 'completed',
            provider: this.name,
            model,
            result: {
              audioUrl: returnedUrl,
              url: returnedUrl,
              metadata: data,
            },
          };
        }
        throw new Error(`StepFun TTS 未返回音频地址: ${JSON.stringify(data).substring(0, 300)}`);
      }

      const audioUrl = this.saveAudioBuffer(buffer, String(body.response_format || 'mp3'), contentType);
      return {
        taskId: `stepfun_tts_${Date.now()}`,
        status: 'completed',
        provider: this.name,
        model,
        result: {
          audioUrl,
          url: audioUrl,
          metadata: {
            model,
            contentType,
            size: buffer.length,
          },
        },
      };
    } catch (error: unknown) {
      logger.error('[StepFun] 语音合成失败:', error);
      return this.handleProviderError(error);
    }
  }

  async generateImage(params: ImageParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      // StepFun 图片生成 API 仅在标准 /v1 端点可用（非 step_plan/v1）
      const baseEndpoint = this.getStandardEndpoint(config);
      const referenceImages = Array.isArray(params.referenceImages) ? params.referenceImages.filter(Boolean) : [];
      const referenceImageUrl = params.referenceImageUrl || referenceImages[0];
      const hasReference = !!referenceImageUrl;
      const endpoint = hasReference
        ? `${baseEndpoint}/images/edits`
        : `${baseEndpoint}/images/generations`;

      if (!params.prompt?.trim()) {
        return this.makeFailedTaskResult('', new Error('StepFun 图片生成需要非空 prompt'));
      }

      let data: any;
      if (hasReference) {
        data = await this.requestMultipart(endpoint, { ...params, referenceImageUrl }, config);
      } else {
        const body = this.buildJsonBody(params);
        data = await this.requestJson(endpoint, body, config);
      }

      const imageUrl = this.extractImageUrl(data);
      if (!imageUrl) {
        return this.makeFailedTaskResult('', new Error(`StepFun 未返回有效图片: ${JSON.stringify(data).substring(0, 300)}`));
      }

      logger.info(`[StepFun] 图片生成完成: model=${params.model || DEFAULT_IMAGE_MODEL}, mode=${hasReference ? 'image_to_image' : 'text_to_image'}`);
      return {
        taskId: data.id || `stepfun-${Date.now()}`,
        status: 'completed',
        provider: this.name,
        model: params.model || DEFAULT_IMAGE_MODEL,
        result: {
          url: imageUrl,
          imageUrl,
          urls: Array.isArray(data?.data)
            ? data.data.map((item: StepFunImageData) => item.url || item.b64_json).filter(Boolean)
            : [imageUrl],
          metadata: data,
        },
      };
    } catch (error: unknown) {
      logger.error('[StepFun] 图片生成失败:', error);
      return this.handleProviderError(error);
    }
  }
}
