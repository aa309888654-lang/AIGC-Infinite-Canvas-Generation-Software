export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  gradient: string;
  borderColor: string;
  glowColor: string;
  type: string;
  priority: string;
  title: string;
  content: string;
  category: string;
}

export const NOTIFICATION_CENTER_BENEFITS_TEMPLATE_ID = 'notification-center-benefits';

export const NOTIFICATION_CENTER_REGISTRATION_BONUS = 50;

export const NOTIFICATION_CENTER_DAILY_CHECKIN_REWARDS = [10, 10, 10, 10, 10, 10] as const;

export const NOTIFICATION_CENTER_BENEFITS_CONTENT = `每日可签到 6 次：第 1-6 次分别获得 ${NOTIFICATION_CENTER_DAILY_CHECKIN_REWARDS.join('、')} 积分；每次间隔 1 小时，签到积分有效期 7 天
绑定邮箱或手机号送 50 积分，绑定奖励积分有效期 1 年
邀请好友注册成功奖励 50 积分，邀请奖励积分有效期 1 个月
邀请的好友使用积分超过 200 积分，您将再次获得 100 积分奖励。
邀请的好友注册并使用积分达标，单个好友累计最高可获得 150 积分
推荐浏览器：Chrome、Firefox`;

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: NOTIFICATION_CENTER_BENEFITS_TEMPLATE_ID,
    name: '通知中心福利默认模版',
    description: '通知中心按钮展开后展示的新用户福利和邀请奖励文字，可作为默认模版修改发送',
    icon: '🎁',
    gradient: 'from-orange-500/20 via-rose-500/10 to-violet-500/20',
    borderColor: 'border-orange-500/30',
    glowColor: 'shadow-orange-500/5',
    type: 'promotion',
    priority: 'normal',
    title: '新用户福利',
    content: NOTIFICATION_CENTER_BENEFITS_CONTENT,
    category: 'promotion',
  },
  {
    id: 'system-maintenance',
    name: '系统维护公告',
    description: '通知用户即将进行的系统维护和停机时间',
    icon: '🔧',
    gradient: 'from-amber-500/20 via-orange-500/10 to-red-500/20',
    borderColor: 'border-amber-500/30',
    glowColor: 'shadow-amber-500/5',
    type: 'system',
    priority: 'high',
    title: '🔧 系统维护通知 - 服务升级中',
    content: '尊敬的用户，您好！\n\n为了给您提供更稳定、更优质的服务体验，本平台将于 2026年5月20日（周三）凌晨 2:00 - 6:00 进行系统升级维护。\n\n📌 影响范围：\n• AI 图片生成服务暂停\n• 视频生成功能暂停\n\n✨ 升级内容：\n• 新增 Flux 2.0 模型支持\n• 优化工作流编辑器性能\n• 修复若干已知 BUG\n\n维护期间您仍可浏览历史作品。给您带来的不便，我们深表歉意！\n\n祝您创作愉快 🎨\n—— 本平台团队',
    category: 'system',
  },
  {
    id: 'task-success',
    name: '任务完成通知',
    description: 'AI 生成任务成功完成时发送给用户',
    icon: '✅',
    gradient: 'from-emerald-500/20 via-green-500/15 to-teal-500/20',
    borderColor: 'border-emerald-500/30',
    glowColor: 'shadow-emerald-500/5',
    type: 'task',
    priority: 'normal',
    title: '✅ 任务完成 - 您的作品已生成',
    content: '太好了！您的 AI 创作任务已成功完成 🎉\n\n🖼️ 作品详情：\n• 生成数量：4 张高清图片\n• 分辨率：2048×2048\n• 风格：写实摄影\n• 耗时：12.3 秒\n\n📋 提示词：未来都市夜景，霓虹灯光，赛博朋克风格\n\n💡 小贴士：\n• 点击下方「查看作品」欣赏高清大图\n• 可对满意的作品进行局部重绘优化\n• 支持一键导出至创意工作流\n\n期待您的下一幅佳作！✨\n—— 本平台',
    category: 'task',
  },
  {
    id: 'new-feature',
    name: '新功能上线',
    description: '平台新功能或模型发布的通知',
    icon: '🚀',
    gradient: 'from-violet-500/20 via-purple-500/15 to-fuchsia-500/20',
    borderColor: 'border-violet-500/30',
    glowColor: 'shadow-violet-500/5',
    type: 'promotion',
    priority: 'normal',
    title: '🚀 重磅更新 | Flux 2.0 模型正式上线！',
    content: '🎊 全新升级，Flux 2.0 正式发布！\n\n🌟 全新能力：\n━━━━━━━━━━━━━━━\n\n🖼️ 画质革命：\n• 分辨率提升至 4096×4096 超高清\n• 细节还原度提升 300%\n• 光影效果更真实自然\n\n🎯 精准控制：\n• 全新「构图助手」功能\n• 支持多参考图融合生成\n• 姿态控制精度提升 5 倍\n\n🎨 风格扩展：\n• 新增 50+ 艺术风格预设\n• 中国风水墨/工笔画专属模型\n• 3D 渲染风格全面优化\n\n⚡ 性能飞跃：\n• 生成速度提升 2.5 倍\n• 排队等待时间缩短 80%\n\n💡 计费说明：新模型统一按积分扣除，具体消耗以生成前提示为准。\n\n👉 立即前往创作页体验 Flux 2.0\n\n让创作没有边界 🚀\n—— 本平台团队',
    category: 'promotion',
  },
  {
    id: 'holiday-greeting',
    name: '节日祝福',
    description: '节日或特殊日期给用户发送暖心祝福',
    icon: '🎊',
    gradient: 'from-pink-500/20 via-rose-500/15 to-red-500/20',
    borderColor: 'border-pink-500/30',
    glowColor: 'shadow-pink-500/5',
    type: 'promotion',
    priority: 'low',
    title: '🎊 新春快乐 · 龙年大吉',
    content: '🧧 新春快乐，龙年大吉！🐉\n\n尊敬的用户，在这辞旧迎新的美好时刻，本平台团队祝您：\n\n🏮 创作灵感如泉涌\n🏮 作品张张皆精品\n🏮 梦想一一都实现\n🏮 生活处处有惊喜\n\n━━━━━━━━━━━━━━━\n\n🎁 新春专属福利已发放到您的账户：\n• 积分 +200\n• 龙年限定头像框\n\n🎨 新春创意挑战赛同步开启！\n用 AI 创作「龙年」主题作品，赢取年度会员大奖！\n\n新的一年，让我们继续用 AI 描绘无限可能 ✨\n\n新年快乐，万事如意！🧧\n—— 本平台团队',
    category: 'promotion',
  },
  {
    id: 'task-failed',
    name: '任务失败通知',
    description: 'AI 生成任务失败时告知用户原因',
    icon: '⚠️',
    gradient: 'from-red-500/20 via-orange-500/15 to-amber-500/20',
    borderColor: 'border-red-500/30',
    glowColor: 'shadow-red-500/5',
    type: 'task',
    priority: 'high',
    title: '⚠️ 任务失败 - 请检查后重试',
    content: '很抱歉，您的 AI 生成任务未能完成 😔\n\n🔍 失败原因分析：\n━━━━━━━━━━━━━━━\n\n❌ 错误代码：CONTENT_SAFETY_001\n📝 错误描述：提示词包含敏感内容，被安全策略拦截\n\n💡 解决方案：\n1️⃣ 检查提示词是否包含不当词汇\n2️⃣ 尝试修改描述方式，使用中性表达\n3️⃣ 参考平台「提示词指南」优化输入\n\n━━━━━━━━━━━━━━━\n\n🙋 需要帮助？\n• 查看「创作指南」了解提示词规范\n• 加入社区与其他创作者交流\n\n温馨提示：优质的提示词是生成精美作品的关键哦 ✨\n\n—— 本平台',
    category: 'task',
  },
];

export const TEMPLATE_CATEGORIES = [
  { key: 'all', label: '全部模版', icon: '📋' },
  { key: 'system', label: '系统通知', icon: '⚙️' },
  { key: 'task', label: '任务通知', icon: '🎯' },
  { key: 'payment', label: '支付通知', icon: '💳' },
  { key: 'membership', label: '会员通知', icon: '👑' },
  { key: 'promotion', label: '推广通知', icon: '📢' },
];
