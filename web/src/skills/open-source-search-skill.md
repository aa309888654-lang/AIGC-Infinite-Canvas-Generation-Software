# Open Source Search Skill

## 技能描述
开源搜索技能包，提供 GitHub 和 npm 仓库搜索、许可证检查、依赖分析等专业能力。帮助开发者快速找到合适的开源组件和库。

## 能力清单

### 1. GitHub 搜索
- **仓库搜索**: 按名称、描述搜索
- **代码搜索**: 搜索代码内容
- **Issue 搜索**: 搜索问题和讨论
- **主题搜索**: 按主题分类搜索

### 2. npm 搜索
- **包搜索**: 按名称、关键词搜索
- **下载统计**: 查看下载量趋势
- **版本信息**: 查看版本历史
- **依赖分析**: 分析包依赖

### 3. 许可证检查
- **许可证识别**: 识别开源许可证
- **兼容性分析**: 分析许可证兼容性
- **义务检查**: 检查使用义务
- **商业使用**: 评估商业使用风险

### 4. 版本比较
- **版本检测**: 检测最新版本
- **变更分析**: 分析版本差异
- **破坏性变更**: 识别破坏性更新
- **更新建议**: 提供更新建议

### 5. 依赖解析
- **依赖树**: 显示完整依赖树
- **冲突检测**: 检测版本冲突
- **安全漏洞**: 检查安全漏洞
- **优化建议**: 提供依赖优化建议

## 使用方法

### 搜索 GitHub 仓库

```typescript
interface GithubSearchParams {
  query: string;
  sortBy?: 'stars' | 'forks' | 'updated' | 'relevance';
  language?: string;
  license?: string;
  minStars?: number;
  perPage?: number;
  page?: number;
}

interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  owner: {
    login: string;
    avatarUrl: string;
  };
  htmlUrl: string;
  stars: number;
  forks: number;
  language: string;
  license: {
    name: string;
    spdxId: string;
  };
  topics: string[];
  createdAt: string;
  updatedAt: string;
  cloneUrl: string;
}

async function searchGithubRepos(
  params: GithubSearchParams
): Promise<GithubRepo[]> {
  const queryParts = [params.query];

  if (params.language) {
    queryParts.push(`language:${params.language}`);
  }
  if (params.license) {
    queryParts.push(`license:${params.license}`);
  }
  if (params.minStars) {
    queryParts.push(`stars:>=${params.minStars}`);
  }

  const query = queryParts.join(' ');
  const sort = params.sortBy || 'stars';

  const response = await githubAPI.search.repos({
    q: query,
    sort,
    order: 'desc',
    per_page: params.perPage || 20,
    page: params.page || 1,
  });

  return response.items.map((item: any) => ({
    id: item.id,
    name: item.name,
    fullName: item.full_name,
    description: item.description,
    owner: {
      login: item.owner.login,
      avatarUrl: item.owner.avatar_url,
    },
    htmlUrl: item.html_url,
    stars: item.stargazers_count,
    forks: item.forks_count,
    language: item.language,
    license: item.license,
    topics: item.topics || [],
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    cloneUrl: item.clone_url,
  }));
}

// 使用示例
const reactFlowRepos = await searchGithubRepos({
  query: 'react flow node editor',
  language: 'TypeScript',
  minStars: 500,
  sortBy: 'stars',
});
```

### 搜索 npm 包

```typescript
interface NpmSearchParams {
  query: string;
  size?: number; // 返回数量
  quality?: number; // 质量分数
  maintenance?: number; // 维护分数
  popularity?: number; // 流行度分数
}

interface NpmPackage {
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email?: string;
  };
  license: string;
  keywords: string[];
  links: {
    npm: string;
    homepage?: string;
    repository?: string;
    bugs?: string;
  };
  score: {
    final: number;
    quality: number;
    popularity: number;
    maintenance: number;
  };
  downloads: number;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

async function searchNpmPackages(
  params: NpmSearchParams
): Promise<NpmPackage[]> {
  const searchUrl = new URL('https://registry.npmjs.org/-/v1/search');
  searchUrl.searchParams.set('text', params.query);
  searchUrl.searchParams.set('size', String(params.size || 20));
  if (params.quality) {
    searchUrl.searchParams.set('quality', String(params.quality));
  }

  const response = await fetch(searchUrl.toString());
  const data = await response.json();

  return data.objects.map((item: any) => ({
    name: item.package.name,
    version: item.package.version,
    description: item.package.description,
    author: item.package.author,
    license: item.package.license,
    keywords: item.package.keywords || [],
    links: item.package.links,
    score: item.score,
    downloads: item.downloads,
    dependencies: item.package.dependencies || {},
    devDependencies: item.package.devDependencies || {},
  }));
}

// 使用示例
const flowPackages = await searchNpmPackages({
  query: 'react flow node',
  size: 10,
});
```

### 许可证检查

