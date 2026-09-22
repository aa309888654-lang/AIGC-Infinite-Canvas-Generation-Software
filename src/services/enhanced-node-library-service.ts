import { logger } from '@/lib/logger';
import {
  NodeFavorite,
  NodeHistoryItem,
  NodeUsageStats,
  EnhancedNodeTemplate,
  NodeTag,
  NodeLibraryConfig,
  DEFAULT_NODE_LIBRARY_CONFIG,
  PRESET_TEMPLATES,
  NODE_TAGS
} from '@/types/enhanced-node-library';
import { NodeTypeDefinition } from '@/types/node-system';

export class EnhancedNodeLibraryService {
  private static instance: EnhancedNodeLibraryService;
  private favorites: Map<string, NodeFavorite> = new Map();
  private history: NodeHistoryItem[] = [];
  private usageStats: Map<string, NodeUsageStats> = new Map();
  private templates: Map<string, EnhancedNodeTemplate> = new Map();
  private customTags: Map<string, NodeTag> = new Map();
  private config: NodeLibraryConfig;
  private readonly STORAGE_KEYS = {
    FAVORITES: 'node_favorites',
    HISTORY: 'node_history',
    USAGE_STATS: 'node_usage_stats',
    TEMPLATES: 'node_templates',
    CUSTOM_TAGS: 'node_custom_tags',
    CONFIG: 'node_library_config'
  };

  private constructor() {
    this.config = { ...DEFAULT_NODE_LIBRARY_CONFIG };
    this.loadFromStorage();
    this.initializePresets();
  }

  static getInstance(): EnhancedNodeLibraryService {
    if (!EnhancedNodeLibraryService.instance) {
      EnhancedNodeLibraryService.instance = new EnhancedNodeLibraryService();
    }
    return EnhancedNodeLibraryService.instance;
  }

  private initializePresets(): void {
    PRESET_TEMPLATES.forEach(template => {
      this.templates.set(template.id, template);
    });

    NODE_TAGS.forEach(tag => {
      if (!this.customTags.has(tag.id)) {
        this.customTags.set(tag.id, tag);
      }
    });
  }

  private loadFromStorage(): void {
    try {
      const savedFavorites = localStorage.getItem(this.STORAGE_KEYS.FAVORITES);
      if (savedFavorites) {
        const favorites = JSON.parse(savedFavorites);
        favorites.forEach((fav: NodeFavorite) => {
          this.favorites.set(fav.nodeId, fav);
        });
      }

      const savedHistory = localStorage.getItem(this.STORAGE_KEYS.HISTORY);
      if (savedHistory) {
        this.history = JSON.parse(savedHistory);
      }

      const savedStats = localStorage.getItem(this.STORAGE_KEYS.USAGE_STATS);
      if (savedStats) {
        const stats = JSON.parse(savedStats);
        stats.forEach((stat: NodeUsageStats) => {
          this.usageStats.set(stat.nodeId, stat);
        });
      }

      const savedTemplates = localStorage.getItem(this.STORAGE_KEYS.TEMPLATES);
      if (savedTemplates) {
        const templates = JSON.parse(savedTemplates);
        templates.forEach((template: EnhancedNodeTemplate) => {
          this.templates.set(template.id, template);
        });
      }

      const savedTags = localStorage.getItem(this.STORAGE_KEYS.CUSTOM_TAGS);
      if (savedTags) {
        const tags = JSON.parse(savedTags);
        tags.forEach((tag: NodeTag) => {
          this.customTags.set(tag.id, tag);
        });
      }

      const savedConfig = localStorage.getItem(this.STORAGE_KEYS.CONFIG);
      if (savedConfig) {
        this.config = { ...DEFAULT_NODE_LIBRARY_CONFIG, ...JSON.parse(savedConfig) };
      }
    } catch (error) {
      logger.warn('加载节点库数据失败:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(
        this.STORAGE_KEYS.FAVORITES,
        JSON.stringify(Array.from(this.favorites.values()))
      );

      localStorage.setItem(
        this.STORAGE_KEYS.HISTORY,
        JSON.stringify(this.history.slice(0, this.config.maxHistorySize))
      );

      localStorage.setItem(
        this.STORAGE_KEYS.USAGE_STATS,
        JSON.stringify(Array.from(this.usageStats.values()))
      );

      const userTemplates = Array.from(this.templates.values()).filter(t => !t.isPreset);
      localStorage.setItem(this.STORAGE_KEYS.TEMPLATES, JSON.stringify(userTemplates));

      localStorage.setItem(
        this.STORAGE_KEYS.CUSTOM_TAGS,
        JSON.stringify(Array.from(this.customTags.values()))
      );

      localStorage.setItem(this.STORAGE_KEYS.CONFIG, JSON.stringify(this.config));
    } catch (error) {
      logger.warn('保存节点库数据失败:', error);
    }
  }

