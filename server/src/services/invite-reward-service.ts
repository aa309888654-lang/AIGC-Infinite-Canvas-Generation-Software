/**
 * 邀请奖励服务
 * 处理邀请码生成、邀请注册奖励、邀请消耗奖励
 */

import crypto from 'crypto';
import prisma from '../lib/prisma';
import { addPoints } from './points-service';
import { getInviteConfig } from './points-config-service';
import { decryptFromStorage } from '../utils/encryption';
import { isAllowedEmailDomain } from '../utils/email-validation';

/**
 * 根据用户ID生成8位邀请码
 */
export function generateInviteCode(userId: string): string {
  return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
}

/**
 * 根据邀请码查找邀请人
 */
async function findInviterByReferralCode(referralCode: string) {
  // 邀请码是基于 userId 的 SHA256 前8位
  // 需要遍历查找匹配的用户
  const users = await prisma.user.findMany({
    select: { id: true, username: true },
  });

  for (const user of users) {
    if (generateInviteCode(user.id) === referralCode) {
      return user;
    }
  }

  return null;
}

/**
 * 处理注册时的邀请奖励
 * 在用户注册时调用，如果带了 referralCode 且配置了邀请注册奖励，则给邀请人发积分
 */
export async function processInviteRegistrationReward(
  newUserId: string,
  referralCode?: string | null
): Promise<{ rewarded: boolean; inviterId?: string; points?: number }> {
  if (!referralCode) {
    return { rewarded: false };
  }

  const config = await getInviteConfig();

  if (config.registrationReward <= 0) {
    return { rewarded: false };
  }

  // 查找邀请人
  const inviter = await findInviterByReferralCode(referralCode);
  if (!inviter) {
    return { rewarded: false };
  }

  // 不能自己邀请自己
  if (inviter.id === newUserId) {
    return { rewarded: false };
  }

  // 检查是否已经给此邀请人发过此新用户的注册奖励（幂等）
  const existing = await prisma.pointsTransaction.findFirst({
    where: {
      userId: inviter.id,
      type: 'invite_reward',
      relatedType: 'invite_registration',
      relatedId: newUserId,
    },
  });

  if (existing) {
    return { rewarded: false };
  }

  // SECURITY: 限制同一邀请人每日最多邀请 5 次，防止刷邀请奖励
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentInvites = await prisma.pointsTransaction.count({
    where: {
      userId: inviter.id,
      type: 'invite_reward',
      relatedType: 'invite_registration',
      createdAt: { gte: oneDayAgo },
    },
  });

  if (recentInvites >= 5) {
    console.warn(`[InviteReward][SECURITY] 邀请人 ${inviter.id} 24小时内已邀请 ${recentInvites} 次，拒绝继续发放奖励`);
    return { rewarded: false };
  }

  // 发放奖励
  const expiryDate = new Date(
    Date.now() + config.expiryDays * 24 * 60 * 60 * 1000
  );

  await addPoints(
    inviter.id,
    config.registrationReward,
    `邀请注册奖励：用户注册（有效期${config.expiryDays}天）`,
    undefined,
    undefined,
    {
      type: 'invite_reward',
      relatedType: 'invite_registration',
      relatedId: newUserId,
      expiresAt: expiryDate,
    }
  );

  console.log(`[InviteReward] 邀请注册奖励: 邀请人=${inviter.id}, 新用户=${newUserId}, 积分=+${config.registrationReward}`);

  return { rewarded: true, inviterId: inviter.id, points: config.registrationReward };
}

/**
 * 判断用户是否已绑定手机和邮箱
 * 邮箱：emailCipher 非空，或 email 为真实邮箱（非 hash、非占位符）
 * 手机：phone 或 phoneCipher 非空
 */
export async function hasUserBoundBothContacts(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailCipher: true, phone: true, phoneCipher: true },
  });
  if (!user) return false;

  let displayEmail = '';
  if (user.emailCipher) {
    try {
      displayEmail = decryptFromStorage(user.emailCipher);
    } catch {
      displayEmail = '';
    }
  } else if (user.email && !/^[a-f0-9]{64}$/.test(user.email) && !/@(phone|unbound|unregistered)\.local$/i.test(user.email)) {
    displayEmail = user.email;
  }

  const emailBound = isAllowedEmailDomain(displayEmail);
  const phoneBound = Boolean(user.phone || user.phoneCipher);

  return emailBound && phoneBound;
}

