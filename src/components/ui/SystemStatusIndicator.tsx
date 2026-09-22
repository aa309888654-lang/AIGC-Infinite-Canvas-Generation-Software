import { Loader2, Wifi, WifiOff, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useTaskStore } from '@/store/useTaskStore';

export const SystemStatusIndicator = () => {
  const { isRunning, executionProgress } = useTaskStore();

  return (
    <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
      {/* 执行状态 */}
      {isRunning && (
        <div className="bg-[#1F1F1F] border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-[#007AFF]" />
          <span className="text-xs text-white font-medium">
            执行中: {executionProgress.completed}/{executionProgress.total}
          </span>
        </div>
      )}

      {/* 任务完成提示 */}
      {executionProgress.completed === executionProgress.total && executionProgress.total > 0 && !isRunning && (
        <div className="bg-[#1F1F1F] border border-[#34C759] rounded-lg px-3 py-1.5 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#34C759]" />
          <span className="text-xs text-white font-medium">
            已完成 {executionProgress.completed} 个任务
          </span>
        </div>
      )}

      {/* 错误提示 */}
      {false && (
        <div className="bg-[#1F1F1F] border border-[#FF3B30] rounded-lg px-3 py-1.5 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#FF3B30]" />
          <span className="text-xs text-white font-medium max-w-48 truncate">
            {'错误'}
          </span>
        </div>
      )}

      {/* 连接状态 */}
      <ConnectionStatus />
    </div>
  );
};

const ConnectionStatus = () => {
  // 模拟连接状态，实际应用中应该从store获取
  const isConnected = true;

  return (
    <div className="bg-[#1F1F1F] border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
      {isConnected ? (
        <>
          <div className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
          <Wifi className="w-4 h-4 text-[#34C759]" />
          <span className="text-xs text-white font-medium">在线</span>
        </>
      ) : (
        <>
          <div className="w-2 h-2 rounded-full bg-[#FF3B30]" />
          <WifiOff className="w-4 h-4 text-[#FF3B30]" />
          <span className="text-xs text-white font-medium">离线</span>
        </>
      )}
    </div>
  );
};

export const StatusToast = ({ message, type = 'info', onClose }: {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose?: () => void;
}) => {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-[#34C759]" />,
    error: <AlertCircle className="w-5 h-5 text-[#FF3B30]" />,
    warning: <AlertCircle className="w-5 h-5 text-[#FF9500]" />,
    info: <Info className="w-5 h-5 text-[#007AFF]" />,
  };

  const borderColors = {
    success: 'border-[#34C759]',
    error: 'border-[#FF3B30]',
    warning: 'border-[#FF9500]',
    info: 'border-[#007AFF]',
  };

  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1F1F1F] border ${borderColors[type]} rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg animate-slide-up z-50`}>
      {icons[type]}
      <span className="text-sm text-white font-medium">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-2 text-white/60 hover:text-white transition-colors"
        >
          ×
        </button>
      )}
    </div>
  );
};

export const MiniProgressBar = ({ progress }: { progress: number }) => {
  return (
    <div className="w-32 h-1.5 bg-[#383838] rounded-full overflow-hidden">
      <div
        className="h-full bg-[#007AFF] transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export const NotificationDot = ({ count }: { count: number }) => {
  if (count === 0) return null;

  return (
    <div className="absolute -top-1 -right-1 min-w-4 h-4 bg-[#FF3B30] rounded-full flex items-center justify-center px-1">
      <span className="text-[10px] text-white font-bold">
        {count > 99 ? '99+' : count}
      </span>
    </div>
  );
};