/**
 * 微前端架构系统
 * 支持功能模块拆分和独立微应用加载
 * 实现单体应用的解耦和可维护性
 */

// ==================== 类型定义 ====================

// 微应用类型
export type MicroAppType = 'node' | 'panel' | 'tool' | 'adapter' | 'theme';

// 微应用状态
export type MicroAppStatus = 'loading' | 'loaded' | 'active' | 'inactive' | 'error';

// 微应用清单
export interface MicroAppManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: MicroAppType;
  entry: string;
  routes?: MicroAppRoute[];
  dependencies?: string[];
  permissions?: string[];
  styles?: string[];
  scripts?: string[];
  assets?: string[];
}

// 路由配置
export interface MicroAppRoute {
  path: string;
  component?: string;
  lazyComponent?: () => Promise<any>;
}

// 微应用实例
export interface MicroAppInstance {
  id: string;
  manifest: MicroAppManifest;
  status: MicroAppStatus;
  module?: any;
  instance?: any;
  error?: Error;
  loadedAt?: Date;
}

// 微应用配置
export interface MicroAppConfig {
  id: string;
  name: string;
  enabled: boolean;
  autoLoad: boolean;
  priority: number;
  routePrefix?: string;
}

// 加载选项
export interface LoadOptions {
  timeout?: number;
  retries?: number;
  lazy?: boolean;
}

// ==================== 错误类型 ====================

export class MicroAppError extends Error {
  constructor(
    message: string,
    public code: string,
    public appId?: string
  ) {
    super(message);
    this.name = 'MicroAppError';
  }
}

export class MicroAppLoadError extends MicroAppError {
  constructor(message: string, appId?: string) {
    super(message, 'LOAD_ERROR', appId);
    this.name = 'MicroAppLoadError';
  }
}

export class MicroAppNotFoundError extends MicroAppError {
  constructor(appId: string) {
    super(`微应用未找到: ${appId}`, 'NOT_FOUND', appId);
    this.name = 'MicroAppNotFoundError';
  }
}

// ==================== 微前端管理器 ====================

class MicroFrontendManager {
  private static instance: MicroFrontendManager;
  private apps: Map<string, MicroAppInstance> = new Map();
  private configs: Map<string, MicroAppConfig> = new Map();
  private activeRoutes: Map<string, string> = new Map(); // path -> appId
  private appLoaders: Map<string, () => Promise<any>> = new Map();
  private eventHandlers: Map<string, Set<(...args: any[]) => void>> = new Map();
  
  private constructor() {
    this.loadConfigsFromStorage();
  }
  
  static getInstance(): MicroFrontendManager {
    if (!MicroFrontendManager.instance) {
      MicroFrontendManager.instance = new MicroFrontendManager();
    }
    return MicroFrontendManager.instance;
  }
  
  // ==================== 应用注册 ====================
  
  // 注册微应用
  async register(manifest: MicroAppManifest): Promise<void> {
    if (this.apps.has(manifest.id)) {
      console.warn(`[MicroFrontend] 应用 ${manifest.id} 已存在，将被覆盖`);
    }
    
    const instance: MicroAppInstance = {
      id: manifest.id,
      manifest,
      status: 'loading'
    };
    
    this.apps.set(manifest.id, instance);
    this.saveConfigsToStorage();
    
    // console.log(`[MicroFrontend] 注册微应用: ${manifest.name} (${manifest.id})`);
    
    // 触发事件
    this.emit('appRegistered', { manifest });
    
    // 如果配置为自动加载，则加载
    const config = this.configs.get(manifest.id);
    if (config?.autoLoad) {
      await this.load(manifest.id);
    }
  }
  
  // 批量注册
  async registerMany(manifests: MicroAppManifest[]): Promise<void> {
    for (const manifest of manifests) {
      await this.register(manifest);
    }
  }
  
  // 注销微应用
  async unregister(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) return;
    
    // 如果应用已加载，先卸载
    if (app.status === 'loaded' || app.status === 'active') {
      await this.unload(appId);
    }
    
    this.apps.delete(appId);
    this.configs.delete(appId);
    this.saveConfigsToStorage();
    
