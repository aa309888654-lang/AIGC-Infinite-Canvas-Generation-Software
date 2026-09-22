/**
 * 系统初始化模块
 * 集成插件系统、中间件系统和微前端架构
 * 在应用启动时自动初始化
 */

import { pluginManager } from './plugin-system';
import { middlewareManager, initDefaultMiddlewares, Middleware } from './middleware-system';
import { microFrontendManager } from './micro-frontend';
import { logger } from '@/lib/logger';

// ==================== 系统配置 ====================

export interface SystemConfig {
  // 插件系统配置
  plugin: {
    autoLoad: boolean;
    enabled: boolean;
  };
  // 中间件系统配置
  middleware: {
    enabled: boolean;
    defaultMiddlewares: boolean;
  };
  // 微前端配置
  microFrontend: {
    enabled: boolean;
    autoLoadApps: boolean;
  };
}

const defaultConfig: SystemConfig = {
  plugin: {
    autoLoad: false,
    enabled: true
  },
  middleware: {
    enabled: true,
    defaultMiddlewares: true
  },
  microFrontend: {
    enabled: true,
    autoLoadApps: false
  }
};

// ==================== 初始化函数 ====================

// 初始化插件系统
export async function initPluginSystem(config?: Partial<SystemConfig['plugin']>): Promise<void> {
  const cfg = { ...defaultConfig.plugin, ...config };
  
  if (!cfg.enabled) {
    return;
  }
  
  logger.info('[SystemInit] 正在初始化插件系统...');
  
  // 注册系统内置钩子
  pluginManager.registerHook('pluginLoaded', async (_context: any) => { /* noop */ });
  
  pluginManager.registerHook('pluginEnabled', async (_context: any) => { /* noop */ });
  
  pluginManager.registerHook('pluginDisabled', async (_context: any) => { /* noop */ });
  
  pluginManager.registerHook('pluginUnloaded', async (_context: any) => { /* noop */ });
  
  logger.info('[SystemInit] 插件系统初始化完成');
}

// 初始化中间件系统
export async function initMiddlewareSystem(config?: Partial<SystemConfig['middleware']>): Promise<void> {
  const cfg = { ...defaultConfig.middleware, ...config };
  
  if (!cfg.enabled) {
    return;
  }
  
  logger.info('[SystemInit] 正在初始化中间件系统...');
  
  // 注册默认中间件
  if (cfg.defaultMiddlewares) {
    initDefaultMiddlewares();
  }
  
  logger.info('[SystemInit] 中间件系统初始化完成');
}

// 初始化微前端系统
export async function initMicroFrontendSystem(config?: Partial<SystemConfig['microFrontend']>): Promise<void> {
  const cfg = { ...defaultConfig.microFrontend, ...config };
  
  if (!cfg.enabled) {
    return;
  }
  
  logger.info('[SystemInit] 正在初始化微前端系统...');
  
  // 注册系统事件处理
  microFrontendManager.on('appRegistered', (_data: any) => { /* noop */ });
  
  microFrontendManager.on('appLoaded', (_data: any) => { /* noop */ });
  
  microFrontendManager.on('appActivated', (_data: any) => { /* noop */ });
  
  logger.info('[SystemInit] 微前端系统初始化完成');
}

// 初始化所有系统
export async function initializeAllSystems(config?: Partial<SystemConfig>): Promise<void> {
  logger.info('[SystemInit] ========== 系统初始化开始 ==========');
  
  const fullConfig = { ...defaultConfig, ...config };
  
  try {
    // 按依赖顺序初始化
    await initPluginSystem(fullConfig.plugin);
    await initMiddlewareSystem(fullConfig.middleware);
    await initMicroFrontendSystem(fullConfig.microFrontend);
    
    logger.info('[SystemInit] ========== 系统初始化完成 ==========');
  } catch (error) {
    console.error('[SystemInit] 系统初始化失败:', error);
    throw error;
  }
}

// ==================== 插件与中间件集成 ====================

// 注册节点执行中间件
export function registerNodeExecutionMiddleware(middleware: Middleware): void {
  middlewareManager.register({
    id: middleware.name,
    name: middleware.name,
    type: middleware.type,
    priority: middleware.priority || 0,
    enabled: true,
    handler: middleware.handler
  });
}

// 执行节点前的中间件链
export async function executeNodePreMiddleware(
  nodeId: string,
  nodeType: string,
  data: any,
  params?: Record<string, any>
): Promise<any> {
  const result = await middlewareManager.executeRequest({
    data,
    params,
    metadata: { nodeId, nodeType }
  });
  
  return result;
}

// 执行节点后的中间件链
export async function executeNodePostMiddleware(
  nodeId: string,
  nodeType: string,
  result: any): Promise<any> {
  const context = await middlewareManager.executeResponse({
    data: result,
    metadata: { nodeId, nodeType }
  });
  
  return context.data;
}

// ==================== 插件与微前端集成 ====================

// 从微前端应用注册插件
export async function registerPluginFromMicroApp(
  manifest: any,
  microAppId: string
): Promise<string> {
  // 为微应用创建插件API
  const api = pluginManager.createPluginAPI(microAppId);
  
  // 注册为节点类型插件
  if (manifest.nodeTypes) {
    Object.entries(manifest.nodeTypes).forEach(([type, config]) => {
      api.registerNode?.(type, config as any);
    });
  }
  
  // 注册为中间件
  if (manifest.middleware) {
    manifest.middleware.forEach((mw: Middleware) => {
      api.registerMiddleware?.(mw as { id: string; name: string; type: 'transform' | 'request' | 'response'; priority: number; enabled: boolean; handler: (context: any, next: () => Promise<any>) => Promise<any> });
    });
  }
  
  // 注册到插件管理器
  const pluginId = await pluginManager.registerPlugin({
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    type: 'node',
    entry: manifest.entry,
    nodeTypes: manifest.nodeTypes,
    middleware: manifest.middleware
  });
  
  return pluginId;
}

// ==================== 导出系统单例 ====================

export { pluginManager, middlewareManager, microFrontendManager };
