import React, { useState, useEffect, useCallback } from 'react';
import { Users, Copy, Check, X, Clock, History, UserPlus, Shield } from 'lucide-react';
import { collaborationService } from '@/services/collaboration-service';

interface CollaborationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [activeTab, setActiveTab] = useState<'members' | 'versions'>('members');

  const userId = `user-${localStorage.getItem('user_id') || Math.random().toString(36).slice(2, 8)}`;

  useEffect(() => {
    if (!isOpen) return;

    const stored = localStorage.getItem('collab-online-users');
    const users: Record<string, number> = stored ? JSON.parse(stored) : {};
    users[userId] = Date.now();
    localStorage.setItem('collab-online-users', JSON.stringify(users));

    const interval = setInterval(() => {
      const all: Record<string, number> = JSON.parse(localStorage.getItem('collab-online-users') || '{}');
      const now = Date.now();
      const active = Object.entries(all).filter(([, ts]) => now - ts < 30000);
      setOnlineCount(active.length);
    }, 5000);

    return () => {
      const all: Record<string, number> = JSON.parse(localStorage.getItem('collab-online-users') || '{}');
      delete all[userId];
      localStorage.setItem('collab-online-users', JSON.stringify(all));
      clearInterval(interval);
    };
  }, [isOpen, userId]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  if (!isOpen) return null;

  const projects = collaborationService.getProjects();
  const currentProject = projects[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#1A1A1E] rounded-2xl border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-gradient-to-r from-[#007AFF]/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#007AFF]/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#007AFF]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">协作</h2>
              <p className="text-xs text-white/50">
                <span className="inline-block w-2 h-2 rounded-full bg-[#10B981] mr-1 animate-pulse" />
                {onlineCount} 人在线
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-white/5">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'members' ? 'text-white border-b-2 border-[#007AFF] bg-white/5' : 'text-gray-400 hover:text-white'}`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            成员
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'versions' ? 'text-white border-b-2 border-[#007AFF] bg-white/5' : 'text-gray-400 hover:text-white'}`}
          >
            <History className="w-4 h-4 inline mr-2" />
            历史
          </button>
        </div>

        <div className="p-4 max-h-72 overflow-y-auto">
          {activeTab === 'members' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#252528] rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-xs font-medium">
                    我
                  </div>
                  <div>
                    <div className="text-sm text-white">当前用户</div>
                    <div className="text-xs text-[#10B981] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] inline-block" /> 在线
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-[#007AFF]/20 text-[#007AFF] text-xs rounded">所有者</span>
              </div>

              <div className="p-3 bg-[#252528] rounded-lg border border-white/5">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <UserPlus className="w-3 h-3" />
                  邀请成员
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleShare}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#007AFF] hover:bg-[#0055CC] text-white text-xs rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? '已复制' : '复制链接'}
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-2">复制链接发送给团队成员，他们可以查看此工作流</p>
              </div>

              <div className="p-3 bg-[#252528] rounded-lg border border-white/5">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <Shield className="w-3 h-3" />
                  权限说明
                </div>
                <div className="space-y-1.5 text-xs text-gray-500">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">所有者</span>
                    <span>编辑、删除、邀请</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">编辑者</span>
                    <span>编辑内容</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">查看者</span>
                    <span>仅查看</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="space-y-3">
              <button
                onClick={() => {
                  collaborationService.saveVersion('default', '当前版本', ['节点变更']);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#007AFF] hover:bg-[#0055CC] text-white text-xs rounded-lg transition-colors"
              >
                <Clock className="w-3 h-3" />
                保存当前版本
              </button>
              {currentProject && (
                <div className="text-xs text-gray-500 mb-2">
                  项目: {currentProject.name} (v{currentProject.version})
                </div>
              )}
              <div className="text-xs text-gray-500 text-center py-4">
                暂无版本历史
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollaborationPanel;
