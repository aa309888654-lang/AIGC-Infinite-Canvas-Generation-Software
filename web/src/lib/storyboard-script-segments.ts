export interface StoryboardScriptSegment {
  id: string;
  title: string;
  script: string;
  sourceBlockCount: number;
}

const SCENE_HEADING = /^(?:第\s*[一二三四五六七八九十百千万0-9]+\s*(?:场|幕|章|节)|场景\s*[一二三四五六七八九十百千万0-9]+|scene\s*[0-9ivxlcdm]+)/i;

function splitLongBlock(block: string, targetChars: number): string[] {
  if (block.length <= targetChars) return [block];
  const sentences = block.split(/(?<=[。！？!?；;])\s*/).filter(Boolean);
  if (sentences.length <= 1) {
    return Array.from({ length: Math.ceil(block.length / targetChars) }, (_, index) =>
      block.slice(index * targetChars, (index + 1) * targetChars)
    );
  }
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > targetChars) {
      chunks.push(current.trim());
      current = '';
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function splitStoryboardScript(
  rawScript: string,
  maxSegments = 20,
  blocksPerSegment = 12,
): StoryboardScriptSegment[] {
  const normalized = rawScript.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  const limit = Math.max(1, Math.min(20, Math.floor(maxSegments)));
  const groupSize = Math.max(1, Math.floor(blocksPerSegment));
  const paragraphs = normalized.split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean);
  const expanded = paragraphs.flatMap((block) => splitLongBlock(block, 1800));

  const sceneBlocks: string[] = [];
  let current = '';
  for (const block of expanded) {
    if (SCENE_HEADING.test(block) && current) {
      sceneBlocks.push(current.trim());
      current = block;
    } else {
      current = current ? `${current}\n\n${block}` : block;
    }
  }
  if (current) sceneBlocks.push(current.trim());
  const units = sceneBlocks.length > 1 ? sceneBlocks : expanded;

  const effectiveGroupSize = paragraphs.length === 1 && expanded.length > 1 ? 1 : groupSize;
  const naturalCount = Math.max(1, Math.ceil(units.length / effectiveGroupSize));
  const desiredCount = Math.min(limit, naturalCount);
  const unitCount = naturalCount <= limit ? effectiveGroupSize : Math.ceil(units.length / limit);
  return Array.from({ length: desiredCount }, (_, index) => {
    const selected = units.slice(index * unitCount, (index + 1) * unitCount);
    return {
      id: `storyboard-segment-${index + 1}`,
      title: `12宫格分镜段落 ${index + 1}`,
      script: selected.join('\n\n').trim(),
      sourceBlockCount: selected.length,
    };
  }).filter((segment) => segment.script);
}
