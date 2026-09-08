import React, { useState, useEffect, useCallback } from 'react';
import { X, Settings, Activity, PlayCircle as Play, Database, Zap, CheckCircle, XCircle, Clock, RefreshCw, Key } from 'lucide-react';

import APIMonitorPanel from './APIMonitorPanel';
import GenerationTaskCenter from './GenerationTaskCenter';

import useUnifiedAPIConfigStore from '@/store/useUnifiedAPIConfigStore';
import { taskScheduler } from '@/services/task-scheduler';
import { apiStatusMonitor } from '@/services/api-status-monitor';

type ActivePanel = 'none' | 'api-monitor' | 'task-center' | 'config' | 'status';

interface UnifiedManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const UnifiedManager: React.FC<UnifiedManagerProps> = ({ isOpen, onClose }) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [taskStats, setTaskStats] = useState<any>(null);
  const [apiStats, setApiStats] = useState<any>(null);

  const { configs, activeProvider } = useUnifiedAPIConfigStore();

  useEffect(() => {
    if (isOpen) {
      setTaskStats(taskScheduler.getStats());
      setApiStats(apiStatusMonitor.getStats());
    }
  }, [isOpen]);

  const refreshStats = useCallback(() => {
    setTaskStats(taskScheduler.getStats());
    setApiStats(apiStatusMonitor.getStats());
  }, []);

  const openPanel = useCallback((panel: ActivePanel) => {
    setActivePanel(panel);
  }, []);

  const closeSubPanel = useCallback(() => {
    setActivePanel('none');
    refreshStats();
  }, [refreshStats]);

  if (!isOpen) return null;

  if (activePanel === 'api-monitor') {
    return (
      <APIMonitorPanel
        isOpen={true}
        onClose={closeSubPanel}
      />
    );
  }

  if (activePanel === 'task-center') {
    return (
      <GenerationTaskCenter
        isOpen={true}
        onClose={closeSubPanel}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1A1A1D] border border-[#2D2D2D] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2D2D2D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">统一管理中心</h2>
              <p className="text-xs text-gray-400">API、任务、状态一站式管理</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshStats}
              className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 p-4 border-b border-[#2D2D2D]">
          <div className="bg-[#252528] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">API 状态</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-xl font-bold text-green-400">
                    {apiStats?.available || 0}
                  </span>
                </div>
                <span className="text-xs text-gray-500">可用</span>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <XCircle className="w-3 h-3 text-red-400" />
                  <span className="text-xl font-bold text-red-400">
                    {apiStats?.error || 0}
                  </span>
                </div>
                <span className="text-xs text-gray-500">异常</span>
              </div>
            </div>
            <button
              onClick={() => openPanel('api-monitor')}
              className="w-full mt-3 px-3 py-2 bg-[#1A1A1D] hover:bg-[#2D2D2D] rounded-lg text-sm text-white transition-colors"
            >
              详细监控
            </button>
          </div>

          <div className="bg-[#252528] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Play className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-400">任务状态</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3 text-gray-400" />
                  <span className="text-xl font-bold text-gray-400">
                    {taskStats?.running || 0}
                  </span>
                </div>
                <span className="text-xs text-gray-500">进行中</span>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-yellow-400" />
                  <span className="text-xl font-bold text-yellow-400">
                    {taskStats?.pending || 0}
                  </span>
                </div>
                <span className="text-xs text-gray-500">等待中</span>
              </div>
            </div>
            <button
              onClick={() => openPanel('task-center')}
              className="w-full mt-3 px-3 py-2 bg-[#1A1A1D] hover:bg-[#2D2D2D] rounded-lg text-sm text-white transition-colors"
            >
              任务中心
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => openPanel('api-monitor')}
              className="flex items-center gap-3 p-4 bg-[#252528] hover:bg-[#2D2D2D] rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center group-hover:bg-gray-500/30 transition-colors">
                <Activity className="w-5 h-5 text-gray-400" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium text-white">小天AICG</h3>
                <p className="text-xs text-gray-400">批量测试、延迟监控、状态追踪</p>
              </div>
            </button>

            <button
              onClick={() => openPanel('task-center')}
              className="flex items-center gap-3 p-4 bg-[#252528] hover:bg-[#2D2D2D] rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                <Play className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium text-white">任务调度中心</h3>
                <p className="text-xs text-gray-400">队列管理、优先级、并发控制</p>
              </div>
            </button>

            <button
              className="flex items-center gap-3 p-4 bg-[#252528] hover:bg-[#2D2D2D] rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                <Key className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium text-white">API 配置管理</h3>
                <p className="text-xs text-gray-400">统一配置、节点同步、导入导出</p>
              </div>
            </button>

            <button
              className="flex items-center gap-3 p-4 bg-[#252528] hover:bg-[#2D2D2D] rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
                <Database className="w-5 h-5 text-orange-400" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium text-white">生成缓存管理</h3>
                <p className="text-xs text-gray-400">参数缓存、命中率、预缓存</p>
              </div>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-[#2D2D2D] bg-[#252528]/50">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span>活跃提供商: {activeProvider || '未设置'}</span>
              <span>配置提供商: {Object.values(configs).filter(c => Object.values(c).some(v => v?.length > 0)).length}</span>
            </div>
            <span className="text-gray-500">所有服务已就绪</span>
          </div>
        </div>

        <div className="p-4 border-t border-[#2D2D2D]">
          <button
            onClick={onClose}
            className="w-full py-2 bg-[#2D2D2D] hover:bg-[#353538] rounded-lg text-white text-sm font-medium transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnifiedManager;
