/**
 * 积分奖励配置服务
 * 从 SystemConfig 表读取积分奖励配置，支持管理后台动态调整
 */

import prisma from '../lib/prisma';
import { logOperation } from './operation-log-service';

// 配置键定义
export const POINTS_CONFIG_KEYS = {
  REGISTRATION_BONUS: 'points_registration_bonus',
  REGISTRATION_BONUS_EXPIRY_DAYS: 'points_registration_bonus_expiry_days',
  DAILY_CLAIM: 'points_daily_claim',
  DAILY_CLAIM_EXPIRY_DAYS: 'points_daily_claim_expiry_days',
  DAILY_CLAIM_REWARDS: 'points_daily_claim_rewards',
  BIND_CONTACT_REWARD: 'points_bind_contact_reward',
  BIND_CONTACT_REWARD_EXPIRY_DAYS: 'points_bind_contact_reward_expiry_days',
  INVITE_REGISTRATION_REWARD: 'points_invite_registration_reward',
  INVITE_RECHARGE_REWARD: 'points_invite_recharge_reward',
  INVITE_RECHARGE_THRESHOLD: 'points_invite_recharge_threshold',
INVITE_REWARD_EXPIRY_DAYS: 'points_invite_reward_expiry_days',
} as const;

// 默认值（数值型配置）
// 国内合规积分规则（2026-07-20 修订）：
//   注册 50 / 签到每次 10 / 绑定账号 50 / 邀请好友 50 / 好友消耗超 200 奖励 100
export const DEFAULT_VALUES = {
  registration_bonus: 50,
  registration_bonus_expiry_days: 7,
  daily_claim: 100,
  daily_claim_expiry_days: 7,
  // Awarded once after both email and phone have been bound.
  bind_contact_reward: 50,
  bind_contact_reward_expiry_days: 365,
  invite_registration_reward: 50,
  invite_recharge_reward: 100,
  invite_recharge_threshold: 200,
invite_reward_expiry_days: 30,
} as const;

// JSON 配置默认值（数组/对象型配置）
export const DEFAULT_JSON_VALUES = {
  // 每日签到：每次 10 积分（最多 6 次/日）
  daily_claim_rewards: [10, 10, 10, 10, 10, 10] as number[],
} as const;

