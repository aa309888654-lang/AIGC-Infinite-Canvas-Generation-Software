import prisma from '../lib/prisma';

export const PACKAGES_CONFIG_KEY = 'packages_config';

export interface RechargePackage {
  id: string;
  name: string;
  points: number;
  price: number;
  originalPrice?: number;
  description?: string;
  bonusPoints?: number;
  isPopular?: boolean;
  isActive: boolean;
}

export const DEFAULT_RECHARGE_PACKAGES: RechargePackage[] = [
  {
    id: 'pkg_30',
    name: '基础',
    points: 3000,
    price: 30,
    description: '适合轻度使用',
    isActive: true,
  },
  {
    id: 'pkg_50',
    name: '推荐',
    points: 5000,
    price: 50,
    description: '最受欢迎的选择',
    isPopular: true,
    isActive: true,
  },
  {
    id: 'pkg_100',
    name: '超值',
    points: 10000,
    price: 100,
    description: '重度用户首选',
    bonusPoints: 100,
    isActive: true,
  },
  {
    id: 'pkg_200',
    name: '特惠',
    points: 20000,
    price: 200,
    description: '性价比超高',
    bonusPoints: 300,
    isActive: true,
  },
  {
    id: 'pkg_500',
    name: '大额',
    points: 50000,
    price: 500,
    description: '专业创作者首选',
    bonusPoints: 1000,
    isActive: true,
  },
];

function toNumber(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeRechargePackage(input: Partial<RechargePackage> | Record<string, unknown>): RechargePackage {
  const storedId = typeof input.id === 'string' ? input.id.trim() : '';
  const id = storedId === 'pkg_10' ? 'pkg_30' : (storedId || 'pkg_' + Date.now());
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : '未命名套餐';
  const configuredPrice = Math.max(0.01, toNumber(input.price, 0.01));
  const price = id === 'pkg_30' ? 30 : configuredPrice;
  const points = Math.max(1, Math.floor(price * 100));
  const configuredBonus = Math.max(0, Math.floor(toNumber(input.bonusPoints, 0)));
  const requiredBonus =
    id === 'pkg_100' ? 100 :
    id === 'pkg_200' ? 300 :
    id === 'pkg_500' ? 1000 :
    0;
  const bonusPoints = Math.max(configuredBonus, requiredBonus);
  return {
    id,
    name,
    points,
    price,
    ...(input.originalPrice !== undefined ? { originalPrice: Math.max(0, toNumber(input.originalPrice, 0)) } : {}),
    ...(typeof input.description === 'string' ? { description: input.description } : {}),
    ...(bonusPoints > 0 ? { bonusPoints } : {}),
    isPopular: Boolean(input.isPopular),
    isActive: input.isActive !== false,
  };
}

function parsePackages(raw: unknown): RechargePackage[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((pkg) => normalizeRechargePackage(pkg)).filter((pkg) => pkg.points > 0 && pkg.price > 0);
  } catch {
    return [];
  }
}

export async function getStoredRechargePackages(): Promise<{ id: string | null; packages: RechargePackage[] }> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: PACKAGES_CONFIG_KEY },
    select: { id: true, value: true },
  });

  if (!config) {
    return { id: null, packages: [] };
  }

  return { id: config.id, packages: parsePackages(config.value) };
}

export async function getRechargePackages(): Promise<RechargePackage[]> {
  const stored = await getStoredRechargePackages();
  return stored.packages.length > 0 ? stored.packages : DEFAULT_RECHARGE_PACKAGES;
}

export async function getActiveRechargePackages(): Promise<RechargePackage[]> {
  return (await getRechargePackages()).filter((pkg) => pkg.isActive);
}

export async function getRechargePackageById(packageId: string): Promise<RechargePackage | null> {
  const packages = await getRechargePackages();
  return packages.find((pkg) => pkg.id === packageId && pkg.isActive) || null;
}

export async function saveRechargePackages(packages: RechargePackage[], id?: string | null): Promise<void> {
  const normalized = packages.map((pkg) => normalizeRechargePackage(pkg));
  const value = JSON.stringify(normalized);

  if (id) {
    await prisma.systemConfig.update({
      where: { id },
      data: {
        value,
        description: '积分充值套餐配置',
      },
    });
    return;
  }

  await prisma.systemConfig.upsert({
    where: { key: PACKAGES_CONFIG_KEY },
    update: {
      value,
      description: '积分充值套餐配置',
    },
    create: {
      key: PACKAGES_CONFIG_KEY,
      value,
      description: '积分充值套餐配置',
    },
  });
}
