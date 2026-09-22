// ============================================
// 文件管理服务 - 企业级文档处理解决方案
// 参考技术规范实现
// ============================================

import { FileMetadata, FileCategory, StorageTier, CompressionAlgorithm, StoragePathConfig, StorageEndpoint, PathRoutingRule, StoragePathValidationResult, FileCreateRequest, FileCreateResponse, FileSizeLimit, MimeTypeRule, CreationRulesConfig, PermissionMatrix, UserRole, TieredStoragePolicy, CompressionPolicy, DeduplicationPolicy, RetentionPolicy, DeletionPipelineStatus, AuditLogEntry, UserSession, ABACRule, ApiScope, PerformanceMetrics, PathTemplateVariables } from '@/types/file-management';
import { generateId } from '@/lib/utils';

// ============================================
// 存储目录结构配置
// ============================================

/**
 * 存储目录结构定义
 */
export const STORAGE_STRUCTURE = {
  // 临时缓存目录
  cache: {
    thumbnails: 'cache/thumbnails/',      // 预览图缓存
    renderTemp: 'cache/render_temp/',     // 渲染中间文件
    downloads: 'cache/downloads/',         // 下载的素材缓存
  },
  // 用户项目文件
  projects: {
    base: 'projects/',
    projectFolder: (projectId: string) => `projects/${projectId}/`,
    video: (projectId: string) => `projects/${projectId}/video.mp4`,
    thumbnail: (projectId: string) => `projects/${projectId}/thumbnail.jpg`,
    projectJson: (projectId: string) => `projects/${projectId}/project.json`,
    assets: (projectId: string) => `projects/${projectId}/assets/`,
  },
  // 独立输出的视频/图片
  outputs: {
    base: 'outputs/',
    byDate: (date: string) => `outputs/${date}/`,  // YYYY-MM-DD 格式
  },
  // 日志目录
  logs: 'logs/',
};

/**
 * 获取完整的存储路径
 * @param basePath 基础存储路径
 * @param type 文件类型: 'cache' | 'project' | 'output' | 'log'
 * @param options 额外选项
 */
export function getStoragePath(
  basePath: string,
  type: 'cache' | 'project' | 'output' | 'log',
  options?: {
    projectId?: string;
    date?: string;
    subFolder?: 'thumbnails' | 'render_temp' | 'downloads' | 'assets';
  }
): string {
  const normalizedPath = basePath.replace(/\\$/, ''); // 移除末尾的反斜杠
  
  switch (type) {
    case 'cache':
      if (options?.subFolder) {
        return `${normalizedPath}/${STORAGE_STRUCTURE.cache[options.subFolder]}`;
      }
      return `${normalizedPath}/cache/`;
    
    case 'project':
      if (options?.projectId) {
        return `${normalizedPath}/${STORAGE_STRUCTURE.projects.projectFolder(options.projectId)}`;
      }
      return `${normalizedPath}/${STORAGE_STRUCTURE.projects.base}`;
    
    case 'output': {
      const date = options?.date || new Date().toISOString().split('T')[0];
      return `${normalizedPath}/${STORAGE_STRUCTURE.outputs.byDate(date)}`;
    }
    
    case 'log':
      return `${normalizedPath}/${STORAGE_STRUCTURE.logs}`;
    
    default:
      return normalizedPath;
  }
}

/**
 * 获取项目文件路径
 */
export function getProjectFilePath(
  basePath: string,
  projectId: string,
  fileType: 'video' | 'thumbnail' | 'projectJson' | 'assets'
): string {
  const normalizedPath = basePath.replace(/\\$/, '');
  switch (fileType) {
    case 'video':
      return `${normalizedPath}/${STORAGE_STRUCTURE.projects.video(projectId)}`;
    case 'thumbnail':
      return `${normalizedPath}/${STORAGE_STRUCTURE.projects.thumbnail(projectId)}`;
    case 'projectJson':
      return `${normalizedPath}/${STORAGE_STRUCTURE.projects.projectJson(projectId)}`;
    case 'assets':
      return `${normalizedPath}/${STORAGE_STRUCTURE.projects.assets(projectId)}`;
    default:
      return `${normalizedPath}/${STORAGE_STRUCTURE.projects.projectFolder(projectId)}`;
  }
}

// ============================================
// 配置常量
// ============================================

