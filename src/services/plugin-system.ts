/**
 * 插件系统
 * 支持第三方扩展的插件架构
 * 提供完整的插件生命周期管理和API扩展能力
 */

import { generateId } from '@/lib/utils';
import * as React from 'react';

// ==================== 类型定义 ====================

// 插件类型（扩展支持中间件）
export type PluginType = 'node' | 'adapter' | 'transformer' | 'ui' | 'theme' | 'middleware';

// 插件状态
export type PluginStatus = 'loaded' | 'enabled' | 'disabled' | 'error';

// 插件权限
export interface PluginPermission {
  name: string;
  description: string;
  granted: boolean;
}

// 插件生命周期钩子（支持优先级）
export interface PluginHook {
  name: string;
  priority?: number;
  handler: (context: any) => Promise<any> | any;
}

// ==================== 节点配置类型 ====================

// 节点插件配置
export interface NodePluginConfig {
  name: string;
  category: string;
  inputs: InputConfig[];
  outputs: OutputConfig[];
  params: ParamConfig[];
  executor?: NodeExecutor;
  icon?: string;
  color?: string;
  description?: string;
}

export interface InputConfig {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  default?: any;
}

export interface OutputConfig {
  id: string;
  name: string;
  type: string;
}

export interface ParamConfig {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'file';
  default?: any;
  options?: { label: string; value: any }[];
  required?: boolean;
}

export type NodeExecutor = (inputs: Record<string, any>, params: Record<string, any>, context: ExecutionContext) => Promise<any>;

export interface ExecutionContext {
  nodeId: string;
  workflowId?: string;
  apiKeys: Record<string, any>;
  addFile?: (file: any) => void;
  updateTask?: (taskId: string, updates: any) => void;
}

// ==================== 中间件类型 ====================

// 中间件配置
export interface MiddlewareConfig {
  name: string;
  type: 'request' | 'response' | 'transform';
  priority?: number;
  handler: MiddlewareHandler;
}

export type MiddlewareHandler = (context: MiddlewareContext, next: NextFunction) => Promise<any>;

export interface MiddlewareContext {
  type: 'node' | 'workflow' | 'api';
  data: any;
  params?: Record<string, any>;
  metadata?: Record<string, any>;
}

export type NextFunction = () => Promise<any>;

// ==================== UI扩展类型 ====================

// 事件处理器
export type EventHandler = (data?: any) => Promise<any> | any;

// 菜单项配置
export interface MenuItemConfig {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
  position?: 'file' | 'edit' | 'view' | 'node' | 'help';
  shortcut?: string;
  disabled?: boolean;
}

// 工具栏按钮配置
export interface ToolbarButtonConfig {
  id: string;
  icon: string;
  label: string;
  tooltip?: string;
  action: () => void;
  position: number;
  disabled?: boolean;
}

// 快捷键配置
export interface ShortcutConfig {
  id: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description?: string;
}

// 面板配置
export interface PanelConfig {
  id: string;
  name: string;
  icon?: string;
  component?: React.ComponentType<any>;
  render?: () => React.ReactNode;
  position?: 'left' | 'right' | 'bottom';
  defaultOpen?: boolean;
}

// 工作流操作配置
export interface WorkflowActionConfig {
  id: string;
  name: string;
  icon?: string;
  handler: (nodes: any[], edges: any[]) => any[] | Promise<any[]>;
}

// 请求选项
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

// 插件接口（扩展后）
export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  type: PluginType;
  status: PluginStatus;
  dependencies?: string[];
  entry: string;
  config?: Record<string, any>;
  hooks?: PluginHook[];
  nodeTypes?: Record<string, NodePluginConfig>;
  middleware?: MiddlewareConfig[];
  permissions?: PluginPermission[];
  api?: PluginAPI;
  loadedAt?: Date;
  enabledAt?: Date;
}

// 插件市场条目
export interface PluginMarketItem {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  downloadUrl?: string;
  icon?: string;
  tags?: string[];
  installed?: boolean;
  installedVersion?: string;
}

// ==================== 扩展的插件API ====================

// 插件API - 完整的扩展接口
export interface PluginAPI {
  // 节点操作
  registerNode?: (nodeType: string, nodeConfig: NodePluginConfig) => void;
  unregisterNode?: (nodeType: string) => void;
  getNodeTypes?: () => Record<string, NodePluginConfig>;
   