```typescript
interface LicenseInfo {
  name: string;
  spdxId: string;
  permissions: string[];
  conditions: string[];
  limitations: string[];
  commercialUse: boolean;
  modifications: boolean;
  distribution: boolean;
  patentUse: boolean;
}

const licenseDatabase: Record<string, LicenseInfo> = {
  'MIT': {
    name: 'MIT License',
    spdxId: 'MIT',
    permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
    conditions: ['include-copyright'],
    limitations: ['no-liability'],
    commercialUse: true,
    modifications: true,
    distribution: true,
    patentUse: false,
  },
  'Apache-2.0': {
    name: 'Apache License 2.0',
    spdxId: 'Apache-2.0',
    permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
    conditions: ['include-copyright', 'state-changes'],
    limitations: ['no-liability'],
    commercialUse: true,
    modifications: true,
    distribution: true,
    patentUse: true,
  },
  'GPL-3.0': {
    name: 'GNU General Public License v3.0',
    spdxId: 'GPL-3.0',
    permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
    conditions: ['include-copyright', 'source-code', 'document-changes'],
    limitations: ['no-liability', 'patent-use'],
    commercialUse: true,
    modifications: true,
    distribution: true,
    patentUse: false,
  },
};

function checkLicense(licenseName: string): LicenseInfo | null {
  return licenseDatabase[licenseName] || null;
}

function isCompatibleWithCommercial(license: LicenseInfo): boolean {
  return license.commercialUse && license.modifications;
}

function checkModificationObligation(license: LicenseInfo): boolean {
  return license.conditions.includes('source-code') ||
         license.conditions.includes('document-changes');
}
```

### 版本比较

```typescript
interface VersionInfo {
  current: string;
  latest: string;
  wanted: string;
  outdated: boolean;
  breaking: boolean;
  changelog?: string[];
}

async function compareVersions(
  packageName: string,
  currentVersion: string
): Promise<VersionInfo> {
  // 获取 npm 包信息
  const response = await fetch(
    `https://registry.npmjs.org/${packageName}/latest`
  );
  const latestData = await response.json();
  const latestVersion = latestData.version;

  // 获取当前安装版本信息
  const currentResponse = await fetch(
    `https://registry.npmjs.org/${packageName}/${currentVersion}`
  );
  const currentData = await currentResponse.json();

  // 分析破坏性变更
  const breaking = checkBreakingChanges(
    currentVersion,
    latestVersion,
    latestData
  );

  return {
    current: currentVersion,
    latest: latestVersion,
    wanted: latestVersion,
    outdated: currentVersion !== latestVersion,
    breaking,
    changelog: latestData.changelog,
  };
}

function checkBreakingChanges(
  from: string,
  to: string,
  packageData: any
): boolean {
  const fromMajor = parseVersion(from).major;
  const toMajor = parseVersion(to).major;
  return toMajor > fromMajor;
}

function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const parts = version.replace(/[^0-9.]/g, '').split('.');
  return {
    major: parseInt(parts[0] || '0', 10),
    minor: parseInt(parts[1] || '0', 10),
    patch: parseInt(parts[2] || '0', 10),
  };
}
```

## 示例

### 示例 1: 搜索 React Flow 相关组件

```typescript
async function findReactFlowComponents(): Promise<{
  github: GithubRepo[];
  npm: NpmPackage[];
}> {
  const [githubRepos, npmPackages] = await Promise.all([
    searchGithubRepos({
      query: 'reactflow node editor component',
      language: 'TypeScript',
      minStars: 100,
    }),
    searchNpmPackages({
      query: 'react flow',
      size: 10,
    }),
  ]);

  return { github: githubRepos, npm: npmPackages };
}

// 使用
const components = await findReactFlowComponents();
console.log('GitHub repos:', components.github);
console.log('npm packages:', components.npm);
```

### 示例 2: 检查项目依赖许可证

```typescript
async function auditProjectLicenses(
  dependencies: Record<string, string>
): Promise<LicenseAuditResult> {
  const results: PackageLicense[] = [];

  for (const [name, version] of Object.entries(dependencies)) {
    const pkgInfo = await getNpmPackageInfo(name);
    const license = checkLicense(pkgInfo.license);

    results.push({
      name,
      version,
      license: pkgInfo.license,
      commercialUse: license?.commercialUse ?? false,
      obligations: license?.conditions ?? [],
    });
  }

  // 找出潜在问题
  const issues = results.filter(r => !r.commercialUse);

  return {
    totalPackages: results.length,
    compatiblePackages: results.length - issues.length,
    issues,
    summary: issues.length === 0
      ? 'All packages are commercially usable'
      : `${issues.length} packages have commercial use restrictions`,
  };
}
```

### 示例 3: 查找可更新的依赖

```typescript
async function findUpdatablePackages(
  dependencies: Record<string, string>
): Promise<UpdateInfo[]> {
  const updates: UpdateInfo[] = [];

  for (const [name, currentVersion] of Object.entries(dependencies)) {
    const versionInfo = await compareVersions(name, currentVersion);

    if (versionInfo.outdated) {
      updates.push({
        name,
        currentVersion,
        latestVersion: versionInfo.latest,
        breaking: versionInfo.breaking,
        urgency: versionInfo.breaking ? 'high' : 'medium',
      });
    }
  }

  // 按优先级排序
  return updates.sort((a, b) => {
    if (a.breaking !== b.breaking) return a.breaking ? -1 : 1;
    return 0;
  });
}
```

## 最佳实践

1. **搜索优化**
   - 使用精确的关键词
   - 组合多个搜索条件
   - 设置合理的筛选条件

2. **许可证检查**
   - 项目开始前检查许可证
   - 定期审计依赖许可证
   - 记录许可证信息

3. **依赖管理**
   - 定期检查更新
   - 使用锁文件
   - 测试更新后再部署

4. **安全考虑**
   - 检查安全漏洞
   - 关注包的维护状态
   - 验证包来源

## 注意事项

- GitHub API 速率限制
- npm 镜像同步延迟
- 许可证解释可能不同
- 自动更新可能破坏兼容性
