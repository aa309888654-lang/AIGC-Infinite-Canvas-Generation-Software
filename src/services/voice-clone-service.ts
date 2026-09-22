import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type VoiceLanguage = 
  | 'zh-cn'
  | 'zh-tw'
  | 'en-us'
  | 'en-gb'
  | 'ja'
  | 'ko'
  | 'de'
  | 'fr'
  | 'es'
  | 'ru';

export type VoiceGender = 'male' | 'female' | 'neutral';

export type VoiceStyle = 
  | 'neutral'
  | 'cheerful'
  | 'sad'
  | 'angry'
  | 'calm'
  | 'excited'
  | 'whisper';

export interface VoiceProfile {
  id: string;
  name: string;
  language: VoiceLanguage;
  gender: VoiceGender;
  style: VoiceStyle;
  previewUrl?: string;
  isCustom: boolean;
  isPremium: boolean;
  quality: 'standard' | 'high' | 'ultra';
}

export interface VoiceCloneSettings {
  referenceAudioUrl: string;
  cloneQuality: 'fast' | 'balanced' | 'quality';
  preserveEmotion: boolean;
  enhanceAudio: boolean;
}

export interface TTSGenerationSettings {
  text: string;
  voiceId: string;
  language: VoiceLanguage;
  speed: number;
  pitch: number;
  volume: number;
  style: VoiceStyle;
  addBreathing: boolean;
  addPauses: boolean;
}

export interface VoiceCloneJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  settings: VoiceCloneSettings;
  result?: VoiceProfile;
  error?: string;
}

export interface TTSJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  settings: TTSGenerationSettings;
  outputUrl?: string;
  duration?: number;
  error?: string;
}

export interface VoiceCloneState {
  voices: VoiceProfile[];
  ttsSettings: TTSGenerationSettings;
  cloneSettings: VoiceCloneSettings;
  cloneJobs: VoiceCloneJob[];
  ttsJobs: TTSJob[];
  activeJobId: string | null;
}

interface VoiceCloneStore extends VoiceCloneState {
  setVoices: (voices: VoiceProfile[]) => void;
  addVoice: (voice: VoiceProfile) => void;
  removeVoice: (voiceId: string) => void;
  
  updateTTSSettings: (settings: Partial<TTSGenerationSettings>) => void;
  updateCloneSettings: (settings: Partial<VoiceCloneSettings>) => void;
  
  startClone: () => string;
  updateCloneProgress: (jobId: string, progress: number) => void;
  completeClone: (jobId: string, voice: VoiceProfile) => void;
  failClone: (jobId: string, error: string) => void;
  
  startTTS: () => string;
  updateTTSProgress: (jobId: string, progress: number) => void;
  completeTTS: (jobId: string, outputUrl: string, duration: number) => void;
  failTTS: (jobId: string, error: string) => void;
  
  setActiveJob: (jobId: string | null) => void;
}

const BUILTIN_VOICES: VoiceProfile[] = [
  { id: 'voice-1', name: '小云', language: 'zh-cn', gender: 'female', style: 'neutral', isCustom: false, isPremium: false, quality: 'high' },
  { id: 'voice-2', name: '小杰', language: 'zh-cn', gender: 'male', style: 'neutral', isCustom: false, isPremium: false, quality: 'high' },
  { id: 'voice-3', name: 'Emma', language: 'en-us', gender: 'female', style: 'neutral', isCustom: false, isPremium: false, quality: 'high' },
  { id: 'voice-4', name: 'James', language: 'en-gb', gender: 'male', style: 'neutral', isCustom: false, isPremium: false, quality: 'high' },
  { id: 'voice-5', name: '美咲', language: 'ja', gender: 'female', style: 'cheerful', isCustom: false, isPremium: true, quality: 'ultra' },
  { id: 'voice-6', name: '敏俊', language: 'ko', gender: 'male', style: 'calm', isCustom: false, isPremium: true, quality: 'ultra' },
];

const DEFAULT_TTS_SETTINGS: TTSGenerationSettings = {
  text: '',
  voiceId: 'voice-1',
  language: 'zh-cn',
  speed: 1.0,
  pitch: 1.0,
  volume: 1.0,
  style: 'neutral',
  addBreathing: true,
  addPauses: true,
};

const DEFAULT_CLONE_SETTINGS: VoiceCloneSettings = {
  referenceAudioUrl: '',
  cloneQuality: 'balanced',
  preserveEmotion: true,
  enhanceAudio: true,
};

export const useVoiceCloneStore = create<VoiceCloneStore>()(
  immer((set, get) => ({
    voices: BUILTIN_VOICES,
    ttsSettings: DEFAULT_TTS_SETTINGS,
    cloneSettings: DEFAULT_CLONE_SETTINGS,
    cloneJobs: [],
    ttsJobs: [],
    activeJobId: null,

    setVoices: (voices) =>
      set((state) => {
        state.voices = voices;
      }),

    addVoice: (voice) =>
      set((state) => {
        state.voices.push(voice);
      }),

    removeVoice: (voiceId) =>
      set((state) => {
        state.voices = state.voices.filter((v) => v.id !== voiceId);
      }),

    updateTTSSettings: (newSettings) =>
      set((state) => {
        Object.assign(state.ttsSettings, newSettings);
      }),

    updateCloneSettings: (newSettings) =>
      set((state) => {
        Object.assign(state.cloneSettings, newSettings);
      }),

    startClone: () => {
      const jobId = `clone-${Date.now()}`;
      const job: VoiceCloneJob = {
        id: jobId,
        status: 'pending',
        progress: 0,
        settings: { ...get().cloneSettings },
      };

      set((state) => {
        state.cloneJobs.push(job);
        state.activeJobId = jobId;
      });

      return jobId;
    },

    updateCloneProgress: (jobId, progress) =>
      set((state) => {
        const job = state.cloneJobs.find((j) => j.id === jobId);
        if (job) {
          job.progress = progress;
          job.status = 'processing';
        }
      }),

    completeClone: (jobId, voice) =>
      set((state) => {
        const job = state.cloneJobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'completed';
          job.progress = 100;
          job.result = voice;
        }
        state.voices.push(voice);
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      }),

    failClone: (jobId, error) =>
      set((state) => {
        const job = state.cloneJobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'failed';
          job.error = error;
        }
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      }),

    startTTS: () => {
      const jobId = `tts-${Date.now()}`;
      const job: TTSJob = {
        id: jobId,
        status: 'pending',
        progress: 0,
        settings: { ...get().ttsSettings },
      };

      set((state) => {
        state.ttsJobs.push(job);
        state.activeJobId = jobId;
      });

      return jobId;
    },

    updateTTSProgress: (jobId, progress) =>
      set((state) => {
        const job = state.ttsJobs.find((j) => j.id === jobId);
        if (job) {
          job.progress = progress;
          job.status = 'processing';
        }
      }),

    completeTTS: (jobId, outputUrl, duration) =>
      set((state) => {
        const job = state.ttsJobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'completed';
          job.progress = 100;
          job.outputUrl = outputUrl;
          job.duration = duration;
        }
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      }),

    failTTS: (jobId, error) =>
      set((state) => {
        const job = state.ttsJobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'failed';
          job.error = error;
        }
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      }),

    setActiveJob: (jobId) =>
      set((state) => {
        state.activeJobId = jobId;
      }),
  }))
);

export class VoiceCloneService {
  private static instance: VoiceCloneService;

  static getInstance(): VoiceCloneService {
    if (!VoiceCloneService.instance) {
      VoiceCloneService.instance = new VoiceCloneService();
    }
    return VoiceCloneService.instance;
  }

  getLanguages(): { id: VoiceLanguage; name: string }[] {
    return [
      { id: 'zh-cn', name: '中文(简体)' },
      { id: 'zh-tw', name: '中文(繁体)' },
      { id: 'en-us', name: '英语(美式)' },
      { id: 'en-gb', name: '英语(英式)' },
      { id: 'ja', name: '日语' },
      { id: 'ko', name: '韩语' },
      { id: 'de', name: '德语' },
      { id: 'fr', name: '法语' },
      { id: 'es', name: '西班牙语' },
      { id: 'ru', name: '俄语' },
    ];
  }

  getStyles(): { id: VoiceStyle; name: string }[] {
    return [
      { id: 'neutral', name: '中性' },
      { id: 'cheerful', name: '欢快' },
      { id: 'sad', name: '悲伤' },
      { id: 'angry', name: '愤怒' },
      { id: 'calm', name: '平静' },
      { id: 'excited', name: '兴奋' },
      { id: 'whisper', name: '耳语' },
    ];
  }

  getQualityOptions(): { id: string; name: string; time: string }[] {
    return [
      { id: 'fast', name: '快速', time: '约30秒' },
      { id: 'balanced', name: '平衡', time: '约1分钟' },
      { id: 'quality', name: '高质量', time: '约3分钟' },
    ];
  }

  generateCoquiTTSCommand(settings: TTSGenerationSettings, outputPath: string): string {
    return `tts --text "${settings.text}" ` +
      `--model_name tts_models/${settings.language}/custom ` +
      `--out_path ${outputPath} ` +
      `--speed ${settings.speed}`;
  }

  generateCloneCommand(settings: VoiceCloneSettings, outputPath: string): string {
    return `tts --model_name tts_models/multilingual/multi-dataset/your_tts ` +
      `--speaker_wav ${settings.referenceAudioUrl} ` +
      `--out_path ${outputPath}`;
  }

  estimateTTSTime(textLength: number): number {
    return Math.ceil(textLength / 50 + 2);
  }

  estimateCloneTime(quality: string): number {
    const times: Record<string, number> = {
      fast: 30,
      balanced: 60,
      quality: 180,
    };
    return times[quality] || 60;
  }
}

export const voiceCloneService = VoiceCloneService.getInstance();
