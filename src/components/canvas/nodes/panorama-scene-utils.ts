import { useCanvasStore } from '@/store/useCanvasStore';

/** 可作为 360 / 全景输入的源节点类型（对齐 AI 无线画布） */
export const PANORAMA_IMAGE_SOURCE_NODE_TYPES = new Set([
  'source-image',
  'ai-image',
  'image',
  'imageInput',
  'aiImage',
  'aicgImageGen',
  'unifiedImageStudio',
  'imageGen',
  'localMatting',
  'gridSplitter',
  'gridDirector',
  'scriptStoryboard',
  'multiAngle',
  'characterConsistency',
  'director3D',
  'output',
  'imageCollage',
]);

const NORMALIZED_PANORAMA_IMAGE_SOURCE_NODE_TYPES = new Set(
  Array.from(PANORAMA_IMAGE_SOURCE_NODE_TYPES, (type) => type.toLowerCase()),
);

export function extractPanoramaImageUrlFromNodeData(
  sourceData: Record<string, unknown> | undefined | null,
): string | null {
  if (!sourceData) return null;
  const task = sourceData.task as Record<string, unknown> | undefined;
  const candidates = [
    sourceData.outputImageUrl,
    sourceData.imageUrl,
    sourceData.receivedImageUrl,
    sourceData.originalImageUrl,
    sourceData.resultUrl,
    sourceData.thumbnailUrl,
    sourceData.src,
    sourceData.url,
    sourceData.output,
    sourceData.panoramaImageUrl,
    sourceData.gridImageUrl,
    sourceData.coverImageUrl,
    task?.resultUrl,
    Array.isArray(task?.resultUrls) ? task.resultUrls[0] : null,
    Array.isArray(sourceData.resultUrls) ? sourceData.resultUrls[0] : null,
    Array.isArray(sourceData.images)
      ? (sourceData.images as { url?: string }[])?.[0]?.url
      : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function isPanoramaImageSourceNodeType(type: string): boolean {
  const normalized = type.trim().toLowerCase();
  return (
    NORMALIZED_PANORAMA_IMAGE_SOURCE_NODE_TYPES.has(normalized) ||
    normalized.includes('image') ||
    normalized.includes('matting') ||
    normalized.includes('angle') ||
    normalized.includes('director')
  );
}

export function resolvePanoramaImageFromIncomingEdge(
  nodeId: string,
  targetHandleId = 'input',
): string | null {
  const { edges, nodes } = useCanvasStore.getState();
  const incoming = edges.filter(
    (e) => e.target === nodeId && (e.targetHandle === targetHandleId || !e.targetHandle),
  );
  for (const edge of incoming) {
    const source = nodes.find((n) => n.id === edge.source);
    if (!source) continue;
    const type = String((source.data as { type?: string })?.type ?? source.type ?? '');
    if (type && !isPanoramaImageSourceNodeType(type)) {
      continue;
    }
    const url = extractPanoramaImageUrlFromNodeData(
      source.data as Record<string, unknown>,
    );
    if (url) return url;
  }
  return null;
}
