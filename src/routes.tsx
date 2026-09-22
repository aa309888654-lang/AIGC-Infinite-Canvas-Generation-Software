import React, { Suspense, useEffect, useLayoutEffect } from 'react';
import { createBrowserRouter, RouterProvider, useLocation, Navigate, Outlet } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ui/ErrorBoundary';
import GlobalErrorBoundary from './components/ui/GlobalErrorBoundary';
import { AICacheSplash } from './components/ui/AICacheSplash';
import {
  goHome as navigationGoHome,
  navigateTo as navigationNavigateTo,
  setAppNavigator,
} from './services/navigation-service';

// === 路由守卫: 编辑器页面禁用滚动 ===
function EditorBodyController({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isEditor = location.pathname === '/1' || location.pathname === '/1/';

  useEffect(() => {
    if (isEditor) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [isEditor]);

  return <>{children}</>;
}

// === 路由守卫: 无限画布（登录系统已移除，直接放行） ===
function CanvasLoginGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const scrollableMain = document.querySelector('.seko-main');
      if (scrollableMain) {
        scrollableMain.scrollTop = 0;
      }
      const scrollableLanding = document.querySelector('.seko-style-landing');
      if (scrollableLanding) {
        scrollableLanding.scrollTop = 0;
      }
    });
  }, [pathname]);
  return null;
}

const PAGE_TITLES: Record<string, string> = {
  '/1': '小天画布 · AI 创作工作台',
  '/music': 'AI音乐 - 小天画布',
  '/ai-music': 'AI音乐 - 小天画布',
  '/ai-view': 'AI视图 - 小天画布',
  '/my-music': '我的音乐 - 小天画布',
  // '/profile' 已移除
};

function DocumentTitleUpdater() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const title = PAGE_TITLES[path];
    document.title = title || '小天画布 · AI 创作工作台';
  }, [location.pathname]);

  return null;
}

// === 加载指示器 — AI 缓存动画 ===
function PageLoader() {
  return <AICacheSplash variant="route" />;
}

const NotificationPopup = React.lazy(() => import('./components/ui/NotificationPopup'));

function DeferredNotificationPopup() {
  const location = useLocation();
  const [ready, setReady] = React.useState(false);
  const disabled = location.pathname === '/m' || location.pathname.startsWith('/m/');

  useEffect(() => {
    if (disabled) {
      setReady(false);
      return undefined;
    }
    if (window.requestIdleCallback) {
      const idleId = window.requestIdleCallback(() => setReady(true), { timeout: 1000 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(() => setReady(true), 300);
    return () => window.clearTimeout(timer);
  }, [disabled]);

  return !disabled && ready ? (
    <Suspense fallback={null}>
      <NotificationPopup />
    </Suspense>
  ) : null;
}

// === 懒加载重试工具 ===
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3
): React.LazyExoticComponent<T> {
  return React.lazy(() => {
    const attempt = (remaining: number): Promise<{ default: T }> =>
      factory().catch((err) => {
        if (remaining <= 0) throw err;
        console.warn(`[LazyLoad] 加载失败，剩余重试 ${remaining} 次...`, err.message);
        return new Promise<{ default: T }>((resolve) => {
          setTimeout(() => resolve(attempt(remaining - 1)), 1000);
        });
      });
    return attempt(retries);
  });
}

async function withAppTranslations<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): Promise<{ default: T }> {
  const [component] = await Promise.all([factory(), import('./lib/app-i18n')]);
  return component;
}

// === 懒加载页面 ===
const App = lazyWithRetry(() => withAppTranslations(() => import('./App')));
const MusicPage = lazyWithRetry(() => withAppTranslations(() => import('./pages/MusicPage')));
const AIViewPage = lazyWithRetry(() => withAppTranslations(() => import('./pages/AIViewPage')));
const MyMusicPage = lazyWithRetry(() => withAppTranslations(() => import('./pages/MyMusicPage')));
// ProfilePage 已移除（会员系统已删除）

function SafePage({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}

function DeviceMusic() {
  return <SafePage><Suspense fallback={<PageLoader />}><MusicPage /></Suspense></SafePage>;
}

function DeviceAIView() {
  return <SafePage><ToastProvider><Suspense fallback={<PageLoader />}><AIViewPage /></Suspense></ToastProvider></SafePage>;
}

// DeviceProfile 已移除（会员系统已删除）

function DeviceMyMusic() {
  return <SafePage><ToastProvider><Suspense fallback={<PageLoader />}><MyMusicPage /></Suspense></ToastProvider></SafePage>;
}

// === 路由配置 ===
// 开源版：删除全部官网营销/法律页，入口直达无限画布创作台 /1
const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <GlobalErrorBoundary>
        <EditorBodyController>
          <ErrorBoundary>
            <ScrollToTop />
            <DocumentTitleUpdater />
            <Outlet />
          </ErrorBoundary>
        </EditorBodyController>
        <DeferredNotificationPopup />
      </GlobalErrorBoundary>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/1" replace />,
      },
      {
        path: 'home',
        element: <Navigate to="/1" replace />,
      },
      {
        path: '1',
        element: (
          <CanvasLoginGuard>
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <App />
              </Suspense>
            </ErrorBoundary>
          </CanvasLoginGuard>
        ),
      },
      {
        path: 'music',
        element: <DeviceMusic />,
      },
      {
        path: 'ai-music',
        element: <Navigate to="/music" replace />,
      },
      {
        path: 'ai-view',
        element: <DeviceAIView />,
      },
      {
        path: 'workspace',
        element: <Navigate to="/ai-view" replace />,
      },
      {
        path: 'my-music',
        element: <DeviceMyMusic />,
      },
      {
        path: 'membership',
        element: <Navigate to="/1" replace />,
      },
      {
        path: 'login',
        element: <Navigate to="/1" replace />,
      },
      {
        path: 'profile',
        element: <Navigate to="/1" replace />,
      },
      {
        path: 'settings',
        element: <Navigate to="/1" replace />,
      },
      {
        path: 'notifications',
        element: <Navigate to="/1" replace />,
      },
      {
        path: 'pricing',
        element: <Navigate to="/1" replace />,
      },
      {
        path: 'tools',
        element: <Navigate to="/1" replace />,
      },
      {
        path: 'canvas',
        element: <Navigate to="/1" replace />,
      },
      {
        path: '*',
        element: <Navigate to="/1" replace />,
      },
    ],
  },
]);

setAppNavigator((path) => {
  void router.navigate(path);
});

// === 向后兼容的导航工具 ===
export const navigateTo = (path: string) => {
  navigationNavigateTo(path);
};

export const goHome = () => {
  navigationGoHome();
};

function AppRoutes() {
  return <RouterProvider router={router} />;
}

export default AppRoutes;
