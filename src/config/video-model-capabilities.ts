export type OfficialVideoMode =
  | 'text_to_video'
  | 'image_to_video'
  | 'first_last_frame'
  | 'reference_to_video'
  | 'video_to_video'
  | 'digital_human'
  | 'subtitle';

export type OfficialVideoProvider = 'doubao' | 'vidu' | 'minimax' | 'hailuo' | string;

export type OfficialVideoField =
  | 'aspectRatio'
  | 'resolution'
  | 'duration'
  | 'fps'
  | 'style'
  | 'motionStrength'
  | 'motionAmplitude'
  | 'cameraMovement'
  | 'styleStrength'
  | 'characterConsistency'
  | 'promptEnhancer'
  | 'generateAudio'
  | 'bgm'
  | 'offPeak'
  | 'watermark'
  | 'wmPosition'
  | 'wmUrl'
  | 'metaData'
  | 'callbackUrl'
  | 'payload'
  | 'returnLastFrame'
  | 'webSearch'
  | 'keepOriginalSound'
  | 'referenceType'
  | 'videoPreset'
  | 'templateMode'
  | 'templateStory'
  | 'templateName'
  | 'templateArea'
  | 'templateBeast'
  | 'templateBgm'
  | 'seed'
  | 'videoUrl'
  | 'audioUrl'
  | 'templateId';

export interface OfficialVideoModelCapability {
  id: string;
  provider: OfficialVideoProvider;
  label: string;
  badge?: string;
  aliases?: string[];
  officialModel?: string;
  modes: OfficialVideoMode[];
  fields: OfficialVideoField[];
  aspectRatios: string[];
  resolutions: string[];
  durations: number[];
  /**
   * 按分辨率区分可选时长。优先级高于 durations。
   * 键为分辨率（如 '720p'/'1080p'），值为该分辨率下支持的时长数组。
   * 若未提供或当前分辨率不在映射中，回退到 durations。
   */
  durationByResolution?: Record<string, number[]>;
  defaults: Record<string, unknown>;
  supportsAudioReference?: boolean;
  supportsVideoReference?: boolean;
  maxReferenceImages?: number;
  maxReferenceVideos?: number;
  maxReferenceAudios?: number;
  notes?: string[];
}

export const OFFICIAL_VIDEO_MODE_LABELS: Record<OfficialVideoMode, string> = {
  text_to_video: '文生视频',
  image_to_video: '图生视频',
  first_last_frame: '首尾帧',
  reference_to_video: '多模态参考',
  video_to_video: '视频重绘',
  digital_human: '数字人对口型',
  subtitle: '口播字幕包装',
};

export const OFFICIAL_VIDEO_MODE_HELP: Record<OfficialVideoMode, string> = {
  text_to_video: '只用提示词生成镜头视频',
  image_to_video: '用首帧或单张参考图驱动画面运动',
  first_last_frame: '指定首帧与尾帧生成过渡镜头',
  reference_to_video: '用多张图片、视频或音频做主体与风格参考',
  video_to_video: '参考已有视频的动作节奏和镜头语言',
  digital_human: '上传人物视频+音频，AI驱动数字人精准对口型',
  subtitle: '上传视频，AI一键添加标题、字幕、音效，30种模板可选',
};

