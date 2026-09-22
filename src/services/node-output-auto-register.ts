import { useCanvasStore } from '@/store/useCanvasStore';
import { useFileStore } from '@/store/useFileStore';
import { normalizeMediaUrl } from '@/lib/media-url';

type GeneratedMediaType = 'image' | 'video' | 'audio';

type GeneratedMedia = {
  url: string;
  type: GeneratedMediaType;
  label: string;
};

const RESULT_FIELDS: Array<[key: string, type?: GeneratedMediaType]> = [
  ['resultUrl'],
  ['resultUrls'],
  ['outputUrl'],
  ['outputUrls'],
  ['videoUrl', 'video'],
  ['videoUrls', 'video'],
  ['audioUrl', 'audio'],
  ['audioUrls', 'audio'],
  ['coverImageUrl', 'image'],
  ['gridImageUrl', 'image'],
  ['panoramaImageUrl', 'image'],
];

function inferMediaType(url: string, explicitType?: GeneratedMediaType): GeneratedMediaType {
  if (explicitType) return explicitType;
  if (/\.(mp3|wav|ogg|flac|aac|m4a|webm|opus|pcm)(?:[?#]|$)/i.test(url)) return 'audio';
  if (/\.(mp4|mov|mkv|avi|webm)(?:[?#]|$)/i.test(url)) return 'video';
  return 'image';
}

function appendUrls(
  target: GeneratedMedia[],
  value: unknown,
  label: string,
  explicitType?: GeneratedMediaType,
): void {
  const urls = Array.isArray(value) ? value : [value];
  for (const item of urls) {
    if (typeof item !== 'string' || !item.trim()) continue;
    const url = normalizeMediaUrl(item.trim());
    target.push({ url, type: inferMediaType(url, explicitType), label });
  }
}

/** Extracts actual result fields only; reference inputs are deliberately excluded. */
export function collectNodeGeneratedMedia(nodeData: Record<string, unknown>): GeneratedMedia[] {
  const found: GeneratedMedia[] = [];
  for (const [field, type] of RESULT_FIELDS) {
    appendUrls(found, nodeData[field], field, type);
  }

  const task = nodeData.task as Record<string, unknown> | undefined;
  if (task && typeof task === 'object') {
    appendUrls(found, task.resultUrl, 'task-result');
    appendUrls(found, task.resultUrls, 'task-results');
  }

  if (Array.isArray(nodeData.frameResults)) {
    nodeData.frameResults.forEach((frame, index) => {
      if (!frame || typeof frame !== 'object') return;
      const record = frame as Record<string, unknown>;
      if (record.status && record.status !== 'succeeded') return;
      appendUrls(found, record.imageUrl || record.resultUrl, `storyboard-frame-${index + 1}`, 'image');
    });
  }

  const seen = new Set<string>();
  return found.filter((item) => {
    const key = `${item.type}:${item.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function autoRegisterNodeGeneratedMedia(nodeId: string): Promise<void> {
  const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId);
  if (!node?.data) return;

  const data = node.data as Record<string, unknown>;
  const label = String(data.label || data.title || data.name || node.type || '节点生成结果')
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char))
    .join('')
    .slice(0, 36);
  const prompt = String(data.prompt || data.text || '');
  const media = collectNodeGeneratedMedia(data);

  await Promise.all(
    media.map((item, index) => {
      const extension = item.type === 'audio' ? 'mp3' : item.type === 'video' ? 'mp4' : 'png';
      return useFileStore.getState().registerGeneratedFile({
        name: `${label || '节点生成结果'}_${index + 1}.${extension}`,
        type: item.type,
        url: item.url,
        thumbnailUrl: item.type === 'image' ? item.url : undefined,
        size: 0,
        source: 'generated',
        metadata: {
          prompt,
          generationId: nodeId,
          category: 'node-output',
        },
      });
    })
  );
}
