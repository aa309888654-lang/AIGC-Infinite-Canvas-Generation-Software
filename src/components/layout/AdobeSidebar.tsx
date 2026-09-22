import { useState, useCallback } from 'react';
import { PUBLIC_URLS } from '@/config/resources';
import { Image, Sparkles, Video, Type, MessageSquare, FileOutput, Palette, Save, FolderOpen, ZoomIn, ZoomOut, Maximize, Download, Upload, Folder, Grid3X3, Trash2, CheckCircle, X, History, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateId } from '@/lib/utils';
import { nodeEventBus } from '@/lib/nodeEventBus';
import { unifiedCacheService } from '@/services/unified-cache-service';
import { NODE_TYPES, buildNodeDataFromDefinition } from '@/types/node-system';


interface AdobeSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onOpenFileManager?: () => void;
  onOpenCacheClearPanel?: () => void;
  onOpenVersionControl?: () => void;
}

interface ToolCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  tools: ToolItem[];
}

interface ToolItem {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  action: () => void;
}

const getCenterPosition = () => {
  const sidebarWidth = 56; // 折叠后的宽度
  const headerHeight = 40;
  const canvasWidth = window.innerWidth - sidebarWidth;
  const canvasHeight = window.innerHeight - headerHeight;
  
  return {
    x: canvasWidth / 2 - 100,
    y: canvasHeight / 2 - 100,
  };
};

