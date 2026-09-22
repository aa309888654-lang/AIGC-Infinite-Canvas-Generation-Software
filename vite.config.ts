import { defineConfig, loadEnv, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'
import path from 'path'
import { resolve } from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function versionReplacePlugin(): Plugin {
  return {
    name: 'version-replace',
    transformIndexHtml(html) {
      return html.replace(/__VERSION__/g, new Date().toISOString().slice(0, 10).replace(/-/g, ''))
    },
  }
}

// 开发模式下放宽 CSP：Vite HMR 和 sourcemap 需要 unsafe-eval。
function cspDevPlugin(): Plugin {
  return {
    name: 'csp-dev',
    transformIndexHtml(html, ctx) {
      if (!ctx.server) return html;
      return html.replace(
        /script-src 'self' blob: 'wasm-unsafe-eval'/g,
        "script-src 'self' blob: 'unsafe-eval' 'wasm-unsafe-eval'"
      );
    },
  }
}

// Note: vite-plugin-pwa 已彻底移除，不再生成 sw.js/workbox-*.js。
// 保留 scripts/cleanup-sw.cjs 作为安全网，防止历史残留；连续 3 次部署后可移除。

function preloadCriticalAssetsPlugin(): Plugin {
  return {
    name: 'preload-critical-assets',
    enforce: 'post',
    transformIndexHtml(html, bundle) {
      const tags: Array<{ tag: string; attrs: Record<string, string>; appendTo?: string }> = []
      const cssMatches = html.match(/href="([^"]*\.css)"/g)
      if (cssMatches) {
        for (const match of cssMatches) {
          const href = match.match(/href="([^"]*)"/)?.[1]
          if (href && !href.startsWith('http')) {
            tags.push({ tag: 'link', attrs: { rel: 'preload', href, as: 'style', crossorigin: '' } })
          }
        }
      }
      const criticalVendors = ['vendor-react', 'vendor-router', 'vendor-utils', 'vendor-ui', 'vendor-data', 'rolldown-runtime', 'src-']
      html = html.replace(/<link\s+rel="modulepreload"[^>]*href="([^"]*)"[^>]*>/g, (match, href) => {
        if (criticalVendors.some(v => href.includes(v))) return match
        return ''
      })
      return { html, tags }
    },
  }
}

