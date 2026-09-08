/**
 * 提示词防火墙 — 内容安全检测（后端版，L1 加强版）
 * 在图片/视频生成前拦截违规提示词，阻止生成并返回错误
 *
 * 依据《生成式人工智能服务管理暂行办法》建立内容审核机制，
 * 防止生成违法信息，对用户输入的提示词进行安全过滤。
 *
 * L1 加强特性：
 * 1. 文本归一化：去除空格/标点/特殊字符/emoji，统一大小写
 * 2. Leet speak 还原：0→o, 3→e, 1→i, 4→a, 5→s, 7→t, @→a, $→s, 8→b
 * 3. 重复字符压缩：色色色情 → 色情，fffffff → f
 * 4. 拼音关键词：seqing、luoti、yinDang 等常见拼音变体
 * 5. 白名单豁免：反对色情、打击色情、拒绝黄赌毒 等合法表达
 * 6. 关键词库扩充至 200+，覆盖网络用语、变体、英文同义词
 */

/** 违规类别 */
export type ViolationCategory =
  | 'pornography'      // 色情
  | 'illegal'          // 违法
  | 'political_sensitive' // 涉政/政策敏感
  | 'anti_state'       // 反动/颠覆国家
  | 'defamation'       // 污蔑国家
  | 'political_party'  // 关于党
  | 'red_flag';        // 红旗话题

export interface PromptFirewallResult {
  /** 是否通过（true = 安全，false = 违规） */
  passed: boolean;
  /** 命中的违规类别 */
  category: ViolationCategory | null;
  /** 面向用户的中文提示 */
  message: string;
  /** 命中的关键词（调试/日志用） */
  matchedKeyword: string | null;
}

/** 各类别的关键词库（含中文、英文、拼音、变体） */
const VIOLATION_KEYWORDS: Record<ViolationCategory, string[]> = {
  pornography: [
    // 中文核心词
    '色情', '裸体', '裸照', '淫秽', '淫荡', '色诱', '脱衣',
    '做爱', '性交', '性行为', '性爱', '性暗示', '挑逗',
    '情色', '成人内容', '十八禁', '18禁', 'R18',
    '裸露', '暴露狂', '恋物', '偷拍', '走光',
    '比基尼脱', '内衣脱', '情趣', '自慰', '高潮',
    // 扩充：网络用语
    '约炮', '撩妹', '福利姬', '写真集', '裸聊', '裸拍',
    '私房照', '私密照', '不雅照', '艳照', '门事件',
    '黄片', '黄图', '黄网', '擦边', '擦边球', '软色情',
    '肉欲', '肉搏',
    '性感诱惑', '诱人身材', '诱惑力',
    '未成年少女', '童贞', '萝莉', '正太', '幼女', '幼童',
    '童裸', '童色', '恋童', '娈童',
    // 拼音变体
    'seqing', 'luoti', 'luozhao', 'yinhui', 'yindang',
    'seyou', 'tuoyi', 'zuoai', 'xingjiao', 'xingai',
    'qingse', 'luoliao', 'luopai', 'yanzhao',
    'yuepao', 'fuluoji', 'huangpian', 'huangtu',
    'luoli', 'zhengtai', 'tongshi',
    // 英文核心词
    'nude', 'naked', 'porn', 'pornography', 'erotic',
    'hentai', 'sex', 'sexual', 'nsfw', 'sexually explicit',
    // 英文扩充
    'porno', 'pron', 'segs', 'fap', 'masturbat', 'orgasm',
    'nudes', 'nudity', 'striptease', 'lingerie',
    'thong', 'panties', 'underwear', 'swimwear',
    'cleavage', 'upskirt', 'downblouse', 'voyeur',
    'camgirl', 'camwhore', 'escort', 'hooker', 'prostitute',
    'brothel', 'redlight', 'adultvideo', 'adultcontent',
    'shotacon', 'cheesepizza', 'childporn', 'lolicon',
    'bondage', 'bdsm', 'fetish', 'kink', 'kinky',
    'horney', 'horny', 'aroused',
    'titillat',
    'busty', 'booty', 'boob', 'dick', 'cock',
    'pussy', 'vagina', 'penis', 'genital',
    'creampie', 'milf', 'teenporn', 'matureporn',
    'rapes', 'molest', 'harass',
  ],
  illegal: [
    // 中文
    '制造炸弹', '制造毒品', '制毒', '贩毒', '吸毒',
    '洗钱', '诈骗', '传销', '非法集资',
    '恐怖袭击', '恐怖主义', '恐怖分子', '恐怖组织',
    '杀人方法', '投毒', '绑架', '勒索',
    '赌博', '赌场', '下注', '博彩',
    '枪支制造', '枪支买卖', '武器制造', '武器交易',
    '假币', '伪造', '走私', '偷渡',
    '黑客攻击', '网络攻击', '木马', '病毒制作',
    // 扩充
    '冰毒', '海洛因', '大麻', '可卡因', '摇头丸', 'K粉',
    '麻古', '鸦片', '吗啡', '安非他命', '甲卡西酮',
    '制枪', '造枪', '买枪', '卖枪', '弹药制造',
    '炸药制作', '雷管', '硝酸铵', 'TNT',
    '黑市', '暗网交易', '比特币洗钱', '电诈', '网赌',
    '六合彩', '澳门赌场', '线上赌场', '体育博彩',
    '走私车', '走私烟', '走私油', '水客',
    '偷越国境', '蛇头', '人口贩卖', '拐卖',
    // 拼音
    'zhidu', 'fandu', 'xidu', 'xiqian', 'zhazhadan',
    'zhidan', 'maiqiang', 'zhidu', 'dubo', 'duchang',
    // 英文
    'hacking', 'cracking', 'exploit', 'malware', 'ransomware',
    'methamphetamine', 'heroin', 'cocaine', 'cannabis', 'marijuana',
    'bombmaking', 'howtomakebomb', 'explosive',
    'drugdealing', 'drugdealer', 'kingpin', 'cartel',
    'moneylaunder', 'counterfeit', 'forgery',
    'smuggling', 'humantraffick', 'kidnapping',
    'gambling', 'casino', 'betting', 'wager',
    'weapon', 'firearm', 'gunmaking', 'ammunition',
    'assassination', 'murdermethod', 'poisonrecipe',
  ],
  political_sensitive: [
    // 中文：涉政/政策敏感风险表达，避免拦截中性"政策解读/普法宣传"
    '政治敏感', '涉政敏感', '敏感政治', '时政谣言',
    '政治谣言', '政治造谣', '散布政治谣言',
    '煽动游行', '煽动示威', '煽动抗议', '煽动集会',
    '非法游行', '非法示威', '非法集会', '群体性事件',
    '领导人恶搞', '领导人丑化', '领导人侮辱', '领导人换脸',
    '国家领导人恶搞', '国家领导人丑化', '国家领导人侮辱', '国家领导人换脸',
    '政治人物换脸', '政治人物裸照', '政治人物色情',
    '政治深度伪造', '政治deepfake', '政治仿冒',
    '伪造政府公告', '伪造政策文件', '伪造官方文件',
    '假政府通知', '假政策通知', '谣传政策',
    // 拼音/英文变体
    'zhengzhimin gan', 'zhengzhimingan', 'shezhengmingan',
    'zhengzhizaoyao', 'zhengzhiyanyao', 'feifajihui',
    'politicalrumor', 'politicaldisinformation', 'politicaldeepfake',
    'leaderdeepfake', 'fakegovernmentnotice', 'fakepolicy',
  ],
  anti_state: [
    // 中文
    '颠覆国家', '推翻政权', '分裂国家', '国家分裂',
    '反华', '反中国', '反政府武装', '暴动', '叛乱',
    '推翻政府', '推翻制度', '武装叛乱', '政变',
    '分裂势力', '独立运动', '分离主义',
    // 扩充
    '港独', '台独', '疆独', '藏独', '蒙独',
    '颜色革命', '茉莉花革命', '街头革命',
    '武装推翻', '暴力夺权', '武装夺权',
    '反动势力', '敌对势力', '境外势力',
    '颠覆政权', '颠覆社会主义',
    // 拼音
    'dianguojia', 'tuifanzhengquan', 'fenglieguojia',
    'fanHua', 'fanZhongguo', 'baodong', 'panluan',
    'gangdu', 'taidu', 'jiangdu', 'zangdu',
    // 英文
    'subvert', 'overthrow', 'separatist', 'secession',
    'insurrection', 'coup', 'rebellion', 'mutiny',
    'colorrevolution', 'jasminerevolution',
    'hongkongindependence', 'taiwanindependence',
    'tibetindependence', 'xinjiangindependence',
  ],
  defamation: [
    // 中文
    '污蔑中国', '诋毁中国', '抹黑中国', '丑化中国',
    '辱华', '反华言论', '中国威胁论',
    '污蔑国家', '诋毁国家', '抹黑国家',
    '中国崩溃', '中国失败',
    // 扩充
    '东亚病夫', '支那', '支那猪', '中共病毒',
    '武汉病毒', '中国病毒', '功夫病毒',
    '辱华言论', '反华分子', '反华势力',
    '丑化中国人', '污蔑中国人', '诋毁中国人',
    // 拼音
    'wumieZhongguo', 'dihuiZhongguo', 'moheiZhongguo',
    'chouhuaZhongguo', 'ruhua', 'Zhongguobengkui',
    'zhina', 'zhinazhu',
    // 英文
    'chinathreat', 'chinavirus', 'kungflu',
    'chicomm', 'chicom', 'ccpvirus',
    'wuhanvirus', 'chinacollapse', 'chinafail',
    'sickmanofasia', 'shina',
  ],
  political_party: [
    // 中文
    '反党', '反共', '反对共产党', '推翻共产党',
    '共产党倒台', '共产党下台', '党腐败',
    '丑化党', '污蔑党', '诋毁党',
    '反中共', '反中国共产党',
    // 扩充
    '打倒共产党', '消灭共产党', '终结共产党',
    '党下台', '党倒台', '党垮台',
    '独裁党', '专制党', '暴政党',
    '反对中共', '反对中国共产党',
    '丑化中共', '污蔑中共', '诋毁中共',
    // 拼音
    'fandang', 'fangong', 'fantongchan', 'fantongchandang',
    'dadaoGongchandang', 'xiaomieGongchandang',
    'fanZhonggong', 'fanZhongguoGongchandang',
    // 英文
    'anticcp', 'anticommunist', 'downwithccp',
    'ccpdown', 'ccpfail', 'ccpcollapse',
    ' communistpartydown', 'overthrowccp',
  ],
  red_flag: [
    // 中文
    '污蔑红旗', '丑化红旗', '亵渎红旗', '侮辱红旗',
    '践踏红旗', '烧红旗', '撕红旗', '毁红旗',
    '污蔑五星红旗', '丑化五星红旗', '亵渎五星红旗',
    '侮辱五星红旗', '践踏五星红旗', '烧五星红旗',
    '污蔑国旗', '丑化国旗', '亵渎国旗', '侮辱国旗',
    // 扩充
    '践踏国旗', '烧国旗', '撕国旗', '毁国旗',
    '涂改国旗', '污损国旗', '倒挂国旗',
    '侮辱国徽', '亵渎国徽', '丑化国徽',
    '污蔑国徽', '践踏国徽',
    // 拼音
    'wumiehongqi', 'chouhuahongqi', 'xiaduhongqi',
    'wuruhongqi', 'jiantahongqi', 'shaohongqi',
    'wumieguoqi', 'chouhuaguoqi', 'xiaduguoqi',
    'wuruguoqi', 'wumieguohui', 'wuruguohui',
    // 英文
    'desecrateflag', 'burnflag', 'insultflag',
    'defaceflag', 'stompflag', 'tearflag',
    'burnchineseflag', 'desecratechineseflag',
    'insultnationalflag', 'insultemblem',
  ],
};

