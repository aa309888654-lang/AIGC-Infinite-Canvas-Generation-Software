import express from 'express';
import { frontendMonitoringController } from '../controllers/frontend-monitoring-controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const adminFrontendMonitoringRouter = express.Router();

adminFrontendMonitoringRouter.use(authenticate, requireAdmin);

adminFrontendMonitoringRouter.get('/dashboard-stats', frontendMonitoringController.getDashboardStats.bind(frontendMonitoringController));

adminFrontendMonitoringRouter.get('/sessions', frontendMonitoringController.getRecentSessions.bind(frontendMonitoringController));

adminFrontendMonitoringRouter.get('/sessions/:sessionId', frontendMonitoringController.getSessionDetails.bind(frontendMonitoringController));

adminFrontendMonitoringRouter.get('/user-sessions/:userId', frontendMonitoringController.getUserSessions.bind(frontendMonitoringController));

adminFrontendMonitoringRouter.get('/performance', frontendMonitoringController.getPerformanceMetrics.bind(frontendMonitoringController));

adminFrontendMonitoringRouter.get('/events/analytics', frontendMonitoringController.getEventAnalytics.bind(frontendMonitoringController));

adminFrontendMonitoringRouter.get('/errors', frontendMonitoringController.getAllErrors.bind(frontendMonitoringController));

adminFrontendMonitoringRouter.get('/errors/analytics', frontendMonitoringController.getErrorAnalytics.bind(frontendMonitoringController));

adminFrontendMonitoringRouter.get('/realtime', frontendMonitoringController.getRealtimeStats.bind(frontendMonitoringController));

export { adminFrontendMonitoringRouter };
