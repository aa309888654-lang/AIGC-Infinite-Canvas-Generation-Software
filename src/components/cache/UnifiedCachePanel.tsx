/**
 * 统一缓存管理面板
 * 整合所有缓存清除和管理功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import { unifiedCacheService, CacheType, CacheStats } from '@/services/unified-cache-service';
import {
  Trash2, RefreshCw, HardDrive, AlertTriangle,
  CheckCircle, X, Database
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UnifiedCachePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const CACHE_TYPE_INFO: Record<CacheType, { name: string; description: string; icon: React.ReactNode }> = {
  api: {
    name: 'API缓存',
    description: 'API请求响应缓存',
    icon: <Database className="w-4 h-4" />,
  },
  thumbnail: {
    name: '缩略图缓存',
    description: '图片和视频缩略图',
    icon: <HardDrive className="w-4 h-4" />,
  },
  model: {
    name: '模型缓存',
    description: 'AI模型数据缓存',
    icon: <Database className="w-4 h-4" />,
  },
  workflow: {
    name: '工作流缓存',
    description: '工作流执行数据',
    icon: <Database className="w-4 h-4" />,
  },
  temp: {
    name: '临时缓存',
    description: '临时文件和数据',
    icon: <HardDrive className="w-4 h-4" />,
  },
  all: {
    name: '所有缓存',
    description: '清除所有缓存',
    icon: <Trash2 className="w-4 h-4" />,
  },
};

export const UnifiedCachePanel: React.FC<UnifiedCachePanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [cacheStats, setCacheStats] = useState<CacheStats[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  const [clearResult, setClearResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<CacheType>>(new Set());

  const loadCacheStats = useCallback(() => {
    const stats = unifiedCacheService.getStats();
    setCacheStats(stats);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadCacheStats();
    }
  }, [isOpen, loadCacheStats]);

  const toggleType = (type: CacheType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleClearSelected = async () => {
    if (selectedTypes.size === 0) return;

    setIsClearing(true);
    setClearResult(null);

    try {
      if (selectedTypes.has('all')) {
        const result = await unifiedCacheService.clearAll();
        setClearResult({
          success: result.success,
          message: result.success
            ? `已清除 ${result.clearedCaches.length} 个缓存，释放 ${unifiedCacheService.formatSize(result.freedSize)}`
            : `清除失败: ${result.errors.join(', ')}`,
        });
      } else {
        selectedTypes.forEach(type => {
          if (type !== 'all') {
            unifiedCacheService.clear(type);
          }
        });
        setClearResult({
          success: true,
          message: `已清除 ${selectedTypes.size} 个缓存`,
        });
      }
      loadCacheStats();
      setSelectedTypes(new Set());
    } catch (error) {
      setClearResult({
        success: false,
        message: `清除失败: ${error}`,
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    setClearResult(null);

    try {
      const result = await unifiedCacheService.clearAll();
      setClearResult({
        success: result.success,
        message: result.success
          ? `已清除所有缓存，释放 ${unifiedCacheService.formatSize(result.freedSize)}`
          : `清除失败: ${result.errors.join(', ')}`,
      });
      loadCacheStats();
    } catch (error) {
      setClearResult({
        success: false,
        message: `清除失败: ${error}`,
      });
    } finally {
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  const totalSize = cacheStats.reduce((sum, stat) => sum + stat.size, 0);
  const totalItems = cacheStats.reduce((sum, stat) => sum + stat.itemCount, 0);
  const hitRate = unifiedCacheService.getHitRate();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1A1A1D] rounded-xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col overflow-hidden border border-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-white">缓存管理</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 p-4 border-b border-white/10">
          <div className="bg-[#2D2D2D] rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">总大小</div>
            <div className="text-xl font-semibold text-white">
              {unifiedCacheService.formatSize(totalSize)}
            </div>
          </div>
          <div className="bg-[#2D2D2D] rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">缓存项</div>
            <div className="text-xl font-semibold text-white">{totalItems}</div>
          </div>
          <div className="bg-[#2D2D2D] rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">命中率</div>
            <div className="text-xl font-semibold text-white">{hitRate.toFixed(1)}%</div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {cacheStats.map(stat => {
              const type = stat.name.replace('缓存', '').toLowerCase() as CacheType;
              const info = CACHE_TYPE_INFO[type] || CACHE_TYPE_INFO.temp;

              return (
                <button
                  key={stat.name}
                  onClick={() => toggleType(type)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-lg border transition-all",
                    selectedTypes.has(type)
                      ? "bg-[#007AFF]/10 border-[#007AFF]/50"
                      : "bg-[#2D2D2D] border-transparent hover:border-white/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      selectedTypes.has(type) ? "bg-[#007AFF]/20" : "bg-white/5"
                    )}>
                      {info.icon}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">{stat.name}</div>
                      <div className="text-xs text-gray-500">{stat.itemCount} 项</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">{stat.formattedSize}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {clearResult && (
          <div className={cn(
            "mx-4 mb-4 p-3 rounded-lg flex items-center gap-2",
            clearResult.success
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          )}>
            {clearResult.success ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm">{clearResult.message}</span>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-[#121214]">
          <button
            onClick={loadCacheStats}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">刷新</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearSelected}
              disabled={selectedTypes.size === 0 || isClearing}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                selectedTypes.size > 0 && !isClearing
                  ? "bg-[#007AFF] text-white hover:bg-[#007AFF]/90"
                  : "bg-white/5 text-gray-500 cursor-not-allowed"
              )}
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">清除选中 ({selectedTypes.size})</span>
            </button>
            <button
              onClick={handleClearAll}
              disabled={isClearing}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">清除全部</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedCachePanel;
