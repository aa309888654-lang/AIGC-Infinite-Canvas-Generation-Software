import { apiClient } from '@/lib/api-client';

export interface ConversationInfo {
  id: string;
  userId: string;
  status: string;
  lastMessageAt: string;
  createdAt: string;
  unreadAdminCount: number;
  user: { id: string; username: string; email: string; avatar: string | null };
  messages: { content: string; senderType: string; createdAt: string }[];
}

export interface ChatMsg {
  id: string;
  senderType: 'user' | 'admin';
  senderId: string | null;
  content: string;
  createdAt: string;
  isRead: boolean;
}

export interface ChatStats {
  totalConversations: number;
  activeConversations: number;
  unreadUserMessages: number;
}

class AdminChatService {
  getConversations(page: number, pageSize = 20): Promise<{
    success: boolean;
    data: {
      conversations: ConversationInfo[];
      pagination: { totalPages: number; total: number; page: number; pageSize: number };
    };
  }> {
    return apiClient.get(`/admin/chat/conversations?page=${page}&pageSize=${pageSize}`, { maxRetries: 0 });
  }

  getStats(): Promise<{ success: boolean; data: ChatStats }> {
    return apiClient.get('/admin/chat/stats', { maxRetries: 0 });
  }

  getMessages(convId: string): Promise<{ success: boolean; data: { messages: ChatMsg[] } }> {
    return apiClient.get(`/admin/chat/conversations/${convId}/messages`, { maxRetries: 0 });
  }

  reply(convId: string, content: string): Promise<{ success: boolean; message?: string }> {
    return apiClient.post(`/admin/chat/conversations/${convId}/reply`, { content }, { maxRetries: 0 });
  }

  updateStatus(convId: string, status: string): Promise<{ success: boolean }> {
    return apiClient.patch(`/admin/chat/conversations/${convId}/status`, { status }, { maxRetries: 0 });
  }
}

export const adminChatService = new AdminChatService();
