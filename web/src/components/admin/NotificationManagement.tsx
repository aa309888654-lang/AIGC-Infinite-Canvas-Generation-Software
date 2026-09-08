import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Loader2, Trash2, CheckCircle, XCircle, Mail, AlertCircle, Gift, Plus, Send, X, Sparkles, Eye, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { notificationService, Notification, NotificationStats } from '@/services/admin/notification-service';
import { useToast } from './shared/AdminToast';
import Pagination from './shared/Pagination';
import { NOTIFICATION_TEMPLATES, TEMPLATE_CATEGORIES, NotificationTemplate } from '@/config/notification-templates';

type TabId = 'list' | 'templates';

const NotificationManagement: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [isReadFilter, setIsReadFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 15;
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('list');
  const [templateCategory, setTemplateCategory] = useState('all');

  const [showSendForm, setShowSendForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendForm, setSendForm] = useState({
    title: '',
    content: '',
    type: 'system',
    priority: 'normal',
    userId: '',
  });

  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [notifRes, statsRes] = await Promise.all([
        notificationService.getNotifications({
          page: currentPage,
          pageSize,
          type: typeFilter === 'all' ? undefined : typeFilter,
          isRead: isReadFilter === 'read' ? true : undefined,
        }),
        notificationService.getNotificationStats()
      ]);

      const notifList = notifRes.data || notifRes.notifications || [];
      const pagination = notifRes.meta || notifRes.pagination || { total: 0, totalPages: 1 };
      setNotifications(notifList);
      setStats((statsRes as any as Record<string, unknown>).data as any as NotificationStats || statsRes as any as NotificationStats);
      setTotalPages(Math.ceil(pagination.total / pageSize) || 1);
      setTotal(pagination.total || 0);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to fetch notifications');
      showToast('Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, typeFilter, isReadFilter, showToast]);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchData();
    }
  }, [fetchData, activeTab]);

  const typeConfig: Record<string, { label: string; color: string; icon: typeof Bell; bgClass: string; badgeClass: string }> = {
    system: { label: '系统', color: 'text-gray-400', icon: AlertCircle, bgClass: 'bg-gray-500/15', badgeClass: 'bg-gray-500/20 text-gray-400 border-gray-500/20' },
    task: { label: '任务', color: 'text-purple-400', icon: Bell, bgClass: 'bg-purple-500/15', badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/20' },
    payment: { label: '支付', color: 'text-green-400', icon: Gift, bgClass: 'bg-green-500/15', badgeClass: 'bg-green-500/20 text-green-400 border-green-500/20' },
    membership: { label: '会员', color: 'text-yellow-400', icon: CheckCircle, bgClass: 'bg-yellow-500/15', badgeClass: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20' },
    promotion: { label: '推广', color: 'text-pink-400', icon: Mail, bgClass: 'bg-pink-500/15', badgeClass: 'bg-pink-500/20 text-pink-400 border-pink-500/20' },
  };

  const priorityConfig: Record<string, { label: string; color: string }> = {
    high: { label: '高', color: 'text-red-400 bg-red-500/15 border-red-500/20' },
    normal: { label: '普通', color: 'text-blue-400 bg-blue-500/15 border-blue-500/20' },
    low: { label: '低', color: 'text-gray-400 bg-gray-500/15 border-gray-500/20' },
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const res = await notificationService.markAsRead(notificationId);
      if (res) {
        showToast('Marked as read', 'success');
        fetchData();
      }
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to mark as read', 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await notificationService.markAllAsRead();
      if (res) {
        showToast('All marked as read', 'success');
        fetchData();
      }
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to mark all as read', 'error');
    }
  };

  const handleDelete = async (notificationId: string) => {
    if (!confirm('确定要删除这条通知吗？')) return;

    try {
      const res = await notificationService.deleteNotification(notificationId);
      if (res) {
        showToast('已删除', 'success');
        fetchData();
      }
    } catch (err: unknown) {
      showToast((err as Error).message || '删除失败', 'error');
    }
  };

  const handleSendNotification = async () => {
    if (!sendForm.title.trim() || !sendForm.content.trim()) {
      showToast('标题和内容不能为空', 'error');
      return;
    }
    try {
      setSending(true);
      const res = await notificationService.sendNotification({
        title: sendForm.title.trim(),
        content: sendForm.content.trim(),
        type: sendForm.type,
        priority: sendForm.priority,
        userId: sendForm.userId.trim() || undefined,
      });
      if (res.success) {
        showToast(sendForm.userId.trim() ? '通知发送成功' : '广播通知发送成功', 'success');
        setSendForm({ title: '', content: '', type: 'system', priority: 'normal', userId: '' });
        setShowSendForm(false);
        fetchData();
      }
    } catch (err: unknown) {
      showToast((err as Error).message || '发送失败', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleUseTemplate = (template: NotificationTemplate) => {
    setSendForm({
      title: template.title,
      content: template.content,
      type: template.type,
      priority: template.priority,
      userId: '',
    });
    setShowSendForm(true);
    setPreviewTemplate(null);
  };

  const handlePreviewTemplate = (template: NotificationTemplate) => {
    setPreviewTemplate(template);
  };

  const filteredTemplates = templateCategory === 'all'
    ? NOTIFICATION_TEMPLATES
    : NOTIFICATION_TEMPLATES.filter(t => t.category === templateCategory);

  const tabs = [
    { id: 'list' as TabId, label: '通知列表', icon: Bell },
    { id: 'templates' as TabId, label: '通知模版', icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-500/20 rounded-lg">
                <Bell className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">总计</p>
                <p className="text-white text-xl font-bold">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">未读</p>
                <p className="text-white text-xl font-bold">{stats.unread}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">通知类型</p>
                <p className="text-white text-xl font-bold">{Object.keys(stats.byType || {}).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/20 rounded-lg">
                <Sparkles className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">可用模版</p>
                <p className="text-white text-xl font-bold">{NOTIFICATION_TEMPLATES.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 bg-[#1A1A1E] rounded-xl border border-white/10 p-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'list' && (
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10">
          <div className="p-4 border-b border-white/10 flex flex-wrap items-center gap-4 justify-between">
            <div className="flex flex-wrap gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2 bg-[#0B0B0E] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500/50"
              >
                <option value="all">全部类型</option>
                <option value="system">系统</option>
                <option value="task">任务</option>
                <option value="payment">支付</option>
                <option value="membership">会员</option>
                <option value="promotion">推广</option>
              </select>
              <select
                value={isReadFilter}
                onChange={(e) => setIsReadFilter(e.target.value)}
                className="px-4 py-2 bg-[#0B0B0E] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500/50"
              >
                <option value="all">全部状态</option>
                <option value="unread">未读</option>
                <option value="read">已读</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleMarkAllAsRead}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
              >
                全部已读
              </button>
              <button
                onClick={() => setShowSendForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                发送通知
              </button>
            </div>
          </div>

          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
              <p className="text-gray-400 text-sm">加载通知中...</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-white/5">
                {notifications.map((notification) => {
                  const type = typeConfig[notification.type] || typeConfig.system;
                  const TypeIcon = type.icon;
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-4 hover:bg-white/5 transition-colors',
                        !notification.isRead && 'bg-gray-500/5'
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn('p-2 rounded-lg shrink-0', type.bgClass)}>
                          <TypeIcon className={cn('w-4 h-4', type.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <h3 className={cn('text-sm font-medium', notification.isRead ? 'text-gray-300' : 'text-white')}>
                                {notification.title}
                              </h3>
                              <span className={cn('px-2 py-0.5 rounded-full text-xs border', type.badgeClass)}>
                                {type.label}
                              </span>
                              {!notification.isRead && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 animate-pulse" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-gray-500 text-xs">
                                {new Date(notification.createdAt).toLocaleDateString()}
                              </span>
                              {!notification.isRead && (
                                <button
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-green-400"
                                  title="标记已读"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(notification.id)}
                                className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <p className="mt-1 text-gray-400 text-sm line-clamp-2">{notification.content}</p>
                          {notification.username && (
                            <p className="mt-1 text-gray-500 text-xs">用户: {notification.username}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 border-t border-white/10">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  total={total}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setTemplateCategory(cat.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                  templateCategory === cat.key
                    ? 'bg-white/10 text-white border-white/20 shadow-sm'
                    : 'bg-[#1A1A1E] text-gray-400 border-white/10 hover:text-white hover:border-white/20'
                )}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className={cn(
                  'relative overflow-hidden rounded-2xl border bg-[#1A1A1E] transition-all duration-300',
                  'hover:scale-[1.02] hover:shadow-2xl group',
                  template.borderColor,
                  template.glowColor
                )}
              >
                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-40 pointer-events-none', template.gradient)} />

                <div className="relative p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
                        'bg-white/5 border border-white/10 backdrop-blur-sm'
                      )}>
                        {template.icon}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-base">{template.name}</h3>
                        <p className="text-gray-400 text-xs mt-0.5">{template.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <span className={cn(
                        'px-2 py-0.5 rounded-md text-[10px] font-medium border',
                        (typeConfig[template.type] || typeConfig.system).badgeClass
                      )}>
                        {(typeConfig[template.type] || typeConfig.system).label}
                      </span>
                      <span className={cn(
                        'px-2 py-0.5 rounded-md text-[10px] font-medium border',
                        priorityConfig[template.priority]?.color || priorityConfig.normal.color
                      )}>
                        {priorityConfig[template.priority]?.label || '普通'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-black/30 rounded-xl border border-white/5 p-3 backdrop-blur-sm">
                    <p className="text-white/80 text-sm font-medium line-clamp-1">
                      {template.title}
                    </p>
                    <p className="text-gray-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                      {template.content.replace(/\n\n/g, ' ').replace(/\n/g, ' ')}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePreviewTemplate(template)}
                      className={cn(
                        'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                        'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      预览
                    </button>
                    <button
                      onClick={() => handleUseTemplate(template)}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex-1 justify-center',
                        'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20'
                      )}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      使用模版
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreviewTemplate(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] bg-[#1A1A1E] border border-white/10 rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-[#0d0d0d] border-b border-white/5 relative">
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl bg-white/10 backdrop-blur-sm border border-white/10">
                    {previewTemplate.icon}
                  </div>
                  <div>
                    <h2 className="text-white text-lg font-bold">{previewTemplate.name}</h2>
                    <p className="text-gray-300 text-sm">{previewTemplate.description}</p>
                  </div>
                </div>
                <button onClick={() => setPreviewTemplate(null)} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[55vh]">
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  <span className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium border',
                    (typeConfig[previewTemplate.type] || typeConfig.system).badgeClass
                  )}>
                    {(typeConfig[previewTemplate.type] || typeConfig.system).label}
                  </span>
                  <span className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium border',
                    priorityConfig[previewTemplate.priority]?.color || priorityConfig.normal.color
                  )}>
                    优先级: {priorityConfig[previewTemplate.priority]?.label || '普通'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-gray-400 text-xs mb-2 tracking-wide uppercase">通知标题</p>
                <div className="bg-[#0B0B0E] rounded-xl border border-white/10 p-4">
                  <p className="text-white text-base font-semibold">{previewTemplate.title}</p>
                </div>
              </div>

              <div>
                <p className="text-gray-400 text-xs mb-2 tracking-wide uppercase">通知内容</p>
                <div className="bg-[#0B0B0E] rounded-xl border border-white/10 p-4 max-h-64 overflow-y-auto">
                  <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">{previewTemplate.content}</pre>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-[#0B0B0E]/50">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm rounded-lg transition-colors"
              >
                关闭
              </button>
              <button
                onClick={() => handleUseTemplate(previewTemplate)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-cyan-500/20"
              >
                <Zap className="w-4 h-4" />
                使用此模版发送
              </button>
            </div>
          </div>
        </div>
      )}

      {showSendForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSendForm(false)}>
          <div className="w-full max-w-lg bg-[#1A1A1E] border border-white/10 rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                <Send className="w-5 h-5 text-cyan-400" />
                发送通知
              </h2>
              <button onClick={() => setShowSendForm(false)} className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">标题 *</label>
                <input
                  value={sendForm.title}
                  onChange={e => setSendForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="通知标题"
                  className="w-full px-3 py-2 bg-[#0B0B0E] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">内容 *</label>
                <textarea
                  value={sendForm.content}
                  onChange={e => setSendForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="通知内容"
                  rows={5}
                  className="w-full px-3 py-2 bg-[#0B0B0E] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 resize-none transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">类型</label>
                  <select
                    value={sendForm.type}
                    onChange={e => setSendForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#0B0B0E] border border-white/10 rounded-lg text-white text-sm focus:outline-none transition-colors"
                  >
                    <option value="system">系统</option>
                    <option value="task">任务</option>
                    <option value="payment">支付</option>
                    <option value="membership">会员</option>
                    <option value="promotion">推广</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">优先级</label>
                  <select
                    value={sendForm.priority}
                    onChange={e => setSendForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#0B0B0E] border border-white/10 rounded-lg text-white text-sm focus:outline-none transition-colors"
                  >
                    <option value="low">低</option>
                    <option value="normal">普通</option>
                    <option value="high">高</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">目标用户ID（留空则广播全体）</label>
                <input
                  value={sendForm.userId}
                  onChange={e => setSendForm(f => ({ ...f, userId: e.target.value }))}
                  placeholder="用户ID，留空则发送给所有用户"
                  className="w-full px-3 py-2 bg-[#0B0B0E] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSendForm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSendNotification}
                disabled={sending}
                className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-cyan-500/20"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? '发送中...' : '发送'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManagement;