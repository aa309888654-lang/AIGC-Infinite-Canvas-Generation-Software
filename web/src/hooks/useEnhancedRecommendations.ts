// @ts-nocheck
/**
 * 增强型推荐Hook
 * 提供分组、筛选、排序等功能
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  RecommendationItem,
  RecommendationGroup,
  RecommendationFilter,
  RecommendationConfig,
  RecommendationType,
  RecommendationSource,
} from '@/types/enhanced-recommendations';
import {
  DEFAULT_RECOMMENDATION_CONFIG,
  RECOMMENDATION_TYPE_LABELS,
  _RECOMMENDATION_SOURCE_LABELS,
} from '@/types/enhanced-recommendations';

interface UseEnhancedRecommendationsReturn {
  /** 所有推荐 */
  recommendations: RecommendationItem[];
  /** 分组后的推荐 */
  groupedRecommendations: RecommendationGroup[];
  /** 添加推荐 */
  addRecommendation: (item: RecommendationItem) => void;
  /** 添加多个推荐 */
  addRecommendations: (items: RecommendationItem[]) => void;
  /** 移除推荐 */
  removeRecommendation: (id: string) => void;
  /** 清空推荐 */
  clearRecommendations: () => void;
  /** 标记为已应用 */
  markAsApplied: (id: string) => void;
  /** 设置筛选 */
  setFilter: (filter: RecommendationFilter) => void;
  /** 重置筛选 */
  resetFilter: () => void;
  /** 获取单个推荐 */
  getRecommendation: (id: string) => RecommendationItem | undefined;
  /** 推荐数量 */
  totalCount: number;
  /** 过滤后数量 */
  filteredCount: number;
  /** 当前筛选条件 */
  currentFilter: RecommendationFilter;
  /** 获取分组统计 */
  getGroupStats: (type: RecommendationType) => RecommendationGroup['stats'] | undefined;
  /** 高分推荐 */
  topRecommendations: RecommendationItem[];
  /** 最近推荐 */
  recentRecommendations: RecommendationItem[];
}

const STORAGE_KEY = 'prompt_recommendations_cache';

