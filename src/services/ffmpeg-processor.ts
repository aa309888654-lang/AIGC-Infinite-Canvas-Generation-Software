/**
 * FFmpeg WebAssembly 视频处理服务
 * 提供浏览器端视频剪辑、格式转换、导出等功能
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { RESOURCE_URLS } from '@/config/resources';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
  size: number;
}

export interface TrimOptions {
  start: number;
  end: number;
}

export interface ExportOptions {
  format: 'mp4' | 'webm' | 'gif' | 'mov';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  resolution?: { width: number; height: number };
  fps?: number;
  codec?: string;
}

export interface ProgressCallback {
  (progress: number, time?: number): void;
}

class FFmpegProcessorService {
  private ffmpeg: FFmpeg | null = null;
  private loaded: boolean = false;
  private loading: Promise<void> | null = null;

  async load(multiThread: boolean = true): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      this.ffmpeg = new FFmpeg();
      
      const baseURL = multiThread 
        ? RESOURCE_URLS.ffmpegCoreMtEsm
        : RESOURCE_URLS.ffmpegCoreEsm;

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.loaded = true;
      // console.log('[FFmpeg] 加载完成，多线程模式:', multiThread);
    })();

    return this.loading;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  async getVideoMetadata(file: File): Promise<VideoMetadata> {
    if (!this.ffmpeg) await this.load();
    
    const inputName = `meta_${Date.now()}.mp4`;
    await this.ffmpeg!.writeFile(inputName, await fetchFile(file));

    const metadata = {
      duration: 0,
      width: 0,
      height: 0,
      fps: 0,
      codec: '',
      bitrate: 0,
      size: file.size
    };

    try {
      await this.ffmpeg!.exec(['-i', inputName, '-f', 'null', '-']);
    } catch (e) {
      const output = String(e);
      const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (durationMatch) {
        metadata.duration = parseInt(durationMatch[1]) * 3600 + 
                           parseInt(durationMatch[2]) * 60 + 
                           parseInt(durationMatch[3]);
      }
      const videoMatch = output.match(/(\d{3,4})x(\d{3,4})/);
      if (videoMatch) {
        metadata.width = parseInt(videoMatch[1]);
        metadata.height = parseInt(videoMatch[2]);
      }
      const fpsMatch = output.match(/(\d+(?:\.\d+)?)\s*fps/);
      if (fpsMatch) {
        metadata.fps = parseFloat(fpsMatch[1]);
      }
    }

    await this.ffmpeg!.deleteFile(inputName);
    return metadata;
  }

  async trimVideo(
    file: File, 
    options: TrimOptions, 
    onProgress?: ProgressCallback
  ): Promise<Blob> {
    if (!this.ffmpeg) await this.load();
    
    const inputName = `trim_input_${Date.now()}.mp4`;
    const outputName = `trim_output_${Date.now()}.mp4`;
    
    await this.ffmpeg!.writeFile(inputName, await fetchFile(file));
    
    if (onProgress) {
      this.ffmpeg!.on('progress', ({ progress }) => {
        onProgress(progress * 100);
      });
    }

    await this.ffmpeg!.exec([
      '-i', inputName,
      '-ss', String(options.start),
      '-to', String(options.end),
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero',
      outputName
    ]);

    const data = await this.ffmpeg!.readFile(outputName);
    
    await this.ffmpeg!.deleteFile(inputName);
    await this.ffmpeg!.deleteFile(outputName);
    
    return new Blob([data as BlobPart], { type: 'video/mp4' });
  }

  async mergeVideos(
    files: File[], 
    onProgress?: ProgressCallback
  ): Promise<Blob> {
    if (!this.ffmpeg) await this.load();
    
    const inputFiles: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const inputName = `merge_input_${i}_${Date.now()}.mp4`;
      await this.ffmpeg!.writeFile(inputName, await fetchFile(files[i]));
      inputFiles.push(inputName);
    }

    const listName = `concat_${Date.now()}.txt`;
    const listContent = inputFiles.map(f => `file '${f}'`).join('\n');
    await this.ffmpeg!.writeFile(listName, listContent);

    const outputName = `merge_output_${Date.now()}.mp4`;
    
    if (onProgress) {
      this.ffmpeg!.on('progress', ({ progress }) => {
        onProgress(progress * 100);
      });
    }

    await this.ffmpeg!.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', listName,
      '-c', 'copy',
      outputName
    ]);

    const data = await this.ffmpeg!.readFile(outputName);
    
    for (const fileName of inputFiles) {
      await this.ffmpeg!.deleteFile(fileName);
    }
    await this.ffmpeg!.deleteFile(listName);
    await this.ffmpeg!.deleteFile(outputName);
    
    return new Blob([data as BlobPart], { type: 'video/mp4' });
  }

  async convertFormat(
    file: File, 
    options: ExportOptions, 
    onProgress?: ProgressCallback
  ): Promise<Blob> {
    if (!this.ffmpeg) await this.load();
    
    const inputName = `convert_input_${Date.now()}.mp4`;
    const outputName = `convert_output_${Date.now()}.${options.format}`;
    
    await this.ffmpeg!.writeFile(inputName, await fetchFile(file));
    
    if (onProgress) {
      this.ffmpeg!.on('progress', ({ progress }) => {
        onProgress(progress * 100);
      });
    }

    const args = ['-i', inputName];
    
    if (options.resolution) {
      args.push('-vf', `scale=${options.resolution.width}:${options.resolution.height}`);
    }
    
    if (options.fps) {
      args.push('-r', String(options.fps));
    }

    const codecMap = {
      mp4: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac'],
      webm: ['-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-c:a', 'libopus'],
      gif: ['-vf', 'fps=15,scale=480:-1:flags=lanczos', '-c:v', 'gif'],
      mov: ['-c:v', 'libx264', '-preset', 'medium', '-c:a', 'aac']
    };

    args.push(...(codecMap[options.format] || codecMap['mp4']));
    args.push(outputName);

    await this.ffmpeg!.exec(args);

    const data = await this.ffmpeg!.readFile(outputName);
    
    await this.ffmpeg!.deleteFile(inputName);
    await this.ffmpeg!.deleteFile(outputName);
    
    return new Blob([data as BlobPart], { type: `video/${options.format}` });
  }

  async generateThumbnails(
    file: File, 
    count: number = 10,
    onProgress?: ProgressCallback
  ): Promise<string[]> {
    if (!this.ffmpeg) await this.load();
    
    const inputName = `thumb_input_${Date.now()}.mp4`;
    await this.ffmpeg!.writeFile(inputName, await fetchFile(file));
    
    const thumbnails: string[] = [];
    
    if (onProgress) {
      this.ffmpeg!.on('progress', ({ progress }) => {
        onProgress(progress * 100);
      });
    }

    for (let i = 0; i < count; i++) {
      const outputName = `thumb_${i}_${Date.now()}.jpg`;
      const time = (i / count);
      
      try {
        await this.ffmpeg!.exec([
          '-i', inputName,
          '-ss', String(time),
          '-vframes', '1',
          '-q:v', '2',
          '-s', '320x180',
          outputName
        ]);
        
        const data = await this.ffmpeg!.readFile(outputName);
        const blob = new Blob([data as BlobPart], { type: 'image/jpeg' });
        thumbnails.push(URL.createObjectURL(blob));
        
        await this.ffmpeg!.deleteFile(outputName);
      } catch (error) {
        console.error(`[FFmpeg] 生成缩略图 ${i} 失败:`, error);
      }
    }

    await this.ffmpeg!.deleteFile(inputName);
    
    return thumbnails;
  }

  async exportProject(
    videoClips: Array<{ file: File; start: number; end: number; track: number }>,
    audioClips: Array<{ file: File; start: number; end: number; track: number; volume: number }>,
    options: ExportOptions,
    onProgress?: ProgressCallback
  ): Promise<Blob> {
    if (!this.ffmpeg) await this.load();
    
    const inputFiles: string[] = [];
    
    for (let i = 0; i < videoClips.length; i++) {
      const inputName = `proj_video_${i}_${Date.now()}.mp4`;
      await this.ffmpeg!.writeFile(inputName, await fetchFile(videoClips[i].file));
      inputFiles.push(inputName);
    }
    
    for (let i = 0; i < audioClips.length; i++) {
      const inputName = `proj_audio_${i}_${Date.now()}.mp3`;
      await this.ffmpeg!.writeFile(inputName, await fetchFile(audioClips[i].file));
      inputFiles.push(inputName);
    }

    const outputName = `project_export_${Date.now()}.${options.format}`;
    
    if (onProgress) {
      this.ffmpeg!.on('progress', ({ progress }) => {
        onProgress(progress * 100);
      });
    }

    const args = [];
    
    for (const video of videoClips) {
      const idx = videoClips.indexOf(video);
      args.push('-i', inputFiles[idx]);
    }
    for (const audio of audioClips) {
      const idx = videoClips.length + audioClips.indexOf(audio);
      args.push('-i', inputFiles[idx]);
      args.push('-itsoffset', String(audio.start), '-i', inputFiles[idx]);
    }

    if (options.resolution) {
      args.push('-vf', `scale=${options.resolution.width}:${options.resolution.height}`);
    }

    args.push('-c:v', 'libx264', '-preset', 'medium');
    args.push('-c:a', 'aac');
    args.push(outputName);

    await this.ffmpeg!.exec(args);

    const data = await this.ffmpeg!.readFile(outputName);
    
    for (const fileName of inputFiles) {
      try {
        await this.ffmpeg!.deleteFile(fileName);
      } catch (e) { /* ignored */ }
    }
    
    try {
      await this.ffmpeg!.deleteFile(outputName);
    } catch (e) { /* ignored */ }
    
    return new Blob([data as BlobPart], { type: `video/${options.format}` });
  }

  async applyFilter(
    file: File, 
    filter: string, 
    onProgress?: ProgressCallback
  ): Promise<Blob> {
    if (!this.ffmpeg) await this.load();
    
    const inputName = `filter_input_${Date.now()}.mp4`;
    const outputName = `filter_output_${Date.now()}.mp4`;
    
    await this.ffmpeg!.writeFile(inputName, await fetchFile(file));
    
    if (onProgress) {
      this.ffmpeg!.on('progress', ({ progress }) => {
        onProgress(progress * 100);
      });
    }

    await this.ffmpeg!.exec([
      '-i', inputName,
      '-vf', filter,
      '-c:a', 'copy',
      outputName
    ]);

    const data = await this.ffmpeg!.readFile(outputName);
    
    await this.ffmpeg!.deleteFile(inputName);
    await this.ffmpeg!.deleteFile(outputName);
    
    return new Blob([data as BlobPart], { type: 'video/mp4' });
  }
}

export const ffmpegProcessor = new FFmpegProcessorService();
