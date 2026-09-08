import prisma from '../lib/prisma';

interface AuditLogParams {
  userId: string;
  username?: string;
  action: string;
  resource: string;
  resourceName?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  status?: string;
  errorMessage?: string;
}

interface AuditQuery {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  severity?: string;
}

interface AuditStats {
  total: number;
  byAction: Record<string, number>;
  bySource: Record<string, number>;
  byActionType: Record<string, number>;
  byDate: Record<string, number>;
  topUsers: { userId: string; username: string; count: number }[];
}

class AuditService {
  private buildEndpoint(resource: string, action: string): string {
    return `admin:${resource}:${action}`;
  }

  private parseEndpoint(endpoint: string): { action: string; resource: string; actionType: string; source: string } {
    const parts = endpoint.split(':');
    if (parts.length >= 3 && parts[0] === 'admin') {
      const resource = parts[1];
      const action = parts.slice(2).join(':');
      return {
        action,
        resource,
        actionType: `${resource}:${action}`,
        source: 'ADMIN',
      };
    }

    return {
      action: endpoint,
      resource: 'general',
      actionType: endpoint,
      source: 'SYSTEM',
    };
  }

  async log(params: AuditLogParams): Promise<void> {
    const {
      userId,
      action,
      resource,
      resourceName,
      metadata,
      ipAddress,
      userAgent,
      status,
      errorMessage
    } = params;

    await prisma.usageLog.create({
      data: {
        userId,
        endpoint: this.buildEndpoint(resource, action),
        method: status || (errorMessage ? 'ERROR' : 'SUCCESS'),
        params: JSON.stringify({
          resourceName,
          metadata: metadata || null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          errorMessage: errorMessage || null,
        }),
        status: errorMessage ? 500 : 200,
        duration: 0,
      }
    });
  }

  async query(params: AuditQuery): Promise<{
    items: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;

    const where: any = {};

    if (params.userId) {
      where.userId = params.userId;
    }

    if (params.action) {
      where.endpoint = { contains: params.action };
    }

    if (params.resource) {
      where.endpoint = {
        contains: params.resource,
      };
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.createdAt.lte = new Date(params.endDate);
      }
    }

