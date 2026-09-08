/**
 * P3 修复 #27：Prisma 客户端连接池配置
 *
 * Prisma 的连接池通过 DATABASE_URL 的查询参数控制：
 *   - connection_limit：最大连接数（默认 = num_cpus * 2 + 1）
 *   - pool_timeout：获取连接超时秒数（默认 10s）
 *   - socket_timeout：SQL 执行超时秒数
 *
 * 此文件在运行时确保连接池参数已设置，无需依赖 .env 中手动配置。
 * 仅对 PostgreSQL/MySQL 生效（SQLite 使用文件级锁，不适用连接池参数）。
 */
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

function buildDatasourceUrl(): string {
  const rawUrl = process.env.DATABASE_URL || '';

  // SQLite 不支持连接池参数，直接返回
  if (rawUrl.startsWith('file:') || rawUrl.includes('sqlite')) {
    return rawUrl;
  }

  // 已手动配置连接池参数则不覆盖
  if (rawUrl.includes('connection_limit=') || rawUrl.includes('pool_timeout=')) {
    return rawUrl;
  }

  // 追加默认连接池参数
  const separator = rawUrl.includes('?') ? '&' : '?';
  const connectionLimit = process.env.PRISMA_CONNECTION_LIMIT || '10';
  const poolTimeout = process.env.PRISMA_POOL_TIMEOUT || '20';
  return `${rawUrl}${separator}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;
}

const datasourceUrl = buildDatasourceUrl();

if (datasourceUrl !== (process.env.DATABASE_URL || '') && process.env.NODE_ENV !== 'production') {
  logger.info(`[Prisma] 连接池已配置: connection_limit=${process.env.PRISMA_CONNECTION_LIMIT || 10}, pool_timeout=${process.env.PRISMA_POOL_TIMEOUT || 20}`);
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  ...(datasourceUrl !== (process.env.DATABASE_URL || '') && {
    datasources: {
      db: { url: datasourceUrl },
    },
  }),
});

export default prisma;
