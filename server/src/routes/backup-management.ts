import { Router, Request, Response } from 'express';
import path from 'path';
import { authenticate, requireAdmin } from '../middleware/auth';
import { backupService } from '../services/backup-service';
import { auditService } from '../services/audit-service';
import { formatBytes } from '../utils/format';

const router = Router();

router.use(authenticate, requireAdmin);

/** 防止路径穿越：只保留文件名部分 */
function sanitizeFilename(filename: string): string {
  return path.basename(filename);
}

router.get('/list', async (req: Request, res: Response) => {
  try {
    const backups = await backupService.listBackups();
    const stats = await backupService.getBackupStats();

    res.json({
      success: true,
      backups: backups.map(b => ({
        id: b.filename,
        filename: b.filename,
        size: b.size,
        sizeFormatted: formatBytes(b.size),
        createdAt: b.createdAt,
        createdAtFormatted: new Date(b.createdAt).toLocaleString('zh-CN')
      })),
      stats: {
        totalBackups: stats.totalBackups,
        totalSize: stats.totalSize,
        totalSizeFormatted: formatBytes(stats.totalSize),
        oldestBackup: stats.oldestBackup,
        newestBackup: stats.newestBackup
      }
    });
  } catch (error: unknown) {
    console.error('[Backup] List error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

router.post('/create', async (req: Request, res: Response) => {
  try {
    await auditService.log({
      userId: (req as any).user?.id,
      username: (req as any).user?.username,
      action: 'CREATE',
      resource: 'BACKUP',
      resourceName: '数据库备份',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'SUCCESS'
    });

    const result = await backupService.createBackup({
      type: 'full',
      compress: true
    });

    if (result.success) {
      await auditService.log({
        userId: (req as any).user?.id,
        username: (req as any).user?.username,
        action: 'CREATE',
        resource: 'BACKUP',
        resourceName: result.filePath,
        metadata: { size: result.fileSize },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'SUCCESS'
      });
    }

    res.json({
      success: result.success,
      message: result.message,
      backup: result.success ? {
        filename: result.filePath?.split('/').pop(),
        size: result.fileSize,
        sizeFormatted: formatBytes(result.fileSize || 0),
        createdAt: result.timestamp
      } : null
    });
  } catch (error: unknown) {
    console.error('[Backup] Create error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

router.post('/restore/:filename', async (req: Request, res: Response) => {
  try {
    const filename = sanitizeFilename(req.params.filename);

    await auditService.log({
      userId: (req as any).user?.id,
      username: (req as any).user?.username,
      action: 'RESTORE',
      resource: 'BACKUP',
      resourceName: filename,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'PENDING'
    });

    const result = await backupService.restoreBackup(`./backups/${filename}`);

    await auditService.log({
      userId: (req as any).user?.id,
      username: (req as any).user?.username,
      action: 'RESTORE',
      resource: 'BACKUP',
      resourceName: filename,
      status: result.success ? 'SUCCESS' : 'FAILURE',
      errorMessage: result.success ? undefined : result.message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(result);
  } catch (error: unknown) {
    console.error('[Backup] Restore error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

router.delete('/:filename', async (req: Request, res: Response) => {
  try {
    const filename = sanitizeFilename(req.params.filename);

    const deleted = await backupService.deleteBackup(filename);

    if (deleted) {
      await auditService.log({
        userId: (req as any).user?.id,
        username: (req as any).user?.username,
        action: 'DELETE',
        resource: 'BACKUP',
        resourceName: filename,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'SUCCESS'
      });
    }

    res.json({ success: deleted });
  } catch (error: unknown) {
    console.error('[Backup] Delete error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

router.get('/download/:filename', async (req: Request, res: Response) => {
  try {
    const filename = sanitizeFilename(req.params.filename);
    const filepath = `./backups/${filename}`;

    await auditService.log({
      userId: (req as any).user?.id,
      username: (req as any).user?.username,
      action: 'EXPORT',
      resource: 'BACKUP',
      resourceName: filename,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'SUCCESS'
    });

    res.download(filepath, filename);
  } catch (error: unknown) {
    console.error('[Backup] Download error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await backupService.getBackupStats();

    res.json({
      success: true,
      stats: {
        totalBackups: stats.totalBackups,
        totalSize: stats.totalSize,
        totalSizeFormatted: formatBytes(stats.totalSize),
        oldestBackup: stats.oldestBackup,
        newestBackup: stats.newestBackup,
        oldestBackupFormatted: stats.oldestBackup ? new Date(stats.oldestBackup).toLocaleString('zh-CN') : null,
        newestBackupFormatted: stats.newestBackup ? new Date(stats.newestBackup).toLocaleString('zh-CN') : null
      }
    });
  } catch (error: unknown) {
    console.error('[Backup] Stats error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const { enabled, cron, retentionDays } = req.body;

    await auditService.log({
      userId: (req as any).user?.id,
      username: (req as any).user?.username,
      action: 'UPDATE',
      resource: 'BACKUP',
      resourceName: '备份计划',
      metadata: { enabled, cron, retentionDays },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      message: '备份计划已更新',
      schedule: {
        enabled,
        cron,
        retentionDays
      }
    });
  } catch (error: unknown) {
    console.error('[Backup] Schedule error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

export default router;
