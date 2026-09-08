/**
 * 定时清理服务：积分过期 + 会员过期
 * 每日在指定小时执行，同一天只执行一次
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { expirePointsForUser } from './points-service';
import { quotaService } from './quota-service';

const CLEANUP_HOUR = 4; // 凌晨 4 点执行
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 每小时检查一次

class ExpiryCleanupService {
  private lastRunDate: string | null = null;

  constructor() {
    if (process.env.NODE_ENV === 'test') return;
    this.start();
    logger.info(`[ExpiryCleanup] 定时清理服务已启动，执行时间: 每日 ${CLEANUP_HOUR}:00`);
  }

  private start() {
    setInterval(() => {
      this.tick().catch(err => logger.error('[ExpiryCleanup] tick failed:', err));
    }, CHECK_INTERVAL_MS);
  }

  private async tick() {
    const now = new Date();
    if (now.getHours() !== CLEANUP_HOUR) return;
    const today = now.toISOString().slice(0, 10);
    if (this.lastRunDate === today) return;
    this.lastRunDate = today;
    await this.runCleanup();
  }

  private async runCleanup() {
    logger.info('[ExpiryCleanup] 开始执行定时清理');
    await this.cleanupExpiredPoints();
    await this.cleanupExpiredMemberships();
    await this.cleanupPendingPayments();
    logger.info('[ExpiryCleanup] 定时清理完成');
  }

  /**
   * 清理所有用户的过期积分
   * 查找有过期积分流水的用户，逐个调用 expirePointsForUser
   */
  private async cleanupExpiredPoints() {
    try {
      const now = new Date();
      const usersWithExpiredPoints = await prisma.pointsTransaction.findMany({
        where: {
          expiresAt: { not: null, lte: now },
          amount: { gt: 0 },
          relatedType: { not: 'points_expired' },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      logger.info(`[ExpiryCleanup] 发现 ${usersWithExpiredPoints.length} 个用户有过期积分待清理`);

      let totalExpired = 0;
      for (const { userId } of usersWithExpiredPoints) {
        try {
          const expired = await expirePointsForUser(userId);
          if (expired > 0) totalExpired += expired;
        } catch (err) {
          logger.error(`[ExpiryCleanup] 清理用户 ${userId} 积分失败:`, err);
        }
      }
      logger.info(`[ExpiryCleanup] 积分清理完成，共扣减 ${totalExpired} 积分`);
    } catch (err) {
      logger.error('[ExpiryCleanup] 积分清理任务异常:', err);
    }
  }

  /**
   * 清理过期会员：更新 status=expired，回退 user.role，同步存储配额
   */
  private async cleanupExpiredMemberships() {
    try {
      const now = new Date();
      const expiredMemberships = await prisma.userMembership.findMany({
        where: {
          status: 'active',
          endAt: { lt: now },
        },
        select: { id: true, userId: true, level: true, membershipId: true },
      });

      logger.info(`[ExpiryCleanup] 发现 ${expiredMemberships.length} 个过期会员待处理`);

      for (const um of expiredMemberships) {
        try {
          await prisma.$transaction(async (tx) => {
            await tx.userMembership.update({
              where: { id: um.id },
              data: { status: 'expired', nextGrantAt: null },
            });
            await tx.user.update({
              where: { id: um.userId },
              data: { role: 'trial' },
            });
          });
          await quotaService.syncMembershipStorageQuota(um.userId, 'trial');
          logger.info(`[ExpiryCleanup] 用户 ${um.userId} 会员已过期，等级回退到 trial`);
        } catch (err) {
          logger.error(`[ExpiryCleanup] 处理用户 ${um.userId} 过期会员失败:`, err);
        }
      }
      logger.info(`[ExpiryCleanup] 会员过期清理完成`);
    } catch (err) {
      logger.error('[ExpiryCleanup] 会员过期清理任务异常:', err);
    }
  }

  /**
   * 清理超时未支付的 Payment 订单：超过 2 小时仍为 pending 的标记为 expired
   */
  private async cleanupPendingPayments() {
    try {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = await prisma.payment.updateMany({
        where: {
          status: 'pending',
          createdAt: { lt: cutoff },
        },
        data: { status: 'expired' },
      });
      if (result.count > 0) {
        logger.info(`[ExpiryCleanup] 已清理 ${result.count} 个超时未支付的 Payment 订单`);
      }
    } catch (err) {
      logger.error('[ExpiryCleanup] Payment 超时清理任务异常:', err);
    }
  }
}

export const expiryCleanupService = new ExpiryCleanupService();