const AdobeSidebar: React.FC<AdobeSidebarProps> = ({ isCollapsed, onToggle, onOpenFileManager, onOpenCacheClearPanel, onOpenVersionControl }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  // 节点添加函数 - 使用事件总线同步到FlowEditor
  const addVideoGenNode = useCallback(() => {
    const pos = getCenterPosition();
    const definition = NODE_TYPES.find((item) => item.id === 'aiVideo');
    const node = {
      id: generateId(),
      type: 'aiVideo',
      position: { x: pos.x, y: pos.y },
      data: {
        ...(definition ? buildNodeDataFromDefinition(definition) : {}),
        type: 'aiVideo',
        isExpanded: true,
      },
    };
    nodeEventBus.emitNodeAdded(node);
  }, []);

  const addImageInputNode = useCallback(() => {
    const pos = getCenterPosition();
    const node = {
      id: generateId(),
      type: 'imageInput',
      position: { x: pos.x, y: pos.y },
      data: { type: 'imageInput', imageUrl: undefined, fileName: undefined, isExpanded: true },
    };
    nodeEventBus.emitNodeAdded(node);
  }, []);

  const addPromptNode = useCallback(() => {
    const pos = getCenterPosition();
    const node = {
      id: generateId(),
      type: 'prompt',
      position: { x: pos.x, y: pos.y },
      data: { type: 'prompt', prompt: '', negativePrompt: '', isExpanded: true },
    };
    nodeEventBus.emitNodeAdded(node);
  }, []);

  const addAIGenTextNode = useCallback(() => {
    const pos = getCenterPosition();
    const node = {
      id: generateId(),
      type: 'aiGenText',
      position: { x: pos.x, y: pos.y },
      data: {
        type: 'aiGenText',
        prompt: '',
        outputText: '',
        model: 'deepseek-v4-flash',
        variableName: 'text_output',
        isExpanded: true,
        task: { status: 'idle' },
      },
    };
    nodeEventBus.emitNodeAdded(node);
  }, []);

  const addOutputNode = useCallback(() => {
    const pos = getCenterPosition();
    const node = {
      id: generateId(),
      type: 'output',
      position: { x: pos.x, y: pos.y },
      data: { type: 'output', outputFormat: 'png', isExpanded: true },
    };
    nodeEventBus.emitNodeAdded(node);
  }, []);

  // 工具分类定义 - 按照优化方案功能分区
  const toolCategories: ToolCategory[] = [
    // AI创作（核心功能，最上方）
    {
      id: 'generation',
      name: 'AI创作',
      icon: Sparkles,
      color: '#10B981',
      tools: [
        { id: 'aiImage', name: 'AI图片', icon: Image, color: '#6610F2', action: () => { window.location.href = '/ai-view'; } },
        { id: 'aiVideo', name: 'AI视频', icon: Video, color: '#E91E63', action: addVideoGenNode },
      ]
    },
    // 输入节点
    {
      id: 'input',
      name: '输入节点',
      icon: Upload,
      color: '#007AFF',
      tools: [
        { id: 'imageInput', name: '图片输入', icon: Image, color: '#007AFF', action: addImageInputNode },
        { id: 'prompt', name: '提示词', icon: MessageSquare, color: '#10B981', action: addPromptNode },
        { id: 'aiGenText', name: '生成文本', icon: Type, color: '#7c3aed', action: addAIGenTextNode },
      ]
    },
    // 输出节点
    {
      id: 'output',
      name: '输出节点',
      icon: Download,
      color: '#DC3545',
      tools: [
        { id: 'output', name: '输出节点', icon: FileOutput, color: '#DC3545', action: addOutputNode },
      ]
    },
    // 文件管理
    {
      id: 'file',
      name: '文件管理',
      icon: Folder,
      color: '#64748B',
      tools: [
        { id: 'save', name: '保存', icon: Save, color: '#64748B', action: () => { /* noop */ } },
        { id: 'fileManager', name: '文件管理', icon: FolderOpen, color: '#FFA500', action: () => onOpenFileManager?.() },
        { id: 'cacheClear', name: '清除缓存', icon: Trash2, color: '#DC3545', action: () => onOpenCacheClearPanel?.() },
      ]
    },
    // 视图
    {
      id: 'view',
      name: '视图',
      icon: Grid3X3,
      color: '#06B6D4',
      tools: [
        { id: 'zoomIn', name: '放大', icon: ZoomIn, color: '#06B6D4', action: () => { /* noop */ } },
        { id: 'zoomOut', name: '缩小', icon: ZoomOut, color: '#06B6D4', action: () => { /* noop */ } },
        { id: 'fitView', name: '适应窗口', icon: Maximize, color: '#06B6D4', action: () => { /* noop */ } },
      ]
    },
    // 版本控制
    {
      id: 'version',
      name: '版本控制',
      icon: Shield,
      color: '#00E5FF',
      tools: [
        { id: 'versionControl', name: '版本管理', icon: History, color: '#00E5FF', action: () => onOpenVersionControl?.() },
      ]
    },
  ];

  const handleToolClick = (tool: ToolItem) => {
    tool.action();
    // 点击后收起分类
    setExpandedCategory(null);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  return (
    <>
      {/* 竖形图标导航栏 - 宽度56px, 图标24px, 间距12px */}
      {/* 只有在非折叠状态时才显示 */}
      {!isCollapsed && (
      <div
        className={cn(
          "fixed left-0 top-0 h-full flex flex-col z-50 transition-all duration-200",
          "w-[56px]"
        )}
      >
        {/* Logo区域 */}
        <div className="h-14 flex items-center justify-center">
          <img src={PUBLIC_URLS.logo} alt="小天AICG" style={{ width: 32, height: 32, borderRadius: 8, filter: 'drop-shadow(0 0 6px rgba(107, 114, 128, 0.3))' }} />
        </div>

        {/* 竖形排列的工具图标列表 - 间距12px */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {/* 所有工具直接竖形排列 */}
          {toolCategories.map((category) => {
            const CategoryIcon = category.icon;
            const isExpanded = expandedCategory === category.id;
            
            return (
              <div key={category.id} className="relative">
                <button
                  onClick={() => toggleCategory(category.id)}
                  onMouseEnter={() => setHoveredTool(category.id)}
                  onMouseLeave={() => setHoveredTool(null)}
                  className={cn(
                    "w-full h-12 flex items-center justify-center relative group transition-all duration-150",
                    "active:scale-95"
                  )}
                  title={category.name}
                >
                  {/* 激活状态指示条 */}
                  {isExpanded && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#00E5FF] rounded-r shadow-[0_0_8px_rgba(0,229,255,0.6)]" />
                  )}
                  {/* 图标大小24px, 悬停效果scale(1.08) */}
                  <CategoryIcon
                    className="w-5 h-5 transition-transform duration-150 group-hover:scale-[1.1]"
                    style={{ color: isExpanded ? '#00E5FF' : category.color, filter: isExpanded ? 'drop-shadow(0 0 4px rgba(0,229,255,0.4))' : 'none' }}
                  />
                  
                  {/* 悬停提示 - Tooltip */}
                  {hoveredTool === category.id && !isExpanded && (
                    <div className="absolute left-full ml-2 px-2.5 py-1.5 backdrop-blur-sm rounded-lg text-xs text-[#FAFAFA] whitespace-nowrap z-50 pointer-events-none">
                      {category.name}
                    </div>
                  )}
                </button>

                {/* 展开的工具列表 - 从右侧弹出 */}
                {isExpanded && (
                  <div className="absolute left-[56px] top-0 h-full w-[180px] z-40 overflow-y-auto animate-fadeIn">
                    <div className="h-11 flex items-center px-3 gap-2">
                      <CategoryIcon className="w-4 h-4" style={{ color: category.color }} />
                      <span className="text-[10px] font-semibold text-[#FAFAFA]">{category.name}</span>
                    </div>
                    <div className="py-1.5 p-1">
                      {category.tools.map((tool) => {
                        const ToolIcon = tool.icon;
                        return (
                          <button
                            key={tool.id}
                            onClick={() => handleToolClick(tool)}
                            className="w-full h-10 flex items-center gap-3 px-2 rounded-lg hover:bg-white/10 transition-colors group"
                          >
                            <div className="w-7 h-7 flex items-center justify-center">
                              <ToolIcon className="w-3.5 h-3.5" style={{ color: tool.color }} />
                            </div>
                            <span className="text-[10px] font-medium text-[#A1A1AA] group-hover:text-[#FAFAFA] transition-colors">{tool.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部区域 - 快速清理缓存和设置 */}
        <div className="py-2 mt-auto space-y-1">
          {/* 快速清理缓存按钮 */}
          <QuickClearCacheButton />
          
          {/* 隐藏工具栏按钮 */}
          <button
            onClick={onToggle}
            className="w-full h-12 flex items-center justify-center hover:bg-white/10 transition-all duration-150 active:scale-95"
            title="隐藏工具栏"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
      )}
    </>
  );
};

// 快速清理缓存按钮组件
const QuickClearCacheButton = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleQuickClear = async () => {
    if (isClearing) return;
    
    setIsClearing(true);
    try {
      const result = await unifiedCacheService.clearAll();
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      }
    } catch (error) {
      console.error('缓存清理失败:', error);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <button
      onClick={handleQuickClear}
      disabled={isClearing}
      className={cn(
        "w-full h-12 flex items-center justify-center relative transition-all duration-150 active:scale-95 hover:bg-white/10",
        showSuccess ? "text-[#10B981]" : "text-white"
      )}
      title="一键清理缓存"
    >
      {showSuccess ? (
        <CheckCircle className="w-6 h-6" />
      ) : isClearing ? (
        <RefreshCw className="w-5 h-5 animate-spin" />
      ) : (
        <Trash2 className="w-6 h-6" />
      )}
      
      {/* 成功提示 */}
      {showSuccess && (
        <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-lg text-xs text-white whitespace-nowrap z-50 pointer-events-none">
          缓存已清理
        </div>
      )}
    </button>
  );
};

// 添加RefreshCw导入（在Trash2之后添加）
import { RefreshCw } from 'lucide-react';

export default AdobeSidebar;
