/**
 * 部署前预检脚本 - 确保模型与密钥配置完整
 *
 * 使用方式：
 *   tsx scripts/predeploy-check.ts
 *   node dist/scripts/predeploy-check.js
 *
 * 检查项：
 *   1. 关键环境变量是否配置（ENCRYPTION_KEY、JWT_SECRET、DATABASE_URL）
 *   2. 各 Provider 的 API 密钥是否配置
 *   3. 数据库连接是否正常
 *   4. ProviderConfig 和 ProviderApiKey 表是否可访问
 *   5. 加密密钥是否可正常加解密
 */

import prisma from '../src/lib/prisma';
import { encryptForStorage, decryptFromStorage } from '../src/utils/encryption';
import fs from 'fs';
import path from 'path';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: string[];
}

// Provider 到环境变量的映射（与 provider-key-sync.ts 保持同步）
const PROVIDER_ENV_KEYS: Array<{ provider: string; envKeys: string[]; displayName: string }> = [
  { provider: 'doubao', envKeys: ['ARK_API_KEY', 'DOUBAO_API_KEY', 'DOUBAO_VIDEO_KEY'], displayName: '豆包/Seedance' },
  { provider: 'vidu', envKeys: ['VIDU_API_KEY'], displayName: 'Vidu' },
  { provider: 'jimeng', envKeys: ['JIMENG_API_KEY', 'DOUBAO_IMAGE_KEY'], displayName: '即梦' },
  { provider: 'seedream', envKeys: ['DOUBAO_IMAGE_KEY', 'ARK_API_KEY', 'DOUBAO_API_KEY'], displayName: 'Seedream' },
  { provider: 'wuyinkeji', envKeys: ['WUYIN_API_KEY'], displayName: '小天API' },
  { provider: 'agnes', envKeys: ['AGNES_KEY_POOL_API_KEY', 'AGNES_VIDEO_API_KEY', 'AGNES_API_KEY'], displayName: 'Agnes' },
  { provider: 'apipaths', envKeys: ['APIPATHS_API_KEY'], displayName: '小天AICG3' },
  { provider: 'dragtokens', envKeys: ['DRAGTOKENS_API_KEY'], displayName: '小天4' },
  { provider: 'xiaotian6', envKeys: ['XIAOTIAN6_API_KEY'], displayName: '小天6' },
  { provider: 'deepseek', envKeys: ['DEEPSEEK_API_KEY'], displayName: 'DeepSeek' },
  { provider: 'volcano', envKeys: ['VOLCANO_API_KEY', 'VOLCANO_ARK_API_KEY'], displayName: '火山引擎' },
  { provider: 'xunfei', envKeys: ['XUNFEI_APIKEY', 'XUNFEI_APISECRET', 'XUNFEI_API_PASSWORD'], displayName: '讯飞星火' },
  { provider: 'sensenova', envKeys: ['SENSENOVA_API_KEY', 'SENSENOVA_API_KEY_2'], displayName: 'SenseNova' },
  { provider: 'stepfun', envKeys: ['STEPFUN_API_KEY', 'STEPFUN_API_KEY_2', 'STEPFUN_API_KEY_3'], displayName: 'StepFun' },
  { provider: 'minimax', envKeys: ['MINIMAX_API_KEY', 'MINIMAX_API_KEY_2'], displayName: 'MiniMax' },
];

const results: CheckResult[] = [];

function resolvePostgresDeployScript(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '..', 'deploy', 'prisma-postgres-deploy.sh'),
    path.resolve(process.cwd(), 'deploy', 'prisma-postgres-deploy.sh'),
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function postgresDeployGuidance(): string {
  const script = resolvePostgresDeployScript();
  return script
    ? `执行生产数据库部署脚本：bash "${script}" "${path.resolve(process.cwd())}"`
    : '未找到 deploy/prisma-postgres-deploy.sh；请从仓库根目录恢复部署脚本后再发布。';
}

