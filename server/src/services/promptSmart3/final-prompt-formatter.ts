const FINAL_MARKER_RE = /^(?:最终提示词|成品提示词|final prompt)\s*[:：-]?\s*(.*)$/i;
const DROP_LINE_RE = /^(?:分析|建议|优化说明|创作思路|过程|步骤|思考|说明|总结|summary|analysis|视觉质检|质检报告|质量检查|修正意见|8维度|精炼优化|画面质量评估|各维度评估|整体评价|评估维度|质量评估)\s*[:：]?/i;

function normalizeLine(rawLine: string): string {
  return rawLine
    .replace(/\|[\s-]*\|/g, '') // 移除空的 markdown 表格行
    .replace(/\|/g, ' ') // 将表格分隔符替换为空格
    .replace(/\*\*/g, '')
    .replace(/```+/g, '')
    .replace(/^>\s*/, '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/^(?:[-*•]+|\d+[.)、]|[A-Za-z][.)])\s*/, '')
    .trim();
}

function shouldDropLine(line: string): boolean {
  if (!line) return true;
  if (DROP_LINE_RE.test(line)) return true;
  if (/^【[^】]{1,20}】$/.test(line)) return true;
  if (/^【(?:视觉质检|质检报告|质量检查|修正意见|8维度|画面质量)/.test(line)) return true;
  if (/^【精炼优化/.test(line)) return true;
  if (!/[，,。！？；：:]/.test(line) && line.length <= 25 && /(提示词|结果|扩展|方案|设计|总结|核心|递进|流程|结构|造型|节奏|质感|构图|评估|修正|评价)/.test(line)) return true;
  if (/^(?:视觉质检|质检报告|质量检查|修正意见|8维度|画面质量|各维度评估|整体评价)/.test(line)) return true;
  if (/✓/.test(line) && /(?:构图|光影|色调|主体|镜头|环境|材质|风格|细节)/.test(line) && !/[。！？]/.test(line)) return true;
  if (/^(?:,|，)/.test(line) && /(?:维度|覆盖|完整|合理|问题|建议|评估|修正)/.test(line)) return true;
  if (/^精炼优化/.test(line)) return true;
  if (/^(?:8个维度|维度覆盖|维度检查|整体评价)/.test(line)) return true;
  if (/^8/.test(line) && /(?:维度|覆盖)/.test(line)) return true;
  if (line.includes('|') && (line.includes('---') || line.includes('✓'))) return true; // 进一步处理表格行
  return false;
}

function cleanPromptLine(line: string): string {
  let cleaned = line.replace(/\*\*/g, '');
  
  // 1. 移除 【视觉质检】 等括号包裹的标题
  cleaned = cleaned.replace(/^【(?:视觉质检|质检报告|精炼优化|最终提示词|成品提示词|画面质量评估|修正后精炼输出)[^】]*】/, '');
  
  // 2. 移除常见的质检引导词前缀，支持带括号的字数说明
  cleaned = cleaned.replace(/^(?:精炼优化|最终提示词|成品提示词|优化结果|修正后精炼输出|画面质量评估与修正|各维度评估|整体评价|修正建议|评估结果)[^，,，：:]*?(?:（\d+字）)?[：:，,]\s*/, '');
  
  // 3. 处理带勾选符号和警告符号的报告前缀，截断到提示词正文开始处
  const promptKeywords = '(?:构图|光影|色调|主体|镜头|环境|材质|风格|细节|最终提示词|成品提示词|人物|场景|画面|一个|一位|一只|一件|三分法|采用|全身照|特写|近景)';
  if (/[✓⚠]/.test(cleaned)) {
    const regex = new RegExp(`^[✓⚠].*?(?=${promptKeywords})`, 'i');
    if (regex.test(cleaned)) {
      cleaned = cleaned.replace(regex, '');
    } else {
      cleaned = cleaned.replace(/^[✓⚠\s\d维度覆盖充分描述专业"为非中文词应改为中部分略冗余可精炼评估修正评价，,，|\\-——]+/, '');
    }
  }

  // 4. 再次强力清理任何包含质检关键词且在提示词正文之前的短句
  const prependedJunkRegex = new RegExp(`^.*?(?:需修正后输出精炼版本|修正后精炼输出|画面质量评估|整体评价|评估结果)[^。！？]*?[，,：:]\\s*(?=${promptKeywords})`, 'i');
  if (prependedJunkRegex.test(cleaned)) {
    cleaned = cleaned.replace(prependedJunkRegex, '');
  }

  // 5. 兜底清理：如果行首依然有“修正后...输出...，”这类模式，直接切除
  cleaned = cleaned.replace(/^[^。！？]*?(?:修正后|精炼输出|最终版)[^。！？]*?[，,：:]\s*/, '');

  return cleaned
    .replace(/^[，,、\s]+/, '')
    .trim();
}

function collectCandidateLines(raw: string): string[] {
  const lines = raw
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/\r\n/g, '\n')
    .split('\n');

  const collected: string[] = [];
  let markerMode = false;

  for (const sourceLine of lines) {
    const line = normalizeLine(sourceLine);
    if (!line) {
      continue;
    }

    const cleanedLine = cleanPromptLine(line);
    if (shouldDropLine(cleanedLine)) {
      continue;
    }

    const markerMatch = cleanedLine.match(FINAL_MARKER_RE);
    if (markerMatch) {
      markerMode = true;
      const inlineContent = markerMatch[1]?.trim();
      if (inlineContent && !shouldDropLine(inlineContent)) {
        collected.push(inlineContent);
      }
      continue;
    }

    collected.push(cleanedLine);
  }

  if (markerMode && collected.length > 0) {
    return collected;
  }

  return collected;
}

function toSingleParagraph(lines: string[]): string {
  return lines.reduce((acc, line, index) => {
    const normalizedLine = index < lines.length - 1 ? line.replace(/[，,。！？；]+$/g, '') : line;
    if (!acc) {
      return normalizedLine;
    }
    const separator = /[，,。！？；]$/.test(acc) ? '' : '，';
    return `${acc}${separator}${normalizedLine}`;
  }, '').replace(/\s+/g, ' ').trim();
}

function toMultiLine(lines: string[]): string {
  return lines.join('\n').replace(/\n{2,}/g, '\n').trim();
}

export function sanitizeOptimizedPrompt(raw: string, scenario: string = 'image'): string {
  const lines = collectCandidateLines(raw);
  if (lines.length === 0) {
    return raw.trim();
  }

  return scenario === 'video' ? toMultiLine(lines) : toSingleParagraph(lines);
}
