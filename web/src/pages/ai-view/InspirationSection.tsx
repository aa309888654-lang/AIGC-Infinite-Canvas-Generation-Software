import React, { memo } from 'react';
import {
  Image,
  Sparkles,
  Loader2,
  Maximize2,
  History,
  Copy,
  Zap,
} from 'lucide-react';
import OptimizedImage from '@/components/ui/OptimizedImage';
import { cn } from '@/lib/utils';
import type { InspirationItem } from './types';

interface InspirationCardProps {
  item: InspirationItem;
  isCompactLayout: boolean;
  onGenerate?: (e: React.MouseEvent, item: InspirationItem) => void;
  isGenerating?: boolean;
  isExpanded: boolean;
  onExpand: (id: string) => void;
  onCopyPrompt: (e: React.MouseEvent, item: InspirationItem) => void;
  isCopied: boolean;
}

const InspirationCard = memo(({
  item,
  isCompactLayout,
  onGenerate,
  isGenerating,
  isExpanded,
  onExpand,
  onCopyPrompt,
  isCopied,
}: InspirationCardProps) => {
  return (
    <div
      className={cn(
        'group rounded-2xl border border-white/10 overflow-hidden bg-[#0F1535]/90 hover:shadow-xl hover:shadow-[#10B981]/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer',
        isExpanded && 'ring-2 ring-[#10B981]/30'
      )}
      onClick={() => onExpand(item.id)}
    >
      <div className={cn(
        'relative overflow-hidden',
        isCompactLayout ? 'aspect-square' : 'aspect-[4/3]'
      )}>
        <OptimizedImage
          src={item.src}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          thumbnailSize={600}
          format="webp"
          quality={80}
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="w-12 h-12 bg-elevated/10 backdrop-blur-md rounded-full flex items-center justify-center">
            <Maximize2 size={20} fill="currentColor" strokeWidth={1.5} className="text-white" />
          </div>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-white">{item.title}</p>
          <span className="text-[10px] text-white bg-gray-50/10 px-2 py-0.5 rounded-md font-medium">
            AI提示
          </span>
        </div>
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-gray-800 space-y-2">
            <p className="text-xs text-white leading-relaxed line-clamp-4">
              {item.prompt}
            </p>
            <div className="flex gap-2">
              <button
                onClick={(e) => onCopyPrompt(e, item)}
                className={cn(
                  'flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
                  isCopied
                    ? 'bg-gray-50/10 text-white border border-accent-primary/20'
                    : 'bg-elevated/5 text-white hover:bg-elevated/10 border border-gray-800'
                )}
              >
                {isCopied ? (
                  <>
                    <Zap size={12} fill="currentColor" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy size={12} fill="currentColor" />
                    复制提示词
                  </>
                )}
              </button>
              {onGenerate && (
                <button
                  onClick={(e) => onGenerate(e, item)}
                  disabled={isGenerating}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
                    isGenerating
                      ? 'bg-[#10B981]/50 text-white cursor-wait'
                      : 'bg-[#10B981] text-white hover:bg-[#059669]'
                  )}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      生成
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} fill="currentColor" strokeWidth={1.5} />
                      生成图片
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
        {!isExpanded && (
          <p className="text-[10px] text-white">点击查看AI提示词或生成图片</p>
        )}
      </div>
    </div>
  );
});

InspirationCard.displayName = 'InspirationCard';

export interface InspirationSectionProps {
  isCompactLayout: boolean;
  isVideoMode: boolean;
  importedFolderName: string;
  importedFolderCount: number;
  materialPlacement: 'top' | 'bottom';
  onToggleMaterialPlacement: () => void;
  onUploadClick: () => void;
  uploadingCount: number;
  showUrlInput: boolean;
  onToggleUrlInput: () => void;
  imageUrlInput: string;
  onImageUrlInputChange: (value: string) => void;
  onAddImageFromUrl: () => void;
  onUrlKeyPress: (e: React.KeyboardEvent) => void;
  onLoadShowcaseImages: () => void;
  isLoadingShowcase: boolean;
  onBatchGenerate: () => void;
  isBatchGenerating: boolean;
  images: InspirationItem[];
  onGenerate: (e: React.MouseEvent, item: InspirationItem) => void;
  generatingId: string | null;
  expandedId: string | null;
  onExpand: (id: string) => void;
  onCopyPrompt: (e: React.MouseEvent, item: InspirationItem) => void;
  copiedId: string | null;
}

