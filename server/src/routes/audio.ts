import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { websocketPushService } from '../services/websocket-push-service';
import { decryptProviderSecrets, getApiProviderConfig } from './ai-provider';
import { autoSaveService } from '../services/auto-save-service';
import { unifiedApiService } from '../services/unified-service';
import { StepFunProvider } from '../services/stepfun-provider';
import { AudioParams } from '../types/api';
import { logger } from '../utils/logger';
import {
  audioUploadExtension,
  normalizeVoiceChatHistory,
  normalizeVoiceChatSessionId,
  resolveVoiceChatAudioSource,
  VOICE_CHAT_MAX_HISTORY_MESSAGES,
  VOICE_CHAT_MAX_MESSAGE_LENGTH,
  type VoiceChatHistoryMessage,
} from '../services/voice-chat-utils';
import {
  buildGenerationIdempotencyKey,
  buildReusedGenerationResponse,
  createIdempotentGenerationTask,
} from '../services/generation-idempotency';
import { fetchRemoteBuffer } from '../utils/safe-remote-fetch';

export const audioRouter = Router();
const MUSIC_DIR = path.join(process.cwd(), 'public', 'music');
const GENERATED_AUDIO_DIR = path.join(process.cwd(), 'public', 'audio');
const DEFAULT_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

audioRouter.get('/files/:kind/:filename', (req, res, next) => {
  try {
    const kind = req.params.kind;
    const filename = req.params.filename;
    const baseDir = kind === 'music' ? MUSIC_DIR : kind === 'audio' ? GENERATED_AUDIO_DIR : null;

    if (!baseDir) {
      throw new AppError('不支持的音频目录', 404);
    }

    if (
      filename !== path.basename(filename) ||
      !/^[a-zA-Z0-9._-]+\.(mp3|wav|ogg|flac|aac|m4a|webm|opus|pcm)$/i.test(filename)
    ) {
      throw new AppError('音频文件名无效', 400);
    }

    const resolvedBaseDir = path.resolve(baseDir);
    const resolvedFilePath = path.resolve(baseDir, filename);
    if (!resolvedFilePath.startsWith(`${resolvedBaseDir}${path.sep}`)) {
      throw new AppError('音频文件路径无效', 400);
    }

    if (!fs.existsSync(resolvedFilePath)) {
      throw new AppError('音频文件不存在', 404);
    }

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(resolvedFilePath);
  } catch (error) {
    next(error);
  }
});

audioRouter.use(authenticate);

// ===== Multer 配置（音频上传） =====
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const audioByExtension = /\.(webm|ogg|opus|wav|mp3|m4a|aac|flac)$/u.test(extension);
    const isAudioUpload =
      file.mimetype.startsWith('audio/') ||
      (file.mimetype === 'video/webm' && extension === '.webm') ||
      (file.mimetype === 'application/octet-stream' && audioByExtension);
    if (isAudioUpload) {
      cb(null, true);
    } else {
      cb(new Error('仅允许上传音频文件'));
    }
  },
});

// ===== MiniMax API 配置（从数据库 ProviderConfig 统一获取） =====
const FALLBACK_MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const FALLBACK_MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com';

let cachedMinimaxConfig: { apiKey: string; baseUrl: string; updatedAt: number } | null = null;
const CONFIG_CACHE_TTL = 5 * 60 * 1000;
const stepFunProvider = new StepFunProvider();

async function getMinimaxConfig(): Promise<{ apiKey: string; baseUrl: string }> {
  const now = Date.now();
  if (cachedMinimaxConfig && now - cachedMinimaxConfig.updatedAt < CONFIG_CACHE_TTL) {
    return { apiKey: cachedMinimaxConfig.apiKey, baseUrl: cachedMinimaxConfig.baseUrl };
  }

  try {
    const providerConfig = await prisma.providerConfig.findUnique({
      where: { provider: 'minimax' },
    });

    if (providerConfig && providerConfig.isActive) {
      const secrets = decryptProviderSecrets(providerConfig);
      if (secrets.apiKey) {
        cachedMinimaxConfig = {
          apiKey: secrets.apiKey,
          baseUrl: providerConfig.endpoint
            ? providerConfig.endpoint.replace(/\/v1\/?$/, '')
            : 'https://api.minimaxi.com',
          updatedAt: now,
        };
        return { apiKey: cachedMinimaxConfig.apiKey, baseUrl: cachedMinimaxConfig.baseUrl };
      }
    }
  } catch (err) {
    logger.error(
      '[AudioRouter] 从数据库获取 MiniMax 配置失败，使用环境变量回退:',
      err instanceof Error ? err.message : String(err)
    );
  }

  if (FALLBACK_MINIMAX_API_KEY) {
    return { apiKey: FALLBACK_MINIMAX_API_KEY, baseUrl: FALLBACK_MINIMAX_BASE_URL };
  }

  throw new AppError('音频服务未配置 (MiniMax API Key 未设置)', 503);
}

type AudioProviderName = 'minimax' | 'stepfun';

function resolveAudioProvider(body: Record<string, unknown>, model?: string): AudioProviderName {
  const explicitProvider = String(body.provider || body.modelProvider || '').toLowerCase();
  if (explicitProvider === 'stepfun' || explicitProvider === 'step') return 'stepfun';
  if (model?.startsWith('step') || model === 'step-1o-audio') return 'stepfun';
  return 'minimax';
}

async function getStepFunConfig(): Promise<{ apiKey: string; baseUrl: string }> {
  // 优先使用环境变量中的主密钥
  const envKey = process.env.STEPFUN_API_KEY || process.env.STEPFUN_API_KEY_2 || '';
  if (envKey) {
    return {
      apiKey: envKey,
      baseUrl: process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/step_plan/v1',
    };
  }

  // 回退到数据库配置
  try {
    const providerConfig = await getApiProviderConfig('stepfun');
    if (providerConfig?.apiKey) {
      return {
        apiKey: providerConfig.apiKey,
        baseUrl:
          providerConfig.endpoint ||
          process.env.STEPFUN_BASE_URL ||
          'https://api.stepfun.com/step_plan/v1',
      };
    }
  } catch (err) {
    logger.warn('[AudioRouter] 获取 StepFun 配置失败，使用环境变量回退', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  throw new AppError('音频服务未配置 (StepFun API Key 未设置)', 503);
}

async function getAudioProviderConfig(
  provider: AudioProviderName
): Promise<{ apiKey: string; endpoint: string }> {
  if (provider === 'stepfun') {
    const { apiKey, baseUrl } = await getStepFunConfig();
    return { apiKey, endpoint: baseUrl };
  }
  const { apiKey, baseUrl } = await getMinimaxConfig();
  return { apiKey, endpoint: baseUrl };
}

export async function generateVoiceChatAudio(
  text: string
): Promise<string> {
  const normalizedText = text.trim().slice(0, 600);
  if (!normalizedText) throw new AppError('语音文本不能为空', 400);

  const config = await getAudioProviderConfig('stepfun');
  const audioParams: AudioParams & Record<string, unknown> = {
    provider: 'stepfun',
    model: 'step-tts-2',
    mode: 'tts',
    text: normalizedText,
    voiceId: 'linjiajiejie',
    speed: 1,
    vol: 0.92,
    format: 'mp3',
    instruction: '可爱灵动的年轻女声，略带童声感，语调明亮亲切，像贴心的小伙伴在聊天，发音自然清晰。',
  };
  const result = await unifiedApiService.generateAudio(audioParams, config);

  if (result.status === 'failed') {
    throw new AppError(result.error || '大模型语音生成失败', 502);
  }

  const generatedAudioUrl = result.result?.audioUrl || result.result?.url;
  if (!generatedAudioUrl) {
    throw new AppError('大模型语音未返回音频地址', 502);
  }

  return generatedAudioUrl;
}

// ===== 类型定义 =====
interface MiniMaxBaseResp {
  status_code: number;
  status_msg?: string;
}

interface MiniMaxAPIResult {
  base_resp?: MiniMaxBaseResp;
  data?: MiniMaxResponseData;
  output?: MiniMaxResponseData;
  task_id?: string;
  voice_id?: string;
  status?: string;
  file?: { file_id: number };
}

interface MiniMaxResponseData {
  status?: string | number;
  status_msg?: string;
  task_id?: string;
  voice_id?: string;
  image_url?: string;
  image_urls?: string[];
  audio_url?: string;
  extra_audio_url?: string;
  trial_audio?: string;
  audio?: string;
  extra_audio?: string;
  [key: string]: unknown;
}

function getMiniMaxDataObj(result: MiniMaxAPIResult): MiniMaxResponseData {
  return {
    ...(result.output ?? {}),
    ...(result.data ?? {}),
    status: result.data?.status ?? result.output?.status ?? result.status,
    status_msg:
      result.data?.status_msg ?? result.output?.status_msg ?? result.base_resp?.status_msg,
    task_id: result.data?.task_id ?? result.output?.task_id ?? result.task_id,
    voice_id: result.data?.voice_id ?? result.output?.voice_id ?? result.voice_id,
  };
}

// ===== Zod 验证 =====

const ttsV2Schema = z
  .object({
    model: z.string().optional().default('speech-2.8-hd'),
    text: z.string().optional().default(''),
    prompt: z.string().optional(),
    lyrics: z.string().optional(),
    voiceId: z.string().optional().default('male-qn-qingse'),
    speed: z.number().min(0.5).max(2.0).optional().default(1.0),
    pitch: z.number().min(-12).max(12).optional().default(0),
    volume: z.number().min(0).max(1).optional().default(1.0),
    // MiniMax 支持 0.1-10；StepFun 会在 provider 适配器中收敛到 0.1-2。
    vol: z.number().min(0.1).max(10).optional(),
    audioFormat: z.string().optional().default('mp3'),
    sampleRate: z.number().optional().default(32000),
    bitrate: z.number().optional().default(128000),
    channel: z.number().optional().default(1),
    emotion: z.string().optional(),
    instruction: z.string().optional(),
    languageBoost: z.string().optional(),
    subtitleEnable: z.boolean().optional().default(false),
    outputFormat: z.enum(['url', 'hex']).optional().default('url'),
    aigcWatermark: z.boolean().optional().default(false),
    pronunciationDict: z.object({ tone: z.array(z.string()) }).optional(),
    voiceModify: z
      .object({
        pitch: z.number().optional(),
        intensity: z.number().optional(),
        timbre: z.number().optional(),
        soundEffects: z.string().optional(),
      })
      .optional(),
    timbreWeights: z
      .array(
        z.object({
          voice_id: z.string(),
          weight: z.number().min(0).max(100),
        })
      )
      .optional(),
    // P1 修复 BUG-S5：与前端 DEFAULT_PARAMS 对齐，显式声明 stream 字段
    stream: z.boolean().optional().default(false),
    // P1 修复 BUG-S5：显式声明 mode 字段（tts/clone/design 等），后端通过 req.body.mode 区分
    mode: z.enum(['tts', 'clone', 'design', 'async_tts', 'voice_management', 'music']).optional(),
    // P1 修复 BUG-S5：clone 模式相关字段
    cloneFileId: z.string().optional(),
    clonePromptText: z.string().optional(),
    // P1 修复 BUG-S5：design 模式相关字段
    voiceDesignPrompt: z.string().optional(),
    voiceDesignGender: z.enum(['male', 'female']).optional(),
    voiceDesignAccent: z.string().optional(),
    voiceDesignAge: z.number().optional(),
    // P1 修复 BUG-S5：参考音频/语音数据字段
    referenceAudioUrl: z.string().optional(),
    referenceAudioDataUrl: z.string().optional(),
    voiceAudioDataUrl: z.string().optional(),
  })
  .passthrough();

const voiceCloneSchema = z.object({
  file_id: z.number({ required_error: '请先上传音频文件' }),
  voice_id: z.string().min(1, 'voice_id 不能为空'),
  prompt_audio: z.number().optional(),
  prompt_text: z.string().optional(),
  need_noise_reduction: z.boolean().optional().default(false),
  need_volume_normalization: z.boolean().optional().default(false),
});

const voiceDesignSchema = z
  .object({
    prompt: z.string().optional(),
    text: z.string().optional(),
    description: z.string().optional(),
    preview_text: z.string().optional(),
    voice_id: z.string().optional(),
  })
  .refine((data) => data.prompt || data.text, {
    message: '请输入音色描述 (prompt 或 text)',
  });

// ===== 辅助函数 =====

async function callMiniMaxAPI(
  path: string,
  body: any,
  timeoutMs: number = 120000
): Promise<MiniMaxAPIResult> {
  const { apiKey, baseUrl } = await getMinimaxConfig();
  const url = `${baseUrl}${path}`;
  logger.info(`[AudioRouter] callMiniMaxAPI: POST ${url} (timeout: ${timeoutMs}ms)`);
  logger.info(`[AudioRouter] 请求体:`, JSON.stringify(body, null, 2));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new AppError(
        `MiniMax API 请求超时 (${timeoutMs / 1000}秒)，音乐生成可能需要较长时间，请稍后重试`,
        504
      );
    }
    throw new AppError(`MiniMax API 网络错误: ${err.message}`, 502);
  }
  clearTimeout(timeoutId);

  const responseText = await response.text();
  logger.info(
    `[AudioRouter] MiniMax API 响应 (${response.status}):`,
    responseText.substring(0, 500)
  );

  if (!response.ok) {
    logger.error(`[AudioRouter] MiniMax API 错误 (${path}):`, response.status, responseText);

    // Check if the response contains specific error information
    let errorDetails = '';
    try {
      const errorJson = JSON.parse(responseText);
      if (errorJson.error && errorJson.error.message) {
        errorDetails = errorJson.error.message;
      }
    } catch (e) {
      // Not JSON, ignore
    }

    throw new AppError(
      `MiniMax API 调用失败: ${response.status} ${errorDetails ? '- ' + errorDetails : ''}`,
      502
    );
  }

  return JSON.parse(responseText) as MiniMaxAPIResult;
}

