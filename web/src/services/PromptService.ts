// @ts-nocheck
/**
 * 统一提示词服务层
 * 集成 Qdrant 向量数据库 + 本地缓存 + 智能搜索
 * 支持离线降级、自动同步、智能推荐
 */

import { promptApi, Prompt, CreatePromptDTO, SearchResult } from '@/lib/promptApi';

// ==================== 配置 ====================

const CACHE_SIZE = 100;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟
const LOCAL_STORAGE_KEY = 'prompt_library_v1';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface LocalStorageData {
  prompts: Prompt[];
  lastSync: number;
  version: string;
}

// ==================== 类型定义 ====================

export interface SearchOptions {
  limit?: number;
  category?: string;
  minScore?: number;
  useCache?: boolean;
}

export interface ServiceStats {
  totalPrompts: number;
  totalUses: number;
  avgQuality: number;
  isOnline: boolean;
  cacheHitRate: number;
}

export interface QualityMetrics {
  score: number;           // 综合分数 0-100
  lengthScore: number;      // 长度得分
  keywordScore: number;    // 关键词得分
  structureScore: number;  // 结构得分
  varietyScore: number;    // 多样性得分
}

export interface QualitySuggestion {
  type: 'positive' | 'improvement';
  message: string;
  suggestion?: string;
  reason?: string;
  impact: number;
  category?: string;
}

// ==================== 主服务类 ====================

class UnifiedPromptService {
  private cache = new Map<string, CacheEntry<any>>();
  private localPrompts: Prompt[] = [];
  private isInitialized = false;
  private isOnline = false;
  private cacheHits = 0;
  private cacheMisses = 0;

  // ========== 初始化 ==========

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const online = await promptApi.healthCheck();
      this.isOnline = online;

