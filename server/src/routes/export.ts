import { Router, Request, Response } from 'express';
import { exportService } from '../services/export-service';
import { authenticate, requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

const exportTypes = ['users', 'tasks', 'logs', 'quotas'];
const exportFormats = ['csv', 'json', 'excel'];

// SEC-AUDIT 修复：根路由加 requireAuth，避免端点结构未授权泄露
// 安全最佳实践：导出接口根路由暴露内部结构，需认证访问
router.get('/', requireAuth, (req, res) => {
  res.json({
    success: true,
    message: 'Export API',
    endpoints: {
      users: 'GET /api/export/users?format=csv|json|excel',
      tasks: 'GET /api/export/tasks?format=csv|json|excel',
      logs: 'GET /api/export/logs?format=csv|json|excel',
      quotas: 'GET /api/export/quotas?format=csv|json|excel',
    },
    supportedTypes: exportTypes,
    supportedFormats: exportFormats,
  });
});

router.get('/:type', requireAuth, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const format = (req.query.format as string) || 'csv';
    const { startDate, endDate } = req.query;

    if (!exportTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `无效的导出类型。可用类型: ${exportTypes.join(', ')}`
      });
    }

    if (!exportFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        message: `无效的导出格式。可用格式: ${exportFormats.join(', ')}`
      });
    }

    const userId = (req as any).user.role === 'admin' ? undefined : (req as any).user.id;

    const exportMethod = `export${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof typeof exportService;
    const result = await (exportService as any)[exportMethod]({
      userId,
      startDate: startDate as string,
      endDate: endDate as string,
      format: format as any
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
    res.send(result.data);
  } catch (error: unknown) {
    console.error('[Export] Error:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '导出失败'
    });
  }
});

router.get('/users/all', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const { startDate, endDate } = req.query;

    const result = await exportService.exportUsers({
      startDate: startDate as string,
      endDate: endDate as string,
      format: format as any
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
    res.send(result.data);
  } catch (error: unknown) {
    console.error('[Export] Users error:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '导出失败'
    });
  }
});

router.get('/tasks/all', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const { startDate, endDate } = req.query;

    const result = await exportService.exportTasks({
      startDate: startDate as string,
      endDate: endDate as string,
      format: format as any
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
    res.send(result.data);
  } catch (error: unknown) {
    console.error('[Export] Tasks error:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '导出失败'
    });
  }
});

router.get('/logs/all', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const { startDate, endDate } = req.query;

    const result = await exportService.exportLogs({
      startDate: startDate as string,
      endDate: endDate as string,
      format: format as any
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
    res.send(result.data);
  } catch (error: unknown) {
    console.error('[Export] Logs error:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '导出失败'
    });
  }
});

router.get('/quotas/all', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'csv';

    const result = await exportService.exportQuotas({
      format: format as any
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
    res.send(result.data);
  } catch (error: unknown) {
    console.error('[Export] Quotas error:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '导出失败'
    });
  }
});

router.get('/types', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    types: exportTypes.map(type => ({
      type,
      description: getTypeDescription(type)
    })),
    formats: exportFormats.map(format => ({
      format,
      description: getFormatDescription(format)
    }))
  });
});

function getTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    users: '导出用户列表',
    tasks: '导出任务记录',
    logs: '导出操作日志',
    quotas: '导出配额使用情况'
  };
  return descriptions[type] || '';
}

function getFormatDescription(format: string): string {
  const descriptions: Record<string, string> = {
    csv: 'CSV格式，适用于Excel打开',
    json: 'JSON格式，适用于程序处理',
    excel: 'Excel格式（需安装exceljs）'
  };
  return descriptions[format] || '';
}

export default router;
