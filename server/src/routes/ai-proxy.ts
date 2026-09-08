/**
 * AI 代理路由
 * 安全代理前端对 LLM API 的调用，避免 API Key 暴露给客户端
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import {
  isXunfeiSparkProvider,
  resolveSensenovaApiKey,
  resolveSensenovaBackupApiKey,
  resolveStepfunApiKey,
  resolveXunfeiSparkApiKey,
  resolveXunfeiSparkBaseUrl,
  // 已废弃 (2026-07-18): resolveZhipuApiKey 已不再使用（zhipu provider 文字通道下线）
  XUNFEI_SPARK_UPSTREAM_MODEL,
} from '../utils/provider-env-keys';

/** 移除 AI 响应中的 <think>...</think> 推理标签 */
function stripThinkingTags(text: string): string {
  if (!text) return text;
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** 解析 MiniMax / OpenAI 格式的 tool_calls 为前端可执行的工具调用对象 */
function parseChatToolCalls(message: Record<string, unknown> | undefined): ParsedToolCall[] {
  if (!message) return [];
  const rawCalls = message.tool_calls;
  if (!Array.isArray(rawCalls)) return [];

  const parsed: ParsedToolCall[] = [];
  for (const tc of rawCalls) {
    if (!tc || typeof tc !== 'object') continue;
    const toolCall = tc as {
      id?: string;
      function?: { name?: string; arguments?: string | Record<string, unknown> };
    };
    const fn = toolCall.function;
    if (!fn?.name) continue;
    try {
      const args =
        typeof fn.arguments === 'string' ? JSON.parse(fn.arguments || '{}') : fn.arguments || {};
      if (!args || typeof args !== 'object' || Array.isArray(args)) continue;

      parsed.push({
        id: toolCall.id || `tool_${Date.now()}_${parsed.length}`,
        name: fn.name,
        arguments: args as Record<string, unknown>,
      });
    } catch {
      /* skip malformed tool call */
    }
  }
  return parsed;
}

/**
 * 检测错误是否表示 API 密钥额度耗尽或认证失败
 * 用于触发多密钥轮换（如 SenseNova 秘钥1→秘钥2）
 */
function isQuotaOrAuthError(error: any): boolean {
  const status = error.response?.status;
  if (status === 401 || status === 402 || status === 403 || status === 429) {
    return true;
  }
  const errorMsg = String(
    error.response?.data?.message || error.response?.data?.error || error.message || ''
  ).toLowerCase();
  return (
    errorMsg.includes('quota') ||
    errorMsg.includes('insufficient') ||
    errorMsg.includes('余额') ||
    errorMsg.includes('额度') ||
    errorMsg.includes('unauthorized') ||
    errorMsg.includes('invalid api key') ||
    errorMsg.includes('exceeded')
  );
}

import { requireAuth, AuthRequest } from '../middleware/auth';
import { isTrustedInternalRequest } from '../utils/internal-request-auth';
import { aiPublicLimiter } from '../middleware/rateLimiter'; // P1 修复 #8：AI 公开接口限流
import { config } from '../types/env';
import { decryptProviderSecrets } from './ai-provider';
import { generateVoiceChatAudio } from './audio';
// SEC-AUDIT 修复：导入会员等级模型白名单校验，防止前端绕过会员等级限制调用 Pro 专属模型
import {
  isModelAllowedForMembership,
  isProviderAllowedForMembership,
} from './ai-provider-membership';
import { creditService } from '../services/credit-service';
import { redisService } from '../services/redis-service';
import { logger } from '../utils/logger';
import { initOptimizePipeline, optimizePrompt } from '../services/promptSmart3/optimizePipeline';
import { sanitizeOptimizedPrompt } from '../services/promptSmart3/final-prompt-formatter';
import { getCulturalDefaultRule } from '../services/promptSmart3/cultural-defaults';
import { ProviderConfig } from '../services/promptSmart3/providerTypes';
import {
  getAllProviderStatus,
  selectProvider,
  selectProviderByName,
  reportSuccess,
  reportFailure,
} from '../services/promptSmart3/providerRegistry';
import { getAllStats } from '../services/promptSmart3/statsStore';
import { routeRequest } from '../services/promptSmart3/router';
import promptSmart3ProviderConfigs from '../services/promptSmart3/providers.json';

const providersConfig: ProviderConfig[] = promptSmart3ProviderConfigs;

let promptSmart3Ready = false;

const SUPPORTED_PROVIDERS = [
  'doubao',
  // 已废弃 (2026-07-18): xunfei / xunfei-x2 / xunfei-x15 文字通道下线，但从 SUPPORTED_PROVIDERS 保留
  // 因为 comic.ts 仍通过 ai-proxy 调用讯飞端点进行漫剧内容生成。后续 comic.ts 迁移后可移除。
  'xunfei',
  'xunfei-x2',
  'xunfei-x15',
  'deepseek',
  'qwen',
  'wuyinkeji',
  'apipaths-kimi-k3',
  'apipaths-glm-5.1',
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'volcano',
  'volcano-ark',
  'doubao-seed-pro',
  'doubao-seed-code',
  'doubao-seed-lite',
  'doubao-seed-mini',
  'doubao-smart-router',
  'kimi-k2-thinking',
  'sensenova',
  'sensenova-6.7-flash-lite',
  'stepfun',
  'step-3.7-flash',
  'step-3.5-flash',
  'iamhc-deepseek-v4-flash',
  'iamhc-kimi-k2.6',
  'iamhc-minimax-m3',
  'iamhc-minimax-m2.7',
  'iamhc-glm-4.7',
  'iamhc-qwen3.6-35b',
  'minimax',
];

const GUEST_TRIAL_LIMIT = 10;
const guestTrialMap = new Map<string, { count: number; date: string }>();
const GUEST_VOICE_TRIAL_LIMIT = 10;
const guestVoiceTrialMap = new Map<string, { count: number; date: string }>();
const GUEST_VOICE_TRIAL_KEY_PREFIX = 'guest_voice_trial:';
const DEFAULT_MINIMAX_MODEL = 'MiniMax-M2.7-highspeed';

// 模型自动降级链
const MODEL_FALLBACK_CHAIN: Record<string, string[]> = {};

function getAvailableProviders(): string[] {
  return SUPPORTED_PROVIDERS;
}

function resolveChatModel(
  provider: string,
  requestedModel: string | undefined,
  defaultModel: string
): string {
  const normalizedModel = requestedModel?.trim();
  if (!normalizedModel || normalizedModel === 'auto') return defaultModel;

  // 讯飞星火仅允许 Spark X2 / X1.5；HTTP 兼容端点实测上游 model 参数为 x1。
  if (isXunfeiSparkProvider(provider)) {
    return XUNFEI_SPARK_UPSTREAM_MODEL;
  }

  // 前端文本模型选择器传的是 provider id。这里兜底转成该 provider 的真实默认模型，
  // 避免把 "volcano-ark" / "apipaths-gpt-5.5" 这类路由 id 当作上游模型名。
  if (normalizedModel === provider || SUPPORTED_PROVIDERS.includes(normalizedModel)) {
    return defaultModel;
  }

  return normalizedModel;
}

function getGuestIdentifier(req: Request): string {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
  return `guest:${ip}`;
}

function checkGuestTrial(identifier: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().split('T')[0];
  const current = guestTrialMap.get(identifier);

  if (!current || current.date !== today) {
    return { allowed: true, remaining: GUEST_TRIAL_LIMIT };
  }

  if (current.count >= GUEST_TRIAL_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: GUEST_TRIAL_LIMIT - current.count };
}

function incrementGuestTrial(identifier: string): void {
  const today = new Date().toISOString().split('T')[0];
  const current = guestTrialMap.get(identifier);

  if (!current || current.date !== today) {
    guestTrialMap.set(identifier, { count: 1, date: today });
  } else {
    current.count++;
    guestTrialMap.set(identifier, current);
  }
}

// 公开路由访客试用中间件。有效登录用户不消耗访客次数；无效 Bearer 仍按访客计数。
async function requireGuestTrial(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    await optionalAuth(req as AuthRequest);
    if ((req as AuthRequest).userId) {
      return next();
    }
  }

  const guestId = getGuestIdentifier(req);
  const trialCheck = checkGuestTrial(guestId);
  if (!trialCheck.allowed) {
    res.status(402).json({
      success: false,
      error: `今日体验次数已用完（每日${GUEST_TRIAL_LIMIT}次）。请登录获取更多次数。`,
    });
    return;
  }
  (req as any).guestId = guestId;
  (req as any).trialRemaining = trialCheck.remaining;

  // 拦截 res.json，在成功响应时自动扣除访客试用次数
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (body && body.success) {
      incrementGuestTrial(guestId);
    }
    return originalJson(body);
  };

  next();
}

function getGuestVoiceTrialTtlSeconds(): number {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return Math.max(3600, Math.min(Math.ceil((endOfDay.getTime() - now.getTime()) / 1000), 86400));
}