function normalizeBaseUrl(baseUrl?: string): string {
  if (!baseUrl) {
    return '/'
  }

  const trimmed = baseUrl.trim()
  if (!trimmed) {
    return '/'
  }

  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  // 后端代理目标可用 VITE_BACKEND_URL 覆盖（默认本机 3200）
  const backendTarget = env.VITE_BACKEND_URL || 'http://127.0.0.1:3200'
  const rollupInputs: Record<string, string> = {
    main: resolve(__dirname, 'index.html'),
  }
  // 管理端入口被移除时仍允许构建公开的主应用。
  if (fs.existsSync(resolve(__dirname, 'admin.html'))) {
    rollupInputs.admin = resolve(__dirname, 'admin.html')
  }

  return {
    // Keep app entry assets on the same origin by default.
    // Large media/resource URLs are configured separately in `src/config/resources.ts`.
    base: normalizeBaseUrl(env.VITE_BUILD_ASSET_BASE_URL),
    plugins: [
      react(),
      versionReplacePlugin(),
      cspDevPlugin(),
      preloadCriticalAssetsPlugin(),
      // PWA 已移除：vite-plugin-pwa 即使 enabled:false 仍会生成 sw.js/workbox-*.js，
      // 导致每次部署都要三层 cleanup（cleanup-sw.cjs + index.html 注销 + 部署脚本清理）。
      // 现已不需要离线访问，移除以根治缓存卡死问题。
      // 过渡期保留 index.html 内联注销脚本和 cleanup-sw.cjs 作为安全网。
      viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 1024,
        deleteOriginFile: false,
      }),
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 1024,
        deleteOriginFile: false,
      }),
    ],
    resolve: {
      extensions: ['.mjs', '.ts', '.tsx', '.js', '.jsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['onnxruntime-web', '@imgly/background-removal'],
      exclude: [],
    },
    build: {
      outDir: 'dist',
      // dist/models can be held open by local model tooling on Windows.
      // scripts/clean-dist.cjs removes stale output while preserving that directory.
      emptyOutDir: false,
      modulePreload: {
        polyfill: false,
      },
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        checks: {
          pluginTimings: false,
        },
        onLog(level, log, handler) {
          const message = typeof log === 'string' ? log : log.message;
          if (typeof message === 'string' && message.includes('[PLUGIN_TIMINGS]')) return;
          handler(level, log);
        },
        input: {
          ...rollupInputs,
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              const reactPkgs = ['/react/', '/react-dom/', '/scheduler/', '/react-is/', '/prop-types/'];
              if (reactPkgs.some(p => id.includes(p))) return 'vendor-react';
              if (id.includes('/@xyflow/') || id.includes('/reactflow/')) return 'vendor-flow';
              if (id.includes('/framer-motion/') || id.includes('/gsap/')) return 'vendor-motion';
              if (id.includes('/pixi.js/') || id.includes('/pixi/') || id.includes('/fabric/')) return 'vendor-media';
              if (id.includes('/tone/') || id.includes('/wavesurfer.js/')) return 'vendor-audio';
              if (id.includes('/@ffmpeg/')) return 'vendor-video';
              // Keep charting code route-local. Forcing Recharts into a shared
              // chunk made the chart-free landing page download it through a
              // cross-chunk React dependency.
              if (id.includes('/onnxruntime-web/')) return 'vendor-onnxruntime';
              if (id.includes('/@imgly/background-removal/')) return 'vendor-bg-removal';
              if (id.includes('/@mediapipe/')) return 'vendor-mediapipe';
              if (id.includes('/lucide-react/') || id.includes('/sonner/')) return 'vendor-ui';
              if (id.includes('/zustand/') || id.includes('/immer/') || id.includes('/clsx/') || id.includes('/tailwind-merge/')) return 'vendor-utils';
              if (id.includes('/react-router-dom/') || id.includes('/react-hook-form/') || id.includes('/@hookform/')) return 'vendor-router';
              if (id.includes('/zod/') || id.includes('/dompurify/') || id.includes('/jszip/') || id.includes('/axios/')) return 'vendor-data';
              if (id.includes('/comlink/') || id.includes('/browser-id3-writer/')) return 'vendor-worker';
            }
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },
      // 发布源码而非混淆产物：关闭压缩与变量名改写，保留可读的标识符与注释。
      minify: false,
      sourcemap: false,
      target: 'es2020',
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 1000,
      reportCompressedSize: true,
      limitZeroThreshold: 1024,
    },
    worker: {
      format: 'es',
    },
    server: {
      port: 5178,
      strictPort: false,
      // COOP/COEP 头是 onnxruntime-web 多线程所必需的（本地抠图 ISNet 模型）
      // 生产环境 nginx 必须配同样的头，否则 crossOriginIsolated=false，降级单线程
      // 示例:
      //   add_header Cross-Origin-Opener-Policy "same-origin" always;
      //   add_header Cross-Origin-Embedder-Policy "credentialless" always;
      //   location /models/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
      headers: {
        'Cache-Control': 'no-store',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
      middleware: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req: any, res: any, next: any) => {
          if (req.url === '/admin.html') {
            const adminHtmlPath = path.resolve(__dirname, 'admin.html');
            if (fs.existsSync(adminHtmlPath)) {
              res.setHeader('Content-Type', 'text/html');
              res.setHeader('Cache-Control', 'no-store');
              res.end(fs.readFileSync(adminHtmlPath));
              return;
            }
          }
          next();
        },
      ],
      proxy: {
        '/api/v1': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        '/api/ai-proxy': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: backendTarget.replace(/^http/, 'ws'),
          ws: true,
        },
        '/baidu-ai': {
          target: 'https://aip.baidubce.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/baidu-ai/, ''),
        },
        '/audio': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 5180,
      strictPort: false,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
      proxy: {
        '/api/v1': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        '/audio': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
