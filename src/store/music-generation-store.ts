import { create } from 'zustand';
import { persist } from 'zustand/middleware';

let historySequence = 0;

export interface MusicResult {
  lyrics: string;
  songTitle: string;
  styleTags: string;
  audioUrl: string;
  extraAudioUrl: string;
  coverImageUrl: string;
}

export interface SongInfo {
  title: string;
  artist: string;
  composer: string;
  lyricist: string;
  arranger: string;
  producer: string;
  album: string;
  genre: string;
  year: string;
  comment: string;
}

export interface HistoryItem {
  id: string;
  type: 'lyrics' | 'music' | 'cover' | 'preset';
  title: string;
  prompt?: string;
  result?: string;
  timestamp: string; // using string instead of Date for JSON serialization
}

interface MusicGenerationState {
  currentStep: 'lyrics' | 'music' | 'cover' | 'done';
  mode: 'full' | 'cover';
  selectedStyle: string;
  selectedMood: string;
  selectedTempo: string;
  selectedTemplate: string;
  customPrompt: string;
  songTitle: string;
  lyricsContent: string;
  lyrics: string;
  generatedSongTitle: string;
  generatedStyleTags: string;
  result: MusicResult;
  coverAudioUrl: string;
  coverPrompt: string;
  coverLyrics: string;
  coverImageStyle: string;
  autoCoverPrompt: boolean;
  songInfo: SongInfo;
  history: HistoryItem[];
  volume: number;
  isMuted: boolean;
  musicTheme: 'dark' | 'light';
  // 当前正在生成的音乐任务 ID（用于进度查询/取消）
  generatingTaskId: string | null;
  // 取消标志（外部 bridge 检测此标志中断轮询）
  cancelGenerationFlag: boolean;

  setCurrentStep: (step: 'lyrics' | 'music' | 'cover' | 'done') => void;
  setMode: (mode: 'full' | 'cover') => void;
  setSelectedStyle: (style: string) => void;
  setSelectedMood: (mood: string) => void;
  setSelectedTempo: (tempo: string) => void;
  setSelectedTemplate: (template: string) => void;
  setCustomPrompt: (prompt: string) => void;
  setSongTitle: (title: string) => void;
  setLyricsContent: (content: string) => void;
  setLyrics: (lyrics: string) => void;
  setGeneratedSongTitle: (title: string) => void;
  setGeneratedStyleTags: (tags: string) => void;
  setResult: (result: Partial<MusicResult>) => void;
  setCoverAudioUrl: (url: string) => void;
  setCoverPrompt: (prompt: string) => void;
  setCoverLyrics: (lyrics: string) => void;
  setCoverImageStyle: (style: string) => void;
  setAutoCoverPrompt: (auto: boolean) => void;
  setSongInfo: (info: Partial<SongInfo>) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setMusicTheme: (theme: 'dark' | 'light') => void;
  addToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  resetState: () => void;
  resetAll: () => void;
  setGeneratingTaskId: (taskId: string | null) => void;
  setCancelGenerationFlag: (cancel: boolean) => void;
}

const initialResult: MusicResult = {
  lyrics: '',
  songTitle: '',
  styleTags: '',
  audioUrl: '',
  extraAudioUrl: '',
  coverImageUrl: '',
};

const initialSongInfo: SongInfo = {
  title: '',
  artist: '',
  composer: '',
  lyricist: '',
  arranger: '',
  producer: '',
  album: '',
  genre: '',
  year: new Date().getFullYear().toString(),
  comment: '',
};

