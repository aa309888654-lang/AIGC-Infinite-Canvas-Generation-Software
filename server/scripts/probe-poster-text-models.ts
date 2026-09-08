import axios from 'axios';
import prisma from '../src/lib/prisma';
import {
  getPosterAgentModelProvider,
  getPosterAgentModels,
} from '../src/services/poster-agent-service';
import { createInternalRequestAuthHeaders } from '../src/utils/internal-request-auth';
import { generateToken } from '../src/utils/jwt';

type ProbeResult = {
  id: string;
  name: string;
  provider: string;
  available: boolean;
  latencyMs: number;
  status: number | string;
  error?: string;
};

function sanitizeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return 'timeout';
    return String(error.response?.data?.code || error.code || 'request_failed').slice(0, 80);
  }
  return error instanceof Error ? error.message.slice(0, 80) : 'unknown';
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: '476133' },
    select: { id: true, username: true, role: true, isActive: true, points: true },
  });
  if (!user?.isActive) throw new Error('测试账号 476133 不可用');

  const token = generateToken({ userId: user.id, username: user.username, role: user.role });
  const endpoint = `http://127.0.0.1:${process.env.PORT || 3200}/api/v1/ai/chat`;
  const models = getPosterAgentModels().filter((model) => model.id !== 'auto');

  async function probe(model: (typeof models)[number]): Promise<ProbeResult> {
    const startedAt = Date.now();
    const provider = getPosterAgentModelProvider(model.id);
    try {
      const response = await axios.post(endpoint, {
        messages: [{ role: 'user', content: '连通性检测，只回复 OK。' }],
        model: model.id,
        provider,
        source: 'poster',
        temperature: 0,
        maxTokens: 24,
        stream: false,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...createInternalRequestAuthHeaders('poster-agent', token),
        },
        timeout: 15000,
        validateStatus: () => true,
      });
      const content = response.data?.content || response.data?.choices?.[0]?.message?.content;
      return {
        id: model.id,
        name: model.name,
        provider,
        available: response.status >= 200 && response.status < 300 && Boolean(content),
        latencyMs: Date.now() - startedAt,
        status: response.status,
        error: response.status >= 200 && response.status < 300 && content
          ? undefined
          : String(response.data?.code || 'empty_or_rejected').slice(0, 80),
      };
    } catch (error) {
      return {
        id: model.id,
        name: model.name,
        provider,
        available: false,
        latencyMs: Date.now() - startedAt,
        status: axios.isAxiosError(error) ? (error.response?.status || error.code || 'error') : 'error',
        error: sanitizeError(error),
      };
    }
  }

  const results: ProbeResult[] = [];
  for (let index = 0; index < models.length; index += 3) {
    results.push(...await Promise.all(models.slice(index, index + 3).map(probe)));
  }
  const updated = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } });
  process.stdout.write(JSON.stringify({
    checkedAt: new Date().toISOString(),
    available: results.filter((result) => result.available),
    unavailable: results.filter((result) => !result.available),
    summary: {
      total: results.length,
      available: results.filter((result) => result.available).length,
      unavailable: results.filter((result) => !result.available).length,
      pointsBefore: user.points,
      pointsAfter: updated?.points,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  });
