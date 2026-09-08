import prisma from '../lib/prisma';

export type AdminAction =
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'user_enable'
  | 'user_disable'
  | 'user_login'
  | 'user_logout'
  | 'api_key_create'
  | 'api_key_update'
  | 'api_key_delete'
  | 'api_key_enable'
  | 'api_key_disable'
  | 'membership_create'
  | 'membership_update'
  | 'membership_delete'
  | 'membership_assign'
  | 'membership_order_refund'
  | 'payment_refund'
  | 'payment_process'
  | 'quota_adjust'
  | 'quota_reset'
  | 'points_adjust'
  | 'points_gift'
  | 'points_refund'
  | 'points_config_update'
  | 'points_json_config_update'
  | 'registration_approve'
  | 'registration_reject'
  | 'rate_limit_update'
  | 'access_rule_create'
  | 'access_rule_remove'
  | 'provider_create'
  | 'provider_update'
  | 'provider_delete'
  | 'config_update'
  | 'generated_cleanup';

export type TargetType =
  | 'user'
  | 'api_key'
  | 'membership'
  | 'membership_order'
  | 'payment'
  | 'quota'
  | 'points'
  | 'registration'
  | 'rate_limit'
  | 'ip'
  | 'provider'
  | 'config'
  | 'system_config'
  | 'generated_content';

export interface LogOperationParams {
  adminId: string;
  adminUsername: string;
  action: AdminAction;
  targetType: TargetType;
  targetId?: string;
  targetName?: string;
  beforeValue?: any;
  afterValue?: any;
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failed';
  errorMessage?: string;
  metadata?: any;
}

export async function logOperation(params: LogOperationParams): Promise<void> {
  try {
    await prisma.adminOperationLog.create({
      data: {
        adminId: params.adminId,
        adminUsername: params.adminUsername,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        targetName: params.targetName,
        beforeValue: params.beforeValue || null,
        afterValue: params.afterValue || null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        status: params.status || 'success',
        errorMessage: params.errorMessage,
        metadata: params.metadata || null,
      },
    });
  } catch (error) {
    console.error('[操作日志服务] 记录操作日志失败:', error);
  }
}

export interface OperationLogQuery {
  adminId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function queryOperationLogs(query: OperationLogQuery) {
  const { page = 1, pageSize = 20, ...filters } = query;
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (filters.adminId) where.adminId = filters.adminId;
  if (filters.action) where.action = filters.action;
  if (filters.targetType) where.targetType = filters.targetType;
  if (filters.targetId) where.targetId = filters.targetId;
  if (filters.status) where.status = filters.status;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.adminOperationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.adminOperationLog.count({ where }),
  ]);

  return {
    logs: logs.map(log => ({
      ...log,
      beforeValue: log.beforeValue || null,
      afterValue: log.afterValue || null,
      metadata: log.metadata || null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getOperationStats(adminId?: string, days: number = 7) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where: any = {
    createdAt: { gte: startDate },
  };

  if (adminId) where.adminId = adminId;

  const [total, successCount, failedCount, byAction] = await Promise.all([
    prisma.adminOperationLog.count({ where }),
    prisma.adminOperationLog.count({ where: { ...where, status: 'success' } }),
    prisma.adminOperationLog.count({ where: { ...where, status: 'failed' } }),
    prisma.adminOperationLog.groupBy({
      by: ['action'],
      where,
      _count: true,
    }),
  ]);

  return {
    total,
    successCount,
    failedCount,
    successRate: total > 0 ? (successCount / total) * 100 : 0,
    byAction: byAction.map(item => ({
      action: item.action,
      count: item._count,
    })),
  };
}
