export interface VideoPricingContext {
  hasVideoInput?: boolean;
  generateAudio?: boolean;
  generationMode?: string;
}

function resolutionKey(resolution: string): '480p' | '720p' | '1080p' {
  const value = resolution.toLowerCase();
  if (value.includes('480')) return '480p';
  if (value.includes('1080') || value.includes('2k') || value === 'large') return '1080p';
  return '720p';
}

export function getConfiguredVideoRate(
  modelId: string,
  resolution: string,
  context: VideoPricingContext = {}
): number | null {
  const model = modelId.toLowerCase();
  const res = resolutionKey(resolution);
  const hasVideo = context.hasVideoInput === true || context.generationMode === 'video_to_video';
  const hasAudio = context.generateAudio === true;

  if (model.includes('seedance-2-mini')) return res === '480p' ? (hasVideo ? 26.4 : 40.8) : (hasVideo ? 54 : 88.8);
  if (model.includes('seedance-2-fast')) return res === '480p' ? (hasVideo ? 39.6 : 67.2) : (hasVideo ? 87.6 : 144);
  if (model.includes('seedance-2') || model.includes('seedance-2-0')) return res === '480p' ? (hasVideo ? 49.2 : 82.8) : (hasVideo ? 109.2 : 178.8);
  if (model.includes('seedance-1-5-pro') || model.includes('seedance-1.5-pro')) {
    if (res === '1080p') return hasAudio ? 64.8 : 32.4;
    if (res === '480p') return hasAudio ? 15.6 : 7.2;
    return hasAudio ? 30 : 15.6;
  }
  if (model.includes('happyhorse')) return res === '1080p' ? 126 : 98.4;
  if (model.includes('kling-v3-turbo') || model.includes('kling-3.0-turbo') || model.includes('kling-3-0-turbo') || model.includes('kling/v3-turbo')) return res === '1080p' ? 98.4 : 78;
  if (model.includes('kling-3-0') || model.includes('kling-3.0') || model.includes('kling/kling-3-0')) {
    if (res === '1080p') return hasAudio ? 117.6 : 78;
    return hasAudio ? 87.6 : 61.2;
  }

  const fixedRates: Array<[string, number]> = [
    ['video-upscale', 12], ['video_upscaling', 12], ['package_1.0', 2.4],
    ['digital_humans', 2.4], ['video_omni', 120], ['video_vidu', 120],
    ['google_omni', 12], ['wan2.7', 36], ['sora2', 12],
  ];
  return fixedRates.find(([alias]) => model.includes(alias))?.[1] ?? null;
}
export function calculateConfiguredVideoPoints(
  modelId: string,
  resolution: string,
  durationSeconds: number,
  context: VideoPricingContext = {}
): number | null {
  const rate = getConfiguredVideoRate(modelId, resolution, context);
  return rate === null ? null : Math.ceil(rate * durationSeconds);
}