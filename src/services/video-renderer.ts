/**
 * 视频渲染器 - 本地渲染导出 + 浏览器端降级方案
 * 优先使用 Electron 本地 FFmpeg 渲染，降级使用 FFmpeg.wasm
 */
import { useSimpleTimelineStore as useTimelineStore } from '@/store/simple-timeline-store';
import type { TimelineClip, TimelineTrack } from '@/store/simple-timeline-store';
import type { MembershipLevel } from '@/store/useMembershipStore';
import { smartRenderCache } from './smart-render-cache';
import { RESOURCE_URLS } from '@/config/resources';

export interface ExportOptions {
  resolution: '720p' | '1080p' | '4K' | 'custom';
  customWidth?: number;
  customHeight?: number;
  fps: 24 | 30 | 60;
  bitrate: number; // kbps
  format: 'mp4' | 'webm' | 'mov';
  codec: 'h264' | 'h265' | 'vp9';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  /** CSS filter string for color grading (e.g. "brightness(1.2) contrast(1.1) saturate(1.3)") */
  colorFilter?: string;
  /** In/out point range for partial export */
  inPoint?: number;
  outPoint?: number;
}

export interface RenderOptions {
  onProgress?: (progress: number) => void;
  onLog?: (message: string) => void;
  onFrameRendered?: (frame: number, totalFrames: number) => void;
}

/**
 * Capture and mix all audio tracks into a single WAV ArrayBuffer
 */
async function captureAudioFromTracks(
  tracks: TimelineTrack[],
  startTime: number,
  endTime: number,
  sampleRate = 44100,
  onLog?: (msg: string) => void
): Promise<ArrayBuffer | null> {
  const audioTracks = tracks.filter(t => t.type === 'audio' && t.visible !== false);
  if (audioTracks.length === 0) return null;

  const duration = endTime - startTime;
  const totalSamples = Math.ceil(duration * sampleRate);
  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  for (const track of audioTracks) {
    for (const clip of track.clips) {
      const clipStart = clip.startTime;
      const clipEnd = clip.startTime + clip.duration;
      // Only include clips that overlap the export range
      if (clipEnd <= startTime || clipStart >= endTime) continue;
      if (!clip.url) continue;

      try {
        const response = await fetch(clip.url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        if (clip.speed && clip.speed !== 1) {
          source.playbackRate.value = Math.abs(clip.speed);
        }

        // Calculate when this clip should start in the export timeline
        const offsetInExport = Math.max(0, clipStart - startTime);
        const trimOffset = clip.trimStart || 0;

        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = clip.volume ?? 1;

        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);

        source.start(offsetInExport, trimOffset);
      } catch (clipErr) {
        // Log clip load/decode failures instead of silently skipping
        onLog?.(`音频片段加载/解码失败: ${clip.name || clip.url} - ${clipErr}`);
      }
    }
  }

  try {
    const rendered = await offlineCtx.startRendering();
    // Encode to WAV
    return encodeWAV(rendered);
  } catch (renderErr) {
    onLog?.(`音频渲染失败: ${renderErr}`);
    return null;
  }
}

