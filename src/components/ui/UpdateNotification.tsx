import React, { useEffect, useState, useCallback } from 'react';
import { Download, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { formatDisplayVersion } from '@/config/app-version';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

interface UpdateNotificationProps {
  /** 是否自动检查更新（默认 true，仅在 Electron 打包环境生效） */
  autoCheck?: boolean;
}

/**
 * 自动更新通知组件
 * 监听 electron-updater 事件，在右下角显示更新通知
 */
const UpdateNotification: React.FC<UpdateNotificationProps> = ({ autoCheck = true }) => {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [version, setVersion] = useState<string>('');
  const [releaseNotes, setReleaseNotes] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [dismissed, setDismissed] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  const hasUpdater = typeof window !== 'undefined' && window.electronAPI?.updater;

  useEffect(() => {
    if (!hasUpdater) return;

    const api = window.electronAPI!.updater!;

    api.onChecking(() => setStatus('checking'));
    api.onAvailable((info) => {
      setVersion(info.version);
      const notes = typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => `【${n.version}】${n.note}`).join('\n')
          : '';
      setReleaseNotes(notes);
      setStatus('available');
      setDismissed(false);
    });
    api.onNotAvailable(() => setStatus('not-available'));
    api.onProgress((p) => {
      setProgress(p.percent);
      setStatus('downloading');
    });
    api.onDownloaded((info) => {
      setVersion(info.version);
      setStatus('downloaded');
      setDismissed(false);
    });
    api.onError((err) => {
      setErrorMsg(err.message);
      setStatus('error');
    });

    // 获取当前版本
    api.getInfo().then((info) => {
      if (info?.version) setCurrentVersion(info.version);
    });

    // 自动检查更新
    if (autoCheck) {
      const timer = setTimeout(() => {
        api.check().catch(() => undefined);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasUpdater, autoCheck]);

  const handleDownload = useCallback(async () => {
    if (!hasUpdater) return;
    setStatus('downloading');
    setProgress(0);
    try {
      await window.electronAPI!.updater!.download();
    } catch (e) {
      setErrorMsg(String(e));
      setStatus('error');
    }
  }, [hasUpdater]);

  const handleInstall = useCallback(async () => {
    if (!hasUpdater) return;
    try {
      await window.electronAPI!.updater!.install();
    } catch (e) {
      setErrorMsg(String(e));
      setStatus('error');
    }
  }, [hasUpdater]);

  const handleManualCheck = useCallback(async () => {
    if (!hasUpdater) return;
    setStatus('checking');
    try {
      const result = await window.electronAPI!.updater!.check();
      if (!result.available && result.error) {
        setErrorMsg(result.error);
        setStatus('error');
      }
    } catch (e) {
      setErrorMsg(String(e));
      setStatus('error');
    }
  }, [hasUpdater]);

  // 非 Electron 环境或已关闭时不渲染
  if (!hasUpdater || dismissed) return null;

  // 不需要显示的状态
  if (status === 'idle' || status === 'checking' || status === 'not-available') return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] w-96 max-w-[calc(100vw-2rem)]">
      <div className="bg-[#1E1E24]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            {status === 'available' && <Download className="w-4 h-4 text-blue-400" />}
            {status === 'downloading' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
            {status === 'downloaded' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
            {status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
            <span className="text-sm font-medium text-white">
              {status === 'available' && `发现新版本 ${formatDisplayVersion(version)}`}
              {status === 'downloading' && '正在下载更新...'}
              {status === 'downloaded' && '更新已就绪'}
              {status === 'error' && '更新失败'}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/40 hover:text-white/80 transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-4 py-3 space-y-3">
          {/* 当前版本信息 */}
          {currentVersion && (
            <div className="text-xs text-white/50">
              当前版本 {formatDisplayVersion(currentVersion)} → 新版本 {formatDisplayVersion(version)}
            </div>
          )}

          {/* 更新日志 */}
          {releaseNotes && status === 'available' && (
            <div className="max-h-32 overflow-y-auto text-xs text-white/70 bg-black/30 rounded-lg p-2 whitespace-pre-wrap">
              {releaseNotes}
            </div>
          )}

          {/* 下载进度 */}
          {status === 'downloading' && (
            <div className="space-y-1">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-white/50 text-right">{progress.toFixed(1)}%</div>
            </div>
          )}

          {/* 错误信息 */}
          {status === 'error' && (
            <div className="text-xs text-red-300/80 bg-red-500/10 rounded-lg p-2">
              {errorMsg || '未知错误'}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            {status === 'available' && (
              <button
                onClick={handleDownload}
                className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-medium rounded-lg transition-all"
              >
                立即下载
              </button>
            )}
            {status === 'downloaded' && (
              <button
                onClick={handleInstall}
                className="flex-1 px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-sm font-medium rounded-lg transition-all"
              >
                立即安装并重启
              </button>
            )}
            {status === 'error' && (
              <button
                onClick={handleManualCheck}
                className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-all"
              >
                重试
              </button>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-all"
            >
              稍后
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
