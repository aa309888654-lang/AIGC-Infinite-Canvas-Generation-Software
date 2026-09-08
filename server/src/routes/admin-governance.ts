import { Router, Request } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { logOperation } from '../services/operation-log-service';
import { assessProviderHealth } from '../services/provider-health-service';
import { logger } from '../utils/logger';

export const adminGovernanceRouter = Router();

adminGovernanceRouter.use(authenticate, requireAdmin);

const HIGH_RISK_ACTIONS = [
  'points_adjust',
  'points_gift',
  'points_refund',
  'membership_assign',
  'membership_update',
  'membership_delete',
  'provider_update',
  'provider_delete',
  'api_key_create',
  'api_key_update',
  'api_key_delete',
  'config_update',
];

const SYSTEM_SETTINGS = [
  {
    key: 'registration_enabled',
    label: '新用户注册',
    description: '控制前端注册入口和注册接口是否允许新账号创建',
    type: 'boolean',
    defaultValue: true,
    group: '基础开关',
    riskLevel: 'medium',
  },
  {
    key: 'maintenance_mode',
    label: '维护模式',
    description: '启用后前端可进入维护提示状态，管理员仍可访问后台',
    type: 'boolean',
    defaultValue: false,
    group: '基础开关',
    riskLevel: 'high',
  },
  {
    key: 'content_review_enabled',
    label: '内容审核',
    description: '控制生成前后的内容安全审核策略',
    type: 'boolean',
    defaultValue: true,
    group: '安全',
    riskLevel: 'high',
  },
  {
    key: 'image_generation_enabled',
    label: '图片生成',
    description: '控制图片生成入口是否启用',
    type: 'boolean',
    defaultValue: true,
    group: '功能开关',
    riskLevel: 'medium',
  },
  {
    key: 'video_generation_enabled',
    label: '视频生成',
    description: '控制视频生成入口是否启用',
    type: 'boolean',
    defaultValue: true,
    group: '功能开关',
    riskLevel: 'medium',
  },
  {
    key: 'audio_generation_enabled',
    label: '音频生成',
    description: '控制音频生成入口是否启用',
    type: 'boolean',
    defaultValue: true,
    group: '功能开关',
    riskLevel: 'medium',
  },
  {
    key: 'prompt_optimization_enabled',
    label: '提示词优化',
    description: '控制文本优化和提示词增强入口是否启用',
    type: 'boolean',
    defaultValue: true,
    group: '功能开关',
    riskLevel: 'medium',
  },
  {
    key: 'audit_retention_days',
    label: '审计保留天数',
    description: '后台审计和高风险操作日志建议保留周期',
    type: 'number',
    defaultValue: 180,
    group: '审计',
    riskLevel: 'medium',
  },
] as const;

const settingKeys: Set<string> = new Set(SYSTEM_SETTINGS.map((setting) => setting.key));

const updateSettingsSchema = z.object({
  settings: z.array(z.object({
    key: z.string(),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  })).min(1),
});

function parseStoredValue(rawValue: string | null | undefined, type: string, fallback: unknown): unknown {
  if (rawValue === null || rawValue === undefined) return fallback;
  if (type === 'boolean') return rawValue === 'true';
  if (type === 'number') {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (type === 'json') {
    try {
      return JSON.parse(rawValue);
    } catch {
      return fallback;
    }
  }
  return rawValue;
}

function serializeConfigValue(value: unknown): string {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.stringify(value);
  }
  return String(value);
}

function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.ip;
}

async function getAdminIdentity(req: Request): Promise<{ id: string; username: string }> {
  const userId = (req as any).userId as string | undefined;
  if (!userId) return { id: 'unknown', username: 'unknown' };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });
  return { id: user?.id || userId, username: user?.username || 'unknown' };
}

async function getSystemConfigMap(keys: string[]): Promise<Map<string, string>> {
  const configs = await prisma.systemConfig.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });
  return new Map(configs.map((config) => [config.key, config.value]));
}