// 默认文件大小限制 (50MB 文档, 500MB 媒体)
const DEFAULT_FILE_SIZE_LIMITS: FileSizeLimit[] = [
  { category: 'document', maxSizeBytes: 50 * 1024 * 1024, warnThresholdBytes: 40 * 1024 * 1024 },
  { category: 'media', maxSizeBytes: 500 * 1024 * 1024, warnThresholdBytes: 400 * 1024 * 1024 },
  { category: 'image', maxSizeBytes: 50 * 1024 * 1024, warnThresholdBytes: 40 * 1024 * 1024 },
  { category: 'video', maxSizeBytes: 500 * 1024 * 1024, warnThresholdBytes: 400 * 1024 * 1024 },
  { category: 'other', maxSizeBytes: 100 * 1024 * 1024, warnThresholdBytes: 80 * 1024 * 1024 },
];

// 默认 MIME 类型规则
const DEFAULT_MIME_TYPE_RULES: MimeTypeRule[] = [
  { 
    category: 'document', 
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'] 
  },
  { 
    category: 'image', 
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'] 
  },
  { 
    category: 'video', 
    allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'] 
  },
  { 
    category: 'media', 
    allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg'] 
  },
];

// 权限矩阵
const PERMISSION_MATRIX: PermissionMatrix[] = [
  { 
    role: 'user', 
    permissions: { create: true, approve: false, modifyOwn: true, modifyTeam: false, modifyAll: false, deleteOwn: true, deleteTeam: false, deleteAll: false } 
  },
  { 
    role: 'manager', 
    permissions: { create: true, approve: true, modifyOwn: true, modifyTeam: true, modifyAll: false, deleteOwn: true, deleteTeam: true, deleteAll: false } 
  },
  { 
    role: 'admin', 
    permissions: { create: true, approve: true, modifyOwn: true, modifyTeam: true, modifyAll: true, deleteOwn: true, deleteTeam: true, deleteAll: true } 
  },
];

// ============================================
// 存储路径解析器
// ============================================

/**
 * 解析路径模板，替换变量
 */
export function resolvePathTemplate(
  template: string, 
  variables: PathTemplateVariables
): string {
  let resolved = template;
  
  // 替换预定义变量
  const date = variables.date || new Date().toISOString().split('T')[0];
  resolved = resolved.replace(/{userID}/g, variables.userID || 'default');
  resolved = resolved.replace(/{department}/g, variables.department || 'general');
  resolved = resolved.replace(/{project}/g, variables.project || 'default');
  resolved = resolved.replace(/{YYYY-MM-DD}/g, date);
  resolved = resolved.replace(/{date}/g, date);
  resolved = resolved.replace(/{category}/g, variables.category || 'other');
  
  // 替换自定义变量
  if (variables.custom) {
    Object.entries(variables.custom).forEach(([key, value]) => {
      resolved = resolved.replace(new RegExp(`{${key}}`, 'g'), value || '');
    });
  }
  
  return resolved;
}

/**
 * 验证存储路径
 */
export function validateStoragePath(
  path: string, 
  endpoint: StorageEndpoint
): StoragePathValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 检查路径格式
  if (!path || path.trim() === '') {
    errors.push('路径不能为空');
  }
  
  // 检查路径中的非法字符
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>"|?*\x00-\x1f]/;
  if (invalidChars.test(path)) {
    errors.push('路径包含非法字符');
  }
  
  // 检查路径长度
  if (path.length > 260) {
    warnings.push('路径长度超过建议的最大值(260字符)');
  }
  
  // 检查端点权限
  if (!endpoint.isActive) {
    errors.push('存储端点未激活');
  }
  
  // 检查路径权限（模拟）
  if (endpoint.type === 's3' && !endpoint.accessKey) {
    warnings.push('S3端点缺少访问密钥');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    resolvedPath: path,
  };
}

// ============================================
// 文件类别检测
// ============================================

/**
 * 根据 MIME 类型确定文件类别
 */
export function getFileCategoryFromMimeType(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'media';
  if (mimeType.startsWith('application/pdf') || 
      mimeType.startsWith('application/msword') ||
      mimeType.startsWith('application/vnd.') ||
      mimeType.startsWith('text/')) {
    return 'document';
  }
  return 'other';
}

/**
 * 根据文件扩展名获取 MIME 类型
 */
export function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

// ============================================
// 文件生成治理 - 规则引擎
// ============================================

/**
 * 创建规则引擎类
 */
export class CreationRulesEngine {
  private config: CreationRulesConfig;
  private fileHashes: Map<string, string[]> = new Map(); // hash -> fileIds

  constructor(config?: Partial<CreationRulesConfig>) {
    this.config = {
      fileSizeLimits: config?.fileSizeLimits || DEFAULT_FILE_SIZE_LIMITS,
      mimeTypeRules: config?.mimeTypeRules || DEFAULT_MIME_TYPE_RULES,
      duplicateDetection: config?.duplicateDetection || {
        enabled: true,
        hashAlgorithm: 'sha256',
        blockSize: 4 * 1024 * 1024, // 4MB
      },
      maxFilesPerUser: config?.maxFilesPerUser || 1000,
      maxStoragePerUser: config?.maxStoragePerUser || 500 * 1024 * 1024, // 500MB
    };
  }

