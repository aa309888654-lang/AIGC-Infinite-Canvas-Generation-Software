const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const isDistCheck = process.argv.includes('--dist');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function collectFiles(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(fullPath, predicate));
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

const failures = [];

if (isDistCheck) {
  const files = collectFiles(path.join(root, 'dist', 'assets', 'js'), (file) => file.endsWith('.js'));
  const forbiddenMarkers = [
    '魔法海报设计师',
    '海报需求结构化解析专家',
    '海报提示词迭代优化专家',
    '超长海报设计规划师',
    '本轮子任务要求',
  ];

  for (const file of files) {
    const content = readFile(file);
    for (const marker of forbiddenMarkers) {
      if (content.includes(marker)) failures.push(`${path.relative(root, file)} contains protected Agent prompt marker: ${marker}`);
    }
  }
} else {
  const sourceFiles = [
    'src/components/panels/AIPosterStudioPanel.tsx',
    'src/services/poster-agent-api.ts',
    'src/services/poster-pipeline-service.ts',
    'src/services/enhanced-poster-pipeline.ts',
    'src/services/ultra-long-poster-service.ts',
  ].map((relativePath) => path.join(root, relativePath));
  const forbiddenPatterns = [
    /taskInstruction/,
    /\/public\/ai\/chat/,
    /\$\{API_BASE_URL\}\/ai\/chat/,
    /trae-api-cn\.mchost\.guru/,
  ];

  for (const file of sourceFiles) {
    if (!fs.existsSync(file)) continue;
    const content = readFile(file);
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) failures.push(`${path.relative(root, file)} violates Agent client boundary: ${pattern}`);
    }
  }

  // The mobile entrypoint is intentionally a thin UI client.  Template
  // matching, model selection, provider routing and prompt construction must
  // remain on the server and must not be reintroduced as a local fallback.
  const mobileEntry = path.join(root, 'src', 'pages', 'MobileCreativeStudioPage.tsx');
  const mobileForbiddenPatterns = [
    /poster-template-catalog/,
    /poster-skill-/,
    /poster-(?:prompt|unified|simplified|llm)-/,
    /xiaotian6-gpt-image-2-4k/,
    /apipaths-gpt-/,
    /provider:\s*['"]/,
    /model:\s*['"](?:gpt-image-2|xiaotian6-)/,
  ];
  for (const file of [mobileEntry]) {
    if (!fs.existsSync(file)) continue;
    const content = readFile(file);
    for (const pattern of mobileForbiddenPatterns) {
      if (pattern.test(content)) failures.push(`${path.relative(root, file)} violates mobile server-owned boundary: ${pattern}`);
    }
  }
}

if (failures.length) {
  console.error('Poster Agent client-boundary check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Poster Agent client-boundary check passed (${isDistCheck ? 'dist' : 'source'}).`);
