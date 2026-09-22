/** 前端隐藏的视频模型 ID（可由后端配置扩展） */
export const EXCLUDED_VIDEO_MODEL_IDS = [
  'ep-20260321212919-vfr2q',
  'video-01-higher',
  'seedance-lite-2-0',
  'video-01',
] as const;

export const EXCLUDED_VIDEO_MODELS = new Set<string>(EXCLUDED_VIDEO_MODEL_IDS);
