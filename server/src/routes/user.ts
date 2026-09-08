/**
 * user 路由 — 用户路由（存根）
 *
 * 登录与会员系统已移除，此文件保留空路由以维持编译兼容。
 */

import { Router } from 'express';

export const userRouter = Router();

// 所有用户端点已移除
userRouter.get('/profile', (_req, res) => {
  res.status(410).json({ success: false, error: '用户功能已移除' });
});