async function getGuestVoiceTrial(
  identifier: string
): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  const redisKey = `${GUEST_VOICE_TRIAL_KEY_PREFIX}${today}:${identifier}`;
  if (redisService.isAvailable()) {
    try {
      const countValue = await redisService.getClient()?.get(redisKey);
      const parsedCount = countValue ? Number.parseInt(countValue, 10) : 0;
      const count = Number.isNaN(parsedCount) ? 0 : parsedCount;
      return {
        allowed: count < GUEST_VOICE_TRIAL_LIMIT,
        remaining: Math.max(0, GUEST_VOICE_TRIAL_LIMIT - count),
      };
    } catch (error) {
      logger.warn('[VoiceChat] Redis 额度读取失败，回退内存计数', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const current = guestVoiceTrialMap.get(identifier);
  if (!current || current.date !== today) {
    return { allowed: true, remaining: GUEST_VOICE_TRIAL_LIMIT };
  }
  return {
    allowed: current.count < GUEST_VOICE_TRIAL_LIMIT,
    remaining: Math.max(0, GUEST_VOICE_TRIAL_LIMIT - current.count),
  };
}

async function incrementGuestVoiceTrial(identifier: string): Promise<void> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  const redisKey = `${GUEST_VOICE_TRIAL_KEY_PREFIX}${today}:${identifier}`;
  if (redisService.isAvailable()) {
    try {
      const client = redisService.getClient();
      if (client) {
        const count = await client.incr(redisKey);
        if (count === 1) await client.expire(redisKey, getGuestVoiceTrialTtlSeconds());
        return;
      }
    } catch (error) {
      logger.warn('[VoiceChat] Redis 额度写入失败，回退内存计数', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const current = guestVoiceTrialMap.get(identifier);
  guestVoiceTrialMap.set(identifier, {
    count: !current || current.date !== today ? 1 : current.count + 1,
    date: today,
  });
}

async function requireGuestVoiceTrial(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    await optionalAuth(req as AuthRequest);
    if ((req as AuthRequest).userId) {
      (req as any).voiceTrialUnlimited = true;
      return next();
    }
  }

  const guestId = getGuestIdentifier(req);
  const trial = await getGuestVoiceTrial(guestId);
  if (!trial.allowed) {
    res.status(402).json({
      success: false,
      code: 'VOICE_TRIAL_EXHAUSTED',
      loginRequired: true,
      remaining: 0,
      error: `免费语音聊天${GUEST_VOICE_TRIAL_LIMIT}次已用完，请登录后继续使用。`,
    });
    return;
  }

  (req as any).guestVoiceId = guestId;
  (req as any).voiceTrialRemaining = trial.remaining;
  next();
}

function isMiniMaxM2Model(model: string): boolean {
  return /^MiniMax-M2(?:\.5|\.7)(?:-highspeed)?$/i.test(model);
}

function isMiniMaxM27Model(model: string): boolean {
  return /^MiniMax-M2\.7(?:-highspeed)?$/i.test(model);
}

function buildMinimaxChatEndpoint(baseUrl: string, model: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');

  if (isMiniMaxM2Model(model)) {
    return normalized.endsWith('/v1')
      ? `${normalized}/chat/completions`
      : `${normalized}/v1/chat/completions`;
  }

  return normalized.endsWith('/v1')
    ? `${normalized}/text/chatcompletion_v2`
    : `${normalized}/v1/text/chatcompletion_v2`;
}

function isOpenAICompatibleProvider(provider: string): boolean {
  return [
    'deepseek',
    'xunfei',
    'xunfei-x2',
    'xunfei-x15',
    'qwen',
    'doubao',
    'apipaths-kimi-k3',
    'apipaths-glm-5.1',
    'deepseek-v4-pro',
    'deepseek-v4-flash',
    'volcano',
    'volcano-ark',
    'sensenova',
    'stepfun',
    'doubao-seed-pro',
    'doubao-seed-code',
    'doubao-seed-lite',
    'doubao-seed-mini',
    'doubao-smart-router',
    'kimi-k2-thinking',
  ].includes(provider);
}

function buildProviderEndpoint(provider: string, baseUrl: string, model: string): string {
  if (provider === 'minimax') return buildMinimaxChatEndpoint(baseUrl, model);
  if (provider === 'wuyinkeji') {
    const normalized = baseUrl.replace(/\/+$/, '');
    return `${normalized}/api/chat/index`;
  }
  if (provider === 'doubao') {
    const normalized = baseUrl.replace(/\/+$/, '');
    return normalized.includes('/api/v3')
      ? `${normalized}/chat/completions`
      : `${normalized}/api/v3/chat/completions`;
  }
  if (isXunfeiSparkProvider(provider)) {
    // 讯飞星火 Spark HTTP 兼容端点: baseUrl 已含版本路径段 (/x2 或 /v2)，直接拼 /chat/completions
    const normalized = baseUrl.replace(/\/+$/, '');
    return `${normalized}/chat/completions`;
  }
  if (provider === 'deepseek' || provider === 'deepseek-v4-pro') {
    const normalized = baseUrl.replace(/\/+$/, '');
    return `${normalized}/chat/completions`;
  }
  if (
    provider === 'sensenova' ||
    provider === 'deepseek-v4-flash' ||
    provider === 'sensenova-6.7-flash-lite'
  ) {
    // SenseNova OpenAI 兼容接口: baseUrl 已包含 /v1
    const normalized = baseUrl.replace(/\/+$/, '');
    return normalized.endsWith('/v1')
      ? `${normalized}/chat/completions`
      : `${normalized}/v1/chat/completions`;
  }
  if (provider === 'stepfun' || provider === 'step-3.7-flash' || provider === 'step-3.5-flash') {
    const normalized = baseUrl.replace(/\/+$/, '');
    return normalized.endsWith('/v1')
      ? `${normalized}/chat/completions`
      : `${normalized}/v1/chat/completions`;
  }
  if (provider === 'volcano' || provider === 'volcano-ark') {
    const normalized = baseUrl.replace(/\/+$/, '');
    // 火山方舟 Coding Plan: baseUrl 已包含 /v3，直接拼 /chat/completions
    return normalized.endsWith('/v3') || normalized.endsWith('/v1')
      ? `${normalized}/chat/completions`
      : `${normalized}/v1/chat/completions`;
  }
  if (
    provider === 'doubao-seed-pro' ||
    provider === 'doubao-seed-code' ||
    provider === 'doubao-seed-lite' ||
    provider === 'doubao-seed-mini' ||
    provider === 'doubao-smart-router' ||
    provider === 'kimi-k2-thinking'
  ) {
    const normalized = baseUrl.replace(/\/+$/, '');
    // 火山方舟标准API: baseUrl 已包含 /v3
    return normalized.endsWith('/v3') || normalized.endsWith('/v1')
      ? `${normalized}/chat/completions`
      : `${normalized}/api/v3/chat/completions`;
  }
  // 已废弃 (2026-07-18): zhipu / glm-5.1 case 已移除（智谱 GLM 文字通道下线）
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.match(/\/v\d+$/)
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;
}

function resolveMinimaxRequestOptions(
  model: string,
  temperature?: number,
  maxTokens?: number
): { temperature: number; maxTokens: number; topP: number } {
  if (/MiniMax-M2\.5/i.test(model)) {
    return {
      temperature: temperature ?? 0.1,
      maxTokens: maxTokens ?? 8192,
      topP: 0.9,
    };
  }

  if (/MiniMax-M2\.7/i.test(model)) {
    return {
      temperature: temperature ?? 0.3,
      maxTokens: maxTokens ?? 16384,
      topP: 0.9,
    };
  }

  return {
    temperature: temperature ?? 0.7,
    maxTokens: maxTokens ?? 2048,
    topP: 0.95,
  };
}

async function resolveApiKeyFromDB(
  providerName: string,
  envKey?: string
): Promise<string | undefined> {
  if (providerName.startsWith('xunfei')) {
    const sparkKey = resolveXunfeiSparkApiKey();
    if (sparkKey) return sparkKey;
    try {
      const providerConfig = await prisma.providerConfig.findUnique({
        where: { provider: 'xunfei' },
      });
      if (providerConfig && providerConfig.isActive && providerConfig.apiKey) {
        const secrets = decryptProviderSecrets(providerConfig);
        if (secrets.apiKey) return secrets.apiKey;
      }
    } catch (e: unknown) {
      console.warn('Failed to resolve XUNFEI api key:', e instanceof Error ? e.message : String(e));
    }
    if (envKey && process.env[envKey]) {
      const val = process.env[envKey];
      if (val.includes(':')) return val;
    }
    return undefined;
  }

  try {
    const providerConfig = await prisma.providerConfig.findUnique({
      where: { provider: providerName },
    });
    if (providerConfig && providerConfig.isActive && providerConfig.apiKey) {
      const secrets = decryptProviderSecrets(providerConfig);
      if (secrets.apiKey) return secrets.apiKey;
    }
  } catch (e: unknown) {
    console.warn(
      `Failed to resolve API key for ${providerName}:`,
      e instanceof Error ? e.message : String(e)
    );
  }
  if (envKey) {
    // 支持逗号分隔的多个 env key（多秘钥轮询），随机选择一个可用秘钥
    const envKeys = envKey
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    const availableKeys: string[] = [];
    for (const k of envKeys) {
      const val = process.env[k];
      if (val) availableKeys.push(val);
    }
    if (availableKeys.length > 0) {
      return availableKeys[Math.floor(Math.random() * availableKeys.length)];
    }
  }
  return undefined;
}

async function ensurePromptSmart3Init(): Promise<boolean> {
  if (promptSmart3Ready) return true;
  try {
    await initOptimizePipeline(providersConfig, resolveApiKeyFromDB);
    promptSmart3Ready = true;
    return true;
  } catch (e: unknown) {
    logger.error('[PromptSmart3] Init failed:', e instanceof Error ? e.message : String(e));
    return false;
  }
}

async function optionalAuth(req: AuthRequest): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return;
  }
  const token = authHeader.split(' ')[1];
  if (!token || token.split('.').length !== 3) {
    return;
  }
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    if (decoded.userId) {
      req.userId = decoded.userId;
      req.userRole = (decoded.role || 'user').toLowerCase();
      const activeMembership = await prisma.userMembership.findFirst({
        where: { userId: decoded.userId, status: 'active', endAt: { gte: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      req.membershipLevel = activeMembership?.level || 'trial';
    }
  } catch {
    // ignore auth errors for optional auth
  }
}

ensurePromptSmart3Init();

async function getAvailableChatProvider(): Promise<string | null> {
  const candidates = ['deepseek', 'doubao', 'wuyinkeji'];
  for (const provider of candidates) {
    try {
      const apiConfig = await getProviderConfig(provider);
      if (apiConfig.apiKey) {
        return provider;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function optimizePromptFallback(
  prompt: string,
  scenario?: string,
  category?: string,
  prePrompt?: string
): Promise<{ optimizedPrompt: string; provider: string }> {
  const provider = await getAvailableChatProvider();
  if (!provider) {
    throw new Error('No available chat provider for fallback optimization');
  }

  const apiConfig = await getProviderConfig(provider);
  const systemPrompt = getOptimizationSystemPrompt(scenario, category);

  let userPrompt = `请优化以下提示词：\n${prompt}`;
  if (prePrompt) {
    userPrompt = `用户附加指令：${prePrompt}\n\n${userPrompt}`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const resolvedModel = apiConfig.defaultModel;
  const endpoint = buildProviderEndpoint(provider, apiConfig.baseUrl, resolvedModel);

  if (provider === 'wuyinkeji') {
    const combinedContent = `${systemPrompt}\n\n${userPrompt}`;
    const wuyinBody = new URLSearchParams();
    wuyinBody.append('content', combinedContent);
    wuyinBody.append('model', resolvedModel);
    wuyinBody.append('stream', 'false');

    const response = await axios.post(endpoint, wuyinBody.toString(), {
      headers: {
        Authorization: apiConfig.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 60000,
    });

    const data = response.data;
    if (data.code !== 200) {
      throw new Error(`小天API fallback 请求失败: ${data.msg || data.code}`);
    }
    const rawContent = data.data?.choices?.[0]?.message?.content || '';
    const content = stripThinkingTags(rawContent);
    if (!content) throw new Error('Empty response from wuyinkeji fallback');
    const sanitized = sanitizeOptimizedPrompt(content, scenario);
    return { optimizedPrompt: sanitized, provider: `${provider} (fallback)` };
  }

  const requestBody: Record<string, unknown> = {
    model: resolvedModel,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 0.95,
  };

  const response = await axios.post(endpoint, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    timeout: 60000,
  });

  const data = response.data;
  const rawContent =
    data.choices?.[0]?.message?.content || data.choices?.[0]?.messages?.[0]?.content || '';
  const content = stripThinkingTags(rawContent);

  if (!content) {
    throw new Error('Empty response from fallback provider');
  }

  const sanitized = sanitizeOptimizedPrompt(content, scenario);

  return {
    optimizedPrompt: sanitized,
    provider: `${provider} (fallback)`,
  };
}

const aiProxyRouter = Router();
const DEFAULT_MEMBERSHIP_LEVEL = 'trial';

// SEC M-2 修复：ai-proxy 的 inpaint 等接口接收 base64 图片，单独放宽 body 限制到 20mb。
// 全局限制已降到 2mb，此处显式放宽以容纳 base64 图片数据。
aiProxyRouter.use(express.json({ limit: '20mb' }));

aiProxyRouter.get('/providers', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [],
  });
});

// 请求验证 schema
const multimodalContentSchema = z.array(z.union([
  z.object({ type: z.literal('text'), text: z.string().max(24000) }).strict(),
  z.object({
    type: z.literal('image_url'),
    image_url: z.object({ url: z.string().min(1).max(4_000_000) }).strict(),
  }).strict(),
])).min(1).max(8);

export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system', 'tool']),
        content: z.union([z.string(), multimodalContentSchema]),
        tool_calls: z.any().optional(),
        tool_call_id: z.string().optional(),
        reasoning_content: z.string().optional(),
      })
    )
    .min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().min(1).max(16384).optional().default(2048),
  stream: z.boolean().optional().default(false),
  provider: z.string().optional().default('deepseek-v4-flash'),
  source: z.string().optional(),
  tools: z.any().optional(),
  toolChoice: z.any().optional(),
  enableThinking: z.boolean().optional(),
  thinkingConfig: z
    .object({
      type: z.enum(['enabled', 'disabled']),
      budget_tokens: z.number().optional(),
    })
    .optional(),
  responseFormat: z
    .object({
      type: z.enum(['json_object', 'text']),
    })
    .optional(),
  seed: z.number().optional(),
  enablePromptCaching: z.boolean().optional(),
  cacheConfig: z
    .object({
      type: z.literal('summary'),
      max_prefix_tokens: z.number().optional(),
      max_cache_tokens: z.number().optional(),
    })
    .optional(),
});

/**
 * POST /api/v1/ai/chat
 * 代理 AI 对话请求
 */
aiProxyRouter.post('/chat', requireAuth, async (req: AuthRequest, res: Response) => {
  // 声明在 try 外部，以便 catch 块中的多密钥重试逻辑可以访问
  let provider = '';
  let stream: boolean | undefined = false;
  let apiConfig: { apiKey: string; baseUrl: string; defaultModel: string } | null = null;
  let endpoint = '';
  let requestBody: Record<string, unknown> = {};
  let membershipLevel = 'trial';
  let LLM_CHAT_POINTS = 5;
  let chatReasonPrefix = 'AI对话';
  let resolvedModel = '';
  let useHomepageSmartRoute = false;
  // T-15 修复：在 preCheck 之前生成一次 taskId，后续 consume/refund 复用同一 taskId 保证幂等
  let chatTaskId = '';

  try {
    const parseResult = chatSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: '无效的请求参数',
        details: parseResult.error.errors,
      });
    }

    const {
      messages,
      model,
      temperature,
      maxTokens,
      stream: parsedStream,
      provider: parsedProvider,
      source,
      tools,
      toolChoice,
      enableThinking,
      thinkingConfig,
      responseFormat,
      seed,
      enablePromptCaching,
      cacheConfig,
    } = parseResult.data;
    stream = parsedStream;
    provider = parsedProvider;
    // 首页文字对话不应被单个上游模型的临时 403/额度耗尽阻断。
    // 保留用户当前选择作为首选项，随后交给 PromptSmart3 自动降级。
    useHomepageSmartRoute = source === 'homepage' && provider === 'auto';

    if (!useHomepageSmartRoute && !getAvailableProviders().includes(provider)) {
      return res.status(400).json({
        success: false,
        error: `Provider not supported: ${provider}`,
      });
    }

    if (!useHomepageSmartRoute) {
      apiConfig = await getProviderConfig(provider);

      if (!apiConfig.apiKey) {
        return res.status(503).json({
          success: false,
          error: `${provider} API not configured, please contact administrator`,
        });
      }
    }

    // 积分预检查
    membershipLevel = req.membershipLevel || 'trial';
    const isPosterChat = source === 'ai-poster' || source === 'poster';
    const isPosterAgentInternalCall = isTrustedInternalRequest(req, 'poster-agent');
    chatReasonPrefix = isPosterAgentInternalCall ? '海报内部规划' : isPosterChat ? 'AI海报' : 'AI对话';
    // 首页海报的单次 60 积分包含其内部文字规划，避免一次生成被重复收费。
    LLM_CHAT_POINTS = isPosterAgentInternalCall ? 0 : isPosterChat ? 10 : 5;
    // T-15 修复：生成一次 taskId，后续 consume/refund 复用，避免 preCheck/consume taskId 不一致
    chatTaskId = `chat_${Date.now()}`;
    const creditCheck = await creditService.preCheck({
      userId: req.userId!,
      membershipLevel,
      type: 'prompt',
      customPoints: LLM_CHAT_POINTS,
      taskId: chatTaskId,
      reason: `${chatReasonPrefix}预检查`,
    });

    if (!creditCheck.allowed) {
      return res.status(402).json({ success: false, error: creditCheck.reason });
    }

    if (useHomepageSmartRoute) {
      const ready = await ensurePromptSmart3Init();
      if (!ready) {
        return res.status(503).json({
          success: false,
          error: '首页文字智能路由尚未就绪，请检查文字模型配置',
        });
      }

      const latestUserContent = [...messages].reverse().find((message) => message.role === 'user');
      const latestUserText = typeof latestUserContent?.content === 'string' ? latestUserContent.content : '';
      const smartMessages = messages
        .filter((message) => message.role !== 'tool')
        .map((message) => ({
          role: message.role as 'system' | 'user' | 'assistant',
          content: typeof message.content === 'string'
            ? message.content
            : message.content
              .filter((part) => part.type === 'text')
              .map((part) => part.text || '')
              .join('\n'),
        }));
      const preferredProvider = model && model !== 'auto' ? model : undefined;
      const smartResult = await routeRequest(
        [],
        smartMessages,
        (tried) => {
          if (preferredProvider && !tried.has(preferredProvider)) {
            const preferred = selectProviderByName(preferredProvider);
            if (preferred && !preferred.circuitBreaker.isOpen) {
              return { config: preferred.config, name: preferred.config.name };
            }
          }
          const selected = selectProvider(tried);
          return selected ? { config: selected.config, name: selected.config.name } : null;
        },
        reportSuccess,
        reportFailure,
      );

      const content = stripThinkingTags(smartResult.content || '');
      await creditService.consume({
        userId: req.userId!,
        membershipLevel,
        type: 'prompt',
        customPoints: LLM_CHAT_POINTS,
        taskId: chatTaskId,
        reason: `${chatReasonPrefix}(智能路由)`,
      });

      return res.json({
        success: true,
        content,
        model: smartResult.provider,
        usage: null,
      });
    }

    resolvedModel = resolveChatModel(provider, model, apiConfig.defaultModel);
    const resolvedOptions =
      provider === 'minimax'
        ? resolveMinimaxRequestOptions(resolvedModel, temperature, maxTokens)
        : {
            temperature,
            maxTokens,
            topP: 0.95,
          };
    endpoint = buildProviderEndpoint(provider, apiConfig.baseUrl, resolvedModel);

    if (provider === 'wuyinkeji') {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      const userContent = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';
      const wuyinBody = new URLSearchParams();
      wuyinBody.append('content', userContent);
      wuyinBody.append('model', resolvedModel);
      wuyinBody.append('stream', String(stream));

      const wuyinHeaders: Record<string, string> = {
        Authorization: apiConfig.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      if (stream) {
        await creditService
          .consume({
            userId: req.userId!,
            membershipLevel,
            type: 'prompt',
            customPoints: LLM_CHAT_POINTS,
            taskId: chatTaskId,
            reason: `${chatReasonPrefix}(流式)`,
          })
          .catch((err) => logger.error('[AI Proxy] 流式积分扣除失败:', err.message));

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const response = await axios.post(endpoint, wuyinBody.toString(), {
          headers: wuyinHeaders,
          responseType: 'stream',
          timeout: 60000,
        });

        response.data.on('data', (chunk: Buffer) => {
          res.write(chunk);
        });
        response.data.on('end', () => {
          res.end();
        });
        response.data.on('error', (err: Error) => {
          logger.error(
            '[AI Proxy] Stream error:',
            err instanceof Error ? err.message : String(err)
          );
          // T-1/T-2 修复：wuyinkeji 流式分支扣费后流中断，退还积分
          creditService
            .refund({
              userId: req.userId!,
              type: 'prompt',
              customPoints: LLM_CHAT_POINTS,
              taskId: chatTaskId,
              reason: `${chatReasonPrefix}失败退款`,
            })
            .catch((refundErr) => logger.error('[AI Proxy] 退款失败:', refundErr));
          res.end();
        });
        req.on('close', () => {
          response.data.destroy();
        });
      } else {
        const response = await axios.post(endpoint, wuyinBody.toString(), {
          headers: wuyinHeaders,
          timeout: 60000,
        });

        const data = response.data;
        if (data.code !== 200) {
          return res.status(400).json({
            success: false,
            error: data.msg || `小天API请求失败 (code: ${data.code})`,
          });
        }

        const rawContent = data.data?.choices?.[0]?.message?.content || '';
        const content = stripThinkingTags(rawContent);

        await creditService
          .consume({
            userId: req.userId!,
            membershipLevel,
            type: 'prompt',
            customPoints: LLM_CHAT_POINTS,
            taskId: chatTaskId,
            reason: chatReasonPrefix,
          })
          .catch((err) => logger.error('[AI Proxy] 积分扣除失败:', err.message));

        return res.json({
          success: true,
          content,
          model: data.data?.model || resolvedModel,
          usage: data.data?.usage || null,
        });
      }
      return;
    }

    requestBody = {
      model: resolvedModel,
      ...(provider === 'stepfun' && resolvedModel === 'stepaudio-2.5-chat'
        ? { modalities: ['text'] }
        : {}),
      messages,
      temperature: resolvedOptions.temperature,
      max_tokens: resolvedOptions.maxTokens,
      top_p: resolvedOptions.topP,
      stream,
      ...(provider === 'minimax' && isMiniMaxM2Model(resolvedModel) && tools ? { tools } : {}),
      ...(provider === 'minimax' && isMiniMaxM2Model(resolvedModel) && toolChoice
        ? { tool_choice: toolChoice }
        : {}),
      ...(provider === 'minimax' && isMiniMaxM27Model(resolvedModel) && enableThinking !== false
        ? {
            thinking: thinkingConfig || {
              type: 'enabled',
              budget_tokens: Math.min(8192, Math.floor(resolvedOptions.maxTokens * 0.4)),
            },
          }
        : {}),
      ...(provider === 'minimax' && isMiniMaxM27Model(resolvedModel) && enableThinking === false
        ? { thinking: { type: 'disabled' } }
        : {}),
      ...(provider === 'minimax' && isMiniMaxM27Model(resolvedModel) && responseFormat
        ? { response_format: responseFormat }
        : {}),
      ...(provider === 'minimax' && isMiniMaxM27Model(resolvedModel) && seed !== undefined
        ? { seed }
        : {}),
      ...(provider === 'minimax' && isMiniMaxM2Model(resolvedModel) && enablePromptCaching
        ? {
            cache_config: cacheConfig || {
              type: 'summary',
              max_prefix_tokens: Math.min(8192, Math.floor(resolvedOptions.maxTokens * 0.5)),
              max_cache_tokens: Math.floor(resolvedOptions.maxTokens * 0.9),
            },
          }
        : {}),
    };

    if (stream) {
      // 流式响应：先扣积分，再转发 SSE 流
      await creditService
        .consume({
          userId: req.userId!,
          membershipLevel,
          type: 'prompt',
          customPoints: LLM_CHAT_POINTS,
          taskId: chatTaskId,
          reason: `${chatReasonPrefix}(流式)`,
        })
        .catch((err) => logger.error('[AI Proxy] 流式积分扣除失败:', err.message));

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const response = await axios.post(endpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`,
        },
        responseType: 'stream',
        timeout: 60000,
      });

      response.data.on('data', (chunk: Buffer) => {
        res.write(chunk);
      });

      response.data.on('end', () => {
        res.end();
      });

      response.data.on('error', (err: Error) => {
        logger.error('[AI Proxy] Stream error:', err instanceof Error ? err.message : String(err));
        res.end();
      });

      // 客户端断开时终止上游连接
      req.on('close', () => {
        response.data.destroy();
      });
    } else {
      // 非流式响应
      const response = await axios.post(endpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`,
        },
        timeout: 30000,
      });

      const data = response.data;

      if (provider === 'minimax' && data.base_resp && data.base_resp.status_code !== 0) {
        return res.status(400).json({
          success: false,
          error: data.base_resp.status_msg || 'API 请求失败',
          code: data.base_resp.status_code,
        });
      }

      const rawContent =
        data.choices?.[0]?.message?.content ||
        data.choices?.[0]?.messages?.[0]?.content ||
        data.choices?.[0]?.message?.content ||
        '';
      const messageObj = data.choices?.[0]?.message as Record<string, unknown> | undefined;
      const content = stripThinkingTags(rawContent);
      const reasoningContent = data.choices?.[0]?.message?.reasoning_content || '';
      const toolCalls = parseChatToolCalls(messageObj);

      // 成功响应后扣除积分
      await creditService
        .consume({
          userId: req.userId!,
          membershipLevel,
          type: 'prompt',
          customPoints: LLM_CHAT_POINTS,
          taskId: chatTaskId,
          reason: chatReasonPrefix,
        })
        .catch((err) => logger.error('[AI Proxy] 积分扣除失败:', err));

      return res.json({
        success: true,
        content,
        reasoning_content: reasoningContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        model: data.model || resolvedModel,
        usage: data.usage || null,
      });
    }
  } catch (error: any) {
    // SenseNova 多密钥重试: 秘钥1额度耗尽自动切换秘钥2
    if (
      (provider === 'sensenova' || provider === 'deepseek-v4-flash') &&
      !res.headersSent &&
      isQuotaOrAuthError(error)
    ) {
      const backupKey = process.env.SENSENOVA_API_KEY_2;
      if (backupKey && backupKey !== apiConfig.apiKey) {
        console.warn('[AI Proxy] SenseNova 秘钥1失败，切换到秘钥2重试...', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
        });
        try {
          if (stream) {
            const retryResponse = await axios.post(endpoint, requestBody, {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${backupKey}`,
              },
              responseType: 'stream',
              timeout: 60000,
            });
            retryResponse.data.on('data', (chunk: Buffer) => res.write(chunk));
            retryResponse.data.on('end', () => res.end());
            retryResponse.data.on('error', (err: Error) => {
              logger.error(
                '[AI Proxy] Stream retry error:',
                err instanceof Error ? err.message : String(err)
              );
              res.end();
            });
            req.on('close', () => retryResponse.data.destroy());
            return;
          } else {
            const retryResponse = await axios.post(endpoint, requestBody, {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${backupKey}`,
              },
              timeout: 30000,
            });
            const data = retryResponse.data;
            const rawContent =
              data.choices?.[0]?.message?.content ||
              data.choices?.[0]?.messages?.[0]?.content ||
              '';
            const messageObj = data.choices?.[0]?.message as Record<string, unknown> | undefined;
            const content = stripThinkingTags(rawContent);
            const reasoningContent = data.choices?.[0]?.message?.reasoning_content || '';
            const toolCalls = parseChatToolCalls(messageObj);

            await creditService
              .consume({
                userId: req.userId!,
                membershipLevel,
                type: 'prompt',
                customPoints: LLM_CHAT_POINTS,
                taskId: chatTaskId,
                reason: `${chatReasonPrefix}(SenseNova秘钥2)`,
              })
              .catch((err) => logger.error('[AI Proxy] 积分扣除失败:', err.message));

            return res.json({
              success: true,
              content,
              reasoning_content: reasoningContent,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              model: data.model || resolvedModel,
              usage: data.usage || null,
            });
          }
        } catch (retryError: any) {
          logger.error(
            '[AI Proxy] SenseNova 秘钥2也失败:',
            retryError.response?.status,
            retryError.message
          );
          if (!res.headersSent) {
            return res.status(retryError.response?.status || 500).json({
              success: false,
              error: `AI服务请求失败(秘钥2): ${retryError.response?.data?.message || retryError.message}`,
              details: retryError.response?.data || {},
            });
          }
          return;
        }
      }
    }

    const errorMsg = error.response?.data?.message || error.message || String(error);
    const errorDetail = error.response?.data || {};

    // T-1/T-2 修复：流式分支先扣费后调用 AI，失败时退还积分（非 SenseNova 重试路径）
    // 非流式分支扣费发生在 AI 调用成功之后，失败时无需退款
    if (stream) {
      await creditService
        .refund({
          userId: req.userId!,
          type: 'prompt',
          customPoints: LLM_CHAT_POINTS,
          taskId: chatTaskId,
          reason: `${chatReasonPrefix}失败退款`,
        })
        .catch((err) => logger.error('[AI Proxy] 退款失败:', err));
    }

    logger.error('[AI Proxy] Chat error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    if (!res.headersSent) {
      return res.status(error.response?.status || 500).json({
        success: false,
        error: `AI服务请求失败: ${errorMsg}`,
        details: errorDetail,
      });
    }
  }
});

