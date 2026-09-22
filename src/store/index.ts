/**
 * Store 统一入口
 *
 * 架构层级：
 * ┌─────────────────────────────────────────────────────────┐
 * │  useCanvasStore (画布状态 — 主 Store)                     │
 * │  35+ 文件依赖，IndexedDB 持久化，批量操作，撤销/重做       │
 * │  提供: nodes, edges, selection, history, batch ops        │
 * ├─────────────────────────────────────────────────────────┤
 * │  useTaskStore (任务管理)                                   │
 * │  useWorkflowStore, usePanelStore, useConfigStore          │
 * │  useFileStore, themeStore                                 │
 * └─────────────────────────────────────────────────────────┘
 */

// === 画布状态 (主 Store) ===
export { useCanvasStore, canvasStoreApi, restoreNodeImages } from './useCanvasStore';

// === 时间轴 Store（存根 — AI剪辑已移除） ===
export { useClipStore } from './useClipStore';
export type { ClipKind, Clip, Track, Sequence, MediaAsset } from './useClipStore';
export type { TimelineState, EditorTool, TimelineMarker } from './editmaster/types';

// === Workflow ===
export { useWorkflowStore } from './useWorkflowStore';

// === 面板与预览 ===
export { usePreviewStore } from './usePreviewStore';
export { usePanelStore } from './usePanelStore';

// === 会员（存根 — 会员系统已移除）与主题 ===
export { useMembershipStore } from './useMembershipStore';
export { useThemeStore } from './themeStore';

// === 配置 ===
export { default as useUnifiedAPIConfigStore } from './useUnifiedAPIConfigStore';
export { useConfigStore } from './useConfigStore';

// === 任务 ===
export { useTaskStore } from './useTaskStore';

// === 文件 ===
export { useFileStore } from './useFileStore';

// === 生成流水线 ===
export { useMusicGenerationStore } from './music-generation-store';

// === 错误处理 ===
export { WorkflowErrorHandler as useErrorHandler } from '@/lib/workflow-error-handler';
