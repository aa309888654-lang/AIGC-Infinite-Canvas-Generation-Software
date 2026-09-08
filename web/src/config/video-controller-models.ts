import {
  OFFICIAL_VIDEO_MODEL_CAPABILITIES,
  type OfficialVideoModelCapability,
} from './video-model-capabilities';

// 海螺型号已被后端明确停用；其余官方视频模型都应在控制器中可选。
const DISABLED_VIDEO_MODEL_IDS = new Set([
  'viduq2',
  'viduq2-pro',
  'viduq2-pro-fast',
  'viduq2-turbo',
  'hailuo-video-2.3',
  'hailuo-2.3-fast-768p-6s',
  'hailuo-2.3-768p-6s',
]);

export function getVideoControllerModelPresets(): OfficialVideoModelCapability[] {
  return OFFICIAL_VIDEO_MODEL_CAPABILITIES.filter(
    (model) => !DISABLED_VIDEO_MODEL_IDS.has(model.id),
  );
}
