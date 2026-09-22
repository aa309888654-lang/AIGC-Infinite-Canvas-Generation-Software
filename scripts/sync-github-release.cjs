// 一键把源项目同步到 GitHub：打包 -> 镜像 -> 提交 -> 推送。
// 维护手册 docs/REPO_MAINTENANCE.md，发布内容规则 docs/GITHUB_PUBLISH_RULES.md。
//
// 设计要点：
// - 只用 Node 内置模块，不引入新依赖；
// - 镜像仓库放在发布目录的 _gitmirror，重复执行时复用，避免每次重新 clone 300 MB；
// - 提交前做删除量保护和"被 .gitignore 吞掉的发布文件"检查，
//   防止打包配置写错时把仓库大面积删空或悄悄漏文件。
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const workspace = path.resolve(__dirname, '..');
const outputRoot = path.resolve('D:/开源软件/发布到GitHub');
const releaseFolderName = process.env.RELEASE_FOLDER_NAME || '源代码软件';
const packRoot = path.join(outputRoot, releaseFolderName);
const mirrorRoot = path.join(outputRoot, '_gitmirror');
const GITHUB_REMOTE = process.env.GITHUB_REMOTE
  || 'https://github.com/aa309888654-lang/AIGC-Infinite-Canvas-Generation-Software.git';
const branch = 'main';

// safecrlf=false：发布包由脚本复制生成，换行风格不该阻塞提交。
// quotepath=false：git 输出中文文件名原文，方便人工核对清单。
const GIT_CONFIG = ['-c', 'core.safecrlf=false', '-c', 'core.quotepath=false'];

const MAX_DELETED_FILES = 500;
const MAX_DELETED_RATIO = 0.25;

const flags = new Set(process.argv.slice(2));
const dryRun = flags.has('--dry-run');
const noPush = flags.has('--no-push');
const force = flags.has('--force');

function step(title) {
  console.log(`\n== ${title} ==`);
}