  // 适配器操作
  registerAdapter?: (name: string, adapter: any) => void;
  unregisterAdapter?: (name: string) => void;
  getAdapters?: () => Record<string, any>;
   
  // 中间件操作
  registerMiddleware?: (middleware: MiddlewareConfig) => void;
  unregisterMiddleware?: (name: string) => void;
   
  // 事件系统（增强）
  on?: (event: string, handler: EventHandler) => void;
  off?: (event: string, handler: EventHandler) => void;
  emit?: (event: string, data?: any) => Promise<any[]>;
   
  // 存储（增强）
  getStorage?: (key: string) => any;
  setStorage?: (key: string, value: any) => void;
  removeStorage?: (key: string) => void;
   
  // 配置
  getConfig?: () => Record<string, any>;
  setPluginConfig?: (config: Record<string, any>) => void;
   
  // 工具
  log?: (message: string, level?: 'info' | 'warn' | 'error' | 'debug') => void;
  getVersion?: () => string;
  
  // 菜单/UI扩展
  registerMenuItem?: (menuItem: MenuItemConfig) => void;
  unregisterMenuItem?: (id: string) => void;
  
  // 工具栏扩展
  registerToolbarButton?: (button: ToolbarButtonConfig) => void;
  unregisterToolbarButton?: (id: string) => void;
  
  // 快捷键
  registerShortcut?: (shortcut: ShortcutConfig) => void;
  unregisterShortcut?: (id: string) => void;
  
  // 面板扩展
  registerPanel?: (panel: PanelConfig) => void;
  unregisterPanel?: (id: string) => void;
  
  // 工作流操作
  registerWorkflowAction?: (action: WorkflowActionConfig) => void;
  
  // HTTP请求（受限）
  fetch?: (url: string, options?: RequestOptions) => Promise<any>;
}

// ==================== 插件管理器 ====================

