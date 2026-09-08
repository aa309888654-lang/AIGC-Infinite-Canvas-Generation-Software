import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  conversationFindUnique: vi.fn(),
  messageFindMany: vi.fn(),
  messageUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../middleware/auth', () => ({
  authenticate: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireAdmin: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../lib/prisma', () => ({
  default: {
    chatConversation: { findUnique: mocks.conversationFindUnique },
    chatMessage: {
      findMany: mocks.messageFindMany,
      updateMany: mocks.messageUpdateMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../services/websocket-push-service', () => ({
  websocketPushService: { sendToUser: vi.fn() },
  WebSocketEvent: { CHAT_MESSAGE_NEW: 'chat:message:new' },
}));

vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn() },
}));

import adminChatRouter from './admin-chat';

describe('admin chat unread state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.conversationFindUnique.mockResolvedValue({
      id: 'conversation-1',
      userId: 'user-1',
      subject: '帮助',
      status: 'active',
      user: { id: 'user-1', username: 'tester', avatar: null },
    });
    mocks.messageFindMany.mockResolvedValue([{
      id: 'message-1',
      content: '你好',
      senderType: 'user',
      senderId: 'user-1',
      createdAt: new Date('2026-07-20T00:00:00Z'),
      isRead: false,
    }]);
    mocks.messageUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
  });

  it('marks user messages read when an administrator opens the conversation', async () => {
    const app = express();
    app.use('/admin/chat', adminChatRouter);

    const response = await request(app).get('/admin/chat/conversations/conversation-1/messages');

    expect(response.status).toBe(200);
    expect(mocks.messageUpdateMany).toHaveBeenCalledWith({
      where: { conversationId: 'conversation-1', senderType: 'user', isRead: false },
      data: { isRead: true },
    });
    expect(response.body.data.messages[0].isRead).toBe(true);
  });
});
