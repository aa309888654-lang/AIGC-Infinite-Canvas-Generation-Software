export type ApiVersion = 'v1' | 'v2' | 'v3';

export interface VersionInfo {
  version: ApiVersion;
  major: number;
  minor: number;
  patch: number;
  status: VersionStatus;
  releaseDate: string;
  endOfLifeDate?: string;
  deprecationDate?: string;
  supportedFeatures: string[];
  deprecatedFeatures: string[];
  breakingChanges: string[];
}

export enum VersionStatus {
  CURRENT = 'current',
  SUPPORTED = 'supported',
  DEPRECATED = 'deprecated',
  LEGACY = 'legacy',
  EOL = 'eol',
}

export interface VersionConfig {
  currentVersion: ApiVersion;
  supportedVersions: ApiVersion[];
  defaultVersion: ApiVersion;
  versionHeader?: string;
  versionParam?: string;
}

export interface VersionUsageStats {
  version: ApiVersion;
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  lastRequest: Date;
}

export interface VersionMigration {
  fromVersion: ApiVersion;
  toVersion: ApiVersion;
  breakingChanges: BreakingChange[];
  migrationSteps: MigrationStep[];
  rollbackPlan: string;
}

export interface BreakingChange {
  type: 'parameter' | 'response' | 'endpoint' | 'behavior';
  description: string;
  impact: 'high' | 'medium' | 'low';
  affectedEndpoints: string[];
}

export interface MigrationStep {
  step: number;
  description: string;
  action: string;
  estimatedTime: string;
  risks: string[];
}

export const VERSION_CONFIG: VersionConfig = {
  currentVersion: 'v1',
  supportedVersions: ['v1', 'v2'],
  defaultVersion: 'v1',
  versionHeader: 'API-Version',
  versionParam: 'version',
};

export const VERSION_LIFECYCLE: Record<ApiVersion, VersionInfo> = {
  v1: {
    version: 'v1',
    major: 1,
    minor: 0,
    patch: 0,
    status: VersionStatus.CURRENT,
    releaseDate: '2026-01-01',
    supportedFeatures: [
      'basic-authentication',
      'pagination',
      'sorting',
      'filtering',
      'provider-config',
      'task-management',
    ],
    deprecatedFeatures: [],
    breakingChanges: [],
  },
  v2: {
    version: 'v2',
    major: 2,
    minor: 0,
    patch: 0,
    status: VersionStatus.SUPPORTED,
    releaseDate: '2026-03-01',
    supportedFeatures: [
      'basic-authentication',
      'pagination',
      'sorting',
      'filtering',
      'provider-config',
      'task-management',
      'enhanced-validation',
      'unified-error-format',
      'standardized-dates',
    ],
    deprecatedFeatures: [],
    breakingChanges: [
      'Response format changed to unified structure',
      'Pagination parameters standardized',
      'Date format ISO 8601',
    ],
  },
  v3: {
    version: 'v3',
    major: 3,
    minor: 0,
    patch: 0,
    status: VersionStatus.DEPRECATED,
    releaseDate: '2025-06-01',
    endOfLifeDate: '2026-03-01',
    deprecationDate: '2026-01-01',
    supportedFeatures: [],
    deprecatedFeatures: [
      'basic-authentication',
      'pagination',
      'sorting',
    ],
    breakingChanges: [],
  },

};

export function isVersionSupported(version: ApiVersion): boolean {
  return VERSION_CONFIG.supportedVersions.includes(version);
}

export function isVersionDeprecated(version: ApiVersion): boolean {
  const info = VERSION_LIFECYCLE[version];
  return info?.status === VersionStatus.DEPRECATED || info?.status === VersionStatus.EOL;
}

export function getVersionInfo(version: ApiVersion): VersionInfo | undefined {
  return VERSION_LIFECYCLE[version];
}