/** 各类别的用户提示语 */
const CATEGORY_MESSAGES: Record<ViolationCategory, string> = {
  pornography: '提示词包含色情内容，违反平台内容安全规范，无法继续处理。请修改提示词后重试。',
  illegal: '提示词涉及违法内容，违反平台内容安全规范及法律法规，无法继续处理。请修改提示词后重试。',
  political_sensitive: '提示词涉及敏感政策或涉政违规内容，违反平台内容安全规范，无法继续处理。请修改提示词后重试。',
  anti_state: '提示词涉及危害国家安全的内容，违反平台内容安全规范，无法继续处理。请修改提示词后重试。',
  defamation: '提示词涉及污蔑国家的言论，违反平台内容安全规范，无法继续处理。请修改提示词后重试。',
  political_party: '提示词涉及关于党的不当内容，违反平台内容安全规范，无法继续处理。请修改提示词后重试。',
  red_flag: '提示词涉及红旗相关不当内容，违反平台内容安全规范，无法继续处理。请修改提示词后重试。',
};

/**
 * 白名单短语：命中这些短语的 prompt 跳过对应类别检测
 * 避免误伤合法表达（如"反对色情"、"打击黄赌毒"）
 */
const WHITELIST_PHRASES: { phrase: string; exemptCategories: ViolationCategory[] }[] = [
  { phrase: '反对色情', exemptCategories: ['pornography'] },
  { phrase: '打击色情', exemptCategories: ['pornography'] },
  { phrase: '拒绝色情', exemptCategories: ['pornography'] },
  { phrase: '抵制色情', exemptCategories: ['pornography'] },
  { phrase: '扫黄', exemptCategories: ['pornography'] },
  { phrase: '打击黄赌毒', exemptCategories: ['pornography', 'illegal'] },
  { phrase: '反对黄赌毒', exemptCategories: ['pornography', 'illegal'] },
  { phrase: '禁毒', exemptCategories: ['illegal'] },
  { phrase: '反对毒品', exemptCategories: ['illegal'] },
  { phrase: '打击毒品', exemptCategories: ['illegal'] },
  { phrase: '拒绝毒品', exemptCategories: ['illegal'] },
  { phrase: '反恐', exemptCategories: ['illegal'] },
  { phrase: '打击恐怖主义', exemptCategories: ['illegal'] },
  { phrase: '反对恐怖主义', exemptCategories: ['illegal'] },
  { phrase: '反对分裂', exemptCategories: ['anti_state'] },
  { phrase: '维护统一', exemptCategories: ['anti_state'] },
  { phrase: '反对港独', exemptCategories: ['anti_state'] },
  { phrase: '反对台独', exemptCategories: ['anti_state'] },
  { phrase: '反对藏独', exemptCategories: ['anti_state'] },
  { phrase: '反对疆独', exemptCategories: ['anti_state'] },
  { phrase: '反对邪教', exemptCategories: ['anti_state', 'political_party'] },
  { phrase: '打击邪教', exemptCategories: ['anti_state', 'political_party'] },
  { phrase: '爱国主义', exemptCategories: ['anti_state', 'defamation'] },
  { phrase: '爱国教育', exemptCategories: ['anti_state', 'defamation'] },
  { phrase: '政策解读', exemptCategories: ['political_sensitive'] },
  { phrase: '政策宣传', exemptCategories: ['political_sensitive'] },
  { phrase: '政策海报', exemptCategories: ['political_sensitive'] },
  { phrase: '法规宣传', exemptCategories: ['political_sensitive'] },
  { phrase: '普法宣传', exemptCategories: ['political_sensitive'] },
  { phrase: '普法教育', exemptCategories: ['political_sensitive'] },
  { phrase: '反腐败', exemptCategories: ['political_party'] },
  { phrase: '廉洁', exemptCategories: ['political_party'] },
  { phrase: '党建', exemptCategories: ['political_party'] },
  { phrase: '党风廉政', exemptCategories: ['political_party'] },
  { phrase: '国旗法', exemptCategories: ['red_flag'] },
  { phrase: '国旗教育', exemptCategories: ['red_flag'] },
  { phrase: '爱护国旗', exemptCategories: ['red_flag'] },
  { phrase: '尊重国旗', exemptCategories: ['red_flag'] },
  { phrase: '保护国旗', exemptCategories: ['red_flag'] },
];