async function uploadFileToMiniMax(
  fileBuffer: Buffer,
  fileName: string,
  purpose: string = 'music_cover'
): Promise<string> {
  const { apiKey, baseUrl } = await getMinimaxConfig();
  const url = `${baseUrl}/v1/files/upload`;
  logger.info(`[AudioRouter] uploadFileToMiniMax: POST ${url}, fileName: ${fileName}`);

  const formData = new (globalThis as any).FormData();
  formData.append('file', new (globalThis as any).Blob([fileBuffer]), fileName);
  formData.append('purpose', purpose);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const responseText = await response.text();
  logger.info(`[AudioRouter] 文件上传响应 (${response.status}):`, responseText.substring(0, 500));

  if (!response.ok) {
    throw new AppError(
      `MiniMax 文件上传失败: ${response.status} - ${responseText.substring(0, 200)}`,
      502
    );
  }

  const result = JSON.parse(responseText);
  const fileId = result?.file?.file_id;
  if (!fileId) {
    throw new AppError(`MiniMax 文件上传未返回 file_id: ${responseText.substring(0, 200)}`, 502);
  }

  logger.info(`[AudioRouter] 文件上传成功, file_id: ${fileId}`);
  return fileId;
}

async function callMiniMaxGET(path: string): Promise<MiniMaxAPIResult> {
  const { apiKey, baseUrl } = await getMinimaxConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[AudioRouter] MiniMax API GET 错误 (${path}):`, response.status, errorText);
    throw new AppError(`MiniMax API 查询失败: ${response.status}`, 502);
  }

  return response.json() as Promise<MiniMaxAPIResult>;
}

function checkMiniMaxBusinessError(result: MiniMaxAPIResult) {
  if (result.base_resp && result.base_resp.status_code !== 0) {
    throw new AppError(result.base_resp.status_msg || 'MiniMax API 业务错误', 500);
  }
}

function extractAudioUrl(
  result: MiniMaxAPIResult,
  fallbackMimeType: string = 'audio/wav'
): string | null {
  if (result.data?.audio_url) return result.data.audio_url as string;
  if (result.output?.audio_url) return result.output.audio_url as string;
  if (result.data?.audio) {
    const audioStr = result.data.audio as string;
    if (
      audioStr.startsWith('http://') ||
      audioStr.startsWith('https://') ||
      audioStr.startsWith('/music/')
    ) {
      return audioStr;
    }
    try {
      const audioBuffer = Buffer.from(audioStr, 'hex');
      const base64Audio = audioBuffer.toString('base64');
      return `data:${fallbackMimeType};base64,${base64Audio}`;
    } catch {
      throw new AppError('音频数据格式错误', 500);
    }
  }
  return null;
}

function decodeHexAudio(data: any, mimeType: string = 'audio/mpeg'): string {
  const audioStr = data?.audio as string;
  if (!audioStr) throw new AppError('音频数据缺失', 500);
  if (
    audioStr.startsWith('http://') ||
    audioStr.startsWith('https://') ||
    audioStr.startsWith('/music/')
  ) {
    return audioStr;
  }
  try {
    const audioBuffer = Buffer.from(audioStr, 'hex');
    const base64Audio = audioBuffer.toString('base64');
    return `data:${mimeType};base64,${base64Audio}`;
  } catch {
    throw new AppError('音频数据格式错误', 500);
  }
}

function ensureMusicDir(): void {
  if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
  }
}

function saveHexAudioToFile(
  hexStr: string,
  filename: string,
  mimeType: string = 'audio/mpeg'
): string {
  if (!hexStr || hexStr.length === 0) {
    throw new AppError('音频hex数据为空', 500);
  }
  try {
    const audioBuffer = Buffer.from(hexStr, 'hex');
    ensureMusicDir();
    const ext = mimeType === 'audio/mpeg' ? '.mp3' : mimeType === 'audio/wav' ? '.wav' : '.mp3';
    const filePath = path.join(MUSIC_DIR, `${filename}${ext}`);
    fs.writeFileSync(filePath, audioBuffer);
    logger.info(
      `[AudioRouter] 音频已保存: ${filePath} (${(audioBuffer.length / 1024).toFixed(1)} KB)`
    );
    return `/music/${filename}${ext}`;
  } catch (err: unknown) {
    logger.error(
      '[AudioRouter] saveHexAudioToFile 错误:',
      err instanceof Error ? err.message : String(err)
    );
    throw new AppError(
      `音频文件保存失败: ${err instanceof Error ? err.message : String(err)}`,
      500
    );
  }
}

function getPublicAudioUrl(req: AuthRequest, audioPath: string | null | undefined): string | null {
  if (!audioPath) return null;

  const backendBaseUrl = `${req.protocol}://${req.get('host')}`;

  const toApiFileUrl = (kind: 'music' | 'audio', filename: string) =>
    `${backendBaseUrl}/api/v1/audio/files/${kind}/${encodeURIComponent(filename)}`;

  if (audioPath.startsWith('/music/') || audioPath.startsWith('/audio/')) {
    const kind = audioPath.startsWith('/music/') ? 'music' : 'audio';
    const filename = path.basename(audioPath.split('?')[0].split('#')[0]);
    return toApiFileUrl(kind, filename);
  }

  try {
    const parsed = new URL(audioPath);
    const requestHost = (req.get('host') || '').split(':')[0];
    const isLocalAudioHost =
      parsed.host === req.get('host') ||
      parsed.hostname === requestHost ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1';

    if (
      isLocalAudioHost &&
      (parsed.pathname.startsWith('/music/') || parsed.pathname.startsWith('/audio/'))
    ) {
      const kind = parsed.pathname.startsWith('/music/') ? 'music' : 'audio';
      const filename = path.basename(parsed.pathname);
      return `${toApiFileUrl(kind, filename)}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // 非 URL 字符串按外部地址原样处理
  }

  if (
    audioPath.startsWith('http://') ||
    audioPath.startsWith('https://') ||
    audioPath.startsWith('data:')
  ) {
    return audioPath;
  }

  return `${backendBaseUrl}${audioPath}`;
}

// ===== 路由 =====

// 1. 语音合成 (TTS v2)
audioRouter.post('/generate', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const validatedData = ttsV2Schema.parse(req.body);
    const providerName = resolveAudioProvider(req.body, validatedData.model);

    // 获取配置
    const config = await getAudioProviderConfig(providerName);

    // 转换参数
    const audioParams: AudioParams & Record<string, unknown> = {
      provider: providerName,
      model: validatedData.model,
      text: validatedData.text,
      prompt: validatedData.prompt,
      lyrics: validatedData.lyrics,
      mode: (req.body.mode as any) || 'tts',
      voiceId: validatedData.voiceId,
      speed: validatedData.speed,
      pitch: validatedData.pitch,
      vol: validatedData.vol ?? validatedData.volume,
      instruction: validatedData.instruction || req.body.instruction,
      emotion: validatedData.emotion,
      sampleRate: validatedData.sampleRate,
      bitrate: validatedData.bitrate,
      format: validatedData.audioFormat as any,
      channel: validatedData.channel,
      languageBoost: validatedData.languageBoost,
      subtitleEnable: validatedData.subtitleEnable,
      outputFormat: validatedData.outputFormat,
      aigcWatermark: validatedData.aigcWatermark,
      cloneFileId: req.body.cloneFileId,
      clonePromptText: req.body.clonePromptText,
      voiceDesignPrompt: req.body.voiceDesignPrompt,
      voiceDesignGender: req.body.voiceDesignGender,
      voiceDesignAccent: req.body.voiceDesignAccent,
      voiceDesignAge: req.body.voiceDesignAge,
      voiceAudioDataUrl: req.body.voiceAudioDataUrl,
      referenceAudioUrl: req.body.referenceAudioUrl,
      referenceAudioDataUrl: req.body.referenceAudioDataUrl,
    };

    const idempotencyKey = buildGenerationIdempotencyKey({
      userId: req.userId!,
      route: 'audio.generate',
      body: { ...req.body, provider: providerName },
      nodeId: typeof req.body.nodeId === 'string' ? req.body.nodeId : undefined,
    });
    const idempotentTask = await createIdempotentGenerationTask(idempotencyKey, {
      userId: req.userId!,
      type: 'audio',
      provider: providerName,
      model: validatedData.model || String(audioParams.mode || 'tts'),
      status: 'pending',
      prompt:
        validatedData.text.substring(0, 100) ||
        validatedData.prompt?.substring(0, 100) ||
        audioParams.voiceDesignPrompt?.substring(0, 100) ||
        '音色操作',
      params: JSON.stringify({ ...validatedData, ...req.body }),
      progress: 0,
    });
    if (idempotentTask.reused) {
      return res.status(202).json({
        success: true,
        data: buildReusedGenerationResponse(idempotentTask.task),
      });
    }
    const task = idempotentTask.task;

    let result;
    try {
      result = await unifiedApiService.generateAudio(audioParams, config);
    } catch (apiError) {
      await prisma.task
        .update({
          where: { id: task.id },
          data: {
            status: 'failed',
            error: apiError instanceof Error ? apiError.message : String(apiError),
          },
        })
        .catch(() => {});
      throw apiError;
    }

    if (result.status === 'failed') {
      logger.error('[AudioRouter] generateAudio failed:', result.error);
      await prisma.task
        .update({
          where: { id: task.id },
          data: { status: 'failed', error: result.error || '生成失败' },
        })
        .catch(() => {});
      throw new AppError(result.error || '生成失败', 400);
    }

    const audioUrl = result.result?.audioUrl || result.result?.url;
    const isPendingMusicTask =
      audioParams.mode === 'music' && result.status === 'pending' && !!result.taskId;
    if (
      !audioUrl &&
      audioParams.mode !== 'clone' &&
      audioParams.mode !== 'design' &&
      !isPendingMusicTask
    ) {
      throw new AppError('未获取到音频数据', 500);
    }

    // 自动保存素材到对象存储（MinIO）和本地缓存。
    if (audioUrl && !audioUrl.startsWith('data:')) {
      autoSaveService
        .autoSaveUrl(req.userId!, audioUrl, 'audio', `音频_${Date.now()}`)
        .then((savedResult) => {
          if (savedResult.primaryUrl) {
            logger.info(
              `[Audio] 音频已保存: local=${!!savedResult.localUrl}, objectStorage=${!!savedResult.cosUrl}`
            );
          }
        })
        .catch((err) => {
          logger.error(
            '[Audio] 自动保存素材失败:',
            err instanceof Error ? err.message : String(err)
          );
        });
    }

    // 更新任务记录
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: result.status === 'pending' ? 'processing' : 'completed',
        result: JSON.stringify({
          ...(result.result || {}),
          ...(isPendingMusicTask ? { minimaxTaskId: result.taskId } : {}),
        }),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        taskId: task.id,
        status: result.status === 'pending' ? 'processing' : result.status,
        minimaxTaskId: isPendingMusicTask ? result.taskId : undefined,
        audioUrl,
        voiceId: result.result?.voiceId,
        provider: providerName,
        model: validatedData.model,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 13. 音乐封面图片生成状态查询
audioRouter.get('/image-query', async (req: AuthRequest, res, next) => {
  try {
    const taskId = req.query.task_id as string;
    if (!taskId) throw new AppError('task_id 不能为空', 400);

    const backendBaseUrl = `${req.protocol}://${req.get('host')}`;
    const getFullUrl = (relativePath: string | null | undefined) => {
      if (!relativePath) return null;
      if (relativePath.startsWith('http')) return relativePath;
      return `${backendBaseUrl}${relativePath}`;
    };

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) throw new AppError('任务不存在', 404);
    if (task.userId !== req.userId) throw new AppError('无权访问此任务', 403);

    if (task.status === 'completed') {
      const result = (task.result as unknown as Record<string, unknown>) || {};
      return res.json({
        success: true,
        data: {
          taskId: task.id,
          status: 'success',
          imageUrl: getFullUrl(result.imageUrl as string),
        },
      });
    }

    if (task.status === 'failed') {
      return res.json({
        success: true,
        data: {
          taskId: task.id,
          status: 'failed',
          legacyStatus: 'fail',
          fail_reason: task.error || '生成失败',
        },
      });
    }

    const resultData = (task.result as unknown as Record<string, unknown>) || {};
    const minimaxTaskId = resultData.minimaxTaskId;

    if (!minimaxTaskId) {
      throw new AppError('任务数据异常：缺少 minimaxTaskId', 500);
    }

    const apiResult = await callMiniMaxGET(`/v1/query/image_generation?task_id=${minimaxTaskId}`);
    checkMiniMaxBusinessError(apiResult);

    const dataObj = getMiniMaxDataObj(apiResult);
    const status = dataObj.status;

    if (status === 'success' || status === 'Success' || status === 2) {
      const imageUrl =
        dataObj.image_urls?.[0] || dataObj.image_url || apiResult.output?.image_url || null;

      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          result: JSON.stringify({ imageUrl, minimaxTaskId }),
        },
      });

      return res.json({
        success: true,
        data: {
          taskId: task.id,
          status: 'success',
          imageUrl: getFullUrl(imageUrl),
        },
      });
    } else if (status === 'fail' || status === 'Fail' || status === 3) {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          error: dataObj.status_msg || '生成失败',
        },
      });

      return res.json({
        success: true,
        data: {
          taskId: task.id,
          status: 'failed',
          legacyStatus: 'fail',
          fail_reason: dataObj.status_msg || '生成失败',
        },
      });
    }

    res.json({
      success: true,
      data: {
        taskId: task.id,
        status: 'processing',
      },
    });
  } catch (error) {
    next(error);
  }
});

