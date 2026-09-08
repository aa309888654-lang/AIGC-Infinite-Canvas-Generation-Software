/**
 * Sentry 错误追踪服务 - P0 修复
 * 在生产环境自动初始化，捕获未处理异常和 5xx 错误
 *
 * 配置（.env）:
 *   SENTRY_DSN=https://xxx@sentry.io/xxx  (留空则不启用)
 *   SENTRY_ENVIRONMENT=production
 *   SENTRY_TRACES_SAMPLE_RATE=0.1
 */

let sentryInitialized = false;

/**
 * 初始化 Sentry（如果配置了 DSN）
 * 不安装 @sentry/node 依赖时静默降级，不阻塞启动
 */
export async function initSentry(): Promise<boolean> {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('[Sentry] 未配置 SENTRY_DSN，错误追踪未启用');
    return false;
  }

  try {
    // 动态导入，避免未安装依赖时启动失败
    const Sentry = await import('@sentry/node' as string).catch(() => null);

    if (!Sentry || !Sentry.init) {
      console.warn('[Sentry] @sentry/node 未安装，错误追踪未启用。请运行: npm install @sentry/node');
      return false;
    }

    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      release: process.env.SENTRY_RELEASE || undefined,
      // 生产环境才启用
      enabled: process.env.NODE_ENV === 'production',
      // 不拦截异常（由 index.ts 的 gracefulShutdown 处理）
      // 但会上报到 Sentry
      integrations: [],
    });

    sentryInitialized = true;
    console.log(`[Sentry] 错误追踪已启用 (env: ${process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV})`);
    return true;
  } catch (error) {
    console.warn('[Sentry] 初始化失败，错误追踪未启用:', error);
    return false;
  }
}

/**
 * 捕获异常到 Sentry
 * 如果 Sentry 未初始化则静默跳过
 */
export function captureException(error: unknown, context?: Record<string, any>): void {
  if (!sentryInitialized) return;
  try {
    import('@sentry/node' as string).then((Sentry) => {
      if (Sentry?.captureException) {
        if (context) {
          Sentry.withScope((scope: any) => {
            Object.entries(context).forEach(([key, value]) => {
              scope.setContext(key, { value });
            });
            Sentry.captureException(error);
          });
        } else {
          Sentry.captureException(error);
        }
      }
    });
  } catch {
    // 静默失败，不影响主流程
  }
}

/**
 * 捕获消息到 Sentry
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!sentryInitialized) return;
  try {
    import('@sentry/node' as string).then((Sentry) => {
      if (Sentry?.captureMessage) {
        Sentry.captureMessage(message, level);
      }
    });
  } catch {
    // 静默失败
  }
}

export function isSentryInitialized(): boolean {
  return sentryInitialized;
}
