export type ModelMediaType = 'image' | 'video';
export type ModelChannelCategory = 'generation' | 'edit' | 'action';

export interface ModelChannel {
  id: string;
  modelId: string;
  aliases?: string[];
  mediaType: ModelMediaType;
  provider: string;
  providerModel: string;
  category: ModelChannelCategory;
  capabilities: string[];
  supportedModes: string[];
  requiredInputs: string[];
  enabled: boolean;
  disabledReason?: string;
  fallbackModelId?: string;
  fallbackProvider?: string;
  keyScope?: string;
}

export interface ResolvedModelChannel {
  channel: ModelChannel;
  provider: string;
  model: string;
  fallbackApplied: boolean;
}

const imageGenerationModes = ['text_to_image', 'image_to_image'];
const videoGenerationModes = [
  'text_to_video',
  'image_to_video',
  'first_last_frame',
  'reference_to_video',
  'video_to_video',
];

const imageChannels: ModelChannel[] = [
  imageChannel(
    'sensenova:sensenova-u1.5-lite',
    'sensenova-u1.5-lite',
    'sensenova',
    'sensenova-u1.5-lite',
    ['text-to-image', 'image-to-image', 'reference', 'infographic']
  ),
  imageChannel(
    'sensenova:sensenova-u1-fast',
    'sensenova-u1-fast',
    'sensenova',
    'sensenova-u1-fast',
    ['text-to-image', 'image-to-image', 'reference', 'infographic']
  ),
  imageChannel(
    'doubao:doubao-seedream-5-0-lite',
    'doubao-seedream-5-0-lite',
    'doubao',
    'doubao-seedream-5-0-lite',
    [
      'text-to-image',
      'image-to-image',
      'reference',
      'instruction-following',
      'infographic',
      'multi-image-fusion',
      'sequential-image-generation',
      'streaming-output',
      'web-search',
    ],
    {
      aliases: ['doubao-seedream-5-0-260128', 'doubao-seedream-5.0-lite', 'seedream-5-0-lite'],
    }
  ),
  imageChannel(
    'doubao:doubao-seedream-4-5',
    'doubao-seedream-4-5',
    'doubao',
    'doubao-seedream-4-5',
    ['text-to-image', 'image-to-image', 'reference'],
    {
      aliases: ['doubao-seedream-4-5-251128', 'doubao-seedream-4.5', 'seedream-4-5'],
    }
  ),
  imageChannel(
    'wuyinkeji:Wan2.7_image',
    'Wan2.7_image',
    'wuyinkeji',
    'Wan2.7_image',
    ['text-to-image', 'image-to-image', 'reference'],
    {
      aliases: ['Wan2.6'],
    }
  ),
];

