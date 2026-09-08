/**
 * 中间件系统
 * 提供节点执行和API调用的请求/响应中间件链
 * 实现功能模块解耦和扩展能力
 */

import { generateId } from '@/lib/utils';
import { logger } from '@/lib/logger';

// ==================== 类型定义 ====================

// 中间件类型
export type MiddlewareType = 'request' | 'response' | 'transform' | 'error';

// 中间件优先级
export const MIDDLEWARE_PRIORITY = {
  HIGHEST: 1000,
  HIGH: 500,
  NORMAL: 0,
  LOW: -500,
  LOWEST: -1000
} as const;

// 中间件上下文
export interface MiddlewareContext {
  // 上下文ID
  id: string;
  // 中间件类型
  type: MiddlewareType;
  // 请求/响应数据
  data: any;
  // 请求参数
  params?: Record<string, any>;
  // 元数据
  metadata?: Record<string, any>;
  // 错误信息
  error?: Error;
  // 时间戳
  timestamp: Date;
  // 节点执行相关
  nodeId?: string;
  nodeType?: string;
  workflowId?: string;
  // API相关
  apiProvider?: string;
  apiEndpoint?: string;
  // 执行状态
  status: 'pending' | 'processing' | 'completed' | 'failed';
  // 原始请求/响应
  originalRequest?: any;
  originalResponse?: any;
}

// 中间件配置
export interface Middleware {
  id: string;
  name: string;
  description?: string;
  type: MiddlewareType;
  priority: number;
  enabled: boolean;
  // 处理函数
  handler: MiddlewareHandler;
  // 条件执行
  condition?: (context: MiddlewareContext) => boolean;
  // 错误处理
  onError?: (error: Error, context: MiddlewareContext) => void;
}

// 中间件处理函数
export type MiddlewareHandler = (
  context: MiddlewareContext,
  next: NextFunction
) => Promise<MiddlewareContext>;

// Next函数类型
export type NextFunction = (context?: MiddlewareContext) => Promise<MiddlewareContext>;

// 预置中间件工厂
export interface MiddlewareFactory {
  name: string;
  create: (options?: any) => Middleware;
}

// ==================== 中间件管理器 ====================

class MiddlewareManager {
  private static instance: MiddlewareManager;
  private middlewares: Map<string, Middleware> = new Map();
  private middlewareChains: Map<string, Middleware[]> = new Map();
  
  private constructor() { /* noop */ }
  
  static getInstance(): MiddlewareManager {
    if (!MiddlewareManager.instance) {
      MiddlewareManager.instance = new MiddlewareManager();
    }
    return MiddlewareManager.instance;
  }
  
  // ==================== 中间件注册 ====================
  
  // 注册中间件
  register(middleware: Middleware): void {
    // 如果ID不存在，生成一个
    if (!middleware.id) {
      middleware.id = generateId();
    }
    
    this.middlewares.set(middleware.id, middleware);
    this.invalidateChains();
    
    logger.debug(`[Middleware] 注册中间件: ${middleware.name} (${middleware.type})`);
  }
  
  // 批量注册中间件
  registerMany(middlewares: Middleware[]): void {
    middlewares.forEach(m => this.register(m));
  }
  
  // 注销中间件
  unregister(idOrName: string): void {
    const middleware = this.middlewares.get(idOrName) || 
      Array.from(this.middlewares.values()).find(m => m.name === idOrName);
    
    if (middleware) {
      this.middlewares.delete(middleware.id);
      this.invalidateChains();
      logger.debug(`[Middleware] 注销中间件: ${middleware.name}`);
    }
  }
  
  // 启用/禁用中间件
  setEnabled(idOrName: string, enabled: boolean): void {
    const middleware = this.middlewares.get(idOrName) ||
      Array.from(this.middlewares.values()).find(m => m.name === idOrName);
    
    if (middleware) {
      middleware.enabled = enabled;
      this.invalidateChains();
    }
  }
  
  // ==================== 中间件获取 ====================
  
  // 获取所有中间件
  getAll(): Middleware[] {
    return Array.from(this.middlewares.values());
  }
  
  // 获取启用的中间件
  getEnabled(): Middleware[] {
    return this.getAll().filter(m => m.enabled);
  }
  
  // 按类型获取
  getByType(type: MiddlewareType): Middleware[] {
    return this.getEnabled().filter(m => m.type === type);
  }
  
  // 获取单个中间件
  get(idOrName: string): Middleware | undefined {
    return this.middlewares.get(idOrName) ||
      Array.from(this.middlewares.values()).find(m => m.name === idOrName);
  }
  
  // ==================== 中间件链执行 ====================
  
  // 创建中间件链
  private buildChain(types: MiddlewareType[]): Middleware[] {
    const chainKey = types.sort().join('-');
    
    if (this.middlewareChains.has(chainKey)) {
      return this.middlewareChains.get(chainKey)!;
    }
    
    // 收集所有匹配类型的中间件
    const chain: Middleware[] = [];
    types.forEach(type => {
      chain.push(...this.getByType(type));
    });
    
    // 按优先级排序
    chain.sort((a, b) => b.priority - a.priority);
    
    this.middlewareChains.set(chainKey, chain);
    return chain;
  }
  
