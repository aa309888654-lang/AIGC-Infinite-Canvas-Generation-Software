import prisma from '../lib/prisma';
import { z } from 'zod';
import { quotaService } from './quota-service';

export const grantSchema = z.object({
  userId: z.string().min(1),
  membershipId: z.string().min(1),
  action: z.enum(['activate', 'renew', 'upgrade']),
  grantPolicy: z.enum(['calendar', 'cycle']).optional(),
  months: z.number().int().min(0).default(1),
  days: z.number().int().min(0).default(0),
});

export type GrantInput = z.infer<typeof grantSchema>;

function addUtcMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}

function addDuration(d: Date, months: number, days: number): Date {
  const r = new Date(d.getTime());
  if (days > 0) {
    r.setUTCDate(r.getUTCDate() + days);
  } else {
    r.setUTCMonth(r.getUTCMonth() + Math.max(months, 1));
  }
  return r;
}

function calcGrantPoints(monthlyGiftPoints: number, policy: string, now: Date): number {
  if (monthlyGiftPoints <= 0) return 0;
  if (policy === 'cycle') return monthlyGiftPoints;
  const totalDays = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
  const remainingDays = totalDays - now.getUTCDate() + 1;
  return Math.ceil((monthlyGiftPoints * remainingDays) / totalDays);
}

async function grantPointsToUser(
  userId: string,
  grantPoints: number,
  reason: string,
  adminId: string | undefined,
  adminUsername: string | undefined,
  tx?: any
) {
  if (grantPoints <= 0) return;
  const db = tx || prisma;

  const u = await db.user.findUnique({
    where: { id: userId },
    select: { pointsBalance: true },
  });
  if (!u) return;
  const balanceBefore = u.pointsBalance;
  await db.user.update({
    where: { id: userId },
    data: {
      points: { increment: grantPoints },
      pointsBalance: { increment: grantPoints },
    },
  });
  const balanceAfter = balanceBefore + grantPoints;
  await db.pointsTransaction.create({
    data: {
      userId,
      type: 'membership_grant',
      amount: grantPoints,
      balanceBefore,
      balanceAfter,
      reason,
      adminId,
      adminUsername,
    },
  });
}

export async function grantMembership(input: GrantInput, adminId?: string, adminUsername?: string, tx?: any) {
  // If no external transaction provided, wrap all operations in a single transaction
  // to ensure atomicity (membership create + user update + points grant all succeed or all fail)
  if (!tx) {
    return prisma.$transaction(async (txInner) => {
      return grantMembershipInner(input, adminId, adminUsername, txInner);
    });
  }
  return grantMembershipInner(input, adminId, adminUsername, tx);
}

async function grantMembershipInner(input: GrantInput, adminId?: string, adminUsername?: string, db: any = prisma) {
  const now = new Date();

  const [user, membership] = await Promise.all([
    db.user.findUnique({ where: { id: input.userId }, select: { id: true } }),
    db.membership.findUnique({ where: { id: input.membershipId } }),
  ]);
  if (!user) throw Object.assign(new Error('用户不存在'), { statusCode: 404 });
  if (!membership) throw Object.assign(new Error('会员套餐不存在'), { statusCode: 404 });

  const current = await db.userMembership.findFirst({
    where: { userId: input.userId, status: 'active' },
    orderBy: { endAt: 'desc' },
  });

  const policy = (input.grantPolicy as string) || (membership.grantPolicy as string) || 'calendar';
  const membershipLevel = membership.name || 'free';

  if (input.action === 'activate') {
    if (current) {
      throw Object.assign(new Error('用户已存在有效会员，请使用续费或升级'), { statusCode: 400 });
    }
    const startAt = now;
    const endAt = addDuration(now, input.months, input.days);
    const um = await db.userMembership.create({
      data: {
        user: {
          connect: { id: input.userId },
        },
        membership: {
          connect: { id: input.membershipId },
        },
        level: membershipLevel,
        status: 'active',
        startAt,
        endAt,
        grantPolicy: policy,
        nextGrantAt: null,
      },
    });
    const grantPoints = calcGrantPoints(membership.monthlyGiftPoints ?? 0, policy, now);
    await quotaService.syncMembershipStorageQuota(input.userId, membershipLevel, membership.id, db);

    await db.user.update({
      where: { id: input.userId },
      data: {
        role: membershipLevel,
      },
    });
    await grantPointsToUser(
      input.userId,
      grantPoints,
      `会员「${membership.displayName}」开通发放 ${grantPoints} 积分（${policy}策略）`,
      adminId,
      adminUsername,
      db
    );
    return { userMembership: um, grantedPoints: grantPoints };
  }

  if (input.action === 'renew') {
    if (!current) {
      throw Object.assign(new Error('用户当前无有效会员，无法续费'), { statusCode: 400 });
    }
    const base = current.endAt > now ? current.endAt : now;
    const updated = await db.userMembership.update({
      where: { id: current.id },
      data: { endAt: addDuration(base, input.months, input.days), grantPolicy: policy },
    });
    
    await quotaService.syncMembershipStorageQuota(input.userId, membershipLevel, membership.id, db);
    
    await db.user.update({
      where: { id: input.userId },
      data: { role: membershipLevel },
    });
    
    const grantPoints = calcGrantPoints(membership.monthlyGiftPoints ?? 0, policy, now);
    if (grantPoints > 0) {
      await grantPointsToUser(
        input.userId,
        grantPoints,
        `会员「${membership.displayName}」续费发放 ${grantPoints} 积分（${policy}策略）`,
        adminId,
        adminUsername,
        db
      );
    }
    
    return { userMembership: updated, grantedPoints: grantPoints };
  }

  let remainingDays = 0;
  if (current) {
    const remainingMs = current.endAt > now ? current.endAt.getTime() - now.getTime() : 0;
    remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    await db.userMembership.update({
      where: { id: current.id },
      data: { status: 'canceled', nextGrantAt: null, endAt: now },
    });
  }

  const endAt = remainingDays > 0
    ? addDuration(addDuration(now, input.months, input.days), 0, remainingDays)
    : addDuration(now, input.months, input.days);

  const um = await db.userMembership.create({
    data: {
      user: {
        connect: { id: input.userId },
      },
      membership: {
        connect: { id: input.membershipId },
      },
      level: membershipLevel,
      status: 'active',
      startAt: now,
      endAt,
      grantPolicy: policy,
      nextGrantAt: null,
    },
  });

  const grantPoints = calcGrantPoints(membership.monthlyGiftPoints ?? 0, policy, now);
  await quotaService.syncMembershipStorageQuota(input.userId, membershipLevel, membership.id, db);

  await db.user.update({
    where: { id: input.userId },
    data: {
      role: membershipLevel,
    },
  });

  const grantReason = remainingDays > 0
    ? `会员「${membership.displayName}」升级发放 ${grantPoints} 积分（剩余 ${remainingDays} 天已叠加）`
    : `会员「${membership.displayName}」升级发放 ${grantPoints} 积分`;
  await grantPointsToUser(
    input.userId,
    grantPoints,
    grantReason,
    adminId,
    adminUsername,
    db
  );
  return { userMembership: um, grantedPoints: grantPoints };
}

export async function cancelUserMembership(id: string) {
  const existing = await prisma.userMembership.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('用户会员不存在'), { statusCode: 404 });
  return prisma.userMembership.update({
    where: { id },
    data: { status: 'canceled', nextGrantAt: null },
  });
}
