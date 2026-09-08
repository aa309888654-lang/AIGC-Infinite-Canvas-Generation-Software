import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { selectProvider, reportSuccess, reportFailure } from '../services/promptSmart3/providerRegistry';
import { callOpenAICompatible } from '../services/promptSmart3/openaiClient';
import { creditService } from '../services/credit-service';
import { AuthRequest, optionalAuth } from '../middleware/auth';
export const csAgentRouter = Router();

const csAgentLimiter = (() => {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const WINDOW_MS = 60_000;
  const MAX_HITS = 20;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = hits.get(ip);

    if (!record || now > record.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
      return next();
    }

    record.count++;
    if (record.count > MAX_HITS) {
      res.status(429).json({ success: false, error: '请求过于频繁，请稍后再试' });
      return;
    }
    next();
  };
})();

// ==================== 内置问答知识库 ====================

interface FAQItem {
  keywords: string[];
  question: string;
  answer: string;
  category: string;
}

const FAQ_KNOWLEDGE_BASE: FAQItem[] = [
  {
    category: '视频生成',
    question: '如何生成视频？',
    keywords: ['生成视频', '做视频', '文字转视频', '文生视频', '怎么生成视频', '视频怎么做', '如何做视频'],
    answer: `🎬 生成视频非常简单！步骤如下：
1. 在画布中添加「视频生成」节点
2. 在节点中选择AI模型（推荐 Seedance 1.5 Pro / Vidu Q3）
3. 输入视频描述提示词（越详细效果越好）
4. 设置视频参数：时长（2-12秒）、分辨率（480p/720p/1080p）、比例
5. 点击「生成」按钮，等待AI完成

💡 提示：
- 支持文字生成视频和图片生成视频
- 首帧图生视频：上传一张图片作为起始帧
- 提示词建议包含：场景、动作、镜头运动、氛围等细节`,
  },
  {
    category: '视频生成',
    question: '支持哪些视频模型？',
    keywords: ['视频模型', '视频AI', 'seedance', 'vidu', '视频生成模型', '有哪些模型'],
    answer: `🎥 目前支持以下视频生成模型：

🔹 Seedance 1.5 Pro — 豆包旗舰，最高质量，支持音频生成
🔹 Seedance 1.0 Pro — 豆包标准版，性价比高
🔹 Seedance 1.0 Lite — 豆包轻量版，速度快
🔹 Vidu Q3 Pro — 七牛云旗舰，画面精细
🔹 Vidu Q3 Turbo — 七牛云快速版，生成快

每个模型支持的功能略有不同，可在模型选择时查看详细说明。`,
  },
  {
    category: '视频生成',
    question: '图生视频怎么用？',
    keywords: ['图生视频', '图片转视频', '首帧', '图片生成视频', '图片变视频'],
    answer: `🖼️→🎬 图生视频操作步骤：
1. 添加「视频生成」节点
2. 选择支持图生视频的模型（如 Seedance）
3. 上传一张图片作为「首帧」
4. 描述你希望图片如何动起来
5. 点击生成

💡 高级用法：
- 首帧+尾帧：上传两张图，AI自动补中间动画
- 首帧图建议：清晰、主体突出、构图合理
- 提示词重点描述运动方向和变化`,
  },
  {
    category: '图片生成',
    question: '如何生成图片？',
    keywords: ['生成图片', '做图片', '文字转图片', '文生图', '怎么生成图片', 'AI画图', 'AI绘图'],
    answer: `🎨 生成图片步骤：
1. 在画布中添加「图片生成」节点
2. 选择AI模型（推荐 Seedream 3.0 / MiniMax）
3. 输入图片描述提示词
4. 设置参数：尺寸、数量、风格等
5. 点击「生成」

💡 提示词技巧：
- 描述主体、场景、风格、光线、色调
- 例如："一只橘猫坐在窗台上，阳光洒落，温暖色调，写实风格"
- 支持角色一致性：同一角色生成不同姿态`,
  },
  {
    category: '图片生成',
    question: '支持哪些图片模型？',
    keywords: ['图片模型', '图片AI', 'seedream', '图片生成模型'],
    answer: `🖼️ 目前支持以下图片生成模型：

🔹 Seedream 3.0 — 豆包最新图片模型，质量最高
🔹 Seedream 2.0 — 豆包标准图片模型
🔹 MiniMax 图片 — 支持角色一致性生成
🔹 即梦 Jimeng — 多种风格图片生成

特殊功能：
- 智能抠图：自动去除背景
- 图片增强：提升图片清晰度和质量
- 角色一致性：保持同一角色在不同图片中的外貌一致`,
  },
  {
    category: '音频生成',
    question: '如何生成音频/语音？',
    keywords: ['生成音频', '语音合成', 'TTS', '文字转语音', '生成音乐', 'AI配音', '怎么生成语音'],
    answer: `🎵 音频生成功能：

📝 语音合成（TTS）：
1. 添加「音频生成」节点
2. 选择「语音合成」模式
3. 输入要转换的文字
4. 选择音色（男声/女声/多种风格）
5. 点击生成

🎶 音乐生成：
1. 添加「音频生成」节点
2. 选择「音乐生成」模式
3. 输入音乐描述或歌词
4. 选择风格和时长
5. 点击生成

🎤 歌词生成：
- 输入主题，AI自动创作歌词
- 支持多种风格：流行、摇滚、民谣等`,
  },
  {
    category: '漫剧创作',
    question: '漫剧功能怎么用？',
    keywords: ['漫剧', '漫画', '创作', '故事', '剧本', '漫剧创作'],
    answer: `📖 漫剧创作功能：

漫剧是本平台的特色功能，可以一键生成完整的漫画故事！

操作步骤：
1. 在画布中使用「漫剧生成」节点
2. 输入故事大纲或剧本
3. AI自动拆分场景、生成分镜
4. 每个分镜自动生成对应图片
5. 支持编辑调整每个分镜
6. 最终导出为完整漫剧

💡 提示：
- 故事大纲越详细，生成效果越好
- 支持自定义角色设定
- 可单独调整每个分镜的图片和文字`,
  },
  {
    category: '会员与积分',
    question: '会员有什么权益？',
    keywords: ['会员', 'VIP', '权益', '会员有什么', '开通会员', '会员等级'],
    answer: `👑 会员权益说明：

🥉 基础会员：
- 生成统一按积分扣除
- 标准画质生成
- 基础模型访问

🥈 高级会员：
- 更多会员赠送积分
- 高清画质生成
- 全部模型访问
- 优先队列

🥇 专业会员：
- 更多可用积分权益
- 最高画质
- 全部模型+最新模型优先体验
- 专属客服通道
- 批量生成功能

💰 积分系统：
- 所有生成按模型规则消耗积分
- 会员开通/活动/签到可获得积分
- 积分余额不足时需要充值或领取奖励`,
  },
  {
    category: '会员与积分',
    question: '如何充值/购买积分？',
    keywords: ['充值', '购买积分', '买积分', '支付', '付款', '怎么充值'],
    answer: `💰 充值方式：

1. 点击页面右上角头像 → 「会员中心」
2. 选择「充值积分」
3. 选择充值金额
4. 支持微信支付、支付宝

💡 说明：
- 充值购买的积分永久有效，不过期
- 会员套餐赠送积分按套餐周期有效
- 充值越多优惠越大

如遇支付问题，请切换到「人工客服」联系我们。`,
  },
  {
    category: '账号问题',
    question: '如何注册/登录？',
    keywords: ['注册', '登录', '账号', '注册账号', '怎么注册', '忘记密码', '密码'],
    answer: `🔐 账号相关：

📝 注册：
1. 点击页面「注册」按钮
2. 输入邮箱/手机号
3. 设置密码
4. 验证邮箱/手机
5. 注册成功

🔑 登录：
- 支持邮箱/手机号+密码登录
- 记住登录状态

🔒 忘记密码：
1. 点击登录页「忘记密码」
2. 输入注册邮箱
3. 收到重置链接
4. 设置新密码

如无法收到验证邮件，请联系人工客服。`,
  },
  {
    category: '使用技巧',
    question: '提示词怎么写效果更好？',
    keywords: ['提示词', 'prompt', '怎么写提示词', '提示词技巧', '写法', '描述'],
    answer: `✍️ 提示词写作技巧：

🎬 视频提示词：
- 场景描述 + 主体动作 + 镜头运动 + 氛围
- 例："一只金毛犬在海滩奔跑，慢镜头，夕阳余晖，温暖色调"
- 避免抽象描述，尽量具体

🖼️ 图片提示词：
- 主体 + 场景 + 风格 + 光线 + 色调
- 例："赛博朋克城市夜景，霓虹灯光，雨后倒影，电影感"
- 指定艺术风格效果更好

🎵 音频提示词：
- 语音：明确语速、情感、语气
- 音乐：指定风格、乐器、节奏、情绪

💡 通用技巧：
- 用英文提示词效果通常更好
- 从简单到复杂逐步优化
- 参考优秀作品的提示词`,
  },
  {
    category: '使用技巧',
    question: '画布编辑器怎么用？',
    keywords: ['画布', '编辑器', '节点', '工作流', '怎么用画布', '流程编辑'],
    answer: `🖥️ 画布编辑器使用指南：

📌 基本操作：
- 左侧面板拖拽节点到画布
- 连接节点之间的数据流
- 双击节点编辑参数
- 右键节点查看更多选项

🔗 节点类型：
- 视频生成节点：AI视频创作
- 图片生成节点：AI图片创作
- 音频生成节点：AI音频创作
- 图像分析节点：AI理解图片内容
- 漫剧生成节点：一键生成漫剧

⚡ 工作流：
1. 拖入所需节点
2. 用连线连接节点（上游输出→下游输入）
3. 配置每个节点参数
4. 点击运行，按流程依次执行

💡 快捷键：
- 空格+拖拽：平移画布
- 滚轮：缩放
- Ctrl+Z：撤销`,
  },
  {
    category: '技术问题',
    question: '生成失败怎么办？',
    keywords: ['生成失败', '失败', '报错', '错误', '无法生成', '生成不了'],
    answer: `❌ 生成失败排查：

1️⃣ 检查积分是否充足
   → 会员中心查看积分余额

2️⃣ 检查提示词是否合规
   → 避免敏感内容描述
   → 确保提示词不为空

3️⃣ 检查参数设置
   → 分辨率/时长是否在支持范围内
   → 图片尺寸是否符合要求

4️⃣ 网络问题
   → 刷新页面重试
   → 检查网络连接

5️⃣ 服务繁忙
   → 高峰期可能需要排队
   → 稍后重试

如果多次失败，请切换到「人工客服」获取帮助。`,
  },
  {
    category: '技术问题',
    question: '生成的视频/图片可以商用吗？',
    keywords: ['商用', '版权', '使用权', '商业', '授权', '著作权'],
    answer: `📜 版权说明：

✅ 会员用户：
- 生成的作品可用于个人和商业用途
- 你拥有生成作品的使用权
- 建议对商用作品进行人工审核和修改

⚠️ 注意事项：
- AI生成内容可能涉及训练数据版权
- 建议对生成内容进行二次创作
- 不得用于违法用途
- 不得冒充真人肖像进行欺诈

如需商业授权证明，请联系人工客服。`,
  },
];

