/**
 * 模型简短名称映射
 * 与 AIImageNode.tsx 中的 IMAGE_MODEL_PRESETS 保持同步
 * 用于任务队列等位置显示简短模型名，而非全称
 *
 * 注：为统一显示原始名称，以下映射已恢复为完整原名，
 * 不再使用缩写代号（如 AG3/SENXT1/STEXT2/SD5 Pro 等）。
 */
const MODEL_SHORT_LABELS: Record<string, string> = {
  'doubao-seedream-5-0-lite': '豆包 Seedream 5.0 Lite',
  'doubao-seedream-5-0-pro': '豆包 Seedream 5.0 Pro',
  'image-01': 'MiniMax Image-01',
  'Wan2.7_image': 'Wan2.7 (小天)',
  'image-eraser': '擦除',
  'image-upscaler': '高清化',
  'image-remove-background': '去背景',
};

/**
 * 根据 modelId 获取简短模型名
 * 优先匹配完整 ID，其次尝试小写匹配，最后回退到原名
 */
export function getModelShortLabel(modelId: string | undefined, fallbackName?: string): string {
  if (!modelId) return fallbackName || '';
  if (MODEL_SHORT_LABELS[modelId]) return MODEL_SHORT_LABELS[modelId];
  const lower = modelId.toLowerCase();
  for (const key of Object.keys(MODEL_SHORT_LABELS)) {
    if (key.toLowerCase() === lower) return MODEL_SHORT_LABELS[key];
  }
  return fallbackName || modelId;
}
