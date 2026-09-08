import { Router } from 'express';
import { adminController } from '../controllers/admin-controller';
import { authenticate, requireAdmin } from '../middleware/auth';
import { auditMiddleware } from '../middleware/audit'; // P0 修复：审计中间件
import { asyncHandler, NotFoundError } from '../middleware/errorHandler'; // P2 修复 #19：统一错误处理
import prisma from '../lib/prisma';
import { z } from 'zod';
import { parsePaginationParamsWithNumbers } from '../utils/pagination';
import { grantSchema, grantMembership, cancelUserMembership } from '../services/membership-service';
import { logOperation } from '../services/operation-log-service';
import { logger } from '../utils/logger';

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

// P2 修复 #20：管理后台支付接口请求体校验
// 防止非法 amount（负数/NaN）、缺失 userId、非法 status 等直接写库。
const PAYMENT_STATUS_ENUM = z.enum(['pending', 'completed', 'failed', 'refunded', 'cancelled']);

const createPaymentSchema = z.object({
  userId: z.string().min(1, 'userId 不能为空').max(64),
  amount: z
    .union([z.number(), z.string()])
    .transform(v => (typeof v === 'string' ? parseFloat(v) : v))
    .refine(v => Number.isFinite(v) && v > 0, 'amount 必须为正数'),
  currency: z.string().max(8).optional().default('CNY'),
  paymentMethod: z.string().max(32).optional(),
  transactionId: z.string().max(128).optional(),
  metadata: z.any().optional(),
});

const updatePaymentSchema = z.object({
  status: PAYMENT_STATUS_ENUM.optional(),
  transactionId: z.string().max(128).optional(),
  errorMessage: z.string().max(512).optional(),
  metadata: z.any().optional(),
});

const refundPaymentSchema = z.object({
  reason: z.string().max(512).optional(),
});

// ==================== 仪表盘统计 ====================
adminRouter.get('/stats', adminController.getStats);

// ==================== 用户会员管理 ====================
// P2 修复 #19：所有路由改用 asyncHandler 包装，错误统一交由 errorHandler 处理，
// 避免直接回传 error.message 泄露内部堆栈与实现细节。
adminRouter.get('/user-memberships/list', asyncHandler(async (req, res) => {
  const { page, pageSize, search, status, grantPolicy } = req.query;
  const pagination = parsePaginationParamsWithNumbers(
    Number(page) || undefined,
    Number(pageSize) || undefined
  );

  const where: any = {};
  if (status) where.status = status;
  if (grantPolicy) where.grantPolicy = grantPolicy;
  if (search) {
    where.user = {
      OR: [
        { username: { contains: search as string } },
        { email: { contains: search as string } },
      ],
    };
  }

  const [items, total] = await Promise.all([
    prisma.userMembership.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        user: { select: { id: true, username: true, email: true, role: true } },
        membership: { select: { id: true, name: true, displayName: true, monthlyGiftPoints: true } },
      },
    }),
    prisma.userMembership.count({ where }),
  ]);

  res.json({
    success: true,
    data: items,
    meta: {
      page: pagination.page,
      pageSize: pagination.pageSize || pagination.limit,
      total,
      totalPages: Math.ceil(total / (pagination.pageSize || pagination.limit)),
    },
  });
}));

adminRouter.post('/user-memberships/grant', asyncHandler(async (req, res) => {
  // grantSchema.parse 抛出 ZodError → errorHandler 自动处理为 400 + details
  const input = grantSchema.parse(req.body);
  const admin = req.userId
    ? await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, username: true } })
    : null;
  // grantMembership 抛出带 statusCode 的 AppError → errorHandler 自动按 statusCode 返回
  const result = await grantMembership(input, admin?.id, admin?.username);

  await logOperation({
    adminId: admin?.id || 'unknown',
    adminUsername: admin?.username || 'unknown',
    action: 'membership_assign',
    targetType: 'membership',
    targetId: input.userId,
    targetName: `会员授权:${input.action}`,
    afterValue: { input, result: { userMembershipId: result.userMembership.id, grantedPoints: result.grantedPoints } },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(err => logger.error('[Admin Grant Membership] 审计日志写入失败:', err instanceof Error ? err.message : String(err)));

  res.json({ success: true, data: result });
}));