// quiet 模式捕获输出，其余模式直接透传到控制台。
function git(args, options = {}) {
  return execFileSync('git', [...GIT_CONFIG, ...args], {
    cwd: options.cwd || mirrorRoot,
    stdio: options.quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
}

function gitOutput(args) {
  const result = spawnSync('git', [...GIT_CONFIG, ...args], {
    cwd: mirrorRoot,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} 失败: ${(result.stderr || '').trim()}`);
  }
  return result.stdout;
}

function ensureMirror() {
  const gitDir = path.join(mirrorRoot, '.git');
  if (fs.existsSync(gitDir)) {
    const current = gitOutput(['remote', 'get-url', 'origin']).trim();
    if (current === GITHUB_REMOTE) {
      console.log(`复用镜像仓库: ${mirrorRoot}`);
      git(['fetch', '--prune', 'origin']);
      const exists = spawnSync('git', [...GIT_CONFIG, 'rev-parse', '--verify', branch], {
        cwd: mirrorRoot,
        encoding: 'utf8',
      });
      if (exists.status !== 0) {
        throw new Error(`镜像仓库里找不到 ${branch} 分支，请手动检查 ${mirrorRoot}`);
      }
      git(['checkout', branch]);
      return;
    }
    if (!force) {
      throw new Error(
        '镜像仓库的远程地址与本次不一致，已中止。\n'
        + `  镜像地址: ${current}\n  本次地址: ${GITHUB_REMOTE}\n`
        + '确认换仓库后加 --force 删除镜像并按新地址重新 clone。'
      );
    }
    console.log(`远程地址变更，按新地址重建镜像: ${GITHUB_REMOTE}`);
    fs.rmSync(mirrorRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  console.log(`首次运行，克隆镜像仓库（仓库约 310 MB，需要几分钟）`);
  git(['clone', GITHUB_REMOTE, mirrorRoot], { cwd: outputRoot });
}

function mirrorPack() {
  const resolvedMirror = path.resolve(mirrorRoot);
  if (resolvedMirror === path.resolve(outputRoot)) {
    throw new Error('镜像目录不能是发布根目录，已中止');
  }
  if (resolvedMirror === path.resolve(packRoot)) {
    throw new Error('镜像目录与发布包目录相同，已中止');
  }
  if (!fs.existsSync(path.join(mirrorRoot, '.git'))) {
    throw new Error(`镜像仓库缺少 .git 目录: ${mirrorRoot}`);
  }

  step('把发布包镜像进 git 工作树');
  let cleared = 0;
  for (const entry of fs.readdirSync(mirrorRoot)) {
    if (entry === '.git') continue;
    fs.rmSync(path.join(mirrorRoot, entry), { recursive: true, force: true });
    cleared += 1;
  }
  console.log(`已清理镜像工作树 ${cleared} 个条目，保留 .git`);
  // _oversized/ 里的 50 MiB 以上文件只留在本地发布目录，不进 git 历史。
  fs.cpSync(packRoot, mirrorRoot, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(packRoot, src).replace(/\\/g, '/');
      return rel !== '_oversized' && !rel.startsWith('_oversized/');
    },
  });
}

function stageAndAnalyze() {
  git(['add', '-A']);
  const rows = gitOutput(['diff', '--cached', '--name-status'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const stats = { added: 0, modified: 0, deleted: 0, total: rows.length };
  const deletedFiles = [];
  for (const row of rows) {
    const [code, file] = row.split('\t');
    if (code.startsWith('D')) {
      stats.deleted += 1;
      deletedFiles.push(file);
    } else if (code.startsWith('A')) {
      stats.added += 1;
    } else {
      stats.modified += 1;
    }
  }
  const tracked = gitOutput(['ls-files']).split('\n').filter(Boolean).length;
  return { ...stats, tracked, deletedFiles };
}

// 删除量异常通常意味着打包配置漏了目录，而不是真的删了这么多源码。
function guardDeletions(stats) {
  if (stats.deleted === 0) return;
  const ratio = stats.tracked > 0 ? stats.deleted / stats.tracked : 0;
  if (stats.deleted <= MAX_DELETED_FILES && ratio <= MAX_DELETED_RATIO) return;
  const sample = stats.deletedFiles.slice(0, 10).map((file) => `  ${file}`).join('\n');
  const message = `删除量过大，已中止：删除 ${stats.deleted} 个文件，占跟踪文件 ${(ratio * 100).toFixed(1)}%。\n`
    + `前几个删除项:\n${sample}\n确认是预期结果后加 --force 重跑。`;
  if (!force) throw new Error(message);
  console.log(`--force 已指定，继续提交（删除 ${stats.deleted} 个文件）`);
}

// 发布包里的文件如果被 .gitignore 命中，就会永远到不了 GitHub，
// 而本地看起来一切正常，属于最难排查的一类漂移。
function guardIgnoredFiles() {
  const ignored = gitOutput(['status', '--porcelain', '--ignored'])
    .split('\n')
    .filter((line) => line.startsWith('!! '))
    .map((line) => line.slice(3).trim().replace(/\/+$/, ''))
    .filter((rel) => rel && fs.existsSync(path.join(mirrorRoot, rel)));
  if (ignored.length === 0) return;
  const sample = ignored.slice(0, 10).map((file) => `  ${file}`).join('\n');
  const message = `发布包里有 ${ignored.length} 项被 .gitignore 忽略，不会进入仓库:\n${sample}\n`
    + '请修正发布包的 .gitignore，确认可跳过后加 --force。';
  if (!force) throw new Error(message);
  console.log(`--force 已指定，放过 ${ignored.length} 个被忽略的条目`);
}

function commit(stats) {
  if (stats.total === 0) {
    console.log('发布包与仓库一致，没有变更，跳过提交。');
    return false;
  }
  const date = new Date().toISOString().slice(0, 10);
  const message = `chore: sync source release ${date} (+${stats.added} ~${stats.modified} -${stats.deleted})`;
  git(['commit', '-m', message]);
  return true;
}

function push() {
  if (noPush) {
    console.log('--no-push 已指定，提交已留在本地镜像仓库，未推送。');
    return;
  }
  git(['push', 'origin', branch]);
  console.log(gitOutput(['log', '--oneline', '-1']).trim());
}

function main() {
  step('生成发布包');
  execFileSync(process.execPath, [path.join(workspace, 'scripts', 'publish-github-release.cjs')], {
    cwd: workspace,
    stdio: 'inherit',
  });

  ensureMirror();
  mirrorPack();

  step('暂存并分析变更');
  const stats = stageAndAnalyze();
  console.log(`暂存变更: +${stats.added} 新增, ~${stats.modified} 改动, -${stats.deleted} 删除; 仓库跟踪文件 ${stats.tracked}`);
  guardDeletions(stats);
  guardIgnoredFiles();

  if (dryRun) {
    console.log('\n--dry-run 已指定：以上只是预览，未提交未推送。');
    return;
  }
  if (commit(stats)) {
    step('推送到 GitHub');
    push();
  }
}

try {
  main();
} catch (error) {
  console.error(`\n同步失败: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
