/**
 * AI生成增强面板UI组件
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Copy, History, Lightbulb, BarChart3, Award, Star } from 'lucide-react';
import { aiEnhancementService } from './enhancement-service';
import {
  GenerationResult,
  ParameterChange,
  PromptSuggestion,
  ParameterTestConfig,
  QualityScore
} from './types';

interface AIGenerationEnhancementPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'compare' | 'history' | 'suggestions' | 'testing' | 'scoring';

const AIGenerationEnhancementPanel: React.FC<AIGenerationEnhancementPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('compare');
  const [generationResults, setGenerationResults] = useState<GenerationResult[]>([]);
  const [parameterChanges, setParameterChanges] = useState<ParameterChange[]>([]);
  const [promptSuggestions, setPromptSuggestions] = useState<PromptSuggestion[]>([]);
  const [, setParameterTests] = useState<ParameterTestConfig[]>([]);
  const [qualityScores, setQualityScores] = useState<QualityScore[]>([]);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState('');

  const loadData = useCallback(() => {
    setGenerationResults(aiEnhancementService.getAllGenerationResults());
    setParameterChanges(aiEnhancementService.getParameterChanges());
    setPromptSuggestions(aiEnhancementService.getPromptSuggestions());
    setParameterTests(aiEnhancementService.getParameterTests());
    setQualityScores(aiEnhancementService.getQualityScores());
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const toggleSelectForCompare = (id: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        if (prev.length >= 4) {
          return [...prev.slice(1), id];
        }
        return [...prev, id];
      }
    });
  };

  const toggleFavorite = (id: string) => {
    aiEnhancementService.toggleFavorite(id);
    loadData();
  };

  const handleGenerateSuggestions = () => {
    if (!currentPrompt.trim()) return;
    const suggestions = aiEnhancementService.generatePromptSuggestions(currentPrompt);
    setPromptSuggestions(suggestions);
  };
  const _handleScoreGeneration = (generationId: string) => {
    aiEnhancementService.generateQualityScore(generationId);
    loadData();
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#10B981';
    if (score >= 80) return '#9CA3AF';
    if (score >= 70) return '#00E5FF';
    return '#EF4444';
  };

  const tabs = [
    { id: 'compare' as TabType, label: '结果对比', icon: Copy },
    { id: 'history' as TabType, label: '参数记录', icon: History },
    { id: 'suggestions' as TabType, label: '提示词建议', icon: Lightbulb },
    { id: 'testing' as TabType, label: '批量测试', icon: BarChart3 },
    { id: 'scoring' as TabType, label: '质量评分', icon: Award },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1F1F1F] rounded-2xl w-[850px] max-h-[85vh] overflow-hidden shadow-2xl border border-[#333333]">
        <div className="flex items-center justify-between p-6 border-b border-[#333333]">
          <div>
            <h2 className="text-xl font-bold text-white">AI生成增强工具</h2>
            <p className="text-sm text-white/60">结果对比、参数记录、提示词优化、批量测试、质量评分</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="flex border-b border-[#333333]">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#10B981] border-b-2 border-[#10B981]'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 140px)' }}>
          {activeTab === 'compare' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">选择结果进行对比（最多4个）</h3>
              <div className="grid grid-cols-3 gap-4">
                {generationResults.slice(0, 9).map(result => (
                  <div
                    key={result.id}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedForCompare.includes(result.id) ? 'border-[#10B981]' : 'border-transparent'
                    }`}
                    onClick={() => toggleSelectForCompare(result.id)}
                  >
                    {result.imageUrl && (
                      <img src={result.imageUrl} alt="" className="w-full h-32 object-cover" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(result.id); }}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
                    >
                      <Star className={`w-4 h-4 ${result.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} />
                    </button>
                    <div className="p-2 bg-[#2A2A2A]">
                      <p className="text-xs text-white/60 truncate">{result.modelProvider}</p>
                      {result.qualityScore && (
                        <p className="text-sm font-medium" style={{ color: getScoreColor(result.qualityScore) }}>
                          质量: {result.qualityScore}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">参数变更记录</h3>
              <div className="space-y-3">
                {parameterChanges.slice(0, 10).map(change => (
                  <div key={change.id} className="p-4 bg-[#2A2A2A] rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{change.parameterName}</span>
                      <span className="text-xs text-white/60">
                        {new Date(change.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-red-400 line-through">{String(change.oldValue)}</span>
                      <span className="text-white/40">→</span>
                      <span className="text-sm text-green-400">{String(change.newValue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'suggestions' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">提示词优化</h3>
              <div className="mb-4">
                <textarea
                  value={currentPrompt}
                  onChange={(e) => setCurrentPrompt(e.target.value)}
                  placeholder="输入你的提示词..."
                  className="w-full p-3 bg-[#2A2A2A] border border-[#333333] rounded-lg text-white resize-none"
                  rows={3}
                />
                <button
                  onClick={handleGenerateSuggestions}
                  className="mt-3 px-4 py-2 bg-[#10B981] text-white rounded-lg hover:bg-[#0EA572] transition-colors"
                >
                  生成优化建议
                </button>
              </div>
              <div className="space-y-3">
                {promptSuggestions.map(suggestion => (
                  <div key={suggestion.id} className="p-4 bg-[#2A2A2A] rounded-lg">
                    <p className="text-sm text-white/60 mb-2">{suggestion.reason}</p>
                    <p className="text-white mb-2">{suggestion.suggestedPrompt}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/40">置信度: {(suggestion.confidence * 100).toFixed(0)}%</span>
                      <div className="flex gap-2">
                        {suggestion.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 text-xs bg-[#10B981]/20 text-[#10B981] rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'testing' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">批量参数测试</h3>
              <p className="text-white/60">暂无测试配置</p>
            </div>
          )}

          {activeTab === 'scoring' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">质量评分</h3>
              <div className="space-y-3">
                {qualityScores.map(score => {
                  const result = generationResults.find(r => r.id === score.generationId);
                  return (
                    <div key={score.id} className="p-4 bg-[#2A2A2A] rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-medium">
                          {result?.modelProvider || 'Unknown'}
                        </span>
                        <span
                          className="text-2xl font-bold"
                          style={{ color: getScoreColor(score.overallScore) }}
                        >
                          {score.overallScore}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-2 mb-3">
                        {Object.entries(score.dimensions).map(([key, value]) => (
                          <div key={key} className="text-center">
                            <p className="text-xs text-white/60 capitalize">{key}</p>
                            <p className="text-sm font-medium text-white">{value.toFixed(0)}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-white/80">{score.aiFeedback}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIGenerationEnhancementPanel;
