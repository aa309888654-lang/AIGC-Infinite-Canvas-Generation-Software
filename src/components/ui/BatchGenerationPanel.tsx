import React, { useState, useCallback } from 'react';
import { 
  X, 
  PlayCircle as Play, 
  Plus, 
  Trash2, 
  Settings, 
  Image, 
  Video, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Layers,
  Zap,
  FileText
} from 'lucide-react';

import { useFileStore } from '@/store/useFileStore';

import { generateId } from '@/lib/utils';

interface BatchGenerationItem {
  id: string;
  type: 'image' | 'video';
  prompt: string;
  negativePrompt?: string;
  config: BatchConfig;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progress: number;
  resultUrl?: string;
  error?: string;
}

interface BatchConfig {
  modelProvider: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  quality?: string;
  count: number;
  variations?: PromptVariation[];
}

interface PromptVariation {
  id: string;
  prompt: string;
  negativePrompt?: string;
}

interface BatchGenerationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const BatchGenerationPanel: React.FC<BatchGenerationPanelProps> = ({ isOpen, onClose }) => {
  const { registerGeneratedFile } = useFileStore();
  
  const [items, setItems] = useState<BatchGenerationItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [currentItemIndex, setCurrentItemIndex] = useState(-1);
  
  // 默认配置
  const [defaultConfig, setDefaultConfig] = useState<BatchConfig>({
    modelProvider: 'doubao',
    aspectRatio: '1:1',
    resolution: '1024x1024',
    duration: 5,
    quality: 'standard',
    count: 1,
    variations: []
  });

  // 添加新项目
  const addItem = useCallback((type: 'image' | 'video') => {
    const newItem: BatchGenerationItem = {
      id: generateId(),
      type,
      prompt: '',
      config: { ...defaultConfig },
      status: 'pending',
      progress: 0
    };
    setItems(prev => [...prev, newItem]);
  }, [defaultConfig]);