// 配置项描述（供前端展示）
export const CONFIG_DEFINITIONS = [
  {
    key: POINTS_CONFIG_KEYS.REGISTRATION_BONUS,
    label: '注册赠送积分',
    description: '新用户注册时赠送的积分数量',
    defaultValue: DEFAULT_VALUES.registration_bonus,
    group: 'registration',
    type: 'number',
    min: 0,
  },
  {
    key: POINTS_CONFIG_KEYS.REGISTRATION_BONUS_EXPIRY_DAYS,
    label: '注册积分有效期（天）',
    description: '注册赠送积分的有效期天数',
    defaultValue: DEFAULT_VALUES.registration_bonus_expiry_days,
    group: 'registration',
    type: 'number',
    min: 1,
  },
  {
    key: POINTS_CONFIG_KEYS.DAILY_CLAIM,
    label: '签到功能开关',
    description: '大于0表示开启签到；奖励为每日6次：50/60/80/100/120/150积分，每次间隔1小时',
    defaultValue: DEFAULT_VALUES.daily_claim,
    group: 'daily_claim',
    type: 'number',
    min: 0,
  },
  {
    key: POINTS_CONFIG_KEYS.DAILY_CLAIM_EXPIRY_DAYS,
    label: '签到积分有效期（天）',
    description: '签到积分的有效期天数',
    defaultValue: DEFAULT_VALUES.daily_claim_expiry_days,
    group: 'daily_claim',
    type: 'number',
    min: 1,
  },
  {
    key: POINTS_CONFIG_KEYS.BIND_CONTACT_REWARD,
    label: '账号绑定奖励',
    description: '邮箱和手机号均首次绑定完成后赠送的积分；默认200积分',
    defaultValue: DEFAULT_VALUES.bind_contact_reward,
    group: 'binding',
    type: 'number',
    min: 0,
  },
  {
    key: POINTS_CONFIG_KEYS.BIND_CONTACT_REWARD_EXPIRY_DAYS,
    label: '绑定奖励有效期（天）',
    description: '绑定邮箱或手机号获得积分的有效期；默认365天',
    defaultValue: DEFAULT_VALUES.bind_contact_reward_expiry_days,
    group: 'binding',
    type: 'number',
    min: 1,
  },
  {
    key: POINTS_CONFIG_KEYS.INVITE_REGISTRATION_REWARD,
    label: '邀请注册奖励积分',
    description: '被邀请人完成注册时，邀请人获得的积分（设为0则不奖励）',
    defaultValue: DEFAULT_VALUES.invite_registration_reward,
    group: 'invite',
    type: 'number',
    min: 0,
  },
  {
    key: POINTS_CONFIG_KEYS.INVITE_RECHARGE_REWARD,
    label: '邀请消耗奖励积分',
    description: '被邀请人累计消耗达到门槛后，邀请人获得的积分',
    defaultValue: DEFAULT_VALUES.invite_recharge_reward,
    group: 'invite',
    type: 'number',
    min: 0,
  },
  {
    key: POINTS_CONFIG_KEYS.INVITE_RECHARGE_THRESHOLD,
    label: '邀请消耗奖励门槛（积分）',
    description: '被邀请人需消耗的积分数量才触发邀请人奖励',
    defaultValue: DEFAULT_VALUES.invite_recharge_threshold,
    group: 'invite',
    type: 'number',
    min: 0,
  },
  {
    key: POINTS_CONFIG_KEYS.INVITE_REWARD_EXPIRY_DAYS,
    label: '邀请奖励有效期（天）',
    description: '邀请奖励积分的有效期天数',
    defaultValue: DEFAULT_VALUES.invite_reward_expiry_days,
    group: 'invite',
    type: 'number',
    min: 1,
  },
] as const;

// JSON 配置项描述（数组/对象型）
export const JSON_CONFIG_DEFINITIONS = [
  {
    key: POINTS_CONFIG_KEYS.DAILY_CLAIM_REWARDS,
    label: '签到奖励档位',
    description: '每日签到每次领取的积分，按顺序对应第 1/2/3/4/5/6 次，默认 [50,60,80,100,120,150]',
    defaultValue: DEFAULT_JSON_VALUES.daily_claim_rewards,
    group: 'daily_claim',
    type: 'array_number',
  },
] as const;

// 内存缓存
let configCache: Record<string, number> | null = null;
let jsonConfigCache: Record<string, unknown> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30秒

async function loadConfig(): Promise<Record<string, number>> {
  if (configCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return configCache;
  }

  const configs = await prisma.systemConfig.findMany({
    where: {
      key: { startsWith: 'points_' },
    },
    select: { key: true, value: true },
  });

  const result: Record<string, number> = { ...DEFAULT_VALUES };
  // 映射 key 到 result 的字段名
  const keyMap: Record<string, keyof typeof DEFAULT_VALUES> = {
    [POINTS_CONFIG_KEYS.REGISTRATION_BONUS]: 'registration_bonus',
    [POINTS_CONFIG_KEYS.REGISTRATION_BONUS_EXPIRY_DAYS]: 'registration_bonus_expiry_days',
    [POINTS_CONFIG_KEYS.DAILY_CLAIM]: 'daily_claim',
    [POINTS_CONFIG_KEYS.DAILY_CLAIM_EXPIRY_DAYS]: 'daily_claim_expiry_days',
    [POINTS_CONFIG_KEYS.BIND_CONTACT_REWARD]: 'bind_contact_reward',
    [POINTS_CONFIG_KEYS.BIND_CONTACT_REWARD_EXPIRY_DAYS]: 'bind_contact_reward_expiry_days',
    [POINTS_CONFIG_KEYS.INVITE_REGISTRATION_REWARD]: 'invite_registration_reward',
    [POINTS_CONFIG_KEYS.INVITE_RECHARGE_REWARD]: 'invite_recharge_reward',
    [POINTS_CONFIG_KEYS.INVITE_RECHARGE_THRESHOLD]: 'invite_recharge_threshold',
    [POINTS_CONFIG_KEYS.INVITE_REWARD_EXPIRY_DAYS]: 'invite_reward_expiry_days',
  };

  for (const c of configs) {
    const fieldName = keyMap[c.key];
    if (fieldName) {
      const num = parseFloat(c.value);
      if (!isNaN(num)) {
        result[fieldName] = num;
      }
    }
  }

  configCache = result;
  cacheTimestamp = Date.now();
  return result;
}