    // console.log(`[MicroFrontend] 注销微应用: ${appId}`);
    this.emit('appUnregistered', { appId });
  }
  
  // ==================== 应用加载 ====================
  
  // 加载微应用
  async load(appId: string, options: LoadOptions = {}): Promise<MicroAppInstance> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new MicroAppNotFoundError(appId);
    }
    
    if (app.status === 'loaded' || app.status === 'active') {
      return app;
    }
    
    const timeout = options.timeout || 30000;
    const retries = options.retries || 3;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        app.status = 'loading';
        
        // 创建加载超时
        const loadPromise = this.loadAppModule(app);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('加载超时')), timeout)
        );
        
        const module = await Promise.race([loadPromise, timeoutPromise]);
        
        app.module = module;
        app.status = 'loaded';
        app.loadedAt = new Date();
        
        // 尝试实例化（如果模块有 bootstrap 或 default 导出）
        if (module && typeof module === 'object') {
          if (module.bootstrap) {
            app.instance = await module.bootstrap();
          } else if (module.default) {
            app.instance = module.default;
          }
        }
        
        // console.log(`[MicroFrontend] 加载微应用成功: ${appId}`);
        this.emit('appLoaded', { appId, instance: app });
        
        return app;
      } catch (error) {
        console.error(`[MicroFrontend] 加载微应用失败 (尝试 ${attempt + 1}/${retries}):`, error);
        
        if (attempt === retries - 1) {
          app.status = 'error';
          app.error = error as Error;
          throw new MicroAppLoadError(`加载失败: ${(error as Error).message}`, appId);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return app;
  }
  
  // 加载应用模块
  private async loadAppModule(app: MicroAppInstance): Promise<any> {
    const { entry } = app.manifest;
    
    // 动态导入
    const module = await import(/* @vite-ignore */ entry);
    return module;
  }
  
  // 卸载微应用
  async unload(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) return;
    
    if (app.instance && typeof app.instance.unmount === 'function') {
      app.instance.unmount();
    }
    
    app.status = 'inactive';
    app.module = undefined;
    app.instance = undefined;
    
    // console.log(`[MicroFrontend] 卸载微应用: ${appId}`);
    this.emit('appUnloaded', { appId });
  }
  
  // 激活微应用
  async activate(appId: string): Promise<void> {
    const app = await this.load(appId);
    
    if (app.status !== 'loaded') {
      throw new MicroAppError('应用未加载', 'NOT_LOADED', appId);
    }
    
    app.status = 'active';
    
    // 注册路由
    if (app.manifest.routes) {
      for (const route of app.manifest.routes) {
        this.activeRoutes.set(route.path, appId);
      }
    }
    
    // console.log(`[MicroFrontend] 激活微应用: ${appId}`);
    this.emit('appActivated', { appId });
  }
  
  // 停用微应用
  async deactivate(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) return;
    
    app.status = 'loaded';
    
    // 注销路由
    if (app.manifest.routes) {
      for (const route of app.manifest.routes) {
        this.activeRoutes.delete(route.path);
      }
    }
    
    // console.log(`[MicroFrontend] 停用微应用: ${appId}`);
    this.emit('appDeactivated', { appId });
  }
  
  // ==================== 应用获取 ====================
  
  // 获取应用
  get(appId: string): MicroAppInstance | undefined {
    return this.apps.get(appId);
  }
  
  // 获取所有应用
  getAll(): MicroAppInstance[] {
    return Array.from(this.apps.values());
  }
  
  // 获取已加载的应用
  getLoaded(): MicroAppInstance[] {
    return this.getAll().filter(app => app.status === 'loaded' || app.status === 'active');
  }
  
  // 获取激活的应用
  getActive(): MicroAppInstance[] {
    return this.getAll().filter(app => app.status === 'active');
  }
  
  // 按类型获取
  getByType(type: MicroAppType): MicroAppInstance[] {
    return this.getAll().filter(app => app.manifest.type === type);
  }
  
  // 根据路径获取应用
  getByPath(path: string): MicroAppInstance | undefined {
    const appId = this.activeRoutes.get(path);
    if (appId) {
      return this.apps.get(appId);
    }
    return undefined;
  }
  
  // ==================== 配置管理 ====================
  
  // 获取配置
  getConfig(appId: string): MicroAppConfig | undefined {
    return this.configs.get(appId);
  }
  
  // 设置配置
  setConfig(config: MicroAppConfig): void {
    this.configs.set(config.id, config);
    this.saveConfigsToStorage();
  }
  
  // 启用/禁用应用
  async setEnabled(appId: string, enabled: boolean): Promise<void> {
    const config = this.configs.get(appId) || {
      id: appId,
      name: appId,
      enabled,
      autoLoad: false,
      priority: 0
    };
    
    config.enabled = enabled;
    this.configs.set(appId, config);
    
    if (enabled) {
      await this.load(appId);
    } else {
      await this.unload(appId);
    }
    
    this.saveConfigsToStorage();
  }
  
  // ==================== 事件系统 ====================
  
  // 订阅事件
  on(event: string, handler: (...args: any[]) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    
    return () => this.eventHandlers.get(event)?.delete(handler);
  }
  
  // 发布事件
  emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[MicroFrontend] 事件处理失败 ${event}:`, error);
      }
    });
  }
  
  // ==================== 持久化 ====================
  
  private saveConfigsToStorage(): void {
    try {
      const data = Array.from(this.configs.entries());
      localStorage.setItem('microFrontendConfigs', JSON.stringify(data));
    } catch (e) {
      console.error('[MicroFrontend] 保存配置失败:', e);
    }
  }
  
  private loadConfigsFromStorage(): void {
    try {
      const data = localStorage.getItem('microFrontendConfigs');
      if (data) {
        const parsed = JSON.parse(data);
        this.configs = new Map(parsed);
      }
    } catch (e) {
      console.error('[MicroFrontend] 加载配置失败:', e);
    }
  }
  
  // ==================== 工具方法 ====================
  
  // 导出所有数据
  exportData(): string {
    return JSON.stringify({
      apps: Array.from(this.apps.entries()).map(([id, app]) => [
        id,
        {
          ...app,
          module: undefined,
          instance: undefined
        }
      ]),
      configs: Array.from(this.configs.entries())
    }, null, 2);
  }
  
  // 清空所有数据
  clear(): void {
    this.apps.clear();
    this.activeRoutes.clear();
    this.configs.clear();
    localStorage.removeItem('microFrontendConfigs');
  }
}

// 导出单例
export const microFrontendManager = MicroFrontendManager.getInstance();

// ==================== 便捷函数 ====================

// 注册微应用
export async function registerMicroApp(manifest: MicroAppManifest): Promise<void> {
  await microFrontendManager.register(manifest);
}

// 加载微应用
export async function loadMicroApp(appId: string, options?: LoadOptions): Promise<MicroAppInstance> {
  return microFrontendManager.load(appId, options);
}

// 卸载微应用
export async function unloadMicroApp(appId: string): Promise<void> {
  return microFrontendManager.unload(appId);
}

// 激活微应用
export async function activateMicroApp(appId: string): Promise<void> {
  return microFrontendManager.activate(appId);
}

// 停用微应用
export async function deactivateMicroApp(appId: string): Promise<void> {
  return microFrontendManager.deactivate(appId);
}

// 获取微应用
export function getMicroApp(appId: string): MicroAppInstance | undefined {
  return microFrontendManager.get(appId);
}

// 获取所有微应用
export function getAllMicroApps(): MicroAppInstance[] {
  return microFrontendManager.getAll();
}

// ==================== 预定义微应用模板 ====================

// 节点微应用模板
export const createNodeAppManifest = (
  name: string,
  id: string,
  config: Partial<MicroAppManifest> = {}
): MicroAppManifest => ({
  id,
  name,
  version: '1.0.0',
  description: `${name} 节点微应用`,
  author: '开发者',
  type: 'node',
  entry: `./apps/${id}/index.ts`,
  routes: [],
  ...config
});

// 面板微应用模板
export const createPanelAppManifest = (
  name: string,
  id: string,
  routes: string[],
  config: Partial<MicroAppManifest> = {}
): MicroAppManifest => ({
  id,
  name,
  version: '1.0.0',
  description: `${name} 面板微应用`,
  author: '开发者',
  type: 'panel',
  entry: `./apps/${id}/index.tsx`,
  routes: routes.map(path => ({ path })),
  ...config
});

// 工具微应用模板
export const createToolAppManifest = (
  name: string,
  id: string,
  config: Partial<MicroAppManifest> = {}
): MicroAppManifest => ({
  id,
  name,
  version: '1.0.0',
  description: `${name} 工具微应用`,
  author: '开发者',
  type: 'tool',
  entry: `./apps/${id}/index.ts`,
  ...config
});

// ==================== 示例微应用定义 ====================

// 示例：图片处理微应用
export const IMAGE_PROCESSOR_MANIFEST: MicroAppManifest = {
  id: 'app:image-processor',
  name: '图片处理器',
  version: '1.0.0',
  description: '提供图片处理功能的微应用',
  author: '开发者',
  type: 'tool',
  entry: './apps/image-processor/index.ts',
  routes: [{ path: '/tools/image-processor' }]
};

// 示例：视频编辑微应用
export const VIDEO_EDITOR_MANIFEST: MicroAppManifest = {
  id: 'app:video-editor',
  name: '视频编辑器',
  version: '1.0.0',
  description: '提供视频编辑功能的微应用',
  author: '开发者',
  type: 'tool',
  entry: './apps/video-editor/index.ts',
  routes: [{ path: '/tools/video-editor' }]
};

// 示例：预设管理微应用
export const PRESET_MANAGER_MANIFEST: MicroAppManifest = {
  id: 'app:preset-manager',
  name: '预设管理器',
  version: '1.0.0',
  description: '管理工作流预设的微应用',
  author: '开发者',
  type: 'panel',
  entry: './apps/preset-manager/index.tsx',
  routes: [{ path: '/panels/presets' }]
};