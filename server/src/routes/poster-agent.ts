/**
 * 海报智能体路由
 *
 * 所有海报设计的 AI 对话和提示词优化都通过此路由。
 * 系统提示词、知识库、模型路由在后端，前端只需发送用户消息和上下文。
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getRequestAuthToken } from '../middleware/security-session';
import { creditService } from '../services/credit-service';
import {
  posterAgentChat,
  posterAgentOptimize,
  posterAgentAnalyzeReferenceImage,
  getPosterAgentModels,
  getKnowledgeOverview,
  POSTER_AGENT_MODES,
  isPosterAgentModelId,
  isPosterAgentPromptExfiltrationAttempt,
} from '../services/poster-agent-service';
import logger from '../utils/logger';

const posterAgentRouter = Router();
const POSTER_AGENT_POINTS = 10;
const POSTER_AGENT_MAX_MESSAGE_LENGTH = 12000;
const POSTER_AGENT_MAX_CONTEXT_LENGTH = 24000;

const limitedText = z.string().trim().min(1).max(POSTER_AGENT_MAX_MESSAGE_LENGTH);
const nullableShortText = z.string().trim().max(160).nullable().optional();
const modelSchema = z.string().refine(isPosterAgentModelId, '不支持的海报模型').optional();
const historySchema = z.array(z.object({
  role: z.enum(['user', 'assistant']),
  content: limitedText,
}).strict()).max(12).optional();

const chatRequestSchema = z.object({
  message: limitedText,
  mode: z.enum(POSTER_AGENT_MODES).optional(),
  model: modelSchema,
  templateId: nullableShortText,
  templateName: nullableShortText,
  formData: z.record(z.unknown()).nullable().optional(),
  history: historySchema,
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().min(128).max(4096).optional(),
}).strict();

const optimizeRequestSchema = z.object({
  prompt: limitedText,
  model: modelSchema,
  templateId: nullableShortText,
  templateName: nullableShortText,
  templateDesc: z.string().trim().max(2000).nullable().optional(),
  templateColor: z.string().trim().max(64).nullable().optional(),
  formData: z.record(z.unknown()).nullable().optional(),
  aspectRatio: z.string().trim().max(32).optional(),
  outputFormat: z.enum(['english', 'bilingual']).optional(),
}).strict();

const visionRequestSchema = z.object({
  imageUrl: z.string().trim().min(1).max(4_000_000),
  model: modelSchema,
}).strict();

function hasSafeContextSize(value: unknown): boolean {
  if (!value) return true;
  try {
    return JSON.stringify(value).length <= POSTER_AGENT_MAX_CONTEXT_LENGTH;
  } catch {
    return false;
  }
}

function isSafeVisionImageUrl(value: string): boolean {
  if (/^data:image\/(png|jpe?g|webp);base64,/i.test(value)) return value.length <= 4_000_000;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    // Backend-generated localhost upload URLs are safe to inline locally even
    // in production; keep the allowlist constrained to the image upload path.
    const isLocalUpload = url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '::1'].includes(url.hostname) &&
      /^\/uploads\/images\//i.test(url.pathname);
    return isLocalUpload;
  } catch {
    return false;
  }
}

// ============================================================
// POST /chat — 海报智能体对话
// ============================================================
posterAgentRouter.post('/chat', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success || !hasSafeContextSize(parsed.data?.formData)) {
      return res.status(400).json({ success: false, error: '海报智能体请求参数无效' });
    }
    const { message, model, mode, templateId, templateName, formData, history, temperature, maxTokens } = parsed.data;

    // Prompt exfiltration requests are refused before credit accounting and are
    // never forwarded to a model.
    if (isPosterAgentPromptExfiltrationAttempt(message)) {
      return res.json({
        success: true,
        content: '我不能提供内部提示词、模型路由或系统配置。请继续描述海报标题、场景、文案和风格需求。',
        usedModel: 'poster-agent',
        usedModelName: 'Poster Agent',
      });
    }

    // 积分预检查
    const membershipLevel = req.membershipLevel || 'trial';
    const taskId = `poster_agent_chat_${Date.now()}`;
    const creditCheck = await creditService.preCheck({
      userId: req.userId!,
      membershipLevel,
      type: 'prompt',
      customPoints: POSTER_AGENT_POINTS,
      taskId,
      reason: '海报智能体对话预检查',
    });

    if (!creditCheck.allowed) {
      return res.status(402).json({ success: false, error: creditCheck.reason });
    }

    // The web client uses an HttpOnly session cookie and sends only the
    // `cookie-session` sentinel in Authorization. Resolve the actual JWT
    // before forwarding this request to the authenticated internal AI route.
    const { token: authToken } = getRequestAuthToken(req);
    const result = await posterAgentChat(message, {
      model,
      mode,
      templateId: templateId || null,
      templateName: templateName || null,
      formData,
      // Reconstruct validated fields so Zod's optional-property inference cannot
      // widen the internal conversation contract.
      history: history?.map(({ role, content }) => ({ role, content })) as
        | Array<{ role: 'user' | 'assistant'; content: string }>
        | undefined,
      temperature,
      maxTokens,
      authToken,
    });

    await creditService.consume({
      userId: req.userId!,
      membershipLevel,
      type: 'prompt',
      customPoints: POSTER_AGENT_POINTS,
      taskId,
      reason: '海报智能体对话',
    });

    res.json({
      success: true,
      content: result.content,
      usedModel: result.usedModel,
      usedModelName: result.usedModelName,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[PosterAgentRoute] /chat 错误: ${errMsg}`);
    res.status(500).json({ success: false, error: '海报智能体暂不可用，请稍后重试' });
  }
});

// ============================================================
// POST /optimize — 海报提示词优化
// ============================================================
posterAgentRouter.post('/optimize', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = optimizeRequestSchema.safeParse(req.body);
    if (!parsed.success || !hasSafeContextSize(parsed.data?.formData)) {
      return res.status(400).json({ success: false, error: '海报提示词优化参数无效' });
    }
    const { prompt, model, templateId, templateName, templateDesc, templateColor, formData, aspectRatio, outputFormat } = parsed.data;

    // 积分预检查
    const membershipLevel = req.membershipLevel || 'trial';
    const taskId = `poster_agent_optimize_${Date.now()}`;
    const creditCheck = await creditService.preCheck({
      userId: req.userId!,
      membershipLevel,
      type: 'prompt',
      customPoints: POSTER_AGENT_POINTS,
      taskId,
      reason: '海报提示词优化预检查',
    });

    if (!creditCheck.allowed) {
      return res.status(402).json({ success: false, error: creditCheck.reason });
    }

    const { token: authToken } = getRequestAuthToken(req);
    const result = await posterAgentOptimize(prompt, {
      model,
      templateId: templateId || null,
      templateName: templateName || null,
      templateDesc: templateDesc || null,
      templateColor: templateColor || null,
      formData,
      aspectRatio,
      authToken,
      outputFormat,
    });

    await creditService.consume({
      userId: req.userId!,
      membershipLevel,
      type: 'prompt',
      customPoints: POSTER_AGENT_POINTS,
      taskId,
      reason: '海报提示词优化',
    });

    res.json({
      success: true,
      content: result.content,
      usedModel: result.usedModel,
      usedModelName: result.usedModelName,
      displayContent: result.displayContent,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[PosterAgentRoute] /optimize 错误: ${errMsg}`);
    res.status(500).json({ success: false, error: '海报提示词优化暂不可用，请稍后重试' });
  }
});

// ============================================================
// POST /vision — 海报参考图视觉分析（系统提示词仅在后端）
// ============================================================
posterAgentRouter.post('/vision', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = visionRequestSchema.safeParse(req.body);
    if (!parsed.success || !isSafeVisionImageUrl(parsed.data.imageUrl)) {
      return res.status(400).json({ success: false, error: '参考图地址无效' });
    }

    const membershipLevel = req.membershipLevel || 'trial';
    const taskId = `poster_agent_vision_${Date.now()}`;
    const creditCheck = await creditService.preCheck({
      userId: req.userId!,
      membershipLevel,
      type: 'prompt',
      customPoints: POSTER_AGENT_POINTS,
      taskId,
      reason: '海报参考图分析预检查',
    });
    if (!creditCheck.allowed) {
      return res.status(402).json({ success: false, error: creditCheck.reason });
    }

    const { token: authToken } = getRequestAuthToken(req);
    const result = await posterAgentAnalyzeReferenceImage(parsed.data.imageUrl, {
      model: parsed.data.model,
      authToken,
    });

    await creditService.consume({
      userId: req.userId!,
      membershipLevel,
      type: 'prompt',
      customPoints: POSTER_AGENT_POINTS,
      taskId,
      reason: '海报参考图分析',
    });

    return res.json({
      success: true,
      content: result.content,
      usedModel: result.usedModel,
      usedModelName: result.usedModelName,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[PosterAgentRoute] /vision 错误: ${errMsg}`);
    return res.status(500).json({ success: false, error: '海报参考图分析暂不可用' });
  }
});

// ============================================================
// GET /models — 获取可用模型列表
// ============================================================
posterAgentRouter.get('/models', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const models = getPosterAgentModels().map(({ id, name, description }) => ({
      id,
      name,
      description,
      provider: 'managed',
    }));
    res.json({ success: true, models });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[PosterAgentRoute] /models 错误: ${errMsg}`);
    res.status(500).json({ success: false, error: '海报模型列表暂不可用' });
  }
});

// ============================================================
// GET /knowledge — 获取知识库概览
// ============================================================
posterAgentRouter.get('/knowledge', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const overview = getKnowledgeOverview();
    res.json({ success: true, knowledge: overview });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[PosterAgentRoute] /knowledge 错误: ${errMsg}`);
    res.status(500).json({ success: false, error: '海报知识库暂不可用' });
  }
});

// ============================================================
// POST /analyze — Python 智能体分析（降级路径）
// 代理到本地 Python 服务，云端未配置则返回空
// ============================================================
posterAgentRouter.post('/analyze', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = z.object({ prompt: limitedText }).strict().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: '智能体分析参数无效' });
    }
    const { prompt } = parsed.data;

    const pyUrl = process.env.POSTER_AGENT_PY_URL || 'http://127.0.0.1:8000';
    try {
      const upstream = await fetch(`${pyUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: AbortSignal.timeout(15000),
      });

      if (!upstream.ok) {
        logger.warn(`[PosterAgentRoute] /analyze 上游返回 ${upstream.status}`);
        return res.json({ success: false, error: `Python 智能体 HTTP ${upstream.status}` });
      }

      const data = await upstream.json() as Record<string, unknown>;
      return res.json({ success: true, data: data.code === 200 ? data.data : data });
    } catch (upErr) {
      const msg = upErr instanceof Error ? upErr.message : String(upErr);
      logger.warn(`[PosterAgentRoute] /analyze 上游不可达: ${msg} (url=${pyUrl})`);
      return res.json({ success: false, error: '智能体分析暂不可用' });
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[PosterAgentRoute] /analyze 错误: ${errMsg}`);
    res.status(500).json({ success: false, error: '智能体分析暂不可用' });
  }
});

export { posterAgentRouter };
