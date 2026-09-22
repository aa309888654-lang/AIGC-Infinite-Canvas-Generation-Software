import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Image, Film } from 'lucide-react';
import { optimizedDragDropManager, FileProcessingItem } from '../../services/optimized-drag-drop-manager';

interface DragDropProgressPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DragDropProgressPanel({ isOpen, onClose }: DragDropProgressPanelProps) {
  const [processingItems, setProcessingItems] = useState<FileProcessingItem[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateItems = () => {
      const items = optimizedDragDropManager.getProcessingStatus();
      setProcessingItems(items);
      
      // 如果有处理中的项目，显示面板
      if (items.length > 0) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // 初始更新
    updateItems();

    // 定期更新状态
    const interval = setInterval(updateItems, 500);

    return () => clearInterval(interval);
  }, []);

  // 合并状态：如果isOpen为true则显示，否则根据是否有处理项目决定是否显示
  const shouldShow = isOpen || isVisible;

  if (!shouldShow || processingItems.length === 0) return null;

  const pendingItems = processingItems.filter(item => item.status === 'pending');
  const processingItemsList = processingItems.filter(item => item.status === 'processing');
  const completedItems = processingItems.filter(item => item.status === 'completed');
  const errorItems = processingItems.filter(item => item.status === 'error');

  const getStatusIcon = (status: FileProcessingItem['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };
  const _getStatusColor = (status: FileProcessingItem['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-400';
      case 'processing':
        return 'text-gray-500';
      case 'completed':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
    }
  };

  const getFileIcon = (type: 'image' | 'video') => {
    return type === 'image' ? 
      <Image className="w-4 h-4 text-gray-500" /> : 
      <Film className="w-4 h-4 text-purple-500" />;
  };

  const cancelProcessing = (itemId: string) => {
    optimizedDragDropManager.cancelProcessing(itemId);
  };

  const clearCompleted = () => {
    const completedIds = completedItems.map(item => item.id);
    completedIds.forEach(id => optimizedDragDropManager.cancelProcessing(id));
  };

  return (
    <div className="fixed top-4 right-4 w-96 bg-[#1F1F1F] border border-white/10 rounded-xl shadow-2xl z-50">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">文件处理进度</h3>
        <div className="flex items-center gap-2">
          {completedItems.length > 0 && (
            <button
              onClick={clearCompleted}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              清除已完成
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {/* 处理中项目 */}
        {processingItemsList.length > 0 && (
          <div className="p-4 border-b border-white/5">
            <h4 className="text-sm font-medium text-white mb-2">处理中 ({processingItemsList.length})</h4>
            <div className="space-y-2">
              {processingItemsList.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-2 bg-white/5 rounded">
                  {getFileIcon(item.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white truncate">{item.name}</span>
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="mt-1">
                      <div className="w-full bg-gray-700 rounded-full h-1">
                        <div 
                          className="bg-gray-500 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => cancelProcessing(item.id)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <X className="w-3 h-3 text-white/50" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 待处理项目 */}
        {pendingItems.length > 0 && (
          <div className="p-4 border-b border-white/5">
            <h4 className="text-sm font-medium text-white mb-2">等待处理 ({pendingItems.length})</h4>
            <div className="space-y-2">
              {pendingItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-2 bg-white/5 rounded">
                  {getFileIcon(item.type)}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white truncate">{item.name}</span>
                    <div className="text-xs text-gray-400">
                      {(item.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  {getStatusIcon(item.status)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 已完成项目 */}
        {completedItems.length > 0 && (
          <div className="p-4 border-b border-white/5">
            <h4 className="text-sm font-medium text-white mb-2">已完成 ({completedItems.length})</h4>
            <div className="space-y-2">
              {completedItems.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center gap-3 p-2 bg-white/5 rounded">
                  {getFileIcon(item.type)}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white truncate">{item.name}</span>
                    <div className="text-xs text-gray-400">
                      {(item.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  {getStatusIcon(item.status)}
                </div>
              ))}
              {completedItems.length > 5 && (
                <div className="text-xs text-gray-400 text-center">
                  还有 {completedItems.length - 5} 个已完成项目
                </div>
              )}
            </div>
          </div>
        )}

        {/* 错误项目 */}
        {errorItems.length > 0 && (
          <div className="p-4">
            <h4 className="text-sm font-medium text-red-400 mb-2">处理失败 ({errorItems.length})</h4>
            <div className="space-y-2">
              {errorItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-2 bg-red-900/20 rounded border border-red-500/20">
                  {getFileIcon(item.type)}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white truncate">{item.name}</span>
                    <div className="text-xs text-red-400 truncate">
                      {item.error || '处理失败'}
                    </div>
                  </div>
                  {getStatusIcon(item.status)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-sm font-semibold text-white">{pendingItems.length}</div>
            <div className="text-xs text-gray-400">等待</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-400">{processingItemsList.length}</div>
            <div className="text-xs text-gray-400">处理中</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-green-400">{completedItems.length}</div>
            <div className="text-xs text-gray-400">完成</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-red-400">{errorItems.length}</div>
            <div className="text-xs text-gray-400">失败</div>
          </div>
        </div>
      </div>
    </div>
  );
}