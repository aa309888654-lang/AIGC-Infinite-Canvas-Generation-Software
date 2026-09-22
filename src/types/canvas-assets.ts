export const CANVAS_ASSET_MANIFEST_VERSION = 1 as const;

export type CanvasAssetKind = 'image' | 'video' | 'audio' | 'thumbnail' | 'model';
export type CanvasAssetRole = 'primary' | 'thumbnail' | 'source';
export type CanvasAssetStatus = 'active' | 'trash';
export type CanvasAssetStorageMode = 'desktop-file' | 'indexeddb';
export type CanvasAssetSource = 'imported' | 'generated';

export interface PersistedCanvasAssetRef {
  assetId: string;
  kind: CanvasAssetKind;
  role: CanvasAssetRole;
}

export interface CanvasAssetRecord {
  id: string;
  projectId: string;
  kind: CanvasAssetKind;
  role: CanvasAssetRole;
  status: CanvasAssetStatus;
  source: CanvasAssetSource;
  storageMode: CanvasAssetStorageMode;
  fileName: string;
  mimeType: string;
  projectRelativePath: string;
  thumbnailRelativePath?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  nodeIds: string[];
}

export interface CanvasAssetManifest {
  version: typeof CANVAS_ASSET_MANIFEST_VERSION;
  projectId: string;
  assets: Record<string, CanvasAssetRecord>;
  deletedAssets: Record<string, CanvasAssetRecord>;
  updatedAt: string;
}