/** Leet speak 字符还原映射 */
const LEET_MAP: Record<string, string> = {
  0: 'o',
  3: 'e',
  1: 'i',
  4: 'a',
  5: 's',
  7: 't',
  '@': 'a',
  $: 's',
  8: 'b',
  2: 'z',
  6: 'g',
  9: 'g',
};

/**
 * 文本归一化：去除干扰字符，统一格式，便于关键词匹配
 * 1. 转小写
 * 2. Leet speak 还原（含 @ $ 等符号，需在去除符号前进行）
 * 3. 去除所有空格、制表符、换行、标点、特殊符号、emoji
 * 4. 重复字符压缩：色色色情 → 色情，fffffff → f
 *
 * 注意：leet 还原必须在去除特殊字符之前，否则 @ $ 等符号会被先删除
 */
function normalizeText(text: string): string {
  if (!text) return '';

  let result = text.toLowerCase();

  // Leet speak 还原：数字和特殊符号替换字母（必须在去除符号前）
  result = result.replace(/[03456789@$12]/g, (char) => LEET_MAP[char] || char);

  // 去除 emoji 和 Unicode 符号（保留中英文和数字）
  // 保留：中文字符 \u4e00-\u9fa5，英文 a-z，数字 0-9
  result = result.replace(/[^\u4e00-\u9fa5a-z0-9]/g, '');

  // 重复字符压缩：色色色情 → 色情，fffffff → f
  // 注意：只压缩 3 个及以上重复字符，避免误伤合法双字词
  result = result.replace(/(.)\1{2,}/g, '$1');

  return result;
}

