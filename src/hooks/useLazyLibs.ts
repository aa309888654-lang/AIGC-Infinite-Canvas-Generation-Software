import { useCallback, useRef, useState } from 'react';

interface LazyLibState<T> {
  lib: T | null;
  isLoading: boolean;
  error: Error | null;
}

export function useLazyLib<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<LazyLibState<T>>({
    lib: null,
    isLoading: false,
    error: null,
  });
  const loadPromiseRef = useRef<Promise<T> | null>(null);

  const load = useCallback(async () => {
    if (state.lib) return state.lib;
    if (state.isLoading && loadPromiseRef.current) return loadPromiseRef.current;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const promise = loader().then(lib => {
      setState({ lib, isLoading: false, error: null });
      return lib;
    }).catch(error => {
      setState({ lib: null, isLoading: false, error: error as Error });
      throw error;
    });

    loadPromiseRef.current = promise;
    return promise;
  }, [loader, state.lib, state.isLoading]);

  return {
    lib: state.lib,
    isLoading: state.isLoading,
    error: state.error,
    load,
  };
}

export async function loadPixiJS() {
  const { Application, Graphics, Container, Text, TextStyle, Sprite, Texture, Assets } = await import('pixi.js');
  return { Application, Graphics, Container, Text, TextStyle, Sprite, Texture, Assets };
}

export async function loadFabricJS() {
  const { Canvas, FabricImage, FabricText, Rect, Circle, Triangle, Line } = await import('fabric');
  return { Canvas, FabricImage, FabricText, Rect, Circle, Triangle, Line };
}

export async function loadFFmpeg() {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
  
  const ffmpeg = new FFmpeg();
  
  const baseURL = RESOURCE_URLS.ffmpegCoreUmd;
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  
  return { ffmpeg, fetchFile };
}

export async function loadToneJS() {
  const Tone = await import('tone');
  return Tone;
}

export async function loadWaveSurfer() {
  const WaveSurfer = (await import('wavesurfer.js')).default;
  return WaveSurfer;
}

export async function loadRecharts() {
  const { 
    LineChart, Line, BarChart, Bar, PieChart, Pie, 
    AreaChart, Area, RadarChart, Radar, 
    ScatterChart, Scatter, ComposedChart, 
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
  } = await import('recharts');
  
  return { 
    LineChart, Line, BarChart, Bar, PieChart, Pie,
    AreaChart, Area, RadarChart, Radar,
    ScatterChart, Scatter, ComposedChart,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
  };
}

import { RESOURCE_URLS } from '../config/resources';

export async function loadOnnxRuntime() {
  const onnx = await import('onnxruntime-web');
  if (onnx.env && onnx.env.wasm) {
    onnx.env.wasm.wasmPaths = `${RESOURCE_URLS.wasm}/`;
  }
  return onnx;
}

export function preloadLibs() {
  if (typeof window === 'undefined') return;
  
  const libs = [
    () => import('tone'),
    () => import('wavesurfer.js'),
    () => import('recharts'),
  ];
  
  libs.forEach(lib => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => lib(), { timeout: 5000 });
    } else {
      setTimeout(lib, 2000);
    }
  });
}
