import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiVersion,
  VERSION_CONFIG,
  VERSION_LIFECYCLE,
  isVersionSupported,
  isVersionDeprecated,
  getVersionInfo,
  VersionUsageStats,
} from '../types/version';

// CFG-04 修复：移除分散的 Express.Request 全局声明，统一到 types/express.d.ts

const versionStats: Map<ApiVersion, VersionUsageStats> = new Map();

versionStats.set('v1', {
  version: 'v1',
  totalRequests: 0,
  successRate: 0,
  averageResponseTime: 0,
  lastRequest: new Date(),
});

versionStats.set('v2', {
  version: 'v2',
  totalRequests: 0,
  successRate: 0,
  averageResponseTime: 0,
  lastRequest: new Date(),
});

versionStats.set('v3', {
  version: 'v3',
  totalRequests: 0,
  successRate: 0,
  averageResponseTime: 0,
  lastRequest: new Date(),
});

export function versionRouter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  req.requestId = requestId;
  
  let apiVersion = extractVersion(req);
  
  if (!apiVersion) {
    apiVersion = VERSION_CONFIG.defaultVersion;
  }
  
  apiVersion = normalizeVersion(apiVersion);
  
  req.apiVersion = apiVersion;
  req.versionInfo = getVersionInfo(apiVersion);
  
  if (isVersionDeprecated(apiVersion)) {
    res.setHeader('Sunset', new Date(req.versionInfo.endOfLifeDate).toUTCString());
    res.setHeader('Deprecation', `version=${apiVersion}; rel="sunset"`);
    
    if (apiVersion === 'v3') {
      res.setHeader('Warning', `299 - This version of the API is deprecated and will be removed on ${req.versionInfo.endOfLifeDate}`);
    }
  }
  
  res.setHeader('API-Version', apiVersion);
  res.setHeader('X-API-Version', apiVersion);
  res.setHeader('X-Request-Id', requestId);
  
  updateVersionStats(apiVersion, startTime);
  
  if (!isVersionSupported(apiVersion)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_API_VERSION',
        message: `API version '${apiVersion}' is not supported`,
        supportedVersions: VERSION_CONFIG.supportedVersions,
        currentVersion: VERSION_CONFIG.currentVersion,
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  next();
}

function extractVersion(req: Request): ApiVersion | null {
  const pathVersion = extractPathVersion(req.path);
  if (pathVersion) {
    return pathVersion;
  }
  
  const headerVersion = extractHeaderVersion(req);
  if (headerVersion) {
    return headerVersion;
  }
  
  const queryVersion = extractQueryVersion(req);
  if (queryVersion) {
    return queryVersion;
  }
  
  return null;
}

function extractPathVersion(path: string): ApiVersion | null {
  const match = path.match(/^\/api\/(v\d+)/);
  if (match) {
    return match[1] as ApiVersion;
  }
  return null;
}

function extractHeaderVersion(req: Request): ApiVersion | null {
  const versionHeader = req.headers[VERSION_CONFIG.versionHeader?.toLowerCase() || 'api-version'];
  
  if (versionHeader && typeof versionHeader === 'string') {
    return parseVersionString(versionHeader);
  }
  
  const acceptHeader = req.headers.accept;
  if (acceptHeader && typeof acceptHeader === 'string') {
    const match = acceptHeader.match(/application\/vnd\.company\.(\w+)\+json/);
    if (match) {
      return parseVersionString(match[1]);
    }
  }
  
  return null;
}

function extractQueryVersion(req: Request): ApiVersion | null {
  const versionParam = req.query[VERSION_CONFIG.versionParam || 'version'];
  if (versionParam && typeof versionParam === 'string') {
    return parseVersionString(versionParam);
  }
  return null;
}

function parseVersionString(version: string): ApiVersion | null {
  const normalized = version.toLowerCase().trim();
  
  if (normalized === 'v1' || normalized === '1' || normalized === 'latest') {
    return 'v1';
  }
  if (normalized === 'v2' || normalized === '2') {
    return 'v2';
  }
  if (normalized === 'v3' || normalized === '3') {
    return 'v3';
  }
  
  return null;
}

function normalizeVersion(version: string): ApiVersion {
  const parsed = parseVersionString(version);
  return parsed || VERSION_CONFIG.defaultVersion;
}

function updateVersionStats(version: ApiVersion, startTime: number) {
  const stats = versionStats.get(version);
  if (stats) {
    stats.totalRequests++;
    stats.lastRequest = new Date();
    
    const responseTime = Date.now() - startTime;
    stats.averageResponseTime = 
      (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) / stats.totalRequests;
  }
}

export function getVersionStats(): VersionUsageStats[] {
  return Array.from(versionStats.values());
}

export function resetVersionStats() {
  for (const [version, stats] of versionStats) {
    stats.totalRequests = 0;
    stats.successRate = 0;
    stats.averageResponseTime = 0;
    stats.lastRequest = new Date();
  }
}


