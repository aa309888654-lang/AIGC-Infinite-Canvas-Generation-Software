#!/usr/bin/env node
/**
 * 后端代码混淆脚本
 * - 移除 .map / .d.ts 文件（避免泄露源码）
 * - 使用 terser 混淆所有 .js 文件
 */
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');

async function processFile(filePath) {
  const ext = path.extname(filePath);
  if (ext === '.map' || ext === '.ts') {
    // .d.ts 文件移除，.map 移除
    fs.unlinkSync(filePath);
    return 'removed';
  }
  if (ext === '.js') {
    const code = fs.readFileSync(filePath, 'utf8');
    try {
      const result = await minify(code, {
        compress: {
          dead_code: true,
          unused: true,
          passes: 2,
        },
        mangle: {
          toplevel: false, // CommonJS 模块 toplevel mangle 可能破坏 require
          keep_fnames: false,
          keep_classnames: false,
        },
        format: {
          comments: false,
        },
      });
      if (result.code) {
        fs.writeFileSync(filePath, result.code);
        return 'obfuscated';
      }
    } catch (e) {
      console.error(`[WARN] 混淆失败 ${filePath}: ${e.message}`);
      return 'skipped';
    }
  }
  return 'unchanged';
}

async function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (entry.isFile()) {
      const result = await processFile(fullPath);
      if (result !== 'unchanged') {
        console.log(`[${result}] ${path.relative(DIST_DIR, fullPath)}`);
      }
    }
  }
}

(async () => {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('dist/ 不存在，请先 npm run build');
    process.exit(1);
  }
  console.log('开始混淆 dist/ ...');
  await walk(DIST_DIR);
  console.log('混淆完成');
})();