  // 移除项目
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // 更新项目
  const updateItem = useCallback((id: string, updates: Partial<BatchGenerationItem>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  // 复制项目
  const duplicateItem = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      const newItem: BatchGenerationItem = {
        ...item,
        id: generateId(),
        status: 'pending',
        progress: 0,
        resultUrl: undefined,
        error: undefined
      };
      setItems(prev => [...prev, newItem]);
    }
  }, [items]);

  // 添加提示词变体
  const addVariation = useCallback((itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item && item.config.variations) {
      const newVariation: PromptVariation = {
        id: generateId(),
        prompt: item.prompt,
        negativePrompt: item.negativePrompt
      };
      updateItem(itemId, {
        config: {
          ...item.config,
          variations: [...item.config.variations, newVariation]
        }
      });
    }
  }, [items, updateItem]);

  // 移除提示词变体
  const removeVariation = useCallback((itemId: string, variationId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item && item.config.variations) {
      updateItem(itemId, {
        config: {
          ...item.config,
          variations: item.config.variations.filter(v => v.id !== variationId)
        }
      });
    }
  }, [items, updateItem]);

  // 开始批量生成
  const startBatchGeneration = useCallback(async () => {
    if (items.length === 0) return;
    
    setIsGenerating(true);
    setGlobalProgress(0);
    setCurrentItemIndex(0);
    
    const totalItems = items.length;
    let completedItems = 0;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (!item.prompt.trim()) {
        updateItem(item.id, {
          status: 'failed',
          error: '提示词不能为空'
        });
        completedItems++;
        setGlobalProgress((completedItems / totalItems) * 100);
        continue;
      }
      
      setCurrentItemIndex(i);
      updateItem(item.id, { status: 'generating', progress: 0 });
      
      try {
        // 模拟生成过程
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          updateItem(item.id, { progress });
        }
        
        // 生成模拟结果URL
        const resultUrl = item.type === 'video' 
          ? `https://example.com/video_${item.id}.mp4`
          : `https://example.com/image_${item.id}.jpg`;
        
        // 添加到文件列表
        await registerGeneratedFile({
          id: generateId(),
          name: `${item.type}_${Date.now()}.${item.type === 'video' ? 'mp4' : 'jpg'}`,
          type: item.type,
          url: resultUrl,
          size: Math.floor(Math.random() * 10000000),
          createdAt: new Date().toISOString()
        });
        
        updateItem(item.id, {
          status: 'completed',
          progress: 100,
          resultUrl
        });
        
      } catch (error) {
        updateItem(item.id, {
          status: 'failed',
          error: error instanceof Error ? error.message : '生成失败'
        });
      }
      
      completedItems++;
      setGlobalProgress((completedItems / totalItems) * 100);
    }
    
    setIsGenerating(false);
    setCurrentItemIndex(-1);
  }, [items, updateItem, registerGeneratedFile]);

  // 停止生成
  const stopGeneration = useCallback(() => {
    setIsGenerating(false);
    setCurrentItemIndex(-1);
  }, []);

  // 导出结果
  const exportResults = useCallback(() => {
    const completedItems = items.filter(i => i.status === 'completed');
    if (completedItems.length === 0) return;
    
    const exportData = completedItems.map(item => ({
      type: item.type,
      prompt: item.prompt,
      negativePrompt: item.negativePrompt,
      resultUrl: item.resultUrl,
      generatedAt: new Date().toISOString()
    }));
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_generation_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items]);

  // 获取状态图标
  const getStatusIcon = (status: BatchGenerationItem['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-[#999999]" />;
      case 'generating':
        return <div className="w-4 h-4 border-2 border-[#1473E6] border-t-transparent rounded-full animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-[#10B981]" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-[#EF4444]" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-[#3E3E42]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-[#3E3E42] bg-[#2D2D30] rounded-t-lg">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-[#1473E6]" />
            <h2 className="text-lg font-semibold text-[#CCCCCC]">批量生成</h2>
            <span className="text-sm text-[#999999]">
              ({items.filter(i => i.status === 'completed').length}/{items.length} 完成)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#3E3E42] rounded transition-colors"
          >
            <X className="w-5 h-5 text-[#999999] hover:text-[#CCCCCC]" />
          </button>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center gap-4 p-4 border-b border-[#3E3E42] bg-[#2D2D30]">
          <button
            onClick={() => addItem('image')}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-[#1473E6] hover:bg-[#0F66D3] text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Image className="w-4 h-4" />
            <span>添加图片生成</span>
          </button>
          
          <button
            onClick={() => addItem('video')}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-[#00E5FF] hover:bg-[#7C3AED] text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Video className="w-4 h-4" />
            <span>添加视频生成</span>
          </button>
          
          <div className="flex-1" />
          
          <button
            onClick={exportResults}
            disabled={items.filter(i => i.status === 'completed').length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#3E3E42] hover:bg-[#454545] text-[#CCCCCC] rounded-lg transition-colors disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>导出结果</span>
          </button>
          
          {isGenerating ? (
            <button
              onClick={stopGeneration}
              className="flex items-center gap-2 px-4 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg transition-colors"
            >
              <Zap className="w-4 h-4" />
              <span>停止生成</span>
            </button>
          ) : (
            <button
              onClick={startBatchGeneration}
              disabled={items.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>开始批量生成</span>
            </button>
          )}
        </div>

        {/* 全局进度条 */}
        {isGenerating && (
          <div className="p-4 bg-[#1E1E1E] border-b border-[#3E3E42]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#999999]">总体进度</span>
              <span className="text-sm text-[#CCCCCC]">{Math.round(globalProgress)}%</span>
            </div>
            <div className="w-full bg-[#3E3E42] rounded-full h-2">
              <div
                className="bg-[#1473E6] h-2 rounded-full transition-all duration-300"
                style={{ width: `${globalProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* 项目列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#999999]">
              <Layers className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">点击上方按钮添加批量生成项目</p>
              <p className="text-sm mt-2">支持批量生成多个图片或视频素材</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`bg-[#2D2D30] rounded-lg border border-[#3E3E42] overflow-hidden ${
                    currentItemIndex === index ? 'ring-2 ring-[#1473E6]' : ''
                  }`}
                >
                  {/* 项目头部 */}
                  <div className="flex items-center gap-3 p-4 bg-[#252526] border-b border-[#3E3E42]">
                    <div className="flex items-center justify-center w-8 h-8 bg-[#3E3E42] rounded-full text-sm font-medium text-[#CCCCCC]">
                      {index + 1}
                    </div>
                    
                    {item.type === 'image' ? (
                      <Image className="w-5 h-5 text-gray-500" />
                    ) : (
                      <Video className="w-5 h-5 text-purple-500" />
                    )}
                    
                    <span className="text-[#CCCCCC] font-medium">
                      {item.type === 'image' ? '图片生成' : '视频生成'}
                    </span>
                    
                    <div className="flex-1" />
                    
                    {getStatusIcon(item.status)}
                    
                    {item.status === 'pending' && (
                      <>
                        <button
                          onClick={() => duplicateItem(item.id)}
                          className="p-1.5 hover:bg-[#3E3E42] rounded transition-colors"
                          title="复制"
                        >
                          <Copy className="w-4 h-4 text-[#999999]" />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 hover:bg-[#3E3E42] rounded transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-[#999999]" />
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* 项目内容 */}
                  <div className="p-4 space-y-4">
                    {/* 提示词输入 */}
                    <div>
                      <label className="block text-sm text-[#999999] mb-2">提示词</label>
                      <textarea
                        value={item.prompt}
                        onChange={(e) => updateItem(item.id, { prompt: e.target.value })}
                        disabled={isGenerating}
                        placeholder="输入您想要生成的内容描述..."
                        className="w-full h-24 px-3 py-2 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-[#CCCCCC] placeholder-[#666666] resize-none focus:outline-none focus:border-[#1473E6] disabled:opacity-50"
                      />
                    </div>
                    
                    {/* 负面提示词 */}
                    <div>
                      <label className="block text-sm text-[#999999] mb-2">负面提示词 (可选)</label>
                      <input
                        type="text"
                        value={item.negativePrompt || ''}
                        onChange={(e) => updateItem(item.id, { negativePrompt: e.target.value })}
                        disabled={isGenerating}
                        placeholder="输入您不想出现的内容..."
                        className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-[#CCCCCC] placeholder-[#666666] focus:outline-none focus:border-[#1473E6] disabled:opacity-50"
                      />
                    </div>
                    
                    {/* 配置选项 */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-[#999999] mb-2">模型提供商</label>
                        <select
                          value={item.config.modelProvider}
                          onChange={(e) => updateItem(item.id, {
                            config: { ...item.config, modelProvider: e.target.value }
                          })}
                          disabled={isGenerating}
                          className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-[#CCCCCC] focus:outline-none focus:border-[#1473E6] disabled:opacity-50"
                        >
                          {item.type === 'image' ? (
                            <>
                              <optgroup label="图片生成">
                                <option value="doubao">豆包</option>
                                <option value="stable_diffusion">Stable Diffusion XL</option>
                                <option value="seedream">Seedream</option>
                                <option value="ideogram">Ideogram</option>
                                <option value="recraft_ai">Recraft</option>
                                <option value="leonardo_ai">Leonardo AI</option>
                                <option value="adobe_firefly">Adobe Firefly</option>
                              </optgroup>
                            </>
                          ) : (
                            <>
                              <optgroup label="视频生成">
                                <option value="doubao">豆包视频</option>
                              </optgroup>
                            </>
                          )}
                        </select>
                      </div>
                      
                      {item.type === 'image' ? (
                        <div>
                          <label className="block text-sm text-[#999999] mb-2">宽高比</label>
                          <select
                            value={item.config.aspectRatio}
                            onChange={(e) => updateItem(item.id, {
                              config: { ...item.config, aspectRatio: e.target.value }
                            })}
                            disabled={isGenerating}
                            className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-[#CCCCCC] focus:outline-none focus:border-[#1473E6] disabled:opacity-50"
                          >
                            <option value="1:1">1:1 (方形)</option>
                            <option value="16:9">16:9 (横版)</option>
                            <option value="9:16">9:16 (竖版)</option>
                            <option value="4:3">4:3</option>
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm text-[#999999] mb-2">分辨率</label>
                          <select
                            value={item.config.resolution}
                            onChange={(e) => updateItem(item.id, {
                              config: { ...item.config, resolution: e.target.value }
                            })}
                            disabled={isGenerating}
                            className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-[#CCCCCC] focus:outline-none focus:border-[#1473E6] disabled:opacity-50"
                          >
                            <option value="16:9">16:9 (1920x1080)</option>
                            <option value="9:16">9:16 (1080x1920)</option>
                            <option value="1:1">1:1 (1080x1080)</option>
                          </select>
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-sm text-[#999999] mb-2">生成数量</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={item.config.count}
                          onChange={(e) => updateItem(item.id, {
                            config: { ...item.config, count: parseInt(e.target.value) || 1 }
                          })}
                          disabled={isGenerating}
                          className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-[#CCCCCC] focus:outline-none focus:border-[#1473E6] disabled:opacity-50"
                        />
                      </div>
                    </div>
                    
                    {/* 进度条 */}
                    {item.status === 'generating' && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[#999999]">生成进度</span>
                          <span className="text-[#CCCCCC]">{item.progress}%</span>
                        </div>
                        <div className="w-full bg-[#3E3E42] rounded-full h-2">
                          <div
                            className="bg-[#1473E6] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* 错误信息 */}
                    {item.status === 'failed' && (
                      <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
                        <p className="text-sm text-[#EF4444]">{item.error}</p>
                      </div>
                    )}
                    
                    {/* 成功结果 */}
                    {item.status === 'completed' && item.resultUrl && (
                      <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg">
                        <p className="text-sm text-[#10B981]">生成完成!</p>
                        <p className="text-xs text-[#999999] mt-1">结果已保存到文件列表</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部统计 */}
        <div className="p-4 border-t border-[#3E3E42] bg-[#2D2D30] rounded-b-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <span className="text-[#999999]">
                总项目数: <span className="text-[#CCCCCC] font-medium">{items.length}</span>
              </span>
              <span className="text-[#999999]">
                待处理: <span className="text-[#CCCCCC] font-medium">{items.filter(i => i.status === 'pending').length}</span>
              </span>
              <span className="text-[#999999]">
                进行中: <span className="text-[#1473E6] font-medium">{items.filter(i => i.status === 'generating').length}</span>
              </span>
              <span className="text-[#999999]">
                已完成: <span className="text-[#10B981] font-medium">{items.filter(i => i.status === 'completed').length}</span>
              </span>
              <span className="text-[#999999]">
                失败: <span className="text-[#EF4444] font-medium">{items.filter(i => i.status === 'failed').length}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchGenerationPanel;