      if (online) {
        // console.log('[PromptService] ✅ Qdrant 服务在线，加载远程数据...');
        await this.loadFromRemote();
      } else {
        console.warn('[PromptService] ⚠️ Qdrant 服务离线，使用本地缓存');
        this.loadFromLocalStorage();
      }
    } catch (error) {
      console.warn('[PromptService] 初始化失败，使用本地模式:', error);
      this.loadFromLocalStorage();
    }

    this.isInitialized = true;
  }

  // ========== 数据加载 ==========

  private async loadFromRemote(): Promise<void> {
    try {
      const result = await promptApi.list({ limit: CACHE_SIZE });
      this.localPrompts = result.prompts;
      this.syncToLocalStorage();
    } catch (error) {
      console.error('[PromptService] 加载远程数据失败:', error);
      this.loadFromLocalStorage();
    }
  }

  private loadFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const data: LocalStorageData = JSON.parse(raw);
        this.localPrompts = data.prompts || [];
      }
    } catch (error) {
      console.error('[PromptService] 加载本地存储失败:', error);
      this.localPrompts = [];
    }
  }

  private syncToLocalStorage(): void {
    try {
      const data: LocalStorageData = {
        prompts: this.localPrompts.slice(0, CACHE_SIZE),
        lastSync: Date.now(),
        version: '1.0.0',
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('[PromptService] 同步到本地存储失败:', error);
    }
  }

  // ========== 核心功能：搜索 ==========

  /**
   * 智能相似度搜索 - 核心功能
   * 优先使用 Qdrant 向量搜索，降级为本地模糊匹配
   */
  async searchSimilar(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const cacheKey = `search:${query}:${options.category || 'all'}`;

    // 检查缓存
    if (options.useCache !== false) {
      const cached = this.getFromCache<SearchResult[]>(cacheKey);
      if (cached) return cached;
    }

    let results: SearchResult[];

    try {
      // 优先：Qdrant 向量搜索（在线模式）
      if (this.isOnline) {
        const response = await promptApi.search(query, {
          limit: options.limit || 10,
          category: options.category,
          minScore: options.minScore || 0.7,
        });
        results = response.results;
      } else {
        // 降级：本地模糊搜索
        results = this.localSearch(query, options.limit || 10);
      }

      this.setToCache(cacheKey, results);
      return results;
    } catch (error) {
      console.warn('[PromptService] 搜索失败，使用本地降级:', error);
      results = this.localSearch(query, options.limit || 10);
      this.setToCache(cacheKey, results);
      return results;
    }
  }

  /** 本地模糊搜索（降级方案） */
  private localSearch(query: string, limit: number): SearchResult[] {
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);

    if (keywords.length === 0) return [];

    return this.localPrompts
      .map(prompt => {
        const text = prompt.text.toLowerCase();
        
        // 简单的关键词匹配评分
        let score = 0;
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            score += keyword.length / text.length;
          }
        }

        return { ...prompt, score };
      })
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ========== CRUD 操作 ==========

  async savePrompt(prompt: CreatePromptDTO): Promise<Prompt> {
    try {
      // 尝试保存到 Qdrant
      if (this.isOnline) {
        const newPrompt = await promptApi.create(prompt);
        this.addLocal(newPrompt);
        return newPrompt;
      }
    } catch (error) {
      console.warn('[PromptService] 远程保存失败，保存到本地:', error);
    }

    // 降级：保存到本地
    const localPrompt: Record<string, any> = {
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...prompt,
      category: (prompt as any).category || '未分类',
      likes: 0,
      uses: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.addLocal(localPrompt);
    return localPrompt;
  }

  private addLocal(prompt: Prompt): void {
    this.localPrompts.unshift(prompt);
    
    // 保持数量限制
    if (this.localPrompts.length > CACHE_SIZE * 2) {
      this.localPrompts = this.localPrompts.slice(0, CACHE_SIZE);
    }
    
    this.syncToLocalStorage();
    this.invalidateCache('search:');
  }

  async updatePrompt(id: string, updates: Partial<CreatePromptDTO>): Promise<Prompt | null> {
    try {
      if (this.isOnline) {
        return await promptApi.update(id, updates);
      }
    } catch (error) {
      console.warn('[PromptService] 远程更新失败:', error);
    }

    // 本地更新
    const index = this.localPrompts.findIndex(p => p.id === id);
    if (index !== -1) {
      this.localPrompts[index] = {
        ...this.localPrompts[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.syncToLocalStorage();
      return this.localPrompts[index];
    }

    return null;
  }

  async deletePrompt(id: string): Promise<boolean> {
    try {
      if (this.isOnline) {
        await promptApi.delete(id);
      }
    } catch (error) {
      console.warn('[PromptService] 远程删除失败:', error);
    }

    const index = this.localPrompts.findIndex(p => p.id === id);
    if (index !== -1) {
      this.localPrompts.splice(index, 1);
      this.syncToLocalStorage();
      return true;
    }

    return false;
  }

  // ========== 获取操作 ==========

  async getHotPrompts(limit = 10, category?: string): Promise<Prompt[]> {
    const cacheKey = `hot:${limit}:${category || 'all'}`;
    const cached = this.getFromCache<Prompt[]>(cacheKey);
    if (cached) return cached;

    let prompts: Prompt[];

    try {
      if (this.isOnline) {
        prompts = await promptApi.getHot(limit, category);
      } else {
        prompts = this.localPrompts
          .filter(p => !category || p.category === category)
          .sort((a, b) => b.uses - a.uses)
          .slice(0, limit);
      }

      this.setToCache(cacheKey, prompts);
      return prompts;
    } catch (error) {
      console.error('[PromptService] 获取热门提示词失败:', error);
      return [];
    }
  }

  async getAllPrompts(category?: string): Promise<Prompt[]> {
    if (!category) return [...this.localPrompts];
    return this.localPrompts.filter(p => p.category === category);
  }

  getPromptById(id: string): Prompt | undefined {
    return this.localPrompts.find(p => p.id === id);
  }

  // ========== 使用记录 ==========

  async recordUsage(promptId: string): Promise<void> {
    try {
      if (this.isOnline) {
        await promptApi.incrementUses(promptId);
      }
    } catch (error) {
      console.warn('[PromptService] 记录使用失败:', error);
    }

    // 本地更新
    const prompt = this.localPrompts.find(p => p.id === promptId);
    if (prompt) {
      prompt.uses++;
      this.syncToLocalStorage();
    }
  }

  async likePrompt(promptId: string): Promise<Prompt | null> {
    try {
      if (this.isOnline) {
        const updated = await promptApi.like(promptId);
        const index = this.localPrompts.findIndex(p => p.id === promptId);
        if (index !== -1) {
          this.localPrompts[index] = updated;
          this.syncToLocalStorage();
        }
        return updated;
      }
    } catch (error) {
      console.warn('[PromptService] 点赞失败:', error);
    }

    // 本地更新
    const prompt = this.localPrompts.find(p => p.id === promptId);
    if (prompt) {
      prompt.likes++;
      this.syncToLocalStorage();
      return prompt;
    }

    return null;
  }

  // ========== 获取分类列表 ==========

  getCategories(): { name: string; count: number }[] {
    const categoryMap = new Map<string, number>();

    for (const prompt of this.localPrompts) {
      const count = categoryMap.get(prompt.category) || 0;
      categoryMap.set(prompt.category, count + 1);
    }

    return Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  }

  // ========== 获取标签列表 ==========

  getTags(): { name: string; count: number }[] {
    const tagMap = new Map<string, number>();

    for (const prompt of this.localPrompts) {
      for (const tag of prompt.tags) {
        const count = tagMap.get(tag) || 0;
        tagMap.set(tag, count + 1);
      }
    }

    return Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([name, count]) => ({ name, count }));
  }

  // ========== 统计信息 ==========

  getStats(): ServiceStats {
    const totalPrompts = this.localPrompts.length;
    const totalUses = this.localPrompts.reduce((sum, p) => sum + p.uses, 0);

    const avgQuality = totalPrompts > 0
      ? Math.round(this.localPrompts.reduce((sum, p) => {
          const score = Math.min((p.uses + p.likes * 2) / 100, 1);
          return sum + score;
        }, 0) / totalPrompts * 100)
      : 0;

    const totalRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalRequests > 0
      ? Math.round((this.cacheHits / totalRequests) * 100)
      : 0;

    return {
      totalPrompts,
      totalUses,
      avgQuality,
      isOnline: this.isOnline,
      cacheHitRate,
    };
  }

  // ========== 缓存管理 ==========

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.cacheMisses++;
      return null;
    }

    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.cache.delete(key);
      this.cacheMisses++;
      return null;
    }

    this.cacheHits++;
    return entry.data as T;
  }

  private setToCache<T>(key: string, data: T): void {
    if (this.cache.size >= CACHE_SIZE) {
      // LRU 淘汰：删除最早的条目
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private invalidateCache(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // ========== 导入/导出 ==========

  exportPrompts(): CreatePromptDTO[] {
    return this.localPrompts.map(p => ({
      text: p.text,
      category: p.category,
      tags: p.tags,
      metadata: p.metadata,
    }));
  }

  async importPrompts(prompts: CreatePromptDTO[]): Promise<{ imported: number }> {
    let imported = 0;

    for (const prompt of prompts) {
      try {
        await this.savePrompt(prompt);
        imported++;
      } catch (error) {
        console.error(`[PromptService] 导入失败: ${prompt.text.substring(0, 50)}`, error);
      }
    }

    return { imported };
  }
}

// ==================== 单例导出 ====================

/** 全局单例实例 */
export const promptService = new UnifiedPromptService();

/** 可选：创建自定义实例 */
export function createPromptService(): UnifiedPromptService {
  return new UnifiedPromptService();
}