const videoChannels: ModelChannel[] = [
  videoChannel('wuyinkeji:Wan2.6_video', 'Wan2.6_video', 'wuyinkeji', 'Wan2.6_video', [
    'text-to-video',
    'image-to-video',
    'first-last-frame',
  ]),
  videoChannel('wuyinkeji:Wan2.7', 'Wan2.7', 'wuyinkeji', 'Wan2.7', [
    'text-to-video',
    'image-to-video',
    'first-last-frame',
    'multi-reference',
  ]),
  videoChannel('wuyinkeji:video_seedance', 'video_seedance', 'wuyinkeji', 'video_seedance', [
    'text-to-video',
    'image-to-video',
    'first-last-frame',
  ]),
  videoChannel('wuyinkeji:video_vidu', 'video_vidu', 'wuyinkeji', 'video_vidu', [
    'text-to-video',
    'image-to-video',
    'first-last-frame',
    'reference-to-video',
  ]),
  videoChannel('wuyinkeji:video_omni', 'video_omni', 'wuyinkeji', 'video_omni', [
    'text-to-video',
    'image-to-video',
    'first-last-frame',
    'video-to-video',
  ]),
  videoChannel(
    'wuyinkeji:Digital_Humans',
    'Digital_Humans',
    'wuyinkeji',
    'Digital_Humans',
    ['digital-human'],
    {
      category: 'action',
      requiredInputs: ['audioUrl', 'videoUrl'],
      supportedModes: ['digital_human'],
    }
  ),
  videoChannel(
    'wuyinkeji:Package_1.0',
    'Package_1.0',
    'wuyinkeji',
    'Package_1.0',
    ['video-package'],
    {
      category: 'action',
      requiredInputs: ['video'],
      supportedModes: ['video_package'],
    }
  ),
  videoChannel(
    'doubao:doubao-seedance-2-0',
    'doubao-seedance-2-0',
    'doubao',
    'doubao-seedance-2-0',
    ['text-to-video', 'image-to-video', 'first-last-frame', 'reference-to-video', 'video-to-video'],
    {
      aliases: [
        'doubao-seedance-2-0-260128',
        'doubao-seedance-2.0',
        'doubao-seedance-2-0-fast',
        'doubao-seedance-2-0-fast-260128',
        'doubao-seedance-2.0-fast',
      ],
    }
  ),
  videoChannel(
    'doubao:doubao-seedance-1-5-pro',
    'doubao-seedance-1-5-pro',
    'doubao',
    'doubao-seedance-1-5-pro',
    ['text-to-video', 'image-to-video', 'first-last-frame'],
    {
      aliases: ['doubao-seedance-1-5-pro-251215'],
    }
  ),
  videoChannel(
    'doubao:doubao-seedance-1-0-pro',
    'doubao-seedance-1-0-pro',
    'doubao',
    'doubao-seedance-1-0-pro',
    ['text-to-video', 'image-to-video', 'first-last-frame'],
    {
      aliases: ['doubao-seedance-1-0-pro-250528'],
    }
  ),
  videoChannel('vidu:viduq2-pro', 'viduq2-pro', 'vidu', 'viduq2-pro', [
    'text-to-video',
    'image-to-video',
    'first-last-frame',
  ]),
  videoChannel('vidu:viduq2-pro-fast', 'viduq2-pro-fast', 'vidu', 'viduq2-pro-fast', [
    'image-to-video',
    'first-last-frame',
  ]),
  videoChannel('vidu:viduq2-turbo', 'viduq2-turbo', 'vidu', 'viduq2-turbo', [
    'text-to-video',
    'image-to-video',
  ]),
  videoChannel('vidu:viduq2', 'viduq2', 'vidu', 'viduq2', ['text-to-video']),
  videoChannel('vidu:vidu2-i2v', 'vidu2-i2v', 'vidu', 'vidu2-i2v', ['image-to-video']),
  videoChannel('vidu:vidu2-start-end', 'vidu2-start-end', 'vidu', 'vidu2-start-end', [
    'first-last-frame',
  ]),
  videoChannel('vidu:vidu2-reference', 'vidu2-reference', 'vidu', 'vidu2-reference', [
    'reference-to-video',
  ]),
];

export const MODEL_CHANNELS: ModelChannel[] = [...imageChannels, ...videoChannels];

function imageChannel(
  id: string,
  modelId: string,
  provider: string,
  providerModel: string,
  capabilities: string[],
  overrides: Partial<ModelChannel> = {}
): ModelChannel {
  return {
    id,
    modelId,
    mediaType: 'image',
    provider,
    providerModel,
    category: 'generation',
    capabilities,
    supportedModes: imageGenerationModes,
    requiredInputs: ['prompt'],
    enabled: true,
    keyScope: `${provider}:${providerModel}`,
    ...overrides,
  };
}

function actionImageChannel(
  id: string,
  modelId: string,
  providerModel: string,
  requiredInputs: string[],
  capabilities: string[],
  aliases: string[] = []
): ModelChannel {
  return imageChannel(id, modelId, 'wuyinkeji', providerModel, capabilities, {
    aliases,
    category: 'action',
    supportedModes: capabilities,
    requiredInputs,
  });
}

