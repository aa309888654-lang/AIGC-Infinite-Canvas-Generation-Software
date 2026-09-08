import { randomUUID } from 'crypto';
import prisma from '../lib/prisma';
import { redisService } from './redis-service';
import { logger } from '../utils/logger';

const SETTINGS_KEY = 'access_control_settings';
const RULES_KEY = 'access_control_rules';
const CACHE_TTL_MS = 5_000;
const LOCAL_RETENTION_MS = 24 * 60 * 60 * 1000;

export type AccessTargetType = 'ip' | 'user';

export interface AccessControlSettings {
  autoProtectionEnabled: boolean;
  ipRequestsPerSecond: number;
  userRequestsPerSecond: number;
  cooldownSeconds: number;
  retentionHours: number;
}

export interface AccessControlRule {
  id: string;
  targetType: AccessTargetType;
  targetValue: string;
  targetLabel?: string;
  reason: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface AccessControlEvent {
  id: string;
  targetType: AccessTargetType;
  targetValue: string;
  userId?: string;
  ip?: string;
  path: string;
  method: string;
  action: 'manual_block' | 'rate_limited';
  reason: string;
  occurredAt: string;
}

export interface AccessDecision {
  allowed: boolean;
  status?: 403 | 429;
  code?: 'ACCESS_BLOCKED' | 'ACCESS_RATE_LIMITED';
  message?: string;
  reason?: string;
  retryAfterSeconds?: number;
  expiresAt?: string | null;
}

export interface AccessRequestContext {
  path: string;
  method: string;
  ip?: string;
  userId?: string;
}

const DEFAULT_SETTINGS: AccessControlSettings = {
  autoProtectionEnabled: true,
  ipRequestsPerSecond: 20,
  userRequestsPerSecond: 20,
  cooldownSeconds: 60,
  retentionHours: 24,
};

type CacheEntry<T> = { value: T; expiresAt: number };
type LocalCounter = { count: number; expiresAt: number };
type LocalTraffic = { count: number; lastSeenAt: string; lastIp?: string };

let settingsCache: CacheEntry<AccessControlSettings> | null = null;
let rulesCache: CacheEntry<AccessControlRule[]> | null = null;
const localCounters = new Map<string, LocalCounter>();
const localCooldowns = new Map<string, number>();
const localTraffic = {
  ip: new Map<string, LocalTraffic>(),
  user: new Map<string, LocalTraffic>(),
};
const localEvents: AccessControlEvent[] = [];
let localMinuteCount = 0;
let localMinuteBucket = 0;
let localSecondCount = 0;
let localSecondBucket = 0;

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeSettings(value: unknown): AccessControlSettings {
  const raw = value && typeof value === 'object' ? value as Partial<AccessControlSettings> : {};
  return {
    autoProtectionEnabled: raw.autoProtectionEnabled !== false,
    ipRequestsPerSecond: clampInteger(raw.ipRequestsPerSecond, 20, 1, 10_000),
    userRequestsPerSecond: clampInteger(raw.userRequestsPerSecond, 20, 1, 10_000),
    cooldownSeconds: clampInteger(raw.cooldownSeconds, 60, 1, 86_400),
    retentionHours: clampInteger(raw.retentionHours, 24, 1, 168),
  };
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isRuleActive(rule: AccessControlRule, now = Date.now()): boolean {
  return !rule.expiresAt || Date.parse(rule.expiresAt) > now;
}

export function normalizeAccessIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  const normalized = ip.trim();
  return normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
}

export function findActiveAccessRule(
  rules: AccessControlRule[],
  targetType: AccessTargetType,
  targetValue: string,
  now = Date.now()
): AccessControlRule | undefined {
  return rules.find(
    (rule) => rule.targetType === targetType
      && rule.targetValue === targetValue
      && isRuleActive(rule, now)
  );
}

function hourBucket(timestamp = Date.now()): number {
  return Math.floor(timestamp / 3_600_000);
}

function minuteBucket(timestamp = Date.now()): number {
  return Math.floor(timestamp / 60_000);
}

function secondBucket(timestamp = Date.now()): number {
  return Math.floor(timestamp / 1_000);
}

function cleanupLocalState(now = Date.now()): void {
  for (const [key, counter] of localCounters) {
    if (counter.expiresAt <= now) localCounters.delete(key);
  }
  for (const [key, expiresAt] of localCooldowns) {
    if (expiresAt <= now) localCooldowns.delete(key);
  }
  const cutoff = new Date(now - LOCAL_RETENTION_MS).toISOString();
  for (const map of [localTraffic.ip, localTraffic.user]) {
    for (const [key, value] of map) {
      if (value.lastSeenAt < cutoff) map.delete(key);
    }
  }
}

function incrementLocalWindow(key: string, now = Date.now()): number {
  cleanupLocalState(now);
  const existing = localCounters.get(key);
  if (existing && existing.expiresAt > now) {
    existing.count += 1;
    return existing.count;
  }
  localCounters.set(key, { count: 1, expiresAt: now + 2_000 });
  return 1;
}

export function evaluateLocalAccessWindow(
  key: string,
  limit: number,
  cooldownSeconds: number,
  now = Date.now()
): { allowed: boolean; count: number; retryAfterSeconds?: number } {
  const cooldownUntil = localCooldowns.get(key);
  if (cooldownUntil && cooldownUntil > now) {
    return {
      allowed: false,
      count: limit + 1,
      retryAfterSeconds: Math.max(1, Math.ceil((cooldownUntil - now) / 1000)),
    };
  }

  const count = incrementLocalWindow(`${key}:${secondBucket(now)}`, now);
  if (count <= limit) return { allowed: true, count };

  localCooldowns.set(key, now + cooldownSeconds * 1000);
  return { allowed: false, count, retryAfterSeconds: cooldownSeconds };
}

async function getStoredConfig(key: string): Promise<string | null> {
  const config = await prisma.systemConfig.findUnique({
    where: { key },
    select: { value: true },
  });
  return config?.value || null;
}

export async function getAccessControlSettings(): Promise<AccessControlSettings> {
  if (settingsCache && settingsCache.expiresAt > Date.now()) return settingsCache.value;
  const settings = normalizeSettings(parseJson(await getStoredConfig(SETTINGS_KEY), DEFAULT_SETTINGS));
  settingsCache = { value: settings, expiresAt: Date.now() + CACHE_TTL_MS };
  return settings;
}

export async function saveAccessControlSettings(
  input: Partial<AccessControlSettings>
): Promise<AccessControlSettings> {
  const settings = normalizeSettings(input);
  await prisma.systemConfig.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(settings), description: '访问管控与自动限流设置' },
    create: { key: SETTINGS_KEY, value: JSON.stringify(settings), description: '访问管控与自动限流设置' },
  });
  settingsCache = { value: settings, expiresAt: Date.now() + CACHE_TTL_MS };
  return settings;
}