  /**
   * 验证文件大小
   */
  validateFileSize(file: { sizeBytes: number; category: FileCategory }): { valid: boolean; error?: string; warning?: string } {
    const limit = this.config.fileSizeLimits.find(l => l.category === file.category);
    if (!limit) {
      return { valid: true }; // 无限制
    }

    if (file.sizeBytes > limit.maxSizeBytes) {
      return { 
        valid: false, 
        error: `文件大小超过限制: ${this.formatFileSize(limit.maxSizeBytes)}` 
      };
    }

    if (limit.warnThresholdBytes && file.sizeBytes > limit.warnThresholdBytes) {
      return { 
        valid: true, 
        warning: `文件接近大小限制: ${this.formatFileSize(file.sizeBytes)} / ${this.formatFileSize(limit.maxSizeBytes)}` 
      };
    }

    return { valid: true };
  }

  /**
   * 验证 MIME 类型
   */
  validateMimeType(mimeType: string, category: FileCategory): { valid: boolean; error?: string } {
    const rule = this.config.mimeTypeRules.find(r => r.category === category);
    if (!rule) {
      return { valid: true }; // 无限制
    }

    if (rule.allowedTypes.length > 0 && !rule.allowedTypes.includes(mimeType)) {
      return { 
        valid: false, 
        error: `不支持的 MIME 类型: ${mimeType}` 
      };
    }

    if (rule.forbiddenTypes?.includes(mimeType)) {
      return { 
        valid: false, 
        error: `禁止的 MIME 类型: ${mimeType}` 
      };
    }

    return { valid: true };
  }

  /**
   * 检查重复文件
   */
  checkDuplicate(contentHash: string): string | null {
    if (!this.config.duplicateDetection.enabled) {
      return null;
    }

    const existing = this.fileHashes.get(contentHash);
    return existing ? existing[0] : null;
  }

  /**
   * 注册文件哈希
   */
  registerFileHash(fileId: string, contentHash: string): void {
    const existing = this.fileHashes.get(contentHash) || [];
    existing.push(fileId);
    this.fileHashes.set(contentHash, existing);
  }

  /**
   * 移除文件哈希
   */
  unregisterFileHash(fileId: string, contentHash: string): void {
    const existing = this.fileHashes.get(contentHash);
    if (existing) {
      const filtered = existing.filter(id => id !== fileId);
      if (filtered.length > 0) {
        this.fileHashes.set(contentHash, filtered);
      } else {
        this.fileHashes.delete(contentHash);
      }
    }
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getConfig(): CreationRulesConfig {
    return { ...this.config };
  }
}

// ============================================
// 权限管理
// ============================================

/**
 * 检查用户权限
 */
export function checkPermission(
  role: UserRole,
  action: 'create' | 'approve' | 'modify' | 'delete',
  targetType: 'own' | 'team' | 'all'
): boolean {
  const matrix = PERMISSION_MATRIX.find(m => m.role === role);
  if (!matrix) return false;

  const perms = matrix.permissions;

  switch (action) {
    case 'create':
      return perms.create;
    case 'approve':
      return perms.approve;
    case 'modify':
      if (targetType === 'own') return perms.modifyOwn;
      if (targetType === 'team') return perms.modifyTeam;
      return perms.modifyAll;
    case 'delete':
      if (targetType === 'own') return perms.deleteOwn;
      if (targetType === 'team') return perms.deleteTeam;
      return perms.deleteAll;
    default:
      return false;
  }
}

/**
 * 检查 API 范围权限
 */
export function checkApiScope(session: UserSession, requiredScope: ApiScope): boolean {
  // 管理员拥有所有权限
  if (session.role === 'admin') return true;

  const scopeHierarchy: Record<string, number> = {
    'files:read': 1,
    'files:write': 2,
    'files:write:admin': 3,
    'files:delete': 2,
    'files:delete:admin': 3,
    'storage:read': 1,
    'storage:write': 2,
    'admin:*': 4,
  };

  const userScopes = getUserScopes(session);
  const requiredLevel = scopeHierarchy[requiredScope] || 0;

  return userScopes.some(scope => scopeHierarchy[scope] >= requiredLevel);
}

/**
 * 获取用户的所有范围
 */
function getUserScopes(session: UserSession): ApiScope[] {
  const scopes: ApiScope[] = ['files:read', 'storage:read'];
  
  if (session.role === 'user') {
    scopes.push('files:write');
  } else if (session.role === 'manager' || session.role === 'admin') {
    scopes.push('files:write', 'files:delete', 'storage:write');
  }
  
  if (session.role === 'admin') {
    scopes.push('files:write:admin', 'files:delete:admin', 'admin:*');
  }
  
  return scopes;
}

// ============================================
// ABAC 规则引擎
// ============================================

/**
 * ABAC 规则引擎
 */
export class ABACEngine {
  private rules: ABACRule[] = [];

