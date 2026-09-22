// 提示词输入框组件 - 带一键自动优化功能
import { useState, useCallback } from 'react';
import { Sparkles, Loader2, Video } from 'lucide-react';
import { optimizePrompt } from '@/lib/prompt-optimizer';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  label?: string;
  isJimeng?: boolean;
}

// 自动检测内容类型 - 人物默认中国风格
function detectContentType(prompt: string): 'product' | 'character' | 'architecture' | 'nature' | 'abstract' | 'chinese-style' {
  const lower = prompt.toLowerCase();
  if (/产品|商品|物体|物品|device|item|object|product/.test(lower)) return 'product';
  // 人物/角色默认中国风格
  if (/人物|角色|人|character|portrait|human|男|女|先生|女士|小姐|女士|老师|总裁|经理|总监|领导|嘉宾|主持|演讲|博士|教授|院长|校长|创始人|CEO|CTO|CFO|COO|VP|chief|director|manager|executive|officer/i.test(lower)) return 'chinese-style';
  if (/建筑|房间|室内|building|interior|room/.test(lower)) return 'architecture';
  if (/风景|自然|landscape|nature|场景/.test(lower)) return 'nature';
  // 检测是否明确指定了非中国文化
  const hasExplicitNonChinese = /(欧美|西方|日本|日式|韩国|韩式|纽约|巴黎|伦敦|罗马|哥特|维多利亚|american|western|european|japanese|korean|gothic|victorian)/i.test(lower);
  if (!hasExplicitNonChinese) return 'chinese-style';
  return 'abstract';
}

export function PromptInput({
  value,
  onChange,
  placeholder = "输入提示词...",
  rows = 3,
  label,
  isJimeng = false
}: PromptInputProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  // IME输入法兼容状态
  const [isComposing, setIsComposing] = useState(false);

  // 一键自动优化
  const handleAutoOptimize = useCallback(async () => {
    if (!value.trim()) return;
    
    setIsOptimizing(true);
    await new Promise(r => setTimeout(r, 400));
    
    const contentType = detectContentType(value);
    const categoryMap = {
      product: 'product-render',
      character: 'model-render',
      architecture: '3d-render',
      nature: '3d-render',
      abstract: 'model-render',
      'chinese-style': '3d-render'
    };

    const optimized = optimizePrompt(value, {
      category: categoryMap[contentType] as any,
      shotType: 'medium-shot',
      focalLength: 50,
      aperture: 2.8,
      params: ['hyperRealistic', 'studioLighting', '8kResolution']
    });

    // 默认添加中国风关键词（当用户未明确指定其他国家/文化时）
    let finalResult = optimized;
    const hasExplicitNonChinese = /(欧美|西方|日本|日式|韩国|韩式|纽约|巴黎|伦敦|罗马|哥特|维多利亚|american|western|european|japanese|korean|gothic|victorian)/i.test(value);
    if (!hasExplicitNonChinese && !finalResult.includes('中国风格') && !finalResult.includes('东方美学') && !finalResult.includes('中式')) {
      const lower = value.toLowerCase();
      let chineseKeywords = '';
      if (/建筑|楼|房|城|街|桥|塔|院|园|室|house|building|city|street|tower/i.test(lower)) {
        chineseKeywords = '中式建筑, 东方美学';
      } else if (/人|女|男|角色|人物|person|woman|man|character|portrait/i.test(lower)) {
        chineseKeywords = '中国人物, 东方美学';
      } else if (/风景|山水|自然|landscape|nature|mountain|river/i.test(lower)) {
        chineseKeywords = '中国风格, 水墨意境';
      } else {
        chineseKeywords = '中国风格, 东方美学';
      }
      finalResult = finalResult + ', ' + chineseKeywords;
    }

    onChange(finalResult);
    setIsOptimizing(false);
  }, [value, onChange]);

  const handleGoToVideo = useCallback(() => {
    window.location.href = '/ai-view?type=video';
  }, []);

  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      
      {/* 操作按钮组 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {/* 生成视频按钮 */}
        <button
          type="button"
          onClick={handleGoToVideo}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Video style={{ width: '14px', height: '14px' }} />
          生成视频
        </button>
        
        {/* 优化按钮 */}
        <button
          type="button"
          onClick={handleAutoOptimize}
          disabled={isOptimizing || !value.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            background: isOptimizing ? '#888' : 'linear-gradient(to right, #00E5FF, #EC4899)',
            color: 'white',
            border: 'none',
            cursor: isOptimizing || !value.trim() ? 'not-allowed' : 'pointer',
            opacity: isOptimizing || !value.trim() ? 0.5 : 1,
          }}
        >
          {isOptimizing ? (
            <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
          ) : (
            <Sparkles style={{ width: '14px', height: '14px' }} />
          )}
          {isOptimizing ? '优化中...' : 'AI优化'}
        </button>
      </div>
      
      {/* 使用标准HTML textarea - 支持IME输入法 */}
      <textarea
        value={value}
        onChange={(e) => {
          if (!isComposing) {
            onChange(e.target.value);
          }
        }}
        onInput={(e) => {
          if (!isComposing) {
            onChange((e.target as HTMLTextAreaElement).value);
          }
        }}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={(e) => {
          setIsComposing(false);
          // IME结束后更新值
          onChange((e.target as HTMLTextAreaElement).value);
        }}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          minHeight: rows ? `${rows * 24}px` : '72px',
          resize: 'vertical',
          padding: '12px 14px',
          borderRadius: '10px',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-elevated)',
          color: isJimeng ? 'white' : 'var(--text-primary)',
          fontSize: '14px',
          fontFamily: 'inherit',
          lineHeight: 1.6,
          outline: 'none',
          imeMode: 'active',
        }}
      />
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default PromptInput;
