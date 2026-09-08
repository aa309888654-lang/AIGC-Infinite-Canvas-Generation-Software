export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

const FULL_FRAME_CROP: CropRegion = {
  x: 0.5,
  y: 0.5,
  width: 1,
  height: 1,
  rotation: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeCropRegion(value: unknown): CropRegion {
  if (!value || typeof value !== 'object') return FULL_FRAME_CROP;
  const region = value as Partial<CropRegion>;
  if (
    !Number.isFinite(region.x) ||
    !Number.isFinite(region.y) ||
    !Number.isFinite(region.width) ||
    !Number.isFinite(region.height) ||
    !Number.isFinite(region.rotation)
  ) {
    return FULL_FRAME_CROP;
  }

  const width = clamp(Number(region.width), 0.1, 1);
  const height = clamp(Number(region.height), 0.1, 1);
  return {
    x: clamp(Number(region.x), width / 2, 1 - width / 2),
    y: clamp(Number(region.y), height / 2, 1 - height / 2),
    width,
    height,
    rotation: Number(region.rotation),
  };
}

export function serializeCropRegion(region: CropRegion): Record<string, unknown> {
  const normalized = normalizeCropRegion(region);
  return {
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
    rotation: normalized.rotation,
  };
}