/**
 * 判断关键词是否为纯 ASCII（英文/拼音/数字）
 */
function isAsciiKeyword(keyword: string): boolean {
  return /^[a-z0-9]+$/.test(keyword);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isNegatedSafetyContext(text: string, matchIndex: number, matchLength: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - 48), matchIndex);
  const after = text.slice(matchIndex + matchLength, matchIndex + matchLength + 24);
  const windowText = `${before}${after}`;

  return /(?:no|not|non|without|avoid|avoiding|exclude|excluding|remove|禁止|不要|别|避免|规避|排除|不包含|不能有|不得有|去除|移除|拒绝|反对|抵制|负向|反向|negative)\s*$/i.test(before) ||
    /(?:^|[^a-z])(?:sfw|safe\s*for\s*work|family\s*friendly)(?:[^a-z]|$)/i.test(windowText);
}

function findAsciiKeywordMatch(englishNormalized: string, normalizedKeyword: string): { index: number; length: number } | null {
  const escaped = escapeRegex(normalizedKeyword);
  const boundaryRegex = new RegExp(`(?:^|[^a-z0-9])(${escaped})(?:[^a-z0-9]|$)`, 'i');
  const boundaryMatch = boundaryRegex.exec(englishNormalized);
  if (boundaryMatch && boundaryMatch.index !== undefined) {
    return {
      index: boundaryMatch.index + boundaryMatch[0].indexOf(boundaryMatch[1]),
      length: boundaryMatch[1].length,
    };
  }

  if (normalizedKeyword.length < 4) return null;

  // Catch obfuscated forms such as "p o r n" or "how-to-make-bomb" without
  // matching ordinary words like "explicitly".
  const spacedPattern = normalizedKeyword
    .split('')
    .map(escapeRegex)
    .join('[\\s._-]*');
  const spacedRegex = new RegExp(`(?:^|[^a-z0-9])(${spacedPattern})(?:[^a-z0-9]|$)`, 'i');
  const spacedMatch = spacedRegex.exec(englishNormalized);
  if (!spacedMatch || spacedMatch.index === undefined) return null;
  return {
    index: spacedMatch.index + spacedMatch[0].indexOf(spacedMatch[1]),
    length: spacedMatch[1].length,
  };
}

function findChineseKeywordMatch(normalizedPrompt: string, normalizedKeyword: string): { index: number; length: number } | null {
  const index = normalizedPrompt.indexOf(normalizedKeyword);
  return index >= 0 ? { index, length: normalizedKeyword.length } : null;
}

const STORYBOARD_METADATA_LINE_PREFIX =
  /\r?\n(?=(?:情绪(?:节拍)?|镜头(?:信息|语言)?|景别|运镜|画面(?:动作)?|主体动作|环境(?:与空间)?|构图(?:与焦点)?|光线(?:设计)?|角色|服装|道具|连续性|旁白(?:\s*\/\s*声音)?|对白|负面(?:约束)?|视觉风格|故事前提)\s*[:：])/g;

/**
 * 保留故事板中字段之间的语义边界，避免“金色\n情绪”在归一化时被误拼成“色情”。
 *
 * 只处理前端固定生成的字段标题；用户输入中的任意换行仍按原有规则检测，不能用来绕过审核。
 */
function preserveStoryboardMetadataBoundaries(prompt: string): string {
  return prompt.replace(STORYBOARD_METADATA_LINE_PREFIX, '\n__storyboard_metadata_boundary__');
}

/**
 * 单张故事板由客户端拼接固定的“字段标题 + 内容”多行提示词。常规扫描会去掉换行，
 * 使相邻字段的尾字和标题首字误组成敏感词。仅在该受控来源中保留这些字段边界。
 */
export function checkPromptSafetyForImageGeneration(
  prompt: string,
  source?: string,
): PromptFirewallResult {
  if (source !== 'storyboard-maker-single-sheet') {
    return checkPromptSafety(prompt);
  }

  return checkPromptSafety(preserveStoryboardMetadataBoundaries(prompt));
}

