/**
 * notification 路由 — 通知路由（存根）
 *
 * 登录与会员系统已移除，此文件保留空路由以维持编译兼容。
 */

import { Router } from 'express';

const notificationRouter = Router();

// 所有通知端点已移除
notificationRouter.get('/', (_req, res) => {
  res.json({ success: true, notifications: [] });
});

export default notificationRouter;