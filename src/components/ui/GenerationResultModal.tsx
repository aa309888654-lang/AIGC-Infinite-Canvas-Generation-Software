import { useState, useCallback, useEffect } from 'react';
import {
  X,
  Download,
  FolderDown,
  Maximize2,
  Minimize2,
  PlayCircle as Play,
  Pause,
  RotateCcw,
  Image as ImageIcon,
  Video as VideoIcon,
  CheckCircle2,
  Loader2,
  XCircle,
  Split,
  LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePreviewStore, type PreviewItem } from '@/store/usePreviewStore';

export type GenerationType = 'image' | 'video';

interface GenerationResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: GenerationType;
  resultUrl?: string;
  title?: string;
  subtitle?: string;
  taskStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  progress?: number;
  errorMessage?: string;
  onDownload?: () => void;
  onSaveLocal?: () => void;
  onRetry?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
}

export function GenerationResultModal({
  isOpen,
  onClose,
  type,
  resultUrl,
  title,
  subtitle,
  taskStatus = 'idle',
  progress = 0,
  errorMessage,
  onDownload,
  onSaveLocal,
  onRetry,
  onConfirm,
  confirmText
}: GenerationResultModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [, setIsLoaded] = useState(false);
  const [comparisonLayout, setComparisonLayout] = useState<'grid' | 'horizontal' | 'vertical'>('grid');
  const { previewHistory, selectedForComparison, clearComparisonSelection } = usePreviewStore();
  
  const comparisonItems = useCallback(() => {
    if (selectedForComparison.length > 0) {
      return previewHistory.filter(item => 
        selectedForComparison.includes(item.id) && 
        item.status === 'completed' && 
        item.resultUrl
      );
    }
    if (resultUrl) {
      return [{ id: 'current', resultUrl, prompt: subtitle || '当前结果' } as PreviewItem];
    }
    return [];
  }, [previewHistory, selectedForComparison, resultUrl, subtitle]);

  const items = comparisonItems();
  const isComparisonMode = items.length > 1;

  const isVideoUrl = useCallback((url: string) => {
    if (!url) return false;
    return /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(url);
  }, []);

  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    if (el) {
      el.onloadeddata = () => setIsLoaded(true);
    }
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const getStatusIcon = () => {
    switch (taskStatus) {
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#1473E6' }} />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5" style={{ color: '#28A745' }} />;
      case 'failed':
        return <XCircle className="w-5 h-5" style={{ color: '#DC3545' }} />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (taskStatus) {
      case 'processing':
        return '生成中...';
      case 'completed':
        return '生成完成';
      case 'failed':
        return '生成失败';
      default:
        return '等待生成';
    }
  };

  const getHeaderGradient = () => {
    if (type === 'image') {
      return 'linear-gradient(135deg, #6610F2 0%, #00E5FF 100%)';
    }
    return 'linear-gradient(135deg, #E91E63 0%, #F472B6 100%)';
  };

  const getTypeIcon = () => {
    if (type === 'image') {
      return <ImageIcon className="w-6 h-6 text-white" />;
    }
    return <VideoIcon className="w-6 h-6 text-white" />;
  };

  const renderMediaContent = (url: string, className?: string, isItemVideo?: boolean) => {
    const isThisVideo = isItemVideo || isVideoUrl(url);
    if (isThisVideo) {
      return (
        <video
          src={url}
          controls
          autoPlay={false}
          className={className}
          style={{ maxHeight: '70vh' }}
        >
          您的浏览器不支持视频播放
        </video>
      );
    }
    return (
      <img
        src={url}
        alt="生成结果"
        className={className}
      />
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border flex flex-col',
          isFullscreen ? 'w-full h-full' : isComparisonMode ? 'w-[1200px] max-h-[90vh]' : 'w-[800px] max-h-[90vh]'
        )}
        style={{
          backgroundColor: '#1A1A1E',
          borderColor: '#3D3D42',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ background: getHeaderGradient() }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
              {isComparisonMode ? <Split className="w-6 h-6 text-white" /> : getTypeIcon()}
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white">
                {isComparisonMode ? '图片对比' : (title || (type === 'image' ? '图片生成结果' : '视频生成结果'))}
              </span>
              {isComparisonMode ? (
                <span className="text-xs text-white/70">对比 {items.length} 张图片</span>
              ) : subtitle ? (
                <span className="text-xs text-white/70">{subtitle}</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isComparisonMode && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
                <button
                  onClick={() => setComparisonLayout('grid')}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    comparisonLayout === 'grid' ? 'bg-white/20' : 'hover:bg-white/10'
                  )}
                  title="网格布局"
                >
                  <LayoutGrid className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => setComparisonLayout('horizontal')}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    comparisonLayout === 'horizontal' ? 'bg-white/20' : 'hover:bg-white/10'
                  )}
                  title="水平排列"
                >
                  <Split className="w-4 h-4 text-white rotate-90" />
                </button>
                <button
                  onClick={() => setComparisonLayout('vertical')}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    comparisonLayout === 'vertical' ? 'bg-white/20' : 'hover:bg-white/10'
                  )}
                  title="垂直排列"
                >
                  <Split className="w-4 h-4 text-white" />
                </button>
              </div>
            )}
            
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
              {getStatusIcon()}
              <span className="text-sm font-medium text-white">{isComparisonMode ? '对比模式' : getStatusText()}</span>
            </div>

            {isComparisonMode && (
              <button
                onClick={() => { clearComparisonSelection(); onClose(); }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="清除对比"
              >
                <XCircle className="w-4 h-4 text-white" />
              </button>
            )}

            <button
              onClick={handleToggleFullscreen}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title={isFullscreen ? '退出全屏' : '全屏'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 text-white" />
              ) : (
                <Maximize2 className="w-5 h-5 text-white" />
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="关闭"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {taskStatus === 'processing' && (
            <div className="p-8 flex flex-col items-center justify-center gap-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'rgba(20, 115, 230, 0.1)' }}>
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#1473E6' }} />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-white">正在生成中...</p>
                <p className="text-sm text-gray-400">请稍候，这可能需要一些时间</p>
              </div>
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>生成进度</span>
                  <span className="font-bold" style={{ color: '#1473E6' }}>{progress}%</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: '#2D2D2D' }}>
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #1473E6 0%, #9CA3AF 100%)',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {taskStatus === 'failed' && (
            <div className="p-8 flex flex-col items-center justify-center gap-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'rgba(220, 53, 69, 0.1)' }}>
                <XCircle className="w-10 h-10" style={{ color: '#DC3545' }} />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-white">生成失败</p>
                <p className="text-sm text-red-400">{errorMessage || '发生未知错误'}</p>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2"
                  style={{
                    background: 'rgba(220, 53, 69, 0.1)',
                    border: '1px solid rgba(220, 53, 69, 0.3)',
                    color: '#DC3545',
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                  重试
                </button>
              )}
            </div>
          )}

          {(isComparisonMode || (taskStatus === 'completed' && resultUrl)) && (
            <div className={cn(
              'flex-1 overflow-hidden p-6',
              comparisonLayout === 'grid' && items.length > 2 ? 'overflow-y-auto' : ''
            )}>
              {comparisonLayout === 'grid' ? (
                <div className={cn(
                  'grid gap-4 h-full',
                  items.length === 2 ? 'grid-cols-2' : 
                  items.length === 3 ? 'grid-cols-3' : 
                  items.length >= 4 ? 'grid-cols-2' : 'grid-cols-1'
                )}>
                  {items.map((item, index) => (
                    <div key={item.id} className="flex flex-col h-full">
                      {item.resultUrl && (
                        <>
                          {renderMediaContent(item.resultUrl, 'flex-1 w-full object-contain rounded-lg shadow-lg', isVideoUrl(item.resultUrl))}
                          {item.prompt && (
                            <div className="mt-2 p-2 rounded bg-[#252528]">
                              <p className="text-xs text-white/70 line-clamp-2">
                                {item.prompt}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : comparisonLayout === 'horizontal' ? (
                <div className="flex gap-4 h-full overflow-x-auto">
                  {items.map((item, index) => (
                    <div key={item.id} className="flex flex-col flex-shrink-0 w-1/2 h-full">
                      {item.resultUrl && (
                        <>
                          {renderMediaContent(item.resultUrl, 'flex-1 w-full object-contain rounded-lg shadow-lg', isVideoUrl(item.resultUrl))}
                          {item.prompt && (
                            <div className="mt-2 p-2 rounded bg-[#252528]">
                              <p className="text-xs text-white/70 line-clamp-2">
                                {item.prompt}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-4 h-full overflow-y-auto">
                  {items.map((item, index) => (
                    <div key={item.id} className="flex flex-col flex-shrink-0">
                      {item.resultUrl && (
                        <>
                          {renderMediaContent(item.resultUrl, 'w-full max-h-[400px] object-contain rounded-lg shadow-lg', isVideoUrl(item.resultUrl))}
                          {item.prompt && (
                            <div className="mt-2 p-2 rounded bg-[#252528]">
                              <p className="text-xs text-white/70 line-clamp-2">
                                {item.prompt}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {taskStatus === 'completed' && !resultUrl && !isComparisonMode && (
            <div className="p-8 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(40, 167, 69, 0.1)' }}>
                <CheckCircle2 className="w-8 h-8" style={{ color: '#28A745' }} />
              </div>
              <p className="text-white">生成完成，但无预览内容</p>
            </div>
          )}

          {taskStatus === 'idle' && !isComparisonMode && (
            <div className="p-8 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(107, 114, 128, 0.1)' }}>
                {type === 'image' ? (
                  <ImageIcon className="w-8 h-8 text-gray-500" />
                ) : (
                  <VideoIcon className="w-8 h-8 text-gray-500" />
                )}
              </div>
              <p className="text-gray-400">等待生成结果</p>
            </div>
          )}
        </div>

        {(taskStatus === 'completed' && resultUrl && !isComparisonMode) && (
          <div className="flex items-center justify-between px-6 py-4" style={{ background: '#252528', borderTop: '1px solid #3D3D42' }}>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="text-white font-medium">文件就绪</span>
            </div>
            <div className="flex items-center gap-3">
              {onSaveLocal && (
                <button
                  onClick={onSaveLocal}
                  className="px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
                  style={{
                    background: '#2D2D2D',
                    border: '1px solid #4A4A4E',
                    color: '#ABABAB',
                  }}
                >
                  <FolderDown className="w-4 h-4" />
                  保存本地
                </button>
              )}
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
                  style={{
                    background: type === 'image' ? '#6610F2' : '#E91E63',
                    color: 'white',
                  }}
                >
                  <Download className="w-4 h-4" />
                  下载
                </button>
              )}
              {onConfirm && (
                <button
                  onClick={onConfirm}
                  className="px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
                  style={{
                    background: '#9CA3AF',
                    color: 'white',
                  }}
                >
                  {confirmText || '确定'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GenerationResultModal;
