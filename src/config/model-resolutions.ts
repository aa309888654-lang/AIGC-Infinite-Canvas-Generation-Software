/**
 * 模型分辨率配置
 *
 * 只放模型 API 可直接请求的尺寸或档位。后处理超分、下载端放大不放在这里，
 * 避免节点 UI 给出看似可选但后端会失败的尺寸。
 */

export interface ModelResolution {
  value: string;
  label: string;
  aspectRatio: string;
}

export interface ModelResolutionConfig {
  modelId: string | string[];
  supportedResolutions: ModelResolution[];
}

const MINIMAX_IMAGE_01: ModelResolution[] = [
  { value: '1:1', label: '1:1 正方形', aspectRatio: '1:1' },
  { value: '16:9', label: '16:9 宽屏', aspectRatio: '16:9' },
  { value: '9:16', label: '9:16 竖屏', aspectRatio: '9:16' },
  { value: '4:3', label: '4:3 横图', aspectRatio: '4:3' },
  { value: '3:4', label: '3:4 竖图', aspectRatio: '3:4' },
  { value: '3:2', label: '3:2 横图', aspectRatio: '3:2' },
  { value: '2:3', label: '2:3 竖图', aspectRatio: '2:3' },
  { value: '21:9', label: '21:9 超宽屏', aspectRatio: '21:9' },
];

const SEEDREAM_5_LITE: ModelResolution[] = [
  { value: '2048x2048', label: '2K 2048×2048 (1:1)', aspectRatio: '1:1' },
  { value: '2304x1728', label: '2K 2304×1728 (4:3)', aspectRatio: '4:3' },
  { value: '1728x2304', label: '2K 1728×2304 (3:4)', aspectRatio: '3:4' },
  { value: '2848x1600', label: '2K 2848×1600 (16:9)', aspectRatio: '16:9' },
  { value: '1600x2848', label: '2K 1600×2848 (9:16)', aspectRatio: '9:16' },
  { value: '2496x1664', label: '2K 2496×1664 (3:2)', aspectRatio: '3:2' },
  { value: '1664x2496', label: '2K 1664×2496 (2:3)', aspectRatio: '2:3' },
  { value: '3136x1344', label: '2K 3136×1344 (21:9)', aspectRatio: '21:9' },
  { value: '3072x3072', label: '3K 3072×3072 (1:1)', aspectRatio: '1:1' },
  { value: '3456x2592', label: '3K 3456×2592 (4:3)', aspectRatio: '4:3' },
  { value: '2592x3456', label: '3K 2592×3456 (3:4)', aspectRatio: '3:4' },
  { value: '4096x2304', label: '3K/4K宽 4096×2304 (16:9)', aspectRatio: '16:9' },
  { value: '2304x4096', label: '3K/4K高 2304×4096 (9:16)', aspectRatio: '9:16' },
  { value: '3744x2496', label: '3K 3744×2496 (3:2)', aspectRatio: '3:2' },
  { value: '2496x3744', label: '3K 2496×3744 (2:3)', aspectRatio: '2:3' },
  { value: '4704x2016', label: '3K 4704×2016 (21:9)', aspectRatio: '21:9' },
  { value: '4096x4096', label: '4K 4096×4096 (1:1)', aspectRatio: '1:1' },
  { value: '4704x3520', label: '4K 4704×3520 (4:3)', aspectRatio: '4:3' },
  { value: '3520x4704', label: '4K 3520×4704 (3:4)', aspectRatio: '3:4' },
  { value: '5504x3040', label: '4K 5504×3040 (16:9)', aspectRatio: '16:9' },
  { value: '3040x5504', label: '4K 3040×5504 (9:16)', aspectRatio: '9:16' },
  { value: '4992x3328', label: '4K 4992×3328 (3:2)', aspectRatio: '3:2' },
  { value: '3328x4992', label: '4K 3328×4992 (2:3)', aspectRatio: '2:3' },
  { value: '6240x2656', label: '4K 6240×2656 (21:9)', aspectRatio: '21:9' },
];

const SEEDREAM_5_PRO: ModelResolution[] = [
  { value: '1024x1024', label: '1K 1024×1024 (1:1)', aspectRatio: '1:1' },
  { value: '1152x864', label: '1K 1152×864 (4:3)', aspectRatio: '4:3' },
  { value: '864x1152', label: '1K 864×1152 (3:4)', aspectRatio: '3:4' },
  { value: '1424x800', label: '1K 1424×800 (16:9)', aspectRatio: '16:9' },
  { value: '800x1424', label: '1K 800×1424 (9:16)', aspectRatio: '9:16' },
  { value: '2048x2048', label: '2K 2048×2048 (1:1)', aspectRatio: '1:1' },
  { value: '2368x1776', label: '2K 2368×1776 (4:3)', aspectRatio: '4:3' },
  { value: '1776x2368', label: '2K 1776×2368 (3:4)', aspectRatio: '3:4' },
  { value: '2816x1584', label: '2K 2816×1584 (16:9)', aspectRatio: '16:9' },
  { value: '1584x2816', label: '2K 1584×2816 (9:16)', aspectRatio: '9:16' },
];