adminGovernanceRouter.get('/system-config', async (_req, res) => {
  try {
    const configMap = await getSystemConfigMap(SYSTEM_SETTINGS.map((setting) => setting.key));
    const settings = SYSTEM_SETTINGS.map((setting) => ({
      ...setting,
      value: parseStoredValue(configMap.get(setting.key), setting.type, setting.defaultValue),
      isDefault: !configMap.has(setting.key),
    }));

    const [pointsConfig] = await Promise.all([
      prisma.systemConfig.findFirst({
        where: { key: { in: ['points_config', 'points_rate_config'] } },
        select: { key: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        settings,
        summaries: {
          points: {
            configKey: pointsConfig?.key || null,
            latestUpdatedAt: pointsConfig?.updatedAt || null,
          },
        },
      },
    });
  } catch (error: unknown) {
    logger.error('[AdminGovernance] 获取系统配置失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
  }
});

adminGovernanceRouter.post('/system-config', async (req, res) => {
  try {
    const input = updateSettingsSchema.parse(req.body);
    const updates = input.settings.filter((setting) => settingKeys.has(setting.key));

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有可更新的系统配置项' });
    }

    await prisma.$transaction(
      updates.map((setting) => {
        const definition = SYSTEM_SETTINGS.find((item) => item.key === setting.key);
        return prisma.systemConfig.upsert({
          where: { key: setting.key },
          update: {
            value: serializeConfigValue(setting.value),
            description: definition?.description,
          },
          create: {
            key: setting.key,
            value: serializeConfigValue(setting.value),
            description: definition?.description,
          },
        });
      })
    );

    const admin = await getAdminIdentity(req);
    await logOperation({
      adminId: admin.id,
      adminUsername: admin.username,
      action: 'config_update',
      targetType: 'config',
      targetId: 'system-config',
      targetName: '系统配置中心',
      afterValue: updates,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: `已更新 ${updates.length} 个系统配置项` });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数错误', details: error.errors });
    }
    logger.error('[AdminGovernance] 更新系统配置失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
  }
});

adminGovernanceRouter.get('/permissions', async (_req, res) => {
  try {
    const [roleGroups, activeUsers, providerCount, activeProviderCount, userApiKeyCount] = await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.providerConfig.count(),
      prisma.providerConfig.count({ where: { isActive: true } }),
      prisma.userApiKey.count(),
    ]);

    const modules = [
      { key: 'points', label: '积分账户/调整', riskLevel: 'high', route: '/admin/points' },
      { key: 'membership', label: '会员套餐/手动开通', riskLevel: 'high', route: '/admin/memberships' },
      { key: 'provider', label: '服务商/平台密钥', riskLevel: 'high', route: '/ai-providers' },
      { key: 'api_key', label: '用户 API Key', riskLevel: 'high', route: '/admin/apikeys' },
      { key: 'system_config', label: '系统配置', riskLevel: 'high', route: '/admin/governance/system-config' },
      { key: 'audit', label: '审计日志', riskLevel: 'medium', route: '/operation-logs' },
      { key: 'export', label: '数据导出', riskLevel: 'medium', route: '/export' },
    ];

    const roles = roleGroups.map((group) => {
      const role = (group.role || 'user').toLowerCase();
      return {
        role,
        userCount: group._count._all,
        scope: role === 'admin' ? '全部后台能力' : '前台和个人资源',
        highRiskAccess: role === 'admin',
        modules: role === 'admin' ? modules.map((module) => module.key) : [],
      };
    });

    res.json({
      success: true,
      data: {
        roles,
        modules,
        summary: {
          activeUsers,
          providerCount,
          activeProviderCount,
          userApiKeyCount,
          highRiskModuleCount: modules.filter((module) => module.riskLevel === 'high').length,
        },
      },
    });
  } catch (error: unknown) {
    logger.error('[AdminGovernance] 获取权限概览失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
  }
});

adminGovernanceRouter.get('/audit-summary', async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [total, failed, highRisk, recentHighRisk, byAction] = await Promise.all([
      prisma.adminOperationLog.count({ where: { createdAt: { gte: since } } }),
      prisma.adminOperationLog.count({ where: { createdAt: { gte: since }, status: { in: ['failed', 'FAILURE', 'FAILED'] } } }),
      prisma.adminOperationLog.count({ where: { createdAt: { gte: since }, action: { in: HIGH_RISK_ACTIONS } } }),
      prisma.adminOperationLog.findMany({
        where: { createdAt: { gte: since }, action: { in: HIGH_RISK_ACTIONS } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.adminOperationLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
    ]);

    res.json({
      success: true,
      data: {
        days,
        total,
        failed,
        highRisk,
        successRate: total > 0 ? ((total - failed) / total) * 100 : 100,
        byAction: byAction.map((item) => ({ action: item.action, count: item._count._all })),
        recentHighRisk,
      },
    });
  } catch (error: unknown) {
    logger.error('[AdminGovernance] 获取审计概览失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
  }
});

adminGovernanceRouter.get('/alerts', async (_req, res) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [providers, failedTasks, failedOps, exhaustedKeys] = await Promise.all([
      prisma.providerConfig.findMany({
        include: { apiKeys: true },
        orderBy: { priority: 'desc' },
      }),
      prisma.task.count({ where: { createdAt: { gte: since24h }, status: 'failed' } }),
      prisma.adminOperationLog.count({ where: { createdAt: { gte: since24h }, status: { in: ['failed', 'FAILURE', 'FAILED'] } } }),
      prisma.providerApiKey.count({ where: { isActive: true, isExhausted: true } }),
    ]);

    const alerts: Array<Record<string, unknown>> = [];
    const providerHealth = providers.map((provider) => ({
      provider,
      health: assessProviderHealth(provider.isActive, provider.apiKeys),
    }));

    providerHealth.forEach(({ provider, health }) => {
      if (!provider.isActive) return;

      if (health.invalidKeys > 0) {
        alerts.push({
          id: `provider-invalid-key-${provider.provider}`,
          severity: 'critical',
          category: 'AI 服务商',
          title: `${provider.displayName || provider.provider} 存在无法解密的密钥`,
          detail: `${health.invalidKeys} 个 active 且未耗尽的密钥无法解密，模型调用会跳过这些密钥。请重新保存对应密钥。`,
          target: provider.provider,
        });
      }

      if (health.status === 'no_key') {
        alerts.push({
          id: `provider-no-key-${provider.provider}`,
          severity: 'critical',
          category: 'AI 服务商',
          title: `${provider.displayName || provider.provider} 无可用密钥`,
          detail: 'Provider 已激活但没有 active 且未耗尽的密钥，模型调用会失败。',
          target: provider.provider,
        });
      }
    });

    if (failedTasks > 0) {
      alerts.push({
        id: 'tasks-failed-24h',
        severity: failedTasks >= 10 ? 'high' : 'medium',
        category: '任务',
        title: '近 24 小时存在失败任务',
        detail: `${failedTasks} 个生成任务失败，建议查看任务管理和模型健康。`,
        target: 'tasks',
      });
    }

    if (failedOps > 0) {
      alerts.push({
        id: 'admin-failed-ops-24h',
        severity: 'high',
        category: '审计',
        title: '近 24 小时存在失败后台操作',
        detail: `${failedOps} 个后台操作失败，建议查看审计中心。`,
        target: 'audit',
      });
    }

    if (exhaustedKeys > 0) {
      alerts.push({
        id: 'provider-exhausted-keys',
        severity: 'high',
        category: 'AI 服务商',
        title: '存在已耗尽的服务商密钥',
        detail: `${exhaustedKeys} 个 active 密钥被标记为耗尽，建议轮换或补充密钥。`,
        target: 'provider-keys',
      });
    }

    res.json({ success: true, data: { alerts, total: alerts.length } });
  } catch (error: unknown) {
    logger.error('[AdminGovernance] 获取告警失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
  }
});

adminGovernanceRouter.get('/cost-analysis', async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 180);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [apiSummary, providerCost, taskCreditSummary, dailyRows] = await Promise.all([
      prisma.apiCallLog.aggregate({
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, totalCost: true, pointsCost: true },
      }),
      prisma.apiCallLog.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { totalCost: true, pointsCost: true, inputTokens: true, outputTokens: true },
      }),
      prisma.task.aggregate({
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { credits: true },
      }),
      prisma.apiCallLog.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, totalCost: true, pointsCost: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const dailyMap = new Map<string, { date: string; totalCost: number; pointsCost: number; apiCalls: number }>();
    dailyRows.forEach((row) => {
      const date = row.createdAt.toISOString().slice(0, 10);
      const current = dailyMap.get(date) || { date, totalCost: 0, pointsCost: 0, apiCalls: 0 };
      current.totalCost += row.totalCost || 0;
      current.pointsCost += row.pointsCost || 0;
      current.apiCalls += 1;
      dailyMap.set(date, current);
    });

    res.json({
      success: true,
      data: {
        days,
        summary: {
          apiCalls: apiSummary._count._all,
          inputTokens: apiSummary._sum.inputTokens || 0,
          outputTokens: apiSummary._sum.outputTokens || 0,
          totalCost: Number((apiSummary._sum.totalCost || 0).toFixed(4)),
          pointsCost: apiSummary._sum.pointsCost || 0,
          taskCount: taskCreditSummary._count._all,
          taskCredits: taskCreditSummary._sum.credits || 0,
        },
        providers: providerCost.map((item) => ({
          provider: item.provider || 'unknown',
          apiCalls: item._count._all,
          totalCost: Number((item._sum.totalCost || 0).toFixed(4)),
          pointsCost: item._sum.pointsCost || 0,
          tokens: (item._sum.inputTokens || 0) + (item._sum.outputTokens || 0),
        })).sort((a, b) => b.totalCost - a.totalCost),
        daily: Array.from(dailyMap.values()).map((item) => ({
          ...item,
          totalCost: Number(item.totalCost.toFixed(4)),
        })),
      },
    });
  } catch (error: unknown) {
    logger.error('[AdminGovernance] 获取成本分析失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
  }
});