function videoChannel(
  id: string,
  modelId: string,
  provider: string,
  providerModel: string,
  capabilities: string[],
  overrides: Partial<ModelChannel> = {}
): ModelChannel {
  return {
    id,
    modelId,
    mediaType: 'video',
    provider,
    providerModel,
    category: 'generation',
    capabilities,
    supportedModes: videoGenerationModes,
    requiredInputs: ['prompt'],
    enabled: true,
    keyScope: `${provider}:${providerModel}`,
    ...overrides,
  };
}

function disabledVideoChannel(
  id: string,
  modelId: string,
  provider: string,
  disabledReason: string,
  fallbackModelId?: string,
  fallbackProvider?: string,
  aliases: string[] = []
): ModelChannel {
  return videoChannel(id, modelId, provider, modelId, ['text-to-video', 'image-to-video'], {
    aliases,
    enabled: false,
    disabledReason,
    fallbackModelId,
    fallbackProvider,
  });
}

function normalize(value?: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function channelKeys(channel: ModelChannel): string[] {
  return [channel.modelId, channel.providerModel, ...(channel.aliases || [])]
    .filter(Boolean)
    .map(normalize);
}

export function getModelChannels(mediaType?: ModelMediaType): ModelChannel[] {
  return mediaType
    ? MODEL_CHANNELS.filter((channel) => channel.mediaType === mediaType)
    : [...MODEL_CHANNELS];
}

export function findModelChannel(
  mediaType: ModelMediaType,
  provider?: string,
  modelId?: string
): ModelChannel | undefined {
  const normalizedProvider = normalize(provider);
  const normalizedModel = normalize(modelId);
  if (!normalizedModel && !normalizedProvider) return undefined;

  return (
    MODEL_CHANNELS.find((channel) => {
      if (channel.mediaType !== mediaType) return false;
      if (
        normalizedProvider &&
        channel.provider !== normalizedProvider &&
        !channel.id.startsWith(`${normalizedProvider}:`)
      ) {
        return false;
      }
      return channelKeys(channel).includes(normalizedModel);
    }) ||
    MODEL_CHANNELS.find((channel) => {
      if (channel.mediaType !== mediaType) return false;
      return channelKeys(channel).includes(normalizedModel);
    })
  );
}

export function resolveModelChannel(
  mediaType: ModelMediaType,
  provider?: string,
  modelId?: string
): ResolvedModelChannel | undefined {
  const channel = findModelChannel(mediaType, provider, modelId);
  if (!channel) return undefined;

  if (!channel.enabled && channel.fallbackModelId && channel.fallbackProvider) {
    const fallback = findModelChannel(mediaType, channel.fallbackProvider, channel.fallbackModelId);
    if (fallback?.enabled) {
      return {
        channel,
        provider: fallback.provider,
        model: fallback.providerModel,
        fallbackApplied: true,
      };
    }
  }

  return {
    channel,
    provider: channel.provider,
    model: channel.providerModel,
    fallbackApplied: false,
  };
}

export function resolveVideoModelChannel(
  provider?: string,
  modelId?: string
): ResolvedModelChannel | undefined {
  return resolveModelChannel('video', provider, modelId);
}

export function resolveImageModelChannel(
  provider?: string,
  modelId?: string
): ResolvedModelChannel | undefined {
  return resolveModelChannel('image', provider, modelId);
}

export function getChannelMetadata(
  provider: string,
  modelId: string,
  mediaType?: ModelMediaType
): Partial<ModelChannel> | undefined {
  const channel = mediaType
    ? findModelChannel(mediaType, provider, modelId)
    : findModelChannel('image', provider, modelId) || findModelChannel('video', provider, modelId);
  if (!channel) return undefined;
  return {
    id: channel.id,
    modelId: channel.modelId,
    provider: channel.provider,
    providerModel: channel.providerModel,
    mediaType: channel.mediaType,
    category: channel.category,
    capabilities: channel.capabilities,
    supportedModes: channel.supportedModes,
    requiredInputs: channel.requiredInputs,
    enabled: channel.enabled,
    disabledReason: channel.disabledReason,
    fallbackModelId: channel.fallbackModelId,
    fallbackProvider: channel.fallbackProvider,
    keyScope: channel.keyScope,
  };
}
