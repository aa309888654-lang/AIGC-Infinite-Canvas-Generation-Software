import { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NodeProps } from '@xyflow/react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import { AICGNodeTopCornerActions } from './AICGNodeShell';
import NodeControllerV2Panel from './NodeControllerV2Panel';
import type { NodeControllerAction } from './NodeControllerCapabilityPanel';
import {
  X as CloseIcon,
  Play,
  Pause,
  Loader2,
  Upload,
  Video,
  Maximize2,
  Download,
  Scissors,
  ChevronDown,
  SlidersHorizontal,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { useFileStore } from '@/store/useFileStore';
import { nodeEventBus } from '@/lib/nodeEventBus';
import { videoStorage } from '@/lib/video-storage';
import { persistImportedCanvasFile } from '@/services/canvas-asset-actions';
import { sendCanvasMediaToClipEditor } from '@/services/canvas-clip-bridge-service';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { toast } from 'sonner';
import { useQualityEnhanceStore } from '@/services/quality-enhance-service';
import {
  audioSeparationService,
  useAudioSeparationStore,
} from '@/services/audio-separation-service';
import { aiSubtitleService } from '@/services/ai-subtitle-service';
import { chineseAISubtitleService } from '@/services/chinese-ai-subtitle-service';
import { getNodeControllerPreset } from '@/services/node-controller-capability-registry';
import {
  spawnControllerToolNode,
  withControllerActionConnection,
} from '@/services/node-controller-action-service';
import { useNodeViewportQuality } from './useNodeViewportQuality';
import type { VideoInputNodeData } from '@/types/ai-models';

const VIDEO_NODE_WIDTH = 548;
const VIDEO_MONITOR_HEIGHT = 304;
const VIDEO_TOOLBAR_MIN_WIDTH = 548;
const MIN_VIDEO_MONITOR_WIDTH = 280;
const MAX_VIDEO_MONITOR_WIDTH = 944;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatVideoTime = (seconds?: number) => {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
};

const audioBufferToWavBlob = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

const makeTextBlobUrl = (text: string, mime = 'text/plain') =>
  URL.createObjectURL(new Blob([text], { type: mime }));

const VideoInputNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as any as VideoInputNodeData;
  const updateNodeData = canvasStoreApi.updateNodeData;
  const deleteNode = canvasStoreApi.deleteNode;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoValid, setIsVideoValid] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [enhanceJobId, setEnhanceJobId] = useState<string | null>(null);
  const [subtitleJobId, setSubtitleJobId] = useState<string | null>(null);
  const [audioJobId, setAudioJobId] = useState<string | null>(null);
  const [showVideoController, setShowVideoController] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const { viewportZoom, isPreviewMode, isCompactMode } = useNodeViewportQuality();

  // 统一视频状态
  const [videoState, setVideoState] = useState<{
    url?: string;
    fileName?: string;
    duration?: number;
    width?: number;
    height?: number;
  }>({
    url: nodeData.videoUrl?.startsWith('blob:') ? undefined : nodeData.videoUrl,
    fileName: nodeData.fileName,
    duration: nodeData.duration,
    width: nodeData.width,
    height: nodeData.height,
  });

  const monitorWidth = VIDEO_NODE_WIDTH;
  const monitorToolbarScale = clamp(
    1 -
      ((monitorWidth - MIN_VIDEO_MONITOR_WIDTH) /
        (MAX_VIDEO_MONITOR_WIDTH - MIN_VIDEO_MONITOR_WIDTH)) *
        0.18,
    0.82,
    1
  );
  const viewportToolbarScale = clamp(1 / Math.max(viewportZoom, 0.18), 0.78, 1.45);
  const toolbarScale = clamp(monitorToolbarScale * viewportToolbarScale, 0.78, 1.45);
  const toolbarOffset = Math.round(-58 * toolbarScale);
  const shouldRenderLiveVideo = !isPreviewMode;

  const handleDeleteNode = useCallback(() => {
    // 删除节点前清理 IndexedDB 中的视频数据和 blob URL，并通知事件总线
    videoStorage.deleteVideo(id as string).catch(console.error);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    deleteNode(id as string);
    nodeEventBus.emitNodeDeleted(id as string);
  }, [deleteNode, id]);

  // 辅助函数：安全地设置并清理 Blob URL
  const setSafeVideoUrl = useCallback((url: string | undefined) => {
    if (blobUrlRef.current && blobUrlRef.current !== url) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if (url?.startsWith('blob:')) {
      blobUrlRef.current = url;
    }

    setVideoState((prev) => ({ ...prev, url }));
  }, []);

  // 监听外部数据变化
  useEffect(() => {
    setVideoState((prev) => ({
      ...prev,
      fileName: nodeData.fileName,
      duration: nodeData.duration,
      width: nodeData.width,
      height: nodeData.height,
    }));

    // 只有当外部 URL 真的变化且不是当前的 blob URL 时才更新
    // 使用 blobUrlRef.current 而非 videoState.url 避免闭包过时
    // 过滤空字符串，避免空值触发 setSafeVideoUrl('') 导致状态不一致
    if (nodeData.videoUrl?.startsWith('blob:') && nodeData.videoUrl !== blobUrlRef.current) {
      setSafeVideoUrl(undefined);
      return;
    }

    if (nodeData.videoUrl && nodeData.videoUrl !== blobUrlRef.current) {
      setSafeVideoUrl(nodeData.videoUrl);
    }
  }, [
    nodeData.videoUrl,
    nodeData.fileName,
    nodeData.duration,
    nodeData.width,
    nodeData.height,
    setSafeVideoUrl,
  ]);

  useEffect(() => {
    if (!isPreviewMode || !isPlaying) return;
    setIsPlaying(false);
  }, [isPlaying, isPreviewMode]);

  // 初始化加载：从 IndexedDB 加载
  useEffect(() => {
    let mounted = true;

    const initLoad = async () => {
      // 仅当节点已有视频资产或 URL 时才进入加载态，避免空节点显示加载动画
      if (!nodeData.videoUrl && !nodeData.videoAssetId) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const storedVideo = await videoStorage.getVideo(id as string);

        if (storedVideo && mounted) {
          if (storedVideo.blob.size > 0) {
            const blobUrl = URL.createObjectURL(storedVideo.blob);
            const metadata = storedVideo.metadata;

            const newState = {
              url: blobUrl,
              fileName: metadata.fileName,
              duration: metadata.duration > 0 ? metadata.duration : undefined,
              width: metadata.width > 0 ? metadata.width : undefined,
              height: metadata.height > 0 ? metadata.height : undefined,
            };

            setSafeVideoUrl(blobUrl);
            setVideoState((prev) => ({ ...prev, ...newState }));
            setIsVideoValid(true);

            updateNodeData(id as string, {
              videoUrl: blobUrl,
              fileName: metadata.fileName,
              duration: newState.duration,
              width: newState.width,
              height: newState.height,
            });
          }
        } else if (mounted) {
          // 使用 nodeData.videoUrl 而非 videoState.url 避免闭包过时
          setIsVideoValid(!!nodeData.videoUrl);
        }
      } catch (error) {
        console.error('[VideoInputNode] Initial load failed:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initLoad();

    return () => {
      mounted = false;
    };
  }, [id]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

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

  // 视频验证与比例计算
  useEffect(() => {
    if (!videoState.url) {
      setIsVideoValid(true);
      return;
    }

    let active = true;
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      if (!active) return;
      setIsVideoValid(true);
    };

    video.onerror = () => {
      if (!active) return;
      console.error('[VideoInputNode] Video load failed:', videoState.url);
      setIsVideoValid(false);
    };

    video.src = videoState.url;

    return () => {
      active = false;
      video.src = '';
      video.load();
    };
  }, [videoState.url]);

  // 确保视频元素加载最新 URL
  useEffect(() => {
    if (videoRef.current && videoState.url) {
      if (videoRef.current.src !== videoState.url) {
        videoRef.current.load();
      }
    }
  }, [videoState.url]);

  const qualityEnhanceStore = useQualityEnhanceStore();
  const audioSeparationStore = useAudioSeparationStore();

  const getVideoFile = useCallback(async (): Promise<File | null> => {
    if (!videoState.url) return null;
    try {
      const stored = await videoStorage.getVideo(id as string);
      if (stored?.blob && stored.blob.size > 0) {
        return new File(
          [stored.blob],
          stored.metadata.fileName || videoState.fileName || 'video.mp4',
          {
            type: stored.blob.type || 'video/mp4',
          }
        );
      }
      const response = await fetch(videoState.url);
      if (!response.ok) {
        console.warn('[VideoInputNode] fetch video failed:', response.status);
        return null;
      }
      const blob = await response.blob();
      if (blob.size === 0) return null;
      return new File([blob], videoState.fileName || 'video.mp4', {
        type: blob.type || 'video/mp4',
      });
    } catch (error) {
      console.error('[VideoInputNode] getVideoFile error:', error);
      return null;
    }
  }, [id, videoState.fileName, videoState.url]);

  const handleEnhanceVideo = useCallback(async () => {
    if (!videoState.url || !videoState.width || !videoState.height) {
      toast.warning('请先上传带尺寸信息的视频');
      return;
    }

    const jobId = qualityEnhanceStore.startEnhance(
      id as string,
      videoState.width,
      videoState.height,
      1
    );
    setEnhanceJobId(jobId);
    qualityEnhanceStore.updateJobProgress(jobId, 20);
    toast.info('正在创建高清增强任务，已生成下游增强节点');

    try {
      // 当前无后端视频超分端点，直接创建下游 video-to-video 增强节点，
      // 由该节点调用实际模型完成高清增强，而不是伪造一个已完成的增强结果。
      const enhancedWidth = videoState.width * qualityEnhanceStore.settings.scale;
      const enhancedHeight = videoState.height * qualityEnhanceStore.settings.scale;

      updateNodeData(
        id as string,
        {
          enhanceJobId: jobId,
          enhancedWidth,
          enhancedHeight,
        } as Record<string, unknown>
      );

      spawnControllerToolNode(id as string, 'aiVideo', {
        controllerActionId: 'video-enhance-result',
        replaceExisting: true,
        label: '高清增强',
        toastLabel: '高清增强节点',
        sourceHandle: 'videoOutput',
        targetHandle: 'input',
        initialData: {
          videoUrl: videoState.url,
          receivedVideoUrl: videoState.url,
          referenceVideoUrl: videoState.url,
          fileName: `高清增强_${videoState.fileName || '视频'}`,
          generationMode: 'video_to_video',
          params: {
            generationMode: 'video_to_video',
            referenceVideoUrl: videoState.url,
            prompt: '对输入视频进行高清增强、细节修复和清晰度提升',
            targetWidth: enhancedWidth,
            targetHeight: enhancedHeight,
            scale: qualityEnhanceStore.settings.scale,
          },
        },
      });

      // 任务已派发到下游节点，标记为完成（节点侧将接管实际增强流程）
      qualityEnhanceStore.updateJobProgress(jobId, 100, 1);
      qualityEnhanceStore.completeJob(jobId, videoState.url, videoState.url);

      toast.success('高清增强任务已派发到下游节点，请在增强节点中查看进度');
    } catch (error) {
      qualityEnhanceStore.failJob(jobId, error instanceof Error ? error.message : '高清增强失败');
      toast.error(`高清增强失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setEnhanceJobId(null);
    }
  }, [
    id,
    qualityEnhanceStore,
    updateNodeData,
    videoState.fileName,
    videoState.height,
    videoState.url,
    videoState.width,
  ]);

  const handleGenerateSubtitles = useCallback(async () => {
    if (!videoState.url) {
      toast.warning('请先上传视频');
      return;
    }

    const file = await getVideoFile();
    if (!file) {
      toast.warning('无法读取视频文件');
      return;
    }

    const jobId = `subtitle-${Date.now()}`;
    setSubtitleJobId(jobId);
    toast.info('正在生成字幕');

    try {
      const aiResult = await chineseAISubtitleService.generateFromVideo(file, {
        provider: 'whisper',
        language: 'zh-CN',
        enablePunctuation: true,
      });

      if (aiResult.success) {
        const segments = aiResult.segments.map((segment) => ({
          id: segment.id,
          startTime: segment.startTime,
          endTime: segment.endTime,
          text: segment.text,
          confidence: segment.confidence,
        }));
        const srt = aiSubtitleService.exportToSRT(segments);
        const subtitleUrl = makeTextBlobUrl(srt, 'text/plain;charset=utf-8');
        updateNodeData(
          id as string,
          {
            subtitleText: srt,
            subtitleSegments: segments,
            subtitleUrl,
          } as Record<string, unknown>
        );

        await useFileStore.getState().registerGeneratedFile({
          name: `${videoState.fileName || '视频'}_字幕.srt`,
          type: 'text',
          url: subtitleUrl,
          size: new Blob([srt]).size,
        });

        spawnControllerToolNode(id as string, 'aiGenText', {
          controllerActionId: 'video-subtitle-result',
          replaceExisting: true,
          label: '视频字幕',
          toastLabel: '字幕文本节点',
          sourceHandle: 'videoOutput',
          targetHandle: 'promptInput',
          initialData: {
            type: 'textInput',
            text: srt,
            prompt: srt,
            outputText: srt,
            sourceVideoUrl: videoState.url,
            sourceVideoNodeId: id,
          },
        });

        toast.success(`字幕生成完成，共 ${segments.length} 段，已保存到文件管理`);
      } else {
        throw new Error(aiResult.error || '字幕生成失败');
      }
    } catch (error) {
      toast.error(`字幕生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSubtitleJobId(null);
    }
  }, [getVideoFile, id, updateNodeData, videoState.fileName, videoState.url]);

  const handleSeparateAudio = useCallback(async () => {
    if (!videoState.url) {
      toast.warning('请先上传视频');
      return;
    }

    const jobId = audioSeparationStore.startSeparation(
      videoState.url,
      videoState.fileName || '视频输入'
    );
    setAudioJobId(jobId);
    audioSeparationStore.updateJobProgress(jobId, 15);

    try {
      const audioBlob = await audioSeparationService.extractAudioFromVideo(videoState.url);
      const audioUrl = URL.createObjectURL(audioBlob);
      try {
        const audioBuffer = await audioSeparationService.loadAudioFile(audioUrl);
        const tracks = await audioSeparationService.separateAudio(
          audioBuffer,
          audioSeparationStore.selectedModel,
          audioSeparationStore.selectedStems,
          (progress) => audioSeparationStore.updateJobProgress(jobId, progress)
        );

        const outputTracks = Array.from(tracks.entries()).map(([stem, buffer]) => {
          const wavBlob = audioBufferToWavBlob(buffer);
          const outputUrl = URL.createObjectURL(wavBlob);
          const config = audioSeparationService.getStemConfig(stem);
          return {
            id: `${jobId}-${stem}`,
            stem,
            name: config.name,
            url: outputUrl,
            size: wavBlob.size,
            duration: buffer.duration,
            waveform: audioSeparationService.generateWaveform(buffer),
            volume: 1,
            muted: false,
            solo: false,
            color: config.color,
          };
        });

        audioSeparationStore.completeJob(jobId, outputTracks);
        updateNodeData(
          id as string,
          {
            audioSeparationJobId: jobId,
            separatedAudioTracks: outputTracks,
          } as Record<string, unknown>
        );

        await Promise.all(
          outputTracks.map((track) =>
            useFileStore.getState().registerGeneratedFile({
              name: `${videoState.fileName || '视频'}_${track.name}.wav`,
              type: 'audio',
              url: track.url,
              size: track.size,
            })
          )
        );

        const primaryTrack = outputTracks[0];
        if (primaryTrack) {
          spawnControllerToolNode(id as string, 'audioInput', {
            controllerActionId: 'video-audio-separate-result',
            replaceExisting: true,
            label: '分离音频',
            toastLabel: '分离音频节点',
            sourceHandle: 'videoOutput',
            targetHandle: 'input',
            initialData: {
              type: 'audioInput',
              audioUrl: primaryTrack.url,
              resultUrl: primaryTrack.url,
              fileName: `${videoState.fileName || '视频'}_${primaryTrack.name}.wav`,
              duration: primaryTrack.duration,
              sourceVideoUrl: videoState.url,
              sourceVideoNodeId: id,
              separatedTracks: outputTracks,
            },
          });

          sendCanvasMediaToClipEditor(
            outputTracks.map((track) => ({
              url: track.url,
              type: 'audio' as const,
              name: `${videoState.fileName || '视频'}_${track.name}`,
              duration: track.duration,
            })),
            id as string
          );
        }

        toast.success(`音频分离完成，共 ${outputTracks.length} 轨，已发送到 AI 剪辑`);
      } finally {
        // 无论成功或失败都释放中间 audioUrl，避免内存泄漏
        URL.revokeObjectURL(audioUrl);
      }
    } catch (error) {
      audioSeparationStore.failJob(jobId, error instanceof Error ? error.message : '音频分离失败');
      toast.error(`音频分离失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setAudioJobId(null);
    }
  }, [audioSeparationStore, id, updateNodeData, videoState.fileName, videoState.url]);

  const forceSaveVideo = useCallback(
    async (file: File, video: HTMLVideoElement) => {
      const metadata = {
        fileName: file.name,
        duration: video.duration || 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
        fileSize: file.size,
        createdAt: Date.now(),
      };

      try {
        setIsLoading(true);

        // 1. 创建本地预览 URL 并设置到状态（setSafeVideoUrl 已更新 videoState.url）
        const previewUrl = URL.createObjectURL(file);
        setSafeVideoUrl(previewUrl);
        setVideoState((prev) => ({
          ...prev,
          url: previewUrl,
          fileName: file.name,
          duration: metadata.duration || undefined,
          width: metadata.width || undefined,
          height: metadata.height || undefined,
        }));

        // 2. 保存到 IndexedDB
        await videoStorage.saveVideo(id as string, file, metadata);

        // 3. 异步持久化到资产库
        let videoAssetId: string | undefined;
        let finalUrl = previewUrl;

        try {
          const persisted = await persistImportedCanvasFile({
            nodeId: id as string,
            kind: 'video',
            file,
          });

          videoAssetId = persisted.asset.id;
          if (persisted.runtimeUrl) {
            finalUrl = persisted.runtimeUrl;
            if (!finalUrl.startsWith('blob:')) {
              setSafeVideoUrl(finalUrl);
            }
          }
        } catch (persistError) {
          console.warn('[VideoInputNode] Asset persistence failed:', persistError);
        }

        // 4. 更新 Store 数据
        updateNodeData(id as string, {
          videoAssetId,
          videoUrl: finalUrl,
          fileName: file.name,
          duration: metadata.duration || undefined,
          width: metadata.width || undefined,
          height: metadata.height || undefined,
        });
        syncDownstreamFromNode(id as string);

        setIsVideoValid(true);
        toast.success('视频上传成功');
      } catch (error) {
        console.error('[VideoInputNode] Video processing failed:', error);
        toast.error(`视频处理失败: ${error instanceof Error ? error.message : error}`);
      } finally {
        setIsLoading(false);
      }
    },
    [id, updateNodeData, setSafeVideoUrl]
  );

  const processVideoFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('video/')) {
        toast.warning('请上传视频文件');
        return;
      }

      if (file.size > 100 * 1024 * 1024) {
        toast.warning('视频文件过大（最大100MB）');
        return;
      }

      const video = document.createElement('video');
      video.preload = 'metadata';

      // tempUrl 仅用于读取元数据，在 onloadedmetadata/onerror 触发后才撤销
      // 注意：不能在调用 forceSaveVideo 之前撤销，否则 video 元素可能还未完成读取
      const tempUrl = URL.createObjectURL(file);
      let urlRevoked = false;
      const cleanup = () => {
        if (!urlRevoked) {
          urlRevoked = true;
          URL.revokeObjectURL(tempUrl);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
        }
      };
      const onLoadedMetadata = () => {
        try {
          forceSaveVideo(file, video);
        } finally {
          cleanup();
        }
      };
      const onError = () => {
        try {
          console.error('[VideoInputNode] Failed to load video metadata');
          forceSaveVideo(file, video);
        } finally {
          cleanup();
        }
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      video.addEventListener('error', onError, { once: true });
      video.src = tempUrl;
    },
    [forceSaveVideo]
  );

  const handleVideoChange = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/webm,video/quicktime,video/x-msvideo';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      processVideoFile(file);
    };

    input.click();
  }, [processVideoFile]);

  const handleDropVideo = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = Array.from(e.dataTransfer.files).find((item) => item.type.startsWith('video/'));
      if (!file) {
        toast.warning('请拖入视频文件');
        return;
      }
      processVideoFile(file);
    },
    [processVideoFile]
  );

  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch((error) => {
              console.warn('[VideoInputNode] 播放失败:', error);
              toast.warning('视频播放失败，请手动点击播放');
              setIsPlaying(false);
            });
        }
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, []);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const video = videoRef.current;
      const progress = progressRef.current;
      if (!video || !progress || !videoState.duration) return;

      const rect = progress.getBoundingClientRect();
      const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      // 优先使用 video.duration（实际媒体时长），回退到 videoState.duration
      const duration = isFinite(video.duration) ? video.duration : videoState.duration;
      if (!duration) return;
      const nextTime = Math.max(0, Math.min(percent * duration, duration));
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [videoState.duration]
  );

  const progressPercent = videoState.duration
    ? Math.min((currentTime / videoState.duration) * 100, 100)
    : 0;
  const videoTitle = videoState.fileName || '视频节点';
  const videoSizeLabel =
    videoState.width && videoState.height ? `${videoState.width} × ${videoState.height}` : '';

  const handleSaveToFileManager = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!videoState.url) {
        toast.warning('请先上传视频');
        return;
      }

      try {
        // 尝试获取真实文件大小，失败时回退到 0
        let fileSize = 0;
        try {
          const file = await getVideoFile();
          if (file) fileSize = file.size;
        } catch {
          // 忽略，使用 0 作为回退值
        }

        const { registerGeneratedFile } = useFileStore.getState();
        await registerGeneratedFile({
          name: videoState.fileName || `video_${Date.now()}.mp4`,
          type: 'video',
          url: videoState.url,
          size: fileSize,
        });
        toast.success('视频已保存到文件管理');
      } catch (err) {
        console.error('[VideoInputNode] 保存视频到文件管理失败:', err);
        toast.error('保存失败，请重试');
      }
    },
    [getVideoFile, videoState.url, videoState.fileName]
  );

  const handleDownloadToLocal = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!videoState.url) {
        toast.warning('请先上传视频');
        return;
      }

      const link = document.createElement('a');
      link.href = videoState.url;
      link.download = videoState.fileName || `video_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [videoState.fileName, videoState.url]
  );

  const handleRemoveVideo = useCallback(() => {
    const removedUrl = videoState.url;
    const clearSyncedDownstreamVideos = () => {
      const outgoingTargetIds = new Set(
        canvasStoreApi
          .getEdges()
          .filter((edge) => edge.source === id)
          .map((edge) => edge.target)
      );
      for (const target of canvasStoreApi.getNodes()) {
        if (target.id === id) continue;
        // 仅处理与本节点有边连接的下游节点
        if (!outgoingTargetIds.has(target.id)) continue;
        const targetData = (target.data ?? {}) as Record<string, unknown>;
        // 仅当目标节点的视频确实来自本节点同步时才清除
        const syncedFromThisNode = targetData._aicgSyncedFrom === id;
        const urlMatchesRemovedUrl =
          !!removedUrl &&
          [targetData.videoUrl, targetData.receivedVideoUrl, targetData.url].includes(removedUrl);
        if (!syncedFromThisNode && !urlMatchesRemovedUrl) continue;
        canvasStoreApi.updateNodeData(target.id, {
          videoUrl: '',
          receivedVideoUrl: '',
          url: '',
          mediaType: undefined,
          _aicgSyncedFrom: undefined,
          _aicgSyncedAt: Date.now(),
        });
      }
      // 直接操作 localStorage 的逻辑已移除：Zustand persist 中间件会自动持久化内存状态，
      // 此前的手写 localStorage 同步是冗余且脆弱的，容易与 store 产生不一致。
    };

    videoStorage.deleteVideo(id as string).catch(console.error);

    // 清理本节点生成的 blob URL（字幕、解析报告、分离音频轨道），避免内存泄漏
    const videoAnalysis = (nodeData as any)?.videoAnalysis;
    const separatedTracks = (nodeData as any)?.separatedAudioTracks;
    const urlsToRevoke = [
      (nodeData as any)?.subtitleUrl,
      videoAnalysis?.reportUrl,
      ...(Array.isArray(separatedTracks) ? separatedTracks.map((t: any) => t?.url) : []),
    ].filter(Boolean) as string[];
    urlsToRevoke.forEach((url) => {
      if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
    });

    setSafeVideoUrl(undefined);
    setVideoState({
      url: undefined,
      fileName: undefined,
      duration: undefined,
      width: undefined,
      height: undefined,
    });
    setIsPlaying(false);
    setCurrentTime(0);
    setIsVideoValid(true);
    setShowMenu(false);
    updateNodeData(id as string, {
      videoUrl: '',
      fileName: '',
      videoAssetId: undefined,
      startFrame: undefined,
      endFrame: undefined,
      width: undefined,
      height: undefined,
      duration: undefined,
    });

    // 清理下游同步数据；移除 setTimeout 重试 hack，store 更新是同步的
    clearSyncedDownstreamVideos();
  }, [id, updateNodeData, setSafeVideoUrl, videoState.url]);

  const ensureVideoReady = useCallback(() => {
    if (!videoState.url) {
      toast.warning('请先上传视频');
      return false;
    }
    return true;
  }, [videoState.url]);

  const handleSendToClip = useCallback(() => {
    if (!ensureVideoReady()) return;
    sendCanvasMediaToClipEditor(
      [
        {
          url: videoState.url as string,
          type: 'video',
          name: videoState.fileName || '视频输入',
          duration: videoState.duration,
        },
      ],
      id as string
    );
    toast.success('已发送到 AI 剪辑');
  }, [ensureVideoReady, id, videoState.duration, videoState.fileName, videoState.url]);

  const handleAnalyzeVideo = useCallback(async () => {
    if (!ensureVideoReady()) return;

    const file = await getVideoFile();
    const infoLines = [
      `文件名：${videoState.fileName || file?.name || '视频输入'}`,
      `分辨率：${videoState.width && videoState.height ? `${videoState.width}×${videoState.height}` : '未知'}`,
      `时长：${videoState.duration ? formatVideoTime(videoState.duration) : '未知'}`,
      `大小：${file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '未知'}`,
      `类型：${file?.type || 'video/mp4'}`,
      `解析时间：${new Date().toLocaleString()}`,
    ];
    const report = infoLines.join('\n');
    const reportUrl = makeTextBlobUrl(report, 'text/plain;charset=utf-8');

    updateNodeData(
      id as string,
      {
        videoAnalysis: {
          fileName: videoState.fileName || file?.name,
          width: videoState.width,
          height: videoState.height,
          duration: videoState.duration,
          size: file?.size,
          mimeType: file?.type,
          report,
          reportUrl,
          analyzedAt: Date.now(),
        },
      } as Record<string, unknown>
    );

    await useFileStore.getState().registerGeneratedFile({
      name: `${videoState.fileName || '视频'}_解析.txt`,
      type: 'text',
      url: reportUrl,
      size: new Blob([report]).size,
    });

    spawnControllerToolNode(id as string, 'aiGenText', {
      controllerActionId: 'video-analysis-result',
      replaceExisting: true,
      label: '视频解析',
      toastLabel: '视频解析节点',
      sourceHandle: 'videoOutput',
      targetHandle: 'promptInput',
      initialData: {
        type: 'textInput',
        text: report,
        prompt: report,
        outputText: report,
        sourceVideoUrl: videoState.url,
        sourceVideoNodeId: id,
      },
    });

    toast.success('视频解析完成，已生成解析文本节点');
  }, [
    ensureVideoReady,
    getVideoFile,
    id,
    updateNodeData,
    videoState.duration,
    videoState.fileName,
    videoState.height,
    videoState.url,
    videoState.width,
  ]);

  const runVideoDownstreamAction = useCallback(
    (actionId: string, replaceExisting = false) => {
      if (!ensureVideoReady()) return;

      if (actionId === 'video-output') {
        spawnControllerToolNode(id as string, 'output', {
          controllerActionId: actionId,
          replaceExisting,
          label: '视频导出',
          toastLabel: '视频导出',
          sourceHandle: 'videoOutput',
          targetHandle: 'video',
          initialData: {
            receivedVideoUrl: videoState.url,
            videoUrl: videoState.url,
            url: videoState.url,
            mediaType: 'video',
            fileName: videoState.fileName || '视频导出',
          },
        });
      }
    },
    [ensureVideoReady, id, videoState.fileName, videoState.url]
  );

  const isEnhancing = Boolean(enhanceJobId);
  const isSubtitleProcessing = Boolean(subtitleJobId);
  const isAudioSeparating = Boolean(audioJobId);
  const videoInputControllerPreset = getNodeControllerPreset('videoInput');
  const videoInputActions: NodeControllerAction[] = useMemo(
    () => [
      {
        id: 'send-to-clip',
        label: 'AI剪辑',
        icon: 'split',
        tone: 'primary',
        disabled: !videoState.url,
        onClick: handleSendToClip,
        title: '发送视频到 AI 剪辑',
      },
      {
        id: 'enhance',
        label: '高清',
        icon: 'upscale',
        state: isEnhancing ? 'pending' : 'idle',
        disabled: !videoState.url || isEnhancing,
        onClick: () => void handleEnhanceVideo(),
        title: '创建视频高清增强任务',
      },
      {
        id: 'analyze',
        label: '解析',
        icon: 'analyze',
        disabled: !videoState.url,
        onClick: () => void handleAnalyzeVideo(),
        title: '查看视频分辨率、时长和文件信息',
      },
      {
        id: 'subtitle',
        label: '字幕',
        icon: 'subtitle',
        state: isSubtitleProcessing ? 'pending' : 'idle',
        disabled: !videoState.url || isSubtitleProcessing,
        onClick: () => void handleGenerateSubtitles(),
        title: '生成视频字幕',
      },
      {
        id: 'audio-separate',
        label: '音频分离',
        icon: 'music',
        state: isAudioSeparating ? 'pending' : 'idle',
        disabled: !videoState.url || isAudioSeparating,
        onClick: () => void handleSeparateAudio(),
        title: '从视频中分离音频轨道',
      },
      {
        id: 'save',
        label: '保存',
        icon: 'save',
        disabled: !videoState.url,
        onClick: () => void handleSaveToFileManager(),
        title: '保存到文件管理',
      },
      {
        id: 'download',
        label: '下载',
        icon: 'download',
        disabled: !videoState.url,
        onClick: () => handleDownloadToLocal(),
        title: '下载视频到本地',
      },
      {
        id: 'remove',
        label: '移除',
        icon: 'trash',
        disabled: !videoState.url,
        onClick: handleRemoveVideo,
        title: '移除当前视频并同步清理下游',
      },
    ],
    [
      handleAnalyzeVideo,
      handleDownloadToLocal,
      handleEnhanceVideo,
      handleGenerateSubtitles,
      handleRemoveVideo,
      handleSaveToFileManager,
      handleSendToClip,
      handleSeparateAudio,
      isAudioSeparating,
      isEnhancing,
      isSubtitleProcessing,
      videoState.url,
    ]
  );
  const videoDownstreamActions: NodeControllerAction[] = useMemo(
    () => [
      withControllerActionConnection({
        sourceNodeId: id as string,
        action: {
          id: 'video-output',
          label: '导出节点',
          icon: 'export',
          disabled: !videoState.url,
          onClick: () => runVideoDownstreamAction('video-output'),
          title: '连接到成片导出节点',
        },
        binding: {
          actionId: 'video-output',
          nodeType: 'output',
          onReplace: () => runVideoDownstreamAction('video-output', true),
        },
      }),
    ],
    [id, runVideoDownstreamAction, videoState.url]
  );

  return (
    <div
      className="group relative select-none border-0 outline-none transition-all duration-300"
      style={{ width: VIDEO_NODE_WIDTH }}
    >
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="videoInput"
        inputTip="视频输入"
        outputId="videoOutput"
        outputTip="视频输出"
      />

      {!isPreviewMode && selected && videoState.url && (
        <div
          className="absolute left-1/2 z-40 flex w-max max-w-none -translate-x-1/2 justify-center origin-bottom transition-transform duration-200"
          style={{
            top: toolbarOffset,
            minWidth: VIDEO_TOOLBAR_MIN_WIDTH,
            transform: `translateX(-50%) scale(${toolbarScale})`,
          }}
        >
          <div className="drag-handle relative z-20 flex w-full flex-nowrap items-center justify-between gap-1 rounded-[10px] border border-white/[0.14] bg-[#101012] px-2 py-0.5 text-[11px] text-white/78 shadow-[0_10px_24px_rgba(0,0,0,0.28)] active:cursor-grabbing">
            <button
              type="button"
              aria-label="发送到AI剪辑"
              data-testid="video-input-send-to-clip"
              onClick={(e) => {
                e.stopPropagation();
                handleSendToClip();
              }}
              className="nodrag nowheel flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1 transition-colors hover:bg-white/8 hover:text-white"
            >
              <Scissors className="h-3.5 w-3.5" />
              <span>剪辑</span>
            </button>
            <button
              type="button"
              aria-label="视频高清增强"
              data-testid="video-input-enhance"
              onClick={(e) => {
                e.stopPropagation();
                void handleEnhanceVideo();
              }}
              className="nodrag nowheel flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1 transition-colors hover:bg-white/8 hover:text-white"
            >
              <span className="rounded-[3px] border border-white/45 px-0.5 text-[8px] font-bold leading-3 text-white/90">
                HD
              </span>
              <span>高清</span>
            </button>
            <button
              type="button"
              aria-label="解析视频信息"
              data-testid="video-input-analyze"
              onClick={(e) => {
                e.stopPropagation();
                handleAnalyzeVideo();
              }}
              className="nodrag nowheel flex h-7 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-white/8 hover:text-white"
            >
              <span className="h-4 w-3 rounded-[2px] border-2 border-white/80" />
              <span>解析</span>
            </button>
            <button
              type="button"
              aria-label="生成视频字幕"
              data-testid="video-input-subtitle"
              onClick={(e) => {
                e.stopPropagation();
                void handleGenerateSubtitles();
              }}
              className="nodrag nowheel flex h-7 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-white/8 hover:text-white"
            >
              <span className="text-[13px] leading-none">⌁</span>
              <span>字幕</span>
            </button>
            <button
              type="button"
              aria-label="视频音频分离"
              data-testid="video-input-audio-separate"
              onClick={(e) => {
                e.stopPropagation();
                void handleSeparateAudio();
              }}
              className="nodrag nowheel flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1 transition-colors hover:bg-white/8 hover:text-white"
            >
              <span className="text-[13px] leading-none">♬</span>
              <span>音频分离</span>
            </button>
            <button
              type="button"
              aria-label={showVideoController ? '隐藏视频控制' : '视频控制'}
              data-testid="video-input-controller-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setShowVideoController((value) => !value);
              }}
              className={cn(
                'nodrag nowheel flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1 transition-colors hover:bg-white/8 hover:text-white',
                showVideoController && 'bg-white/10 text-white'
              )}
              title={showVideoController ? '隐藏视频控制' : '视频控制'}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>视频控制</span>
            </button>
            <div className="h-5 w-px bg-white/10" />
            <button
              type="button"
              aria-label="保存到文件管理"
              data-testid="video-input-save"
              onClick={(e) => {
                e.stopPropagation();
                void handleSaveToFileManager(e);
              }}
              className="nodrag nowheel flex h-7 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/8 hover:text-white"
              title="保存到文件管理"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="全屏预览"
              data-testid="video-input-fullscreen"
              onClick={(e) => {
                e.stopPropagation();
                setShowPreview(true);
              }}
              className="nodrag nowheel flex h-7 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/8 hover:text-white disabled:opacity-30"
              disabled={!videoState.url}
              title="全屏预览"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div
        className={cn('relative rounded-[10px] text-white shadow-[0_18px_44px_rgba(0,0,0,0.36)]')}
      >
        {!isPreviewMode && <AICGNodeTopCornerActions onDelete={handleDeleteNode} />}
        <div
          className={cn(
            'drag-handle group/player relative cursor-grab overflow-hidden rounded-[8px] border border-white/[0.12] bg-[#101012] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] active:cursor-grabbing transition-colors',
            isDragOver && 'border-white/55 ring-2 ring-white/22'
          )}
          style={{ height: VIDEO_MONITOR_HEIGHT, width: '100%' }}
          data-testid="video-input-monitor"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDragOver) setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            // 检查 relatedTarget 避免因子元素触发而闪烁
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragOver(false);
            }
          }}
          onDrop={handleDropVideo}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (videoState.url) setShowPreview(true);
          }}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
              if (item.type.startsWith('video/')) {
                const file = item.getAsFile();
                if (file) {
                  e.preventDefault();
                  processVideoFile(file);
                  break;
                }
              }
            }
          }}
        >
          <div className="pointer-events-none absolute left-3 right-14 top-3 z-20 flex min-w-0 items-center justify-between gap-3 rounded-md bg-black/28 px-2 py-1 text-white/70 backdrop-blur-sm">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-[12px] text-white/45">▸</span>
              <span className="truncate text-[11px] font-medium text-white/82">{videoTitle}</span>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-white/45">{videoSizeLabel}</span>
          </div>
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#101012]">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
              <p className="mt-2 text-[10px] text-white/45">加载中...</p>
            </div>
          ) : videoState.url && isVideoValid ? (
            shouldRenderLiveVideo ? (
              <>
                <video
                  ref={videoRef}
                  src={videoState.url}
                  className="h-full w-full object-contain"
                  draggable={false}
                  preload="metadata"
                  playsInline
                  muted={isMuted}
                  onClick={handlePlayPause}
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime || 0);
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(videoState.duration || 0);
                  }}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="nodrag nowheel absolute bottom-3 left-4 right-4 flex items-center gap-3 text-white">
                  <button
                    type="button"
                    aria-label={isPlaying ? '暂停视频' : '播放视频'}
                    data-testid="video-input-play-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayPause();
                    }}
                    className="nodrag nowheel flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10"
                    title={isPlaying ? '暂停' : '播放'}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4 fill-white" />
                    ) : (
                      <Play className="h-4 w-4 fill-white" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={isMuted ? '取消静音' : '静音'}
                    data-testid="video-input-mute-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted((value) => !value);
                    }}
                    className="nodrag nowheel flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10"
                    title={isMuted ? '取消静音' : '静音'}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <span className="w-9 shrink-0 font-mono text-[10px] text-white/85">
                    {formatVideoTime(currentTime)}
                  </span>
                  <div
                    ref={progressRef}
                    className="nodrag nowheel relative h-1 flex-1 cursor-pointer rounded-full bg-white/35"
                    onClick={handleSeek}
                    role="presentation"
                  >
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-white"
                      style={{ width: `${progressPercent}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.2)]"
                      style={{ left: `calc(${progressPercent}% - 5px)` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right font-mono text-[10px] text-white/85">
                    {formatVideoTime(videoState.duration)}
                  </span>
                </div>
              </>
            ) : (
              <button
                type="button"
                className={cn(
                  'absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#101012] pt-8 text-white/60 transition-colors hover:bg-[#151515]',
                  isCompactMode && 'gap-2 pt-6'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPreview(true);
                }}
              >
                <span
                  className={cn(
                    'flex items-center justify-center rounded-full border border-white/12 bg-black/35 text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.34)]',
                    isCompactMode ? 'h-12 w-12' : 'h-16 w-16'
                  )}
                >
                  <Play className={cn('fill-white', isCompactMode ? 'h-5 w-5' : 'h-7 w-7')} />
                </span>
                <span
                  className={cn(
                    'max-w-[72%] truncate font-medium text-white/80',
                    isCompactMode ? 'text-[11px]' : 'text-[13px]'
                  )}
                >
                  {videoTitle}
                </span>
                <span className="font-mono text-[10px] text-white/42">
                  {videoSizeLabel} · {formatVideoTime(videoState.duration)}
                </span>
              </button>
            )
          ) : (
            <button
              type="button"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 pt-10 bg-[#101012] text-[#E2E8F0] transition-colors hover:bg-[#101012] hover:text-[#E2E8F0]"
              onClick={(e) => {
                e.stopPropagation();
                handleVideoChange();
              }}
            >
              <Video className="h-10 w-10" />
              <span className="text-xs">点击上传视频</span>
              <span className="text-[10px]">支持 MP4, WebM, MOV · 最大 100MB</span>
            </button>
          )}

          {!isPreviewMode && (
            <button
              type="button"
              aria-label={videoState.url ? '替换视频' : '上传视频'}
              data-testid="video-input-upload"
              onClick={(e) => {
                e.stopPropagation();
                handleVideoChange();
              }}
              className="nodrag nowheel absolute right-12 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/40 text-white/65 opacity-0 shadow-lg backdrop-blur transition-all hover:bg-white/12 hover:text-white group-hover:opacity-90"
              title={videoState.url ? '替换视频' : '上传视频'}
            >
              <Upload className="h-4 w-4" />
            </button>
          )}

          {!isPreviewMode && selected && (
            <div className="nodrag nowheel absolute right-2 top-11">
              <button
                type="button"
                aria-label="更多视频操作"
                data-testid="video-input-more"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu((value) => !value);
                }}
                className="nodrag nowheel flex h-7 w-7 items-center justify-center rounded-md bg-black/35 text-white/60 opacity-100 backdrop-blur transition-all hover:bg-white/12 hover:text-white"
                title="更多"
              >
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', showMenu && 'rotate-180')}
                />
              </button>
              {showMenu ? (
                <div className="nodrag nowheel absolute right-0 top-8 z-30 w-28 overflow-hidden rounded-lg border border-white/10 bg-[#1f1f1f]/95 p-1 text-[11px] text-white/72 shadow-2xl backdrop-blur">
                  <button
                    type="button"
                    aria-label="保存视频"
                    data-testid="video-input-menu-save"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSaveToFileManager(e);
                    }}
                    className="nodrag nowheel flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-white/8"
                  >
                    <Download className="h-3.5 w-3.5" />
                    保存
                  </button>
                  <button
                    type="button"
                    aria-label="下载视频"
                    data-testid="video-input-menu-download"
                    onClick={handleDownloadToLocal}
                    className="nodrag nowheel flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-white/8"
                  >
                    <Download className="h-3.5 w-3.5" />
                    下载
                  </button>
                  <button
                    type="button"
                    aria-label="移除视频"
                    data-testid="video-input-menu-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveVideo();
                    }}
                    className="nodrag nowheel flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-red-300 hover:bg-red-500/15"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    移除
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {!isPreviewMode && selected && showVideoController && (
        <NodeControllerV2Panel
          title={videoInputControllerPreset.v2.title}
          subtitle={videoInputControllerPreset.v2.subtitle}
          status={
            isEnhancing || isSubtitleProcessing || isAudioSeparating
              ? 'processing'
              : videoState.url
                ? 'done'
                : 'idle'
          }
          onClose={() => setShowVideoController(false)}
          sections={[
            {
              id: 'result',
              label: videoInputControllerPreset.v2.sections.result || '视频动作',
              actions: videoInputActions,
            },
            {
              id: 'downstream',
              label: videoInputControllerPreset.v2.sections.downstream || '下游工具',
              actions: videoDownstreamActions,
            },
          ]}
          summary={[
            { id: 'file', label: videoTitle, title: '视频文件' },
            { id: 'size', label: videoSizeLabel, title: '分辨率' },
            { id: 'duration', label: formatVideoTime(videoState.duration), title: '时长' },
          ]}
          className="mt-2"
        />
      )}

      {showPreview &&
        videoState.url &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black backdrop-blur-xl animate-in fade-in duration-200"
            onClick={(e) => {
              e.stopPropagation();
              setShowPreview(false);
            }}
          >
            <div className="relative w-screen h-screen flex items-center justify-center">
              <video
                src={videoState.url}
                controls
                autoPlay
                muted
                className="w-full h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />

              {/* 关闭按钮 */}
              <button
                aria-label="关闭视频预览"
                data-testid="video-input-preview-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPreview(false);
                }}
                className="nodrag nowheel absolute top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-black/70"
              >
                <CloseIcon className="w-6 h-6" />
              </button>

              {/* 下载按钮 */}
              <button
                aria-label="保存预览视频到文件管理"
                data-testid="video-input-preview-save"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveToFileManager(e);
                }}
                className="nodrag nowheel absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-6 py-2 text-sm font-medium text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-black/70 active:scale-95"
              >
                保存到文件管理
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

VideoInputNode.displayName = 'VideoInputNode';

export default VideoInputNode;
