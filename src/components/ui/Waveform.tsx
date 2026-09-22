import React, { useRef, useEffect, useState, useCallback } from 'react';

interface WaveformProps {
  audioUrl: string;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  height?: number;
  barWidth?: number;
  barGap?: number;
  activeColor?: string;
  inactiveColor?: string;
}

const Waveform: React.FC<WaveformProps> = ({
  audioUrl,
  currentTime,
  duration,
  onSeek,
  isPlaying,
  height = 60,
  barWidth = 3,
  barGap = 2,
  activeColor = '#6366f1',
  inactiveColor = '#4b5563',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadWaveform = useCallback(async () => {
    if (!audioUrl) return;

    try {
      setIsLoading(true);
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const samples = 200;
      const blockSize = Math.floor(channelData.length / samples);
      const filteredData: number[] = [];

      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[i * blockSize + j]);
        }
        filteredData.push(sum / blockSize);
      }

      const maxVal = Math.max(...filteredData);
      const normalizedData = filteredData.map(v => v / maxVal);
      setWaveformData(normalizedData);
      setIsLoading(false);

      audioContext.close();
    } catch (error) {
      console.error('[Waveform] Failed to load audio:', error);
      setIsLoading(false);
    }
  }, [audioUrl]);

  useEffect(() => {
    loadWaveform();
  }, [loadWaveform]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    const progress = duration > 0 ? currentTime / duration : 0;
    const progressIndex = Math.floor(progress * waveformData.length);

    const totalBarWidth = barWidth + barGap;
    const barsCount = Math.floor(rect.width / totalBarWidth);

    for (let i = 0; i < barsCount; i++) {
      const dataIndex = Math.floor((i / barsCount) * waveformData.length);
      const barHeight = Math.max(4, waveformData[dataIndex] * rect.height * 0.8);
      const x = i * totalBarWidth;
      const y = (rect.height - barHeight) / 2;

      ctx.fillStyle = i <= progressIndex ? activeColor : inactiveColor;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
      ctx.fill();
    }
  }, [waveformData, currentTime, duration, barWidth, barGap, activeColor, inactiveColor]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * duration;
    onSeek(newTime);
  };

  if (isLoading) {
    return (
      <div 
        className="w-full rounded-lg bg-gray-800/50 animate-pulse"
        style={{ height }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full cursor-pointer rounded-lg"
      style={{ height }}
      onClick={handleClick}
    />
  );
};

export default Waveform;