/**
 * POST /api/v1/ai/optimize-prompt
 * 代理提示词优化请求
 */
aiProxyRouter.post('/optimize-prompt', requireAuth, async (req: AuthRequest, res: Response) => {
  // SEC-04 修复：添加 requireAuth 防止未认证用户消耗 AI 额度
  try {
    const { prompt, scenario, category } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: '提示词不能为空',
      });
    }

    const checkResult = await creditService.preCheck({
      userId: req.userId!,
      membershipLevel: req.membershipLevel || DEFAULT_MEMBERSHIP_LEVEL,
      type: 'prompt',
      taskId: 'temp',
      reason: '提示词优化预检查',
    });

    if (!checkResult.allowed) {
      return res.status(402).json({
        success: false,
        error: checkResult.reason,
      });
    }

    const ready = await ensurePromptSmart3Init();
    if (!ready) {
      const hasFallback = await getAvailableChatProvider();
      if (!hasFallback) {
        return res.status(503).json({
          success: false,
          error: '提示词优化服务初始化中，请稍后重试',
        });
      }
    }

    let result: {
      optimizedPrompt: string;
      provider: string;
      cached?: boolean;
      latencyMs?: number;
      qualityReport?: unknown;
      modelProfile?: string;
    };
    if (ready) {
      result = await optimizePrompt(prompt, scenario, category);
    } else {
      result = await optimizePromptFallback(prompt, scenario, category);
    }

    await creditService.consume({
      userId: req.userId!,
      membershipLevel: req.membershipLevel || DEFAULT_MEMBERSHIP_LEVEL,
      type: 'prompt',
      taskId: 'prompt_opt_' + Date.now(),
      reason: '提示词优化',
    });

    return res.json({
      success: true,
      optimizedPrompt: result.optimizedPrompt,
      provider: result.provider,
      cached: (result as any).cached ?? false,
      points: checkResult.pointsNeeded,
    });
  } catch (error: unknown) {
    logger.error(
      '[AI Proxy] Optimize error:',
      error instanceof Error ? error.message : String(error)
    );
    return res.status(500).json({
      success: false,
      error: '提示词优化服务暂时不可用',
    });
  }
});