  // 执行中间件链
  async execute(
    initialContext: Partial<MiddlewareContext>,
    types: MiddlewareType[] = ['request', 'response']
  ): Promise<MiddlewareContext> {
    // 构建完整上下文
    const context: MiddlewareContext = {
      id: generateId(),
      type: 'request',
      data: initialContext.data,
      params: initialContext.params,
      metadata: initialContext.metadata,
      timestamp: new Date(),
      status: 'pending',
      ...initialContext
    };
    
    const chain = this.buildChain(types);
    
    if (chain.length === 0) {
      return context;
    }
    
    // 创建索引闭包
    let index = 0;
    
    // 创建next函数
    const next: NextFunction = async (nextContext?: MiddlewareContext): Promise<MiddlewareContext> => {
      if (nextContext) {
        Object.assign(context, nextContext);
      }
      
      if (index >= chain.length) {
        return context;
      }
      
      const middleware = chain[index++];
      
      // 检查条件
      if (middleware.condition && !middleware.condition(context)) {
        return next();
      }
      
      try {
        context.status = 'processing';
        return await middleware.handler(context, next);
      } catch (error) {
        // 错误处理
        context.status = 'failed';
        context.error = error as Error;
        
        if (middleware.onError) {
          middleware.onError(error as Error, context);
        } else {
          console.error(`[Middleware] ${middleware.name} 执行失败:`, error);
        }
        
        // 重新抛出错误，让调用方处理
        throw error;
      }
    };
    
    try {
      const result = await next();
      result.status = 'completed';
      return result;
    } catch (error) {
      context.status = 'failed';
      context.error = error as Error;
      throw error;
    }
  }
  
  // 专门执行请求中间件链
  async executeRequest(context: Partial<MiddlewareContext>): Promise<MiddlewareContext> {
    return this.execute(context, ['request', 'transform']);
  }
  
  // 专门执行响应中间件链
  async executeResponse(context: Partial<MiddlewareContext>): Promise<MiddlewareContext> {
    return this.execute(context, ['response', 'transform']);
  }
  
  // 执行完整请求-响应链
  async executeFull(
    requestContext: Partial<MiddlewareContext>
  ): Promise<{ request: MiddlewareContext; response: MiddlewareContext }> {
    // 执行请求链
    const requestResult = await this.executeRequest(requestContext);
    
    // 模拟API调用（实际调用会在外部执行）
    let apiResponse: any;
    try {
      // 这里可以调用实际的API
      // apiResponse = await callAPI(requestResult.data, requestResult.params);
      apiResponse = { status: 'success', data: requestResult.data };
    } catch (error) {
      // 执行错误中间件
      const errorChain = this.buildChain(['error']);
      for (const middleware of errorChain) {
        if (middleware.condition && !middleware.condition(requestResult)) continue;
        try {
          await middleware.handler(requestResult, async () => requestResult);
        } catch {
          // 忽略中间件错误以继续执行
        }
      }
      throw error;
    }
    
    // 执行响应链
    const responseContext: Partial<MiddlewareContext> = {
      ...requestResult,
      data: apiResponse,
      originalRequest: requestResult.data,
      originalResponse: apiResponse,
      type: 'response'
    };
    
    const responseResult = await this.executeResponse(responseContext);
    
    return {
      request: requestResult,
      response: responseResult
    };
  }
  
  // 使缓存的链失效
  private invalidateChains(): void {
    this.middlewareChains.clear();
  }
  
  // 清空所有中间件
  clear(): void {
    this.middlewares.clear();
    this.middlewareChains.clear();
  }
}

// 导出单例
export const middlewareManager = MiddlewareManager.getInstance();

// ==================== 预置中间件工厂 ====================

// 日志中间件
export const loggingMiddleware: MiddlewareFactory = {
  name: 'logging',
  create: (options = {}) => ({
    id: generateId(),
    name: '日志中间件',
    description: '记录请求和响应日志',
    type: 'transform' as MiddlewareType,
    priority: MIDDLEWARE_PRIORITY.LOWEST,
    enabled: true,
    handler: async (context, next) => {
      logger.debug(`[${context.type}] 开始处理:`, {
        nodeId: context.nodeId,
        nodeType: context.nodeType,
        data: options.logData ? context.data : '[hidden]'
      });
      
      const result = await next();
      
      logger.debug(`[${context.type}] 处理完成:`, {
        status: result.status,
        hasError: !!result.error
      });
      
      return result;
    }
  })
};

// 验证中间件
export const validationMiddleware: MiddlewareFactory = {
  name: 'validation',
  create: (options: { schema?: any; requiredFields?: string[] } = {}) => ({
    id: generateId(),
    name: '验证中间件',
    description: '验证请求数据的有效性',
    type: 'request' as MiddlewareType,
    priority: MIDDLEWARE_PRIORITY.HIGH,
    enabled: true,
    handler: async (context, next) => {
      // 检查必需字段
      if (options.requiredFields) {
        for (const field of options.requiredFields) {
          if (!context.data?.[field] && context.params?.[field] === undefined) {
            throw new Error(`缺少必需字段: ${field}`);
          }
        }
      }
      
      return next();
    }
  })
};

