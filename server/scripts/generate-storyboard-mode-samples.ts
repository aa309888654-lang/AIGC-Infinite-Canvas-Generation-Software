import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import prisma from '../src/lib/prisma';
import { generateToken } from '../src/utils/jwt';

type ModeId = 'character-design-sheet' | 'twelve-panel-storyboard' | 'cinematic-relationship-board';

const API_URL = 'http://127.0.0.1:3200/api/v1/image/generate';
const OUTPUT_DIR = path.resolve(process.cwd(), '..', 'output', 'storyboard-modes');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'generation-manifest.json');

const STORY_CONTEXT = `原创中文太空歌剧世界。帝国刚在黑暗星击败星际海盗联盟，图塔昆元帅重伤未醒，皇室封锁消息并宣扬胜利。二皇子古远乘皇家军舰前往黑暗星驻军，军舰上同行十二名向导考察团，研究晶石能源对向导体质的影响。方夏夏是公爵府二小姐、古远匹配度90%的未婚妻，但她反感政治婚约，真正目的是替姐姐去黑暗星接应一件秘密物品。途中皇家军舰突然遭到残余星际海盗袭击。`;

const CHARACTER_ANCHORS = `方夏夏：二十岁出头东亚女性，净白素颜，齐刘海，乌黑长发扎利落马尾，眼神冷静聪慧，身形轻盈但有训练感；固定服装为干净白色长袖衬衫、略宽松黑色长裤、黑白运动鞋，无珠宝、无浓妆。古远：二十多岁后期东亚男性，短黑发、墨色眼睛、克制冷峻，黑色帝国军装配银色细边。世界视觉统一为冷峻克制、写实电影级太空歌剧，深空蓝黑、金属灰、冷白全息光，仅少量警报红。`;

const PROMPTS: Record<ModeId, string> = {
  'character-design-sheet': `Use case: stylized-concept
Asset type: professional film character design sheet, landscape 16:9
Primary request: Create a polished production character bible sheet for Fang Xiaxia from this story.
${STORY_CONTEXT}
${CHARACTER_ANCHORS}
Layout: premium warm-white production design board. One dominant full-body hero view on the left; clean front, back, left profile and three-quarter turnaround views across the upper right; three practical action poses: crouching, running, defensive fighting stance; five facial expressions: calm, alert, disgusted, determined, briefly startled; close detail swatches for straight bangs and ponytail, white shirt cuff, black trousers fabric, sport shoes, and personal terminal. Include small black silhouette studies for body proportions.
Text (verbatim): large Chinese title "方夏夏" and small subtitle "向导考察团 | 公爵府二小姐". Other annotations should be minimal, short, clean Chinese labels only.
Style/medium: cinematic costume concept photography blended with high-end production character-sheet design; realistic human anatomy, identity consistent in every view, restrained editorial typography.
Constraints: every figure is the same adult woman with the exact same face, hairstyle and outfit; practical clothing; no skirt, no boots, no jewelry, no fantasy robe; generous margins; no watermark, no logo, no garbled text, no extra limbs.`,

  'twelve-panel-storyboard': `Use case: illustration-story
Asset type: professional director storyboard sheet, landscape 16:9
Primary request: Create one complete 12-panel annotated storyboard sheet, arranged in a strict 4-column by 3-row grid, based on this story.
${STORY_CONTEXT}
${CHARACTER_ANCHORS}
Panel sequence: 1 aftermath over the conquered Dark Star and damaged imperial fleet; 2 Marshal Tutakun unconscious in a sealed military medical bay; 3 imperial star-network celebrates the victory while the hidden casualty report glows behind; 4 royal warship performs a high-speed jump from Blue Star toward Dark Star; 5 Prince Guyuan studies the holographic star map alone; 6 the Empress appears in a secure holographic call and orders protection of the guide expedition; 7 close-up of the twelve-person guide roster with Fang Xiaxia highlighted; 8 Fang Xiaxia quietly reads her personal terminal among overdressed guides in the cabin; 9 restrained contrast between exhausted royal sentinels and carefree guides; 10 Fang Xiaxia hides a secret encrypted message for her sister; 11 red alarm lights ignite and the cabin door opens; 12 armed royal sentinels surround the guides and announce a space-pirate attack.
Layout and annotations: every panel has a clear number 01-12 and a very short readable Chinese shot title. Add sparse professional red, blue and green director arrows for camera movement, eyeline, blocking and continuity. Use distinct establishing, medium, close-up, over-shoulder, low-angle and reaction shots. Include a narrow annotation strip under each frame for shot size, camera move and emotional beat.
Style/medium: refined grayscale pencil storyboard, cinematic hand-drawn line art on scanned production paper, controlled shading, professional film previsualization, small selective red alarm accents only.
Constraints: exactly 12 bordered panels in one sheet; consistent Fang Xiaxia and Guyuan; readable hierarchy; no full-color painting, no single large poster, no 3D render, no watermark, no logo, no broken grid, no extra panels, no garbled labels.`,

  'cinematic-relationship-board': `Use case: stylized-concept
Asset type: cinematic character relationship and atmosphere concept board, landscape 16:9
Primary request: Create a premium film-pitch relationship board for Fang Xiaxia and Prince Guyuan during the royal warship voyage to Dark Star.
${STORY_CONTEXT}
${CHARACTER_ANCHORS}
Composition: one dominant cinematic image occupying about two thirds of the board. In the royal warship's cold holographic command cabin, Guyuan stands above beside a glowing star map while Fang Xiaxia is seen lower in the adjacent guide cabin through layered glass and reflections; they are physically close in the same ship yet emotionally separated by rank, distrust and an arranged engagement. Add three clean supporting stills along the lower-right edge: Guyuan's restrained dark-eyed close-up after the Empress mentions his fiancee; Fang Xiaxia hiding an encrypted terminal message; their first tense eyeline connection as red attack alarms ignite. Use subtle production-board margins and elegant image cropping, not decorative cards.
Lighting/mood: cold white holographic light, blue-black metal, faint green crystal-energy reflections, a precise red alarm rim; quiet political tension, mutual vigilance, suppressed curiosity, approaching danger.
Text (verbatim): title "航向黑暗星" and subtitle "古远 x 方夏夏 | 未婚关系 / 利益分布 / 隐秘任务". No other long copy.
Style/medium: photorealistic cinematic Chinese science-fiction concept photography, restrained editorial pitch-board design, natural skin texture, realistic costume materials, anamorphic depth, sophisticated color grading.
Constraints: preserve the specified adult East Asian identities and clothes; no romantic embrace, no fantasy robes, no sexualized pose, no glossy fashion ad, no beige palette, no watermark, no logo, no garbled text.`,
};