/**
 * POST /api/v1/ai/optimize-prompt-v3
 * 智能多 Provider 提示词优化（加权路由 + 熔断 + 缓存）
 * 私有入口必须登录；访客请使用 /api/v1/public/ai/optimize-prompt-v3
 */
aiProxyRouter.post('/optimize-prompt-v3', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, scenario, category, models, preferredProvider, prePrompt, storyboardPlanning } =
      req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: '提示词不能为空',
      });
    }

    // SEC-AUDIT 修复：会员等级模型白名单校验，防止前端绕过调用 Pro 专属优化模型
    if (preferredProvider) {
      const membershipLevel = (req.membershipLevel || 'trial') as Parameters<
        typeof isProviderAllowedForMembership
      >[1];
      if (!isProviderAllowedForMembership(preferredProvider, membershipLevel)) {
        return res.status(403).json({
          success: false,
          error: '当前会员等级无权使用该服务商',
          code: 'PROVIDER_NOT_ALLOWED',
        });
      }
    }

    const ready = await ensurePromptSmart3Init();
    if (!ready) {
      const hasFallback = await getAvailableChatProvider();
      if (!hasFallback) {
        return res.status(503).json({
          success: false,
          error: '提示词优化服务尚未就绪，请检查 Provider 配置',
        });
      }
    }

    const PROMPT_MODEL_POINTS: Record<string, number> = {
      auto: 20,
      'deepseek-v4-flash': 20,
      'deepseek-v4-pro': 30,
      'xunfei-1': 10,
      'xunfei-2': 10,
      minimax: 15,
      'longcat-flash-lite': 10,
      'longcat-flash-thinking': 20,

      'qwen3-plus': 25,
      'moonshot-k2.5': 25,
      'yi-large': 22,
      'step-3.7-flash': 28,
      'step-3.5-flash': 25,
      'sensenova-6.7-flash-lite': 20,
      'kimi-k2-thinking': 25,
      'doubao-seed-pro': 25,
      'sensenova': 20,
    };
    // 故事版规划采用固定套餐价，避免被前端选择的文本模型覆盖实际扣费。
    const customPoints =
      storyboardPlanning === true
        ? 60
        : preferredProvider
          ? (PROMPT_MODEL_POINTS[preferredProvider] ?? 0)
          : undefined;

    const promptTaskId = 'prompt_opt_v3_' + Date.now();
    const checkResult = await creditService.preCheck({
      userId: req.userId!,
      membershipLevel: req.membershipLevel || DEFAULT_MEMBERSHIP_LEVEL,
      type: 'prompt',
      taskId: promptTaskId,
      reason: storyboardPlanning === true ? '故事版方案生成预检查' : '提示词优化预检查',
      customPoints,
    });

    if (!checkResult.allowed) {
      return res.status(402).json({
        success: false,
        error: checkResult.reason,
      });
    }

    let result: {
      optimizedPrompt: string;
      provider: string;
      cached?: boolean;
      latencyMs?: number;
      qualityReport?: unknown;
      modelProfile?: string;
    };
    if (ready) {
      result = await optimizePrompt(
        prompt,
        scenario,
        category,
        models,
        preferredProvider,
        prePrompt
      );
    } else {
      result = await optimizePromptFallback(prompt, scenario, category, prePrompt);
    }

    await creditService.consume({
      userId: req.userId!,
      membershipLevel: req.membershipLevel || DEFAULT_MEMBERSHIP_LEVEL,
      type: 'prompt',
      taskId: promptTaskId,
      reason:
        storyboardPlanning === true
          ? '故事版方案生成（60积分）'
          : `智能提示词优化${preferredProvider ? `(${preferredProvider})` : ''}`,
      customPoints,
    });

    return res.json({
      success: true,
      optimizedPrompt: result.optimizedPrompt,
      provider: result.provider,
      cached: (result as any).cached ?? false,
      latencyMs: (result as any).latencyMs ?? 0,
      qualityReport: result.qualityReport,
      modelProfile: result.modelProfile,
      points: checkResult.pointsNeeded,
    });
  } catch (error: unknown) {
    logger.error(
      '[AI Proxy] Optimize V3 error:',
      error instanceof Error ? error.message : String(error)
    );
    return res.status(500).json({
      success: false,
      error: '提示词优化服务暂时不可用',
    });
  }
});

/**
 * GET /api/v1/ai/optimize-prompt-v3/status
 * 提示词优化服务状态
 */
aiProxyRouter.get(
  '/optimize-prompt-v3/status',
  requireAuth,
  async (_req: Request, res: Response) => {
    await ensurePromptSmart3Init();
    const providers = getAllProviderStatus();
    const stats = await getAllStats();
    return res.json({
      success: true,
      providers,
      stats,
    });
  }
);

/**
 * GET /api/v1/ai/status
 * 检查 AI 服务的可用性
 */
aiProxyRouter.get('/status', requireAuth, async (_req: Request, res: Response) => {
  const [doubaoConfig, deepseekConfig, sensenovaConfig, wuyinConfig] = await Promise.all([
    getProviderConfig('doubao'),
    getProviderConfig('deepseek'),
    getProviderConfig('sensenova'),
    getProviderConfig('wuyinkeji'),
  ]);

  const providers = {
    doubao: !!doubaoConfig.apiKey,
    deepseek: !!deepseekConfig.apiKey,
    sensenova: !!sensenovaConfig.apiKey,
    wuyinkeji: !!wuyinConfig.apiKey,
    stability: !!process.env.STABILITY_API_KEY,
  };

  return res.json({
    success: true,
    providers,
    availableProviders: Object.entries(providers)
      .filter(([, available]) => available)
      .map(([name]) => name),
  });
});

/**
 * POST /api/v1/ai/inpaint
 * 代理局部重绘请求
 */
const inpaintSchema = z.object({
  image: z.string().min(1, '图片数据不能为空'),
  mask: z.string().optional(),
  prompt: z.string().optional(),
  provider: z.string().optional().default('stability-ai'),
});

aiProxyRouter.post('/inpaint', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = inpaintSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: '请求参数无效',
        details: parseResult.error.errors,
      });
    }

    const { image, mask, prompt, provider } = parseResult.data;

    // 积分预检查
    const membershipLevel = req.membershipLevel || 'trial';
    const INPAINT_POINTS = 80;
    const creditCheck = await creditService.preCheck({
      userId: req.userId!,
      membershipLevel,
      type: 'image',
      customPoints: INPAINT_POINTS,
      taskId: `inpaint_${Date.now()}`,
      reason: 'AI局部重绘预检查',
    });

    if (!creditCheck.allowed) {
      return res.status(402).json({ success: false, error: creditCheck.reason });
    }

    let result: { imageUrl: string } | null = null;

    // Stability AI Inpainting
    if (provider === 'stability-ai') {
      const apiKey = process.env.STABILITY_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          success: false,
          error: '未配置 Stability AI API',
        });
      }

      // 将 base64 data URL 转为 Buffer
      const imageBase64 = image.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(imageBase64, 'base64');

      const formData = new FormData();
      formData.append('image', new Blob([imageBuffer]), 'image.png');

      if (mask) {
        const maskBase64 = mask.replace(/^data:image\/\w+;base64,/, '');
        const maskBuffer = Buffer.from(maskBase64, 'base64');
        formData.append('mask', new Blob([maskBuffer]), 'mask.png');
      }

      if (prompt) {
        formData.append('prompt', prompt);
      }

      formData.append('output_format', 'png');

      const response = await axios.post(
        'https://api.stability.ai/v2beta/stable-image/edit/inpaint',
        formData,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'image/*',
          },
          responseType: 'arraybuffer',
          timeout: 60000,
        }
      );

      const resultBuffer = Buffer.from(response.data);
      const resultBase64 = `data:image/png;base64,${resultBuffer.toString('base64')}`;
      result = { imageUrl: resultBase64 };
    }

    // Doubao Inpainting（火山引擎图像编辑 API）
    if (!result && provider === 'doubao') {
      const apiKey = process.env.DOUBAO_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          success: false,
          error: '豆包 API 未配置',
        });
      }

      const baseUrl = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com';

      const response = await axios.post(
        `${baseUrl}/api/v3/images/edits`,
        {
          image,
          mask: mask || '',
          prompt: prompt || '',
          n: 1,
          size: '1024x1024',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 60000,
        }
      );

      const imageUrl = response.data?.data?.[0]?.url || response.data?.data?.[0]?.b64_json;
      if (imageUrl) {
        result = {
          imageUrl: imageUrl.startsWith('data:') ? imageUrl : `data:image/png;base64,${imageUrl}`,
        };
      }
    }

    if (!result) {
      return res.status(400).json({
        success: false,
        error: `不支持的重绘服务商: ${provider}`,
      });
    }

    // 成功生成，扣除积分
    await creditService
      .consume({
        userId: req.userId!,
        membershipLevel,
        type: 'image',
        customPoints: INPAINT_POINTS,
        taskId: `inpaint_${Date.now()}`,
        reason: 'AI局部重绘',
      })
      .catch((err) => logger.error('[AI Proxy] Inpaint积分扣除失败:', err.message));

    return res.json({
      success: true,
      imageUrl: result.imageUrl,
      points: INPAINT_POINTS,
    });
  } catch (error: unknown) {
    logger.error(
      '[AI Proxy] Inpaint error:',
      error instanceof Error ? error.message : String(error)
    );
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: '局部重绘服务暂时不可用',
      });
    }
  }
});

