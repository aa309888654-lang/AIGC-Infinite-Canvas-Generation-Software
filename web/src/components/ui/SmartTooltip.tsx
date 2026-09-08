// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { X, Lightbulb, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useLayout } from '@/services/layout-manager';

interface Suggestion {
  text: string;
  action: () => void;
  priority: 'high' | 'medium' | 'low';
  icon?: React.ComponentType<{ className?: string }>;
}

interface SmartTooltipProps {
  context: string;
  suggestions: Suggestion[];
  position?: 'top' | 'bottom' | 'left' | 'right';
  autoClose?: number; // 自动关闭时间（毫秒）
  onClose?: () => void;
}

const SmartTooltip: React.FC<SmartTooltipProps> = ({
  context,
  suggestions,
  position = 'top',
  autoClose = 5000,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { nodes, selectedNodeIds } = useCanvasStore();
  const { isRunning, tasks } = useTaskStore();
  const { openPanel } = useLayout();

  // 根据上下文生成智能建议
  const generateSmartSuggestions = (): Suggestion[] => {
    const smartSuggestions: Suggestion[] = [];
    
    // 基于当前状态的智能建议
    if (nodes.length === 0) {
      smartSuggestions.push({
        text: '从节点库添加第一个节点',
        action: () => openPanel('nodePalette'),
        priority: 'high',
        icon: () => <span className="text-[#007AFF]">📦</span>
      });
    }
    
    if (selectedNodeIds.length > 0) {
      smartSuggestions.push({
        text: '连接选中的节点',
        action: () => {
          // 实现节点连接逻辑
          toast.info('节点连接功能开发中...');
        },
        priority: 'high',
        icon: () => <span className="text-green-500">🔗</span>
      });
      
      smartSuggestions.push({
        text: '复制选中的节点',
        action: () => {
          // 实现节点复制逻辑
          toast.info('节点复制功能开发中...');
        },
        priority: 'medium',
        icon: () => <span className="text-gray-500">📋</span>
      });
    }
    
    if (Object.keys(tasks).length > 0 && !isRunning) {
      smartSuggestions.push({
        text: '查看任务队列',
        action: () => openPanel('taskQueue'),
        priority: 'medium',
        icon: () => <span className="text-orange-500">📋</span>
      });
    }
    
    if (isRunning) {
      smartSuggestions.push({
        text: '监控执行进度',
        action: () => openPanel('statusMonitor'),
        priority: 'high',
        icon: () => <span className="text-green-500">▶️</span>
      });
    }
    
    return smartSuggestions;
  };

  // 合并自定义建议和智能建议
  const allSuggestions = [
    ...generateSmartSuggestions(),
    ...suggestions
  ].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  }).slice(0, 5); // 限制显示数量

  // 显示动画
  useEffect(() => {
    if (context && allSuggestions.length > 0) {
      setIsVisible(true);
      
      // 自动关闭
      if (autoClose > 0) {
        const timer = setTimeout(() => {
          handleClose();
        }, autoClose);
        
        return () => clearTimeout(timer);
      }
    }
  }, [context, allSuggestions.length, autoClose, handleClose]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, handleClose]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      onClose?.();
    }, 200);
  };

  if (!isVisible || allSuggestions.length === 0) return null;

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  return (
    <div
      ref={tooltipRef}
      className={cn(
        "absolute z-50 bg-[#1C1C1E] border border-white/20 rounded-lg shadow-xl max-w-sm",
        getPositionClasses(),
        isClosing ? "animate-out fade-out slide-out-to-top-2" : "animate-in fade-in slide-in-from-top-2"
      )}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-[#007AFF]" />
          <div className="text-sm font-medium text-white">{context}</div>
        </div>
        <button
          className="p-1 hover:bg-white/10 rounded transition-colors"
          onClick={handleClose}
        >
          <X className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* 建议列表 */}
      <div className="p-2">
        <div className="flex flex-col gap-1">
          {allSuggestions.map((suggestion, index) => {
            const IconComponent = suggestion.icon;
            
            return (
              <button
                key={index}
                className="flex items-center gap-2 px-3 py-2 text-left text-xs bg-white/5 hover:bg-white/10 rounded transition-colors group"
                onClick={() => {
                  suggestion.action();
                  handleClose();
                }}
              >
                {IconComponent && <IconComponent className="w-4 h-4 flex-shrink-0" />}
                <span className="flex-1 text-white">{suggestion.text}</span>
                <ArrowRight className="w-3 h-3 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 优先级指示器 */}
      <div className="px-3 py-2 border-t border-white/10 flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-white/60">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span>高优先级</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/60">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          <span>中优先级</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/60">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span>低优先级</span>
        </div>
      </div>
    </div>
  );
};

// 上下文敏感的智能提示钩子
export const useSmartTooltip = () => {
  const [tooltipContext, setTooltipContext] = useState<string | null>(null);
  const [tooltipSuggestions, setTooltipSuggestions] = useState<Suggestion[]>([]);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const showTooltip = (context: string, suggestions: Suggestion[] = [], position?: { x: number; y: number }) => {
    setTooltipContext(context);
    setTooltipSuggestions(suggestions);
    if (position) {
      setTooltipPosition(position);
    }
  };

  const hideTooltip = () => {
    setTooltipContext(null);
    setTooltipSuggestions([]);
  };

  return {
    tooltipContext,
    tooltipSuggestions,
    tooltipPosition,
    showTooltip,
    hideTooltip
  };
};

// 新手引导提示组件
export const OnboardingTooltip: React.FC = () => {
  const [currentStep, _setCurrentStep] = useState(0);
  const { nodes } = useCanvasStore();
  const { showTooltip } = useSmartTooltip();

  const onboardingSteps = [
    {
      context: "欢迎使用 XTAICG",
      suggestions: [
        {
          text: "开始创建第一个节点",
          action: () => {
            // 打开节点库
            toast.info('节点库已打开');
          },
          priority: 'high' as const
        },
        {
          text: "查看快速入门指南",
          action: () => {
            toast.info('快速入门指南');
          },
          priority: 'medium' as const
        }
      ],
      condition: () => nodes.length === 0
    },
    {
      context: "工作流执行完成",
      suggestions: [
        {
          text: "查看生成结果",
          action: () => {
            toast.info('查看结果');
          },
          priority: 'high' as const
        },
        {
          text: "保存当前工作流",
          action: () => {
            toast.info('保存工作流');
          },
          priority: 'medium' as const
        }
      ],
      condition: () => false // 需要监听工作流完成事件
    }
  ];

  useEffect(() => {
    const currentStepData = onboardingSteps[currentStep];
    if (currentStepData && currentStepData.condition()) {
      showTooltip(currentStepData.context, currentStepData.suggestions);
    }
  }, [currentStep, nodes.length, showTooltip, onboardingSteps]);

  return null; // 实际渲染由 SmartTooltip 组件处理
};

export default SmartTooltip;