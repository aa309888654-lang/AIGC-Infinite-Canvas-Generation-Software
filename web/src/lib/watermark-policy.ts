/**
 * watermark-policy — 水印策略（存根）
 *
 * 登录与会员系统已移除，此文件保留空实现以维持编译兼容。
 */

/** 获取默认水印启用状态 — 体验版默认开启 */
export function getDefaultWatermarkEnabled(_membershipLevel?: string): boolean {
  return true;
}

/** 解析水印设置 */
export function resolveWatermarkSetting(
  watermarkParam: unknown,
  _membershipLevel?: string
): boolean {
  // 如果显式设置了水印参数则使用，否则默认开启
  return typeof watermarkParam === 'boolean' ? watermarkParam : true;
}