function addResult(name: string, status: CheckResult['status'], message: string, details?: string[]) {
  results.push({ name, status, message, details });
  const icon = status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌';
  console.log(`${icon} [${name}] ${message}`);
  if (details && details.length > 0) {
    details.forEach(d => console.log(`    ${d}`));
  }
}

async function checkEnvVars(): Promise<void> {
  const critical = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];
  const missing = critical.filter(k => !process.env[k]);

  if (missing.length > 0) {
    addResult(
      '关键环境变量',
      'fail',
      `缺失关键环境变量: ${missing.join(', ')}`,
      [
        '解决方法：',
        '  1. 复制 server/.env.example 为 .env',
        '  2. 填入真实值',
        '  3. ENCRYPTION_KEY 生成：openssl rand -hex 32',
        '  4. JWT_SECRET 生成：openssl rand -hex 32',
      ]
    );
  } else {
    addResult('关键环境变量', 'pass', '所有关键环境变量已配置');
  }
}

async function checkStorageEnv(): Promise<void> {
  const requiredMinioVars = [
    'MINIO_ENDPOINT',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
    'MINIO_PUBLIC_URL',
  ];
  const hasBucket = !!(process.env.MINIO_BUCKET || process.env.MINIO_BUCKET_FILES);
  const missing = requiredMinioVars.filter(k => !process.env[k]);
  if (!hasBucket) missing.push('MINIO_BUCKET');

  const cosVars = [
    'COS_SECRET_ID',
    'COS_SECRET_KEY',
    'COS_BUCKET',
    'COS_REGION',
    'COS_DOMAIN',
    'COS_CDN_DOMAIN',
  ].filter(k => !!process.env[k]);

  const usesDefaultMinioCredentials =
    process.env.MINIO_ACCESS_KEY === 'minioadmin' || process.env.MINIO_SECRET_KEY === 'minioadmin';
  const isProduction = process.env.NODE_ENV === 'production';

  if (cosVars.length > 0) {
    addResult(
      '对象存储',
      isProduction ? 'fail' : 'warn',
      '检测到 COS 环境变量，当前发布策略禁止 COS',
      [`请移除: ${cosVars.join(', ')}`, '生产环境只允许 MinIO。']
    );
    return;
  }

  if (missing.length > 0) {
    addResult(
      '对象存储',
      isProduction ? 'fail' : 'warn',
      `MinIO 配置不完整: ${missing.join(', ')}`,
      [
        '生产环境必须配置 MinIO endpoint、bucket、非默认账号和公网访问地址。',
        '参考 server/.env.example 的 MinIO 配置块。',
      ]
    );
    return;
  }

  if (usesDefaultMinioCredentials) {
    addResult('对象存储', isProduction ? 'fail' : 'warn', 'MinIO 使用默认 minioadmin 凭据', [
      '生产环境必须创建独立访问账号并轮换默认凭据。',
    ]);
    return;
  }

  addResult('对象存储', 'pass', 'MinIO-only 配置已就绪，未检测到 COS 配置');
}

async function checkDatabasePolicy(): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
  const schema = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf8') : '';
  const providerMatch = schema.match(/datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/);
  const schemaProvider = providerMatch?.[1] || 'unknown';
  const databaseUrl = process.env.DATABASE_URL || '';
  const usesSqliteUrl = /^file:/i.test(databaseUrl) || /sqlite/i.test(databaseUrl);
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && usesSqliteUrl) {
    addResult(
      '数据库策略',
      'fail',
      '生产环境禁止 SQLite',
      [
        `schema provider: ${schemaProvider}`,
        postgresDeployGuidance(),
      ]
    );
    return;
  }

  if (isProduction && schemaProvider === 'sqlite') {
    const script = resolvePostgresDeployScript();
    addResult(
      '数据库策略',
      script ? 'warn' : 'fail',
      script ? '源 schema 为 SQLite 开发配置；生产必须通过隔离的 PostgreSQL 部署脚本' : '生产部署脚本缺失',
      [postgresDeployGuidance()],
    );
    return;
  }

  if (schemaProvider === 'sqlite' || usesSqliteUrl) {
    addResult(
      '数据库策略',
      'warn',
      '当前仍是 SQLite 开发配置，不适合正式云端生产',
      [
        `schema provider: ${schemaProvider}`,
        '发布生产前需要迁移 PostgreSQL/MySQL，并处理金额字段精度。',
      ]
    );
    return;
  }

  addResult('数据库策略', 'pass', `数据库策略符合云端部署要求: ${schemaProvider}`);
}

