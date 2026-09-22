import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Copy, Lightbulb} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyntaxToken {
  type: 'parameter' | 'weight' | 'modifier' | 'text' | 'tag';
  value: string;
  start: number;
  end: number;
}

interface Suggestion {
  text: string;
  type: 'keyword' | 'style' | 'lighting' | 'composition' | 'camera';
  score: number;
}

const SYNTAX_PATTERNS = [
  { pattern: /:(\w+)/g, type: 'parameter' as const },
  { pattern: /\(([^)]+)\)/g, type: 'weight' as const },
  { pattern: /\[([^\]]+)\]/g, type: 'modifier' as const },
  { pattern: /<([^>]+)>/g, type: 'tag' as const },
];

const PROFESSIONAL_KEYWORDS: Suggestion[] = [
  { text: '精致的五官', type: 'keyword', score: 95 },
  { text: '柔和的光线', type: 'lighting', score: 90 },
  { text: '景深效果', type: 'composition', score: 85 },
  { text: '自然表情', type: 'keyword', score: 88 },
  { text: '黄金时刻', type: 'lighting', score: 95 },
  { text: '广角镜头', type: 'camera', score: 90 },
  { text: '电影感', type: 'style', score: 92 },
  { text: '赛博朋克', type: 'style', score: 88 },
  { text: '青橙色调', type: 'style', score: 85 },
  { text: '三分法构图', type: 'composition', score: 82 },
];

const STYLE_PRESETS = [
  { label: '写实', keywords: ['写实风格', '高细节', '自然光'] },
  { label: '动漫', keywords: ['动漫风格', '线条清晰', '色彩鲜艳'] },
  { label: '电影', keywords: ['电影感', '宽银幕', '戏剧光线'] },
  { label: '油画', keywords: ['油画质感', '笔触', '暖色调'] },
];

interface EnhancedPromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onOptimize?: () => void;
  isOptimizing?: boolean;
}