// 缓存中间件
export const cacheMiddleware: MiddlewareFactory = {
  name: 'cache',
  create: (options: { ttl?: number; keyGenerator?: (context: MiddlewareContext) => string } = {}) => {
    const cache = new Map<string, { data: any; expiry: number }>();
    
    return {
      id: generateId(),
      name: '缓存中间件',
      description: '缓存请求结果',
      type: 'request' as MiddlewareType,
      priority: MIDDLEWARE_PRIORITY.HIGH,
      enabled: true,
      condition: (context) => context.type === 'request',
      handler: async (context, next) => {
        const cacheKey = options.keyGenerator ? options.keyGenerator(context) : 
          JSON.stringify({ data: context.data, params: context.params });
        
        const cached = cache.get(cacheKey);
        const now = Date.now();
        
        if (cached && cached.expiry > now) {
          logger.debug('[Cache] 命中缓存');
          return { ...context, data: cached.data, metadata: { ...context.metadata, cached: true } };
        }
        
        const result = await next();
        
        // 存储到缓存
        const ttl = options.ttl || 60000; // 默认1分钟
        cache.set(cacheKey, {
          data: result.data,
          expiry: now + ttl
        });
        
        return result;
      }
    };
  }
};

// 重试中间件
export const retryMiddleware: MiddlewareFactory = {
  name: 'retry',
  create: (options: { maxRetries?: number; delay?: number } = {}) => ({
    id: generateId(),
    name: '重试中间件',
    description: '请求失败时自动重试',
    type: 'request' as MiddlewareType,
    priority: MIDDLEWARE_PRIORITY.LOW,
    enabled: true,
    handler: async (context, next) => {
      const maxRetries = options.maxRetries || 3;
      const delay = options.delay || 1000;
      
      let lastError: Error | undefined;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await next();
        } catch (error) {
          lastError = error as Error;
          logger.debug(`[Retry] 第 ${attempt + 1} 次尝试失败，${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      throw lastError || new Error('重试次数耗尽');
    }
  })
};

// 超时中间件
export const timeoutMiddleware: MiddlewareFactory = {
  name: 'timeout',
  create: (options: { ms?: number } = {}): Middleware => ({
    id: generateId(),
    name: '超时中间件',
    description: '请求超时控制',
    type: 'request' as MiddlewareType,
    priority: MIDDLEWARE_PRIORITY.HIGHEST,
    enabled: true,
    handler: async (context, next): Promise<MiddlewareContext> => {
      const timeout = options.ms || 30000;
      
      return Promise.race([
        next(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`请求超时: ${timeout}ms`)), timeout)
        )
      ]) as Promise<MiddlewareContext>;
    }
  })
};

// 错误处理中间件
export const errorHandlerMiddleware: MiddlewareFactory = {
  name: 'errorHandler',
  create: (options: { onError?: (error: Error) => void } = {}) => ({
    id: generateId(),
    name: '错误处理中间件',
    description: '统一处理请求错误',
    type: 'error' as MiddlewareType,
    priority: MIDDLEWARE_PRIORITY.HIGHEST,
    enabled: true,
    handler: async (context, next) => {
      try {
        return await next();
      } catch (error) {
        context.status = 'failed';
        context.error = error as Error;
        
        if (options.onError) {
          options.onError(error as Error);
        }
        
        // 可以选择重新抛出或返回降级数据
        // throw error;
        return context;
      }
    }
  })
};

// 转换中间件
export const transformMiddleware: MiddlewareFactory = {
  name: 'transform',
  create: (options: { 
    transformRequest?: (data: any) => any;
    transformResponse?: (data: any) => any;
  } = {}) => ({
    id: generateId(),
    name: '数据转换中间件',
    description: '转换请求和响应数据',
    type: 'transform' as MiddlewareType,
    priority: MIDDLEWARE_PRIORITY.NORMAL,
    enabled: true,
    handler: async (context, next) => {
      // 转换请求数据
      if (context.type === 'request' && options.transformRequest) {
        context.data = options.transformRequest(context.data);
      }
      
      const result = await next();
      
      // 转换响应数据
      if (context.type === 'response' && options.transformResponse) {
        result.data = options.transformResponse(result.data);
      }
      
      return result;
    }
  })
};

// ==================== 便捷函数 ====================

// 初始化默认中间件
export function initDefaultMiddlewares(): void {
  middlewareManager.register(loggingMiddleware.create());
  middlewareManager.register(validationMiddleware.create());
  middlewareManager.register(timeoutMiddleware.create({ ms: 60000 }));
  middlewareManager.register(errorHandlerMiddleware.create());
}

// 创建自定义中间件
export function createMiddleware(
  name: string,
  type: MiddlewareType,
  handler: MiddlewareHandler,
  options: Partial<Middleware> = {}
): Middleware {
  return {
    id: generateId(),
    name,
    type,
    priority: MIDDLEWARE_PRIORITY.NORMAL,
    enabled: true,
    handler,
    ...options
  };
}