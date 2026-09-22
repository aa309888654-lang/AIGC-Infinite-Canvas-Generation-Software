/**
 * 提示词优化相关类型定义
 */

// 优化模式类型
export type OptimizationModeType = 
  | 'directorAgent'  // 导演Agent架构
  | 'iterative'      // 多轮迭代优化
  | 'productAnimation' // 产品动画优化
  | 'gepa'           // GEPA进化式优化
  | 'rapo'           // RAPO优化
  | 'basic';         // 基础优化

// 优化模式元数据
export interface OptimizationModeMetadata {
  type: OptimizationModeType;
  label: string;
  description: string;
  estimatedDuration: string;
  complexity: 'low' | 'medium' | 'high';
  recommendedFor: string[];
}

// 优化模式配置
export const OPTIMIZATION_MODE_CONFIG: Record<OptimizationModeType, OptimizationModeMetadata> = {
  directorAgent: {
    type: 'directorAgent',
    label: '导演Agent架构',
    description: '采用多Agent协作架构，导演Agent分析、批评Agent评估、优化Agent精修',
    estimatedDuration: '15-30秒',
    complexity: 'high',
    recommendedFor: ['高质量要求', '电影级效果', '复杂场景'],
  },
  iterative: {
    type: 'iterative',
    label: '多轮迭代优化',
    description: '通过多轮优化-批评-精修循环持续改进提示词质量',
    estimatedDuration: '20-40秒',
    complexity: 'high',
    recommendedFor: ['精细调优', '追求完美', '专业用户'],
  },
  productAnimation: {
    type: 'productAnimation',
    label: '产品动画优化',
    description: '针对CG和产品展示场景的专项优化，基于七维结构框架',
    estimatedDuration: '10-20秒',
    complexity: 'medium',
    recommendedFor: ['产品展示', '电商场景', '三维动画'],
  },
  gepa: {
    type: 'gepa',
    label: 'GEPA进化式优化',
    description: '参考遗传算法，通过变异、评估、选择、交叉等进化操作优化',
    estimatedDuration: '30-60秒',
    complexity: 'high',
    recommendedFor: ['探索最优解', '创新风格', '高级用户'],
  },
  rapo: {
    type: 'rapo',
    label: 'RAPO优化',
    description: '基于强化学习的提示词优化策略',
    estimatedDuration: '25-50秒',
    complexity: 'high',
    recommendedFor: ['自适应优化', '复杂任务', '研究用途'],
  },
  basic: {
    type: 'basic',
    label: '基础优化',
    description: '标准提示词增强，添加专业术语和结构化描述',
    estimatedDuration: '5-10秒',
    complexity: 'low',
    recommendedFor: ['快速优化', '新手用户', '简单场景'],
  },
};

// 优化阶段类型
export type OptimizationStage = 
  | 'idle'
  | 'initializing'
  | 'analyzing'
  | 'optimizing'
  | 'evaluating'
  | 'refining'
  | 'completed'
  | 'error';

// 优化进度信息
export interface OptimizationProgress {
  stage: OptimizationStage;
  message: string;
  progress: number; // 0-100
  estimatedTimeRemaining?: string;
}

// 优化历史记录
export interface OptimizationHistoryRecord {
  id: string;
  timestamp: number;
  mode: OptimizationModeType;
  originalPrompt: string;
  optimizedPrompt: string;
  intermediateResults?: {
    stage: string;
    result: string;
  }[];
  metadata: {
    duration: number;
    success: boolean;
    errorMessage?: string;
  };
}
