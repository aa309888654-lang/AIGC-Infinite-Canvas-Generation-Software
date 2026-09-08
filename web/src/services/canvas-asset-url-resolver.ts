import { canvasProjectService } from '@/services/canvas-project-service';
import { createCanvasAssetRepository } from './canvas-asset-repository';

function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && !!(window as any as {
    electronAPI?: { fs?: unknown };
  }).electronAPI?.fs;
}

export async function resolveAssetUrl(assetId?: string): Promise<string | null> {
  if (!assetId) return null;

  const meta = canvasProjectService.getActiveProjectMeta();
  const runtime = meta?.projectRoot && isDesktopRuntime() ? 'desktop' : 'web';
  const repo = createCanvasAssetRepository({
    runtime,
    projectId: meta?.projectId ?? 'local-browser-project',
    projectRoot: runtime === 'desktop' ? meta?.projectRoot ?? null : null,
  });

  return repo.resolveRuntimeUrl(assetId);
}
