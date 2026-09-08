/**
 * 积分服务 — 原子化积分扣费/充值
 * 确保余额检查与扣减在同一事务中，防止竞态条件导致超额扣除
 */

import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { isLocalUser } from '../utils/local-user';

export interface DeductPointsResult {
  success: boolean;
  balanceBefore: number;
  balanceAfter: number;
  pointsDeducted: number;
  transactionId: string;
  alreadyDeducted?: boolean;
}

export interface DeductPointsOptions {
  rechargeOnly?: boolean;
}

export interface AddPointsResult {
  success: boolean;
  balanceBefore: number;
  balanceAfter: number;
  pointsAdded: number;
  transactionId: string;
}

/**
 * 原子化积分扣费
 * 在单个事务中完成：余额检查 → 条件扣减 → 流水记录
 *
 * @param userId 用户ID
 * @param points 要扣除的积分数量（正数）
 * @param reason 扣费原因
 * @param relatedTaskId 关联任务ID（可选）
 * @throws AppError(402) 余额不足
 */
export async function deductPoints(
  userId: string,
  points: number,
  reason: string,
  relatedTaskId?: string,
  options?: DeductPointsOptions
): Promise<DeductPointsResult> {
  // 开源本地模式：本地用户免积分
  if (isLocalUser(userId)) {
    return {
      success: true,
      balanceBefore: 1000000,
      balanceAfter: 1000000,
      pointsDeducted: 0,
      transactionId: `local-${Date.now()}`,
    };
  }
  if (points <= 0) {
    throw new AppError('扣费积分必须大于0', 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 在事务内读取当前余额
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true, rechargePointsBalance: true, points: true },
    });

    if (!user) {
      throw new AppError('用户不存在', 404);
    }

    const balanceBefore = user.pointsBalance;
    const rechargeBalanceBefore = Math.min(user.rechargePointsBalance, balanceBefore);
    const rewardBalanceBefore = Math.max(0, balanceBefore - rechargeBalanceBefore);
    const rechargePointsDeducted = options?.rechargeOnly
      ? points
      : Math.max(0, points - rewardBalanceBefore);

    if (balanceBefore < points || rechargeBalanceBefore < rechargePointsDeducted) {
      throw new AppError(options?.rechargeOnly ? '充值积分余额不足' : '积分余额不足', 402);
    }

    const balanceAfter = balanceBefore - points;
    const rechargeBalanceAfter = rechargeBalanceBefore - rechargePointsDeducted;

    // 条件更新：仅在余额足够时才扣减
    const updateResult = await tx.user.updateMany({
      where: {
        id: userId,
        pointsBalance: { gte: points },
        rechargePointsBalance: { gte: rechargePointsDeducted },
      },
      data: {
        pointsBalance: balanceAfter,
        rechargePointsBalance: rechargeBalanceAfter,
        points: Math.floor(balanceAfter),
      },
    });

    if (updateResult.count === 0) {
      throw new AppError('积分余额不足，扣费失败（并发冲突）', 402);
    }

    // 创建积分流水记录
    const transaction = await tx.pointsTransaction.create({
      data: {
        userId,
        type: 'CONSUME',
        amount: -points,
        rechargeAmount: -rechargePointsDeducted,
        balanceBefore,
        balanceAfter,
        reason,
        orderNo: relatedTaskId,
      },
    });

    return {
      balanceBefore,
      balanceAfter,
      transactionId: transaction.id,
    };
  });

  // 积分扣减后异步触发邀请消耗奖励检查（不阻塞主流程，动态 import 避免循环依赖）
  import('./invite-reward-service')
    .then(({ processInviteConsumptionReward }) => processInviteConsumptionReward(userId))
    .catch((err) => console.error('[PointsService] 邀请消耗奖励检查失败:', err));

  return {
    success: true,
    balanceBefore: result.balanceBefore,
    balanceAfter: result.balanceAfter,
    pointsDeducted: points,
    transactionId: result.transactionId,
  };
}

/**
 * 针对任务完成场景的原子化扣费。
 * 通过 task.credits 作为幂等标记，避免生成完成回调和轮询查询重复扣费。
 */
