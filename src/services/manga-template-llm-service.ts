import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';
import { logger } from '@/lib/logger';
import type { MangaTemplate, TemplateScene } from '@/config/templates';

export interface GenerateMangaTemplateOptions {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const PREVIEW_GRADIENTS = [
  'linear-gradient(135deg, rgba(168,85,247,0.32), rgba(59,130,246,0.16))',
  'linear-gradient(135deg, rgba(56,189,248,0.32), rgba(16,185,129,0.14))',
  'linear-gradient(135deg, rgba(248,113,113,0.35), rgba(249,115,22,0.16))',
  'linear-gradient(135deg, rgba(34,197,94,0.28), rgba(234,179,8,0.14))',
];

const TEMPLATE_ICONS = ['🎬', '📦', '⚡', '🎨', '🚀', '💡', '🔥', '⭐'];

class MangaTemplateLLMService {
  /**
   * 调用 /api/v1/ai/chat 让 LLM 根据 userPrompt 生成漫剧模板
   * 失败时抛错，由调用方决定降级策略
   */
  async generateMangaTemplate(
    userPrompt: string,
    options: GenerateMangaTemplateOptions = {}
  ): Promise<MangaTemplate> {
    const trimmedPrompt = userPrompt.trim();
    if (!trimmedPrompt) {
      throw new Error('请提供模板需求描述');
    }

    const systemPrompt =
      '你是专业漫剧/短视频剪辑导演。根据用户需求生成结构化的剪辑模板。' +
      '只输出 JSON，不要解释，不要 Markdown 代码块。' +
      'JSON 格式：{"name":"模板名","description":"一句话描述","category":"short-drama|product|action","style":"anime|comic|realistic|mixed","duration":30,"tags":["标签1","标签2"],"scenes":[{"id":"scene-1","name":"场景名","type":"opening|dialogue|action|emotional|narration|ending","duration":6,"effects":["特效1","特效2"],"elements":[{"type":"text","content":"文案","position":"top|center|bottom|left|right","style":"可选样式"}]}]}。' +
      'duration 是总秒数；scenes 各段 duration 之和应等于总 duration；每个模板 3-5 个场景。';

    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken() || ''}`,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `需求：${trimmedPrompt}` },
        ],
        provider: options.provider || 'stepfun',
        model: options.model || 'step-3.5-flash',
        temperature: options.temperature ?? 0.6,
        maxTokens: options.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`LLM 请求失败: ${response.status} ${errText.slice(0, 160)}`);
    }

    const data = await response.json();
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.content ??
      data?.message?.content ??
      data?.result ??
      '';

    const template = this.parseMangaTemplateResponse(content, trimmedPrompt);
    return template;
  }

  private parseMangaTemplateResponse(content: string, userPrompt: string): MangaTemplate {
    if (!content || typeof content !== 'string') {
      throw new Error('LLM 返回为空');
    }

    const cleaned = content.replace(/```(?:json)?/gi, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('LLM 返回未找到 JSON 对象');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch (error) {
      throw new Error(`LLM 返回 JSON 解析失败: ${error instanceof Error ? error.message : ''}`);
    }

    const scenes = this.parseScenes(parsed.scenes);
    if (scenes.length === 0) {
      throw new Error('LLM 返回缺少有效场景');
    }

    const totalDuration = Number(parsed.duration);
    const safeTotal = Number.isFinite(totalDuration) && totalDuration > 0
      ? totalDuration
      : scenes.reduce((sum, scene) => sum + scene.duration, 0);

    const id = `llm-manga-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const promptSnippet = userPrompt.slice(0, 12);

    return {
      id,
      name: typeof parsed.name === 'string' ? parsed.name : `LLM 生成 · ${promptSnippet}`,
      description: typeof parsed.description === 'string' ? parsed.description : userPrompt,
      category: typeof parsed.category === 'string' ? parsed.category : 'short-drama',
      icon: TEMPLATE_ICONS[Math.floor(Math.random() * TEMPLATE_ICONS.length)],
      style: this.parseStyle(parsed.style),
      duration: safeTotal,
      popularity: 80,
      isNew: true,
      tags: this.parseTags(parsed.tags),
      preview: PREVIEW_GRADIENTS[Math.floor(Math.random() * PREVIEW_GRADIENTS.length)],
      scenes,
    };
  }

  private parseScenes(raw: unknown): TemplateScene[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((scene): scene is Record<string, unknown> => typeof scene === 'object' && scene !== null)
      .map((scene, index) => {
        const duration = Number(scene.duration);
        const validTypes = new Set(['opening', 'dialogue', 'action', 'emotional', 'narration', 'ending']);
        const rawType = typeof scene.type === 'string' ? scene.type : 'narration';
        const type = validTypes.has(rawType) ? (rawType as TemplateScene['type']) : 'narration';

        return {
          id: typeof scene.id === 'string' ? scene.id : `scene-${index + 1}`,
          name: typeof scene.name === 'string' ? scene.name : `场景 ${index + 1}`,
          type,
          duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 4,
          elements: this.parseElements(scene.elements),
          effects: this.parseEffects(scene.effects),
        };
      });
  }

  private parseElements(raw: unknown): TemplateScene['elements'] {
    if (!Array.isArray(raw)) return [];
    const validPositions = new Set(['top', 'center', 'bottom', 'left', 'right']);
    const validTypes = new Set(['panel', 'text', 'effect', 'transition']);
    return raw
      .filter((el): el is Record<string, unknown> => typeof el === 'object' && el !== null)
      .map((el) => {
        const rawType = typeof el.type === 'string' ? el.type : 'text';
        const rawPos = typeof el.position === 'string' ? el.position : 'center';
        return {
          type: validTypes.has(rawType) ? (rawType as TemplateScene['elements'][0]['type']) : 'text',
          content: typeof el.content === 'string' ? el.content : '',
          position: validPositions.has(rawPos) ? (rawPos as TemplateScene['elements'][0]['position']) : 'center',
          style: typeof el.style === 'string' ? el.style : undefined,
        };
      });
  }

  private parseEffects(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((effect): effect is string => typeof effect === 'string').slice(0, 5);
  }

  private parseStyle(raw: unknown): MangaTemplate['style'] {
    const validStyles = new Set(['anime', 'comic', 'realistic', 'mixed']);
    return typeof raw === 'string' && validStyles.has(raw)
      ? (raw as MangaTemplate['style'])
      : 'mixed';
  }

  private parseTags(raw: unknown): string[] {
    if (!Array.isArray(raw)) return ['LLM生成'];
    return raw.filter((tag): tag is string => typeof tag === 'string').slice(0, 4);
  }
}

export const mangaTemplateLLMService = new MangaTemplateLLMService();
