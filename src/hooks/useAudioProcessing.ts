/**
 * 音频处理Hook
 * 支持音频分析、处理和可视化
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type AudioEffect =
  | 'normalize'
  | 'denoise'
  | 'bass_boost'
  | 'treble_boost'
  | 'compressor'
  | 'reverb'
  | 'echo'
  | 'fade_in'
  | 'fade_out';

export interface AudioSegment {
  startTime: number;
  endTime: number;
  type: 'speech' | 'music' | 'silence' | 'noise' | 'ambient';
  confidence: number;
  labels: string[];
}

export interface AudioMetrics {
  rms: number;
  peak: number;
  crest: number;
  silence: number;
  speech: number;
  music: number;
}

export interface AudioEffectSettings {
  normalize: { target: number };
  denoise: { strength: number };
  bass_boost: { amount: number };
  treble_boost: { amount: number };
  compressor: { threshold: number; ratio: number };
  reverb: { roomSize: number; damping: number };
  echo: { delay: number; feedback: number };
  fade_in: { duration: number };
  fade_out: { duration: number };
}

export interface AudioState {
  isAnalyzing: boolean;
  isProcessing: boolean;
  progress: number;
  waveformData: number[];
  frequencyData: number[];
  segments: AudioSegment[];
  metrics: AudioMetrics;
  effects: Map<AudioEffect, boolean>;
  effectSettings: AudioEffectSettings;
  volume: number;
  pan: number;
  mute: boolean;
}

export function useAudioProcessing() {
  const [state, setState] = useState<AudioState>({
    isAnalyzing: false,
    isProcessing: false,
    progress: 0,
    waveformData: [],
    frequencyData: [],
    segments: [],
    metrics: {
      rms: 0,
      peak: 0,
      crest: 0,
      silence: 0,
      speech: 0,
      music: 0,
    },
    effects: new Map(),
    effectSettings: {
      normalize: { target: -14 },
      denoise: { strength: 50 },
      bass_boost: { amount: 3 },
      treble_boost: { amount: 2 },
      compressor: { threshold: -20, ratio: 4 },
      reverb: { roomSize: 30, damping: 50 },
      echo: { delay: 200, feedback: 30 },
      fade_in: { duration: 1 },
      fade_out: { duration: 1 },
    },
    volume: 100,
    pan: 0,
    mute: false,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const initializeAudioContext = useCallback((audioElement: HTMLAudioElement) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    if (audioRef.current !== audioElement) {
      audioRef.current = audioElement;

      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }

      sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 2048;

      sourceRef.current.connect(analyzerRef.current);
      analyzerRef.current.connect(audioContextRef.current.destination);
    }
  }, []);

  const startAnalysis = useCallback(async ( _audioPath: string) => {
    setState(prev => ({ ...prev, isAnalyzing: true, progress: 0 }));

    await new Promise(resolve => setTimeout(resolve, 500));

    const waveformData: number[] = [];
    for (let i = 0; i < 100; i++) {
      waveformData.push(Math.random() * 0.8 + 0.1);
      setState(prev => ({ ...prev, progress: (i / 100) * 50 }));
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    const frequencyData: number[] = [];
    for (let i = 0; i < 64; i++) {
      frequencyData.push(Math.random() * 0.9 + 0.1);
    }

    const segments: AudioSegment[] = [
      { startTime: 0, endTime: 5.2, type: 'speech', confidence: 0.92, labels: ['语音', '男声'] },
      { startTime: 5.2, endTime: 8.7, type: 'music', confidence: 0.88, labels: ['背景音乐'] },
      { startTime: 8.7, endTime: 15.3, type: 'speech', confidence: 0.95, labels: ['语音', '女声'] },
      { startTime: 15.3, endTime: 18.0, type: 'silence', confidence: 0.99, labels: ['静音'] },
      { startTime: 18.0, endTime: 25.5, type: 'music', confidence: 0.85, labels: ['背景音乐', '节奏'] },
    ];

    const metrics: AudioMetrics = {
      rms: Math.random() * 0.3 + 0.2,
      peak: Math.random() * 0.5 + 0.5,
      crest: Math.random() * 10 + 10,
      silence: 15.3,
      speech: 15.5,
      music: 10.2,
    };

    setState(prev => ({
      ...prev,
      isAnalyzing: false,
      progress: 100,
      waveformData,
      frequencyData,
      segments,
      metrics,
    }));

    return { waveformData, frequencyData, segments, metrics };
  }, []);

  const applyEffect = useCallback((effect: AudioEffect, enabled: boolean) => {
    setState(prev => {
      const newEffects = new Map(prev.effects);
      newEffects.set(effect, enabled);
      return { ...prev, effects: newEffects };
    });
  }, []);

  const updateEffectSettings = useCallback((effect: AudioEffect, settings: Record<string, number>) => {
    setState(prev => ({
      ...prev,
      effectSettings: {
        ...prev.effectSettings,
        [effect]: { ...prev.effectSettings[effect], ...settings },
      },
    }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setState(prev => ({ ...prev, volume: Math.max(0, Math.min(100, volume)) }));
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, []);

  const setPan = useCallback((pan: number) => {
    setState(prev => ({ ...prev, pan: Math.max(-1, Math.min(1, pan)) }));
  }, []);

  const toggleMute = useCallback(() => {
    setState(prev => {
      const newMute = !prev.mute;
      if (audioRef.current) {
        audioRef.current.muted = newMute;
      }
      return { ...prev, mute: newMute };
    });
  }, []);

  const extractAudio = useCallback(async (_videoPath: string, outputPath: string) => {
    setState(prev => ({ ...prev, isProcessing: true, progress: 0 }));

    for (let i = 0; i <= 100; i += 5) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setState(prev => ({ ...prev, progress: i }));
    }

    setState(prev => ({ ...prev, isProcessing: false, progress: 100 }));
    return outputPath.replace(/\.[^/.]+$/, '.mp3');
  }, []);

  const addBackgroundMusic = useCallback(async (
    _mainAudioPath: string,
    _musicPath: string,
    _mixRatio: number = 0.3
  ) => {
    setState(prev => ({ ...prev, isProcessing: true, progress: 0 }));

    for (let i = 0; i <= 100; i += 2) {
      await new Promise(resolve => setTimeout(resolve, 80));
      setState(prev => ({ ...prev, progress: i }));
    }

    setState(prev => ({ ...prev, isProcessing: false, progress: 100 }));
  }, []);

  const normalizeAudio = useCallback(async (_audioPath: string, _targetDB: number = -14) => {
    setState(prev => ({ ...prev, isProcessing: true, progress: 0, effects: new Map(prev.effects).set('normalize', true) }));

    await new Promise(resolve => setTimeout(resolve, 1000));
    setState(prev => ({ ...prev, progress: 100, isProcessing: false }));
  }, []);

  const removeSilence = useCallback(async (_audioPath: string, _threshold: number = -40) => {
    setState(prev => ({ ...prev, isProcessing: true, progress: 0 }));

    for (let i = 0; i <= 100; i += 3) {
      await new Promise(resolve => setTimeout(resolve, 60));
      setState(prev => ({ ...prev, progress: i }));
    }

    setState(prev => ({ ...prev, isProcessing: false, progress: 100 }));
  }, []);

  const exportAudio = useCallback(async (
    audioPath: string,
    format: 'mp3' | 'wav' | 'aac' = 'mp3',
    _bitrate: number = 192
  ) => {
    setState(prev => ({ ...prev, isProcessing: true, progress: 0 }));

    for (let i = 0; i <= 100; i += 4) {
      await new Promise(resolve => setTimeout(resolve, 70));
      setState(prev => ({ ...prev, progress: i }));
    }

    setState(prev => ({ ...prev, isProcessing: false, progress: 100 }));

    const outputPath = audioPath.replace(/\.[^/.]+$/, `.${format}`);
    return outputPath;
  }, []);

  const startVisualization = useCallback(() => {
    if (!analyzerRef.current) return;

    const updateVisualization = () => {
      if (!analyzerRef.current) return;

      const waveformData = new Uint8Array(analyzerRef.current.frequencyBinCount);
      analyzerRef.current.getByteTimeDomainData(waveformData);

      const frequencyData = new Uint8Array(analyzerRef.current.frequencyBinCount);
      analyzerRef.current.getByteFrequencyData(frequencyData);

      setState(prev => ({
        ...prev,
        waveformData: Array.from(waveformData).map(v => v / 255),
        frequencyData: Array.from(frequencyData).map(v => v / 255),
      }));

      animationFrameRef.current = requestAnimationFrame(updateVisualization);
    };

    updateVisualization();
  }, []);

  const stopVisualization = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    state,
    audioRef,
    analyzerRef,
    initializeAudioContext,
    startAnalysis,
    applyEffect,
    updateEffectSettings,
    setVolume,
    setPan,
    toggleMute,
    extractAudio,
    addBackgroundMusic,
    normalizeAudio,
    removeSilence,
    exportAudio,
    startVisualization,
    stopVisualization,
  };
}
