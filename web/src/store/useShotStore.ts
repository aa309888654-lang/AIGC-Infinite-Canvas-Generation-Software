import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Shot } from '@/types/shot-system';
import { generateShotsFromScript, updateShotTimestamp } from '@/services/shot-generator-service';

interface ShotState {
  scriptDraft: string;
  shots: Shot[];
  selectedShotId: string | null;
  setScriptDraft: (script: string) => void;
  generateFromScript: (script?: string) => Shot[];
  setShots: (shots: Shot[]) => void;
  updateShot: (shotId: string, patch: Partial<Shot>) => void;
  moveShot: (shotId: string, direction: 'up' | 'down') => void;
  selectShotVersion: (shotId: string, mediaType: 'image' | 'video', versionId: string) => void;
  removeShot: (shotId: string) => void;
  selectShot: (shotId: string | null) => void;
  clearShots: () => void;
}

function reindexShots(shots: Shot[]): Shot[] {
  return shots.map((shot, index) => {
    const nextIndex = index + 1;
    const nextTitle = /^镜头\s*\d+$/u.test(shot.title) ? `镜头 ${String(nextIndex).padStart(2, '0')}` : shot.title;

    return {
      ...shot,
      index: nextIndex,
      title: nextTitle,
      updatedAt: new Date().toISOString(),
    };
  });
}

export const useShotStore = create<ShotState>()(
  persist(
    (set, get) => ({
      scriptDraft: '',
      shots: [],
      selectedShotId: null,

      setScriptDraft: (script) => set({ scriptDraft: script }),

      generateFromScript: (script) => {
        const source = script ?? get().scriptDraft;
        const shots = generateShotsFromScript({ script: source });
        set({
          scriptDraft: source,
          shots,
          selectedShotId: shots[0]?.id ?? null,
        });
        return shots;
      },

      setShots: (shots) => set({ shots, selectedShotId: shots[0]?.id ?? null }),

      updateShot: (shotId, patch) =>
        set((state) => ({
          shots: state.shots.map((shot) =>
            shot.id === shotId ? { ...shot, ...updateShotTimestamp(patch) } : shot
          ),
        })),

      moveShot: (shotId, direction) =>
        set((state) => {
          const currentIndex = state.shots.findIndex((shot) => shot.id === shotId);
          if (currentIndex < 0) return state;

          const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
          if (targetIndex < 0 || targetIndex >= state.shots.length) return state;

          const shots = [...state.shots];
          const [shot] = shots.splice(currentIndex, 1);
          shots.splice(targetIndex, 0, shot);

          return { shots: reindexShots(shots) };
        }),

      selectShotVersion: (shotId, mediaType, versionId) =>
        set((state) => ({
          shots: state.shots.map((shot) =>
            shot.id === shotId
              ? {
                  ...shot,
                  ...updateShotTimestamp(
                    mediaType === 'image'
                      ? { selectedImageVersionId: versionId }
                      : { selectedVideoVersionId: versionId }
                  ),
                }
              : shot
          ),
        })),

      removeShot: (shotId) =>
        set((state) => {
          const shots = reindexShots(state.shots.filter((shot) => shot.id !== shotId));
          return {
            shots,
            selectedShotId: state.selectedShotId === shotId ? shots[0]?.id ?? null : state.selectedShotId,
          };
        }),

      selectShot: (shotId) => set({ selectedShotId: shotId }),

      clearShots: () => set({ shots: [], selectedShotId: null }),
    }),
    {
      name: 'aicg-shot-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
