import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { Save, Download, Trash2, PlayCircle as Play, Loader2, RefreshCw } from 'lucide-react';

const FloatingDock = () => {
  const { resetCanvas } = useCanvasStore();
  const { isRunning } = useTaskStore();
  const { executeWorkflow } = useWorkflowStore();
  const [isHovering, setIsHovering] = useState(false);
  const [tooltip, setTooltip] = useState<string | null>(null);

  const handleTooltip = (text: string) => {
    setTooltip(text);
  };

  const buttons = [
    { id: 'save', icon: Save, label: '保存', onClick: () => { /* TODO: 保存功能 */ } },
    { id: 'export', icon: Download, label: '导出', onClick: () => { /* TODO: 导出功能 */ } },
    { id: 'reset', icon: Trash2, label: '清空画布', onClick: resetCanvas, color: 'var(--accent-error)' },
  ];

  return (
    <div
      className="floating-dock"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setTooltip(null);
      }}
    >
      {/* 常规按钮 */}
      {buttons.map((btn) => (
        <button
          key={btn.id}
          onClick={btn.onClick}
          className="dock-button"
          onMouseEnter={() => handleTooltip(btn.label)}
          onMouseLeave={() => setTooltip(null)}
          title={btn.label}
          style={{ color: btn.color }}
        >
          <btn.icon className="w-5 h-5" />
        </button>
      ))}

      <div className="dock-divider"></div>

      {/* 刷新按钮 */}
      <button
        onClick={() => window.location.reload()}
        className="dock-button"
        onMouseEnter={() => handleTooltip('刷新')}
        onMouseLeave={() => setTooltip(null)}
        title="刷新"
      >
        <RefreshCw className="w-5 h-5" />
      </button>

      <div className="dock-divider"></div>

      {/* 执行按钮 */}
      <button
        onClick={executeWorkflow}
        disabled={isRunning}
        className="dock-button primary px-6"
        onMouseEnter={() => handleTooltip(isRunning ? '运行中...' : '全部生成')}
        onMouseLeave={() => setTooltip(null)}
        style={{ minWidth: '120px' }}
      >
        {isRunning ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="ml-2 font-semibold">运行中</span>
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            <span className="ml-2 font-semibold">全部生成</span>
          </>
        )}
      </button>

      {/* Tooltip */}
      {isHovering && tooltip && (
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200"
          style={{
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {tooltip}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 border-4"
            style={{
              borderColor: 'var(--bg-elevated) transparent transparent transparent'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default FloatingDock;
