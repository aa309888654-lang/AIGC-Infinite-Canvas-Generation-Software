/**
 * auth 路由 — 认证路由（存根）
 *
 * 登录与会员系统已移除，此文件保留空路由以维持编译兼容。
 */

import { Router } from 'express';

export const authRouter = Router();

// 所有认证端点已移除
authRouter.post('/login', (_req, res) => {
  res.status(410).json({ success: false, error: '登录功能已移除' });
});

authRouter.post('/register', (_req, res) => {
  res.status(410).json({ success: false, error: '注册功能已移除' });
});

authRouter.post('/logout', (_req, res) => {
  res.json({ success: true });
});