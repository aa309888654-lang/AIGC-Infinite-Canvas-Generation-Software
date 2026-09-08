import { generateId } from '@/lib/utils';
import type { Shot, ShotCamera, ShotGenerationInput } from '@/types/shot-system';

const CAMERA_SEQUENCE: ShotCamera[] = ['wide', 'medium', 'close', 'tracking', 'push', 'orbit'];

const CAMERA_LABELS: Record<ShotCamera, string> = {
  wide: '大全景，交代环境与人物关系',
  medium: '中景，呈现人物动作与场景互动',
  close: '特写，突出表情、道具或关键情绪',
  tracking: '跟拍镜头，增强行动感',
  push: '缓慢推进，制造情绪递进',
  orbit: '环绕镜头，展示主体立体感',
  static: '固定机位，保持稳定叙事',
};

const CHARACTER_HINTS = [
  '女孩',
  '男孩',
  '男人',
  '女人',
  '主角',
  '少年',
  '少女',
  '老人',
  '老板',
  '顾客',
  '医生',
  '老师',
  '妈妈',
  '爸爸',
  '同事',
  '朋友',
];

function splitScript(script: string): string[] {
  const normalized = script
    .replace(/\r/g, '\n')
    .replace(/[。！？!?]\s*/g, (match) => `${match.trim()}\n`)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (normalized.length <= 1) {
    return script
      .split(/(?<=[，,；;])\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return normalized;
}

function extractCharacters(text: string): string[] {
  const found = CHARACTER_HINTS.filter((hint) => text.includes(hint));
  return found.length > 0 ? [...new Set(found)].slice(0, 4) : ['主角'];
}

function inferScene(text: string, index: number): string {
  const candidates = [
    ['街', '街道'],
    ['房间', '室内房间'],
    ['办公室', '办公室'],
    ['学校', '校园'],
    ['餐厅', '餐厅'],
    ['商店', '店铺'],
    ['夜', '夜晚场景'],
    ['雨', '雨中场景'],
    ['海', '海边'],
    ['山', '山野'],
  ] as const;

  const matched = candidates.find(([keyword]) => text.includes(keyword));
  return matched?.[1] || `场景 ${index + 1}`;
}

function buildVisualPrompt(text: string, camera: ShotCamera, scene: string): string {
  return [
    scene,
    CAMERA_LABELS[camera],
    text,
    '电影感构图，光影层次清晰，角色一致，画面干净，适合后续图生视频',
  ].join('，');
}

export function generateShotsFromScript(input: ShotGenerationInput): Shot[] {
  const lines = splitScript(input.script).slice(0, 24);
  const now = new Date().toISOString();
  const fallbackLines = lines.length > 0 ? lines : ['输入剧本后，在这里生成镜头。'];

  return fallbackLines.map((line, index) => {
    const camera = CAMERA_SEQUENCE[index % CAMERA_SEQUENCE.length];
    const scene = inferScene(line, index);
    return {
      id: generateId(),
      index: index + 1,
      title: `镜头 ${String(index + 1).padStart(2, '0')}`,
      scriptText: line,
      scene,
      characters: extractCharacters(line),
      visualPrompt: buildVisualPrompt(line, camera, scene),
      camera,
      duration: input.defaultDuration || 4,
      aspectRatio: input.aspectRatio || '16:9',
      status: 'planned',
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function updateShotTimestamp<T extends Partial<Shot>>(patch: T): T & { updatedAt: string } {
  return { ...patch, updatedAt: new Date().toISOString() };
}