audioRouter.get('/proxy-download', authenticate, async (req: AuthRequest, res) => {
  try {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      res.status(400).json({ success: false, error: '缺少 url 参数' });
      return;
    }

    const allowedHosts = [
      'minimax.com',
      'volces.com',
      'aliyuncs.com',
      'suno.com',
      'maas.com',
      'maas-api.com',
    ];
    const response = await fetchRemoteBuffer(targetUrl, {
      allowedHosts,
      maxBytes: 100 * 1024 * 1024,
      timeoutMs: 60000,
    });
    if (response.status < 200 || response.status >= 300) {
      res
        .status(response.status)
        .json({ success: false, error: `下载失败: ${response.status}` });
      return;
    }

    const contentTypeHeader = response.headers['content-type'];
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader[0] || 'application/octet-stream'
      : typeof contentTypeHeader === 'string'
        ? contentTypeHeader
        : 'application/octet-stream';
    const buffer = Buffer.from(response.data);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: '代理下载失败',
    });
  }
});

// 2. 异步语音合成 - 创建任务
audioRouter.post('/async-create', async (req: AuthRequest, res, next) => {
  try {
    const validatedData = ttsV2Schema.parse(req.body);

    const requestBody: Record<string, any> = {
      model: validatedData.model,
      text: validatedData.text,
      voice_setting: {
        voice_id: validatedData.voiceId,
        speed: validatedData.speed,
        pitch: validatedData.pitch,
        vol: validatedData.volume,
        ...(validatedData.emotion ? { emotion: validatedData.emotion } : {}),
      },
      audio_setting: {
        sample_rate: validatedData.sampleRate,
        bitrate: validatedData.bitrate,
        format: validatedData.audioFormat,
        channel: validatedData.channel,
      },
    };
    if (validatedData.languageBoost) requestBody.language_boost = validatedData.languageBoost;
    if (validatedData.subtitleEnable) requestBody.subtitle_enable = true;
    if (validatedData.pronunciationDict)
      requestBody.pronunciation_dict = validatedData.pronunciationDict;

    logger.info('[AudioRouter] 异步 TTS 创建:', JSON.stringify(requestBody, null, 2));

    const result = await callMiniMaxAPI(`/v1/t2a_v2`, requestBody);
    checkMiniMaxBusinessError(result);

    const taskId = result.data?.task_id || result.task_id;
    if (!taskId) throw new AppError('未获取到任务ID', 500);

    const task = await prisma.task.create({
      data: {
        userId: req.userId!,
        type: 'audio',
        provider: 'minimax',
        model: validatedData.model,
        status: 'processing',
        prompt: validatedData.text.substring(0, 100),
        params: JSON.stringify({ ...validatedData, mode: 'async_text_to_audio' }),
        result: JSON.stringify({ minimaxTaskId: taskId }),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        taskId: task.id,
        minimaxTaskId: taskId,
        status: 'processing',
        model: validatedData.model,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 3. 异步语音合成 - 查询任务
audioRouter.get('/async-query', async (req: AuthRequest, res, next) => {
  try {
    const taskId = req.query.task_id as string;
    if (!taskId) throw new AppError('task_id 参数缺失', 400);

    const result = await callMiniMaxGET(`/v1/query/t2a_async_query_v2?task_id=${taskId}`);
    checkMiniMaxBusinessError(result);

    // 如果任务完成，更新本地记录
    const status = result.data?.status || result.status;
    if (status === 'success' || status === 'Success') {
      const audioUrl = result.data?.audio_url || extractAudioUrl(result);
      if (audioUrl) {
        // Use atomic update to prevent double-completion race condition
        await prisma.task.updateMany({
          where: {
            userId: req.userId!,
            result: { contains: taskId },
            type: 'audio',
            status: 'processing',
          },
          data: {
            status: 'completed',
            result: JSON.stringify({ audioUrl, minimaxTaskId: taskId }),
          },
        });
      }
    }

    res.json({
      success: true,
      data: {
        taskId,
        status,
        audioUrl: result.data?.audio_url || null,
        subtitle: result.data?.subtitle || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 4. 上传音频文件 (用于音色复刻)
audioRouter.post('/upload', audioUpload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = (req as any).file;
    if (!file) throw new AppError('请上传音频文件', 400);

    const purpose = req.body.purpose || 'voice_clone';
    logger.info(
      `[AudioRouter] 上传音频: ${file.originalname}, purpose: ${purpose}, size: ${file.size}`
    );

    const { apiKey, baseUrl } = await getMinimaxConfig();

    const formData = new (globalThis as any).FormData();
    const blob = new (globalThis as any).Blob([file.buffer], { type: file.mimetype });
    formData.append('file', blob, file.originalname);
    formData.append('purpose', purpose);

    const response = await fetch(`${baseUrl}/v1/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[AudioRouter] MiniMax 上传错误:', response.status, errorText);
      throw new AppError('音频上传失败', 502);
    }

    const result = (await response.json()) as MiniMaxAPIResult;
    checkMiniMaxBusinessError(result);

    res.status(201).json({
      success: true,
      data: {
        file_id: result.file?.file_id || result.data?.file_id,
        file_name: file.originalname,
        purpose,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 5. 音色复刻
audioRouter.post(
  '/voice-clone',
  async (req: AuthRequest, res, next) => {
    try {
      const validatedData = voiceCloneSchema.parse(req.body);

      const requestBody: Record<string, any> = {
        voice_id: validatedData.voice_id,
        file_id: validatedData.file_id,
        need_noise_reduction: validatedData.need_noise_reduction,
        need_volume_normalization: validatedData.need_volume_normalization,
      };

      if (validatedData.prompt_audio) {
        requestBody.prompt_audio = {
          file_id: validatedData.prompt_audio,
          prompt_text: validatedData.prompt_text || '',
        };
      }

      logger.info('[AudioRouter] 音色复刻请求:', JSON.stringify(requestBody, null, 2));

      const result = await callMiniMaxAPI(`/v1/voice_clone`, requestBody);
      checkMiniMaxBusinessError(result);

      const task = await prisma.task.create({
        data: {
          userId: req.userId!,
          type: 'audio',
          provider: 'minimax',
          model: 'voice-clone',
          status: 'completed',
          prompt: '音色复刻',
          params: JSON.stringify({ ...validatedData, mode: 'voice_clone' }),
          result: JSON.stringify({ voice_id: validatedData.voice_id }),
        },
      });

      res.status(201).json({
        success: true,
        data: {
          taskId: task.id,
          voice_id: validatedData.voice_id,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 6. 音色设计
audioRouter.post(
  '/voice-design',
  async (req: AuthRequest, res, next) => {
    try {
      const validatedData = voiceDesignSchema.parse(req.body);

      const promptText = validatedData.prompt || validatedData.description || '';
      if (!promptText) throw new AppError('请输入音色描述', 400);
      const previewText =
        validatedData.preview_text || validatedData.text || '你好，这是一条测试音频。';

      const requestBody: Record<string, any> = {
        prompt: promptText,
        preview_text: previewText,
      };
      if (validatedData.voice_id) requestBody.voice_id = validatedData.voice_id;

      logger.info('[AudioRouter] 音色设计请求:', JSON.stringify(requestBody, null, 2));

      const result = await callMiniMaxAPI(`/v1/voice_design`, requestBody);
      checkMiniMaxBusinessError(result);

      const dataObj = getMiniMaxDataObj(result);
      const generatedVoiceId = ((dataObj as any).voice_id as string) || null;

      let trialAudioUrl: string | null = null;
      const hexTrialAudio = (dataObj as any).trial_audio as string | undefined;
      if (hexTrialAudio && hexTrialAudio.length > 100) {
        const taskId = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        trialAudioUrl = saveHexAudioToFile(hexTrialAudio, taskId, 'audio/mpeg');
      }

      const task = await prisma.task.create({
        data: {
          userId: req.userId!,
          type: 'audio',
          provider: 'minimax',
          model: 'voice-design',
          status: 'completed',
          prompt: promptText.substring(0, 100),
          params: JSON.stringify({ ...validatedData, mode: 'voice_design' }),
          result: JSON.stringify({ voice_id: generatedVoiceId, trial_audio_url: trialAudioUrl }),
        },
      });

      res.status(201).json({
        success: true,
        data: {
          taskId: task.id,
          voice_id: generatedVoiceId,
          trial_audio_url: trialAudioUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 6.5 音色试听 (预览)
audioRouter.post('/voice-preview', async (req: AuthRequest, res, next) => {
  try {
    const { voice_id, text } = req.body;
    if (!voice_id) throw new AppError('voice_id 不能为空', 400);

    const previewText = text || '你好，这是一段试听音频，欢迎使用。';

    const requestBody: Record<string, any> = {
      model: 'speech-2.6-turbo',
      text: previewText,
      stream: false,
      voice_setting: {
        voice_id,
        speed: 1.0,
        vol: 1.0,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
      output_format: 'hex',
    };

    const result = await callMiniMaxAPI(`/v1/t2a_v2`, requestBody);
    checkMiniMaxBusinessError(result);

    const dataObj = getMiniMaxDataObj(result);
    const audioUrl =
      (dataObj as any).audio_url ||
      (result as any).audio?.url ||
      (result as any).data?.audio_url ||
      null;
    const hexAudio = (dataObj as any).audio as string | undefined;

    if (!audioUrl && !hexAudio) {
      throw new AppError('试听音频生成失败：未收到音频数据', 500);
    }

    res.json({
      success: true,
      data: {
        voice_id,
        audio_url: audioUrl,
        audio: hexAudio || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 7. 获取音色列表
audioRouter.get('/voices', async (req: AuthRequest, res, next) => {
  try {
    const voiceType = (req.query.voice_type as string) || 'all';

    // 尝试从 MiniMax API 获取
    try {
      const result = await callMiniMaxGET(`/v1/voice_clone?voice_type=${voiceType}`);

      if (result.base_resp && result.base_resp.status_code === 0) {
        return res.json({
          success: true,
          data: result.data || result,
        });
      }
    } catch (apiErr) {
      console.warn('[AudioRouter] MiniMax 音色列表获取失败，使用本地列表:', apiErr);
    }

    // 降级到本地列表
    const systemVoices = [
      { voice_id: 'female-tianmei', name: '甜妹', gender: 'female', language: '中文' },
      { voice_id: 'female-shaonv', name: '少女', gender: 'female', language: '中文' },
      { voice_id: 'female-yujie', name: '御姐', gender: 'female', language: '中文' },
      { voice_id: 'female-chengshu', name: '成熟女声', gender: 'female', language: '中文' },
      { voice_id: 'male-qn-qingse', name: '青涩男声', gender: 'male', language: '中文' },
      { voice_id: 'male-qn-jingying', name: '精英男声', gender: 'male', language: '中文' },
      { voice_id: 'male-qn-badao', name: '霸道男声', gender: 'male', language: '中文' },
      { voice_id: 'male-qn-daxuesheng', name: '大学男声', gender: 'male', language: '中文' },
      { voice_id: 'presenter_male', name: '男主持', gender: 'male', language: '中文' },
      { voice_id: 'presenter_female', name: '女主持', gender: 'female', language: '中文' },
      { voice_id: 'audiobook_male_1', name: '有声书男', gender: 'male', language: '中文' },
      { voice_id: 'audiobook_female_1', name: '有声书女', gender: 'female', language: '中文' },
    ];

    res.json({
      success: true,
      data: { system_voices: systemVoices, voice_cloning: [], voice_generation: [] },
    });
  } catch (error) {
    next(error);
  }
});

// 8. 删除复刻/设计音色
audioRouter.delete('/voices/:voiceId', async (req: AuthRequest, res, next) => {
  try {
    const { voiceId } = req.params;
    if (!voiceId) throw new AppError('voiceId 参数缺失', 400);

    const result = await callMiniMaxAPI(`/v1/voice_clone/delete`, {
      voice_id: voiceId,
    });
    checkMiniMaxBusinessError(result);

    res.json({
      success: true,
      data: { voice_id: voiceId, deleted: true },
    });
  } catch (error) {
    next(error);
  }
});

// 9. 音乐生成 (music-2.6)
audioRouter.post(
  '/music-generate',
  async (req: AuthRequest, res, next) => {
    try {
      const { prompt, lyrics, audioSetting, instrumental } = req.body;
      if (!prompt && !lyrics) throw new AppError('风格描述或歌词至少填写一项', 400);

      // MiniMax music API 要求 lyrics 非空，除非 instrumental=true
      const hasLyrics = lyrics && lyrics.trim();
      const isInstrumental = instrumental !== undefined ? instrumental : !hasLyrics;

      const requestBody: Record<string, any> = {
        model: 'music-2.6',
        lyrics: hasLyrics || isInstrumental ? lyrics || '' : '',
        instrumental: isInstrumental,
      };
      if (prompt) requestBody.prompt = prompt;
      if (audioSetting) {
        if (audioSetting.format) requestBody.audio_setting = { format: audioSetting.format };
        if (audioSetting.sampleRate) {
          requestBody.audio_setting = requestBody.audio_setting || {};
          requestBody.audio_setting.sample_rate = audioSetting.sampleRate;
        }
      }

      logger.info('[AudioRouter] 音乐生成请求:', JSON.stringify(requestBody, null, 2));

      const idempotencyKey = buildGenerationIdempotencyKey({
        userId: req.userId!,
        route: 'audio.music-generate',
        body: { prompt, lyrics, audioSetting, instrumental },
        nodeId: typeof req.body.nodeId === 'string' ? req.body.nodeId : undefined,
      });
      const idempotentTask = await createIdempotentGenerationTask(idempotencyKey, {
        userId: req.userId!,
        type: 'audio',
        provider: 'minimax',
        model: 'music-2.6',
        status: 'pending',
        prompt: (prompt || lyrics || '音乐生成').substring(0, 100),
        params: JSON.stringify({ prompt, lyrics, mode: 'music_generation' }),
        progress: 0,
      });
      if (idempotentTask.reused) {
        return res.status(202).json({
          success: true,
          data: buildReusedGenerationResponse(idempotentTask.task),
        });
      }
      const task = idempotentTask.task;

      let result: MiniMaxAPIResult;
      try {
        result = await callMiniMaxAPI(`/v1/music_generation`, requestBody);
        checkMiniMaxBusinessError(result);
      } catch (apiError) {
        await prisma.task
          .update({
            where: { id: task.id },
            data: {
              status: 'failed',
              error: apiError instanceof Error ? apiError.message : String(apiError),
            },
          })
          .catch(() => {});
        throw apiError;
      }

      const dataObj = getMiniMaxDataObj(result);
      const hexAudio = (dataObj as any).audio as string | undefined;
      const audioStatus = (dataObj as any).status as number | undefined;
      const minimaxTaskId = (dataObj as any).task_id || (result as any).task_id || null;
      const extraInfo = (result as any).extra_info || null;

      logger.info(
        '[AudioRouter] 音乐响应 status:',
        audioStatus,
        '| audio长度:',
        hexAudio ? hexAudio.length : 'N/A'
      );

      let audioUrl: string | null = null;
      let extraAudioUrl: string | null = null;

      if (hexAudio && hexAudio.length > 100) {
        const taskId = `music_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        audioUrl = saveHexAudioToFile(hexAudio, taskId, 'audio/mpeg');
      }

      if ((dataObj as any).extra_audio_url) {
        extraAudioUrl = (dataObj as any).extra_audio_url as string;
      } else if ((dataObj as any).extra_audio) {
        const taskId2 = `music_extra_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        extraAudioUrl = saveHexAudioToFile(
          (dataObj as any).extra_audio as string,
          taskId2,
          'audio/mpeg'
        );
      }

      if (!audioUrl && minimaxTaskId) {
        logger.info('[AudioRouter] 音乐生成返回异步任务ID:', minimaxTaskId, '，返回处理中状态');
        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: 'processing',
            result: JSON.stringify({ minimaxTaskId }),
          },
        });
        res.status(201).json({
          success: true,
          data: {
            taskId: task.id,
            minimaxTaskId,
            status: 'processing',
            audioUrl: null,
            extraAudioUrl: null,
            provider: 'minimax',
            model: 'music-2.6',
          },
        });
        return;
      }

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          result: JSON.stringify({ audioUrl, extraAudioUrl }),
        },
      });

      res.status(201).json({
        success: true,
        data: {
          taskId: task.id,
          status: 'completed',
          audioUrl: getPublicAudioUrl(req, audioUrl),
          extraAudioUrl: getPublicAudioUrl(req, extraAudioUrl),
          extraInfo,
          provider: 'minimax',
          model: 'music-2.6',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 9.5 本地音频上传（用于翻唱等需要可访问URL的场景）
audioRouter.post(
  '/upload-local',
  audioUpload.single('file'),
  async (req: AuthRequest, res, next) => {
    try {
      const file = (req as any).file;
      if (!file) throw new AppError('请上传音频文件', 400);

      const tempDir = path.join(process.cwd(), 'public', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const ext = path.extname(file.originalname) || '.mp3';
      const fileName = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
      const filePath = path.join(tempDir, fileName);

      fs.writeFileSync(filePath, file.buffer);

      logger.info('[AudioRouter] 本地音频上传成功:', fileName, 'size:', file.size);

      cleanOldTempFiles();

      res.status(201).json({
        success: true,
        data: {
          audioUrl: `/temp/${fileName}`,
          fileName,
          size: file.size,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 10. 翻唱生成 (music-cover)
audioRouter.post(
  '/music-cover',
  async (req: AuthRequest, res, next) => {
    try {
      const { audioUrl, prompt, lyrics } = req.body;
      if (!audioUrl) throw new AppError('参考音频URL不能为空', 400);

      let fullAudioUrl = audioUrl;
      if (audioUrl.startsWith('/temp/')) {
        fullAudioUrl = `${req.protocol}://${req.get('host')}${audioUrl}`;
      }

      let referenceFileId: string | null = null;

      if (audioUrl.startsWith('/temp/')) {
        const localPath = path.join(process.cwd(), 'public', audioUrl);
        if (fs.existsSync(localPath)) {
          try {
            const fileBuffer = fs.readFileSync(localPath);
            const fileName = path.basename(localPath);
            referenceFileId = await uploadFileToMiniMax(fileBuffer, fileName, 'music_cover');
            logger.info('[AudioRouter] 参考音频已上传到MiniMax, file_id:', referenceFileId);
          } catch (uploadErr) {
            console.warn(
              '[AudioRouter] MiniMax文件上传失败, 回退到URL方式:',
              (uploadErr as Error).message
            );
          }
        }
      }

      const requestBody: Record<string, any> = {
        model: 'music-2.6',
        prompt: prompt || '翻唱',
      };

      if (referenceFileId) {
        requestBody.reference_audio_file_id = referenceFileId;
      } else {
        requestBody.reference_audio_url = fullAudioUrl;
      }

      if (lyrics) requestBody.lyrics = lyrics;

      logger.info('[AudioRouter] 翻唱生成请求:', JSON.stringify(requestBody, null, 2));

      const idempotencyKey = buildGenerationIdempotencyKey({
        userId: req.userId!,
        route: 'audio.music-cover',
        body: { audioUrl, prompt, lyrics },
        nodeId: typeof req.body.nodeId === 'string' ? req.body.nodeId : undefined,
      });
      const idempotentTask = await createIdempotentGenerationTask(idempotencyKey, {
        userId: req.userId!,
        type: 'audio',
        provider: 'minimax',
        model: 'music-2.6',
        status: 'pending',
        prompt: (prompt || '翻唱').substring(0, 100),
        params: JSON.stringify({ audioUrl, prompt, lyrics, mode: 'music_cover' }),
        progress: 0,
      });
      if (idempotentTask.reused) {
        return res.status(202).json({
          success: true,
          data: buildReusedGenerationResponse(idempotentTask.task),
        });
      }
      const task = idempotentTask.task;

      let result: MiniMaxAPIResult;
      try {
        result = await callMiniMaxAPI(`/v1/music_generation`, requestBody);
        checkMiniMaxBusinessError(result);
      } catch (apiError) {
        await prisma.task
          .update({
            where: { id: task.id },
            data: {
              status: 'failed',
              error: apiError instanceof Error ? apiError.message : String(apiError),
            },
          })
          .catch(() => {});
        throw apiError;
      }

      const dataObj = getMiniMaxDataObj(result);
      const hexAudio = (dataObj as any).audio as string | undefined;
      const minimaxTaskId = (dataObj as any).task_id || (result as any).task_id || null;

      logger.info('[AudioRouter] 翻唱响应 audio长度:', hexAudio ? hexAudio.length : 'N/A');

      let resultAudioUrl: string | null = null;
      let extraAudioUrl: string | null = null;

      if (hexAudio && hexAudio.length > 100) {
        const taskId = `cover_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        resultAudioUrl = saveHexAudioToFile(hexAudio, taskId, 'audio/mpeg');
      }

      if ((dataObj as any).extra_audio_url) {
        extraAudioUrl = (dataObj as any).extra_audio_url as string;
      } else if ((dataObj as any).extra_audio) {
        const taskId2 = `cover_extra_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        extraAudioUrl = saveHexAudioToFile(
          (dataObj as any).extra_audio as string,
          taskId2,
          'audio/mpeg'
        );
      }

      if (!resultAudioUrl && minimaxTaskId) {
        logger.info('[AudioRouter] 翻唱生成返回异步任务ID:', minimaxTaskId);
        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: 'processing',
            result: JSON.stringify({ minimaxTaskId }),
          },
        });
        res.status(201).json({
          success: true,
          data: {
            taskId: task.id,
            minimaxTaskId,
            status: 'processing',
            audioUrl: null,
            extraAudioUrl: null,
            provider: 'minimax',
            model: 'music-2.6',
          },
        });
        return;
      }

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          result: JSON.stringify({ audioUrl: resultAudioUrl, extraAudioUrl }),
        },
      });

      res.status(201).json({
        success: true,
        data: {
          taskId: task.id,
          status: 'completed',
          audioUrl: resultAudioUrl,
          extraAudioUrl,
          provider: 'minimax',
          model: 'music-2.6',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 10.5 音乐生成状态查询
audioRouter.get('/music-query', async (req: AuthRequest, res, next) => {
  try {
    const taskId = req.query.task_id as string;
    if (!taskId) throw new AppError('task_id 不能为空', 400);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) throw new AppError('任务不存在', 404);
    if (task.userId !== req.userId) throw new AppError('无权访问此任务', 403);

    if (task.status === 'completed') {
      const result = (task.result as unknown as Record<string, unknown>) || {};
      return res.json({
        success: true,
        data: {
          taskId: task.id,
          status: 'success',
          audioUrl: getPublicAudioUrl(req, result.audioUrl as string),
          extraAudioUrl: getPublicAudioUrl(req, result.extraAudioUrl as string),
        },
      });
    }

    if (task.status === 'failed') {
      return res.json({
        success: true,
        data: {
          taskId: task.id,
          status: 'failed',
          legacyStatus: 'fail',
          fail_reason: task.error || '生成失败',
        },
      });
    }

    const resultData = (task.result as unknown as Record<string, unknown>) || {};
    const minimaxTaskId = resultData.minimaxTaskId;

    if (!minimaxTaskId) {
      throw new AppError('任务数据异常：缺少 minimaxTaskId', 500);
    }

    const apiResult = await callMiniMaxGET(`/v1/query/music_generation?task_id=${minimaxTaskId}`);
    checkMiniMaxBusinessError(apiResult);

    const dataObj = getMiniMaxDataObj(apiResult);
    const status = dataObj.status;

    if (status === 'success' || status === 'Success' || status === 2) {
      const hexAudio = (dataObj as any).audio as string | undefined;
      let audioUrl: string | null = null;
      let extraAudioUrl: string | null = null;

      if (hexAudio && hexAudio.length > 100) {
        audioUrl = saveHexAudioToFile(
          hexAudio,
          `music_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          'audio/mpeg'
        );
      } else if (dataObj.audio_url) {
        audioUrl = dataObj.audio_url;
      }

      if ((dataObj as any).extra_audio_url) {
        extraAudioUrl = (dataObj as any).extra_audio_url;
      } else if ((dataObj as any).extra_audio) {
        extraAudioUrl = saveHexAudioToFile(
          (dataObj as any).extra_audio as string,
          `music_extra_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          'audio/mpeg'
        );
      }

      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          result: JSON.stringify({ audioUrl, extraAudioUrl, minimaxTaskId }),
        },
      });

      return res.json({
        success: true,
        data: {
          taskId: task.id,
          status: 'success',
          audioUrl: getPublicAudioUrl(req, audioUrl),
          extraAudioUrl: getPublicAudioUrl(req, extraAudioUrl),
        },
      });
    } else if (status === 'fail' || status === 'Fail' || status === 3) {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          error: dataObj.status_msg || '生成失败',
        },
      });

      return res.json({
        success: true,
        data: {
          taskId: task.id,
          status: 'failed',
          legacyStatus: 'fail',
          fail_reason: dataObj.status_msg || '生成失败',
        },
      });
    }

    res.json({
      success: true,
      data: {
        taskId: task.id,
        status: 'processing',
      },
    });
  } catch (error) {
    next(error);
  }
});

// 11. 获取模型列表
audioRouter.get('/models', async (_req, res) => {
  const models = [
    { id: 'speech-2.8-hd', name: 'Text to Speech HD', description: '超高清语音合成' },
    { id: 'music-2.6', name: 'Music 2.6', description: 'AI音乐生成' },
    { id: 'music-cover', name: 'Music Cover', description: 'AI翻唱' },
    { id: 'lyrics_generation', name: 'Lyrics Generation', description: '歌词生成' },
  ];

  res.json({
    success: true,
    data: { models },
  });
});

// 12. 歌词生成
audioRouter.post(
  '/lyrics-generate',
  async (req: AuthRequest, res, next) => {
    try {
      const { prompt, mode, lyrics: existingLyrics, title, language } = req.body;
      if (!prompt) throw new AppError('歌词描述不能为空', 400);

      const requestMode = mode === 'edit' ? 'edit' : 'write_full_song';

      const requestBody: Record<string, any> = {
        mode: requestMode,
        prompt,
      };
      if (existingLyrics) requestBody.lyrics = existingLyrics;
      if (title) requestBody.title = title;
      if (language) requestBody.language = language;

      logger.info('[AudioRouter] 歌词生成请求:', JSON.stringify(requestBody, null, 2));

      const result = await callMiniMaxAPI(`/v1/lyrics_generation`, requestBody);
      checkMiniMaxBusinessError(result);

      logger.info('[AudioRouter] 歌词生成完整响应 keys:', Object.keys(result).join(','));

      const generatedLyrics = (result as any).lyrics || (result as any).data?.lyrics || null;
      const songTitle = (result as any).song_title || (result as any).data?.song_title || null;
      const styleTags = (result as any).style_tags || (result as any).data?.style_tags || null;

      if (!generatedLyrics) {
        throw new AppError('歌词生成失败：未收到歌词内容', 500);
      }

      const task = await prisma.task.create({
        data: {
          userId: req.userId!,
          type: 'audio',
          provider: 'minimax',
          model: 'lyrics-01',
          status: 'completed',
          prompt: prompt.substring(0, 100),
          params: JSON.stringify({ prompt, mode: requestMode, type: 'lyrics_generation' }),
          result: JSON.stringify({ lyrics: generatedLyrics, songTitle, styleTags }),
        },
      });

      res.status(201).json({
        success: true,
        data: {
          taskId: task.id,
          status: 'completed',
          lyrics: generatedLyrics,
          songTitle,
          styleTags,
          provider: 'minimax',
          model: 'lyrics-01',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 13. 封面图片生成
audioRouter.post(
  '/music-cover-image',
  async (req: AuthRequest, res, next) => {
    try {
      const { prompt, musicTitle } = req.body;
      if (!prompt) throw new AppError('封面描述不能为空', 400);

      const requestBody: Record<string, any> = {
        model: 'image-01',
      };
      if (prompt) requestBody.prompt = prompt;
      if (musicTitle) requestBody.music_title = musicTitle;

      logger.info('[AudioRouter] 封面图片生成请求:', JSON.stringify(requestBody, null, 2));

      const result = await callMiniMaxAPI(`/v1/image_generation`, requestBody);
      checkMiniMaxBusinessError(result);

      logger.info('[AudioRouter] 封面图片生成完整响应:', JSON.stringify(result, null, 2));

      const imageUrl =
        result.data?.image_urls?.[0] || result.data?.image_url || result.output?.image_url || null;
      const minimaxTaskId = result.data?.task_id || result.task_id || null;

      if (!imageUrl && minimaxTaskId) {
        logger.info('[AudioRouter] 封面图片生成返回异步任务ID:', minimaxTaskId, '，返回处理中状态');
        const task = await prisma.task.create({
          data: {
            userId: req.userId!,
            type: 'audio',
            provider: 'minimax',
            model: 'image-01',
            status: 'processing',
            prompt: prompt.substring(0, 100),
            params: JSON.stringify({ prompt, musicTitle, mode: 'cover_image' }),
            result: JSON.stringify({ minimaxTaskId }),
          },
        });
        res.status(201).json({
          success: true,
          data: {
            taskId: task.id,
            minimaxTaskId,
            status: 'processing',
            imageUrl: null,
            provider: 'minimax',
            model: 'image-01',
          },
        });
        return;
      }

      const task = await prisma.task.create({
        data: {
          userId: req.userId!,
          type: 'audio',
          provider: 'minimax',
          model: 'image-01',
          status: 'completed',
          prompt: prompt.substring(0, 100),
          params: JSON.stringify({ prompt, musicTitle, mode: 'cover_image' }),
          result: JSON.stringify({ imageUrl }),
        },
      });

      res.status(201).json({
        success: true,
        data: {
          taskId: task.id,
          status: 'completed',
          imageUrl,
          provider: 'minimax',
          model: 'image-01',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 14. 保存歌曲到我的音乐
audioRouter.post('/songs/save', async (req: AuthRequest, res, next) => {
  try {
    const { title, lyrics, lrc, audioFileId, coverFileId, songInfo, audioUrl, coverImageUrl } =
      req.body;

    const song = await prisma.song.create({
      data: {
        userId: req.userId!,
        title: title || '未命名歌曲',
        lyrics: lyrics || '',
        lrc: lrc || null,
        audioUrl: audioUrl || audioFileId || '',
        coverImageUrl: coverImageUrl || coverFileId || null,
        artist: songInfo?.artist || null,
        composer: songInfo?.composer || null,
        lyricist: songInfo?.lyricist || null,
        arranger: songInfo?.arranger || null,
        producer: songInfo?.producer || null,
        album: songInfo?.album || null,
        genre: songInfo?.genre || null,
        year: songInfo?.year?.toString() || null,
        comment: songInfo?.comment || null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: song.id,
        title: song.title,
        createdAt: song.createdAt,
      },
    });
  } catch (error) {
    logger.error(
      '[AudioRouter] Failed to save song:',
      error instanceof Error ? error.message : String(error)
    );
    next(error);
  }
});

// 15. 获取我的音乐列表
audioRouter.get('/songs/history', async (req: AuthRequest, res, next) => {
  try {
    const songs = await prisma.song.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: songs,
    });
  } catch (error) {
    next(error);
  }
});

// 16. 获取单首歌曲详情
audioRouter.get('/songs/:songId', async (req: AuthRequest, res, next) => {
  try {
    const { songId } = req.params;

    const song = await prisma.song.findFirst({
      where: {
        id: songId,
        userId: req.userId!,
      },
    });

    if (!song) {
      throw new AppError('歌曲不存在', 404);
    }

    res.json({
      success: true,
      data: song,
    });
  } catch (error) {
    next(error);
  }
});

// 17. 删除歌曲
audioRouter.delete('/songs/:songId', async (req: AuthRequest, res, next) => {
  try {
    const { songId } = req.params;

    const song = await prisma.song.findFirst({
      where: {
        id: songId,
        userId: req.userId!,
      },
    });

    if (!song) {
      throw new AppError('歌曲不存在', 404);
    }

    await prisma.song.delete({
      where: { id: songId },
    });

    res.json({
      success: true,
      message: '歌曲已删除',
    });
  } catch (error) {
    next(error);
  }
});

// ===== 18. ASR 语音识别 =====
audioRouter.post('/asr', async (req: AuthRequest, res, next) => {
  try {
    const { audioUrl, language, provider, model } = req.body as {
      audioUrl?: string;
      language?: string;
      provider?: string;
      model?: string;
    };
    if (!audioUrl) throw new AppError('audioUrl 参数必填', 400);
    const providerName: AudioProviderName =
      provider === 'stepfun' || model?.startsWith('stepaudio') ? 'stepfun' : 'minimax';

    if (providerName === 'stepfun') {
      const config = await getAudioProviderConfig('stepfun');
      const result = await stepFunProvider.recognizeAudio(
        audioUrl,
        language || 'auto',
        config,
        model
      );
      if (result.status === 'failed') {
        throw new AppError(result.error || 'StepFun ASR 识别失败', 502);
      }

      return res.json({
        success: true,
        result: {
          text: result.result?.metadata?.text || '',
          data: result.result?.metadata,
          provider: 'stepfun',
          model: model || 'stepaudio-2.5-asr',
        },
      });
    }

    const { apiKey, baseUrl } = await getMinimaxConfig();
    const result = await fetch(`${baseUrl}/v1/asr`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: audioUrl, language: language || 'auto' }),
    });

    if (!result.ok) {
      const errText = await result.text();
      throw new AppError(`ASR 识别失败: ${result.status} - ${errText.substring(0, 200)}`, 502);
    }

    const data = await result.json();

    res.json({ success: true, result: data });
  } catch (error) {
    next(error);
  }
});

// ===== 19. 语音对话 (Voice Chat: ASR → Chat → TTS) =====
function getConfiguredUploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR);
}

async function loadVoiceChatSessionHistory(
  userId: string,
  sessionId: string
): Promise<VoiceChatHistoryMessage[]> {
  try {
    const rows = await prisma.voiceChatMessage.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: 'desc' },
      take: VOICE_CHAT_MAX_HISTORY_MESSAGES,
      select: { role: true, content: true },
    });
    return normalizeVoiceChatHistory(rows.reverse());
  } catch (error) {
    // Session context is an enhancement; a transient database failure must
    // not make an otherwise healthy ASR/chat request fail.
    logger.warn('[VoiceChat] 加载会话历史失败', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function persistVoiceChatTurn(
  userId: string,
  sessionId: string | undefined,
  recognizedText: string,
  replyText: string
): void {
  if (!sessionId) return;
  void Promise.all([
    prisma.voiceChatMessage.create({
      data: {
        userId,
        sessionId,
        role: 'user',
        content: recognizedText.slice(0, VOICE_CHAT_MAX_MESSAGE_LENGTH),
      },
    }),
    prisma.voiceChatMessage.create({
      data: {
        userId,
        sessionId,
        role: 'assistant',
        content: replyText.slice(0, VOICE_CHAT_MAX_MESSAGE_LENGTH),
      },
    }),
  ]).catch((error) => {
    logger.warn('[VoiceChat] 保存会话历史失败', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

audioRouter.post('/voice-chat', audioUpload.single('file'), async (req: AuthRequest, res, next) => {
  let temporaryInputPath: string | undefined;
  try {
    const file = req.file as Express.Multer.File | undefined;
    const {
      audioUrl,
      language,
      voice,
      instructions,
      chatModel,
      ttsModel,
      ttsVoice,
      history,
      chatHistory,
      sessionId: rawSessionId,
      session_id: rawSessionIdSnake,
    } = req.body as {
      audioUrl?: string;
      language?: string;
      voice?: string;
      instructions?: string;
      chatModel?: string;
      ttsModel?: string;
      ttsVoice?: string;
      history?: unknown;
      chatHistory?: unknown;
      sessionId?: unknown;
      session_id?: unknown;
    };

    // Keep an uploaded recording private and short-lived. The provider reads
    // this local path directly; no self-requesting public URL is generated.
    let inputAudioSource = '';
    if (file) {
      if (!file.buffer?.length) throw new AppError('上传的音频文件为空', 400);
      const uploadDir = path.join(getConfiguredUploadDir(), 'voice-chat');
      await fs.promises.mkdir(uploadDir, { recursive: true });
      const filename = `vc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}${audioUploadExtension(file.mimetype, file.originalname)}`;
      temporaryInputPath = path.join(uploadDir, filename);
      await fs.promises.writeFile(temporaryInputPath, file.buffer);
      inputAudioSource = temporaryInputPath;
    } else {
      try {
        inputAudioSource = resolveVoiceChatAudioSource(audioUrl);
      } catch (error) {
        throw new AppError(error instanceof Error ? error.message : '音频文件路径无效', 400);
      }
    }
    if (!inputAudioSource) throw new AppError('需要上传音频文件或提供 audioUrl', 400);

    // 1. ASR: 语音转文字
    const asrConfig = await getAudioProviderConfig('stepfun');
    const asrResult = await stepFunProvider.recognizeAudio(
      inputAudioSource,
      typeof language === 'string' ? language.slice(0, 32) : 'zh',
      asrConfig,
      'stepaudio-2.5-asr'
    );
    if (asrResult.status === 'failed') {
      throw new AppError(asrResult.error || 'ASR 识别失败', 502);
    }
    const recognizedText = String(asrResult.result?.metadata?.text || '')
      .trim()
      .slice(0, VOICE_CHAT_MAX_MESSAGE_LENGTH);
    if (!recognizedText.trim()) {
      throw new AppError('语音识别结果为空，请重试', 400);
    }

    const sessionId = normalizeVoiceChatSessionId(rawSessionId ?? rawSessionIdSnake);
    const suppliedHistory = history ?? chatHistory;
    const hasClientHistory = suppliedHistory !== undefined && suppliedHistory !== null;
    const conversationHistory = hasClientHistory
      ? normalizeVoiceChatHistory(suppliedHistory)
      : sessionId
        ? await loadVoiceChatSessionHistory(req.userId!, sessionId)
        : [];

    // 2. Chat: 调用语音对话模型
    let replyText = '';
    let chatModelUsed = chatModel || 'stepaudio-2.5-chat';
    const chatConfig = await getAudioProviderConfig('stepfun');
    const standardEndpoint = (chatConfig.endpoint || 'https://api.stepfun.com/v1')
      .replace(/\/step_plan\/v1$/, '/v1')
      .replace(/\/+$/, '');
    const chatResp = await fetch(`${standardEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chatConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: chatModelUsed,
        modalities: ['text'],
        messages: [
          { role: 'system', content: `当前场景要求：${typeof instructions === 'string' && instructions.trim() ? instructions.trim() : '回答自然、温暖、直接。'}`.slice(0, VOICE_CHAT_MAX_MESSAGE_LENGTH) },
          ...conversationHistory,
          { role: 'user', content: recognizedText },
        ],
      }),
    });
    if (!chatResp.ok) {
      const errText = await chatResp.text();
      throw new AppError(`StepAudio Chat 失败: ${chatResp.status} - ${errText.substring(0, 200)}`, 502);
    }
    const chatData = (await chatResp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    replyText = String(chatData.choices?.[0]?.message?.content || '抱歉，我没有理解你的意思，请再说一次。').slice(0, VOICE_CHAT_MAX_MESSAGE_LENGTH);

    // 3. TTS: 文字转语音
    const ttsConfig = await getAudioProviderConfig('stepfun');
    const ttsVoiceFinal = ttsVoice || voice || 'cixingnansheng';
    const ttsInstruction =
      !ttsVoice && !voice
        ? '温柔可爱的少女音色，语调活泼亲切，像朋友一样聊天，带自然呼吸感'
        : undefined;
    const ttsResult = await stepFunProvider.generateAudio(
      {
        text: replyText,
        model: ttsModel || 'step-tts-2',
        voice: ttsVoiceFinal,
        instruction: ttsInstruction,
        provider: 'stepfun',
      } as AudioParams,
      ttsConfig
    );

    if (ttsResult.status === 'failed') {
      throw new AppError(ttsResult.error || 'TTS 合成失败', 502);
    }

    const rawAudioResponseUrl = ttsResult.result?.audioUrl || ttsResult.result?.url || '';
    if (!rawAudioResponseUrl) throw new AppError('TTS 未返回可播放音频地址', 502);
    // `/audio/...` is converted to the existing authenticated file route. A
    // data URL or a provider-hosted URL remains directly playable as-is.
    const audioResponseUrl = getPublicAudioUrl(req, rawAudioResponseUrl);

    persistVoiceChatTurn(req.userId!, sessionId, recognizedText, replyText);

    res.json({
      success: true,
      result: {
        recognizedText,
        replyText,
        audioUrl: audioResponseUrl,
        audio_url: audioResponseUrl,
        audioMimeType:
          typeof ttsResult.result?.metadata?.contentType === 'string'
            ? ttsResult.result.metadata.contentType
            : 'audio/mpeg',
        sessionId: sessionId || null,
        provider: 'stepfun',
        models: {
          asr: 'stepaudio-2.5-asr',
          chat: chatModelUsed,
          tts: ttsModel || 'step-tts-2',
        },
      },
    });
  } catch (error) {
    next(error);
  } finally {
    if (temporaryInputPath) {
      try {
        // Use the synchronous unlink here so Express cannot finish the
        // response while the short-lived recording is still on disk.
        fs.rmSync(temporaryInputPath, { force: true });
      } catch (cleanupError) {
        logger.warn('[VoiceChat] 清理临时录音失败', {
          path: temporaryInputPath,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }
  }
});

// ===== 20. 音频降噪 =====
audioRouter.post(
  '/noise-reduce',
  audioUpload.single('file'),
  async (req: AuthRequest, res, next) => {
    try {
      const { audioUrl, level } = req.body as { audioUrl?: string; level?: string };
      const file = req.file as Express.Multer.File | undefined;

      let inputUrl = audioUrl;
      if (file && !inputUrl) {
        const ext = file.originalname?.split('.').pop() || 'wav';
        const tmpName = `noise_reduce_input_${Date.now()}.${ext}`;
        const tmpPath = path.join(process.cwd(), 'uploads', 'audio', tmpName);
        const tmpDir = path.dirname(tmpPath);
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(tmpPath, file.buffer);
        inputUrl = `/uploads/audio/${tmpName}`;
      }

    if (!inputUrl) throw new AppError('请提供音频文件或 audioUrl', 400);

    const { apiKey, baseUrl } = await getMinimaxConfig();
    const result = await fetch(`${baseUrl}/v1/audio/noise_reduction`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio_url: inputUrl, level: level || 'medium' }),
      });

      if (!result.ok) {
        throw new AppError(`降噪处理失败: ${result.status}`, 502);
      }

      const data: any = await result.json();
      const cleanedUrl = data?.data?.audio_url || data?.audio_url;

      let savedUrl = cleanedUrl;
      if (cleanedUrl) {
        const saved = await autoSaveService.autoSaveUrl(
          req.userId!,
          cleanedUrl,
          'audio',
          `denoised_${Date.now()}.mp3`
        );
        savedUrl = saved.primaryUrl || cleanedUrl;
      }

      res.json({
        success: true,
        result: {
          cleanedUrl: savedUrl,
          noiseReductionDb: data?.data?.noise_reduction_db || 0,
          originalSnr: data?.data?.original_snr || 0,
          improvedSnr: data?.data?.improved_snr || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===== 20. 音频增强 =====
audioRouter.post('/enhance', audioUpload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const { audioUrl, targetLufs } = req.body as { audioUrl?: string; targetLufs?: number };
    const file = req.file as Express.Multer.File | undefined;

    let inputUrl = audioUrl;
    if (file && !inputUrl) {
      const ext = file.originalname?.split('.').pop() || 'wav';
      const tmpName = `enhance_input_${Date.now()}.${ext}`;
      const tmpPath = path.join(process.cwd(), 'uploads', 'audio', tmpName);
      const tmpDir = path.dirname(tmpPath);
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(tmpPath, file.buffer);
      inputUrl = `/uploads/audio/${tmpName}`;
    }

    if (!inputUrl) throw new AppError('请提供音频文件或 audioUrl', 400);

    const { apiKey, baseUrl } = await getMinimaxConfig();
    const result = await fetch(`${baseUrl}/v1/audio/enhance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: inputUrl, target_lufs: targetLufs || -16 }),
    });

    if (!result.ok) {
      throw new AppError(`音频增强失败: ${result.status}`, 502);
    }

    const data: any = await result.json();
    const enhancedUrl = data?.data?.audio_url || data?.audio_url;

    let savedUrl = enhancedUrl;
    if (enhancedUrl) {
      const saved = await autoSaveService.autoSaveUrl(
        req.userId!,
        enhancedUrl,
        'audio',
        `enhanced_${Date.now()}.mp3`
      );
      savedUrl = saved.primaryUrl || enhancedUrl;
    }

    res.json({
      success: true,
      result: {
        enhancedUrl: savedUrl,
        improvements: data?.data?.improvements || [],
        loudnessChange: data?.data?.loudness_change || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===== 21. 响度归一化 =====
audioRouter.post('/normalize', audioUpload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const { audioUrl, targetLufs } = req.body as { audioUrl?: string; targetLufs?: number };
    const file = req.file as Express.Multer.File | undefined;

    let inputUrl = audioUrl;
    if (file && !inputUrl) {
      const ext = file.originalname?.split('.').pop() || 'wav';
      const tmpName = `normalize_input_${Date.now()}.${ext}`;
      const tmpPath = path.join(process.cwd(), 'uploads', 'audio', tmpName);
      const tmpDir = path.dirname(tmpPath);
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(tmpPath, file.buffer);
      inputUrl = `/uploads/audio/${tmpName}`;
    }

    if (!inputUrl) throw new AppError('请提供音频文件或 audioUrl', 400);

    const { apiKey, baseUrl } = await getMinimaxConfig();
    const result = await fetch(`${baseUrl}/v1/audio/normalize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: inputUrl, target_lufs: targetLufs || -16 }),
    });

    if (!result.ok) {
      throw new AppError(`响度归一化失败: ${result.status}`, 502);
    }

    const data: any = await result.json();
    const normalizedUrl = data?.data?.audio_url || data?.audio_url;

    let savedUrl = normalizedUrl;
    if (normalizedUrl) {
      const saved = await autoSaveService.autoSaveUrl(
        req.userId!,
        normalizedUrl,
        'audio',
        `normalized_${Date.now()}.mp3`
      );
      savedUrl = saved.primaryUrl || normalizedUrl;
    }

    res.json({
      success: true,
      result: { url: savedUrl, lufs: data?.data?.lufs || targetLufs || -16 },
    });
  } catch (error) {
    next(error);
  }
});

// ===== 22. 格式转换 =====
audioRouter.post('/convert', audioUpload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const { audioUrl, targetFormat, bitrate, sampleRate } = req.body as {
      audioUrl?: string;
      targetFormat?: string;
      bitrate?: number;
      sampleRate?: number;
    };
    const file = req.file as Express.Multer.File | undefined;

    let inputUrl = audioUrl;
    if (file && !inputUrl) {
      const ext = file.originalname?.split('.').pop() || 'wav';
      const tmpName = `convert_input_${Date.now()}.${ext}`;
      const tmpPath = path.join(process.cwd(), 'uploads', 'audio', tmpName);
      const tmpDir = path.dirname(tmpPath);
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(tmpPath, file.buffer);
      inputUrl = `/uploads/audio/${tmpName}`;
    }

    if (!inputUrl) throw new AppError('请提供音频文件或 audioUrl', 400);

    const { apiKey, baseUrl } = await getMinimaxConfig();
    const result = await fetch(`${baseUrl}/v1/audio/convert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: inputUrl,
        target_format: targetFormat || 'mp3',
        bitrate: bitrate || 128000,
        sample_rate: sampleRate || 44100,
      }),
    });

    if (!result.ok) {
      throw new AppError(`格式转换失败: ${result.status}`, 502);
    }

    const data: any = await result.json();
    const convertedUrl = data?.data?.audio_url || data?.audio_url;

    let savedUrl = convertedUrl;
    if (convertedUrl) {
      const saved = await autoSaveService.autoSaveUrl(
        req.userId!,
        convertedUrl,
        'audio',
        `converted_${Date.now()}.${targetFormat || 'mp3'}`
      );
      savedUrl = saved.primaryUrl || convertedUrl;
    }

    res.json({
      success: true,
      result: { url: savedUrl, format: targetFormat || 'mp3' },
    });
  } catch (error) {
    next(error);
  }
});

function cleanOldTempFiles(maxAgeMs: number = 2 * 60 * 60 * 1000): void {
  const tempDir = path.join(process.cwd(), 'public', 'temp');
  if (!fs.existsSync(tempDir)) return;

  const now = Date.now();
  const files = fs.readdirSync(tempDir);
  let cleaned = 0;

  for (const file of files) {
    const filePath = path.join(tempDir, file);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    } catch {
      // A concurrent cleanup may have already removed the file.
    }
  }

  if (cleaned > 0) {
    logger.info(`[AudioRouter] 清理了 ${cleaned} 个过期临时文件`);
  }
}

setInterval(() => cleanOldTempFiles(), 60 * 60 * 1000);