/** Encode AudioBuffer to WAV ArrayBuffer */
function encodeWAV(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const buffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * numChannels * 2, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(audioBuffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return buffer;
}

/**
 * 会员等级对应的导出质量限制
 */
export const EXPORT_TIER_LIMITS: Record<MembershipLevel, {
  maxResolution: '720p' | '1080p' | '4K';
  maxFps: 24 | 30 | 60;
  maxBitrate: number;
  allowedCodecs: string[];
  allowedFormats: string[];
  label: string;
}> = {
  trial: {
    maxResolution: '720p',
    maxFps: 30,
    maxBitrate: 2000,
    allowedCodecs: ['h264'],
    allowedFormats: ['mp4'],
    label: '体验版',
  },
  free: {
    maxResolution: '720p',
    maxFps: 30,
    maxBitrate: 4000,
    allowedCodecs: ['h264'],
    allowedFormats: ['mp4'],
    label: '免费版',
  },
  basic: {
    maxResolution: '720p',
    maxFps: 30,
    maxBitrate: 6000,
    allowedCodecs: ['h264'],
    allowedFormats: ['mp4', 'webm'],
    label: '基础版',
  },
  pro: {
    maxResolution: '1080p',
    maxFps: 30,
    maxBitrate: 10000,
    allowedCodecs: ['h264', 'h265'],
    allowedFormats: ['mp4', 'webm'],
    label: '专业版',
  },
  vip: {
    maxResolution: '1080p',
    maxFps: 30,
    maxBitrate: 10000,
    allowedCodecs: ['h264', 'h265'],
    allowedFormats: ['mp4', 'webm'],
    label: 'VIP',
  },
  premium: {
    maxResolution: '4K',
    maxFps: 60,
    maxBitrate: 20000,
    allowedCodecs: ['h264', 'h265', 'vp9'],
    allowedFormats: ['mp4', 'webm', 'mov'],
    label: '高级版',
  },
  enterprise: {
    maxResolution: '4K',
    maxFps: 60,
    maxBitrate: 50000,
    allowedCodecs: ['h264', 'h265', 'vp9', 'av1'],
    allowedFormats: ['mp4', 'webm', 'mov', 'mkv'],
    label: '企业版',
  },
};

/**
 * 根据会员等级校验并修正导出选项
 * 返回修正后的选项和被限制的项列表
 */
export function validateExportOptions(
  options: ExportOptions,
  membershipLevel: MembershipLevel
): { validated: ExportOptions; restrictions: string[] } {
  const limits = EXPORT_TIER_LIMITS[membershipLevel];
  const restrictions: string[] = [];
  const validated = { ...options };

  // 分辨率限制
  const resolutionRank: Record<string, number> = { '720p': 1, '1080p': 2, '4K': 3, custom: 4 };
  const maxRank = resolutionRank[limits.maxResolution] || 1;
  if ((resolutionRank[options.resolution] || 0) > maxRank) {
    validated.resolution = limits.maxResolution;
    restrictions.push(`分辨率已降至 ${limits.maxResolution}（${limits.label}最高支持）`);
  }
  // 自定义分辨率检查
  if (options.resolution === 'custom') {
    const maxH = limits.maxResolution === '720p' ? 720 : limits.maxResolution === '1080p' ? 1080 : 2160;
    if ((options.customHeight || 0) > maxH) {
      validated.customHeight = maxH;
      validated.customWidth = Math.round(maxH * 16 / 9);
      restrictions.push(`自定义分辨率已降至 ${validated.customWidth}x${validated.customHeight}（${limits.label}最高支持）`);
    }
  }

  // 帧率限制
  if ((options.fps || 0) > limits.maxFps) {
    validated.fps = limits.maxFps;
    restrictions.push(`帧率已降至 ${limits.maxFps}fps（${limits.label}最高支持）`);
  }

  // 码率限制
  if (options.bitrate > limits.maxBitrate) {
    validated.bitrate = limits.maxBitrate;
    restrictions.push(`码率已降至 ${limits.maxBitrate}kbps（${limits.label}最高支持）`);
  }

  // 编码器限制
  if (!limits.allowedCodecs.includes(options.codec)) {
    validated.codec = limits.allowedCodecs[limits.allowedCodecs.length - 1] as ExportOptions['codec'];
    restrictions.push(`编码器已改为 ${validated.codec}（${limits.label}仅支持 ${limits.allowedCodecs.join('/')}）`);
  }

  // 格式限制
  if (!limits.allowedFormats.includes(options.format)) {
    validated.format = limits.allowedFormats[0] as ExportOptions['format'];
    restrictions.push(`格式已改为 ${validated.format}（${limits.label}仅支持 ${limits.allowedFormats.join('/')}）`);
  }

  return { validated, restrictions };
}

/**
 * 判断当前是否运行在 Electron 环境中
 */
function isElectron(): boolean {
  return !!(window as any).electronAPI;
}

class VideoRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isInitialized = false;
  private localRenderAvailable: boolean | null = null;

  /**
   * 检测本地渲染环境是否可用
   */
  async checkLocalRenderEnvironment(): Promise<{
    available: boolean;
    ffmpegAvailable: boolean;
    outputDir: string;
    outputDirWritable: boolean;
    version?: string;
  }> {
    if (!isElectron() || !(window as any).electronAPI?.render) {
      this.localRenderAvailable = false;
      return { available: false, ffmpegAvailable: false, outputDir: '', outputDirWritable: false };
    }

    try {
      const env = await (window as any).electronAPI.render.checkEnvironment();
      this.localRenderAvailable = env.ffmpeg.available;
      return {
        available: env.ffmpeg.available,
        ffmpegAvailable: env.ffmpeg.available,
        outputDir: env.outputDir,
        outputDirWritable: env.outputDirWritable,
        version: env.ffmpeg.version,
      };
    } catch {
      this.localRenderAvailable = false;
      return { available: false, ffmpegAvailable: false, outputDir: '', outputDirWritable: false };
    }
  }

  /**
   * 初始化渲染器
   */
  async initialize(width: number, height: number): Promise<void> {
    if (this.isInitialized) return;

    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('无法创建 Canvas 上下文');
    }

    this.isInitialized = true;
  }

  /**
   * 渲染时间轴并导出视频
   * 优先使用 Electron 本地 FFmpeg 渲染，降级使用浏览器端 Canvas + FFmpeg.wasm
   */
  async renderTimeline(
    exportOptions: ExportOptions,
    renderOptions?: RenderOptions,
    membershipLevel?: MembershipLevel
  ): Promise<Blob> {
    // 会员等级校验
    let effectiveOptions = exportOptions;
    if (membershipLevel) {
      const { validated, restrictions } = validateExportOptions(exportOptions, membershipLevel);
      effectiveOptions = validated;
      if (restrictions.length > 0) {
        restrictions.forEach(r => renderOptions?.onLog?.(`⚠ ${r}`));
      }
    }

    // 优先尝试本地渲染
    if (isElectron() && this.localRenderAvailable !== false) {
      try {
        const result = await this.renderLocal(effectiveOptions, renderOptions);
        if (result !== null) return result;
      } catch (error) {
        renderOptions?.onLog?.(`本地渲染失败，降级为浏览器渲染: ${error}`);
        // 降级继续
      }
    }

    // 降级：浏览器端渲染
    return this.renderBrowser(effectiveOptions, renderOptions);
  }

  /**
   * 使用 Electron 本地 FFmpeg 渲染
   */
  private async renderLocal(
    exportOptions: ExportOptions,
    renderOptions?: RenderOptions
  ): Promise<Blob | null> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.render) return null;

    renderOptions?.onLog?.('使用本地 FFmpeg 渲染...');
    renderOptions?.onProgress?.(5);

    // 获取时间轴数据
    const { tracks, getTotalDuration } = useTimelineStore.getState();
    const duration = getTotalDuration();

    if (duration === 0) {
      throw new Error('时间轴为空，无法导出');
    }

    // 收集所有片段的本地文件路径
    const inputFiles: Array<{
      path: string;
      startTime: number;
      duration: number;
      track: string;
      type: string;
    }> = [];

    for (const track of tracks) {
      if (!track.visible) continue;
      for (const clip of track.clips) {
        // 本地渲染需要文件系统路径
        // clip.url 可能是 blob URL 或 file:// URL
        const filePath = this.resolveLocalPath(clip);
        if (filePath) {
          inputFiles.push({
            path: filePath,
            startTime: clip.startTime,
            duration: clip.duration,
            track: track.id,
            type: clip.type,
          });
        }
      }
    }

    if (inputFiles.length === 0) {
      renderOptions?.onLog?.('未找到本地文件路径，降级为浏览器渲染');
      this.localRenderAvailable = false;
      return null;
    }

    const { width, height } = this.getResolution(exportOptions);

    // 获取输出目录
    let outputDir: string;
    try {
      const env = await electronAPI.render.checkEnvironment();
      outputDir = env.outputDir;
    } catch {
      outputDir = '';
    }

    const outputFileName = `export_${Date.now()}.${exportOptions.format}`;

    renderOptions?.onLog?.(`正在本地渲染: ${width}x${height}, ${exportOptions.fps}fps, ${exportOptions.bitrate}kbps`);
    renderOptions?.onProgress?.(10);

    const result = await electronAPI.render.exportVideo({
      inputFiles,
      outputDir,
      outputFileName,
      resolution: { width, height },
      fps: exportOptions.fps,
      bitrate: exportOptions.bitrate,
      codec: exportOptions.codec,
      format: exportOptions.format,
      audioCodec: 'aac',
      audioBitrate: 192,
    });

    if (!result.success) {
      throw new Error(result.error || '本地渲染失败');
    }

    renderOptions?.onProgress?.(95);

    // 读取输出文件并转为 Blob
    if (result.outputPath) {
      try {
        const fileResult = await electronAPI.fs.readFile(result.outputPath);
        if (fileResult.success && fileResult.data) {
          // 将 base64 字符串转为 Blob
          const binaryString = atob(fileResult.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          renderOptions?.onProgress?.(100);
          renderOptions?.onLog?.('本地渲染导出完成！');
          return new Blob([bytes], { type: `video/${exportOptions.format}` });
        }
      } catch (readError) {
        renderOptions?.onLog?.(`读取输出文件失败: ${readError}，尝试直接打开文件夹`);
      }

      // 如果无法读取文件内容，尝试在文件管理器中展示
      try {
        await electronAPI.showItemInFolder(result.outputPath);
      } catch { /* ignored */ }
      renderOptions?.onProgress?.(100);
      renderOptions?.onLog?.(`本地渲染完成，文件已保存至: ${result.outputPath}`);
      // 返回空 Blob 标记成功（文件已保存到本地）
      return new Blob([], { type: `video/${exportOptions.format}` });
    }

    throw new Error('本地渲染完成但未获得输出路径');
  }

  /**
   * 解析片段的本地文件路径
   * Electron 环境中，优先使用本地文件路径
   */
  private resolveLocalPath(clip: TimelineClip): string | null {
    if (!clip.url) return null;

    // file:// 协议直接提取路径
    if (clip.url.startsWith('file://')) {
      return clip.url.replace(/^file:\/\/\//, '/');
    }

    // blob URL 无法用于本地渲染
    if (clip.url.startsWith('blob:')) {
      return null;
    }

    // 可能是相对路径或绝对路径
    if (clip.url.startsWith('/') || /^[A-Za-z]:/.test(clip.url)) {
      return clip.url;
    }

    return null;
  }

  /**
   * 浏览器端渲染（降级方案）
   */
  private async renderBrowser(
    exportOptions: ExportOptions,
    renderOptions?: RenderOptions
  ): Promise<Blob> {
    try {
      renderOptions?.onLog?.('使用浏览器端渲染...');
      renderOptions?.onProgress?.(0);

      // 获取时间轴数据
      const { tracks, getTotalDuration } = useTimelineStore.getState();
      let duration = getTotalDuration();

      // Apply in/out point range
      const startTime = exportOptions.inPoint ?? 0;
      const endTime = exportOptions.outPoint ?? duration;
      duration = Math.max(0, endTime - startTime);

      if (duration === 0) {
        throw new Error('时间轴为空，无法导出');
      }

      // 获取分辨率
      const { width, height } = this.getResolution(exportOptions);
      await this.initialize(width, height);

      // 计算总帧数
      const totalFrames = Math.ceil(duration * exportOptions.fps);
      renderOptions?.onLog?.(`总时长: ${duration.toFixed(2)}秒, 总帧数: ${totalFrames}`);

      // 分段编码配置：每段最大30秒，防止编码器掉速和帧率不稳
      const SEGMENT_DURATION_SEC = 30;
      const segmentCount = Math.ceil(duration / SEGMENT_DURATION_SEC);
      renderOptions?.onLog?.(`分段编码: ${segmentCount} 段, 每段约 ${SEGMENT_DURATION_SEC} 秒`);

      // Pre-load FFmpeg.wasm before expensive frame rendering (reuse this instance for encoding)
      let ffmpegInstance: InstanceType<typeof import('@ffmpeg/ffmpeg').FFmpeg> | null = null;
      try {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { toBlobURL } = await import('@ffmpeg/util');
        const ffmpeg = new FFmpeg();
        const baseURL = RESOURCE_URLS.ffmpegCoreEsm;
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegInstance = ffmpeg;
        renderOptions?.onLog?.('FFmpeg.wasm 加载成功');
      } catch (preloadErr) {
        renderOptions?.onLog?.(`FFmpeg.wasm 不可用: ${preloadErr}，将使用 MediaRecorder 降级`);
      }

      // 分段渲染和编码
      const segmentBlobs: Blob[] = [];
      for (let seg = 0; seg < segmentCount; seg++) {
        const segStartTime = startTime + seg * SEGMENT_DURATION_SEC;
        const segEndTime = Math.min(segStartTime + SEGMENT_DURATION_SEC, endTime);
        const segDuration = segEndTime - segStartTime;
        const segFrames = Math.ceil(segDuration * exportOptions.fps);

        renderOptions?.onLog?.(`正在渲染第 ${seg + 1}/${segmentCount} 段: ${segFrames} 帧`);

        // 渲染每一帧
        const frames: string[] = [];
        for (let frame = 0; frame < segFrames; frame++) {
          const time = segStartTime + frame / exportOptions.fps;
          const frameData = await this.renderFrame(tracks, time, exportOptions.colorFilter);
          frames.push(frameData);

          // Cache key frames (every 30 frames = ~1 second at 30fps) for smart re-export
          if (frame % 30 === 0) {
            try {
              const activeClips = this.getActiveClips(tracks, time);
              for (const { clip, track } of activeClips) {
                if (!smartRenderCache.get(track.id, clip.id, clip.startTime, clip.startTime + clip.duration, clip, width, height)) {
                  smartRenderCache.set(track.id, clip.id, clip.startTime, clip.startTime + clip.duration, clip, frameData, width, height);
                }
              }
            } catch { /* caching is best-effort */ }
          }

          const overallProgress = ((seg * SEGMENT_DURATION_SEC + (frame + 1) / exportOptions.fps) / duration) * 80;
          renderOptions?.onProgress?.(overallProgress);
          renderOptions?.onFrameRendered?.(seg * Math.ceil(SEGMENT_DURATION_SEC * exportOptions.fps) + frame + 1, totalFrames);
        }

        // 分段编码
        const segAudioData = await captureAudioFromTracks(tracks, segStartTime, segEndTime, 44100, renderOptions?.onLog);
        const segBlob = await this.encodeVideo(frames, exportOptions, renderOptions, segAudioData, ffmpegInstance);
        segmentBlobs.push(segBlob);

        renderOptions?.onLog?.(`第 ${seg + 1}/${segmentCount} 段编码完成`);

        // 每5个分段释放一次内存，防止累积内存泄漏
        if ((seg + 1) % 5 === 0) {
          this.clearVideoCache();
          frames.length = 0;
          if (typeof globalThis.gc === 'function') {
            try { globalThis.gc(); } catch { /* ignored */ }
          }
          renderOptions?.onLog?.(`已执行第 ${seg + 1} 段后的内存释放`);
        }
      }

      // 合并分段视频
      renderOptions?.onLog?.('所有分段渲染完成，开始合并...');
      const finalBlob = await this.mergeSegments(segmentBlobs, exportOptions, renderOptions, ffmpegInstance);

      // Clear video cache after export to free memory
      this.clearVideoCache();

      renderOptions?.onProgress?.(100);
      renderOptions?.onLog?.('视频导出完成！');

      return finalBlob;
    } catch (error) {
      renderOptions?.onLog?.(`渲染失败: ${error}`);
      throw error;
    }
  }

  /**
   * 渲染单帧
   */
  private async renderFrame(
    tracks: TimelineTrack[],
    time: number,
    colorFilter?: string
  ): Promise<string> {
    if (!this.ctx || !this.canvas) {
      throw new Error('渲染器未初始化');
    }

    // 清空画布
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 获取当前时间的所有片段
    const activeClips = this.getActiveClips(tracks, time);

    // 按轨道顺序渲染
    for (const { clip, track } of activeClips) {
      // Check smart render cache first
      const cached = smartRenderCache.get(
        track.id, clip.id,
        clip.startTime, clip.startTime + clip.duration,
        clip, this.canvas!.width, this.canvas!.height
      );
      if (cached) {
        // Draw cached frame image
        try {
          const img = new Image();
          img.src = cached;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            setTimeout(() => reject(), 2000);
          });
          this.ctx!.drawImage(img, 0, 0, this.canvas!.width, this.canvas!.height);
          continue; // skip full render for this clip
        } catch {
          // cache miss fallback - render normally
        }
      }
      await this.renderClip(clip, time);
    }

    // Apply color grading filter to the entire frame
    if (colorFilter) {
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.applyCSSFilterToImageData(imageData, colorFilter);
      this.ctx.putImageData(imageData, 0, 0);
    }

    // 返回帧数据
    return this.canvas.toDataURL('image/png');
  }

  /** Apply a simplified CSS-like color filter to ImageData */
  private applyCSSFilterToImageData(imageData: ImageData, filter: string): void {
    const data = imageData.data;
    // Parse brightness, contrast, saturate, hue-rotate from filter string
    const brightnessMatch = filter.match(/brightness\(([\d.]+)\)/);
    const contrastMatch = filter.match(/contrast\(([\d.]+)\)/);
    const saturateMatch = filter.match(/saturate\(([\d.]+)\)/);
    const hueMatch = filter.match(/hue-rotate\(([-\d.]+)deg\)/);
    const sepiaMatch = filter.match(/sepia\(([\d.]+)\)/);

    const brightness = brightnessMatch ? parseFloat(brightnessMatch[1]) : 1;
    const contrast = contrastMatch ? parseFloat(contrastMatch[1]) : 1;
    const saturate = saturateMatch ? parseFloat(saturateMatch[1]) : 1;
    const hueRotate = hueMatch ? parseFloat(hueMatch[1]) : 0;
    const sepiaAmount = sepiaMatch ? parseFloat(sepiaMatch[1]) : 0;

    const contrastFactor = (259 * (contrast * 255 - 128 + 259)) / (259 * (259 - contrast * 255 + 128));
    const hueRad = (hueRotate * Math.PI) / 180;
    const cosH = Math.cos(hueRad);
    const sinH = Math.sin(hueRad);

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];

      // Brightness
      r *= brightness; g *= brightness; b *= brightness;

      // Contrast
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;

      // Sepia
      if (sepiaAmount > 0) {
        const sr = r * 0.393 + g * 0.769 + b * 0.189;
        const sg = r * 0.349 + g * 0.686 + b * 0.168;
        const sb = r * 0.272 + g * 0.534 + b * 0.131;
        r = r + (sr - r) * sepiaAmount;
        g = g + (sg - g) * sepiaAmount;
        b = b + (sb - b) * sepiaAmount;
      }

      // Saturation
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + saturate * (r - gray);
      g = gray + saturate * (g - gray);
      b = gray + saturate * (b - gray);

      // Hue rotate (simplified rotation matrix)
      if (hueRotate !== 0) {
        const nr = r * (0.213 + cosH * 0.787 - sinH * 0.213) + g * (0.715 - cosH * 0.715 - sinH * 0.715) + b * (0.072 - cosH * 0.072 + sinH * 0.928);
        const ng = r * (0.213 - cosH * 0.213 + sinH * 0.143) + g * (0.715 + cosH * 0.285 + sinH * 0.140) + b * (0.072 - cosH * 0.072 - sinH * 0.283);
        const nb = r * (0.213 - cosH * 0.213 - sinH * 0.787) + g * (0.715 - cosH * 0.715 + sinH * 0.715) + b * (0.072 + cosH * 0.928 + sinH * 0.072);
        r = nr; g = ng; b = nb;
      }

      data[i] = Math.max(0, Math.min(255, Math.round(r)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
  }

  /**
   * 获取当前时间的活动片段
   */
  private getActiveClips(tracks: TimelineTrack[], time: number): Array<{ clip: TimelineClip; track: TimelineTrack }> {
    const clips: Array<{ clip: TimelineClip; track: TimelineTrack }> = [];

    for (const track of tracks) {
      if (!track.visible) continue;

      for (const clip of track.clips) {
        if (time >= clip.startTime && time < clip.startTime + clip.duration) {
          clips.push({ clip, track });
        }
      }
    }

    return clips;
  }

  /**
   * 渲染片段
   */
  private async renderClip(clip: TimelineClip, time: number): Promise<void> {
    if (!this.ctx || !this.canvas) return;

    const clipTime = time - clip.startTime + (clip.trimStart || 0);
    const clipLocalTime = time - clip.startTime;
    const clipDuration = clip.duration;

    // Calculate transition-based opacity
    let transitionAlpha = clip.opacity ?? 1;
    const transitionDuration = clip.transitions?.duration ?? 0.5;

    // Fade in: from clip start for transitionDuration
    if (clip.transitions?.in && clipLocalTime < transitionDuration) {
      const progress = clipLocalTime / transitionDuration;
      switch (clip.transitions.in) {
        case 'fade':
        case 'crossfade':
        case 'dissolve':
          transitionAlpha *= progress;
          break;
        case 'slide-left':
        case 'slide-right':
        case 'slide-up':
        case 'slide-down':
          // Slide transitions: opacity is full, position shifts
          break;
        default:
          transitionAlpha *= progress; // default: fade
      }
    }

    // Fade out: for the last transitionDuration of the clip
    if (clip.transitions?.out && clipLocalTime > clipDuration - transitionDuration) {
      const remaining = clipDuration - clipLocalTime;
      const progress = remaining / transitionDuration;
      switch (clip.transitions.out) {
        case 'fade':
        case 'crossfade':
        case 'dissolve':
          transitionAlpha *= progress;
          break;
        default:
          transitionAlpha *= progress;
      }
    }

    // Apply transition alpha
    const prevAlpha = this.ctx.globalAlpha;
    this.ctx.globalAlpha = Math.max(0, Math.min(1, transitionAlpha));

    switch (clip.type) {
      case 'video':
        await this.renderVideoClip(clip, clipTime);
        break;
      case 'image':
        await this.renderImageClip(clip);
        break;
      case 'text':
        this.renderTextClip(clip);
        break;
    }

    // Restore alpha
    this.ctx.globalAlpha = prevAlpha;
  }

  private videoCache: Map<string, HTMLVideoElement> = new Map();

  private getVideoElement(url: string): HTMLVideoElement {
    if (!this.videoCache.has(url)) {
      const video = document.createElement('video');
      video.src = url;
      video.preload = 'auto';
      video.muted = true;
      this.videoCache.set(url, video);
    }
    return this.videoCache.get(url)!;
  }

  /**
   * Clear video element cache to free memory
   */
  clearVideoCache(): void {
    for (const [, video] of this.videoCache) {
      video.pause();
      video.src = '';
      video.removeAttribute('src');
    }
    this.videoCache.clear();
  }

  /**
   * 渲染视频片段
   */
  private async renderVideoClip(clip: TimelineClip, clipTime: number): Promise<void> {
    if (!this.ctx || !clip.url) return;

    const video = this.getVideoElement(clip.url);
    // Apply speed: adjust clipTime for variable speed
    const speed = clip.speed || 1;
    const adjustedTime = clipTime / speed;
    video.currentTime = adjustedTime;

    await new Promise((resolve) => {
      const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(undefined); };
      video.addEventListener('seeked', onSeeked);
      // Timeout fallback in case seeked never fires
      setTimeout(resolve, 2000);
    });

    const x = clip.position?.x || 0;
    const y = clip.position?.y || 0;
    const scaleX = clip.scale?.x || 1;
    const scaleY = clip.scale?.y || 1;

    this.ctx.save();
    // Note: globalAlpha is set by renderClip() with transition support

    // Apply rotation if set
    if (clip.rotation) {
      const cx = x + (video.videoWidth * scaleX) / 2;
      const cy = y + (video.videoHeight * scaleY) / 2;
      this.ctx.translate(cx, cy);
      this.ctx.rotate((clip.rotation * Math.PI) / 180);
      this.ctx.translate(-cx, -cy);
    }

    this.ctx.translate(x, y);
    this.ctx.scale(scaleX, scaleY);

    // Draw video fitted to canvas
    const canvasW = this.canvas!.width;
    const canvasH = this.canvas!.height;
    const videoAspect = video.videoWidth / video.videoHeight || 16 / 9;
    const canvasAspect = canvasW / canvasH;
    let drawW = canvasW, drawH = canvasH;
    if (videoAspect > canvasAspect) { drawH = canvasW / videoAspect; }
    else { drawW = canvasH * videoAspect; }
    const dx = (canvasW - drawW) / 2;
    const dy = (canvasH - drawH) / 2;
    this.ctx.drawImage(video, dx, dy, drawW, drawH);

    this.ctx.restore();
  }

  /**
   * 渲染图片片段
   */
  private async renderImageClip(clip: TimelineClip): Promise<void> {
    if (!this.ctx || !clip.url) return;

    const img = new Image();
    img.src = clip.url;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const x = clip.position?.x || 0;
    const y = clip.position?.y || 0;
    const scaleX = clip.scale?.x || 1;
    const scaleY = clip.scale?.y || 1;

    this.ctx.save();
    this.ctx.globalAlpha = clip.opacity || 1;
    this.ctx.translate(x, y);
    this.ctx.scale(scaleX, scaleY);
    this.ctx.drawImage(img, 0, 0);
    this.ctx.restore();
  }

  /**
   * 渲染文字片段
   */
  private renderTextClip(clip: TimelineClip): void {
    if (!this.ctx) return;

    const x = clip.position?.x || 0;
    const y = clip.position?.y || 0;
    const scale = clip.scale?.x || 1;
    const fontSize = Math.round(36 * scale);
    const rotation = clip.rotation || 0;

    this.ctx.save();
    // Note: globalAlpha is set by renderClip() with transition support

    if (rotation) {
      const cx = x + 200;
      const cy = y + fontSize / 2;
      this.ctx.translate(cx, cy);
      this.ctx.rotate((rotation * Math.PI) / 180);
      this.ctx.translate(-cx, -cy);
    }

    // Text background for readability
    this.ctx.font = `bold ${fontSize}px "Microsoft YaHei", Arial, sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Shadow
    this.ctx.shadowColor = 'rgba(0,0,0,0.7)';
    this.ctx.shadowBlur = 4;
    this.ctx.shadowOffsetX = 1;
    this.ctx.shadowOffsetY = 1;

    // Draw text centered on canvas
    const canvasW = this.canvas!.width;
    const canvasH = this.canvas!.height;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillText(clip.name, canvasW / 2 + x, canvasH - 60 + y);

    this.ctx.restore();
  }

  /**
   * 编码视频（浏览器端降级方案）
   */
  private async encodeVideo(
    frames: string[],
    exportOptions: ExportOptions,
    renderOptions?: RenderOptions,
    audioData?: ArrayBuffer | null,
    preloadedFFmpeg?: InstanceType<typeof import('@ffmpeg/ffmpeg').FFmpeg> | null
  ): Promise<Blob> {
    renderOptions?.onLog?.('使用 FFmpeg.wasm 编码视频...');

    try {
      // Use pre-loaded FFmpeg instance if available, otherwise load a new one
      const ffmpeg = preloadedFFmpeg || await (async () => {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { toBlobURL } = await import('@ffmpeg/util');
        const ff = new FFmpeg();
        const baseURL = RESOURCE_URLS.ffmpegCoreEsm;
        await ff.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        return ff;
      })();

      // 写入帧图片
      for (let i = 0; i < frames.length; i++) {
        const dataUrl = frames[i];
        const base64 = dataUrl.split(',')[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) {
          bytes[j] = binaryStr.charCodeAt(j);
        }
        const paddedIndex = String(i).padStart(5, '0');
        await ffmpeg.writeFile(`frame_${paddedIndex}.png`, bytes);

        const progress = 80 + ((i + 1) / frames.length) * 15;
        renderOptions?.onProgress?.(progress);
      }

      // Write audio file if available
      let hasAudio = false;
      if (audioData && audioData.byteLength > 44) {
        try {
          await ffmpeg.writeFile('audio.wav', new Uint8Array(audioData));
          hasAudio = true;
        } catch (audioWriteErr) {
          renderOptions?.onLog?.(`音频写入 FFmpeg 失败，将生成无声视频: ${audioWriteErr}`);
        }
      }

      // 编码
      const outputName = `output.${exportOptions.format}`;
      const videoCodecMap: Record<string, string> = {
        mp4: '-c:v libx264 -preset fast -crf 18 -vsync cfr',
        webm: '-c:v libvpx-vp9 -crf 18 -b:v 0 -vsync cfr',
        mov: '-c:v libx264 -preset fast -crf 18 -vsync cfr',
      };
      const audioCodecMap: Record<string, string> = {
        mp4: '-c:a aac -b:a 192k',
        webm: '-c:a libopus -b:a 128k',
        mov: '-c:a aac -b:a 192k',
      };

      const encodeArgs = [
        '-framerate', String(exportOptions.fps),
        '-i', 'frame_%05d.png',
      ];
      if (hasAudio) {
        encodeArgs.push('-i', 'audio.wav');
      }
      encodeArgs.push(...(videoCodecMap[exportOptions.format] || videoCodecMap['mp4']).split(' '));
      if (hasAudio) {
        encodeArgs.push(...(audioCodecMap[exportOptions.format] || audioCodecMap['mp4']).split(' '));
      } else if (exportOptions.format === 'mp4' || exportOptions.format === 'mov') {
        // Add silent audio track for compatibility
        encodeArgs.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
      }
      encodeArgs.push('-y', outputName);

      await ffmpeg.exec(encodeArgs);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data as BlobPart], { type: `video/${exportOptions.format}` });

      // 清理
      try {
        for (let i = 0; i < frames.length; i++) {
          const paddedIndex = String(i).padStart(5, '0');
          await ffmpeg.deleteFile(`frame_${paddedIndex}.png`);
        }
        await ffmpeg.deleteFile(outputName);
        if (hasAudio) { try { await ffmpeg.deleteFile('audio.wav'); } catch { /* ignored */ } }
      } catch { /* ignored */ }

      return blob;
    } catch (ffmpegError) {
      renderOptions?.onLog?.(`FFmpeg.wasm 编码失败: ${ffmpegError}，使用 MediaRecorder 降级`);

      // 最终降级：使用 MediaRecorder API
      return this.encodeWithMediaRecorder(frames, exportOptions, renderOptions, audioData);
    }
  }

  /**
   * 使用 MediaRecorder 降级编码
   */
  private async encodeWithMediaRecorder(
    frames: string[],
    exportOptions: ExportOptions,
    renderOptions?: RenderOptions,
    audioData?: ArrayBuffer | null
  ): Promise<Blob> {
    renderOptions?.onLog?.('使用 MediaRecorder 降级编码...');

    if (!this.canvas || !this.ctx) {
      // 最终兜底：返回空 Blob
      return new Blob([], { type: 'video/webm' });
    }

    const videoStream = this.canvas.captureStream(exportOptions.fps);

    // Mix audio into the stream if available
    let combinedStream: MediaStream = videoStream;
    if (audioData && audioData.byteLength > 44) {
      try {
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(audioData.slice(0));
        const audioSource = audioCtx.createMediaStreamDestination();
        const bufferSource = audioCtx.createBufferSource();
        bufferSource.buffer = audioBuffer;
        bufferSource.connect(audioSource);
        bufferSource.start();

        const audioTracks = audioSource.stream.getAudioTracks();
        combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioTracks,
        ]);
      } catch {
        // Audio mixing failed, proceed with video-only
      }
    }

    // Select best supported MIME type for MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: exportOptions.bitrate * 1000,
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        renderOptions?.onProgress?.(100);
        resolve(new Blob(chunks, { type: 'video/webm' }));
      };

      mediaRecorder.start();

      // 逐帧绘制到 canvas 并等待
      let frameIndex = 0;
      const drawFrame = async () => {
        if (frameIndex >= frames.length) {
          mediaRecorder.stop();
          return;
        }

        const img = new Image();
        img.src = frames[frameIndex];
        await new Promise<void>((res) => { img.onload = () => res(); });

        this.ctx!.clearRect(0, 0, this.canvas!.width, this.canvas!.height);
        this.ctx!.drawImage(img, 0, 0);

        frameIndex++;
        const progress = 80 + (frameIndex / frames.length) * 15;
        renderOptions?.onProgress?.(progress);

        setTimeout(drawFrame, 1000 / exportOptions.fps);
      };

      drawFrame();
    });
  }

  /**
   * 合并分段视频
   * 使用 FFmpeg concat 协议合并多个分段视频
   */
  private async mergeSegments(
    segmentBlobs: Blob[],
    exportOptions: ExportOptions,
    renderOptions?: RenderOptions,
    preloadedFFmpeg?: InstanceType<typeof import('@ffmpeg/ffmpeg').FFmpeg> | null
  ): Promise<Blob> {
    if (segmentBlobs.length === 1) {
      return segmentBlobs[0];
    }

    renderOptions?.onLog?.(`合并 ${segmentBlobs.length} 个分段视频...`);

    try {
      const ffmpeg = preloadedFFmpeg || await (async () => {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { toBlobURL } = await import('@ffmpeg/util');
        const ff = new FFmpeg();
        const baseURL = RESOURCE_URLS.ffmpegCoreEsm;
        await ff.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        return ff;
      })();

      // 写入分段视频文件
      for (let i = 0; i < segmentBlobs.length; i++) {
        const arrayBuffer = await segmentBlobs[i].arrayBuffer();
        await ffmpeg.writeFile(`segment_${i}.mp4`, new Uint8Array(arrayBuffer));
      }

      // 创建 concat 列表文件
      const concatList = segmentBlobs.map((_, i) => `file segment_${i}.mp4`).join('\n');
      await ffmpeg.writeFile('concat_list.txt', new TextEncoder().encode(concatList));

      // 使用 concat 协议合并
      const outputName = `merged_output.${exportOptions.format}`;
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat_list.txt',
        '-c', 'copy',
        '-y', outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data as BlobPart], { type: `video/${exportOptions.format}` });

      // 清理临时文件
      try {
        for (let i = 0; i < segmentBlobs.length; i++) {
          await ffmpeg.deleteFile(`segment_${i}.mp4`);
        }
        await ffmpeg.deleteFile('concat_list.txt');
        await ffmpeg.deleteFile(outputName);
      } catch { /* ignored */ }

      renderOptions?.onLog?.('分段视频合并完成');
      return blob;
    } catch (mergeError) {
      renderOptions?.onLog?.(`分段合并失败: ${mergeError}，返回第一段视频`);
      // 降级：返回第一段视频
      return segmentBlobs[0];
    }
  }

  /**
   * 获取分辨率
   */
  private getResolution(options: ExportOptions): { width: number; height: number } {
    switch (options.resolution) {
      case '720p':
        return { width: 1280, height: 720 };
      case '1080p':
        return { width: 1920, height: 1080 };
      case '4K':
        return { width: 3840, height: 2160 };
      case 'custom':
        return {
          width: options.customWidth || 1920,
          height: options.customHeight || 1080,
        };
      default:
        return { width: 1920, height: 1080 };
    }
  }

  /**
   * 获取质量预设
   */
  getQualityPresets(): Record<ExportOptions['quality'], Partial<ExportOptions>> {
    return {
      low: {
        bitrate: 2000,
        fps: 24,
      },
      medium: {
        bitrate: 5000,
        fps: 30,
      },
      high: {
        bitrate: 10000,
        fps: 30,
      },
      ultra: {
        bitrate: 20000,
        fps: 60,
      },
    };
  }

  /**
   * 估算文件大小
   */
  estimateFileSize(duration: number, options: ExportOptions): number {
    return (options.bitrate * duration) / 8 / 1024;
  }
}

// 导出单例
export const videoRenderer = new VideoRenderer();
