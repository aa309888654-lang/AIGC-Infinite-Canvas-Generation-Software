/**
 * 应用配置
 * Express服务器配置和中间件设置
 */

import express, { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { config } from '../types/env';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler';
import { globalLimiter } from '../middleware/rateLimiter';
import { accessControlIpMiddleware } from '../middleware/access-control';
import { csrfProtection, sessionCookieBridge } from '../middleware/security-session';
import { authenticate } from '../middleware/auth';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();

// 信任代理（用于获取真实IP）
// 仅在生产环境启用，开发环境禁用以避免速率限制绕过问题
app.set('trust proxy', config.nodeEnv === 'production' ? 1 : false);

// 安全Headers配置
// SEC H-5 修复：为所有响应添加 CSP（包括 API JSON 与后端直接 serve 的静态文件）。
// 安全最佳实践：CSP 是 XSS 防御的第二道防线，即便 nginx 也会设置，后端应作为兜底。
// - script-src 'self'：阻止内联脚本与外部 CDN 注入（API JSON 不受影响，仅约束可执行脚本）
// - frame-ancestors 'none'：防止 API 响应或 admin 页面被 iframe 嵌套（点击劫持）
// - object-src 'none'：禁用 Flash/PDF 等插件
// - connect-src 'self' ws: wss: https:：允许 API、WebSocket 与第三方 AI 接口调用
//
// CSP 来源策略（渐进迁移）：
// 1. 前端兜底：index.html meta 标签
// 2. API 兜底：本 Helmet 配置（覆盖 API JSON 响应与后端直接 serve 的静态文件）
// ⚠️ 各处 CSP 内容必须保持一致
// 注意：生产环境 nginx 可对静态文件返回更严格的 CSP header 覆盖此默认值。
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // @imgly/background-removal loads its local WASM module from a same-origin Blob URL.
      scriptSrc: ["'self'", 'blob:', "'wasm-unsafe-eval'"],
      workerSrc: ["'self'", 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https:', 'http://127.0.0.1:8000', 'http://localhost:8000'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  // SEC L-3 修复：全局 CORP 默认收紧为 same-origin，仅对确需跨域加载的路径单独放宽。
  // 安全最佳实践：原 cross-origin 允许任意第三方页面通过 <img>/<script> 加载本站全部
  // 静态资源，配合用户 token 可能形成侧信道。same-origin 默认阻止跨域加载，需跨域
  // 的路径（/uploads、/music、/audio、/sponsor）在各自路由显式设置 cross-origin。
  crossOriginResourcePolicy: { policy: 'same-origin' },
  originAgentCluster: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  noSniff: true,
  hsts: false,
}));

// 报告策略保持与强制策略一致，便于收集剩余违规而不放宽执行权限。
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    'Content-Security-Policy-Report-Only',
    "default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ws: wss: https: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  );
  next();
});

// BREACH 防护：敏感响应不允许代理压缩或转换。根路径也显式禁用，避免扫描器
// 将入口响应的 deflate/gzip 误判为可利用的认证响应压缩。
app.use((req: Request, res: Response, next: NextFunction) => {
  const isSensitiveResponse =
    req.path === '/' ||
    req.path.startsWith('/api/v1/auth/') ||
    Boolean(req.headers.authorization || req.headers.cookie);
  if (isSensitiveResponse) {
    res.setHeader('Content-Encoding', 'identity');
    res.setHeader('Cache-Control', 'private, no-store, no-transform');
  }
  next();
});

