/**
 * 环境配置
 * 加载并验证环境变量
 */

import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { isLocalOnlyMode } from '../utils/local-mode';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

/**
 * 定位 .env 文件：优先当前工作目录，其次查找 backend/.env
 */
function locateEnvFile(): { envPath: string | null; productionPath: string | null } {
  const candidates: string[] = [process.cwd()];

  const workingDirectoryEnv = path.join(process.cwd(), '.env');
  if (fs.existsSync(workingDirectoryEnv)) {
    return {
      envPath: workingDirectoryEnv,
      productionPath: path.join(process.cwd(), '.env.production'),
    };
  }

  // 向上查找最多 5 层父目录，寻找包含 backend/.env 或 .env 的位置
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
    candidates.push(dir);
  }

  // 优先在 backend/ 子目录中查找
  for (const base of candidates) {
    const backendEnv = path.join(base, 'backend', '.env');
    if (fs.existsSync(backendEnv)) {
      return {
        envPath: backendEnv,
        productionPath: path.join(base, 'backend', '.env.production'),
      };
    }
  }

  // 其次在各级目录根查找 .env
  for (const base of candidates) {
    const rootEnv = path.join(base, '.env');
    if (fs.existsSync(rootEnv)) {
      return {
        envPath: rootEnv,
        productionPath: path.join(base, '.env.production'),
      };
    }
  }

  return { envPath: null, productionPath: null };
}

const located = locateEnvFile();

if (located.envPath && fs.existsSync(located.envPath)) {
  dotenv.config({ path: located.envPath, override: true });
  const productionPath = located.productionPath || path.join(path.dirname(located.envPath), '.env.production');
  if (fs.existsSync(productionPath)) {
    dotenv.config({ path: productionPath, override: false });
  }
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`已加载环境配置: ${located.envPath}`);
  }
} else if (located.productionPath && fs.existsSync(located.productionPath)) {
  dotenv.config({ path: located.productionPath, override: false });
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }
} else {
  dotenv.config({ override: false });
  console.warn('未找到 .env，使用进程环境变量');
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

interface MinioConfig {
  endpoint: string;
  port: string;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicUrl: string;
}

interface Config {
  nodeEnv: string;
  port: number;
  host: string;
  baseUrl: string;
  jwt: JwtConfig;
  bcryptRounds: number;
  allowedOrigins: string[];
  rateLimit: RateLimitConfig;
  database: {
    url: string;
  };
  encryption: {
    key: string | undefined;
    hashPepper: string | undefined;
  };
  minio: MinioConfig;
  [key: string]: unknown;
}

function getEnv(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

const LOCAL_DEV_PORTS = [3001, 3200, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 5181, 5182];
const LOCAL_DEV_ORIGINS = LOCAL_DEV_PORTS.flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);

function withLocalDevOrigins(origins: string[]): string[] {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    return origins;
  }

  const hasLocalOrigin = origins.some((origin) =>
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  );

  if (!hasLocalOrigin) {
    return origins;
  }

  return Array.from(new Set([...origins, ...LOCAL_DEV_ORIGINS]));
}

function parseOrigins(origins: string): string[] {
  if (!origins) {
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      throw new Error('⚠️ 生产环境错误: ALLOWED_ORIGINS 必须设置');
    }
    return LOCAL_DEV_ORIGINS;
  }
  return withLocalDevOrigins(origins.split(',').map(o => o.trim()).filter(Boolean));
}

/**
 * 本地模式：从本机派生稳定的本地密钥（不落盘、不依赖环境变量），
 * 保证无密钥也能正常启动本地开发；生产环境仍强制要求显式配置。
 */
function deriveLocalSecret(prefix: string, length: number): string {
  const seed = `${process.cwd()}:${prefix}`;
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, length);
}

function validateJwtSecret(secret: string): void {
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32) {
      throw new Error(
        '⚠️ 生产环境错误: JWT_SECRET 必须设置强密钥（至少32个字符）\n' +
        '⚠️ 请运行: openssl rand -base64 32\n' +
        '⚠️ 并将生成的密钥设置为 JWT_SECRET 环境变量'
      );
    }
  }

  if (!secret) {
    if (isLocalOnlyMode()) {
      process.env.JWT_SECRET = deriveLocalSecret('jwt', 64);
      logger.info('🏠 本地模式：JWT_SECRET 未设置，已自动派生本地密钥');
      return;
    }
    throw new Error(
      '⚠️ JWT_SECRET 未设置！\n' +
      '⚠️ 请运行: openssl rand -base64 32\n' +
      '⚠️ 并将生成的密钥设置为 JWT_SECRET 环境变量'
    );
  }

  if (secret.length < 16) {
    console.warn('⚠️ 警告: JWT_SECRET 长度过短（建议至少32个字符），建议使用更强密钥');
  }
}

export const config: Config = {
  nodeEnv: getEnv('NODE_ENV', 'development'),

  port: parseInt(getEnv('PORT', '3200'), 10),

  host: getEnv('HOST', '127.0.0.1'),

  baseUrl: getEnv('BASE_URL', 'http://localhost:3200'),

  bcryptRounds: parseInt(getEnv('BCRYPT_ROUNDS', '12'), 10),

  allowedOrigins: parseOrigins(getEnv('ALLOWED_ORIGINS', '')),

  rateLimit: {
    windowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(getEnv('RATE_LIMIT_MAX', '100'), 10),
  },

  database: {
    url: getEnv('DATABASE_URL', ''),
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY,
    hashPepper: process.env.HASH_PEPPER,
  },

  jwt: {
    secret: getEnv('JWT_SECRET', ''),
    expiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
    refreshSecret: getEnv('JWT_REFRESH_SECRET', ''),
    refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '30d'),
  },

  minio: {
    endpoint: getEnv('MINIO_ENDPOINT'),
    port: getEnv('MINIO_PORT'),
    useSSL: getEnv('MINIO_USE_SSL') === 'true',
    accessKey: getEnv('MINIO_ACCESS_KEY'),
    secretKey: getEnv('MINIO_SECRET_KEY'),
    bucket: getEnv('MINIO_BUCKET', getEnv('MINIO_BUCKET_FILES', 'aicg-files')),
    publicUrl: getEnv('MINIO_PUBLIC_URL'),
  },
};