export async function getAccessControlRules(includeExpired = false): Promise<AccessControlRule[]> {
  if (!rulesCache || rulesCache.expiresAt <= Date.now()) {
    const parsed = parseJson<AccessControlRule[]>(await getStoredConfig(RULES_KEY), []);
    const rules = Array.isArray(parsed) ? parsed : [];
    rulesCache = { value: rules, expiresAt: Date.now() + CACHE_TTL_MS };
  }
  return includeExpired ? rulesCache.value : rulesCache.value.filter((rule) => isRuleActive(rule));
}

async function persistRules(rules: AccessControlRule[]): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: RULES_KEY },
    update: { value: JSON.stringify(rules), description: 'IP 与用户访问封禁规则' },
    create: { key: RULES_KEY, value: JSON.stringify(rules), description: 'IP 与用户访问封禁规则' },
  });
  rulesCache = { value: rules, expiresAt: Date.now() + CACHE_TTL_MS };
}

export async function createAccessControlRule(input: {
  targetType: AccessTargetType;
  targetValue: string;
  targetLabel?: string;
  reason: string;
  durationMinutes?: number | null;
  createdBy: string;
  createdByName: string;
}): Promise<AccessControlRule> {
  const rules = await getAccessControlRules(true);
  const activeDuplicate = findActiveAccessRule(rules, input.targetType, input.targetValue);
  if (activeDuplicate) throw new Error('目标已处于封禁状态');

  const now = new Date();
  const duration = input.durationMinutes && input.durationMinutes > 0
    ? clampInteger(input.durationMinutes, 60, 1, 525_600)
    : null;
  const rule: AccessControlRule = {
    id: randomUUID(),
    targetType: input.targetType,
    targetValue: input.targetValue,
    targetLabel: input.targetLabel,
    reason: input.reason.trim(),
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    createdAt: now.toISOString(),
    expiresAt: duration ? new Date(now.getTime() + duration * 60_000).toISOString() : null,
  };
  await persistRules([rule, ...rules].slice(0, 2_000));
  return rule;
}