function matchFAQ(message: string): FAQItem | null {
  const normalizedMsg = message.toLowerCase().replace(/[？?！!。，,\s]/g, '');

  let bestMatch: FAQItem | null = null;
  let bestScore = 0;

  for (const faq of FAQ_KNOWLEDGE_BASE) {
    let score = 0;
    for (const keyword of faq.keywords) {
      const normalizedKeyword = keyword.toLowerCase().replace(/[？?！!。，,\s]/g, '');
      if (normalizedMsg.includes(normalizedKeyword)) {
        score += normalizedKeyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
}

const LLM_SYSTEM_PROMPT = `你是AICGXT平台的AI客服助手，基于小天AICG模型。

你的职责是回答用户关于AICGXT平台的各种问题，包括：
- AI视频生成（文字转视频、图片转视频、漫剧创作）
- AI图片生成（文字转图片、智能抠图、图片增强、角色一致性）
- AI音频生成（语音合成、音乐生成、歌词生成）
- 会员和积分系统
- 账号注册和登录问题
- 画布编辑器使用方法

【重要规则】：
1. 如果有人问"你是什么模型"，请回答"我是小天AICG模型"
2. 不要提及MiniMax、豆包、astron或其他第三方模型名称
3. 回答要友好、专业、简洁，用中文回答
4. 如果是不确定的问题或需要人工处理（投诉、退款、充值失败等），建议用户切换到「人工客服」
5. 不要编造不存在的功能`;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

async function callLLM(messages: ChatMessage[]): Promise<string> {
  const tried = new Set<string>();
  for (let attempt = 0; attempt < 3; attempt++) {
    const entry = selectProvider(tried);
    if (!entry) {
      throw new Error('No LLM provider available');
    }
    tried.add(entry.config.name);
    try {
      const content = await callOpenAICompatible(
        entry.config,
        messages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
        15000,
      );
      if (content) {
        reportSuccess(entry.config.name);
        return content;
      }
    } catch (err) {
      reportFailure(entry.config.name);
      console.error(`[CSAgent] LLM provider "${entry.config.name}" failed:`, (err instanceof Error ? err.message : String(err)));
    }
  }
  throw new Error('All LLM providers failed');
}

// ==================== 路由 ====================

csAgentRouter.post('/chat', optionalAuth, csAgentLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { message, history } = req.body as { message: string; history?: ChatMessage[] };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: '请输入消息内容' });
    }

    const faqMatch = matchFAQ(message);
    if (faqMatch) {
      const needHuman = /人工|客服|投诉|退款|充值|付款|发票/.test(message);
      return res.json({
        success: true,
        data: {
          reply: faqMatch.answer,
          needHuman,
          matchedFAQ: true,
          category: faqMatch.category,
        },
      });
    }

    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: '请登录后使用 AI 客服智能回答',
        code: 'AUTH_REQUIRED',
      });
    }

    const userId = req.userId;
    const membershipLevel = req.membershipLevel || 'trial';

    const creditCheck = await creditService.preCheck({
      userId,
      membershipLevel,
      type: 'prompt',
      customPoints: 3,
      taskId: `cs_agent_${Date.now()}`,
      reason: '智能客服预检查',
    });
    if (!creditCheck.allowed) {
      return res.status(402).json({ success: false, error: creditCheck.reason });
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: LLM_SYSTEM_PROMPT },
      ...(history || []).slice(-10),
      { role: 'user', content: message },
    ];

    try {
      const reply = await callLLM(messages);
      if (reply) {
        // LLM调用成功，扣除积分
        await creditService.consume({
          userId,
          membershipLevel,
          type: 'prompt',
          customPoints: 3,
          taskId: `cs_agent_${Date.now()}`,
          reason: '智能客服AI回答',
        }).catch(err => console.error('[CSAgent] 积分扣除失败:', err.message));
        const needHuman = /人工|客服|投诉|退款|充值|付款|发票/.test(message);
        return res.json({
          success: true,
          data: { reply, needHuman, matchedFAQ: false, provider: 'llm' },
        });
      }
    } catch (err) {
      console.error('[CSAgent] LLM failed:', (err instanceof Error ? err.message : String(err)));
    }

    return res.json({
      success: true,
      data: {
        reply: '抱歉，AI客服暂时无法响应，请点击「人工客服」联系我们的客服获取帮助。',
        needHuman: true,
      },
    });
  } catch (error: unknown) {
    console.error('[CSAgent] Error:', (error instanceof Error ? error.message : String(error)));
    res.json({
      success: true,
      data: {
        reply: '抱歉，服务出现异常，请点击「人工客服」联系客服。',
        needHuman: true,
      },
    });
  }
});

csAgentRouter.get('/faq-categories', (_req: Request, res: Response) => {
  const categories = [...new Set(FAQ_KNOWLEDGE_BASE.map(f => f.category))];
  const faqList = FAQ_KNOWLEDGE_BASE.map(f => ({
    question: f.question,
    category: f.category,
    keywords: f.keywords.slice(0, 3),
  }));
  res.json({ success: true, data: { categories, faqs: faqList } });
});

export default csAgentRouter;
