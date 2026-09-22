// 生成用于 GitHub 分享的源代码发布包。
// 该包只包含可审查、可构建的源码：不做任何前端或后端混淆，不打包密钥、
// 数据库、日志、用户上传内容、node_modules 与构建产物。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const workspace = path.resolve(__dirname, '..');
const outputRoot = path.resolve('D:/开源软件/发布到GitHub');
const releaseFolderName = process.env.RELEASE_FOLDER_NAME || '源代码软件';
if (!/^[\p{L}\p{N}._-]+$/u.test(releaseFolderName)) {
  throw new Error(`发布目录名称包含非法字符: ${releaseFolderName}`);
}
const releaseRoot = path.join(outputRoot, releaseFolderName);
// GitHub 拒绝大于 100 MiB 的单个文件。演示视频不属于源码，超限时直接剔除，
// 避免生成无法推送的上传包。
const GITHUB_MAX_FILE_BYTES = 100 * 1024 * 1024;
// GitHub 对单文件的两条线：超过 50 MiB 推送时告警，超过 100 MiB 直接拒绝。
const GITHUB_WARN_FILE_BYTES = 50 * 1024 * 1024;
// 发布规则第 3 节要求保护运行时可达素材。工作流市场的预览视频由
// src/services/workflow-marketplace-completeness.ts 直接引用，删掉会让克隆者
// 看到加载失败的演示，所以这些文件即使超过 50 MiB 也照常进仓库。
const RUNTIME_PROTECTED_PREFIXES = ['public/sample-videos/'];
function isRuntimeProtected(relative) {
  return RUNTIME_PROTECTED_PREFIXES.some((prefix) => relative.startsWith(prefix));
}

// web/ 是根目录前端的历史副本，内容与 src/、public/ 完全一致且不参与构建，
// 因此只保留其构建脚本与配置参考，避免发布包里出现重复源码和素材。
const sourceFiles = [
  '.gitignore', '.gitattributes', '.npmrc', '.prettierrc',
  'README.md', 'README.en.md', 'LICENSE', 'LICENSE-COMMERCIAL.md', 'qrcode.webp',
  'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.node.json',
  'vite.config.ts', 'index.html', 'postcss.config.cjs', 'tailwind.config.js',
  'electron-builder.yml', 'electron-main.cjs', 'electron-preload.cjs',
  'src', 'public', 'scripts', 'server', 'docs',
  'web/scripts', 'web/vite.config.ts', 'web/tailwind.config.js', 'web/.env.example',
];

// 被隔离出去的大文件不计入发布包体积与文件清单。
function isQuarantined(relative) {
  return relative.startsWith('_oversized/');
}
const deniedNames = new Set([
  '.git', '.env', '.env.local', '.env.development', '.env.production', '.env.cloud',
  '.mimosa', '.joycode', '.zcode', '.agents', '.codex', 'node_modules',
  'dist', 'build', 'coverage', 'uploads', '.uploads', 'logs', 'backups',
]);
const deniedExt = /\.(log|db|sqlite|sqlite3|pem|key|p12|pfx|crt|map|tsbuildinfo)$/i;

// 环境变量文件一律按敏感文件处理，.env.example 因只含占位说明所以保留。
function isSecretFileName(name) {
  return /^\.env($|\.)/.test(name) && !name.endsWith('.example');
}

function removeIfExists(target) {
  if (!fs.existsSync(target)) return;
  // Windows 在旧构建进程占用文件句柄时可能拒绝递归删除 Unicode 路径。
  // 先删子项，保留下目录本身，便于人工发布。
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
  } catch (error) {
    if (process.platform !== 'win32' || !fs.statSync(target).isDirectory()) throw error;
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      const child = path.join(target, entry.name);
      try { fs.rmSync(child, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); } catch {}
    }
    if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
      throw new Error(`无法清理目录（可能被其他程序占用）: ${target}`);
    }
  }
}

function copyFiltered(source, destination) {
  if (!fs.existsSync(source)) return;
  const stat = fs.statSync(source);
  if (stat.isFile()) {
    const name = path.basename(source);
    if (deniedNames.has(name) || deniedExt.test(name) || isSecretFileName(name)) return;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    return;
  }
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (deniedNames.has(entry.name)) continue;
    copyFiltered(path.join(source, entry.name), path.join(destination, entry.name));
  }
}

function walk(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, result);
    else result.push(full);
  }
  return result;
}