export async function removeAccessControlRule(ruleId: string): Promise<AccessControlRule | null> {
  const rules = await getAccessControlRules(true);
  const removed = rules.find((rule) => rule.id === ruleId) || null;
  if (!removed) return null;
  await persistRules(rules.filter((rule) => rule.id !== ruleId));
  return removed;
}

function shouldBypassAccessControl(path: string): boolean {
  const pathname = path.split('?')[0];
  return pathname.startsWith('/api/health')
    || pathname.startsWith('/api/v1/admin/access-control');
}

function updateLocalTraffic(
  targetType: AccessTargetType,
  targetValue: string,
  context: AccessRequestContext,
  now = Date.now()
): void {
  const bucket = secondBucket(now);
  if (localSecondBucket !== bucket) {
    localSecondBucket = bucket;
    localSecondCount = 0;
  }
  localSecondCount += targetType === 'ip' ? 1 : 0;

  const minute = minuteBucket(now);
  if (localMinuteBucket !== minute) {
    localMinuteBucket = minute;
    localMinuteCount = 0;
  }
  localMinuteCount += targetType === 'ip' ? 1 : 0;

  const map = localTraffic[targetType];
  const current = map.get(targetValue) || { count: 0, lastSeenAt: new Date(now).toISOString() };
  current.count += 1;
  current.lastSeenAt = new Date(now).toISOString();
  if (targetType === 'user' && context.ip) current.lastIp = context.ip;
  map.set(targetValue, current);
}

async function recordTraffic(
  targetType: AccessTargetType,
  targetValue: string,
  context: AccessRequestContext,
  now = Date.now()
): Promise<void> {
  updateLocalTraffic(targetType, targetValue, context, now);
  const client = redisService.isAvailable() ? redisService.getClient() : null;
  if (!client) return;

  const bucket = hourBucket(now);
  const retentionSeconds = 8 * 24 * 60 * 60;
  const multi = client.multi();
  multi.zincrby(`access:traffic:${targetType}:${bucket}`, 1, targetValue);
  multi.expire(`access:traffic:${targetType}:${bucket}`, retentionSeconds);
  multi.set(`access:lastseen:${targetType}:${targetValue}`, new Date(now).toISOString(), 'EX', retentionSeconds);
  if (targetType === 'ip') {
    multi.incr(`access:requests:second:${secondBucket(now)}`);
    multi.expire(`access:requests:second:${secondBucket(now)}`, 5);
    multi.incr(`access:requests:minute:${minuteBucket(now)}`);
    multi.expire(`access:requests:minute:${minuteBucket(now)}`, 180);
  } else if (context.ip) {
    multi.set(`access:lastip:user:${targetValue}`, context.ip, 'EX', retentionSeconds);
  }
  try {
    await multi.exec();
  } catch (error) {
    logger.warn('[AccessControl] Redis traffic recording failed:', error instanceof Error ? error.message : String(error));
  }
}

async function recordEvent(event: AccessControlEvent): Promise<void> {
  localEvents.unshift(event);
  if (localEvents.length > 200) localEvents.length = 200;
  const client = redisService.isAvailable() ? redisService.getClient() : null;
  if (!client) return;
  try {
    const multi = client.multi();
    multi.lpush('access:events', JSON.stringify(event));
    multi.ltrim('access:events', 0, 199);
    multi.expire('access:events', 8 * 24 * 60 * 60);
    multi.incr(`access:blocked:${hourBucket()}`);
    multi.expire(`access:blocked:${hourBucket()}`, 8 * 24 * 60 * 60);
    await multi.exec();
  } catch (error) {
    logger.warn('[AccessControl] Redis event recording failed:', error instanceof Error ? error.message : String(error));
  }
}

