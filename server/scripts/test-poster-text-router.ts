import prisma from '../src/lib/prisma';
import { posterAgentOptimize } from '../src/services/poster-agent-service';
import { generateToken } from '../src/utils/jwt';

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: '476133' },
    select: { id: true, username: true, role: true, isActive: true, points: true },
  });
  if (!user?.isActive) throw new Error('测试账号 476133 不可用');

  const token = generateToken({ userId: user.id, username: user.username, role: user.role });
  const startedAt = Date.now();
  const result = await posterAgentOptimize(
    '为品牌发布会海报优化文字与视觉提示词。主标题“灵感无界”，副标题“AI 创作新纪元”，9:16 竖版，玫红与深蓝未来城市风格。',
    {
      model: 'auto',
      aspectRatio: '9:16',
      authToken: token,
    },
  );
  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    select: { points: true },
  });

  process.stdout.write(JSON.stringify({
    status: 'success',
    usedModel: result.usedModel,
    usedModelName: result.usedModelName,
    durationMs: Date.now() - startedAt,
    contentLength: result.content.length,
    contentPreview: result.content.slice(0, 240),
    pointsBefore: user.points,
    pointsAfter: updated?.points,
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
