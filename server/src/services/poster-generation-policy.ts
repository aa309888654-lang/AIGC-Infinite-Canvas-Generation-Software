export const POSTER_GENERATION_POLICY = {
  // Provider/model selection is a server concern.  A browser can choose a
  // visual quality tier, but it must never select an upstream vendor or model.
  provider: 'ai-node-router',
  model: 'doubao-seedream-5-0-pro',
  textRenderMode: 'in-image',
  imageCount: 1,
} as const;

// 海报生成使用豆包 Seedream 5.0 Pro 国产模型
export const POSTER_PROVIDER_ORDER = ['doubao'] as const;

const MOBILE_MUSIC_COVER_POLICY = {
  provider: 'ai-node-router',
  model: 'doubao-seedream-5-0-pro',
  imageCount: 1,
} as const;

export function enforcePosterGenerationPolicy(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (payload.source === 'mobile-music-cover') {
    return {
      ...payload,
      provider: MOBILE_MUSIC_COVER_POLICY.provider,
      model: MOBILE_MUSIC_COVER_POLICY.model,
      imageCount: MOBILE_MUSIC_COVER_POLICY.imageCount,
      n: MOBILE_MUSIC_COVER_POLICY.imageCount,
    };
  }

  if (payload.source !== 'poster') return payload;

  return {
    ...payload,
    provider: POSTER_GENERATION_POLICY.provider,
    model: POSTER_GENERATION_POLICY.model,
    imageCount: POSTER_GENERATION_POLICY.imageCount,
    n: POSTER_GENERATION_POLICY.imageCount,
    posterCandidateCount: POSTER_GENERATION_POLICY.imageCount,
    textRenderMode: POSTER_GENERATION_POLICY.textRenderMode,
  };
}
