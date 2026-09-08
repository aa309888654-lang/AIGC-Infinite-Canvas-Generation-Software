/**
 * Search Agent
 * 开源搜索节点软件 Agent
 *
 * 职责：搜索和整合开源节点库
 * 能力：GitHub搜索、npm搜索、许可证检查
 * 工具：GitHub API, npm Registry
 */

import { BaseAgent, AgentExecutor, AgentConfig as FrameworkAgentConfig } from '@/services/agents/agent-framework';
import { LLMToolCall } from '@/services/llm-adapters/base-llm-adapter';
import type { SearchAgentConfig, SearchTask, SearchResultItem, SearchFilters, GithubRepoInfo, NpmPackageInfo } from './types';
import { SEARCH_SYSTEM_PROMPT } from './prompts';
import type { SearchSource, SortBy, LicenseType } from './types';

/** 默认配置 */
const DEFAULT_CONFIG: SearchAgentConfig = {
  id: 'search-agent',
  name: 'Search Agent',
  role: 'search',
  description: '开源搜索节点软件专家',
  capabilities: [
    { id: 'github-search', name: 'GitHub搜索', description: '搜索GitHub仓库', category: 'search' },
    { id: 'npm-search', name: 'npm搜索', description: '搜索npm包', category: 'search' },
    { id: 'license-check', name: '许可证检查', description: '检查许可证兼容性', category: 'analysis' },
    { id: 'version-compare', name: '版本比较', description: '比较包版本', category: 'analysis' },
    { id: 'dependency-resolve', name: '依赖解析', description: '解析依赖关系', category: 'analysis' },
  ],
  tools: [],
  model: 'ark-code-latest',
  temperature: 0.2,
  maxTokens: 8192,
  maxIterations: 10,
  systemPrompt: SEARCH_SYSTEM_PROMPT,
  enabled: true,
  defaultSource: 'github-npm',
  defaultSortBy: 'relevance',
  maxResults: 20,
  apiKeys: {},
};

/**
 * Search Agent
 */
export class SearchAgent extends BaseAgent {
  private defaultSource: SearchSource;
  private defaultSortBy: SortBy;
  private maxResults: number;
  private apiKeys: { github?: string; npm?: string };
  private searchHistory: Map<string, SearchTask>;

  constructor(executor: AgentExecutor, config?: Partial<SearchAgentConfig>) {
    const mergedConfig: SearchAgentConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    const baseConfig: FrameworkAgentConfig = {
      name: mergedConfig.name,
      description: mergedConfig.description,
      model: mergedConfig.model,
      temperature: mergedConfig.temperature,
      maxTokens: mergedConfig.maxTokens,
      maxIterations: mergedConfig.maxIterations,
      systemPrompt: mergedConfig.systemPrompt,
    };

    super(baseConfig, executor);

    this.defaultSource = mergedConfig.defaultSource;
    this.defaultSortBy = mergedConfig.defaultSortBy;
    this.maxResults = mergedConfig.maxResults;
    this.apiKeys = mergedConfig.apiKeys || {};
    this.searchHistory = new Map();
  }

  protected async step(): Promise<{
    toolCalls?: LLMToolCall[];
    finalResult?: string;
    metadata?: Record<string, unknown>;
  }> {
    const params = this.buildLLMParams();
    const response = await this.executor.complete(params);

    const content = response.choices[0]?.message?.content || '';
    const toolCalls = this.extractToolCalls(response);

    if (toolCalls.length > 0) {
      return { toolCalls };
    }

    const finalResult = this.extractFinalResult(content);
    if (finalResult) {
      return { finalResult };
    }

    this.addMessage('assistant', content);
    return { finalResult: content };
  }

  /**
   * 搜索仓库/包
   */
  public async search(
    query: string,
    source?: SearchSource,
    filters?: SearchFilters
  ): Promise<SearchResultItem[]> {
    const taskId = `search_${Date.now()}`;
    const searchSource = source || this.defaultSource;

    const task: SearchTask = {
      id: taskId,
      query,
      source: searchSource,
      filters,
      sortBy: this.defaultSortBy,
      status: 'processing',
      createdAt: new Date(),
    };

    this.searchHistory.set(taskId, task);

    // Simulate search results
    const results: SearchResultItem[] = this.generateMockResults(query, searchSource);

    task.status = 'completed';
    task.results = results.slice(0, this.maxResults);
    this.searchHistory.set(taskId, task);

    return task.results;
  }

