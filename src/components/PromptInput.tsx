/**
 * 增强版提示词输入组件
 * 集成 Qdrant 向量搜索 + 质量分析 + 智能推荐
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Save, Sparkles, Star, TrendingUp, Lightbulb, X, Video } from 'lucide-react';
import { promptService, type QualityMetrics, type QualitySuggestion } from '@/services/PromptService';
import { type SearchResult } from '@/lib/promptApi';
import { promptQualityAnalyzer } from '@/services/PromptQualityAnalyzer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ==================== 类型定义 ====================

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (text: string) => void;
  placeholder?: string;
  showSimilar?: boolean;
  showQuality?: boolean;
  autoSave?: boolean;
  className?: string;
}

interface SuggestionItem extends SearchResult {
  displayText: string;
  scorePercent: number;
}

// ==================== 主组件 ====================

export function PromptInput({
  value,
  onChange,
  onSave,
  placeholder = '输入提示词...',
  showSimilar = true,
  showQuality = true,
  className = '',
}: PromptInputProps) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [recentPrompts, setRecentPrompts] = useState<SearchResult[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [suggestionsList, setSuggestionsList] = useState<QualitySuggestion[]>([]);

  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 初始化服务
  useEffect(() => {
    promptService.initialize();
  }, []);

  // 加载热门提示词
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const hot = await promptService.getHotPrompts(5);
        setRecentPrompts(hot.map(p => ({ ...p, score: p.uses / 100 })));
      } catch (error) {
        console.error('Failed to load history:', error);
      }
    };
    loadHistory();
  }, []);

  // 实时质量分析（当 showQuality 开启时）
  useEffect(() => {
    if (!showQuality || !value.trim()) return;

    if (value.trim().length > 5) {
      const result = promptQualityAnalyzer.analyze(value);
      setQualityMetrics(result.metrics);
      setSuggestionsList(result.suggestions);
    } else {
      setQualityMetrics(null);
      setSuggestionsList([]);
    }
  }, [value, showQuality]);

  // 防抖搜索相似提示词
  useEffect(() => {
    if (!showSimilar || value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await promptService.searchSimilar(value, { limit: 6 });
        
        // 格式化显示文本
        const formatted: SuggestionItem[] = results.map(r => ({
          ...r,
          displayText: r.text.length > 60 ? r.text.substring(0, 60) + '...' : r.text,
          scorePercent: Math.round(r.score * 100),
        }));
        
        setSuggestions(formatted);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Search failed:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, showSimilar]);

  // 选择相似提示词
  const handleSelectSuggestion = useCallback((text: string, id?: string) => {
    onChange(text);
    setShowSuggestions(false);
    
    // 记录使用
    if (id) {
      promptService.recordUsage(id).catch(e => console.error('Record usage failed:', e));
    }
    
    // 聚焦回输入框
    inputRef.current?.focus();
  }, [onChange]);

  // 保存提示词到库
  const handleSave = useCallback(async () => {
    if (!value.trim() || !onSave) return;

    try {
      await promptService.savePrompt({
        text: value.trim(),
        category: 'general',
        tags: [],
      });
      
      // 可选：显示成功提示
      if (typeof window !== 'undefined') {
        toast.success('提示词已保存到 Qdrant 库！');
      }
      
      onSave(value);
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('保存失败');
    }
  }, [value, onSave]);

  // 键盘快捷键：Ctrl+S 保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (value.trim() && onSave) {
          handleSave();
        }
      }
      
      // Escape 关闭建议列表
      if (e.key === 'Escape' && showSuggestions) {
        setShowSuggestions(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value, onSave, handleSave, showSuggestions]);

  // 点击外部关闭建议列表
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.prompt-input-container')) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ========== 渲染 ==========

  return (
    <div className={cn("prompt-input-container relative w-full", className)}>
      {/* 输入框 */}
      <div className="relative">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full p-4 border-2 border-gray-200 rounded-lg 
                     focus:border-gray-500 focus:ring-2 focus:ring-gray-200 
                     transition-all duration-200 resize-none min-h-[120px]
                     bg-white dark:bg-gray-800 
                     text-gray-900 dark:text-gray-100
                     placeholder:text-gray-400"
          rows={4}
        />
        
        {/* 搜索指示器 */}
        {isSearching && (
          <div className="absolute right-3 top-3">
            <Sparkles className="w-4 h-4 animate-pulse text-gray-500" />
            <span className="ml-1 text-xs text-gray-500 animate-pulse">搜索中...</span>
          </div>
        )}

        {/* 字数统计 */}
        <div className="absolute right-3 bottom-2 text-xs text-gray-400">
          {value.length} 字符
        </div>
      </div>

      {/* ==================== 质量分数显示 ==================== */}
      {showQuality && qualityMetrics && (
        <div className="mt-2 p-3 bg-gradient-to-r from-gray-50 to-cyan-50 
                       dark:from-gray-800 dark:to-gray-700 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              🎯 提示词质量评分
            </span>
            <span className={cn(
              "text-lg font-bold",
              qualityMetrics.score >= 80 ? "text-green-600" :
              qualityMetrics.score >= 60 ? "text-yellow-600" :
              "text-red-600"
            )}>
              {qualityMetrics.score}/100
            </span>
          </div>
          
          {/* 分数条 */}
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-2">
            <div 
              className={cn(
                "h-full transition-all duration-300",
                qualityMetrics.score >= 80 ? "bg-green-500" :
                qualityMetrics.score >= 60 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${qualityMetrics.score}%` }}
            />
          </div>

          {/* 各维度得分 */}
          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
            <div className="flex justify-between">
              <span>长度</span>
              <span>{qualityMetrics.lengthScore}</span>
            </div>
            <div className="flex justify-between">
              <span>关键词</span>
              <span>{qualityMetrics.keywordScore}</span>
            </div>
            <div className="flex justify-between">
              <span>结构</span>
              <span>{qualityMetrics.structureScore}</span>
            </div>
            <div className="flex justify-between">
              <span>多样性</span>
              <span>{qualityMetrics.varietyScore}</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 相似提示词推荐 ==================== */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 
                     border-2 border-gray-300 shadow-xl rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 
                       bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Search className="w-4 h-4" />
              Qdrant 智能推荐 ({suggestions.length} 条)
            </div>
            <button 
              onClick={() => setShowSuggestions(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {suggestions.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectSuggestion(item.text, item.id)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 
                           dark:hover:bg-gray-700 border-b last:border-b-0 
                           transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm line-clamp-2 flex-1 text-left 
                           text-gray-700 dark:text-gray-300
                           group-hover:text-gray-700 dark:group-hover:text-gray-300">
                    {item.displayText}
                  </p>
                  
                  <div className="flex-shrink-0 ml-2 flex flex-col items-end gap-1">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full",
                      item.scorePercent >= 85 ? "bg-green-100 text-green-700" :
                      item.scorePercent >= 70 ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    )}>
                      <Star className="w-3 h-3" />
                      {item.scorePercent}%
                    </span>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      <span>👍 {item.likes}</span>
                      <span>📊 {item.uses}</span>
                    </div>
                  </div>
                </div>
                
                {/* 标签显示 */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-100 
                                         dark:bg-gray-700 rounded text-gray-500">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
          
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 text-center">
            💡 点击选择或按 Esc 关闭 · 数据来自 Qdrant 向量数据库
          </div>
        </div>
      )}

      {/* ==================== 历史记录快速访问 ==================== */}
      {!showSuggestions && recentPrompts.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
            <TrendingUp className="w-4 h-4" />
            <span>热门 / 最近使用</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentPrompts.slice(0, 4).map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => handleSelectSuggestion(prompt.text, prompt.id)}
                className="group px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 
                           hover:bg-gray-50 dark:hover:bg-gray-900/30 
                           rounded-full transition-all duration-200 
                           border border-transparent hover:border-gray-200
                           max-w-[200px]"
              >
                <Lightbulb className="w-3.5 h-3.5 mr-1.5 text-yellow-500 opacity-70 
                            group-hover:opacity-100 transition-opacity" />
                <span className="truncate text-gray-600 dark:text-gray-400 
                             group-hover:text-gray-700 dark:group-hover:text-gray-300">
                  {prompt.text.substring(0, 25)}
                  {prompt.text.length > 25 && '...'}
                </span>
                <span className="ml-auto pl-2 text-xs text-gray-400">
                  {Math.round(prompt.score * 100)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ==================== 改进建议 ==================== */}
      {showQuality && suggestionsList.length > 0 && (
        <div className="mt-3 space-y-2">
          {suggestionsList.map((suggestion, idx) => (
            <div
              key={idx}
              className={cn(
                "p-2 rounded-md text-sm border-l-3",
                suggestion.type === 'positive'
                  ? "bg-green-50 dark:bg-green-900/20 border-green-300 text-green-800 dark:text-green-300"
                  : "bg-orange-50 dark:bg-orange-900/20 border-orange-300 text-orange-800 dark:text-orange-300"
              )}
            >
              <span className="font-medium">
                {suggestion.type === 'positive' ? '✅' : '💡'}{' '}
                {suggestion.message}
              </span>
              {suggestion.impact > 0 && (
                <span className="ml-2 text-xs opacity-60">
                  (+{suggestion.impact})
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ==================== 跳转按钮 ==================== */}
      {value.trim() && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => window.location.href = '/ai-view?type=video'}
            className="flex items-center gap-2 px-4 py-2 
                       bg-gradient-to-r from-gray-500 to-cyan-600 
                       text-white rounded-lg shadow-md
                       hover:from-gray-600 hover:to-cyan-700 
                       active:scale-95 transform transition-all duration-200"
          >
            <Video className="w-4 h-4" />
            <span>生成视频</span>
          </button>
        </div>
      )}

      {/* ==================== 保存按钮 ==================== */}
      {onSave && value.trim() && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 
                       bg-gradient-to-r from-gray-500 to-cyan-600 
                       text-white rounded-lg shadow-md
                       hover:from-gray-600 hover:to-cyan-700 
                       active:scale-95 transform transition-all duration-200"
          >
            <Save className="w-4 h-4" />
            <span>保存到 Qdrant 提示词库</span>
            <kbd className="hidden sm:inline-flex items-center gap-1 
                        px-1.5 py-0.5 text-xs bg-white/20 rounded">
              ⌘S
            </kbd>
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== 导出 ====================

export default PromptInput;

/** 简化版本 - 仅带基本功能 */
export function SimplePromptInput(props: Omit<PromptInputProps, 'showSimilar' | 'showQuality'>) {
  return <PromptInput {...props} showSimilar={false} showQuality={false} />;
}

/** 仅带搜索功能的版本 */
export function SearchablePromptInput(props: Omit<PromptInputProps, 'showQuality'>) {
  return <PromptInput {...props} showSimilar={true} showQuality={false} />;
}

/** 仅带质量分析的版本 */
export function QualityPromptInput(props: Omit<PromptInputProps, 'showSimilar'>) {
  return <PromptInput {...props} showSimilar={false} showQuality={true} />;
}
