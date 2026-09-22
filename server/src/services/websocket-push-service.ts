import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../types/env';
import { loggingService } from './logging-service';
import { redisService } from './redis-service';
import prisma from '../lib/prisma';

export enum WebSocketEvent {
  TASK_PROGRESS = 'task:progress',
  TASK_COMPLETE = 'task:complete',
  TASK_REVIEW_PENDING = 'task:review-pending',
  TASK_REVIEW_REJECTED = 'task:review-rejected',
  ADMIN_TASK_UPDATED = 'admin:task:updated',
  TASK_FAILED = 'task:failed',
  NOTIFICATION = 'notification:new',
  QUOTA_WARNING = 'quota:warning',
  PAYMENT_STATUS = 'payment:status',
  SYSTEM_ALERT = 'system:alert',
USER_ONLINE = 'user:online',
  USER_OFFLINE = 'user:offline',
  CHAT_MESSAGE_NEW = 'chat:message:new'
}

export interface PushMessage {
  type: WebSocketEvent | string;
  data: any;
  timestamp: string;
  userId?: string;
}

interface AuthenticatedUser {
  userId: string;
  username: string;
  role: string;
}

class WebSocketPushService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<WebSocket>> = new Map();
  private userConnections: Map<WebSocket, AuthenticatedUser> = new Map();
  private heartbeatIntervals: Map<WebSocket, NodeJS.Timeout> = new Map();
  private server: HttpServer | null = null;

  initialize(server: HttpServer): void {
    this.server = server;
    
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      clientTracking: true
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('[WebSocket] 新的WebSocket连接');

      ws.on('message', async (data: Buffer) => {
        try {
          const message = data.toString();
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('[WebSocket] 消息处理错误:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] 连接错误:', error);
        this.handleDisconnect(ws);
      });

      // CONC-04 修复：移除冲突的永久 on('pong') 监听器，心跳超时由 startHeartbeat 中的 once('pong') 管理

      this.startHeartbeat(ws);
    });

    this.wss.on('error', (error) => {
      console.error('[WebSocketServer] 错误:', error);
    });

    console.log('[WebSocket] WebSocket服务已初始化');
  }

  private async handleMessage(ws: WebSocket, message: string): Promise<void> {
    try {
      const parsed = JSON.parse(message);
      
      if (parsed.type === 'auth') {
        await this.handleAuth(ws, parsed.token);
      } else if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      } else if (parsed.type === 'subscribe') {
        this.handleSubscribe(ws, parsed.channel);
      } else if (parsed.type === 'unsubscribe') {
        this.handleUnsubscribe(ws, parsed.channel);
      }
    } catch (error) {
      console.error('[WebSocket] 消息解析错误:', error);
    }
  }

  private async handleAuth(ws: WebSocket, token: string): Promise<void> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      const user: AuthenticatedUser = {
        userId: decoded.id || decoded.userId,
        username: decoded.username,
        role: decoded.role
      };

      this.userConnections.set(ws, user);

      if (!this.clients.has(user.userId)) {
        this.clients.set(user.userId, new Set());
      }
      this.clients.get(user.userId)!.add(ws);

      ws.send(JSON.stringify({
        type: 'auth_success',
        user: {
          userId: user.userId,
          username: user.username,
          role: user.role
        },
        timestamp: new Date().toISOString()
      }));

      await this.flushOfflineMessages(user.userId);

      const userOnlineMsg = {
        type: WebSocketEvent.USER_ONLINE,
        data: { userId: user.userId, username: user.username },
        timestamp: new Date().toISOString()
      };
      await this.sendToUser(user.userId, userOnlineMsg);

      console.log(`[WebSocket] 用户已认证: ${user.username} (${user.userId})`);
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'auth_error',
        error: '认证失败',
        timestamp: new Date().toISOString()
      }));
      ws.close();
    }
  }

  private handleSubscribe(ws: WebSocket, channel: string): void {
    const user = this.userConnections.get(ws);
    
    if (user) {
      const channelKey = `${user.userId}:${channel}`;
      console.log(`[WebSocket] 用户 ${user.username} 订阅频道: ${channel}`);
    }
  }

  private handleUnsubscribe(ws: WebSocket, channel: string): void {
    const user = this.userConnections.get(ws);
    
    if (user) {
      console.log(`[WebSocket] 用户 ${user.username} 取消订阅频道: ${channel}`);
    }
  }

  private handleDisconnect(ws: WebSocket): void {
    const user = this.userConnections.get(ws);

    if (user) {
      const userClients = this.clients.get(user.userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          this.clients.delete(user.userId);
          
          this.broadcastToRole('admin', {
            type: WebSocketEvent.USER_OFFLINE,
            data: { userId: user.userId, username: user.username },
            timestamp: new Date().toISOString()
          }).catch(console.error);

          console.log(`[WebSocket] 用户离线: ${user.username}`);
        }
      }
      this.userConnections.delete(ws);
    }

    const interval = this.heartbeatIntervals.get(ws);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(ws);
    }
  }

  private startHeartbeat(ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        
        const pingTimeout = setTimeout(() => {
          ws.terminate();
        }, 30000);
        
        ws.once('pong', () => {
          clearTimeout(pingTimeout);
        });
      } else {
        clearInterval(interval);
      }
    }, 30000);

    this.heartbeatIntervals.set(ws, interval);
  }

  async sendToUser(userId: string, message: PushMessage): Promise<boolean> {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.size === 0) {
      console.log(`[WebSocket] 用户 ${userId} 当前不在线`);
      await this.cacheOfflineMessage(userId, message);
      return false;
    }

    const payload = JSON.stringify(message);
    let sent = 0;

    userClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        sent++;
      }
    });

    if (sent === 0) {
      await this.cacheOfflineMessage(userId, message);
    }

    console.log(`[WebSocket] 向用户 ${userId} 发送消息，发送了 ${sent}/${userClients.size} 个连接`);
    return sent > 0;
  }

  private shouldCacheOfflineMessage(message: PushMessage): boolean {
    return message.type !== WebSocketEvent.USER_ONLINE && message.type !== WebSocketEvent.USER_OFFLINE;
  }

  private async cacheOfflineMessage(userId: string, message: PushMessage): Promise<void> {
    if (!this.shouldCacheOfflineMessage(message)) return;
    const redis = redisService.getClient();
    if (!redisService.isConnected() || !redis) return;

    try {
      const cacheKey = `ws:offline:${userId}`;
      await redis.lpush(cacheKey, JSON.stringify(message));
      await redis.ltrim(cacheKey, 0, 99);
      await redis.expire(cacheKey, 300);
      console.log(`[WebSocket] 用户 ${userId} 离线，消息已缓存`);
    } catch (error) {
      console.warn('[WebSocket] 缓存离线消息失败:', error);
    }
  }

  async flushOfflineMessages(userId: string): Promise<void> {
    const redis = redisService.getClient();
    if (!redisService.isConnected() || !redis) return;

    const cacheKey = `ws:offline:${userId}`;
    try {
      const messages = await redis.lrange(cacheKey, 0, -1);
      if (!messages.length) return;
      for (const raw of messages.reverse()) {
        try {
          await this.sendToUser(userId, JSON.parse(raw));
        } catch (error) {
          console.warn('[WebSocket] 投递离线消息失败:', error);
        }
      }
      await redis.del(cacheKey);
    } catch (error) {
      console.warn('[WebSocket] 刷新离线消息失败:', error);
    }
  }


  async broadcast(message: PushMessage, excludeUserId?: string): Promise<void> {
    const payload = JSON.stringify(message);
    let sent = 0;

    this.clients.forEach((wsSet, userId) => {
      if (excludeUserId && userId === excludeUserId) {
        return;
      }

      wsSet.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
          sent++;
        }
      });
    });

    console.log(`[WebSocket] 广播消息到 ${sent} 个连接`);
  }

  async broadcastToRole(role: string, message: PushMessage): Promise<void> {
    const payload = JSON.stringify(message);
    let sent = 0;

    this.userConnections.forEach((user, ws) => {
      if (user.role === role && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        sent++;
      }
    });

    console.log(`[WebSocket] 向角色 ${role} 广播消息，发送了 ${sent} 个连接`);
  }

  async notifyTaskProgress(userId: string, taskId: string, progress: number, meta?: { type?: string; provider?: string; prompt?: string }): Promise<void> {
    await this.sendToUser(userId, {
      type: WebSocketEvent.TASK_PROGRESS,
      data: { taskId, progress, ...meta },
      timestamp: new Date().toISOString(),
      userId
    });
  }

  async notifyTaskComplete(userId: string, taskId: string, result: any, meta?: { type?: string; provider?: string; prompt?: string }): Promise<void> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, userId: true, type: true, status: true },
    });

    await this.broadcastToRole('admin', {
      type: WebSocketEvent.ADMIN_TASK_UPDATED,
      data: { taskId, status: 'completed', result, ...meta },
      timestamp: new Date().toISOString(),
      userId,
    });

    void task; // 任务查询保留以兼容原逻辑，审核门控已移除

    await this.sendToUser(userId, {
      type: WebSocketEvent.TASK_COMPLETE,
      data: { taskId, result, ...meta },
      timestamp: new Date().toISOString(),
      userId
    });

    await loggingService.logUserAction(userId, 'websocket_notify', taskId, {
      event: 'task_complete',
      taskId
    });
  }

  async notifyTaskReviewRejected(userId: string, taskId: string, note?: string): Promise<void> {
    await this.sendToUser(userId, {
      type: WebSocketEvent.TASK_REVIEW_REJECTED,
      data: { taskId, status: 'rejected', resultAvailable: false, message: note || '内容未通过审核' },
      timestamp: new Date().toISOString(),
      userId,
    });
  }

  async notifyTaskFailed(userId: string, taskId: string, error: string, meta?: { type?: string; provider?: string; prompt?: string }): Promise<void> {
    await this.sendToUser(userId, {
      type: WebSocketEvent.TASK_FAILED,
      data: { taskId, error, ...meta },
      timestamp: new Date().toISOString(),
      userId
    });

    await loggingService.logUserAction(userId, 'websocket_notify', taskId, {
      event: 'task_failed',
      taskId,
      error
    });
  }

  async notifyNewNotification(userId: string, notification: any): Promise<void> {
    await this.sendToUser(userId, {
      type: WebSocketEvent.NOTIFICATION,
      data: notification,
      timestamp: new Date().toISOString(),
      userId
    });
  }

  async notifyQuotaWarning(userId: string, usage: number, limit: number, percentage: number): Promise<void> {
    await this.sendToUser(userId, {
      type: WebSocketEvent.QUOTA_WARNING,
      data: { usage, limit, percentage },
      timestamp: new Date().toISOString(),
      userId
    });
  }

  async notifyPaymentStatus(userId: string, orderId: string, status: string): Promise<void> {
    await this.sendToUser(userId, {
      type: WebSocketEvent.PAYMENT_STATUS,
      data: { orderId, status },
      timestamp: new Date().toISOString(),
      userId
    });
  }

  async notifySystemAlert(alert: { level: string; message: string; details?: any }): Promise<void> {
    await this.broadcast({
      type: WebSocketEvent.SYSTEM_ALERT,
      data: alert,
      timestamp: new Date().toISOString()
    });
  }

  getOnlineUsers(): { userId: string; username: string; role: string }[] {
    const usersById = new Map<string, { userId: string; username: string; role: string }>();
    
    this.userConnections.forEach((user) => {
      usersById.set(user.userId, {
        userId: user.userId,
        username: user.username,
        role: user.role
      });
    });

    return Array.from(usersById.values());
  }

  getConnectionStats(): {
    totalConnections: number;
    onlineUsers: number;
    connectionsByUser: Record<string, number>;
  } {
    const connectionsByUser: Record<string, number> = {};
    let totalConnections = 0;

    this.clients.forEach((wsSet, userId) => {
      const count = wsSet.size;
      connectionsByUser[userId] = count;
      totalConnections += count;
    });

    return {
      totalConnections,
      onlineUsers: this.clients.size,
      connectionsByUser
    };
  }

  async destroy(): Promise<void> {
    this.heartbeatIntervals.forEach((interval) => clearInterval(interval));
    this.heartbeatIntervals.clear();

    if (this.wss) {
      this.wss.clients.forEach((client) => {
        client.close();
      });
      this.wss.close();
    }

    this.clients.clear();
    this.userConnections.clear();
    this.server = null;
    
    console.log('[WebSocket] WebSocket服务已销毁');
  }
}

export const websocketPushService = new WebSocketPushService();