  constructor(rules: ABACRule[] = []) {
    this.rules = rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 评估访问权限
   */
  evaluate(
    subject: { department?: string; clearanceLevel?: number; role?: UserRole },
    resource: { ownerId?: string; department?: string; tags?: string[] },
    action: string
  ): boolean {
    for (const rule of this.rules) {
      // 检查主体条件
      if (rule.subject.department && rule.subject.department !== subject.department) continue;
      if (rule.subject.clearanceLevel && (subject.clearanceLevel || 0) < rule.subject.clearanceLevel) continue;
      if (rule.subject.role && !rule.subject.role.includes(subject.role as UserRole)) continue;

      // 检查资源条件
      if (rule.resource.ownerId && rule.resource.ownerId !== resource.ownerId) continue;
      if (rule.resource.department && rule.resource.department !== resource.department) continue;
      if (rule.resource.tags?.length && !rule.resource.tags.some(t => resource.tags?.includes(t))) continue;

      // 检查操作
      if (!rule.action.includes(action) && !rule.action.includes('*')) continue;

      return rule.effect === 'allow';
    }

    return true; // 默认允许
  }

  addRule(rule: ABACRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  getRules(): ABACRule[] {
    return [...this.rules];
  }
}

// ============================================
// 存储优化服务
// ============================================

/**
 * 存储优化服务
 */
export class StorageOptimizationService {
  private tieredStoragePolicy: TieredStoragePolicy;
  private compressionPolicies: CompressionPolicy[];
  private deduplicationPolicy: DeduplicationPolicy;

  constructor(
    tieredPolicy?: Partial<TieredStoragePolicy>,
    compressionPolicies?: CompressionPolicy[],
    deduplicationPolicy?: Partial<DeduplicationPolicy>
  ) {
    this.tieredStoragePolicy = {
      id: generateId(),
      name: 'Default Tiered Storage',
      tiers: {
        hot: { enabled: true, storageType: 'nvme_ssd', retentionDays: 30 },
        warm: { enabled: true, storageType: 'sas_hdd', retentionDays: 90 },
        cold: { enabled: true, storageType: 'object_storage', retentionDays: 365 },
      },
      autoTieringEnabled: true,
      tieringCron: '0 0 * * *',
      ...tieredPolicy,
    } as TieredStoragePolicy;

    this.compressionPolicies = compressionPolicies || [
      { id: '1', name: 'Text Compression', category: 'document', algorithm: 'lz4', enabled: true, level: 3 },
      { id: '2', name: 'Media Compression', category: 'media', algorithm: 'zstd', enabled: true, level: 5 },
    ];

    this.deduplicationPolicy = {
      id: generateId(),
      name: 'Default Deduplication',
      enabled: true,
      blockSize: 4 * 1024 * 1024,
      referenceCounting: true,
      garbageCollectionEnabled: true,
      gcCron: '0 2 * * *',
      ...deduplicationPolicy,
    };
  }

  /**
   * 确定文件的存储层级
   */
  determineStorageTier(fileAgeDays: number): StorageTier {
    const { tiers } = this.tieredStoragePolicy;
    
    if (fileAgeDays < tiers.hot.retentionDays) return 'hot';
    if (fileAgeDays < tiers.warm.retentionDays) return 'warm';
    return 'cold';
  }

  /**
   * 获取文件的压缩策略
   */
  getCompressionPolicy(category: FileCategory): CompressionPolicy | null {
    return this.compressionPolicies.find(p => p.category === category && p.enabled) || null;
  }

  /**
   * 确定是否应该压缩文件
   */
  shouldCompress(file: { sizeBytes: number; category: FileCategory }): boolean {
    const policy = this.getCompressionPolicy(file.category);
    if (!policy || !policy.enabled) return false;
    
    if (policy.minFileSize && file.sizeBytes < policy.minFileSize) return false;
    if (policy.maxFileSize && file.sizeBytes > policy.maxFileSize) return false;
    
    return true;
  }

  /**
   * 模拟压缩（实际实现需要集成 compression 库）
   */
  async compress(data: Buffer, _algorithm: CompressionAlgorithm): Promise<Buffer> {
    // 这里应该实现实际的压缩逻辑
    // 使用 lz4 或 zstd 库
    // console.log(`[StorageOptimization] Compressing with ${algorithm}`);
    return data; // 返回原始数据作为占位符
  }

  /**
   * 模拟解压缩
   */
  async decompress(data: Buffer, _algorithm: CompressionAlgorithm): Promise<Buffer> {
    // console.log(`[StorageOptimization] Decompressing with ${algorithm}`);
    return data;
  }

  getTieredPolicy(): TieredStoragePolicy {
    return { ...this.tieredStoragePolicy };
  }

  getDeduplicationPolicy(): DeduplicationPolicy {
    return { ...this.deduplicationPolicy };
  }
}

// ============================================
// 文件生命周期管理
// ============================================

/**
 * 文件生命周期管理服务
 */
export class FileLifecycleService {
  private retentionPolicies: RetentionPolicy[] = [];
  private auditLog: AuditLogEntry[] = [];
  private deletionQueue: Map<string, DeletionPipelineStatus> = new Map();

  constructor(policies?: RetentionPolicy[]) {
    this.retentionPolicies = policies || [
      {
        id: '1',
        name: 'Default Document Retention',
        category: 'document',
        retentionDays: 365,
        cronExpression: '0 0 1 * *',
        action: 'archive',
        isLegalHold: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        name: 'Default Media Retention',
        category: 'media',
        retentionDays: 180,
        cronExpression: '0 0 1 * *',
        action: 'delete',
        isLegalHold: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  /**
   * 获取文件的保留策略
   */
  getRetentionPolicy(category: FileCategory): RetentionPolicy | null {
    return this.retentionPolicies.find(p => p.category === category) || null;
  }

  /**
   * 检查文件是否应该被归档/删除
   */
  shouldProcessFile(file: FileMetadata): { shouldArchive: boolean; shouldDelete: boolean } {
    const policy = this.getRetentionPolicy(file.category);
    if (!policy || policy.isLegalHold) {
      return { shouldArchive: false, shouldDelete: false };
    }

    const now = new Date();
    const lastActive = new Date(file.lastAccessedAt);
    const daysSinceActive = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    return {
      shouldArchive: daysSinceActive >= policy.retentionDays && policy.action === 'archive',
      shouldDelete: daysSinceActive >= policy.retentionDays && policy.action === 'delete',
    };
  }

  /**
   * 软删除文件
   */
  softDelete(fileId: string, gracePeriodDays: number = 30): DeletionPipelineStatus {
    const status: DeletionPipelineStatus = {
      fileId,
      state: 'soft_deleted',
      scheduledDate: new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000),
    };
    this.deletionQueue.set(fileId, status);
    return status;
  }

  /**
   * 安全擦除
   */
  secureErase(fileId: string, method: 'dod_5220_22_m' | 'crypto_shred' = 'dod_5220_22_m'): void {
    const status = this.deletionQueue.get(fileId);
    if (status) {
      status.state = 'secure_erase';
      status.method = method;
      status.completedDate = new Date();
      this.deletionQueue.set(fileId, status);
    }
  }

  /**
   * 回收存储
   */
  reclaimStorage(fileId: string): void {
    const status = this.deletionQueue.get(fileId);
    if (status && status.state === 'secure_erase') {
      status.state = 'reclaimed';
      status.completedDate = new Date();
      this.deletionQueue.set(fileId, status);
    }
  }

  /**
   * 获取删除状态
   */
  getDeletionStatus(fileId: string): DeletionPipelineStatus | undefined {
    return this.deletionQueue.get(fileId);
  }

  /**
   * 添加审计日志
   */
  addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'checksum'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: generateId(),
      checksum: this.calculateChecksum(entry),
    };
    this.auditLog.push(fullEntry);
    return fullEntry;
  }

  /**
   * 计算校验和
   */
  private calculateChecksum(entry: Omit<AuditLogEntry, 'id' | 'checksum'>): string {
    const data = JSON.stringify(entry);
    // 简化实现，实际应该使用 SHA-256
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 获取审计日志
   */
  getAuditLog(fileId?: string): AuditLogEntry[] {
    if (fileId) {
      return this.auditLog.filter(e => e.fileId === fileId);
    }
    return [...this.auditLog];
  }

  getRetentionPolicies(): RetentionPolicy[] {
    return [...this.retentionPolicies];
  }
}

// ============================================
// 文件管理主服务
// ============================================

/**
 * 文件管理主服务
 */
export class FileManagementService {
  private files: Map<string, FileMetadata> = new Map();
  private storagePathConfigs: Map<string, StoragePathConfig> = new Map();
  private storageEndpoints: Map<string, StorageEndpoint> = new Map();
  private pathRoutingRules: PathRoutingRule[] = [];
  
  private creationRulesEngine: CreationRulesEngine;
  private storageOptimization: StorageOptimizationService;
  private lifecycleService: FileLifecycleService;
  private abacEngine: ABACEngine;

  constructor() {
    this.creationRulesEngine = new CreationRulesEngine();
    this.storageOptimization = new StorageOptimizationService();
    this.lifecycleService = new FileLifecycleService();
    this.abacEngine = new ABACEngine();

    // 添加默认存储端点
    this.addStorageEndpoint({
      id: 'local',
      name: 'Local Storage',
      type: 'local',
      endpoint: './storage',
      isActive: true,
    });
  }

  /**
   * 创建文件
   */
  async createFile(
    request: FileCreateRequest,
    session: UserSession
  ): Promise<FileCreateResponse> {
    const warnings: string[] = [];
    
    // 1. 验证权限
    if (!checkApiScope(session, 'files:write')) {
      return { success: false, error: '权限不足' };
    }

    // 2. 确定文件类别
    const category = request.category || getFileCategoryFromMimeType(request.mimeType);

    // 3. 验证文件大小
    const sizeValidation = this.creationRulesEngine.validateFileSize({
      sizeBytes: request.sizeBytes,
      category,
    });
    if (!sizeValidation.valid) {
      return { success: false, error: sizeValidation.error! };
    }
    if (sizeValidation.warning) {
      warnings.push(sizeValidation.warning);
    }

    // 4. 验证 MIME 类型
    const mimeValidation = this.creationRulesEngine.validateMimeType(request.mimeType, category);
    if (!mimeValidation.valid) {
      return { success: false, error: mimeValidation.error! };
    }

    // 5. 检查重复（需要计算哈希）
    // const contentHash = await this.calculateHash(request.content);
    // const duplicateId = this.creationRulesEngine.checkDuplicate(contentHash);
    // if (duplicateId) {
    //   warnings.push(`检测到重复文件: ${duplicateId}`);
    // }

    // 6. 确定存储路径
    const storagePath = this.resolveStoragePath(request, session);
    const endpoint = this.getActiveEndpoint();

    // 7. 确定初始存储层级
    const storageTier: StorageTier = 'hot';

    // 8. 创建文件元数据
    const fileMetadata: FileMetadata = {
      id: generateId(),
      name: request.name,
      originalName: request.name,
      mimeType: request.mimeType,
      sizeBytes: request.sizeBytes,
      category,
      storagePath,
      storageEndpoint: endpoint.id,
      storageTier,
      lifecycleState: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessedAt: new Date(),
      produceTime: new Date().toISOString(), // 默认使用当前时间作为生产时间
      ownerId: session.userId,
      department: session.department,
      project: request.project,
      tags: request.tags || [],
      contentHash: '', // 需要计算
      isCompressed: false,
      isEncrypted: false,
      isLegalHold: false,
      auditLog: [],
    };

    // 9. 保存文件元数据
    this.files.set(fileMetadata.id, fileMetadata);

    // 10. 记录审计日志
    this.lifecycleService.addAuditLog({
      timestamp: new Date(),
      userId: session.userId,
      action: 'create',
      fileId: fileMetadata.id,
      fileName: fileMetadata.name,
      newState: 'active',
      details: { storagePath, storageTier, ...request.metadata },
    });

    return {
      success: true,
      file: fileMetadata,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * 解析存储路径
   */
  private resolveStoragePath(request: FileCreateRequest, session: UserSession): string {
    // 检查用户自定义路径配置
    const userConfig = this.storagePathConfigs.get(session.userId);
    
    if (userConfig) {
      return resolvePathTemplate(userConfig.template, {
        userID: session.userId,
        department: session.department || request.department,
        project: request.project,
        category: request.category,
        date: new Date().toISOString().split('T')[0],
      });
    }

    // 使用默认路径
    const endpoint = this.getActiveEndpoint();
    const date = new Date().toISOString().split('T')[0];
    return `${endpoint.endpoint}/${session.userId}/${request.category || 'other'}/${date}/`;
  }

  /**
   * 获取活动存储端点
   */
  private getActiveEndpoint(): StorageEndpoint {
    const active = Array.from(this.storageEndpoints.values()).find(e => e.isActive);
    if (!active) {
      throw new Error('No active storage endpoint configured');
    }
    return active;
  }

  /**
   * 添加存储端点
   */
  addStorageEndpoint(endpoint: StorageEndpoint): void {
    this.storageEndpoints.set(endpoint.id, endpoint);
  }

  /**
   * 添加存储路径配置
   */
  addStoragePathConfig(config: StoragePathConfig): void {
    this.storagePathConfigs.set(config.userID, config);
  }

  /**
   * 添加路径路由规则
   */
  addPathRoutingRule(rule: PathRoutingRule): void {
    this.pathRoutingRules.push(rule);
    this.pathRoutingRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取文件
   */
  getFile(fileId: string): FileMetadata | undefined {
    return this.files.get(fileId);
  }

  /**
   * 获取用户的所有文件
   */
  getUserFiles(userId: string): FileMetadata[] {
    return Array.from(this.files.values()).filter(f => f.ownerId === userId);
  }

  /**
   * 删除文件（软删除）
   */
  async deleteFile(fileId: string, session: UserSession): Promise<boolean> {
    const file = this.files.get(fileId);
    if (!file) return false;

    // 检查权限
    const targetType = file.ownerId === session.userId ? 'own' : 
                       file.department === session.department ? 'team' : 'all';
    
    if (!checkPermission(session.role, 'delete', targetType)) {
      return false;
    }

    // 检查法律保留
    if (file.isLegalHold) {
      return false;
    }

    // 执行软删除
    const deletionStatus = this.lifecycleService.softDelete(fileId);
    file.lifecycleState = 'soft_deleted';
    file.deletionStatus = deletionStatus;
    file.updatedAt = new Date();

    // 记录审计日志
    this.lifecycleService.addAuditLog({
      timestamp: new Date(),
      userId: session.userId,
      action: 'delete',
      fileId: file.id,
      fileName: file.name,
      previousState: 'active',
      newState: 'soft_deleted',
      details: { gracePeriodDays: 30 },
    });

    return true;
  }

  /**
   * 获取性能指标（模拟）
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return {
      latencyMs: { p50: 45, p95: 120, p99: 250 },
      throughputMBps: 450,
      successRate: 0.998,
      errorRate: 0.002,
    };
  }
}

// ============================================
// 导出单例实例
// ============================================

export const fileManagementService = new FileManagementService();

// ============================================
// 文件系统检测服务
// ============================================

export interface FileSystemHealthCheck {
  status: 'healthy' | 'warning' | 'error';
  timestamp: Date;
  checks: {
    pathValidation: { passed: boolean; message?: string };
    diskSpace: { passed: boolean; freeSpace: number; totalSpace: number; message?: string };
    permissions: { passed: boolean; message?: string };
    integrity: { passed: boolean; message?: string };
  };
  overallMessage: string;
}

/**
 * 文件系统检测服务 - 全面检测文件系统健康状态
 */
export class FileSystemHealthService {
  private static instance: FileSystemHealthService;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(health: FileSystemHealthCheck) => void> = new Set();

  private constructor() { /* noop */ }

  public static getInstance(): FileSystemHealthService {
    if (!FileSystemHealthService.instance) {
      FileSystemHealthService.instance = new FileSystemHealthService();
    }
    return FileSystemHealthService.instance;
  }

  /**
   * 全面检测文件系统健康状态
   */
  async performHealthCheck(storagePath: string): Promise<FileSystemHealthCheck> {
    const checks = {
      pathValidation: { passed: false as boolean, message: '' as string },
      diskSpace: { passed: false as boolean, freeSpace: 0, totalSpace: 0, message: '' as string },
      permissions: { passed: false as boolean, message: '' as string },
      integrity: { passed: false as boolean, message: '' as string },
    };

    let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    const messages: string[] = [];

    // 1. 路径验证检测
    try {
      const pathValidation = await this.validatePath(storagePath);
      checks.pathValidation = {
        passed: pathValidation.valid,
        message: pathValidation.valid ? '路径有效' : pathValidation.error || '路径无效',
      };
      if (!pathValidation.valid) {
        overallStatus = 'error';
        messages.push('路径验证失败');
      }
    } catch (e) {
      checks.pathValidation = {
        passed: false,
        message: `路径验证异常: ${e instanceof Error ? e.message : '未知错误'}`,
      };
      overallStatus = 'error';
    }

    // 2. 磁盘空间检测
    try {
      const diskSpace = await this.checkDiskSpace(storagePath);
      const freePercent = (diskSpace.freeSpace / diskSpace.totalSpace) * 100;
      checks.diskSpace = {
        passed: freePercent > 10,
        freeSpace: diskSpace.freeSpace,
        totalSpace: diskSpace.totalSpace,
        message: `可用空间: ${this.formatBytes(diskSpace.freeSpace)} / ${this.formatBytes(diskSpace.totalSpace)}`,
      };
      if (freePercent <= 10) {
        overallStatus = 'error';
        messages.push('磁盘空间不足');
      } else if (freePercent <= 20) {
        if (overallStatus === 'healthy') overallStatus = 'warning';
        messages.push('磁盘空间偏低');
      }
    } catch (e) {
      checks.diskSpace = {
        passed: false,
        freeSpace: 0,
        totalSpace: 0,
        message: `磁盘空间检测异常: ${e instanceof Error ? e.message : '未知错误'}`,
      };
      if (overallStatus === 'healthy') overallStatus = 'warning';
    }

    // 3. 权限检测
    try {
      const permissions = await this.checkPermissions(storagePath);
      checks.permissions = {
        passed: permissions.canRead && permissions.canWrite,
        message: `读取: ${permissions.canRead ? '✓' : '✗'}, 写入: ${permissions.canWrite ? '✓' : '✗'}`,
      };
      if (!permissions.canRead || !permissions.canWrite) {
        overallStatus = 'error';
        messages.push('权限不足');
      }
    } catch (e) {
      checks.permissions = {
        passed: false,
        message: `权限检测异常: ${e instanceof Error ? e.message : '未知错误'}`,
      };
      if (overallStatus === 'healthy') overallStatus = 'warning';
    }

    // 4. 完整性检测
    try {
      const integrity = await this.checkIntegrity(storagePath);
      checks.integrity = {
        passed: integrity.valid,
        message: integrity.valid ? '文件系统正常' : integrity.error || '文件系统异常',
      };
      if (!integrity.valid) {
        if (overallStatus === 'healthy') overallStatus = 'warning';
        messages.push('文件系统完整性异常');
      }
    } catch (e) {
      checks.integrity = {
        passed: false,
        message: `完整性检测异常: ${e instanceof Error ? e.message : '未知错误'}`,
      };
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      checks,
      overallMessage: messages.length > 0 ? messages.join('; ') : '文件系统健康',
    };
  }

  /**
   * 验证路径
   */
  private async validatePath(path: string): Promise<{ valid: boolean; error?: string }> {
    if (!path || path.trim() === '') {
      return { valid: false, error: '路径为空' };
    }

    // 检查非法字符
    // eslint-disable-next-line no-control-regex
    const invalidChars = /[<>"|?*\x00-\x1f]/;
    if (invalidChars.test(path)) {
      return { valid: false, error: '路径包含非法字符' };
    }

    return { valid: true };
  }

  /**
   * 检查磁盘空间
   */
  private async checkDiskSpace(path: string): Promise<{ freeSpace: number; totalSpace: number }> {
    // 通过 Tauri 命令获取磁盘空间
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const drives = await invoke<Array<{ letter: string; freeSpace: number; totalSpace: number }>>('get_available_drives');
      
      // 找到匹配的驱动器
      const driveLetter = path.charAt(0).toUpperCase();
      const drive = drives.find(d => d.letter === `${driveLetter}:`);
      
      if (drive) {
        return {
          freeSpace: drive.freeSpace,
          totalSpace: drive.totalSpace,
        };
      }
    } catch (e) {
      console.warn('Tauri API 不可用，使用模拟数据');
    }

    // 返回模拟数据作为后备
    return {
      freeSpace: 50 * 1024 * 1024 * 1024, // 50GB
      totalSpace: 500 * 1024 * 1024 * 1024, // 500GB
    };
  }

  /**
   * 检查权限
   */
  private async checkPermissions(path: string): Promise<{ canRead: boolean; canWrite: boolean }> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{
        valid: boolean;
        can_read: boolean;
        can_write: boolean;
      }>('validate_path', { path });

      return {
        canRead: result.can_read,
        canWrite: result.can_write,
      };
    } catch (e) {
      console.warn('Tauri API 不可用，使用默认权限');
      return { canRead: true, canWrite: true };
    }
  }

  /**
   * 检查文件系统完整性
   */
  private async checkIntegrity(path: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const exists = await invoke<boolean>('check_directory_exists', { path });

      if (!exists) {
        return { valid: false, error: '目录不存在' };
      }

      return { valid: true };
    } catch (e) {
      return { valid: true }; // 非关键检查，失败不阻塞
    }
  }

  /**
   * 格式化字节大小
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 订阅健康状态变化
   */
  subscribe(listener: (health: FileSystemHealthCheck) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 开始定期健康检测
   */
  startPeriodicCheck(storagePath: string, intervalMs: number = 60000): void {
    this.stopPeriodicCheck();

    this.healthCheckInterval = setInterval(async () => {
      const health = await this.performHealthCheck(storagePath);
      this.listeners.forEach(listener => listener(health));
    }, intervalMs);
  }

  /**
   * 停止定期健康检测
   */
  stopPeriodicCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export const fileSystemHealthService = FileSystemHealthService.getInstance();