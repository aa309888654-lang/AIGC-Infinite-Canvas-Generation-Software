import {
  CANVAS_ASSET_MANIFEST_VERSION,
  type CanvasAssetManifest,
  type CanvasAssetRecord,
} from '@/types/canvas-assets';
import type { CanvasAssetRepository, ImportCanvasAssetInput } from './canvas-asset-repository';

const folderByKind = {
  image: 'assets/images',
  video: 'assets/videos',
  audio: 'assets/audio',
  thumbnail: 'assets/thumbnails',
  model: 'assets/models',
} as const;

const manifestCache = new Map<string, CanvasAssetManifest>();

type ElectronFsApi = {
  mkdir: (path: string) => Promise<any>;
  readFile: (path: string) => Promise<{ success?: boolean; data?: string; error?: string }>;
  writeFile: (path: string, data: string) => Promise<{ success?: boolean; error?: string }>;
  // 以二进制模式写入文件，接收 base64 字符串，由主进程解码为二进制
  writeBinaryFile: (path: string, base64Data: string) => Promise<{ success?: boolean; error?: string }>;
};

function getElectronFs(): ElectronFsApi | null {
  if (typeof window === 'undefined') return null;
  return ((window as any as {
    electronAPI?: { fs?: ElectronFsApi };
  }).electronAPI?.fs ?? null);
}

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

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('blob read failed'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('blob read failed'));
    reader.readAsDataURL(blob);
  });
}

function inferFileName(input: ImportCanvasAssetInput): string {
  if (input.fileName) return input.fileName;
  if ('name' in input.file && typeof input.file.name === 'string' && input.file.name) {
    return input.file.name;
  }
  return `${input.kind}-${Date.now()}`;
}

export function createDesktopCanvasAssetRepository(config: {
  runtime: 'desktop';
  projectId: string;
  projectRoot: string;
}): CanvasAssetRepository {
  const manifestKey = `${config.projectId}:${config.projectRoot}`;
  const manifestPath = `${config.projectRoot}/project.manifest.json`;

  async function getOrCreateManifest(): Promise<CanvasAssetManifest> {
    const cached = manifestCache.get(manifestKey);
    if (cached) return cached;

    const fsApi = getElectronFs();
    if (!fsApi) {
      const empty = createEmptyManifest(config.projectId);
      manifestCache.set(manifestKey, empty);
      return empty;
    }

    const readResult = await fsApi.readFile(manifestPath);
    if (readResult?.success && readResult.data) {
      try {
        const parsed = normalizeManifest(
          JSON.parse(readResult.data) as Partial<CanvasAssetManifest>,
          config.projectId
        );
        manifestCache.set(manifestKey, parsed);
        return parsed;
      } catch {
        // Fall through to recreate the manifest if the file is malformed.
      }
    }

    const empty = createEmptyManifest(config.projectId);
    manifestCache.set(manifestKey, empty);
    return empty;
  }

  async function persistManifest(manifest: CanvasAssetManifest): Promise<void> {
    manifestCache.set(manifestKey, manifest);
    const fsApi = getElectronFs();
    if (!fsApi) return;

    await fsApi.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  return {
    async importFile(input) {
      const fileName = inferFileName(input);
      const folder = folderByKind[input.kind];
      const projectRelativePath = `${folder}/${fileName}`;
      const manifest = await getOrCreateManifest();
      const fsApi = getElectronFs();

      if (fsApi) {
        await fsApi.mkdir(`${config.projectRoot}/${folder}`);
        const data = await blobToBase64(input.file);
        // 使用二进制模式写入，避免文本模式写入 base64 导致图片无法加载
        await fsApi.writeBinaryFile(`${config.projectRoot}/${projectRelativePath}`, data);
      }

      const now = new Date().toISOString();
      const asset: CanvasAssetRecord = {
        id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        projectId: config.projectId,
        kind: input.kind,
        role: input.role,
        status: 'active',
        source: input.source,
        storageMode: 'desktop-file',
        fileName,
        mimeType: input.file.type || 'application/octet-stream',
        projectRelativePath,
        createdAt: now,
        updatedAt: now,
        nodeIds: [input.nodeId],
      };

      manifest.assets[asset.id] = asset;
      manifest.updatedAt = now;
      await persistManifest(manifest);

      return asset;
    },

    async resolveRuntimeUrl(assetId) {
      const manifest = await getOrCreateManifest();
      const asset = manifest.assets[assetId];
      if (!asset) return null;
      // Windows 路径反斜杠转为正斜杠，避免 file:// URL 格式错误
      const fullPath = `${config.projectRoot}/${asset.projectRelativePath}`;
      const posixPath = fullPath.replace(/\\/g, '/');
      // 确保以 / 开头
      const normalizedPath = posixPath.startsWith('/') ? posixPath : `/${posixPath}`;
      return `file://${normalizedPath}`;
    },

    releaseRuntimeUrl(_assetId) {
      // 桌面端使用 file:// 协议，无需释放 blob URL
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
