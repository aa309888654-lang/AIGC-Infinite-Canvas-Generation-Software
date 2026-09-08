/**
 * 提示词结构化构建器
 * 本地确定性扩展引擎：动作分解 + 运镜策略 + 环境氛围 + 冲突校验
 * 在调用 MiniMax M2.7 精炼之前，先做一轮结构化扩展
 */

// ===== 类型定义 =====

export type MoodType = 'tense' | 'epic' | 'serene' | 'melancholy' | 'frenetic' | 'mysterious' | 'romantic';
export type VisualStyle = 'cinematic' | 'cyberpunk' | 'noir' | 'anime' | 'watercolor' | 'photorealistic';
export type SceneType = 'fight' | 'chase' | 'dialogue' | 'montage' | 'establishing' | 'custom';

export interface CinemaInput {
  subject: string;
  mood?: MoodType;
  style?: VisualStyle;
  intensity?: 1 | 2 | 3;
  mode: 'video' | 'image';     // 区分视频/图片模式
}

export interface CinemaOutput {
  expandedPrompt: string;       // 扩展后的文本（送入 LLM 精炼）
  cameraDescription: string;    // 运镜中文描述（仅视频模式）
  cameraControl: Record<string, unknown>; // 对接后端 CameraControl 格式（仅视频模式）
  negativePrompt: string;
  warnings: string[];
}

// ===== 情绪推断关键词 =====

const MOOD_KEYWORDS: Record<MoodType, string[]> = {
  tense:      ['紧张','危险','追逐','逃亡','对峙','暗杀','伏击','紧迫','威胁','死斗'],
  epic:       ['宏大','壮观','史诗','战场','千军万马','天地','宇宙','山巅','崛起','英雄'],
  serene:     ['宁静','安详','平静','清晨','溪流','田园','微风','温暖','温柔'],
  melancholy: ['忧伤','回忆','离别','雨天','黄昏','孤独','消逝','遗憾','思念'],
  frenetic:   ['疯狂','暴走','混乱','失控','狂暴','极速','爆发','崩塌','毁灭'],
  mysterious: ['神秘','诡异','未知','迷雾','黑暗','秘密','窥探','阴影','诅咒'],
  romantic:   ['浪漫','爱情','相遇','牵手','月光','花海','温馨','心动','告白'],
};

// ===== 运镜策略映射（仅视频模式使用） =====

interface CameraRule {
  cameraDesc: string;
  type: string;
  params: Record<string, number>;
}

const MOOD_CAMERA: Record<MoodType, CameraRule> = {
  tense:      { cameraDesc: '手持摄影机紧贴角色，画面微微晃动增加临场紧张感，快速甩镜切换对手反应', type: 'tracking', params: { pan: -7 } },
  epic:       { cameraDesc: '摇臂缓缓升起俯瞰全景，随后环绕主体展现宏大规模，升降机营造壮阔感', type: 'crane_up', params: { vertical: 5, horizontal: 5 } },
  serene:     { cameraDesc: '斯坦尼康缓慢平稳推进，如呼吸般安宁，浅景深虚化背景突出主体', type: 'zoom_in', params: { zoom: 3 } },
  melancholy: { cameraDesc: '镜头缓缓横移掠过画面，留恋般慢慢拉远，浅景深营造孤独感', type: 'pan_left', params: { pan: -4, zoom: 2 } },
  frenetic:   { cameraDesc: '暴力甩镜快速切换，冲击缩放制造眩晕感，手持剧烈晃动', type: 'tracking', params: { pan: 9, zoom: 8 } },
  mysterious: { cameraDesc: 'Dolly Zoom制造空间扭曲不安感，倾斜构图暗示危险，缓推制造悬念', type: 'dolly', params: { zoom: 5, roll: 4 } },
  romantic:   { cameraDesc: '环绕角色缓慢旋转营造亲密感，浅景深推进虚化背景，柔光笼罩', type: 'parallax', params: { horizontal: 3, zoom: 2 } },
};

// ===== 构图策略映射（仅图片模式使用） =====

interface CompositionRule {
  composition: string;
  angle: string;
}

