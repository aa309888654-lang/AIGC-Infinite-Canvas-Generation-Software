import React from 'react';
import { Bell, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SiteMessage } from '@/services/site-message-service';
import './message-center.css';

const typeLabels: Record<string, string> = {
  system: '系统',
  promotion: '活动',
  update: '更新',
  notice: '公告',
};

const priorityClass: Record<string, string> = {
  high: 'msg-center-item--high',
  normal: 'msg-center-item--normal',
  low: 'msg-center-item--low',
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

interface MessageCenterPanelProps {
  messages: SiteMessage[];
  loading?: boolean;
  title?: string;
  compact?: boolean;
  theme?: 'dark' | 'light';
  emptyText?: string;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  className?: string;
}

const MessageCenterPanel: React.FC<MessageCenterPanelProps> = ({
  messages,
  loading = false,
  title = '消息中心',
  compact = false,
  theme = 'dark',
  emptyText = '暂无消息',
  onMarkRead,
  onMarkAllRead,
  className,
}) => {
  const unreadCount = messages.filter((m) => !m.isRead).length;

  return (
    <div className={cn('msg-center-panel', `msg-center-panel--${theme}`, compact && 'msg-center-panel--compact', className)}>
      <div className="msg-center-panel__header">
        <div className="msg-center-panel__title-wrap">
          <Bell size={compact ? 14 : 16} />
          <span>{title}</span>
          {unreadCount > 0 && <span className="msg-center-panel__badge">{unreadCount}</span>}
        </div>
        {unreadCount > 0 && onMarkAllRead && (
          <button type="button" className="msg-center-panel__mark-all" onClick={onMarkAllRead}>
            全部已读
          </button>
        )}
      </div>

      <div className="msg-center-panel__list">
        {loading ? (
          <div className="msg-center-panel__empty">
            <Loader2 size={18} className="animate-spin" />
            <span>加载中...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="msg-center-panel__empty">
            <Bell size={24} className="opacity-30" />
            <span>{emptyText}</span>
          </div>
        ) : (
          messages.map((message) => (
            <button
              key={message.id}
              type="button"
              className={cn(
                'msg-center-item',
                priorityClass[message.priority] || priorityClass.normal,
                !message.isRead && 'msg-center-item--unread',
              )}
              onClick={() => {
                if (!message.isRead) onMarkRead?.(message.id);
              }}
            >
              <div className="msg-center-item__top">
                <span className="msg-center-item__title">{message.title}</span>
                {!message.isRead && <span className="msg-center-item__dot" />}
              </div>
              <p className="msg-center-item__content">{message.content}</p>
              <div className="msg-center-item__meta">
                <span>{formatTime(message.createdAt)}</span>
                <span>{typeLabels[message.type] || message.type}</span>
                {message.linkUrl && (
                  <a
                    href={message.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="msg-center-item__link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {message.linkLabel || '查看详情'}
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default MessageCenterPanel;