// JSON 配置 key 映射
const jsonKeyMap: Record<string, keyof typeof DEFAULT_JSON_VALUES> = {
  [POINTS_CONFIG_KEYS.DAILY_CLAIM_REWARDS]: 'daily_claim_rewards',
};

async function loadJsonConfig(): Promise<typeof DEFAULT_JSON_VALUES> {
  if (jsonConfigCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return jsonConfigCache as typeof DEFAULT_JSON_VALUES;
  }

  const configs = await prisma.systemConfig.findMany({
    where: {
      key: { in: Object.keys(jsonKeyMap) },
    },
    select: { key: true, value: true },
  });

  const result = JSON.parse(JSON.stringify(DEFAULT_JSON_VALUES)) as typeof DEFAULT_JSON_VALUES;

  for (const c of configs) {
    const fieldName = jsonKeyMap[c.key];
    if (fieldName) {
      try {
        const parsed = JSON.parse(c.value);
        (result as Record<string, unknown>)[fieldName] = parsed;
      } catch {
        // 解析失败保留默认值
      }
    }
  }

  jsonConfigCache = result;
  cacheTimestamp = Date.now();
  return result;
}

export async function getPointsConfig() {
  return loadConfig();
}

export async function getRegistrationBonus(): Promise<{ points: number; expiryDays: number }> {
  const cfg = await loadConfig();
  return { points: cfg.registration_bonus, expiryDays: cfg.registration_bonus_expiry_days };
}

export async function getDailyClaimConfig(): Promise<{ points: number; expiryDays: number }> {
  const cfg = await loadConfig();
  return { points: cfg.daily_claim, expiryDays: cfg.daily_claim_expiry_days };
}

export async function getBindContactRewardConfig(): Promise<{ points: number; expiryDays: number }> {
  const cfg = await loadConfig();
  return { points: cfg.bind_contact_reward, expiryDays: cfg.bind_contact_reward_expiry_days };
}

export async function getInviteConfig(): Promise<{
  registrationReward: number;
  rechargeReward: number;
  rechargeThreshold: number;
  expiryDays: number;
}> {
  const cfg = await loadConfig();
  return {
    registrationReward: cfg.invite_registration_reward,
    rechargeReward: cfg.invite_recharge_reward,
    rechargeThreshold: cfg.invite_recharge_threshold,
    expiryDays: cfg.invite_reward_expiry_days,
  };
}

export async function getDailyClaimRewards(): Promise<number[]> {
  const cfg = await loadJsonConfig();
  return cfg.daily_claim_rewards;
}

export async function getJsonConfig() {
  return loadJsonConfig();
}

/**
 * 保存 JSON 配置（签到奖励档位）
 */
