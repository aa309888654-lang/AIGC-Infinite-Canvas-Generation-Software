/**
 * AI生成增强系统
 * 整合结果对比、参数记录、提示词建议、质量评分等功能
 */

// 导出增强服务
export { aiEnhancementService } from './enhancement-service';

// 导出UI组件
export { default } from './AIGenerationEnhancementPanel';

// 导出类型
export type {
  GenerationResult,
  ParameterChange,
  PromptSuggestion,
  ParameterTestConfig,
  QualityScore,
  EnhancementConfig
} from './types';
