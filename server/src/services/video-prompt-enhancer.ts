/**
 * 全视频模型提示词增强器
 *
 * 为所有视频模型提供独立的提示词优化和负向提示词管理。
 * 即使用户未点击"提示词优化"按钮，也会在传送到模型前做轻量规则优化。
 *
 * 支持的视频模型分组：
 * - DOUBAO_SEEDANCE (doubao-seedance-*): 豆包视频，不支持 negative_prompt
 * - VIDU (viduq2/viduq3): Vidu 视频，不支持 negative_prompt
 * - WAN (Wan2.6/Wan2.7): 万象视频，支持 negative_prompt
 * - WUYINKEJI_GENERIC (video_vidu/video_omni/video_seedance): 小天通用视频
 * - GENERIC: 未知模型通用增强
 *
 * 已删除 (2026-07-20): 国外模型 GOOGLE_OMNI / SORA / GROK 已下线
 */

import logger from '../utils/logger';

export interface VideoEnhancedPrompt {
  prompt: string;
  negativePrompt: string;
  enhanced: boolean;
}

// ============================================================
// 模型专用负向提示词
// ============================================================

const NEG_DOUBAO = 'flickering, jittery motion, morphing artifacts, warped faces, distorted bodies, extra limbs, deformed hands, bad anatomy, low quality, blurry frames, pixelated, noisy, watermark, text, logo, overexposed, underexposed, bad lighting, inconsistent lighting, stuttering animation';

const NEG_VIDU = 'flickering, jittery motion, morphing artifacts, warped faces, distorted bodies, extra limbs, deformed hands, bad anatomy, low quality, blurry frames, pixelated, noisy, watermark, text, logo, overexposed, underexposed, bad lighting, stuttering animation';

const NEG_WAN = 'flickering, jittery motion, unnatural movement, morphing artifacts, warped faces, distorted bodies, extra limbs, missing limbs, deformed hands, bad anatomy, low quality, blurry frames, pixelated, noisy, grainy, watermark, text, logo, signature, copyright, overexposed, underexposed, bad lighting, inconsistent lighting, flickering shadows, duplicate frames, stuttering animation';

// 已删除 (2026-07-20): 国外模型 NEG_GOOGLE_OMNI / NEG_SORA / NEG_GROK 已下线

const NEG_WUYINKEJI_GENERIC = 'flickering, jittery motion, morphing artifacts, warped faces, distorted bodies, extra limbs, deformed hands, bad anatomy, low quality, blurry frames, pixelated, noisy, watermark, text, logo, overexposed, underexposed, bad lighting, stuttering animation';

const NEG_GENERIC = 'flickering, jittery motion, morphing artifacts, warped faces, distorted bodies, extra limbs, deformed hands, bad anatomy, low quality, blurry frames, pixelated, noisy, watermark, text, logo, overexposed, underexposed, bad lighting, stuttering animation';

// ============================================================
// 模型专用正向质量后缀
// ============================================================

const SUFFIX_DOUBAO = 'cinematic motion, smooth animation, high quality video, professional cinematography, detailed textures, natural motion, coherent scene continuity';
const SUFFIX_VIDU = 'cinematic motion, smooth animation, high quality video, professional cinematography, detailed textures, natural motion, coherent lighting';
const SUFFIX_WAN = 'cinematic motion, smooth camera movement, high quality video, professional cinematography, 4K resolution, detailed textures, natural motion blur, coherent scene continuity, rich color grading';
// 已删除 (2026-07-20): 国外模型 SUFFIX_GOOGLE_OMNI / SUFFIX_SORA / SUFFIX_GROK 已下线
const SUFFIX_WUYINKEJI_GENERIC = 'cinematic motion, smooth animation, high quality video, professional cinematography, detailed textures, natural motion, coherent scene continuity';
const SUFFIX_GENERIC = 'cinematic motion, smooth animation, high quality video, professional cinematography, detailed textures';

// ============================================================
// 辅助函数
// ============================================================

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

function appendIfMissing(original: string, suffix: string, checkKeywords: string[]): string {
  if (containsAny(original, checkKeywords)) return original;
  return `${original.trim()}. ${suffix}`;
}

// ============================================================
// 模型识别
// ============================================================

type VideoModelGroup =
  | 'doubao-seedance'
  | 'vidu'
  | 'wan'
  | 'wuyinkeji-generic'
  | 'generic';
// 已删除 (2026-07-20): 国外模型 google-omni / sora / grok 分组已下线

