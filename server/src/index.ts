import app from './config/app';
import { config } from './types/env';
import prisma from './lib/prisma';
import { websocketPushService } from './services/websocket-push-service';
import { initializeSystem } from './services/system-initialization-service';
import { startBackgroundTaskPoller, stopBackgroundTaskPoller } from './services/background-task-poller';
import { logger } from './utils/logger';
// MinIO 临时文件定时清理（side-effect import，构造函数内自动启动 setInterval）
import './services/minio-cleanup-service';
// P0 修复：Sentry 错误追踪 + 告警服务
import { initSentry, captureException } from './services/sentry-service';
import { alertService } from './services/alert-service';
import { backendStabilityMonitor } from './services/backend-stability-monitor';
// P1 修复 #11：Loki 日志传输
import { loggingService } from './services/logging-service';

const PORT = config.port;
let isShuttingDown = false;

async function gracefulShutdown(reason: string, exitCode = 0): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.error(`[Shutdown] Triggered by ${reason}`);
stopBackgroundTaskPoller();
  websocketPushService.destroy();

  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('Server closed');
    } catch (disconnectError) {
      logger.error('[Shutdown] Prisma disconnect failed:', disconnectError instanceof Error ? disconnectError.message : String(disconnectError));
    } finally {
      process.exit(exitCode);
    }
  });

  setTimeout(() => {
    logger.error('[Shutdown] Forced exit after timeout');
    process.exit(exitCode || 1);
  }, 10000).unref();
}

const HOST = config.host || '127.0.0.1';
const server = app.listen(Number(PORT), HOST, async () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`📦 Environment: ${config.nodeEnv}`);
  console.log(`🔒 CORS enabled for: ${config.allowedOrigins.join(', ')}`);

  websocketPushService.initialize(server);
  console.log(`🔌 WebSocket Push服务已启动，访问 ws://localhost:${PORT}/ws`);

  // P0 修复：初始化 Sentry 错误追踪
  await initSentry();

  // P0 修复：初始化告警服务，订阅稳定性监控的 alert 事件
  alertService.init();
  backendStabilityMonitor.on('alert', (alert) => {
    void alertService.handleAlert(alert);
  });
  console.log(`🔔 告警服务已启动，订阅稳定性监控事件`);

  // P1 修复 #11：初始化 Loki 日志传输（若配置了 LOKI_URL/LOKI_HOST）
  try {
    const lokiConfigured = await loggingService.configureLoki();
    if (lokiConfigured) {
      console.log(`📊 Loki 日志传输已接入`);
    }
  } catch (e) {
    console.warn('[Startup] Loki 初始化失败，降级为 Console+Redis:', e instanceof Error ? e.message : String(e));
  }

  try {
    await initializeSystem();
  } catch (e) {
    logger.error('[Startup] 系统初始化失败:', e instanceof Error ? e.message : String(e));
    captureException(e, { phase: 'startup' });
  }

startBackgroundTaskPoller();

  console.log('🏠 本地版本：云支付分账模块未启用');
});

// 教程视频支持大文件 PUT/POST 上传（前端上限 1GB）。Node 默认请求超时会在慢速磁盘写入或自动截帧时重置连接。
server.requestTimeout = 5 * 60 * 1000;
server.timeout = 5 * 60 * 1000;
server.headersTimeout = 5 * 60 * 1000 + 10 * 1000;
server.keepAliveTimeout = 65 * 1000;

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await gracefulShutdown('SIGTERM');
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await gracefulShutdown('SIGINT');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason instanceof Error ? reason.message : String(reason));
  captureException(reason, { type: 'unhandledRejection' });
});

process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception:', error instanceof Error ? error.message : String(error));
  captureException(error, { type: 'uncaughtException' });
  await gracefulShutdown('uncaughtException', 1);
});
