// 清理 Service Worker 残留文件（安全网）
// vite-plugin-pwa 已从 vite.config.ts 移除，不再生成 sw.js/workbox-*.js。
// public/sw.js 是手动维护的"注销版 SW"，用于让旧浏览器自动清理缓存，必须保留。
// 本脚本只清理 workbox-*.js 残留（如果意外引入 PWA 依赖后会出现）。
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  console.log('[cleanup-sw] dist directory not found, skipping');
  process.exit(0);
}

// 只清理 workbox 残留，保留 public/sw.js 注销版
const patterns = [
  /^workbox-[\w-]+\.js(\.(gz|br))?$/,
];

let removed = 0;
for (const file of fs.readdirSync(distDir)) {
  if (patterns.some(p => p.test(file))) {
    const filePath = path.join(distDir, file);
    fs.rmSync(filePath, { force: true });
    console.log(`[cleanup-sw] Removed ${file}`);
    removed++;
  }
}

if (removed === 0) {
  console.log('[cleanup-sw] No workbox残留，public/sw.js 注销版已保留');
} else {
  console.log(`[cleanup-sw] Cleaned ${removed} workbox file(s)`);
}