// 发布前先跑一次真实构建，确保交出的源码在干净环境里可以编译通过。
function build() {
  if (fs.existsSync(path.join(workspace, 'vite.config.ts'))) {
    if (process.platform === 'win32') {
      execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run build'], { cwd: workspace, stdio: 'inherit' });
    } else {
      execFileSync('npm', ['run', 'build'], { cwd: workspace, stdio: 'inherit' });
    }
  }
}

function copySourceRelease() {
  for (const entry of sourceFiles) {
    copyFiltered(path.join(workspace, entry), path.join(releaseRoot, entry));
  }
}

// 演示视频不是源码。超过 GitHub 硬上限的必须剔除；50 MiB 到 100 MiB 之间的
// 挪进 _oversized/（.gitignore 已忽略），文件仍留在本地发布目录可取回，但不会
// 进入 git 历史，避免每次推送都触发大文件告警。
function pruneOversizedReleaseFiles() {
  const removed = [];
  const oversized = [];
  const quarantine = path.join(releaseRoot, '_oversized');
  for (const file of walk(releaseRoot)) {
    const relative = path.relative(releaseRoot, file).replace(/\\/g, '/');
    const size = fs.statSync(file).size;
    if (isQuarantined(relative)) continue;
    // 完整教程录像只是演示素材，且远超 GitHub 单文件上限，直接剔除。
    const demoOnlyMedia = /(^|\/)sample-videos\/tutorial-episode-1-full\.mp4$/i.test(relative);
    if (size > GITHUB_MAX_FILE_BYTES || demoOnlyMedia) {
      fs.rmSync(file, { force: true });
      removed.push({ file: relative, bytes: size });
      continue;
    }
    if (size > GITHUB_WARN_FILE_BYTES) {
      if (isRuntimeProtected(relative)) continue;
      const target = path.join(quarantine, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.renameSync(file, target);
      oversized.push({ file: relative, bytes: size });
    }
  }
  return { removed, oversized };
}

function verifyNoProtectedFiles() {
  const leaks = [];
  for (const file of walk(releaseRoot)) {
    const relative = path.relative(releaseRoot, file).replace(/\\/g, '/');
    const name = path.basename(file);
    if (isSecretFileName(name) || deniedExt.test(name)) leaks.push(relative);
  }
  if (leaks.length > 0) {
    throw new Error(`发布副本包含受保护文件，已中止: ${leaks.slice(0, 10).join(', ')}`);
  }
}

// 防止误把正在运行的部署目录（含 .env、node_modules、数据库）当成源码包覆盖。
function assertNotLiveDeploy() {
  const markers = [
    path.join(releaseRoot, 'server', '.env'),
    path.join(releaseRoot, 'server', 'node_modules'),
    path.join(releaseRoot, 'server', 'prisma', 'dev.db'),
    path.join(releaseRoot, 'assets'),
  ];
  const found = markers.filter((marker) => fs.existsSync(marker));
  if (found.length > 0) {
    throw new Error(
      `拒绝覆盖疑似运行中的目录 ${releaseRoot}（检测到 ${found.map((m) => path.relative(releaseRoot, m)).join(', ')}）。`
      + '源码发布包不包含密钥、依赖和构建产物，请换用其他目录名。'
    );
  }
}

function writeReleaseDocs() {
  // LICENSE 与 LICENSE-COMMERCIAL.md 是两份不同内容：前者是 GitHub 用来识别
  // 授权协议的仓库根文件，后者是商业条款。早先这里用后者覆盖前者，等于把仓库的
  // LICENSE 换成了商业条款副本，现在两份都按源项目原件复制。
  for (const name of ['LICENSE', 'LICENSE-COMMERCIAL.md']) {
    const source = path.join(workspace, name);
    if (!fs.existsSync(source)) {
      throw new Error(`找不到发布许可证: ${source}`);
    }
    fs.copyFileSync(source, path.join(releaseRoot, name));
  }
  // README.md 是仓库门面，由源项目手工维护（截图、授权表、赞助说明都在里面）。
  // 这里不再生成白板 README，否则每次发布都会把手写内容覆盖掉。
  const readmeSource = path.join(workspace, 'README.md');
  if (!fs.existsSync(readmeSource)) {
    throw new Error(`找不到发布 README: ${readmeSource}`);
  }
  fs.copyFileSync(readmeSource, path.join(releaseRoot, 'README.md'));
  fs.writeFileSync(path.join(releaseRoot, '.gitignore'), [
    '.env',
    '.env.*',
    '!.env.example',
    '_oversized/',
    'node_modules/',
    'dist/',
    'uploads/',
    'logs/',
    'backups/',
    '*.db',
    '*.sqlite',
    '*.sqlite3',
    '*.log',
    '.DS_Store',
    '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(releaseRoot, 'RELEASE-NOTES.md'), [
    '# 发布说明', '',
    '- 发布形态：完整源代码包，前端与后端均未做压缩混淆。',
    '- 不包含 `.env`、数据库、日志、`node_modules`、构建产物与用户上传内容。',
    '- 单文件超过 100 MiB 的演示视频和完整教程录像已剔除；50 MiB 到 100 MiB 之间的文件',
    '  挪到本地发布目录的 `_oversized/`，不入 git 历史，需要时挂到 Releases 分发。',
    '- `web/` 目录是根目录前端的历史副本，内容与 `src/`、`public/` 完全一致，因此发布包只保留其构建脚本与配置。',
    '- 本地服务默认跑在本机，模型密钥保存在本机数据库中，无需登录账户即可使用全部功能。', '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(releaseRoot, 'SECURITY-DEPLOYMENT.md'), [
    '# 部署安全', '',
    '生产服务端必须设置 `ENCRYPTION_KEY`：32 字节随机值，64 位十六进制。不要将其放在前端、GitHub 或发布目录。',
    '使用 HTTPS、严格 CSP、最小权限数据库账号和服务端侧权限控制。模型 API Key 只存在于服务端配置，浏览器不持有长期密钥。',
    '本仓库为源码发布，任何人可审计；请勿在本仓库或提交历史中存放任何真实密钥。', '',
  ].join('\n'), 'utf8');
}

function writePublishSummary(manifest) {
  fs.writeFileSync(path.join(outputRoot, 'README.md'), [
    '# 小天画布 | AI 图片与视频生成', '',
    '这是用于 GitHub 分享的整理目录，包含图片生成、视频生成和节点式创作工作流的完整源代码。', '',
    '## 目录', '',
    `- \`${releaseFolderName}\`：可上传到 GitHub 的源代码包，未做任何混淆。`,
    '- `PUBLISH_MANIFEST.json`：本次发布的文件清单与校验信息。',
    '- `PUBLISH_RULES.md`：发布执行标准副本。', '',
    '## 安全边界', '',
    'API 密钥和 `ENCRYPTION_KEY` 只能通过服务端环境变量或密钥管理系统注入。',
    '不要将 `.env`、数据库、日志或用户上传内容提交到仓库。', '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(outputRoot, 'PUBLISH_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

function main() {
  build();
  assertNotLiveDeploy();
  removeIfExists(releaseRoot);
  fs.mkdirSync(releaseRoot, { recursive: true });
  copySourceRelease();
  const { removed: prunedFiles, oversized } = pruneOversizedReleaseFiles();
  verifyNoProtectedFiles();
  writeReleaseDocs();
  // 被隔离的大文件不计入发布包体积和文件清单。
  const shippable = walk(releaseRoot).filter((file) => !isQuarantined(path.relative(releaseRoot, file).replace(/\\/g, '/')));
  const releaseFiles = shippable.length;
  const releaseBytes = shippable.reduce((total, file) => total + fs.statSync(file).size, 0);
  const rules = path.join(workspace, 'docs', 'GITHUB_PUBLISH_RULES.md');
  copyFiltered(rules, path.join(outputRoot, 'PUBLISH_RULES.md'));
  writePublishSummary({
    generatedAt: new Date().toISOString(),
    releaseType: 'source-code',
    release: releaseFolderName,
    releaseFiles,
    releaseBytes,
    prunedFiles,
    oversizedFiles: oversized,
    security: {
      frontendObfuscation: false,
      backendObfuscation: false,
      strongStringObfuscation: false,
      sourceMaps: false,
      keysIncluded: false,
      databaseIncluded: false,
      sourceIncluded: true,
    },
  });
  console.log(`源代码发布目录已生成: ${releaseRoot}`);
  console.log(`文件: ${releaseFiles}; 大小: ${(releaseBytes / 1024 / 1024).toFixed(1)} MB; 剔除超限文件: ${prunedFiles.length}`);
  if (oversized.length > 0) {
    console.log(`已隔离 ${oversized.length} 个 50 MiB 以上文件到 _oversized/（不入仓库）:`);
    for (const item of oversized) {
      console.log(`  - ${item.file} (${(item.bytes / 1024 / 1024).toFixed(1)} MB)`);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
