import { useState, useCallback, useEffect, useRef } from 'react';
import {
  X,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Sparkles,
  Video,
  Image as ImageIcon,
  Brain,
  Loader2,
  Send,
  RotateCcw,
  MessageSquare,
  Swords,
  Trophy,
  Film,
  Box,
  Music,
  Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  optimizePrompt,
  type OptimizationScenario,
  type ProfessionalCategory,
  professionalCategories
} from '@/services/prompt-optimizer-api';

interface PromptOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalPrompt: string;
  onApply: (optimizedPrompt: string, preserveOriginal?: boolean) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'fighting': return <Swords className="w-3 h-3" />;
    case 'sports': return <Trophy className="w-3 h-3" />;
    case 'animation': return <Film className="w-3 h-3" />;
    case 'cinematic': return <Video className="w-3 h-3" />;
    case 'product': return <Box className="w-3 h-3" />;
    case 'music-video': return <Music className="w-3 h-3" />;
    default: return <Palette className="w-3 h-3" />;
  }
};

export function PromptOptimizerModal({
  isOpen,
  onClose,
  originalPrompt,
  onApply
}: PromptOptimizerModalProps) {
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [scenario, setScenario] = useState<OptimizationScenario>('video');
  const [category, setCategory] = useState<ProfessionalCategory>('cinematic');
  const [isAIOptimizing, setIsAIOptimizing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [preserveOriginal, setPreserveOriginal] = useState(true);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [hasOptimized, setHasOptimized] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleAIOptimize = useCallback(async () => {
    if (!originalPrompt.trim()) {
      setAiError('提示词不能为空');
      return;
    }

    setIsAIOptimizing(true);
    setAiError(null);
    setHasOptimized(false);
    setChatMessages([]);

    try {
      const result = await optimizePrompt(originalPrompt, scenario, category);

      if (result.success && result.optimizedPrompt) {
        setOptimizedPrompt(result.optimizedPrompt);
        setHasOptimized(true);
      } else {
        setAiError(result.error || '优化失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '优化失败，请检查网络或提示词语法';
      setAiError(errorMessage);
    } finally {
      setIsAIOptimizing(false);
    }
  }, [originalPrompt, scenario, category]);

  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading || !optimizedPrompt) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const refinementPrompt = `请基于以下当前提示词，根据用户的修改要求进行调整，只输出修改后的完整提示词，不要输出任何解释或分析：\n\n当前提示词：\n${optimizedPrompt}\n\n用户修改要求：${userMessage.content}`;

      const result = await optimizePrompt(refinementPrompt, scenario, category);

      if (result.success && result.optimizedPrompt) {
        const newPrompt = result.optimizedPrompt;
        setOptimizedPrompt(newPrompt);
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '已根据您的要求修改提示词'
        };
        setChatMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `修改失败：${result.error || '未知错误'}，请重试`
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '修改失败，请检查网络连接后重试'
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, isChatLoading, optimizedPrompt, scenario, category]);

  const handleReset = useCallback(() => {
    setOptimizedPrompt('');
    setHasOptimized(false);
    setChatMessages([]);
    setAiError(null);
  }, []);

  const handleApply = useCallback(() => {
    if (optimizedPrompt) {
      onApply(optimizedPrompt, preserveOriginal);
      onClose();
    }
  }, [optimizedPrompt, preserveOriginal, onApply, onClose]);

  const handleCopy = useCallback(() => {
    if (optimizedPrompt) {
      navigator.clipboard.writeText(optimizedPrompt);
    }
  }, [optimizedPrompt]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  }, [handleChatSend]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative rounded-xl border flex flex-col overflow-hidden"
        style={{
          width: '620px',
          maxHeight: '85vh',
          backgroundColor: '#1A1A1E',
          borderColor: '#3D3D42',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-gray-600 to-cyan-600">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white">AI 提示词优化</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* AI 一键优化区域 */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-gray-600/20 to-cyan-600/20 border border-gray-500/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-white">AI 一键优化</span>
              </div>
              {hasOptimized && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-all"
                >
                  <RotateCcw className="w-3 h-3" />
                  重新优化
                </button>
              )}
            </div>

            {/* 场景选择 */}
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setScenario('video')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all",
                  scenario === 'video'
                    ? "bg-gradient-to-r from-gray-600 to-cyan-600 text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                <Video className="w-3 h-3" />
                视频生产
              </button>
              <button
                onClick={() => setScenario('image')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all",
                  scenario === 'image'
                    ? "bg-gradient-to-r from-cyan-600 to-gray-600 text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                <ImageIcon className="w-3 h-3" />
                图片生产
              </button>
            </div>

            {/* 专业主题分类 */}
            {scenario === 'video' && (
              <div className="mb-2">
                <div className="text-[10px] text-gray-400 mb-1.5">专业主题分类</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {professionalCategories.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value as ProfessionalCategory)}
                      className={cn(
                        "flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[10px] transition-all",
                        category === cat.value
                          ? "bg-gray-600 text-white"
                          : "bg-white/5 text-white/70 hover:bg-white/10"
                      )}
                    >
                      {getCategoryIcon(cat.value)}
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 一键优化按钮 */}
            <button
              onClick={handleAIOptimize}
              disabled={isAIOptimizing || !originalPrompt.trim()}
              className={cn(
                "w-full py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-xs",
                isAIOptimizing || !originalPrompt.trim()
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-[#28A745] to-[#1E7B34] hover:from-[#218838] hover:to-[#1A6B2C] text-white shadow-lg shadow-green-500/20"
              )}
            >
              {isAIOptimizing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  优化中...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  一键优化
                </>
              )}
            </button>

            {/* 错误提示 */}
            {aiError && (
              <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                <span className="text-[10px] text-red-400">{aiError}</span>
              </div>
            )}
          </div>

          {/* 优化结果 - 只显示最终提示词 */}
          {hasOptimized && (
            <div className="rounded-lg bg-green-500/5 border border-green-500/20">
              <div className="flex items-center justify-between px-3 py-2 border-b border-green-500/10">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs font-medium text-green-400">优化结果</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-all"
                >
                  <Copy className="w-3 h-3" />
                  复制
                </button>
              </div>
              <div className="p-3">
                <p className="text-xs text-white leading-relaxed whitespace-pre-wrap">
                  {optimizedPrompt}
                </p>
              </div>
            </div>
          )}

          {/* 多轮对话区域 */}
          {hasOptimized && (
            <div className="rounded-lg bg-[#252528] border border-[#3D3D42]">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#3D3D42]">
                <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-white">对话修改</span>
                <span className="text-[10px] text-gray-500 ml-1">输入要求继续优化提示词</span>
              </div>

              {/* 对话消息列表 */}
              <div className="max-h-40 overflow-y-auto px-3 py-2 space-y-2">
                {chatMessages.length === 0 && (
                  <div className="text-center py-3">
                    <p className="text-[10px] text-gray-500">例如：增加电影感、调整色调为暖色、添加慢动作效果...</p>
                  </div>
                )}
                {chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2",
                      msg.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] px-2.5 py-1.5 rounded-lg text-[11px] leading-relaxed",
                        msg.role === 'user'
                          ? "bg-gray-600/30 text-gray-200 border border-gray-500/20"
                          : "bg-green-500/10 text-green-300 border border-green-500/20"
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start gap-2">
                    <div className="px-2.5 py-1.5 rounded-lg text-[11px] bg-green-500/10 text-green-300 border border-green-500/20 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      修改中...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* 对话输入框 */}
              <div className="px-3 py-2 border-t border-[#3D3D42]">
                <div className="flex gap-2">
                  <textarea
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入修改要求..."
                    rows={1}
                    className="flex-1 bg-[#1E1E22] border border-[#4A4A4E] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-gray-500/50 resize-none"
                    style={{ maxHeight: '60px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 60) + 'px';
                    }}
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || isChatLoading}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all flex items-center justify-center",
                      chatInput.trim() && !isChatLoading
                        ? "bg-gray-600 hover:bg-gray-500 text-white"
                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    )}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#252528] border-t border-[#3D3D42]">
          <label className="flex items-center gap-1.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={preserveOriginal}
              onChange={(e) => setPreserveOriginal(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#4A4A4E] bg-[#1E1E22] text-green-500 focus:ring-green-500/30 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors">
              保留原意
            </span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[10px] text-gray-400 hover:text-white bg-[#2D2D2D] border border-[#4A4A4E] rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              disabled={!optimizedPrompt}
              className="px-4 py-1.5 text-[10px] font-medium text-white bg-gradient-to-r from-[#28A745] to-[#1E7B34] hover:from-[#218838] hover:to-[#1A6B2C] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3 h-3" />
              应用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PromptOptimizerModal;