adminGovernanceRouter.get('/model-health-daily', async (_req, res) => {
  try {
    const providers = await prisma.providerConfig.findMany({
      include: { apiKeys: true },
      orderBy: { priority: 'desc' },
    });

    const rows = providers.map((provider) => {
      const health = assessProviderHealth(provider.isActive, provider.apiKeys);
      return {
        provider: provider.provider,
        displayName: provider.displayName || provider.name,
        isActive: provider.isActive,
        totalKeys: provider.apiKeys.length,
        ...health,
        updatedAt: provider.updatedAt,
      };
    });

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        summary: {
          totalProviders: rows.length,
          activeProviders: rows.filter((row) => row.isActive).length,
          readyProviders: rows.filter((row) => row.status === 'ready').length,
          noKeyProviders: rows.filter((row) => row.status === 'no_key').length,
          invalidKeyProviders: rows.filter((row) => row.status === 'invalid_key').length,
          invalidKeys: rows.reduce((sum, row) => sum + row.invalidKeys, 0),
          exhaustedKeys: rows.reduce((sum, row) => sum + row.exhaustedKeys, 0),
        },
        providers: rows,
      },
    });
  } catch (error: unknown) {
    logger.error('[AdminGovernance] 获取模型健康失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
  }
});

adminGovernanceRouter.get('/exports', (_req, res) => {
  res.json({
    success: true,
    data: {
      types: [
        { type: 'users', label: '用户列表', endpoint: '/export/users/all' },
        { type: 'tasks', label: '任务记录', endpoint: '/export/tasks/all' },
        { type: 'payments', label: '支付记录', endpoint: '/export/payments/all' },
        { type: 'logs', label: '操作日志', endpoint: '/export/logs/all' },
        { type: 'quotas', label: '配额使用', endpoint: '/export/quotas/all' },
      ],
      formats: [
        { format: 'csv', label: 'CSV' },
        { format: 'json', label: 'JSON' },
        { format: 'excel', label: 'Excel' },
      ],
    },
  });
});
