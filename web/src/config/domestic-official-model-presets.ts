export type DomesticOfficialMediaType = 'image' | 'video';

export interface DomesticOfficialModelPreset {
  id: string;
  mediaType: DomesticOfficialMediaType;
  displayName: string;
  provider: string;
  model: string;
  endpoint: string;
  protocol: 'native';
  modelOptions?: Array<{ id: string; label: string }>;
}

const PRESETS: DomesticOfficialModelPreset[] = [
  { id: 'wan-video', mediaType: 'video', displayName: '通义万相 Wan 视频', provider: 'wan', model: 'wan2.6-video', endpoint: 'https://dashscope.aliyuncs.com/api/v1', protocol: 'native' },
  { id: 'kling-video', mediaType: 'video', displayName: 'Kling 3.0 / 3.0 Omni', provider: 'kling', model: 'kling-3.0', endpoint: 'https://api-beijing.klingai.com', protocol: 'native' },
  { id: 'hailuo-video', mediaType: 'video', displayName: '海螺 Hailuo 视频', provider: 'hailuo', model: 'hailuo-02', endpoint: 'https://api.minimaxi.com/v1', protocol: 'native' },
  { id: 'doubao-seedance-video', mediaType: 'video', displayName: '豆包 Seedance 视频', provider: 'doubao', model: 'doubao-seedance-2-0', endpoint: 'https://ark.cn-beijing.volces.com/api/v3', protocol: 'native' },
  { id: 'vidu-video', mediaType: 'video', displayName: 'Vidu Q3 视频', provider: 'vidu', model: 'vidu-q3', endpoint: 'https://api.vidu.cn', protocol: 'native' },
  { id: 'pixverse-video', mediaType: 'video', displayName: 'PixVerse 视频', provider: 'pixverse', model: 'pixverse-v4', endpoint: 'https://app-api.pixverse.ai/openapi/v2', protocol: 'native' },
  { id: 'hunyuan-video', mediaType: 'video', displayName: '混元 HunyuanVideo', provider: 'hunyuan', model: 'hunyuan-video', endpoint: 'https://api.hunyuan.cloud.tencent.com', protocol: 'native' },
  { id: 'wan-image', mediaType: 'image', displayName: '通义万相 Wan 生图', provider: 'wan', model: 'wan2.6-image', endpoint: 'https://dashscope.aliyuncs.com/api/v1', protocol: 'native' },
  {
    id: 'wanx-image',
    mediaType: 'image',
    displayName: '通义万相 Wanx 生图',
    provider: 'wan',
    model: 'wan2.6-t2i',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1',
    protocol: 'native',
    modelOptions: [
      { id: 'wan2.6-t2i', label: '万相 2.6（最新推荐）' },
      { id: 'wan2.5-t2i-preview', label: '万相 2.5 Preview（推荐）' },
      { id: 'wan2.2-t2i-plus', label: '万相 2.2 专业版' },
    ],
  },
  { id: 'kling-image', mediaType: 'image', displayName: '可灵 Kling 生图', provider: 'kling', model: 'kling-image', endpoint: 'https://api.klingai.com', protocol: 'native' },
  { id: 'seedream-image', mediaType: 'image', displayName: '豆包 Seedream 生图', provider: 'doubao', model: 'doubao-seedream-5-0-lite', endpoint: 'https://ark.cn-beijing.volces.com/api/v3', protocol: 'native' },
  { id: 'hunyuan-image', mediaType: 'image', displayName: '混元 HunyuanImage', provider: 'hunyuan', model: 'hunyuan-image', endpoint: 'https://api.hunyuan.cloud.tencent.com', protocol: 'native' },
];

export function getDomesticOfficialModelPresets(mediaType: DomesticOfficialMediaType): DomesticOfficialModelPreset[] {
  return PRESETS.filter((preset) => preset.mediaType === mediaType);
}

export function getDomesticOfficialModelPreset(id: string): DomesticOfficialModelPreset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

export function applyDomesticOfficialModelPreset(id: string) {
  const preset = getDomesticOfficialModelPreset(id);
  if (!preset) return undefined;
  return {
    presetId: preset.id,
    mediaType: preset.mediaType,
    connectionMode: 'official' as const,
    displayName: preset.displayName,
    upstreamModel: preset.model,
    endpoint: preset.endpoint,
    provider: preset.provider,
  };
}
