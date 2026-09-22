/**
 * 视频对比Hook
 * 支持原始视频和处理后视频的对比查看
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type ComparisonMode = 'side-by-side' | 'before-after' | 'slider' | 'toggle' | 'overlay';

export interface ComparisonState {
  mode: ComparisonMode;
  sliderPosition: number;
  syncPlayback: boolean;
  showOriginal: boolean;
  zoom: number;
  pan: { x: number; y: number };
  highlightedDifferences: boolean;
}

export interface FrameData {
  timestamp: number;
  original: ImageBitmap | null;
  processed: ImageBitmap | null;
  difference: number;
}

export function useVideoComparison() {
  const [state, setState] = useState<ComparisonState>({
    mode: 'side-by-side',
    sliderPosition: 50,
    syncPlayback: true,
    showOriginal: true,
    zoom: 1,
    pan: { x: 0, y: 0 },
    highlightedDifferences: false,
  });

  const [originalDuration, _setOriginalDuration] = useState(0);
  const [processedDuration, _setProcessedDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameData, _setFrameData] = useState<FrameData[]>([]);

  const originalVideoRef = useRef<HTMLVideoElement | null>(null);
  const processedVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const setMode = useCallback((mode: ComparisonMode) => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  const setSliderPosition = useCallback((position: number) => {
    setState(prev => ({ ...prev, sliderPosition: Math.max(0, Math.min(100, position)) }));
  }, []);

  const toggleSyncPlayback = useCallback(() => {
    setState(prev => ({ ...prev, syncPlayback: !prev.syncPlayback }));
  }, []);

  const toggleShowOriginal = useCallback(() => {
    setState(prev => ({ ...prev, showOriginal: !prev.showOriginal }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState(prev => ({ ...prev, zoom: Math.max(0.5, Math.min(4, zoom)) }));
  }, []);

  const setPan = useCallback((x: number, y: number) => {
    setState(prev => ({ ...prev, pan: { x, y } }));
  }, []);

  const resetView = useCallback(() => {
    setState(prev => ({
      ...prev,
      zoom: 1,
      pan: { x: 0, y: 0 },
    }));
  }, []);

  const toggleHighlightDifferences = useCallback(() => {
    setState(prev => ({ ...prev, highlightedDifferences: !prev.highlightedDifferences }));
  }, []);

  const loadVideos = useCallback((originalSrc: string, processedSrc: string) => {
    if (originalVideoRef.current) {
      originalVideoRef.current.src = originalSrc;
    }
    if (processedVideoRef.current) {
      processedVideoRef.current.src = processedSrc;
    }
  }, []);

  const syncPlay = useCallback(() => {
    if (originalVideoRef.current && processedVideoRef.current && state.syncPlayback) {
      const currentTime = originalVideoRef.current.currentTime;
      processedVideoRef.current.currentTime = currentTime;
    }
    setIsPlaying(true);

    if (originalVideoRef.current) {
      originalVideoRef.current.play();
    }
    if (processedVideoRef.current && state.syncPlayback) {
      processedVideoRef.current.play();
    }
  }, [state.syncPlayback]);

  const syncPause = useCallback(() => {
    setIsPlaying(false);

    if (originalVideoRef.current) {
      originalVideoRef.current.pause();
    }
    if (processedVideoRef.current) {
      processedVideoRef.current.pause();
    }
  }, []);

  const syncSeek = useCallback((time: number) => {
    setCurrentTime(time);

    if (originalVideoRef.current) {
      originalVideoRef.current.currentTime = time;
    }
    if (processedVideoRef.current && state.syncPlayback) {
      processedVideoRef.current.currentTime = time;
    }
  }, [state.syncPlayback]);

  const captureFrame = useCallback(async (video: 'original' | 'processed' | 'both', _timestamp?: number) => {
    const videoEl = video === 'original' ? originalVideoRef.current :
                    video === 'processed' ? processedVideoRef.current : null;

    if (videoEl && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = videoEl.videoWidth;
        canvasRef.current.height = videoEl.videoHeight;

        if (video === 'both') {
          if (originalVideoRef.current && processedVideoRef.current) {
            const halfWidth = videoEl.videoWidth / 2;
            ctx.drawImage(originalVideoRef.current, 0, 0, halfWidth, videoEl.videoHeight);
            ctx.drawImage(processedVideoRef.current, halfWidth, 0, halfWidth, videoEl.videoHeight);
          }
        } else {
          ctx.drawImage(videoEl, 0, 0);
        }

        return canvasRef.current.toDataURL('image/png');
      }
    }
    return null;
  }, []);

  const analyzeDifferences = useCallback(async () => {
    if (!originalVideoRef.current || !processedVideoRef.current) return;

    const differences: { timestamp: number; diff: number }[] = [];
    const originalCanvas = document.createElement('canvas');
    const processedCanvas = document.createElement('canvas');

    originalCanvas.width = originalVideoRef.current.videoWidth;
    originalCanvas.height = originalVideoRef.current.videoHeight;
    processedCanvas.width = processedVideoRef.current.videoWidth;
    processedCanvas.height = processedVideoRef.current.videoHeight;

    const originalCtx = originalCanvas.getContext('2d');
    const processedCtx = processedCanvas.getContext('2d');

    if (!originalCtx || !processedCtx) return;

    const duration = originalVideoRef.current.duration;
    const sampleInterval = 1;

    for (let time = 0; time < duration; time += sampleInterval) {
      originalVideoRef.current.currentTime = time;
      processedVideoRef.current.currentTime = time;

      await new Promise(resolve => setTimeout(resolve, 100));

      originalCtx.drawImage(originalVideoRef.current, 0, 0);
      processedCtx.drawImage(processedVideoRef.current, 0, 0);

      const originalData = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
      const processedData = processedCtx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);

      let diff = 0;
      const pixelCount = originalData.data.length / 4;

      for (let i = 0; i < originalData.data.length; i += 4) {
        const r = Math.abs(originalData.data[i] - processedData.data[i]);
        const g = Math.abs(originalData.data[i + 1] - processedData.data[i + 1]);
        const b = Math.abs(originalData.data[i + 2] - processedData.data[i + 2]);
        diff += (r + g + b) / 3;
      }

      diff = diff / pixelCount / 255 * 100;
      differences.push({ timestamp: time, diff });
    }

    return differences;
  }, []);

  const exportComparison = useCallback(async (format: 'png' | 'jpg' = 'png') => {
    const dataUrl = await captureFrame('both');
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `comparison_${Date.now()}.${format}`;
      link.href = dataUrl;
      link.click();
    }
  }, [captureFrame]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    state,
    originalDuration,
    processedDuration,
    currentTime,
    isPlaying,
    frameData,
    originalVideoRef,
    processedVideoRef,
    canvasRef,
    setMode,
    setSliderPosition,
    toggleSyncPlayback,
    toggleShowOriginal,
    setZoom,
    setPan,
    resetView,
    toggleHighlightDifferences,
    loadVideos,
    syncPlay,
    syncPause,
    syncSeek,
    captureFrame,
    analyzeDifferences,
    exportComparison,
  };
}
