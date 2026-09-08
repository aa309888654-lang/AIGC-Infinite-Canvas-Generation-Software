import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Star, TrendingUp, Zap, DollarSign, BarChart3, Filter, Search, Heart, ChevronRight, CheckCircle, AlertCircle, Award, Settings } from 'lucide-react';

import { modelRegistry, ModelInfo } from '@/services/model-registry';
import { modelPerformanceMonitor} from '@/services/model-performance-monitor';
import { intelligentRecommendationEngine, ModelRecommendation, RecommendationOptions } from '@/services/intelligent-recommendation-engine';
import { costManagementSystem} from '@/services/cost-management-system';
import { useNodeModels } from '@/hooks/useNodeModels';
import { useMembershipStore } from '@/store/useMembershipStore';
import { mergeImageModelPresets } from '@/components/canvas/nodes/AIImageNode';

type TabType = 'all' | 'image' | 'video' | 'popular' | 'recommendations' | 'comparison';

interface ModelMarketplaceProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LocalModelItem {
  name: string;
  size: string;
  compatibility: string;
  note: string;
}

interface LocalModelGroup {
  vram: string;
  description: string;
  imageModels: LocalModelItem[];
  videoModels: LocalModelItem[];
}

const LOCAL_MODEL_GROUPS: LocalModelGroup[] = [
  {
    vram: '6G 显存',
    description: '优先 SD1.5 生态，视频建议短片段和低分辨率。',
    imageModels: [
      { name: 'Stable Diffusion 1.5', size: '约 2.0GB', compatibility: '推荐', note: '最稳，适合 512×512/512×768' },
      { name: 'DreamShaper 8', size: '约 2.1GB', compatibility: '推荐', note: 'SD1.5 泛用写实/插画模型' },
      { name: 'Realistic Vision', size: '约 2.0GB', compatibility: '推荐', note: '写实人像，适合低显存' },
      { name: 'Anything v5', size: '约 2.1GB', compatibility: '推荐', note: '二次元，SD1.x 生态' },
      { name: 'Counterfeit-V3.0', size: '约 2.1GB', compatibility: '推荐', note: '插画/动漫风格' },
      { name: 'MeinaMix', size: '约 2.0GB', compatibility: '推荐', note: '动漫/半写实' },
      { name: 'SD Turbo', size: '约 2.1GB', compatibility: '可用', note: '少步数快速预览' },
      { name: 'SDXL Turbo', size: '约 6.9GB', compatibility: '勉强', note: '需低显存/CPU offload，建议 512/768' },
      { name: 'FLUX.1 Schnell GGUF/NF4', size: '约 4-8GB', compatibility: '勉强', note: '需 ComfyUI 量化工作流，速度较慢' },
    ],
    videoModels: [
      { name: 'AnimateDiff + SD1.5', size: '约 3.5-4GB', compatibility: '推荐', note: '运动模块约 1.6GB + SD1.5，适合短视频/动图' },
      { name: 'LTX-Video 2B 量化版', size: '约 3-5GB', compatibility: '可用', note: '建议 ComfyUI 量化节点' },
      { name: 'CogVideoX-2B 量化版', size: '约 4-6GB', compatibility: '勉强', note: '低分辨率可尝试，速度慢' },
      { name: 'Stable Video Diffusion XT', size: '约 9.5GB', compatibility: '勉强', note: '需低显存/CPU offload，生成慢' },
      { name: 'Wan2.1 T2V/I2V 1.3B 量化版', size: '约 6-9GB', compatibility: '勉强', note: '需要量化和 offload' },
    ],
  },
  {
    vram: '8G 显存',
    description: '可更舒服运行 SDXL 系，视频可尝试更多 2B/轻量量化模型。',
    imageModels: [
      { name: 'Stable Diffusion XL Base 1.0', size: '约 6.9GB', compatibility: '推荐', note: '1024 基础生图，建议 fp16/低显存优化' },
      { name: 'Juggernaut XL', size: '约 6.6GB', compatibility: '推荐', note: 'SDXL 写实泛用，商业质感较好' },
      { name: 'RealVisXL', size: '约 6.5GB', compatibility: '推荐', note: 'SDXL 写实人像/产品图' },
      { name: 'DreamShaper XL', size: '约 6.5GB', compatibility: '推荐', note: 'SDXL 泛用插画和写实' },
      { name: 'Animagine XL', size: '约 6.5GB', compatibility: '可用', note: 'SDXL 二次元模型' },
      { name: 'FLUX.1 Schnell NF4/GGUF', size: '约 4-8GB', compatibility: '可用', note: '量化版可跑，速度取决于 offload' },
    ],
    videoModels: [
      { name: 'AnimateDiff SDXL', size: '约 8-10GB', compatibility: '可用', note: '建议低分辨率、短帧数' },
      { name: 'Stable Video Diffusion XT', size: '约 9.5GB', compatibility: '可用', note: '图生视频，需优化参数' },
      { name: 'LTX-Video 2B', size: '约 5-7GB', compatibility: '推荐', note: '轻量视频模型，适合本地尝试' },
      { name: 'CogVideoX-2B', size: '约 6-8GB', compatibility: '可用', note: '建议量化或 CPU offload' },
      { name: 'Wan2.1 1.3B 量化版', size: '约 6-9GB', compatibility: '可用', note: '文本/图片转视频可尝试' },
    ],
  },
  {
    vram: '16G 显存',
    description: '可作为本地生图/轻量视频主力，支持更多高质量和更高分辨率工作流。',
    imageModels: [
      { name: 'Stable Diffusion XL Base/Refiner', size: '约 13GB', compatibility: '推荐', note: 'Base + Refiner 工作流更完整' },
      { name: 'Pony Diffusion XL', size: '约 6.5GB', compatibility: '推荐', note: '二次元/角色向 SDXL 模型' },
      { name: 'Playground v2.5', size: '约 6.5GB', compatibility: '推荐', note: '高质量 SDXL 系泛用模型' },
      { name: 'Stable Cascade', size: '约 12-20GB', compatibility: '可用', note: '可尝试完整级联工作流' },
      { name: 'FLUX.1 Schnell FP8/NF4', size: '约 11-17GB', compatibility: '推荐', note: '本地 FLUX 更实用的配置' },
      { name: 'FLUX.1 Dev FP8/NF4', size: '约 12-18GB', compatibility: '可用', note: '质量更高，速度和内存压力更大' },
    ],
    videoModels: [
      { name: 'CogVideoX-5B 量化版', size: '约 10-14GB', compatibility: '可用', note: '比 2B 质量更好，建议量化' },
      { name: 'Wan2.1 T2V/I2V 1.3B', size: '约 9-12GB', compatibility: '推荐', note: '可更稳定运行非极限参数' },
      { name: 'Wan2.1 14B 量化版', size: '约 12-20GB', compatibility: '勉强', note: '需要量化/offload，速度较慢' },
      { name: 'HunyuanVideo 量化版', size: '约 12-20GB', compatibility: '勉强', note: '可实验，工作流复杂' },
      { name: 'Mochi 1 量化版', size: '约 12-18GB', compatibility: '可用', note: '适合高显存本地视频实验' },
    ],
  },
];