const MOOD_COMPOSITION: Record<MoodType, CompositionRule> = {
  tense:      { composition: '紧凑构图，主体偏离中心制造不安，前景遮挡增加压迫感', angle: '低角度仰拍，倾斜构图，制造视觉张力' },
  epic:       { composition: '黄金比例构图，极远景展现全貌，引导线指向主体', angle: '大广角低角度仰拍，突出宏大与壮观' },
  serene:     { composition: '三分法构图，大量留白呼吸感，水平线稳定画面', angle: '平视角度，自然视角，安定舒适' },
  melancholy: { composition: '偏心构图，大量负空间制造孤独，暗角收拢视线', angle: '微俯拍，视角略带疏离感' },
  frenetic:   { composition: '极端倾斜构图，视觉元素溢出画框，信息过载', angle: '荷兰角，极度仰拍或俯拍，混乱视角' },
  mysterious: { composition: '中心构图但主体被阴影半遮，负空间制造悬念', angle: '微仰拍，阴影角度投射，不安定感' },
  romantic:   { composition: '中心对称构图，柔焦虚化边缘，花框式前景', angle: '平视微仰，柔和亲密视角' },
};

// ===== 动作分解库（仅视频模式使用） =====

interface ActionDecomposition {
  triggers: string[];
  action: string;
  vfx: string;
}

const ACTION_LIBRARY: ActionDecomposition[] = [
  // 拳法
  { triggers: ['出拳','直拳','重拳'], action: '拳头蓄力后猛然弹出，拳风划破空气产生冲击波纹', vfx: '冲击波扩散、空气扭曲、拳风轨迹线' },
  { triggers: ['勾拳','上勾拳'], action: '身体下蹲蓄力，拳头从下方弧线升起击中下颌', vfx: '慢动作击中特写、面部变形涟漪、汗珠飞溅' },
  { triggers: ['摆拳','横扫拳'], action: '手臂横向挥出巨大弧线，拳风扫过掀起尘土', vfx: '弧形残影、尘土飞扬、横向冲击波' },
  // 腿法
  { triggers: ['踢','鞭腿','侧踢'], action: '腿部如鞭子般甩出，脚尖破空留下一道白烟轨迹', vfx: '腿风残影、空气爆裂纹、地面尘土扬起' },
  { triggers: ['回旋踢','旋风腿'], action: '身体腾空旋转三百六十度，腿部横扫气流卷起碎屑', vfx: '旋转残影环、碎片飞旋、气旋涡流' },
  { triggers: ['下劈','劈腿'], action: '腿部高举后如斧头般劈下，落点地面龟裂', vfx: '地面裂纹扩散、碎石飞溅、冲击尘环' },
  // 防守闪避
  { triggers: ['闪避','躲避'], action: '身体极限后仰，攻击擦身而过带起发丝飘动', vfx: '速度线、时间减速效果、气流扰动' },
  { triggers: ['格挡','防御'], action: '双臂交叉防御，冲击力沿手臂传导产生涟漪', vfx: '能量波纹扩散、地面微微震裂、衣袍猎猎' },
  // 冲撞
  { triggers: ['冲撞','撞击'], action: '全身力量汇聚一点冲撞，撞击瞬间空气压缩爆裂', vfx: '冲击波球体扩散、碎片四溅、慢动作碎裂' },
  // 投掷
  { triggers: ['扔','投掷','抛'], action: '物体旋转飞出，划出弧线拖尾', vfx: '运动模糊拖尾、空气压缩锥、抛物线轨迹' },
  // 武器
  { triggers: ['剑','刀','斩','劈砍'], action: '刀刃划出银色弧光，斩击路径留下延迟消散的光痕', vfx: '刀光弧线、斩击波纹、金属碎屑闪烁' },
  { triggers: ['枪','射击','开火'], action: '枪口闪光后子弹穿透空气，留下一道高温气流通道', vfx: '枪口焰、弹道轨迹线、弹壳抛飞旋转' },
  // 通用打斗
  { triggers: ['打斗','战斗','格斗','交手','对决','搏斗','打架'], action: '双方激烈交锋，拳脚碰撞产生冲击气流，地面碎裂扩散', vfx: '冲击波纹、多重残影、碎片飞溅、尘土弥漫' },
  // 追逐
  { triggers: ['追','逃','跑','追逐'], action: '极速奔跑，脚步踏碎地面扬起尘烟，身体前倾极限冲刺', vfx: '运动模糊、速度线、地面碎裂轨迹、残影拖尾' },
  // 舞蹈
  { triggers: ['舞','舞蹈','跳舞'], action: '身体随节奏优雅旋转，裙摆划出流畅弧线，指尖延伸至极致', vfx: '裙摆残影弧线、光粒子尾迹、柔焦光晕' },
];

// ===== 环境风格预设 =====

