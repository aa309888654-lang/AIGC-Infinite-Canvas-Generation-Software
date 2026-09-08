import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { loggingService } from './logging-service';
import { config } from '../types/env';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  weekRevenue: number;
  totalQuota: number;
  usedQuota: number;
  systemHealth: {
    uptime: number;
    avgResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
}

export interface UserManagement {
  id: string;
  username: string;
  email: string;
  phone?: string;
  role: string;
  apiQuota: number;
  usedQuota: number;
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
  totalOrders: number;
  totalSpent: number;
}

export interface OrderManagement {
  id: string;
  orderNo: string;
  userId: string;
  username: string;
  email: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  transactionId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface EmailLog {
  id: string;
  email: string;
  type: string;
  code: string;
  status: string;
  ipAddress?: string;
  expiresAt: Date;
  verifiedAt?: Date;
  createdAt: Date;
}

export interface SystemSettings {
  siteName: string;
  siteUrl: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  emailVerificationRequired: boolean;
  maxUsers: number;
  defaultQuota: number;
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

class AdminService {
  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      orders,
      totalQuota,
      usedQuota,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.paymentLog.findMany({
        select: {
          status: true,
          amount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      prisma.user.aggregate({ _sum: { apiQuota: true } }),
      prisma.user.aggregate({ _sum: { usedQuota: true } }),
    ]);

    const completedOrders = orders.filter((o) => o.status === 'completed');
    const pendingOrders = orders.filter(
      (o) => o.status === 'pending' || o.status === 'processing'
    );

    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.amount, 0);
    const todayRevenue = completedOrders
      .filter((o) => o.createdAt >= today)
      .reduce((sum, o) => sum + o.amount, 0);
    const weekRevenue = completedOrders
      .filter((o) => o.createdAt >= weekAgo)
      .reduce((sum, o) => sum + o.amount, 0);