const ModelMarketplace: React.FC<ModelMarketplaceProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [recommendations, setRecommendations] = useState<ModelRecommendation[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [comparingModels, setComparingModels] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // ===== 复用节点下拉的模型显示名称 =====
  const { models: aiImageModels } = useNodeModels('aiImage');
  const { groupedOptions: videoGroupedOptions } = useNodeModels('aiVideo');
  const membershipLevel = useMembershipStore((s) => s.membership?.membershipLevel || 'trial');

  const modelNameMap = useMemo(() => {
    const map = new Map<string, string>();

    // 图片模型：复用 AI 图片节点的命名逻辑
    const imagePresets = mergeImageModelPresets(aiImageModels, membershipLevel);
    for (const preset of imagePresets) {
      // preset.id 格式如 "doubao-doubao-seedream-5-0-pro"，与 ModelInfo.id 一致
      map.set(preset.id, preset.label);
      // 也存入不含 provider 前缀的原始 modelId
      const rawId = preset.id.includes('-') ? preset.id.split('-').slice(1).join('-') : preset.id;
      if (rawId !== preset.id) map.set(rawId, preset.label);
    }

    // 视频模型：复用 AI 视频节点的 modelInfo.name
    for (const group of videoGroupedOptions) {
      for (const option of group.options) {
        // option.value 是原始 modelId（如 "doubao-video-1.2"）
        const value = String(option.value);
        if (!map.has(value)) {
          map.set(value, option.label);
        }
      }
    }

    return map;
  }, [aiImageModels, videoGroupedOptions, membershipLevel]);

  const getModelDisplayName = useCallback((model: ModelInfo): string => {
    return modelNameMap.get(model.id) || modelNameMap.get(model.modelId || '') || model.name;
  }, [modelNameMap]);

  const loadModels = useCallback(() => {
    let loadedModels: ModelInfo[] = [];
    
    switch (activeTab) {
      case 'image':
        loadedModels = modelRegistry.getModelsByType('image');
        break;
      case 'video':
        loadedModels = modelRegistry.getModelsByType('video');
        break;
      case 'popular': {
        const popularIds = modelRegistry.getPopularModels(20);
        loadedModels = popularIds.map(id => modelRegistry.getModelById(id.id)).filter((m): m is ModelInfo => m !== undefined);
        break;
      }
      case 'recommendations':
        break;
      default:
        loadedModels = modelRegistry.getAllModels();
    }

    if (searchQuery) {
      loadedModels = modelRegistry.searchModels(searchQuery);
    }

    setModels(loadedModels);
  }, [activeTab, searchQuery]);

  const loadRecommendations = useCallback(() => {
    const options: RecommendationOptions = {
      taskType: 'both',
      limit: 10
    };
    const recs = intelligentRecommendationEngine.recommendModels(options);
    setRecommendations(recs);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadModels();
      loadRecommendations();
    }
  }, [isOpen, loadModels, loadRecommendations]);

  const toggleFavorite = useCallback((modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const favorites = modelRegistry.getFavoriteModels('default');
    const isFavorite = favorites.some(m => m.id === modelId);
    
    if (isFavorite) {
      modelRegistry.removeFromFavorites(modelId, 'default');
    } else {
      modelRegistry.addToFavorites(modelId, 'default');
    }
    
    loadModels();
  }, [loadModels]);

  const toggleCompare = useCallback((modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setComparingModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId);
      }
      if (prev.length < 3) {
        return [...prev, modelId];
      }
      return prev;
    });
  }, []);

  const renderStars = (rating: number, size = 14) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            size={size}
            className={`${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
          />
        ))}
      </div>
    );
  };

  const renderSpeedBadge = (speed?: 'fast' | 'medium' | 'slow') => {
    const colors = {
      fast: 'bg-green-500/20 text-green-400 border-green-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      slow: 'bg-red-500/20 text-red-400 border-red-500/30'
    };

    const labels = {
      fast: '快速',
      medium: '中等',
      slow: '慢速'
    };

    if (!speed) return null;

    return (
      <span className={`px-2 py-0.5 rounded-md text-xs border ${colors[speed]}`}>
        {labels[speed]}
      </span>
    );
  };

  const renderModelCard = (model: ModelInfo, recommendation?: ModelRecommendation) => {
    const isFavorite = modelRegistry.getFavoriteModels('default').some(m => m.id === model.id);
    const isComparing = comparingModels.includes(model.id);

    return (
      <div
        key={model.id}
        className={`bg-[#242428] border border-[#2D2D2D] rounded-xl p-4 cursor-pointer transition-all hover:border-[#007AFF]/50 hover:shadow-lg ${selectedModel?.id === model.id ? 'border-[#007AFF]' : ''}`}
        onClick={() => setSelectedModel(model)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white">{getModelDisplayName(model)}</h3>
              {model.isPopular && (
                <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">热门</span>
              )}
            </div>
            <p className="text-sm text-gray-400">{model.provider}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => toggleCompare(model.id, e)}
              className={`p-1.5 rounded-lg transition-colors ${isComparing ? 'bg-[#007AFF] text-white' : 'hover:bg-[#2D2D2D] text-gray-400'}`}
            >
              <BarChart3 size={16} />
            </button>
            <button
              onClick={(e) => toggleFavorite(model.id, e)}
              className={`p-1.5 rounded-lg transition-colors ${isFavorite ? 'text-red-500' : 'hover:bg-[#2D2D2D] text-gray-400'}`}
            >
              <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-3 line-clamp-2">{model.description}</p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {model.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-[#2D2D2D] text-gray-300 rounded text-xs">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {renderStars(model.qualityRating || 0)}
            {renderSpeedBadge(model.estimatedSpeed)}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {model.costPerImage && (
              <span className="text-green-400">${model.costPerImage.toFixed(3)}</span>
            )}
            {model.costPerMinute && (
              <span className="text-gray-400">${model.costPerMinute.toFixed(2)}/min</span>
            )}
          </div>
        </div>

        {recommendation && recommendation.reasons.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#2D2D2D]">
            <div className="flex items-center gap-1.5 text-xs text-[#007AFF]">
              <Award size={12} />
              <span>推荐原因:</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {recommendation.reasons.slice(0, 2).map((reason, idx) => (
                <span key={idx} className="px-1.5 py-0.5 bg-[#007AFF]/10 text-[#007AFF] rounded text-xs">
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLocalModelCard = (model: LocalModelItem, type: '图片' | '视频') => {
    return (
      <div key={`${type}-${model.name}`} className="rounded-lg border border-[#2D2D2D] bg-[#1A1A1D] p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium text-white">{model.name}</h4>
            <p className="mt-0.5 text-xs text-gray-500">{model.size}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${type === '图片' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
              {type}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${model.compatibility === '推荐' ? 'bg-green-500/20 text-green-300' : model.compatibility === '可用' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-orange-500/20 text-orange-300'}`}>
              {model.compatibility}
            </span>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-gray-400">{model.note}</p>
      </div>
    );
  };

  const renderLocalModelPanel = () => {
    return (
      <section className="w-full bg-[#242428] border border-[#2D2D2D] rounded-xl p-4">
        <div className="mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Settings size={16} />
            本地模型
          </h3>
          <p className="mt-1 text-xs text-gray-400">按 6G / 8G / 16G 显存分类；本软件按 ComfyUI/本地服务接入兼容</p>
        </div>

        <div className="space-y-5">
          {LOCAL_MODEL_GROUPS.map((group) => (
            <div key={group.vram} className="rounded-xl border border-[#2D2D2D] bg-black/10 p-3">
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-white">{group.vram}</h4>
                <p className="mt-1 text-xs text-gray-500">{group.description}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-purple-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                    图片模型
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {group.imageModels.map((model) => renderLocalModelCard(model, '图片'))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-blue-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                    视频模型
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {group.videoModels.map((model) => renderLocalModelCard(model, '视频'))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderComparisonPanel = () => {
    if (comparingModels.length < 2) return null;

    const modelsToCompare = comparingModels.map(id => modelRegistry.getModelById(id)).filter((m): m is ModelInfo => m !== undefined);

    return (
      <div className="bg-[#242428] border border-[#2D2D2D] rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <BarChart3 size={18} />
            模型对比
          </h3>
          <button
            onClick={() => setComparingModels([])}
            className="text-sm text-gray-400 hover:text-white"
          >
            清除
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2D2D2D]">
                <th className="text-left py-2 px-3 text-sm text-gray-400">特性</th>
                {modelsToCompare.map(model => (
                  <th key={model.id} className="text-center py-2 px-3 text-sm text-white">
                    {getModelDisplayName(model)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#2D2D2D]/50">
                <td className="py-2 px-3 text-sm text-gray-400">提供商</td>
                {modelsToCompare.map(model => (
                  <td key={model.id} className="text-center py-2 px-3 text-sm text-gray-300">
                    {model.provider}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#2D2D2D]/50">
                <td className="py-2 px-3 text-sm text-gray-400">质量评分</td>
                {modelsToCompare.map(model => (
                  <td key={model.id} className="text-center py-2 px-3">
                    {renderStars(model.qualityRating || 0, 12)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#2D2D2D]/50">
                <td className="py-2 px-3 text-sm text-gray-400">速度</td>
                {modelsToCompare.map(model => (
                  <td key={model.id} className="text-center py-2 px-3">
                    {renderSpeedBadge(model.estimatedSpeed)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 px-3 text-sm text-gray-400">成本</td>
                {modelsToCompare.map(model => (
                  <td key={model.id} className="text-center py-2 px-3 text-sm">
                    {model.costPerImage && (
                      <span className="text-green-400">${model.costPerImage.toFixed(3)}</span>
                    )}
                    {model.costPerMinute && (
                      <span className="text-gray-400 ml-1">${model.costPerMinute.toFixed(2)}/min</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  if (selectedModel) {
    const perfStats = modelPerformanceMonitor.getModelPerformanceStats(selectedModel.id);
    const costEstimate = costManagementSystem.estimateCost(selectedModel.id, selectedModel.type === 'image' ? 'image' : 'video');
    const optimizationSuggestions = costManagementSystem.getOptimizationSuggestions(selectedModel.type === 'image' ? 'image' : 'video', selectedModel.id);
    const isFavorite = modelRegistry.getFavoriteModels('default').some(m => m.id === selectedModel.id);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-[#1A1A1D] border border-[#2D2D2D] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-[#2D2D2D]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedModel(null)}
                className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <ChevronRight size={20} className="rotate-180" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-white">{getModelDisplayName(selectedModel)}</h2>
                <p className="text-xs text-gray-400">{selectedModel.provider}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => toggleFavorite(selectedModel.id, e)}
                className={`p-2 rounded-lg transition-colors ${isFavorite ? 'text-red-500' : 'hover:bg-[#2D2D2D] text-gray-400'}`}
              >
                <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#242428] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-medium text-white">质量评分</h3>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{selectedModel.qualityRating?.toFixed(1) || '-'}</div>
                {renderStars(selectedModel.qualityRating || 0, 16)}
              </div>
              
              <div className="bg-[#242428] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-gray-400" />
                  <h3 className="font-medium text-white">速度</h3>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {selectedModel.estimatedSpeed === 'fast' ? '快' : selectedModel.estimatedSpeed === 'medium' ? '中' : '慢'}
                </div>
                {renderSpeedBadge(selectedModel.estimatedSpeed)}
              </div>

              <div className="bg-[#242428] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <h3 className="font-medium text-white">预估成本</h3>
                </div>
                <div className="text-3xl font-bold text-green-400 mb-1">${costEstimate.estimatedCost.toFixed(3)}</div>
                <p className="text-xs text-gray-400">置信度: {costEstimate.confidence === 'high' ? '高' : costEstimate.confidence === 'medium' ? '中' : '低'}</p>
              </div>

              <div className="bg-[#242428] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  <h3 className="font-medium text-white">使用次数</h3>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{perfStats.totalTasks}</div>
                <p className="text-xs text-gray-400">成功率: {(perfStats.successRate * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="bg-[#242428] rounded-xl p-4 mb-6">
              <h3 className="font-medium text-white mb-3">模型描述</h3>
              <p className="text-gray-400">{selectedModel.description}</p>
            </div>

            <div className="bg-[#242428] rounded-xl p-4 mb-6">
              <h3 className="font-medium text-white mb-3">能力</h3>
              <div className="flex flex-wrap gap-2">
                {selectedModel.capabilities.map(cap => (
                  <span key={cap} className="px-3 py-1 bg-[#2D2D2D] text-gray-300 rounded-lg text-sm">
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-[#242428] rounded-xl p-4 mb-6">
              <h3 className="font-medium text-white mb-3">标签</h3>
              <div className="flex flex-wrap gap-2">
                {selectedModel.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-[#007AFF]/20 text-[#007AFF] rounded-lg text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {optimizationSuggestions.length > 0 && (
              <div className="bg-[#242428] rounded-xl p-4">
                <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Settings size={18} />
                  成本优化建议
                </h3>
                <div className="space-y-3">
                  {optimizationSuggestions.map(suggestion => (
                    <div key={suggestion.id} className="bg-[#2D2D2D] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-white">{suggestion.title}</h4>
                        <span className="text-green-400 text-sm">节省 ~${suggestion.estimatedSavings.toFixed(2)}</span>
                      </div>
                      <p className="text-sm text-gray-400">{suggestion.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1A1A1D] border border-[#2D2D2D] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2D2D2D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AI模型市场</h2>
              <p className="text-xs text-gray-400">发现、对比和选择最佳AI模型</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-[#2D2D2D] sm:grid-cols-3 lg:grid-cols-5">
          {[
            { id: 'all', label: '全部', icon: TrendingUp },
            { id: 'image', label: '图片生成', icon: CheckCircle },
            { id: 'video', label: '视频生成', icon: AlertCircle },
            { id: 'popular', label: '热门推荐', icon: Award },
            { id: 'recommendations', label: '智能推荐', icon: Star }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-[#007AFF] text-white' : 'hover:bg-[#2D2D2D] text-gray-400'}`}
              >
                <Icon size={16} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2D2D2D]">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="搜索模型..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#242428] border border-[#2D2D2D] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#007AFF]"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-[#007AFF] text-white' : 'hover:bg-[#2D2D2D] text-gray-400'}`}
          >
            <Filter size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {renderComparisonPanel()}

          {activeTab === 'recommendations' ? (
            <div className="space-y-4">
              {recommendations.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendations.map(rec => renderModelCard(rec.model, rec))}
                </div>
              )}
              {renderLocalModelPanel()}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {models.map(model => renderModelCard(model))}
            </div>
          )}

          {activeTab !== 'recommendations' && models.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="w-12 h-12 text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">未找到模型</h3>
              <p className="text-gray-400">尝试调整搜索条件或筛选器</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelMarketplace;