export async function deductPointsForTask(
  userId: string,
  taskId: string,
  points: number,
  reason: string,
  options?: DeductPointsOptions
): Promise<DeductPointsResult> {
  // 开源本地模式：本地用户免积分
  if (isLocalUser(userId)) {
    return {
      success: true,
      balanceBefore: 1000000,
      balanceAfter: 1000000,
      pointsDeducted: 0,
      transactionId: `local-${Date.now()}`,
      alreadyDeducted: true,
    };
  }
  if (points <= 0) {
    throw new AppError('扣费积分必须大于0', 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: taskId },
      select: { id: true, userId: true, credits: true },
    });

    if (!task || task.userId !== userId) {
      throw new AppError('任务不存在或无权访问', 404);
    }

    if (task.credits >= points) {
      const existingTransaction = await tx.pointsTransaction.findFirst({
        where: {
          userId,
          type: 'CONSUME',
          relatedType: 'task',
          relatedId: taskId,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        balanceBefore: existingTransaction?.balanceBefore ?? 0,
        balanceAfter: existingTransaction?.balanceAfter ?? 0,
        transactionId: existingTransaction?.id ?? '',
        alreadyDeducted: true,
      };
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true, rechargePointsBalance: true },
    });

    if (!user) {
      throw new AppError('用户不存在', 404);
    }

    const balanceBefore = user.pointsBalance;
    const rechargeBalanceBefore = Math.min(user.rechargePointsBalance, balanceBefore);
    const rewardBalanceBefore = Math.max(0, balanceBefore - rechargeBalanceBefore);
    const rechargePointsDeducted = options?.rechargeOnly
      ? points
      : Math.max(0, points - rewardBalanceBefore);
    if (balanceBefore < points || rechargeBalanceBefore < rechargePointsDeducted) {
      throw new AppError(options?.rechargeOnly ? '充值积分余额不足' : '积分余额不足', 402);
    }

    const balanceAfter = balanceBefore - points;
    const rechargeBalanceAfter = rechargeBalanceBefore - rechargePointsDeducted;

    const taskUpdate = await tx.task.updateMany({
      where: {
        id: taskId,
        userId,
        credits: { lt: points },
      },
      data: {
        credits: points,
      },
    });

    if (taskUpdate.count === 0) {
      const existingTransaction = await tx.pointsTransaction.findFirst({
        where: {
          userId,
          type: 'CONSUME',
          relatedType: 'task',
          relatedId: taskId,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        balanceBefore: existingTransaction?.balanceBefore ?? balanceBefore,
        balanceAfter: existingTransaction?.balanceAfter ?? balanceBefore,
        transactionId: existingTransaction?.id ?? '',
        alreadyDeducted: true,
      };
    }

    const updateResult = await tx.user.updateMany({
      where: {
        id: userId,
        pointsBalance: { gte: points },
        rechargePointsBalance: { gte: rechargePointsDeducted },
      },
      data: {
        pointsBalance: balanceAfter,
        rechargePointsBalance: rechargeBalanceAfter,
        points: Math.floor(balanceAfter),
      },
    });

    if (updateResult.count === 0) {
      throw new AppError('积分余额不足，扣费失败（并发冲突）', 402);
    }

    const transaction = await tx.pointsTransaction.create({
      data: {
        userId,
        type: 'CONSUME',
        amount: -points,
        rechargeAmount: -rechargePointsDeducted,
        balanceBefore,
        balanceAfter,
        reason,
        orderNo: taskId,
        relatedType: 'task',
        relatedId: taskId,
      },
    });

    return {
      balanceBefore,
      balanceAfter,
      transactionId: transaction.id,
      alreadyDeducted: false,
    };
  });

  return {
    success: true,
    balanceBefore: result.balanceBefore,
    balanceAfter: result.balanceAfter,
    pointsDeducted: result.alreadyDeducted ? 0 : points,
    transactionId: result.transactionId,
    alreadyDeducted: result.alreadyDeducted,
  };
}

/**
 * 原子化积分充值/增加
 * 在单个事务中完成：余额增加 → 流水记录
 *
 * @param userId 用户ID
 * @param points 要增加的积分数量（正数）
 * @param reason 充值原因
 * @param relatedOrderId 关联订单ID（可选）
 */
export interface AddPointsOptions {
  type?: string;
  relatedType?: string;
  relatedId?: string;
  idempotencyKey?: string;
  expiresAt?: Date;
  rechargeAmount?: number;
}

export async function addPoints(
  userId: string,
  points: number,
  reason: string,
  relatedTaskId?: string,
  tx?: any,
  options?: AddPointsOptions
): Promise<AddPointsResult> {
  if (points <= 0) {
    throw new AppError('充值积分必须大于0', 400);
  }

  const result = await (tx
    ? handleAddPoints(tx, userId, points, reason, relatedTaskId, options)
    : prisma.$transaction(async (t) =>
        handleAddPoints(t, userId, points, reason, relatedTaskId, options)
      ));

  return {
    success: true,
    balanceBefore: result.balanceBefore,
    balanceAfter: result.balanceAfter,
    pointsAdded: points,
    transactionId: result.transactionId,
  };
}

