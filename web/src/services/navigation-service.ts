type NavigateHandler = (path: string) => void | Promise<void>;

let appNavigator: NavigateHandler | null = null;

export function setAppNavigator(navigator: NavigateHandler): void {
  appNavigator = navigator;
}

export function navigateTo(path: string): void {
  if (appNavigator) {
    void appNavigator(path);
    return;
  }

  if (typeof window !== 'undefined') {
    window.location.assign(path);
  }
}

export function goHome(): void {
  navigateTo('/');
}
