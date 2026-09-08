/**
 * 前端代码深度混淆脚本
 * 在 Vite (esbuild) 构建后运行，对 dist/assets/js 中的 .js 文件进行 terser 二次深度混淆
 *
 * 策略：激进混淆（不影响功能）
 * - 移除所有注释（esbuild 已做，二次确保）
 * - 移除 console.log/info/debug
 * - toplevel 变量名混淆（最强保护）
 * - 死代码消除
 * - 不混淆属性名（避免破坏第三方库 API）
 *
 * 用法：node scripts/obfuscate.js
 */
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

// 跳过的文件模式（入口文件、vendor 等不需要二次混淆）
const SKIP_FILE_PATTERNS = [
  /\.d\.ts$/,
  /\.json$/,
  /\.map$/,
  /\.gz$/,
  /\.br$/,
  /^vendor-/, // 跳过第三方库 chunk，避免性能问题
];

// 字符串加密配置（保守，不影响运行时逻辑）
const STRING_ARRAY_CONFIG = {
  compact: true,
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ['rc4'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  disableConsoleOutput: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  identifierNamesGenerator: 'hexadecimal',
};

// 需要隐藏的模型 ID/名称（十六进制转义，运行时等价但静态搜索不可见）
// obfuscator 的 stringArray 不加密对象 key 和部分字面量，故追加此步骤兜底
const MODEL_IDS_TO_HIDE = [
  // 长模型 ID（含 - 或 . ，全局替换安全）
  'agnes-video-v2.0',
  'gpt-image-2',
  'doubao-seedance-2-0-fast-260128',
  'doubao-seedance-1-5-pro-251215',
  'doubao-seedance-2-0-260128',
  'doubao-seedance-2-express',
  'doubao-seedance-1-5-pro',
  'doubao-seedance-2-0-fast',
  'doubao-seedance-2-0',
  'doubao-seedream-5-0-lite',
  'doubao-seedream-5-0-pro',
  'doubao-seedream-5-0',
  'doubao-seedream-4-5',
  'doubao-seedance',
  'doubao-seedream',
  'flux-kontext-dev',
  'flux-2-pro',
  'flux-2-dev',
  'flux-2-flex',
  'stable_diffusion',
  'stable-diffusion',
  'stablediffusion',
  // i18n key（含 _ ，在引号内使用，全局替换安全）
  'model_not_support_vidu_style',
  'optimize_seedream_button',
  'optimize_seedream_helper',
  'optimize_minimax_button',
  'optimize_minimax_helper',
  'optimize_vidu_button',
  'optimize_vidu_helper',
  'provider_minimax_desc',
  'img_provider_minimax',
  'img_provider_kling',
  'img_provider_flux',
  'model_runway_desc',
  'model_jimeng_desc',
  'model_kling_desc',
  'model_pika_desc',
  'model_vidu_desc',
  'model_luma_desc',
  'model_jimeng_f1',
  'model_jimeng_f2',
  'model_jimeng_f3',
  'model_jimeng_f4',
  'video_seedance',
  'video_vidu',
  'provider_minimax',
  'provider_kling',
  'provider_vidu',
  'model_jimeng',
  // 驼峰命名组合名（含模型名，前面通常是引号，(?<![a-zA-Z]) 可匹配）
  'gptImage2',
  'gptImage2Type',
  'gptImage2TemplateId',
  'doubaoSeedream',
  'doubaoVideoGen',
  'onOpenMiniMaxConfig',
  'isMiniMaxConfigOpen',
  'setMiniMaxConfigOpen',
  'MiniMaxConfigModal',
  // 短模型名（只替换引号开头，避免误伤英文单词和混淆变量名）
  'seedance',
  'seedream',
  'minimax',
  'jimeng',
  'kling',
  'runway',
  'luma',
  'pika',
  'flux',
  'vidu',
];

function escapeHex(str) {
  return str.split('').map(c => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hideModelNames(code) {
  const longNames = MODEL_IDS_TO_HIDE.filter((n) => /[-.]/.test(n));
  const shortNames = MODEL_IDS_TO_HIDE.filter((n) => !/[-.]/.test(n));

  return code.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, (fullMatch) => {
    let result = fullMatch;

    for (const name of [...longNames].sort((a, b) => b.length - a.length)) {
      const regex = new RegExp(escapeRegExp(name), 'gi');
      result = result.replace(regex, (match) => escapeHex(match));
    }

    for (const name of [...shortNames].sort((a, b) => b.length - a.length)) {
      const regex = new RegExp(`(?<![a-zA-Z])${escapeRegExp(name)}`, 'gi');
      result = result.replace(regex, (match) => escapeHex(match));
    }

    return result;
  });
}

// 需要混淆的目录
const TARGET_DIRS = ['assets/js', 'assets/css'];

const zlib = require('zlib');

// terser 超时包装（防止大文件卡死）
function minifyWithTimeout(code, opts, timeoutMs = 30000) {
  return Promise.race([
    minify(code, opts),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`terser timeout (${timeoutMs / 1000}s)`)), timeoutMs)
    ),
  ]);
}

