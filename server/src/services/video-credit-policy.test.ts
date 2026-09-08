import { describe, expect, it } from 'vitest';
import { getVideoCreditPolicy, isLightMembershipOrAbove } from './video-credit-policy';

describe('video credit policy', () => {
  it('allows the experience model group to use any points and membership', () => {
    expect(getVideoCreditPolicy('agnes', 'agnes-video-v2.0')).toEqual({
      isExperienceGroup: true,
      requiresLightMembership: false,
      pointsSource: 'any',
    });
    expect(isLightMembershipOrAbove('trial')).toBe(false);
  });

  it('requires recharge points and light membership for Xiaotian 1 and 2', () => {
    expect(getVideoCreditPolicy('wuyinkeji', 'google_omni')).toMatchObject({
      requiresLightMembership: true,
      pointsSource: 'recharge',
    });
    expect(getVideoCreditPolicy('doubao', 'doubao-seedance-2')).toMatchObject({
      requiresLightMembership: true,
      pointsSource: 'recharge',
    });
    expect(isLightMembershipOrAbove('light')).toBe(true);
    expect(isLightMembershipOrAbove('pro')).toBe(true);
  });

  it('requires recharge points but no membership gate for other video groups', () => {
    expect(getVideoCreditPolicy('apipaths', 'video-model')).toEqual({
      isExperienceGroup: false,
      requiresLightMembership: false,
      pointsSource: 'recharge',
    });
  });
});