  /**
   * 搜索 GitHub 仓库
   */
  public async searchGithub(
    query: string,
    _sortBy: SortBy = 'stars',
    _filters?: SearchFilters
  ): Promise<GithubRepoInfo[]> {
    // Mock GitHub search results
    return [
      {
        name: query,
        fullName: `user/${query}`,
        description: `A repository for ${query}`,
        owner: 'user',
        stars: 1000,
        forks: 100,
        openIssues: 10,
        language: 'TypeScript',
        license: 'MIT',
        topics: ['react', 'flow', 'nodes'],
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date(),
        cloneUrl: `https://github.com/user/${query}.git`,
      },
    ];
  }

  /**
   * 搜索 npm 包
   */
  public async searchNpm(
    query: string,
    _sortBy: SortBy = 'downloads'
  ): Promise<NpmPackageInfo[]> {
    // Mock npm search results
    return [
      {
        name: query,
        version: '1.0.0',
        description: `An npm package for ${query}`,
        author: 'author',
        license: 'MIT',
        keywords: ['react', 'flow', 'nodes'],
        downloads: 10000,
        versions: ['1.0.0', '0.9.0', '0.8.0'],
        dependencies: {},
        devDependencies: {},
      },
    ];
  }

  /**
   * 检查许可证
   */
  public async checkLicense(
    name: string,
    license: LicenseType
  ): Promise<{
    compatible: boolean;
    obligations: string[];
    commercialUse: boolean;
    modifications: boolean;
  }> {
    const licenseInfo: Record<LicenseType, {
      compatible: boolean;
      obligations: string[];
      commercialUse: boolean;
      modifications: boolean;
    }> = {
      MIT: {
        compatible: true,
        obligations: ['Include copyright notice'],
        commercialUse: true,
        modifications: true,
      },
      'Apache-2.0': {
        compatible: true,
        obligations: ['Include copyright notice', 'State changes'],
        commercialUse: true,
        modifications: true,
      },
      'GPL-3.0': {
        compatible: false,
        obligations: ['Open source modifications', 'Include source code'],
        commercialUse: false,
        modifications: true,
      },
      'BSD-3-Clause': {
        compatible: true,
        obligations: ['Include copyright notice', 'No use of author names'],
        commercialUse: true,
        modifications: true,
      },
      ISC: {
        compatible: true,
        obligations: ['Include copyright notice'],
        commercialUse: true,
        modifications: true,
      },
      Unlicense: {
        compatible: true,
        obligations: [],
        commercialUse: true,
        modifications: true,
      },
      'LGPL-3.0': {
        compatible: true,
        obligations: ['Provide source code for library'],
        commercialUse: true,
        modifications: true,
      },
      'MPL-2.0': {
        compatible: true,
        obligations: ['Credit contributors'],
        commercialUse: true,
        modifications: true,
      },
    };

    return licenseInfo[license] || licenseInfo['MIT'];
  }

  /**
   * 比较版本
   */
  public async compareVersions(
    packageName: string,
    currentVersion: string
  ): Promise<{
    latestVersion: string;
    hasUpdate: boolean;
    breakingChanges: boolean;
  }> {
    return {
      latestVersion: '1.2.0',
      hasUpdate: currentVersion !== '1.2.0',
      breakingChanges: false,
    };
  }

  /**
   * 获取搜索历史
   */
  public getSearchHistory(): SearchTask[] {
    return Array.from(this.searchHistory.values());
  }

  /**
   * 获取最大结果数
   */
  public getMaxResults(): number {
    return this.maxResults;
  }

  private generateMockResults(query: string, source: SearchSource): SearchResultItem[] {
    const baseItem: SearchResultItem = {
      id: `item_${Date.now()}`,
      name: query,
      description: `A ${source} result for ${query}`,
      source,
      url: `https://example.com/${query}`,
      stars: 100,
      downloads: 1000,
      license: 'MIT',
      keywords: [query],
      score: 0.9,
    };

    return [baseItem];
  }
}

/**
 * 创建 SearchAgent 实例
 */
export function createSearchAgent(executor: AgentExecutor, config?: Partial<SearchAgentConfig>): SearchAgent {
  return new SearchAgent(executor, config);
}
