/**
 * ai-provider-membership — AI提供商会员限制（存根）
 *
 * 登录与会员系统已移除，此文件保留空实现以维持编译兼容。
 * 所有模型和提供商均不限制。
 */

export type MembershipLevel = 'trial' | 'free' | 'basic' | 'pro' | 'vip' | 'premium' | 'enterprise';

/** 标准化会员等级 — 默认返回 trial */
export function normalizeMembershipLevel(level?: string | null): MembershipLevel {
  if (!level) return 'trial';
  const normalized = level.toLowerCase();
  if (['trial', 'free', 'basic', 'pro', 'vip', 'premium', 'enterprise'].includes(normalized)) {
    return normalized as MembershipLevel;
  }
  return 'trial';
}

/** 检查模型是否对会员等级开放 — 始终开放 */
export function isModelAllowedForMembership(
  _modelOrId: any,
  _level?: string | null
): boolean {
  return true;
}

/** 检查提供商是否对会员等级开放 — 始终开放 */
export function isProviderAllowedForMembership(
  _provider: string,
  _level?: string | null
): boolean {
  return true;
}

/** 获取会员等级允许的模型列表 — 返回 null 表示不限制 */
export function getModelsAllowedForMembership(
  _provider: string,
  _level?: string | null
): string[] | null {
  return null; // null = 不限制
}

/** 获取会员等级默认模型优先级 — 返回空数组 */
export function getDefaultModelPriority(
  _level?: string | null
): Record<string, string[]> {
  return {};
}