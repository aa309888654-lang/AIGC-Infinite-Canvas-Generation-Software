/**
 * 统一文件管理组件 v2.0
 * 完整修复：缩略图显示、文件大小、加载状态
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useFileStore } from '@/store/useFileStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { useMembershipStore } from '@/store/useMembershipStore';
import { useAppPanelStore } from '@/store/useAppPanelStore';
import { getDefaultStorageLimit } from '@/config/membership-storage';
import { logger } from '@/lib/logger';
import { File, Image, Video, Music, FileText, Trash2, Grid, List, Search, Star, Clock, Folder, X, Download, Copy, Loader2, Workflow, ZoomIn, ZoomOut, Maximize2, Minimize2, ExternalLink, PenLine, HardDrive, RotateCcw, Play, UserRound, Archive, Mic, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, getProxiedImageUrl, safeOpen } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { transformLocalhostUrl } from '@/lib/api-config';
import { importItemsToClipTimeline } from '@/services/canvas-clip-bridge-service';
import type { FileItem } from '@/types/ai-models';
import {
  buildCanvasNodeFromAsset,
  buildClipImportItemFromAsset,
  buildTimelineDragPayload,
} from '@/services/unified-asset-workflow';

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'date' | 'size' | 'type';
type FileTab =
  | 'all'
  | 'project'
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'workflow'
  | 'subject'
  | 'character'
  | 'favorite'
  | 'recent'
  | 'trash';

interface UnifiedFileManagerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: FileTab;
}

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <Image className="w-5 h-5" />,
  video: <Video className="w-5 h-5" />,
  audio: <Music className="w-5 h-5" />,
  text: <PenLine className="w-5 h-5" />,
  document: <FileText className="w-5 h-5" />,
  workflow: <Workflow className="w-5 h-5" />,
  default: <File className="w-5 h-5" />,
};

const TABS: { id: FileTab; label: string; icon: React.ReactNode }[] = [
  { id: 'project', label: '项目素材', icon: <Folder className="w-4 h-4" /> },
  { id: 'all', label: '全部资产', icon: <Archive className="w-4 h-4" /> },
  { id: 'image', label: '图片历史', icon: <Image className="w-4 h-4" /> },
  { id: 'video', label: '视频历史', icon: <Video className="w-4 h-4" /> },
  { id: 'audio', label: '音频历史', icon: <Music className="w-4 h-4" /> },
  { id: 'text', label: '文本历史', icon: <PenLine className="w-4 h-4" /> },
  { id: 'workflow', label: '工作流', icon: <Workflow className="w-4 h-4" /> },
  { id: 'subject', label: '主体库', icon: <Archive className="w-4 h-4" /> },
  { id: 'character', label: '角色库', icon: <UserRound className="w-4 h-4" /> },
  { id: 'favorite', label: '收藏', icon: <Star className="w-4 h-4" /> },
  { id: 'recent', label: '最近', icon: <Clock className="w-4 h-4" /> },
  { id: 'trash', label: '回收站', icon: <Trash2 className="w-4 h-4" /> },
];

/**
 * 格式化文件大小
 */
function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化日期
 */
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function decodeDisplayFilename(value: string): string {
  if (!value || [...value].some((char) => char.charCodeAt(0) > 255)) return value;
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from([...value], (char) => char.charCodeAt(0))
    );
    return /[\u3400-\u9fff]/.test(decoded) ? decoded : value;
  } catch {
    return value;
  }
}

/**
 * 文件缩略图组件 v4
 * 支持从 VideoStorage 恢复视频，并显示缩略图和文件大小
 * 修复了超时处理、内存泄漏和 CORS 问题
 */
interface FileManagerFile {
  id: string;
  name: string;
  url?: string;
  type: string;
  size?: number;
  thumbnailUrl?: string;
  mimeType?: string;
  path?: string;
  createdAt?: string;
  isFavorite?: boolean;
  isDeleted?: boolean;
  source?: string;
  duration?: number;
  textContent?: string;
  textTitle?: string;
  workflowName?: string;
  nodeId?: string;
  sourceType?: string;
}

interface ThumbnailPreviewProps {
  file: FileManagerFile;
  compact?: boolean;
}

function canAddFileToClipTimeline(file: FileManagerFile): boolean {
  return Boolean(file.url) && (file.type === 'image' || file.type === 'video' || file.type === 'audio');
}

function canAddFileToCanvas(file: FileManagerFile): boolean {
  return file.type === 'text' || canAddFileToClipTimeline(file);
}

function getAssetCategory(file: FileItem | FileManagerFile): string {
  const metadata = 'metadata' in file ? file.metadata : undefined;
  return String(metadata?.category || '').toLowerCase();
}

function getAssetSourceType(file: FileItem | FileManagerFile): string {
  return String('sourceType' in file ? file.sourceType || '' : '').toLowerCase();
}

type MediaCandidate = string | Record<string, unknown> | null | undefined;

function extractMediaUrl(candidate: MediaCandidate): string {
  if (!candidate) return '';
  if (typeof candidate === 'string') return candidate;
  return String(
    candidate.url ||
    candidate.resultUrl ||
    candidate.imageUrl ||
    candidate.outputImageUrl ||
    candidate.thumbnailUrl ||
    candidate.cosUrl ||
    ''
  );
}

function extractMediaName(candidate: MediaCandidate, fallback: string): string {
  if (!candidate || typeof candidate === 'string') return fallback;
  const name = candidate.name || candidate.fileName || candidate.filename || candidate.title;
  return typeof name === 'string' && name.trim() ? name : fallback;
}

function extractMediaSize(candidate: MediaCandidate, fallbackUrl: string): number {
  if (candidate && typeof candidate === 'object') {
    const rawSize = candidate.size || candidate.fileSize;
    const size = typeof rawSize === 'number' ? rawSize : Number(rawSize || 0);
    if (Number.isFinite(size) && size > 0) return size;
  }
  return fallbackUrl?.length || 0;
}

function extractThumbnailUrl(candidate: MediaCandidate): string {
  if (!candidate || typeof candidate === 'string') return '';
  return String(candidate.thumbnailUrl || candidate.thumbUrl || candidate.previewUrl || '');
}

function resolveMediaUrl(url?: string): string {
  if (!url) return '';
  return getProxiedImageUrl(transformLocalhostUrl(url));
}