    const [items, total] = await Promise.all([
      prisma.usageLog.findMany({
        where,
        include: {
          user: {
            select: { username: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.usageLog.count({ where })
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async getStats(period: string = '7d'): Promise<AuditStats> {
    const startDate = this.getStartDate(period);
    
    const where: any = {
      createdAt: {
        gte: startDate
      }
    };

    const [logs, methodCounts, _statusCounts, _dateCounts, topUsers] = await Promise.all([
      prisma.usageLog.findMany({
        where,
        select: {
          createdAt: true,
          endpoint: true,
          method: true,
          status: true,
        }
      }),
      prisma.usageLog.groupBy({
        by: ['method'],
        where,
        _count: true
      }),
      prisma.usageLog.groupBy({
        by: ['status'],
        where,
        _count: true
      }),
      prisma.usageLog.groupBy({
        by: ['createdAt'],
        where: {
          ...where,
          createdAt: {
            gte: startDate
          }
        },
        _count: true
      }),
      prisma.usageLog.groupBy({
        by: ['userId'],
        where,
        _count: true,
        orderBy: {
          _count: {
            userId: 'desc'
          }
        },
        take: 10
      })
    ]);

    const byAction: Record<string, number> = {};
    logs.forEach(log => {
      const { action } = this.parseEndpoint(log.endpoint);
      byAction[action] = (byAction[action] || 0) + 1;
    });

    const bySource: Record<string, number> = {};
    logs.forEach(log => {
      const { source } = this.parseEndpoint(log.endpoint);
      bySource[source] = (bySource[source] || 0) + 1;
    });

    const byActionType: Record<string, number> = {};
    methodCounts.forEach(item => {
      byActionType[item.method || 'UNKNOWN'] = item._count;
    });

    const byDate: Record<string, number> = {};
    logs.forEach(log => {
      const date = log.createdAt.toISOString().split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    });

    const topUsersWithNames = await Promise.all(
      topUsers.map(async (item) => {
        const user = await prisma.user.findUnique({
          where: { id: item.userId },
          select: { username: true }
        });
        return {
          userId: item.userId,
          username: user?.username || 'Unknown',
          count: item._count
        };
      })
    );

    return {
      total: logs.length,
      byAction,
      bySource,
      byActionType,
      byDate,
      topUsers: topUsersWithNames
    };
  }

  private getStartDate(period: string): Date {
    const now = new Date();
    
    switch (period) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  async getSecurityEvents(period: string = '7d'): Promise<any[]> {
    const startDate = this.getStartDate(period);

    const securityActions = [
      'login_failed',
      'login_success',
      'logout',
      'password_change',
      'api_key_create',
      'api_key_delete',
      'permission_denied',
      'quota_exceeded',
      'payment_failed'
    ];

    const logs = await prisma.usageLog.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      },
      include: {
        user: {
          select: { username: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return logs
      .filter((log) => securityActions.includes(this.parseEndpoint(log.endpoint).action))
      .map(log => ({
        ...log,
        eventType: this.categorizeSecurityEvent(this.parseEndpoint(log.endpoint).action),
        riskLevel: this.assessRiskLevel(this.parseEndpoint(log.endpoint).action)
      }));
  }

  private categorizeSecurityEvent(action: string): string {
    if (action.includes('login')) return '认证';
    if (action.includes('password')) return '密码';
    if (action.includes('api_key')) return 'API密钥';
    if (action.includes('permission')) return '权限';
    if (action.includes('quota')) return '配额';
    if (action.includes('payment')) return '支付';
    return '其他';
  }

  private assessRiskLevel(action: string): string {
    if (action.includes('login_failed') || action.includes('permission_denied')) {
      return 'high';
    }
    if (action.includes('payment_failed') || action.includes('quota_exceeded')) {
      return 'medium';
    }
    return 'low';
  }

  async getUserActivity(userId: string, period: string = '30d'): Promise<any> {
    const startDate = this.getStartDate(period);

    const [activity, summary] = await Promise.all([
      prisma.usageLog.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      }),
      prisma.usageLog.groupBy({
        by: ['endpoint'],
        where: {
          userId,
          createdAt: {
            gte: startDate
          }
        },
        _count: true
      })
    ]);

    return {
      activity,
      summary: summary.map(item => ({
        action: this.parseEndpoint(item.endpoint).action,
        count: item._count
      })),
      period,
      totalActions: activity.length
    };
  }

  async getAnomalies(period: string = '24h'): Promise<any[]> {
    const startDate = this.getStartDate(period);

    const logs = await prisma.usageLog.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      },
      include: {
        user: {
          select: { username: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const anomalies: any[] = [];

    const userActionCounts = new Map<string, number>();
    const userSourceMap = new Map<string, Set<string>>();
    const failedActions: typeof logs = [];

    logs.forEach(log => {
      const count = userActionCounts.get(log.userId) || 0;
      userActionCounts.set(log.userId, count + 1);

      const { source, action } = this.parseEndpoint(log.endpoint);

      if (source) {
        const sources = userSourceMap.get(log.userId) || new Set();
        sources.add(source);
        userSourceMap.set(log.userId, sources);
      }

      if (action.includes('failed')) {
        failedActions.push(log);
      }
    });

    userActionCounts.forEach((count, userId) => {
      if (count > 100) {
        const user = logs.find(l => l.userId === userId)?.user;
        anomalies.push({
          type: 'high_activity',
          userId,
          username: user?.username || 'Unknown',
          count,
          threshold: 100,
          severity: 'warning'
        });
      }
    });

    userSourceMap.forEach((sources, userId) => {
      if (sources.size > 5) {
        const user = logs.find(l => l.userId === userId)?.user;
        anomalies.push({
          type: 'multiple_source',
          userId,
          username: user?.username || 'Unknown',
          sourceCount: sources.size,
          sources: Array.from(sources),
          severity: 'warning'
        });
      }
    });

    if (failedActions.length > 10) {
      anomalies.push({
        type: 'high_failure_rate',
        count: failedActions.length,
        total: logs.length,
        percentage: ((failedActions.length / logs.length) * 100).toFixed(2),
        severity: 'critical'
      });
    }

    return anomalies;
  }
}

export const auditService = new AuditService();
