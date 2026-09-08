import { Router, Request, Response } from 'express';
import { VERSION_CONFIG, VERSION_LIFECYCLE } from '../types/version';
import { getVersionStats, resetVersionStats } from '../middleware/versionRouter';
import {
  compareVersions,
  generateMigrationGuide,
  generateVersionReport,
  exportVersionConfig,
} from '../utils/versionManager';
import { authenticate, requireRole } from '../middleware/auth';

export const versionRouter = Router();

versionRouter.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      currentVersion: VERSION_CONFIG.currentVersion,
      supportedVersions: VERSION_CONFIG.supportedVersions,
      defaultVersion: VERSION_CONFIG.defaultVersion,
      allVersions: VERSION_LIFECYCLE,
    },
  });
});

versionRouter.get('/stats', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  const stats = getVersionStats();
  
  res.json({
    success: true,
    data: {
      stats,
      summary: {
        totalRequests: stats.reduce((sum, s) => sum + s.totalRequests, 0),
        averageResponseTime: stats.reduce((sum, s) => sum + s.averageResponseTime, 0) / stats.length,
      },
    },
  });
});

versionRouter.post('/stats/reset', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  resetVersionStats();
  
  res.json({
    success: true,
    message: 'Version statistics reset successfully',
  });
});

versionRouter.get('/compare/:from/:to', (req: Request, res: Response) => {
  const { from, to } = req.params;
  
  try {
    const diff = compareVersions(from as any, to as any);
    
    res.json({
      success: true,
      data: diff,
    });
  } catch (error: unknown) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_VERSION',
        message: (error instanceof Error ? error.message : String(error)),
      },
    });
  }
});

versionRouter.get('/migration/:from/:to', (req: Request, res: Response) => {
  const { from, to } = req.params;
  
  try {
    const guide = generateMigrationGuide(from as any, to as any);
    
    res.json({
      success: true,
      data: guide,
    });
  } catch (error: unknown) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_VERSION',
        message: (error instanceof Error ? error.message : String(error)),
      },
    });
  }
});

versionRouter.get('/report', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  const report = generateVersionReport();
  
  res.setHeader('Content-Type', 'text/markdown');
  res.send(report);
});

versionRouter.get('/export', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  const config = exportVersionConfig();
  
  res.setHeader('Content-Type', 'application/json');
  res.attachment('api-versions.json');
  res.send(config);
});

versionRouter.get('/lifecycle', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: VERSION_LIFECYCLE,
  });
});

versionRouter.get('/current', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      version: VERSION_CONFIG.currentVersion,
      info: VERSION_LIFECYCLE[VERSION_CONFIG.currentVersion],
    },
  });
});

versionRouter.get('/deprecations', (req: Request, res: Response) => {
  const deprecations = Object.entries(VERSION_LIFECYCLE)
    .filter(([_, info]: [string, any]) => info.status === 'deprecated' || info.status === 'eol')
    .map(([version, info]: [string, any]) => ({
      version,
      status: info.status,
      deprecationDate: info.deprecationDate,
      endOfLifeDate: info.endOfLifeDate,
      sunsetDate: info.endOfLifeDate,
    }));
  
  res.json({
    success: true,
    data: deprecations,
  });
});