/**
 * 获取 AI 提供商配置
 */
type ProviderRuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
};

async function getProviderConfigFromDatabase(
  provider: string
): Promise<{ apiKey: string; baseUrl?: string } | null> {
  try {
    const providerConfig = await prisma.providerConfig.findUnique({
      where: { provider },
    });
    if (!providerConfig || !providerConfig.isActive) return null;
    const secrets = decryptProviderSecrets(providerConfig);
    if (!secrets.apiKey) return null;
    return { apiKey: secrets.apiKey, baseUrl: providerConfig.endpoint || undefined };
  } catch (err) {
    logger.error(
      `[AI Proxy] 从数据库获取 ${provider} 配置失败:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

async function resolveProviderRuntimeConfig(
  provider: string,
  envApiKey: string,
  envBaseUrl: string | undefined,
  fallbackBaseUrl: string,
  defaultModel: string
): Promise<ProviderRuntimeConfig> {
  if (envApiKey) {
    return {
      apiKey: envApiKey,
      baseUrl: envBaseUrl || fallbackBaseUrl,
      defaultModel,
    };
  }

  const dbConfig = await getProviderConfigFromDatabase(provider);
  if (dbConfig?.apiKey) {
    return {
      apiKey: dbConfig.apiKey,
      baseUrl: dbConfig.baseUrl || envBaseUrl || fallbackBaseUrl,
      defaultModel,
    };
  }

  return {
    apiKey: '',
    baseUrl: envBaseUrl || fallbackBaseUrl,
    defaultModel,
  };
}

async function getProviderConfig(provider: string): Promise<ProviderRuntimeConfig> {
  switch (provider) {
    case 'apipaths-kimi-k3':
      return resolveProviderRuntimeConfig(
        'apipaths',
        process.env.APIPATHS_KIMI_API_KEY || process.env.APIPATHS_API_KEY || '',
        process.env.APIPATHS_BASE_URL,
        'https://apipaths.com/v1',
        'kimi-k3'
      );
    case 'apipaths-glm-5.1':
      return resolveProviderRuntimeConfig(
        'apipaths',
        process.env.APIPATHS_GLM_API_KEY || process.env.APIPATHS_API_KEY || '',
        process.env.APIPATHS_BASE_URL,
        'https://apipaths.com/v1',
        'glm-5.1'
      );
    case 'auto':
      // 已删除 (2026-07-20): 国外 apipaths (GPT) case 已下线，auto 回退到国内 DeepSeek
      return resolveProviderRuntimeConfig(
        'deepseek',
        process.env.DEEPSEEK_API_KEY || '',
        undefined,
        'https://api.deepseek.com',
        'deepseek-v4-flash'
      );
    case 'deepseek-v4-pro':
      return resolveProviderRuntimeConfig(
        'deepseek',
        process.env.DEEPSEEK_API_KEY || '',
        undefined,
        'https://api.deepseek.com',
        'deepseek-v4-pro'
      );
    case 'deepseek-v4-flash':
      return resolveProviderRuntimeConfig(
        'sensenova',
        resolveSensenovaApiKey(),
        process.env.SENSENOVA_BASE_URL,
        'https://token.sensenova.cn/v1',
        'deepseek-v4-flash'
      );
    case 'sensenova':
      return resolveProviderRuntimeConfig(
        'sensenova',
        resolveSensenovaApiKey(),
        process.env.SENSENOVA_BASE_URL,
        'https://token.sensenova.cn/v1',
        process.env.SENSENOVA_MODEL || 'deepseek-v4-flash'
      );
    case 'sensenova-6.7-flash-lite':
      return resolveProviderRuntimeConfig(
        'sensenova',
        resolveSensenovaApiKey(),
        process.env.SENSENOVA_BASE_URL,
        'https://token.sensenova.cn/v1',
        'sensenova-6.7-flash-lite'
      );
    case 'step-3.7-flash':
    case 'step-3.5-flash':
      return {
        apiKey: resolveStepfunApiKey(),
        baseUrl: process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/step_plan/v1',
        defaultModel: provider,
      };
    case 'stepfun': {
      try {
        const providerConfig = await prisma.providerConfig.findUnique({
          where: { provider: 'stepfun' },
        });
        if (providerConfig && providerConfig.isActive) {
          const secrets = decryptProviderSecrets(providerConfig);
          if (secrets.apiKey) {
            return {
              apiKey: secrets.apiKey,
              baseUrl:
                providerConfig.endpoint ||
                process.env.STEPFUN_BASE_URL ||
                'https://api.stepfun.com/step_plan/v1',
              defaultModel: process.env.STEPFUN_CHAT_MODEL || 'stepaudio-2.5-chat',
            };
          }
        }
      } catch (err) {
        logger.error(
          '[AI Proxy] 从数据库获取 StepFun 配置失败:',
          err instanceof Error ? err.message : String(err)
        );
      }
      return {
        apiKey: resolveStepfunApiKey(),
        baseUrl: process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/step_plan/v1',
        defaultModel: process.env.STEPFUN_CHAT_MODEL || 'stepaudio-2.5-chat',
      };
    }
    // 已废弃 (2026-07-18): glm-5.1 case 已移除（智谱 GLM 文字通道下线）
    // 已废弃 (2026-07-18): nvidia-deepseek-v4-pro case 已移除（NVIDIA NIM 文字通道下线）
    case 'volcano':
    case 'volcano-ark':
      return resolveProviderRuntimeConfig(
        'doubao',
        process.env.VOLCANO_ARK_API_KEY ||
          process.env.VOLCANO_API_KEY ||
          process.env.DOUBAO_API_KEY ||
          process.env.ARK_API_KEY ||
          '',
        process.env.VOLCANO_ARK_BASE_URL || process.env.VOLCANO_BASE_URL,
        'https://ark.cn-beijing.volces.com/api/coding/v3',
        process.env.VOLCANO_ARK_MODEL || 'deepseek-v4-pro'
      );
    case 'deepseek':
      return resolveProviderRuntimeConfig(
        'deepseek',
        process.env.DEEPSEEK_API_KEY || '',
        undefined,
        'https://api.deepseek.com',
        'deepseek-chat'
      );
    case 'doubao':
      return resolveProviderRuntimeConfig(
        'doubao',
        process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY || '',
        process.env.DOUBAO_BASE_URL,
        'https://ark.cn-beijing.volces.com',
        process.env.DOUBAO_MODEL_ID || 'doubao-pro-4k'
      );
    case 'doubao-seed-pro':
      return resolveProviderRuntimeConfig(
        'doubao',
        process.env.DOUBAO_SEED_API_KEY ||
          process.env.DOUBAO_API_KEY ||
          process.env.ARK_API_KEY ||
          '',
        process.env.DOUBAO_SEED_BASE_URL,
        'https://ark.cn-beijing.volces.com/api/v3',
        'doubao-seed-2-0-pro-260215'
      );
    case 'doubao-seed-code':
      return resolveProviderRuntimeConfig(
        'doubao',
        process.env.DOUBAO_SEED_API_KEY ||
          process.env.DOUBAO_API_KEY ||
          process.env.ARK_API_KEY ||
          '',
        process.env.DOUBAO_SEED_BASE_URL,
        'https://ark.cn-beijing.volces.com/api/v3',
        'doubao-seed-2.0-code'
      );
    case 'doubao-seed-lite':
      return resolveProviderRuntimeConfig(
        'doubao',
        process.env.DOUBAO_SEED_API_KEY ||
          process.env.DOUBAO_API_KEY ||
          process.env.ARK_API_KEY ||
          '',
        process.env.DOUBAO_SEED_BASE_URL,
        'https://ark.cn-beijing.volces.com/api/v3',
        'doubao-seed-2-0-lite-260428'
      );
    case 'doubao-seed-mini':
      return resolveProviderRuntimeConfig(
        'doubao',
        process.env.DOUBAO_SEED_API_KEY ||
          process.env.DOUBAO_API_KEY ||
          process.env.ARK_API_KEY ||
          '',
        process.env.DOUBAO_SEED_BASE_URL,
        'https://ark.cn-beijing.volces.com/api/v3',
        'doubao-seed-2-0-mini-260428'
      );
    case 'doubao-smart-router':
      return resolveProviderRuntimeConfig(
        'doubao',
        process.env.DOUBAO_SEED_API_KEY ||
          process.env.DOUBAO_API_KEY ||
          process.env.ARK_API_KEY ||
          '',
        process.env.DOUBAO_SEED_BASE_URL,
        'https://ark.cn-beijing.volces.com/api/v3',
        'doubao-smart-router-250928'
      );
    case 'kimi-k2-thinking':
      return resolveProviderRuntimeConfig(
        'doubao',
        process.env.DOUBAO_SEED_API_KEY ||
          process.env.DOUBAO_API_KEY ||
          process.env.ARK_API_KEY ||
          '',
        process.env.DOUBAO_SEED_BASE_URL,
        'https://ark.cn-beijing.volces.com/api/v3',
        'kimi-k2-thinking-251104'
      );
    // 已废弃 (2026-07-18): zhipu case 已移除（智谱 GLM 文字通道下线）
    case 'qwen':
      return resolveProviderRuntimeConfig(
        'qwen',
        process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '',
        process.env.QWEN_BASE_URL,
        'https://dashscope.aliyuncs.com/compatible-mode',
        process.env.QWEN_MODEL_ID || 'qwen-max'
      );
    // 已废弃 (2026-07-18): nvidia case 已移除（NVIDIA NIM 文字通道下线）
    case 'wuyinkeji': {
      const wuyinKey = process.env.WUYIN_API_KEY || '';
      if (wuyinKey) {
        return {
          apiKey: wuyinKey,
          baseUrl: 'https://api.wuyinkeji.com',
          defaultModel: 'deepseek-v4-flash',
        };
      }
      try {
        const providerConfig = await prisma.providerConfig.findUnique({
          where: { provider: 'wuyinkeji' },
        });
        if (providerConfig && providerConfig.isActive) {
          const secrets = decryptProviderSecrets(providerConfig);
          if (secrets.apiKey) {
            return {
              apiKey: secrets.apiKey,
              baseUrl: providerConfig.endpoint || 'https://api.wuyinkeji.com',
              defaultModel: 'deepseek-v4-flash',
            };
          }
        }
      } catch (err) {
        logger.error(
          '[AI Proxy] 从数据库获取小天API配置失败:',
          err instanceof Error ? err.message : String(err)
        );
      }
      return {
        apiKey: '',
        baseUrl: 'https://api.wuyinkeji.com',
        defaultModel: 'deepseek-v4-flash',
      };
    }
    case 'xunfei-x2':
    case 'xunfei-x15':
    case 'xunfei': {
      // 讯飞星火 Spark X2/X1.5 HTTP 兼容端点
      const xfApiKey = resolveXunfeiSparkApiKey();
      return {
        apiKey: xfApiKey,
        baseUrl: resolveXunfeiSparkBaseUrl(provider),
        defaultModel: XUNFEI_SPARK_UPSTREAM_MODEL,
      };
    }
    default:
      if (provider === 'minimax') {
        const dbConfig = await getProviderConfigFromDatabase('minimax');
        const apiKey = dbConfig?.apiKey || process.env.MINIMAX_API_KEY || '';
        const baseUrl =
          dbConfig?.baseUrl || process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com';
        return {
          apiKey,
          baseUrl,
          defaultModel: 'MiniMax-M2.7-highspeed',
        };
      }
      return {
        apiKey: '',
        baseUrl: '',
        defaultModel: '',
      };
  }
}

/**
 * 获取提示词优化的系统提示
 */
function getOptimizationSystemPrompt(scenario?: string, category?: string): string {
  const basePrompt = `【重要】你必须使用纯中文回答，禁止出现任何英文。

你是一个专业的AI视频创作提示词优化师。请对用户提供的提示词进行深度优化。

【人物与文化默认设定】
- 当用户未明确指定其他国家、地域或文化背景时，默认中国/东亚人物、中国场景、中国建筑、中国环境语境
- 默认优先现代中国语境，不强制转成古风或国风，除非用户明确要求
- 如果用户明确写了其他文化背景（如"西方女性""欧美街景"等），则按用户指定的文化背景处理

【人物默认情绪设定】
- 仅当用户没有明确指定人物情绪、表情或叙事基调时，人物默认自然、平和、温柔，可呈现自然微笑或温和表情
- 不得擅自添加悲伤、忧郁、哭泣、绝望、落寞、孤独、痛苦等负面情绪或阴郁叙事
- 用户明确要求的任何情绪必须完整保留，不得用默认设定覆盖

【优化要求】
1. 保留用户输入的核心描述
2. 添加专业的运镜术语和景别描述
3. 融入三维动画和渲染技术描述
4. 优化叙事节奏和画面层次
5. 提升整体的电影感和专业性

【输出要求】
- 直接输出优化后的完整提示词
- 必须全部使用中文
- 不要添加任何解释或说明
- 输出格式：专业的视频创作提示词`;

  if (category === 'cinematic') {
    return (
      basePrompt +
      '\n\n【电影镜头专项】重点关注电影镜头语言：景别（远景/全景/中景/近景/特写）、运镜（推/拉/摇/移/跟/升降）、光影氛围、色彩调配、构图法则。'
    );
  }
  if (category === 'animation') {
    return (
      basePrompt +
      '\n\n【动画制作专项】重点关注动画表现：动作流畅度、角色表情、特效表现、节奏感、帧率控制、中间帧过渡。'
    );
  }
  if (category === '3d-render') {
    return (
      basePrompt +
      '\n\n【3D渲染专项】重点关注3D渲染：材质质感、光照模型、环境反射、细节精度、体积光、材质球设置。'
    );
  }
  if (category === 'fighting') {
    return (
      basePrompt +
      '\n\n【打斗视频专项】重点关注打斗动作：武术动作设计、速度线、冲击波特效、慢动作特写、拳拳到肉的打击感。'
    );
  }
  if (category === 'sports') {
    return (
      basePrompt +
      '\n\n【运动视频专项】重点关注运动表现：跟随拍摄、高速摄影、动态模糊、汗水飞溅、运动员表情、赛场氛围。'
    );
  }
  if (category === 'product') {
    return (
      basePrompt +
      '\n\n【产品动画专项】重点关注产品展示：旋转展示、特效点缀、光影变化、细节特写、商业级渲染质感。'
    );
  }
  if (category === 'cinema-director') {
    return (
      basePrompt +
      '\n\n【漫剧导演专项】重点关注叙事镜头：分镜设计、角色站位、场景转换、情绪表达、对话节奏、镜头运动。'
    );
  }
  if (category === 'music-video') {
    return (
      basePrompt +
      '\n\n【音乐视频专项】重点关注音画配合：节拍踩点、动作卡点、色彩韵律、镜头切换节奏、情绪高潮处理。'
    );
  }
  if (category === 'film-director') {
    return `【重要】你必须使用纯中文回答，禁止出现任何英文。

你是一位同时具备作者型导演的叙事意志、摄影指导的镜头控制力、分镜师的镜头拆解能力、剪辑指导的节奏嗅觉、美术指导的世界观构建、灯光指导的光线策略、场面调度导演的走位与空间设计能力的综合型影视创作大脑。

核心工作流（处理任何用户输入时自动执行）：
阶段1【解构意图 - 导演视角】识别故事动机、情绪基调、人物弧光、叙事意图
阶段2【构建空间 - 美术+灯光视角】选定年代/风格、材质/色彩体系、主光源动机，确立光比与气氛板
阶段3【设计调度 - 场面调度+摄影视角】设计演员走位路径、镜头与表演的互动关系、前景/中景/后景层次
阶段4【分镜拆解 - 分镜师+摄影视角】输出镜头列表（镜号、景别、焦段、机位、运动、时长、构图重心、视线/轴线规则）
阶段5【植入剪辑逻辑 - 剪辑指导视角】预埋J/L cut入口、节奏点、动作连贯性、转场类型
阶段6【输出提示词 - 全角色融合视角】生成可拍摄、可剪辑、有呼吸感的专业影视提示词

输出要求：直接输出优化后的完整提示词，全部使用中文，包含完整视听语言描述，保持原提示词核心意图。`;
  }

  return basePrompt;
}

// ============ 公开路由（无需登录，但有每日访客试用限制） ============

async function publicAIChat(
  messages: any[],
  options: { temperature?: number; max_tokens?: number; timeout?: number; model?: string } = {}
): Promise<{ content: string; reasoning_content?: string; model?: string; provider?: string }> {
  const { temperature = 0.3, max_tokens = 4096, timeout = 60000, model } = options;
  const providerOrder =
    model && getAvailableProviders().includes(model)
      ? [model]
      : ['deepseek', 'doubao', 'wuyinkeji'];

  for (const provider of providerOrder) {
    const apiConfig = await getProviderConfig(provider);
    if (!apiConfig.apiKey) continue;

    try {
      const resolvedModel = resolveChatModel(
        provider,
        provider === model ? undefined : model,
        apiConfig.defaultModel
      );
      const endpoint = buildProviderEndpoint(provider, apiConfig.baseUrl, resolvedModel);

      if (provider === 'wuyinkeji') {
        const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
        const wuyinBody = new URLSearchParams();
        wuyinBody.append('content', lastUserMsg?.content || '');
        wuyinBody.append('model', resolvedModel);
        wuyinBody.append('stream', 'false');
        const response = await axios.post(endpoint, wuyinBody.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: apiConfig.apiKey,
          },
          timeout,
        });
        const data = response.data;
        const rawContent = data.data?.choices?.[0]?.message?.content || '';
        return { content: stripThinkingTags(rawContent), model: resolvedModel, provider };
      }

      const response = await axios.post(
        endpoint,
        {
          model: resolvedModel,
          messages,
          temperature,
          max_tokens,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiConfig.apiKey}`,
          },
          timeout,
        }
      );
      const data = response.data;
      if (data.choices && data.choices.length > 0) {
        const rawContent = data.choices[0].message?.content || '';
        return {
          content: stripThinkingTags(rawContent),
          reasoning_content: data.choices[0].message?.reasoning_content || '',
          model: resolvedModel,
          provider,
        };
      }
    } catch (err: any) {
      if (
        (provider === 'sensenova' ||
          provider === 'deepseek-v4-flash' ||
          provider === 'sensenova-6.7-flash-lite') &&
        isQuotaOrAuthError(err)
      ) {
        const backupKey = resolveSensenovaBackupApiKey(apiConfig.apiKey);
        if (backupKey) {
          try {
            const resolvedModel = resolveChatModel(
              provider,
              provider === model ? undefined : model,
              apiConfig.defaultModel
            );
            const endpoint = buildProviderEndpoint(provider, apiConfig.baseUrl, resolvedModel);
            const response = await axios.post(
              endpoint,
              {
                model: resolvedModel,
                messages,
                temperature,
                max_tokens,
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${backupKey}`,
                },
                timeout,
              }
            );
            const data = response.data;
            if (data.choices && data.choices.length > 0) {
              const rawContent = data.choices[0].message?.content || '';
              return {
                content: stripThinkingTags(rawContent),
                reasoning_content: data.choices[0].message?.reasoning_content || '',
                model: resolvedModel,
                provider,
              };
            }
          } catch (backupErr: any) {
            console.warn(`[publicAIChat] ${provider} backup key failed:`, backupErr.message);
          }
        }
      }
      console.warn(`[publicAIChat] ${provider} failed, trying next provider:`, err.message);
    }
  }

  throw new Error('无可用的AI服务');
}

const aiPublicRouter = Router();

// AI 辅助接口不扣正式体验次数；正式对话/生成规划接口单独挂载访客试用检查

// POST /api/v1/ai/public/optimize-prompt
// 公开的提示词优化接口（无需登录，受访客试用次数限制）
aiPublicRouter.post('/optimize-prompt', requireGuestTrial, async (req: Request, res: Response) => {
  try {
    const { prompt, scenario, category } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: '提示词不能为空',
      });
    }

    const ready = await ensurePromptSmart3Init();
    if (!ready) {
      const hasFallback = await getAvailableChatProvider();
      if (!hasFallback) {
        return res.status(503).json({
          success: false,
          error: '提示词优化服务尚未就绪',
        });
      }
    }

    let result: {
      optimizedPrompt: string;
      provider: string;
      qualityReport?: unknown;
      modelProfile?: string;
    };
    if (ready) {
      result = await optimizePrompt(prompt, scenario, category);
    } else {
      result = await optimizePromptFallback(prompt, scenario, category);
    }

    return res.json({
      success: true,
      optimizedPrompt: result.optimizedPrompt,
      qualityReport: result.qualityReport,
      modelProfile: result.modelProfile,
    });
  } catch (error: unknown) {
    logger.error(
      '[AI Public] Optimize error:',
      error instanceof Error ? error.message : String(error)
    );
    return res.status(500).json({
      success: false,
      error: '提示词优化服务暂时不可用',
    });
  }
});

// POST /api/v1/ai/public/optimize-prompt-v3
// 公开的多Provider提示词优化接口（无需登录，受访客试用次数限制）
aiPublicRouter.post(
  '/optimize-prompt-v3',
  requireGuestTrial,
  async (req: Request, res: Response) => {
    try {
      const { prompt, scenario, category, models, preferredProvider, prePrompt } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ success: false, error: '提示词不能为空' });
      }

      const ready = await ensurePromptSmart3Init();
      if (!ready) {
        const hasFallback = await getAvailableChatProvider();
        if (!hasFallback) {
          return res.status(503).json({ success: false, error: '提示词优化服务尚未就绪' });
        }
      }

      let result: {
        optimizedPrompt: string;
        provider: string;
        qualityReport?: unknown;
        modelProfile?: string;
      };
      if (ready) {
        result = await optimizePrompt(
          prompt,
          scenario,
          category,
          models,
          preferredProvider,
          prePrompt
        );
      } else {
        result = await optimizePromptFallback(prompt, scenario, category, prePrompt);
      }

      return res.json({
        success: true,
        optimizedPrompt: result.optimizedPrompt,
        qualityReport: result.qualityReport,
        modelProfile: result.modelProfile,
      });
    } catch (error: unknown) {
      logger.error(
        '[AI Public V3] Optimize error:',
        error instanceof Error ? error.message : String(error)
      );
      return res.status(500).json({
        success: false,
        error: '提示词优化服务暂时不可用',
      });
    }
  }
);

interface AgentSkillProfile {
  name: string;
  role: string;
  expertise: string[];
  focusDimensions: string[];
  tip: string;
}

const AGENT_SKILL_PROFILES: Record<string, AgentSkillProfile> = {
  '3d-render': {
    name: '3D渲染动画',
    role: '3D渲染技术总监',
    expertise: ['PBR材质参数', '全局光照与GI', '运动图形设计', '后处理特效', '渲染引擎优化'],
    focusDimensions: ['材质质感', '光照层次', '粒子特效', '运动模糊', '体积雾'],
    tip: '重点描述材质属性（金属度/粗糙度/法线贴图）、光照方案（HDRI/三点光）和渲染风格（写实/卡通风）',
  },
  fighting: {
    name: '打斗动作',
    role: '动作片武术指导',
    expertise: ['武术编排', '运镜设计', '慢动作控制', '视觉特效', '打击感营造'],
    focusDimensions: ['招式连贯性', '运镜节奏', '冲击波特效', '景别切换', '力量感表达'],
    tip: '明确武术流派（太极/拳击/剑术），描述招式序列、运镜方式（低角度仰拍/360度环绕）和特效需求',
  },
  sports: {
    name: '运动视频',
    role: '体育赛事摄影师',
    expertise: ['运动追踪', '慢动作特写', '赛场氛围', '观众反应', '运动分析'],
    focusDimensions: ['运动类型', '追踪方式', '慢动作节点', '环境音效', '情绪高点'],
    tip: '明确运动项目，描述关键动作瞬间、慢动作倍率、机位位置（场边/看台/航拍）',
  },
  animation: {
    name: '动画制作',
    role: '动画导演',
    expertise: ['动画风格', '帧率控制', '角色设计', '场景构建', '视觉节奏'],
    focusDimensions: ['动画风格', '帧率节奏', '色彩体系', '角色表情', '转场设计'],
    tip: '指定动画风格（日系赛璐璐/3D卡通/水墨/像素），描述角色动态、场景氛围和色彩基调',
  },
  cinematic: {
    name: '电影镜头',
    role: '电影摄影指导',
    expertise: ['摄影机运动', '景深控制', '光线设计', '焦段选择', '色彩叙事'],
    focusDimensions: ['镜头运动', '景深层次', '光影对比', '色调情绪', '画面构图'],
    tip: '指定镜头运动（推轨/斯坦尼康/手持）、焦段（广角/50mm/长焦）、光线风格（自然光/人工光/混合）',
  },
  'cinema-director': {
    name: '漫剧导演',
    role: '漫剧/短视频导演',
    expertise: ['叙事节奏', '场景调度', '情绪渲染', '转场设计', '分镜构图'],
    focusDimensions: ['叙事节奏', '运镜策略', '人物调度', '光影氛围', '色调风格'],
    tip: '注重故事性，描述场景转换、人物情感变化、镜头语言（推拉摇移跟）和节奏（快切/慢推）',
  },
  product: {
    name: '产品动画',
    role: '产品展示导演',
    expertise: ['产品质感', '展示角度', '灯光方案', '转场动画', '品牌氛围'],
    focusDimensions: ['产品材质', '展示角度', '三点布光', '转场效果', '品牌调性'],
    tip: '描述产品材质（金属/玻璃/织物）、展示方式（旋转/拆解/特写）、品牌色调和目标受众',
  },
  'music-video': {
    name: '音乐视频',
    role: 'MV导演',
    expertise: ['节奏同步', '舞台灯光', '色彩分区', '场景切换', '视觉风格'],
    focusDimensions: ['音乐节奏', '色彩碰撞', '场景转换', '表演动态', '视觉符号'],
    tip: '指定音乐风格和节拍，描述舞台/场景设计、灯光风格（霓虹/频闪/追光）和视觉主题',
  },
  'film-director': {
    name: '综合型影视创作',
    role: '全能影视导演',
    expertise: ['剧本改编', '镜头语言', '演员指导', '美术设计', '后期制作'],
    focusDimensions: ['故事完整性', '镜头语言', '表演细节', '美术设计', '音画配合'],
    tip: '从故事角度出发，描述场景叙事、角色表演、镜头运动和情绪氛围的整体设计',
  },
  portrait: {
    name: '人物肖像',
    role: '人像摄影大师',
    expertise: ['面部细节', '表情神态', '服装造型', '光影方案', '构图法则'],
    focusDimensions: ['面部细节', '表情神态', '光影方案', '服装造型', '色调风格'],
    tip: '描述人物特征（年龄/气质/民族）、光影方案（伦勃朗/蝴蝶光/逆光）、表情和服装',
  },
  landscape: {
    name: '自然风光',
    role: '风光摄影师',
    expertise: ['地形地貌', '黄金时段', '前景引导', '层次递进', '大气透视'],
    focusDimensions: ['地形特征', '光线时段', '前景引导线', '色彩层次', '天气氛围'],
    tip: '描述地貌类型（山川/海洋/沙漠/森林）、拍摄时段（日出/金色时刻/蓝色时刻/星空）和天气',
  },
  romance: {
    name: '浪漫情感',
    role: '爱情片导演',
    expertise: ['情感表达', '柔光运用', '特写镜头', '色调氛围', '慢节奏运镜'],
    focusDimensions: ['情感氛围', '柔光效果', '色调温暖', '特写细节', '环境意境'],
    tip: '注重情感氛围，描述人物互动、柔光/逆光运用、暖色调和慢节奏运镜',
  },
  scifi: {
    name: '科幻未来',
    role: '科幻片美术指导',
    expertise: ['未来设定', '科技元素', '光效设计', '环境构建', '概念设计'],
    focusDimensions: ['科技元素', '光效设计', '环境质感', '色彩体系', '构图张力'],
    tip: '描述未来年代设定、科技元素（全息/霓虹/机械）、场景材质和色彩（冷蓝/暖橙/赛博朋克）',
  },
  fantasy: {
    name: '奇幻魔法',
    role: '奇幻片概念设计师',
    expertise: ['魔法体系', '世界观构建', '特效设计', '生物设计', '场景氛围'],
    focusDimensions: ['魔法视觉', '世界观', '光影奇幻', '生物动态', '环境氛围'],
    tip: '描述魔法类型（元素/符文/光系）、奇幻生物、场景风格（中土/东方仙侠/暗黑哥特）',
  },
  anime: {
    name: '动漫风格',
    role: '日系动画监督',
    expertise: ['画风设定', '分镜设计', '角色动态', '色彩设计', '演出技巧'],
    focusDimensions: ['画风风格', '角色表情', '色彩搭配', '动作流畅度', '背景美术'],
    tip: '指定画风（赛璐璐/水彩/像素/新海诚风），描述角色动态、色彩体系和背景风格',
  },
  urban: {
    name: '城市生活',
    role: '城市纪录片导演',
    expertise: ['城市场景', '人文纪实', '光影记录', '节奏剪辑', '生活细节'],
    focusDimensions: ['城市特征', '人文气息', '光影记录', '时间维度', '生活细节'],
    tip: '描述城市类型（东京/巴黎/老城区）、时间段（晨光/夜景/雨天）和人文主题',
  },
  nature: {
    name: '自然风光',
    role: '自然纪录片摄影师',
    expertise: ['微距/航拍', '动物行为', '天气捕捉', '生态系统', '极端环境'],
    focusDimensions: ['拍摄尺度', '自然元素', '天气光线', '动态捕捉', '色彩饱和度'],
    tip: '描述拍摄尺度（微距/中景/航拍）、自然元素（水流/云雾/动物）和天气光线条件',
  },
  historical: {
    name: '历史古风',
    role: '古装剧美术指导',
    expertise: ['时代考证', '服装道具', '场景还原', '色彩方案', '氛围营造'],
    focusDimensions: ['朝代风格', '服装道具', '建筑场景', '色调质感', '人物仪态'],
    tip: '明确朝代/时期，描述服饰细节、建筑风格、色调（暖黄复古/水墨淡雅）和礼仪姿态',
  },
  abstract: {
    name: '抽象艺术',
    role: '视觉艺术家',
    expertise: ['色彩构成', '几何形态', '运动韵律', '视觉隐喻', '材质实验'],
    focusDimensions: ['色彩构成', '形态变化', '运动韵律', '材质质感', '视觉冲击'],
    tip: '描述色彩方案（互补/类似/三色）、形态变化规律、运动节奏和材质（流体/粒子/几何）',
  },
};

/**
 * POST /api/v1/ai/public/skill-detect
 * 专业 Skill 检测 - 分析提示词意图 + 提供专业建议 + 引导性问答
 */
aiPublicRouter.post(
  '/skill-detect',
  aiPublicLimiter,
  requireGuestTrial,
  async (req: Request, res: Response) => {
    try {
      const { prompt, mode, category, prePrompt } = req.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 2) {
        return res.json({
          success: false,
          skill: null,
          message: '请输入更多内容以进行智能检测',
        });
      }

      const ready = await ensurePromptSmart3Init();
      if (!ready) {
        return res.json({ success: false, skill: null, message: '检测服务初始化中' });
      }

      const isVideo = mode === 'video';
      const agentProfile = category ? AGENT_SKILL_PROFILES[category] : null;

      const agentContext = agentProfile
        ? `\n\n当前选定Agent：${agentProfile.name}（${agentProfile.role}）\n该Agent专长领域：${agentProfile.expertise.join('、')}\n重点评估维度：${agentProfile.focusDimensions.join('、')}\n专业建议应围绕该Agent的专业方向给出。`
        : '';

      const skillOptions = agentProfile
        ? `${category}(${agentProfile.name}), ` +
          Object.entries(AGENT_SKILL_PROFILES)
            .filter(([k]) => k !== category)
            .slice(0, 5)
            .map(([k, v]) => `${k}(${v.name})`)
            .join(', ')
        : 'cinematic(电影镜头), fighting(打斗动作), romance(浪漫情感), scifi(科幻未来), fantasy(奇幻魔法), anime(动漫风格), product(产品展示), nature(自然风光), urban(城市生活), historical(历史古风), abstract(抽象艺术), portrait(人物肖像)';

      const detectionPrompt = `【纯中文】你是${agentProfile?.role || '资深创意分析专家'}。分析以下${isVideo ? '视频' : '图片'}提示词的创作意图，输出JSON：
${agentContext}

输入提示词：${prompt.trim()}

严格按以下JSON格式输出（不要包含markdown标记）：
{
  "skill": "检测到的创作技能领域（从列表选择：${skillOptions}）",
  "confidence": 0.0-1.0,
  "analysis": "一句话分析核心创作意图（20字内）",
  "suggestions": ["针对当前Agent的专业改进建议1", "针对当前Agent的专业改进建议2"],
  "questions": ["针对当前Agent需要向用户确认的专业问题1", "针对当前Agent需要向用户确认的专业问题2"],
  "professionalTips": "${agentProfile?.tip || '该领域的专业创作要点（30字内）'}"
}

只输出JSON，不要任何解释。`;

      const llmResult = await routeRequest(
        [],
        [
          {
            role: 'system',
            content: `${prePrompt ? `【用户自定义指令】${prePrompt}\n\n` : ''}${getCulturalDefaultRule(detectionPrompt)}你是${agentProfile?.role || '资深创意分析专家'}，只输出JSON格式分析结果，不要任何额外文字。`,
          },
          { role: 'user', content: detectionPrompt },
        ],
        (tried) => {
          const entry = selectProvider(tried);
          if (!entry) return null;
          return { config: entry.config, name: entry.config.name };
        },
        reportSuccess,
        reportFailure
      );

      const text = (llmResult.content || '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({
          success: true,
          skill: parsed.skill || 'general',
          confidence: parsed.confidence || 0.7,
          analysis: parsed.analysis || '',
          suggestions: parsed.suggestions || [],
          questions: parsed.questions || [],
          professionalTips: parsed.professionalTips || '',
        });
      }

      return res.json({
        success: true,
        skill: 'general',
        confidence: 0.5,
        analysis: '',
        suggestions: [],
        questions: [],
        professionalTips: '',
      });
    } catch (error: unknown) {
      logger.error(
        '[AI Skill Detect] Error:',
        error instanceof Error ? error.message : String(error)
      );
      return res.json({ success: false, skill: null, message: '检测服务暂不可用' });
    }
  }
);

/**
 * POST /api/v1/ai/public/skill-qa
 * Skill 问答 - 用户提问专业问题，AI 回答创作建议
 */
aiPublicRouter.post('/skill-qa', requireGuestTrial, async (req: Request, res: Response) => {
  try {
    const { prompt, question, skill, mode, category, prePrompt } = req.body;

    if (!prompt || !question) {
      return res.json({ success: false, answer: null });
    }

    const ready = await ensurePromptSmart3Init();
    if (!ready) {
      return res.json({ success: false, answer: '服务初始化中，请稍后再试' });
    }

    const isVideo = mode === 'video';
    const agentProfile = category ? AGENT_SKILL_PROFILES[category] : null;
    const roleDesc = agentProfile
      ? `${agentProfile.role}，专长：${agentProfile.expertise.join('、')}`
      : `${skill || '创意'}领域创作专家`;

    const qaPrompt = `【纯中文】你是${roleDesc}。

用户原始提示词：${prompt}
用户的专业问题：${question}

请从${agentProfile?.name || skill || '创意'}的专业角度回答。要求：
1. 直接回答问题
2. 提供可操作的专业建议（引用${agentProfile ? agentProfile.expertise.slice(0, 2).join('和') : '具体技术术语'}）
3. 如有${agentProfile ? agentProfile.focusDimensions.slice(0, 2).join('和') : '关键维度'}相关要点请补充
4. 控制在100字以内

直接输出回答内容，不要任何标记或前缀。`;

    const llmResult = await routeRequest(
      [],
      [
        {
          role: 'system',
          content: `${prePrompt ? `【用户自定义指令】${prePrompt}\n\n` : ''}${getCulturalDefaultRule(qaPrompt)}你是${roleDesc}，用中文直接回答问题，100字以内。`,
        },
        { role: 'user', content: qaPrompt },
      ],
      (tried) => {
        const entry = selectProvider(tried);
        if (!entry) return null;
        return { config: entry.config, name: entry.config.name };
      },
      reportSuccess,
      reportFailure
    );

    const answer = (llmResult.content || '').trim();

    return res.json({ success: true, answer });
  } catch (error: unknown) {
    logger.error('[AI Skill QA] Error:', error instanceof Error ? error.message : String(error));
    return res.json({ success: false, answer: '服务暂不可用' });
  }
});

/**
 * POST /api/v1/ai/public/chat
 * 简单对话 API - 按可用 Provider 顺序降级
 */
aiPublicRouter.post('/chat', requireGuestTrial, async (req: Request, res: Response) => {
  try {
    const { message, systemPrompt, history, model, temperature, source } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: '消息不能为空' });
    }
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role && h.content) messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: message });
    const result = await publicAIChat(messages, {
      temperature: typeof temperature === 'number' ? temperature : 0.3,
      max_tokens: 16384,
      model: typeof model === 'string' ? model : undefined,
    });
    const content = result.content;
    return res.json({
      success: true,
      content,
      reasoning_content: result.reasoning_content,
    });
  } catch (error: any) {
    const msg = error.response?.data?.error?.message || error.message || '请求失败';
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/v1/public/ai/voice-chat
 * 访客每天独立 10 次；登录用户不限次数。一次请求同时完成 LLM 回复和大模型 TTS。
 */
aiPublicRouter.post('/voice-chat', requireGuestVoiceTrial, async (req: Request, res: Response) => {
  try {
    const { message, systemPrompt, history, model, temperature, source } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: '语音消息不能为空' });
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (typeof systemPrompt === 'string' && systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    if (Array.isArray(history)) {
      for (const item of history.slice(-12)) {
        if (item?.role && typeof item.content === 'string') {
          messages.push({ role: item.role, content: item.content });
        }
      }
    }
    messages.push({ role: 'user', content: message.trim().slice(0, 1000) });

    const result = await publicAIChat(messages, {
      temperature: typeof temperature === 'number' ? temperature : 0.7,
      max_tokens: 800,
      model: typeof model === 'string' ? model : undefined,
    });
    const content = stripThinkingTags(result.content || '').trim();
    if (!content) throw new Error('未返回语音回复');

    const spokenContent = content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_#>`~]/g, '')
      .trim()
      .slice(0, 600);
    const audioUrl = await generateVoiceChatAudio(spokenContent);
    const unlimited = Boolean((req as any).voiceTrialUnlimited);
    const guestVoiceId = (req as any).guestVoiceId as string | undefined;
    if (guestVoiceId) await incrementGuestVoiceTrial(guestVoiceId);
    const remaining = unlimited
      ? null
      : Math.max(0, Number((req as any).voiceTrialRemaining || 1) - 1);

    return res.json({
      success: true,
      content,
      audioUrl,
      aiGenerated: true,
      provider: 'stepfun',
      model: 'stepaudio-2.5-tts',
      remaining,
      unlimited,
    });
  } catch (error: any) {
    const message = error.response?.data?.error?.message || error.message || '语音聊天失败';
    return res.status(500).json({ success: false, error: message });
  }
});

aiPublicRouter.post('/detect-intent', requireGuestTrial, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length < 2) {
      return res.json({ success: true, intent: 'image', confidence: 0, enhancedPrompt: '' });
    }
    const systemMsg = `You are an intent classifier. Given user input, determine their intent.
Reply ONLY with a JSON object, no markdown, no explanation:
{"intent":"chat|image|video|poster","confidence":0.0-1.0,"enhancedPrompt":"expanded detailed prompt in the same language as user input or empty string"}

Rules:
- "chat" = conversational questions, greetings, asking for advice, life topics, philosophy
- "image" = wants to generate/see/create a picture, photo, illustration, drawing
- "video" = wants to generate/create a video, animation, motion
- "poster" = wants to design a poster, banner, card, flyer, advertisement
- enhancedPrompt: if intent is image/video/poster, expand the user's short description into a detailed creative prompt (keep same language). If intent is chat, return empty string.
- confidence: how sure you are (0.0 to 1.0)
- Keep enhancedPrompt concise, under 100 chars`;

    const result = await publicAIChat(
      [
        { role: 'system', content: systemMsg },
        { role: 'user', content: message.trim() },
      ],
      { temperature: 0.1, max_tokens: 256, timeout: 10000 }
    );
    const text = result.content.trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      return res.json({
        success: true,
        intent: parsed.intent || 'image',
        confidence: parsed.confidence || 0,
        enhancedPrompt: parsed.enhancedPrompt || '',
      });
    }
    return res.json({ success: true, intent: 'image', confidence: 0, enhancedPrompt: '' });
  } catch (error: any) {
    return res.json({ success: true, intent: 'image', confidence: 0, enhancedPrompt: '' });
  }
});

