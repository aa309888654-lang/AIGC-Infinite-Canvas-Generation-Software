/**
 * 智能场景检测服务
 * 分析视频内容，识别场景切换并提供剪辑建议
 */

export interface SceneSegment {
  id: string;
  startTime: number;
  endTime: number;
  type: 'cut' | 'gradual' | 'motion';
  confidence: number;
  thumbnail?: string;
  description?: string;
}

export interface SceneDetectionOptions {
  sensitivity: number; // 0-1, 检测灵敏度
  minSceneDuration: number; // 最小场景时长（秒）
  detectGradual: boolean; // 是否检测渐变转场
  generateThumbnails: boolean; // 是否生成缩略图
}

export interface SceneDetectionResult {
  success: boolean;
  scenes: SceneSegment[];
  totalDuration: number;
  sceneCount: number;
  error?: string;
}

const INV_255 = 1 / 255;

class SceneDetectionService {
  private static instance: SceneDetectionService;
  private defaultOptions: SceneDetectionOptions = {
    sensitivity: 0.5,
    minSceneDuration: 1.0,
    detectGradual: true,
    generateThumbnails: false,
  };

  private constructor() { /* noop */ }

  public static getInstance(): SceneDetectionService {
    if (!SceneDetectionService.instance) {
      SceneDetectionService.instance = new SceneDetectionService();
    }
    return SceneDetectionService.instance;
  }

  /**
   * 从视频文件检测场景
   */
  async detectScenes(
    videoFile: File,
    options: Partial<SceneDetectionOptions> = {},
    signal?: AbortSignal
  ): Promise<SceneDetectionResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      
      const videoUrl = URL.createObjectURL(videoFile);
      try {
        const duration = await this.getVideoDuration(videoUrl);
        
        const scenes = await this.analyzeVideoFrames(videoUrl, duration, opts, signal);
        
        URL.revokeObjectURL(videoUrl);
        
        return {
          success: true,
          scenes,
          totalDuration: duration,
          sceneCount: scenes.length,
        };
      } catch (innerError) {
        URL.revokeObjectURL(videoUrl);
        throw innerError;
      }
    } catch (error) {
      console.error('[场景检测] 分析失败:', error);
      return {
        success: false,
        scenes: [],
        totalDuration: 0,
        sceneCount: 0,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 分析视频帧
   */
  private async analyzeVideoFrames(
    videoUrl: string,
    duration: number,
    options: SceneDetectionOptions,
    signal?: AbortSignal
  ): Promise<SceneSegment[]> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'));
        return;
      }
      
      const scenes: SceneSegment[] = [];
      let lastFrameData: ImageData | null = null;
      let sceneId = 0;
      
      const sampleInterval = 1.0;
      const threshold = 1 - options.sensitivity;
      const cutThreshold = threshold * 1.4;
      
      const analyzeFrame = (currentTime: number) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        
        if (currentTime >= duration) {
          if (scenes.length > 0) {
            scenes[scenes.length - 1].endTime = duration;
          }
          resolve(scenes);
          return;
        }
        
        video.currentTime = currentTime;
      };
      
      video.onseeked = () => {
        if (!ctx) return;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const currentFrameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        if (!lastFrameData) {
          lastFrameData = currentFrameData;
          scenes.push({
            id: `scene-${sceneId++}`,
            startTime: 0,
            endTime: 0,
            type: 'cut',
            confidence: 1.0,
          });
          analyzeFrame(video.currentTime + sampleInterval);
          return;
        }
        
        const diff = this.calculateFrameDifference(lastFrameData, currentFrameData);
        
        if (diff > threshold) {
          const lastScene = scenes[scenes.length - 1];
          if (lastScene) {
            lastScene.endTime = video.currentTime;
            lastScene.confidence = 1 - diff;
          }
          
          if (video.currentTime - lastScene.startTime >= options.minSceneDuration) {
            scenes.push({
              id: `scene-${sceneId++}`,
              startTime: video.currentTime,
              endTime: duration,
              type: diff > cutThreshold ? 'cut' : 'gradual',
              confidence: diff,
            });
          } else {
            lastScene.endTime = duration;
          }
          
          lastFrameData = currentFrameData;
        }
        
        setTimeout(() => {
          analyzeFrame(video.currentTime + sampleInterval);
        }, 10);
      };
      
      video.onerror = () => {
        reject(new Error('无法加载视频'));
      };
      
      video.onloadedmetadata = () => {
        const vw = video.videoWidth || 160;
        const vh = video.videoHeight || 90;
        const aspect = vw / vh;
        let cw = 320;
        let ch = 180;
        if (aspect > 16 / 9) {
          ch = Math.round(cw / aspect);
        } else {
          cw = Math.round(ch * aspect);
        }
        canvas.width = Math.min(cw, 320);
        canvas.height = Math.min(ch, 180);
        video.currentTime = 0;
      };
      
      video.src = videoUrl;
    });
  }

  /**
   * 计算两帧之间的差异
   */
  private calculateFrameDifference(frame1: ImageData, frame2: ImageData): number {
    const data1 = frame1.data;
    const data2 = frame2.data;
    
    let diff = 0;
    const pixelCount = data1.length / 4;
    
    const sampleRate = 4;
    
    for (let i = 0; i < data1.length; i += 4 * sampleRate) {
      const rDiff = Math.abs(data1[i] - data2[i]) * INV_255;
      const gDiff = Math.abs(data1[i + 1] - data2[i + 1]) * INV_255;
      const bDiff = Math.abs(data1[i + 2] - data2[i + 2]) * INV_255;
      
      diff += (rDiff * 0.299 + gDiff * 0.587 + bDiff * 0.114);
    }
    
    return diff / (pixelCount / sampleRate);
  }

  /**
   * 获取视频时长
   */
  private getVideoDuration(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve(video.duration);
      };
      video.onerror = () => {
        reject(new Error('无法加载视频'));
      };
      video.src = url;
    });
  }

  /**
   * 生成缩略图
   */
  async generateThumbnail(
    videoFile: File,
    time: number
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(null);
        return;
      }
      
      canvas.width = 160;
      canvas.height = 90;
      
      const objectUrl = URL.createObjectURL(videoFile);
      
      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(time, video.duration);
      };
      
      video.src = objectUrl;
    });
  }

  /**
   * 智能推荐剪辑点
   */
  getSuggestedCutPoints(
    scenes: SceneSegment[],
    targetCount: number = 5
  ): number[] {
    if (scenes.length <= targetCount) {
      return scenes.map(s => s.startTime);
    }
    
    const sortedScenes = [...scenes].sort((a, b) => b.confidence - a.confidence);
    return sortedScenes.slice(0, targetCount).sort((a, b) => a.startTime - b.startTime).map(s => s.startTime);
  }

  async detectScenesFromUrl(
    url: string,
    options: Partial<SceneDetectionOptions> = {},
    signal?: AbortSignal
  ): Promise<SceneDetectionResult> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const response = await fetch(url, { signal });
      const blob = await response.blob();
      const file = new File([blob], 'video', { type: blob.type || 'video/mp4' });
      return this.detectScenes(file, opts, signal);
    } catch (error) {
      console.error('[场景检测] URL分析失败:', error);
      return {
        success: false,
        scenes: [],
        totalDuration: 0,
        sceneCount: 0,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }
}

export const sceneDetectionService = SceneDetectionService.getInstance();
export default sceneDetectionService;
