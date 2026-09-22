import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface WaveformVisualizerProps {
  audioUrl: string;
  progress: number;
  onSeek: (progress: number) => void;
  isPlaying?: boolean;
  height?: number;
  barColor?: string;
  progressColor?: string;
  className?: string;
}

export function WaveformVisualizer({
  audioUrl,
  progress,
  onSeek,
  isPlaying = false,
  height = 48,
  barColor = '#4a4a5a',
  progressColor = '#8b5cf6',
  className,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const generateWaveform = useCallback(async () => {
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const samples = 100;
      const blockSize = Math.floor(channelData.length / samples);
      const data: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        const start = i * blockSize;
        let max = 0;
        for (let j = 0; j < blockSize; j++) {
          max = Math.max(max, Math.abs(channelData[start + j] || 0));
        }
        data.push(max);
      }
      
      setWaveformData(data);
      setIsLoading(false);
      audioContext.close();
    } catch (error) {
      console.warn('Failed to generate waveform:', error);
      const dummyData = Array(100).fill(0).map(() => Math.random() * 0.3 + 0.1);
      setWaveformData(dummyData);
      setIsLoading(false);
    }
  }, [audioUrl]);

  useEffect(() => {
    generateWaveform();
  }, [generateWaveform]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const barWidth = width / waveformData.length;
    const centerY = height / 2;
    const maxAmplitude = centerY * 0.9;

    ctx.clearRect(0, 0, width, height);

    waveformData.forEach((value, index) => {
      const x = index * barWidth;
      const barHeight = Math.max(2, value * maxAmplitude);
      const progressX = (progress / 100) * width;

      if (x < progressX) {
        ctx.fillStyle = progressColor;
        ctx.globalAlpha = 0.9;
      } else {
        ctx.fillStyle = barColor;
        ctx.globalAlpha = 0.6;
      }

      ctx.beginPath();
      ctx.roundRect(
        x + 1,
        centerY - barHeight,
        Math.max(2, barWidth - 2),
        barHeight * 2,
        2
      );
      ctx.fill();
    });

    ctx.globalAlpha = 1;
  }, [waveformData, progress, height, barColor, progressColor]);

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const newProgress = (x / rect.width) * 100;
    onSeek(Math.max(0, Math.min(100, newProgress)));
  }, [onSeek]);

  if (isLoading) {
    return (
      <div
        className={cn('flex items-center justify-center bg-white/5 rounded-lg', className)}
        style={{ height }}
      >
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-violet-500/50 rounded-full animate-pulse"
              style={{
                height: `${20 + Math.random() * 20}px`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative cursor-pointer group rounded-lg overflow-hidden bg-white/5',
        className
      )}
      style={{ height }}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
      
      <div
        className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-violet-500/20 to-transparent pointer-events-none transition-all"
        style={{ width: `${progress}%` }}
      />

      <div
        className="absolute top-0 bottom-0 w-0.5 bg-violet-500 shadow-lg shadow-violet-500/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ left: `${progress}%` }}
      />

      <div
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg shadow-violet-500/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ left: `calc(${progress}% - 6px)` }}
      />
    </div>
  );
}

export default WaveformVisualizer;
