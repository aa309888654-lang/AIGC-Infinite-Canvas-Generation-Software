import {
  ApiVersion,
  VERSION_LIFECYCLE,
  VERSION_CONFIG,
  BreakingChange,
  MigrationStep,
  VersionMigration,
  VersionInfo,
} from '../types/version';

export interface VersionDiff {
  fromVersion: ApiVersion;
  toVersion: ApiVersion;
  breakingChanges: BreakingChange[];
  newFeatures: string[];
  deprecatedFeatures: string[];
  removedFeatures: string[];
  behaviorChanges: string[];
}

export interface MigrationGuide {
  fromVersion: ApiVersion;
  toVersion: ApiVersion;
  estimatedTime: string;
  difficulty: 'easy' | 'medium' | 'hard';
  steps: MigrationStep[];
  rollbackPlan: string;
  compatibilityMatrix: Record<string, string>;
  codeExamples: CodeExample[];
}

export interface CodeExample {
  language: 'curl' | 'javascript' | 'python' | 'java';
  before: string;
  after: string;
  description: string;
}

export function compareVersions(from: ApiVersion, to: ApiVersion): VersionDiff {
  const fromInfo = VERSION_LIFECYCLE[from];
  const toInfo = VERSION_LIFECYCLE[to];
  
  if (!fromInfo || !toInfo) {
    throw new Error(`Invalid version: ${from} or ${to}`);
  }
  
  const newFeatures = toInfo.supportedFeatures.filter(
    f => !fromInfo.supportedFeatures.includes(f)
  );
  
  const deprecatedFeatures = [
    ...toInfo.deprecatedFeatures,
    ...fromInfo.supportedFeatures.filter(
      f => !toInfo.supportedFeatures.includes(f) && !toInfo.deprecatedFeatures.includes(f)
    ),
  ];
  
  const removedFeatures = fromInfo.supportedFeatures.filter(
    f => !toInfo.supportedFeatures.includes(f) && !toInfo.deprecatedFeatures.includes(f)
  );
  
  const breakingChanges = toInfo.breakingChanges.map((change, index) => ({
    type: getBreakingChangeType(change),
    description: change,
    impact: getBreakingChangeImpact(change),
    affectedEndpoints: getAffectedEndpoints(change),
  }));
  
  return {
    fromVersion: from,
    toVersion: to,
    breakingChanges,
    newFeatures,
    deprecatedFeatures,
    removedFeatures,
    behaviorChanges: toInfo.breakingChanges,
  };
}

function getBreakingChangeType(change: string): 'parameter' | 'response' | 'endpoint' | 'behavior' {
  if (change.toLowerCase().includes('parameter')) return 'parameter';
  if (change.toLowerCase().includes('response')) return 'response';
  if (change.toLowerCase().includes('endpoint')) return 'endpoint';
  return 'behavior';
}

function getBreakingChangeImpact(change: string): 'high' | 'medium' | 'low' {
  const highImpact = ['breaking', 'removed', 'deleted', 'dropped'];
  const mediumImpact = ['changed', 'modified', 'updated', 'restructured'];
  
  const lowerChange = change.toLowerCase();
  
  if (highImpact.some(keyword => lowerChange.includes(keyword))) {
    return 'high';
  }
  if (mediumImpact.some(keyword => lowerChange.includes(keyword))) {
    return 'medium';
  }
  return 'low';
}

function getAffectedEndpoints(change: string): string[] {
  const endpoints: Record<string, string[]> = {
    pagination: ['/api/*/users', '/api/*/tasks', '/api/*/transactions'],
    response: ['/api/*/users', '/api/*/tasks', '/api/*/providers'],
    date: ['/api/*/users', '/api/*/tasks', '/api/*/logs'],
  };
  
  const lowerChange = change.toLowerCase();
  
  for (const [key, urls] of Object.entries(endpoints)) {
    if (lowerChange.includes(key)) {
      return urls;
    }
  }
  
  return ['*'];
}

export function generateMigrationGuide(from: ApiVersion, to: ApiVersion): MigrationGuide {
  const diff = compareVersions(from, to);
  
  const steps: MigrationStep[] = [];
  
  if (diff.breakingChanges.some(c => c.type === 'response')) {
    steps.push({
      step: steps.length + 1,
      description: 'Update response parsing logic',
      action: 'Review and update all code that parses API responses to match the new unified format',
      estimatedTime: '2-4 hours',
      risks: ['May affect data transformation logic'],
    });
  }
  
  if (diff.breakingChanges.some(c => c.type === 'parameter')) {
    steps.push({
      step: steps.length + 1,
      description: 'Update pagination parameters',
      action: 'Change from pageSize to limit parameter, add offset support',
      estimatedTime: '1-2 hours',
      risks: ['May break existing pagination logic'],
    });
  }
  
  if (diff.newFeatures.includes('enhanced-validation')) {
    steps.push({
      step: steps.length + 1,
      description: 'Enable enhanced validation',
      action: 'Optional - Enable strict validation mode for better error messages',
      estimatedTime: '30 minutes',
      risks: ['May reject previously accepted inputs'],
    });
  }
  
  if (diff.newFeatures.includes('standardized-dates')) {
    steps.push({
      step: steps.length + 1,
      description: 'Update date handling',
      action: 'All dates now use ISO 8601 format with timezone',
      estimatedTime: '1 hour',
      risks: ['May affect date parsing in client code'],
    });
  }
  
  const codeExamples: CodeExample[] = [];
  
  if (diff.breakingChanges.some(c => c.type === 'response')) {
    codeExamples.push({
      language: 'javascript',
      before: `// Old response format
const user = response.data.user;
const token = response.data.token;`,
      after: `// New unified format
const { data: { user, token } } = response;`,
      description: 'Unified response structure with data wrapper',
    });
  }
  
  if (diff.breakingChanges.some(c => c.type === 'parameter')) {
    codeExamples.push({
      language: 'curl',
      before: `# Old pagination
GET /api/users?page=1&pageSize=20`,
      after: `# New pagination
GET /api/users?page=1&limit=20
# or with offset
GET /api/users?offset=0&limit=20`,
      description: 'Pagination parameter standardization',
    });
  }
  
  return {
    fromVersion: from,
    toVersion: to,
    estimatedTime: calculateEstimatedMigrationTime(steps),
    difficulty: calculateMigrationDifficulty(diff),
    steps,
    rollbackPlan: generateRollbackPlan(from),
    compatibilityMatrix: generateCompatibilityMatrix(from, to),
    codeExamples,
  };
}

