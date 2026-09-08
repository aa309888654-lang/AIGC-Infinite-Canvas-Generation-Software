/**
 * 邮件事件回调路由
 * 接收邮件服务商的事件回调（投递成功、退信、打开、点击等）
 * 回调地址: /api/email-callback/account
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

const router = Router();

/**
 * 接收腾讯云 SES 账户级事件回调
 * 腾讯云会向此端点 POST 事件数据，包括：
 * - send: 发送请求
 * - delivery: 投递成功
 * - bounce: 退信
 * - open: 邮件打开
 * - click: 链接点击
 * - unsubscribe: 退订
 */
router.post('/account', asyncHandler(async (req, res) => {
  try {
    const payload = req.body;
    logger.info('[Email Callback] 收到腾讯云邮件回调:', JSON.stringify(payload).substring(0, 500));

    // 腾讯云 SES 回调数据结构
    const event = payload.event || payload.EventType || 'unknown';
    const messageId = payload.messageId || payload.MessageId || payload.message_id || '';
    const email = payload.to || payload.To || payload.email || '';
    const timestamp = payload.timestamp || payload.Timestamp || new Date().toISOString();

    // 更新邮件发送日志状态
    if (messageId) {
      const log = await prisma.emailSendLog.findFirst({
        where: { messageId },
      });

      if (log) {
        const statusMap: Record<string, string> = {
          send: 'sent',
          delivery: 'delivered',
          bounce: 'bounced',
          open: 'opened',
          click: 'clicked',
          unsubscribe: 'unsubscribed',
        };

        const newStatus = statusMap[event.toLowerCase()] || event.toLowerCase();

        await prisma.emailSendLog.update({
          where: { id: log.id },
          data: {
            status: newStatus,
            errorMessage: event === 'bounce' ? (payload.bounceReason || payload.reason || '退信') : null,
          },
        });

        logger.info(`[Email Callback] 邮件状态更新: ${email} -> ${newStatus} (messageId: ${messageId})`);
      } else {
        logger.warn(`[Email Callback] 未找到 messageId 对应的发送日志: ${messageId}`);
      }
    }

    // 腾讯云要求返回 200 OK，否则会重试
    res.status(200).json({ success: true, message: 'Callback received' });
  } catch (error) {
    logger.error('[Email Callback] 处理回调失败:', error);
    // 即使出错也返回 200，避免腾讯云重试
    res.status(200).json({ success: true, message: 'Callback received' });
  }
}));

/**
 * 健康检查端点（用于腾讯云验证回调地址可用性）
 */
router.get('/account', (_req, res) => {
  res.status(200).json({ success: true, message: 'Email callback endpoint is active' });
});

export default router;
