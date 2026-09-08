import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getBalanceMock,
  deductPointsMock,
  deductPointsForTaskMock,
  getDailyUsageMock,
} = vi.hoisted(() => ({
  getBalanceMock: vi.fn(),
  deductPointsMock: vi.fn(),
  deductPointsForTaskMock: vi.fn(),
  getDailyUsageMock: vi.fn(),
}));

vi.mock('./points-service', () => ({
  getBalance: getBalanceMock,
  deductPoints: deductPointsMock,
  deductPointsForTask: deductPointsForTaskMock,
  addPoints: vi.fn(),
}));

vi.mock('./daily-usage-service', () => ({
  dailyUsageService: {
    getDailyUsage: getDailyUsageMock,
    incrementUsage: vi.fn(),
    decrementUsage: vi.fn(),
  },
}));

vi.mock('./pricing-rules-service', () => ({
  resolvePricingCost: vi.fn().mockResolvedValue(50),
}));

vi.mock('../config/membership-permissions', () => ({
  getMembershipLimits: vi.fn(),
  calculateVideoPoints: vi.fn(() => 50),
  calculateAudioPoints: vi.fn(() => 1),
  IMAGE_PRICING_RULES: { default: 1 },
  MUSIC_PRICING_RULES: { default: 1 },
}));

vi.mock('../lib/prisma', () => ({
  default: {
    pointsTransaction: { findFirst: vi.fn() },
    task: { updateMany: vi.fn() },
  },
}));

import { creditService } from './credit-service';

const baseVideoOptions = {
  userId: 'user-1',
  type: 'video' as const,
  taskId: 'task-1',
  reason: 'video test',
  model: 'model-1',
  durationSeconds: 5,
};

describe('CreditService video point-source policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDailyUsageMock.mockResolvedValue({
      musicCount: 0,
      imageCount: 0,
      audioMinutes: 0,
      promptOptimizationCount: 0,
      videoCount: 0,
      date: '2026-07-20',
    });
  });

  it('allows trial members to use the XT experience model with reward points', async () => {
    getBalanceMock.mockResolvedValue({
      points: 100,
      pointsBalance: 100,
      rechargePointsBalance: 0,
      frozenPoints: 0,
    });

    const result = await creditService.preCheck({
      ...baseVideoOptions,
      membershipLevel: 'trial',
      provider: 'agnes',
      model: 'agnes-video-v2.0',
    });

    expect(result).toMatchObject({ allowed: true, pointsSource: 'any' });
  });

  it('blocks trial members from Xiaotian 2 even when recharge points are available', async () => {
    const result = await creditService.preCheck({
      ...baseVideoOptions,
      membershipLevel: 'trial',
      provider: 'doubao',
      model: 'doubao-seedance-2',
    });

    expect(result).toMatchObject({ allowed: false, pointsNeeded: 0 });
    expect(result.reason).toContain('轻享版');
    expect(getBalanceMock).not.toHaveBeenCalled();
  });

  it('blocks light members from Xiaotian 2 when they only have reward points', async () => {
    getBalanceMock.mockResolvedValue({
      points: 100,
      pointsBalance: 100,
      rechargePointsBalance: 0,
      frozenPoints: 0,
    });

    const result = await creditService.preCheck({
      ...baseVideoOptions,
      membershipLevel: 'light',
      provider: 'doubao',
      model: 'doubao-seedance-2',
    });

    expect(result).toMatchObject({ allowed: false, pointsSource: 'recharge' });
    expect(result.reason).toContain('充值积分不足');
  });

  it('deducts recharge points for light members using Xiaotian 2', async () => {
    getBalanceMock.mockResolvedValue({
      points: 100,
      pointsBalance: 100,
      rechargePointsBalance: 100,
      frozenPoints: 0,
    });
    deductPointsForTaskMock.mockResolvedValue({ success: true });

    await creditService.consume({
      ...baseVideoOptions,
      membershipLevel: 'light',
      provider: 'doubao',
      model: 'doubao-seedance-2',
    });

    expect(deductPointsForTaskMock).toHaveBeenCalledWith(
      'user-1',
      'task-1',
      50,
      'video test',
      { rechargeOnly: true },
    );
  });

  it('requires recharge points for other non-experience video groups', async () => {
    getBalanceMock.mockResolvedValue({
      points: 100,
      pointsBalance: 100,
      rechargePointsBalance: 0,
      frozenPoints: 0,
    });

    const result = await creditService.preCheck({
      ...baseVideoOptions,
      membershipLevel: 'trial',
      provider: 'apipaths',
    });

    expect(result).toMatchObject({ allowed: false, pointsSource: 'recharge' });
  });
});