// 增强的插件管理器类
class PluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, Plugin> = new Map();
  private hookHandlers: Map<string, Array<(...args: any[]) => any>> = new Map();
  private nodeTypes: Map<string, NodePluginConfig> = new Map();
  private adapters: Map<string, any> = new Map();
  private middleware: Map<string, MiddlewareConfig> = new Map();
  private menuItems: Map<string, MenuItemConfig> = new Map();
  private toolbarButtons: Map<string, ToolbarButtonConfig> = new Map();
  private shortcuts: Map<string, ShortcutConfig> = new Map();
  private panels: Map<string, PanelConfig> = new Map();
  private workflowActions: Map<string, WorkflowActionConfig> = new Map();
  private config: Record<string, any> = {};
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  
  private constructor() {
    this.loadFromStorage();
  }
  
  static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }
  
  // ==================== 插件生命周期管理 ====================
  
  // 注册插件
  async registerPlugin(plugin: Omit<Plugin, 'id' | 'status'>): Promise<string> {
    const id = generateId();
    const fullPlugin: Plugin = {
      ...plugin,
      id,
      status: 'loaded',
      loadedAt: new Date()
    };
    
    // 检查依赖
    if (plugin.dependencies) {
      for (const depId of plugin.dependencies) {
        const depPlugin = Array.from(this.plugins.values()).find(p => p.name === depId);
        if (!depPlugin) {
          throw new Error(`缺少依赖插件: ${depId}`);
        }
      }
    }
    
    this.plugins.set(id, fullPlugin);
    
    // 注册节点类型
    if (plugin.nodeTypes) {
      Object.entries(plugin.nodeTypes).forEach(([type, config]) => {
        this.nodeTypes.set(type, config);
      });
    }
    
    // 注册中间件
    if (plugin.middleware) {
      plugin.middleware.forEach(mw => {
        this.middleware.set(mw.name, mw);
      });
    }
    
    this.saveToStorage();
    
    // 执行生命周期钩子
    await this.executeHook('pluginLoaded', { plugin: fullPlugin });
    
    return id;
  }
  
  // 启用插件
  async enablePlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`插件不存在: ${id}`);
    
    plugin.status = 'enabled';
    plugin.enabledAt = new Date();
    this.plugins.set(id, plugin);
    this.saveToStorage();
    
    await this.executeHook('pluginEnabled', { plugin });
  }
  
  // 禁用插件
  async disablePlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`插件不存在: ${id}`);
    
    plugin.status = 'disabled';
    this.plugins.set(id, plugin);
    this.saveToStorage();
    
    await this.executeHook('pluginDisabled', { plugin });
  }
  
  // 卸载插件
  async unregisterPlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    
    // 清理节点类型
    if (plugin.nodeTypes) {
      Object.keys(plugin.nodeTypes).forEach(type => {
        this.nodeTypes.delete(type);
      });
    }
    
    // 清理中间件
    if (plugin.middleware) {
      plugin.middleware.forEach(mw => {
        this.middleware.delete(mw.name);
      });
    }
    
    this.plugins.delete(id);
    this.saveToStorage();
    
    await this.executeHook('pluginUnloaded', { plugin });
  }
  
  // 获取插件
  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }
  
  // 获取所有插件
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  
  // 获取启用的插件
  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.status === 'enabled');
  }
  
  // ==================== 节点类型管理 ====================
  
  // 获取节点类型
  getNodeTypes(): Map<string, NodePluginConfig> {
    return new Map(this.nodeTypes);
  }
  
  // 注册节点类型（内部使用）
  registerNodeType(type: string, config: NodePluginConfig): void {
    this.nodeTypes.set(type, config);
  }
  
  // ==================== 适配器管理 ====================
  
  // 获取适配器
  getAdapters(): Map<string, any> {
    return new Map(this.adapters);
  }
  
  // 注册适配器（内部使用）
  registerAdapter(name: string, adapter: any): void {
    this.adapters.set(name, adapter);
  }
  
  // ==================== 中间件管理 ====================
  
  // 获取中间件列表
  getMiddleware(): MiddlewareConfig[] {
    return Array.from(this.middleware.values()).sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );
  }
  
  // 获取请求中间件
  getRequestMiddleware(): MiddlewareConfig[] {
    return this.getMiddleware().filter(m => m.type === 'request');
  }
  
  // 获取响应中间件
  getResponseMiddleware(): MiddlewareConfig[] {
    return this.getMiddleware().filter(m => m.type === 'response');
  }
  
  // ==================== 钩子系统 ====================
  
  // 注册钩子
  registerHook(name: string, handler: (...args: any[]) => any, _priority?: number): void {
    if (!this.hookHandlers.has(name)) {
      this.hookHandlers.set(name, []);
    }
    const handlers = this.hookHandlers.get(name)!;
    handlers.push(handler);
    // 按优先级排序（高优先级在前）
    handlers.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
  }
  
  // 执行钩子
  async executeHook(name: string, context: any): Promise<any[]> {
    const handlers = this.hookHandlers.get(name) || [];
    const results = [];
    
    for (const handler of handlers) {
      try {
        results.push(await handler(context));
      } catch (error) {
        console.error(`钩子执行失败 ${name}:`, error);
      }
    }
    
    return results;
  }
  
  // ==================== 事件系统 ====================
  
  // 订阅事件
  subscribe(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    
    // 返回取消订阅函数
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }
  
  // 发布事件
  async emit(event: string, data?: any): Promise<any[]> {
    const handlers = this.eventHandlers.get(event) || new Set();
    const results = [];
    
    for (const handler of Array.from(handlers)) {
      try {
        results.push(await handler(data));
      } catch (error) {
        console.error(`事件处理失败 ${event}:`, error);
      }
    }
    
    return results;
  }
  
  // ==================== UI扩展管理 ====================
  
  // 获取菜单项
  getMenuItems(): MenuItemConfig[] {
    return Array.from(this.menuItems.values());
  }
  
  // 注册菜单项
  registerMenuItem(item: MenuItemConfig): void {
    this.menuItems.set(item.id, item);
  }
  
  // 获取工具栏按钮
  getToolbarButtons(): ToolbarButtonConfig[] {
    return Array.from(this.toolbarButtons.values()).sort((a, b) => a.position - b.position);
  }
  
  // 注册工具栏按钮
  registerToolbarButton(button: ToolbarButtonConfig): void {
    this.toolbarButtons.set(button.id, button);
  }
  
  // 获取快捷键
  getShortcuts(): ShortcutConfig[] {
    return Array.from(this.shortcuts.values());
  }
  
  // 注册快捷键
  registerShortcut(shortcut: ShortcutConfig): void {
    this.shortcuts.set(shortcut.id, shortcut);
  }
  
  // 获取面板
  getPanels(): PanelConfig[] {
    return Array.from(this.panels.values());
  }
  
  // 注册面板
  registerPanel(panel: PanelConfig): void {
    this.panels.set(panel.id, panel);
  }
  
  // 获取工作流操作
  getWorkflowActions(): WorkflowActionConfig[] {
    return Array.from(this.workflowActions.values());
  }
  
  // 注册工作流操作
  registerWorkflowAction(action: WorkflowActionConfig): void {
    this.workflowActions.set(action.id, action);
  }
  
  // ==================== 存储管理 ====================
  
  // 创建插件API
  createPluginAPI(pluginId: string): PluginAPI {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    
    return {
      // 节点操作
      registerNode: (type, config) => {
        self.nodeTypes.set(type, config);
      },
      unregisterNode: (type) => {
        self.nodeTypes.delete(type);
      },
      getNodeTypes: () => Object.fromEntries(self.nodeTypes),
      
      // 适配器操作
      registerAdapter: (name, adapter) => {
        self.adapters.set(name, adapter);
      },
      unregisterAdapter: (name) => {
        self.adapters.delete(name);
      },
      getAdapters: () => Object.fromEntries(self.adapters),
      
      // 中间件操作
      registerMiddleware: (middleware) => {
        self.middleware.set(middleware.name, middleware);
      },
      unregisterMiddleware: (name) => {
        self.middleware.delete(name);
      },
      
      // 事件系统
      on: (event, handler) => {
        self.subscribe(`${pluginId}:${event}`, handler);
      },
      off: (event, handler) => {
        // 简化的移除逻辑
        self.eventHandlers.get(`${pluginId}:${event}`)?.delete(handler);
      },
      emit: async (event, data) => {
        return self.emit(`${pluginId}:${event}`, data);
      },
      
      // 存储
      getStorage: (key) => self.config[`${pluginId}:${key}`],
      setStorage: (key, value) => {
        self.config[`${pluginId}:${key}`] = value;
        self.saveToStorage();
      },
      removeStorage: (key) => {
        delete self.config[`${pluginId}:${key}`];
        self.saveToStorage();
      },
      
      // 配置
      getConfig: () => self.config,
      setPluginConfig: (config) => {
        self.config[`${pluginId}:config`] = config;
        self.saveToStorage();
      },
      
      // 工具
      log: (message, level = 'info') => { console[level](`[Plugin ${pluginId}]`, message); }, // eslint-disable-line no-console
      getVersion: () => '1.0.0',
      
      // 菜单/UI扩展
      registerMenuItem: (item) => self.registerMenuItem({ ...item, id: `${pluginId}:${item.id}` }),
      unregisterMenuItem: (id) => self.menuItems.delete(`${pluginId}:${id}`),
      
      // 工具栏扩展
      registerToolbarButton: (button) => self.registerToolbarButton({ ...button, id: `${pluginId}:${button.id}` }),
      unregisterToolbarButton: (id) => self.toolbarButtons.delete(`${pluginId}:${id}`),
      
      // 快捷键
      registerShortcut: (shortcut) => self.registerShortcut({ ...shortcut, id: `${pluginId}:${shortcut.id}` }),
      unregisterShortcut: (id) => self.shortcuts.delete(`${pluginId}:${id}`),
      
      // 面板扩展
      registerPanel: (panel) => self.registerPanel({ ...panel, id: `${pluginId}:${panel.id}` }),
      unregisterPanel: (id) => self.panels.delete(`${pluginId}:${id}`),
      
      // 工作流操作
      registerWorkflowAction: (action) => self.registerWorkflowAction({ ...action, id: `${pluginId}:${action.id}` }),
      
      // HTTP请求（受限）
      fetch: async (url, options) => {
        // 安全限制：只允许特定域名
        const allowedDomains = ['api.example.com', 'localhost'];
        try {
          const urlObj = new URL(url);
          if (!allowedDomains.includes(urlObj.hostname)) {
            throw new Error('不允许请求此域名');
          }
        } catch {
          throw new Error('无效的URL');
        }
        
        const controller = new AbortController();
        const timeout = options?.timeout || 30000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...options?.headers
            }
          });
          return response.json();
        } finally {
          clearTimeout(timeoutId);
        }
      }
    };
  }
  
  // ==================== 存储持久化 ====================
  
  // 保存到存储
  private saveToStorage(): void {
    try {
      const data = {
        plugins: Array.from(this.plugins.entries()),
        config: this.config
      };
      localStorage.setItem('pluginSystem', JSON.stringify(data));
    } catch (e) {
      console.error('保存插件系统数据失败:', e);
    }
  }
  
  // 从存储加载
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('pluginSystem');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.plugins) {
          this.plugins = new Map(parsed.plugins);
        }
        if (parsed.config) {
          this.config = parsed.config;
        }
      }
    } catch (e) {
      console.error('加载插件系统数据失败:', e);
    }
  }
  
  // ==================== 工具方法 ====================
  
  // 导出所有数据
  exportData(): string {
    return JSON.stringify({
      plugins: Array.from(this.plugins.entries()),
      nodeTypes: Array.from(this.nodeTypes.entries()),
      adapters: Array.from(this.adapters.entries()),
      middleware: Array.from(this.middleware.entries()),
      config: this.config
    }, null, 2);
  }
  
  // 导入数据
  importData(jsonString: string): void {
    try {
      const data = JSON.parse(jsonString);
      if (data.plugins) this.plugins = new Map(data.plugins);
      if (data.nodeTypes) this.nodeTypes = new Map(data.nodeTypes);
      if (data.adapters) this.adapters = new Map(data.adapters);
      if (data.middleware) this.middleware = new Map(data.middleware);
      if (data.config) this.config = data.config;
      this.saveToStorage();
    } catch (e) {
      console.error('导入数据失败:', e);
      throw new Error('无效的数据格式');
    }
  }
  
  // 清空所有数据
  clearAll(): void {
    this.plugins.clear();
    this.nodeTypes.clear();
    this.adapters.clear();
    this.middleware.clear();
    this.menuItems.clear();
    this.toolbarButtons.clear();
    this.shortcuts.clear();
    this.panels.clear();
    this.workflowActions.clear();
    this.config = {};
    this.hookHandlers.clear();
    this.eventHandlers.clear();
    localStorage.removeItem('pluginSystem');
  }
}

