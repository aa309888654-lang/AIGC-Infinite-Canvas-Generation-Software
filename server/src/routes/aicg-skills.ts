import { Router, Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

/**
 * AICG Agent Skill HTTP API — 供 OpenClaw / 外部 Agent 调用画布能力（Sprint 4）
 */
export const aicgSkillsRouter = Router();

const SKILLS = [
  {
    id: 'aicg.generate_script',
    name: '剧本生分镜',
    description: '从剧本文本生成结构化分镜',
    endpoint: 'POST /api/v1/aicg-skills/script',
    auth: 'Bearer required',
  },
  {
    id: 'aicg.video_analyze',
    name: '视频参考理解',
    description: '分析参考视频的节奏、运镜与场景，供 ScriptNode 分镜生成',
    endpoint: 'POST /api/v1/aicg-skills/video-analyze',
    auth: 'Bearer required',
  },
  {
    id: 'aicg.generate_image',
    name: 'AI 生图',
    description: '文生图 / 图生图（返回 jobId，客户端画布执行）',
    endpoint: 'POST /api/v1/aicg-skills/image',
    auth: 'Bearer required',
  },
  {
    id: 'aicg.generate_video',
    name: 'AI 生视频',
    description: '文生视频 / 图生视频（返回 jobId，客户端画布执行）',
    endpoint: 'POST /api/v1/aicg-skills/video',
    auth: 'Bearer required',
  },
  {
    id: 'aicg.compose_video',
    name: '视频合成',
    description: '多段视频拼接',
    endpoint: 'POST /api/v1/aicg-skills/compose',
    auth: 'Bearer required',
  },
  {
    id: 'aicg.export_clip',
    name: '导出到剪辑',
    description: '将媒体推送到 AI 剪辑时间轴',
    endpoint: 'POST /api/v1/aicg-skills/export-clip',
    auth: 'Bearer required',
  },
] as const;

function internalApiBase(): string {
  const port = process.env.PORT || '3200';
  return process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${port}`;
}

function buildScriptPrePrompt(scriptType?: string, tone?: string): string {
  const typeHint =
    scriptType === 'cinematic'
      ? '电影级分镜'
      : scriptType === 'story'
        ? '叙事短片分镜'
        : '专业分镜';
  const toneHint = tone ? `情绪基调：${tone}。` : '';
  return `你是${typeHint}编剧。${toneHint}将输入解析为 JSON 数组，每项含 description、duration(秒)、shotType、cameraMovement、transition、dialogue(可选)、narration(可选)。只输出 JSON 数组，无其它文字。`;
}

function parseScenesFromText(text: string): Record<string, unknown>[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function videoSnapshotUrl(videoUrl: string): string | null {
  if (!videoUrl || videoUrl.startsWith('blob:') || videoUrl.startsWith('data:')) return null;
  return null;
}

async function callOptimizePromptV3(
  req: AuthRequest,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data?: Record<string, unknown>; status: number }> {
  const response = await fetch(`${internalApiBase()}/api/v1/ai/optimize-prompt-v3`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok && data.success === true, data, status: response.status };
}

aicgSkillsRouter.get('/', (_req, res) => {
  res.json({ success: true, skills: SKILLS, version: '1.0.0' });
});

aicgSkillsRouter.use(requireAuth);

aicgSkillsRouter.post('/script', async (req: AuthRequest, res: Response) => {
  try {
    const { script, mode = 'text', scriptType, tone, videoAnalysis, notes } = req.body || {};
    if (!script || typeof script !== 'string') {
      return res.status(400).json({ success: false, error: 'script required' });
    }

    let userPrompt = script;
    if (mode === 'video_reference' && videoAnalysis) {
      userPrompt = `参考视频分析：\n${videoAnalysis}\n\n补充：${notes || script}`;
    }

    const category =
      scriptType === 'cinematic' ? 'film-director' : scriptType === 'story' ? 'cinema-director' : 'cinematic';

    const result = await callOptimizePromptV3(req, {
      prompt: userPrompt,
      scenario: 'video',
      category,
      prePrompt: buildScriptPrePrompt(scriptType, tone),
    });

    if (!result.ok) {
      return res.status(result.status >= 400 ? result.status : 500).json({
        success: false,
        error: (result.data?.error as string) || '剧本分镜生成失败',
      });
    }

    const optimizedText = String(result.data?.optimizedPrompt || '');
    const scenes = parseScenesFromText(optimizedText);

    return res.json({
      success: true,
      mode,
      scenes,
      optimizedText,
      provider: result.data?.provider,
    });
  } catch (error) {
    logger.error('[AICG Skills] script error:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ success: false, error: '剧本分镜生成失败' });
  }
});

aicgSkillsRouter.post('/video-analyze', async (req: AuthRequest, res: Response) => {
  try {
    const { videoUrl, notes } = req.body || {};
    if (!videoUrl || typeof videoUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'videoUrl required' });
    }

    const snapshot = videoSnapshotUrl(videoUrl);
    const prePrompt = `你是专业视频分析师与分镜顾问。根据视频 URL、可选封面帧与补充说明，输出结构化中文分析，包含：
1. 整体节奏与时长感
2. 主要运镜方式（推拉摇移跟等）
3. 色调与光影风格
4. 场景与主体描述
5. 可复用的 4-8 个关键镜头要点（含建议 duration、shotType、cameraMovement）
若无法直接观看视频，结合 URL 与描述做合理专业推断。输出 Markdown，便于后续生成分镜。`;

    const userPrompt = [
      `视频 URL：${videoUrl}`,
      snapshot ? `封面帧 URL（可参考）：${snapshot}` : null,
      notes ? `补充说明：${notes}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const result = await callOptimizePromptV3(req, {
      prompt: userPrompt,
      scenario: 'video',
      category: 'film-director',
      prePrompt,
    });

    if (!result.ok) {
      return res.status(result.status >= 400 ? result.status : 500).json({
        success: false,
        error: (result.data?.error as string) || '视频理解失败',
      });
    }

    return res.json({
      success: true,
      analysis: result.data?.optimizedPrompt,
      snapshotUrl: snapshot,
      provider: result.data?.provider,
    });
  } catch (error) {
    logger.error('[AICG Skills] video-analyze error:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ success: false, error: '视频理解失败' });
  }
});

