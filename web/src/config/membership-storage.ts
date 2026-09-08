/**
 * membership-storage — 会员存储配置（存根）
 *
 * 登录与会员系统已移除，此文件保留空实现以维持编译兼容。
 */

/** 获取默认存储限制 — 返回 100MB */
export function getDefaultStorageLimit(_level?: string | null): number {
  return 100 * 1024 * 1024; // 100MB
}