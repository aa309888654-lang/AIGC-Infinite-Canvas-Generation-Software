/**
 * 提升清晰度节点
 * 调用 doubao Video_Upscaling API 将视频超分至 1080P
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { NodeProps } from '@xyflow/react';
import {
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  Wand2,
  RefreshCw,
  Video as VideoIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getAuthToken } from '@/lib/auth-check';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import { aicgGlass } from './aicg-node-glass';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { API_BASE_URL } from '@/lib/api-config';

export interface VideoUpscaleNodeData {
  type: 'videoUpscale';
  videoUrl?: string;
  receivedVideoUrl?: string;
  resultUrl?: string;
  fileName?: string;
  originalWidth?: number;
  originalHeight?: number;
  targetWidth?: number;
  targetHeight?: number;
  isProcessed?: boolean;
  autoExecute?: boolean;
  task?: {
    status: 'idle' | 'processing' | 'done' | 'error';
    progress?: number;
    error?: string;
  };
}

type VideoUpscaleTaskStatus = 'idle' | 'processing' | 'done' | 'error';

const TARGET_WIDTH = 1920;
const TARGET_HEIGHT = 1080;
const POINTS_PER_SECOND = 20;

function VideoUpscaleNode({ id, data, selected }: NodeProps) {
  const nodeData = (data ?? {}) as VideoUpscaleNodeData & Record<string, unknown>;
  const updateNodeData = canvasStoreApi.updateNodeData;

  const inputVideoUrl = nodeData.receivedVideoUrl || nodeData.videoUrl;
  const resultUrl = nodeData.resultUrl;
  const taskStatus: VideoUpscaleTaskStatus = nodeData.task?.status || 'idle';
  const taskError = nodeData.task?.error;

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isProcessing = taskStatus === 'processing';
  const canExecute = !!inputVideoUrl && !isProcessing;

  const setInputVideo = useCallback(
    (url: string, fileName?: string) => {
      updateNodeData(id as string, {
        videoUrl: url,
        receivedVideoUrl: url,
        fileName,
        resultUrl: undefined,
        isProcessed: false,
        task: { status: 'idle' },
      } as Record<string, unknown>);
      setVideoLoaded(false);
      setVideoError(false);
      setVideoDuration(0);
    },
    [id, updateNodeData]
  );

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('video/')) {
        toast.error('请上传视频文件');
        return;
      }
      try {
        const token = getAuthToken();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'videos');

        const resp = await fetch(`${API_BASE_URL}/files/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        const result = await resp.json();
        if (!resp.ok || !result.success || !result.fileUrl) {
          throw new Error(result.error || '视频上传失败');
        }

        setInputVideo(result.fileUrl, file.name);
        toast.success('视频已上传');
      } catch (error) {
        toast.error(`视频上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    },
    [setInputVideo]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('video/'));
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleExecute = useCallback(async () => {
    if (!inputVideoUrl) {
      toast.warning('请先输入视频');
      return;
    }
    if (inputVideoUrl.startsWith('blob:')) {
      toast.error('本地视频需先上传，请通过节点内上传按钮选择视频文件');
      return;
    }

    updateNodeData(id as string, {
      task: { status: 'processing', progress: 0 },
      resultUrl: undefined,
      isProcessed: false,
    } as Record<string, unknown>);

    try {
      const token = getAuthToken();
      const resp = await fetch(`${API_BASE_URL}/video/upscale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ video_url: inputVideoUrl, duration: videoDuration || undefined, source: 'video_upscale_node' }),
      });

      const result = await resp.json();

      if (!resp.ok || !result.success) {
        throw new Error(result.error || '视频超分失败');
      }

      if (result.status === 'processing') {
        updateNodeData(id as string, {
          task: { status: 'processing', progress: 50 },
        } as Record<string, unknown>);
        toast.info('视频超分任务已提交，正在处理中，请稍后查询任务状态');
        return;
      }

      updateNodeData(id as string, {
        resultUrl: result.video_url,
        isProcessed: true,
        targetWidth: TARGET_WIDTH,
        targetHeight: TARGET_HEIGHT,
        task: { status: 'done', progress: 100 },
      } as Record<string, unknown>);
      toast.success(`视频超分完成，已消耗 ${result.points} 积分（${result.durationSeconds}秒）`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      updateNodeData(id as string, {
        task: { status: 'error', error: errMsg },
      } as Record<string, unknown>);
      toast.error(`视频超分失败: ${errMsg}`);
    }
  }, [id, inputVideoUrl, videoDuration, updateNodeData]);

  const handleReset = useCallback(() => {
    updateNodeData(id as string, {
      resultUrl: undefined,
      isProcessed: false,
      task: { status: 'idle' },
    } as Record<string, unknown>);
  }, [id, updateNodeData]);

  // 接收上游视频后自动执行
  useEffect(() => {
    if (nodeData.autoExecute && inputVideoUrl && taskStatus === 'idle' && !inputVideoUrl.startsWith('blob:')) {
      handleExecute();
    }
  }, [nodeData.autoExecute, inputVideoUrl, taskStatus, handleExecute]);

  const previewContent = (() => {
    if (isProcessing) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-6">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          <p className="text-[11px] text-white/70">超分处理中...</p>
          <p className="text-[10px] text-white/40">视频较长时可能需要数分钟</p>
        </div>
      );
    }

    if (resultUrl) {
      return (
        <div className="relative w-full">
          <video
            src={resultUrl}
            controls
            muted
            preload="none"
            className="w-full rounded-lg bg-black"
            style={{ aspectRatio: '16/9', maxHeight: 220 }}
            onLoadedData={() => setVideoLoaded(true)}
            onError={() => setVideoError(true)}
          />
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
            <CheckCircle className="w-3 h-3" />
            1080P
          </div>
        </div>
      );
    }

    if (inputVideoUrl) {
      return (
        <div className="relative w-full">
          <video
            src={inputVideoUrl}
            muted
            preload="metadata"
            className="w-full rounded-lg bg-black"
            style={{ aspectRatio: '16/9', maxHeight: 220 }}
            onLoadedMetadata={(e) => {
              setVideoLoaded(true);
              setVideoDuration(e.currentTarget.duration);
            }}
            onError={() => setVideoError(true)}
          />
          <div className="absolute top-1.5 right-1.5 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
            原始
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 py-8 cursor-pointer transition-colors',
          isDraggingOver ? 'bg-cyan-500/10' : 'bg-black/30'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-6 h-6 text-white/40" />
        <p className="text-[11px] text-white/50">点击上传或拖入视频</p>
        <p className="text-[10px] text-white/30">支持 mp4 / mov / webm</p>
      </div>
    );
  })();

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = '';
        }}
      />
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="videoUpscale"
        inputId="video"
        outputId="output"
        inputTip="视频输入"
        outputTip="高清视频输出"
      />

      <div className={selected ? aicgGlass.videoComposeFrameSelected : aicgGlass.videoComposeFrame}>
        <div className={aicgGlass.videoComposeInnerRing} />
        <AICGNodeShell
          variant="glass-stack"
          aicgType="tool"
          title="提升清晰度"
          subtitle="Video_Upscaling · 1080P"
          selected={selected}
          width={380}
          onDelete={() => canvasStoreApi.deleteNode(id as string)}
          preview={
            <div
              className="drag-handle relative flex cursor-grab items-center justify-center overflow-hidden bg-black/40 active:cursor-grabbing p-2"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={handleDrop}
            >
              {previewContent}
            </div>
          }
          controls={
            <div className="flex flex-col gap-2 p-2">
              {taskError && (
                <div className="flex items-start gap-1.5 rounded-md bg-red-500/10 border border-red-500/30 px-2 py-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-300 break-all">{taskError}</p>
                </div>
              )}

              {inputVideoUrl && !resultUrl && !isProcessing && (
                <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                  <VideoIcon className="w-3 h-3" />
                  <span className="truncate">{nodeData.fileName || '已连接视频'}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!canExecute}
                  onClick={handleExecute}
                  className={cn(
                    'nodrag nowheel flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium transition-all',
                    canExecute
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20'
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                  )}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      处理中
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5" />
                      开始提升
                    </>
                  )}
                </button>

                {resultUrl && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="nodrag nowheel flex items-center justify-center gap-1 rounded-lg bg-white/5 px-2.5 py-2 text-[11px] text-white/60 hover:bg-white/10 transition-all"
                    title="重新提升"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-white/40">
                <span>目标:1080P</span>
                <span>{POINTS_PER_SECOND} 积分/秒{videoDuration > 0 ? ` · 约 ${Math.ceil(videoDuration * POINTS_PER_SECOND)} 积分` : ''}</span>
              </div>
            </div>
          }
        />
      </div>
    </>
  );
}

export default memo(VideoUpscaleNode);