export default function EnhancedPromptInput({
  value,
  onChange,
  placeholder = '输入你的创意描述...',
  onOptimize,
}: EnhancedPromptInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const tokenizePrompt = useCallback((text: string): SyntaxToken[] => {
    const tokens: SyntaxToken[] = [];
    let lastIndex = 0;

    const sortedPatterns = [...SYNTAX_PATTERNS].sort((a, b) => b.pattern.source.length - a.pattern.source.length);

    for (const { pattern, type } of sortedPatterns) {
      const regex = new RegExp(pattern.source, 'g');
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match.index >= lastIndex) {
          if (match.index > lastIndex) {
            tokens.push({
              type: 'text',
              value: text.slice(lastIndex, match.index),
              start: lastIndex,
              end: match.index,
            });
          }
          tokens.push({
            type,
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
          });
          lastIndex = match.index + match[0].length;
        }
      }
    }

    if (lastIndex < text.length) {
      tokens.push({
        type: 'text',
        value: text.slice(lastIndex),
        start: lastIndex,
        end: text.length,
      });
    }

    return tokens;
  }, []);

  const getSuggestions = useCallback((text: string, cursor: number): Suggestion[] => {
    const textBeforeCursor = text.slice(0, cursor).split(/\s+/).pop() || '';
    
    if (!textBeforeCursor) return [];

    return PROFESSIONAL_KEYWORDS.filter(
      (kw) =>
        kw.text.includes(textBeforeCursor) ||
        kw.text.toLowerCase().includes(textBeforeCursor.toLowerCase())
    )
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, []);

  const highlightedContent = useMemo(() => {
    const tokens = tokenizePrompt(value);
    if (tokens.length === 0) return null;

    return tokens.map((token, index) => {
      const styleClass = {
        parameter: 'text-gray-400 bg-gray-500/20 px-0.5 rounded',
        weight: 'text-green-400 bg-green-500/20 px-0.5 rounded',
        modifier: 'text-yellow-400 bg-yellow-500/20 px-0.5 rounded',
        tag: 'text-purple-400 bg-purple-500/20 px-0.5 rounded',
        text: 'text-white',
      }[token.type];

      return (
        <span key={index} className={styleClass}>
          {token.value}
        </span>
      );
    });
  }, [value, tokenizePrompt]);

  const suggestions = useMemo(
    () => getSuggestions(value, cursorPosition),
    [value, cursorPosition, getSuggestions]
  );

  const handleSelectSuggestion = useCallback(
    (suggestion: Suggestion) => {
      const textBeforeCursor = value.slice(0, cursorPosition).split(/\s+/).pop() || '';
      const textAfterCursor = value.slice(cursorPosition);
      const newText =
        value.slice(0, cursorPosition - textBeforeCursor.length) +
        suggestion.text +
        ' ' +
        textAfterCursor;
      onChange(newText);
      setShowSuggestions(false);
      textareaRef.current?.focus();
    },
    [value, cursorPosition, onChange]
  );

  const handleInsertStylePreset = useCallback(
    (preset: typeof STYLE_PRESETS[0]) => {
      const currentText = value.trim();
      const newText = currentText
        ? `${currentText}, ${preset.keywords.join(', ')}`
        : preset.keywords.join(', ');
      onChange(newText);
    },
    [value, onChange]
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Tab' && suggestions.length > 0) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[0]);
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    },
    [suggestions, handleSelectSuggestion]
  );

  useEffect(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, [value]);

  return (
    <div className="relative">
      {/* 语法高亮层 */}
      <div
        ref={highlightRef}
        className={cn(
          'absolute inset-0 p-3 pointer-events-none overflow-hidden text-sm leading-relaxed whitespace-pre-wrap break-words',
          'font-mono'
        )}
        aria-hidden="true"
      >
        {highlightedContent || (
          <span className="text-gray-500">{placeholder}</span>
        )}
      </div>

      {/* 实际输入层 */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          setIsFocused(true);
          setShowSuggestions(true);
        }}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        onSelect={(e) => {
          const target = e.target as HTMLTextAreaElement;
          setCursorPosition(target.selectionStart);
        }}
        onClick={(e) => {
          const target = e.target as HTMLTextAreaElement;
          setCursorPosition(target.selectionStart);
        }}
        onKeyUp={(e) => {
          const target = e.target as HTMLTextAreaElement;
          setCursorPosition(target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'relative w-full min-h-[120px] p-3 bg-[#252530] text-white text-sm leading-relaxed',
          'rounded-lg border-2 transition-all resize-none',
          'placeholder:text-gray-500',
          isFocused
            ? 'border-[#10B981] focus:outline-none ring-2 ring-[#10B981]/20'
            : 'border-[#2d2d35] hover:border-[#3d3d45]'
        )}
        style={{
          fontFamily: 'inherit',
          caretColor: '#10B981',
        }}
      />

      {/* 智能建议下拉 */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#2d2d35] rounded-lg shadow-xl border border-[#3d3d45] overflow-hidden">
          <div className="px-3 py-2 border-b border-[#3d3d45]">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              智能建议 (按 Tab 快速插入)
            </span>
          </div>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm hover:bg-[#3d3d45] transition-colors flex items-center justify-between',
                index === 0 && 'bg-[#3d3d45]'
              )}
            >
              <span className="text-white">{suggestion.text}</span>
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  {
                    keyword: 'bg-gray-500/20 text-gray-400',
                    style: 'bg-purple-500/20 text-purple-400',
                    lighting: 'bg-yellow-500/20 text-yellow-400',
                    composition: 'bg-green-500/20 text-green-400',
                    camera: 'bg-cyan-500/20 text-cyan-400',
                  }[suggestion.type]
                )}
              >
                {suggestion.type === 'keyword' && '关键词'}
                {suggestion.type === 'style' && '风格'}
                {suggestion.type === 'lighting' && '光线'}
                {suggestion.type === 'composition' && '构图'}
                {suggestion.type === 'camera' && '镜头'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 风格预设快捷按钮 */}
      <div className="mt-2 flex gap-2 flex-wrap">
        {STYLE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handleInsertStylePreset(preset)}
            className={cn(
              'px-2 py-1 text-xs rounded-full transition-all',
              'bg-[#2d2d35] text-gray-400 hover:bg-[#3d3d45] hover:text-white'
            )}
          >
            + {preset.label}
          </button>
        ))}
        <button
          onClick={handleCopy}
          disabled={!value}
          className={cn(
            'px-2 py-1 text-xs rounded-full transition-all flex items-center gap-1',
            value
              ? 'bg-[#2d2d35] text-gray-400 hover:bg-[#3d3d45] hover:text-white'
              : 'bg-[#1a1a20] text-gray-600 cursor-not-allowed'
          )}
        >
          <Copy className="w-3 h-3" />
          复制
        </button>
      </div>

      {/* 语法提示 */}
      <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-3">
        <span className="flex items-center gap-1">
          <span className="text-gray-400">:param</span> 参数
        </span>
        <span className="flex items-center gap-1">
          <span className="text-green-400">(权重)</span> 强度
        </span>
        <span className="flex items-center gap-1">
          <span className="text-yellow-400">[修饰]</span> 变体
        </span>
        <span className="flex items-center gap-1">
          <span className="text-purple-400">&lt;标签&gt;</span> 风格
        </span>
      </div>
    </div>
  );
}
