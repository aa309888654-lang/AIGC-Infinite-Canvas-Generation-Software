/**
 * 魔法海报 AI 解析工具
 */

export interface PosterTemplateResult {
  templateId: string;
  title: string;
  subtitle?: string;
  date?: string;
  location?: string;
  organizer?: string;
  contact?: string;
  description?: string;
  aspectRatio?: string;
  style?: string;
  colorScheme?: string;
}

export function parseTemplateFromContent(content: string): PosterTemplateResult | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*?"templateId"[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.templateId && parsed.title) {
        return parsed as PosterTemplateResult;
      }
    }
  } catch { /* ignore */ }

  const templateMatch = content.match(/【模版选择】[\s\S]*?模板[：:]\s*(\S+)/);
  if (templateMatch) {
    const tplName = templateMatch[1];
    const titleMatch = content.match(/标题[：:]\s*(.+)/);
    return {
      templateId: tplName,
      title: titleMatch ? titleMatch[1].trim() : '未命名海报',
    };
  }
  return null;
}

/** 归一化后端 / 模型返回的 toolCalls */
export function normalizePosterToolCalls(raw: unknown): PosterTemplateResult[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const results: PosterTemplateResult[] = [];

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    // 已是扁平结构
    if (obj.templateId && obj.title) {
      results.push(obj as any as PosterTemplateResult);
      continue;
    }

    // 后端归一化格式：{ id, name, arguments }
    if (obj.name === 'select_poster_template' && obj.arguments) {
      const args = obj.arguments as Record<string, unknown>;
      if (args.templateId && args.title) {
        results.push(args as any as PosterTemplateResult);
      }
      continue;
    }

    // OpenAI / MiniMax tool_calls 格式
    const fn = obj.function as { name?: string; arguments?: string | Record<string, unknown> } | undefined;
    if (fn?.name === 'select_poster_template' && fn.arguments) {
      try {
        const args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : fn.arguments;
        if (args?.templateId && args?.title) {
          results.push(args as PosterTemplateResult);
        }
      } catch { /* ignore */ }
    }
  }
  return results;
}

/** 合并 toolCalls 与 content 中的 JSON 解析 */
export function resolvePosterToolCalls(
  content: string,
  rawToolCalls?: unknown
): PosterTemplateResult[] {
  const fromTools = normalizePosterToolCalls(rawToolCalls);
  if (fromTools.length > 0) return fromTools;
  const fromContent = parseTemplateFromContent(content);
  return fromContent ? [fromContent] : [];
}

export function stripTemplateJsonFromContent(content: string): string {
  return content
    .replace(/【模版选择】[\s\S]*/g, '')
    .replace(/\{[\s\S]*?"templateId"[\s\S]*?\}/g, '')
    .trim();
}

export interface FormField {
  label: string;
  example: string;
  key: string;
}

/** 从 AI 编号列表回复解析表单字段 */
export function parseMagicPosterFormFields(content: string): FormField[] {
  const fields: FormField[] = [];
  const cleanContent = content.replace(/<think[\s\S]*?<\/think>/g, '');
  const lines = cleanContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\s*(\d+)\.\s+\*\*(.+?)\*\*\s*[（(]?\s*(必填|选填)?\s*[）)]?\s*$/);
    if (match) {
      const key = match[1];
      const label = match[2];
      let example = '';
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const exMatch = lines[j].match(/^\s*[-•]\s*(?:例如[：:]\s*)?(.+)$/);
        if (exMatch) {
          example = exMatch[1].trim();
          break;
        }
      }
      fields.push({ label, example, key });
    }
  }
  return fields;
}

const MAGIC_POSTER_STORAGE_KEY = 'magic_poster_chat_state';

export function loadMagicPosterChatState(): {
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; formFields?: FormField[] }>;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  phase: string;
} | null {
  try {
    const raw = localStorage.getItem(MAGIC_POSTER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const MAX_POSTER_MESSAGES = 50;
const MAX_POSTER_HISTORY = 40;
const MAX_POSTER_STORAGE_BYTES = 2 * 1024 * 1024;

export function saveMagicPosterChatState(state: {
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; formFields?: FormField[] }>;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  phase: string;
}): void {
  try {
    const trimmed = {
      ...state,
      messages: state.messages.slice(-MAX_POSTER_MESSAGES),
      history: state.history.slice(-MAX_POSTER_HISTORY),
    };
    let payload = JSON.stringify(trimmed);
    if (payload.length > MAX_POSTER_STORAGE_BYTES) {
      const compact = {
        phase: trimmed.phase,
        messages: trimmed.messages.slice(-20),
        history: trimmed.history.slice(-20),
      };
      payload = JSON.stringify(compact);
    }
    localStorage.setItem(MAGIC_POSTER_STORAGE_KEY, payload);
  } catch { /* ignore */ }
}
