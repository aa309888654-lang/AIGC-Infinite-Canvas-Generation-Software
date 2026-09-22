import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'sonner'
import 'sonner/dist/styles.css'
import AppRoutes from './routes.tsx'
import './index.css'
import './styles/mobile-visual-polish.css'
import GlobalErrorBoundary from './components/ui/GlobalErrorBoundary.tsx'
import { BootCacheSplash } from './components/ui/AICacheSplash.tsx'
import { initGlobalMonitoring } from './services/monitoring'
import { initLanguage } from './lib/i18n'
import { purgeBrowserApiSecrets } from './services/api-config-security'
import { LanguageRefreshBoundary } from './components/i18n/LanguageRefreshBoundary';

function RootApp() {
  return (
    <>
      <LanguageRefreshBoundary>
        <AppRoutes />
      </LanguageRefreshBoundary>
      <BootCacheSplash minMs={180} />
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}

initGlobalMonitoring();
initLanguage();
// One-time migration: erase historical browser-stored model credentials before
// any page, component, or legacy compatibility module can read them.
purgeBrowserApiSecrets();

// 清理已停止使用的 Service Worker 及其缓存。放在受 CSP 允许的同源模块内，
// 避免为启动脚本开放任意内联脚本执行权限。
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => undefined);
}
if ('caches' in window) {
  void caches.keys()
    .then((names) => Promise.all(names.map((name) => caches.delete(name))))
    .catch(() => undefined);
}

// 集成 React DevTools
const isDev = import.meta.env.DEV;
if (isDev) {
  import('./services/canvas-test-bridge').then(({ installCanvasTestBridge }) => {
    installCanvasTestBridge();
  });
}

// 集成 Redux DevTools
// Zustand 会自动检测 Redux DevTools 扩展
if (isDev) {
  // console.log('🔧 Redux DevTools 已启用 (通过 Zustand)')
}

// 添加全局错误捕获 - 阻止错误传播并记录
// #region debug-point browser-console-logs-reporting
// 调试收集器默认关闭，仅当外部设置 window.__BROWSER_DEBUG_COLLECTOR__ = true 时启用。
// 这样可避免在无收集器运行时频繁触发 fetch 失败（net::ERR_CONNECTION_REFUSED）污染控制台。
const isBrowserDebugCollectorEnabled = () =>
  typeof window !== 'undefined' && (window as unknown as { __BROWSER_DEBUG_COLLECTOR__?: boolean }).__BROWSER_DEBUG_COLLECTOR__ === true;

const reportBrowserConsoleDebug = (event: Record<string, unknown>) => {
  if (!import.meta.env.DEV) return;
  if (!isBrowserDebugCollectorEnabled()) return;
  fetch('http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'browser-console-logs',
      runId: 'pre',
      timestamp: new Date().toISOString(),
      ...event,
    }),
  }).catch(() => undefined);
};
// #endregion debug-point browser-console-logs-reporting

const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);
console.error = (...args: unknown[]) => {
  const message = args.map((item) => String(item)).join(' ');
  if (message.includes('[getThemeColors]') || message.includes('exportedColors')) return;
  reportBrowserConsoleDebug({ level: 'error', source: 'console.error', message, args: args.map((item) => String(item)) });
  originalConsoleError(...args);
};
console.warn = (...args: unknown[]) => {
  const message = args.map((item) => String(item)).join(' ');
  reportBrowserConsoleDebug({ level: 'warn', source: 'console.warn', message, args: args.map((item) => String(item)) });
  originalConsoleWarn(...args);
};

const DYNAMIC_IMPORT_ERROR_TOKENS = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'failed to load module script',
  'chunkloaderror',
];
const CHUNK_RELOAD_STORAGE_KEY = 'app_chunk_reload_at';
const CHUNK_RELOAD_PARAM = '__app_asset_reload';

const isDynamicImportErrorMessage = (message: string) => {
  const normalized = message.toLowerCase();
  return DYNAMIC_IMPORT_ERROR_TOKENS.some((token) => normalized.includes(token));
};

const reloadForFreshAssetsAfterChunkError = () => {
  try {
    const now = Date.now();
    const lastReloadAt = Number(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) || 0);
    if (now - lastReloadAt < 15000) return false;

    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
    const url = new URL(window.location.href);
    url.searchParams.set(CHUNK_RELOAD_PARAM, String(now));
    window.location.replace(url.toString());
    return true;
  } catch {
    window.location.reload();
    return true;
  }
};

window.addEventListener(
  'error',
  (event) => {
    const target = event.target as EventTarget | null;
    if (target instanceof HTMLElement) {
      // 资源加载错误（img/script/css）在 dev 模式下常因 React StrictMode 双挂载或 HMR 触发 ERR_ABORTED，
      // 属于无害噪音，调用 preventDefault 抑制浏览器默认控制台输出。
      const resourceSrc =
        (target as HTMLImageElement | HTMLScriptElement).src || (target as HTMLLinkElement).href || '';
      if (resourceSrc) {
        event.preventDefault();
      }
      reportBrowserConsoleDebug({
        level: 'error',
        source: 'resource-error',
        tagName: target.tagName,
        src: resourceSrc,
        outerHTML: target.outerHTML?.slice(0, 500),
      });
      return;
    }

  const message = String(event.message ?? event.error?.message ?? '');

  // SOLO/浏览器注入脚本偶发主题探测错误，不属于应用源码，过滤避免污染控制台
  if (message.includes('exportedColors') || message.includes('getThemeColors')) {
    event.preventDefault();
    return;
  }

  if (message.includes('ResizeObserver loop completed with undelivered notifications')) {
    event.preventDefault();
    return;
  }

  if (isDynamicImportErrorMessage(message)) {
    event.preventDefault();
    console.warn('[GlobalError] 动态模块加载失败，尝试刷新最新资源:', event.filename);
    reloadForFreshAssetsAfterChunkError();
    return;
  }

  reportBrowserConsoleDebug({
    level: 'error',
    source: 'window.error',
    message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
  });
  console.error('Global error caught:', event.error ?? event.message ?? 'unknown');
  },
  true
);

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = String(reason?.message ?? reason ?? '');

  if (message.includes('exportedColors') || message.includes('getThemeColors')) {
    event.preventDefault();
    return;
  }

  // 阻止动态导入相关的未处理Promise拒绝
  if (isDynamicImportErrorMessage(message)) {
    event.preventDefault();
    console.warn('[GlobalError] 动态导入Promise被拒绝，尝试刷新最新资源');
    reloadForFreshAssetsAfterChunkError();
    return;
  }

  reportBrowserConsoleDebug({
    level: 'error',
    source: 'unhandledrejection',
    message,
    stack: reason?.stack,
  });
  console.error('Unhandled promise rejection:', reason);
});

const rootElement = document.getElementById('root')!;
const reactRoot = import.meta.hot?.data.reactRoot ?? ReactDOM.createRoot(rootElement);

if (import.meta.hot) {
  import.meta.hot.data.reactRoot = reactRoot;
}

reactRoot.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <RootApp />
    </GlobalErrorBoundary>
  </React.StrictMode>,
)