  addFavorite(nodeId: string): boolean {
    if (this.favorites.has(nodeId)) {
      return false;
    }

    const favorite: NodeFavorite = {
      nodeId,
      addedAt: Date.now(),
      usageCount: 0,
      lastUsedAt: Date.now()
    };

    this.favorites.set(nodeId, favorite);
    this.saveToStorage();
    logger.info(`节点 ${nodeId} 已添加到收藏`);
    return true;
  }

  removeFavorite(nodeId: string): boolean {
    const success = this.favorites.delete(nodeId);
    if (success) {
      this.saveToStorage();
      logger.info(`节点 ${nodeId} 已从收藏移除`);
    }
    return success;
  }

  isFavorite(nodeId: string): boolean {
    return this.favorites.has(nodeId);
  }

  getFavorites(): NodeFavorite[] {
    return Array.from(this.favorites.values()).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  }

  addToHistory(nodeId: string, workflowId?: string): void {
    const item: NodeHistoryItem = {
      nodeId,
      usedAt: Date.now(),
      workflowId
    };

    this.history.unshift(item);
    this.history = this.history.slice(0, this.config.maxHistorySize);

    const favorite = this.favorites.get(nodeId);
    if (favorite) {
      favorite.usageCount++;
      favorite.lastUsedAt = Date.now();
    }

    this.updateUsageStats(nodeId);
    this.saveToStorage();
  }