adminRouter.post('/user-memberships/:id/cancel', asyncHandler(async (req, res) => {
  const admin = req.userId
    ? await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, username: true } })
    : null;
  const existing = await prisma.userMembership.findUnique({
    where: { id: req.params.id },
    select: { id: true, userId: true, level: true, status: true, endAt: true },
  });
  const updated = await cancelUserMembership(req.params.id);

  await logOperation({
    adminId: admin?.id || 'unknown',
    adminUsername: admin?.username || 'unknown',
    action: 'membership_update',
    targetType: 'membership',
    targetId: req.params.id,
    targetName: existing ? `会员取消:${existing.level}` : req.params.id,
    beforeValue: existing || null,
    afterValue: updated,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(err => logger.error('[Admin Cancel Membership] 审计日志写入失败:', err instanceof Error ? err.message : String(err)));

  res.json({ success: true, data: updated });
}));

// ==================== API密钥管理 ====================
// P0 修复：所有写操作添加审计中间件
adminRouter.get('/apikeys', adminController.getAllApiKeys);
adminRouter.post('/apikeys', auditMiddleware('api_key_create', 'api_key'), adminController.createApiKey);
adminRouter.put('/apikeys/:id', auditMiddleware('api_key_update', 'api_key'), adminController.updateApiKey);
adminRouter.delete('/apikeys/:id', auditMiddleware('api_key_delete', 'api_key'), adminController.deleteApiKey);
adminRouter.put('/apikeys/:id/toggle', auditMiddleware('api_key_enable', 'api_key'), adminController.toggleApiKey);
adminRouter.get('/apikeys/:id/stats', adminController.getApiKeyStats);

// ==================== 支付记录管理 ====================
adminRouter.get('/payments', asyncHandler(async (req, res) => {
  const { page, pageSize, status, paymentMethod, startDate, endDate, search, orderNo } = req.query;
  const pageNum = Number(page) || 1;
  const size = Number(pageSize) || 10;
  const skip = (pageNum - 1) * size;

  const where: any = {};
  if (status) where.status = status;
  if (paymentMethod) where.paymentMethod = paymentMethod;
  if (orderNo) where.orderNo = { contains: orderNo as string };
  if (search) {
    where.OR = [
      { orderNo: { contains: search as string } },
      { user: { username: { contains: search as string } } },
      { user: { email: { contains: search as string } } },
    ];
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate as string);
    if (endDate) where.createdAt.lte = new Date(endDate as string);
  }

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: size,
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  res.json({
    success: true,
    data: items,
    meta: { page: pageNum, pageSize: size, total, totalPages: Math.ceil(total / size) },
  });
}));

adminRouter.get('/payments/stats', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const where: any = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate as string);
    if (endDate) where.createdAt.lte = new Date(endDate as string);
  }

  const [totalPayments, completedPayments, pendingPayments, failedPayments, totalAmount, completedAmount, byMethodRaw] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.count({ where: { ...where, status: 'completed' } }),
    prisma.payment.count({ where: { ...where, status: 'pending' } }),
    prisma.payment.count({ where: { ...where, status: 'failed' } }),
    prisma.payment.aggregate({ where, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...where, status: 'completed' }, _sum: { amount: true } }),
    prisma.payment.groupBy({ by: ['paymentMethod'], where, _count: true, _sum: { amount: true } }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todayOrders, todayRevenue, pendingOrders, totalRevenue] = await Promise.all([
    prisma.payment.count({ where: { createdAt: { gte: today } } }),
    prisma.payment.aggregate({ where: { createdAt: { gte: today }, status: 'completed' }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: 'pending' } }),
    prisma.payment.aggregate({ where: { status: 'completed' }, _sum: { amount: true } }),
  ]);

  res.json({
    success: true,
    data: {
      overview: {
        totalPayments,
        completedPayments,
        pendingPayments,
        failedPayments,
        totalAmount: totalAmount._sum.amount || 0,
        completedAmount: completedAmount._sum.amount || 0,
        averageAmount: totalPayments > 0 ? (totalAmount._sum.amount || 0) / totalPayments : 0,
      },
      byMethod: byMethodRaw.map(m => ({
        method: m.paymentMethod || 'unknown',
        count: m._count,
        amount: m._sum.amount || 0,
      })),
      recentTrend: [],
      todayOrders,
      todayRevenue: todayRevenue._sum.amount || 0,
      pendingOrders,
      totalRevenue: totalRevenue._sum.amount || 0,
    },
  });
}));

