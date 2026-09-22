import { create } from 'zustand';

export interface OneClickTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  thumbnail: string;
  segments: TemplateSegment[];
  bgmStyle: string;
  totalDuration: number;
}

export interface TemplateSegment {
  index: number;
  duration: number;
  promptTemplate: string;
  cameraMovement: string;
  transition: string;
  userPrompt: string;
}

export interface VideoSegment {
  index: number;
  duration: number;
  prompt: string;
  status: 'idle' | 'generating' | 'done' | 'failed';
  videoUrl?: string;
  thumbnail?: string;
  error?: string;
  taskId?: string;
}

export interface BgmTrack {
  id: string;
  name: string;
  style: string;
  duration: number;
  url: string;
  source: 'library' | 'ai';
}

export interface ComposeSettings {
  resolution: '720p' | '1080p';
  fps: 24 | 30;
  bgmVolume: number;
}

interface OneClickVideoState {
  sourceImage: string | null;
  selectedTemplateId: string | null;
  editedPrompts: Record<number, string>;
  segments: VideoSegment[];
  selectedBgm: BgmTrack | null;
  composeSettings: ComposeSettings;
  isGenerating: boolean;
  isComposing: boolean;
  composeProgress: number;
  composeResultUrl: string | null;

  setSourceImage: (image: string | null) => void;
  setSelectedTemplateId: (id: string | null) => void;
  setEditedPrompt: (index: number, prompt: string) => void;
  setSegments: (segments: VideoSegment[]) => void;
  updateSegment: (index: number, partial: Partial<VideoSegment>) => void;
  setSelectedBgm: (bgm: BgmTrack | null) => void;
  setComposeSettings: (settings: Partial<ComposeSettings>) => void;
  setIsGenerating: (v: boolean) => void;
  setIsComposing: (v: boolean) => void;
  setComposeProgress: (v: number) => void;
  setComposeResultUrl: (url: string | null) => void;
  reset: () => void;
}

const initialState = {
  sourceImage: null,
  selectedTemplateId: null,
  editedPrompts: {},
  segments: [],
  selectedBgm: null,
  composeSettings: { resolution: '1080p' as const, fps: 24 as const, bgmVolume: 0.7 },
  isGenerating: false,
  isComposing: false,
  composeProgress: 0,
  composeResultUrl: null,
};

export const useOneClickVideoStore = create<OneClickVideoState>((set) => ({
  ...initialState,

  setSourceImage: (image) => set({ sourceImage: image }),
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
  setEditedPrompt: (index, prompt) =>
    set((state) => ({ editedPrompts: { ...state.editedPrompts, [index]: prompt } })),
  setSegments: (segments) => set({ segments }),
  updateSegment: (index, partial) =>
    set((state) => ({
      segments: state.segments.map((s, i) => (i === index ? { ...s, ...partial } : s)),
    })),
  setSelectedBgm: (bgm) => set({ selectedBgm: bgm }),
  setComposeSettings: (settings) =>
    set((state) => ({ composeSettings: { ...state.composeSettings, ...settings } })),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setIsComposing: (v) => set({ isComposing: v }),
  setComposeProgress: (v) => set({ composeProgress: v }),
  setComposeResultUrl: (url) => set({ composeResultUrl: url }),
  reset: () => set(initialState),
}));