export const OFFICIAL_VIDEO_MODE_FIELDS: Record<OfficialVideoMode, OfficialVideoField[]> = {
  text_to_video: [
    'aspectRatio',
    'resolution',
    'duration',
    'motionStrength',
    'style',
    'motionAmplitude',
    'cameraMovement',
    'styleStrength',
    'characterConsistency',
    'promptEnhancer',
    'generateAudio',
    'returnLastFrame',
    'webSearch',
    'bgm',
    'offPeak',
    'watermark',
    'wmPosition',
    'wmUrl',
    'templateMode',
    'templateName',
    'templateStory',
    'templateArea',
    'templateBeast',
    'templateBgm',
    'payload',
    'metaData',
    'callbackUrl',
    'seed',
  ],
  image_to_video: [
    'aspectRatio',
    'resolution',
    'duration',
    'style',
    'motionAmplitude',
    'motionStrength',
    'cameraMovement',
    'styleStrength',
    'characterConsistency',
    'promptEnhancer',
    'generateAudio',
    'returnLastFrame',
    'webSearch',
    'bgm',
    'offPeak',
    'watermark',
    'wmPosition',
    'wmUrl',
    'templateMode',
    'templateName',
    'templateStory',
    'templateArea',
    'templateBeast',
    'templateBgm',
    'payload',
    'metaData',
    'callbackUrl',
    'seed',
  ],
  first_last_frame: [
    'aspectRatio',
    'resolution',
    'duration',
    'motionAmplitude',
    'motionStrength',
    'cameraMovement',
    'styleStrength',
    'characterConsistency',
    'promptEnhancer',
    'generateAudio',
    'returnLastFrame',
    'webSearch',
    'offPeak',
    'watermark',
    'wmPosition',
    'wmUrl',
    'templateMode',
    'templateName',
    'templateStory',
    'templateArea',
    'templateBeast',
    'templateBgm',
    'payload',
    'metaData',
    'callbackUrl',
    'seed',
  ],
  reference_to_video: [
    'aspectRatio',
    'resolution',
    'duration',
    'style',
    'motionAmplitude',
    'motionStrength',
    'styleStrength',
    'characterConsistency',
    'referenceType',
    'promptEnhancer',
    'generateAudio',
    'returnLastFrame',
    'webSearch',
    'bgm',
    'offPeak',
    'watermark',
    'wmPosition',
    'wmUrl',
    'templateMode',
    'templateName',
    'templateStory',
    'templateArea',
    'templateBeast',
    'templateBgm',
    'payload',
    'metaData',
    'callbackUrl',
    'seed',
  ],
  video_to_video: [
    'resolution',
    'duration',
    'fps',
    'motionStrength',
    'styleStrength',
    'keepOriginalSound',
    'watermark',
    'payload',
    'metaData',
    'callbackUrl',
    'seed',
  ],
  digital_human: ['videoUrl', 'audioUrl'],
  subtitle: ['videoUrl', 'templateId'],
};

const DOUBAO_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const VIDU_RATIOS = ['16:9', '9:16', '3:4', '4:3', '1:1'];
const VIDU_TEMPLATE_FIELDS: OfficialVideoField[] = [
  'templateMode',
  'templateName',
  'templateStory',
  'templateArea',
  'templateBeast',
  'templateBgm',
];