const FILE_NAMES: Record<ModeId, string> = {
  'character-design-sheet': '01-character-design-sheet.png',
  'twelve-panel-storyboard': '02-twelve-panel-storyboard.png',
  'cinematic-relationship-board': '03-cinematic-relationship-board.png',
};

function parseMode(): ModeId {
  const raw = process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1];
  if (raw && raw in PROMPTS) return raw as ModeId;
  throw new Error(`Use --mode=${Object.keys(PROMPTS).join('|')}`);
}

async function loadReferenceImage(): Promise<string | undefined> {
  const raw = process.argv.find((arg) => arg.startsWith('--reference='))?.slice('--reference='.length);
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:image/')) return raw;
  const bytes = await readFile(path.resolve(raw));
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

async function loadManifest(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as Record<string, unknown>;
  } catch {
    return { createdAt: new Date().toISOString(), model: 'gpt-image-2', generator: 'AI image node controller-compatible backend route', outputs: {} };
  }
}

async function downloadImage(url: string, destination: string): Promise<void> {
  const response = await fetch(url.replace('http://localhost:3200', 'http://127.0.0.1:3200'));
  if (!response.ok) throw new Error(`Image download failed: HTTP ${response.status}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function main(): Promise<void> {
  const mode = parseMode();
  const referenceImage = await loadReferenceImage();
  await mkdir(OUTPUT_DIR, { recursive: true });

  const userId = process.env.STORYBOARD_USER_ID || 'babbce2f-df65-4055-b1aa-f9b47a4319b3';
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, role: true } });
  if (!user) throw new Error(`User not found: ${userId}`);

  const token = generateToken({ userId: user.id, username: user.username, role: user.role });
  const requestedProvider = process.argv.find((arg) => arg.startsWith('--provider='))?.slice('--provider='.length);
  const provider = requestedProvider || (referenceImage ? 'wuyinkeji' : 'dragtokens');
  if (!['dragtokens', 'wuyinkeji', 'apipaths'].includes(provider)) {
    throw new Error(`Unsupported GPT-Image-2 provider: ${provider}`);
  }
  const aspectRatio = '16:9';
  const size = '1672x941';
  const nodeId = `storyboard-mode-${mode}-${Date.now()}`;

  console.log(`[generate] ${mode} provider=${provider} model=gpt-image-2 started`);
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: PROMPTS[mode],
      negativePrompt: '水印，品牌Logo，乱码，多余肢体，多余手指，畸形面孔，脸部漂移，服装漂移，低清晰度，过曝，塑料皮肤，幼态卡通风',
      aspectRatio,
      size,
      imageSize: size,
      quality: 'high',
      gptQuality: 'high',
      gptImageQuality: 'high',
      gptOutputFormat: 'png',
      gptBackground: 'opaque',
      generationMode: referenceImage ? 'image_to_image' : 'text_to_image',
      referenceImage,
      referenceImages: referenceImage ? [referenceImage] : undefined,
      characterConsistency: 0.9,
      provider,
      model: 'gpt-image-2',
      imageCount: 1,
      n: 1,
      source: 'storyboard-mode-real-validation',
      nodeId,
      forceStoryboardGptImage2Only: true,
      allowedGptImage2Providers: ['dragtokens', 'wuyinkeji', 'apipaths'],
    }),
  });

  const payload = await response.json() as {
    success?: boolean;
    error?: string;
    data?: { taskId?: string; status?: string; resultUrl?: string; actualProvider?: string; actualModel?: string };
  };
  if (!response.ok || !payload.success || !payload.data?.resultUrl) {
    throw new Error(`${mode} HTTP ${response.status}: ${payload.error || JSON.stringify(payload)}`);
  }

  const destination = path.join(OUTPUT_DIR, FILE_NAMES[mode]);
  await downloadImage(payload.data.resultUrl, destination);
  const manifest = await loadManifest();
  const outputs = (manifest.outputs && typeof manifest.outputs === 'object' ? manifest.outputs : {}) as Record<string, unknown>;
  outputs[mode] = {
    file: destination,
    prompt: PROMPTS[mode],
    sourceUrl: payload.data.resultUrl,
    taskId: payload.data.taskId,
    provider: payload.data.actualProvider || provider,
    model: payload.data.actualModel || 'gpt-image-2',
    reference: referenceImage ? '01-character-design-sheet.png' : null,
    completedAt: new Date().toISOString(),
  };
  await writeFile(MANIFEST_PATH, JSON.stringify({ ...manifest, outputs }, null, 2));
  console.log(`[generate] ${mode} completed -> ${destination}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.stack : error);
    await prisma.$disconnect();
    process.exit(1);
  });
