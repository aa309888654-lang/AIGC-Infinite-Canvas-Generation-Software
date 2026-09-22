/**
 * 视频处理引擎 - 基于 FFmpeg.wasm
 * 提供小天 AI 剪辑板块的视频编辑能力
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { RESOURCE_URLS } from '@/config/resources';

export interface VideoProcessOptions {
  onProgress?: (progress: number) => void;
  onLog?: (message: string) => void;
}

class VideoEngine {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;

  /**
   * 初始化 FFmpeg
   */
  async initialize(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // console.log('[VideoEngine] 初始化 FFmpeg...');
      
      this.ffmpeg = new FFmpeg();
      
      this.ffmpeg.on('log', ({ message }) => {
        // console.log('[FFmpeg]', message);
      });

      this.ffmpeg.on('progress', ({ progress: progress }) => {
        // console.log('[FFmpeg] 进度:', (progress * 100).toFixed(2) + '%');
      });

      const baseURL = RESOURCE_URLS.ffmpegCoreUmd;
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
      // console.log('[VideoEngine] FFmpeg 初始化完成');
    } catch (error) {
      console.error('[VideoEngine] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 将 FFmpeg 输出转换为 Blob
   */
  private dataToBlob(data: Uint8Array | string, mimeType: string): Blob {
    if (typeof data === 'string') {
      return new Blob([data], { type: mimeType });
    }
    // Convert Uint8Array to regular array to avoid ArrayBufferLike type issues
    return new Blob([new Uint8Array(data)], { type: mimeType });
  }

  /**
   * 剪切视频
   */
  async cutVideo(
    videoUrl: string,
    startTime: number,
    duration: number,
    options?: VideoProcessOptions
  ): Promise<Blob> {
    if (!this.ffmpeg) throw new Error('FFmpeg 未初始化');

    try {
      options?.onLog?.('开始剪切视频...');
      options?.onProgress?.(0);

      // 加载视频文件
      const videoData = await fetchFile(videoUrl);
      await this.ffmpeg.writeFile('input.mp4', videoData);

      // 执行剪切命令
      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-c', 'copy',
        'output.mp4'
      ]);

      // 读取输出文件
      const data = await this.ffmpeg.readFile('output.mp4') as Uint8Array;
      const blob = this.dataToBlob(data, 'video/mp4');

      options?.onLog?.('视频剪切完成');
      options?.onProgress?.(100);

      return blob;
    } catch (error) {
      options?.onLog?.(`剪切失败: ${error}`);
      throw error;
    }
  }

  /**
   * 合并多个视频
   */
  async mergeVideos(
    videoUrls: string[],
    options?: VideoProcessOptions
  ): Promise<Blob> {
    if (!this.ffmpeg) throw new Error('FFmpeg 未初始化');

    try {
      options?.onLog?.('开始合并视频...');
      options?.onProgress?.(0);

      // 加载所有视频
      for (let i = 0; i < videoUrls.length; i++) {
        const videoData = await fetchFile(videoUrls[i]);
        await this.ffmpeg.writeFile(`input${i}.mp4`, videoData);
        options?.onProgress?.((i / videoUrls.length) * 50);
      }

      // 创建合并列表
      const fileList = videoUrls.map((_, i) => `file 'input${i}.mp4'`).join('\n');
      await this.ffmpeg.writeFile('filelist.txt', fileList);

      // 执行合并
      await this.ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'filelist.txt',
        '-c', 'copy',
        'output.mp4'
      ]);

      const data = await this.ffmpeg.readFile('output.mp4') as Uint8Array;
      const blob = this.dataToBlob(data, 'video/mp4');

      options?.onLog?.('视频合并完成');
      options?.onProgress?.(100);

      return blob;
    } catch (error) {
      options?.onLog?.(`合并失败: ${error}`);
      throw error;
    }
  }

  /**
   * 提取音频
   */
  async extractAudio(
    videoUrl: string,
    options?: VideoProcessOptions
  ): Promise<Blob> {
    if (!this.ffmpeg) throw new Error('FFmpeg 未初始化');

    try {
      options?.onLog?.('提取音频...');
      
      const videoData = await fetchFile(videoUrl);
      await this.ffmpeg.writeFile('input.mp4', videoData);

      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-vn',
        '-acodec', 'libmp3lame',
        'output.mp3'
      ]);

      const data = await this.ffmpeg.readFile('output.mp3') as Uint8Array;
      const blob = this.dataToBlob(data, 'audio/mp3');

      options?.onLog?.('音频提取完成');
      return blob;
    } catch (error) {
      options?.onLog?.(`提取失败: ${error}`);
      throw error;
    }
  }

  /**
   * 生成缩略图
   */
  async generateThumbnail(
    videoUrl: string,
    timeInSeconds: number = 0,
    options?: VideoProcessOptions
  ): Promise<string> {
    if (!this.ffmpeg) throw new Error('FFmpeg 未初始化');

    try {
      options?.onLog?.('生成缩略图...');
      
      const videoData = await fetchFile(videoUrl);
      await this.ffmpeg.writeFile('input.mp4', videoData);

      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-ss', timeInSeconds.toString(),
        '-vframes', '1',
        'thumbnail.jpg'
      ]);

      const data = await this.ffmpeg.readFile('thumbnail.jpg') as Uint8Array;
      const blob = this.dataToBlob(data, 'image/jpeg');
      const url = URL.createObjectURL(blob);

      options?.onLog?.('缩略图生成完成');
      return url;
    } catch (error) {
      options?.onLog?.(`生成失败: ${error}`);
      throw error;
    }
  }

  /**
   * 添加水印
   */
  async addWatermark(
    videoUrl: string,
    watermarkUrl: string,
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right',
    options?: VideoProcessOptions
  ): Promise<Blob> {
    if (!this.ffmpeg) throw new Error('FFmpeg 未初始化');

    try {
      options?.onLog?.('添加水印...');
      
      const videoData = await fetchFile(videoUrl);
      const watermarkData = await fetchFile(watermarkUrl);
      
      await this.ffmpeg.writeFile('input.mp4', videoData);
      await this.ffmpeg.writeFile('watermark.png', watermarkData);

      const overlayPosition = {
        'top-left': '10:10',
        'top-right': 'W-w-10:10',
        'bottom-left': '10:H-h-10',
        'bottom-right': 'W-w-10:H-h-10',
      }[position];

      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-i', 'watermark.png',
        '-filter_complex', `overlay=${overlayPosition}`,
        'output.mp4'
      ]);

      const data = await this.ffmpeg.readFile('output.mp4') as Uint8Array;
      const blob = this.dataToBlob(data, 'video/mp4');

      options?.onLog?.('水印添加完成');
      return blob;
    } catch (error) {
      options?.onLog?.(`添加失败: ${error}`);
      throw error;
    }
  }

  /**
   * 调整视频速度
   */
  async changeSpeed(
    videoUrl: string,
    speed: number,
    options?: VideoProcessOptions
  ): Promise<Blob> {
    if (!this.ffmpeg) throw new Error('FFmpeg 未初始化');

    try {
      options?.onLog?.(`调整速度到 ${speed}x...`);
      
      const videoData = await fetchFile(videoUrl);
      await this.ffmpeg.writeFile('input.mp4', videoData);

      const pts = 1 / speed;
      const atempo = speed;

      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-filter_complex', `[0:v]setpts=${pts}*PTS[v];[0:a]atempo=${atempo}[a]`,
        '-map', '[v]',
        '-map', '[a]',
        'output.mp4'
      ]);

      const data = await this.ffmpeg.readFile('output.mp4') as Uint8Array;
      const blob = this.dataToBlob(data, 'video/mp4');

      options?.onLog?.('速度调整完成');
      return blob;
    } catch (error) {
      options?.onLog?.(`调整失败: ${error}`);
      throw error;
    }
  }

  /**
   * 转换视频格式
   */
  async convertFormat(
    videoUrl: string,
    format: 'mp4' | 'webm' | 'avi' | 'mov',
    options?: VideoProcessOptions
  ): Promise<Blob> {
    if (!this.ffmpeg) throw new Error('FFmpeg 未初始化');

    try {
      options?.onLog?.(`转换为 ${format} 格式...`);
      
      const videoData = await fetchFile(videoUrl);
      await this.ffmpeg.writeFile('input.mp4', videoData);

      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        `output.${format}`
      ]);

      const data = await this.ffmpeg.readFile(`output.${format}`) as Uint8Array;
      const mimeType = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        avi: 'video/x-msvideo',
        mov: 'video/quicktime',
      }[format];

      const blob = this.dataToBlob(data, mimeType);

      options?.onLog?.('格式转换完成');
      return blob;
    } catch (error) {
      options?.onLog?.(`转换失败: ${error}`);
      throw error;
    }
  }

  /**
   * 释放 FFmpeg WASM 实例（约25MB内存）
   */
  destroy(): void {
    if (this.ffmpeg) {
      try {
        this.ffmpeg.terminate();
      } catch {
        // FFmpeg terminate 可能抛出异常，忽略
      }
      this.ffmpeg = null;
      this.isLoaded = false;
    }
  }
}

// 导出单例
export const videoEngine = new VideoEngine();
