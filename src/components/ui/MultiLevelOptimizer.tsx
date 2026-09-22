import React, { useState, useCallback, useMemo } from 'react';
import { Zap, Sparkles, Award, Check, Info, TrendingUp, Star, Crown, Rocket, Target, Lightbulb, Wand2, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OptimizationLevel = 'basic' | 'professional' | 'cinematic';

interface OptimizationStrategy {
  id: OptimizationLevel;
  name: string;
  description: string;
  icon: React.ReactNode;
  cost: number;
  features: string[];
  improvements: string[];
  estimatedQuality: 'good' | 'excellent' | 'premium';
  color: string;
  gradient: string;
}

const OPTIMIZATION_STRATEGIES: OptimizationStrategy[] = [
  {
    id: 'basic',
    name: '基础优化',
    description: '快速提升提示词质量，适合日常使用',
    icon: <Zap className="w-5 h-5" />,
    cost: 1,
    features: ['语法修正', '关键词补全', '结构优化', '去重精简'],
    improvements: ['提升清晰度 20%', '优化语法', '补充缺失信息'],
    estimatedQuality: 'good',
    color: 'text-gray-400',
    gradient: 'from-gray-600 to-cyan-500'
  },
  {
    id: 'professional',
    name: '专业增强',
    description: '深度优化，添加专业术语和风格元素',
    icon: <Sparkles className="w-5 h-5" />,
    cost: 3,
    features: [
      '专业术语注入',
      '光影描述增强',
      '构图建议',
      '风格一致性检查',
      '质量评分优化'
    ],
    improvements: [
      '提升清晰度 45%',
      '专业术语库',
      '光影/构图优化',
      '风格统一性'
    ],
    estimatedQuality: 'excellent',
    color: 'text-purple-400',
    gradient: 'from-purple-600 to-pink-500'
  },
  {
    id: 'cinematic',
    name: '电影级优化',
    description: '顶级优化，达到电影级视觉效果描述',
    icon: <Crown className="w-5 h-5" />,
    cost: 8,
    features: [
      '电影级语言重构',
      '导演视角分析',
      '多维度细节填充',
      '情感氛围营造',
      '技术参数精确化',
      '行业标杆对齐'
    ],
    improvements: [
      '提升清晰度 80%+',
      '电影级描述语言',
      '完整视觉叙事',
      '专业参数配置',
      '行业顶级标准'
    ],
    estimatedQuality: 'premium',
    color: 'text-amber-400',
    gradient: 'from-amber-500 to-orange-600'
  }
];

interface MultiLevelOptimizerProps {
  value: string;
  onOptimize?: (level: OptimizationLevel) => void;
  isOptimizing?: boolean;
  userPoints?: number;
  currentLevel?: OptimizationLevel;
}

interface QualityScore {
  overall: number;
  clarity: number;
  detail: number;
  creativity: number;
  technical: number;
}

function analyzePromptQuality(prompt: string): QualityScore {
  if (!prompt.trim()) {
    return { overall: 0, clarity: 0, detail: 0, creativity: 0, technical: 0 };
  }

  const length = prompt.length;
  const wordCount = prompt.split(/\s+/).length;

  const hasParameters = /[:[<>]/.test(prompt);
  const hasStyleKeywords = /(写实|动漫|油画|电影|赛博|奇幻)/i.test(prompt);
  const hasLightingKeywords = /(光线|光照|阴影|高光|逆光|柔光)/i.test(prompt);
  const hasCompositionKeywords = /(构图|三分法|对称|前景|背景|景深)/i.test(prompt);
  const hasTechnicalKeywords = /(镜头|焦距|ISO|快门|光圈|广角|长焦)/i.test(prompt);

  const clarity = Math.min(100,
    (wordCount > 3 ? 40 : 20) +
    (length > 20 ? 20 : 10) +
    (hasParameters ? 20 : 10)
  );

  const detail = Math.min(100,
    (wordCount > 10 ? 30 : 15) +
    (hasStyleKeywords ? 25 : 10) +
    (hasLightingKeywords || hasCompositionKeywords ? 25 : 10) +
    (hasTechnicalKeywords ? 20 : 10)
  );

  const creativity = Math.min(100,
    (hasStyleKeywords ? 35 : 15) +
    (/^(?!.*(?:一个|一张|这是))/.test(prompt) ? 30 : 15) +
    (prompt.includes('，') && prompt.length > 50 ? 20 : 10) +
    (Math.random() * 15)
  );

  const technical = Math.min(100,
    (hasTechnicalKeywords ? 40 : 10) +
    (hasLightingKeywords ? 25 : 10) +
    (hasCompositionKeywords ? 25 : 10) +
    (hasParameters ? 10 : 5)
  );

  const overall = Math.round((clarity + detail + creativity + technical) / 4);

  return {
    overall,
    clarity: Math.round(clarity),
    detail: Math.round(detail),
    creativity: Math.round(creativity),
    technical: Math.round(technical)
  };
}

function getRecommendedLevel(score: QualityScore): OptimizationLevel {
  if (score.overall >= 70) return 'basic';
  if (score.overall >= 40) return 'professional';
  return 'cinematic';
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function MultiLevelOptimizer({
  value,
  onOptimize,
  isOptimizing,
  userPoints = 100,
  currentLevel
}: MultiLevelOptimizerProps) {
  const [selectedLevel, setSelectedLevel] = useState<OptimizationLevel>(currentLevel || 'professional');
  const [showDetails, setShowDetails] = useState(false);

  const qualityScore = useMemo(() => analyzePromptQuality(value), [value]);
  const recommendedLevel = useMemo(() => getRecommendedLevel(qualityScore), [qualityScore]);

  const handleSelectLevel = useCallback((level: OptimizationLevel) => {
    setSelectedLevel(level);
  }, []);

  const handleOptimize = useCallback(() => {
    onOptimize?.(selectedLevel);
  }, [onOptimize, selectedLevel]);

  const canAfford = useCallback((cost: number) => userPoints >= cost, [userPoints]);

  return (
    <div className="bg-[#1A1A1D] rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[#15151A] border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-white">多层次优化策略</span>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 hover:bg-white/5 rounded transition-colors"
          >
            <Info className={cn(
              'w-4 h-4 transition-colors',
              showDetails ? 'text-purple-400' : 'text-gray-500'
            )} />
          </button>
        </div>
      </div>

      {/* Quality Score */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400">当前提示词质量评分</span>
          <div className="flex items-center gap-2">
            <span className={cn('text-lg font-bold', getScoreColor(qualityScore.overall))}>
              {qualityScore.overall}
            </span>
            <span className="text-xs text-gray-500">/100</span>
          </div>
        </div>

        {/* Score Bars */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: '清晰度', score: qualityScore.clarity, icon: <Lightbulb className="w-3 h-3" /> },
            { label: '细节', score: qualityScore.detail, icon: <Sparkles className="w-3 h-3" /> },
            { label: '创意', score: qualityScore.creativity, icon: <Star className="w-3 h-3" /> },
            { label: '技术', score: qualityScore.technical, icon: <Wand2 className="w-3 h-3" /> }
          ].map(item => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  {item.icon}
                  {item.label}
                </span>
                <span className={cn('text-[10px] font-medium', getScoreColor(item.score))}>
                  {item.score}
                </span>
              </div>
              <div className="h-1 bg-[#252528] rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-300', getScoreBgColor(item.score))}
                  style={{ width: `${item.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Recommendation */}
        {value.trim() && (
          <div className={cn(
            'px-3 py-2 rounded-lg flex items-center gap-2',
            recommendedLevel === 'cinematic' ? 'bg-purple-500/10 border border-purple-500/20' :
            recommendedLevel === 'professional' ? 'bg-gray-500/10 border border-gray-500/20' :
            'bg-green-500/10 border border-green-500/20'
          )}>
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-gray-300">
              推荐使用
              <span className={cn('font-medium ml-1', OPTIMIZATION_STRATEGIES.find(s => s.id === recommendedLevel)?.color)}>
                {OPTIMIZATION_STRATEGIES.find(s => s.id === recommendedLevel)?.name}
              </span>
              可将质量提升至
              <span className="font-medium ml-1">
                {recommendedLevel === 'cinematic' ? '95+' : recommendedLevel === 'professional' ? '85+' : '75+'}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Strategy Selection */}
      <div className="p-4 space-y-3">
        {OPTIMIZATION_STRATEGIES.map(strategy => (
          <button
            key={strategy.id}
            onClick={() => handleSelectLevel(strategy.id)}
            disabled={!canAfford(strategy.cost)}
            className={cn(
              'w-full p-3 rounded-lg border transition-all text-left relative overflow-hidden group',
              selectedLevel === strategy.id
                ? 'border-current bg-white/[0.03]'
                : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]',
              !canAfford(strategy.cost) && 'opacity-50 cursor-not-allowed'
            )}
            style={{
              borderColor: selectedLevel === strategy.id ? undefined : undefined,
              ...(selectedLevel === strategy.id && {
                borderColor: strategy.color.replace('text-', ''),
                background: `linear-gradient(135deg, ${strategy.color.includes('blue') ? 'rgba(156, 163, 175,0.05)' : strategy.color.includes('purple') ? 'rgba(168,85,247,0.05)' : 'rgba(245,158,11,0.05)'}, transparent)`
              })
            }}
          >
            {/* Selected indicator */}
            {selectedLevel === strategy.id && (
              <div className={cn(
                'absolute left-0 top-0 bottom-0 w-1 rounded-r',
                strategy.color.replace('text-', 'bg-')
              )} />
            )}

            <div className="flex items-start gap-3 pl-2">
              <div className={cn(
                'p-2 rounded-lg shrink-0',
                strategy.gradient ? `bg-gradient-to-br ${strategy.gradient}` : 'bg-[#2d2d35]'
              )}>
                <div className="text-white">{strategy.icon}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-medium text-sm', strategy.color)}>
                      {strategy.name}
                    </span>
                    {strategy.id === recommendedLevel && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">
                        推荐
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    <span className="text-xs font-mono text-yellow-400">{strategy.cost}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-2 line-clamp-1">{strategy.description}</p>
                <div className="flex flex-wrap gap-1">
                  {strategy.features.slice(0, 3).map(feature => (
                    <span key={feature} className="text-[10px] px-1.5 py-0.5 bg-[#252528] rounded text-gray-400">
                      {feature}
                    </span>
                  ))}
                  {strategy.features.length > 3 && (
                    <span className="text-[10px] px-1.5 py-0.5 text-gray-600">
                      +{strategy.features.length - 3}
                    </span>
                  )}
                </div>
              </div>
              {selectedLevel === strategy.id && (
                <Check className={cn('w-5 h-5 shrink-0', strategy.color)} />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Details Panel */}
      {showDetails && selectedLevel && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-[#15151A] rounded-lg border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-white">优化效果预览</span>
            </div>
            {(() => {
              const strategy = OPTIMIZATION_STRATEGIES.find(s => s.id === selectedLevel)!;
              return (
                <>
                  <div className="space-y-2 mb-3">
                    {strategy.improvements.map(improvement => (
                      <div key={improvement} className="flex items-center gap-2">
                        <ArrowUp className="w-3 h-3 text-green-400" />
                        <span className="text-xs text-gray-300">{improvement}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">预估输出质量</span>
                      <span className={cn('font-medium', strategy.color)}>
                        {strategy.estimatedQuality === 'premium' ? '⭐⭐⭐ 电影级' :
                         strategy.estimatedQuality === 'excellent' ? '⭐⭐ 专业级' :
                         '⭐ 基础级'}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="px-4 pb-4">
        <button
          onClick={handleOptimize}
          disabled={isOptimizing || !value.trim() || !canAfford(OPTIMIZATION_STRATEGIES.find(s => s.id === selectedLevel)?.cost || 0)}
          className={cn(
            'w-full py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2',
            isOptimizing
              ? 'bg-[#2d2d35] text-gray-500 cursor-wait'
              : !value.trim()
              ? 'bg-[#2d2d35] text-gray-600 cursor-not-allowed'
              : cn('bg-gradient-to-r hover:opacity-90 text-white',
                OPTIMIZATION_STRATEGIES.find(s => s.id === selectedLevel)?.gradient)
          )}
        >
          {isOptimizing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              优化中...
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4" />
              开始{OPTIMIZATION_STRATEGIES.find(s => s.id === selectedLevel)?.name}
              <span className="text-xs opacity-70">
                (-{OPTIMIZATION_STRATEGIES.find(s => s.id === selectedLevel)?.cost} 积分)
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