async function processFile(filePath) {
  const ext = path.extname(filePath);
  if (ext !== '.js') return { skipped: true };

  const code = fs.readFileSync(filePath, 'utf8');
  if (code.length === 0) return { skipped: true };

  const fileName = path.basename(filePath);
  const codeBytes = Buffer.byteLength(code);
  const startTime = Date.now();

  try {
    // 大文件（>300KB）跳过 terser，仅做 hideModelNames，避免卡死
    // vite 已做 esbuild 压缩，大文件跳过 terser 不影响功能
    let finalCode;

    if (codeBytes > 300 * 1024) {
      console.log(`  [大文件跳过terser] ${fileName} (${(codeBytes / 1024).toFixed(0)}KB)`);
      finalCode = code;
    } else {
      const result = await minifyWithTimeout(code, {
        module: true,
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
          dead_code: true,
          unused: true,
          passes: 1,
        },
        mangle: {
          toplevel: true,
          keep_fnames: false,
          keep_classnames: false,
          reserved: [
            'exports', 'module', 'require', '__esModule',
            'default', 'then', 'catch', 'finally',
            'resolve', 'reject', 'toString', 'valueOf',
            'toJSON', 'constructor', 'prototype',
          ],
        },
        format: {
          comments: false,
        },
      }, 30000);

      if (!result.code || result.code.length === 0) {
        return { skipped: true };
      }
      finalCode = result.code;
    }

    const originalSize = codeBytes;
    const minifiedSize = Buffer.byteLength(finalCode);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    fs.writeFileSync(filePath, finalCode, 'utf8');

    // 重新生成 .gz 和 .br 文件
    const gzPath = filePath + '.gz';
    const brPath = filePath + '.br';
    if (fs.existsSync(gzPath)) {
      fs.writeFileSync(gzPath, zlib.gzipSync(finalCode, { level: 9 }));
    }
    if (fs.existsSync(brPath)) {
      fs.writeFileSync(brPath, zlib.brotliCompressSync(finalCode, { quality: 5 }));
    }

    console.log(`  [OK ${elapsed}s] ${fileName} (${(originalSize / 1024).toFixed(0)}KB -> ${(minifiedSize / 1024).toFixed(0)}KB)`);
    return { originalSize, minifiedSize };
  } catch (err) {
    // 混淆失败的文件：仍然应用 hideModelNames，保持原代码结构
    console.error(`  [跳过terser] ${fileName}: ${err.message}`);
    try {
      fs.writeFileSync(filePath, code, 'utf8');
      const gzPath = filePath + '.gz';
      const brPath = filePath + '.br';
      if (fs.existsSync(gzPath)) {
        fs.writeFileSync(gzPath, zlib.gzipSync(code, { level: 9 }));
      }
      if (fs.existsSync(brPath)) {
        fs.writeFileSync(brPath, zlib.brotliCompressSync(code, { quality: 5 }));
      }
    } catch (e) {
      // 最坏情况：保持原文件不变
    }
    return { skipped: true };
  }
}

async function processDir(dir) {
  if (!fs.existsSync(dir)) return { files: 0, skipped: 0, totalOriginal: 0, totalMinified: 0 };

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let stats = { files: 0, skipped: 0, totalOriginal: 0, totalMinified: 0 };

  // 收集所有待处理文件
  const tasks = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
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
      tasks.push(fullPath);
    }
  }

  // 并行处理（每批 8 个文件）
  const BATCH_SIZE = 8;
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(f => processFile(f)));
    for (const result of results) {
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
  console.log('前端代码深度混淆开始');
  console.log('====================================================');
  console.log(`目标目录: ${distDir}`);
  console.log('');

  const startTime = Date.now();
  let totalStats = { files: 0, skipped: 0, totalOriginal: 0, totalMinified: 0 };

  for (const target of TARGET_DIRS) {
    const targetPath = path.join(distDir, target);
    console.log(`处理: ${target}/`);
    const stats = await processDir(targetPath);
    totalStats.files += stats.files;
    totalStats.skipped += stats.skipped;
    totalStats.totalOriginal += stats.totalOriginal;
    totalStats.totalMinified += stats.totalMinified;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('');
  console.log('====================================================');
  console.log('深度混淆完成');
  console.log('====================================================');
  console.log(`处理文件: ${totalStats.files} 个`);
  console.log(`跳过文件: ${totalStats.skipped} 个`);
  if (totalStats.totalOriginal > 0) {
    console.log(`原始大小: ${(totalStats.totalOriginal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`混淆后:   ${(totalStats.totalMinified / 1024 / 1024).toFixed(2)} MB`);
    console.log(`压缩率:   ${((1 - totalStats.totalMinified / totalStats.totalOriginal) * 100).toFixed(1)}%`);
  }
  console.log(`耗时:     ${elapsed}s`);
}

main().catch((err) => {
  console.error('混淆脚本执行失败:', err);
  process.exit(1);
});
