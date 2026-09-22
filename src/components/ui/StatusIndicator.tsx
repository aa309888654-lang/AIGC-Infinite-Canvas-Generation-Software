import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, Loader2, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';

interface StatusMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'loading';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    text: string;
    onClick: () => void;
  };
}

interface StatusIndicatorProps {
  className?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  className,
  position = 'top-right'
}) => {
  const [messages, setMessages] = useState<StatusMessage[]>([]);
  const executionCompleted = useTaskStore((s) => s.executionProgress.completed);
  const executionTotal = useTaskStore((s) => s.executionProgress.total);
  const workflowRunning = useWorkflowStore((s) => s.isRunning);

  // 移除状态消息
  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  // 添加状态消息
  const addMessage = useCallback((message: Omit<StatusMessage, 'id'>) => {
    const id = Date.now().toString();
    const newMessage: StatusMessage = {
      ...message,
      id,
      duration: message.duration || 3000
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // 自动移除
    if (newMessage.duration > 0) {
      setTimeout(() => {
        removeMessage(id);
      }, newMessage.duration);
    }
    
    return id;
  }, [removeMessage]);

  // 获取位置样式
  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'center':
        return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  // 获取图标
  const getIcon = (type: StatusMessage['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'loading':
        return <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  // 监听工作流状态变化
  const workflowLoadingMsgRef = useRef<string | null>(null);

  useEffect(() => {
    if (workflowRunning && executionTotal > 0) {
      if (workflowLoadingMsgRef.current) {
        setMessages(prev => prev.map(msg =>
          msg.id === workflowLoadingMsgRef.current
            ? { ...msg, message: `进度: ${executionCompleted}/${executionTotal}` }
            : msg
        ));
      } else {
        const id = addMessage({
          type: 'loading',
          title: '工作流执行中',
          message: `进度: ${executionCompleted}/${executionTotal}`,
          duration: 0
        });
        workflowLoadingMsgRef.current = id;
      }
    } else if (!workflowRunning && executionCompleted > 0) {
      if (workflowLoadingMsgRef.current) {
        removeMessage(workflowLoadingMsgRef.current);
        workflowLoadingMsgRef.current = null;
      }
      addMessage({
        type: 'success',
        title: '工作流执行完成',
        message: `成功执行 ${executionCompleted} 个节点`,
        duration: 3000
      });
    }
  }, [workflowRunning, executionTotal, executionCompleted, addMessage, removeMessage]);

  // 监听任务状态变化
  useEffect(() => {
    // 这里可以监听具体任务状态变化
  }, []);

  return (
    <div className={cn("fixed z-50 space-y-2", getPositionClasses(), className)}>
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "bg-[#1C1C1E] border border-white/10 rounded-lg shadow-xl p-4 min-w-[300px] max-w-[400px]",
            "animate-in slide-in-from-right duration-300"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(message.type)}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-white">{message.title}</h4>
                <button
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  onClick={() => removeMessage(message.id)}
                >
                  <X className="w-4 h-4 text-white/70" />
                </button>
              </div>
              
              {message.message && (
                <p className="text-xs text-white/70 mt-1">{message.message}</p>
              )}
              
              {message.action && (
                <button
                  className="mt-2 px-3 py-1 text-xs bg-[#007AFF] hover:bg-[#0056CC] text-white rounded transition-colors"
                  onClick={() => {
                    message.action?.onClick();
                    removeMessage(message.id);
                  }}
                >
                  {message.action.text}
                </button>
              )}
            </div>
          </div>
          
          {/* 进度条（用于加载状态） */}
          {message.type === 'loading' && (
            <div className="mt-3">
              <div className="w-full bg-white/10 rounded-full h-1">
                <div 
                  className="bg-[#007AFF] h-1 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(executionCompleted / Math.max(1, executionTotal)) * 100}%` 
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// 全局状态管理器
class StatusManager {
  private static instance: StatusManager;
  private listeners: Set<(message: Omit<StatusMessage, 'id'>) => void> = new Set();

  private constructor() { /* noop */ }

  public static getInstance(): StatusManager {
    if (!StatusManager.instance) {
      StatusManager.instance = new StatusManager();
    }
    return StatusManager.instance;
  }

  public subscribe(listener: (message: Omit<StatusMessage, 'id'>) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public showSuccess(title: string, message?: string, options?: Partial<Omit<StatusMessage, 'id' | 'type' | 'title' | 'message'>>) {
    this.notifyListeners({
      type: 'success',
      title,
      message,
      ...options
    });
  }

  public showError(title: string, message?: string, options?: Partial<Omit<StatusMessage, 'id' | 'type' | 'title' | 'message'>>) {
    this.notifyListeners({
      type: 'error',
      title,
      message,
      ...options
    });
  }

  public showInfo(title: string, message?: string, options?: Partial<Omit<StatusMessage, 'id' | 'type' | 'title' | 'message'>>) {
    this.notifyListeners({
      type: 'info',
      title,
      message,
      ...options
    });
  }

  public showWarning(title: string, message?: string, options?: Partial<Omit<StatusMessage, 'id' | 'type' | 'title' | 'message'>>) {
    this.notifyListeners({
      type: 'warning',
      title,
      message,
      ...options
    });
  }

  public showLoading(title: string, message?: string, options?: Partial<Omit<StatusMessage, 'id' | 'type' | 'title' | 'message'>>) {
    this.notifyListeners({
      type: 'loading',
      title,
      message,
      duration: 0, // 不自动关闭
      ...options
    });
  }

  private notifyListeners(message: Omit<StatusMessage, 'id'>) {
    this.listeners.forEach(listener => listener(message));
  }
}

export const statusManager = StatusManager.getInstance();

export default StatusIndicator;