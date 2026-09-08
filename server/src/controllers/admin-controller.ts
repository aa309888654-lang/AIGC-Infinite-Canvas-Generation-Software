import { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/admin-service';
import { safeParseInt } from '../utils/parse';

export const adminController = {
  async getAllApiKeys(req: Request, res: Response, next: NextFunction) {
    try {
      const apiKeys = await adminService.getAllApiKeys();
      res.json({
        success: true,
        data: apiKeys,
      });
    } catch (error) {
      next(error);
    }
  },

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },

  async createApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      const apiKey = await adminService.createApiKey(req.body);
      res.json({ success: true, data: apiKey, message: 'API密钥创建成功' });
    } catch (error) { next(error); }
  },

  async updateApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      const apiKey = await adminService.updateApiKey(req.params.id, req.body);
      res.json({ success: true, data: apiKey, message: 'API密钥更新成功' });
    } catch (error) { next(error); }
  },

  async deleteApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      await adminService.deleteApiKey(req.params.id);
      res.json({ success: true, message: 'API密钥删除成功' });
    } catch (error) { next(error); }
  },

  async toggleApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      const apiKey = await adminService.toggleApiKey(req.params.id);
      res.json({ success: true, data: apiKey, message: 'API密钥状态已切换' });
    } catch (error) { next(error); }
  },

  async getApiKeyStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getApiKeyStats(req.params.id);
      res.json({ success: true, data: stats });
    } catch (error) { next(error); }
  },

  async getCampaignParticipations(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.getCampaignParticipations(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  },

};

