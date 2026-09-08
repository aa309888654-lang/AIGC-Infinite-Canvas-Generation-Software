import { Express } from 'express';
import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { redisService } from './redis-service';

export interface LogLevel {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  value: number;
}

const LOG_LEVELS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

// P1 修复 #11：Loki transport 接口（pino-loki 实例的子集）
interface LokiTransportLike {
  level: string;
  log: (obj: Record<string, unknown>) => void;
  end: () => void;
}

class LoggingService {
  // P1 修复 #11：真正持有 pino-loki transport 实例，用于异步推送日志到 Loki
  private lokiTransport: LokiTransportLike | null = null;
  private isLokiConfigured: boolean = false;
  private logBuffer: LogEntry[] = [];
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 5000;

  constructor() {
    if (process.env.NODE_ENV !== 'test') {
      this.startPeriodicFlush();
    }
  }

  private logToConsole(level: keyof typeof LOG_LEVELS, message: string, ...args: unknown[]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    switch (level) {
      case 'debug':
        console.debug(prefix, message, ...args);
        break;
      case 'info':
        console.info(prefix, message, ...args);
        break;
      case 'warn':
        console.warn(prefix, message, ...args);
        break;
      case 'error':
      case 'fatal':
        console.error(prefix, message, ...args);
        break;
    }
  }

  /**
   * P1 修复 #11：真正实例化 pino-loki transport，将日志推送到 Loki
   * 之前只是设置标志位，依赖从未被实例化。现在通过动态导入 pino-loki 创建 transport。
   */
  async configureLoki(): Promise<boolean> {
    const lokiUrl = process.env.LOKI_URL;
    const lokiHost = process.env.LOKI_HOST;

    if (!lokiUrl && !lokiHost) {
      console.log('[Logging] Loki not configured (LOKI_URL/LOKI_HOST 未设置)，Loki 集成已禁用');
      return false;
    }

    try {
      const targetUrl = lokiUrl || `http://${lokiHost}:3100/loki/api/v1/push`;
      // 动态导入避免未配置时加载失败影响启动
      const pinoLokiModule: any = await import('pino-loki');

      // pino-loki v2 默认导出 transport 工厂；兼容 default / named 两种导出形式
      const createTransport = pinoLokiModule.default ?? pinoLokiModule.pinoLoki ?? pinoLokiModule;

      const labels = this.parseLokiLabels();
      const transportOptions: Record<string, unknown> = {
        host: targetUrl,
        labels: { app: process.env.APP_NAME || 'backend', ...labels },
        // silence console output from the transport itself
        silenceErrors: false,
        replaceTimestamp: true,
      };

      // 可选 Basic Auth（Loki 网关带鉴权时）
      const lokiUser = process.env.LOKI_USER || process.env.LOKI_USERNAME;
      const lokiPass = process.env.LOKI_PASSWORD || process.env.LOKI_API_KEY;
      if (lokiUser && lokiPass) {
        transportOptions.basicAuth = `${lokiUser}:${lokiPass}`;
      }

      // pino-loki 的 createWriteStream / transport 两种 API 兼容
      if (typeof createTransport === 'function') {
        const stream = await createTransport(transportOptions);
        this.lokiTransport = this.adaptLokiStream(stream);
      } else if (typeof createTransport === 'object' && createTransport) {
        // 已是 transport 实例
        this.lokiTransport = this.adaptLokiStream(createTransport);
      } else {
        throw new Error('pino-loki 模块导出形式未识别');
      }

      this.isLokiConfigured = true;
      console.log(`[Logging] Loki 已接入: ${targetUrl}, labels=${JSON.stringify(labels)}`);
      return true;
    } catch (error) {
      this.isLokiConfigured = false;
      this.lokiTransport = null;
      console.error('[Logging] Loki 接入失败（降级为仅 Redis+Console）:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private parseLokiLabels(): Record<string, string> {
    const raw = process.env.LOKI_LABELS;
    if (!raw) return {};
    const labels: Record<string, string> = {};
    for (const pair of raw.split(',')) {
      const [k, v] = pair.split('=');
      if (k && v) labels[k.trim()] = v.trim();
    }
    return labels;
  }

  /**
   * 将 pino-loki 的 stream/transport 适配为统一的 LokiTransportLike 接口
   * 支持 write(obj) / pino.write 形式
   */
  private adaptLokiStream(stream: any): LokiTransportLike {
    if (!stream || typeof stream !== 'object') {
      throw new Error('Loki stream 不是对象');
    }
    // pino-loki v2 transport 暴露 write(chunk) 接收 NDJSON 字符串
    if (typeof stream.write === 'function') {
      return {
        level: process.env.LOKI_LEVEL || 'info',
        log: (obj: Record<string, unknown>) => {
          try {
            stream.write(JSON.stringify(obj) + '\n');
          } catch {
            /* swallow transport errors */
          }
        },
        end: () => {
          try { stream.end(); } catch { /* ignore */ }
        },
      };
    }
    // 兜底：假定是 pino 实例
    if (typeof stream.info === 'function') {
      return {
        level: process.env.LOKI_LEVEL || 'info',
        log: (obj: Record<string, unknown>) => {
          const level = String(obj.level || 'info');
          if (typeof (stream as any)[level] === 'function') {
            (stream as any)[level](obj);
          } else {
            stream.info(obj);
          }
        },
        end: () => {
          try { stream.end(); } catch { /* ignore */ }
        },
      };
    }
    throw new Error('Loki stream 缺少 write/info 方法，无法适配');
  }

  private startPeriodicFlush() {
    setInterval(() => {
      this.flushLogs();
    }, this.FLUSH_INTERVAL);
  }

  private async flushLogs() {
    if (this.logBuffer.length > 0) {
      try {
        // Store in Redis for quick access
        const redisClient = redisService.getClient();
        if (redisService.isConnected() && redisClient) {
          const key = `logs:${new Date().toISOString().slice(0, 10)}`;
          await redisClient.lpush(key, JSON.stringify(this.logBuffer));
          await redisClient.ltrim(key, 0, 999);
          await redisClient.expire(key, 7 * 24 * 60 * 60); // 7 days
        }

        this.logBuffer = [];
      } catch (error) {
        console.error('[Logging] Flush failed:', error);
      }
    }
  }

  private log(level: keyof typeof LOG_LEVELS, message: string, meta?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta
    };

    this.logBuffer.push(entry);

    // P1 修复 #11：同时将结构化日志推送到 Loki transport（异步，失败不影响主流程）
    if (this.lokiTransport) {
      try {
        // pino 约定: level 用数字值
        const levelValue = LOG_LEVELS[level] ?? 30;
        this.lokiTransport.log({
          level: levelValue,
          time: Date.now(),
          msg: message,
          ...meta,
        });
      } catch {
        /* swallow loki transport errors */
      }
    }

    // Also log immediately for critical levels
    if (level === 'error' || level === 'fatal') {
      this.flushLogs();
    }

    this.logToConsole(level, message, meta);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.log('error', message, meta);
  }

  fatal(message: string, meta?: Record<string, any>) {
    this.log('fatal', message, meta);
  }

  async getRecentLogs(count: number = 100, level?: string): Promise<LogEntry[]> {
    try {
      const redisClient = redisService.getClient();
      if (!redisClient) return [];
      
      const key = `logs:${new Date().toISOString().slice(0, 10)}`;
      const logs = await redisClient.lrange(key, 0, count - 1);

      if (!logs) return [];

      return logs
        .map(log => JSON.parse(log) as LogEntry[])
        .flat()
        .filter(log => !level || log.level === level);
    } catch (error) {
      console.error('[Logging] Get recent logs failed:', error);
      return [];
    }
  }

  async getLogsByDate(date: string, level?: string): Promise<LogEntry[]> {
    try {
      const redisClient = redisService.getClient();
      if (!redisClient) return [];
      
      const key = `logs:${date}`;
      const logs = await redisClient.lrange(key, 0, 999);

      if (!logs) return [];

      return logs
        .map(log => JSON.parse(log) as LogEntry[])
        .flat()
        .filter(log => !level || log.level === level);
    } catch (error) {
      console.error('[Logging] Get logs by date failed:', error);
      return [];
    }
  }

  async getLogsByUser(userId: string, count: number = 100): Promise<LogEntry[]> {
    try {
      const allLogs = await this.getRecentLogs(1000);
      return allLogs.filter(log => log.userId === userId).slice(0, count);
    } catch (error) {
      console.error('[Logging] Get logs by user failed:', error);
      return [];
    }
  }

  async getErrorStats(): Promise<{
    total: number;
    byLevel: Record<string, number>;
    recent: LogEntry[];
  }> {
    try {
      const logs = await this.getRecentLogs(1000, 'error');
      const byLevel: Record<string, number> = {};

      for (const log of logs) {
        byLevel[log.level] = (byLevel[log.level] || 0) + 1;
      }

      return {
        total: logs.length,
        byLevel,
        recent: logs.slice(0, 10)
      };
    } catch (error) {
      console.error('[Logging] Get error stats failed:', error);
      return { total: 0, byLevel: {}, recent: [] };
    }
  }

  createRequestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = Math.random().toString(36).substring(7);

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
          requestId,
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          userId: (req as any).user?.id
        };

        const level = res.statusCode >= 500 ? 'error' :
                      res.statusCode >= 400 ? 'warn' : 'info';

