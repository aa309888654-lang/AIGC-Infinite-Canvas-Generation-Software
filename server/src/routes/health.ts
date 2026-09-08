import { Router, Request, Response } from 'express';
import os from 'os';
import { config } from '../types/env';
import prisma from '../lib/prisma';
import { requireAdmin, AuthRequest } from '../middleware/auth';
// 已废弃 (2026-07-18): xunfei 相关 imports 已移除（健康检查不再检测讯飞端点）
import { APP_DISPLAY_VERSION } from '../config/app-version';

const router = Router();

interface HealthCheck {
  status: 'up' | 'down';
  latency?: number;
  error?: string;
}

interface DetailedHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: HealthCheck;
    redis: HealthCheck;
    minio: HealthCheck & { bucket?: string; endpoint?: string; publicUrlConfigured?: boolean; publicRead?: boolean };
    loki: HealthCheck;
    aiProviders: {
      status: 'up' | 'degraded' | 'down';
      total: number;
      online: number;
      offline: number;
      details: Array<{
        provider: string;
        displayName: string;
        online: boolean;
        latency?: number;
        error?: string;
      }>;
    };
  };
  metrics: {
    cpu: {
      loadavg: number[];
      usage: number;
    };
    memory: {
      total: number;
      used: number;
      free: number;
      usagePercent: number;
    };
    process: {
      memory: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
        external: number;
      };
      uptime: number;
    };
  };
  connections: {
    active: number;
    total: number;
  };
}

router.get('/', async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Health check endpoint. Use /live, /ready, or /detailed for more.',
    timestamp: new Date().toISOString(),
    version: APP_DISPLAY_VERSION,
    endpoints: {
      live: '/api/health/live (no auth, liveness probe)',
      ready: '/api/health/ready (no auth, readiness probe)',
      detailed: '/api/health/detailed (admin auth required)',
    },
  });
});

// P2 修复 #17：/detailed 拆分说明
// - /live      : 进程存活探针（无鉴权，K8s/Docker livenessProbe）
// - /ready     : 就绪探针（无鉴权，检查 DB；K8s/Docker readinessProbe）
// - /detailed  : 完整健康详情（admin 鉴权，含 AI Provider 连通性等敏感信息）
// 监控系统应抓取 /live 和 /ready，不应依赖 /detailed（会暴露内部架构且需要鉴权）

router.get('/detailed', requireAdmin, async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  
  const health: DetailedHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: APP_DISPLAY_VERSION,
    environment: config.nodeEnv,
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      minio: await checkMinio(),
      loki: await checkLoki(),
      aiProviders: await checkAIProviders()
    },
    metrics: {
      cpu: {
        loadavg: os.loadavg(),
        usage: calculateCpuUsage()
      },
      memory: {
        total: os.totalmem(),
        used: os.totalmem() - os.freemem(),
        free: os.freemem(),
        usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
      },
      process: {
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    },
    connections: {
      active: 0,
      total: 0
    }
  };

  // 生产存储策略：禁止 COS，MinIO 是唯一云端对象存储。
  const storageHealthy = health.services.minio.status === 'up';
  const coreServicesHealthy = health.services.database.status === 'up'
    && health.services.redis.status === 'up'
    && storageHealthy;
  const aiProvidersDegraded = health.services.aiProviders.status === 'degraded';
  const aiProvidersDown = health.services.aiProviders.status === 'down';
  const isHealthy = coreServicesHealthy && !aiProvidersDown;
  const hasWarnings = [health.services.database, health.services.redis, health.services.loki].some(s => s.status === 'down' && s.latency && s.latency < 5000) || aiProvidersDegraded;

  if (!isHealthy) {
    health.status = 'unhealthy';
  } else if (hasWarnings) {
    health.status = 'degraded';
  }

  const latency = Date.now() - startTime;
  
  const statusCode = health.status === 'unhealthy' ? 503 : 200;
  
  res.status(statusCode).json({
    ...health,
    responseTime: latency
  });
});

router.get('/simple', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabase();
    
    if (dbHealth.status === 'up') {
      res.json({ status: 'ready' });
    } else {
      res.status(503).json({ 
        status: 'not_ready',
        reason: 'Database not available'
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'not_ready',
      reason: 'Health check failed'
    });
  }
});

router.get('/live', (req: Request, res: Response) => {
  res.json({ status: 'alive' });
});

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'up',
      latency: Date.now() - start
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const redisService = await import('../services/redis-service').then(m => m.redisService);
    if (redisService && redisService.isConnected && redisService.isConnected()) {
      return {
        status: 'up',
        latency: Date.now() - start
      };
    }
    return {
      status: 'down',
      latency: Date.now() - start,
      error: 'Redis not connected'
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      error: 'Redis service not available'
    };
  }
}

