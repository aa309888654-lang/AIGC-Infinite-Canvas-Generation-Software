import { UserInfo } from '../services/permission-service';
import type { PreCheckResult } from '../services/credit-service';
import type { CreditDeductionConfig } from '../middleware/credit-deduction';

declare global {
  namespace Express {
    interface Request {
      // CFG-04 修复：统一所有 Express.Request 扩展声明到此文件
      userId?: string;
      userRole?: string;
      user?: UserInfo;
      membershipLevel?: string;
      creditCheck?: PreCheckResult;
      creditConfig?: CreditDeductionConfig;
      adminId?: string;
      adminUser?: { id: string; username: string; role: string };
      // 从 requestLogger.ts 迁移
      requestId?: string;
      startTime?: number;
      originalBody?: any;
      originalQuery?: any;
      // 从 versionRouter.ts 迁移
      apiVersion?: string;
      versionInfo?: any;
    }
  }
}
