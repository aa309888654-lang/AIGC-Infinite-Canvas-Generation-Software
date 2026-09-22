import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { API_BASE_URL } from '@/lib/api-config';

export type AudioStem = 'vocals' | 'drums' | 'bass' | 'other' | 'piano' | 'guitar';

export interface SeparatedTrack {
  id: string;
  stem: AudioStem;
  name: string;
  url: string;
  duration: number;
  waveform?: number[];
  volume: number;
  muted: boolean;
  solo: boolean;
  color: string;
}

export interface AudioSeparationJob {
  id: string;
  sourceUrl: string;
  sourceName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  model: 'spleeter' | 'demucs' | 'openunmix' | 'local';
  stems: AudioStem[];
  outputTracks: SeparatedTrack[];
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface AudioSeparationState {
  jobs: AudioSeparationJob[];
  currentJob: AudioSeparationJob | null;
  isProcessing: boolean;
  selectedModel: 'spleeter' | 'demucs' | 'openunmix' | 'local';
  selectedStems: AudioStem[];
}

interface AudioSeparationStore extends AudioSeparationState {
  startSeparation: (sourceUrl: string, sourceName: string) => string;
  updateJobProgress: (jobId: string, progress: number) => void;
  completeJob: (jobId: string, tracks: SeparatedTrack[]) => void;
  failJob: (jobId: string, error: string) => void;
  cancelJob: (jobId: string) => void;
  removeJob: (jobId: string) => void;
  
  setSelectedModel: (model: AudioSeparationState['selectedModel']) => void;
  setSelectedStems: (stems: AudioStem[]) => void;
  toggleStem: (stem: AudioStem) => void;
  
  getJobById: (jobId: string) => AudioSeparationJob | undefined;
  getActiveJobs: () => AudioSeparationJob[];
}

const STEM_CONFIGS: Record<AudioStem, { name: string; color: string }> = {
  vocals: { name: '人声', color: '#EC4899' },
  drums: { name: '鼓点', color: '#F59E0B' },
  bass: { name: '贝斯', color: '#9CA3AF' },
  other: { name: '其他', color: '#10B981' },
  piano: { name: '钢琴', color: '#8B5CF6' },
  guitar: { name: '吉他', color: '#EF4444' },
};

export const useAudioSeparationStore = create<AudioSeparationStore>()(
  immer((set, get) => ({
    jobs: [],
    currentJob: null,
    isProcessing: false,
    selectedModel: 'demucs',
    selectedStems: ['vocals', 'drums', 'bass', 'other'],

    startSeparation: (sourceUrl, sourceName) => {
      const jobId = `sep-${Date.now()}`;
      const state = get();

      const newJob: AudioSeparationJob = {
        id: jobId,
        sourceUrl,
        sourceName,
        status: 'pending',
        progress: 0,
        model: state.selectedModel,
        stems: state.selectedStems,
        outputTracks: [],
        createdAt: new Date(),
      };

      set((s) => {
        s.jobs.push(newJob);
        s.currentJob = newJob;
        s.isProcessing = true;
      });

      return jobId;
    },

    updateJobProgress: (jobId, progress) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.progress = progress;
          job.status = 'processing';
        }
      }),

    completeJob: (jobId, tracks) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          if (job.outputTracks) {
            for (const t of job.outputTracks) {
              if (t.url?.startsWith('blob:')) URL.revokeObjectURL(t.url);
            }
          }
          job.status = 'completed';
          job.progress = 100;
          job.outputTracks = tracks;
          job.completedAt = new Date();
        }
        state.isProcessing = state.jobs.some((j) => j.status === 'processing');
      }),

    failJob: (jobId, error) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'failed';
          job.error = error;
        }
        state.isProcessing = state.jobs.some((j) => j.status === 'processing');
      }),

    cancelJob: (jobId) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job && job.status === 'processing') {
          job.status = 'failed';
          job.error = '用户取消';
        }
        state.isProcessing = state.jobs.some((j) => j.status === 'processing');
      }),

    removeJob: (jobId) =>
      set((state) => {
        state.jobs = state.jobs.filter((j) => j.id !== jobId);
        if (state.currentJob?.id === jobId) {
          state.currentJob = null;
        }
      }),

    setSelectedModel: (model) =>
      set((state) => {
        state.selectedModel = model;
      }),

    setSelectedStems: (stems) =>
      set((state) => {
        state.selectedStems = stems;
      }),

    toggleStem: (stem) =>
      set((state) => {
        const index = state.selectedStems.indexOf(stem);
        if (index === -1) {
          state.selectedStems.push(stem);
        } else {
          state.selectedStems.splice(index, 1);
        }
      }),

    getJobById: (jobId) => {
      const state = get();
      return state.jobs.find((j) => j.id === jobId);
    },

    getActiveJobs: () => {
      const state = get();
      return state.jobs.filter((j) => j.status === 'processing' || j.status === 'pending');
    },
  }))
);

export class AudioSeparationService {
  private static instance: AudioSeparationService;
  private audioContext: AudioContext | null = null;

  static getInstance(): AudioSeparationService {
    if (!AudioSeparationService.instance) {
      AudioSeparationService.instance = new AudioSeparationService();
    }
    return AudioSeparationService.instance;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  async loadAudioFile(url: string): Promise<AudioBuffer> {
    const ctx = this.getAudioContext();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return ctx.decodeAudioData(arrayBuffer);
  }

  async extractAudioFromVideo(videoUrl: string): Promise<Blob> {
    const response = await fetch(videoUrl);
    const arrayBuffer = await response.arrayBuffer();

    const videoBlob = new Blob([arrayBuffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(videoBlob);

    try {
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('视频元数据加载失败'));
      });

      const stream = (video as any).captureStream
        ? (video as any).captureStream()
        : (video as any).mozCaptureStream();

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('视频中没有音频轨道');
      }

      const mediaStream = new MediaStream(audioTracks);

      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      const chunks: Blob[] = [];

      return await new Promise((resolve, reject) => {
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          resolve(audioBlob);
        };

        mediaRecorder.onerror = (_e) => {
          reject(new Error('音频提取失败'));
        };

        video.play();
        mediaRecorder.start();

        video.onended = () => {
          mediaRecorder.stop();
        };

        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            video.pause();
          }
        }, video.duration * 1000 + 1000);
      });
    } finally {
      // 无论成功或失败都释放 blob URL，避免内存泄漏
      URL.revokeObjectURL(url);
    }
  }

  async separateAudio(
    audioBuffer: AudioBuffer,
    model: 'spleeter' | 'demucs' | 'openunmix' | 'local',
    stems: AudioStem[],
    onProgress: (progress: number) => void
  ): Promise<Map<AudioStem, AudioBuffer>> {
    onProgress(10);

    if (model === 'local') {
      return this.separateWithLocalProcessing(audioBuffer, stems, onProgress);
    }

    return this.separateWithBackend(audioBuffer, model, stems, onProgress);
  }

  private async separateWithLocalProcessing(
    audioBuffer: AudioBuffer,
    stems: AudioStem[],
    onProgress: (progress: number) => void
  ): Promise<Map<AudioStem, AudioBuffer>> {
    const ctx = this.getAudioContext();
    const result = new Map<AudioStem, AudioBuffer>();
    const sampleRate = audioBuffer.sampleRate;

    onProgress(20);

    for (let i = 0; i < stems.length; i++) {
      const stem = stems[i];
      const progress = 20 + (i / stems.length) * 70;
      onProgress(progress);

      const stemBuffer = ctx.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        sampleRate
      );

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const inputData = audioBuffer.getChannelData(channel);
        const outputData = stemBuffer.getChannelData(channel);

        const filteredData = this.applyFrequencyFilter(
          inputData,
          sampleRate,
          stem
        );

        outputData.set(filteredData);
      }

      result.set(stem, stemBuffer);
    }

    onProgress(100);
    return result;
  }

  private applyFrequencyFilter(
    data: Float32Array,
    sampleRate: number,
    stem: AudioStem
  ): Float32Array {
    const result = new Float32Array(data.length);

    const frequencyRanges: Record<AudioStem, { low: number; high: number; boost: number }> = {
      vocals: { low: 300, high: 3400, boost: 1.2 },
      drums: { low: 60, high: 8000, boost: 1.0 },
      bass: { low: 20, high: 250, boost: 1.3 },
      other: { low: 250, high: 8000, boost: 0.8 },
      piano: { low: 27, high: 4200, boost: 1.0 },
      guitar: { low: 82, high: 1200, boost: 1.0 },
    };

    const range = frequencyRanges[stem];
    const lowBin = Math.floor((range.low / sampleRate) * data.length);
    const highBin = Math.floor((range.high / sampleRate) * data.length);

    for (let i = 0; i < data.length; i++) {
      if (i >= lowBin && i <= highBin) {
        result[i] = data[i] * range.boost;
      } else {
        result[i] = data[i] * 0.1;
      }
    }

    return result;
  }

  private async separateWithBackend(
    audioBuffer: AudioBuffer,
    model: 'spleeter' | 'demucs' | 'openunmix',
    stems: AudioStem[],
    onProgress: (progress: number) => void
  ): Promise<Map<AudioStem, AudioBuffer>> {
    const result = new Map<AudioStem, AudioBuffer>();

    try {
      const wavBlob = await this.audioBufferToWav(audioBuffer);
      const formData = new FormData();
      formData.append('audio', wavBlob, 'audio.wav');
      formData.append('model', model);
      formData.append('stems', stems.join(','));

      onProgress(30);

      const response = await fetch(`${API_BASE_URL}/audio/separate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('音频分离请求失败');
      }

      onProgress(60);

      const data = await response.json();

      for (const stem of stems) {
        if (data.stems[stem]) {
          const audioUrl = data.stems[stem];
          const stemBuffer = await this.loadAudioFile(audioUrl);
          result.set(stem, stemBuffer);
        }
      }

      onProgress(100);
    } catch (error) {
      console.error('Backend separation failed, falling back to local:', error);
      return this.separateWithLocalProcessing(audioBuffer, stems, onProgress);
    }

    return result;
  }

  private async audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  generateWaveform(audioBuffer: AudioBuffer, samples: number = 100): number[] {
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / samples);
    const waveform: number[] = [];

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        const index = i * blockSize + j;
        sum += Math.abs(channelData[index] || 0);
      }
      waveform.push(sum / blockSize);
    }

    const max = Math.max(...waveform);
    return waveform.map((v) => v / max);
  }

  getStemConfig(stem: AudioStem): { name: string; color: string } {
    return STEM_CONFIGS[stem];
  }

  getAvailableStems(): { stem: AudioStem; name: string; color: string }[] {
    return Object.entries(STEM_CONFIGS).map(([stem, config]) => ({
      stem: stem as AudioStem,
      ...config,
    }));
  }

  getAvailableModels(): { id: string; name: string; description: string; stems: AudioStem[] }[] {
    return [
      {
        id: 'spleeter',
        name: 'Spleeter',
        description: 'Deezer开源，快速分离，支持2/4/5轨道',
        stems: ['vocals', 'drums', 'bass', 'other', 'piano'],
      },
      {
        id: 'demucs',
        name: 'Demucs',
        description: 'Facebook开源，高质量分离，支持6轨道',
        stems: ['vocals', 'drums', 'bass', 'other', 'piano', 'guitar'],
      },
      {
        id: 'openunmix',
        name: 'OpenUnmix',
        description: '轻量级，适合实时处理',
        stems: ['vocals', 'drums', 'bass', 'other'],
      },
      {
        id: 'local',
        name: '本地处理',
        description: '基于频率滤波的简单分离（无需后端）',
        stems: ['vocals', 'drums', 'bass', 'other', 'piano', 'guitar'],
      },
    ];
  }
}

export const audioSeparationService = AudioSeparationService.getInstance();
