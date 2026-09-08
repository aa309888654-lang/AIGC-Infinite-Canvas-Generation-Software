export type LandingNavigationAction = 'navigate' | 'login';

// 软件工作台 /1 允许未登录预览，执行需要登录的操作时再弹出登录弹窗
const LOGIN_REQUIRED_PATHS = new Set<string>([]);

export function resolveLandingNavigationAction(
  href: string,
  isLoggedIn: boolean,
): LandingNavigationAction {
  const pathname = href.startsWith('/')
    ? href.split(/[?#]/, 1)[0]
    : href;

  if (LOGIN_REQUIRED_PATHS.has(pathname) && !isLoggedIn) {
    return 'login';
  }
  return 'navigate';
}
