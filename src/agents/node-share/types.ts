/**
 * 节点分享 Agent 类型定义
 */

export type ShareVisibility = 'private' | 'public' | 'unlisted';
export type ShareFormat = 'json' | 'base64' | 'file';
export type MergeStrategy = 'replace' | 'merge' | 'skip';
export type SortOption = 'popular' | 'recent' | 'rating' | 'downloads' | 'relevance';

export interface NodeExportParams {
  nodeId: string;
  format: ShareFormat;
  includeMetadata?: boolean;
  includeStyles?: boolean;
  includeConnections?: boolean;
}

export interface NodeImportParams {
  data: string;
  source: 'clipboard' | 'file' | 'url';
  validate?: boolean;
  mergeStrategy?: MergeStrategy;
  existingData?: Record<string, unknown>;
}

export interface ShareParams {
  nodeId: string;
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  visibility?: ShareVisibility;
  license?: string;
  author?: string;
}

export interface BrowseParams {
  category?: string;
  sortBy?: SortOption;
  page?: number;
  pageSize?: number;
  filter?: BrowseFilter;
}

export interface BrowseFilter {
  tags?: string[];
  minRating?: number;
  maxDownloads?: number;
  author?: string;
  isVerified?: boolean;
  isOfficial?: boolean;
}

export interface SearchParams {
  query: string;
  categories?: string[];
  tags?: string[];
  minRating?: number;
  sortBy?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface RateParams {
  nodeId: string;
  rating: number;
  comment?: string;
}

export interface ForkParams {
  templateId: string;
  newName?: string;
  modifications?: TemplateModification[];
}

export interface TemplateModification {
  nodeId: string;
  changes: Record<string, unknown>;
}

export interface CreateTemplateParams {
  name: string;
  description?: string;
  nodes: SharedNodeData[];
  edges: EdgeData[];
  variables?: Record<string, unknown>;
  thumbnail?: string;
  category?: string;
  tags?: string[];
}

export interface SharedNodeData {
  id: string;
  type: string;
  label?: string;
  name?: string;
  params?: Record<string, unknown>;
  position?: { x: number; y: number };
  style?: Record<string, string>;
  data?: Record<string, unknown>;
}

export interface EdgeData {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  animated?: boolean;
  style?: Record<string, string>;
}

export interface ExportResult {
  success: boolean;
  data?: string;
  format?: ShareFormat;
  nodeId?: string;
  nodeName?: string;
  metadata?: {
    exportedAt: string;
    version: string;
    author: string;
  };
  error?: string;
}

export interface ImportResult {
  success: boolean;
  nodeData?: Record<string, unknown>;
  nodeName?: string;
  error?: string;
  validationErrors?: string[];
  warnings?: string[];
  existing?: boolean;
}

export interface ShareResult {
  success: boolean;
  shareId?: string;
  shareUrl?: string;
  nodeName?: string;
  error?: string;
}

export interface BrowseResult {
  success: boolean;
  nodes: SharedNode[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SearchResult {
  success: boolean;
  results: SharedNode[];
  total: number;
  query: string;
}

export interface RateResult {
  success: boolean;
  nodeId: string;
  newRating: number;
  totalRatings: number;
  error?: string;
}

export interface ForkResult {
  success: boolean;
  forkedTemplateId?: string;
  forkedTemplateName?: string;
  changes?: TemplateModification[];
  error?: string;
}

export interface CreateTemplateResult {
  success: boolean;
  templateId?: string;
  templateName?: string;
  templateUrl?: string;
  error?: string;
}

export interface VersionHistoryResult {
  success: boolean;
  nodeId: string;
  versions: NodeVersion[];
  currentVersion: string;
}

export interface NodeVersion {
  version: string;
  createdAt: string;
  author: string;
  changes: string;
  isCurrent: boolean;
}

export interface SharedNode {
  id: string;
  name: string;
  description: string;
  author: string;
  authorAvatar?: string;
  version: string;
  nodeType: string;
  category: string;
  tags: string[];
  thumbnail?: string;
  downloads: number;
  likes: number;
  dislikes: number;
  rating: number;
  totalRatings: number;
  createdAt: string;
  updatedAt: string;
  isVerified: boolean;
  isOfficial: boolean;
  license: string;
  preview?: {
    code?: string;
    config?: Record<string, unknown>;
  };
}

export interface NodeTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  authorAvatar?: string;
  thumbnail?: string;
  nodes: SharedNodeData[];
  edges: EdgeData[];
  variables: Record<string, unknown>;
  usageCount: number;
  likes: number;
  rating: number;
  totalRatings: number;
  createdAt: string;
  updatedAt: string;
  isOfficial: boolean;
  isFeatured: boolean;
  tags: string[];
  category: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  nodeCount: number;
}

export interface License {
  id: string;
  name: string;
  description: string;
  url?: string;
}