// CORS配置 - 生产环境必须指定具体域名
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // 开发环境允许所有来源
    if (config.nodeEnv !== 'production') {
      return callback(null, true);
    }

    // 生产环境：只允许配置的域名
    if (!origin) {
      // SEC M-6 修复：放行无 Origin 头的请求，但绝不据此推断"可信来源"。
      // 安全最佳实践：CORS 是浏览器强制的同源策略放宽机制，非浏览器客户端
      // (Postman/curl/移动端原生/桌面 Tauri 应用) 本就不受 CORS 约束——
      // 对无 Origin 请求"拒绝"也无法阻挡此类客户端发起请求。任何敏感操作
      // 必须依赖 Authorization 头认证（已由 auth 中间件强制），而非 Origin。
      // 严禁在任何业务逻辑中将"无 Origin"或"Origin 在白名单"作为信任信号。
      return callback(null, true);
    }

    // 检查来源是否在白名单中
    const allowedOrigins = config.allowedOrigins;
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // 支持通配符匹配子域名和协议
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      // 特殊处理 tauri:// 和 app:// 协议
      if (allowedOrigin.startsWith('tauri://') || allowedOrigin.startsWith('app://')) {
        return origin.startsWith(allowedOrigin.replace(/\*/g, ''));
      }
      return origin === allowedOrigin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS拒绝: ${origin} 不在允许列表中`);
      // 不抛Error(会导致500)，而是返回false让浏览器拦截
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'X-Auth-Mode',
    'X-CSRF-Token',
    'x-admin-login',
    'x-admin-panel',
    'X-Admin-Token'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // 预检请求缓存24小时
};

app.use(cors(corsOptions));

// Cookie 认证兼容桥：现有 Bearer Token 继续可用，Web 登录同时获得 HttpOnly Cookie。
app.use(sessionCookieBridge);
app.use(csrfProtection);

// 全局 API 限流：使用 Redis store，保证多实例部署共享计数。
app.use('/api', accessControlIpMiddleware, globalLimiter);

// Body解析 - 必须放在路由之前！
// 仅明确接收 Base64 图片/画布快照的路由允许较大 JSON，且必须先于全局解析器。
const largeJsonRoutePrefixes = [
  '/api/v1/image',
  '/api/v1/video',
  '/api/v1/ai',
  '/api/v1/sync',
  '/api/v1/canvas-project',
  '/api/v1/rembg',
  '/api/v1/sam2',
  '/api/v1/upscale',
];
const largeJsonParser = express.json({ limit: '20mb' });
largeJsonRoutePrefixes.forEach((routePrefix) => app.use(routePrefix, largeJsonParser));

// 普通 API 不应缓冲大型请求体；媒体文件使用 multipart/对象存储上传。
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb', parameterLimit: 1000 }));

// API版本控制中间件
import { versionRouter } from '../middleware/versionRouter';
app.use(versionRouter);

// 请求日志中间件
import { requestLogger } from '../middleware/requestLogger';
app.use(requestLogger);

// P2 修复 #18：HTTP 指标中间件（prom-client）
// 在所有路由之前注册，使用 res.on('finish') 异步记录，避免阻塞响应。
// route 标签优先使用 req.route?.path（Express 路由模板），回退到 req.path
// 以避免每个独立 URL 被当作独立 label 导致指标爆炸（高基数问题）。
import { metricsService } from '../services/metrics-service';
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSeconds = durationNs / 1e9;
    const route = (req as any).route?.path || req.path || 'unknown';
    metricsService.recordHttpRequest(req.method, route, res.statusCode, durationSeconds);
  });
  next();
});

// 日期格式化中间件
import { dateFormatterMiddleware, responseDateFormatter } from '../middleware/dateFormatter';
app.use(dateFormatterMiddleware);
app.use(responseDateFormatter);

// 统一API响应格式中间件 — COM-01 修复：实现 responseFormatter，确保响应格式一致
app.use((req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  res.json = function(body: any) {
    // 如果已经是标准格式（包含 success 字段），直接返回
    if (body !== null && typeof body === 'object' && 'success' in body) {
      return originalJson(body);
    }
    // 如果是错误对象，包装为标准格式 — 风险修复：保留 code 字段供前端识别错误类型
    if (body !== null && typeof body === 'object' && 'error' in body && !('success' in body)) {
      const wrapped: Record<string, unknown> = {
        success: false,
        error: body.error,
        message: body.message || body.error,
      };
      // 保留 auth 中间件的 code 字段（如 NO_TOKEN, TOKEN_EXPIRED 等）
      if (body.code) wrapped.code = body.code;
      return originalJson(wrapped);
    }
    // 其他情况直接返回（如微信回调XML、纯字符串等）
    return originalJson(body);
  };
  next();
});

// 静态文件路径配置
const publicPath = path.join(process.cwd(), 'public');
// 前端构建产物路径：
// - 生产环境通过 FRONTEND_DIST_PATH 指定（如 /var/www/aicgxt）
// - 开发环境回退到 ../web/dist（与后端 cwd 的父目录关系）
const frontendDistPath = process.env.FRONTEND_DIST_PATH
  ? path.resolve(process.env.FRONTEND_DIST_PATH)
  : path.join(process.cwd(), '..', 'web', 'dist');
const hasMainDist = fs.existsSync(path.join(frontendDistPath, 'index.html'));
const mainHtmlPath = hasMainDist ? path.join(frontendDistPath, 'index.html') : path.join(publicPath, 'index.html');

// 健康检查端点 (P0优先级)
import healthRoutes from '../routes/health';
app.use('/api/health', healthRoutes);

// P2 修复 #18：Prometheus 标准抓取端点 /metrics
// SEC-AUDIT 修复：添加 Bearer Token 认证，防止系统指标公网泄露
// 认证方式：?token=xxx 查询参数 或 Authorization: Bearer xxx 请求头
// Token 通过环境变量 METRICS_TOKEN 配置；未配置时返回 403 拒绝访问
app.get('/metrics', async (req: Request, res: Response) => {
  const expectedToken = process.env.METRICS_TOKEN;
  if (!expectedToken) {
    res.status(403).send('# Metrics endpoint disabled (METRICS_TOKEN not configured)\n');
    return;
  }
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  if (bearerToken !== expectedToken && queryToken !== expectedToken) {
    res.status(401).send('# Unauthorized\n');
    return;
  }
  try {
    const metrics = await metricsService.metrics();
    res.set('Content-Type', metricsService.getContentType());
    res.send(metrics);
  } catch (err) {
    res.status(500).send('# Error collecting metrics\n');
  }
});

// Prisma Studio代理路由
import { prismaStudioRouter } from '../routes/prisma-studio';
app.use('/prisma-studio', prismaStudioRouter);

// API版本管理
import { versionRouter as versionApiRouter } from '../routes/version';
app.use('/api/version', versionApiRouter);

// API路由 v1（统一入口，所有API均通过此路由）
import { v1Router } from '../routes/v1';

app.use('/api/v1', v1Router);

import { csAgentRouter } from '../routes/cs-agent';
import { promptSafety } from '../middleware/prompt-safety';
app.use('/api/cs-agent', promptSafety, csAgentRouter);

import { chatRouter } from '../routes/chat';
app.use('/api/chat', promptSafety, chatRouter);

// ============================================================
// 静态文件服务 - 必须放在所有API路由之后！
// ============================================================

app.use((req, res, next) => {
  if (req.path.endsWith('.map')) {
    return res.status(404).send('Not Found');
  }
  next();
});

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // 搜索引擎优化：前端页面允许索引，API和管理页面禁止索引
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  } else {
    res.setHeader('X-Robots-Tag', 'index, follow');
  }
  res.removeHeader('X-Powered-By');
  next();
});

// 主前端 SPA 构建产物静态服务（单一前端入口，后端同源托管）
if (hasMainDist) {
  app.use(express.static(frontendDistPath, {
    dotfiles: 'deny',
    fallthrough: true,
    index: false,
  }));
  app.use('/public', express.static(path.join(frontendDistPath, 'public')));
}

// 静态文件服务
app.use(express.static(publicPath));

// BUG-1 修复：静态文件服务必须使用与上传路由相同的 UPLOAD_DIR，避免路径不一致导致 404
const uploadsRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
app.use('/uploads/tutorial-videos', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(uploadsRoot, 'tutorial-videos'), {
  maxAge: '1y',
  immutable: true,
}));
app.use('/uploads', authenticate, (req, res, next) => {
  const segments = req.path.split('/').filter(Boolean);
  const possibleOwnerId = segments[1];
  if (
    possibleOwnerId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(possibleOwnerId) &&
    possibleOwnerId !== (req as any).userId
  ) {
    return res.status(403).json({ success: false, error: '无权访问此文件' });
  }
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'private, no-store');
  if (segments[0] === 'workflows' || /\.(?:html?|js|mjs|cjs|svg|xml|json)$/i.test(req.path)) {
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  }
  next();
}, express.static(uploadsRoot, { dotfiles: 'deny', index: false }));

const localStorageRoot = process.env.LOCAL_STORAGE_DIR
  ? path.resolve(process.env.LOCAL_STORAGE_DIR)
  : path.join(uploadsRoot, 'storage');
app.use('/storage', authenticate, (req, res, next) => {
  const segments = req.path.split('/').filter(Boolean);
  if (segments[0] === 'users' && segments[1] && segments[1] !== (req as any).userId) {
    return res.status(403).json({ success: false, error: '无权访问此文件' });
  }
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'private, no-store');
  next();
}, express.static(localStorageRoot, { dotfiles: 'deny', index: false }));

// 音乐文件静态服务
// SEC L-3 修复：显式设置 cross-origin，覆盖 helmet 默认的 same-origin。
// 前端 (5173-5182 端口) 需跨端口加载后端 (3200) 的音乐文件。
app.use('/music', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(process.cwd(), 'public', 'music')));

// 音频文件静态服务 (AI配音生成结果)
// SEC L-3 修复：显式设置 cross-origin，覆盖 helmet 默认的 same-origin。
app.use('/audio', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(process.cwd(), 'public', 'audio')));

// 赞助图片静态文件服务
// SEC L-3 修复：显式设置 cross-origin，覆盖 helmet 默认的 same-origin。
app.use('/sponsor', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(publicPath, 'sponsor')));

// 主前端 SPA 入口（开源本地模式：后端同源托管前端）
// 未构建前端时返回服务信息，便于开发调试
app.get('/', (req, res) => {
  if (hasMainDist) {
    res.sendFile(mainHtmlPath);
    return;
  }
  res.json({
    success: true,
    name: 'xiaotian-canvas-backend',
    message: 'Backend is running',
    health: '/api/health',
    api: '/api/v1',
  });
});

// 主前端 SPA 路由回退：无文件扩展名且非 API/静态路径的 GET 请求交给前端路由
app.get('*', (req, res, next) => {
  const pathname = req.path;
  if (pathname.startsWith('/api/') || pathname.startsWith('/admin') || pathname.startsWith('/uploads')
    || pathname.startsWith('/storage') || pathname.startsWith('/music') || pathname.startsWith('/audio')
    || pathname.startsWith('/sponsor')
    || pathname.startsWith('/prisma-studio') || pathname === '/metrics' || pathname === '/favicon.ico') {
    return next();
  }
  const ext = path.extname(pathname);
  if (ext && ext !== '.html') {
    return next();
  }
  if (hasMainDist) {
    res.sendFile(mainHtmlPath);
    return;
  }
  next();
});

// ============================================================
// 所有未匹配请求统一交给错误处理中间件输出标准错误结构
// 必须放在所有API与静态资源路由之后！
// ============================================================
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
