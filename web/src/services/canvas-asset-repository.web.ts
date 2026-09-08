import {
  CANVAS_ASSET_MANIFEST_VERSION,
  type CanvasAssetManifest,
  type CanvasAssetRecord,
} from '@/types/canvas-assets';
import type { CanvasAssetRepository, ImportCanvasAssetInput } from './canvas-asset-repository';

const DB_NAME = 'canvas-assets';
const STORE_NAME = 'asset-blobs';
const DB_VERSION = 1;
const MANIFEST_STORAGE_PREFIX = 'canvas-asset-manifest:';

const manifestCache = new Map<string, CanvasAssetManifest>();
const runtimeUrlCache = new Map<string, string>();

function createEmptyManifest(projectId: string): CanvasAssetManifest {
  return {
    version: CANVAS_ASSET_MANIFEST_VERSION,
    projectId,
    assets: {},
    deletedAssets: {},
    updatedAt: new Date().toISOString(),
  };
}

function normalizeManifest(
  value: Partial<CanvasAssetManifest> | null | undefined,
  projectId: string
): CanvasAssetManifest {
  return {
    version: CANVAS_ASSET_MANIFEST_VERSION,
    projectId: value?.projectId || projectId,
    assets: value?.assets ?? {},
    deletedAssets: value?.deletedAssets ?? {},
    updatedAt: value?.updatedAt || new Date().toISOString(),
  };
}

function inferFileName(input: ImportCanvasAssetInput): string {
  if (input.fileName) return input.fileName;
  if ('name' in input.file && typeof input.file.name === 'string' && input.file.name) {
    return input.file.name;
  }
  return `${input.kind}-${Date.now()}`;
}

async function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await openIndexedDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getBlob(key: string): Promise<Blob | null> {
  const db = await openIndexedDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export function createWebCanvasAssetRepository(config: {
  runtime: 'web';
  projectId: string;
  projectRoot: null;
}): CanvasAssetRepository {
  const manifestKey = config.projectId;
  const localStorageKey = `${MANIFEST_STORAGE_PREFIX}${config.projectId}`;

  async function getOrCreateManifest(): Promise<CanvasAssetManifest> {
    const cached = manifestCache.get(manifestKey);
    if (cached) return cached;

    try {
      const raw = localStorage.getItem(localStorageKey);
      if (raw) {
        const parsed = normalizeManifest(JSON.parse(raw) as Partial<CanvasAssetManifest>, config.projectId);
        manifestCache.set(manifestKey, parsed);
        return parsed;
      }
    } catch {
      // Fall back to a fresh manifest if storage is unavailable or malformed.
    }

    const empty = createEmptyManifest(config.projectId);
    manifestCache.set(manifestKey, empty);
    return empty;
  }

  async function persistManifest(manifest: CanvasAssetManifest): Promise<void> {
    manifestCache.set(manifestKey, manifest);
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(manifest));
    } catch {
      // Best effort: runtime URL resolution still works from IndexedDB even if metadata persistence fails.
    }
  }

  return {
    async importFile(input) {
      const fileName = inferFileName(input);
      const now = new Date().toISOString();
      const asset: CanvasAssetRecord = {
        id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        projectId: config.projectId,
        kind: input.kind,
        role: input.role,
        status: 'active',
        source: input.source,
        storageMode: 'indexeddb',
        fileName,
        mimeType: input.file.type || 'application/octet-stream',
        projectRelativePath: fileName,
        createdAt: now,
        updatedAt: now,
        nodeIds: [input.nodeId],
      };
      const manifest = await getOrCreateManifest();

      await putBlob(asset.id, input.file);
      manifest.assets[asset.id] = asset;
      manifest.updatedAt = now;
      await persistManifest(manifest);

      return asset;
    },

    async resolveRuntimeUrl(assetId) {
      const cached = runtimeUrlCache.get(assetId);
      if (cached) {
        // 检测缓存的 URL 是否仍然有效，失效时重新生成
        try {
          const testResp = await fetch(cached, { method: 'HEAD' });
          if (testResp.ok) return cached;
        } catch {
          // URL 已失效，从缓存中移除并重新生成
        }
        runtimeUrlCache.delete(assetId);
      }

      const blob = await getBlob(assetId);
      if (!blob) return null;

      const url = URL.createObjectURL(blob);
      runtimeUrlCache.set(assetId, url);
      return url;
    },

    releaseRuntimeUrl(assetId) {
      const cached = runtimeUrlCache.get(assetId);
      if (cached) {
        URL.revokeObjectURL(cached);
        runtimeUrlCache.delete(assetId);
      }
    },

    async markNodeAssetUsage(nodeId, assetId) {
      const manifest = await getOrCreateManifest();
      const asset = manifest.assets[assetId];
      if (!asset) return;
      if (!asset.nodeIds.includes(nodeId)) {
        asset.nodeIds.push(nodeId);
        asset.updatedAt = new Date().toISOString();
        await persistManifest(manifest);
      }
    },

    async unmarkNodeAssetUsage(nodeId, assetId) {
      const manifest = await getOrCreateManifest();
      const asset = manifest.assets[assetId];
      if (!asset) return;

      asset.nodeIds = asset.nodeIds.filter((existingId) => existingId !== nodeId);
      asset.updatedAt = new Date().toISOString();
      await persistManifest(manifest);
    },

    async moveUnusedAssetToTrash(assetId) {
      const manifest = await getOrCreateManifest();
      const asset = manifest.assets[assetId];
      if (!asset || asset.nodeIds.length > 0) return;

      delete manifest.assets[assetId];
      manifest.deletedAssets[assetId] = {
        ...asset,
        status: 'trash',
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      manifest.updatedAt = new Date().toISOString();
      await persistManifest(manifest);
      // 清理 runtime URL 缓存，避免 blob URL 永不释放
      this.releaseRuntimeUrl(assetId);
    },

    async restoreAsset(assetId) {
      const manifest = await getOrCreateManifest();
      const asset = manifest.deletedAssets[assetId];
      if (!asset) return;

      delete manifest.deletedAssets[assetId];
      manifest.assets[assetId] = {
        ...asset,
        status: 'active',
        deletedAt: undefined,
        updatedAt: new Date().toISOString(),
      };
      manifest.updatedAt = new Date().toISOString();
      await persistManifest(manifest);
    },

    async getManifest() {
      return getOrCreateManifest();
    },

    async saveManifest(manifest) {
      await persistManifest(manifest ?? (await getOrCreateManifest()));
    },
  };
}
