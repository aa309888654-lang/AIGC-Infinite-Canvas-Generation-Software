// 提示词优化器 - 基于用户提供代码整合
// TEMS四维框架: Time(时间) / Entity(实体) / Motion(运动) / Style(风格)

// ============ 提示词分析类型定义 ============
export interface PromptAnalysis {
  originalLength: number;
  wordCount: number;
  qualityScore: number;
  issues: PromptIssue[];
  suggestions: string[];
  missingElements: string[];
  detectedCategories: string[];
  hasTimeElement: boolean;
  hasStyleElement: boolean;
  hasMotionElement: boolean;
  hasEntityElement: boolean;
}

export interface PromptIssue {
  type: 'missing' | 'vague' | 'structure' | 'redundant';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export interface OptimizationSuggestion {
  category: 'structure' | 'keywords' | 'context' | 'style';
  original: string;
  optimized: string;
  explanation: string;
}

export interface EnhancedOptimizeOptions extends OptimizeOptions {
  optimizationLevel: 'basic' | 'standard' | 'advanced';
  includeQualityKeywords: boolean;
  includeTechnicalTerms: boolean;
  preserveOriginal: boolean;
  userPreferences?: {
    style?: string;
    tone?: string;
    detailLevel?: 'low' | 'medium' | 'high';
  };
}

// ============ 模糊表述检测词库 ============
const vagueExpressions = [
  'nice', 'good', 'beautiful', 'pretty', 'great', 'awesome', 'cool',
  'something', 'thing', 'stuff', 'like', 'kind of', 'sort of',
  'very', 'really', 'extremely', 'super', 'quite', 'fairly',
  'a lot', 'many', 'much', 'some', 'several', 'various'
];

// ============ 质量增强关键词 ============
const qualityKeywords = [
  'ultra detailed', 'hyper detailed', 'highly detailed',
  'photorealistic', 'realistic', 'true to life',
  '8k resolution', '4k resolution', 'high definition',
  'sharp focus', 'crystal clear', 'crisp details',
  'masterpiece', 'best quality', 'award winning',
  'professional', 'commercial grade', 'studio quality'
];

// ============ 中文质量增强关键词 ============
const chineseQualityKeywords = [
  '超高清', '4K分辨率', '8K分辨率', '细节丰富', '专业级',
  '电影质感', '照片级真实', '光线优美', '色彩饱满', '构图完美',
  '超写实', '高清细节', '大师之作', '最佳质量', '获奖级作品',
  '商业级别', '工作室品质', '清晰锐利', '晶莹剔透', '精致细节'
];

// ============ 中国风默认增强关键词 ============
const chineseStyleDefaultKeywords = [
  '中国风格', '中式建筑', '东方美学', '中国传统元素',
  '亭台楼阁', '飞檐翘角', '红墙黛瓦', '雕梁画栋',
  '江南水乡', '徽派建筑', '四合院', '古典园林',
  '祥云纹样', '龙凤呈祥', '青绿山水',
  '朱砂红', '琉璃金', '月白', '天青',
  '丝绸质感', '玉石温润', '青铜古韵',
  '中国人物', '汉服', '旗袍', '中式服饰',
  '中国城市', '现代中国', '中国街景', '中式室内'
];

// ============ 中文模糊表述检测词库 ============
const chineseVagueExpressions = [
  '好看', '漂亮', '美丽', '不错', '很好', '很棒',
  '什么', '东西', '一些', '很多', '非常', '特别',
  '稍微', '比较', '相当', '大概', '差不多', '有点'
];

// ============ 技术术语词库 ============
const technicalTerms = {
  lighting: ['softbox lighting', 'three-point lighting', 'rim lighting', 'key light', 'fill light', 'back light', 'volumetric lighting', 'global illumination'],
  camera: ['depth of field', 'bokeh', 'shallow depth of field', 'wide aperture', 'telephoto lens', 'wide angle lens', 'macro lens'],
  rendering: ['ray tracing', 'path tracing', 'PBR materials', 'subsurface scattering', 'physically based rendering'],
  composition: ['rule of thirds', 'golden ratio', 'leading lines', 'symmetrical composition', 'asymmetrical composition']
};

// ============ 常见主题分类 ============
const themeCategories = {
  nature: ['forest', 'mountain', 'ocean', 'sky', 'sunset', 'sunrise', 'landscape', 'garden', 'park'],
  portrait: ['person', 'face', 'portrait', 'human', 'character', 'model'],
  product: ['product', 'item', 'object', 'merchandise', 'goods'],
  architecture: ['building', 'architecture', 'house', 'skyscraper', 'interior', 'exterior'],
  animal: ['animal', 'pet', 'wildlife', 'bird', 'dog', 'cat', 'creature'],
  fantasy: ['fantasy', 'magic', 'dragon', 'wizard', 'fairy', 'mythical', 'epic'],
  'sci-fi': ['sci-fi', 'science fiction', 'space', 'future', 'cyberpunk', 'robot', 'spaceship']
};

// ============ 提示词分析函数 ============
export function analyzePrompt(prompt: string): PromptAnalysis {
  const trimmedPrompt = prompt.trim();
  const words = trimmedPrompt.split(/\s+/).filter(w => w.length > 0);
  
  const analysis: PromptAnalysis = {
    originalLength: trimmedPrompt.length,
    wordCount: words.length,
    qualityScore: 0,
    issues: [],
    suggestions: [],
    missingElements: [],
    detectedCategories: [],
    hasTimeElement: false,
    hasStyleElement: false,
    hasMotionElement: false,
    hasEntityElement: false
  };

  // 检查 TEMS 元素
  Object.keys(timeKeywords).forEach(key => {
    if (timeKeywords[key].some(kw => trimmedPrompt.toLowerCase().includes(kw.toLowerCase()))) {
      analysis.hasTimeElement = true;
    }
  });

  Object.keys(styleKeywords).forEach(key => {
    if (styleKeywords[key].some(kw => trimmedPrompt.toLowerCase().includes(kw.toLowerCase()))) {
      analysis.hasStyleElement = true;
    }
  });

  Object.keys(motionKeywords).forEach(key => {
    if (motionKeywords[key].some(kw => trimmedPrompt.toLowerCase().includes(kw.toLowerCase()))) {
      analysis.hasMotionElement = true;
    }
  });

  Object.keys(entityKeywords).forEach(key => {
    if (entityKeywords[key].some(kw => trimmedPrompt.toLowerCase().includes(kw.toLowerCase()))) {
      analysis.hasEntityElement = true;
    }
  });

  // 检测主题分类
  Object.entries(themeCategories).forEach(([category, keywords]) => {
    if (keywords.some(kw => trimmedPrompt.toLowerCase().includes(kw.toLowerCase()))) {
      analysis.detectedCategories.push(category);
    }
  });

  // 检测模糊表述
  vagueExpressions.forEach(vague => {
    const regex = new RegExp(`\\b${vague}\\b`, 'gi');
    if (regex.test(trimmedPrompt)) {
      analysis.issues.push({
        type: 'vague',
        severity: 'medium',
        description: `使用了模糊表述: "${vague}"`,
        suggestion: '替换为更具体的描述性词汇'
      });
    }
  });

  // 检测中文模糊表述
  chineseVagueExpressions.forEach(vague => {
    if (trimmedPrompt.includes(vague)) {
      analysis.issues.push({
        type: 'vague',
        severity: 'medium',
        description: `使用了模糊表述: "${vague}"`,
        suggestion: '替换为更具体的描述性词汇'
      });
    }
  });

  // 检查长度
  if (trimmedPrompt.length < 20) {
    analysis.issues.push({
      type: 'missing',
      severity: 'high',
      description: '提示词太短，信息不足',
      suggestion: '添加更多描述性细节'
    });
  }

  // 检查缺失的元素
  if (!analysis.hasTimeElement) {
    analysis.missingElements.push('时间/光照');
  }
  if (!analysis.hasStyleElement) {
    analysis.missingElements.push('艺术风格');
  }
  if (!analysis.hasEntityElement && trimmedPrompt.length > 0) {
    analysis.missingElements.push('主体描述');
  }

  // 生成建议
  if (!analysis.hasTimeElement) {
    analysis.suggestions.push('建议添加时间/光照描述（如：golden hour, sunset, studio lighting）');
  }
  if (!analysis.hasStyleElement) {
    analysis.suggestions.push('建议添加艺术风格描述（如：photorealistic, cinematic, minimalist）');
  }
  if (analysis.wordCount < 10) {
    analysis.suggestions.push('建议增加更多细节描述');
  }

  // 计算质量分数
  let score = 50;
  if (trimmedPrompt.length >= 50) score += 10;
  if (trimmedPrompt.length >= 100) score += 10;
  if (trimmedPrompt.length >= 200) score += 10;
  if (analysis.hasTimeElement) score += 5;
  if (analysis.hasStyleElement) score += 5;
  if (analysis.hasMotionElement) score += 5;
  if (analysis.hasEntityElement) score += 5;
  if (qualityKeywords.some(kw => trimmedPrompt.toLowerCase().includes(kw.toLowerCase()))) score += 5;
  if (chineseQualityKeywords.some(kw => trimmedPrompt.includes(kw))) score += 5;
  
  // 减分
  const vagueCount = analysis.issues.filter(i => i.type === 'vague').length;
  score -= vagueCount * 5;
  
  analysis.qualityScore = Math.max(0, Math.min(100, score));

  return analysis;
}

// ============ 智能优化函数 ============
export function enhancePrompt(
  originalPrompt: string,
  options: Partial<EnhancedOptimizeOptions> = {}
): { optimized: string; suggestions: OptimizationSuggestion[]; analysis: PromptAnalysis } {
  const analysis = analyzePrompt(originalPrompt);
  const suggestions: OptimizationSuggestion[] = [];
  const optimized = originalPrompt.trim();

  const defaultOptions: EnhancedOptimizeOptions = {
    category: 'product-render',
    shotType: 'medium-shot',
    optimizationLevel: 'standard',
    includeQualityKeywords: true,
    includeTechnicalTerms: true,
    preserveOriginal: true,
    ...options
  };

  const parts: string[] = [];
  
  // 保留原始提示词
  if (defaultOptions.preserveOriginal && optimized.length > 0) {
    parts.push(optimized);
  }

  // 根据分析结果自动添加缺失元素
  if (analysis.detectedCategories.length > 0) {
    const category = analysis.detectedCategories[0];
    if (categoryKeywords[category as keyof typeof categoryKeywords]) {
      const catWords = categoryKeywords[category as keyof typeof categoryKeywords];
      const selectedWords = catWords.slice(0, 3);
      if (selectedWords.length > 0) {
        const originalFragment = selectedWords.join(', ');
        parts.push(originalFragment);
        suggestions.push({
          category: 'keywords',
          original: '',
          optimized: originalFragment,
          explanation: '根据检测到的主题添加了相关关键词'
        });
      }
    }
  } else if (categoryKeywords[defaultOptions.category]) {
    const catWords = categoryKeywords[defaultOptions.category];
    const selectedWords = catWords.slice(0, 3);
    if (selectedWords.length > 0) {
      parts.push(selectedWords.join(', '));
    }
  }

  // 添加质量关键词
  if (defaultOptions.includeQualityKeywords && defaultOptions.optimizationLevel !== 'basic') {
    // 检测是否有中文内容
    const hasChinese = /[\u4e00-\u9fa5]/.test(optimized);
    const qualityList = hasChinese ? chineseQualityKeywords : qualityKeywords;
    const qualityToAdd = qualityList.slice(0, 3);
    const missingQuality = qualityToAdd.filter(kw =>
      !optimized.toLowerCase().includes(kw.toLowerCase()) && !optimized.includes(kw)
    );
    if (missingQuality.length > 0) {
      parts.push(missingQuality.join(', '));
      suggestions.push({
        category: 'keywords',
        original: '',
        optimized: missingQuality.join(', '),
        explanation: '添加了质量增强关键词'
      });
    }
  }

  // 默认中国风规则：未明确指定其他国家/文化时，一律应用中国风格、中国人、中国建筑
  const hasExplicitNonChinese = /(欧美|西方|外国|异域|日本|日式|东京|京都|大阪|韩国|韩式|首尔|纽约|洛杉矶|巴黎|伦敦|米兰|罗马|曼谷|印度|阿拉伯|中东|非洲|拉美|美式|英式|法式|欧式|赛博东京|武士|和风|哥特|维多利亚|中世纪欧洲|american|western|european|japanese|japan|tokyo|kyoto|korean|korea|seoul|new york|paris|london|milan|rome|bangkok|arab|middle east|african|latin|samurai|gothic|victorian)/i.test(optimized);

  // 未指定非中国文化时，默认添加中国风关键词（中国人/中国建筑/中国风格）
  if (!hasExplicitNonChinese) {
    const matchedChineseKeywords: string[] = [];
    const lower = optimized.toLowerCase();

    // 人物类 - 默认中国人形象
    const hasPersonContent = /(人物|角色|人|男|女|先生|女士|老师|总裁|经理|总监|领导|嘉宾|主持|演讲|博士|教授|院长|校长|创始人|CEO|CTO|CFO|COO|VP|chief|director|manager|executive|officer|character|portrait|human|person|woman|man|girl|boy|child|kid|people)/i.test(optimized);
    if (hasPersonContent) {
      matchedChineseKeywords.push('中国人物', '东方美学', '中式服饰');
    }
    // 建筑/场景类 - 默认中国建筑
    else if (/建筑|楼|房|城|街|桥|塔|院|园|室|house|building|city|street|tower|architecture/i.test(lower)) {
      matchedChineseKeywords.push('中式建筑', '中国风格', '东方美学');
    }
    // 风景类
    else if (/风景|山水|自然|landscape|nature|mountain|river|scenery/i.test(lower)) {
      matchedChineseKeywords.push('中国风格', '青绿山水', '东方美学');
    }
    // 默认添加通用中国风
    else {
      matchedChineseKeywords.push('中国风格', '东方美学');
    }

    const missingChinese = matchedChineseKeywords.filter(kw => !optimized.includes(kw));
    if (missingChinese.length > 0) {
      parts.push(missingChinese.join(', '));
      suggestions.push({
        category: 'style',
        original: '',
        optimized: missingChinese.join(', '),
        explanation: '默认应用中国风格（中国人/中国建筑/中国美学），如需其他文化请明确指定'
      });
    }
  }

  // 添加技术术语
  if (defaultOptions.includeTechnicalTerms && defaultOptions.optimizationLevel === 'advanced') {
    const techToAdd = [
      ...technicalTerms.lighting.slice(0, 2),
      ...technicalTerms.camera.slice(0, 1),
      ...technicalTerms.rendering.slice(0, 1)
    ];
    const missingTech = techToAdd.filter(kw => 
      !optimized.toLowerCase().includes(kw.toLowerCase())
    );
    if (missingTech.length > 0) {
      parts.push(missingTech.join(', '));
      suggestions.push({
        category: 'context',
        original: '',
        optimized: missingTech.join(', '),
        explanation: '添加了专业技术术语'
      });
    }
  }

  // 添加镜头景别
  if (shotTypeKeywords[defaultOptions.shotType]) {
    const shotWords = shotTypeKeywords[defaultOptions.shotType];
    if (!optimized.toLowerCase().includes(shotWords.toLowerCase())) {
      parts.push(shotWords);
    }
  }

  // 添加镜头参数
  if (defaultOptions.focalLength) {
    parts.push(`${defaultOptions.focalLength}mm lens`);
  }
  if (defaultOptions.aperture) {
    parts.push(`f/${defaultOptions.aperture} aperture`);
  }

  return {
    optimized: parts.join(', '),
    suggestions,
    analysis
  };
}

// ============ 快速智能优化 ============
export function smartOptimize(originalPrompt: string): { 
  optimized: string; 
  analysis: PromptAnalysis;
  comparison: { original: string; optimized: string };
} {
  const analysis = analyzePrompt(originalPrompt);
  
  // 根据检测到的分类自动选择
  let category: keyof typeof categoryKeywords = '3d-render';
  if (analysis.detectedCategories.includes('product')) category = 'product-render';
  else if (analysis.detectedCategories.includes('nature')) category = '3d-render';
  else if (analysis.detectedCategories.includes('architecture')) category = '3d-render';
  
  const result = enhancePrompt(originalPrompt, {
    category,
    optimizationLevel: 'standard',
    includeQualityKeywords: true,
    includeTechnicalTerms: true,
    preserveOriginal: true
  });

  return {
    optimized: result.optimized,
    analysis: result.analysis,
    comparison: {
      original: originalPrompt,
      optimized: result.optimized
    }
  };
}

// ============ TEMS 四维框架关键词库 ============

// Time 时间维度 - 表达时间概念、季节、时间段
export const timeKeywords: Record<string, string[]> = {
  'golden-hour': ['golden hour lighting', 'warm sunset light', 'golden hour', 'soft evening light', '黄昏时分', '黄金时刻', '暖色调夕阳'],
  'blue-hour': ['blue hour', 'twilight lighting', 'cool blue ambient', '蓝调时刻', '黄昏暮色', '冷色调环境光'],
  midday: ['harsh sunlight', 'bright daylight', 'high key lighting', '正午阳光', '明亮日光', '高调照明'],
  overcast: ['soft overcast light', 'diffused daylight', 'cloudy day lighting', '阴天', '柔和漫射光', '多云日光'],
  night: ['night scene', 'dark ambient', 'moonlight', '夜晚场景', '黑暗环境', '月光'],
  dawn: ['dawn lighting', 'early morning light', 'soft sunrise', '黎明', '晨光', '日出时分'],
  dusk: ['dusk lighting', 'evening light', 'sunset colors', '黄昏', '暮色', '日落色彩']
};

// Entity 实体维度 - 主体对象特征
export const entityKeywords: Record<string, string[]> = {
  product: ['product photography', 'commercial product', 'showcase item', '产品摄影', '商业产品', '展示物品'],
  character: ['character design', 'portrait', 'human figure', '角色设计', '人物肖像', '人体形态'],
  architecture: ['architectural render', 'building visualization', 'interior design', '建筑渲染', '建筑可视化', '室内设计'],
  vehicle: ['vehicle render', 'car design', 'automotive visualization', '车辆渲染', '汽车设计', '汽车可视化'],
  machinery: ['machinery', 'equipment', 'mechanical device', '机械设备', '工业设备', '机械装置'],
  nature: ['nature scene', 'landscape', 'environment', '自然场景', '风景', '环境'
  ],
  abstract: ['abstract', 'conceptual', 'artistic composition', '抽象', '概念性', '艺术构图']
};

// Motion 运动维度 - 动态表现
export const motionKeywords: Record<string, string[]> = {
  static: ['static', 'stationary', 'no motion', '静态', '固定', '无运动'],
  'slow-motion': ['slow motion', 'slow-mo', 'gentle movement', '慢动作', '缓慢移动', '轻柔运动'],
  'fast-motion': ['fast motion', 'time-lapse', 'speed effect', '快动作', '延时摄影', '速度效果'],
  dynamic: ['dynamic pose', 'action shot', 'energetic', '动态姿势', '动作镜头', '活力感'],
  flowing: ['flowing', 'fluid motion', 'smooth movement', '流动', '流体运动', '平滑移动'],
  explosion: ['explosion', 'burst', 'impact', '爆炸', '爆发', '冲击'],
  rotation: ['rotating', 'spinning', '360 rotation', '旋转', '自转', '360度旋转']
};

// Style 风格维度 - 艺术风格
export const styleKeywords: Record<string, string[]> = {
  photorealistic: ['photorealistic', 'realistic', 'true-to-life', '照片级真实', '写实', '逼真'],
  cinematic: ['cinematic', 'film look', 'movie quality', '电影质感', '影片效果', '电影级'],
  minimalist: ['minimalist', 'clean', 'simple', '极简', '简洁', '简单'],
  luxury: ['luxury', 'elegant', 'premium', '奢侈', '优雅', '高端'],
  vintage: ['vintage', 'retro', 'classic', '复古', '经典', '老式'],
  futuristic: ['futuristic', 'sci-fi', 'cyberpunk', '未来感', '科幻', '赛博朋克'],
  artistic: ['artistic', 'painterly', 'art gallery', '艺术感', '绘画风格', '画廊级']
};

// ============ 渲染板块关键词库 ============
export const categoryKeywords: Record<string, string[]> = {
  'product-render': [
    'professional product photography', 'studio lighting', 'softbox lighting', 'clean white background',
    'photorealistic', 'ultra detailed', 'sharp focus', 'commercial photography', 'product showcase',
    'high contrast', 'color accurate', '4k 8k resolution', 'depth of field', 'macro details',
    '商业产品摄影', '专业影棚灯光', '纯净白色背景', '超写实', '高清细节', '商业摄影', '产品展示'
  ],
  'industrial-render': [
    'industrial design visualization', 'factory environment', 'metallic textures', 'worn materials',
    'engineering precision', 'technical drawing aesthetic', 'heavy machinery', 'industrial lighting',
    'high contrast', 'gritty realistic', 'CAD render', 'technical documentation style', 'structural details',
    '工业设计可视化', '工厂环境', '金属材质', '做旧材质', '工程精度', '技术图纸美学', '重型机械'
  ],
  'model-render': [
    '3D model render', 'turntable animation style', 'clean environment', 'even lighting',
    'showcase topology', 'wireframe optional', 'textured materials', 'high polygon count',
    'realistic shading', 'PBR materials', 'subsurface scattering', 'accurate proportions',
    '3D模型渲染', '转台动画风格', '干净环境', '均匀照明', '展示拓扑', '纹理材质'
  ],
  '3d-render': [
    'cinematic 3D render', 'Blender Cycles render', 'octane render', 'ray tracing',
    'global illumination', 'volumetric lighting', 'photorealistic', 'ultra detailed',
    '8k resolution', 'hyper detailed textures', 'realistic physics', 'vray render quality',
    '电影级3D渲染', 'Blender Cycles渲染', 'Octane渲染', '光线追踪', '全局光照', '体积光'
  ],
  'product-animation': [
    'product animation', '360° turntable rotation', 'smooth motion', 'dynamic camera movement',
    'slow pan', 'close up details', 'transition effects', 'studio environment',
    'slow motion', 'highlight features', 'commercial animation style', '4K 60fps',
    '产品动画', '360°转台旋转', '平滑运动', '动态镜头', '慢镜头', '特写细节', '商业动画风格'
  ],
  'industrial-animation': [
    'industrial animation', 'technical animation', 'assembly process', 'exploded view animation',
    'mechanical movement', 'engineering visualization', 'industrial environment',
    'technical demonstration', 'precise motion', '4K technical animation', 'CAD animation',
    '工业动画', '技术动画', '装配过程', '爆炸视图动画', '机械运动', '工程可视化'
  ],
  'model-animation': [
    '3D model animation', 'rigged character animation', 'smooth motion capture',
    'dynamic camera angles', 'action sequence', 'realistic physics simulation',
    'cloth simulation', 'particle effects', 'detailed textures', 'cinematic lighting',
    '3D模型动画', '绑定角色动画', '运动捕捉', '动态镜头', '动作序列', '物理模拟'
  ]
};

// 镜头景别关键词
export const shotTypeKeywords: Record<string, string> = {
  'close-up': 'extreme close-up shot, focusing on fine details, macro perspective, 特写镜头, 微距视角, 聚焦细节',
  'medium-close-up': 'medium close-up shot, showing product details and partial context, 中近景, 展示产品细节和部分背景',
  'medium-shot': 'medium shot, showing full product with minimal surrounding context, 中景, 展示完整产品, 简洁背景',
  'medium-full-shot': 'medium full shot, showing product in its immediate environment, 中全景, 展示产品及其周围环境',
  'full-shot': 'full shot, showing entire product in full context, 全景, 完整展示产品',
  'wide-shot': 'wide shot, showing product in large environment, wide perspective, 远景, 广阔视角, 大环境',
  'extreme-wide-shot': 'extreme wide shot, vast perspective, showing product in grand environment, 超广角, 宏大场景'
};

// 渲染参数关键词
export const renderParamsKeywords: Record<string, string[]> = {
  hyperRealistic: ['hyper realistic', 'photorealistic', 'ultra realistic', '超写实风格', '照片级真实'],
  studioLighting: ['professional studio lighting', 'softbox lighting', 'three-point lighting', '影棚灯光', '三点布光', '柔光箱'],
  '8kResolution': ['8k resolution', 'ultra high definition', '4k resolution', '8K分辨率', '超高清', '4K'],
  rayTracing: ['ray tracing', 'real-time ray tracing', '光线追踪', '实时光追'],
  depthOfField: ['depth of field', 'bokeh effect', 'shallow depth of field', '景深', '虚化效果', '浅景深']
};

// 镜头参数
export const cameraParams = {
  focalLength: { min: 14, max: 200, default: 50 },
  aperture: { min: 1.2, max: 22, default: 2.8 },
  iso: { min: 100, max: 6400, default: 100 }
};

// 提示词优化选项类型
export interface OptimizeOptions {
  category: keyof typeof categoryKeywords;
  shotType: keyof typeof shotTypeKeywords;
  focalLength?: number;
  aperture?: number;
  iso?: number;
  params?: string[];
}

// 优化提示词
export function optimizePrompt(
  originalPrompt: string,
  options: OptimizeOptions
): string {
  const optimizedParts: string[] = [];
  
  // 1. 添加原始提示词
  if (originalPrompt.trim()) {
    optimizedParts.push(originalPrompt.trim());
  }
  
  // 2. 添加渲染板块关键词
  const categoryWords = categoryKeywords[options.category];
  if (categoryWords && categoryWords.length > 0) {
    const randomWords = categoryWords.slice(0, 5).join(', ');
    optimizedParts.push(randomWords);
  }
  
  // 3. 添加镜头景别关键词
  const shotWords = shotTypeKeywords[options.shotType];
  if (shotWords) {
    optimizedParts.push(shotWords);
  }
  
  // 4. 添加镜头参数
  if (options.focalLength) {
    optimizedParts.push(`${options.focalLength}mm lens, ${options.focalLength}mm焦距镜头`);
  }
  if (options.aperture) {
    optimizedParts.push(`f/${options.aperture} aperture, f/${options.aperture}光圈`);
  }
  if (options.iso) {
    optimizedParts.push(`ISO ${options.iso}`);
  }
  
  // 5. 添加渲染参数
  if (options.params && options.params.length > 0) {
    const paramWords = options.params.flatMap(p => renderParamsKeywords[p] || []);
    if (paramWords.length > 0) {
      optimizedParts.push(paramWords.slice(0, 4).join(', '));
    }
  }
  
  // 组合优化后的提示词
  return optimizedParts.join(', ');
}

// 快速优化 - 使用默认参数
export function quickOptimize(
  originalPrompt: string,
  category: keyof typeof categoryKeywords = 'product-render'
): string {
  return optimizePrompt(originalPrompt, {
    category,
    shotType: 'medium-shot',
    focalLength: 50,
    aperture: 2.8,
    iso: 100,
    params: ['hyperRealistic', 'studioLighting', '8kResolution']
  });
}

// 优化选项列表
export const optimizeCategories = [
  { value: 'product-render', label: '产品渲染' },
  { value: 'industrial-render', label: '工业渲染' },
  { value: 'model-render', label: '模型渲染' },
  { value: '3d-render', label: '三维渲染' },
  { value: 'product-animation', label: '产品动画' },
  { value: 'industrial-animation', label: '工业动画' },
  { value: 'model-animation', label: '模型动画' }
];

export const shotTypes = [
  { value: 'auto', label: '智能识别' },
  { value: 'close-up', label: '特写' },
  { value: 'medium-close-up', label: '中近景' },
  { value: 'medium-shot', label: '中景' },
  { value: 'medium-full-shot', label: '中全景' },
  { value: 'full-shot', label: '全景' },
  { value: 'wide-shot', label: '远景' },
  { value: 'extreme-wide-shot', label: '超广角' }
];