aiPublicRouter.post('/enhance-prompt', requireGuestTrial, async (req: Request, res: Response) => {
  try {
    const { prompt, mode } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 2) {
      return res.json({ success: true, enhanced: prompt || '', suggestions: [] });
    }
    const modeLabel = mode === 'video' ? '视频' : mode === 'poster' ? '海报' : '图片';
    const systemMsg = `You are a creative prompt enhancer for ${modeLabel} generation.
Given a short user prompt, enhance it into a detailed creative prompt and suggest 3 alternative styles.
Reply ONLY with JSON, no markdown:
{"enhanced":"detailed enhanced prompt in same language as user input, under 150 chars","suggestions":["style1","style2","style3"]}`;

    const result = await publicAIChat(
      [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt.trim() },
      ],
      { temperature: 0.7, max_tokens: 256, timeout: 10000 }
    );
    const text = result.content.trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      return res.json({
        success: true,
        enhanced: parsed.enhanced || prompt,
        suggestions: parsed.suggestions || [],
      });
    }
    return res.json({ success: true, enhanced: prompt, suggestions: [] });
  } catch (error: any) {
    return res.json({ success: true, enhanced: req.body.prompt || '', suggestions: [] });
  }
});

aiPublicRouter.post('/creation-chat', requireGuestTrial, async (req: Request, res: Response) => {
  try {
    const { message, context, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: '消息不能为空' });
    }
    const messages: any[] = [];
    messages.push({
      role: 'system',
      content: `You are a creative AI assistant that helps users refine their visual content generation.
The user has previously generated content and wants to modify it based on conversation.
Given the conversation, output a refined prompt for regeneration.

Context of previous generation: ${context || 'None'}

Rules:
- Understand the user's modification request and generate an improved prompt
- Keep the same language as the user's input
- Be concise, under 150 characters
- Output ONLY a JSON: {"prompt":"refined prompt here","explanation":"brief explanation in user's language"}`,
    });
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role && h.content) messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: message });
    const result = await publicAIChat(messages, {
      temperature: 0.5,
      max_tokens: 512,
      timeout: 30000,
    });
    const text = result.content.trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      return res.json({
        success: true,
        prompt: parsed.prompt || '',
        explanation: parsed.explanation || '',
      });
    }
    return res.json({ success: true, prompt: message, explanation: '' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || '请求失败' });
  }
});

