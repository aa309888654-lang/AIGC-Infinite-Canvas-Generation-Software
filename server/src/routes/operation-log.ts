import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { parsePaginationParamsWithNumbers } from '../utils/pagination';
import {
  queryOperationLogs,
  getOperationStats,
  type OperationLogQuery,
} from '../services/operation-log-service';

export const operationLogRouter = Router();

operationLogRouter.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { page, pageSize, adminId, action, targetType, targetId, status, startDate, endDate } = req.query;

    const query: OperationLogQuery = {
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    };

    if (adminId) query.adminId = adminId as string;
    if (action) query.action = action as string;
    if (targetType) query.targetType = targetType as string;
    if (targetId) query.targetId = targetId as string;
    if (status) query.status = status as string;
    if (startDate) query.startDate = new Date(startDate as string);
    if (endDate) query.endDate = new Date(endDate as string);

    const result = await queryOperationLogs(query);

    res.json({
      success: true,
      data: result.logs,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

operationLogRouter.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const { adminId, days = 7 } = req.query;

    const stats = await getOperationStats(
      adminId as string | undefined,
      Number(days)
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

operationLogRouter.get('/actions', authenticate, requireAdmin, async (req, res) => {
  try {
    const actions = [
      { value: 'user_create', label: '创建用户' },
      { value: 'user_update', label: '更新用户' },
      { value: 'user_delete', label: '删除用户' },
      { value: 'user_enable', label: '启用用户' },
      { value: 'user_disable', label: '禁用用户' },
      { value: 'api_key_create', label: '创建API Key' },
      { value: 'api_key_update', label: '更新API Key' },
      { value: 'api_key_delete', label: '删除API Key' },
      { value: 'api_key_enable', label: '启用API Key' },
      { value: 'api_key_disable', label: '禁用API Key' },
      { value: 'membership_create', label: '创建会员' },
      { value: 'membership_update', label: '更新会员' },
      { value: 'membership_delete', label: '删除会员' },
      { value: 'membership_assign', label: '分配会员' },
      { value: 'payment_refund', label: '退款' },
      { value: 'payment_process', label: '处理支付' },
      { value: 'quota_adjust', label: '调整配额' },
      { value: 'quota_reset', label: '重置配额' },
      { value: 'points_adjust', label: '调整积分' },
      { value: 'points_gift', label: '赠送积分' },
      { value: 'points_refund', label: '积分退款' },
      { value: 'registration_approve', label: '批准注册' },
      { value: 'registration_reject', label: '拒绝注册' },
      { value: 'rate_limit_update', label: '更新限流' },
      { value: 'provider_create', label: '创建服务商' },
      { value: 'provider_update', label: '更新服务商' },
      { value: 'provider_delete', label: '删除服务商' },
      { value: 'config_update', label: '更新配置' },
    ];

    res.json({
      success: true,
      data: actions,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});