async function checkRateWindow(
  targetType: AccessTargetType,
  targetValue: string,
  limit: number,
  cooldownSeconds: number,
  now = Date.now()
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const baseKey = `access:${targetType}:${targetValue}`;
  const client = redisService.isAvailable() ? redisService.getClient() : null;
  if (!client) return evaluateLocalAccessWindow(baseKey, limit, cooldownSeconds, now);

  const cooldownKey = `access:cooldown:${targetType}:${targetValue}`;
  try {
    const cooldownTtl = await client.ttl(cooldownKey);
    if (cooldownTtl > 0) return { allowed: false, retryAfterSeconds: cooldownTtl };

    const count = await redisService.incrWithExpiry(
      `access:window:${targetType}:${targetValue}:${secondBucket(now)}`,
      2
    );
    if (count > 0 && count <= limit) return { allowed: true };
    if (count > limit) {
      await redisService.set(cooldownKey, '1', cooldownSeconds);
      return { allowed: false, retryAfterSeconds: cooldownSeconds };
    }
  } catch (error) {
    logger.warn('[AccessControl] Redis limiter failed, using local fallback:', error instanceof Error ? error.message : String(error));
  }
  return evaluateLocalAccessWindow(baseKey, limit, cooldownSeconds, now);
}

async function enforceTarget(
  targetType: AccessTargetType,
  targetValue: string,
  context: AccessRequestContext
): Promise<AccessDecision> {
  const now = Date.now();
  await recordTraffic(targetType, targetValue, context, now);

  const rules = await getAccessControlRules();
  const rule = findActiveAccessRule(rules, targetType, targetValue, now);
  if (rule) {
    await recordEvent({
      id: randomUUID(),
      targetType,
      targetValue,
      userId: context.userId,
      ip: context.ip,
      path: context.path,
      method: context.method,
      action: 'manual_block',
      reason: rule.reason,
      occurredAt: new Date(now).toISOString(),
    });
    return {
      allowed: false,
      status: 403,
      code: 'ACCESS_BLOCKED',
      message: targetType === 'ip' ? '当前 IP 已被管理员封禁' : '当前用户已被管理员封禁',
      reason: rule.reason,
      expiresAt: rule.expiresAt,
    };
  }

  const settings = await getAccessControlSettings();
  if (!settings.autoProtectionEnabled) return { allowed: true };
  const limit = targetType === 'ip' ? settings.ipRequestsPerSecond : settings.userRequestsPerSecond;
  const result = await checkRateWindow(targetType, targetValue, limit, settings.cooldownSeconds, now);
  if (result.allowed) return { allowed: true };

  await recordEvent({
    id: randomUUID(),
    targetType,
    targetValue,
    userId: context.userId,
    ip: context.ip,
    path: context.path,
    method: context.method,
    action: 'rate_limited',
    reason: `超过每秒 ${limit} 次访问阈值`,
    occurredAt: new Date(now).toISOString(),
  });
  return {
    allowed: false,
    status: 429,
    code: 'ACCESS_RATE_LIMITED',
    message: '访问频率过高，已进入自动冷却',
    reason: `超过每秒 ${limit} 次访问阈值`,
    retryAfterSeconds: result.retryAfterSeconds || settings.cooldownSeconds,
  };
}

export async function enforceIpAccess(context: AccessRequestContext): Promise<AccessDecision> {
  if (context.method === 'OPTIONS' || shouldBypassAccessControl(context.path)) return { allowed: true };
  const ip = normalizeAccessIp(context.ip);
  return enforceTarget('ip', ip, { ...context, ip });
}

export async function enforceUserAccess(
  context: AccessRequestContext & { userId: string; userRole?: string }
): Promise<AccessDecision> {
  if (context.userRole === 'admin' && shouldBypassAccessControl(context.path)) return { allowed: true };
  return enforceTarget('user', context.userId, {
    ...context,
    ip: normalizeAccessIp(context.ip),
  });
}