aicgSkillsRouter.post('/image', async (req: AuthRequest, res: Response) => {
  const { prompt, modelId, modelProvider } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, error: 'prompt required' });
  }

  return res.json({
    success: true,
    jobId: `img_${Date.now()}_${req.userId!.slice(0, 8)}`,
    prompt,
    modelId: modelId || 'default',
    modelProvider: modelProvider || 'auto',
    message: '请在客户端 AICGImageGenNode 或 executeSingleNode 执行生成',
    executeHint: { nodeType: 'aicgImageGen', params: { prompt, modelId, modelProvider } },
  });
});

aicgSkillsRouter.post('/video', async (req: AuthRequest, res: Response) => {
  const { prompt, modelId, modelProvider } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, error: 'prompt required' });
  }

  return res.json({
    success: true,
    jobId: `vid_${Date.now()}_${req.userId!.slice(0, 8)}`,
    prompt,
    modelId: modelId || 'viduq3-turbo',
    modelProvider: modelProvider || 'vidu',
    message: '请在客户端 AICGVideoGenNode 或 executeSingleNode 执行生成',
    executeHint: { nodeType: 'aiVideo', params: { prompt, modelId, modelProvider } },
  });
});

aicgSkillsRouter.post('/compose', (req: AuthRequest, res: Response) => {
  const { videoUrls } = req.body || {};
  if (!Array.isArray(videoUrls) || videoUrls.length < 2) {
    return res.status(400).json({ success: false, error: 'videoUrls[] (min 2) required' });
  }
  res.json({
    success: true,
    jobId: `compose_${Date.now()}`,
    videoUrls,
    userId: req.userId,
    message: '请在客户端 VideoComposeNode 执行 FFmpeg 合成',
  });
});

aicgSkillsRouter.post('/export-clip', (req: AuthRequest, res: Response) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'items[] required' });
  }
  res.json({
    success: true,
    redirect: '/1?view=aiclipping',
    items,
    userId: req.userId,
  });
});

export default aicgSkillsRouter;
