import React, { useMemo } from 'react';
import { Bot, Sparkles, Cpu, Fingerprint, Activity, Wand2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CopilotSuggestion {
  id: string;
  label: string;
  desc: string;
  action?: () => void;
}

interface MusicAICopilotProps {
  /** 当前选中的风格标签 */
  styles?: string[];
  /** 当前选中的情绪 */
  moods?: string[];
  /** 创作模式 */
  mode?: 'simple' | 'custom' | 'cover' | 'full';
  /** 额外建议 */
  suggestions?: CopilotSuggestion[];
  /** 嵌入侧栏时隐藏引擎详情，避免与预设区重叠 */
  compact?: boolean;
  className?: string;
}

const ENGINE_FEATURES = [
  { icon: Cpu, label: '神经作曲', desc: '大模型理解曲式与和声' },
  { icon: Fingerprint, label: '风格识别', desc: '14+ 流派精准匹配' },
  { icon: Activity, label: '动态编排', desc: '旋律与节奏自适应' },
  { icon: Wand2, label: '智能导演', desc: '歌词·封面·情绪联动' },
];

const CALM_MOODS = new Set(['治愈', '宁静', 'calm', 'dreamy', 'tender', 'melancholy']);
const ENERGY_MOODS = new Set(['热血', '激情', 'energetic', 'passionate', 'epic', 'triumphant']);
const FOREST_STYLES = new Set(['folk', 'lofi', 'ambient', 'acoustic', 'country', 'newage']);
const ELECTRONIC_STYLES = new Set(['electronic', 'edm', 'house', 'techno', 'synthwave', 'trap']);

function buildAdaptiveHints(styles: string[], moods: string[]): string[] {
  const hints: string[] = [];
  if (styles.length === 0 && moods.length === 0) {
    hints.push('描述你想要的场景，AI 将推荐最佳风格组合');
    hints.push('可尝试「民谣 + 治愈」营造森林创作氛围');
    return hints;
  }
  if (styles.some((s) => FOREST_STYLES.has(s))) {
    hints.push('森林氛围建议：加入原声吉他与自然音效');
  }
  if (styles.some((s) => ELECTRONIC_STYLES.has(s))) {
    hints.push('电子流派：可叠加合成器铺底增强空间感');
  }
  if (moods.some((m) => CALM_MOODS.has(m))) {
    hints.push('情绪适配：慢速 BPM + 柔和人声更契合治愈感');
  }
  if (moods.some((m) => ENERGY_MOODS.has(m))) {
    hints.push('高能量场景：建议选用摇滚或 EDM 强化节奏冲击');
  }
  if (styles.length >= 2) {
    hints.push(`已选 ${styles.length} 种风格，AI 将智能融合编曲`);
  }
  if (hints.length === 0) {
    hints.push('参数已就绪，可一键生成或先让 AI 作词');
  }
  return hints.slice(0, 4);
}

/**
 * AI 音乐智能副驾 — 展示大模型联动状态与主动适配建议
 */
const MusicAICopilot: React.FC<MusicAICopilotProps> = ({
  styles = [],
  moods = [],
  mode = 'simple',
  suggestions = [],
  compact = false,
  className,
}) => {
  const hints = useMemo(() => buildAdaptiveHints(styles, moods), [styles, moods]);

  const modeLabel =
    mode === 'cover' ? '翻唱迁移' :
    mode === 'custom' ? '专业工作室' :
    mode === 'full' ? '全流程导演' : '灵感速创';

  return (
    <aside className={cn('mf-copilot', compact && 'mf-copilot--compact', className)}>
      <div className="mf-copilot__header">
        <div className="mf-copilot__avatar">
          <Bot size={18} strokeWidth={1.8} />
          <span className="mf-copilot__pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mf-copilot__title">AI 音乐导演</p>
          <p className="mf-copilot__sub">高质量大模型 · 深度匹配引擎</p>
        </div>
        <span className="mf-status">
          <span className="mf-status__dot" />
          在线
        </span>
      </div>

      <div className="mf-copilot__engine">
        <p className="mf-copilot__section-label">
          <Sparkles size={11} />
          神经引擎 v3.2
        </p>
        <div className="mf-copilot__features">
          {ENGINE_FEATURES.map((f) => (
            <div key={f.label} className="mf-copilot__feature">
              <f.icon size={13} className="text-emerald-400/80 shrink-0" />
              <div className="min-w-0">
                <p className="mf-copilot__feature-label">{f.label}</p>
                <p className="mf-copilot__feature-desc">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mf-copilot__session">
        <p className="mf-copilot__section-label">当前会话</p>
        <div className="mf-copilot__chips">
          <span className="mf-chip">{modeLabel}</span>
          {styles.length > 0 && (
            <span className="mf-chip">{styles.length} 风格</span>
          )}
          {moods.length > 0 && (
            <span className="mf-chip">{moods.length} 情绪</span>
          )}
        </div>
      </div>

      <div className="mf-copilot__hints">
        <p className="mf-copilot__section-label">主动适配建议</p>
        <ul className="mf-copilot__hint-list">
          {hints.map((hint, i) => (
            <li key={i} className="mf-copilot__hint-item">
              <ChevronRight size={12} className="shrink-0 text-emerald-500/60" />
              <span>{hint}</span>
            </li>
          ))}
        </ul>
      </div>

      {suggestions.length > 0 && (
        <div className="mf-copilot__actions">
          <p className="mf-copilot__section-label">快捷操作</p>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={s.action}
                className="mf-copilot__action-btn"
              >
                <span className="font-bold text-[11px] text-white">{s.label}</span>
                <span className="text-[10px] text-white/80">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

export default MusicAICopilot;
