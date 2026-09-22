import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type MusicGenre = 
  | 'electronic'
  | 'ambient'
  | 'cinematic'
  | 'pop'
  | 'rock'
  | 'classical'
  | 'jazz'
  | 'hiphop'
  | 'lofi'
  | 'custom';

export type MusicMood = 
  | 'happy'
  | 'sad'
  | 'energetic'
  | 'calm'
  | 'dramatic'
  | 'romantic'
  | 'mysterious'
  | 'epic';

export type MusicDuration = 15 | 30 | 60 | 90 | 120;

export interface MusicGenerationSettings {
  prompt: string;
  genre: MusicGenre;
  mood: MusicMood;
  duration: MusicDuration;
  tempo: number;
  key: string;
  instruments: string[];
  vocals: boolean;
  loop: boolean;
  fadeOut: boolean;
  fadeOutDuration: number;
}

export interface GeneratedMusic {
  id: string;
  prompt: string;
  settings: MusicGenerationSettings;
  url: string;
  waveform: number[];
  duration: number;
  createdAt: Date;
  favorite: boolean;
}

export interface MusicGenerationJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  settings: MusicGenerationSettings;
  result?: GeneratedMusic;
  error?: string;
}

export interface MusicGenerationState {
  settings: MusicGenerationSettings;
  generatedMusic: GeneratedMusic[];
  jobs: MusicGenerationJob[];
  activeJobId: string | null;
  favorites: string[];
}

interface MusicGenerationStore extends MusicGenerationState {
  updateSettings: (settings: Partial<MusicGenerationSettings>) => void;
  
  startGeneration: () => string;
  updateJobProgress: (jobId: string, progress: number) => void;
  completeJob: (jobId: string, music: GeneratedMusic) => void;
  failJob: (jobId: string, error: string) => void;
  
  toggleFavorite: (musicId: string) => void;
  deleteMusic: (musicId: string) => void;
  
  setActiveJob: (jobId: string | null) => void;
}

const DEFAULT_SETTINGS: MusicGenerationSettings = {
  prompt: '',
  genre: 'electronic',
  mood: 'energetic',
  duration: 30,
  tempo: 120,
  key: 'C',
  instruments: [],
  vocals: false,
  loop: true,
  fadeOut: true,
  fadeOutDuration: 2,
};

const GENRE_OPTIONS: { id: MusicGenre; name: string; description: string }[] = [
  { id: 'electronic', name: '电子', description: '电子音乐风格' },
  { id: 'ambient', name: '氛围', description: '氛围音乐' },
  { id: 'cinematic', name: '电影', description: '电影配乐风格' },
  { id: 'pop', name: '流行', description: '流行音乐' },
  { id: 'rock', name: '摇滚', description: '摇滚音乐' },
  { id: 'classical', name: '古典', description: '古典音乐' },
  { id: 'jazz', name: '爵士', description: '爵士音乐' },
  { id: 'hiphop', name: '嘻哈', description: '嘻哈音乐' },
  { id: 'lofi', name: 'Lo-Fi', description: '低保真音乐' },
];

const MOOD_OPTIONS: { id: MusicMood; name: string; emoji: string }[] = [
  { id: 'happy', name: '欢快', emoji: '😊' },
  { id: 'sad', name: '悲伤', emoji: '😢' },
  { id: 'energetic', name: '活力', emoji: '⚡' },
  { id: 'calm', name: '平静', emoji: '😌' },
  { id: 'dramatic', name: '戏剧', emoji: '🎭' },
  { id: 'romantic', name: '浪漫', emoji: '💕' },
  { id: 'mysterious', name: '神秘', emoji: '🌙' },
  { id: 'epic', name: '史诗', emoji: '⚔️' },
];

const KEY_OPTIONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const useMusicGenerationStore = create<MusicGenerationStore>()(
  immer((set, get) => ({
    settings: DEFAULT_SETTINGS,
    generatedMusic: [],
    jobs: [],
    activeJobId: null,
    favorites: [],

    updateSettings: (newSettings) =>
      set((state) => {
        Object.assign(state.settings, newSettings);
      }),

    startGeneration: () => {
      const jobId = `music-${Date.now()}`;
      const job: MusicGenerationJob = {
        id: jobId,
        status: 'pending',
        progress: 0,
        settings: { ...get().settings },
      };

      set((state) => {
        state.jobs.push(job);
        state.activeJobId = jobId;
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

    completeJob: (jobId, music) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'completed';
          job.progress = 100;
          job.result = music;
        }
        state.generatedMusic.unshift(music);
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      }),

    failJob: (jobId, error) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'failed';
          job.error = error;
        }
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      }),

    toggleFavorite: (musicId) =>
      set((state) => {
        const index = state.favorites.indexOf(musicId);
        if (index === -1) {
          state.favorites.push(musicId);
        } else {
          state.favorites.splice(index, 1);
        }
        const music = state.generatedMusic.find((m) => m.id === musicId);
        if (music) {
          music.favorite = !music.favorite;
        }
      }),

    deleteMusic: (musicId) =>
      set((state) => {
        state.generatedMusic = state.generatedMusic.filter((m) => m.id !== musicId);
        state.favorites = state.favorites.filter((id) => id !== musicId);
      }),

    setActiveJob: (jobId) =>
      set((state) => {
        state.activeJobId = jobId;
      }),
  }))
);

export class MusicGenerationService {
  private static instance: MusicGenerationService;

  static getInstance(): MusicGenerationService {
    if (!MusicGenerationService.instance) {
      MusicGenerationService.instance = new MusicGenerationService();
    }
    return MusicGenerationService.instance;
  }

  getGenreOptions() {
    return GENRE_OPTIONS;
  }

  getMoodOptions() {
    return MOOD_OPTIONS;
  }

  getKeyOptions() {
    return KEY_OPTIONS;
  }

  getDurationOptions(): { value: MusicDuration; label: string }[] {
    return [
      { value: 15, label: '15秒' },
      { value: 30, label: '30秒' },
      { value: 60, label: '1分钟' },
      { value: 90, label: '1分30秒' },
      { value: 120, label: '2分钟' },
    ];
  }

  getInstrumentOptions(): string[] {
    return [
      'piano', 'guitar', 'drums', 'bass', 'synth',
      'violin', 'cello', 'flute', 'saxophone', 'trumpet',
    ];
  }

  generatePrompt(settings: MusicGenerationSettings): string {
    const parts: string[] = [];
    
    if (settings.prompt) {
      parts.push(settings.prompt);
    }
    
    const genre = GENRE_OPTIONS.find((g) => g.id === settings.genre);
    if (genre) {
      parts.push(genre.name + '风格');
    }
    
    const mood = MOOD_OPTIONS.find((m) => m.id === settings.mood);
    if (mood) {
      parts.push(mood.name + '情绪');
    }
    
    parts.push(`${settings.tempo} BPM`);
    parts.push(`${settings.key}调`);
    
    if (settings.instruments.length > 0) {
      parts.push('乐器: ' + settings.instruments.join(', '));
    }
    
    return parts.join(', ');
  }

  generateMusicGenCommand(settings: MusicGenerationSettings): string {
    const prompt = this.generatePrompt(settings);
    return `musicgen --prompt "${prompt}" --duration ${settings.duration} --model large`;
  }

  estimateGenerationTime(duration: MusicDuration): number {
    return Math.ceil(duration * 0.5 + 10);
  }
}

export const musicGenerationService = MusicGenerationService.getInstance();
