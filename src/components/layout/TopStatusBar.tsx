import { useState } from 'react';
import { PUBLIC_URLS } from '@/config/resources';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useFileStore } from '@/store/useFileStore';
import { usePanelStore } from '@/store/usePanelStore';
import { User, Settings, FolderOpen, Files } from 'lucide-react';
import SettingsPanel from '@/components/settings/SettingsPanel';
import ThemeToggle from '@/components/ui/ThemeToggle';

const TopStatusBar = () => {
  const { nodes } = useCanvasStore();
  const { isRunning } = useTaskStore();
  const { files } = useFileStore();
  const { setWorkflowPanelOpen, setFileManagerOpen } = usePanelStore();
  const [autoSave, setAutoSave] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const getStatusText = () => {
    if (isRunning) return '处理中';
    if (nodes.length > 0) return '就绪';
    return '等待添加节点';
  };

  const nodeCount = nodes.length;

  return (
    <div className="top-status-bar">
      {/* 左侧：Logo与名称 */}
      <div className="flex items-center gap-3">
        <img src={PUBLIC_URLS.logo} alt="小天AICG" style={{ width: 28, height: 28, borderRadius: 6 }} />
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-wide" style={{ color: 'var(--accent-primary)', letterSpacing: '0.02em' }}>
            小天AICG
          </span>
          <span className="badge badge-primary">AI</span>
        </div>
      </div>

      {/* 中央：状态 */}
      <div className="flex items-center gap-6">
        <div className={`status-item flex items-center gap-2 ${isRunning ? 'highlight' : ''}`}>
          {isRunning ? (
            <>
              <span className="status-dot status-dot-processing"></span>
              <span>处理中</span>
            </>
          ) : (
            <>
              <span className="status-dot status-dot-ready"></span>
              <span>{getStatusText()}</span>
            </>
          )}
        </div>
        {nodeCount > 0 && (
          <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {nodeCount} 个节点
          </div>
        )}
      </div>

      {/* 右侧：操作 */}
      <div className="flex items-center gap-4">
        {/* 自动保存开关 */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>自动保存</span>
          <button
            onClick={() => setAutoSave(!autoSave)}
            className={`toggle-switch ${autoSave ? 'active' : ''}`}
          />
        </div>

        <div className="w-px h-5" style={{ background: 'var(--border-default)' }}></div>

        {/* 工作流管理按钮 */}
        <button
          onClick={() => setWorkflowPanelOpen(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-[var(--bg-hover)]"
          style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          title="工作流管理"
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        <div className="w-px h-5" style={{ background: 'var(--border-default)' }}></div>

        {/* 文件管理按钮 */}
        <button
          onClick={() => setFileManagerOpen(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-[var(--bg-hover)] relative"
          style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          title="文件管理"
        >
          <Files className="w-4 h-4" />
          {files.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-[10px] text-white flex items-center justify-center">
              {files.length}
            </span>
          )}
        </button>

        <div className="w-px h-5" style={{ background: 'var(--border-default)' }}></div>

        {/* 主题切换 */}
        <ThemeToggle />

        <div className="w-px h-5" style={{ background: 'var(--border-default)' }}></div>

        {/* 设置按钮 */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-[var(--bg-hover)]"
          style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          title="设置"
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="w-px h-5" style={{ background: 'var(--border-default)' }}></div>

        {/* 用户头像 */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          title="用户"
        >
          <User className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </div>
      </div>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default TopStatusBar;