export function useEnhancedRecommendations(
  initialConfig?: Partial<RecommendationConfig>
): UseEnhancedRecommendationsReturn {
  const config = { ...DEFAULT_RECOMMENDATION_CONFIG, ...initialConfig };
  
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [filter, setFilterState] = useState<RecommendationFilter>({});
  const [currentConfig, setCurrentConfig] = useState<RecommendationConfig>(config);
  
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  // 从localStorage恢复
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        // 只保留最近24小时的推荐
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const validItems = (data.recommendations || []).filter(
          (item: RecommendationItem) => item.createdAt > oneDayAgo
        );
        setRecommendations(validItems);
      }
    } catch (error) {
      console.error('[Recommendations] 恢复缓存失败:', error);
    }
  }, []);

  // 保存到localStorage
  useEffect(() => {
    if (!initializedRef.current) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        recommendations,
        lastUpdated: Date.now(),
      }));
    } catch (error) {
      console.error('[Recommendations] 保存缓存失败:', error);
    }
  }, [recommendations]);

  // 自动刷新
  useEffect(() => {
    if (!currentConfig.autoRefreshInterval) return;

    autoRefreshTimerRef.current = setInterval(() => {
      // 清理过期的推荐
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      setRecommendations(prev => 
        prev.filter(item => item.createdAt > oneDayAgo)
      );
    }, currentConfig.autoRefreshInterval);

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [currentConfig.autoRefreshInterval]);

  // 过滤后的推荐
  const filteredRecommendations = useMemo(() => {
    let filtered = [...recommendations];

    if (filter.types && filter.types.length > 0) {
      filtered = filtered.filter(item => filter.types!.includes(item.type));
    }

    if (filter.sources && filter.sources.length > 0) {
      filtered = filtered.filter(item => filter.sources!.includes(item.source));
    }

    if (filter.minScore !== undefined) {
      filtered = filtered.filter(item => item.score >= filter.minScore!);
    }

    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter(item =>
        item.tags?.some(tag => filter.tags!.includes(tag))
      );
    }

    if (filter.searchKeyword) {
      const keyword = filter.searchKeyword.toLowerCase();
      filtered = filtered.filter(item =>
        item.content.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword) ||
        item.tags?.some(tag => tag.toLowerCase().includes(keyword))
      );
    }

    // 按分数排序
    filtered.sort((a, b) => b.score - a.score);

    // 限制数量
    return filtered.slice(0, currentConfig.maxRecommendations);
  }, [recommendations, filter, currentConfig.maxRecommendations]);

  // 分组推荐
  const groupedRecommendations = useMemo(() => {
    if (!currentConfig.enableGrouping) return [];

    const groups = new Map<RecommendationType, RecommendationItem[]>();

    // 初始化所有类型
    (Object.keys(RECOMMENDATION_TYPE_LABELS) as RecommendationType[]).forEach(type => {
      groups.set(type, []);
    });

    // 分配推荐到各组
    filteredRecommendations.forEach(item => {
      const group = groups.get(item.type);
      if (group) {
        group.push(item);
      }
    });

    // 转换为分组数组
    return Array.from(groups.entries())
      .filter(([_, items]) => items.length > 0)
      .map(([type, items]) => {
        const scores = items.map(i => i.score);
        return {
          id: `group_${type}`,
          name: RECOMMENDATION_TYPE_LABELS[type],
          type,
          items,
          stats: {
            totalCount: items.length,
            averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            topScore: Math.max(...scores),
          },
        };
      });
  }, [filteredRecommendations, currentConfig.enableGrouping]);

  // 添加推荐
  const addRecommendation = useCallback((item: RecommendationItem) => {
    setRecommendations(prev => {
      // 检查是否已存在相同内容
      const exists = prev.some(
        r => r.content === item.content && r.type === item.type
      );
      if (exists) return prev;

      return [item, ...prev].slice(0, currentConfig.maxRecommendations * 2);
    });
  }, [currentConfig.maxRecommendations]);

  // 添加多个推荐
  const addRecommendations = useCallback((items: RecommendationItem[]) => {
    setRecommendations(prev => {
      const newItems = items.filter(item => 
        !prev.some(r => r.content === item.content && r.type === item.type)
      );
      return [...newItems, ...prev].slice(0, currentConfig.maxRecommendations * 2);
    });
  }, [currentConfig.maxRecommendations]);

  // 移除推荐
  const removeRecommendation = useCallback((id: string) => {
    setRecommendations(prev => prev.filter(item => item.id !== id));
  }, []);

  // 清空推荐
  const clearRecommendations = useCallback(() => {
    setRecommendations([]);
  }, []);

  // 标记为已应用
  const markAsApplied = useCallback((id: string) => {
    setRecommendations(prev =>
      prev.map(item =>
        item.id === id ? { ...item, applied: true } : item
      )
    );
  }, []);

  // 设置筛选
  const setFilter = useCallback((newFilter: RecommendationFilter) => {
    setFilterState(newFilter);
  }, []);

  // 重置筛选
  const resetFilter = useCallback(() => {
    setFilterState({});
  }, []);

  // 获取单个推荐
  const getRecommendation = useCallback((id: string) => {
    return recommendations.find(item => item.id === id);
  }, [recommendations]);

  // 获取分组统计
  const getGroupStats = useCallback((type: RecommendationType) => {
    const group = groupedRecommendations.find(g => g.type === type);
    return group?.stats;
  }, [groupedRecommendations]);

  // 高分推荐
  const topRecommendations = useMemo(() => {
    return [...recommendations]
      .filter(item => !item.applied)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [recommendations]);

  // 最近推荐
  const recentRecommendations = useMemo(() => {
    return [...recommendations]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
  }, [recommendations]);

  return {
    recommendations: filteredRecommendations,
    groupedRecommendations,
    addRecommendation,
    addRecommendations,
    removeRecommendation,
    clearRecommendations,
    markAsApplied,
    setFilter,
    resetFilter,
    getRecommendation,
    totalCount: recommendations.length,
    filteredCount: filteredRecommendations.length,
    currentFilter: filter,
    getGroupStats,
    topRecommendations,
    recentRecommendations,
  };
}
