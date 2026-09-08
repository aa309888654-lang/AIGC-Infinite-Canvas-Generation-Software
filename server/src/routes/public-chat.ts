import { Router, Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { creditService } from '../services/credit-service';
import { config } from '../types/env';
import prisma from '../lib/prisma';
import { redisService } from '../services/redis-service'; // P2 修复 #22：访客限流改用 Redis
import { logger } from '../utils/logger'; // BUG-09 修复：引入 logger
import { initOptimizePipeline } from '../services/promptSmart3/optimizePipeline';
import { ProviderConfig } from '../services/promptSmart3/providerTypes';
import promptSmart3ProviderConfigs from '../services/promptSmart3/providers.json';
import {
  selectProvider as selectPromptSmart3Provider,
  selectProviderByName,
  reportSuccess,
  reportFailure,
} from '../services/promptSmart3/providerRegistry';
import { routeRequest } from '../services/promptSmart3/router';
import {
  resolveXunfeiSparkApiKey,
  XUNFEI_SPARK_UPSTREAM_MODEL,
  XUNFEI_SPARK_X15_BASE_URL,
} from '../utils/provider-env-keys';
import { getRequestAuthToken } from '../middleware/security-session';

const publicChatRouter = Router();
const promptSmart3Providers: ProviderConfig[] = promptSmart3ProviderConfigs;
let promptSmart3Ready = false;

const XUNFEI_API_URL = `${XUNFEI_SPARK_X15_BASE_URL}/chat/completions`;
const XUNFEI_MODEL = XUNFEI_SPARK_UPSTREAM_MODEL;
// TODO: 讯飞星火文字通道已废弃 (2026-07-18)，此处仅作为公开对话的最后回退。
// 当 PromptSmart3 智能路由和 MiniMax 均不可用时才会命中。后续应迁移到其他可用 provider。

const MINIMAX_CHAT_BASE_URL = 'https://api.minimax.chat';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_MODEL = 'MiniMax-M2.7-highspeed';

const GUEST_TRIAL_LIMIT = 20;
// P2 修复 #22：访客限流改用 Redis，保证多实例部署共享计数。
// 保留 guestTrialMap 作为 Redis 不可用时的内存兜底（仅开发环境）。
const guestTrialMap = new Map<string, { count: number; date: string }>();
const GUEST_TRIAL_KEY_PREFIX = 'guest_trial:';
// TTL：当日剩余秒数（至少 1 小时，最多 24 小时），保证 key 在跨天后自动清理
function computeGuestTrialTtlSeconds(): number {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const ttl = Math.ceil((endOfDay.getTime() - now.getTime()) / 1000);
  return Math.max(3600, Math.min(ttl, 86400));
}
const PROMPT_TEXT_PROVIDER_IDS = new Set([
  'auto',
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  // 已废弃 (2026-07-18): glm-5.1 / glm-4-plus - 智谱 GLM 文字通道已下线
  'qwen3-plus',
  'moonshot-k2.5',
  'yi-large',
  'step-3.7-flash',
  'step-3.5-flash',
  'sensenova-6.7-flash-lite',
  'minimax',
  'volcano',
  'volcano-ark',
  // 已废弃 (2026-07-18): nvidia-deepseek-v4-pro - NVIDIA NIM 文字通道已下线
  'iamhc-deepseek-v4-flash',
  'iamhc-kimi-k2.6',
  'iamhc-minimax-m3',
  'iamhc-minimax-m2.7',
  'iamhc-glm-4.7',
  'iamhc-qwen3.6-35b',
  // 国内 APIPATHS Kimi / GLM 通道保留
  'apipaths-kimi-k3',
  'apipaths-glm-5.1',
]);

const PROMPT_TEXT_PROVIDER_ALIASES: Record<string, string> = {
  'volcano-ark': 'volcano',
};

async function resolvePromptSmart3ApiKey(providerName: string, envKey?: string): Promise<string | undefined> {
  if (envKey) {
    // 支持逗号分隔的多个 env key（多秘钥轮询），随机选择一个可用秘钥
    const envKeys = envKey.split(',').map((k) => k.trim()).filter(Boolean);
    const availableKeys: string[] = [];
    for (const k of envKeys) {
      const val = process.env[k];
      if (val) availableKeys.push(val);
    }
    if (availableKeys.length > 0) {
      return availableKeys[Math.floor(Math.random() * availableKeys.length)];
    }
  }

  const providerRow = await prisma.providerConfig.findFirst({
    where: {
      provider: providerName,
      isActive: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!providerRow) return undefined;
  try {
    const { decryptProviderSecrets } = await import('./ai-provider');
    const secrets = decryptProviderSecrets(providerRow);
    return secrets.apiKey;
  } catch (err) {
    console.error(`[Public Chat] ${providerName} key decrypt failed:`, err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

async function ensurePromptSmart3Init(): Promise<boolean> {
  if (promptSmart3Ready) return true;
  try {
    await initOptimizePipeline(promptSmart3Providers, resolvePromptSmart3ApiKey);
    promptSmart3Ready = true;
    return true;
  } catch (err) {
    console.error('[Public Chat] PromptSmart3 init failed:', err instanceof Error ? err.message : String(err));
    return false;
  }
}

function selectProvider(): { provider: string; apiKey: string; baseUrl: string; model: string } {
  if (MINIMAX_API_KEY) {
    return { provider: 'minimax', apiKey: MINIMAX_API_KEY, baseUrl: MINIMAX_CHAT_BASE_URL, model: MINIMAX_MODEL };
  }
  const xunfeiApiKey = resolveXunfeiSparkApiKey();
  if (xunfeiApiKey) {
    return { provider: 'xunfei', apiKey: xunfeiApiKey, baseUrl: XUNFEI_API_URL, model: XUNFEI_MODEL };
  }
  return { provider: '', apiKey: '', baseUrl: '', model: '' };
}

function isM27Model(model: string): boolean {
  return /^MiniMax-M2\.7(?:-highspeed)?$/i.test(model);
}

function isM25Model(model: string): boolean {
  return /^MiniMax-M2\.5(?:-highspeed)?$/i.test(model);
}

function resolveMinimaxParams(model: string, enableThinking?: boolean): { temperature: number; maxTokens: number; topP: number } {
  if (isM27Model(model)) {
    return { temperature: 0.3, maxTokens: 16384, topP: 0.9 };
  }
  if (isM25Model(model)) {
    return { temperature: 0.1, maxTokens: 8192, topP: 0.9 };
  }
  return { temperature: 0.7, maxTokens: 2048, topP: 0.95 };
}

function getGuestIdentifier(req: Request): string {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
             req.socket.remoteAddress ||
             'unknown';
  return `guest:${ip}`;
}

// P2 修复 #22：访客限流改用 Redis（INCR + EXPIRE 原子操作）
// 多实例部署时所有节点共享计数，避免内存 Map 各自计数导致突破上限。
async function checkGuestTrial(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().split('T')[0];
  const redisKey = `${GUEST_TRIAL_KEY_PREFIX}${today}:${identifier}`;

  // Redis 可用：读取当日已用次数
  if (redisService.isAvailable()) {
    try {
      const client = redisService.getClient();
      const countStr = await client?.get(redisKey);
      const count = countStr ? parseInt(countStr, 10) : 0;
      if (Number.isNaN(count) || count >= GUEST_TRIAL_LIMIT) {
        return { allowed: false, remaining: 0 };
      }
      return { allowed: true, remaining: GUEST_TRIAL_LIMIT - count };
    } catch (err) {
      logger.warn('[Public Chat] Redis guest trial check failed, fallback to memory', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 内存兜底（Redis 不可用，仅开发环境）
  const current = guestTrialMap.get(identifier);
  if (!current || current.date !== today) {
    return { allowed: true, remaining: GUEST_TRIAL_LIMIT };
  }
  if (current.count >= GUEST_TRIAL_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: GUEST_TRIAL_LIMIT - current.count };
}

async function incrementGuestTrial(identifier: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const redisKey = `${GUEST_TRIAL_KEY_PREFIX}${today}:${identifier}`;

  // Redis 可用：INCR 原子自增，首次设置 TTL
  if (redisService.isAvailable()) {
    try {
      const client = redisService.getClient();
      if (client) {
        const newCount = await client.incr(redisKey);
        // 仅在首次自增（newCount === 1）时设置过期，避免每次刷新 TTL
        if (newCount === 1) {
          await client.expire(redisKey, computeGuestTrialTtlSeconds());
        }
        return;
      }
    } catch (err) {
      logger.warn('[Public Chat] Redis guest trial increment failed, fallback to memory', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 内存兜底（Redis 不可用，仅开发环境）
  const current = guestTrialMap.get(identifier);
  if (!current || current.date !== today) {
    guestTrialMap.set(identifier, { count: 1, date: today });
  } else {
    current.count++;
    guestTrialMap.set(identifier, current);
  }
}

async function resolveAuthUserId(req: Request): Promise<{ userId: string | null; membershipLevel: string } | null> {
  const { token } = getRequestAuthToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwt.secret) as any; // SEC-09 修复：使用统一的 config.jwt.secret 而非 process.env.JWT_SECRET || 'default-secret'
    return { userId: payload.userId || payload.id, membershipLevel: payload.membershipLevel || 'trial' };
  } catch {
    return null;
  }
}

/** 移除 AI 响应中的 &lt;think&gt;...&lt;/think&gt; 推理标签 */
function stripThinkingTags(text: string): string {
  if (!text) return text;
  return text.replace(/<\s*think\s*>[\s\S]*?<\s*\/\s*think\s*>/gi, '').trim();
}

publicChatRouter.post('/', async (req: Request, res: Response) => {
  const providerConfig = selectProvider();

  // 认证检测：登录用户走积分扣除，访客走试用限制
  const authInfo = await resolveAuthUserId(req);
  const isGuest = !authInfo;
  let guestId = '';
  let membershipLevel = 'trial';

  if (authInfo) {
    membershipLevel = authInfo.membershipLevel || 'trial';
    // 登录用户积分预检查
    const creditCheck = await creditService.preCheck({
      userId: authInfo.userId,
      membershipLevel,
      type: 'prompt',
      customPoints: 5,
      taskId: `public_chat_${Date.now()}`,
      reason: '公开对话预检查',
    });
    if (!creditCheck.allowed) {
      return res.status(402).json({ success: false, error: creditCheck.reason });
    }
  } else {
    // 访客试用限制
    guestId = getGuestIdentifier(req);
    const trialCheck = await checkGuestTrial(guestId);
    if (!trialCheck.allowed) {
      return res.status(402).json({
        success: false,
        error: `今日试用次数已用完（每日${GUEST_TRIAL_LIMIT}次）。请登录获取更多次数。`,
      });
    }
  }

  // P1 修复：生成唯一 chatSessionId 供 consume 和 refund 幂等使用（需在 try 外声明，catch 中可访问）
  const chatSessionId = `public_chat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const { message, systemPrompt, history, enableThinking, model } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: '消息不能为空',
      });
    }

    const messages: Array<{ role: string; content: string }> = [];

    if (systemPrompt && typeof systemPrompt === 'string') {
      messages.push({ role: 'system', content: systemPrompt });
    }

    if (Array.isArray(history) && history.length > 0) {
      for (const h of history) {
        if (h.role && h.content && typeof h.content === 'string') {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }

    messages.push({ role: 'user', content: message });

    // 风险修复：积分扣除移到 AI 处理之前，避免用户等待 AI 后才发现积分不足
    if (authInfo) {
      try {
        await creditService.consume({
          userId: authInfo.userId,
          membershipLevel,
          type: 'prompt',
          customPoints: 5,
          taskId: chatSessionId,
          reason: '公开对话',
        });
      } catch (creditErr) {
        logger.error('[Public Chat] 积分扣除失败:', creditErr);
        return res.status(402).json({
          success: false,
          error: '积分不足，请充值后重试',
        });
      }
    }

    let chatResult: { content: string; reasoning_content?: string; model?: string; usage?: any } | null = null;
    const requestedModel = typeof model === 'string' ? model.trim() : '';
    // 首页文字推理统一走 PromptSmart3 智能路由。未知或未指定模型按 auto 处理，
    // 不再落入旧的单一 Provider 分支。
    const selectedModel = PROMPT_TEXT_PROVIDER_IDS.has(requestedModel) ? requestedModel : 'auto';

    if (PROMPT_TEXT_PROVIDER_IDS.has(selectedModel)) {
      const ready = await ensurePromptSmart3Init();
      if (!ready) {
        return res.status(503).json({
          success: false,
          error: '智能文本模型服务尚未就绪，请检查 Provider 配置',
        });
      }

      const llmResult = await routeRequest(
        [],
        messages,
        (tried) => {
          const preferredProviderName = PROMPT_TEXT_PROVIDER_ALIASES[selectedModel] || selectedModel;
          if (preferredProviderName && preferredProviderName !== 'auto' && !tried.has(preferredProviderName)) {
            const preferred = selectProviderByName(preferredProviderName);
            if (preferred && !preferred.circuitBreaker.isOpen) {
              return { config: preferred.config, name: preferred.config.name };
            }
          }
          const entry = selectPromptSmart3Provider(tried);
          if (!entry) return null;
          return { config: entry.config, name: entry.config.name };
        },
        reportSuccess,
        reportFailure,
      );

      chatResult = {
        content: stripThinkingTags(llmResult.content || ''),
        model: llmResult.provider,
      };
    }

    if (!chatResult && !providerConfig.apiKey) {
      return res.status(503).json({
        success: false,
        error: 'AI服务未配置，请配置至少一个智能路由文字模型',
      });
    }

    if (!chatResult && providerConfig.provider === 'minimax') {
      const resolved = resolveMinimaxParams(providerConfig.model, enableThinking);
      const requestBody: Record<string, unknown> = {
        model: providerConfig.model,
        messages,
        temperature: resolved.temperature,
        max_tokens: resolved.maxTokens,
        top_p: resolved.topP,
      };

      if (isM27Model(providerConfig.model) && enableThinking !== false) {
        requestBody.thinking = {
          type: 'enabled',
          budget_tokens: Math.min(8192, Math.floor(resolved.maxTokens * 0.4)),
        };
      }

      const response = await axios.post(
        `${providerConfig.baseUrl}/v1/chat/completions`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${providerConfig.apiKey}`,
          },
          timeout: 60000,
        }
      );

      const data = response.data;

      if (data.choices && data.choices.length > 0) {
        const rawContent = data.choices[0].message?.content || '';
        const content = stripThinkingTags(rawContent);
        const reasoningContent = data.choices[0].message?.reasoning_content || '';
        chatResult = {
          content,
          reasoning_content: reasoningContent,
          model: data.model || providerConfig.model,
          usage: data.usage ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
          } : undefined,
        };
      } else {
        return res.status(500).json({
          success: false,
          error: 'API返回数据格式异常',
        });
      }
    }

    if (!chatResult) {
      const response = await axios.post(
        providerConfig.baseUrl,
        {
          model: providerConfig.model,
          messages,
          temperature: 0.7,
          max_tokens: 2000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${providerConfig.apiKey}`,
          },
          timeout: 30000,
        }
      );

      const data = response.data;

      if (data.choices && data.choices.length > 0) {
        const rawContent = data.choices[0].message?.content || data.choices[0].text || '';
        const content = stripThinkingTags(rawContent);
        chatResult = {
          content,
          model: data.model || providerConfig.model,
        };
      } else {
        return res.status(500).json({
          success: false,
          error: 'API返回数据格式异常',
        });
      }
    }

    // 风险修复：积分已在 AI 处理前扣除，此处仅需处理访客试用计数
    if (!authInfo) {
      await incrementGuestTrial(guestId);
    }

    return res.json({
      success: true,
      ...chatResult,
    });
  } catch (error: unknown) {
    const errAxios = error as any;
    console.error('[Public Chat] Error:', (error instanceof Error ? error.message : String(error)));
    if (errAxios?.response) {
      console.error('[Public Chat] API Response Status:', errAxios.response.status);
      console.error('[Public Chat] API Response Data:', JSON.stringify(errAxios.response.data).substring(0, 500));
    }
    // 风险修复：AI 处理失败时退还已扣除的积分
    // P1 修复：传入 chatSessionId 供幂等检查，refund 失败时告知用户
    if (authInfo) {
      try {
        await creditService.refund({
          userId: authInfo.userId,
          type: 'prompt',
          customPoints: 5,
          taskId: chatSessionId,
          reason: '公开对话AI处理失败',
        });
      } catch (refundErr) {
        logger.error('[Public Chat] 积分退还失败:', refundErr);
        return res.status(500).json({
          success: false,
          error: 'AI服务不可用，积分退还失败请联系客服',
        });
      }
    }
    return res.status(500).json({
      success: false,
      error: 'AI服务暂时不可用，积分已退还',
    });
  }
});

export default publicChatRouter;
