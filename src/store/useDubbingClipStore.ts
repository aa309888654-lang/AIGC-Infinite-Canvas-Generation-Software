import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type DubbingClipTag = 'narration' | 'dialogue' | 'sfx' | 'music';

export interface DubbingClip {
  id: string;
  text: string;
  audioUrl: string;
  voiceId: string;
  persona?: string;
  emotion?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  duration?: number;
  format?: string;
  model?: string;
  tag?: DubbingClipTag;
  createdAt: number;
}

interface DubbingClipState {
  clips: DubbingClip[];
  activeClipId: string | null;
  addClip: (clip: Omit<DubbingClip, 'id' | 'createdAt'> & Partial<Pick<DubbingClip, 'id' | 'createdAt'>>) => string;
  updateClip: (id: string, patch: Partial<DubbingClip>) => void;
  removeClip: (id: string) => void;
  clearAll: () => void;
  setActive: (id: string | null) => void;
  getActive: () => DubbingClip | undefined;
  recent: (limit?: number) => DubbingClip[];
}

const STORAGE_NAME = 'dubbing-clips-store';
const MAX_CLIPS = 50;

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useDubbingClipStore = create<DubbingClipState>()(
  persist(
    (set, get) => ({
      clips: [],
      activeClipId: null,

      addClip: (clip) => {
        const id = clip.id ?? genId();
        const createdAt = clip.createdAt ?? Date.now();
        const full: DubbingClip = { ...clip, id, createdAt };
        set((state) => ({
          clips: [full, ...state.clips].slice(0, MAX_CLIPS),
          activeClipId: id,
        }));
        return id;
      },

      updateClip: (id, patch) => {
        set((state) => ({
          clips: state.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
      },

      removeClip: (id) => {
        set((state) => ({
          clips: state.clips.filter((c) => c.id !== id),
          activeClipId: state.activeClipId === id ? null : state.activeClipId,
        }));
      },

      clearAll: () => set({ clips: [], activeClipId: null }),

      setActive: (id) => set({ activeClipId: id }),

      getActive: () => {
        const { clips, activeClipId } = get();
        return clips.find((c) => c.id === activeClipId);
      },

      recent: (limit = 10) => {
        const { clips } = get();
        return clips.slice(0, limit);
      },
    }),
    {
      name: STORAGE_NAME,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ clips: state.clips, activeClipId: state.activeClipId }),
    },
  ),
);
