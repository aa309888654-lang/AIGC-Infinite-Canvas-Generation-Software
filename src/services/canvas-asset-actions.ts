import type { CanvasAssetKind, CanvasAssetRole, CanvasAssetSource } from '@/types/canvas-assets';
import { canvasProjectService } from './canvas-project-service';
import { createCanvasAssetRepository } from './canvas-asset-repository';
import { API_BASE_URL } from '@/lib/api-config';
import { ensureAuthToken, getAuthToken } from '@/lib/auth-check';

function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && !!(window as any as {
    electronAPI?: { fs?: unknown };
  }).electronAPI?.fs;
}

export function getCanvasAssetRepositoryForCurrentProject() {
  const meta = canvasProjectService.getActiveProjectMeta();
  const runtime = meta?.projectRoot && isDesktopRuntime() ? 'desktop' : 'web';

  return createCanvasAssetRepository({
    runtime,
    projectId: meta?.projectId ?? 'local-browser-project',
    projectRoot: runtime === 'desktop' ? meta?.projectRoot ?? null : null,
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) throw new Error('Invalid data URL');

  const header = dataUrl.slice(0, commaIndex);
  const body = dataUrl.slice(commaIndex + 1);
  const mimeType = /data:([^;,]+)/.exec(header)?.[1] || 'application/octet-stream';
  const isBase64 = /;base64/i.test(header);
  const binary = isBase64 ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function persistImportedCanvasFile(params: {
  nodeId: string;
  kind: CanvasAssetKind;
  file: File;
  role?: CanvasAssetRole;
  source?: CanvasAssetSource;
}) {
  const repo = getCanvasAssetRepositoryForCurrentProject();
  const asset = await repo.importFile({
    nodeId: params.nodeId,
    kind: params.kind,
    role: params.role ?? 'primary',
    source: params.source ?? 'imported',
    file: params.file,
    fileName: params.file.name,
  });
  const runtimeUrl = await repo.resolveRuntimeUrl(asset.id);
  // 如果解析得到的是 blob URL，立即释放避免泄漏：调用方（如 ImageInputNode）使用 base64 而非 blob URL，
  // 而 blob URL 在页面刷新后失效，保留无意义。需要运行时 URL 的调用方可再次调用 resolveRuntimeUrl。
  if (runtimeUrl?.startsWith('blob:') && params.kind !== 'model') {
    repo.releaseRuntimeUrl(asset.id);
    return { asset, runtimeUrl: null };
  }

  return { asset, runtimeUrl };
}

export async function persistGeneratedCanvasUrl(params: {
  nodeId: string;
  kind: CanvasAssetKind;
  url: string;
  fileName: string;
  role?: CanvasAssetRole;
}) {
  let fetchUrl = params.url;
  let usesBackendProxy = false;
  if (!params.url.startsWith('data:') && !params.url.startsWith('blob:')) {
    try {
      const urlObj = new URL(params.url);
      const isSameOrigin = urlObj.origin === window.location.origin;
      if (!isSameOrigin) {
        const proxyBase = params.kind === 'video'
          ? `${API_BASE_URL}/video/proxy-download`
          : `${API_BASE_URL}/image/proxy-download`;
        fetchUrl = `${proxyBase}?url=${encodeURIComponent(params.url)}`;
        usesBackendProxy = true;
      }
    } catch {
      // relative URL, use as-is
    }
  }

  const blob = params.url.startsWith('data:')
    ? dataUrlToBlob(params.url)
    : await (async () => {
        const token = usesBackendProxy
          ? await ensureAuthToken().catch(() => getAuthToken())
          : getAuthToken();
        const response = await fetch(fetchUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch generated media: ${params.url}`);
        }
        return response.blob();
      })();
  const file = new File([blob], params.fileName, {
    type: blob.type || (params.kind === 'video' ? 'video/mp4' : 'image/png'),
  });

  return persistImportedCanvasFile({
    nodeId: params.nodeId,
    kind: params.kind,
    file,
    role: params.role,
    source: 'generated',
  });
}
