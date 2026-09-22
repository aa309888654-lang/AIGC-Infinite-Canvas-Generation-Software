import { logger } from '@/lib/logger';

// 初始化全局监控系统
export function initGlobalMonitoring() {
  // 捕获未处理的 Promise 拒绝
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled Promise Rejection', {
      reason: event.reason,
      stack: event.reason?.stack,
    });
    
    // 可以在这里集成 Sentry 或自定义的上报逻辑
    reportErrorToBackend('unhandledrejection', event.reason);
  });

  // 捕获全局运行时错误
  window.addEventListener('error', (event) => {
    const message = String(event.message ?? event.error?.message ?? '');
    if (message.includes('ResizeObserver loop completed with undelivered notifications')) {
      event.preventDefault();
      return;
    }

    logger.error('Global Runtime Error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error instanceof Error ? { message: event.error.message, stack: event.error.stack } : (event.error ?? event.message ?? 'unknown'),
    });

    reportErrorToBackend('runtime_error', event.error || event.message);
  });

  // 性能监控：测量 FCP (首帧渲染时间) 和 LCP
  if ('PerformanceObserver' in window) {
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          logger.info(`首帧渲染时间 (FCP): ${entry.startTime.toFixed(2)}ms`);
        }
      }
    });
    paintObserver.observe({ type: 'paint', buffered: true });
    
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      logger.info(`最大内容渲染时间 (LCP): ${lastEntry.startTime.toFixed(2)}ms`);
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  }
}

// 模拟错误上报
function reportErrorToBackend(_type: string, _error: unknown) {
  // 在真实环境中，这里应该调用后端的监控上报 API
  // console.log(`[Monitoring] Report to backend: [${type}]`, error);
}
