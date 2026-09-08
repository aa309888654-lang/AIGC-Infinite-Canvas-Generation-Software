import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

const DYNAMIC_IMPORT_ERROR_TOKENS = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'failed to load module script',
  'chunkloaderror',
];
const CHUNK_RELOAD_STORAGE_KEY = 'app_chunk_reload_at';
const CHUNK_RELOAD_PARAM = '__app_asset_reload';

const isDynamicImportError = (error: Error | null) => {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  return DYNAMIC_IMPORT_ERROR_TOKENS.some((token) => message.includes(token));
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

class GlobalErrorBoundary extends Component<Props, State> {
  private autoRecoverCount = 0;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    // Sonner Toaster (section) 与 React 19 的 DOM 调和偶发 removeChild 冲突，
    // 页面内容实际已正常渲染，自动恢复避免遮挡用户界面。
    if (
      error.message?.includes('removeChild') ||
      error.message?.includes('The node to be removed is not a child of this node')
    ) {
      if (this.autoRecoverCount < 5) {
        this.autoRecoverCount++;
        console.warn('[GlobalErrorBoundary] 检测到 DOM removeChild 冲突，自动恢复 (第' + this.autoRecoverCount + '次)');
        setTimeout(() => {
          this.setState({ hasError: false, error: null, errorInfo: null });
        }, 0);
        return;
      }
    }

    if (isDynamicImportError(error)) {
      console.warn('[GlobalErrorBoundary] 检测到动态导入错误，尝试刷新最新资源...');
      if (reloadForFreshAssetsAfterChunkError()) return;
      this.setState({ error, errorInfo });
      return;
    }
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-[#1A1A1D] border border-[#3A3A42] rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white">应用出现错误</h2>
            </div>
            
            <div className="mb-4">
              <p className="text-white/80 mb-2">
                很抱歉，应用遇到了一个错误。以下是错误信息：
              </p>
              <div className="bg-[#252528] border border-[#4A4A4E] rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-sm text-red-400 font-mono">
                  {this.state.error?.message || '未知错误'}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-white/60 cursor-pointer">详细信息</summary>
                    <pre className="text-xs text-white/40 mt-2 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 py-2.5 bg-[#007AFF] hover:bg-[#0056D4] text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重试
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 bg-[#6610F2] hover:bg-[#7C3AED] text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重新加载
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;