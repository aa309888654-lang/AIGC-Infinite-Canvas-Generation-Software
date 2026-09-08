/**
 * Provider 密钥备份与恢复脚本
 *
 * 功能：
 *   backup  - 将数据库中的 Provider 配置和密钥导出为 JSON 文件
 *   restore - 从 JSON 备份文件恢复 Provider 配置和密钥
 *   list    - 列出当前数据库中的 Provider 配置概览
 *
 * 使用方式：
 *   tsx scripts/backup-providers.ts backup [output.json]
 *   tsx scripts/backup-providers.ts restore [input.json]
 *   tsx scripts/backup-providers.ts list
 *
 * 备份内容：
 *   - ProviderConfig 表（含 provider, displayName, isActive, config, endpoint）
 *   - ProviderApiKey 表（含 keyLabel, encryptedKey, modelScope, weight 等）
 *   - 备份时间戳和 ENCRYPTION_KEY 指纹（用于校验密钥一致性）
 *
 * 重要提示：
 *   - 备份文件包含加密后的密钥，仅在相同 ENCRYPTION_KEY 下可恢复
 *   - 请将备份文件存放在安全位置，不要提交到 git
 *   - env-default 标签的密钥可从环境变量重建，无需备份
 *   - 此脚本主要备份管理员手动添加的密钥（非 env-default）
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../src/lib/prisma';
import { encryptForStorage } from '../src/utils/encryption';

interface BackupData {
  version: string;
  timestamp: string;
  encryptionKeyFingerprint: string;
  providerConfigs: Array<{
    provider: string;
    name: string;
    displayName: string | null;
    description: string | null;
    endpoint: string | null;
    apiKey: string | null;
    apiSecret: string | null;
    isActive: boolean;
    config: string;
    priority: number;
    rateLimit: number | null;
  }>;
  providerApiKeys: Array<{
    providerName: string;
    keyLabel: string;
    encryptedKey: string;
    modelScope: string | null;
    weight: number;
    maxConcurrency: number;
    quotaTotal: number;
    quotaUsed: number;
    quotaRemaining: number;
    isActive: boolean;
    isExhausted: boolean;
    failureCount: number;
    priority: number;
  }>;
}

function getEncryptionKeyFingerprint(): string {
  const key = process.env.ENCRYPTION_KEY || 'dev-default-key';
  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
}

async function backup(outputPath?: string): Promise<void> {
  const filePath = outputPath || `backups/providers-backup-${Date.now()}.json`;
  const dir = path.dirname(filePath);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log('开始备份 Provider 配置和密钥...');

  const [providerConfigs, providerApiKeys] = await Promise.all([
    prisma.providerConfig.findMany({
      orderBy: { provider: 'asc' },
    }),
    prisma.providerApiKey.findMany({
      orderBy: [{ providerName: 'asc' }, { keyLabel: 'asc' }],
    }),
  ]);

  const backupData: BackupData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    encryptionKeyFingerprint: getEncryptionKeyFingerprint(),
    providerConfigs: providerConfigs.map(p => ({
      provider: p.provider,
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      endpoint: p.endpoint,
      apiKey: p.apiKey,
      apiSecret: p.apiSecret,
      isActive: p.isActive,
      config: typeof p.config === 'string' ? p.config : JSON.stringify(p.config),
      priority: p.priority,
      rateLimit: p.rateLimit,
    })),
    providerApiKeys: providerApiKeys.map(k => ({
      providerName: k.providerName,
      keyLabel: k.keyLabel,
      encryptedKey: k.encryptedKey,
      modelScope: k.modelScope,
      weight: k.weight,
      maxConcurrency: k.maxConcurrency,
      quotaTotal: k.quotaTotal,
      quotaUsed: k.quotaUsed,
      quotaRemaining: k.quotaRemaining,
      isActive: k.isActive,
      isExhausted: k.isExhausted,
      failureCount: k.failureCount,
      priority: k.priority,
    })),
  };

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

  const envDefaultCount = providerApiKeys.filter(k => k.keyLabel === 'env-default').length;
  const customKeyCount = providerApiKeys.length - envDefaultCount;

  console.log(`\n✅ 备份完成: ${filePath}`);
  console.log(`   Provider 配置: ${providerConfigs.length} 个`);
  console.log(`   API 密钥: ${providerApiKeys.length} 个 (env-default: ${envDefaultCount}, 自定义: ${customKeyCount})`);
  console.log(`   ENCRYPTION_KEY 指纹: ${backupData.encryptionKeyFingerprint}`);
  console.log(`\n⚠️  重要：备份文件包含加密的密钥，请妥善保管！`);
  console.log(`        恢复时需要使用相同的 ENCRYPTION_KEY。`);
}

async function restore(inputPath?: string): Promise<void> {
  const filePath = inputPath || 'backups/providers-backup-latest.json';
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 备份文件不存在: ${filePath}`);
    process.exit(1);
  }

  console.log(`从 ${filePath} 恢复 Provider 配置...`);

  const backupData: BackupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // 校验 ENCRYPTION_KEY 指纹
  const currentFingerprint = getEncryptionKeyFingerprint();
  if (backupData.encryptionKeyFingerprint !== currentFingerprint) {
    console.error('❌ ENCRYPTION_KEY 指纹不匹配！');
    console.error(`   备份时: ${backupData.encryptionKeyFingerprint}`);
    console.error(`   当前:   ${currentFingerprint}`);
    console.error('\n   警告：使用不同的 ENCRYPTION_KEY 将无法解密已备份的密钥。');
    console.error('   如果确认要更换密钥，请先从环境变量重新同步密钥（删除数据库中的 apiKey 后重启服务）。');
    process.exit(1);
  }

  console.log(`✅ ENCRYPTION_KEY 指纹匹配`);
  console.log(`备份时间: ${backupData.timestamp}`);
  console.log(`Provider 配置: ${backupData.providerConfigs.length} 个`);
  console.log(`API 密钥: ${backupData.providerApiKeys.length} 个\n`);

  // 恢复 ProviderConfig
  let restoredConfigs = 0;
  for (const pc of backupData.providerConfigs) {
    try {
      await prisma.providerConfig.upsert({
        where: { provider: pc.provider },
        update: {
          name: pc.name,
          displayName: pc.displayName,
          description: pc.description,
          endpoint: pc.endpoint,
          apiKey: pc.apiKey,
          apiSecret: pc.apiSecret,
          isActive: pc.isActive,
          config: pc.config,
          priority: pc.priority,
          rateLimit: pc.rateLimit,
        },
        create: {
          provider: pc.provider,
          name: pc.name,
          displayName: pc.displayName,
          description: pc.description,
          endpoint: pc.endpoint || '',
          apiKey: pc.apiKey,
          apiSecret: pc.apiSecret,
          isActive: pc.isActive,
          config: pc.config,
          priority: pc.priority,
          rateLimit: pc.rateLimit,
        },
      });
      restoredConfigs++;
    } catch (error) {
      console.error(`  ❌ 恢复 ProviderConfig ${pc.provider} 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`✅ ProviderConfig: 恢复 ${restoredConfigs}/${backupData.providerConfigs.length}`);

  // 恢复 ProviderApiKey
  let restoredKeys = 0;
  for (const k of backupData.providerApiKeys) {
    try {
      await prisma.providerApiKey.upsert({
        where: {
          providerName_keyLabel: {
            providerName: k.providerName,
            keyLabel: k.keyLabel,
          },
        },
        update: {
          encryptedKey: k.encryptedKey,
          modelScope: k.modelScope,
          weight: k.weight,
          maxConcurrency: k.maxConcurrency,
          quotaTotal: k.quotaTotal,
          quotaUsed: k.quotaUsed,
          quotaRemaining: k.quotaRemaining,
          isActive: k.isActive,
          isExhausted: k.isExhausted,
          failureCount: k.failureCount,
          priority: k.priority,
        },
        create: {
          providerName: k.providerName,
          keyLabel: k.keyLabel,
          encryptedKey: k.encryptedKey,
          modelScope: k.modelScope,
          weight: k.weight,
          maxConcurrency: k.maxConcurrency,
          quotaTotal: k.quotaTotal,
          quotaUsed: k.quotaUsed,
          quotaRemaining: k.quotaRemaining,
          isActive: k.isActive,
          isExhausted: k.isExhausted,
          failureCount: k.failureCount,
          priority: k.priority,
        },
      });
      restoredKeys++;
    } catch (error) {
      console.error(`  ❌ 恢复 ProviderApiKey ${k.providerName}/${k.keyLabel} 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`✅ ProviderApiKey: 恢复 ${restoredKeys}/${backupData.providerApiKeys.length}`);

  console.log('\n====================================');
  console.log('  恢复完成！请重启后端服务以使配置生效。');
  console.log('====================================');
}

async function list(): Promise<void> {
  const [providers, keys] = await Promise.all([
    prisma.providerConfig.findMany({
      select: {
        provider: true,
        displayName: true,
        isActive: true,
        endpoint: true,
        apiKey: true,
        _count: { select: { apiKeys: true } },
      },
      orderBy: { provider: 'asc' },
    }),
    prisma.providerApiKey.findMany({
      select: {
        providerName: true,
        keyLabel: true,
        isActive: true,
        isExhausted: true,
        modelScope: true,
        weight: true,
        priority: true,
      },
      orderBy: [{ providerName: 'asc' }, { keyLabel: 'asc' }],
    }),
  ]);

  console.log('\n====================================');
  console.log('  Provider 配置概览');
  console.log('====================================\n');

  console.log('ProviderConfig 表:');
  console.log('─'.repeat(100));
  for (const p of providers) {
    const status = p.isActive ? '✅ 活跃' : '⛔ 停用';
    const hasKey = p.apiKey ? '密钥✓' : '密钥✗';
    console.log(`  ${status} | ${p.provider.padEnd(15)} | ${(p.displayName || '').padEnd(25)} | ${hasKey} | 密钥池:${p._count.apiKeys}`);
  }

  console.log(`\nProviderApiKey 表 (${keys.length} 个):`);
  console.log('─'.repeat(100));
  const envDefaultKeys = keys.filter(k => k.keyLabel === 'env-default');
  const customKeys = keys.filter(k => k.keyLabel !== 'env-default');
  console.log(`  env-default 密钥: ${envDefaultKeys.length} 个（可从环境变量重建）`);
  console.log(`  自定义密钥: ${customKeys.length} 个（需备份）`);

  if (customKeys.length > 0) {
    console.log('\n  自定义密钥列表（需备份）:');
    for (const k of customKeys) {
      const status = k.isActive ? '✅' : '⛔';
      const exhausted = k.isExhausted ? ' [耗尽]' : '';
      console.log(`    ${status} ${k.providerName}/${k.keyLabel} weight=${k.weight} priority=${k.priority}${exhausted}`);
    }
  }
  console.log('');
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'list';
  const filePath = process.argv[3];

  try {
    switch (command) {
      case 'backup':
        await backup(filePath);
        break;
      case 'restore':
        await restore(filePath);
        break;
      case 'list':
        await list();
        break;
      default:
        console.log('使用方式:');
        console.log('  tsx scripts/backup-providers.ts backup [output.json]  - 备份 Provider 配置和密钥');
        console.log('  tsx scripts/backup-providers.ts restore [input.json] - 从备份恢复');
        console.log('  tsx scripts/backup-providers.ts list                 - 列出当前配置');
        break;
    }
  } catch (error) {
    console.error('操作失败:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
