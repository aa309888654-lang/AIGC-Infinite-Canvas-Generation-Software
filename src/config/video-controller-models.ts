import {
  OFFICIAL_VIDEO_MODEL_CAPABILITIES,
  type OfficialVideoModelCapability,
} from './video-model-capabilities';

// 保留用户指定的 Hailuo 2.3；旧 Q2 型号仍按后端停用状态隐藏。
const DISABLED_VIDEO_MODEL_IDS = new Set([
  'viduq2',
  'viduq2-pro',
  'viduq2-pro-fast',
  'viduq2-turbo',
]);

export function getVideoControllerModelPresets(): OfficialVideoModelCapability[] {
  return OFFICIAL_VIDEO_MODEL_CAPABILITIES.filter(
    (model) => !DISABLED_VIDEO_MODEL_IDS.has(model.id),
  );
}