async function checkProviderKeys(): Promise<void> {
  const configured: string[] = [];
  const missing: string[] = [];

  for (const mapping of PROVIDER_ENV_KEYS) {
    const hasKey = mapping.envKeys.some(envKey => process.env[envKey]);
    if (hasKey) {
      configured.push(mapping.provider);
    } else {
      missing.push(`${mapping.provider} (需要: ${mapping.envKeys[0]})`);
    }
  }

  if (missing.length === 0) {
    addResult('Provider 密钥', 'pass', `所有 ${configured.length} 个 Provider 密钥已配置`);
  } else if (configured.length === 0) {
    addResult('Provider 密钥', 'fail', '未配置任何 Provider 密钥');
  } else {
    addResult(
      'Provider 密钥',
      'warn',
      `${configured.length}/${configured.length + missing.length} 个 Provider 已配置`,
      [
        `已配置: ${configured.join(', ')}`,
        `未配置: ${missing.join(', ')}`,
        '提示：未配置的 Provider 将无法使用，但不会影响其他 Provider',
      ]
    );
  }
}

async function checkDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    addResult('数据库连接', 'pass', '数据库连接正常');
  } catch (error) {
    addResult(
      '数据库连接',
      'fail',
      `数据库连接失败: ${error instanceof Error ? error.message : String(error)}`,
      [
        '检查 DATABASE_URL 是否正确',
        '检查数据库服务是否运行',
        '检查网络连接和防火墙',
      ]
    );
    throw error;
  }
}

async function checkProviderConfigs(): Promise<void> {
  try {
    const providers = await prisma.providerConfig.findMany({
      select: {
        provider: true,
        displayName: true,
        isActive: true,
        apiKey: true,
        _count: { select: { apiKeys: true } },
      },
      orderBy: { provider: 'asc' },
    });

    if (providers.length === 0) {
      addResult(
        'Provider 配置',
        'warn',
        '数据库中无 Provider 配置，将在启动时自动初始化',
        ['启动后端时会自动调用 initializeSystem() 创建配置']
      );
      return;
    }

    const activeProviders = providers.filter(p => p.isActive);
    const providersWithKey = providers.filter(p => p.apiKey || p._count.apiKeys > 0);
    const providersWithoutKey = providers.filter(p => !p.apiKey && p._count.apiKeys === 0);

    const details: string[] = [];
    for (const p of activeProviders) {
      const hasKey = p.apiKey || p._count.apiKeys > 0;
      details.push(`${p.provider} (${p.displayName}): ${p.isActive ? '活跃' : '停用'}, 密钥${hasKey ? '已配置' : '未配置'} (池:${p._count.apiKeys})`);
    }
    if (providersWithoutKey.length > 0) {
      details.push(`⚠️ 活跃但无密钥的 Provider: ${providersWithoutKey.map(p => p.provider).join(', ')}`);
    }

    addResult(
      'Provider 配置',
      activeProviders.length > 0 ? 'pass' : 'warn',
      `${providers.length} 个 Provider, ${activeProviders.length} 个活跃, ${providersWithKey.length} 个已配置密钥`,
      details
    );
  } catch (error) {
    addResult(
      'Provider 配置',
      'fail',
      `查询 Provider 配置失败: ${error instanceof Error ? error.message : String(error)}`,
      [postgresDeployGuidance()]
    );
  }
}

