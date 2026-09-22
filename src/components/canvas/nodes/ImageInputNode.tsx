import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { toast } from 'sonner';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import { AICGNodeTopCornerActions } from './AICGNodeShell';
import ImageInputToolbar from './ImageInputToolbar';
import { Upload, Loader2, X, Download, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageInputNodeData } from '@/types/ai-models';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { nodeEventBus } from '@/lib/nodeEventBus';
import {
  persistImportedCanvasFile,
  getCanvasAssetRepositoryForCurrentProject,
} from '@/services/canvas-asset-actions';
import { CANVAS_NODE_BASE_WIDTH } from '@/lib/canvas-node-dimensions';
import { useNodeViewportQuality } from './useNodeViewportQuality';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';

const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/x-icon',
  'image/tiff',
  'image/avif',
  'image/apng',
];
const SUPPORTED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.tiff',
  '.tif',
  '.avif',
  '.apng',
];
const ACCEPT_FORMATS = '.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.ico,.tiff,.tif,.avif,.apng';
const DEFAULT_NODE_WIDTH = CANVAS_NODE_BASE_WIDTH;
const DEFAULT_NODE_HEIGHT = 304;
const MIN_NODE_WIDTH = 280;
const MIN_NODE_HEIGHT = 180;
const MAX_NODE_WIDTH = 944;
const MAX_NODE_HEIGHT = 720;
const MIN_IMAGE_TOOLBAR_WIDTH = 840;
// 图片大小上限：20MB
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getImageDisplaySize = (width?: number, height?: number) => {
  if (!width || !height || width <= 0 || height <= 0) {
    return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
  }

  const fitScale = Math.min(MAX_NODE_WIDTH / width, MAX_NODE_HEIGHT / height, 1);
  let nextWidth = Math.round(width * fitScale);
  let nextHeight = Math.round(height * fitScale);

  if (nextWidth < MIN_NODE_WIDTH || nextHeight < MIN_NODE_HEIGHT) {
    const minScale = Math.min(
      MAX_NODE_WIDTH / width,
      MAX_NODE_HEIGHT / height,
      Math.max(MIN_NODE_WIDTH / width, MIN_NODE_HEIGHT / height)
    );
    nextWidth = Math.round(width * minScale);
    nextHeight = Math.round(height * minScale);
  }

  return {
    width: nextWidth,
    height: nextHeight,
  };
};

const isSupportedImageFormat = (file: File): boolean => {
  if (SUPPORTED_IMAGE_FORMATS.includes(file.type)) return true;
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.includes(extension);
};

const getSupportedFormatsString = (): string =>
  'JPG, PNG, GIF, WebP, SVG, BMP, ICO, TIFF, AVIF, APNG';

const readImageDimensions = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // SVG 可能没有固有尺寸，使用默认值
      const width = image.naturalWidth || 512;
      const height = image.naturalHeight || 512;
      resolve({ width, height });
    };
    image.onerror = () => reject(new Error('Image load failed'));
    image.src = src;
  });

// 使用 Canvas API 压缩图片，对大尺寸图片限制最大宽度并转为 JPEG（保留透明通道的 PNG 除外）
const compressImage = (file: File, maxWidth = 2048, quality = 0.85): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // PNG 保留透明通道，其他格式统一转 JPEG 压缩
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => resolve(blob || file),
          outputType,
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
};

const ImageInputNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as any as ImageInputNodeData;
  const updateNodeData = canvasStoreApi.updateNodeData;
  const reactFlowInstance = useReactFlow();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const lastRestoreAttemptRef = useRef<string | null>(null);
  // 标记 imageUrl 是否由本地 setSafeImageUrl 更新，避免 useEffect 双重同步竞态
  const isLocalUpdate = useRef(false);
  const { viewportZoom, isPreviewMode, isCompactMode } = useNodeViewportQuality();

  const flipHorizontal = nodeData.flipHorizontal ?? false;
  const imageUrl = typeof nodeData.imageUrl === 'string' && !nodeData.imageUrl.startsWith('blob:') ? nodeData.imageUrl : '';
  const originalImageUrl = typeof nodeData.originalImageUrl === 'string' && !nodeData.originalImageUrl.startsWith('blob:') ? nodeData.originalImageUrl : '';
  const compareSource = originalImageUrl && nodeData.isProcessed ? originalImageUrl : null;
  const hasImage = Boolean(imageUrl);
  const isPromptAnalysis = Boolean(
    nodeData.analysisOnly || nodeData.analysisMode === 'prompt_generate'
  );
  const analysisResult =
    typeof nodeData.analysisResult === 'string' ? nodeData.analysisResult.trim() : '';
  const displayFileName = nodeData.fileName || '未命名图片';
  const displaySize =
    nodeData.width && nodeData.height ? `${nodeData.width} × ${nodeData.height}` : '';
  const previewSize = getImageDisplaySize(nodeData.width, nodeData.height);
  const imageSizeToolbarScale = clamp(
    1 - ((previewSize.width - MIN_NODE_WIDTH) / (MAX_NODE_WIDTH - MIN_NODE_WIDTH)) * 0.18,
    0.82,
    1
  );
  const viewportToolbarScale = clamp(1 / Math.max(viewportZoom, 0.18), 0.78, 1.45);
  const toolbarScale = clamp(imageSizeToolbarScale * viewportToolbarScale, 0.78, 1.45);
  const toolbarOffset = Math.round(-96 * toolbarScale);
  const toolbarWidth = Math.max(previewSize.width, MIN_IMAGE_TOOLBAR_WIDTH);

  const restoreImageAsset = useCallback(async () => {
    if (!nodeData.imageAssetId) return false;
    try {
      const repo = getCanvasAssetRepositoryForCurrentProject();
      const restoredUrl = await repo.resolveRuntimeUrl(nodeData.imageAssetId);
      if (!restoredUrl) {
        // 恢复失败时提示用户并清除失效的 assetId
        toast.error('图片恢复失败，请重新上传');
        isLocalUpdate.current = true;
        updateNodeData(id as string, { imageAssetId: undefined });
        return false;
      }
      isLocalUpdate.current = true;
      updateNodeData(id as string, { imageUrl: restoredUrl, imageError: false });
      return true;
    } catch (error) {
      console.warn('[ImageInputNode] 从资产库恢复图片失败:', error);
      return false;
    }
  }, [id, nodeData.imageAssetId, updateNodeData]);

  useEffect(() => {
    let mounted = true;

    const fixOldBlobUrl = async () => {
      if (!mounted) return;

      // 如果 imageUrl 由本地代码更新，跳过本次同步以避免竞态
      if (isLocalUpdate.current) {
        isLocalUpdate.current = false;
        return;
      }

      const imageUrl = nodeData.imageUrl;
      const imageAssetId = nodeData.imageAssetId;

      if (imageAssetId && !imageUrl) {
        const restored = await restoreImageAsset();
        if (mounted && restored) return;
      }

      if (imageUrl?.startsWith('blob:')) {
        if (imageAssetId) {
          const restored = await restoreImageAsset();
          if (mounted && restored) return;
        }

        isLocalUpdate.current = true;
        updateNodeData(id as string, {
          imageAssetId: undefined,
          imageUrl: '',
          fileName: '',
          originalImageUrl: '',
          processingMode: 'none',
          isProcessed: false,
          width: undefined,
          height: undefined,
          imageError: false,
        });
      }
    };

    fixOldBlobUrl();
    return () => {
      mounted = false;
    };
  }, [id, nodeData.imageAssetId, nodeData.imageUrl, restoreImageAsset, updateNodeData]);

  const processImageFile = useCallback(
    async (file: File) => {
      if (isProcessing) return;

      if (!isSupportedImageFormat(file)) {
        toast.error('不支持的图片格式！', {
          description: `支持：${getSupportedFormatsString()}`,
        });
        return;
      }

      // 文件大小校验，避免大文件导致崩溃
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error(`图片大小不能超过 ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
        return;
      }

      try {
        setIsProcessing(true);

        // 对大图片进行压缩处理，减小内存占用
        let processedFile: File = file;
        try {
          const compressedBlob = await compressImage(file);
          // 仅在压缩后体积更小时采用压缩结果
          if (compressedBlob.size < file.size) {
            const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            processedFile = new File([compressedBlob], file.name, { type: outputType });
          }
        } catch (compressError) {
          console.warn('[ImageInputNode] 图片压缩失败，使用原图:', compressError);
        }

        const base64Url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('FileReader failed'));
          reader.readAsDataURL(processedFile);
        });

        const imageDimensions = await readImageDimensions(base64Url).catch(() => ({
          width: undefined,
          height: undefined,
        }));

        setShowCompare(false);

        // 新图片上传时重置恢复尝试标记，允许后续恢复流程正常工作
        lastRestoreAttemptRef.current = null;

        let imageAssetId: string | undefined;
        let finalUrl = base64Url;

        try {
          const persisted = await persistImportedCanvasFile({
            nodeId: id as string,
            kind: 'image',
            file: processedFile,
            role: 'primary',
            source: 'imported',
          });
          imageAssetId = persisted.asset.id;
          if (persisted.runtimeUrl && !persisted.runtimeUrl.startsWith('blob:')) {
            finalUrl = persisted.runtimeUrl;
          }
        } catch (persistError) {
          console.warn('[ImageInputNode] 图片持久化失败，使用 Base64:', persistError);
        }

        isLocalUpdate.current = true;
        updateNodeData(id as string, {
          imageAssetId,
          imageUrl: finalUrl,
          fileName: file.name,
          processingMode: 'none',
          isProcessed: false,
          originalImageUrl: '',
          imageError: false,
          width: imageDimensions.width,
          height: imageDimensions.height,
          flipHorizontal: false,
        });

        const nextPreviewSize = getImageDisplaySize(imageDimensions.width, imageDimensions.height);
        if (nextPreviewSize.width >= 640 || nextPreviewSize.height >= 420) {
          setTimeout(() => {
            try {
              reactFlowInstance.fitView({
                nodes: [{ id }],
                padding: 0.5,
                duration: 500,
                includeHiddenNodes: false,
              });
            } catch (fitViewError) {
              void fitViewError;
            }
          }, 100);
        }
      } catch (error) {
        console.error('[ImageInputNode] 图片处理失败:', error);
        toast.error('图片处理失败，请重试');
      } finally {
        setIsProcessing(false);
      }
    },
    [id, isProcessing, reactFlowInstance, updateNodeData]
  );

  const handleImageChange = useCallback(async () => {
    if (isProcessing) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT_FORMATS;
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await processImageFile(file);
    };
    input.click();
  }, [isProcessing, processImageFile]);

  const handleDownload = useCallback(() => {
    if (!nodeData.imageUrl) {
      toast.info('请先上传图片');
      return;
    }
    const imageUrl = nodeData.imageUrl;
    // blob: 与 data: URL 可直接下载；跨域 URL 通过后端代理下载
    const downloadUrl = imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')
      ? imageUrl
      : `${API_BASE_URL}/image/proxy-download?url=${encodeURIComponent(imageUrl)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = nodeData.fileName || `image-${Date.now()}.png`;
    link.click();
  }, [nodeData.imageUrl, nodeData.fileName]);

  const handleFlip = useCallback(() => {
    if (!nodeData.imageUrl) {
      toast.info('请先上传图片');
      return;
    }
    updateNodeData(id as string, { flipHorizontal: !flipHorizontal });
  }, [flipHorizontal, id, nodeData.imageUrl, updateNodeData]);

  const handleExpand = useCallback(() => {
    if (!nodeData.imageUrl) {
      toast.info('请先上传图片');
      return;
    }
    setShowPreview(true);
  }, [nodeData.imageUrl]);

  const handleAnalyzePrompt = useCallback(async () => {
    if (!imageUrl) {
      toast.info('请先上传图片');
      return;
    }
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/image/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          imageUrl,
          model: 'qwen-vl-plus',
          analysisMode: 'prompt_generate',
          language: 'zh',
          outputDetail: 'detailed',
          maxTokens: 1024,
          temperature: 0.3,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || '图片分析失败');
      }
      const analysisResult = String(
        payload.analysis || payload.result || payload.text || ''
      ).trim();
      if (!analysisResult) throw new Error('图片分析未返回提示词');
      updateNodeData(id as string, {
        analysisResult,
        outputText: analysisResult,
        prompt: analysisResult,
        task: { status: 'completed', progress: 100 },
      });
      syncDownstreamFromNode(id as string);
      toast.success('图片提示词已生成');
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片分析失败';
      updateNodeData(id as string, { task: { status: 'failed', error: message } });
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [id, imageUrl, isAnalyzing, updateNodeData]);

  const handleDropImage = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      if (isProcessing) return;
      const files = Array.from(event.dataTransfer.files);
      const file = files.find(isSupportedImageFormat);
      if (!file) {
        if (files.length > 0) {
          toast.error('拖入的文件不是支持的图片格式', {
            description: `支持：${getSupportedFormatsString()}`,
          });
        }
        return;
      }
      await processImageFile(file);
    },
    [isProcessing, processImageFile]
  );

  // 支持粘贴板上传图片
  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (isProcessing) return;
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void processImageFile(file);
            break;
          }
        }
      }
    },
    [isProcessing, processImageFile]
  );

  const handleCompareToggle = useCallback(() => {
    if (!compareSource) {
      setShowCompare(false);
      toast.info('处理前后对比需先通过抠图等工具生成原图副本');
      return;
    }
    setShowCompare((v) => !v);
  }, [compareSource]);

  const handleDeleteNode = useCallback(() => {
    // 删除节点前通知事件总线，让下游节点能感知并清理引用
    nodeEventBus.emitNodeDeleted(id as string);
    canvasStoreApi.deleteNode(id as string);
  }, [id]);

  const handlePreviewImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      const naturalWidth = image.naturalWidth || undefined;
      const naturalHeight = image.naturalHeight || undefined;
      // 仅在缺失尺寸或加载出错后恢复时才更新，避免每次加载都覆盖已有尺寸导致多余渲染
      const needsUpdate =
        nodeData.imageError ||
        (!nodeData.width && naturalWidth) ||
        (!nodeData.height && naturalHeight);
      if (!needsUpdate) return;
      updateNodeData(id as string, {
        imageError: false,
        width: naturalWidth,
        height: naturalHeight,
      });
    },
    [id, nodeData.imageError, nodeData.width, nodeData.height, updateNodeData]
  );

  const handlePreviewImageError = useCallback(() => {
    updateNodeData(id as string, { imageError: true });
    if (!nodeData.imageAssetId) return;
    const restoreKey = `${nodeData.imageAssetId}:${nodeData.imageUrl || ''}`;
    if (lastRestoreAttemptRef.current === restoreKey) return;
    lastRestoreAttemptRef.current = restoreKey;
    void restoreImageAsset();
  }, [id, nodeData.imageAssetId, nodeData.imageUrl, restoreImageAsset, updateNodeData]);

  // 全屏预览时支持 Escape 键关闭
  useEffect(() => {
    if (!showPreview) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setShowPreview(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showPreview]);

  return (
    <div
      className={cn('group relative select-none outline-none', selected && 'rounded-[16px]')}
      style={{ width: previewSize.width }}
      tabIndex={0}
      onPaste={handlePaste}
    >
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="imageInput"
        inputTip="图片输入"
        outputId="imageOutput"
        extraOutputs={isPromptAnalysis ? ['prompt'] : undefined}
        outputTip="图片输出"
      />

      {!isPreviewMode && selected && hasImage && (
        <div
          className="absolute left-1/2 z-40 origin-bottom transition-transform duration-200"
          style={{
            top: toolbarOffset,
            width: toolbarWidth,
            transform: `translateX(-50%) scale(${toolbarScale})`,
          }}
        >
          <ImageInputToolbar
            nodeId={id as string}
            hasImage={hasImage}
            onDownload={handleDownload}
            onExpand={handleExpand}
            onCompareToggle={handleCompareToggle}
            compareActive={showCompare && Boolean(compareSource)}
            canCompare={Boolean(compareSource)}
            onFlip={handleFlip}
          />
        </div>
      )}

      <div
        className={cn(
          'drag-handle relative overflow-hidden rounded-[15px] border border-white/[0.12] bg-[#101012] shadow-[0_16px_42px_rgba(0,0,0,0.42)] active:cursor-grabbing transition-colors',
          selected
            ? 'border-white/28 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_18px_50px_rgba(0,0,0,0.48)]'
            : 'hover:border-white/22',
          isDragOver && 'border-white/55 ring-2 ring-white/22'
        )}
        style={{ height: previewSize.height }}
        onDoubleClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isDragOver) setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          setIsDragOver(false);
        }}
        onDrop={handleDropImage}
      >
        <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-1.5 text-[13px] font-medium text-white/72">
          <span className="text-[14px] leading-none">▣</span>
          <span>图片节点</span>
        </div>

        {imageUrl ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#101012]">
            {!isCompactMode && showCompare && compareSource ? (
              <div className="grid h-full w-full grid-cols-2 bg-[#101012]">
                {[
                  { label: '原图', src: compareSource },
                  { label: '处理后', src: imageUrl },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="relative flex min-w-0 items-center justify-center border-r border-white/8 last:border-r-0"
                  >
                    <div className="absolute left-3 top-3 z-20 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/78 backdrop-blur">
                      {item.label}
                    </div>
                    <img
                      src={item.src}
                      alt={`${displayFileName} ${item.label}`}
                      draggable={false}
                      onLoad={item.label === '处理后' ? handlePreviewImageLoad : undefined}
                      onError={item.label === '处理后' ? handlePreviewImageError : undefined}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      className={cn(
                        'h-full w-full select-none object-contain',
                        item.label === '处理后' && flipHorizontal && '-scale-x-100',
                        item.label === '处理后' && nodeData.imageError && 'opacity-20'
                      )}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <img
                src={imageUrl}
                alt={displayFileName}
                draggable={false}
                onLoad={handlePreviewImageLoad}
                onError={handlePreviewImageError}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                className={cn(
                  'h-full w-full select-none object-contain',
                  flipHorizontal && '-scale-x-100',
                  nodeData.imageError && 'opacity-20'
                )}
              />
            )}
            {nodeData.imageError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#101012] text-white/55">
                <Upload className="h-9 w-9 opacity-60" strokeWidth={1.8} />
                <span className="text-[13px]">图片加载失败，请重新上传</span>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            disabled={isProcessing}
            onClick={(e) => {
              e.stopPropagation();
              handleImageChange();
            }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 pt-10 bg-[#101012] text-[#E2E8F0] transition-colors hover:bg-[#101012] hover:text-[#E2E8F0] disabled:cursor-wait disabled:opacity-70"
          >
            {isProcessing ? (
              <Loader2 className="h-12 w-12 animate-spin" strokeWidth={1.8} />
            ) : (
              <Upload className="h-10 w-10" strokeWidth={1.8} />
            )}
            <span className="text-xs">
              {isProcessing ? '正在处理图片...' : '点击或拖拽上传图片'}
            </span>
            <span className="text-[10px]">{getSupportedFormatsString()}</span>
          </button>
        )}
        {!isPreviewMode && (
          <>
            <AICGNodeTopCornerActions onDelete={handleDeleteNode} />
            <button
              type="button"
              disabled={isProcessing}
              onClick={(e) => {
                e.stopPropagation();
                handleImageChange();
              }}
              className="nodrag nowheel absolute right-12 top-2 z-30 flex h-7 w-7 items-center justify-center rounded-md bg-black/40 text-white/65 opacity-0 shadow-lg backdrop-blur transition-all hover:bg-white/12 hover:text-white group-hover:opacity-90 disabled:cursor-wait disabled:opacity-65"
              title="上传图片"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-[18px] w-[18px]" strokeWidth={2.1} />
              )}
            </button>
            {isPromptAnalysis && hasImage ? (
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleAnalyzePrompt();
                }}
                className="nodrag nowheel absolute bottom-3 right-3 z-30 flex h-8 items-center gap-1.5 rounded-lg border border-white/14 bg-black/65 px-2.5 text-[10px] font-medium text-white/80 shadow-lg backdrop-blur transition-colors hover:bg-white/12 hover:text-white disabled:cursor-wait disabled:opacity-60"
                title="分析图片并生成提示词"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {isAnalyzing ? '分析中' : '反推提示词'}
              </button>
            ) : null}
          </>
        )}

        <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.035),inset_0_0_0_1px_rgba(255,255,255,0.018)]" />

        {!isPreviewMode && displaySize ? (
          <div className="pointer-events-none absolute bottom-4 left-4 max-w-[52%] opacity-0 transition-opacity group-hover:opacity-100">
            <div className="rounded-[12px] border border-white/8 bg-black/30 px-3 py-2 text-[10px] text-white/35 backdrop-blur-xl">
              {displaySize}
            </div>
          </div>
        ) : null}
      </div>

      {isPromptAnalysis && analysisResult ? (
        <div className="nodrag nowheel mt-2 max-h-36 overflow-y-auto rounded-[12px] border border-white/10 bg-[#101012] px-3 py-2 text-[11px] leading-5 text-white/72">
          {analysisResult}
        </div>
      ) : null}

      {showPreview &&
        imageUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/78 p-8 backdrop-blur-sm"
            onClick={() => setShowPreview(false)}
          >
            <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="absolute -right-3 -top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/85 text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-colors hover:bg-black"
                title="关闭预览"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className="absolute -left-3 -top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/85 text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-colors hover:bg-black"
                title="下载图片"
              >
                <Download className="h-5 w-5" />
              </button>
              <img
                src={imageUrl}
                alt={displayFileName}
                className={cn(
                  'max-h-[82vh] max-w-[86vw] rounded-[18px] border border-white/10 object-contain shadow-[0_24px_80px_rgba(0,0,0,0.55)]',
                  flipHorizontal && '-scale-x-100'
                )}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

ImageInputNode.displayName = 'ImageInputNode';

export default ImageInputNode;