async function checkMinio(): Promise<HealthCheck & { bucket?: string; endpoint?: string; publicUrlConfigured?: boolean; publicRead?: boolean }> {
  const start = Date.now();
  try {
    const minioService = await import('../services/minio-service').then(m => m.minioService);
    if (!minioService || !minioService.isAvailable()) {
      return {
        status: 'down',
        latency: Date.now() - start,
        error: 'MinIO credentials are not configured'
      };
    }
    const isHealthy = await minioService.checkConnection();
    const bucketInfo = minioService.getBucketInfo();
    return {
      status: isHealthy ? 'up' : 'down',
      latency: Date.now() - start,
      bucket: bucketInfo.bucket,
      endpoint: bucketInfo.endpoint,
      publicUrlConfigured: !!bucketInfo.publicUrl,
      publicRead: bucketInfo.publicRead,
      error: isHealthy ? undefined : 'MinIO health check failed'
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      error: 'MinIO service not available'
    };
  }
}

async function checkLoki(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const loggingService = await import('../services/logging-service').then(m => m.loggingService);
    if (loggingService) {
      return {
        status: 'up',
        latency: Date.now() - start
      };
    }
    return {
      status: 'down',
      latency: Date.now() - start,
      error: 'Loki service not available'
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      error: 'Loki service not available'
    };
  }
}

function calculateCpuUsage(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type as keyof typeof cpu.times];
    }
    idle += cpu.times.idle;
  }
  
  return ((1 - idle / total) * 100);
}

async function checkAIProviders(): Promise<{
  status: 'up' | 'degraded' | 'down';
  total: number;
  online: number;
  offline: number;
  details: Array<{
    provider: string;
    displayName: string;
    online: boolean;
    latency?: number;
    error?: string;
  }>;
}> {
  const details: Array<{
    provider: string;
    displayName: string;
    online: boolean;
    latency?: number;
    error?: string;
  }> = [];

  try {
    const providers = await prisma.providerConfig.findMany({
      where: { isActive: true },
      select: { provider: true, displayName: true, apiKey: true, apiSecret: true, endpoint: true, config: true },
    });

    const envChecks: Array<{ provider: string; key: string | undefined; endpoint: string }> = [
      { provider: 'doubao', key: process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY, endpoint: 'https://ark.cn-beijing.volces.com' },
      { provider: 'vidu', key: process.env.VIDU_API_KEY, endpoint: 'https://api.vidu.cn' },
      { provider: 'jimeng', key: process.env.JIMENG_API_KEY || process.env.DOUBAO_IMAGE_KEY, endpoint: 'https://jimeng.jianying.com' },
      { provider: 'seedream', key: process.env.DOUBAO_IMAGE_KEY || process.env.ARK_API_KEY, endpoint: 'https://ark.cn-beijing.volces.com' },
    ];

    const dbProviderNames = new Set(providers.map(p => p.provider));

    const testPromises = providers.map(async (p) => {
      const start = Date.now();
      try {
        const { decrypt: decryptFn, isEncrypted: isEncryptedFn } = await import('../utils/encryption');
        let apiKey = p.apiKey || '';
        if (apiKey && isEncryptedFn(apiKey)) {
          try { apiKey = decryptFn(apiKey); } catch { apiKey = ''; }
        }
        if (!apiKey) {
          const envMatch = envChecks.find(e => e.provider === p.provider);
          apiKey = envMatch?.key || '';
        }
        if (!apiKey) {
          return { provider: p.provider, displayName: p.displayName, online: false, error: '未配置密钥' };
        }

        const endpoint = p.endpoint || envChecks.find(e => e.provider === p.provider)?.endpoint;
        const testUrl = getTestUrl(p.provider, endpoint);
        const resp = await fetch(testUrl.url, {
          method: testUrl.method,
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...testUrl.headers },
          body: testUrl.body ? JSON.stringify(testUrl.body) : undefined,
          signal: AbortSignal.timeout(10000),
        });
        const latency = Date.now() - start;
        const online = isResponseOnline(p.provider, resp.status);
        return { provider: p.provider, displayName: p.displayName, online, latency, error: online ? undefined : `HTTP ${resp.status}` };
      } catch (err: unknown) {
        const e = err as Error;
        return { provider: p.provider, displayName: p.displayName, online: false, latency: Date.now() - start, error: classifyError(e) };
      }
    });

    for (const envCheck of envChecks) {
      if (!dbProviderNames.has(envCheck.provider) && envCheck.key) {
        testPromises.push((async () => {
          const start = Date.now();
          try {
            const testUrl = getTestUrl(envCheck.provider, envCheck.endpoint);
            const resp = await fetch(testUrl.url, {
              method: testUrl.method,
              headers: { Authorization: `Bearer ${envCheck.key}`, 'Content-Type': 'application/json', ...testUrl.headers },
              body: testUrl.body ? JSON.stringify(testUrl.body) : undefined,
              signal: AbortSignal.timeout(10000),
            });
            const latency = Date.now() - start;
            const online = isResponseOnline(envCheck.provider, resp.status);
            return { provider: envCheck.provider, displayName: envCheck.provider, online, latency, error: online ? undefined : `HTTP ${resp.status}` };
          } catch (err: unknown) {
            return { provider: envCheck.provider, displayName: envCheck.provider, online: false, latency: Date.now() - start, error: classifyError(err as Error) };
          }
        })());
      }
    }

    const settled = await Promise.allSettled(testPromises);
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) details.push(r.value);
    }
  } catch (error) {
    console.error('AI Provider健康检查失败:', error);
  }

  const total = details.length;
  const online = details.filter(d => d.online).length;
  const offline = total - online;

  let status: 'up' | 'degraded' | 'down' = 'up';
  if (total === 0) status = 'down';
  else if (online === 0) status = 'down';
  else if (offline > 0 && online < total) status = 'degraded';

  return { status, total, online, offline, details };
}

