/**
 * 后端代码混淆脚本
 * 在 tsc 编译后运行，对 dist 目录中的 .js 文件进行压缩和注释移除
 *
 * 策略：保守混淆（不影响功能）
 * - 移除所有注释
 * - 压缩空白
 * - 死代码消除
 * - 不混淆变量名/函数名/类名（确保 Prisma/Express/Reflect 正常工作）
 *
 * 用法：node scripts/obfuscate.js
 */
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

// 不混淆的目录（包含运行时必需的元数据或第三方生成代码）
const SKIP_DIRS = new Set([
  'node_modules',
  'prisma',
  'types',
]);

// 不混淆的文件模式
const SKIP_FILE_PATTERNS = [
  /\.d\.ts$/, // TypeScript 声明文件
  /\.json$/, // JSON 配置文件
  /\.map$/, // source map
];

async function processFile(filePath) {
  const ext = path.extname(filePath);
  if (ext !== '.js') return { skipped: true };

  const code = fs.readFileSync(filePath, 'utf8');
  if (code.length === 0) return { skipped: true };

  try {
    const result = await minify(code, {
      compress: {
        // 后端保留 console（用于日志输出）
        drop_console: false,
        drop_debugger: true,
        // 死代码消除
        dead_code: true,
        // 未使用变量消除
        unused: true,
        // 压缩_passes
        passes: 2,
      },
      mangle: {
        // 不混淆变量名（确保 Prisma/Express/Reflect 元数据正常）
        toplevel: false,
        // 保留函数名（避免反射/装饰器问题）
        keep_fnames: true,
        // 保留类名（避免 Prisma Client 类名依赖）
        keep_classnames: true,
      },
      format: {
        // 移除所有注释
        comments: false,
        // 不保留 shebang
        shebang: false,
      },
    });

    if (result.code && result.code.length > 0) {
      const originalSize = Buffer.byteLength(code);
      const minifiedSize = Buffer.byteLength(result.code);
      const ratio = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

      // 保留 shebang 行（如果有）
      const shebangMatch = code.match(/^#!.*\n/);
      const finalCode = shebangMatch ? shebangMatch[0] + result.code : result.code;

      fs.writeFileSync(filePath, finalCode, 'utf8');
      return { originalSize, minifiedSize, ratio };
    }
  } catch (err) {
    console.error(`  [混淆失败] ${filePath}: ${err.message}`);
  }
  return { skipped: true };
}

async function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let stats = { files: 0, skipped: 0, totalOriginal: 0, totalMinified: 0 };

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const subStats = await processDir(fullPath);
      stats.files += subStats.files;
      stats.skipped += subStats.skipped;
      stats.totalOriginal += subStats.totalOriginal;
      stats.totalMinified += subStats.totalMinified;
    } else if (entry.isFile()) {
      if (SKIP_FILE_PATTERNS.some((p) => p.test(entry.name))) {
        stats.skipped++;
        continue;
      }

      const result = await processFile(fullPath);
      if (result.skipped) {
        stats.skipped++;
      } else {
        stats.files++;
        stats.totalOriginal += result.originalSize;
        stats.totalMinified += result.minifiedSize;
      }
    }
  }

  return stats;
}

async function main() {
  const distDir = path.resolve(__dirname, '..', 'dist');

  if (!fs.existsSync(distDir)) {
    console.error('错误: dist 目录不存在，请先运行 npm run build');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('后端代码混淆开始');
  console.log('====================================================');
  console.log(`目标目录: ${distDir}`);
  console.log(`跳过目录: ${[...SKIP_DIRS].join(', ')}`);
  console.log('');

  const startTime = Date.now();
  const stats = await processDir(distDir);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('');
  console.log('====================================================');
  console.log('混淆完成');
  console.log('====================================================');
  console.log(`处理文件: ${stats.files} 个`);
  console.log(`跳过文件: ${stats.skipped} 个`);
  console.log(`原始大小: ${(stats.totalOriginal / 1024).toFixed(1)} KB`);
  console.log(`混淆后:   ${(stats.totalMinified / 1024).toFixed(1)} KB`);
  console.log(`压缩率:   ${((1 - stats.totalMinified / stats.totalOriginal) * 100).toFixed(1)}%`);
  console.log(`耗时:     ${elapsed}s`);
}

main().catch((err) => {
  console.error('混淆脚本执行失败:', err);
  process.exit(1);
});
