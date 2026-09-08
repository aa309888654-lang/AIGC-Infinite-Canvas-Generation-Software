export type VideoPointsSource = 'any' | 'recharge';

export interface VideoCreditPolicy {
  pointsSource: VideoPointsSource;
  requiresLightMembership: boolean;
  isExperienceGroup: boolean;
}

const LIGHT_MEMBERSHIP_LEVELS = new Set([
  'light',
  'basic',
  'vip',
  'pro',
  'premium',
  'professional',
  'local',
  'enterprise',
  'admin',
]);

export function isLightMembershipOrAbove(level: string): boolean {
  return LIGHT_MEMBERSHIP_LEVELS.has(String(level || '').toLowerCase());
}

export function getVideoCreditPolicy(provider?: string, model?: string): VideoCreditPolicy {
  const normalizedProvider = String(provider || '').toLowerCase();
  const normalizedModel = String(model || '').toLowerCase();
  const isExperienceGroup =
    normalizedProvider === 'agnes' ||
    normalizedModel === 'agnes-video-v2.0' ||
    normalizedModel === 'agnes_video_v2';
  const requiresLightMembership =
    normalizedProvider === 'wuyinkeji' ||
    normalizedProvider === 'doubao' ||
    normalizedModel.startsWith('doubao-');

  return {
    isExperienceGroup,
    requiresLightMembership,
    pointsSource: isExperienceGroup ? 'any' : 'recharge',
  };
}