/**
 * 处理积分消耗时的邀请奖励
 * 在被邀请人累计消耗积分超过门槛后，且邀请人和被邀请人均已绑定手机+邮箱，给邀请人发放一次奖励。
 * 注册奖励 200 + 消耗达标奖励 400，使每个好友对邀请人的累计奖励严格封顶 600。
 */
export async function processInviteConsumptionReward(
  userId: string
): Promise<{ rewarded: boolean; inviterId?: string; points?: number; reason?: string }> {
  const config = await getInviteConfig();

  if (config.rechargeReward <= 0) {
    return { rewarded: false };
  }

  // 查找此用户的邀请人：通过 UserRegistration.referralCode
  const registration = await prisma.userRegistration.findFirst({
    where: { userId },
    select: { referralCode: true },
  });

  if (!registration?.referralCode) {
    return { rewarded: false };
  }

  const inviter = await findInviterByReferralCode(registration.referralCode);
  if (!inviter) {
    return { rewarded: false };
  }

  if (inviter.id === userId) {
    return { rewarded: false };
  }

  // 查询被邀请人累计消耗的积分
  const consumptionAgg = await prisma.pointsTransaction.aggregate({
    where: { userId, type: 'CONSUME' },
    _sum: { amount: true },
  });
  const totalConsumed = Math.abs(consumptionAgg._sum.amount || 0);

  if (totalConsumed <= config.rechargeThreshold) {
    return { rewarded: false };
  }

  // 双方绑定校验：邀请人和被邀请人都必须绑定手机+邮箱
  const [inviterBound, friendBound] = await Promise.all([
    hasUserBoundBothContacts(inviter.id),
    hasUserBoundBothContacts(userId),
  ]);

  if (!friendBound) {
    console.log(`[InviteReward] 被邀请人 ${userId} 尚未绑定手机+邮箱，暂缓发放邀请消耗奖励`);
    return { rewarded: false, reason: 'friend_not_bound' };
  }
  if (!inviterBound) {
    console.log(`[InviteReward] 邀请人 ${inviter.id} 尚未绑定手机+邮箱，暂缓发放邀请消耗奖励`);
    return { rewarded: false, reason: 'inviter_not_bound' };
  }

  // 发放奖励
  const expiryDate = new Date(
    Date.now() + config.expiryDays * 24 * 60 * 60 * 1000
  );

  const rewardResult = await prisma.$transaction(async (tx) => {
    const inviterExisting = await tx.pointsTransaction.findFirst({
      where: {
        userId: inviter.id,
        type: 'invite_reward',
        relatedType: 'invite_consumption',
        relatedId: userId,
      },
    });

    let inviterRewarded = false;

    if (!inviterExisting) {
      await addPoints(
        inviter.id,
        config.rechargeReward,
        `邀请消耗奖励：被邀请用户累计消耗${totalConsumed}积分（有效期${config.expiryDays}天）`,
        undefined,
        tx,
        {
          type: 'invite_reward',
          relatedType: 'invite_consumption',
          relatedId: userId,
          expiresAt: expiryDate,
        }
      );
      inviterRewarded = true;
    }

    return { inviterRewarded };
  }, { isolationLevel: 'Serializable' });

  if (!rewardResult.inviterRewarded) {
    return { rewarded: false };
  }

  console.log(`[InviteReward] 邀请消耗奖励: 邀请人=${inviter.id}(+${config.rechargeReward}), 被邀请人=${userId}，累计消耗=${totalConsumed}`);

  return {
    rewarded: rewardResult.inviterRewarded,
    inviterId: inviter.id,
    points: config.rechargeReward,
  };
}

/**
 * 当邀请人绑定手机/邮箱后，回补检查所有已达标但未发放的被邀请人奖励
 */
export async function processPendingInviteRewardsForInviter(inviterId: string): Promise<void> {
  const inviterCode = generateInviteCode(inviterId);

  const registrations = await prisma.userRegistration.findMany({
    where: { referralCode: inviterCode },
    select: { userId: true },
  });

  if (registrations.length === 0) return;

  for (const reg of registrations) {
    processInviteConsumptionReward(reg.userId)
      .catch((err) => console.error('[InviteReward] 回补检查失败:', err));
  }
}