async function handleAddPoints(
  tx: any,
  userId: string,
  points: number,
  reason: string,
  relatedTaskId?: string,
  options?: AddPointsOptions
) {
  const rechargeAmount = options?.rechargeAmount ?? 0;
  if (rechargeAmount < 0 || rechargeAmount > points) {
    throw new AppError('充值积分来源金额无效', 400);
  }

  // P0 修复：使用原子递增替代 read-then-write，防止并发 Lost Update
  // 先执行原子更新，再读回最新余额推导 balanceBefore/balanceAfter
  const updatedUser = await tx.user.update({
    where: { id: userId },
    data: {
      pointsBalance: { increment: points }, // 原子递增，防止并发覆盖
      rechargePointsBalance: { increment: rechargeAmount },
      points: { increment: points },
    },
    select: { pointsBalance: true, points: true },
  });

  if (!updatedUser) {
    throw new AppError('用户不存在', 404);
  }

  const balanceAfter = updatedUser.pointsBalance;
  const balanceBefore = balanceAfter - points;

  const transaction = await tx.pointsTransaction.create({
    data: {
      userId,
      idempotencyKey: options?.idempotencyKey,
      type: options?.type || 'RECHARGE',
      amount: points,
      rechargeAmount,
      balanceBefore,
      balanceAfter,
      reason,
      orderNo: relatedTaskId,
      relatedType: options?.relatedType,
      relatedId: options?.relatedId,
      expiresAt: options?.expiresAt,
    },
  });

  return {
    balanceBefore,
    balanceAfter,
    transactionId: transaction.id,
  };
}

/**
 * 积分过期清理：查找已过期但未处理的积分收入流水，扣减余额并记录过期流水
 * 应在查询余额、扣减积分前调用，确保返回的余额不包含已过期积分
 */
export async function expirePointsForUser(userId: string): Promise<number> {
  const now = new Date();
  const expiredTransactions = await prisma.pointsTransaction.findMany({
    where: {
      userId,
      expiresAt: { not: null, lte: now },
      amount: { gt: 0 },
      relatedType: { not: 'points_expired' },
    },
    select: { id: true, amount: true, rechargeAmount: true, expiresAt: true, type: true, reason: true },
  });

  if (expiredTransactions.length === 0) return 0;

  let totalExpired = 0;
  let totalRechargeExpired = 0;
  for (const tx of expiredTransactions) {
    const existingDeduction = await prisma.pointsTransaction.findFirst({
      where: {
        userId,
        type: 'points_expired',
        relatedId: tx.id,
      },
    });
    if (existingDeduction) continue;
    totalExpired += tx.amount;
    totalRechargeExpired += Math.max(0, tx.rechargeAmount);
  }

  if (totalExpired <= 0) return 0;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return 0;

  const balanceBefore = user.pointsBalance ?? 0;
  const rechargeBalanceBefore = Math.min(user.rechargePointsBalance ?? 0, balanceBefore);
  const actualDeduction = Math.min(totalExpired, balanceBefore);
  const actualRechargeDeduction = Math.min(
    totalRechargeExpired,
    rechargeBalanceBefore,
    actualDeduction,
  );
  // P2 修复 #21：余额扣减 + 过期流水创建必须原子完成，
  // 否则循环中途失败会导致余额已扣但部分流水未记录，永久不一致。
  const balanceAfter = Math.max(0, balanceBefore - actualDeduction);
  const rechargeBalanceAfter = rechargeBalanceBefore - actualRechargeDeduction;

  await prisma.$transaction(async (tx) => {
    if (actualDeduction > 0) {
      await tx.user.update({
        where: { id: userId },
        data: {
          pointsBalance: balanceAfter,
          rechargePointsBalance: rechargeBalanceAfter,
          points: Math.floor(balanceAfter),
        },
      });
    }

    for (const expiredTx of expiredTransactions) {
      await tx.pointsTransaction.create({
        data: {
          userId,
          type: 'points_expired',
          amount: -expiredTx.amount,
          rechargeAmount: -Math.max(0, expiredTx.rechargeAmount),
          balanceBefore: actualDeduction > 0 ? balanceBefore : 0,
          balanceAfter: actualDeduction > 0 ? balanceAfter : 0,
          reason: `积分过期: ${expiredTx.reason || expiredTx.type}`,
          relatedType: 'points_expired',
          relatedId: expiredTx.id,
        },
      });
    }
  });

  logger.info(`[Points Expire] 用户 ${userId} 过期扣减 ${actualDeduction} 积分`);
  return actualDeduction;
}

/**
 * 查询用户当前积分余额（自动清理过期积分后返回）
 */
export async function getBalance(userId: string): Promise<{
  points: number;
  pointsBalance: number;
  rechargePointsBalance: number;
  frozenPoints: number;
}> {
  await expirePointsForUser(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true, pointsBalance: true, rechargePointsBalance: true, frozenPoints: true },
  });

  if (!user) {
    throw new AppError('用户不存在', 404);
  }

  return {
    points: user.points,
    pointsBalance: user.pointsBalance,
    rechargePointsBalance: user.rechargePointsBalance,
    frozenPoints: user.frozenPoints,
  };
}
