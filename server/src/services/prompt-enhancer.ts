/**
 * 全模型提示词增强器
 *
 * 为所有图片模型提供独立的提示词优化和负向提示词管理。
 *
 * 核心设计：
 * - 每个模型有专用的正向质量后缀和负向提示词
 * - 即使用户未点击"提示词优化"按钮，也会在传送到模型前做轻量规则优化
 * - 轻量优化：补充缺失的质量/光照/构图关键词，不改变用户原始意图
 *
 * 支持的模型分组：
 * - SENXT1 (sensenova-u1-fast): 信息图与写实场景
 * - STEXT2 (step-image-edit-2): 图片编辑与文生图
 * - AG3 (agnes-image-2.1-flash): 高信息密度图像
 * - DOUBAO_SEEDREAM (doubao-seedream-5-0-pro): 通用文生图
 * - SEEDREAM (doubao-seedream-5-0-lite): 写实与艺术
 * - WAN (Wan2.7_image): 万象文生图
 * - GENERIC: 未知模型的通用增强
 *
 * 已删除 (2026-07-20): 国外模型 NANO_BANANA / GROK / FLUX / MIDJOURNEY 已下线
 */

import logger from '../utils/logger';

/** 增强结果 */
export interface EnhancedPrompt {
  /** 增强后的正向提示词 */
  prompt: string;
  /** 增强后的负向提示词 */
  negativePrompt: string;
  /** 是否进行了增强 */
  enhanced: boolean;
}

export interface EnhancePromptOptions {
  /** 海报 in-image 模式需要模型直接渲染文字，不能再追加禁止文字类负向词 */
  preserveText?: boolean;
}

// ============================================================
// 模型专用负向提示词
// ============================================================

/** SENXT1 专用负向提示词 */
const NEG_SENXT1 = 'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra hands, missing hands, extra arms, missing arms, deformed arms, twisted arms, broken arms, abnormal limbs, extra limbs, missing limbs, extra legs, missing legs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, deformed eyes, bad teeth, deformed ears, unnatural facial expression, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, compression artifacts, JPEG artifacts, banding, watermark, text, logo, signature, copyright, brand name, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, symmetrical errors, oversaturated, undersaturated, unnatural colors, color cast, washed out, dull colors';

/** STEXT2 专用负向提示词 */
const NEG_STEXT2 = 'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural facial expression, deformed features, unwanted changes, inconsistent style, style drift, lost details, blurred details, over-smoothed texture, color shift, hue distortion, tone mismatch, low quality, blurry, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, compression artifacts, banding, color banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, duplicate elements, cloned regions, tiling artifacts, seams, stitching marks, edge artifacts, oversharpened, over-processed, artificial look, plastic skin, waxy texture, porcelain skin, doll-like';

/** AG3 专用负向提示词（嵌入正向提示词） */
const NEG_AG3 = 'extra fingers, missing fingers, deformed fingers, malformed hands, bad anatomy, deformed body, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural expression, low quality, blurry, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored errors, oversaturated, unnatural colors, color cast, washed out, compression artifacts, JPEG artifacts, banding';

/** 豆包 Seedream 5.0 Pro 专用负向提示词 */
const NEG_GPT_IMAGE = 'extra fingers, missing fingers, deformed fingers, malformed hands, bad anatomy, deformed body, distorted face, asymmetrical face, bad eyes, crossed eyes, low quality, blurry, pixelated, noisy, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, oversaturated, unnatural colors, washed out, overexposed, underexposed, bad lighting, harsh shadows';

/** Seedream 5.0 专用负向提示词 */
const NEG_SEEDREAM = 'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, deformed ears, unnatural facial expression, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, compression artifacts, banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, oversaturated, undersaturated, unnatural colors, color cast, washed out, dull colors, plastic skin, waxy texture, doll-like, over-processed';

/** Wan2.7 专用负向提示词 */
const NEG_WAN = 'extra fingers, missing fingers, deformed fingers, malformed hands, bad anatomy, deformed body, distorted face, asymmetrical face, bad eyes, crossed eyes, low quality, blurry, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, watermark, text, logo, signature, copyright, cropped, out of frame, bad composition, oversaturated, unnatural colors, washed out, duplicate, cloned';

// 已删除 (2026-07-20): 国外模型 NEG_NANO_BANANA / NEG_GROK / NEG_FLUX / NEG_MIDJOURNEY 已下线

/** 通用负向提示词（未知模型） */
const NEG_GENERIC = 'extra fingers, missing fingers, deformed fingers, malformed hands, bad anatomy, deformed body, distorted face, asymmetrical face, bad eyes, crossed eyes, low quality, blurry, pixelated, noisy, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, oversaturated, unnatural colors, washed out';

// ============================================================
// 模型专用正向质量后缀
// ============================================================

