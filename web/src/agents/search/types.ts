/**
 * Search Agent Types
 * 开源搜索节点软件 Agent 类型定义
 */

import type { AgentConfig, AgentCapability} from '@/types/agent';

/** 搜索 Agent 标识 */
export const SEARCH_AGENT_ID = 'search-agent';

/** 搜索能力 */
export interface SearchCapability extends AgentCapability {
  id: 'github-search' | 'npm-search' | 'license-check' | 'version-compare' | 'dependency-resolve';
}

/** 搜索来源 */
export type SearchSource = 'github' | 'npm' | 'github-npm' | 'npm-github';

/** 排序方式 */
export type SortBy = 'stars' | 'downloads' | 'recent' | 'relevance';

/** 许可证类型 */
export type LicenseType =
  | 'MIT'
  | 'Apache-2.0'
  | 'GPL-3.0'
  | 'BSD-3-Clause'
  | 'ISC'
  | 'Unlicense'
  | 'LGPL-3.0'
  | 'MPL-2.0';

/** 搜索结果项 */
export interface SearchResultItem {
  id: string;
  name: string;
  description: string;
  version?: string;
  source: SearchSource;
  url: string;
  stars?: number;
  downloads?: number;
  lastUpdated?: Date;
  license?: LicenseType;
  author?: string;
  keywords?: string[];
  score?: number;
}

/** NPM 包信息 */
export interface NpmPackageInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  repository?: string;
  homepage?: string;
  keywords: string[];
  downloads: number;
  versions: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

/** GitHub 仓库信息 */
export interface GithubRepoInfo {
  name: string;
  fullName: string;
  description: string;
  owner: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string;
  license: string;
  topics: string[];
  createdAt: Date;
  updatedAt: Date;
  homepage?: string;
  cloneUrl: string;
}

/** 搜索任务 */
export interface SearchTask {
  id: string;
  query: string;
  source: SearchSource;
  filters?: SearchFilters;
  sortBy: SortBy;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: SearchResultItem[];
  error?: string;
  createdAt: Date;
}

/** 搜索过滤器 */
export interface SearchFilters {
  keywords?: string[];
  license?: LicenseType[];
  language?: string;
  minStars?: number;
  minDownloads?: number;
  hasNpm?: boolean;
  hasGithub?: boolean;
  topics?: string[];
}

/** 版本比较结果 */
export interface VersionCompareResult {
  packageName: string;
  currentVersion: string;
  latestVersion: string;
  versions: string[];
  hasUpdate: boolean;
  breakingChanges?: string[];
}

/** 搜索 Agent 配置 */
export interface SearchAgentConfig extends Omit<AgentConfig, 'role'> {
  id: typeof SEARCH_AGENT_ID;
  role: 'search';
  defaultSource: SearchSource;
  defaultSortBy: SortBy;
  maxResults: number;
  apiKeys?: {
    github?: string;
    npm?: string;
  };
}
