/**
 * 连接管理器
 * 
 * ⚠️ 已废弃：此模块已重新导出主 ConnectionManager
 * 请使用 @/services/connection-manager 中的完整实现
 * 
 * @deprecated 请使用 @/services/connection-manager
 */

// 重新导出主 ConnectionManager，保持向后兼容
export { ConnectionManager, connectionManager } from '@/services/connection-manager';
export type { UnifiedConnectionStatus as ConnectionStatus, UnifiedAPIProvider } from '@/types/core';
