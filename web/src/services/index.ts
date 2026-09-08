export { UnifiedCacheService, unifiedCacheService } from './unified-cache-service';
export type { CacheType, CacheStats, CacheClearResult, CacheConfig } from './unified-cache-service';

export { KeyboardShortcutManager } from './keyboard-shortcuts';
export type { KeyboardShortcut, ShortcutCategory, ShortcutConfig } from './keyboard-shortcuts';

export { serviceContainer, registerService, getService, initializeServices, disposeServices, registerCoreServices } from './service-container';

export * from './core';
// export * from './ai';  // Module does not exist
export * from './media';
export * from './workflow';
export * from './storage';
export * from './admin';

// 中国AI服务导出
export { chineseAISubtitleService } from './chinese-ai-subtitle-service';
export type { ChineseSubtitleSegment, ChineseSubtitleOptions, ChineseSubtitleResult, ChineseAIProvider } from './chinese-ai-subtitle-service';

export { chineseAISoundService } from './chinese-ai-sound-service';
export type { ChineseSoundMatchResult, ChineseSoundOptions, SceneAnalysis, ChineseSoundProvider } from './chinese-ai-sound-service';

// XT语音指令控制
export { xtCommandControl } from './xt-command-control-service';
export type { CommandIntent, CommandResult, ExecutedAction, CommandCategory } from './xt-command-control-service';

// 智能助手服务
export { intelligentAssistant } from './intelligent-assistant-service';
export type {
  AIModel,
  ModelInfo,
  AssistantMessage,
  ToolCall,
  ToolResult,
  AssistantOptions,
  ConversationContext
} from './intelligent-assistant-service';