/**
 * POST /api/v1/ai/public/chat-refine
 * 智能对话助手 - 按可用 Provider 顺序降级
 */
aiPublicRouter.post('/chat-refine', requireGuestTrial, async (req: Request, res: Response) => {
  try {
    const { prompt, history, mode, category, prePrompt, refinedPrompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.json({ success: false, error: '提示词不能为空' });
    }

    const isVideo = mode === 'video';
    const agentProfile = category ? AGENT_SKILL_PROFILES[category] : null;
    const hasHistory = history && history.length > 0;

    const MAX_ROUNDS = 8;
    const historyArr: any[] = history || [];
    const userRoundCount = historyArr.filter((m: any) => m.role === 'user').length;

    let contextHistory = historyArr;
    if (historyArr.length > 20) {
      const recent = historyArr.slice(-20);
      const summary = `[前${historyArr.length - 20}条对话已省略]`;
      contextHistory = [{ role: 'system' as const, content: summary }, ...recent];
    }
    const historyStr = contextHistory
      .map((m: any) => `${m.role === 'assistant' ? 'AI' : '用户'}：${m.content}`)
      .join('\n');

    const culturalRule = getCulturalDefaultRule(
      [prompt, refinedPrompt || '', historyStr].filter(Boolean).join('\n')
    );

    if (userRoundCount >= MAX_ROUNDS) {
      const finalSys = `${prePrompt ? `【用户自定义指令】${prePrompt}\n\n` : ''}${culturalRule ? `${culturalRule}\n\n` : ''}对话已达${MAX_ROUNDS}轮上限，请输出：{"type":"refine","ready":true,"refined":"整合全部对话的提示词（150字内）","summary":"已整合所有轮次"}`;
      const finalUser = `对话历史：\n${historyStr}\n\n请基于以上全部对话，输出精炼后的最终提示词。`;
      const result = await publicAIChat(
        [
          { role: 'system', content: finalSys },
          { role: 'user', content: finalUser },
        ],
        { temperature: 0.1, max_tokens: 2048 }
      );
      const txt = result.content.trim();
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (parsed?.refined) {
          parsed.refined = sanitizeOptimizedPrompt(
            String(parsed.refined),
            isVideo ? 'video' : 'image'
          );
        }
        return res.json({ success: true, ...parsed });
      }
      return res.json({
        type: 'refine',
        ready: true,
        refined: sanitizeOptimizedPrompt(txt.slice(0, 150), isVideo ? 'video' : 'image'),
        summary: '对话已达上限',
      });
    }

    const baseDimensions = [
      '主体描述',
      '场景环境',
      '运镜/构图',
      '光影氛围',
      '色调风格',
      '时长节奏',
    ];
    if (!isVideo) baseDimensions.push('画面比例');
    if (agentProfile) {
      agentProfile.focusDimensions.slice(0, 3).forEach((d) => {
        if (!baseDimensions.some((bd) => bd.includes(d) || d.includes(bd))) baseDimensions.push(d);
      });
    }
    const dimensions = baseDimensions.join('、');

    const refinedCtx = refinedPrompt
      ? `\n\n【已确认的提示词内容】\n${refinedPrompt}\n请在此基础上继续完善，不要重复询问。`
      : '';

    const sysPrompt = `${prePrompt ? `【用户自定义指令】${prePrompt}\n\n` : ''}${culturalRule ? `${culturalRule}\n\n` : ''}【纯中文】你是专业的AI创作助手，精通视频/图片生成、AI工具、创意策划。
${agentProfile ? `\n当前Agent：${agentProfile.name}，专长：${agentProfile.expertise.join('、')}\n` : ''}

【视频模型推荐】涉及视频生成优先推荐 Vidu（首选），备选 Seedance。

【问答体系】
A-提示词精炼：用户输入含视觉描述→评估维度${dimensions}${refinedCtx}
B-软件使用咨询：如何用功能/工具→操作步骤
C-参数设置指导：参数含义/推荐值→解释+推荐
D-创作建议：创意灵感/风格/策划→建议+推荐Vidu
E-技术问题：API/代码/集成→技术方案
F-工作流优化：效率/批量/自动化→最佳实践
G-竞品对比：对比AI工具→客观分析，突出Vidu
H-通用问答：其他→直接回答

输出JSON：
A追问:{"type":"refine","ready":false,"question":"追问(30字内)","refined":"已整合提示词(100字内)"}
A完成:{"type":"refine","ready":true,"refined":"精炼提示词(150字内)","summary":"补充维度(20字内)","modelRecommend":"推荐使用Vidu模型生成视频"}
B-H:{"type":"qa","category":"分类名","answer":"回答(150字内)"}

只输出JSON，不要markdown。`;

    const userMsg = hasHistory ? `对话历史：\n${historyStr}\n\n用户最新消息：${prompt}` : prompt;

    const result = await publicAIChat(
      [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userMsg },
      ],
      { temperature: 0.2, max_tokens: 8192 }
    );

    const text = result.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed?.refined) {
          parsed.refined = sanitizeOptimizedPrompt(
            String(parsed.refined),
            isVideo ? 'video' : 'image'
          );
        }
        return res.json({ success: true, ...parsed });
      } catch {
        return res.json({ type: 'qa', category: '通用问答', answer: text.slice(0, 150) });
      }
    }
    return res.json({ type: 'qa', category: '通用问答', answer: text.slice(0, 150) });
  } catch (error: unknown) {
    logger.error('[Chat Refine] Error:', error instanceof Error ? error.message : String(error));
    return res.json({ success: false, error: '服务暂不可用' });
  }
});