const SEEDREAM_4_5: ModelResolution[] = [
  { value: '2048x2048', label: '2K 2048×2048 (1:1)', aspectRatio: '1:1' },
  { value: '2304x1728', label: '2K 2304×1728 (4:3)', aspectRatio: '4:3' },
  { value: '1728x2304', label: '2K 1728×2304 (3:4)', aspectRatio: '3:4' },
  { value: '2560x1440', label: '2K 2560×1440 (16:9)', aspectRatio: '16:9' },
  { value: '1440x2560', label: '2K 1440×2560 (9:16)', aspectRatio: '9:16' },
  { value: '2496x1664', label: '2K 2496×1664 (3:2)', aspectRatio: '3:2' },
  { value: '1664x2496', label: '2K 1664×2496 (2:3)', aspectRatio: '2:3' },
  { value: '3024x1296', label: '2K 3024×1296 (21:9)', aspectRatio: '21:9' },
  { value: '4096x4096', label: '4K 4096×4096 (1:1)', aspectRatio: '1:1' },
  { value: '4096x2304', label: '4K 4096×2304 (16:9)', aspectRatio: '16:9' },
  { value: '2304x4096', label: '4K 2304×4096 (9:16)', aspectRatio: '9:16' },
];

export const MODEL_RESOLUTION_CONFIGS: ModelResolutionConfig[] = [
  {
    modelId: ['minimax-image', 'image-01', 'image_01'],
    supportedResolutions: MINIMAX_IMAGE_01,
  },
  {
    modelId: [
      'doubao-seedream-5-0-lite',
      'doubao-seedream-5-0-260128',
      'doubao-seedream-5-0-lite-260128',
      'doubao-seedream-5.0-lite',
      'seedream-5-0-lite',
      'seedream_5_lite',
      'seedream-v5.0-lite',
    ],
    supportedResolutions: SEEDREAM_5_LITE,
  },
  {
    modelId: [
      'doubao-seedream-5-0-pro',
      'doubao-seedream-5-0-pro-260628',
      'doubao-seedream-5.0-pro',
      'seedream-5-0-pro',
      'seedream-5.0-pro',
    ],
    supportedResolutions: SEEDREAM_5_PRO,
  },
  {
    modelId: [
      'doubao-seedream-4-5',
      'doubao-seedream-4.5',
      'seedream-4-5',
      'seedream-4.5',
      'seedream-4',
      'seedream-4.0',
      'seedream',
    ],
    supportedResolutions: SEEDREAM_4_5,
  },
];

export const DEFAULT_RESOLUTIONS: ModelResolution[] = [
  { value: '1024x1024', label: '1024×1024 (1:1)', aspectRatio: '1:1' },
  { value: '1344x768', label: '1344×768 (16:9)', aspectRatio: '16:9' },
  { value: '768x1344', label: '768×1344 (9:16)', aspectRatio: '9:16' },
  { value: '1024x768', label: '1024×768 (4:3)', aspectRatio: '4:3' },
  { value: '768x1024', label: '768×1024 (3:4)', aspectRatio: '3:4' },
  { value: '1536x1024', label: '1536×1024 (3:2)', aspectRatio: '3:2' },
  { value: '1024x1536', label: '1024×1536 (2:3)', aspectRatio: '2:3' },
  { value: '1440x640', label: '1440×640 (21:9)', aspectRatio: '21:9' },
];

/**
 * 根据模型ID获取支持的分辨率列表。
 */
export function getModelSupportedResolutions(modelId: string): ModelResolution[] {
  const normalized = modelId.trim();

  for (const config of MODEL_RESOLUTION_CONFIGS) {
    if (typeof config.modelId === 'string') {
      if (config.modelId === normalized) return config.supportedResolutions;
    } else if (config.modelId.includes(normalized)) {
      return config.supportedResolutions;
    }
  }

  const lowerModelId = normalized.toLowerCase();
  for (const config of MODEL_RESOLUTION_CONFIGS) {
    const ids = typeof config.modelId === 'string' ? [config.modelId] : config.modelId;
    if (ids.some((id) => lowerModelId.includes(id.toLowerCase()))) {
      return config.supportedResolutions;
    }
  }

  return DEFAULT_RESOLUTIONS;
}
