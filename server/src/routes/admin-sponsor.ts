/**
 * admin-sponsor 路由 — 管理员赞助管理路由（存根）
 *
 * 登录与会员系统已移除，此文件保留空路由以维持编译兼容。
 */

import { Router } from 'express';

const adminSponsorRouter = Router();

// 所有赞助管理端点已移除
adminSponsorRouter.get('/', (_req, res) => {
  res.json({ success: true, sponsors: [] });
});

export default adminSponsorRouter;