const SUFFIX_SENXT1 = 'high detail, sharp focus, professional composition, cinematic lighting, 8K quality, photorealistic';
const SUFFIX_STEXT2 = 'high detail, sharp focus, natural lighting, professional quality, coherent style, fine texture detail';
const SUFFIX_AG3 = 'high visual density, rich detail, sharp focus, professional composition, cinematic lighting, high information density, ultra-detailed';
const SUFFIX_GPT_IMAGE = 'high quality, detailed, sharp focus, professional composition, natural lighting, 4K resolution';
const SUFFIX_SEEDREAM = 'high detail, sharp focus, cinematic lighting, professional composition, photorealistic, 8K quality, rich texture';
const SUFFIX_WAN = 'high detail, sharp focus, professional composition, natural lighting, rich texture, 4K quality';
// 已删除 (2026-07-20): 国外模型 SUFFIX_NANO_BANANA / SUFFIX_GROK / SUFFIX_FLUX / SUFFIX_MIDJOURNEY 已下线
const SUFFIX_GENERIC = 'high detail, sharp focus, professional composition, good lighting, high quality';

// ============================================================
// 辅助函数
// ============================================================

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

function appendIfMissing(original: string, suffix: string, checkKeywords: string[]): string {
  if (containsAny(original, checkKeywords)) return original;
  return `${original.trim()}, ${suffix}`;
}

const TEXT_NEGATIVE_TERMS = new Set([
  'text',
  'letters',
  'words',
  'chinese characters',
  'english letters',
  'numbers',
  'digits',
  'caption',
  'label',
  'labels',
  'typography',
  'brand name',
  'company name',
  'event name',
  'location name',
  'names',
]);

