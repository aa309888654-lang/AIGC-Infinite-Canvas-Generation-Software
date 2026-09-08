/**
 * 智能模板融合相关类型定义
 */

export interface SemanticAnalysis {
  /** 主体识别 */
  subjects: string[];
  /** 动作描述 */
  actions: string[];
  /** 场景环境 */
  scenes: string[];
  /** 风格关键词 */
  styles: string[];
  /** 光线氛围 */
  moods: string[];
  /** 技术参数 */
  technical: string[];
  /** 整体意图评分 */
  confidence: number;
}

export interface TemplateSemantics {
  templateId: string;
  templateName: string;
  /** 核心语义标签 */
  semanticTags: string[];
  /** 语义向量（用于相似度计算） */
  semanticVector?: number[];
  /** 模板强度 */
  intensity: number;
  /** 模板描述 */
  description: string;
}

export interface SemanticConflict {
  /** 冲突类型 */
  type: 'redundant' | 'contradictory' | 'overlap';
  /** 涉及模板 */
  templates: [string, string];
  /** 冲突描述 */
  description: string;
  /** 建议的解决方式 */
  resolution: string;
}

export interface MergedPrompt {
  /** 融合后的提示词 */
  content: string;
  /** 检测到的冲突 */
  conflicts: SemanticConflict[];
  /** 使用的模板列表 */
  usedTemplates: string[];
  /** 冲突解决建议 */
  suggestions: string[];
  /** 语义覆盖率 */
  semanticCoverage: {
    userIntent: number;
    templateFeatures: number;
  };
  /** 中间结果（用于调试） */
  intermediateResults?: {
    userSemantic: SemanticAnalysis;
    templateSemantics: TemplateSemantics[];
    mergedKeywords: string[];
  };
}

export interface TemplateFusionOptions {
  /** 融合模式 */
  mode: 'concervative' | 'balanced' | 'aggressive';
  /** 是否检测冲突 */
  detectConflicts: boolean;
  /** 是否保留用户意图优先 */
  userIntentPriority: boolean;
  /** 最大模板数量 */
  maxTemplates: number;
  /** 是否输出中间结果 */
  includeIntermediate: boolean;
}

export const DEFAULT_FUSION_OPTIONS: TemplateFusionOptions = {
  mode: 'balanced',
  detectConflicts: true,
  userIntentPriority: true,
  maxTemplates: 4,
  includeIntermediate: false,
};

// 语义类别定义
export const SEMANTIC_CATEGORIES = {
  SUBJECT: 'subject',
  ACTION: 'action',
  SCENE: 'scene',
  STYLE: 'style',
  MOOD: 'mood',
  TECHNICAL: 'technical',
} as const;

export type SemanticCategory = typeof SEMANTIC_CATEGORIES[keyof typeof SEMANTIC_CATEGORIES];

// 语义冲突规则
export interface ConflictRule {
  category: SemanticCategory;
  keywords: string[];
  conflictWith: string[];
  resolution: string;
}

export const SEMANTIC_CONFLICT_RULES: ConflictRule[] = [
  {
    category: SEMANTIC_CATEGORIES.STYLE,
    keywords: ['anime', '日漫', '二次元'],
    conflictWith: ['realistic', '写实', '真实'],
    resolution: '建议只选择一个风格，避免风格冲突',
  },
  {
    category: SEMANTIC_CATEGORIES.MOOD,
    keywords: ['dark', 'darkness', '暗色'],
    conflictWith: ['bright', 'light', '明亮'],
    resolution: '两种氛围差异较大，建议保持一致',
  },
  {
    category: SEMANTIC_CATEGORIES.TECHNICAL,
    keywords: ['4k', 'ultra'],
    conflictWith: ['low', '144p', '240p'],
    resolution: '分辨率设置冲突，以高分辨率优先',
  },
];
