/**
 * 优化模式管理 Hook
 * 集中管理优化模式选择，避免 ref 手动同步的复杂性
 */

import { useState, useCallback } from 'react';

export type OptimizationMode = 
  | 'directorAgent'  // 导演Agent架构
  | 'iterative'      // 多轮迭代优化
  | 'productAnimation' // 产品动画优化
  | 'gepa'           // GEPA进化式优化
  | 'rapo'           // RAPO优化
  | 'cinemaDirector' // 漫剧导演
  | 'filmDirector'   // 综合型影视创作
  | null;            // 无优化模式

interface OptimizationModeHandlers {
  directorAgent: () => Promise<void>;
  iterative: () => Promise<void>;
  productAnimation: () => Promise<void>;
  gepa: () => Promise<void>;
  rapo: () => Promise<void>;
  cinemaDirector: () => Promise<void>;
  filmDirector: () => Promise<void>;
}

interface UseOptimizationModeReturn {
  /** 当前选中的优化模式 */
  selectedMode: OptimizationMode;
  /** 选择优化模式（仅设置，不执行） */
  selectMode: (mode: OptimizationMode) => void;
  /** 执行选中的优化模式 */
  executeSelected: (handlers: OptimizationModeHandlers) => Promise<void>;
  /** 检查是否选中了某个模式 */
  isModeSelected: (mode: OptimizationMode) => boolean;
  /** 获取当前模式的显示名称 */
  getModeDisplayName: (mode: OptimizationMode) => string;
  /** 清除选中的模式 */
  clearMode: () => void;
}

export function useOptimizationMode(): UseOptimizationModeReturn {
  const [selectedMode, setSelectedMode] = useState<OptimizationMode>(null);

  /** 选择优化模式 */
  const selectMode = useCallback((mode: OptimizationMode) => {
    setSelectedMode(mode);
  }, []);

  /** 执行选中的优化模式 */
  const executeSelected = useCallback(async (handlers: OptimizationModeHandlers) => {
    if (!selectedMode) {
      console.warn('[useOptimizationMode] No optimization mode selected');
      return;
    }

    const handler = handlers[selectedMode];
    if (handler) {
      await handler();
    } else {
      console.error(`[useOptimizationMode] Handler not found for mode: ${selectedMode}`);
    }

    // 执行后清除选择
    setSelectedMode(null);
  }, [selectedMode]);

  /** 检查是否选中了某个模式 */
  const isModeSelected = useCallback((mode: OptimizationMode): boolean => {
    return selectedMode === mode;
  }, [selectedMode]);

  /** 获取模式的显示名称 */
  const getModeDisplayName = useCallback((mode: OptimizationMode): string => {
    const names: Record<NonNullable<OptimizationMode>, string> = {
      directorAgent: '导演Agent架构',
      iterative: '多轮迭代优化',
      productAnimation: '产品动画优化',
      gepa: 'GEPA进化式优化',
      rapo: 'RAPO优化',
      cinemaDirector: '漫剧导演',
      filmDirector: '综合型影视创作',
    };
    return mode ? names[mode] : '';
  }, []);

  /** 清除选中的模式 */
  const clearMode = useCallback(() => {
    setSelectedMode(null);
  }, []);

  return {
    selectedMode,
    selectMode,
    executeSelected,
    isModeSelected,
    getModeDisplayName,
    clearMode,
  };
}
