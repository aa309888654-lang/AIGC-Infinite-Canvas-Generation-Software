import { getConfiguredVideoRate, type VideoPricingContext } from './video-pricing-table';

/**
 * 会员等级权限配置
 * 定义各会员等级的积分计费与资源限制
 */

export interface PermissionLimits {
  dailyMusic: number; // 每天AI音乐生成次数
  dailyImage: number; // 每天AI图片生成次数
  dailyAudioMinutes: number; // 每天音频生成分钟数
  dailyPromptOptimization: number; // 每天提示词优化次数（-1表示无限）
  dailyVideo: number; // 每天AI视频生成次数

  // MiniMax Image-01 免费额度（0表示无免费额度，统一按积分扣费）
  minimaxImage01FreeQuota: number;

  // 兼容旧的超额扣费配置；日额度为 -1 时直接按积分扣费
  musicDeductionPoints: number; // 音乐每次超额扣除积分
  imageDeductionPoints: number; // 图片每次超额扣除积分
  audioDeductionPoints: number; // 音频每分钟超额扣除积分
  promptDeductionPoints: number; // 提示词优化每次超额扣除积分

  // 云存储空间（字节）
  storageSpace: number; // 对象存储空间，默认100MB=104857600字节

  // 并发任务数
  concurrentTasks: number; // 同时进行的最大任务数
}

export const MB = 1024 * 1024;
export const GB = 1024 * MB;
export const STORAGE_SPACE_BYTES = {
  trial: 100 * MB, // 100 MB 体验版
  free: 100 * MB, // 100 MB 兼容旧数据
  light: 1000 * MB, // 1000 MB 轻享版
  basic: 1000 * MB, // 1000 MB 轻享版
  pro: 1000 * MB, // 1000 MB 专业版
  local: 100 * MB, // 100 MB 本地安装版本
  enterprise: 100 * MB, // 100 MB 兼容旧数据
} as const;

// 视频积分消耗规则：所有会员统一按模型、分辨率、时长计费
export const VIDEO_PRICING_RULES = {
  // 模型与分辨率每秒消耗积分映射
  pointsPerSecond: {
    'Wan2.6_video': { '720p': 50, '1080p': 50, '4k': 50 },
    'Wan2.7': { '720p': 100, '1080p': 100, '4k': 100 },
    video_vidu: { '720p': 150, '1080p': 150, '4k': 150 },
    video_omni: { std: 150, pro: 150, '720p': 150, '1080p': 150, '4k': 150 },
    video_seedance: { '480p': 150, '720p': 150, '1080p': 150, '4k': 150 },
    Digital_Humans: { '720p': 10, '1080p': 10, '4k': 10 },
    'Package_1.0': { '720p': 10, '1080p': 10, '4k': 10 },
    'agnes-video-v2.0': { '720p': 8, '1080p': 8, '4k': 8 },
    // vidu 视频模型
    'viduq2-pro': { '720p': 37.2, '1080p': 55.2, '4k': 55.2 },
    viduq2: { '720p': 40.0, '1080p': 60.0, '4k': 60.0 },
    'viduq2-turbo': { '720p': 40.0, '1080p': 60.0, '4k': 60.0 },
    'viduq2-pro-fast': { '720p': 37.2, '1080p': 55.2, '4k': 55.2 },
    'viduq3-pro': { '720p': 82.0, '1080p': 110.0, '4k': 110.0 },
    'viduq3-turbo': { '720p': 82.0, '1080p': 110.0, '4k': 110.0 },
    'viduq3-pro-fast': { '720p': 82.0, '1080p': 110.0, '4k': 110.0 },
    'viduq3-mix': { '720p': 82.0, '1080p': 110.0, '4k': 110.0 },
    // seedance 视频模型
    'seedance-1.5': { '720p': 108, '1080p': 108, '4k': 108 },
    'doubao-seedance-2-0': { '720p': 10, '1080p': 15, '4k': 15 },
    'doubao-seedance-2-0-fast': { '720p': 8, '1080p': 12, '4k': 12 },
    'doubao-seedance-1-5-pro': { '720p': 100, '1080p': 100, '4k': 100 },
    // kling 视频模型
    'kling-3.0-turbo': { '720p': 18, '1080p': 25, '4k': 25 },
    'kling-3.0': { '720p': 25, '1080p': 35, '4k': 35 },
    default: { '720p': 50, '1080p': 50, '4k': 50 },
  } as Record<string, Record<string, number>>,
};

export const IMAGE_PRICING_RULES = {
  'seedream-5.0-lite': 60,
  'seedream-5.0-pro': 80,
  'doubao-seedream-5-0-pro': 80,
  'seedream-4.5': 100,
  'step-image-edit-2': 10,
  wuyinkeji: 50,
  'Wan2.7_image': 60,
  'Wan2.6': 60,
  'sensenova-u1-fast': 5,
  flux: 50,
  'flux-2-pro': 30,
  'flux-2-flex': 15,
  'flux-2-dev': 15,
  'flux-kontext-dev': 22,
  'flux-kontext-pro': 35,
  'flux-kontext-max': 60,
  'image-eraser': 10,
  'image-upscaler': 10,
  'image-remove-background': 1,
  'image-01': 30,
  'agnes-image-2.1-flash': 20,
  default: 100,
};

export const MUSIC_PRICING_RULES = {
  'music-2.6': 60,
  default: 100,
};

export const AUDIO_PRICING_RULES: Record<string, number> = {
  'speech-2.8-hd': 100,
  'minimax-asr': 100,
  'step-tts-mini': 30,
  'step-tts-2': 30,
  'stepaudio-2.5-tts': 30,
  'stepaudio-2.5-asr': 30,
  'stepaudio-2.5-chat': 30,
  'step-1o-audio': 30,
  'stepaudio-2.5-realtime': 30,
  default: 30,
};

export function calculateAudioPoints(model: string | undefined, minutes: number): number {
  const normalizedModel = (model || 'default').toLowerCase();
  const pointsPerMinute =
    AUDIO_PRICING_RULES[normalizedModel] ??
    (normalizedModel.includes('minimax') || normalizedModel.includes('speech-2.8')
      ? 100
      : AUDIO_PRICING_RULES.default);

  return Math.ceil(pointsPerMinute * Math.max(1, minutes));
}

// 计算视频生成的积分消耗
export function calculateVideoPoints(provider: string, resolution: string, durationSeconds: number, context: VideoPricingContext = {}): number {
  const normalizedProvider = provider.toLowerCase();
  const configuredRate = getConfiguredVideoRate(provider, resolution, context);
  if (configuredRate !== null) return Math.ceil(configuredRate * durationSeconds);

  const resLower = resolution.toLowerCase();
  const normalizedRes =
    resLower === 'std' || resLower === 'pro'
      ? resLower
      : resLower.includes('4k') || resLower.includes('2160')
        ? '4k'
        : resLower.includes('1080') || resLower.includes('2k')
          ? '1080p'
          : '720p';

  const matchedProviderKey = Object.keys(VIDEO_PRICING_RULES.pointsPerSecond).find(
        (key) => key.toLowerCase() === normalizedProvider
      );
  const providerRules =
    (matchedProviderKey ? VIDEO_PRICING_RULES.pointsPerSecond[matchedProviderKey] : undefined) ||
    VIDEO_PRICING_RULES.pointsPerSecond['default'];
  const pointsPerSecond = providerRules[normalizedRes] || providerRules['720p'];

  return Math.ceil(pointsPerSecond * durationSeconds);
}

export interface MembershipTier {
  name: string;
  displayName: string;
  description: string;
  limits: PermissionLimits;
  features: string[];
}

export const MEMBERSHIP_TIERS: Record<string, MembershipTier> = {
  trial: {
    name: 'trial',
    displayName: '体验版',
    description: '免费体验，适合新手体验基本功能',
    limits: {
      dailyMusic: -1,
      dailyImage: -1,
      dailyAudioMinutes: -1,
      dailyPromptOptimization: -1,
      dailyVideo: -1,

      minimaxImage01FreeQuota: 0, // 体验版图片统一按模型积分抵扣

      musicDeductionPoints: 100,
      imageDeductionPoints: 100,
      audioDeductionPoints: 30,
      promptDeductionPoints: 1,
      storageSpace: STORAGE_SPACE_BYTES.trial,
      concurrentTasks: 1,
    },
    features: [
      '云空间100M',
      '注册得500积分',
      'AI音乐按照模型积分抵扣',
      'AI图片按照模型积分抵扣',
      'AI配音按照模型积分抵扣',
      '提示词优化每次扣1积分',
      '视频按照模型与时长积分抵扣',
    ],
  },

  light: {
    name: 'light',
    displayName: '轻享版',
    description: '适合日常创作者使用',
    limits: {
      dailyMusic: -1,
      dailyImage: -1,
      dailyAudioMinutes: -1,
      dailyPromptOptimization: -1,
      dailyVideo: -1,

      minimaxImage01FreeQuota: 0, // 图片统一按模型积分抵扣

      musicDeductionPoints: 100,
      imageDeductionPoints: 100,
      audioDeductionPoints: 30,
      promptDeductionPoints: 1,
      storageSpace: STORAGE_SPACE_BYTES.light,
      concurrentTasks: 2,
    },
    features: [
      '云空间1000M',
      '开通获得5280积分',
      'AI音乐按照模型积分抵扣',
      'AI图片按照模型积分抵扣',
      'AI配音按照模型积分抵扣',
      '提示词优化每次扣1积分',
      '视频按照模型与时长积分抵扣',
    ],
  },

  pro: {
    name: 'pro',
    displayName: '专业版',
    description: '适合专业创作者和团队',
    limits: {
      dailyMusic: -1,
      dailyImage: -1,
      dailyAudioMinutes: -1,
      dailyPromptOptimization: -1,
      dailyVideo: -1,

      minimaxImage01FreeQuota: 0, // 图片统一按模型积分抵扣

      musicDeductionPoints: 100,
      imageDeductionPoints: 100,
      audioDeductionPoints: 30,
      promptDeductionPoints: 1,
      storageSpace: STORAGE_SPACE_BYTES.pro,
      concurrentTasks: 10,
    },
    features: [
      '云空间1000M',
      '开通获得20280积分',
      'AI音乐按照模型积分抵扣',
      'AI图片按照模型积分抵扣',
      'AI配音按照模型积分抵扣',
      '提示词优化每次扣1积分',
      '视频按照模型与时长积分抵扣',
    ],
  },

  local: {
    name: 'local',
    displayName: '本地安装版本',
    description: '本地终身版，支持自定义大模型API，终身使用',
    limits: {
      dailyMusic: -1,
      dailyImage: -1,
      dailyAudioMinutes: -1,
      dailyPromptOptimization: -1,
      dailyVideo: -1,

      minimaxImage01FreeQuota: 0, // 图片统一按模型积分抵扣

      musicDeductionPoints: 100,
      imageDeductionPoints: 100,
      audioDeductionPoints: 30,
      promptDeductionPoints: 1,
      storageSpace: STORAGE_SPACE_BYTES.local,
      concurrentTasks: 10,
    },
    features: [
      '云空间100M',
      '开通获得10000积分',
      'AI音乐按照模型积分抵扣',
      'AI图片按照模型积分抵扣',
      'AI配音按照模型积分抵扣',
      '提示词优化每次扣1积分',
      '视频设置自己的大模型API（全部模块都可以设置自己的大模型）',
      '本地软件，终身使用',
    ],
  },
};

