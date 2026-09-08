/**
 * ai-image-membership — AI图片会员限制（存根）
 *
 * 登录与会员系统已移除，此文件保留空实现以维持编译兼容。
 * 所有模型和提供商均不隐藏。
 */

/** 检查图片提供商是否对会员等级隐藏 — 始终不隐藏 */
export function isImageProviderHiddenForMembership(_provider: string | undefined, _level: string): boolean {
  return false;
}

/** 检查图片模型是否对会员等级隐藏 — 始终不隐藏 */
export function isImageModelHiddenForMembership(_modelId: string, _provider: string | undefined, _level: string): boolean {
  return false;
}

/** 合并图片模型预设（按会员等级过滤） — 原样返回 */
export function mergeImageModelPresets<T>(presets: T[], _level?: string): T[] {
  return presets;
}