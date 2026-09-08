/**
 * site-messages 路由 — 站点消息路由（存根）
 *
 * 登录与会员系统已移除，此文件保留空路由以维持编译兼容。
 */

import { Router } from 'express';

const siteMessagesRouter = Router();

// 所有站点消息端点已移除
siteMessagesRouter.get('/', (_req, res) => {
  res.json({ success: true, messages: [] });
});

export default siteMessagesRouter;