const STYLE_ENVIRONMENTS: Record<VisualStyle, { lighting: string; atmosphere: string; colorGrade: string }> = {
  cinematic: {
    lighting: '电影级三点布光，主光45度侧方打亮面部，补光填充阴影，轮廓光勾勒身形',
    atmosphere: '浅景深虚化背景，胶片颗粒质感，画面层次分明',
    colorGrade: '青橙色调分级，暗部偏青蓝，亮部偏暖橙',
  },
  cyberpunk: {
    lighting: '霓虹灯光多角度穿透雨幕，紫色与青色混合光在湿润地面映射',
    atmosphere: '雨夜都市，水雾弥漫，霓虹倒影在积水路面碎裂摇曳，蒸汽从地下管道升腾',
    colorGrade: '高饱和霓虹色，暗部深紫，高光青蓝',
  },
  noir: {
    lighting: '高反差单侧强光，百叶窗投影切割面部，深黑阴影吞没半边身体',
    atmosphere: '烟雾缭绕，雨痕划过窗户投射暗纹，浓重暗角收拢视线',
    colorGrade: '近乎黑白，仅保留微弱暖色，极低饱和度',
  },
  anime: {
    lighting: '日式动画光效，柔和漫反射主光，边缘高光勾线，瞳孔精致高光点',
    atmosphere: '赛璐璐平涂色块，线条清晰锐利，背景水彩质感虚化',
    colorGrade: '高饱和纯净色彩，阴影互补色偏移，日系清新色调',
  },
  watercolor: {
    lighting: '自然漫射光，无硬阴影，光线如透过宣纸般柔和晕染',
    atmosphere: '水墨晕染效果，墨色浓淡渐变，大面积留白呼吸感',
    colorGrade: '低饱和水墨色，焦点处点染彩色，灰白留白',
  },
  photorealistic: {
    lighting: '物理准确全局光照，光线追踪级反射折射，体积光穿透尘埃',
    atmosphere: '8K超高清细节，微距级皮肤纹理，真实光学景深',
    colorGrade: 'RAW原始色彩，专业级色彩校正，HDR宽动态范围',
  },
};

const MOOD_ATMOSPHERE: Record<MoodType, string> = {
  tense:      '空气凝滞，暗流涌动，紧张到令人窒息的沉默',
  epic:       '天地辽阔，风云际会，壮阔到令人心潮澎湃',
  serene:     '微风拂面，光影柔和，时间仿佛在此刻静止',
  melancholy: '阴云低垂，光线暗淡，一切笼罩在淡淡哀愁中',
  frenetic:   '画面撕裂，时空扭曲，信息量过载的狂暴视觉',
  mysterious: '迷雾重重，光影诡谲，暗处似有未知窥视',
  romantic:   '暖光如蜜，花瓣轻舞，空气中弥漫甜腻气息',
};

// ===== 冲突校验规则 =====

const CONFLICT_PAIRS: [RegExp, RegExp, string][] = [
  [/特写|近景|微距/, /全景|远景|广角/, '同时指定特写与全景冲突'],
  [/静止|固定|稳定/, /高速|极速|飞速|狂暴/, '静态镜头与高速运动冲突'],
  [/浅景深|虚化/, /深景深|前后清晰/, '景深参数矛盾'],
  [/慢动作|慢速/, /快动作|加速|延时/, '速度描述矛盾'],
  [/顺光|正面光/, /逆光|背光|剪影/, '光照方向矛盾'],
];

// ===== 主构建器 =====

export class CinemaPromptBuilder {

  /**
   * 构建：本地结构化扩展
   * 视频模式 = 运镜 + 动作 + 特效 + 光照 + 氛围 + 色调
   * 图片模式 = 构图 + 角度 + 光照 + 氛围 + 色调
   */
  build(input: CinemaInput): CinemaOutput {
    const mood = input.mood || this.inferMood(input.subject);
    const style = input.style || 'cinematic';
    const intensity = input.intensity || 2;

    if (input.mode === 'video') {
      return this.buildVideo(input, mood, style, intensity);
    } else {
      return this.buildImage(input, mood, style, intensity);
    }
  }

  // ===== 视频模式 =====

