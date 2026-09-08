export const POSTER_IMAGE_GENERATION_POINTS = 10;
export const POSTER_GENERATION_CREDIT_MULTIPLIER = 1;

// 豆包 Seedream 5.0 定价表 — 海报生成使用国产模型
const POSTER_MODEL_POINTS_MAP: Record<string, number> = {
  'doubao-seedream-5-0-lite': 30,
  'doubao-seedream-5-0-pro': 60,
};

const POSTER_PROVIDER_MODEL_POINTS_MAP: Record<string, number> = {
  'doubao:doubao-seedream-5-0-lite': 30,
  'doubao:doubao-seedream-5-0-pro': 60,
};

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
}

function resolvePosterModelBasePoints(provider: string, model: string): number {
  const normalizedProvider = String(provider || '').toLowerCase();
  const normalized = String(model || '').toLowerCase();
  const providerExact = POSTER_PROVIDER_MODEL_POINTS_MAP[`${normalizedProvider}:${normalized}`];
  if (providerExact) return providerExact;

  const exact = POSTER_MODEL_POINTS_MAP[normalized];
  if (exact) return exact;
  for (const key of Object.keys(POSTER_MODEL_POINTS_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return POSTER_MODEL_POINTS_MAP[key];
    }
  }
  return POSTER_IMAGE_GENERATION_POINTS;
}

export function resolvePosterImageBasePoints(
  provider: string,
  model: string,
  imageCount: number = 1,
): number | undefined {
  const count = normalizePositiveInteger(imageCount, 1);
  return resolvePosterModelBasePoints(provider, model) * count;
}

export function resolvePosterImageRequestPoints(options: {
  provider: string;
  model: string;
  imageCount?: number;
  candidateCount?: unknown;
}): number | undefined {
  return resolvePosterImageBasePoints(
    options.provider,
    options.model,
    options.imageCount,
  );
}