// 导出单例
export const pluginManager = PluginManager.getInstance();

// ==================== 便捷函数 ====================

// 加载插件
export async function loadPlugin(pluginData: Omit<Plugin, 'id' | 'status'>): Promise<string> {
  const id = await pluginManager.registerPlugin(pluginData);
  const api = pluginManager.createPluginAPI(id);
  
  // 如果插件有入口，加载模块
  if (pluginData.entry) {
    try {
      const module = await import(pluginData.entry);
      if (module.default) {
        await module.default(api);
      }
    } catch (e) {
      console.error('加载插件模块失败:', e);
      throw e;
    }
  }
  
  return id;
}

// 卸载插件
export async function unloadPlugin(id: string): Promise<void> {
  await pluginManager.unregisterPlugin(id);
}

// 启用插件
export async function enablePlugin(id: string): Promise<void> {
  await pluginManager.enablePlugin(id);
}

// 禁用插件
export async function disablePlugin(id: string): Promise<void> {
  await pluginManager.disablePlugin(id);
}

// ==================== 示例插件定义 ====================

export const EXAMPLE_PLUGIN: Omit<Plugin, 'id' | 'status'> = {
  name: '示例插件',
  version: '1.0.0',
  description: '这是一个示例插件，展示插件系统的功能',
  author: '开发者',
  type: 'node',
  entry: './plugins/example',
  hooks: [],
  nodeTypes: {},
  permissions: []
};

// ==================== 插件市场（预留） ====================

// 模拟插件市场数据
export const PLUGIN_MARKET: PluginMarketItem[] = [
  {
    id: 'market:image-filters',
    name: '图片滤镜',
    description: '提供多种图片滤镜效果',
    author: '社区',
    version: '1.0.0',
    tags: ['图像', '滤镜'],
    installed: false
  },
  {
    id: 'market:video-effects',
    name: '视频特效',
    description: '视频特效增强插件',
    author: '社区',
    version: '1.0.0',
    tags: ['视频', '特效'],
    installed: false
  }
];