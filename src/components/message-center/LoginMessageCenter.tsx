import React, { useEffect, useState } from 'react';
import MessageCenterPanel from './MessageCenterPanel';
import {
  fetchPublicSiteMessages,
  markAllSiteMessagesRead,
  markSiteMessageRead,
  type SiteMessage,
} from '@/services/site-message-service';
import './message-center.css';

interface LoginMessageCenterProps {
  isOpen: boolean;
}

/** 登录弹窗右侧消息中心 */
const LoginMessageCenter: React.FC<LoginMessageCenterProps> = ({ isOpen }) => {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<SiteMessage[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const list = await fetchPublicSiteMessages(true);
        if (!cancelled) setMessages(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleMarkRead = async (id: string) => {
    await markSiteMessageRead(id);
    setMessages((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  };

  const handleMarkAllRead = async () => {
    await markAllSiteMessagesRead();
    setMessages((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  return (
    <aside className="msg-center-login-side hidden lg:flex">
      <MessageCenterPanel
        theme="light"
        title="消息中心"
        messages={messages}
        loading={loading}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        className="h-full"
      />
    </aside>
  );
};

export default LoginMessageCenter;