const ThumbnailPreview: React.FC<ThumbnailPreviewProps> = ({ file, compact = false }) => {
  const [error, setError] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef(true);
  const urlRef = useRef<string>('');
  const isLoadingRef = useRef(false);
  const thumbnailUrlRef = useRef('');

  const generateThumbnailFromUrl = useCallback((url: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!mountedRef.current) {
        resolve();
        return;
      }

      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      if (url.startsWith('http://') || url.startsWith('https://')) {
        video.crossOrigin = 'anonymous';
      }

      const TIMEOUT_MS = 8000;
      const timeoutId = setTimeout(() => {
        handleError();
      }, TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(timeoutId);
        video.src = '';
        video.load();
      };

      const handleSuccess = (dataUrl?: string) => {
        cleanup();
        if (mountedRef.current && dataUrl) {
          setThumbnailUrl(dataUrl);
          thumbnailUrlRef.current = dataUrl;
        }
        resolve();
      };

      const handleError = () => {
        cleanup();
        if (mountedRef.current) {
          setError(true);
        }
        resolve();
      };

      video.onloadedmetadata = () => {
        try {
          video.currentTime = Math.min(1, video.duration * 0.1);
        } catch {
          // ignore
        }
      };

      video.onseeked = () => {
        try {
          if (video.videoWidth > 0 && mountedRef.current) {
            const canvas = document.createElement('canvas');
            const aspectRatio = video.videoWidth / video.videoHeight;
            const maxWidth = 320;
            const maxHeight = 180;

            let width: number, height: number;
            if (aspectRatio > maxWidth / maxHeight) {
              width = maxWidth;
              height = Math.round(maxWidth / aspectRatio);
            } else {
              height = maxHeight;
              width = Math.round(maxHeight * aspectRatio);
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
              handleSuccess(dataUrl);
              return;
            }
          }
          handleError();
        } catch {
          handleError();
        }
      };

      video.onerror = () => {
        handleError();
      };

      video.onabort = () => {
        resolve();
      };

      try {
        video.src = url;
        video.load();
      } catch {
        handleError();
      }
    });
  }, []);

  const loadVideoThumbnail = useCallback(async () => {
    if (isLoadingRef.current || thumbnailUrlRef.current) return;

    const currentUrl = resolveMediaUrl(file.url);

    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      if (file.thumbnailUrl) {
        if (mountedRef.current) {
          setThumbnailUrl(file.thumbnailUrl);
          thumbnailUrlRef.current = file.thumbnailUrl;
          setIsLoading(false);
        }
        isLoadingRef.current = false;
        return;
      }

      if (
        currentUrl &&
        (currentUrl.startsWith('blob:') ||
          currentUrl.startsWith('data:') ||
          currentUrl.startsWith('http://') ||
          currentUrl.startsWith('https://'))
      ) {
        await generateThumbnailFromUrl(currentUrl);
        if (mountedRef.current) {
          setIsLoading(false);
        }
        isLoadingRef.current = false;
        return;
      }

      if (currentUrl && currentUrl.startsWith('blob:')) {
        if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).videoStorage) {
          const videoData = await ((window as unknown as Record<string, unknown>).videoStorage as { getVideo: (id: string) => Promise<{ blob: Blob } | null> }).getVideo(file.id);
          if (videoData && videoData.blob && mountedRef.current) {
            const restoredUrl = URL.createObjectURL(videoData.blob);
            await generateThumbnailFromUrl(restoredUrl);
            setTimeout(() => {
              try {
                URL.revokeObjectURL(restoredUrl);
              } catch {
                // ignore
              }
            }, 1000);
            if (mountedRef.current) {
              setIsLoading(false);
            }
            isLoadingRef.current = false;
            return;
          }
        }
      }

      if (mountedRef.current) {
        setError(true);
        setIsLoading(false);
      }
      isLoadingRef.current = false;
    } catch {
      if (mountedRef.current) {
        setError(true);
        setIsLoading(false);
      }
      isLoadingRef.current = false;
    }
  }, [file.id, file.url, file.thumbnailUrl, generateThumbnailFromUrl]);

  useEffect(() => {
    mountedRef.current = true;
    urlRef.current = file.url;
    setError(false);
    setImagePreviewIndex(0);

    if (file.type === 'video') {
      loadVideoThumbnail();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [file.id, file.url, file.thumbnailUrl, file.type, loadVideoThumbnail]);

  // 图片类型 - 优先使用缩略图，并对本地/跨域地址做归一化；失败时回退到原图/缩略图备用地址
  if (file.type === 'image' && (file.thumbnailUrl || file.url) && !error) {
    const imageCandidates = [file.thumbnailUrl, file.url]
      .filter((url): url is string => Boolean(url))
      .map(resolveMediaUrl)
      .filter(Boolean);
    const previewUrl = imageCandidates[Math.min(imagePreviewIndex, imageCandidates.length - 1)];

    return (
      <div className="aspect-square overflow-hidden bg-black/20">
        <img
          src={previewUrl}
          alt={file.name}
          className="w-full h-full object-cover"
          onError={() => {
            if (imagePreviewIndex < imageCandidates.length - 1) {
              setImagePreviewIndex((index) => index + 1);
              return;
            }
            setError(true);
          }}
          loading="lazy"
        />
      </div>
    );
  }

  // 视频类型 - 显示缩略图或播放图标
  if (file.type === 'video') {
    const containerClass = compact
      ? 'w-full h-full overflow-hidden bg-black/20 relative'
      : 'aspect-square overflow-hidden bg-black/20 relative';

    // 如果有缩略图，显示缩略图
    if (thumbnailUrl) {
      return (
        <div className={containerClass}>
          <img
            src={thumbnailUrl}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={() => {
              setThumbnailUrl('');
              setError(true);
            }}
          />
          {/* 播放图标覆盖 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <div className={cn(
              'rounded-full bg-black/60 flex items-center justify-center border border-white/10',
              compact ? 'w-6 h-6' : 'w-10 h-10'
            )}>
              <svg className={cn('text-white ml-0.5', compact ? 'w-3 h-3' : 'w-5 h-5')} fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      );
    }

    // 如果正在加载，显示加载动画
    if (isLoading) {
      return (
        <div className={cn(containerClass, 'flex items-center justify-center')}>
          <Loader2 className={cn('text-gray-500 animate-spin', compact ? 'w-5 h-5' : 'w-8 h-8')} />
        </div>
      );
    }

    // 尝试显示 video 元素作为降级方案
    if (file.url && !thumbnailUrl && !error) {
      return (
        <div className={containerClass}>
          <video
            ref={videoRef}
            src={resolveMediaUrl(file.url)}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
            crossOrigin={resolveMediaUrl(file.url).startsWith('http') ? 'anonymous' : undefined}
            onLoadedData={() => {
              const video = videoRef.current;
              const canvas = canvasRef.current;
              if (video && canvas && video.videoWidth > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
                try {
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                  setThumbnailUrl(dataUrl);
                } catch (e) {
                  console.warn('[ThumbnailPreview] 无法生成缩略图（CORS限制）:', e);
                  setError(true);
                }
              }
            }}
            onError={() => {
              console.warn('[ThumbnailPreview] 视频元素加载失败:', file.name);
              setError(true);
            }}
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className={cn(
              'rounded-full bg-black/60 flex items-center justify-center border border-white/10',
              compact ? 'w-6 h-6' : 'w-10 h-10'
            )}>
              <svg className={cn('text-white ml-0.5', compact ? 'w-3 h-3' : 'w-5 h-5')} fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      );
    }

    // 出错时退回播放图标，点击仍可打开视频预览弹窗
    return (
      <div className={cn(containerClass, 'flex items-center justify-center')}>
        <div className="absolute inset-0 bg-black/10" />
        <Video className={cn('relative z-[1] text-gray-500', compact ? 'w-5 h-5' : 'w-8 h-8')} />
        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center justify-center gap-1 text-white/80">
            <Play className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
            {!compact && <span className="text-[11px]">点击播放</span>}
          </div>
        </div>
      </div>
    );
  }

  // 音频类型 - 显示音频波形图标
  if (file.type === 'audio') {
    return (
      <div className="aspect-square overflow-hidden bg-gradient-to-br from-[#9B59B6]/20 to-[#1A1A1D] relative flex flex-col items-center justify-center gap-2">
        <Music className="w-10 h-10 text-[#9B59B6]/70" />
        <div className="flex items-end gap-[2px] h-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="w-[3px] bg-[#9B59B6]/50 rounded-full"
              style={{ height: `${Math.random() * 20 + 6}px` }}
            />
          ))}
        </div>
        {file.duration && (
          <span className="text-[10px] text-gray-400 mt-1">
            {Math.floor(file.duration / 60)}:
            {String(Math.floor(file.duration % 60)).padStart(2, '0')}
          </span>
        )}
      </div>
    );
  }

  // 文字/歌词类型 - 显示文字预览
  if (file.type === 'text') {
    const previewText = file.textContent || '';
    const lines = previewText.split('\n').slice(0, 6);
    return (
      <div className="aspect-square overflow-hidden bg-gradient-to-br from-[#2196F3]/20 to-[#1A1A1D] relative flex flex-col items-center justify-center gap-2 p-3">
        <PenLine className="w-6 h-6 text-[#2196F3]/70" />
        <div className="w-full text-[9px] text-gray-400 leading-tight line-clamp-6 text-center overflow-hidden">
          {lines.map((line: string, i: number) => (
            <p key={i} className="truncate">
              {line || '\u00A0'}
            </p>
          ))}
        </div>
      </div>
    );
  }

  // 错误或其他类型 - 显示文件类型图标
  return (
    <div className="aspect-square flex items-center justify-center bg-black/20">
      <div className="text-gray-500">{FILE_TYPE_ICONS[file.type] || FILE_TYPE_ICONS.default}</div>
    </div>
  );
};

export const UnifiedFileManager: React.FC<UnifiedFileManagerProps> = ({
  isOpen,
  onClose,
  initialTab = 'all',
}) => {
  const {
    files,
    deleteFile,
    clearFiles,
    fetchCloudFiles,
    softDeleteCloudFile,
    restoreCloudFile,
    permanentlyDeleteCloudFile,
    isLoadingCloudFiles,
  } = useFileStore();
  const { addNode } = useCanvasStore();
  const { nodes } = useCanvasStore();
  const { membership } = useMembershipStore();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState(initialTab);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  // 云空间信息
  const storageUsed = membership?.storageUsed || 0;
  const storageLimit =
    membership?.storageLimit ?? getDefaultStorageLimit(membership?.membershipLevel);
  const storagePercent =
    storageLimit > 0 ? Math.min(100, Math.round((storageUsed / storageLimit) * 100)) : 0;

  const getCloudFetchOptions = useCallback(
    (tab: FileTab): { type?: string; onlyDeleted?: boolean } => {
      if (tab === 'trash') return { onlyDeleted: true };
      if (tab === 'project' || tab === 'subject' || tab === 'character') return {};
      if (tab === 'image' || tab === 'video' || tab === 'audio' || tab === 'text' || tab === 'workflow') {
        return { type: tab };
      }
      return {};
    },
    []
  );

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'warning',
    onConfirm: () => { /* noop */ },
  });

  // 图片预览状态
  const [imagePreview, setImagePreview] = useState<{
    isOpen: boolean;
    file: FileManagerFile | null;
    zoomLevel: number;
  }>({
    isOpen: false,
    file: null,
    zoomLevel: 1,
  });

  // 视频预览状态
  const [videoPreview, setVideoPreview] = useState<{
    isOpen: boolean;
    file: FileManagerFile | null;
    isPlaying: boolean;
  }>({
    isOpen: false,
    file: null,
    isPlaying: false,
  });

  const [audioPreview, setAudioPreview] = useState<{
    isOpen: boolean;
    file: FileManagerFile | null;
    isPlaying: boolean;
  }>({
    isOpen: false,
    file: null,
    isPlaying: false,
  });

  const [textPreview, setTextPreview] = useState<{
    isOpen: boolean;
    file: FileManagerFile | null;
  }>({
    isOpen: false,
    file: null,
  });

  const [workflowRefreshKey, setWorkflowRefreshKey] = useState(0); // 用于刷新工作流列表

  // 从画布节点收集素材文件（核心修复）
  const canvasFiles = useMemo(() => {
    const collected: FileManagerFile[] = [];

    for (const node of nodes) {
      if (!node?.data) continue;
      const data = node.data as Record<string, unknown>;
      const d = (key: string): unknown => data[key];
      const ds = (key: string): string => (data[key] as string) || '';
      const dn = (key: string): number => (data[key] as number) || 0;
      const nodeType = ds('type') || node.type || '';

      // 图片输入节点
      if ((nodeType === 'imageInput' || nodeType === 'image-input') && d('imageUrl')) {
        collected.push({
          id: `canvas_${node.id}_image`,
          name: ds('fileName') || `image_${node.id}.png`,
          type: 'image',
          url: ds('imageUrl'),
          size: ds('imageUrl')?.length || 0,
          createdAt: new Date().toISOString(),
          source: 'canvas',
          nodeId: node.id,
          sourceType: 'imageInput',
        });
      }

      // 视频输入节点
      if ((nodeType === 'videoInput' || nodeType === 'video-input') && d('videoUrl')) {
        collected.push({
          id: `canvas_${node.id}_video`,
          name: ds('fileName') || `video_${node.id}.mp4`,
          type: 'video',
          url: ds('videoUrl'),
          size: 0,
          createdAt: new Date().toISOString(),
          source: 'canvas',
          nodeId: node.id,
          sourceType: 'videoInput',
          duration: dn('duration'),
        });
      }

      // 图片生成节点结果
      if (
        (
          nodeType === 'imageGen' ||
          nodeType === 'unifiedImageStudio' ||
          nodeType === 'aicgImageGen' ||
          nodeType === 'aiImage' ||
          nodeType === 'localMatting' ||
          nodeType === 'image-gen' ||
          nodeType === 'ImageGen'
        )
      ) {
        const taskData = d('task') as Record<string, unknown> | undefined;
        const rawResultUrls = d('resultUrls') || d('images') || d('imageUrls') || taskData?.resultUrls || taskData?.images;
        const rawResults = Array.isArray(rawResultUrls)
          ? rawResultUrls
          : [
              d('resultUrl'),
              d('imageUrl'),
              d('outputImageUrl'),
              d('resultImageUrl'),
              d('cosUrl'),
              taskData?.resultUrl,
              taskData?.imageUrl,
              taskData?.outputImageUrl,
            ];
        const results = rawResults
          .map((item) => ({
            raw: item as MediaCandidate,
            url: extractMediaUrl(item as MediaCandidate),
          }))
          .filter((item) => item.url);

        for (let i = 0; i < results.length; i++) {
          const item = results[i];
          collected.push({
            id: `canvas_${node.id}_result_${i}`,
            name: extractMediaName(item.raw, `gen_${node.id}_${i + 1}.png`),
            type: 'image',
            url: item.url,
            thumbnailUrl: extractThumbnailUrl(item.raw) || ds('thumbnailUrl'),
            size: extractMediaSize(item.raw, item.url),
            createdAt: ds('generatedAt') || (taskData?.updatedAt as string) || new Date().toISOString(),
            source: 'canvas',
            nodeId: node.id,
            sourceType: nodeType,
          });
        }
      }

      // 视频生成节点结果
      if (
        nodeType === 'videoGen' ||
        nodeType === 'advancedVideoGen' ||
        nodeType === 'aicgVideoGen' ||
        nodeType === 'aiVideo' ||
        nodeType === 'video-gen' ||
        nodeType === 'VideoGen'
      ) {
        const taskData = d('task') as Record<string, unknown> | undefined;
        const videoUrl = (taskData?.resultUrl as string) || ds('resultUrl');
        if (videoUrl) {
          collected.push({
            id: `canvas_${node.id}_video_result`,
            name: `video_${node.id}.mp4`,
            type: 'video',
            url: videoUrl,
            size: 0,
            createdAt: new Date().toISOString(),
            source: 'canvas',
            nodeId: node.id,
            sourceType: nodeType,
          });
        }
      }

      // 音频生成节点结果
      if (nodeType === 'audioGen' || nodeType === 'audio-gen' || nodeType === 'AudioGen') {
        const taskData = d('task') as Record<string, unknown> | undefined;
        const audioUrl = ds('audioUrl') || (taskData?.resultUrl as string) || ds('resultUrl');
        if (audioUrl) {
          collected.push({
            id: `canvas_${node.id}_audio_result`,
            name: ds('songTitle') || ds('fileName') || `audio_${node.id}.mp3`,
            type: 'audio',
            url: audioUrl,
            size: 0,
            createdAt: ds('audioGeneratedAt') || new Date().toISOString(),
            source: 'canvas',
            nodeId: node.id,
            sourceType: 'audioGen',
            duration: dn('duration'),
          });
        }
        if (d('lyricsContent')) {
          const lyricsContent = ds('lyricsContent');
          const lyricsTitle = ds('lyricsTitle');
          collected.push({
            id: `canvas_${node.id}_lyrics_result`,
            name: lyricsTitle ? `${lyricsTitle}.txt` : `lyrics_${node.id}.txt`,
            type: 'text',
            url: '',
            size: lyricsContent.length,
            createdAt: ds('lyricsGeneratedAt') || new Date().toISOString(),
            source: 'canvas',
            nodeId: node.id,
            sourceType: 'audioGen',
            textContent: lyricsContent,
            textTitle: lyricsTitle,
          });
        }
      }

      // AI助手节点 / 文本节点中的文字内容
      if (
        nodeType === 'textInput' ||
        nodeType === 'text-input' ||
        nodeType === 'aiGenText'
      ) {
        const textContent = d('textContent') || d('text') || d('content') || d('response') || d('outputText');
        if (textContent && typeof textContent === 'string' && textContent.trim().length > 0) {
          const textName = ds('title') || ds('name') || `text_${node.id}.txt`;
          collected.push({
            id: `canvas_${node.id}_text_result`,
            name: textName.endsWith('.txt') ? textName : `${textName}.txt`,
            type: 'text',
            url: '',
            size: textContent.length,
            createdAt: ds('generatedAt') || new Date().toISOString(),
            source: 'canvas',
            nodeId: node.id,
            sourceType: nodeType,
            textContent,
          });
        }
      }
      if (nodeType === 'videoInput' && d('videoUrl')) {
        collected.push({
          id: `canvas_${node.id}_video_input`,
          name: ds('fileName') || `input_video_${node.id}.mp4`,
          type: 'video',
          url: ds('videoUrl'),
          size: 0,
          createdAt: new Date().toISOString(),
          source: 'canvas',
          nodeId: node.id,
          sourceType: 'videoInput',
        });
      }
    }

    return collected;
  }, [nodes]);

  // 收集保存的工作流文件
  const workflowFiles = useMemo(() => {
    void workflowRefreshKey;
    const { getSavedWorkflows } = useWorkflowStore.getState();
    const workflows = getSavedWorkflows();

    return workflows.map((wf) => ({
      id: `workflow_${wf.name}`,
      name: `${wf.name}.json`,
      type: 'workflow',
      url: '',
      size: JSON.stringify(wf).length,
      createdAt: wf.date,
      source: 'saved_workflow',
      sourceType: 'workflow',
      workflowName: wf.name,
      workflowDate: wf.date,
    }));
  }, [workflowRefreshKey]); // 使用 refreshKey 触发刷新

  // 刷新工作流列表
  const refreshWorkflows = useCallback(() => {
    setWorkflowRefreshKey((prev) => prev + 1);
    logger.debug('[FileManager] 🔄 已刷新工作流列表');
  }, []);

  const handleRefreshFiles = useCallback(() => {
    if (activeTab === 'workflow') {
      refreshWorkflows();
    }
    fetchCloudFiles(getCloudFetchOptions(activeTab));
  }, [activeTab, fetchCloudFiles, getCloudFetchOptions, refreshWorkflows]);

  // 初始加载云端文件
  useEffect(() => {
    if (isOpen) {
      fetchCloudFiles(getCloudFetchOptions(activeTab));
    }
  }, [isOpen, activeTab, fetchCloudFiles, getCloudFetchOptions]);

  // 加载收藏和最近访问
  useEffect(() => {
    try {
      const stored = localStorage.getItem('file-favorites');
      if (stored) {
        setFavorites(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.error('加载收藏失败:', e);
    }

    try {
      const stored = localStorage.getItem('recent-files');
      if (stored) {
        setRecentFiles(JSON.parse(stored));
      }
    } catch (e) {
      console.error('加载最近访问失败:', e);
    }
  }, []);

  const toggleFavorite = useCallback((fileId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      localStorage.setItem('file-favorites', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const addToRecent = useCallback((fileId: string) => {
    setRecentFiles((prev) => {
      const next = [fileId, ...prev.filter((id) => id !== fileId)].slice(0, 20);
      localStorage.setItem('recent-files', JSON.stringify(next));
      return next;
    });
  }, []);

  const filteredFiles = useMemo(() => {
    // 合并画布节点收集的文件和手动添加/生成的文件，优先保留 store 中更完整的记录。
    const allFiles = [...files, ...canvasFiles].map((file) => ({
      ...file,
      name: decodeDisplayFilename(file.name),
    }));

    // 去重：同一个媒体 URL 可能同时来自画布节点和生成文件记录。
    const seen = new Set<string>();
    const deduped = allFiles.filter((f) => {
      const key = f.url ? `${f.type}:${f.url}` : `id:${f.id}`;
      const fileFingerprint = `${f.type}:${f.name.trim().toLocaleLowerCase()}:${f.size || 0}`;
      if (seen.has(f.id) || seen.has(key) || seen.has(fileFingerprint)) return false;
      seen.add(f.id);
      seen.add(key);
      seen.add(fileFingerprint);
      return true;
    });

    let result = deduped;

    if (activeTab === 'trash') {
      result = allFiles.filter((f) => f.source === 'cloud' && f.isDeleted);
    } else {
      result = result.filter((f) => !f.isDeleted);
    }

    // 按标签筛选
    if (activeTab === 'project') {
      result = result.filter((f) => f.source === 'canvas' || f.source === 'saved_workflow');
    } else if (activeTab === 'image') {
      result = result.filter((f) => f.type === 'image');
    } else if (activeTab === 'video') {
      result = result.filter((f) => f.type === 'video');
    } else if (activeTab === 'audio') {
      result = result.filter((f) => f.type === 'audio');
    } else if (activeTab === 'text') {
      result = result.filter((f) => f.type === 'text');
    } else if (activeTab === 'workflow') {
      result = workflowFiles;
    } else if (activeTab === 'subject') {
      result = result.filter((f) => {
        const category = getAssetCategory(f);
        const sourceType = getAssetSourceType(f);
        const name = f.name.toLowerCase();
        return category.includes('subject') || category.includes('主体') || sourceType.includes('character') || name.includes('主体') || name.includes('商品') || name.includes('场景');
      });
    } else if (activeTab === 'character') {
      result = result.filter((f) => {
        const category = getAssetCategory(f);
        const sourceType = getAssetSourceType(f);
        const name = f.name.toLowerCase();
        return category.includes('character') || category.includes('角色') || sourceType.includes('character') || name.includes('角色') || name.includes('人物');
      });
    } else if (activeTab === 'favorite') {
      result = result.filter((f) => favorites.has(f.id));
    } else if (activeTab === 'recent') {
      result = result.filter((f) => recentFiles.includes(f.id));
      result.sort((a, b) => recentFiles.indexOf(a.id) - recentFiles.indexOf(b.id));
    } else if (activeTab === 'trash') {
      result = result.filter((f) => f.source === 'cloud' && f.isDeleted);
    }

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(query));
    }

    // 排序
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'size':
          return (b.size || 0) - (a.size || 0);
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });

    return result;
  }, [files, canvasFiles, workflowFiles, activeTab, searchQuery, sortBy, favorites, recentFiles]);

  const previewImageFiles = useMemo(
    () => filteredFiles.filter((file) => file.type === 'image' && Boolean(file.url)),
    [filteredFiles]
  );

  const currentImagePreviewIndex = useMemo(() => {
    if (!imagePreview.file) return -1;
    return previewImageFiles.findIndex((file) => file.id === imagePreview.file?.id);
  }, [imagePreview.file, previewImageFiles]);

  const switchImagePreview = useCallback(
    (direction: -1 | 1) => {
      if (!previewImageFiles.length) return;
      const currentIndex = currentImagePreviewIndex >= 0 ? currentImagePreviewIndex : 0;
      const nextIndex = (currentIndex + direction + previewImageFiles.length) % previewImageFiles.length;
      setImagePreview({ isOpen: true, file: previewImageFiles[nextIndex], zoomLevel: 1 });
      addToRecent(previewImageFiles[nextIndex].id);
    },
    [addToRecent, currentImagePreviewIndex, previewImageFiles]
  );

  const handleFileClick = useCallback(
    (file: FileManagerFile) => {
      addToRecent(file.id);
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        if (next.has(file.id)) {
          next.delete(file.id);
        } else {
          next.add(file.id);
        }
        return next;
      });
    },
    [addToRecent]
  );

  const handleFileDoubleClick = useCallback(
    (file: FileManagerFile) => {
      // 图片文件 - 打开预览模态框
      if (file.type === 'image' && file.url) {
        setImagePreview({
          isOpen: true,
          file,
          zoomLevel: 1,
        });
        return;
      }

      // 视频文件 - 打开视频预览模态框
      if (file.type === 'video' && file.url) {
        setVideoPreview({
          isOpen: true,
          file,
          isPlaying: false,
        });
        return;
      }

      // 音频文件 - 打开音频预览模态框
      if (file.type === 'audio' && file.url) {
        setAudioPreview({
          isOpen: true,
          file,
          isPlaying: false,
        });
        return;
      }

      // 文字/歌词文件 - 打开文字预览模态框
      if (file.type === 'text') {
        setTextPreview({
          isOpen: true,
          file,
        });
        return;
      }

      // 工作流文件 - 加载工作流
      if (file.type === 'workflow' && file.workflowName) {
        const { loadWorkflow } = useWorkflowStore.getState();
        setConfirmDialog({
          isOpen: true,
          title: '加载工作流',
          message: `确定要加载工作流 "${file.workflowName}" 吗？\n\n当前画布将被替换。`,
          variant: 'info',
          onConfirm: () => {
            loadWorkflow(file.workflowName);
            logger.info(`[FileManager] ✅ 已加载工作流: ${file.workflowName}`);
            onClose();
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          },
        });
        return;
      }

      const newNode = buildCanvasNodeFromAsset(file, {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      });
      if (!newNode) return;
      addNode(newNode);
      onClose();
    },
    [addNode, onClose]
  );

  const handleDownloadFile = useCallback((file: FileManagerFile) => {
    if (!file.url) return;
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToRecent(file.id);
  }, [addToRecent]);

  const handleAddFileToCanvas = useCallback(
    (file: FileManagerFile) => {
      const newNode = buildCanvasNodeFromAsset(file, {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      });

      if (!newNode) {
        logger.warn('[FileManager] 当前文件暂不支持添加到画布', { name: file.name, type: file.type });
        return;
      }

      addToRecent(file.id);
      addNode(newNode);
      logger.info('[FileManager] 已添加文件到画布节点', { name: file.name, nodeType: newNode.type });
      onClose();
    },
    [addNode, addToRecent, onClose]
  );

  const handleAddFileToTimeline = useCallback(
    async (file: FileManagerFile) => {
      const item = buildClipImportItemFromAsset(file);
      if (!item) {
        logger.warn('[FileManager] 当前文件暂不支持添加到 AI 剪辑', { name: file.name, type: file.type });
        return;
      }

      const count = await importItemsToClipTimeline([item]);
      addToRecent(file.id);
      logger.info(`[FileManager] 已添加 ${count} 个文件到 AI 剪辑时间线`, { name: file.name });
    },
    [addToRecent]
  );

  /** 将文件发送到 AI 面板（配音/音乐） */
  const handleSendToAIPanel = useCallback(
    (file: FileManagerFile, panel: 'dubbing' | 'music') => {
      const { setAIDubbingOpen, setMusicGenerationOpen } = useAppPanelStore.getState();

      // 将文件信息暂存到 sessionStorage，供 AI 面板读取
      const assetContext = {
        fileId: file.id,
        fileName: file.name,
        fileUrl: file.url,
        fileType: file.type,
        thumbnailUrl: file.thumbnailUrl,
      };
      sessionStorage.setItem('ai_panel_asset_context', JSON.stringify(assetContext));

      switch (panel) {
        case 'dubbing':
          setAIDubbingOpen(true);
          break;
        case 'music':
          setMusicGenerationOpen(true);
          break;
      }

      addToRecent(file.id);
      logger.info(`[FileManager] 已发送文件到 AI 面板`, { name: file.name, panel });
    },
    [addToRecent]
  );

  const handleAddSelectedToTimeline = useCallback(async () => {
    const items = [...selectedFiles]
      .map((id) => filteredFiles.find((file) => file.id === id))
      .filter((file): file is FileManagerFile => Boolean(file))
      .map(buildClipImportItemFromAsset)
      .filter((item): item is NonNullable<ReturnType<typeof buildClipImportItemFromAsset>> => Boolean(item));

    if (items.length === 0) {
      logger.warn('[FileManager] 没有可添加到 AI 剪辑时间线的媒体文件');
      return;
    }

    const count = await importItemsToClipTimeline(items);
    logger.info(`[FileManager] 已添加 ${count} 个文件到 AI 剪辑时间线`);
    setSelectedFiles(new Set());
  }, [filteredFiles, selectedFiles]);

  const executeDelete = useCallback(
    (
      filesToDelete: Set<string>,
      workflows: FileManagerFile[],
      delFile: (id: string) => void,
      softDelete: (id: string) => Promise<boolean>,
      refreshWF: () => void,
      setSelFiles: React.Dispatch<React.SetStateAction<Set<string>>>,
      refreshCloudFiles: () => void
    ) => {
      let hasWorkflowDeleted = false;

      Promise.all(
        [...filesToDelete].map(async (id) => {
        const file = [...useFileStore.getState().files, ...workflows].find((f) => f.id === id);
        if (file?.type === 'workflow' && file.workflowName) {
          const { deleteWorkflow } = useWorkflowStore.getState();
          deleteWorkflow(file.workflowName);
          logger.info(`[FileManager] 🗑️ 已删除工作流: ${file.workflowName}`);
          hasWorkflowDeleted = true;
        } else if (file?.source === 'cloud') {
          await softDelete(id);
        } else {
          delFile(id);
        }
        })
      ).finally(() => {
        if (hasWorkflowDeleted) {
          refreshWF();
        }

        refreshCloudFiles();
        setSelFiles(new Set());
      });
    },
    []
  );

  const handleDeleteSelected = useCallback(() => {
    const workflowNamesToDelete: string[] = [];

    selectedFiles.forEach((id) => {
      const file = [...useFileStore.getState().files, ...workflowFiles].find((f) => f.id === id);
      if (file?.type === 'workflow' && file.workflowName) {
        workflowNamesToDelete.push(file.workflowName);
      }
    });

    if (workflowNamesToDelete.length > 0) {
      const workflowList = workflowNamesToDelete.map((name) => `• ${name}`).join('\n');
      setConfirmDialog({
        isOpen: true,
        title: '删除工作流',
        message: `确定要删除以下 ${workflowNamesToDelete.length} 个工作流吗？\n\n${workflowList}\n\n此操作不可撤销！`,
        variant: 'danger',
        onConfirm: () => {
          executeDelete(
            selectedFiles,
            workflowFiles,
            deleteFile,
            softDeleteCloudFile,
            refreshWorkflows,
            setSelectedFiles,
            handleRefreshFiles
          );
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
      return;
    }

    executeDelete(
      selectedFiles,
      workflowFiles,
      deleteFile,
      softDeleteCloudFile,
      refreshWorkflows,
      setSelectedFiles,
      handleRefreshFiles
    );
  }, [selectedFiles, workflowFiles, deleteFile, softDeleteCloudFile, refreshWorkflows, handleRefreshFiles, executeDelete]);

  const handleRestoreSelected = useCallback(async () => {
    await Promise.all([...selectedFiles].map((id) => restoreCloudFile(id)));
    setSelectedFiles(new Set());
    handleRefreshFiles();
  }, [selectedFiles, restoreCloudFile, handleRefreshFiles]);

  const handlePermanentDeleteSelected = useCallback(async () => {
    await Promise.all([...selectedFiles].map((id) => permanentlyDeleteCloudFile(id)));
    setSelectedFiles(new Set());
    handleRefreshFiles();
  }, [selectedFiles, permanentlyDeleteCloudFile, handleRefreshFiles]);

  const handleClearAll = useCallback(() => {
    clearFiles();
    setSelectedFiles(new Set());
  }, [clearFiles]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (imagePreview.isOpen) {
        if (event.key === 'Escape') {
          setImagePreview((prev) => ({ ...prev, isOpen: false }));
          return;
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          switchImagePreview(-1);
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          switchImagePreview(1);
          return;
        }
      }
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imagePreview.isOpen, isOpen, onClose, switchImagePreview]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative bg-[#151518]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden border border-white/10 backdrop-blur-xl transition-all duration-200',
          isExpanded
            ? 'w-[min(1600px,calc(100vw-48px))] h-[min(920px,calc(100vh-72px))] max-w-[calc(100vw-48px)] max-h-[calc(100vh-72px)] rounded-2xl'
            : 'w-[1180px] h-[640px] max-w-[calc(100vw-48px)] max-h-[84vh] rounded-2xl'
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Folder className="w-5 h-5 text-[#007AFF]" />
            <h2 className="text-lg font-semibold text-white">文件管理</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsExpanded((value) => !value)}
              aria-label={isExpanded ? '还原文件管理' : '扩大文件管理'}
              title={isExpanded ? '还原' : '扩大'}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <Minimize2 className="w-5 h-5 text-gray-400" />
              ) : (
                <Maximize2 className="w-5 h-5 text-gray-400" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭文件管理"
              title="关闭"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 标签栏 */}
        <div className="border-b border-white/10 bg-black/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/8 bg-black/20 p-1.5">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedFiles(new Set());
                  }}
                  className={cn(
                    'group relative flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all duration-200 outline-none sm:h-9 sm:gap-2 sm:px-3 sm:text-sm',
                    'focus-visible:ring-2 focus-visible:ring-[#007AFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#151518]',
                    isActive
                      ? 'bg-[#007AFF] text-white shadow-[0_8px_24px_rgba(0,122,255,0.28)]'
                      : 'text-white/52 hover:bg-white/[0.07] hover:text-white'
                  )}
                  aria-pressed={isActive}
                  title={tab.label}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-md transition-colors sm:h-6 sm:w-6',
                      isActive ? 'bg-white/18 text-white' : 'bg-white/[0.04] text-white/44 group-hover:bg-white/10 group-hover:text-white/82'
                    )}
                  >
                    {tab.icon}
                  </span>
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedFiles(new Set(filteredFiles.map((f) => f.id)));
                  } else {
                    setSelectedFiles(new Set());
                  }
                }}
                className="w-4 h-4 rounded border-gray-500"
              />
              全选
            </label>
            <span className="text-xs text-gray-500">({filteredFiles.length} 个文件)</span>
          </div>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文件..."
              className="w-full pl-10 pr-4 py-2 bg-[#2D2D2D] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#007AFF]"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 bg-[#2D2D2D] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#007AFF]"
          >
            <option value="name">按名称</option>
            <option value="date">按日期</option>
            <option value="size">按大小</option>
            <option value="type">按类型</option>
          </select>
          <div className="flex border border-white/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'grid'
                  ? 'bg-[#007AFF] text-white'
                  : 'bg-[#2D2D2D] text-gray-400 hover:text-white'
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'list'
                  ? 'bg-[#007AFF] text-white'
                  : 'bg-[#2D2D2D] text-gray-400 hover:text-white'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleRefreshFiles}
            disabled={isLoadingCloudFiles}
            className="px-3 py-2 bg-[#2D2D2D] border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:border-[#007AFF] transition-colors flex items-center gap-2"
            title="刷新列表"
          >
            <Loader2 className={cn('w-4 h-4', isLoadingCloudFiles && 'animate-spin')} />
            刷新
          </button>
        </div>

        {/* 批量操作栏 */}
        {selectedFiles.size > 0 && (
          <div className="flex items-center gap-4 px-4 py-3 bg-[#007AFF]/10 border-t border-white/10">
            <span className="text-sm text-white">已选择 {selectedFiles.size} 个文件</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleAddSelectedToTimeline()}
                className="px-3 py-1 bg-[#10B981] hover:bg-[#0EA472] rounded text-xs text-white transition-colors"
              >
                添加到 AI 剪辑
              </button>
              {activeTab === 'trash' ? (
                <>
                  <button
                    onClick={handleRestoreSelected}
                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-xs text-white transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    恢复
                  </button>
                  <button
                    onClick={handlePermanentDeleteSelected}
                    className="px-3 py-1 bg-[#EF4444] hover:bg-[#DC2626] rounded text-xs text-white transition-colors"
                  >
                    永久删除
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDeleteSelected}
                  className="px-3 py-1 bg-[#EF4444] hover:bg-[#DC2626] rounded text-xs text-white transition-colors"
                >
                  删除
                </button>
              )}
              <button
                onClick={() => setSelectedFiles(new Set())}
                className="px-3 py-1 bg-[#3A3A3A] hover:bg-[#4A4A4A] rounded text-xs text-white transition-colors"
              >
                取消选择
              </button>
            </div>
          </div>
        )}

        {/* 文件列表 */}
        <div className="flex-1 overflow-auto p-4">
          {filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              {activeTab === 'workflow' ? (
                <>
                  <Workflow className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-sm">暂无保存的工作流</p>
                  <p className="text-xs mt-2">在画布上设计工作流后，使用 Ctrl+S 保存</p>
                </>
              ) : activeTab === 'trash' ? (
                <>
                  <Trash2 className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-sm">回收站为空</p>
                  <p className="text-xs mt-2">删除的云端文件会先进入回收站，可恢复或永久删除</p>
                </>
              ) : activeTab === 'text' ? (
                <>
                  <PenLine className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-sm">暂无文字内容</p>
                  <p className="text-xs mt-2">生成歌词或使用AI助手后，文字内容会自动保存在此处</p>
                </>
              ) : (
                <>
                  <Folder className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-sm">暂无文件</p>
                  <p className="text-xs mt-2">拖拽文件到此处或点击上传</p>
                </>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* 网格视图 */
            <div className="grid grid-cols-4 gap-4">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  draggable={canAddFileToClipTimeline(file)}
                  onDragStart={(e) => {
                    const payload = buildTimelineDragPayload(file);
                    if (!payload) {
                      e.preventDefault();
                      return;
                    }
                    e.dataTransfer.setData(
                      'application/json',
                      JSON.stringify(payload)
                    );
                    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                    e.dataTransfer.effectAllowed = 'copy';
                    logger.debug('[FileManager] 开始拖拽文件', { name: file.name, type: file.type });
                  }}
                  onClick={() => handleFileClick(file)}
                  onDoubleClick={() => handleFileDoubleClick(file)}
                  className={cn(
                    'group relative bg-[#2D2D2D] rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-[#007AFF]/50',
                    selectedFiles.has(file.id) && 'ring-2 ring-[#007AFF]',
                    canAddFileToClipTimeline(file) && 'cursor-grab active:cursor-grabbing'
                  )}
                  title={canAddFileToClipTimeline(file) ? `拖拽到 AI 剪辑: ${file.name}` : file.name}
                >
                  {/* 拖拽指示器 */}
                  {file.source === 'cloud' ? (
                    <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 bg-[#007AFF]/80 backdrop-blur-md rounded text-[10px] text-white flex items-center gap-1 border border-white/10">
                      <HardDrive className="w-2.5 h-2.5" />
                      云端
                    </div>
                  ) : (
                    canAddFileToClipTimeline(file) && (
                      <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/60 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        拖拽剪辑
                      </div>
                    )
                  )}
                  {file.isDeleted && (
                    <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-red-500/80 rounded text-[10px] text-white">
                      已删除
                    </div>
                  )}

                  {/* 缩略图 */}
                  <ThumbnailPreview file={file} />

                  {/* 文件信息 */}
                  <div className="p-2">
                    <p className="text-xs text-white truncate font-medium" title={file.name}>
                      {file.name}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span
                        className="text-xs text-gray-400"
                        title={`文件大小: ${formatFileSize(file.size)}`}
                      >
                        {formatFileSize(file.size)}
                      </span>
                      <span className="text-xs text-gray-600">{file.type?.toUpperCase()}</span>
                    </div>
                    <div
                      className="mt-1 text-xs text-gray-500 truncate"
                      title={`生成时间: ${formatDate(file.createdAt)}`}
                    >
                      {formatDate(file.createdAt)}
                    </div>
                  </div>

                  {(file.type === 'image' || canAddFileToCanvas(file) || canAddFileToClipTimeline(file)) && (
                    <div className="flex items-center gap-1 px-2 pb-2">
                      {file.type === 'image' && file.url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadFile(file);
                          }}
                          className="inline-flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded bg-[#F59E0B]/80 px-1 text-[11px] text-white hover:bg-[#D97706] transition-colors"
                          title="下载图片"
                        >
                          <Download className="w-3 h-3" />
                          下载
                        </button>
                      )}
                      {canAddFileToCanvas(file) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddFileToCanvas(file);
                          }}
                          className="inline-flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1 text-[11px] text-white hover:bg-white/20 transition-colors"
                          title="添加为画布节点"
                        >
                          <Workflow className="w-3 h-3" />
                          画布
                        </button>
                      )}
                      {canAddFileToClipTimeline(file) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleAddFileToTimeline(file);
                          }}
                          className="inline-flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded bg-[#10B981]/80 px-1 text-[11px] text-white hover:bg-[#0EA472] transition-colors"
                          title="添加到 AI 剪辑时间线"
                        >
                          <Play className="w-3 h-3" />
                          剪辑
                        </button>
                      )}
                      {/* AI 面板快捷发送 */}
                      {file.type === 'audio' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSendToAIPanel(file, 'dubbing'); }}
                          className="inline-flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded bg-[#8B5CF6]/80 px-1 text-[11px] text-white hover:bg-[#7C3AED] transition-colors"
                          title="发送到 AI 配音"
                        >
                          <Mic className="w-3 h-3" />
                          配音
                        </button>
                      )}
                      {file.type === 'audio' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSendToAIPanel(file, 'music'); }}
                          className="inline-flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded bg-[#F59E0B]/80 px-1 text-[11px] text-white hover:bg-[#D97706] transition-colors"
                          title="发送到 AI 音乐"
                        >
                          <Music className="w-3 h-3" />
                          音乐
                        </button>
                      )}
                    </div>
                  )}

                  {/* 收藏按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(file.id);
                    }}
                    className={cn(
                      'absolute top-2 right-2 p-1 rounded-full transition-all',
                      favorites.has(file.id)
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-black/50 text-gray-400 opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <Star
                      className="w-3 h-3"
                      fill={favorites.has(file.id) ? 'currentColor' : 'none'}
                    />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            /* 列表视图 */
            <div className="space-y-1">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  draggable={canAddFileToClipTimeline(file)}
                  onDragStart={(e) => {
                    const payload = buildTimelineDragPayload(file);
                    if (!payload) {
                      e.preventDefault();
                      return;
                    }
                    e.dataTransfer.setData(
                      'application/json',
                      JSON.stringify(payload)
                    );
                    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                    e.dataTransfer.effectAllowed = 'copy';
                    logger.debug('[FileManager] 开始拖拽文件', { name: file.name, type: file.type });
                  }}
                  onClick={() => handleFileClick(file)}
                  onDoubleClick={() => handleFileDoubleClick(file)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                    selectedFiles.has(file.id)
                      ? 'bg-[#007AFF]/10 text-white'
                      : 'hover:bg-white/5 text-gray-300',
                    canAddFileToClipTimeline(file) && 'cursor-grab active:cursor-grabbing'
                  )}
                  title={canAddFileToClipTimeline(file) ? `拖拽到 AI 剪辑: ${file.name}` : file.name}
                >
                  {/* 缩略图预览（小尺寸） */}
                  <div className="w-10 h-10 flex-shrink-0 overflow-hidden rounded bg-black/20">
                    {(file.type === 'image' || file.type === 'video') && file.url ? (
                      <ThumbnailPreview file={file} compact />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        {FILE_TYPE_ICONS[file.type] || FILE_TYPE_ICONS.default}
                      </div>
                    )}
                  </div>

                  {/* 文件名 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium" title={file.name}>
                      {file.name}
                    </p>
                  </div>

                  {/* 文件大小 */}
                  <div
                    className="text-xs text-gray-500 w-20 text-right shrink-0"
                    title={`文件大小: ${formatFileSize(file.size)}`}
                  >
                    {formatFileSize(file.size)}
                  </div>

                  {/* 类型 */}
                  <div
                    className="text-xs text-gray-600 w-12 text-right shrink-0 uppercase"
                    title={`类型: ${file.type}`}
                  >
                    {file.type}
                  </div>

                  {/* 生成时间 */}
                  <div
                    className="text-xs text-gray-500 w-28 text-right shrink-0"
                    title={`生成时间: ${formatDate(file.createdAt)}`}
                  >
                    {formatDate(file.createdAt)}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {file.type === 'image' && file.url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFile(file);
                        }}
                        className="inline-flex h-7 w-14 items-center justify-center gap-1 rounded bg-[#06B6D4]/80 px-1 text-[11px] text-white hover:bg-[#0891B2] transition-colors"
                        title="下载图片"
                      >
                        <Download className="w-3 h-3" />
                        下载
                      </button>
                    )}
                    {canAddFileToCanvas(file) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddFileToCanvas(file);
                        }}
                        className="inline-flex h-7 w-14 items-center justify-center gap-1 rounded bg-white/10 px-1 text-[11px] text-white hover:bg-white/20 transition-colors"
                        title="添加为画布节点"
                      >
                        <Workflow className="w-3 h-3" />
                        画布
                      </button>
                    )}
                    {canAddFileToClipTimeline(file) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleAddFileToTimeline(file);
                        }}
                        className="inline-flex h-7 w-14 items-center justify-center gap-1 rounded bg-[#10B981]/80 px-1 text-[11px] text-white hover:bg-[#0EA472] transition-colors"
                        title="添加到 AI 剪辑时间线"
                      >
                        <Play className="w-3 h-3" />
                        剪辑
                      </button>
                    )}
                    {/* AI 面板快捷发送 */}
                    {file.type === 'audio' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSendToAIPanel(file, 'dubbing'); }}
                        className="inline-flex h-7 w-14 items-center justify-center gap-1 rounded bg-[#8B5CF6]/80 px-1 text-[11px] text-white hover:bg-[#7C3AED] transition-colors"
                        title="发送到 AI 配音"
                      >
                        <Mic className="w-3 h-3" />
                        配音
                      </button>
                    )}
                    {file.type === 'audio' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSendToAIPanel(file, 'music'); }}
                        className="inline-flex h-7 w-14 items-center justify-center gap-1 rounded bg-[#F59E0B]/80 px-1 text-[11px] text-white hover:bg-[#D97706] transition-colors"
                        title="发送到 AI 音乐"
                      >
                        <Music className="w-3 h-3" />
                        音乐
                      </button>
                    )}
                  </div>

                  {/* 收藏按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(file.id);
                    }}
                    className={cn(
                      'p-1 rounded transition-colors',
                      favorites.has(file.id) ? 'text-yellow-400' : 'text-gray-500 hover:text-white'
                    )}
                  >
                    <Star
                      className="w-4 h-4"
                      fill={favorites.has(file.id) ? 'currentColor' : 'none'}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-[#121214]">
          <div className="flex flex-col gap-2">
            <div className="text-sm text-gray-400">
              共 <span className="text-white font-medium">{files.length}</span> 个文件， 已选择{' '}
              <span className="text-[#007AFF] font-medium">{selectedFiles.size}</span> 个
            </div>
            {/* 云存储进度条 */}
            <div className="flex flex-col gap-1 w-48">
              <div className="flex items-center justify-between text-[10px] text-gray-500">
                <div className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  <span>
                    云空间: {formatFileSize(storageUsed)} / {formatFileSize(storageLimit)}
                  </span>
                </div>
                <span>{storagePercent}%</span>
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-500 rounded-full',
                    storagePercent > 90
                      ? 'bg-red-500'
                      : storagePercent > 70
                        ? 'bg-yellow-500'
                        : 'bg-[#007AFF]'
                  )}
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedFiles.size > 0 && (
              activeTab === 'trash' ? (
                <>
                  <button
                    onClick={handleRestoreSelected}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="text-sm">恢复选中</span>
                  </button>
                  <button
                    onClick={handlePermanentDeleteSelected}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">永久删除</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm">删除选中</span>
                </button>
              )
            )}
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">清空全部</span>
            </button>
          </div>
        </div>
      </div>

      {/* 确认对话框 - 居中显示，使用软件色系 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={() => confirmDialog.onConfirm()}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* 图片预览模态框 */}
      {imagePreview.isOpen && imagePreview.file && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setImagePreview({ ...imagePreview, isOpen: false })}
        >
          {previewImageFiles.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  switchImagePreview(-1);
                }}
                className="absolute left-6 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white shadow-xl backdrop-blur-md transition-colors hover:bg-white/10"
                title="上一张（←）"
                aria-label="上一张图片"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  switchImagePreview(1);
                }}
                className="absolute right-6 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white shadow-xl backdrop-blur-md transition-colors hover:bg-white/10"
                title="下一张（→）"
                aria-label="下一张图片"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}

          {/* 图片预览区域 - 包含关闭按钮 */}
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: 'zoom-in' }}
          >
            {/* 关闭按钮 - 右上角 */}
            <button
              onClick={() => setImagePreview({ ...imagePreview, isOpen: false })}
              className="absolute -top-12 -right-2 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full transition-colors text-white border border-white/20 z-20"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>

            <img
              src={imagePreview.file.url}
              alt={imagePreview.file.name}
              className="max-w-[90vw] max-h-[85vh] object-contain shadow-2xl rounded-lg"
              style={{
                transform: `scale(${imagePreview.zoomLevel})`,
                transition: 'transform 0.2s ease-out',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setImagePreview((prev) => ({
                  ...prev,
                  zoomLevel: prev.zoomLevel === 1 ? 2 : 1,
                }));
              }}
            />
          </div>

          {/* 控制工具栏 */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-6 py-3 bg-black/80 backdrop-blur-md rounded-full border border-white/10 shadow-xl">
            {/* 缩小按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImagePreview((prev) => ({
                  ...prev,
                  zoomLevel: Math.max(0.5, prev.zoomLevel - 0.25),
                }));
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
              title="缩小"
            >
              <ZoomOut className="w-5 h-5" />
            </button>

            {/* 缩放比例显示 */}
            <div className="px-4 py-1 bg-white/10 rounded-full text-white text-sm font-medium min-w-[80px] text-center">
              {Math.round(imagePreview.zoomLevel * 100)}%
            </div>

            {/* 放大按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImagePreview((prev) => ({
                  ...prev,
                  zoomLevel: Math.min(5, prev.zoomLevel + 0.25),
                }));
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
              title="放大"
            >
              <ZoomIn className="w-5 h-5" />
            </button>

            {/* 分隔线 */}
            <div className="w-px h-6 bg-white/20" />

            {/* 适应屏幕 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImagePreview((prev) => ({ ...prev, zoomLevel: 1 }));
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
              title="适应屏幕"
            >
              <Maximize2 className="w-5 h-5" />
            </button>

            {/* 分隔线 */}
            <div className="w-px h-6 bg-white/20" />

            {/* 下载按钮 (仅限云端文件) */}
            {imagePreview.file.source === 'cloud' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (imagePreview.file.url) {
                    const link = document.createElement('a');
                    link.href = imagePreview.file.url;
                    link.download = imagePreview.file.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                title="下载到本地"
              >
                <Download className="w-5 h-5" />
              </button>
            )}

            {/* 在新窗口打开 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (imagePreview.file.url) {
                  safeOpen(imagePreview.file.url);
                }
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
              title="在新窗口打开"
            >
              <ExternalLink className="w-5 h-5" />
            </button>

            {/* 分隔线 */}
            <div className="w-px h-6 bg-white/20" />

            {/* 云端标识 */}
            {imagePreview.file.source === 'cloud' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#007AFF]/20 rounded-md border border-[#007AFF]/30 mr-1">
                <HardDrive className="w-3.5 h-3.5 text-[#007AFF]" />
                <span className="text-[10px] text-[#007AFF] font-bold uppercase tracking-wider">
                  Cloud
                </span>
              </div>
            )}

            {previewImageFiles.length > 1 && currentImagePreviewIndex >= 0 && (
              <div className="px-2 py-0.5 rounded-md bg-white/10 text-xs font-medium text-white/70">
                {currentImagePreviewIndex + 1}/{previewImageFiles.length}
              </div>
            )}

            {/* 文件名 */}
            <div className="text-white text-sm max-w-[200px] truncate">
              <span className="font-medium">{imagePreview.file.name}</span>
            </div>
            {imagePreview.file.size && (
              <div className="text-gray-400 text-sm">{formatFileSize(imagePreview.file.size)}</div>
            )}
          </div>

          {/* 提示文字 */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-gray-500 text-xs">
            点击图片切换缩放 · ←/→ 切换图片 · ESC 关闭
          </div>
        </div>
      )}

      {/* 视频预览模态框 */}
      {videoPreview.isOpen && videoPreview.file && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setVideoPreview({ ...videoPreview, isOpen: false })}
        >
          {/* 视频预览区域 - 包含关闭按钮 */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            {/* 关闭按钮 - 右上角 */}
            <button
              onClick={() => setVideoPreview({ ...videoPreview, isOpen: false })}
              className="absolute -top-12 -right-2 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full transition-colors text-white border border-white/20 z-20"
              title="关闭 (ESC)"
            >
              <X className="w-5 h-5" />
            </button>

            <video
              key={videoPreview.file.id}
              src={resolveMediaUrl(videoPreview.file.url)}
              autoPlay={videoPreview.isPlaying}
              controls
              loop
              muted={false}
              className="max-w-[90vw] max-h-[85vh] object-contain shadow-2xl rounded-lg"
              onPlay={() => setVideoPreview((prev) => ({ ...prev, isPlaying: true }))}
              onPause={() => setVideoPreview((prev) => ({ ...prev, isPlaying: false }))}
              onClick={(e) => {
                e.stopPropagation();
                const video = e.currentTarget;
                if (video.paused) {
                  video.play();
                } else {
                  video.pause();
                }
              }}
            />
          </div>

          {/* 控制工具栏 */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-6 py-3 bg-black/80 backdrop-blur-md rounded-full border border-white/10 shadow-xl">
            {/* 播放/暂停按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setVideoPreview((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
              title={videoPreview.isPlaying ? '暂停' : '播放'}
            >
              {videoPreview.isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* 分隔线 */}
            <div className="w-px h-6 bg-white/20" />

            {/* 在新窗口打开 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const resolvedUrl = resolveMediaUrl(videoPreview.file.url);
                if (resolvedUrl) {
                  safeOpen(resolvedUrl);
                }
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
              title="下载/在新窗口打开"
            >
              <ExternalLink className="w-5 h-5" />
            </button>

            {/* 分隔线 */}
            <div className="w-px h-6 bg-white/20" />

            {/* 文件名 */}
            <div className="text-white text-sm">
              <span className="font-medium">{videoPreview.file.name}</span>
            </div>
            {videoPreview.file.size && (
              <div className="text-gray-400 text-sm">{formatFileSize(videoPreview.file.size)}</div>
            )}
          </div>

          {/* 提示文字 */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-gray-500 text-xs">
            点击视频可播放/暂停 · 点击背景关闭
          </div>
        </div>
      )}

      {/* 音频预览模态框 */}
      {audioPreview.isOpen && audioPreview.file && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setAudioPreview({ ...audioPreview, isOpen: false })}
        >
          <div
            className="relative bg-[#1A1A1D] rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setAudioPreview({ ...audioPreview, isOpen: false })}
              className="absolute -top-3 -right-3 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full transition-colors text-white border border-white/20 z-20"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-[#9B59B6]/20 flex items-center justify-center">
                <Music className="w-10 h-10 text-[#9B59B6]" />
              </div>

              <div className="text-center">
                <p className="text-white font-medium text-lg truncate max-w-xs">
                  {audioPreview.file.name}
                </p>
                {audioPreview.file.size > 0 && (
                  <p className="text-gray-400 text-sm mt-1">
                    {formatFileSize(audioPreview.file.size)}
                  </p>
                )}
              </div>

              <audio
                key={audioPreview.file.id}
                src={audioPreview.file.url}
                autoPlay={audioPreview.isPlaying}
                controls
                loop
                className="w-full"
                onPlay={() => setAudioPreview((prev) => ({ ...prev, isPlaying: true }))}
                onPause={() => setAudioPreview((prev) => ({ ...prev, isPlaying: false }))}
              />

              <div className="flex gap-3 w-full">
                <a
                  href={audioPreview.file.url}
                  download={audioPreview.file.name}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#9B59B6] hover:bg-[#8E44AD] rounded-lg text-white text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  下载
                </a>
                <button
                  onClick={() => {
                    safeOpen(audioPreview.file.url);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  新窗口打开
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 文字/歌词预览模态框 */}
      {textPreview.isOpen && textPreview.file && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setTextPreview({ ...textPreview, isOpen: false })}
        >
          <div
            className="relative bg-[#1A1A1D] rounded-xl p-8 max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setTextPreview({ ...textPreview, isOpen: false })}
              className="absolute -top-3 -right-3 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full transition-colors text-white border border-white/20 z-20"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col gap-4 overflow-hidden flex-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#2196F3]/20 flex items-center justify-center flex-shrink-0">
                  <PenLine className="w-5 h-5 text-[#2196F3]" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-medium text-lg truncate">
                    {textPreview.file.textTitle || textPreview.file.name}
                  </p>
                  <p className="text-gray-400 text-sm">{textPreview.file.name}</p>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-black/20 rounded-lg p-4 min-h-0">
                <pre className="text-gray-200 text-sm whitespace-pre-wrap font-sans leading-relaxed">
                  {textPreview.file.textContent || '暂无内容'}
                </pre>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const content = textPreview.file.textContent || '';
                    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = textPreview.file.name || 'text.txt';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#2196F3] hover:bg-[#1976D2] rounded-lg text-white text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  下载文本
                </button>
                <button
                  onClick={() => {
                    const content = textPreview.file.textContent || '';
                    navigator.clipboard.writeText(content);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  复制内容
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedFileManager;
