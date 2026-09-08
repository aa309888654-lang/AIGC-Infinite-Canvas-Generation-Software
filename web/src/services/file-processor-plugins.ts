/**
 * 文件处理插件系统
 * 可扩展的文件处理插件架构
 */
import type { ProcessedFile, FileMetadata } from './enhanced-file-processor';

// 插件接口
export interface FileProcessorPlugin {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description?: string;
  /** 支持的文件类型 */
  supportedTypes: string[];
  /** 优先级（数字越小越先执行） */
  priority?: number;
  /** 处理前钩子 */
  onBeforeProcess?: (file: ProcessedFile) => ProcessedFile | Promise<ProcessedFile>;
  /** 处理后钩子 */
  onAfterProcess?: (file: ProcessedFile) => ProcessedFile | Promise<ProcessedFile>;
  /** 元数据提取钩子 */
  onExtractMetadata?: (file: File, metadata: FileMetadata) => FileMetadata | Promise<FileMetadata>;
  /** 缩略图生成钩子 */
  onCreateThumbnail?: (file: File, thumbnail: string) => string | Promise<string>;
}

// 插件管理器
class FileProcessorPluginManager {
  private plugins: FileProcessorPlugin[] = [];
  
  /** 注册插件 */
  registerPlugin(plugin: FileProcessorPlugin): void {
    // 检查是否已存在同名插件
    const existing = this.plugins.find(p => p.name === plugin.name);
    if (existing) {
      console.warn(`插件 ${plugin.name} 已存在，将被替换`);
      this.plugins = this.plugins.filter(p => p.name !== plugin.name);
    }
    
    this.plugins.push(plugin);
    // 按优先级排序
    this.plugins.sort((a, b) => (a.priority || 100) - (b.priority || 100));
    // console.log(`[FileProcessor] 注册插件: ${plugin.name} (v${plugin.version})`);
  }
  
  /** 移除插件 */
  unregisterPlugin(name: string): void {
    this.plugins = this.plugins.filter(p => p.name !== name);
    // console.log(`[FileProcessor] 移除插件: ${name}`);
  }
  
  /** 获取所有插件 */
  getPlugins(): FileProcessorPlugin[] {
    return [...this.plugins];
  }
  
  /** 获取支持指定类型的插件 */
  getPluginsForType(fileType: string): FileProcessorPlugin[] {
    return this.plugins.filter(p => p.supportedTypes.includes(fileType));
  }
  
  /** 执行处理前钩子 */
  async executeBeforeProcess(file: ProcessedFile): Promise<ProcessedFile> {
    let result = file;
    for (const plugin of this.plugins) {
      if (plugin.onBeforeProcess && this.isPluginApplicable(plugin, file.type)) {
        result = await plugin.onBeforeProcess(result);
      }
    }
    return result;
  }
  
  /** 执行处理后钩子 */
  async executeAfterProcess(file: ProcessedFile): Promise<ProcessedFile> {
    let result = file;
    for (const plugin of this.plugins) {
      if (plugin.onAfterProcess && this.isPluginApplicable(plugin, file.type)) {
        result = await plugin.onAfterProcess(result);
      }
    }
    return result;
  }
  
  /** 执行元数据提取钩子 */
  async executeExtractMetadata(file: File, metadata: FileMetadata): Promise<FileMetadata> {
    let result = metadata;
    const fileType = file.type.split('/')[0];
    for (const plugin of this.plugins) {
      if (plugin.onExtractMetadata && plugin.supportedTypes.includes(fileType)) {
        result = await plugin.onExtractMetadata(file, result);
      }
    }
    return result;
  }
  
  /** 检查插件是否适用于指定文件类型 */
  private isPluginApplicable(plugin: FileProcessorPlugin, fileType: string): boolean {
    return plugin.supportedTypes.includes(fileType) || 
           plugin.supportedTypes.includes('*');
  }
}

// 插件管理器单例
export const pluginManager = new FileProcessorPluginManager();

// ==================== 内置插件 ====================

/** 水印插件 */
export const watermarkPlugin: FileProcessorPlugin = {
  name: 'watermark',
  version: '1.0.0',
  description: '添加水印',
  supportedTypes: ['image'],
  priority: 10,
  onAfterProcess: async (file) => {
    // 可以在这里添加水印逻辑
    // 目前只是占位
    return file;
  },
};

/** 压缩插件 */
export const compressionPlugin: FileProcessorPlugin = {
  name: 'compression',
  version: '1.0.0',
  description: '自动压缩大文件',
  supportedTypes: ['image', 'video'],
  priority: 5,
  onBeforeProcess: async (file) => {
    // 可以在这里添加压缩逻辑
    return file;
  },
};

/** 重命名插件 */
export const renamePlugin: FileProcessorPlugin = {
  name: 'auto-rename',
  version: '1.0.0',
  description: '自动重命名文件',
  supportedTypes: ['*'],
  priority: 1,
  onAfterProcess: (file) => {
    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const newName = `${file.type}_${timestamp}.${ext}`;
    return { ...file, name: newName };
  },
};

/** 元数据清理插件 */
export const metadataCleanupPlugin: FileProcessorPlugin = {
  name: 'metadata-cleanup',
  version: '1.0.0',
  description: '清理敏感元数据',
  supportedTypes: ['image'],
  priority: 20,
  onAfterProcess: (file) => {
    // 清理敏感元数据
    if (file.metadata) {
      const cleaned = { ...file.metadata };
      delete (cleaned as any).lastModified;
      return { ...file, metadata: cleaned };
    }
    return file;
  },
};

// 注册内置插件
export function registerBuiltinPlugins(): void {
  pluginManager.registerPlugin(watermarkPlugin);
  pluginManager.registerPlugin(compressionPlugin);
  pluginManager.registerPlugin(renamePlugin);
  pluginManager.registerPlugin(metadataCleanupPlugin);
  // console.log('[FileProcessor] 内置插件已注册');
}

export default {
  pluginManager,
  registerBuiltinPlugins,
  watermarkPlugin,
  compressionPlugin,
  renamePlugin,
  metadataCleanupPlugin,
};
