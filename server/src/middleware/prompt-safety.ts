import { NextFunction, Request, Response } from 'express';
import {
  checkPromptSafety,
  checkPromptSafetyForImageGeneration,
  PromptFirewallResult,
} from '../services/prompt-firewall';
import { logger } from '../utils/logger';

type PromptSafetyScanValue = string | number | boolean | null | undefined | PromptSafetyScanValue[] | {
  [key: string]: PromptSafetyScanValue;
};

export interface PromptSafetyFinding extends PromptFirewallResult {
  fieldPath: string;
  valuePreview: string;
}

export interface PromptSafetyScanOptions {
  maxDepth?: number;
  maxVisitedValues?: number;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH']);

const PROMPT_FIELD_NAMES = new Set([
  'prompt',
  'systemprompt',
  'system_prompt',
  'preprompt',
  'pre_prompt',
  'prompttext',
  'previewtext',
  'message',
  'messages',
  'history',
  'content',
  'text',
  'input',
  'instruction',
  'query',
  'question',
  'answer',
  'script',
  'story',
  'lyrics',
  'lrc',
  'title',
  'subtitle',
  'body',
  'description',
  'caption',
  'dialogue',
  'dialogues',
  'narration',
  'style',
  'tone',
  'mood',
  'emotion',
  'genre',
  'theme',
  'topic',
  'subject',
  'scene',
  'setting',
  'appearance',
  'outfit',
  'character',
  'characters',
  'visual',
  'visualdirection',
  'visual_direction',
  'herosubject',
  'hero_subject',
  'composition',
  'materials',
  'lighting',
  'notes',
  'usagecontext',
  'functiontext',
  'slogan',
  'brand',
  'product',
  'templatestory',
  'templatename',
  'templatearea',
  'templatebeast',
  'musictitle',
  'songtitle',
  'usergoal',
  'user_goal',
  'maintitle',
  'main_title',
  'mainimageprompt',
  'main_image_prompt',
  'scenedescription',
  'storyboard',
  'panels',
  'brief',
  'textblocks',
  'text_blocks',
  'musthave',
  'must_have',
  'mustavoid',
  'must_avoid',
  'benefits',
]);

const PROMPT_PARENT_FIELD_NAMES = new Set([
  'messages',
  'history',
  'dialogues',
  'panels',
  'brief',
  'textblocks',
  'text_blocks',
  'params',
  'parameters',
  'config',
  'data',
  'nodes',
  'edges',
  'payload',
  'body',
  'context',
  'metadata',
  'songinfo',
  'song_info',
]);

const NON_PROMPT_FIELD_NAMES = new Set([
  'id',
  'userid',
  'user_id',
  'taskid',
  'task_id',
  'sessionid',
  'session_id',
  'nodeid',
  'node_id',
  'model',
  'modelid',
  'model_id',
  'voiceid',
  'voice_id',
  'negativeprompt',
  'provider',
  'providerid',
  'provider_id',
  'url',
  'uri',
  'href',
  'endpoint',
  'image',
  'imageurl',
  'image_url',
  'images',
  'audiourl',
  'audio_url',
  'videourl',
  'video_url',
  'referenceimage',
  'reference_image',
  'referenceimages',
  'reference_images',
  'startimage',
  'start_image',
  'endimage',
  'end_image',
  'file',
  'filename',
  'file_name',
  'filepath',
  'file_path',
  'base64',
  'authorization',
  'token',
  'apikey',
  'api_key',
  'secret',
  'password',
]);

function normalizeFieldName(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

function pathChild(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

function pathIndex(parent: string, index: number): string {
  return `${parent || 'body'}[${index}]`;
}

function previewText(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > 120 ? `${compact.slice(0, 120)}...` : compact;
}

function isLikelyBinaryOrUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^data:(?:image|audio|video|application)\//i.test(trimmed)) return true;
  if (/^(?:https?:|blob:|file:|\/uploads\/|\/storage\/)/i.test(trimmed)) return true;

  // 大段 base64 / hex / UUID 列表不按提示词处理，避免扫描图片和文件载荷。
  if (trimmed.length > 512 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) return true;
  if (trimmed.length > 64 && /^[0-9a-f-]+$/i.test(trimmed)) return true;
  return false;
}

function isPromptLikeKey(key: string): boolean {
  return PROMPT_FIELD_NAMES.has(normalizeFieldName(key));
}

function isPromptParentKey(key: string): boolean {
  return PROMPT_PARENT_FIELD_NAMES.has(normalizeFieldName(key));
}

function shouldScanString(key: string, path: string, value: string, promptContext: boolean): boolean {
  const normalizedKey = normalizeFieldName(key);
  if (NON_PROMPT_FIELD_NAMES.has(normalizedKey)) return false;
  if (isLikelyBinaryOrUrl(value)) return false;
  if (isPromptLikeKey(key) || promptContext) return true;

  // 常见 OpenAI/LLM messages 数组: body.messages[0].content
  if (/(?:messages|history|dialogues|panels)\[\d+\]\.(?:content|text|prompt|description|dialogue|narration)$/i.test(path)) {
    return true;
  }
  return false;
}

export function scanPromptSafety(
  payload: PromptSafetyScanValue,
  options: PromptSafetyScanOptions = {},
): PromptSafetyFinding | null {
  const maxDepth = options.maxDepth ?? 10;
  const maxVisitedValues = options.maxVisitedValues ?? 2000;
  let visitedValues = 0;
  const seen = new WeakSet<object>();
  const requestSource =
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    typeof (payload as Record<string, unknown>).source === 'string'
      ? String((payload as Record<string, unknown>).source)
      : undefined;

  function visit(value: PromptSafetyScanValue, path: string, key: string, depth: number, promptContext: boolean): PromptSafetyFinding | null {
    if (visitedValues > maxVisitedValues || depth > maxDepth) return null;
    visitedValues += 1;

    if (typeof value === 'string') {
      if (!shouldScanString(key, path, value, promptContext)) return null;
      const result =
        path === 'body.prompt'
          ? checkPromptSafetyForImageGeneration(value, requestSource)
          : checkPromptSafety(value);
      if (!result.passed) {
        return {
          ...result,
          fieldPath: path || key || 'body',
          valuePreview: previewText(value),
        };
      }
      return null;
    }

    if (!value || typeof value !== 'object') return null;
    if (seen.has(value)) return null;
    seen.add(value);

    // Skip safety scan for developer-authored system prompts (role === 'system')
    // System prompts are written by the application developers, not user input,
    // and may legitimately reference blocked keywords in negative instructions.
    if (
      typeof (value as Record<string, unknown>).role === 'string' &&
      ((value as Record<string, unknown>).role as string).toLowerCase() === 'system'
    ) {
      return null;
    }

    // The scan starts at a synthetic `body` root. Do not let that root turn every
    // string field (model IDs, voice IDs, formats) into user-authored prompt text.
    const nextPromptContext =
      promptContext || (depth > 0 && (isPromptParentKey(key) || isPromptLikeKey(key)));

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const finding = visit(value[index], pathIndex(path, index), key, depth + 1, nextPromptContext);
        if (finding) return finding;
      }
      return null;
    }

    for (const [childKey, childValue] of Object.entries(value)) {
      const finding = visit(
        childValue as PromptSafetyScanValue,
        pathChild(path, childKey),
        childKey,
        depth + 1,
        nextPromptContext,
      );
      if (finding) return finding;
    }
    return null;
  }

  return visit(payload, 'body', 'body', 0, false);
}

export function promptSafetyMiddleware(options: PromptSafetyScanOptions = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
      return next();
    }

    const finding = scanPromptSafety(req.body as PromptSafetyScanValue, options);
    if (!finding) {
      return next();
    }

    logger.warn('[prompt-safety] 请求被违规提示词防火墙拦截', {
      method: req.method,
      path: req.originalUrl || req.path,
      userId: req.userId,
      fieldPath: finding.fieldPath,
      category: finding.category,
      matchedKeyword: finding.matchedKeyword,
      valuePreview: finding.valuePreview,
    });

    res.status(400).json({
      success: false,
      error: finding.message,
      code: 'PROMPT_VIOLATION',
      category: finding.category,
      matchedKeyword: finding.matchedKeyword,
      fieldPath: finding.fieldPath,
    });
  };
}

export const promptSafety = promptSafetyMiddleware();
