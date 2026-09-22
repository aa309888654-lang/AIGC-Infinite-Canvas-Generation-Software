/**
 * points-config-service — 积分配置服务（存根）
 *
 * 会员系统已移除，此文件保留空实现以维持编译兼容。
 * 所有积分查询返回默认值。
 */

export const pointsConfigService = {
  /** 获取图片积分 — 默认0 */
  getImagePoints(_modelId: string): number {
    return 0;
  },

  /** 获取视频积分 — 默认0 */
  getVideoPoints(_modelId: string, _duration?: number, _resolution?: string): number {
    return 0;
  },

  /** 获取积分配置 — 空对象 */
  getPointsConfig(): Record<string, unknown> {
    return {};
  },
};