import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Send, Clock, CheckCheck, User, Search, RefreshCw, XCircle } from 'lucide-react';
import { adminChatService, type ChatMsg, type ConversationInfo } from '@/services/admin';
import { webSocketService } from '@/lib/api-core/websocket-service';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) return `今天 ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${time}`;
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`;
}

export default function ChatManagement() {
  const [conversations, setConversations] = useState<ConversationInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [replyInput, setReplyInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ totalConversations: 0, activeConversations: 0, unreadUserMessages: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminChatService.getConversations(page, 20);
      if (data.success) {
        setConversations(data.data.conversations);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch { /* ignored */ } finally {
      setLoading(false);
    }
  }, [page]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await adminChatService.getStats();
      if (data.success) setStats(data.data);
    } catch { /* ignored */ }
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    setMsgLoading(true);
    try {
      const data = await adminChatService.getMessages(convId);
      if (data.success) {
        setMessages(data.data.messages);
      }
    } catch { /* ignored */ } finally {
      setMsgLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchStats();
  }, [fetchConversations, fetchStats]);

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
    }
  }, [selectedId, fetchMessages]);

  useEffect(() => {
    if (selectedId) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        fetchMessages(selectedId);
        fetchConversations();
        fetchStats();
      }, 5000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [selectedId, fetchMessages, fetchConversations, fetchStats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 实时接收新消息推送（保留轮询兜底）
  useEffect(() => {
    const handler = (msg: { data?: { conversationId?: string; from?: string } }) => {
      const data = msg?.data;
      fetchConversations();
      fetchStats();
      if (data?.conversationId && data.conversationId === selectedIdRef.current) {
        fetchMessages(data.conversationId);
      }
    };
    const unsub = webSocketService.subscribe('chat:message:new', handler as any);
    return () => {
      unsub();
    };
  }, [fetchConversations, fetchStats, fetchMessages]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const sendReply = async () => {
    const text = replyInput.trim();
    if (!text || sending || !selectedId) return;
    setSending(true);
    try {
      const data = await adminChatService.reply(selectedId, text);
      if (data.success) {
        setReplyInput('');
        fetchMessages(selectedId);
        fetchConversations();
        fetchStats();
      } else {
        alert(data.message || '回复失败');
      }
    } catch (error) {
      console.error('回复失败:', error);
      alert('回复失败，请稍后重试');
    } finally {
      setSending(false);
    }
  };

  const toggleStatus = async (convId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'closed' : 'active';
    try {
      const data = await adminChatService.updateStatus(convId, newStatus);
      if (data.success) {
        fetchConversations();
        fetchStats();
      }
    } catch { /* ignored */ }
  };

  const filteredConversations = conversations.filter(c =>
    !searchQuery ||
    c.user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.messages?.[0]?.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConv = conversations.find(c => c.id === selectedId);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-4">
      <div className="flex gap-4 flex-wrap">
        {[
          { label: '总会话', value: stats.totalConversations, color: '#00D4FF', icon: MessageSquare },
          { label: '活跃会话', value: stats.activeConversations, color: '#00FFA3', icon: Clock },
          { label: '未读消息', value: stats.unreadUserMessages, color: '#f59e0b', icon: CheckCheck },
        ].map(s => (
          <div key={s.label} className="flex-1 min-w-[160px] p-4 rounded-xl border flex items-center gap-3" style={{ background: 'rgba(15, 23, 42, 0.6)', borderColor: `${s.color}33` }}>
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ background: `${s.color}15`, border: `1px solid ${s.color}30` }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <div className="text-xs text-gray-400">{s.label}</div>
              <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        <div className="w-80 flex flex-col rounded-xl overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(0, 212, 255, 0.15)' }}>
          <div className="px-3.5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(0, 212, 255, 0.1)' }}>
            <Search size={14} color="#64748b" />
            <input
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索用户/消息..."
              className="flex-1 bg-transparent border-none text-gray-200 text-[13px] outline-none"
            />
            <button onClick={() => { fetchConversations(); fetchStats(); }} className="bg-transparent border-none cursor-pointer p-1">
              <RefreshCw size={14} color="#64748b" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-6 text-center text-gray-500 text-[13px]">加载中...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-6 text-center text-gray-500 text-[13px]">暂无会话</div>
            ) : (
              filteredConversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className="px-3.5 py-3 cursor-pointer border-b transition-colors"
                  style={{
                    borderColor: 'rgba(0, 212, 255, 0.06)',
                    background: selectedId === conv.id ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (selectedId !== conv.id) e.currentTarget.style.background = 'rgba(0, 212, 255, 0.04)'; }}
                  onMouseLeave={e => { if (selectedId !== conv.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(0, 212, 255, 0.15)', border: '1px solid rgba(0, 212, 255, 0.3)' }}>
                        <User size={13} color="#00D4FF" />
                      </div>
                      <span className="text-gray-200 text-[13px] font-medium">{conv.user?.username || conv.user?.email || '未知用户'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {conv.unreadAdminCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-[1px] rounded-lg min-w-[16px] text-center">{conv.unreadAdminCount}</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${conv.status === 'active' ? 'text-green-400 bg-green-400/10 border border-green-400/20' : 'text-gray-500 bg-gray-500/10 border border-gray-500/20'}`}>
                        {conv.status === 'active' ? '活跃' : '已关闭'}
                      </span>
                    </div>
                  </div>
                  {conv.messages?.[0] && (
                    <div className="text-[12px] text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap pl-9">
                      {conv.messages[0].content}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-600 pl-9 mt-0.5">
                    {formatTime(conv.lastMessageAt)}
                  </div>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="px-3.5 py-2 border-t flex justify-center gap-2" style={{ borderColor: 'rgba(0, 212, 255, 0.1)' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-2.5 py-1 rounded-md border text-[12px] transition-colors" style={{ borderColor: 'rgba(0, 212, 255, 0.2)', background: page <= 1 ? 'rgba(30, 41, 59, 0.3)' : 'rgba(0, 212, 255, 0.1)', color: page <= 1 ? '#475569' : '#00D4FF', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>
                上一页
              </button>
              <span className="text-gray-400 text-[12px] leading-7">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-2.5 py-1 rounded-md border text-[12px] transition-colors" style={{ borderColor: 'rgba(0, 212, 255, 0.2)', background: page >= totalPages ? 'rgba(30, 41, 59, 0.3)' : 'rgba(0, 212, 255, 0.1)', color: page >= totalPages ? '#475569' : '#00D4FF', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>
                下一页
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col rounded-xl overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(0, 212, 255, 0.15)' }}>
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
              <MessageSquare size={40} strokeWidth={1} />
              <div className="text-sm">选择左侧会话查看聊天记录</div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(0, 212, 255, 0.1)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0, 212, 255, 0.15)', border: '1px solid rgba(0, 212, 255, 0.3)' }}>
                    <User size={15} color="#00D4FF" />
                  </div>
                  <div>
                    <div className="text-gray-200 text-sm font-medium">{selectedConv?.user?.username || selectedConv?.user?.email || '未知用户'}</div>
                    <div className="text-gray-500 text-[11px]">{selectedConv?.user?.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => selectedConv && toggleStatus(selectedConv.id, selectedConv.status)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] cursor-pointer transition-all"
                  style={{
                    background: selectedConv?.status === 'active' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 255, 163, 0.1)',
                    border: `1px solid ${selectedConv?.status === 'active' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0, 255, 163, 0.25)'}`,
                    color: selectedConv?.status === 'active' ? '#ef4444' : '#00FFA3',
                  }}
                >
                  {selectedConv?.status === 'active' ? <><XCircle size={13} /> 关闭会话</> : <><Clock size={13} /> 重新开启</>}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3.5 flex flex-col gap-2.5">
                {msgLoading ? (
                  <div className="text-center text-gray-500 text-[13px] py-6">加载中...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500 text-[13px] py-6">暂无消息</div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.senderType === 'user' ? 'justify-start' : 'justify-end'}`}>
                      <div className="max-w-[70%]">
                        <div className={`text-[10px] mb-0.5 mx-1 ${msg.senderType === 'user' ? 'text-cyan-400 text-left' : 'text-green-400 text-right'}`}>
                          {msg.senderType === 'user' ? '用户' : '客服'}
                        </div>
                        <div
                          className="px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                          style={{
                            borderRadius: msg.senderType === 'user' ? '2px 12px 12px 12px' : '12px 2px 12px 12px',
                            background: msg.senderType === 'user' ? 'rgba(0, 212, 255, 0.08)' : 'rgba(0, 255, 163, 0.08)',
                            border: `1px solid ${msg.senderType === 'user' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0, 255, 163, 0.2)'}`,
                            color: msg.senderType === 'user' ? '#c0e0f0' : '#d0f0e0',
                          }}
                        >
                          {msg.content}
                        </div>
                        <div className={`text-[10px] text-gray-600 mt-0.5 mx-1 ${msg.senderType === 'user' ? 'text-left' : 'text-right'}`}>
                          {formatTime(msg.createdAt)}
                          {!msg.isRead && msg.senderType === 'user' && <span className="text-amber-500 ml-1.5">未读</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-4 py-3 flex gap-2 border-t" style={{ borderColor: 'rgba(0, 212, 255, 0.1)' }}>
                <input
                  value={replyInput} onChange={e => setReplyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  placeholder="输入回复内容..."
                  className="flex-1 px-3.5 py-2.5 rounded-lg border bg-[#0a0e1a]/80 text-gray-200 text-[13px] outline-none transition-colors focus:border-green-400/50"
                  style={{ borderColor: 'rgba(0, 255, 163, 0.2)' }}
                />
                <button
                  onClick={sendReply} disabled={sending || !replyInput.trim()}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-lg border text-[13px] font-medium transition-all"
                  style={{
                    borderColor: 'rgba(0, 255, 163, 0.3)',
                    background: sending || !replyInput.trim() ? 'rgba(30, 41, 59, 0.5)' : 'linear-gradient(135deg, rgba(0, 255, 163, 0.2), rgba(0, 212, 255, 0.15))',
                    color: sending || !replyInput.trim() ? '#475569' : '#00FFA3',
                    cursor: sending || !replyInput.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Send size={14} /> 回复
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