        this.log(level, `${req.method} ${req.originalUrl}`, logData);
      });

      next();
    };
  }

  async logUserAction(
    userId: string,
    action: string,
    resource?: string,
    details?: Record<string, any>
  ) {
    this.info(`User action: ${action}`, {
      userId,
      action,
      resource,
      ...details
    });
  }

  async logSecurityEvent(event: string, details: Record<string, any>) {
    this.warn(`Security event: ${event}`, {
      event,
      type: 'security',
      ...details
    });
  }

  async logApiCall(userId: string, endpoint: string, params?: Record<string, any>) {
    this.debug(`API call`, {
      userId,
      endpoint,
      params
    });
  }

  async logSystemEvent(event: string, details: Record<string, any>) {
    this.info(`System event: ${event}`, {
      event,
      type: 'system',
      ...details
    });
  }

  async getPaymentLogs(params: {
    userId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ logs: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    try {
      const where: any = {};

      if (params.userId) {
        where.userId = params.userId;
      }
      if (params.status) {
        where.status = params.status;
      }
      if (params.startDate || params.endDate) {
        where.createdAt = {};
        if (params.startDate) where.createdAt.gte = params.startDate;
        if (params.endDate) where.createdAt.lte = params.endDate;
      }

      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        prisma.paymentLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { user: { select: { username: true, email: true } } }
        }),
        prisma.paymentLog.count({ where })
      ]);

      return {
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      this.error('Failed to get payment logs', { error });
      return { logs: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }
  }

  async getLoginLogs(params: {
    userId?: string;
    loginResult?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ logs: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    try {
      const where: any = {};

      if (params.userId) {
        where.userId = params.userId;
      }
      if (params.loginResult) {
        where.loginResult = params.loginResult;
      }
      if (params.startDate || params.endDate) {
        where.createdAt = {};
        if (params.startDate) where.createdAt.gte = params.startDate;
        if (params.endDate) where.createdAt.lte = params.endDate;
      }

      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        prisma.loginLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { user: { select: { username: true, email: true } } }
        }),
        prisma.loginLog.count({ where })
      ]);

      return {
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      this.error('Failed to get login logs', { error });
      return { logs: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }
  }

  async getUsageLogs(params: {
    userId?: string;
    action?: string;
    actionType?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ logs: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    try {
      const where: any = {};

      if (params.userId) {
        where.userId = params.userId;
      }
      if (params.action) {
        where.action = params.action;
      }
      if (params.actionType) {
        where.actionType = params.actionType;
      }
      if (params.startDate || params.endDate) {
        where.createdAt = {};
        if (params.startDate) where.createdAt.gte = params.startDate;
        if (params.endDate) where.createdAt.lte = params.endDate;
      }

      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        prisma.usageLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { user: { select: { username: true, email: true } } }
        }),
        prisma.usageLog.count({ where })
      ]);

      return {
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      this.error('Failed to get usage logs', { error });
      return { logs: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }
  }

  async verifyLogIntegrity(params: { startDate?: Date; endDate?: Date }): Promise<{ valid: boolean; total: number; corrupted: number; details?: string[] }> {
    try {
      const where: any = {};

      if (params.startDate || params.endDate) {
        where.createdAt = {};
        if (params.startDate) where.createdAt.gte = params.startDate;
        if (params.endDate) where.createdAt.lte = params.endDate;
      }

      const logs = await prisma.loginLog.findMany({
        where,
        select: { id: true, userId: true, createdAt: true }
      });

      const corrupted: string[] = [];
      for (const log of logs) {
        if (!log.userId || !log.createdAt) {
          corrupted.push(log.id);
        }
      }

      return {
        valid: corrupted.length === 0,
        total: logs.length,
        corrupted: corrupted.length,
        details: corrupted.length > 0 ? corrupted : undefined
      };
    } catch (error) {
      this.error('Failed to verify log integrity', { error });
      return { valid: false, total: 0, corrupted: 0 };
    }
  }

  async logPayment(paymentId: string, userId: string, amount: number, status: string, details?: Record<string, any>): Promise<void> {
    try {
      const method = typeof details?.gateway === 'string' ? details.gateway : 'unknown';
      const transactionId = typeof details?.transactionId === 'string' ? details.transactionId : null;
      await prisma.paymentLog.create({
        data: {
          userId,
          type: 'payment',
          amount,
          status,
          orderNo: paymentId,
          method,
          transactionId,
          metadata: details ? JSON.stringify(details) : null
        }
      });
      this.info('Payment logged', { paymentId, userId, amount, status });
    } catch (error) {
      this.error('Failed to log payment', { error, paymentId, userId });
    }
  }

  async close() {
    await this.flushLogs();
    // P1 修复 #11：关闭 Loki transport，确保缓冲日志刷新到远端
    if (this.lokiTransport) {
      try {
        this.lokiTransport.end();
      } catch {
        /* ignore close errors */
      }
    }
  }
}

export interface LogEntry {
  timestamp: string;
  level: keyof typeof LOG_LEVELS;
  message: string;
  requestId?: string;
  method?: string;
  url?: string;
  status?: number;
  duration?: number;
  ip?: string;
  userId?: string;
  userAgent?: string;
  action?: string;
  resource?: string;
  event?: string;
  type?: string;
  [key: string]: any;
}

export const loggingService = new LoggingService();
export default loggingService;
