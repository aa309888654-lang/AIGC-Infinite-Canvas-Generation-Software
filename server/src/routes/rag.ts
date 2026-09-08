import { Router, Request, Response } from 'express';

const ragRouter = Router();

// RAG 微服务地址
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:5179';

/**
 * POST /api/v1/rag/search - 语义检索相似海报案例
 * 代理请求到 Python RAG 微服务
 */
ragRouter.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, top_k = 5 } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ success: false, error: 'query 参数不能为空' });
      return;
    }

    const startTime = Date.now();

    // 构建转发请求体
    const requestBody = {
      query: query.trim(),
      top_k: Math.min(Math.max(Number(top_k) || 5, 1), 20),
    };

    // 转发到 RAG 微服务
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5秒超时

    try {
      const response = await fetch(`${RAG_SERVICE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[RAG] 微服务返回错误: ${response.status} - ${errorText}`);

        // RAG 服务不可用时返回空结果而非报错（降级策略）
        res.json({
          success: true,
          degraded: true,
          message: 'RAG 服务暂时不可用，已跳过知识库检索',
          results: [],
          total: 0,
          query,
          query_time_ms: Date.now() - startTime,
        });
        return;
      }

      const data = await response.json() as Record<string, unknown>;
      res.json({
        success: true,
        degraded: false,
        ...data,
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeout);

      // 网络错误时降级返回空结果
      console.warn(`[RAG] 微服务连接失败: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      res.json({
        success: true,
        degraded: true,
        message: 'RAG 服务连接失败，已跳过知识库检索',
        results: [],
        total: 0,
        query,
        query_time_ms: Date.now() - startTime,
      });
    }
  } catch (error) {
    console.error('[RAG] 检索异常:', error);
    res.status(500).json({ success: false, error: '检索服务异常' });
  }
});

/**
 * GET /api/v1/rag/health - RAG 服务健康检查
 */
ragRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${RAG_SERVICE_URL}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      res.json({ status: 'unhealthy', rag_service: 'error' });
      return;
    }

    const data = await response.json();
    res.json({ status: 'ok', rag_service: data });
  } catch {
    res.json({ status: 'unhealthy', rag_service: 'unreachable' });
  }
});

/**
 * GET /api/v1/rag/stats - RAG 数据库统计
 */
ragRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${RAG_SERVICE_URL}/stats`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      res.status(503).json({ success: false, error: 'RAG 服务不可用' });
      return;
    }

    const data = await response.json() as Record<string, unknown>;
    res.json({ success: true, ...data });
  } catch {
    res.status(503).json({ success: false, error: 'RAG 服务不可达' });
  }
});

export { ragRouter };
