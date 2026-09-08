import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../types/env';
import { authenticate, requireAdmin } from '../middleware/auth';

const prismaStudioRouter = express.Router();

const PRISMA_STUDIO_URL = process.env.PRISMA_STUDIO_URL || 'http://localhost:5555';
const PRISMA_STUDIO_ENABLED = config.nodeEnv !== 'production' || !!process.env.PRISMA_STUDIO_URL;

prismaStudioRouter.use((req, res, next) => {
  if (!PRISMA_STUDIO_ENABLED) {
    res.status(404).json({
      success: false,
      error: 'Prisma Studio 未启用',
      code: 'PRISMA_STUDIO_DISABLED',
    });
    return;
  }

  next();
});

prismaStudioRouter.use(authenticate, requireAdmin);

prismaStudioRouter.use(
  createProxyMiddleware({
    target: PRISMA_STUDIO_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/prisma-studio': '',
    },
    onProxyReq: (proxyReq: any, req: express.Request) => {
      console.log(`[Prisma Studio Proxy] ${req.method} ${req.path}`);
    },
    onError: (err: Error, req: express.Request, res: express.Response) => {
      console.error('[Prisma Studio Proxy] Error:', err.message);
      res.status(503).json({
        success: false,
        error: 'Prisma Studio 不可用，请确保其在 5555 端口运行。',
        code: 'PRISMA_STUDIO_UNAVAILABLE'
      });
    }
  } as any)
);

export { prismaStudioRouter };
