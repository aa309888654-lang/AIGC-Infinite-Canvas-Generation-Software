/**
 * 插件系统类型定义
 * 支持第三方节点和适配器插件
 */

import { ComponentType, ReactNode } from 'react';
import { NodeProps } from '@xyflow/react';

// 插件类型
export type PluginType = 'node' | 'adapter' | 'ui' | 'theme';

// 插件状态
export type PluginStatus = 'enabled' | 'disabled' | 'error';

// 基础插件接口
export interface BasePlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: PluginType;
  status: PluginStatus;
  dependencies?: string[];
  permissions?: string[];
}

// 节点插件接口
export interface NodePlugin extends BasePlugin {
  type: 'node';
  nodeType: string;
  component: ComponentType<NodeProps>;
  defaultData: Record<string, unknown>;
  icon?: string;
  category: string;
}

// 适配器插件接口
export interface AdapterPlugin extends BasePlugin {
  type: 'adapter';
  providerId: string;
  adapterClass: new (...args: unknown[]) => unknown;
  supportedTypes: ('image' | 'video')[];
}

// UI插件接口
export interface UIPlugin extends BasePlugin {
  type: 'ui';
  component: ComponentType<Record<string, unknown>>;
  position: 'toolbar' | 'sidebar' | 'panel' | 'modal';
}

// 主题插件接口
export interface ThemePlugin extends BasePlugin {
  type: 'theme';
  theme: Record<string, string>;
  variables: Record<string, string>;
}

// 插件管理器接口
export interface PluginManager {
  // 插件注册
  registerPlugin(plugin: BasePlugin): boolean;
  
  // 插件卸载
  unregisterPlugin(pluginId: string): boolean;
  
  // 启用插件
  enablePlugin(pluginId: string): boolean;
  
  // 禁用插件
  disablePlugin(pluginId: string): boolean;
  
  // 获取插件
  getPlugin(pluginId: string): BasePlugin | undefined;
  
  // 获取所有插件
  getAllPlugins(): BasePlugin[];
  
  // 按类型获取插件
  getPluginsByType(type: PluginType): BasePlugin[];
  
  // 检查插件依赖
  checkDependencies(plugin: BasePlugin): { valid: boolean; missing: string[] };
  
  // 加载插件
  loadPlugin(pluginPath: string): Promise<BasePlugin>;
  
  // 卸载插件
  unloadPlugin(pluginId: string): Promise<boolean>;
}

// 插件配置接口
export interface PluginConfig {
  enabled: boolean;
  settings: Record<string, unknown>;
  permissions: string[];
}

// 插件市场接口
export interface PluginMarketplace {
  // 搜索插件
  searchPlugins(query: string): Promise<BasePlugin[]>;
  
  // 获取插件详情
  getPluginDetails(pluginId: string): Promise<BasePlugin>;
  
  // 安装插件
  installPlugin(pluginId: string): Promise<boolean>;
  
  // 更新插件
  updatePlugin(pluginId: string): Promise<boolean>;
  
  // 卸载插件
  uninstallPlugin(pluginId: string): Promise<boolean>;
}

// 插件事件类型
export type PluginEventType = 
  | 'plugin:registered'
  | 'plugin:unregistered'
  | 'plugin:enabled'
  | 'plugin:disabled'
  | 'plugin:error';

// 插件事件接口
export interface PluginEvent {
  type: PluginEventType;
  pluginId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

// 插件上下文接口
export interface PluginContext {
  // 获取API客户端
  getApiClient: () => unknown;
  
  // 获取状态管理器
  getStore: () => unknown;
  
  // 获取配置
  getConfig: () => Record<string, unknown>;
  
  // 发送事件
  emitEvent: (event: PluginEvent) => void;
  
  // 监听事件
  onEvent: (eventType: PluginEventType, callback: (event: PluginEvent) => void) => void;
}

// 插件API接口
export interface PluginAPI {
  // 注册节点类型
  registerNodeType: (nodeType: string, component: ComponentType<NodeProps>) => void;

  // 注册适配器
  registerAdapter: (providerId: string, adapter: new (...args: unknown[]) => unknown) => void;

  // 注册UI组件
  registerUIComponent: (position: string, component: ComponentType<Record<string, unknown>>) => void;

  // 注册主题
  registerTheme: (theme: Record<string, string>) => void;

  // 显示通知
  showNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

  // 显示模态框
  showModal: (content: React.ReactNode, options?: { title?: string; size?: 'sm' | 'md' | 'lg' }) => void;
}