export const OFFICIAL_VIDEO_MODEL_CAPABILITIES: OfficialVideoModelCapability[] = [
  {
    id: 'kling-3.0-turbo',
    provider: 'kling',
    label: 'Kling 3.0 Turbo',
    badge: '旗舰极速',
    aliases: ['kling 3.0 turbo'],
    officialModel: 'kling-3.0-turbo',
    modes: ['image_to_video'],
    fields: ['resolution', 'duration', 'payload'],
    aspectRatios: [],
    resolutions: ['720p', '1080p'],
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaults: { resolution: '1080p', duration: 5 },
    maxReferenceImages: 1,
    notes: ['仅支持首帧图生视频，不支持尾帧。'],
  },
  {
    id: 'kling-3.0',
    provider: 'kling',
    label: 'Kling 3.0 / 3.0 Omni',
    badge: '旗舰全能',
    aliases: ['kling-3.0-omni', 'kling 3.0 omni'],
    officialModel: 'kling-3.0',
    modes: ['image_to_video', 'first_last_frame'],
    fields: ['resolution', 'duration', 'generateAudio', 'payload'],
    aspectRatios: [],
    resolutions: ['720p', '1080p', '4K'],
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaults: { resolution: '1080p', duration: 5, generateAudio: false },
    maxReferenceImages: 2,
    notes: ['支持首尾帧、原生音频和多镜头；镜头路径任务默认关闭多镜头以保持连续运动。'],
  },
  {
    id: 'doubao-seedance-2-0',
    provider: 'doubao',
    label: 'Seedance 2.0 官方（火山方舟）',
    badge: '官方',
    aliases: ['Doubao-Seedance-2.0', 'doubao-seedance-2.0', 'Seedance-2.0', 'seedance-2.0'],
    officialModel: 'doubao-seedance-2-0-260128',
    modes: [
      'text_to_video',
      'image_to_video',
      'first_last_frame',
      'reference_to_video',
      'video_to_video',
    ],
    fields: [
      'aspectRatio',
      'resolution',
      'duration',
      'motionStrength',
      'cameraMovement',
      'styleStrength',
      'characterConsistency',
      'promptEnhancer',
      'generateAudio',
      'returnLastFrame',
      'webSearch',
      'watermark',
      'payload',
      'metaData',
      'callbackUrl',
      'seed',
    ],
    aspectRatios: DOUBAO_RATIOS,
    resolutions: ['480p', '720p', '1080p'],
    durations: [4, 5, 6, 8, 10, 15],
    defaults: {
      aspectRatio: '16:9',
      resolution: '1080p',
      duration: 5,
      motionStrength: 6,
      cameraMovement: 'auto',
      promptEnhancer: true,
      generateAudio: false,
      returnLastFrame: false,
      webSearch: false,
      watermark: false,
      seed: -1,
    },
    supportsAudioReference: true,
    supportsVideoReference: true,
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
  },
  {
    id: 'doubao-seedance-2-0-fast',
    provider: 'doubao',
    label: 'Seedance 2.0 Fast',
    badge: 'Fast',
    aliases: [
      'Doubao-Seedance-2.0-fast',
      'doubao-seedance-2.0-fast',
      'Seedance-2.0-fast',
      'seedance-2.0-fast',
    ],
    officialModel: 'doubao-seedance-2-0-fast-260128',
    modes: [
      'text_to_video',
      'image_to_video',
      'first_last_frame',
      'reference_to_video',
      'video_to_video',
    ],
    fields: [
      'aspectRatio',
      'resolution',
      'duration',
      'motionStrength',
      'cameraMovement',
      'styleStrength',
      'characterConsistency',
      'promptEnhancer',
      'generateAudio',
      'returnLastFrame',
      'webSearch',
      'watermark',
      'payload',
      'metaData',
      'callbackUrl',
      'seed',
    ],
    aspectRatios: DOUBAO_RATIOS,
    resolutions: ['480p', '720p'],
    durations: [4, 5, 6, 8, 10, 15],
    defaults: {
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 5,
      motionStrength: 6,
      cameraMovement: 'auto',
      promptEnhancer: true,
      generateAudio: false,
      returnLastFrame: false,
      webSearch: false,
      watermark: false,
      seed: -1,
    },
    supportsAudioReference: true,
    supportsVideoReference: true,
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
  },
  {
    id: 'doubao-seedance-1-5-pro',
    provider: 'doubao',
    label: 'Seedance 1.5 Pro 💪极具稳定',
    badge: 'Pro',
    aliases: [
      'Seedance-1.5-pro',
      'seedance-1.5-pro',
      'Doubao-Seedance-1.5-Pro',
      'doubao-seedance-1.5-pro',
    ],
    officialModel: 'doubao-seedance-1-5-pro-251215',
    modes: ['text_to_video', 'image_to_video'],
    fields: [
      'aspectRatio',
      'resolution',
      'duration',
      'motionStrength',
      'cameraMovement',
      'promptEnhancer',
      'generateAudio',
      'watermark',
      'seed',
    ],
    aspectRatios: DOUBAO_RATIOS,
    resolutions: ['720p', '1080p'],
    // 来自 doubao-models.ts: supportedDurations [3, 5, 10]，原 [5,10,12] 中 12 不被后端支持
    durations: [3, 5, 10],
    defaults: {
      aspectRatio: '16:9',
      resolution: '1080p',
      duration: 5,
      motionStrength: 5,
      cameraMovement: 'auto',
      promptEnhancer: true,
      generateAudio: false,
      watermark: false,
      seed: -1,
    },
  },
  {
    id: 'viduq3-pro',
    provider: 'vidu',
    label: 'Vidu Q3 Pro',
    badge: 'Q3',
    aliases: ['Q3-pro', 'q3-pro', 'Vidu Q3 Pro', 'vidu-q3-pro'],
    modes: ['text_to_video', 'image_to_video', 'first_last_frame', 'reference_to_video'],
    fields: [
      'aspectRatio',
      'resolution',
      'duration',
      'style',
      'motionAmplitude',
      'generateAudio',
      'offPeak',
      'watermark',
      ...VIDU_TEMPLATE_FIELDS,
      'wmPosition',
      'wmUrl',
      'metaData',
      'callbackUrl',
      'payload',
      'seed',
    ],
    aspectRatios: VIDU_RATIOS,
    resolutions: ['540p', '720p', '1080p'],
    durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    defaults: {
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 5,
      style: 'general',
      motionAmplitude: 'auto',
      generateAudio: true,
      bgm: false,
      offPeak: false,
      watermark: false,
      wmPosition: 3,
      templateMode: 'standard',
      seed: -1,
    },
    supportsVideoReference: false,
    maxReferenceImages: 7,
  },
  {
    id: 'viduq3-turbo',
    provider: 'vidu',
    label: 'Vidu Q3 Turbo',
    badge: 'Q3',
    aliases: ['Q3-turbo', 'q3-turbo', 'Vidu Q3 Turbo', 'vidu-q3-turbo'],
    modes: ['text_to_video', 'image_to_video', 'first_last_frame', 'reference_to_video'],
    fields: [
      'aspectRatio',
      'resolution',
      'duration',
      'style',
      'motionAmplitude',
      'generateAudio',
      'offPeak',
      'watermark',
      ...VIDU_TEMPLATE_FIELDS,
      'wmPosition',
      'wmUrl',
      'metaData',
      'callbackUrl',
      'payload',
      'seed',
    ],
    aspectRatios: VIDU_RATIOS,
    resolutions: ['540p', '720p', '1080p'],
    durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    defaults: {
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 5,
      style: 'general',
      motionAmplitude: 'auto',
      generateAudio: true,
      bgm: false,
      offPeak: false,
      watermark: false,
      wmPosition: 3,
      templateMode: 'standard',
      seed: -1,
    },
    supportsVideoReference: false,
    maxReferenceImages: 7,
  },
  {
    id: 'viduq3-pro-fast',
    provider: 'vidu',
    label: 'Vidu Q3 Pro Fast',
    badge: 'Fast',
    aliases: ['Q3-pro-fast', 'q3-pro-fast', 'Vidu Q3 Pro Fast', 'vidu-q3-pro-fast'],
    modes: ['image_to_video'],
    fields: [
      'aspectRatio',
      'resolution',
      'duration',
      'style',
      'motionAmplitude',
      'generateAudio',
      'offPeak',
      'watermark',
      ...VIDU_TEMPLATE_FIELDS,
      'wmPosition',
      'wmUrl',
      'metaData',
      'callbackUrl',
      'payload',
      'seed',
    ],
    aspectRatios: VIDU_RATIOS,
    resolutions: ['720p', '1080p'],
    durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    defaults: {
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 5,
      style: 'general',
      motionAmplitude: 'auto',
      generateAudio: true,
      offPeak: false,
      watermark: false,
      wmPosition: 3,
      templateMode: 'standard',
      seed: -1,
    },
    maxReferenceImages: 1,
  },
  {
    id: 'viduq3-mix',
    provider: 'vidu',
    label: 'Vidu Q3 Mix',
    badge: 'Mix',
    aliases: ['Q3-mix', 'q3-mix', 'Vidu Q3 Mix', 'vidu-q3-mix'],
    modes: ['reference_to_video'],
    fields: [
      'aspectRatio',
      'resolution',
      'duration',
      'style',
      'generateAudio',
      'offPeak',
      'watermark',
      ...VIDU_TEMPLATE_FIELDS,
      'wmPosition',
      'wmUrl',
      'metaData',
      'callbackUrl',
      'payload',
      'seed',
    ],
    aspectRatios: VIDU_RATIOS,
    resolutions: ['540p', '720p', '1080p'],
    durations: [3, 4, 5, 6, 7, 8],
    defaults: {
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 5,
      style: 'general',
      generateAudio: true,
      offPeak: false,
      watermark: false,
      wmPosition: 3,
      templateMode: 'standard',
      seed: -1,
    },
    maxReferenceImages: 7,
  },
  {
    id: 'viduq2-pro',
    provider: 'vidu',
    label: 'Vidu Q2 Pro',
    badge: 'Q2',
    aliases: ['Q2-pro', 'q2-pro', 'Vidu Q2 Pro', 'vidu-q2-pro'],
    modes: ['text_to_video', 'image_to_video', 'first_last_frame', 'reference_to_video'],
    fields: [
      'aspectRatio',
      'resolution',
      'duration',
      'style',
      'motionAmplitude',
      'bgm',
      'offPeak',
      'watermark',
      ...VIDU_TEMPLATE_FIELDS,
      'wmPosition',
      'wmUrl',
      'metaData',
      'callbackUrl',
      'payload',
      'seed',
    ],
    aspectRatios: VIDU_RATIOS,
    resolutions: ['540p', '720p', '1080p'],
    durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    defaults: {
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 5,
      style: 'general',
      motionAmplitude: 'auto',
      bgm: false,
      offPeak: false,
      watermark: false,
      wmPosition: 3,
      templateMode: 'standard',
      seed: -1,
    },
    supportsVideoReference: true,
    maxReferenceImages: 7,
    maxReferenceVideos: 2,
  },
  {
    id: 'viduq2-turbo',
    provider: 'vidu',
    label: 'Vidu Q2 Turbo',
    badge: 'Q2',
    aliases: ['Q2-turbo', 'q2-turbo', 'Vidu Q2 Turbo', 'vidu-q2-turbo'],
    modes: ['text_to_video', 'image_to_video', 'first_last_frame', 'reference_to_video'],
    fields: [
      'aspectRatio',
      'resolution',
      'duration',
      'style',
      'motionAmplitude',
      'bgm',
      'offPeak',
      'watermark',
      ...VIDU_TEMPLATE_FIELDS,
      'wmPosition',
      'wmUrl',
      'metaData',
      'callbackUrl',
      'payload',
      'seed',
    ],
    aspectRatios: VIDU_RATIOS,
    resolutions: ['540p', '720p', '1080p'],
    durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    defaults: {
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 5,
      style: 'general',
      motionAmplitude: 'auto',
      bgm: false,
      offPeak: false,
      watermark: false,
      wmPosition: 3,
      templateMode: 'standard',
      seed: -1,
    },
    maxReferenceImages: 7,
  },
  {
    id: 'viduq2-pro-fast',
    provider: 'vidu',
    label: 'Vidu Q2 Pro Fast',
    badge: 'Fast',
    aliases: ['Q2-pro-fast', 'q2-pro-fast', 'Vidu Q2 Pro Fast', 'vidu-q2-pro-fast'],
    modes: ['image_to_video', 'first_last_frame'],
    fields: [
      'aspectRatio',
      'resolution',
      'duration',
      'style',
      'motionAmplitude',
      'bgm',
      'offPeak',
      'watermark',
      ...VIDU_TEMPLATE_FIELDS,
      'wmPosition',
      'wmUrl',
      'metaData',
      'callbackUrl',
      'payload',
      'seed',
    ],
    aspectRatios: VIDU_RATIOS,
    resolutions: ['720p', '1080p'],
    durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    defaults: {
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 5,
      style: 'general',
      motionAmplitude: 'auto',
      bgm: false,
      offPeak: false,
      watermark: false,
      wmPosition: 3,
      templateMode: 'standard',
      seed: -1,
    },
    maxReferenceImages: 2,
  },
  {
    id: 'viduq2',
    provider: 'vidu',
    label: 'Vidu Q2',
    badge: 'Q2',
    aliases: ['Q2', 'q2', 'Vidu Q2', 'vidu-q2'],
    modes: ['text_to_video', 'reference_to_video'],
    fields: [
      'aspectRatio',
      'resolution',
      'duration',
      'style',
      'motionAmplitude',
      'bgm',
      'offPeak',
      'watermark',
      ...VIDU_TEMPLATE_FIELDS,
      'wmPosition',
      'wmUrl',
      'metaData',
      'callbackUrl',
      'payload',
      'seed',
    ],
    aspectRatios: VIDU_RATIOS,
    resolutions: ['540p', '720p', '1080p'],
    durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    defaults: {
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 5,
      style: 'general',
      motionAmplitude: 'auto',
      bgm: false,
      offPeak: false,
      watermark: false,
      wmPosition: 3,
      templateMode: 'standard',
      seed: -1,
    },
    maxReferenceImages: 7,
  },
  {
    id: 'minimax-h3',
    provider: 'minimax',
    label: 'MiniMax H3',
    badge: '旗舰',
    aliases: ['MiniMax H3', 'minimax-h3-video', 'h3-video'],
    modes: ['text_to_video', 'image_to_video'],
    fields: ['aspectRatio', 'resolution', 'duration', 'promptEnhancer', 'watermark'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    durations: [5, 6, 10],
    defaults: { aspectRatio: '16:9', resolution: '1080p', duration: 5, promptEnhancer: true },
    notes: ['MiniMax H3 热门旗舰视频模型。'],
  },
  {
    id: 'doubao-seedance-2-5',
    provider: 'doubao',
    label: 'Seedance 2.5',
    badge: '旗舰',
    aliases: ['Seedance 2.5', 'seedance-2.5', 'doubao-seedance-2.5'],
    modes: ['text_to_video', 'image_to_video', 'first_last_frame', 'reference_to_video'],
    fields: ['aspectRatio', 'resolution', 'duration', 'promptEnhancer', 'generateAudio', 'watermark'],
    aspectRatios: DOUBAO_RATIOS,
    resolutions: ['720p', '1080p'],
    durations: [5, 10],
    defaults: { aspectRatio: '16:9', resolution: '1080p', duration: 5, promptEnhancer: true, generateAudio: false },
    supportsVideoReference: true,
    maxReferenceImages: 4,
  },
  {
    id: 'happyhorse-1.1',
    provider: 'happyhorse',
    label: 'HappyHorse 1.1',
    badge: '旗舰',
    aliases: ['HappyHorse 1.1', 'happyhorse-1-1', 'happyhorse-1.1-video'],
    modes: ['text_to_video', 'image_to_video'],
    fields: ['aspectRatio', 'resolution', 'duration', 'promptEnhancer', 'watermark'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    durations: [5, 10],
    defaults: { aspectRatio: '16:9', resolution: '1080p', duration: 5, promptEnhancer: true },
  },
  {
    id: 'wan2.7-video',
    provider: 'wan',
    label: '通义万相 Wan 2.7',
    badge: '旗舰',
    aliases: ['Wan 2.7', 'Wan2.7', 'wan-2.7-video', 'wan2.7'],
    modes: ['text_to_video', 'image_to_video'],
    fields: ['aspectRatio', 'resolution', 'duration', 'promptEnhancer', 'watermark'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    durations: [5, 10],
    defaults: { aspectRatio: '16:9', resolution: '1080p', duration: 5, promptEnhancer: true },
  },
  {
    id: 'skyreels-v4',
    provider: 'skyreels',
    label: 'SkyReels V4',
    badge: '旗舰',
    aliases: ['SkyReels V4', 'skyreels-v4-video', 'skyreels-4'],
    modes: ['text_to_video', 'image_to_video'],
    fields: ['aspectRatio', 'resolution', 'duration', 'promptEnhancer', 'watermark'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    durations: [5, 10],
    defaults: { aspectRatio: '16:9', resolution: '1080p', duration: 5, promptEnhancer: true },
  },
  {
    id: 'hailuo-video-2.3',
    provider: 'hailuo',
    label: '海螺 Hailuo 2.3',
    badge: '旗舰',
    aliases: ['Hailuo 2.3', 'Hailuo-2.3', 'hailuo-2-3'],
    modes: ['text_to_video', 'image_to_video', 'first_last_frame', 'video_to_video'],
    fields: ['aspectRatio', 'resolution', 'duration', 'promptEnhancer', 'watermark'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['768p', '1080p'],
    durations: [6, 10],
    defaults: { aspectRatio: '16:9', resolution: '768p', duration: 6, promptEnhancer: true },
    supportsVideoReference: true,
    maxReferenceImages: 1,
  },
];

export const OFFICIAL_VIDEO_MODEL_CAPABILITY_MAP = new Map(
  OFFICIAL_VIDEO_MODEL_CAPABILITIES.map((capability) => [capability.id, capability])
);

export function getOfficialVideoModelCapability(
  modelId?: string
): OfficialVideoModelCapability | undefined {
  if (!modelId) return undefined;
  return OFFICIAL_VIDEO_MODEL_CAPABILITY_MAP.get(modelId);
}

function normalizeVideoModelAlias(modelId: string): string {
  return modelId
    .trim()
    .toLowerCase()
    .replace(/[_\s.]+/g, '-')
    .replace(/-+/g, '-');
}

export function getOfficialVideoModelCapabilityByAlias(
  modelId?: string
): OfficialVideoModelCapability | undefined {
  if (!modelId) return undefined;
  const direct = getOfficialVideoModelCapability(modelId);
  if (direct) return direct;
  const normalized = normalizeVideoModelAlias(modelId);
  return OFFICIAL_VIDEO_MODEL_CAPABILITIES.find((item) => {
    const keys = [item.id, item.officialModel, ...(item.aliases || [])].filter(Boolean) as string[];
    return keys.some((key) => normalizeVideoModelAlias(key) === normalized);
  });
}

export function isOfficialVideoMode(mode: unknown): mode is OfficialVideoMode {
  return typeof mode === 'string' && mode in OFFICIAL_VIDEO_MODE_LABELS;
}

export function normalizeOfficialVideoMode(mode: unknown): OfficialVideoMode {
  if (mode === 'reference') return 'reference_to_video';
  return isOfficialVideoMode(mode) ? mode : 'text_to_video';
}

export function getOfficialVideoModeIssue(modelId: string, mode: OfficialVideoMode): string | null {
  const capability = getOfficialVideoModelCapabilityByAlias(modelId);
  if (!capability) return null;
  if (capability.modes.includes(mode)) return null;
  return `${capability.label} 不支持「${OFFICIAL_VIDEO_MODE_LABELS[mode]}」，请切换模型或生成模式`;
}

export function clampOfficialVideoParams(
  params: Record<string, unknown>,
  capability?: OfficialVideoModelCapability
): Record<string, unknown> {
  if (!capability) return params;
  const next = { ...capability.defaults, ...params };
  const mode = normalizeOfficialVideoMode(next.generationMode);
  next.generationMode = capability.modes.includes(mode) ? mode : capability.modes[0];

  if (!capability.aspectRatios.includes(String(next.aspectRatio))) {
    next.aspectRatio = capability.defaults.aspectRatio || capability.aspectRatios[0];
  }
  if (!capability.resolutions.includes(String(next.resolution))) {
    next.resolution = capability.defaults.resolution || capability.resolutions[0];
  }

  // 优先使用按分辨率区分的时长清单，否则回退到 durations
  const resolutionKey = String(next.resolution);
  const allowedDurations =
    (capability.durationByResolution && capability.durationByResolution[resolutionKey]) ||
    capability.durations;
  if (!allowedDurations.includes(Number(next.duration))) {
    // 当前时长不再被当前分辨率支持，回落到默认值；若默认值也不被支持，取允许列表第一个
    const fallback = capability.defaults.duration;
    next.duration = allowedDurations.includes(Number(fallback)) ? fallback : allowedDurations[0];
  }

  return next;
}

/**
 * 获取当前模型在指定分辨率下可选的时长列表。
 * 若模型声明了 durationByResolution，则按分辨率返回；否则返回 durations。
 */
export function getDurationsForResolution(
  capability: OfficialVideoModelCapability | undefined,
  resolution: string | undefined
): number[] {
  if (!capability) return [4, 5, 6, 8, 10];
  const key = String(resolution || capability.defaults.resolution || '');
  if (capability.durationByResolution && key && capability.durationByResolution[key]) {
    return capability.durationByResolution[key];
  }
  return capability.durations;
}
