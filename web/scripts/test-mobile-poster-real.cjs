const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const dotenv = require('../../backend/node_modules/dotenv');
const jwt = require('../../backend/node_modules/jsonwebtoken');
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');

dotenv.config({ path: path.resolve(__dirname, '..', '..', 'backend', '.env') });
if (process.env.DATABASE_URL?.startsWith('file:./')) {
  process.env.DATABASE_URL = `file:${path.resolve(
    __dirname,
    '..',
    '..',
    'backend',
    'prisma',
    process.env.DATABASE_URL.slice('file:./'.length),
  ).replace(/\\/g, '/')}`;
}
const prisma = new PrismaClient();
const targetUrl = 'http://127.0.0.1:5178/m';
const outputDirectory = path.resolve(__dirname, '..', 'test-artifacts', 'mobile-poster-real');
const prompt = [
  '制作一张9:16竖版品牌发布会海报。',
  '主标题“灵感无界”，副标题“AI 创作新纪元”，',
  '时间“2026年7月20日 14:00”，地点“上海外滩金融中心”。',
  '玫红、深蓝与银白配色，未来城市夜景和流动丝绸光带，',
  '人物主体位于右侧，中文文字清晰完整，高端商业摄影与专业品牌排版。',
].join('');

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: '476133' },
    select: { id: true, username: true, role: true, isActive: true, points: true },
  });
  if (!user?.isActive) throw new Error('测试账号 476133 不可用');
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET 未配置');
  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );

  fs.mkdirSync(outputDirectory, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
  });
  await context.addInitScript((authToken) => {
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('token', authToken);
  }, token);
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  const imageResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/image/')) {
      imageResponses.push({ url: response.url(), status: response.status() });
    }
  });

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('.mobile-studio__account').waitFor({ state: 'visible', timeout: 30000 });
    await textarea.fill(prompt);
    await page.screenshot({ path: path.join(outputDirectory, 'before.png'), fullPage: true });

    await page.getByRole('button', { name: '生成海报', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDirectory, 'generating.png'), fullPage: true });

    const resultImage = page.locator('img[alt="智能生成海报"]');
    const errorMessage = page.locator('.mobile-studio__error');
    const startedAt = Date.now();
    let outcome = 'timeout';
    let errorText = '';
    let latestTask = null;
    while (Date.now() - startedAt < 12 * 60 * 1000) {
      if (await resultImage.count() && await resultImage.isVisible()) {
        outcome = 'completed';
        break;
      }
      if (await errorMessage.count() && await errorMessage.isVisible()) {
        errorText = (await errorMessage.innerText()).trim();
        if (errorText) {
          outcome = 'failed';
          break;
        }
      }
      latestTask = await prisma.task.findFirst({
        where: { userId: user.id, type: 'image', createdAt: { gte: new Date(startedAt - 5000) } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          provider: true,
          model: true,
          progress: true,
          error: true,
          outputUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (latestTask?.status === 'failed') {
        outcome = 'failed';
        errorText = latestTask.error || '图片任务失败';
        break;
      }
      await page.waitForTimeout(3000);
    }

    let image = null;
    if (outcome === 'completed') {
      await resultImage.scrollIntoViewIfNeeded();
      await resultImage.evaluate((element) => element.decode());
      image = await resultImage.evaluate((element) => ({
        src: element.currentSrc || element.src,
        complete: element.complete,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
      }));
    }
    latestTask = latestTask || await prisma.task.findFirst({
      where: { userId: user.id, type: 'image', createdAt: { gte: new Date(startedAt - 5000) } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, provider: true, model: true, progress: true, error: true, outputUrl: true },
    });
    const updated = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } });
    await page.screenshot({ path: path.join(outputDirectory, 'final.png'), fullPage: true });
    const layout = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    const result = {
      outcome,
      durationMs: Date.now() - startedAt,
      errorText,
      image,
      task: latestTask,
      pointsBefore: user.points,
      pointsAfter: updated?.points,
      pointsUsed: user.points - (updated?.points ?? user.points),
      layout,
      imageResponses,
      consoleErrors,
      failedRequests,
    };
    fs.writeFileSync(path.join(outputDirectory, 'result.json'), JSON.stringify(result, null, 2));
    process.stdout.write(JSON.stringify(result, null, 2));
    if (outcome !== 'completed') process.exitCode = 1;
  } finally {
    await browser.close();
  }
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