async function getRedisTop(
  targetType: AccessTargetType,
  retentionHours: number,
  limit: number
): Promise<Array<{ targetValue: string; requestCount: number; lastSeenAt: string | null; lastIp?: string | null }>> {
  const client = redisService.isAvailable() ? redisService.getClient() : null;
  if (!client) {
    return Array.from(localTraffic[targetType].entries())
      .map(([targetValue, value]) => ({ targetValue, requestCount: value.count, lastSeenAt: value.lastSeenAt, lastIp: value.lastIp }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, limit);
  }

  const totals = new Map<string, number>();
  const currentHour = hourBucket();
  const responses = await Promise.all(
    Array.from({ length: retentionHours }, (_, index) =>
      client.zrevrange(`access:traffic:${targetType}:${currentHour - index}`, 0, 99, 'WITHSCORES')
    )
  );
  for (const response of responses) {
    for (let index = 0; index < response.length; index += 2) {
      const targetValue = response[index];
      totals.set(targetValue, (totals.get(targetValue) || 0) + Number(response[index + 1] || 0));
    }
  }
  const ranked = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  return Promise.all(ranked.map(async ([targetValue, requestCount]) => ({
    targetValue,
    requestCount,
    lastSeenAt: await client.get(`access:lastseen:${targetType}:${targetValue}`),
    lastIp: targetType === 'user' ? await client.get(`access:lastip:user:${targetValue}`) : undefined,
  })));
}

async function getRecentEvents(): Promise<AccessControlEvent[]> {
  const client = redisService.isAvailable() ? redisService.getClient() : null;
  if (!client) return localEvents.slice(0, 50);
  try {
    const rows = await client.lrange('access:events', 0, 49);
    return rows.flatMap((row) => {
      try {
        return [JSON.parse(row) as AccessControlEvent];
      } catch {
        return [];
      }
    });
  } catch {
    return localEvents.slice(0, 50);
  }
}

async function getBlockedHits(retentionHours: number): Promise<number> {
  const client = redisService.isAvailable() ? redisService.getClient() : null;
  if (!client) return localEvents.length;
  const currentHour = hourBucket();
  const values = await client.mget(
    ...Array.from({ length: retentionHours }, (_, index) => `access:blocked:${currentHour - index}`)
  );
  return values.reduce((sum, value) => sum + Number(value || 0), 0);
}

export async function getAccessControlDashboard() {
  const settings = await getAccessControlSettings();
  const [rules, topIps, topUsersRaw, events, blockedHits] = await Promise.all([
    getAccessControlRules(),
    getRedisTop('ip', settings.retentionHours, 20),
    getRedisTop('user', settings.retentionHours, 20),
    getRecentEvents(),
    getBlockedHits(settings.retentionHours),
  ]);
  const userIds = topUsersRaw.map((item) => item.targetValue);
  const users = userIds.length > 0
    ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, email: true, role: true, isActive: true },
    })
    : [];
  const usersById = new Map(users.map((user) => [user.id, user]));
  const client = redisService.isAvailable() ? redisService.getClient() : null;
  const currentSecond = secondBucket();
  const currentMinute = minuteBucket();
  const [currentRpsRaw, minuteRequestsRaw] = client
    ? await Promise.all([
      client.get(`access:requests:second:${currentSecond}`),
      client.get(`access:requests:minute:${currentMinute}`),
    ])
    : [String(localSecondBucket === currentSecond ? localSecondCount : 0), String(localMinuteBucket === currentMinute ? localMinuteCount : 0)];

  return {
    generatedAt: new Date().toISOString(),
    enforcementStatus: redisService.isAvailable() ? 'active' : 'degraded',
    settings,
    summary: {
      currentRps: Number(currentRpsRaw || 0),
      minuteRequests: Number(minuteRequestsRaw || 0),
      blockedIpCount: rules.filter((rule) => rule.targetType === 'ip').length,
      blockedUserCount: rules.filter((rule) => rule.targetType === 'user').length,
      blockedHits,
      redisAvailable: redisService.isAvailable(),
    },
    rules,
    topIps,
    topUsers: topUsersRaw.map((item) => ({
      ...item,
      user: usersById.get(item.targetValue) || null,
    })),
    events,
  };
}

export function resetAccessControlStateForTests(): void {
  settingsCache = null;
  rulesCache = null;
  localCounters.clear();
  localCooldowns.clear();
  localTraffic.ip.clear();
  localTraffic.user.clear();
  localEvents.length = 0;
  localMinuteCount = 0;
  localMinuteBucket = 0;
  localSecondCount = 0;
  localSecondBucket = 0;
}