  private buildVideo(input: CinemaInput, mood: MoodType, style: VisualStyle, intensity: 1 | 2 | 3): CinemaOutput {
    // 1. 动作分解
    const { actions, vfx } = this.decomposeActions(input.subject, intensity);

    // 2. 运镜策略
    const cameraRule = MOOD_CAMERA[mood];

    // 3. 环境
    const env = STYLE_ENVIRONMENTS[style];
    const moodAtmo = MOOD_ATMOSPHERE[mood];

    // 4. 组装
    const segments: string[] = [];
    segments.push(`【运镜】${cameraRule.cameraDesc}`);
    if (actions.length > 0) segments.push(`【动作】${actions.join('，')}`);
    if (vfx.length > 0) segments.push(`【特效】${vfx.join('，')}`);
    segments.push(`【光照】${env.lighting}`);
    segments.push(`【氛围】${env.atmosphere}，${moodAtmo}`);
    segments.push(`【色调】${env.colorGrade}`);

    const expandedPrompt = segments.join('。');

    // 5. 冲突校验
    const warnings = CONFLICT_PAIRS
      .filter(([a, b]) => a.test(expandedPrompt) && b.test(expandedPrompt))
      .map(([, , msg]) => msg);

    // 6. cameraControl
    const cameraControl: Record<string, unknown> = { type: cameraRule.type };
    for (const [key, val] of Object.entries(cameraRule.params)) {
      cameraControl[key] = val;
    }

    return {
      expandedPrompt,
      cameraDescription: cameraRule.cameraDesc,
      cameraControl,
      negativePrompt: '模糊, 低质量, 变形, 静态无动作, 曝光过度, 色彩失真, 画面抖动过度, 逻辑混乱',
      warnings,
    };
  }

  // ===== 图片模式 =====

  private buildImage(input: CinemaInput, mood: MoodType, style: VisualStyle, _intensity: 1 | 2 | 3): CinemaOutput {
    const compRule = MOOD_COMPOSITION[mood];
    const env = STYLE_ENVIRONMENTS[style];
    const moodAtmo = MOOD_ATMOSPHERE[mood];

    const segments: string[] = [];
    segments.push(`【构图】${compRule.composition}`);
    segments.push(`【角度】${compRule.angle}`);
    segments.push(`【光照】${env.lighting}`);
    segments.push(`【氛围】${env.atmosphere}，${moodAtmo}`);
    segments.push(`【色调】${env.colorGrade}`);

    // 图片模式也检测动作关键词，但不做动作分解，只做情绪描述
    const hasAction = ACTION_LIBRARY.some(a => a.triggers.some(t => input.subject.includes(t)));
    if (hasAction) {
      segments.push(`【动态】捕捉动作最具张力的一瞬间，凝固动态巅峰时刻，力量感在静止画面中涌动`);
    }

    const expandedPrompt = segments.join('。');

    const warnings = CONFLICT_PAIRS
      .filter(([a, b]) => a.test(expandedPrompt) && b.test(expandedPrompt))
      .map(([, , msg]) => msg);

    return {
      expandedPrompt,
      cameraDescription: '',  // 图片无运镜
      cameraControl: {},      // 图片无 cameraControl
      negativePrompt: '模糊, 低质量, 变形, 构图混乱, 曝光过度, 色彩失真, 细节缺失, 人体结构错误',
      warnings,
    };
  }

  // ===== 辅助方法 =====

  inferMood(text: string): MoodType {
    let best: MoodType = 'tense';
    let bestScore = 0;
    for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS) as [MoodType, string[]][]) {
      const score = keywords.filter(k => text.includes(k)).length;
      if (score > bestScore) { bestScore = score; best = mood; }
    }
    return best;
  }

  inferSceneType(subject: string): SceneType {
    if (/打斗|战斗|格斗|对决|交手|搏斗|打架/.test(subject)) return 'fight';
    if (/追|逃|跑/.test(subject)) return 'chase';
    if (/对话|交谈|对白/.test(subject)) return 'dialogue';
    if (/蒙太奇|混剪|回忆/.test(subject)) return 'montage';
    if (/全景|鸟瞰|俯瞰/.test(subject)) return 'establishing';
    return 'custom';
  }

  private decomposeActions(subject: string, intensity: 1 | 2 | 3): { actions: string[]; vfx: string[] } {
    const actions: string[] = [];
    const vfx: string[] = [];

    for (const entry of ACTION_LIBRARY) {
      if (entry.triggers.some(t => subject.includes(t))) {
        const actionText = intensity === 1
          ? entry.action.replace(/猛然|爆裂|剧烈|极限|冲击/g, '轻巧')
          : intensity === 3
            ? entry.action + '，力量感爆裂'
            : entry.action;
        actions.push(actionText);
        vfx.push(intensity >= 3 ? entry.vfx + '，爆裂特效' : entry.vfx);
      }
    }

    return { actions, vfx };
  }
}

export const cinemaPromptBuilder = new CinemaPromptBuilder();
