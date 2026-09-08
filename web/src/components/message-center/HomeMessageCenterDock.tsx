import React, { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import MessageCenterPanel from './MessageCenterPanel';
import {
  fetchPublicSiteMessages,
  getUnreadSiteMessageCount,
  markAllSiteMessagesRead,
  markSiteMessageRead,
  type SiteMessage,
} from '@/services/site-message-service';
import './message-center.css';

/** 首页右侧消息中心（未登录可见公共消息） */
const HomeMessageCenterDock: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<SiteMessage[]>([]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchPublicSiteMessages();
      setMessages(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 60000);
    return () => window.clearInterval(timer);
  }, [loadMessages]);

  const unreadCount = getUnreadSiteMessageCount(messages);

  const handleMarkRead = async (id: string) => {
    await markSiteMessageRead(id);
    setMessages((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  };

  const handleMarkAllRead = async () => {
    await markAllSiteMessagesRead();
    setMessages((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  return (
    <div className="msg-center-dock">
      <button
        type="button"
        className="msg-center-dock__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="打开消息中心"
      >
        <Bell size={14} />
        <span>消息中心</span>
        {unreadCount > 0 && <span className="msg-center-dock__toggle-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="msg-center-dock__panel">
          <MessageCenterPanel
            messages={messages}
            loading={loading}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
          />
        </div>
      )}
    </div>
  );
};

export default HomeMessageCenterDock;