function calculateEstimatedMigrationTime(steps: MigrationStep[]): string {
  const totalMinutes = steps.reduce((total, step) => {
    const match = step.estimatedTime.match(/(\d+)-(\d+)\s*hours?/);
    if (match) {
      return total + (parseInt(match[1]) + parseInt(match[2])) / 2 * 60;
    }
    const minuteMatch = step.estimatedTime.match(/(\d+)\s*minutes?/);
    if (minuteMatch) {
      return total + parseInt(minuteMatch[1]);
    }
    return total;
  }, 0);
  
  if (totalMinutes >= 240) {
    return `${Math.ceil(totalMinutes / 240)} working days`;
  }
  return `${Math.ceil(totalMinutes / 60)} hours`;
}

function calculateMigrationDifficulty(diff: VersionDiff): 'easy' | 'medium' | 'hard' {
  const highImpactCount = diff.breakingChanges.filter(c => c.impact === 'high').length;
  const mediumImpactCount = diff.breakingChanges.filter(c => c.impact === 'medium').length;
  
  if (highImpactCount >= 2 || mediumImpactCount >= 3) {
    return 'hard';
  }
  if (highImpactCount >= 1 || mediumImpactCount >= 1) {
    return 'medium';
  }
  return 'easy';
}

function generateRollbackPlan(version: ApiVersion): string {
  return `## Rollback Plan for ${version}
  
1. Keep old client code in version control
2. Deploy previous version of API if needed
3. Switch back to old endpoints
4. Verify all functionality works correctly
5. Monitor error rates for 24 hours`;
}

function generateCompatibilityMatrix(from: ApiVersion, to: ApiVersion): Record<string, string> {
  return {
    [`${from} -> ${to}`]: 'Breaking - requires migration',
    [`${to} -> ${from}`]: 'Not supported',
    [`${from} -> ${VERSION_CONFIG.currentVersion}`]: 'Supported',
    [`${to} -> ${VERSION_CONFIG.currentVersion}`]: 'Compatible',
  };
}

export function generateVersionReport(): string {
  const lines: string[] = [];
  
  lines.push('# API Version Report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  
  lines.push('## Version Lifecycle');
  lines.push('');
  
  for (const [version, info] of Object.entries(VERSION_LIFECYCLE)) {
    lines.push(`### ${version.toUpperCase()}`);
    lines.push(`- Status: ${info.status}`);
    lines.push(`- Released: ${info.releaseDate}`);
    if (info.deprecationDate) {
      lines.push(`- Deprecated: ${info.deprecationDate}`);
    }
    if (info.endOfLifeDate) {
      lines.push(`- End of Life: ${info.endOfLifeDate}`);
    }
    lines.push('');
    lines.push(`- Supported Features (${info.supportedFeatures.length}):`);
    info.supportedFeatures.forEach(f => lines.push(`  - ${f}`));
    lines.push('');
    
    if (info.deprecatedFeatures.length > 0) {
      lines.push(`- Deprecated Features (${info.deprecatedFeatures.length}):`);
      info.deprecatedFeatures.forEach(f => lines.push(`  - ${f}`));
      lines.push('');
    }
    
    if (info.breakingChanges.length > 0) {
      lines.push(`- Breaking Changes (${info.breakingChanges.length}):`);
      info.breakingChanges.forEach(c => lines.push(`  - ${c}`));
      lines.push('');
    }
  }
  
  lines.push('## Migration Paths');
  lines.push('');
  lines.push('### v1 -> v2');
  const v1Tov2Guide = generateMigrationGuide('v1', 'v2');
  lines.push(`- Difficulty: ${v1Tov2Guide.difficulty}`);
  lines.push(`- Estimated Time: ${v1Tov2Guide.estimatedTime}`);
  lines.push(`- Steps: ${v1Tov2Guide.steps.length}`);
  lines.push('');
  
  return lines.join('\n');
}

export function exportVersionConfig(): string {
  return JSON.stringify({
    config: VERSION_CONFIG,
    lifecycle: VERSION_LIFECYCLE,
    generatedAt: new Date().toISOString(),
  }, null, 2);
}
