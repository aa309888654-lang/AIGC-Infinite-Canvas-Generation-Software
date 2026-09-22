/**
 * quota-helper — 配额辅助工具（存根）
 *
 * 登录与会员系统已移除，此文件保留空实现以维持编译兼容。
 */

export type QuotaFeature = string;

export interface QuotaBadge {
  text: string;
  color: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  message?: string;
}

/** 检查配额 — 始终放行 */
export async function checkQuotaOrFail(_feature: string, _params?: any): Promise<QuotaCheckResult> {
  return { allowed: true };
}

/** 获取配额徽标 — 返回空徽标 */
export function getQuotaBadge(_feature: string, _permissions?: any): QuotaBadge {
  return { text: '', color: '' };
}