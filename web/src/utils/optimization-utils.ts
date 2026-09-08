/**
 * 优化工具函数
 * 提供优化相关的实用函数
 */

import { OPTIMIZATION_MODE_CONFIG, type OptimizationModeType, type OptimizationProgress } from '@/types/optimization';

/**
 * 获取优化模式的显示信息
 */
export function getOptimizationModeInfo(mode: OptimizationModeType | null) {
  if (!mode) {
    return {
      label: '未选择',
      description: '',
      estimatedDuration: '',
      complexity: 'low' as const,
      recommendedFor: [],
    };
  }
  
  return OPTIMIZATION_MODE_CONFIG[mode] || OPTIMIZATION_MODE_CONFIG.basic;
}

/**
 * 检查优化模式是否有效
 */
export function isValidOptimizationMode(mode: string | null): mode is OptimizationModeType {
  if (!mode) return false;
  return mode in OPTIMIZATION_MODE_CONFIG;
}

/**
 * 获取所有可用优化模式列表
 */
export function getAllOptimizationModes(): OptimizationModeType[] {
  return Object.keys(OPTIMIZATION_MODE_CONFIG) as OptimizationModeType[];
}

/**
 * 根据复杂度筛选优化模式
 */
export function filterModesByComplexity(
  modes: OptimizationModeType[],
  complexity: 'low' | 'medium' | 'high'
): OptimizationModeType[] {
  return modes.filter(mode => OPTIMIZATION_MODE_CONFIG[mode].complexity === complexity);
}

/**
 * 根据使用场景推荐优化模式
 */
export function recommendModeForUseCase(useCase: string): OptimizationModeType[] {
  const recommendations: Record<string, OptimizationModeType[]> = {
    快速: ['basic'],
    简单: ['basic', 'productAnimation'],
    电商: ['productAnimation'],
    产品: ['productAnimation'],
    电影: ['directorAgent', 'iterative'],
    高质量: ['directorAgent', 'iterative', 'gepa'],
    创意: ['gepa', 'rapo'],
    研究: ['gepa', 'rapo'],
    动画: ['productAnimation', 'directorAgent'],
    三维: ['productAnimation'],
  };

  const lowerUseCase = useCase.toLowerCase();
  
  for (const [keyword, modes] of Object.entries(recommendations)) {
    if (lowerUseCase.includes(keyword)) {
      return modes;
    }
  }

  return ['basic'];
}

/**
 * 格式化优化进度
 */
export function formatOptimizationProgress(progress: OptimizationProgress): string {
  const { stage, message, progress: percent } = progress;
  
  const stageLabels: Record<string, string> = {
    idle: '空闲',
    initializing: '初始化',
    analyzing: '分析中',
    optimizing: '优化中',
    evaluating: '评估中',
    refining: '精修中',
    completed: '完成',
    error: '错误',
  };

  return `${stageLabels[stage] || stage}: ${message} (${percent}%)`;
}

/**
 * 计算优化预估时间
 */
export function estimateOptimizationTime(mode: OptimizationModeType): { min: number; max: number } {
  const config = OPTIMIZATION_MODE_CONFIG[mode];
  
  const timeMap: Record<string, { min: number; max: number }> = {
    '5-10秒': { min: 5, max: 10 },
    '10-20秒': { min: 10, max: 20 },
    '15-30秒': { min: 15, max: 30 },
    '20-40秒': { min: 20, max: 40 },
    '25-50秒': { min: 25, max: 50 },
    '30-60秒': { min: 30, max: 60 },
  };

  return timeMap[config.estimatedDuration] || { min: 10, max: 30 };
}

/**
 * 验证优化提示词质量
 */
export function validateOptimizedPrompt(prompt: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!prompt || prompt.trim().length === 0) {
    issues.push('提示词为空');
    return { isValid: false, issues };
  }

  if (prompt.length < 10) {
    issues.push('提示词过短');
  }

  if (prompt.length > 2000) {
    issues.push('提示词过长');
  }

  if (!/[，,。.；;]/.test(prompt)) {
    issues.push('建议使用分隔符提升结构化程度');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
