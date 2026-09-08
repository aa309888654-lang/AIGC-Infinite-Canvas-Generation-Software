import { UnifiedCacheService } from './unified-cache-service';
import { KeyboardShortcutManager } from './keyboard-shortcuts';
import { logger } from '@/lib/logger';
type ServiceFactory<T> = () => T;
type ServiceInitializer<T> = (instance: T) => void | Promise<void>;

interface ServiceConfig<T> {
  name: string;
  factory?: ServiceFactory<T>;
  initializer?: ServiceInitializer<T>;
  lazy?: boolean;
  dependencies?: string[];
}

class ServiceContainer {
  private static instance: ServiceContainer;
  private services: Map<string, unknown> = new Map();
  private configs: Map<string, ServiceConfig<any>> = new Map();
  private initializing: Set<string> = new Set();

  private constructor() { /* noop */ }

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  register<T>(config: ServiceConfig<T>): void {
    this.configs.set(config.name, config as ServiceConfig<any>);
    if (!config.lazy && !config.factory) {
      logger.warn(`Service ${config.name} is not lazy but has no factory`);
    }
  }

  get<T>(name: string): T | undefined {
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    const config = this.configs.get(name);
    if (!config) {
      logger.warn(`Service ${name} not registered`);
      return undefined;
    }

    if (this.initializing.has(name)) {
      logger.error(`Circular dependency detected for service ${name}`);
      return undefined;
    }

    this.initializing.add(name);

    if (config.dependencies) {
      for (const dep of config.dependencies) {
        if (!this.services.has(dep)) {
          this.get(dep);
        }
      }
    }

    let instance: T;
    if (config.factory) {
      instance = config.factory() as T;
    } else {
      instance = this.createDefaultInstance(name) as T;
    }

    this.services.set(name, instance);
    this.initializing.delete(name);

    if (config.initializer) {
      Promise.resolve(config.initializer(instance)).catch(err => {
        logger.error(`Failed to initialize service ${name}:`, err);
      });
    }

    return instance;
  }

  private createDefaultInstance<T>(name: string): T | undefined {
    switch (name) {
      case 'cache':
        return UnifiedCacheService.getInstance() as T;
      case 'keyboard':
        return KeyboardShortcutManager.getInstance() as T;
      default:
        logger.warn(`No default factory for service ${name}`);
        return undefined;
    }
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  async initializeAll(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    this.configs.forEach((config, name) => {
      if (!config.lazy) {
        this.get(name);
      }
    });

    await Promise.all(initPromises);
    logger.info('All services initialized');
  }

  dispose(name: string): void {
    const service = this.services.get(name);
    if (service && typeof (service as any).dispose === 'function') {
      (service as any).dispose();
    }
    this.services.delete(name);
    logger.info(`Service ${name} disposed`);
  }

  disposeAll(): void {
    this.services.forEach((service, name) => {
      if (typeof (service as any).dispose === 'function') {
        try {
          (service as any).dispose();
        } catch (err) {
          logger.error(`Failed to dispose service ${name}:`, err);
        }
      }
    });
    this.services.clear();
    logger.info('All services disposed');
  }

  getServiceStats(): { name: string; initialized: boolean }[] {
    const stats: { name: string; initialized: boolean }[] = [];
    this.configs.forEach((config, name) => {
      stats.push({
        name,
        initialized: this.services.has(name),
      });
    });
    return stats;
  }
}

export const serviceContainer = ServiceContainer.getInstance();

export function registerService<T>(config: ServiceConfig<T>): void {
  serviceContainer.register(config);
}

export function getService<T>(name: string): T | undefined {
  return serviceContainer.get<T>(name);
}

export function initializeServices(): Promise<void> {
  return serviceContainer.initializeAll();
}

export function disposeServices(): void {
  serviceContainer.disposeAll();
}

export function registerCoreServices(): void {
  registerService({
    name: 'cache',
    lazy: false,
    initializer: (_instance) => {
      logger.info('Cache service initialized');
    },
  });

  registerService({
    name: 'keyboard',
    lazy: false,
    initializer: (_instance) => {
      logger.info('Keyboard shortcut service initialized');
    },
  });
}
