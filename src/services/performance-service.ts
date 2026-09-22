// 性能优化和GPU加速服务
import { create } from 'zustand';

export interface GPUCapability {
  vendor: string;
  renderer: string;
  supported: boolean;
  features: {
    webgl: boolean;
    webgl2: boolean;
    webgpu: boolean;
    hardwareAcceleration: boolean;
    parallelProcessing: boolean;
  };
  maxTextureSize: number;
  maxViewportDims: number[];
  videoDecoding: 'none' | 'webcodec' | 'media-source';
  videoEncoding: 'none' | 'simd' | 'hardware';
}

export interface CacheConfig {
  maxCacheSize: number; // MB
  currentUsage: number;  // MB
  strategy: 'lru' | 'lfu' | 'fifo';
  preloadAhead: number; // seconds
  backgroundProcessing: boolean;
  autoCleanup: boolean;
  cleanupThreshold: number; // percentage
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;     // ms
  memoryUsage: number;   // MB
  gpuUsage: number;      // percentage
  cpuUsage: number;      // percentage
  networkLatency: number; // ms
  renderTime: number;    // ms
  timestamp: number;
}

export interface PerformanceSettings {
  gpuAcceleration: boolean;
  hardwareVideoDecoding: boolean;
  hardwareVideoEncoding: boolean;
  parallelProcessing: boolean;
  previewQuality: 'full' | 'half' | 'quarter' | 'auto';
  autoOptimization: boolean;
  performanceMode: 'quality' | 'balanced' | 'performance';
  vSync: boolean;
  antiAliasing: boolean;
  maxCacheSize: number;
  preloadThumbnails: boolean;
  thumbnailCacheSize: number;
}

interface PerformanceState {
  gpu: GPUCapability | null;
  cache: CacheConfig;
  metrics: PerformanceMetrics;
  settings: PerformanceSettings;
  isMonitoring: boolean;
  alerts: PerformanceAlert[];
  
  // Actions
  detectGPU: () => Promise<GPUCapability>;
  updateMetrics: (metrics: Partial<PerformanceMetrics>) => void;
  updateCache: (config: Partial<CacheConfig>) => void;
  updateSettings: (settings: Partial<PerformanceSettings>) => void;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  clearCache: () => void;
  optimizeSettings: () => void;
  addAlert: (alert: PerformanceAlert) => void;
  dismissAlert: (id: string) => void;
}

export interface PerformanceAlert {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
  timestamp: number;
}

const defaultSettings: PerformanceSettings = {
  gpuAcceleration: true,
  hardwareVideoDecoding: true,
  hardwareVideoEncoding: false,
  parallelProcessing: true,
  previewQuality: 'auto',
  autoOptimization: true,
  performanceMode: 'balanced',
  vSync: true,
  antiAliasing: true,
  maxCacheSize: 512,
  preloadThumbnails: true,
  thumbnailCacheSize: 128,
};

const defaultCache: CacheConfig = {
  maxCacheSize: 512,
  currentUsage: 0,
  strategy: 'lru',
  preloadAhead: 5,
  backgroundProcessing: true,
  autoCleanup: true,
  cleanupThreshold: 80,
};

// 检测GPU能力
export const detectGPUCapabilities = async (): Promise<GPUCapability> => {
  const capability: GPUCapability = {
    vendor: 'Unknown',
    renderer: 'Unknown',
    supported: false,
    features: {
      webgl: false,
      webgl2: false,
      webgpu: false,
      hardwareAcceleration: false,
      parallelProcessing: false,
    },
    maxTextureSize: 0,
    maxViewportDims: [0, 0],
    videoDecoding: 'none',
    videoEncoding: 'none',
  };

  try {
    // 检测WebGL
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    
    if (gl) {
      capability.features.webgl = true;
      capability.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      capability.maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        capability.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        capability.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
      
      capability.supported = true;
    }
    
    // 检测WebGL2
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      capability.features.webgl2 = true;
    }
    
    // 检测WebGPU
    if ('gpu' in navigator) {
      try {
        const gpu = await (navigator as any).gpu.requestAdapter();
        if (gpu) {
          capability.features.webgpu = true;
        }
      } catch (e) {
        // console.log('WebGPU not supported');
      }
    }
    
    // 检测硬件加速
    capability.features.hardwareAcceleration = capability.features.webgl2;
    
    // 检测视频解码能力
    if (typeof VideoDecoder !== 'undefined') {
      capability.videoDecoding = 'webcodec';
    } else if (typeof HTMLVideoElement !== 'undefined') {
      capability.videoDecoding = 'media-source';
    }
    
    // 检测SIMD支持
    if (typeof WebAssembly !== 'undefined') {
      capability.videoEncoding = 'simd';
    }
    
  } catch (error) {
    console.error('GPU detection failed:', error);
  }
  
  return capability;
};