    return {
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      pendingOrders: pendingOrders.length,
      totalRevenue,
      todayRevenue,
      weekRevenue,
      totalQuota: totalQuota._sum.apiQuota || 0,
      usedQuota: usedQuota._sum.usedQuota || 0,
      systemHealth: {
        uptime: process.uptime(),
        avgResponseTime: 0,
        errorRate: 0,
        activeConnections: 0,
      },
    };
  }

  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ users: UserManagement[]; pagination: any }> {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { payments: true },
          },
          payments: {
            where: { status: 'completed' },
            select: { amount: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const formattedUsers: UserManagement[] = users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      phone: (user as any).phone,
      role: user.role,
      apiQuota: user.apiQuota,
      usedQuota: user.usedQuota,
      isActive: user.isActive,
      createdAt: user.createdAt,
      totalOrders: user._count.payments,
      totalSpent: user.payments.reduce((sum, p) => sum + p.amount, 0),
    }));

    return {
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUser(
    userId: string,
    data: {
      username?: string;
      email?: string;
      phone?: string;
      password?: string;
      role?: string;
      apiQuota?: number;
      isActive?: boolean;
    }
  ): Promise<UserManagement> {
    const updateData: any = { ...data };
    
    if (updateData.password) {
      updateData.passwordHash = await bcrypt.hash(updateData.password, config.bcryptRounds);
      delete updateData.password;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        payments: {
          where: { status: 'completed' },
          select: { amount: true },
        },
      },
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: (user as any).phone,
      role: user.role,
      apiQuota: user.apiQuota,
      usedQuota: user.usedQuota,
      isActive: user.isActive,
      createdAt: user.createdAt,
      totalOrders: user.payments.length,
      totalSpent: user.payments.reduce((sum, p) => sum + p.amount, 0),
    };
  }

  async deleteUser(userId: string): Promise<void> {
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  async batchUpdateUsers(
    userIds: string[],
    data: { isActive?: boolean; role?: string }
  ): Promise<number> {
    const result = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data,
    });
    return result.count;
  }

  async getOrders(params: {
    page?: number;
    limit?: number;
    userId?: string;
    status?: string;
    paymentMethod?: string;
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
  }): Promise<{ orders: OrderManagement[]; pagination: any }> {
    const {
      page = 1,
      limit = 20,
      userId,
      status,
      paymentMethod,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
    } = params;

    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) where.amount.gte = minAmount;
      if (maxAmount) where.amount.lte = maxAmount;
    }

    let userFilter = {};
    if (search) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: search } },
            { email: { contains: search } },
          ],
        },
        select: { id: true },
      });
      userFilter = { userId: { in: users.map((u) => u.id) } };
    }

    const [orders, total] = await Promise.all([
      prisma.paymentLog.findMany({
        where: { ...where, ...userFilter },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { username: true, email: true },
          },
        },
      }),
      prisma.paymentLog.count({ where: { ...where, ...userFilter } }),
    ]);

    const formattedOrders: OrderManagement[] = orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      userId: order.userId,
      username: order.user.username,
      email: order.user.email,
      amount: order.amount,
      currency: order.currency,
      paymentMethod: order.method || undefined,
      status: order.status,
      transactionId: order.transactionId || undefined,
      createdAt: order.createdAt,
      completedAt: order.paidAt || undefined,
    }));

    return {
      orders: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

    async getOrderStats(): Promise<any> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [todayCount, todayCompletedCount, todayRevenue, weekCount, weekCompletedCount, weekRevenue, allCount, allCompletedCount, allRevenue] = await Promise.all([
      prisma.paymentLog.count({ where: { createdAt: { gte: today } } }),
      prisma.paymentLog.count({ where: { createdAt: { gte: today }, status: 'completed' } }),
      prisma.paymentLog.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: today }, status: 'completed' } }),
      prisma.paymentLog.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.paymentLog.count({ where: { createdAt: { gte: weekAgo }, status: 'completed' } }),
      prisma.paymentLog.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: weekAgo }, status: 'completed' } }),
      prisma.paymentLog.count(),
      prisma.paymentLog.count({ where: { status: 'completed' } }),
      prisma.paymentLog.aggregate({ _sum: { amount: true }, where: { status: 'completed' } }),
    ]);

    const todayRev = todayRevenue._sum.amount || 0;
    const weekRev = weekRevenue._sum.amount || 0;
    const allRev = allRevenue._sum.amount || 0;

    return {
      today: {
        count: todayCount,
        revenue: todayRev,
        avgAmount: todayCompletedCount > 0 ? todayRev / todayCompletedCount : 0,
      },
      week: {
        count: weekCount,
        revenue: weekRev,
        avgAmount: weekCompletedCount > 0 ? weekRev / weekCompletedCount : 0,
      },
      total: {
        count: allCount,
        revenue: allRev,
        avgAmount: allCompletedCount > 0 ? allRev / allCompletedCount : 0,
      },
    };
  }

  async exportOrders(params: any): Promise<string> {
    const { orders } = await this.getOrders({ ...params, limit: 10000 });
    
    const headers = [
      '订单号',
      '用户名',
      '邮箱',
      '金额',
      '货币',
      '支付方式',
      '状态',
      '交易ID',
      '创建时间',
      '完成时间',
    ];

    const rows = orders.map((o) => [
      o.orderNo,
      o.username,
      o.email,
      o.amount.toString(),
      o.currency,
      o.paymentMethod,
      o.status,
      o.transactionId || '',
      o.createdAt.toISOString(),
      o.completedAt?.toISOString() || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    return csv;
  }

  async getEmailLogs(params: {
    page?: number;
    limit?: number;
    email?: string;
    type?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ logs: EmailLog[]; pagination: any }> {
    const { page = 1, limit = 20, email, type, status, startDate, endDate } =
      params;

    const where: any = {};
    if (email) where.email = { contains: email };
    if (type) where.type = type;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.emailVerification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.emailVerification.count({ where }),
    ]);

    const formattedLogs: EmailLog[] = logs.map((log) => ({
      id: log.id,
      email: log.email,
      type: log.type,
      code: log.code,
      status: log.status,
      ipAddress: log.ipAddress || undefined,
      expiresAt: log.expiresAt,
      verifiedAt: log.verifiedAt || undefined,
      createdAt: log.createdAt,
    }));

    return {
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

    async getEmailStats(): Promise<any> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [todayCount, todayVerified, todayFailed, todayExpired, weekCount, weekVerified, weekFailed, weekExpired, allCount, allVerified, allFailed, allExpired] = await Promise.all([
      prisma.emailVerification.count({ where: { createdAt: { gte: today } } }),
      prisma.emailVerification.count({ where: { createdAt: { gte: today }, status: 'verified' } }),
      prisma.emailVerification.count({ where: { createdAt: { gte: today }, status: 'failed' } }),
      prisma.emailVerification.count({ where: { createdAt: { gte: today }, status: 'expired' } }),
      prisma.emailVerification.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.emailVerification.count({ where: { createdAt: { gte: weekAgo }, status: 'verified' } }),
      prisma.emailVerification.count({ where: { createdAt: { gte: weekAgo }, status: 'failed' } }),
      prisma.emailVerification.count({ where: { createdAt: { gte: weekAgo }, status: 'expired' } }),
      prisma.emailVerification.count(),
      prisma.emailVerification.count({ where: { status: 'verified' } }),
      prisma.emailVerification.count({ where: { status: 'failed' } }),
      prisma.emailVerification.count({ where: { status: 'expired' } }),
    ]);

    return {
      today: {
        sent: todayCount,
        verified: todayVerified,
        failed: todayFailed,
        expired: todayExpired,
      },
      week: {
        sent: weekCount,
        verified: weekVerified,
        failed: weekFailed,
        expired: weekExpired,
      },
      total: {
        sent: allCount,
        verified: allVerified,
        failed: allFailed,
        expired: allExpired,
      },
      verificationRate: allCount > 0 ? ((allVerified / allCount) * 100).toFixed(2) : '0.00',
    };
  }

  async getSystemSettings(): Promise<SystemSettings> {
    return {
      siteName: 'AI Video Generation Platform',
      siteUrl: process.env.SITE_URL || config.baseUrl,
      maintenanceMode: false,
      registrationEnabled: true,
      emailVerificationRequired: false,
      maxUsers: 10000,
      defaultQuota: 100,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 100,
      },
    };
  }

  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
    logger.info('Updating system settings:', settings);
  }

  private async updateEnvFile(envVars: Record<string, string>): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      console.error('.env file not found');
      return;
    }

    let envContent = fs.readFileSync(envPath, 'utf-8');
    
    for (const [key, value] of Object.entries(envVars)) {
      const regex = new RegExp(`^${key}=.*`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }

    fs.writeFileSync(envPath, envContent);
    logger.info('Environment file updated successfully');
  }

  async getUsageStats(params: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<any> {
    const { startDate, endDate, groupBy = 'day' } = params;
    const logs = await loggingService.getUsageLogs({
      startDate,
      endDate,
      limit: 1000,
    });

    const stats: any = {};
    logs.logs.forEach((log: any) => {
      const date = new Date(log.createdAt);
      let key: string;

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const week = Math.floor(
          date.getTime() / (7 * 24 * 60 * 60 * 1000)
        );
        key = `Week ${week}`;
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          '0'
        )}`;
      }

      if (!stats[key]) {
        stats[key] = { count: 0, users: new Set() };
      }
      stats[key].count++;
      stats[key].users.add(log.userId);
    });

    return Object.entries(stats).map(([period, data]: [string, any]) => ({
      period,
      count: data.count,
      uniqueUsers: data.users.size,
    }));
  }

  async getLoginStats(params: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<any> {
    const { startDate, endDate } = params;
    const logs = await loggingService.getLoginLogs({
      startDate,
      endDate,
      limit: 1000,
    });

    const success = logs.logs.filter(
      (log: any) => log.loginResult === 'success'
    ).length;
    const failed = logs.logs.filter(
      (log: any) => log.loginResult === 'failed'
    ).length;

    return {
      total: logs.logs.length,
      success,
      failed,
      successRate:
        logs.logs.length > 0 ? ((success / logs.logs.length) * 100).toFixed(2) : '0.00',
      recentAttempts: logs.logs.slice(0, 10),
    };
  }

  async getAllApiKeys(): Promise<any[]> {
    const apiKeys = await prisma.apiKey.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map((key) => ({
      id: key.id,
      provider: key.provider,
      apiKey: key.key.substring(0, 20) + '...',
      apiSecret: null,
      endpoint: null,
      isActive: key.isActive,
      userId: key.userId,
      username: key.user.username,
      email: key.user.email,
      createdAt: key.createdAt,
      updatedAt: key.lastUsed || key.createdAt,
    }));
  }

  async getAllTasks(params: {
    page?: number;
    limit?: number;
    status?: string;
    taskType?: string;
    userId?: string;
  }): Promise<{ tasks: any[]; pagination: any }> {
    const { page = 1, limit = 20, status, taskType, userId } = params;

    const where: any = {};
    if (status) where.status = status;
    if (taskType) where.type = taskType;
    if (userId) where.userId = userId;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks: tasks.map((task) => ({
        id: task.id,
        taskType: task.type,
        provider: task.provider,
        model: task.model,
        mode: '',
        status: task.status,
        progress: task.progress,
        errorMessage: task.error,
        userId: task.userId,
        username: task.user.username,
        email: task.user.email,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

    async getStats(): Promise<{
    totalUsers: number;
    totalTasks: number;
    totalApiKeys: number;
    totalQuota: number;
    usedQuota: number;
  }> {
    const [totalUsers, totalTasks, totalApiKeys, totalDailyLimit, totalDailyUsed] = await Promise.all([
      prisma.user.count(),
      prisma.task.count(),
      prisma.userApiKey.count(),
      prisma.userQuota.aggregate({ _sum: { dailyLimit: true } }),
      prisma.userQuota.aggregate({ _sum: { dailyUsed: true } }),
    ]);

    const usedQuota = await prisma.user.aggregate({ _sum: { usedQuota: true } });

    return {
      totalUsers,
      totalTasks,
      totalApiKeys,
      totalQuota: totalDailyLimit._sum.dailyLimit || 0,
      usedQuota: (usedQuota._sum.usedQuota || 0) + (totalDailyUsed._sum.dailyUsed || 0),
    };
  }

  // ==================== API密钥管理增强 ====================

  async createApiKey(data: {
    userId: string;
    keyName: string;
    provider?: string;
    models?: string;
    permissions?: string;
    rateLimit?: number;
    expiresAt?: string;
  }) {
    const apiKey = `ak_${crypto.randomBytes(24).toString('hex')}`;
    const apiSecret = crypto.randomBytes(32).toString('hex');

    return prisma.userApiKey.create({
      data: {
        userId: data.userId,
        keyName: data.keyName,
        apiKey,
        apiSecret,
        provider: data.provider || 'general',
        models: data.models,
        permissions: data.permissions,
        rateLimit: data.rateLimit || 60,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
  }

  async updateApiKey(id: string, data: {
    keyName?: string;
    provider?: string;
    models?: string;
    permissions?: string;
    rateLimit?: number;
    rateLimitWindow?: string;
    expiresAt?: string;
  }) {
    const updateData: any = { ...data };
    if (data.expiresAt) {
      updateData.expiresAt = new Date(data.expiresAt);
    }
    return prisma.userApiKey.update({ where: { id }, data: updateData });
  }

  async deleteApiKey(id: string) {
    return prisma.userApiKey.delete({ where: { id } });
  }

  async toggleApiKey(id: string) {
    const key = await prisma.userApiKey.findUnique({ where: { id } });
    if (!key) throw new Error('API密钥不存在');
    return prisma.userApiKey.update({
      where: { id },
      data: { isActive: !key.isActive },
    });
  }

  async getApiKeyStats(id: string) {
    const key = await prisma.userApiKey.findUnique({
      where: { id },
      include: {
        callLogs: {
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!key) throw new Error('API密钥不存在');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCalls = await prisma.apiCallLog.groupBy({
      by: ['createdAt'],
      where: {
        userApiKeyId: id,
        createdAt: { gte: sevenDaysAgo },
      },
      _count: true,
    });

    return {
      keyInfo: {
        id: key.id,
        keyName: key.keyName,
        apiKey: key.apiKey,
        isActive: key.isActive,
        totalCalls: key.totalCalls,
        totalCost: key.totalCost,
        lastUsedAt: key.lastUsedAt,
        rateLimit: key.rateLimit,
        createdAt: key.createdAt,
      },
      recentCalls: key.callLogs,
      dailyStats: recentCalls,
    };
  }

  // ==================== 营销活动模块 ====================

  async getCampaignParticipations(campaignId: string) {
    return prisma.campaignParticipation.findMany({
      where: { campaignId },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==================== 客服工单模块 ====================

  async getTickets(params: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    category?: string;
    assignedTo?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    if (params.category) where.category = params.category;

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTicketDetail(id: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, email: true, phone: true } },
      },
    });

    if (!ticket) {
      return null;
    }

    let messages: Array<Record<string, unknown>> = [];
    try {
      messages = (ticket.messages as unknown as Array<Record<string, unknown>>) || [];
    } catch {
      messages = [];
    }

    return {
      ...ticket,
      replies: messages,
    };
  }

  async updateTicket(id: string, data: {
    status?: string;
    priority?: string;
    category?: string;
    assignedTo?: string;
    tags?: string;
    resolution?: string;
  }) {
    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.priority) updateData.priority = data.priority;
    if (data.category) updateData.category = data.category;
    if (data.status === 'closed') {
      updateData.resolvedAt = new Date();
    }
    return prisma.ticket.update({ where: { id }, data: updateData });
  }

  async deleteTicket(id: string) {
    return prisma.ticket.delete({ where: { id } });
  }

  async addTicketReply(ticketId: string, data: {
    content: string;
    adminId?: string;
    userId?: string;
    isInternal?: boolean;
  }) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, messages: true },
    });

    if (!ticket) {
      throw new Error('工单不存在');
    }

    let messages: Array<Record<string, unknown>> = [];
    try {
      messages = (ticket.messages as unknown as Array<Record<string, unknown>>) || [];
    } catch {
      messages = [];
    }

    const reply = {
      id: `reply_${Date.now()}`,
      content: data.content,
      adminId: data.adminId || null,
      userId: data.userId || null,
      isInternal: data.isInternal || false,
      createdAt: new Date().toISOString(),
    };

    messages.push(reply);

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { messages: messages as any },
    });

    return reply;
  }

  // ==================== 系统设置面板增强 ====================

  async getSettingsCategories() {
    const configs = await prisma.systemConfig.findMany();
    const configMap: Record<string, string> = {};
    configs.forEach(c => { configMap[c.key] = c.value; });

    return {
      basic: {
        label: '基础设置',
        settings: {
          siteName: { value: configMap.siteName || config.SITE_NAME || '', label: '站点名称', type: 'text' },
          siteUrl: { value: configMap.siteUrl || '', label: '站点URL', type: 'text' },
          maintenanceMode: { value: configMap.maintenanceMode || 'false', label: '维护模式', type: 'toggle' },
          registrationEnabled: { value: configMap.registrationEnabled || 'true', label: '开放注册', type: 'toggle' },
          maxUsers: { value: configMap.maxUsers || '0', label: '最大用户数(0=无限)', type: 'number' },
          defaultQuota: { value: configMap.defaultQuota || '100', label: '默认配额', type: 'number' },
        },
      },
      rateLimit: {
        label: '限流设置',
        settings: {
          rateLimitWindow: { value: configMap.rateLimitWindow || '60000', label: '限流窗口(ms)', type: 'number' },
          rateLimitMax: { value: configMap.rateLimitMax || '100', label: '最大请求数', type: 'number' },
          apiRateLimit: { value: configMap.apiRateLimit || '60', label: 'API限流(次/分)', type: 'number' },
        },
      },
      security: {
        label: '安全设置',
        settings: {
          jwtExpiresIn: { value: configMap.jwtExpiresIn || '7d', label: 'Token过期时间', type: 'text' },
          bcryptRounds: { value: configMap.bcryptRounds || '10', label: '加密轮数', type: 'number' },
          loginMaxAttempts: { value: configMap.loginMaxAttempts || '5', label: '最大登录尝试', type: 'number' },
          loginLockDuration: { value: configMap.loginLockDuration || '30', label: '锁定时长(分钟)', type: 'number' },
        },
      },
      storage: {
        label: '存储设置',
        settings: {
          maxFileSize: { value: configMap.maxFileSize || '10485760', label: '最大文件大小(B)', type: 'number' },
          allowedFileTypes: { value: configMap.allowedFileTypes || 'jpg,jpeg,png,gif,pdf,doc,docx', label: '允许的文件类型', type: 'text' },
          storageProvider: { value: configMap.storageProvider || 'local', label: '存储提供商', type: 'select', options: ['local', 's3', 'oss'] },
        },
      },
    };
  }

  async batchUpdateSettings(settings: Record<string, string>) {
    const operations = Object.entries(settings).map(([key, value]) =>
      prisma.systemConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    );
    await Promise.all(operations);

    const envMappings: Record<string, string> = {
      siteName: 'SITE_NAME',
      siteUrl: 'SITE_URL',
      maintenanceMode: 'MAINTENANCE_MODE',
      jwtExpiresIn: 'JWT_EXPIRES_IN',
    };

    for (const [key, envKey] of Object.entries(envMappings)) {
      if (settings[key]) {
        try {
          await this.updateEnvFile({ [envKey]: settings[key] });
        } catch (e) {
          console.warn(`[AdminService] Failed to persist setting "${key}" to env file:`, e);
        }
      }
    }

    return { updated: Object.keys(settings).length };
  }
}

export const adminService = new AdminService();