async function checkEncryption(): Promise<void> {
  try {
    const testText = 'predeploy-encryption-test-' + Date.now();
    const encrypted = encryptForStorage(testText);
    const decrypted = decryptFromStorage(encrypted);

    if (decrypted === testText) {
      addResult('加密系统', 'pass', 'ENCRYPTION_KEY 加解密正常');
    } else {
      addResult('加密系统', 'fail', '加密后解密结果不匹配', [
        '警告：ENCRYPTION_KEY 可能已变更',
        '如果更换了 ENCRYPTION_KEY，数据库中已加密的密钥将无法解密',
        '需要重新从环境变量同步密钥：删除 ProviderConfig.apiKey 后重启服务',
      ]);
    }
  } catch (error) {
    addResult(
      '加密系统',
      'fail',
      `加密测试失败: ${error instanceof Error ? error.message : String(error)}`,
      [
        '生产环境必须设置 ENCRYPTION_KEY',
        '生成方法：openssl rand -hex 32',
      ]
    );
  }
}

async function checkRequiredSchema(): Promise<void> {
  try {
    await Promise.all([
      prisma.pointsTransaction.findFirst({
        select: { idempotencyKey: true },
      }),
      prisma.emailVerification.findFirst({
        select: { attempts: true },
      }),
      prisma.canvasProject.findFirst({
        select: { revision: true },
      }),
    ]);
    addResult('运行时数据库结构', 'pass', '关键运行时字段已就绪');
  } catch (error) {
    addResult(
      '运行时数据库结构',
      'fail',
      `关键运行时字段缺失或 Prisma Client 未同步: ${error instanceof Error ? error.message : String(error)}`,
      [
        '必须先同步 prisma/schema.prisma 和 prisma/migrations。',
        postgresDeployGuidance(),
        '没有 _prisma_migrations 表的旧环境需先备份并完成迁移基线，禁止直接部署新 dist。',
      ]
    );
  }
}

async function checkPrismaMigrations(): Promise<void> {
  try {
    const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "_prisma_migrations" WHERE migration_name IS NOT NULL` as Array<{ count: bigint | number }>;
    const appliedCount = Number(result[0]?.count || 0);
    addResult('数据库迁移', 'pass', `已应用 ${appliedCount} 个迁移`);
  } catch (error) {
    addResult(
      '数据库迁移',
      'warn',
      `无法查询迁移状态: ${error instanceof Error ? error.message : String(error)}`,
      [postgresDeployGuidance()]
    );
  }
}

async function main(): Promise<void> {
  console.log('====================================');
  console.log('  小天 AICG Studio - 部署前预检');
  console.log('====================================\n');

  await checkEnvVars();
  await checkStorageEnv();
  await checkDatabasePolicy();
  await checkProviderKeys();

  try {
    await checkDatabase();
    await checkProviderConfigs();
    await checkEncryption();
    await checkRequiredSchema();
    await checkPrismaMigrations();
  } catch (error) {
    console.error('\n❌ 数据库相关检查已跳过（连接失败）');
  }

  console.log('\n====================================');
  const passCount = results.filter(r => r.status === 'pass').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  console.log(`  结果: ${passCount} 通过, ${warnCount} 警告, ${failCount} 失败`);
  console.log('====================================\n');

  await prisma.$disconnect();

  if (failCount > 0) {
    console.error('❌ 预检失败，请修复上述问题后再部署');
    process.exit(1);
  } else if (warnCount > 0) {
    console.warn('⚠️ 预检通过（有警告），建议处理警告项以确保完整功能');
    process.exit(0);
  } else {
    console.log('✅ 预检全部通过，可以部署');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('预检脚本异常:', error);
  process.exit(1);
});