  getHistory(limit?: number): NodeHistoryItem[] {
    return limit ? this.history.slice(0, limit) : [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.saveToStorage();
    logger.info('节点使用历史已清空');
  }

  private updateUsageStats(nodeId: string): void {
    const existing = this.usageStats.get(nodeId);
    if (!existing) {
      this.usageStats.set(nodeId, {
        nodeId,
        totalUsage: 1,
        lastUsed: Date.now(),
        successRate: 1
      });
    } else {
      existing.totalUsage++;
      existing.lastUsed = Date.now();
    }
  }

  getUsageStats(nodeId: string): NodeUsageStats | undefined {
    return this.usageStats.get(nodeId);
  }

  getAllUsageStats(): NodeUsageStats[] {
    return Array.from(this.usageStats.values());
  }

  recordNodeExecution(nodeId: string, success: boolean, executionTime?: number): void {
    const stats = this.usageStats.get(nodeId);
    if (!stats) return;

    if (executionTime) {
      const currentAvg = stats.averageExecutionTime || 0;
      const count = stats.totalUsage;
      stats.averageExecutionTime = (currentAvg * (count - 1) + executionTime) / count;
    }

    if (stats.totalUsage > 0) {
      const successCount = Math.floor(stats.successRate * (stats.totalUsage - 1));
      stats.successRate = (successCount + (success ? 1 : 0)) / stats.totalUsage;
    }

    this.saveToStorage();
  }

  getRecommendations(
    currentNodes: string[],
    limit: number = 5
  ): NodeTypeDefinition[] {
    const stats = this.getAllUsageStats();

    const sortedStats = stats
      .filter(stat => !currentNodes.includes(stat.nodeId))
      .sort((a, b) => b.totalUsage - a.totalUsage)
      .slice(0, limit);

    return sortedStats.map(stat => {
      return { id: stat.nodeId } as NodeTypeDefinition;
    });
  }

  getSmartRecommendations(
    context: { currentNodes: string[]; recentNodes: string[] }
  ): string[] {
    const scores = new Map<string, number>();
    const currentSet = new Set(context.currentNodes);

    const stats = this.getAllUsageStats();
    stats.forEach(stat => {
      if (!currentSet.has(stat.nodeId)) {
        let score = stat.totalUsage;
        if (stat.lastUsed) {
          const recency = Math.max(0, 1 - (Date.now() - stat.lastUsed) / (7 * 24 * 60 * 60 * 1000));
          score *= (1 + recency);
        }
        scores.set(stat.nodeId, score);
      }
    });

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nodeId]) => nodeId);
  }

  saveTemplate(template: Omit<EnhancedNodeTemplate, 'createdAt' | 'updatedAt' | 'isPreset'>): string {
    const id = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const newTemplate: EnhancedNodeTemplate = {
      ...template,
      id,
      isPreset: false,
      createdAt: now,
      updatedAt: now
    };

    this.templates.set(id, newTemplate);
    this.saveToStorage();
    logger.info(`模板 ${template.name} 已保存`);
    return id;
  }

  updateTemplate(id: string, updates: Partial<EnhancedNodeTemplate>): boolean {
    const template = this.templates.get(id);
    if (!template || template.isPreset) {
      return false;
    }

    this.templates.set(id, {
      ...template,
      ...updates,
      updatedAt: Date.now()
    });

    this.saveToStorage();
    logger.info(`模板 ${template.name} 已更新`);
    return true;
  }

  deleteTemplate(id: string): boolean {
    const template = this.templates.get(id);
    if (!template || template.isPreset) {
      return false;
    }

    const success = this.templates.delete(id);
    if (success) {
      this.saveToStorage();
      logger.info(`模板 ${template.name} 已删除`);
    }
    return success;
  }

  getTemplate(id: string): EnhancedNodeTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): EnhancedNodeTemplate[] {
    return Array.from(this.templates.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getPresetTemplates(): EnhancedNodeTemplate[] {
    return Array.from(this.templates.values())
      .filter(t => t.isPreset)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getUserTemplates(): EnhancedNodeTemplate[] {
    return Array.from(this.templates.values())
      .filter(t => !t.isPreset)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  addTag(tag: Omit<NodeTag, 'nodeIds'>): string {
    const id = `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTag: NodeTag = {
      ...tag,
      id,
      nodeIds: []
    };

    this.customTags.set(id, newTag);
    this.saveToStorage();
    logger.info(`标签 ${tag.name} 已创建`);
    return id;
  }

  deleteTag(tagId: string): boolean {
    const success = this.customTags.delete(tagId);
    if (success) {
      this.saveToStorage();
      logger.info('标签已删除');
    }
    return success;
  }

  addNodeToTag(tagId: string, nodeId: string): boolean {
    const tag = this.customTags.get(tagId);
    if (!tag) return false;

    if (!tag.nodeIds.includes(nodeId)) {
      tag.nodeIds.push(nodeId);
      this.saveToStorage();
    }
    return true;
  }

  removeNodeFromTag(tagId: string, nodeId: string): boolean {
    const tag = this.customTags.get(tagId);
    if (!tag) return false;

    const index = tag.nodeIds.indexOf(nodeId);
    if (index > -1) {
      tag.nodeIds.splice(index, 1);
      this.saveToStorage();
    }
    return true;
  }

  getTags(): NodeTag[] {
    return Array.from(this.customTags.values());
  }

  getNodeTags(nodeId: string): NodeTag[] {
    return Array.from(this.customTags.values()).filter(tag =>
      tag.nodeIds.includes(nodeId)
    );
  }

  getConfig(): NodeLibraryConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<NodeLibraryConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveToStorage();
    logger.info('节点库配置已更新');
  }

  resetConfig(): void {
    this.config = { ...DEFAULT_NODE_LIBRARY_CONFIG };
    this.saveToStorage();
    logger.info('节点库配置已重置');
  }

  resetAll(): void {
    this.favorites.clear();
    this.history = [];
    this.usageStats.clear();
    this.customTags.clear();
    this.templates.clear();
    this.config = { ...DEFAULT_NODE_LIBRARY_CONFIG };
    this.initializePresets();
    this.saveToStorage();
    logger.info('节点库已重置');
  }

  exportData(): string {
    const data = {
      favorites: Array.from(this.favorites.values()),
      history: this.history,
      usageStats: Array.from(this.usageStats.values()),
      templates: this.getUserTemplates(),
      tags: this.getTags(),
      config: this.config,
      exportedAt: Date.now()
    };
    return JSON.stringify(data, null, 2);
  }

  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);

      if (data.favorites) {
        data.favorites.forEach((fav: NodeFavorite) => {
          this.favorites.set(fav.nodeId, fav);
        });
      }

      if (data.history) {
        this.history = [...data.history, ...this.history].slice(0, this.config.maxHistorySize);
      }

      if (data.usageStats) {
        data.usageStats.forEach((stat: NodeUsageStats) => {
          const existing = this.usageStats.get(stat.nodeId);
          if (existing) {
            existing.totalUsage += stat.totalUsage;
            existing.lastUsed = stat.lastUsed;
          } else {
            this.usageStats.set(stat.nodeId, stat);
          }
        });
      }

      if (data.templates) {
        data.templates.forEach((template: EnhancedNodeTemplate) => {
          if (!this.templates.has(template.id)) {
            this.templates.set(template.id, template);
          }
        });
      }

      if (data.tags) {
        data.tags.forEach((tag: NodeTag) => {
          if (!this.customTags.has(tag.id)) {
            this.customTags.set(tag.id, tag);
          }
        });
      }

      if (data.config) {
        this.config = { ...this.config, ...data.config };
      }

      this.saveToStorage();
      logger.info('节点库数据已导入');
      return true;
    } catch (error) {
      logger.error('导入节点库数据失败:', error);
      return false;
    }
  }
}

export const enhancedNodeLibraryService = EnhancedNodeLibraryService.getInstance();
