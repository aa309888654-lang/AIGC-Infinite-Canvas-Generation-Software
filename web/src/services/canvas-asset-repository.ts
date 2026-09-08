import type {
  CanvasAssetKind,
  CanvasAssetManifest,
  CanvasAssetRecord,
  CanvasAssetRole,
  CanvasAssetSource,
} from '@/types/canvas-assets';
import { createDesktopCanvasAssetRepository } from './canvas-asset-repository.desktop';
import { createWebCanvasAssetRepository } from './canvas-asset-repository.web';

export interface ImportCanvasAssetInput {
  nodeId: string;
  kind: CanvasAssetKind;
  role: CanvasAssetRole;
  source: CanvasAssetSource;
  file: File | Blob;
  fileName?: string;
}

export interface CanvasAssetRepository {
  importFile(input: ImportCanvasAssetInput): Promise<CanvasAssetRecord>;
  resolveRuntimeUrl(assetId: string): Promise<string | null>;
  releaseRuntimeUrl(assetId: string): void;
  markNodeAssetUsage(nodeId: string, assetId: string): Promise<void>;
  unmarkNodeAssetUsage(nodeId: string, assetId: string): Promise<void>;
  moveUnusedAssetToTrash(assetId: string): Promise<void>;
  restoreAsset(assetId: string): Promise<void>;
  getManifest(): Promise<CanvasAssetManifest>;
  saveManifest(manifest?: CanvasAssetManifest): Promise<void>;
}

export interface CanvasAssetRepositoryConfig {
  runtime: 'desktop' | 'web';
  projectId: string;
  projectRoot: string | null;
}

export function createCanvasAssetRepository(
  config: CanvasAssetRepositoryConfig
): CanvasAssetRepository {
  if (config.runtime === 'desktop' && config.projectRoot) {
    return createDesktopCanvasAssetRepository({
      runtime: 'desktop',
      projectId: config.projectId,
      projectRoot: config.projectRoot,
    });
  }

  return createWebCanvasAssetRepository({
    runtime: 'web',
    projectId: config.projectId,
    projectRoot: null,
  });
}