adminRouter.get('/payments/export/csv', asyncHandler(async (req, res) => {
  const { status, startDate, endDate } = req.query;
  const where: any = {};
  if (status) where.status = status;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate as string);
    if (endDate) where.createdAt.lte = new Date(endDate as string);
  }

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { username: true, email: true } } },
  });

  const header = '订单号,用户,金额,货币,状态,支付方式,创建时间\n';
  const rows = payments.map(p =>
    `${p.orderNo},${p.user?.username || ''},${p.amount},${p.currency},${p.status},${p.paymentMethod || ''},${p.createdAt.toISOString()}`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=payments_${Date.now()}.csv`);
  res.send('\ufeff' + header + rows);
}));

adminRouter.get('/payments/:id', asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, username: true, email: true } } },
  });
  if (!payment) {
    // 抛 NotFoundError 由 errorHandler 统一处理为 404
    throw new NotFoundError('支付记录不存在');
  }
  res.json({ success: true, data: payment });
}));

adminRouter.post('/payments', auditMiddleware('payment_process', 'payment'), asyncHandler(async (req, res) => {
  // P2 修复 #20：zod 校验请求体，防止 amount 非正数 / userId 缺失等
  const parsed = createPaymentSchema.parse(req.body);
  const payment = await prisma.payment.create({
    data: {
      userId: parsed.userId,
      membershipId: '',
      orderNo: `MANUAL_${Date.now()}`,
      amount: parsed.amount,
      currency: parsed.currency,
      status: 'completed',
      paymentMethod: parsed.paymentMethod || 'manual',
      transactionId: parsed.transactionId,
      paidAt: new Date(),
    },
  });
  res.json({ success: true, data: payment, message: '支付记录创建成功' });
}));

adminRouter.put('/payments/:id', auditMiddleware('payment_process', 'payment'), asyncHandler(async (req, res) => {
  // P2 修复 #20：status 必须为合法枚举值
  const parsed = updatePaymentSchema.parse(req.body);
  const payment = await prisma.payment.update({
    where: { id: req.params.id },
    data: {
      ...(parsed.status && { status: parsed.status }),
      ...(parsed.transactionId && { transactionId: parsed.transactionId }),
    },
  });
  res.json({ success: true, data: payment });
}));

adminRouter.delete('/payments/:id', auditMiddleware('payment_process', 'payment'), asyncHandler(async (req, res) => {
  await prisma.payment.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: '支付记录已删除' });
}));

adminRouter.post('/payments/:id/refund', auditMiddleware('payment_refund', 'payment'), asyncHandler(async (req, res) => {
  // P2 修复 #20：reason 长度限制
  const parsed = refundPaymentSchema.parse(req.body);
  const payment = await prisma.payment.update({
    where: { id: req.params.id },
    data: {
      refundStatus: 'refunded',
      refundReason: parsed.reason || '管理员退款',
      refundAmount: undefined,
      refundedAt: new Date(),
      refundedBy: req.userId || 'admin',
      status: 'refunded',
    },
  });
  res.json({ success: true, message: '退款成功', data: payment });
}));

// ==================== 活动参与 ====================
adminRouter.get('/campaigns/:id/participations', adminController.getCampaignParticipations);
