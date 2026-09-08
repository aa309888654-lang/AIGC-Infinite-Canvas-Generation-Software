import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generateId } from '@/lib/utils';
import type { GenerationMediaType, GenerationVersion, GenerationVersionInput } from '@/types/generation-version';

interface GenerationVersionState {
  versions: GenerationVersion[];
  upsertFromNodeResult: (input: GenerationVersionInput) => GenerationVersion;
  selectVersion: (versionId: string) => void;
  toggleFavorite: (versionId: string) => void;
  removeVersionsForShot: (shotId: string) => void;
  clearVersions: () => void;
}

function sameVersion(version: GenerationVersion, input: GenerationVersionInput) {
  return version.shotId === input.shotId && version.nodeId === input.nodeId && version.url === input.url;
}

function hasSelectedVersion(versions: GenerationVersion[], shotId: string, mediaType: GenerationMediaType) {
  return versions.some((version) => version.shotId === shotId && version.mediaType === mediaType && version.selected);
}

export const useGenerationVersionStore = create<GenerationVersionState>()(
  persist(
    (set, get) => ({
      versions: [],

      upsertFromNodeResult: (input) => {
        const now = new Date().toISOString();
        const existing = get().versions.find((version) => sameVersion(version, input));

        if (existing) {
          const updated: GenerationVersion = {
            ...existing,
            nodeType: input.nodeType ?? existing.nodeType,
            prompt: input.prompt ?? existing.prompt,
            modelId: input.modelId ?? existing.modelId,
            params: input.params ?? existing.params,
            source: input.source ?? existing.source,
            updatedAt: now,
          };

          set((state) => ({
            versions: state.versions.map((version) => (version.id === existing.id ? updated : version)),
          }));
          return updated;
        }

        const selected = !hasSelectedVersion(get().versions, input.shotId, input.mediaType);
        const version: GenerationVersion = {
          ...input,
          id: generateId(),
          selected,
          source: input.source ?? 'node-sync',
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({ versions: [version, ...state.versions] }));
        return version;
      },

      selectVersion: (versionId) =>
        set((state) => {
          const selected = state.versions.find((version) => version.id === versionId);
          if (!selected) return state;

          return {
            versions: state.versions.map((version) =>
              version.shotId === selected.shotId && version.mediaType === selected.mediaType
                ? { ...version, selected: version.id === versionId, updatedAt: version.id === versionId ? new Date().toISOString() : version.updatedAt }
                : version
            ),
          };
        }),

      toggleFavorite: (versionId) =>
        set((state) => ({
          versions: state.versions.map((version) =>
            version.id === versionId
              ? { ...version, favorite: !version.favorite, updatedAt: new Date().toISOString() }
              : version
          ),
        })),

      removeVersionsForShot: (shotId) =>
        set((state) => ({ versions: state.versions.filter((version) => version.shotId !== shotId) })),

      clearVersions: () => set({ versions: [] }),
    }),
    {
      name: 'aicg-generation-version-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