function resolveVideoModelGroup(model: string | undefined, provider: string | undefined): VideoModelGroup {
  const m = (model || '').toLowerCase();
  const p = (provider || '').toLowerCase();

  if (m.includes('seedance') || m.includes('seedream') || m.includes('doubao')) return 'doubao-seedance';
  if (m.startsWith('vidu') || p === 'vidu') return 'vidu';
  if (m.includes('wan2')) return 'wan';
  // 已删除 (2026-07-20): 国外模型 google_omni / sora / grok 检测已下线
  if (m.startsWith('video_') || p === 'wuyinkeji') return 'wuyinkeji-generic';
  return 'generic';
}

function getVideoNegativePrompt(group: VideoModelGroup): string {
  switch (group) {
    case 'doubao-seedance': return NEG_DOUBAO;
    case 'vidu': return NEG_VIDU;
    case 'wan': return NEG_WAN;
    // 已删除 (2026-07-20): 国外模型 google-omni / sora / grok 分支已下线
    case 'wuyinkeji-generic': return NEG_WUYINKEJI_GENERIC;
    default: return NEG_GENERIC;
  }
}

function getVideoQualitySuffix(group: VideoModelGroup): string {
  switch (group) {
    case 'doubao-seedance': return SUFFIX_DOUBAO;
    case 'vidu': return SUFFIX_VIDU;
    case 'wan': return SUFFIX_WAN;
    // 已删除 (2026-07-20): 国外模型 google-omni / sora / grok 分支已下线
    case 'wuyinkeji-generic': return SUFFIX_WUYINKEJI_GENERIC;
    default: return SUFFIX_GENERIC;
  }
}

/** 判断模型是否原生支持 negative_prompt 参数 */
function videoSupportsNegativePrompt(group: VideoModelGroup): boolean {
  // Doubao V3、Vidu 官方 API 不支持 negative_prompt
  // 已删除 (2026-07-20): 国外模型 Google Omni / Sora 分支已下线
  return group === 'wan';
}

// ============================================================
// 轻量自动优化
// ============================================================

function lightOptimizeVideo(
  prompt: string,
  negativePrompt: string,
  group: VideoModelGroup
): VideoEnhancedPrompt {
  let enhanced = prompt.trim();
  const suffix = getVideoQualitySuffix(group);
  const defaultNegative = getVideoNegativePrompt(group);

  // 1. 补充视频质量关键词
  enhanced = appendIfMissing(
    enhanced,
    suffix,
    ['cinematic', 'high quality video', 'smooth motion', '4k', 'professional', '电影级', '高清', '高质量']
  );

  // 2. 补充运镜关键词
  enhanced = appendIfMissing(
    enhanced,
    'smooth camera movement, natural motion blur',
    ['camera movement', '运镜', '镜头移动', 'motion blur', '动态模糊']
  );

  // 3. 补充场景连续性关键词
  enhanced = appendIfMissing(
    enhanced,
    'coherent scene continuity, consistent lighting',
    ['continuity', 'consistent', '连续', '一致', '连贯']
  );

  // 4. 负向提示词处理
  let finalNegative = negativePrompt?.trim() || '';
  if (!finalNegative) {
    finalNegative = defaultNegative;
  } else if (videoSupportsNegativePrompt(group) && !containsAny(finalNegative, ['flickering', 'morphing', 'low quality', 'jittery'])) {
    finalNegative = `${finalNegative}, flickering, morphing artifacts, low quality, jittery motion, watermark, text, logo`;
  }

  return {
    prompt: enhanced,
    negativePrompt: videoSupportsNegativePrompt(group) ? finalNegative : '',
    enhanced: enhanced !== prompt.trim() || (!negativePrompt?.trim() && videoSupportsNegativePrompt(group)),
  };
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 对视频提示词进行模型专用增强
 *
 * 即使用户未点击"提示词优化"按钮，此函数也会在传送到模型前
 * 对提示词做轻量规则优化，补充缺失的视频质量/运镜/场景连续性关键词。
 */
export function enhanceVideoPromptForModel(
  prompt: string,
  negativePrompt: string | undefined,
  model: string | undefined,
  provider: string | undefined
): VideoEnhancedPrompt {
  const group = resolveVideoModelGroup(model, provider);
  const originalPrompt = prompt.trim();
  const originalNegative = negativePrompt?.trim() || '';

  const result = lightOptimizeVideo(originalPrompt, originalNegative, group);

  if (result.enhanced) {
    logger.info(
      `[VideoPromptEnhancer] ${group} (${model || provider || 'unknown'}) 提示词增强: ` +
      `prompt ${originalPrompt.length}->${result.prompt.length} chars, ` +
      `negativePrompt ${originalNegative.length}->${result.negativePrompt.length} chars`
    );
  }

  return result;
}