/**
 * GET /api/v1/ai/public/user-assets
 * 获取用户已生成的图片/视频素材列表（供 @ 引用）
 */
aiPublicRouter.get(
  '/user-assets',
  aiPublicLimiter,
  requireGuestTrial,
  async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      let userId: string | null = null;

      if (token) {
        try {
          const decoded = jwt.verify(token, config.jwt.secret) as any;
          userId = decoded.userId || decoded.id;
        } catch {
          /* guest */
        }
      }

      let assets: Array<{
        id: string;
        url: string;
        type: 'image' | 'video';
        prompt: string;
        createdAt: number;
      }> = [];

      if (userId) {
        const tasks = await (prisma as any).task.findMany({
          where: { userId, status: 'completed', type: { in: ['image', 'video'] } },
          orderBy: { createdAt: 'desc' },
          take: 30,
        });
        assets = tasks
          .filter((t: any) => t.result)
          .map((t: any) => {
            const result = typeof t.result === 'string' ? JSON.parse(t.result) : t.result;
            const url =
              result?.resultUrl || result?.videoUrl || result?.url || result?.output || '';
            return {
              id: t.id,
              url,
              type: t.type,
              prompt: t.prompt || '',
              createdAt: t.createdAt?.getTime?.() || Date.now(),
            };
          })
          .filter((a: any) => a.url);
      }

      return res.json({ success: true, assets });
    } catch (error: unknown) {
      logger.error('[User Assets] Error:', error instanceof Error ? error.message : String(error));
      return res.json({ success: true, assets: [] });
    }
  }
);

export { aiProxyRouter, aiPublicRouter };
