import React, { useEffect } from 'react';
import { HardDrive, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useFileStore } from '@/store/useFileStore';
import { cn } from '@/lib/utils';

interface DiskSpaceMonitorProps {
  className?: string;
  compact?: boolean;
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getUsageColor = (percent: number): string => {
  if (percent >= 90) return 'text-red-400';
  if (percent >= 75) return 'text-yellow-400';
  return 'text-green-400';
};

const getProgressColor = (percent: number): string => {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-yellow-500';
  return 'bg-green-500';
};

const DiskSpaceMonitor: React.FC<DiskSpaceMonitorProps> = ({ className, compact = false }) => {
  const { diskSpace, refreshDiskSpace, startDiskMonitoring, stopDiskMonitoring } = useFileStore();

  useEffect(() => {
    startDiskMonitoring();
    return () => stopDiskMonitoring();
  }, [startDiskMonitoring, stopDiskMonitoring]);

  if (!diskSpace) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-4 bg-[#1F1F1F] rounded-xl border border-[#3E3E3E]",
        className
      )}>
        <RefreshCw className="w-5 h-5 text-[#64748B] animate-spin" />
        <span className="text-[#64748B] text-sm">加载磁盘信息...</span>
      </div>
    );
  }

  const usagePercent = Math.min(100, Math.max(0, diskSpace.usagePercent));

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-2 bg-[#1F1F1F] rounded-lg border border-[#3E3E3E]",
        className
      )}>
        <HardDrive className={cn(
          "w-4 h-4",
          diskSpace.isLowSpace ? "text-red-400" : "text-[#10B981]"
        )} />
        <div className="flex-1">
          <div className="h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div 
              className={cn("h-full transition-all duration-500", getProgressColor(usagePercent))}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
        <span className={cn("text-xs font-mono", getUsageColor(usagePercent))}>
          {usagePercent.toFixed(1)}%
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      "p-4 bg-[#1F1F1F] rounded-xl border border-[#3E3E3E]",
      className
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            diskSpace.isLowSpace 
              ? "bg-red-500/20" 
              : "bg-[#10B981]/20"
          )}>
            <HardDrive className={cn(
              "w-5 h-5",
              diskSpace.isLowSpace ? "text-red-400" : "text-[#10B981]"
            )} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">磁盘空间</h3>
            <p className="text-xs text-[#64748B]">实时监控存储状态</p>
          </div>
        </div>
        <button
          onClick={() => refreshDiskSpace()}
          className="p-2 hover:bg-[#3E3E3E] rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-[#64748B]" />
        </button>
      </div>

      {diskSpace.isLowSpace && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">存储空间不足！</p>
            <p className="text-xs text-red-300/80 mt-1">
              剩余空间不足 10GB，请及时清理或更换存储位置。
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#64748B]">已使用</span>
            <span className={cn("text-sm font-semibold", getUsageColor(usagePercent))}>
              {formatSize(diskSpace.usedSpace)} / {formatSize(diskSpace.totalSpace)}
            </span>
          </div>
          <div className="h-3 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div 
              className={cn("h-full transition-all duration-500 rounded-full", getProgressColor(usagePercent))}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[#64748B]">
              使用率: {usagePercent.toFixed(1)}%
            </span>
            <span className="text-xs text-[#64748B]">
              可用: {formatSize(diskSpace.freeSpace)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#3E3E3E]">
          <div className="text-center p-2 bg-[#2A2A2A] rounded-lg">
            <p className="text-xs text-[#64748B] mb-1">总容量</p>
            <p className="text-sm font-semibold text-white">
              {formatSize(diskSpace.totalSpace)}
            </p>
          </div>
          <div className="text-center p-2 bg-[#2A2A2A] rounded-lg">
            <p className="text-xs text-[#64748B] mb-1">已使用</p>
            <p className="text-sm font-semibold text-[#FF6B6B]">
              {formatSize(diskSpace.usedSpace)}
            </p>
          </div>
          <div className="text-center p-2 bg-[#2A2A2A] rounded-lg">
            <p className="text-xs text-[#64748B] mb-1">可用</p>
            <p className="text-sm font-semibold text-[#10B981]">
              {formatSize(diskSpace.freeSpace)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2">
          {diskSpace.isLowSpace ? (
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs">需要立即清理空间</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#10B981]">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">空间充足</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiskSpaceMonitor;