const InspirationSection = memo(({
  isCompactLayout,
  isVideoMode,
  importedFolderName,
  importedFolderCount,
  materialPlacement,
  onToggleMaterialPlacement,
  onUploadClick: _onUploadClick,
  uploadingCount: _uploadingCount,
  showUrlInput,
  onToggleUrlInput,
  imageUrlInput,
  onImageUrlInputChange,
  onAddImageFromUrl,
  onUrlKeyPress,
  onLoadShowcaseImages,
  isLoadingShowcase,
  onBatchGenerate,
  isBatchGenerating,
  images,
  onGenerate,
  generatingId,
  expandedId,
  onExpand,
  onCopyPrompt,
  copiedId,
}: InspirationSectionProps) => {
  void _onUploadClick;
  void _uploadingCount;
  void isVideoMode;

  return (
    <div
      className={cn(
        'mb-8',
        isCompactLayout &&
          'rounded-2xl border border-gray-800 bg-gray-950/80 p-4'
      )}
    >
      <div
        className={cn(
          'mb-5 flex justify-between gap-4',
          isCompactLayout ? 'flex-col items-start' : 'items-end'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-gray-50/10 flex items-center justify-center border border-accent-primary/30">
            <History size={20} fill="currentColor" strokeWidth={1.5} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">灵感素材</h3>
            <p className="mt-0.5 text-xs text-white">
              已导入「{importedFolderName}」中的 {importedFolderCount} 张图
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {isCompactLayout && (
            <button
              onClick={onToggleMaterialPlacement}
              className="inline-flex items-center justify-center rounded-full border border-gray-800 bg-gray-950/80 px-3 py-1.5 text-[11px] font-medium text-white transition-all hover:border-accent-primary/30 hover:bg-gray-50/10 hover:text-white"
            >
              {materialPlacement === 'top' ? '素材移到底部' : '素材移到上方'}
            </button>
          )}

          <button
            onClick={onLoadShowcaseImages}
            disabled={isLoadingShowcase}
            className="inline-flex items-center justify-center rounded-full border border-accent-primary/30 bg-elevated px-3.5 py-1.5 text-[11px] font-medium text-white transition-all hover:bg-gray-50/10 disabled:opacity-50 disabled:cursor-not-allowed gap-1.5"
          >
            {isLoadingShowcase ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                加载中.
              </>
            ) : (
              <>
                <Image size={14} strokeWidth={1.5} />
                加载示例
              </>
            )}
          </button>
          <button
            onClick={onBatchGenerate}
            disabled={isBatchGenerating}
            className="inline-flex items-center justify-center rounded-full bg-[#10B981] px-3.5 py-1.5 text-[11px] font-medium text-white transition-all hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed gap-1.5"
          >
            {isBatchGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                生成中..
              </>
            ) : (
              <>
                <Sparkles size={14} fill="currentColor" strokeWidth={1.5} />
                AI生成
              </>
            )}
          </button>
        </div>
      </div>
      {showUrlInput && (
        <div className="mb-4 p-3 bg-elevated rounded-lg border border-accent-primary/30">
          <div className="flex gap-2">
            <input
              type="text"
              value={imageUrlInput}
              onChange={(e) => onImageUrlInputChange(e.target.value)}
              onKeyPress={onUrlKeyPress}
              placeholder="请输入图片链接，例如: https://example.com/image.jpg"
              className="flex-1 px-3 py-2 text-xs border border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
            />
            <button
              onClick={onAddImageFromUrl}
              className="px-4 py-2 bg-[#10B981] text-white text-xs font-medium rounded-lg hover:bg-gray-50/20 transition-colors"
            >
              添加
            </button>
            <button
              onClick={() => {
                onToggleUrlInput();
                onImageUrlInputChange('');
              }}
              className="px-3 py-2 bg-elevated/5 text-white text-xs font-medium rounded-lg hover:bg-elevated/10 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className={cn('grid gap-4', isCompactLayout ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4')}>
        {images.map((item) => (
          <InspirationCard
            key={item.id}
            item={item}
            isCompactLayout={isCompactLayout}
            onGenerate={onGenerate}
            isGenerating={generatingId === item.id}
            isExpanded={expandedId === item.id}
            onExpand={onExpand}
            onCopyPrompt={onCopyPrompt}
            isCopied={copiedId === item.id}
          />
        ))}
      </div>
    </div>
  );
});

InspirationSection.displayName = 'InspirationSection';

export default InspirationSection;
