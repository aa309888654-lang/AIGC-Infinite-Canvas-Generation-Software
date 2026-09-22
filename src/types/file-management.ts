// ============================================
// 文件管理模块类型定义
// 参考技术规范实现
// ============================================

// 用户角色类型
export type UserRole = 'user' | 'manager' | 'admin';

// 文件生命周期状态
export type FileLifecycleState = 'draft' | 'pending_approval' | 'active' | 'archived' | 'soft_deleted';

// 存储层级类型
export type StorageTier = 'hot' | 'warm' | 'cold';

// 压缩算法类型
export type CompressionAlgorithm = 'lz4' | 'zstd' | 'none';

// 文件类型
export type FileCategory = 'document' | 'media' | 'image' | 'video' | 'other';

// ============================================
// 1. 存储路径配置
// ============================================

// 路径模板变量
export interface PathTemplateVariables {
  userID?: string;
  department?: string;
  project?: string;
  date?: string; // YYYY-MM-DD
  category?: string;
  custom?: Record<string, string>;
}

// 存储路径配置
export interface StoragePathConfig {
  id: string;
  userID: string;
  template: string; // e.g., "{userID}/{department}/{project}/{YYYY-MM-DD}/"
  variables: PathTemplateVariables;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 存储端点配置
export interface StorageEndpoint {
  id: string;
  name: string;
  type: 's3' | 'azure_blob' | 'local' | 'custom';
  endpoint: string;
  bucket?: string;
  container?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
  isActive: boolean;
}

// 路径路由规则
export interface PathRoutingRule {
  id: string;
  name: string;
  conditions: {
    fileTags?: string[];
    fileType?: FileCategory;
    fileSize?: { min?: number; max?: number };
    mimeType?: string[];
  };
  targetEndpoint: string;
  priority: number;
  isActive: boolean;
}

// ============================================
// 2. 文件生成治理
// ============================================

// 文件大小限制配置
export interface FileSizeLimit {
  category: FileCategory;
  maxSizeBytes: number;
  warnThresholdBytes?: number;
}

// MIME类型验证规则
export interface MimeTypeRule {
  category: FileCategory;
  allowedTypes: string[];
  forbiddenTypes?: string[];
}

// 重复检测配置
export interface DuplicateDetectionConfig {
  enabled: boolean;
  hashAlgorithm: 'sha256' | 'md5';
  blockSize?: number; // 块大小，用于分块去重
}

// 创建规则配置
export interface CreationRulesConfig {
  fileSizeLimits: FileSizeLimit[];
  mimeTypeRules: MimeTypeRule[];
  duplicateDetection: DuplicateDetectionConfig;
  maxFilesPerUser?: number;
  maxStoragePerUser?: number;
}

// 权限矩阵
export interface PermissionMatrix {
  role: UserRole;
  permissions: {
    create: boolean;
    approve: boolean;
    modifyOwn: boolean;
    modifyTeam: boolean;
    modifyAll: boolean;
    deleteOwn: boolean;
    deleteTeam: boolean;
    deleteAll: boolean;
  };
}

// ============================================
// 3. 存储优化策略
// ============================================

// 分层存储策略
export interface TieredStoragePolicy {
  id: string;
  name: string;
  tiers: {
    hot: {
      enabled: boolean;
      storageType: 'nvme_ssd' | 's3_hot';
      retentionDays: number;
    };
    warm: {
      enabled: boolean;
      storageType: 'sas_hdd' | 's3_warm';
      retentionDays: number;
    };
    cold: {
      enabled: boolean;
      storageType: 'object_storage' | 's3_glacier';
      retentionDays: number;
    };
  };
  autoTieringEnabled: boolean;
  tieringCron?: string;
}

// 压缩策略
export interface CompressionPolicy {
  id: string;
  name: string;
  category: FileCategory;
  algorithm: CompressionAlgorithm;
  enabled: boolean;
  level?: number; // 压缩级别
  minFileSize?: number; // 最小文件大小才压缩
  maxFileSize?: number; // 最大文件大小
}

// 去重策略
export interface DeduplicationPolicy {
  id: string;
  name: string;
  enabled: boolean;
  blockSize: number; // 4MB chunks
  referenceCounting: boolean;
  garbageCollectionEnabled: boolean;
  gcCron?: string;
}

// 性能指标
export interface PerformanceMetrics {
  latencyMs: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughputMBps: number;
  successRate: number;
  errorRate: number;
}

// ============================================
// 4. 文件生命周期管理
// ============================================

// 保留策略
export interface RetentionPolicy {
  id: string;
  name: string;
  category: FileCategory;
  retentionDays: number;
  cronExpression: string;
  action: 'archive' | 'delete' | 'notify';
  isLegalHold: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 删除管道状态
export interface DeletionPipelineStatus {
  fileId: string;
  state: 'soft_deleted' | 'secure_erase' | 'reclaimed';
  scheduledDate: Date;
  completedDate?: Date;
  method?: 'soft_delete' | 'dod_5220_22_m' | 'crypto_shred';
}

// 审计日志条目
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'download' | 'share' | 'restore' | 'approve';
  fileId: string;
  fileName: string;
  previousState?: FileLifecycleState;
  newState?: FileLifecycleState;
  details: Record<string, unknown>;
  checksum: string; // SHA-256
  ipAddress?: string;
  userAgent?: string;
}

// ============================================
// 5. 安全与访问控制
// ============================================

// 用户会话
export interface UserSession {
  id: string;
  userId: string;
  role: UserRole;
  department?: string;
  clearanceLevel?: number;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  isMfaVerified: boolean;
}

// API 范围权限
export type ApiScope = 
  | 'files:read' 
  | 'files:write' 
  | 'files:write:admin' 
  | 'files:delete' 
  | 'files:delete:admin'
  | 'storage:read'
  | 'storage:write'
  | 'admin:*';

// ABAC 规则
export interface ABACRule {
  id: string;
  name: string;
  subject: {
    department?: string;
    clearanceLevel?: number;
    role?: UserRole[];
  };
  resource: {
    ownerId?: string;
    department?: string;
    tags?: string[];
  };
  action: string[];
  effect: 'allow' | 'deny';
  priority: number;
}

// 加密配置
export interface EncryptionConfig {
  algorithm: 'AES-256-GCM';
  keyRotationDays: number;
  kmsProvider?: string;
  kmsKeyId?: string;
}

// 合规配置
export interface ComplianceConfig {
  gdpr: {
    enabled: boolean;
    rightToBeForgottenSLAHours: number;
  };
  sox: {
    enabled: boolean;
    wormStorageEnabled: boolean;
  };
  hipaa: {
    enabled: boolean;
    auditLogRetentionYears: number;
  };
}

// ============================================
// 6. 文件元数据
// ============================================

// 完整文件元数据
export interface FileMetadata {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: FileCategory;
  