function getTestUrl(provider: string, endpoint?: string | null): { url: string; method: string; headers?: Record<string, string>; body?: unknown } {
  switch (provider) {
    case 'doubao':
    case 'doubao-video':
    case 'seedream':
      return { url: `${endpoint || 'https://ark.cn-beijing.volces.com'}/api/v3/models`, method: 'GET' };
    case 'minimax':
      return { url: `${endpoint || 'https://api.minimax.chat'}/v1/models`, method: 'GET' };
    case 'vidu':
      return { url: `${endpoint || 'https://api.vidu.cn'}/ent/v2/reference2video`, method: 'POST', body: { model: 'viduq2-turbo', prompt: 'test' } };
    case 'jimeng':
      return { url: `${endpoint || 'https://ark.cn-beijing.volces.com/api/v3'}/models`, method: 'GET' };
    case 'deepseek':
      return { url: `${endpoint || 'https://api.deepseek.com'}/v1/models`, method: 'GET' };
    case 'sensenova':
      return { url: `${endpoint || 'https://token.sensenova.cn'}/v1/models`, method: 'GET' };
    case 'stepfun':
      return { url: `${endpoint || 'https://api.stepfun.com'}/v1/models`, method: 'GET' };
    // 已废弃 (2026-07-18): xunfei 健康检查端点已移除（文字通道已下线）
    case 'wuyinkeji':
    case 'aisz':
    case 'apipaths':
      return { url: `${endpoint}/v1/models`, method: 'GET' };
    case 'volcano':
      return { url: `${endpoint || 'https://ark.cn-beijing.volces.com'}/api/v3/models`, method: 'GET' };
    default:
      if (endpoint) return { url: endpoint + '/v1/models', method: 'GET' };
      return { url: 'https://httpbin.org/get', method: 'GET' };
  }
}

function isResponseOnline(provider: string, status: number): boolean {
  if (status >= 200 && status < 300) return true;
  if (status === 401 || status === 403) return false;
  if (provider === 'minimax' && (status === 400 || status === 422 || status === 404)) return true;
  if (provider === 'doubao' && status === 404) return true;
  if (provider === 'seedream' && status === 404) return true;
  if (provider === 'volcano' && status === 404) return true;
  if (provider === 'deepseek' && (status === 404 || status === 402)) return true;
  if (provider === 'sensenova' && (status === 404 || status === 401)) return true;
  if (provider === 'stepfun' && (status === 404 || status === 401)) return true;
  // 已废弃 (2026-07-18): xunfei 健康检查响应判断已移除
  if (provider === 'wuyinkeji' && (status === 404 || status === 401)) return true;
  if (provider === 'aisz' && (status === 404 || status === 401)) return true;
  if (provider === 'apipaths' && (status === 404 || status === 401)) return true;
  if (provider === 'jimeng' && (status === 404 || status === 401)) return true;
  if (provider === 'vidu' && status === 400) return true;
  if (status >= 400 && status < 500) return false;
  return false;
}

function classifyError(e: Error): string {
  if (e.name === 'AbortError' || e.message?.includes('timeout')) return '连接超时';
  if (e.message?.includes('ECONNREFUSED')) return '连接被拒绝';
  if (e.message?.includes('ENOTFOUND') || e.message?.includes('getaddrinfo')) return 'DNS解析失败';
  if (e.message?.includes('ECONNRESET')) return '连接被重置(可能被防火墙阻断)';
  if (e.message?.includes('CERT') || e.message?.includes('SSL') || e.message?.includes('TLS')) return 'SSL/TLS证书错误';
  return e.message || '未知错误';
}

export default router;
