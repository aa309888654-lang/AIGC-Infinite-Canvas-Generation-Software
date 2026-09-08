/**
 * P2 修复 #16：统一日志到 pino JSON
 * - 生产环境: pino JSON 输出（结构化，便于 Loki/ELK 采集）
 * - 开发环境: pino-pretty 彩色文本（可读性好）
 * - 保持原有 logger.{trace,debug,info,warn,error} 签名向后兼容
 * - 保留 SENSITIVE_KEYS 脱敏逻辑
 *
 * 注意：services/logging-service.ts 继续作为业务日志服务（带 Redis 缓存 + Loki 推送），
 *      本文件作为底层传输，两者职责分离：utils/logger = 传输层，services/logging-service = 业务层。
 */
import pino, { LoggerOptions, Logger as PinoLogger } from 'pino';

const SENSITIVE_KEYS = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'apikey', 'api_key',
  'private', 'credential', 'auth', 'authorization', 'bearer', 'jwt',
  'session', 'cookie', 'signature', 'encrypt', 'decrypt',
  'access_key', 'access-key', 'secret_key', 'secret-key',
  'minimax_api_key', 'doubao_api_key', 'openai_api_key',
  'encryption_key', 'jwt_secret'
];

function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 5 || obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    for (const key of SENSITIVE_KEYS) {
      if (obj.toLowerCase().includes(key)) {
        return '[REDACTED]';
      }
    }
    return obj;
  }

  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item, depth + 1));
    }

    // Error 对象特殊处理：提取 name/message/stack
    if (obj instanceof Error) {
      return {
        name: obj.name,
        message: obj.message,
        stack: process.env.NODE_ENV === 'development' ? obj.stack : undefined,
      };
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(value, depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

// P2 修复 #16：根据环境构建 pino options
function buildPinoOptions(): LoggerOptions {
  const isDev = process.env.NODE_ENV === 'development';
  const level = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

  if (isDev) {
    // 开发环境：pino-pretty 彩色输出，时间戳人类可读
    return {
      level,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
          ignore: 'pid,hostname',
          messageFormat: '{msg}',
          singleLine: false,
        },
      },
      // 开发环境附加 timestamp 字段，保持与旧文本格式时间戳一致
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
    };
  }

  // 生产环境：纯 JSON 输出，便于 Loki/ELK 采集
  return {
    level,
    // 不使用 transport，直接同步输出 JSON（避免 transport 进程开销）
    timestamp: pino.stdTimeFunctions.isoTime,
    // 序列化时脱敏（pino 自带 serializer 机制）
    serializers: {
      err(value: any) {
        return sanitizeObject(value);
      },
      req(value: any) {
        return sanitizeObject(value);
      },
      res(value: any) {
        return sanitizeObject(value);
      },
    },
  };
}

const pinoLogger: PinoLogger = pino(buildPinoOptions());

/**
 * 将变长参数合并为 pino 可接受的第一参数（mergingObject）+ message
 * 兼容旧签名 logger.info(message: string, ...args: any[])
 */
function logWithPino(
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  message: string,
  args: any[]
): void {
  if (args.length === 0) {
    pinoLogger[level](message);
    return;
  }

  // 多个参数：第一个对象作为 mergingObject，其余合并到 context
  const context: Record<string, any> = {};
  for (let i = 0; i < args.length; i++) {
    const sanitized = sanitizeObject(args[i]);
    if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
      Object.assign(context, sanitized);
    } else {
      // 非对象参数按 arg0/arg1/... 命名
      context[`arg${i}`] = sanitized;
    }
  }

  if (Object.keys(context).length > 0) {
    pinoLogger[level](context, message);
  } else {
    pinoLogger[level](message);
  }
}

export const logger = {
  trace: (message: string, ...args: any[]) => {
    logWithPino('trace', message, args);
  },

  debug: (message: string, ...args: any[]) => {
    logWithPino('debug', message, args);
  },

  info: (message: string, ...args: any[]) => {
    logWithPino('info', message, args);
  },

  log: (message: string, ...args: any[]) => {
    logWithPino('info', message, args);
  },

  warn: (message: string, ...args: any[]) => {
    logWithPino('warn', message, args);
  },

  error: (message: string, ...args: any[]) => {
    logWithPino('error', message, args);
  },

  // P2 修复 #16：暴露底层 pino 实例，供需要 child logger 的场景使用
  child: (bindings: Record<string, any>) => pinoLogger.child(bindings),
};

export function sanitizeError(error: Error): { name: string; message: string; stack?: string } {
  return {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };
}

export default logger;