export async function saveJsonConfig(
  values: Partial<Record<string, unknown>>,
  adminId?: string,
  adminUsername?: string
): Promise<void> {
  const reverseJsonKeyMap: Record<string, string> = Object.fromEntries(
    Object.entries(jsonKeyMap).map(([k, v]) => [v, k])
  );

  const descriptionLookup: Record<string, string> = Object.fromEntries(
    JSON_CONFIG_DEFINITIONS.map((d) => [d.key, d.description])
  );

  const updates = Object.entries(values)
    .filter(([k]) => reverseJsonKeyMap[k])
    .map(([k, v]) => ({
      key: reverseJsonKeyMap[k],
      value: JSON.stringify(v),
      description: descriptionLookup[reverseJsonKeyMap[k]] || '',
    }));

  if (updates.length === 0) return;

  await prisma.$transaction(
    updates.map((u) =>
      prisma.systemConfig.upsert({
        where: { key: u.key },
        update: { value: u.value, description: u.description },
        create: { key: u.key, value: u.value, description: u.description },
      })
    )
  );

  if (adminId && adminUsername) {
    await logOperation({
      adminId,
      adminUsername,
      action: 'points_json_config_update',
      targetType: 'system_config',
      targetId: 'points_json_config',
      status: 'success',
      metadata: { updates: updates.map((u) => ({ key: u.key })) },
    }).catch(err => console.error('[PointsConfig] 审计日志写入失败:', err));
  }

  jsonConfigCache = null;
  configCache = null;
}

export async function savePointsConfig(
  values: Record<string, number>,
  adminId?: string,
  adminUsername?: string
): Promise<void> {
  const keyMap: Record<string, string> = {
    registration_bonus: POINTS_CONFIG_KEYS.REGISTRATION_BONUS,
    registration_bonus_expiry_days: POINTS_CONFIG_KEYS.REGISTRATION_BONUS_EXPIRY_DAYS,
    daily_claim: POINTS_CONFIG_KEYS.DAILY_CLAIM,
    daily_claim_expiry_days: POINTS_CONFIG_KEYS.DAILY_CLAIM_EXPIRY_DAYS,
    bind_contact_reward: POINTS_CONFIG_KEYS.BIND_CONTACT_REWARD,
    bind_contact_reward_expiry_days: POINTS_CONFIG_KEYS.BIND_CONTACT_REWARD_EXPIRY_DAYS,
    invite_registration_reward: POINTS_CONFIG_KEYS.INVITE_REGISTRATION_REWARD,
    invite_recharge_reward: POINTS_CONFIG_KEYS.INVITE_RECHARGE_REWARD,
    invite_recharge_threshold: POINTS_CONFIG_KEYS.INVITE_RECHARGE_THRESHOLD,
    invite_reward_expiry_days: POINTS_CONFIG_KEYS.INVITE_REWARD_EXPIRY_DAYS,
  };

  const descriptionMap: Record<string, string> = Object.fromEntries(
    CONFIG_DEFINITIONS.map((d) => [keyMap[d.key as keyof typeof keyMap] || d.key, d.description])
  );

  const updates = Object.entries(values)
    .filter(([k]) => keyMap[k])
    .map(([k, v]) => ({
      key: keyMap[k],
      value: String(v),
      description: descriptionMap[keyMap[k]] || '',
    }));

  await prisma.$transaction(
    updates.map((u) =>
      prisma.systemConfig.upsert({
        where: { key: u.key },
        update: { value: u.value, description: u.description },
        create: { key: u.key, value: u.value, description: u.description },
      })
    )
  );

  // 写入审计日志
  if (adminId && adminUsername) {
    await logOperation({
      adminId,
      adminUsername,
      action: 'points_config_update',
      targetType: 'system_config',
      targetId: 'points_config',
      status: 'success',
      metadata: { updates },
    }).catch(err => console.error('[PointsConfig] 审计日志写入失败:', err));
  }

  // 清除缓存
  configCache = null;
  jsonConfigCache = null;
  cacheTimestamp = 0;
}

/** 清除缓存（管理后台更新配置后调用） */
export function invalidatePointsConfigCache(): void {
  configCache = null;
  jsonConfigCache = null;
  cacheTimestamp = 0;
}
