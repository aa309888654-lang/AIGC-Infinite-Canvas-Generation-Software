import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({ default: {} }));

import {
  DEFAULT_RECHARGE_PACKAGES,
  normalizeRechargePackage,
} from './points-packages-service';

describe('recharge package policy', () => {
  it('uses 30 yuan as the minimum package and keeps 100 points per yuan', () => {
    expect(DEFAULT_RECHARGE_PACKAGES[0]).toMatchObject({
      id: 'pkg_30',
      price: 30,
      points: 3000,
    });

    expect(normalizeRechargePackage({ id: 'pkg_10', price: 10, points: 1000 })).toMatchObject({
      id: 'pkg_30',
      price: 30,
      points: 3000,
    });
  });

  it.each([
    ['pkg_100', 100, 10000, 100],
    ['pkg_200', 200, 20000, 300],
    ['pkg_500', 500, 50000, 1000],
  ])('applies the configured reward for %s', (id, price, points, bonusPoints) => {
    expect(normalizeRechargePackage({ id, price })).toMatchObject({
      id,
      price,
      points,
      bonusPoints,
    });
  });
});
