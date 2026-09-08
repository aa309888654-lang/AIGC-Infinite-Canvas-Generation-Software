/**
 * auth-check.ts — 认证检查工具（存根）
 *
 * 登录与会员系统已移除，此文件保留空实现以维持编译兼容。
 * 所有函数均为 no-op，getAuthToken 始终返回 null。
 */

/** 获取认证令牌 — 始终返回 null（无登录系统） */
export function getAuthToken(): string | null {
  return null;
}

/** 清除认证令牌 — no-op */
export function clearAuthToken(): void {
  // no-op: 登录系统已移除
}

/** 设置认证令牌 — no-op */
export function setAuthToken(_token: string): void {
  // no-op: 登录系统已移除
}

/** 持久化存储的令牌处理（存根：原样返回令牌） */
export function tokenForPersistentStorage(token: string): string {
  return token;
}

/** 确保已认证 — 始终返回 null（无登录系统） */
export async function ensureAuthToken(): Promise<string | null> {
  return null;
}

/** Cookie 认证模式请求头 — 空对象 */
export function cookieAuthModeHeaders(): Record<string, string> {
  return {};
}

/** 安全刷新会员信息 — no-op */
export async function safeRefreshMembership(): Promise<void> {
  // no-op: 会员系统已移除
}