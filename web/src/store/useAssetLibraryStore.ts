import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  CharacterAsset,
  ProjectCharacterReference,
  ProjectPropReference,
  ProjectSceneReference,
  ProjectVoiceReference,
  PropAsset,
  SceneAsset,
  VoiceAsset,
} from '@/types/asset-library';

interface AssetLibraryState {
  characterAssets: CharacterAsset[];
  voiceAssets: VoiceAsset[];
  sceneAssets: SceneAsset[];
  propAssets: PropAsset[];
  upsertCharacterAsset: (asset: CharacterAsset) => void;
  deleteCharacterAsset: (assetId: string) => void;
  upsertVoiceAsset: (asset: VoiceAsset) => void;
  deleteVoiceAsset: (assetId: string) => void;
  upsertSceneAsset: (asset: SceneAsset) => void;
  deleteSceneAsset: (assetId: string) => void;
  upsertPropAsset: (asset: PropAsset) => void;
  setPropAssets: (assets: PropAsset[]) => void;
  deletePropAsset: (assetId: string) => void;
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) {
    return [...items, nextItem];
  }

  const copy = [...items];
  copy[index] = nextItem;
  return copy;
}

export const useAssetLibraryStore = create<AssetLibraryState>()(
  persist(
    (set) => ({
      characterAssets: [],
      voiceAssets: [],
      sceneAssets: [],
      propAssets: [],
      upsertCharacterAsset: (asset) =>
        set((state) => ({
          characterAssets: upsertById(state.characterAssets, asset),
        })),
      deleteCharacterAsset: (assetId) =>
        set((state) => ({
          characterAssets: state.characterAssets.filter((asset) => asset.id !== assetId),
        })),
      upsertVoiceAsset: (asset) =>
        set((state) => ({
          voiceAssets: upsertById(state.voiceAssets, asset),
        })),
      deleteVoiceAsset: (assetId) =>
        set((state) => ({
          voiceAssets: state.voiceAssets.filter((asset) => asset.id !== assetId),
        })),
      upsertSceneAsset: (asset) =>
        set((state) => ({
          sceneAssets: upsertById(state.sceneAssets, asset),
        })),
      deleteSceneAsset: (assetId) =>
        set((state) => ({
          sceneAssets: state.sceneAssets.filter((asset) => asset.id !== assetId),
        })),
      upsertPropAsset: (asset) =>
        set((state) => ({
          propAssets: upsertById(state.propAssets, asset),
        })),
      setPropAssets: (assets) =>
        set({
          propAssets: assets,
        }),
      deletePropAsset: (assetId) =>
        set((state) => ({
          propAssets: state.propAssets.filter((asset) => asset.id !== assetId),
        })),
    }),
    {
      name: 'asset-library-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        characterAssets: state.characterAssets,
        voiceAssets: state.voiceAssets,
        sceneAssets: state.sceneAssets,
        propAssets: state.propAssets,
      }),
    },
  ),
);

export function resolveProjectCharacterReference(
  reference: ProjectCharacterReference,
  assets: CharacterAsset[],
) {
  const asset = assets.find((entry) => entry.id === reference.characterAssetId) || null;
  if (!asset) {
    return {
      status: 'missing' as const,
      asset: null,
    };
  }

  return {
    status: 'ready' as const,
    asset: {
      ...asset,
      ...reference.overrides,
    },
  };
}

export function resolveProjectVoiceReference(
  reference: ProjectVoiceReference,
  assets: VoiceAsset[],
) {
  const asset = assets.find((entry) => entry.id === reference.voiceAssetId) || null;
  if (!asset) {
    return {
      status: 'missing' as const,
      asset: null,
    };
  }

  return {
    status: 'ready' as const,
    asset: {
      ...asset,
      ...reference.overrides,
    },
  };
}

export function resolveProjectSceneReference(
  reference: ProjectSceneReference,
  assets: SceneAsset[],
) {
  const asset = assets.find((entry) => entry.id === reference.sceneAssetId) || null;
  if (!asset) {
    return {
      status: 'missing' as const,
      asset: null,
    };
  }

  return {
    status: 'ready' as const,
    asset: {
      ...asset,
      ...reference.overrides,
    },
  };
}

export function resolveProjectPropReference(
  reference: ProjectPropReference,
  assets: PropAsset[],
) {
  const asset = assets.find((entry) => entry.id === reference.propAssetId) || null;
  if (!asset) {
    return {
      status: 'missing' as const,
      asset: null,
    };
  }

  return {
    status: 'ready' as const,
    asset: {
      ...asset,
      ...reference.overrides,
    },
  };
}
