import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/sponsor', async (req: Request, res: Response) => {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { startsWith: 'sponsor_' } }
    });
    
    const configMap: Record<string, string> = {};
    configs.forEach(c => { configMap[c.key] = c.value; });
    
    res.json({
      success: true,
      data: {
        qrcodeUrl: configMap['sponsor_qrcode_url'] || '/sponsor/qrcode.png',
        description: configMap['sponsor_description'] || '感谢您的支持！扫码赞助。',
      }
    });
  } catch (error: unknown) {
    console.error('[Public Sponsor] Get error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

router.get('/sponsor/icon', async (req: Request, res: Response) => {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'app_icon_url' }
    });
    
    res.json({
      success: true,
      data: {
        iconUrl: config?.value || '/sponsor/app-icon.png'
      }
    });
  } catch (error: unknown) {
    console.error('[Public Sponsor] Get icon error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

export default router;
