const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '发布版本');
const apply = process.argv.includes('--apply');
// 这些目录由应用通过稳定路径或运行时配置加载，不能按静态引用结果删除。
const protectedDirs = new Set(['ai-models', 'brand', 'fonts', 'models', 'sponsor', 'workflow-marketplace']);
const textExtensions = new Set(['.js', '.css', '.html', '.json', '.mjs', '.webmanifest', '.txt', '.md']);
const mediaExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.webm', '.mov']);

function walk(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, result);
    else result.push(full);
  }
  return result;
}

if (!fs.existsSync(root)) throw new Error(`发布目录不存在: ${root}`);
const files = walk(root);
const byBaseName = new Map(files.map((file) => [path.basename(file), file]));
const reachable = new Set();
const queue = [path.join(root, 'index.html')];

while (queue.length > 0) {
  const file = queue.shift();
  if (!file || reachable.has(file) || !fs.existsSync(file)) continue;
  reachable.add(file);
  const ext = path.extname(file).toLowerCase();
  if (!textExtensions.has(ext)) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const [baseName, target] of byBaseName) {
    if (!reachable.has(target) && content.includes(baseName)) queue.push(target);
  }
}

const candidates = files.filter((file) => {
  const relative = path.relative(root, file);
  const top = relative.split(path.sep)[0];
  if (protectedDirs.has(top)) return false;
  const ext = path.extname(file).toLowerCase();
  const isBuildAsset = relative.startsWith(`assets${path.sep}`) || relative.startsWith(`assets/`);
  const isMedia = mediaExtensions.has(ext);
  const isCompressionSidecar = /\.(js|css|mjs|wasm|json|html)\.(gz|br)$/i.test(file);
  const isLegacyBuildFile = isBuildAsset && /\.(js|css|mjs|wasm|json|html)(\.(gz|br))?$/i.test(file);
  return !reachable.has(file) && (isMedia || isCompressionSidecar || isLegacyBuildFile);
});

const bytes = candidates.reduce((total, file) => total + fs.statSync(file).size, 0);
console.log(JSON.stringify({ apply, candidates: candidates.length, bytes, files: candidates.map((file) => path.relative(root, file)) }, null, 2));

if (apply) {
  for (const file of candidates) {
    const resolved = path.resolve(file);
    if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error(`拒绝删除越界路径: ${resolved}`);
    fs.rmSync(resolved, { force: true });
  }
  console.log(`已清理 ${candidates.length} 个文件，释放 ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}
