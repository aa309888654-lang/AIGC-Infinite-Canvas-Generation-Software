/**
 * v3 声明层 — 插件 / JSON manifest 加载器
 */
import { nodeRegistry } from './node-registry';
import type { NodeManifestFile } from './types/node-manifest';

const manifestModules = import.meta.glob('../config/nodes/*.json', {
  eager: true,
}) as Record<string, { default: NodeManifestFile }>;

class PluginLoader {
  private loaded = false;

  /** 加载内置 JSON manifest（覆盖/增强 NODE_TYPES 元数据） */
  loadBuiltInManifests(): void {
    if (this.loaded) return;
    nodeRegistry.init();

    for (const mod of Object.values(manifestModules)) {
      try {
        const file = mod?.default;
        if (file?.id) {
          nodeRegistry.registerFromFile(file);
        }
      } catch (err) {
        console.warn('[PluginLoader] 跳过无效 manifest:', err);
      }
    }

    this.loaded = true;
  }

  /** 运行时加载外部插件 manifest（Phase 5 插件市场预留） */
  loadPluginManifests(files: NodeManifestFile[]): number {
    let count = 0;
    for (const file of files) {
      if (!file?.id) continue;
      nodeRegistry.registerFromFile(file);
      count++;
    }
    return count;
  }
}

export const pluginLoader = new PluginLoader();