export const FREE_LIMITS: PermissionLimits = {
  ...MEMBERSHIP_TIERS.trial.limits,
  storageSpace: STORAGE_SPACE_BYTES.trial,
};

export const GUEST_LIMITS: PermissionLimits = {
  dailyMusic: 0,
  dailyImage: 0,
  dailyAudioMinutes: 0,
  dailyPromptOptimization: 0,
  dailyVideo: 0,
  minimaxImage01FreeQuota: 0, // MiniMax Image-01 无免费额度
  musicDeductionPoints: 0,
  imageDeductionPoints: 0,
  audioDeductionPoints: 0,
  promptDeductionPoints: 0,
  storageSpace: STORAGE_SPACE_BYTES.trial,
  concurrentTasks: 1,
};

export const DEFAULT_LIMITS: PermissionLimits = MEMBERSHIP_TIERS.trial.limits;

export function getConcurrentTasks(membershipLevel: string): number {
  const limits = getMembershipLimits(membershipLevel);
  return limits.concurrentTasks;
}

function normalizeMembershipLevel(level?: string): string {
  const normalized = level?.toLowerCase() || 'trial';

  if (normalized === 'vip' || normalized === 'light' || normalized === 'basic') {
    return 'light';
  }

  if (normalized === 'premium' || normalized === 'professional') {
    return 'pro';
  }

  if (normalized === 'user') {
    return 'trial';
  }

  if (normalized === 'admin') {
    return 'local';
  }

  if (normalized === 'enterprise' || normalized === 'local') {
    return 'local';
  }

  if (normalized === 'test' || normalized === 'beta' || normalized === 'free') {
    return 'trial';
  }

  return normalized;
}

export function getMembershipLimits(membershipLevel: string): PermissionLimits {
  const level = normalizeMembershipLevel(membershipLevel);

  if (level === 'guest') {
    return GUEST_LIMITS;
  }

  if (level === 'trial') {
    return FREE_LIMITS;
  }

  return MEMBERSHIP_TIERS[level]?.limits || FREE_LIMITS;
}

export function getMembershipTier(membershipLevel: string): MembershipTier | null {
  const level = normalizeMembershipLevel(membershipLevel);

  if (level === 'guest') {
    return null;
  }

  if (level === 'trial') {
    return MEMBERSHIP_TIERS.trial;
  }

  return MEMBERSHIP_TIERS[level] || null;
}

export function canUseFeature(
  membershipLevel: string,
  feature: keyof PermissionLimits,
  currentUsage: number
): { allowed: boolean; remaining: number; limit: number } {
  const limits = getMembershipLimits(membershipLevel);
  const limit = limits[feature];

  if (typeof limit !== 'number') {
    return { allowed: false, remaining: 0, limit: 0 };
  }

  if (limit === -1) {
    return { allowed: true, remaining: Infinity, limit: -1 };
  }

  if (limit === 0) {
    return { allowed: false, remaining: 0, limit: 0 };
  }

  const remaining = limit - currentUsage;
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    limit,
  };
}

export function getAllMembershipTiers(): MembershipTier[] {
  return Object.values(MEMBERSHIP_TIERS);
}

export function getMembershipTierByName(name: string): MembershipTier | null {
  const normalizedName = normalizeMembershipLevel(name);

  if (normalizedName === 'trial') {
    return MEMBERSHIP_TIERS.trial;
  }

  return MEMBERSHIP_TIERS[normalizedName] || null;
}

export function getStorageSpaceByMembershipLevel(membershipLevel: string): number {
  return getMembershipLimits(membershipLevel).storageSpace;
}