function stripTextNegativeTerms(negativePrompt: string): string {
  const seen = new Set<string>();
  return negativePrompt
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean)
    .filter((term) => {
      const normalized = term.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (TEXT_NEGATIVE_TERMS.has(normalized)) return false;
      if (normalized.startsWith('no ') && TEXT_NEGATIVE_TERMS.has(normalized.slice(3))) return false;
      if (normalized.includes('letters') || normalized.includes('words') || normalized.includes('digits')) return false;
      if (normalized.includes('readable') && normalized.includes('text')) return false;
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join(', ');
}

// ============================================================
// 模型识别
// ============================================================

type ModelGroup =
  | 'sensenova-u1-fast'
  | 'step-image-edit-2'
  | 'agnes-image-2.1-flash'
  | 'doubao-seedream-5-0-pro'
  | 'seedream'
  | 'wan'
  | 'generic';
// 已删除 (2026-07-20): 国外模型 nano-banana / grok / flux / midjourney 分组已下线

function resolveModelGroup(model: string | undefined, provider: string | undefined): ModelGroup {
  const m = (model || '').toLowerCase();
  const p = (provider || '').toLowerCase();

  if (m === 'sensenova-u1-fast' || m.startsWith('sensenova-u1') || p === 'sensenova') return 'sensenova-u1-fast';
  if (m === 'step-image-edit-2' || p === 'stepfun') return 'step-image-edit-2';
  if (m === 'agnes-image-2.1-flash' || p === 'agnes') return 'agnes-image-2.1-flash';
  if (m === 'doubao-seedream-5-0-pro' || m === 'doubao-seedream-5-0-lite' || m.startsWith('doubao-seedream')) return 'doubao-seedream-5-0-pro';
  if (m.includes('seedream') || m.includes('doubao')) return 'seedream';
  // 已删除 (2026-07-20): 国外模型 nano-banana / grok / flux / midjourney 检测已下线
  if (m.includes('wan') && m.includes('image')) return 'wan';
  return 'generic';
}

function getNegativePrompt(group: ModelGroup): string {
  switch (group) {
    case 'sensenova-u1-fast': return NEG_SENXT1;
    case 'step-image-edit-2': return NEG_STEXT2;
    case 'agnes-image-2.1-flash': return NEG_AG3;
    case 'doubao-seedream-5-0-pro': return NEG_GPT_IMAGE;
    case 'seedream': return NEG_SEEDREAM;
    case 'wan': return NEG_WAN;
    // 已删除 (2026-07-20): 国外模型 nano-banana / grok / flux / midjourney 分支已下线
    default: return NEG_GENERIC;
  }
}

function getQualitySuffix(group: ModelGroup): string {
  switch (group) {
    case 'sensenova-u1-fast': return SUFFIX_SENXT1;
    case 'step-image-edit-2': return SUFFIX_STEXT2;
    case 'agnes-image-2.1-flash': return SUFFIX_AG3;
    case 'doubao-seedream-5-0-pro': return SUFFIX_GPT_IMAGE;
    case 'seedream': return SUFFIX_SEEDREAM;
    case 'wan': return SUFFIX_WAN;
    // 已删除 (2026-07-20): 国外模型 nano-banana / grok / flux / midjourney 分支已下线
    default: return SUFFIX_GENERIC;
  }
}

/** 判断模型是否原生支持 negative_prompt 参数 */
function supportsNegativePrompt(group: ModelGroup): boolean {
  // AG3 API 不支持 negative_prompt 参数
  return group !== 'agnes-image-2.1-flash';
}

// ============================================================
// 轻量自动优化（规则引擎，非 LLM）
// ============================================================

/**
 * 轻量提示词优化 — 即使用户未点击"提示词优化"按钮也会执行
 *
 * 策略：
 * 1. 补充质量关键词（如缺失）
 * 2. 补充光照关键词（如缺失）
 * 3. 补充构图关键词（如缺失）
 * 4. 为支持的模型补充默认负向提示词（如用户未提供）
 * 5. 不改变用户原始意图，只做增量补充
 */
function lightOptimize(
  prompt: string,
  negativePrompt: string,
  group: ModelGroup,
  options: EnhancePromptOptions = {},
): EnhancedPrompt {
  let enhanced = prompt.trim();
  const suffix = getQualitySuffix(group);
  const defaultNegative = getNegativePrompt(group);

  // 1. 补充质量关键词
  enhanced = appendIfMissing(
    enhanced,
    suffix,
    ['high detail', 'sharp focus', 'high quality', '8k', '4k', 'ultra-detailed', '高清', '高质量', '写实']
  );

  // 2. 补充光照关键词
  enhanced = appendIfMissing(
    enhanced,
    'cinematic lighting, professional color grading',
    ['lighting', '光照', '光影', 'light', '光线']
  );

  // 3. 补充构图关键词
  enhanced = appendIfMissing(
    enhanced,
    'professional composition, balanced layout',
    ['composition', '构图', 'layout', 'framing', '布局']
  );

  // 4. 模型专用增强
  switch (group) {
    case 'agnes-image-2.1-flash':
      // AG3: 补充视觉层次 + 嵌入负向提示词
      enhanced = appendIfMissing(
        enhanced,
        'rich visual hierarchy, layered composition, deep depth of field',
        ['hierarchy', 'layered', '层次', 'depth', '景深']
      );
      if (!containsAny(enhanced, ['avoid', 'no ', 'without ', '不要', '避免'])) {
        enhanced = `${enhanced}. Avoid: ${negativePrompt?.trim() || defaultNegative}`;
      }
      return {
        prompt: enhanced,
        negativePrompt: '', // AG3 不支持 negative_prompt 参数
        enhanced: enhanced !== prompt.trim(),
      };

    case 'step-image-edit-2':
      // STEXT2: 补充风格一致性 + 纹理细节
      enhanced = appendIfMissing(
        enhanced,
        'coherent style, consistent lighting, natural color transition',
        ['coherent', 'consistent', '一致', '协调']
      );
      enhanced = appendIfMissing(
        enhanced,
        'fine texture detail, preserved fine details',
        ['texture', '纹理', 'detail', '细节']
      );
      break;
  }

  // 5. 负向提示词处理
  let finalNegative = negativePrompt?.trim() || '';
  if (!finalNegative) {
    finalNegative = defaultNegative;
  } else if (supportsNegativePrompt(group) && !containsAny(finalNegative, ['extra fingers', 'bad anatomy', 'low quality'])) {
    // 用户提供了负向词但缺少基本质量约束，补充
    const textGuard = options.preserveText ? '' : ', text';
    finalNegative = `${finalNegative}, extra fingers, missing fingers, deformed fingers, bad anatomy, low quality, blurry, watermark${textGuard}, logo`;
  }
  if (options.preserveText) {
    finalNegative = stripTextNegativeTerms(finalNegative);
  }

  return {
    prompt: enhanced,
    negativePrompt: supportsNegativePrompt(group) ? finalNegative : '',
    enhanced: enhanced !== prompt.trim() || !negativePrompt?.trim(),
  };
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 对提示词进行模型专用增强
 *
 * 即使用户未点击"提示词优化"按钮，此函数也会在传送到模型前
 * 对提示词做轻量规则优化，补充缺失的质量/光照/构图关键词。
 *
 * @param prompt 用户原始正向提示词
 * @param negativePrompt 用户原始负向提示词（可为空）
 * @param model 模型名称
 * @param provider 提供商名称
 * @returns 增强后的提示词
 */
export function enhancePromptForModel(
  prompt: string,
  negativePrompt: string | undefined,
  model: string | undefined,
  provider: string | undefined,
  options: EnhancePromptOptions = {},
): EnhancedPrompt {
  const group = resolveModelGroup(model, provider);
  const originalPrompt = prompt.trim();
  const originalNegative = negativePrompt?.trim() || '';

  const result = lightOptimize(originalPrompt, originalNegative, group, options);

  if (result.enhanced) {
    logger.info(
      `[PromptEnhancer] ${group} (${model || provider || 'unknown'}) 提示词增强: ` +
      `prompt ${originalPrompt.length}->${result.prompt.length} chars, ` +
      `negativePrompt ${originalNegative.length}->${result.negativePrompt.length} chars`
    );
  }

  return result;
}