// 验证所有必要的环境变量
function validateEnvironmentVariables() {
  logger.info('开始验证环境变量...');

  // 验证JWT密钥（本地模式自动派生）
  validateJwtSecret(config.jwt.secret);
  config.jwt.secret = process.env.JWT_SECRET || config.jwt.secret;
  config.jwt.refreshSecret = getEnv('JWT_REFRESH_SECRET', '') || config.jwt.secret;

  // 验证数据库连接
  if (!config.database.url) {
    if (config.nodeEnv === 'production') {
      throw new Error('⚠️ 生产环境错误: DATABASE_URL 必须设置');
    }
    console.warn('⚠️ 警告: DATABASE_URL 未设置，请配置 PostgreSQL 连接');
  }

  // 验证加密密钥（本地模式自动派生）
  if (!config.encryption.key) {
    if (config.nodeEnv === 'production') {
      throw new Error('⚠️ 生产环境错误: ENCRYPTION_KEY 必须设置');
    }
    if (isLocalOnlyMode()) {
      config.encryption.key = deriveLocalSecret('encryption', 64);
      config.encryption.hashPepper = config.encryption.hashPepper || deriveLocalSecret('pepper', 64);
      logger.info('🏠 本地模式：ENCRYPTION_KEY/HASH_PEPPER 未设置，已自动派生本地密钥');
    } else {
      console.warn('⚠️ 警告: ENCRYPTION_KEY 未设置，敏感数据将使用默认密钥加密');
    }
  }

  // 验证端口
  if (config.port < 1024 || config.port > 65535) {
    console.warn('⚠️ 警告: 端口号无效，使用默认端口 3200');
  }

  // 验证基本URL
  if (!config.baseUrl) {
    console.warn('⚠️ 警告: BASE_URL 未设置，使用默认值 http://localhost:3200');
  }

  // 验证 MinIO 配置
  const minioMissing = [
    ['MINIO_ENDPOINT', config.minio.endpoint],
    ['MINIO_ACCESS_KEY', config.minio.accessKey],
    ['MINIO_SECRET_KEY', config.minio.secretKey],
    ['MINIO_BUCKET', config.minio.bucket],
    ['MINIO_PUBLIC_URL', config.minio.publicUrl],
  ].filter(([, value]) => !value);
  const usesDefaultMinioCredentials =
    config.minio.accessKey === 'minioadmin' || config.minio.secretKey === 'minioadmin';

  if (config.nodeEnv === 'production') {
    if (minioMissing.length > 0) {
      throw new Error(`⚠️ 生产环境错误: MinIO 必须配置完整，缺少 ${minioMissing.map(([key]) => key).join(', ')}`);
    }
    if (usesDefaultMinioCredentials) {
      throw new Error('⚠️ 生产环境错误: MinIO 禁止使用默认 minioadmin 凭据');
    }
    logger.info('✅ MinIO 对象存储已配置');
  } else if (isLocalOnlyMode()) {
    logger.info('🏠 本地模式：使用本地文件存储，跳过 MinIO 配置校验');
  } else if (minioMissing.length > 0) {
    console.warn(`⚠️ 警告: MinIO 配置不完整，缺少 ${minioMissing.map(([key]) => key).join(', ')}`);
  }

  logger.info('✅ 环境变量验证完成');
}

// P3 修复 #28：使用 Zod schema 验证关键环境变量的类型与格式
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/, 'PORT 必须为数字').default('3200').transform(Number),
  HOST: z.string().default('127.0.0.1'),
  BASE_URL: z.string().default('http://localhost:3200'),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_ROUNDS: z.string().regex(/^\d+$/).default('12').transform(Number),
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).default('900000').transform(Number),
  RATE_LIMIT_MAX: z.string().regex(/^\d+$/).default('100').transform(Number),
  DATABASE_URL: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  HASH_PEPPER: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  // MinIO
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.string().optional(),
  MINIO_USE_SSL: z.enum(['true', 'false']).optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().optional(),
  MINIO_PUBLIC_URL: z.string().optional(),
});

function validateEnvWithZod(): void {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.errors.map(
      e => `  - ${e.path.join('.')}: ${e.message}`
    );
    console.warn('⚠️ [EnvValidation] 环境变量格式校验失败（不阻止启动，但需修正）：');
    console.warn(errors.join('\n'));
  } else {
    logger.debug('[EnvValidation] 环境变量格式校验通过');
  }
}

// 执行环境变量验证
validateEnvironmentVariables();
validateEnvWithZod();

// 开发环境输出配置信息
if (config.nodeEnv !== 'production') {
  logger.info('📋 环境配置:');
  logger.info(`  - 运行环境: ${config.nodeEnv}`);
  logger.info(`  - 端口: ${config.port}`);
  logger.info(`  - JWT密钥: ${process.env.JWT_SECRET ? '✓ 已设置' : '⚠️ 使用开发环境默认密钥'}`);
  logger.info(`  - 数据库: ${config.database.url ? '✓ 已配置' : '⚠️ 未配置'}`);
  logger.info(`  - 加密密钥: ${config.encryption.key ? '✓ 已配置' : '⚠️ 未配置'}`);
  logger.info(`  - CORS源: ${config.allowedOrigins.join(', ')}`);
}