  // 存储信息
  storagePath: string;
  storageEndpoint: string;
  storageTier: StorageTier;
  
  // 生命周期
  lifecycleState: FileLifecycleState;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  produceTime?: string; // ISO 8601 格式的生产时间
  expiresAt?: Date;
  
  // 所有权
  ownerId: string;
  department?: string;
  project?: string;
  tags: string[];
  
  // 内容哈希
  contentHash: string;
  deduplicationHash?: string;
  
  // 压缩与优化
  compressionAlgorithm?: CompressionAlgorithm;
  isCompressed: boolean;
  originalSizeBytes?: number;
  
  // 安全
  isEncrypted: boolean;
  encryptionKeyId?: string;
  
  // 审计
  isLegalHold: boolean;
  auditLog: string[]; // audit log entry IDs
  
  // 删除管道
  deletionStatus?: DeletionPipelineStatus;
}

// ============================================
// 7. 工作流状态
// ============================================

// 工作流状态
export interface WorkflowState {
  id: string;
  name: string;
  currentState: 'draft' | 'pending_approval' | 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
}

// ============================================
// 8. API 请求/响应类型
// ============================================

// 存储路径验证结果
export interface StoragePathValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  resolvedPath?: string;
}

// 文件创建请求
export interface FileCreateRequest {
  name: string;
  mimeType: string;
  sizeBytes: number;
  content: Blob | Buffer;
  category?: FileCategory;
  tags?: string[];
  department?: string;
  project?: string;
  metadata?: Record<string, unknown>;
}

// 文件创建响应
export interface FileCreateResponse {
  success: boolean;
  file?: FileMetadata;
  error?: string;
  warnings?: string[];
}

// 批量操作结果
export interface BatchOperationResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}