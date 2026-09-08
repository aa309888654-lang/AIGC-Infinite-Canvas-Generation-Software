import { useEffect, useState, useMemo } from 'react';
import WorkflowManager from './WorkflowManager';
import { cn } from '@/lib/utils';
import realAPIExecutor from '@/store/real-api-executor';
import { Sparkles } from 'lucide-react';

const CanvasToolbar = () => {
  const [showWorkflowManager, setShowWorkflowManager] = useState(false);

  const actions = useMemo(() => ([
    {
      key: 'workflow',
      label: '工作流',
      icon: Sparkles,
      onClick: () => setShowWorkflowManager(true),
    },
  ]), []);

  useEffect(() => {
    const handleNodeExecute = (e: Event) => {
      const detail = (e as CustomEvent<{ nodeId?: string }>).detail;
      const nodeId = detail?.nodeId;
      void (async () => {
        if (nodeId) {
          await realAPIExecutor.executeSingleNode(nodeId);
        } else {
          await realAPIExecutor.executeWithRealAPI();
        }
      })();
    };

    window.addEventListener('execute-node', handleNodeExecute as EventListener);
    return () => {
      window.removeEventListener('execute-node', handleNodeExecute as EventListener);
    };
  }, []);

  return (
    <>
      <div
        className={cn(
          'pointer-events-auto flex shrink-0 items-center gap-1 rounded-xl border border-white/10',
          'bg-[#0d0d0d] px-1.5 py-1 shadow-[0_10px_34px_rgba(0,0,0,0.32)] backdrop-blur-xl',
          'ring-1 ring-white/[0.025]',
        )}
      >
        {actions.map(({ key, label, icon: Icon, onClick }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold text-white/76 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 工作流管理面板 */}
      <WorkflowManager
        isOpen={showWorkflowManager}
        onClose={() => setShowWorkflowManager(false)}
      />
    </>
  );
};

export default CanvasToolbar;