// 获取性能指标
export const getPerformanceMetrics = (): PerformanceMetrics => {
  const metrics: PerformanceMetrics = {
    fps: 60,
    frameTime: 16.67,
    memoryUsage: 0,
    gpuUsage: 0,
    cpuUsage: 0,
    networkLatency: 0,
    renderTime: 0,
    timestamp: Date.now(),
  };
  
  // 获取内存使用情况
  if ((performance as any).memory) {
    const memory = (performance as any).memory;
    metrics.memoryUsage = Math.round(memory.usedJSHeapSize / (1024 * 1024));
  }
  
  // 获取FPS (如果可用)
  const lastFrameTime = (window as any).__lastFrameTime;
  if (lastFrameTime) {
    metrics.frameTime = Date.now() - lastFrameTime;
    metrics.fps = Math.round(1000 / metrics.frameTime);
  }
  
  return metrics;
};

// 性能优化建议
export const getOptimizationSuggestions = (
  gpu: GPUCapability,
  settings: PerformanceSettings
): string[] => {
  const suggestions: string[] = [];
  
  if (!gpu.supported) {
    suggestions.push('GPU不支持，建议升级浏览器以获得更好的性能');
  }
  
  if (!gpu.features.webgl2) {
    suggestions.push('WebGL 2.0不可用，某些高级效果可能无法使用');
  }
  
  if (!gpu.features.hardwareAcceleration) {
    suggestions.push('建议启用硬件加速以提升视频处理速度');
  }
  
  if (settings.performanceMode === 'quality') {
    suggestions.push('当前为质量优先模式，如需提升性能可切换为均衡或性能模式');
  }
  
  return suggestions;
};

export const usePerformanceStore = create<PerformanceState>((set, get) => ({
  gpu: null,
  cache: defaultCache,
  metrics: {
    fps: 60,
    frameTime: 16.67,
    memoryUsage: 0,
    gpuUsage: 0,
    cpuUsage: 0,
    networkLatency: 0,
    renderTime: 0,
    timestamp: Date.now(),
  },
  settings: defaultSettings,
  isMonitoring: false,
  alerts: [],

  detectGPU: async () => {
    const gpu = await detectGPUCapabilities();
    set({ gpu });
    return gpu;
  },
  
  updateMetrics: (metrics) => set((state) => ({
    metrics: { ...state.metrics, ...metrics },
  })),
  
  updateCache: (config) => set((state) => ({
    cache: { ...state.cache, ...config },
  })),
  
  updateSettings: (settings) => set((state) => ({
    settings: { ...state.settings, ...settings },
  })),
  
  startMonitoring: () => {
    set({ isMonitoring: true });
    
    const updateMetrics = () => {
      if (!get().isMonitoring) return;
      
      const metrics = getPerformanceMetrics();
      get().updateMetrics(metrics);
      
      // 检查性能警报
      if (metrics.fps < 30) {
        get().addAlert({
          id: `fps-${Date.now()}`,
          type: 'warning',
          message: `帧率过低: ${metrics.fps} FPS`,
          suggestion: '建议降低预览质量或关闭硬件加速',
          timestamp: Date.now(),
        });
      }
      
      if (metrics.memoryUsage > get().cache.maxCacheSize * 0.9) {
        get().addAlert({
          id: `memory-${Date.now()}`,
          type: 'error',
          message: `内存使用过高: ${metrics.memoryUsage}MB`,
          suggestion: '建议清理缓存或重启应用',
          timestamp: Date.now(),
        });
      }
      
      requestAnimationFrame(updateMetrics);
    };
    
    updateMetrics();
  },
  
  stopMonitoring: () => set({ isMonitoring: false }),
  
  clearCache: () => {
    // 清理各种缓存
    if (caches) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    
    // 清理图片缓存
    const images = document.querySelectorAll('img');
    images.forEach((img) => {
      img.src = '';
    });
    
    set((state) => ({
      cache: { ...state.cache, currentUsage: 0 },
    }));
    
    get().addAlert({
      id: `clear-${Date.now()}`,
      type: 'info',
      message: '缓存已清理',
      timestamp: Date.now(),
    });
  },
  
  optimizeSettings: () => {
    const { gpu } = get();
    
    if (!gpu?.supported) {
      // GPU不支持时的优化
      set((state) => ({
        settings: {
          ...state.settings,
          gpuAcceleration: false,
          previewQuality: 'quarter',
          antiAliasing: false,
          performanceMode: 'performance',
        },
      }));
    } else if (gpu.features.webgl2) {
      // 启用所有优化
      set((state) => ({
        settings: {
          ...state.settings,
          gpuAcceleration: true,
          hardwareVideoDecoding: true,
          previewQuality: 'auto',
          performanceMode: 'balanced',
        },
      }));
    }
    
    get().addAlert({
      id: `optimize-${Date.now()}`,
      type: 'info',
      message: '性能设置已优化',
      suggestion: '已根据您的硬件配置自动调整',
      timestamp: Date.now(),
    });
  },
  
  addAlert: (alert) => set((state) => ({
    alerts: [...state.alerts, alert].slice(-10), // 保留最近10条
  })),
  
  dismissAlert: (id) => set((state) => ({
    alerts: state.alerts.filter((a) => a.id !== id),
  })),
}));