export const useMusicGenerationStore = create<MusicGenerationState>()(
  persist(
    (set) => ({
      currentStep: 'lyrics',
      mode: 'full',
      selectedStyle: '',
      selectedMood: '',
      selectedTempo: '',
      selectedTemplate: '',
      customPrompt: '',
      songTitle: '',
      lyricsContent: '',
      lyrics: '',
      generatedSongTitle: '',
      generatedStyleTags: '',
      result: initialResult,
      coverAudioUrl: '',
      coverPrompt: '',
      coverLyrics: '',
      coverImageStyle: 'dreamy',
      autoCoverPrompt: true,
      songInfo: initialSongInfo,
      history: [],
      volume: 1,
      isMuted: false,
      musicTheme: 'dark',
      generatingTaskId: null,
      cancelGenerationFlag: false,

      setCurrentStep: (step) => set({ currentStep: step }),
      setMode: (mode) => set({ mode }),
      setSelectedStyle: (style) => set({ selectedStyle: style }),
      setSelectedMood: (mood) => set({ selectedMood: mood }),
      setSelectedTempo: (tempo) => set({ selectedTempo: tempo }),
      setSelectedTemplate: (template) => set({ selectedTemplate: template }),
      setCustomPrompt: (prompt) => set({ customPrompt: prompt }),
      setSongTitle: (title) => set({ songTitle: title }),
      setLyricsContent: (content) => set({ lyricsContent: content }),
      setLyrics: (lyrics) => set({ lyrics }),
      setGeneratedSongTitle: (title) => set({ generatedSongTitle: title }),
      setGeneratedStyleTags: (tags) => set({ generatedStyleTags: tags }),
      setResult: (result) => set((state) => ({
        result: { ...state.result, ...result }
      })),
      setCoverAudioUrl: (url) => set({ coverAudioUrl: url }),
      setCoverPrompt: (prompt) => set({ coverPrompt: prompt }),
      setCoverLyrics: (lyrics) => set({ coverLyrics: lyrics }),
      setCoverImageStyle: (style) => set({ coverImageStyle: style }),
      setAutoCoverPrompt: (auto) => set({ autoCoverPrompt: auto }),
      setSongInfo: (info) => set((state) => ({
        songInfo: { ...state.songInfo, ...info }
      })),
      setVolume: (volume) => set({ volume }),
      setIsMuted: (muted) => set({ isMuted: muted }),
      setMusicTheme: (theme) => set({ musicTheme: theme }),
      setGeneratingTaskId: (taskId) => set((state) => ({
        generatingTaskId: taskId,
        cancelGenerationFlag: taskId ? false : state.cancelGenerationFlag,
      })),
      setCancelGenerationFlag: (cancel) => set({ cancelGenerationFlag: cancel }),
      addToHistory: (item) => set((state) => ({
        history: [
          {
            ...item,
            id: `hist_${Date.now()}_${++historySequence}`,
            timestamp: new Date().toISOString(),
          } as HistoryItem,
          ...state.history,
        ].slice(0, 50),
      })),
      resetState: () => set({
        currentStep: 'lyrics',
        selectedStyle: '',
        selectedMood: '',
        selectedTempo: '',
        selectedTemplate: '',
        customPrompt: '',
        songTitle: '',
        lyricsContent: '',
        lyrics: '',
        generatedSongTitle: '',
        generatedStyleTags: '',
        result: initialResult,
        coverAudioUrl: '',
        coverPrompt: '',
        coverLyrics: '',
        coverImageStyle: 'dreamy',
        autoCoverPrompt: true,
      }),
      resetAll: () => set({
        currentStep: 'lyrics',
        mode: 'full',
        selectedStyle: '',
        selectedMood: '',
        selectedTempo: '',
        selectedTemplate: '',
        customPrompt: '',
        songTitle: '',
        lyricsContent: '',
        lyrics: '',
        generatedSongTitle: '',
        generatedStyleTags: '',
        result: initialResult,
        coverAudioUrl: '',
        coverPrompt: '',
        coverLyrics: '',
        coverImageStyle: 'dreamy',
        autoCoverPrompt: true,
        songInfo: initialSongInfo,
        history: [],
        volume: 1,
        isMuted: false,
        musicTheme: 'dark',
      }),
    }),
    {
      name: 'music-generation-storage',
      partialize: (state) => ({
        currentStep: state.currentStep,
        mode: state.mode,
        selectedStyle: state.selectedStyle,
        selectedMood: state.selectedMood,
        selectedTempo: state.selectedTempo,
        selectedTemplate: state.selectedTemplate,
        customPrompt: state.customPrompt,
        songTitle: state.songTitle,
        lyricsContent: state.lyricsContent,
        lyrics: state.lyrics,
        generatedSongTitle: state.generatedSongTitle,
        generatedStyleTags: state.generatedStyleTags,
        result: state.result,
        coverAudioUrl: state.coverAudioUrl,
        coverPrompt: state.coverPrompt,
        coverLyrics: state.coverLyrics,
        coverImageStyle: state.coverImageStyle,
        autoCoverPrompt: state.autoCoverPrompt,
        songInfo: state.songInfo,
        history: state.history,
        volume: state.volume,
        isMuted: state.isMuted,
        musicTheme: state.musicTheme,
      }),
    }
  )
);

export default useMusicGenerationStore;