/**
 * 检测提示词是否违规
 * @param prompt 待检测的提示词文本
 * @returns 检测结果
 *
 * 匹配策略：
 * - 中文关键词：子串匹配（中文无单词边界概念）
 * - 英文/拼音关键词：单词边界匹配（\b），避免子串误伤合法英文词
 *   例如 "ass" 不应命中 "class"、"tit" 不应命中 "title"
 */
export function checkPromptSafety(
  prompt: string,
  options?: { categories?: ViolationCategory[] },
): PromptFirewallResult {
  if (!prompt || typeof prompt !== 'string') {
    return { passed: true, category: null, message: '', matchedKeyword: null };
  }

  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    return { passed: true, category: null, message: '', matchedKeyword: null };
  }

  // 归一化文本（用于中文关键词匹配）
  const normalizedPrompt = normalizeText(trimmedPrompt);

  // 英文归一化文本（保留空格，用于英文单词边界匹配）
  // 流程：小写 → leet 还原 → 压缩重复字符 → 压缩单字母空格模式 → 规范化空格
  let englishNormalized = trimmedPrompt.toLowerCase();
  englishNormalized = englishNormalized.replace(/[03456789@$12]/g, (char) => LEET_MAP[char] || char);
  englishNormalized = englishNormalized.replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' '); // 非字母数字转为空格
  englishNormalized = englishNormalized.replace(/(.)\1{2,}/g, '$1'); // 压缩重复字符
  // 压缩"单字母+空格+单字母"模式：p o r n → porn，但 the cat 不受影响
  // 连续匹配 2 个以上的"单字母+空格"序列，将空格去除
  englishNormalized = englishNormalized.replace(/(\b[a-z]\s){2,}[a-z]\b/g, (m) => m.replace(/\s+/g, ''));
  englishNormalized = englishNormalized.replace(/\s+/g, ' ').trim();

  // 原始文本（小写，用于白名单短语匹配，保留语义）
  const originalLower = trimmedPrompt.toLowerCase();

  // 计算需要豁免的类别（基于白名单短语）
  const exemptCategories = new Set<ViolationCategory>();
  for (const { phrase, exemptCategories: cats } of WHITELIST_PHRASES) {
    if (originalLower.includes(phrase) || normalizedPrompt.includes(normalizeText(phrase))) {
      cats.forEach((c) => exemptCategories.add(c));
    }
  }

  // 按优先级检测各类别（可通过 options.categories 自定义检测范围）
  const categoryOrder: ViolationCategory[] = options?.categories ?? [
    'political_sensitive',
    'anti_state',
    'defamation',
    'political_party',
    'red_flag',
    'pornography',
    'illegal',
  ];

  for (const category of categoryOrder) {
    // 跳过白名单豁免的类别
    if (exemptCategories.has(category)) {
      continue;
    }

    const keywords = VIOLATION_KEYWORDS[category];
    for (const keyword of keywords) {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword) continue;

      if (isAsciiKeyword(normalizedKeyword)) {
        // 英文/拼音关键词匹配策略：
        // 1. 单词边界匹配，避免 explicit 误伤 explicitly 这类普通词。
        // 2. 带边界的分隔符匹配，防止 p o r n / how-to-make-bomb 等绕过。
        const match = findAsciiKeywordMatch(englishNormalized, normalizedKeyword);
        if (match && !isNegatedSafetyContext(englishNormalized, match.index, match.length)) {
          return {
            passed: false,
            category,
            message: CATEGORY_MESSAGES[category],
            matchedKeyword: keyword,
          };
        }
      } else {
        // 中文关键词：子串匹配（中文无单词边界概念）
        const match = findChineseKeywordMatch(normalizedPrompt, normalizedKeyword);
        if (match && !isNegatedSafetyContext(normalizedPrompt, match.index, match.length)) {
          return {
            passed: false,
            category,
            message: CATEGORY_MESSAGES[category],
            matchedKeyword: keyword,
          };
        }
      }
    }
  }

  return { passed: true, category: null, message: '', matchedKeyword: null };
}

/**
 * 便捷方法：检测提示词是否安全
 */
export function isPromptSafe(prompt: string): boolean {
  return checkPromptSafety(prompt).passed;
}

/** 单例便捷导出 */
export const promptFirewall = {
  checkPromptSafety,
  isPromptSafe,
  normalizeText,
};
