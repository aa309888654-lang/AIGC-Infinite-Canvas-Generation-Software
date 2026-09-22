import { Router, Request, Response } from 'express';
import { createSponsorOrder, querySponsorOrder, SponsorUpstreamError } from '../services/sponsor-upstream-client';

/**
 * 赞助下单代理：与 https://aicgxt.cn/sponsor 同一套 YunGouOS 支付。
 * 官网支付网关不允许跨域浏览器请求，由本服务在服务端转发，前端走同源 /api/v1。
 * 本路由只负责入参校验与响应透传，对外请求统一走 sponsor-upstream-client
 * （内部固定官网域名 + 请求前白名单校验 + 禁重定向 + DNS 解析地址校验）。
 */

const MAX_SPONSOR_AMOUNT = 500;
const ORDER_NO_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_SPONSOR_AMOUNT) {
      res.status(400).json({ success: false, message: '赞助金额不合法' });
      return;
    }
    const upstream = await createSponsorOrder(amount);
    res.status(upstream.status).json(upstream.body);
  } catch (error: any) {
    const upstreamError = error as SponsorUpstreamError;
    if (upstreamError?.upstreamStatus) {
      res.status(upstreamError.upstreamStatus).json(upstreamError.upstreamBody ?? { success: false, message: '下单失败' });
      return;
    }
    console.error('[Sponsor Orders] create proxy error:', error?.message || error);
    res.status(502).json({ success: false, message: '支付网关暂时不可用，请稍后重试' });
  }
});

router.get('/:orderNo', async (req: Request, res: Response) => {
  try {
    const orderNo = String(req.params.orderNo || '');
    if (!ORDER_NO_PATTERN.test(orderNo)) {
      res.status(400).json({ success: false, message: '订单号不合法' });
      return;
    }
    const upstream = await querySponsorOrder(orderNo);
    res.status(upstream.status).json(upstream.body);
  } catch (error: any) {
    const upstreamError = error as SponsorUpstreamError;
    if (upstreamError?.upstreamStatus) {
      res.status(upstreamError.upstreamStatus).json(upstreamError.upstreamBody ?? { success: false, message: '查询失败' });
      return;
    }
    console.error('[Sponsor Orders] query proxy error:', error?.message || error);
    res.status(502).json({ success: false, message: '支付网关暂时不可用，请稍后重试' });
  }
});

export default router;
