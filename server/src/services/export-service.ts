import prisma from '../lib/prisma';
import { formatBytes } from '../utils/format';

type ExportFormat = 'csv' | 'excel' | 'json';

interface ExportOptions {
  userId?: string;
  startDate?: string;
  endDate?: string;
  format: ExportFormat;
}

interface ExportResult {
  success: boolean;
  data?: any;
  filename?: string;
  contentType?: string;
  error?: string;
}

class ExportService {
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private arrayToCSV(data: any[], headers: string[]): string {
    const headerRow = headers.join(',');
    const rows = data.map(item => {
      return headers.map(header => this.escapeCSVValue(item[header])).join(',');
    });
    return [headerRow, ...rows].join('\n');
  }

  async exportUsers(options: ExportOptions): Promise<ExportResult> {
    try {
      const where: any = {};
      
      if (options.startDate || options.endDate) {
        where.createdAt = {};
        if (options.startDate) {
          where.createdAt.gte = new Date(options.startDate);
        }
        if (options.endDate) {
          where.createdAt.lte = new Date(options.endDate);
        }
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const formattedUsers = users.map(user => ({
        ...user,
        createdAt: this.formatDate(user.createdAt),
        lastLoginAt: user.lastLoginAt ? this.formatDate(user.lastLoginAt) : ''
      }));

      const filename = `users_export_${Date.now()}`;

      if (options.format === 'csv') {
        return {
          success: true,
          data: this.arrayToCSV(formattedUsers, [
            'id', 'username', 'email', 'role',
            'isActive', 'createdAt', 'lastLoginAt'
          ]),
          filename: `${filename}.csv`,
          contentType: 'text/csv'
        };
      } else if (options.format === 'json') {
        return {
          success: true,
          data: JSON.stringify(formattedUsers, null, 2),
          filename: `${filename}.json`,
          contentType: 'application/json'
        };
      } else {
        return {
          success: true,
          data: formattedUsers,
          filename: `${filename}.json`,
          contentType: 'application/json'
        };
      }
    } catch (error) {
      console.error('[Export] Users export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '导出失败'
      };
    }
  }

  async exportTasks(options: ExportOptions): Promise<ExportResult> {
    try {
      const where: any = {};
      
      if (options.userId) {
        where.userId = options.userId;
      }
      
      if (options.startDate || options.endDate) {
        where.createdAt = {};
        if (options.startDate) {
          where.createdAt.gte = new Date(options.startDate);
        }
        if (options.endDate) {
          where.createdAt.lte = new Date(options.endDate);
        }
      }

      const tasks = await prisma.task.findMany({
        where,
        include: {
          user: {
            select: { username: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formattedTasks = tasks.map(task => ({
        id: task.id,
        username: task.user.username,
        email: task.user.email,
        taskType: task.type,
        provider: task.provider,
        model: task.model,
        mode: '',
        status: task.status,
        progress: task.progress,
        createdAt: this.formatDate(task.createdAt),
        updatedAt: this.formatDate(task.updatedAt),
        completedAt: ''
      }));

      const filename = `tasks_export_${Date.now()}`;

      if (options.format === 'csv') {
        return {
          success: true,
          data: this.arrayToCSV(formattedTasks, [
            'id', 'username', 'email', 'taskType', 'provider', 
            'model', 'mode', 'status', 'progress', 'createdAt', 'updatedAt', 'completedAt'
          ]),
          filename: `${filename}.csv`,
          contentType: 'text/csv'
        };
      } else if (options.format === 'json') {
        return {
          success: true,
          data: JSON.stringify(formattedTasks, null, 2),
          filename: `${filename}.json`,
          contentType: 'application/json'
        };
      } else {
        return {
          success: true,
          data: formattedTasks,
          filename: `${filename}.json`,
          contentType: 'application/json'
        };
      }
    } catch (error) {
      console.error('[Export] Tasks export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '导出失败'
      };
    }
  }

  async exportLogs(options: ExportOptions): Promise<ExportResult> {
    try {
      const where: any = {};
      
      if (options.userId) {
        where.userId = options.userId;
      }
      
      if (options.startDate || options.endDate) {
        where.createdAt = {};
        if (options.startDate) {
          where.createdAt.gte = new Date(options.startDate);
        }
        if (options.endDate) {
          where.createdAt.lte = new Date(options.endDate);
        }
      }

      // PERF-06 修复：添加分页支持，避免一次性加载过多数据
      const page = (options as any).page || 1;
      const pageSize = (options as any).pageSize || 1000;
      const offset = (page - 1) * pageSize;

      const logs = await prisma.usageLog.findMany({
        where,
        include: {
          user: {
            select: { username: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: pageSize,
      });

      const formattedLogs = logs.map(log => ({
        id: log.id,
        username: log.user.username,
        email: log.user.email,
        action: log.endpoint,
        actionType: log.method,
        beforeState: '',
        afterState: '',
        source: log.ip || '',
        duration: log.duration,
        metadata: log.params,
        createdAt: this.formatDate(log.createdAt)
      }));

      const filename = `logs_export_${Date.now()}`;

      if (options.format === 'csv') {
        return {
          success: true,
          data: this.arrayToCSV(formattedLogs, [
            'id', 'username', 'email', 'action', 'resource', 
            'status', 'ip', 'userAgent', 'createdAt'
          ]),
          filename: `${filename}.csv`,
          contentType: 'text/csv'
        };
      } else if (options.format === 'json') {
        return {
          success: true,
          data: JSON.stringify(formattedLogs, null, 2),
          filename: `${filename}.json`,
          contentType: 'application/json'
        };
      } else {
        return {
          success: true,
          data: formattedLogs,
          filename: `${filename}.json`,
          contentType: 'application/json'
        };
      }
    } catch (error) {
      console.error('[Export] Logs export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '导出失败'
      };
    }
  }

  async exportQuotas(options: ExportOptions): Promise<ExportResult> {
    try {
      const quotas = await prisma.userQuota.findMany({
        include: {
          user: {
            select: { username: true, email: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      const formattedQuotas = quotas.map(quota => ({
        username: quota.user.username,
        email: quota.user.email,
        dailyResetAt: quota.resetAt ? this.formatDate(quota.resetAt) : null,
        monthlyResetAt: quota.resetAt ? this.formatDate(quota.resetAt) : null,
        storageLimit: formatBytes(Number(quota.storageLimit)),
        fileLimit: quota.fileLimit,
        updatedAt: this.formatDate(quota.updatedAt)
      }));

      const filename = `quotas_export_${Date.now()}`;

      if (options.format === 'csv') {
        return {
          success: true,
          data: this.arrayToCSV(formattedQuotas, [
            'username', 'email', 'dailyResetAt', 'monthlyResetAt',
            'storageLimit', 'fileLimit', 'updatedAt'
          ]),
          filename: `${filename}.csv`,
          contentType: 'text/csv'
        };
      } else {
        return {
          success: true,
          data: JSON.stringify(formattedQuotas, null, 2),
          filename: `${filename}.json`,
          contentType: 'application/json'
        };
      }
    } catch (error) {
      console.error('[Export] Quotas export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '导出失败'
      };
    }
  }
}

export const exportService = new ExportService();
