import React, { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { NodeProps, NodeResizer } from '@xyflow/react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import { AICG_HANDLE_CLASS } from './aicg-node-handles';
import AICGNodeShell from './AICGNodeShell';
import AICGNodePromptBar from './AICGNodePromptBar';
import AICGSlashMenu from '../AICGSlashMenu';
import { useAICGSlashConnect } from '@/hooks/useAICGSlashConnect';
import { ChevronDown, X as CloseIcon, Sparkles, Brain, BookOpen, Check, Loader2, Camera, Video, Sun, Zap, Film, Music, Mountain, CloudRain, Swords, Palette, Maximize2, Minimize2, AlertCircle, Gauge, Search, Smile, Timer, Move, Clapperboard, Repeat, ArrowRightLeft, Paintbrush, Lightbulb, Wind, Shirt, Focus, Clock, Users, Gem, PawPrint, User, Bot, Utensils, ShoppingBag, Leaf, Microscope, Car, Heart, Snowflake, Aperture, UserCircle, LayoutGrid, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeControllerCollapse } from '@/hooks/useNodeControllerCollapse';
import { canvasStoreApi, useCanvasStore } from '@/store/useCanvasStore';
import { promptOptimizerService, classifyPromptAgent } from '@/services/prompt-optimizer-api';
import { promptQualityAnalyzer } from '@/services/PromptQualityAnalyzer';
import { usePermission } from '@/hooks/usePermission';
import { checkQuotaOrFail, getQuotaBadge } from '@/lib/quota-helper';
import { toast } from 'sonner';
import type { PromptNodeData } from '@/types/node-data';
import { nodeEventBus } from '@/lib/nodeEventBus';
import { PROMPT_OPTIMIZER_MODELS, DEFAULT_PROMPT_TEXT_MODEL_ID, type PromptOptimizerModelId } from '@/config/prompt-optimizer-models';
import { getTextModelIcon } from '@/config/text-model-icons';
import videoCombosJson from '@/pages/data/video-combos.json';
import imageCombosJson from '@/pages/data/image-combos.json';

const COMBO_ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, Camera, Swords, Music, Mountain, Zap, Timer, Move, Clapperboard,
  Repeat, ArrowRightLeft, Paintbrush, Lightbulb, CloudRain, Wind, Shirt, Focus,
  Clock, Users, Gem, PawPrint, Palette, User, Sun, Bot, Film, Utensils,
  ShoppingBag, Leaf, Microscope, Car, Heart, Snowflake, Aperture, UserCircle, LayoutGrid,
};

type ComboGroupJson = {
  group: string;
  color: string;
  iconKey: string;
  items: { name: string; en: string }[];
};

type ComboGroupWithIcon = {
  group: string;
  color: string;
  icon: LucideIcon;
  items: { name: string; en: string }[];
};

function resolveComboIcons(data: ComboGroupJson[]): ComboGroupWithIcon[] {
  return data.map((g) => ({
    group: g.group,
    color: g.color,
    icon: COMBO_ICON_MAP[g.iconKey] || Sparkles,
    items: g.items,
  }));
}

function mergeCombos(base: ComboGroupWithIcon[], extra: ComboGroupWithIcon[]): ComboGroupWithIcon[] {
  const merged = base.map(g => ({ ...g, items: [...g.items] }));
  const indexByName = new Map(merged.map((g, i) => [g.group, i]));
  for (const g of extra) {
    const idx = indexByName.get(g.group);
    if (idx >= 0) {
      merged[idx].items.push(...g.items);
    } else {
      indexByName.set(g.group, merged.length);
      merged.push({ ...g, items: [...g.items] });
    }
  }
  return merged;
}

const VIDEO_COMBOS_BUILTIN: ComboGroupWithIcon[] = [
  { group: '运镜', color: 'blue', icon: Camera, items: [
    { name: '经典打斗', en: '手持跟拍，甩镜切换，慢动作击中瞬间' },
    { name: '史诗展现', en: '摇臂缓缓升起俯瞰，环绕展现全貌' },
    { name: '悬疑推进', en: '滑动变焦空间扭曲，倾斜构图，缓慢推进' },
    { name: '浪漫环绕', en: '环绕角色缓慢旋转，浅景深推进' },
    { name: '暴力追击', en: 'FPV穿越，冲击缩放，剧烈晃动' },
    { name: '宁静呼吸', en: '稳定器，缓慢推进，呼吸感节奏' },
  ]},
  { group: '打斗', color: 'red', icon: Swords, items: [
    { name: '拳法连击', en: '直拳→勾拳→摆拳，三连击组合' },
    { name: '腿法旋风', en: '鞭腿→回旋踢→下劈，空中腿法连击' },
    { name: '攻防转换', en: '格挡→闪避→反击，防御反击节奏' },
    { name: '武器对决', en: '斩击→格挡→对拼，冷兵器交锋' },
  ]},
  { group: '情绪', color: 'purple', icon: Music, items: [
    { name: '紧张', en: '快速甩镜，冷色调蓝绿光，急促节奏，倾斜构图' },
    { name: '宏大', en: '摇臂升全景，黄金时刻侧光，壮阔配乐感' },
    { name: '宁静', en: '缓慢推进，柔光，暖色调，呼吸感节奏' },
    { name: '忧郁', en: '推轨慢移，低饱和冷调，雨雾，长镜头' },
    { name: '狂乱', en: '手持晃动，高速剪辑，过曝闪烁，混乱节奏' },
    { name: '神秘', en: '滑动变焦，烟雾，局部光，深色高对比' },
    { name: '浪漫', en: '环绕旋转，黄金时刻柔光，花瓣飞舞，浅景深' },
  ]},
  { group: '风格', color: 'amber', icon: Palette, items: [
    { name: '电影质感', en: '电影级调色，变形宽银幕，胶片颗粒，青橙色调' },
    { name: '日漫风格', en: '日式动画，赛璐璐平涂，速度线，高饱和纯色' },
    { name: '赛博朋克', en: '霓虹灯光，紫青混合光，湿润地面映射，高对比' },
    { name: '纪录片', en: '手持摄影，自然光线，观察式镜头，真实质感' },
    { name: '水彩风格', en: 'Watercolor painting, loose brushwork, artistic conception, fluid style' },
  ]},
  { group: '场景', color: 'emerald', icon: Mountain, items: [
    { name: '古风江湖', en: '竹林古道，亭台楼阁，烟雾缭绕，水墨远山' },
    { name: '末日废土', en: '荒芜废墟，锈蚀金属，灰黄天空，风沙弥漫' },
    { name: '太空站舱', en: '太空站内部，金属走廊，舷窗星空，幽蓝灯光' },
    { name: '水下世界', en: '深海幽蓝，气泡升腾，光线折射，珊瑚摇曳' },
    { name: '极光冰原', en: '北极冰原，极光漫天，冰晶闪烁，寒冷蓝光' },
  ]},
  { group: '转场', color: 'teal', icon: Film, items: [
    { name: '淡入淡出', en: '画面逐渐淡入，光晕扩散，柔和过渡' },
    { name: '闪白切换', en: '画面过曝闪白，瞬间切换，冲击感强烈' },
    { name: '匹配剪辑', en: '动作匹配衔接，形似物体过渡，无缝转场' },
    { name: '缩放穿越', en: '快速缩放进入画面细节，穿越到新场景' },
  ]},
  { group: '特效', color: 'rose', icon: Zap, items: [
    { name: '子弹时间', en: '子弹时间，360度冻结，时间减速，环绕展现' },
    { name: '粒子爆散', en: '粒子爆散，碎片飞溅，能量释放，冲击波扩散' },
    { name: '残影叠化', en: '运动残影，多重叠化，动作拖尾，节奏感' },
    { name: '故障艺术', en: '数字故障，色彩分离，像素错位，赛博失真' },
  ]},
];

const IMAGE_COMBOS_BUILTIN: ComboGroupWithIcon[] = [
  { group: '风格', color: 'violet', icon: Palette, items: [
    { name: '电影质感', en: '电影级调色，青橙色调分级，胶片颗粒，伦勃朗光' },
    { name: '赛博朋克', en: '霓虹紫青混合光，湿润地面映射，高饱和霓虹色' },
    { name: '黑色电影', en: '高反差单侧强光，百叶窗投影，深黑阴影，近黑白' },
    { name: '日系清新', en: '柔和淡雅色调，通透光线，低对比，淡粉蓝' },
    { name: '复古胶片', en: '胶片颗粒，漏光效果，褪色色调，柯达色彩' },
    { name: '水彩写意', en: 'Watercolor painting, loose brushwork, artistic conception, fluid style' },
  ]},
  { group: '角度', color: 'cyan', icon: Camera, items: [
    { name: '仰拍英雄', en: '低角度仰拍，英雄视角，向上仰望，力量感' },
    { name: '鸟瞰全景', en: '鸟瞰航拍，俯视全景，无人机视角' },
    { name: '微距特写', en: '微距特写，极度放大，浅景深，细节世界' },
    { name: '鱼眼广角', en: '鱼眼镜头，桶形畸变，超广角球面' },
  ]},
  { group: '光影', color: 'orange', icon: Sun, items: [
    { name: '黄金时段', en: '日落暖光，长影投射，琥珀金辉' },
    { name: '伦勃朗光', en: '伦勃朗光效，三角光斑，戏剧性明暗' },
    { name: '逆光剪影', en: '逆光轮廓光，剪影效果，边缘发光' },
    { name: '体积光束', en: '体积光，丁达尔效应，光束穿透' },
    { name: '霓虹夜景', en: '霓虹灯光，多彩光源，夜色笼罩' },
  ]},
  { group: '环境', color: 'green', icon: CloudRain, items: [
    { name: '雨夜都市', en: '雨夜都市，湿润地面映射，霓虹倒影' },
    { name: '森林晨雾', en: '森林晨雾，斑驳阳光，苔藓地面' },
    { name: '星空银河', en: '银河星空，长曝光，星河横跨天际' },
    { name: '海滨落日', en: '海滨落日，金色余晖，波光粼粼' },
  ]},
  { group: '宫格参考', color: 'blue', icon: Maximize2, items: [
    { name: '多机位九宫格', en: 'A multi-camera angle reference sheet in 3x3 grid layout, showing [主体] from 9 different perspectives simultaneously: top-left front view, top-center 3/4 front view, top-right side profile, middle-left low angle, middle-center eye-level straight-on, middle-right high angle, bottom-left back view, bottom-center 3/4 back view, bottom-right top-down overhead view. [主体详细描述]. Consistent lighting across all 9 frames, uniform light warm gray background color F0EDE8, subjects softly blending with background with natural edge transition, no hard edges no white halo no light bleed, professional studio photography, clean grid layout with thin white dividers between frames, character consistency maintained across all angles, absolutely no visible numbers text labels frame counters corner marks or annotations anywhere on the image' },
    { name: '多机位九宫格4K', en: 'Ultra high resolution multi-camera angle reference sheet in 3x3 grid layout, 4K quality, showing [主体] from 9 different perspectives simultaneously: top-left front view, top-center 3/4 front view, top-right side profile, middle-left low angle, middle-center eye-level straight-on, middle-right high angle, bottom-left back view, bottom-center 3/4 back view, bottom-right top-down overhead view. [主体详细描述]. Consistent cinematic lighting across all 9 frames, uniform light warm gray background color F0EDE8, subjects softly blending with background with natural edge transition, no hard edges no white halo no light bleed, professional studio photography with medium format film aesthetic, clean grid layout with thin white dividers between frames, character consistency maintained across all angles, fine organic film grain, zero digital sharpening, absolutely no visible numbers text labels frame counters corner marks or annotations anywhere on the image' },
    { name: '剧情推演四宫格', en: 'A 4-panel storyboard sequence in 2x2 grid, showing narrative progression of [事件/场景]: top-left [阶段1描述], top-right [阶段2描述], bottom-left [阶段3描述], bottom-right [阶段4描述]. Consistent character design across all panels, coherent lighting and color palette, uniform light warm gray background color F0EDE8, subjects softly blending with background with natural edge transition, no hard edges no white halo no light bleed, cinematic composition, emotional arc from [情绪A] to [情绪B], film grain texture, clean thin white grid dividers, absolutely no visible numbers text labels frame counters corner marks or annotations anywhere on the image' },
    { name: '角色脸部三视图', en: 'Character face reference sheet, three views side by side in single row: left panel front view straight-on, center panel 3/4 angle view, right panel side profile view. [角色面部详细描述]. Consistent lighting from 45-degree top-side across all three views, light warm gray background color F0EDE8, subjects softly blending with background with natural edge transition, no hard edges no white halo no light bleed, neutral clean backdrop, professional character design sheet, clean linework, subtle skin texture, identical facial features maintained across all angles, absolutely no visible numbers text labels frame counters corner marks or annotations anywhere on the image' },
    { name: '产品三视图', en: 'Product design reference sheet, three orthographic views in single row: front view, side view, top view. [产品详细描述]. Light warm gray background color F0EDE8, products softly blending with background with natural edge transition, no hard edges no white halo no light bleed, studio lighting with soft shadows, technical drawing aesthetic, precise proportions, material texture visible, no perspective distortion, professional product photography, absolutely no visible numbers text labels frame counters corner marks or annotations anywhere on the image' },
    { name: '25宫格连贯分镜', en: 'A 5x5 cinematic storyboard grid, 25 sequential frames showing continuous narrative flow of [主体/场景/动作], naturally divided into 9 story beats progressing through beginning, development, escalation, twist, climax, and resolution. Scene transitions conveyed purely through visual continuity and character motion, absolutely no visible numbers, text, labels, frame counters, corner marks, or annotations anywhere on the image. Consistent character and environment across all 25 frames, smooth motion continuity between adjacent frames, uniform cinematic lighting and color palette, light warm gray background color F0EDE8, subjects softly blending with background with natural edge transition, no hard edges no white halo no light bleed, varied shot progression from wide to close-up, professional film storyboard aesthetic, subtle film grain, clean thin white grid dividers' },
    { name: '电影级光影校正', en: 'Cinematic lighting comparison sheet, 6 panels showing the same [主体/场景] under different lighting conditions: top-left golden hour warm backlight, top-center overcast soft diffused light, top-right neon night city light, bottom-left harsh midday direct sun, bottom-center Rembrandt 45-degree side light with triangle shadow, bottom-right dramatic low-key chiaroscuro. Consistent composition and subject across all panels, only lighting changes, light warm gray background color F0EDE8, subjects softly blending with background with natural edge transition, no hard edges no white halo no light bleed, professional cinematography reference, absolutely no visible numbers text labels frame counters corner marks or annotations anywhere on the image' },
    { name: '角色设定参考表', en: 'Character reference sheet, left-right split layout: left one-third area is chest-up close-up front view portrait (shoulder-up framing, extreme facial detail clarity, gentle natural expression, bright eyes looking straight at camera, realistic skin texture with visible pores and subtle imperfections, refined classical makeup); right two-thirds area is three full-body views in horizontal row, from left to right: full-body front standing pose (arms hanging naturally, feet together, complete front costume and body proportions), full-body side profile view (weight slightly shifted, waist-hip curve and silhouette visible, complete side costume and footwear), full-body back view (complete back neckline, hairstyle from behind, back costume details). Consistent front-top-side lighting across all panels, soft diffused light quality, light warm gray background color F0EDE8, subjects softly blending with background with natural edge transition, no hard edges no white halo no light bleed, identical character design, costume, hairstyle and accessories across all panels, professional character design sheet style, clean edges, accurate proportions, material texture visible from all angles, absolutely no visible numbers, text, labels, frame counters, corner marks or annotations anywhere on the image' },
    { name: '6种基础表情胸像', en: 'Character expression reference sheet in 2x3 grid layout, six basic expressions of the same character: top row from left to right: calm neutral expression (relaxed face, eyes looking straight ahead, lips naturally closed), gentle smile (corners of mouth slightly raised, eyes with smile lines, warm and approachable), joyful laugh (eyebrows and eyes curved upward, mouth open showing teeth, exuberant happiness); bottom row from left to right: sad tearful expression (slight furrow between brows, downturned outer eye corners, tears welling in eyes about to fall), angry stern expression (brows tightly locked, sharp piercing eyes with pressure, jaw slightly set), surprised astonished expression (eyes wide open, eyebrows raised high, mouth slightly open in O shape). All six expressions are chest-up close-up portraits of the same character, shoulder-up framing, extreme facial detail clarity, realistic skin texture preserved, no additional light source, light warm gray background color F0EDE8, subjects softly blending with background with natural edge transition, no hard edges no white halo no light bleed, identical character styling, hairstyle, makeup and accessories across all six panels, only facial expression changes, professional character expression sheet style, clean edges, absolutely no visible numbers, text, labels, frame counters, corner marks or annotations anywhere on the image' },
    { name: '360全景图', en: '生成一个720度的全景VR图，左右边缘100%像素级无缝衔接，可无限循环拼接；上下极点(南北极)自然过渡，无明显断层或拉伸，场景一致性，以及场景的逻辑性，封闭场景需要有门' },
  ]},
];

const VIDEO_COMBOS = mergeCombos(resolveComboIcons(videoCombosJson as unknown as ComboGroupJson[]), VIDEO_COMBOS_BUILTIN);
const IMAGE_COMBOS = mergeCombos(resolveComboIcons(imageCombosJson as unknown as ComboGroupJson[]), IMAGE_COMBOS_BUILTIN);

const MICRO_EXPRESSION_BASE_COMBOS = [
  { group: '喜悦', color: 'amber', icon: Smile, items: [
    { name: '克制微笑', en: '超清晰电影级人物面部特写，真实克制的微笑从中性表情缓慢出现：先是眼神变柔，眼轮匝肌轻微收紧，眼尾出现极浅细纹；随后双侧嘴角只上扬2到4毫米，颧大肌轻微牵动脸颊但不露齿；鼻翼保持自然，额头无夸张皱纹，瞳孔稳定聚焦，皮肤纹理、睫毛、下眼睑阴影清晰可见，表情变化控制在1.2秒内，温暖但不过度表演，避免假笑、僵硬笑、嘴型扭曲、眼睛闪烁' },
    { name: '释然笑意', en: '人物经历压抑后的释然微笑，镜头锁定眼睛、嘴角、下颌线：视线先短暂下垂并轻微闪避，随后重新聚焦；眉间细小皱褶逐渐松开，嘴唇闭合状态下形成非常浅的半笑，嘴角不对称地轻微上扬；下颌肌肉放松，喉结轻轻吞咽，伴随一次浅呼气，眼神从紧张转为柔和，面部保持真实皮肤细节和稳定轮廓，避免夸张表情、脸部融化、五官漂移' },
    { name: '惊喜绽放', en: '极清晰人物惊喜微表情，表情节奏分三段：第一段瞳孔轻微放大、上眼睑抬起；第二段眉毛快速上扬后自然回落，嘴唇轻启但不夸张张大；第三段眼神变亮、脸颊抬起、嘴角逐渐上扬形成真实喜悦。保持眼球高光稳定、牙齿不过曝、唇线清晰、鼻梁和法令纹自然，情绪在0.8到1.5秒内顺滑转变，避免卡顿、跳帧、笑容突然变形' },
    { name: '含泪微笑', en: '高分辨率含泪微笑特写，眼眶湿润但泪珠不夸张滑落，下眼睑轻微发红，内眉略微上扬，嘴角努力上扬却带轻微颤动，鼻翼有极细微抽动，笑容略不对称，呈现脆弱、感谢、忍耐混合情绪；保留眼中水光、睫毛边缘、唇部纹理、脸颊微红和真实皮肤毛孔，情绪复杂但自然，避免哭笑失控、眼泪糊成一片、面部过度扭曲' },
  ]},
  { group: '愤怒', color: 'red', icon: Swords, items: [
    { name: '压抑怒意', en: '超清晰压抑愤怒面部特写，人物不爆发但愤怒在细节中累积：眉头向内下压，眉间形成两道细小纵纹；上眼睑压低，眼神变窄并固定在目标上；下颌咬紧，咬肌微微凸起，嘴唇压成薄线，唇角轻微向下；鼻翼轻微扩张，呼吸变浅。面部轮廓稳定，眼睛、眉毛、嘴唇、下颌肌肉细节清晰，避免怒吼式夸张、牙齿变形、五官抖动' },
    { name: '冷怒凝视', en: '冷静危险的愤怒凝视，镜头为85mm电影肖像近景，面部几乎静止但眼神极具压迫感：眼睑微降，瞳孔稳定直视，眉峰轻压，单侧嘴角极轻微下沉，下颌略向前顶，颈部肌肉轻微绷紧。光线突出眼窝阴影和鼻梁立体感，皮肤纹理清楚，表情强度控制在低幅度高张力，避免脸部僵死、眼睛无神、表情断层' },
    { name: '爆发前一秒', en: '愤怒爆发前一秒的微表情序列，先出现短促吸气，鼻翼扩张，太阳穴和下颌肌肉同时绷紧；随后眉峰突然压低，眼睛快速眨动一次后定住；嘴唇微开像要说话又强行闭合，喉部轻微起伏。要求面部动作细腻连续、帧间稳定、没有闪烁，清晰呈现眉间纹、唇线、咬肌、眼神变化，避免突然咆哮或夸张张嘴' },
    { name: '不屑怒笑', en: '轻蔑和愤怒混合的短促微表情，单侧嘴角仅轻微上扬形成冷笑，鼻翼短暂收缩，上唇轻微抬起但不露出夸张牙齿；眉头仍然紧锁，眼神有攻击性，冷笑持续不到一秒后迅速消失。保持脸部左右不完全对称的真实表演感，嘴角、鼻翼、眉峰细节清晰，避免卡通化、邪笑过度、面部歪斜' },
  ]},
  { group: '悲伤', color: 'blue', icon: CloudRain, items: [
    { name: '强忍泪意', en: '极清晰强忍泪意特写，人物努力控制情绪：内眉上扬并向中间靠拢，眉尾轻微下坠；眼眶逐渐泛红，下眼睑积起薄薄水光但不让眼泪落下；嘴角轻微下坠又试图恢复中性，嘴唇闭合并轻颤，喉咙轻轻吞咽。皮肤毛孔、睫毛、眼部高光、泪膜反射保持清晰稳定，悲伤克制真实，避免大哭、眼部糊掉、脸部崩坏' },
    { name: '失落垂眼', en: '沉默失落的细腻微表情，视线缓慢下移，眼皮沉重但不完全闭合，睫毛阴影落在下眼睑；脸颊肌肉松弛，嘴唇轻轻闭合，嘴角无力下坠1到2毫米，呼吸明显放慢，肩颈微微塌下。画面需要清晰稳定，眼部轮廓、鼻梁阴影、唇部纹理和下巴线条自然可见，避免表情空洞或人物五官漂移' },
    { name: '心碎停顿', en: '人物听到坏消息后的心碎停顿，前0.5秒表情空白、眨眼延迟、瞳孔轻微失焦；随后内眉上提，眉间收紧，嘴唇微张又闭合，唇角逐渐下落，眼神像失去支撑。要求面部情绪从空白到悲伤自然浮现，眼神焦点变化清楚，皮肤和五官边缘锐利，避免突然哭泣、表情跳变、眼球闪烁' },
    { name: '苦涩微笑', en: '苦涩自我安慰式微笑，嘴角轻微上扬但眼睛没有笑意，下眼睑紧张，眉尾下压，眼神湿润并轻微游离；笑容维持很短时间后慢慢消退，脸颊没有明显抬起，形成笑与悲伤的冲突。镜头保持面部清晰，捕捉唇角不对称、眼眶水光、鼻翼轻颤和细小法令纹，避免假笑、过曝泪光、嘴型变形' },
  ]},
  { group: '惊惧', color: 'violet', icon: Zap, items: [
    { name: '细微惊吓', en: '真实细微惊吓微表情，眼睛瞬间睁大但不夸张，上眼睑快速抬起，下眼睑轻微紧绷，眉毛快速上扬后回落，嘴唇微张2到3毫米，呼吸短暂停顿，头部几乎不动。要求0.3到0.6秒内完成惊吓反应并被人物压回，眼球高光稳定、虹膜清晰、唇线和鼻翼清楚，避免夸张瞪眼、嘴巴拉伸、脸部闪烁' },
    { name: '恐惧冻结', en: '恐惧冻结状态的电影级特写，人物眼神固定在威胁方向，瞳孔放大，眨眼减少，面部肌肉僵硬但仍保持真实微颤；嘴角轻微向后拉，下巴微收，颈部肌肉紧张，呼吸几乎停住。画面要求高锐度、低噪点、面部轮廓稳定，清晰呈现眼睛湿润、高光、眉毛边缘和唇部细节，避免恐怖夸张变脸' },
    { name: '警觉怀疑', en: '警觉怀疑的复杂微表情，一侧眉峰微微抬起，另一侧眉头轻皱，眼神快速扫视左右后重新聚焦，嘴唇轻抿，鼻翼轻动，头部仅有极小幅度转动。整体表情是察觉异常后的不安和理性判断并存，保持清晰稳定的脸部结构、自然眼球运动和真实眨眼，避免左右脸错位、眼睛抖动、过度疑惑表演' },
    { name: '震惊失语', en: '震惊到失语的微表情序列，嘴巴微张却没有发声，舌头和牙齿不夸张暴露；眼睛睁大，眉毛高抬后停住，眨眼减少，脸部血色像被抽离，表情停顿0.8秒。要求极清晰捕捉瞳孔、上眼睑、唇部开合边缘、鼻梁阴影，避免嘴巴畸形、牙齿混乱、表情冻结成假人' },
  ]},
  { group: '厌恶', color: 'emerald', icon: AlertCircle, items: [
    { name: '轻微嫌恶', en: '礼貌克制的轻微嫌恶，鼻梁短暂轻皱，上唇单侧微抬1到2毫米，眼神快速躲开又恢复，嘴角向下压，表情迅速收敛，仿佛被冒犯但仍保持社交礼仪。要求鼻翼、上唇、嘴角和眼神变化清晰可见，面部纹理稳定，避免夸张鬼脸、鼻子变形、嘴唇糊掉' },
    { name: '反感克制', en: '克制反感的高级表演，下眼睑微紧，鼻翼轻微收缩，嘴唇抿紧并变薄，头部轻微后撤，下巴略收，眼神保持距离感但不失礼貌。镜头清晰呈现眼下阴影、唇线、鼻翼褶皱、脸颊肌肉轻微收紧，动作幅度小但情绪明确，避免表情过度、脸部抽搐' },
    { name: '鄙夷一瞥', en: '短促鄙夷一瞥，视线从上到下快速扫过目标，单侧嘴角轻微上扬后立刻下压，下巴略抬，眼神冷淡，眉毛几乎不动，持续时间低于一秒。要求眼球运动自然、眼神方向明确、嘴角动作清晰且不夸张，保持面部对称稳定和高分辨率细节，避免斜眼变形' },
    { name: '厌倦疲惫', en: '长期忍耐后的厌倦疲惫，眼皮半垂，眨眼变慢，嘴角无力下坠，眉间出现浅纹，轻轻叹气后脸部肌肉松掉，眼神从对方身上移开。画面需要干净锐利，皮肤纹理真实，眼袋、鼻梁阴影、唇部干纹清晰，避免老化过度、脸部塌陷或表情空白' },
  ]},
  { group: '情绪转场', color: 'rose', icon: Film, items: [
    { name: '笑转悲', en: '复杂情绪转场：先保持礼貌微笑，嘴角微扬但眼睛逐渐失去笑意；随后眼神慢慢失焦，下眼睑泛红，嘴角缓慢下落，内眉抬起，笑容像被压碎一样在2秒内自然转为悲伤。要求转场连续、帧间无跳变，眼睛、嘴角、眉间、脸颊肌肉变化清楚，清晰稳定，避免表情突然切换' },
    { name: '怒转忍耐', en: '从怒意到忍耐的高级表情控制：眉头和下颌先明显紧绷，鼻翼扩张，眼神锐利；随后人物深吸一口气，眼神下移，嘴唇重新闭合，咬肌慢慢放松，怒意被压回，转为冷静忍耐。保持面部细节清晰、动作顺序合理、眼神焦点稳定，避免怒气突然消失' },
    { name: '惊转喜', en: '从意外到开心的顺滑微表情，先出现短暂睁眼和微张嘴，眉毛快速上扬；随后眼神变亮，脸颊逐渐抬起，眼尾出现细小笑纹，嘴角从迟疑到上扬，最终形成真实开心。要求0.8到1.5秒内完成自然转场，面部高清、五官稳定、眼睛不闪烁、嘴型不变形' },
    { name: '惧转坚定', en: '恐惧逐渐转为坚定，眼神先闪避，呼吸急促，下巴微收；随后视线重新聚焦，呼吸稳定，眉头从紧张皱起转为轻微下压，下巴抬起，嘴唇闭合成坚定线条。清晰捕捉瞳孔聚焦、眉头变化、唇线收紧和下颌稳定，避免英雄化夸张或表情断裂' },
  ]},
  { group: '表演控制', color: 'teal', icon: Camera, items: [
    { name: '电影特写', en: '85mm或100mm电影级人像特写，浅景深但眼睛、睫毛、眉毛、鼻梁、嘴唇和下颌线必须锐利清晰；焦点锁定最近一侧眼睛，保留真实皮肤纹理、毛孔、细小皱纹、唇纹和泪膜反射；微表情以毫米级肌肉变化呈现，不使用夸张卡通表演，背景柔化但脸部稳定，避免五官漂移、脸部融化、眼睛闪烁、动态模糊' },
    { name: '时序连贯', en: '面部表情按真实演员表演节奏变化：先出现眼神和呼吸变化，再带动眉毛、眼睑、鼻翼、嘴角和下颌；每个动作有起势、保持、回落，表情不能突然跳变；保持同一人物身份、面部比例、眼距、鼻型、嘴型和肤色一致，帧间连续稳定，无闪烁、无变脸、无面部漂移' },
    { name: '自然眨眼', en: '加入自然眨眼和微小眼球运动，眨眼有完整闭合与打开过程，频率真实，不要机械重复；眼神随情绪轻微漂移后重新聚焦，虹膜和瞳孔保持圆润稳定，眼白不过曝，睫毛和眼睑边缘清晰，避免死板凝视、斗鸡眼、眼球乱跳、眼睛变形和闪烁' },
    { name: '对白同步', en: '表情与对白节奏同步，发声前出现浅呼吸、嘴唇预备动作和下颌轻微打开；关键词处眉眼有细微反应，句尾嘴唇自然闭合，表情缓慢回落；唇形清晰但不过度夸张，牙齿整齐稳定，舌头不异常外露，保持面部高清、嘴型连贯、无口型撕裂' },
  ]},
  { group: '参数精控', color: 'purple', icon: Gauge, items: [
    { name: '泪速控制', en: '精准控制眼泪生成与流速：先在下眼睑形成薄薄泪膜，0.6秒后泪珠在内眼角聚集，1.2秒时第一颗泪珠缓慢越过下眼睑，沿脸颊以极慢速度向下滑动，泪痕细窄透明，不成片糊开；泪珠速度约每秒移动脸颊高度的8%到12%，不突然掉落，不喷涌，不夸张大哭；保持睫毛、泪膜高光、眼眶泛红和皮肤纹理清晰，泪水受重力自然流动，避免眼泪变成白线、水渍闪烁或脸部糊掉' },
    { name: '泪量分级', en: '将悲伤泪量控制为可分级表演：强度20%为眼眶湿润但不落泪；强度40%为下眼睑蓄泪，眼中水光明显；强度60%为一颗泪珠缓慢滑落；强度80%为双眼各有少量泪水但仍克制；禁止强度100%的崩溃大哭。表情必须保留克制、忍耐和真实呼吸，眼泪边缘清晰透明，脸部身份稳定，避免泪水过多、面部变形、眼睛融化' },
    { name: '微笑弧度', en: '精准控制嘴角微笑弧度：嘴角上扬幅度只控制在2到5毫米，弧度约5到12度，嘴唇保持闭合或微微分开，不露齿或仅露出极少牙齿；先由眼神变柔触发，再带动颧大肌轻微抬起，嘴角形成浅弧线，持续1秒后自然回落。左右嘴角可有1毫米以内不对称，增加真实感；避免咧嘴大笑、嘴角拉伸、唇形撕裂、牙齿畸形' },
    { name: '笑容强度', en: '将笑容强度参数化：10%为眼神柔和但嘴角几乎不动；25%为嘴角上扬2毫米的礼貌微笑；40%为脸颊轻微抬起、眼尾有浅笑纹；60%为自然开心但不过度露齿；禁止超过70%的夸张大笑。保持眼睛与嘴角同步，笑容由内而外逐渐形成，面部高清稳定，避免假笑、皮笑肉不笑、突然变脸' },
    { name: '表情时间轴', en: '使用明确时间轴控制微表情：0.0秒中性表情，0.3秒眼神先变化，0.6秒眉毛和下眼睑产生细微动作，0.9秒嘴角或唇部开始响应，1.2秒达到目标表情强度，1.8秒保持，2.4秒缓慢回落到克制状态。所有变化必须连续平滑，不能跳帧，不能突然切换表情，眼睛、嘴角、鼻翼、下颌动作按真实肌肉链路依次发生' },
    { name: '局部肌肉', en: '精确控制局部面部肌肉动作：内眉上提不超过3毫米，眉头收紧形成轻微纵纹；下眼睑收紧但不挤压眼球；鼻翼扩张幅度小于2毫米；嘴角上扬或下坠幅度控制在2到5毫米；下颌只轻微前顶或放松，不改变脸型。微表情只改变肌肉张力，不改变五官结构，保持面部拓扑和身份一致' },
  ]},
  { group: '头部特写', color: 'cyan', icon: Camera, items: [
    { name: '缓慢转头', en: '电影级头部特写，人物从三分之二侧脸缓慢转向镜头，转头幅度约25到35度，持续1.8到2.4秒；动作先由眼神轻微移动开始，再带动头部和下颌缓慢旋转，颈部肌肉自然牵动，耳朵、发际线、鼻梁透视随角度真实变化。转头过程中眼睛、嘴角、鼻翼和皮肤纹理保持清晰稳定，无脸部拉伸、五官漂移、轮廓融化、动态模糊' },
    { name: '回眸微表情', en: '人物背对或侧对镜头后轻微回眸，头部只转回15到25度，眼睛先看向镜头，随后眉毛和嘴角出现极细微情绪反应；发丝随转头轻轻移动，颈部线条自然，眼神带迟疑、克制或欲言又止。要求回眸过程帧间连续，虹膜高光稳定，睫毛和眼睑边缘清晰，避免突然转脸、五官错位、眼球乱跳' },
    { name: '自然眨眼特写', en: '超清晰眼部与头部特写，自然眨眼包含完整时间结构：上眼睑在0.08到0.12秒内下落，下眼睑轻微上提，闭合停留约0.05秒，再在0.12到0.18秒内自然睁开；眨眼后眼神重新聚焦，睫毛阴影和眼睑褶皱清晰可见。避免机械眨眼、半边眼不同步、眼皮穿模、眼球闪烁、眨眼时脸部变形' },
    { name: '含泪眨眼', en: '含泪状态下的细腻眨眼，眼眶湿润、下眼睑有泪膜，眨眼时泪膜被轻轻挤压形成更亮的水光，睁眼后内眼角出现小泪珠但不立刻滑落；眉尾轻微下压，嘴唇克制闭合。要求泪膜透明、睫毛湿润细节清晰，眨眼动作柔和连续，避免泪水变白线、眼部糊掉、眼睛大小突变' },
    { name: '低头抬眼', en: '人物头部微微低下但眼睛向上看，形成压抑、试探或隐忍的微表情；下巴向内收约5到10度，眉骨投下轻微阴影，上眼睑压低，瞳孔从下方缓慢抬起重新聚焦，嘴角保持紧绷。画面清晰捕捉眼神压力、鼻梁阴影、唇线和下颌轮廓，避免眼睛翻白、头部畸形、脸部阴影糊成一片' },
    { name: '侧脸垂眼', en: '侧脸或三分之二侧脸特写，人物视线缓慢垂下，眼睑下落，睫毛阴影覆盖下眼睑，鼻梁、嘴唇和下巴形成清晰侧面轮廓；嘴角轻微下坠，颈部放松，情绪表现为失落、沉思或回避。保持侧脸结构稳定、鼻尖和唇线锐利、皮肤纹理自然，避免侧脸塌陷、眼睛错位、鼻子变形' },
    { name: '眼神漂移', en: '控制细微眼神漂移而非大幅转头：头部保持基本静止，瞳孔先向左下方漂移0.4秒，再短暂停留，随后缓慢回到对焦点；眼睑和眉毛只有极小反应，嘴唇保持克制。适合犹豫、撒谎、回忆、心虚等情绪。要求虹膜圆润稳定、眼白不过曝、双眼运动同步，避免斗鸡眼、眼球震颤、视线方向混乱' },
    { name: '呼吸带动头动', en: '头部特写中加入真实呼吸带动的微动作：吸气时鼻翼轻微扩张，胸颈微动，头部上抬1到2毫米；呼气时下颌放松，头部极轻微下沉，嘴唇边缘微动。动作幅度非常小但连续真实，配合微表情增强生命感。保持面部高清、颈部和下颌线稳定，避免头部漂浮、节奏抽搐、呼吸动作过大' },
  ]},
  { group: '五官风格', color: 'fuchsia', icon: Palette, items: [
    { name: '女性电影自然脸', en: '极高清女性电影自然脸特写，五官真实不网红化：眼睛清澈有稳定虹膜高光，双眼皮或自然眼褶细节清晰，眉毛毛流分明，鼻梁柔和立体，鼻翼边缘干净，嘴唇有真实唇纹和自然血色，脸颊保留毛孔、细小绒毛和轻微肤色变化；整体气质自然、克制、真实演员感，避免塑料皮肤、过度磨皮、五官模板化' },
    { name: '女性清冷高级脸', en: '高清清冷高级女性五官，眼型偏长且眼神克制，眉峰利落但不过分锐利，鼻梁线条清晰，鼻尖小而自然，唇形薄厚适中、唇峰明确，下颌线干净，颧骨轻微立体；光线突出眼窝、鼻梁、唇线和脸部骨相，皮肤细腻但保留真实纹理，避免过度美颜、脸部扁平、眼睛无神' },
    { name: '女性甜美柔和脸', en: '极清晰甜美柔和女性五官，圆润明亮的眼睛，眼尾柔和，下眼睑卧蚕自然不过度，眉毛柔顺，鼻梁轻巧，鼻尖圆润，嘴角天然微微上扬，唇部水润但不过曝；脸颊有自然红润和细腻毛孔，整体亲和温暖，保持真实皮肤质感，避免幼态过度、卡通化、大眼畸形' },
    { name: '女性英气利落脸', en: '高清英气女性面部特写，眉形清晰有力量，眼神坚定，眼裂比例自然，鼻梁挺直，鼻翼收束干净，唇线利落，下巴和下颌线更明确；肤质真实，眼窝阴影、眉骨、鼻梁和嘴角细节锐利，整体有中性力量感和专业感，避免男性化过度、脸部僵硬或五官过锐' },
    { name: '女性复古港风脸', en: '电影级复古港风女性五官，浓密自然眉毛，眼神湿润有故事感，眼线感轻微但真实，鼻梁柔和立体，红润饱满唇形带清晰唇纹，脸颊有自然光泽和胶片质感；五官清晰但不过度锐化，情绪含蓄，适合近景微表情，避免滤镜过重、磨皮、五官漂移' },
    { name: '女性东方古典脸', en: '高清东方古典女性面部，眉眼舒展含蓄，眼型细长柔和，鼻梁自然，唇形小巧但唇线清楚，脸部轮廓流畅，颧骨与下颌过渡温和；皮肤真实细腻，保留毛孔和轻微肌理，表情克制优雅，光影突出眉眼和鼻梁层次，避免古装塑料脸、过白肤色、五官失真' },
    { name: '女性欧美立体脸', en: '极高清欧美立体女性五官，深眼窝、清晰眉骨、高鼻梁、明确唇峰和下颌线，眼睛高光稳定，睫毛与眉毛根根分明，鼻翼和唇部纹理清晰；皮肤有真实雀斑、毛孔或细微纹理，整体时尚电影感，避免过度锐化、皮肤蜡像感、五官比例夸张' },
    { name: '女性冷艳反派脸', en: '高清冷艳女性反派气质五官，眼神锐利但不夸张，眉峰轻压，眼尾略有攻击性，鼻梁挺直，唇色偏冷、唇线清晰，单侧嘴角可有极轻微弧度；脸部轮廓稳定，肤质真实，光影强化眼窝和下颌线，适合冷怒、轻蔑微表情，避免邪笑过度、脸部扭曲' },
    { name: '女性哭戏特写脸', en: '女性哭戏高清五官控制，眼眶泛红、泪膜透明，下眼睑和内眼角水光清晰，眉尾轻微下坠，鼻翼轻颤，嘴唇闭合或轻微颤动，唇纹保持清楚；皮肤纹理、睫毛湿润、泪痕和脸颊细节稳定，情绪脆弱但克制，避免眼泪糊脸、哭到五官崩坏' },
    { name: '女性微笑特写脸', en: '女性微笑高清五官控制，眼神先变柔，眼尾出现极浅笑纹，脸颊轻微抬起，嘴角上扬2到5毫米，唇线保持清楚，牙齿不夸张暴露；皮肤毛孔、睫毛、鼻翼、法令纹细节清晰，笑容自然可信，避免假笑、嘴角拉伸、过度甜腻' },
    { name: '男性电影自然脸', en: '极高清男性电影自然脸特写，五官真实有生活感：眉毛毛流清晰，眼神稳定有层次，鼻梁和鼻翼结构明确，嘴唇纹理真实，下颌线和胡茬细节可见，皮肤保留毛孔、细纹和轻微瑕疵；整体像真实演员近景，避免塑料皮肤、过度磨皮、网红化和五官漂移' },
    { name: '男性硬朗成熟脸', en: '高清硬朗成熟男性五官，眉骨和眼窝立体，眼神沉稳，鼻梁挺直，鼻翼厚度自然，嘴唇线条克制，下颌线清晰，咬肌和颈部线条有轻微张力；皮肤质感真实，可见胡茬、毛孔、细纹，适合压抑愤怒或沉默凝视，避免肌肉夸张、脸部过度硬化' },
    { name: '男性温柔干净脸', en: '高清温柔干净男性五官，眼神柔和清澈，眉毛自然，鼻梁干净，嘴角有浅淡亲和弧度，唇色自然，下颌线不锋利但结构稳定；皮肤清爽真实，毛孔轻微可见，光线柔和，适合释然、微笑、关怀情绪，避免过度女性化、磨皮和眼睛无神' },
    { name: '男性少年感清爽脸', en: '极清晰少年感男性面部，眼睛明亮，眼神直接但不幼态，眉形自然，鼻梁轻巧，嘴唇线条清楚，脸部轮廓干净，皮肤有真实细小毛孔和自然光泽；表情可轻松、惊喜或羞涩，保持真实年龄感，避免卡通化、大眼畸形、皮肤塑料感' },
    { name: '男性冷峻精英脸', en: '高清冷峻精英男性五官，眼神克制锐利，眉峰低压，鼻梁笔直，唇线薄而清晰，下颌线利落，脸部骨相明确；光影强调眼窝、鼻梁、颧骨和下巴结构，表情适合冷怒、判断、克制，避免过度阴沉、五官僵硬或反派脸谱化' },
    { name: '男性沧桑故事脸', en: '电影级沧桑男性脸部特写，眼角细纹、法令纹、胡茬、皮肤纹理和轻微疲惫感清晰可见，眼神有经历感，鼻梁和嘴唇真实不过度修饰，下颌线稳定；适合沉默、悲伤、释然和回忆情绪，避免老化过度、脸部脏乱或低清噪点' },
    { name: '男性古风侠客脸', en: '高清古风侠客男性五官，剑眉清晰，眼神坚定克制，鼻梁挺直，唇线干净，下颌线有力量但不过度夸张，发际线和鬓角稳定；皮肤保留真实纹理，光影有古典电影质感，适合回眸、凝视、压抑怒意，避免网游脸、塑料古装脸和五官漂移' },
    { name: '男性欧美硬派脸', en: '极高清欧美硬派男性五官，深眼窝、浓眉、高鼻梁、清晰颧骨和下颌线，胡茬、皮肤毛孔、唇纹和眼角纹理清楚；眼神沉稳有压迫感，适合动作片或悬疑片近景，避免过度肌肉化、皮肤蜡像、牙齿畸形和脸部闪烁' },
    { name: '男性哭戏克制脸', en: '男性克制哭戏高清五官，眼眶微红，泪膜在下眼睑聚集但不夸张落下，眉间收紧，嘴唇压住轻颤，下颌咬紧后缓慢放松；胡茬、皮肤纹理、眼部水光和鼻翼轻颤清晰稳定，情绪强烈但不崩溃，避免大哭变形和眼泪糊脸' },
    { name: '男性微笑释然脸', en: '男性释然微笑高清五官，眼神从紧绷变柔，眉间压力释放，嘴角上扬2到4毫米，脸颊轻微牵动但不露齿或少量露齿，下颌放松，呼气自然；皮肤纹理、胡茬、唇线、眼角细纹清晰，笑容真实克制，避免假笑、嘴巴拉伸、脸部身份漂移' },
  ]},
  { group: '清晰稳定', color: 'blue', icon: Sparkles, items: [
    { name: '面部高清', en: '极致清晰的人物面部生成控制，4K电影级面部细节，眼睛、眉毛、睫毛、鼻翼、嘴唇、牙齿、下颌线全部保持锐利；真实皮肤纹理、毛孔、细小绒毛、唇纹、眼角细纹和泪膜高光可见；脸部不糊、不变形、不融化，左右眼大小稳定，眼距一致，鼻型和嘴型全程一致，避免低清晰度、动态模糊、压缩痕迹、塑料皮肤' },
    { name: '五官锁定', en: '锁定同一角色五官身份与面部拓扑，整个视频中脸型、眼距、眉形、鼻梁、鼻翼、嘴唇厚度、牙齿排列、下巴和发际线保持一致；微表情只改变肌肉张力和细节表情，不改变身份结构；保持脸部边缘稳定、眼球稳定、口型稳定，避免变脸、五官漂移、眼睛忽大忽小、嘴巴错位' },
    { name: '抗闪烁', en: '视频面部抗闪烁控制，帧间光照、肤色、眼睛高光、牙齿亮度、嘴唇颜色保持连续；眨眼、嘴角、眉毛、鼻翼动作平滑过渡，无突然跳帧、无眼部闪烁、无脸部纹理闪烁、无皮肤噪点跳动；运动中仍保持面部清晰，微表情细节不被模糊吞掉' },
    { name: '负面约束', en: '避免面部模糊、低清、五官扭曲、脸部崩坏、眼睛错位、瞳孔变形、斗鸡眼、斜视、眼球闪烁、嘴巴撕裂、牙齿畸形、多排牙齿、唇形错乱、鼻子变形、下颌断裂、皮肤融化、塑料脸、表情僵硬、过度夸张、卡通化、身份漂移、帧间闪烁、动态模糊、压缩噪点' },
  ]},
];

const MICRO_EXPRESSION_VARIANTS = [
  { name: '电影近景', en: '镜头为85mm电影近景，焦点锁定最近一侧眼睛，浅景深但面部五官锐利，捕捉皮肤纹理、睫毛、唇纹、眼角细纹和细小肌肉牵动；表情幅度控制在真实演员微表演范围内，避免夸张、卡通化、五官漂移' },
  { name: '极近特写', en: '极近面部特写，只保留额头到下颌区域，眼睛、眉毛、鼻翼、嘴角和下颌线必须清晰，微表情以毫米级变化呈现，背景完全虚化，帧间脸部结构稳定，避免动态模糊和脸部融化' },
  { name: '眼神优先', en: '情绪先从眼神开始：瞳孔聚焦变化、眼睑张力、下眼睑水光、眨眼延迟先出现，再带动眉毛和嘴角；双眼运动同步，虹膜高光稳定，避免斗鸡眼、眼球闪烁和视线方向混乱' },
  { name: '嘴角精控', en: '嘴角动作精确控制在2到5毫米范围内，嘴唇闭合或轻微分开，唇线清晰，左右嘴角可有1毫米以内自然不对称；嘴角变化必须由面部肌肉牵动自然产生，避免嘴型撕裂、牙齿畸形和夸张咧嘴' },
  { name: '泪膜细节', en: '眼眶湿润但克制，下眼睑形成透明泪膜，内眼角有微小水光；若出现泪珠，需缓慢聚集并沿脸颊自然下滑，泪痕细窄透明，避免泪水喷涌、白线化、糊脸或水渍闪烁' },
  { name: '头部微动', en: '加入极小头部微动作：下巴内收或上抬5度以内，头部转动不超过15度，动作先由视线牵引再带动颈部和下颌，呼吸造成1到2毫米轻微起伏，避免头部漂浮、突然转脸和五官错位' },
  { name: '侧脸轮廓', en: '三分之二侧脸或侧脸构图，鼻梁、鼻尖、唇线、下巴和颈部线条清晰，眼神从侧向缓慢移动；侧脸透视真实，发际线和耳朵位置稳定，避免侧脸塌陷、鼻子变形和眼睛错位' },
  { name: '眨眼时序', en: '自然眨眼具有完整闭合与打开过程，上眼睑快速下落、短暂停留、再自然睁开，眨眼后眼神重新聚焦；睫毛阴影和眼睑褶皱清晰，避免机械眨眼、左右眼不同步和眼皮穿模' },
  { name: '呼吸表演', en: '表情与呼吸同步：吸气时鼻翼轻微扩张、眼神短暂停顿、下颌微紧；呼气时嘴唇边缘放松、肩颈微降、情绪缓慢回落，动作幅度小且连续，避免抽搐和节奏跳变' },
  { name: '时间轴控制', en: '使用清晰时间轴：0.0秒中性，0.3秒眼神变化，0.6秒眉眼响应，0.9秒嘴角或鼻翼变化，1.2秒达到目标强度，1.8秒保持，2.4秒回落；全过程平滑连续，避免表情突然切换' },
  { name: '低强度克制', en: '表情强度控制在20%到35%，情绪只通过眼神、下眼睑、眉间、嘴角和呼吸细节泄露，不出现大哭、大笑、怒吼或惊叫；保持高级克制表演，适合真实电影角色' },
  { name: '中强度显性', en: '表情强度控制在45%到60%，观众能明确读出情绪，但仍保持真实自然；眉眼、嘴角、鼻翼和下颌动作协同，脸部肌肉有张力但不夸张，避免表演过火' },
  { name: '微肌肉链路', en: '遵循真实面部肌肉链路：眼神与呼吸先变化，随后眼轮匝肌、皱眉肌、颧大肌、鼻翼、口轮匝肌和下颌肌肉依次响应；每个动作有起势、保持、回落，避免单个五官孤立乱动' },
  { name: '对白前反应', en: '适合说话前一瞬间：先浅吸气，嘴唇轻轻预备打开，下颌下降1到2毫米，眼神短暂聚焦，关键词前眉眼有细微反应；口型清晰但不夸张，牙齿稳定，避免口型撕裂' },
  { name: '静默凝视', en: '人物保持静默凝视，头部基本不动，只通过瞳孔微动、眼睑张力、嘴角细小变化和下颌肌肉表达情绪；画面强调眼神压力和面部细节，避免死板假人感和眼睛无神' },
  { name: '回避视线', en: '视线先短暂接触目标，然后向左下或右下缓慢回避0.4到0.8秒，再犹豫地重新聚焦；眉尾、下眼睑和嘴角产生细微连锁反应，适合心虚、羞怯、悲伤和隐忍' },
  { name: '情绪压回', en: '目标情绪刚出现就被人物压回：眼神先泄露真实情绪，嘴角或眉毛刚开始变化便被强行收住，下颌轻微咬紧，呼吸变浅；保留压抑痕迹，避免情绪完全消失或突然跳变' },
  { name: '面部稳定', en: '锁定同一角色身份，脸型、眼距、鼻型、嘴唇厚度、牙齿排列、下巴、发际线和肤色全程一致；微表情只改变肌肉张力，不改变五官结构，避免变脸、五官漂移和面部拓扑崩坏' },
  { name: '抗闪烁高清', en: '帧间光照、肤色、眼睛高光、牙齿亮度、嘴唇颜色保持连续，面部纹理不闪烁；运动中仍保持眼睛、睫毛、嘴角、鼻翼和下颌线清晰，避免压缩噪点、动态模糊和皮肤跳动' },
  { name: '负面约束', en: '严格避免脸部模糊、五官扭曲、眼睛错位、瞳孔变形、斗鸡眼、眼球闪烁、嘴巴撕裂、牙齿畸形、鼻子变形、皮肤融化、塑料脸、表情僵硬、身份漂移、跳帧和动态模糊' },
];

const expandMicroExpressionCombos = (groups: typeof MICRO_EXPRESSION_BASE_COMBOS) => groups.map(group => ({
  ...group,
  items: MICRO_EXPRESSION_VARIANTS.map((variant, index) => {
    const base = group.items[index % group.items.length];
    return {
      name: `${base.name} · ${variant.name}`,
      en: `${base.en}；${variant.en}`,
    };
  }),
}));

const MICRO_EXPRESSION_COMBOS = expandMicroExpressionCombos(MICRO_EXPRESSION_BASE_COMBOS);

const NEGATIVE_PRESETS = [
  { label: '通用', value: '模糊, 低清, 变形, 崩坏, 最差画质, 水印, 文字' },
  { label: '人物', value: '变形, 多余肢体, 手指异常, 面部崩坏, 闭眼, 丑陋' },
  { label: '风景', value: '模糊, 噪点, 过曝, 色偏, 变形, 水印' },
  { label: '视频', value: '卡顿, 闪烁, 变形, 模糊, 静态, 水印, 字幕' },
];

const OPTIMIZE_MODELS = PROMPT_OPTIMIZER_MODELS;
const HIDDEN_OPTIMIZE_MODEL_IDS = new Set<string>();
const VISIBLE_OPTIMIZE_MODELS = OPTIMIZE_MODELS.filter((model) => !HIDDEN_OPTIMIZE_MODEL_IDS.has(model.id));
type OptimizeModelId = PromptOptimizerModelId;

// 扩展的本地节点数据类型（包含运行时字段）
interface PromptNodeRuntimeData extends PromptNodeData {
  promptType?: 'image' | 'video';
  optimizeModel?: OptimizeModelId;
}

const MAX_PROMPT_LENGTH = 2000;
const PROMPT_NODE_WIDTH = 620;

type CategoryFilter = 'all' | string;

const PromptNode = memo(({ data, selected, id }: NodeProps) => {
  const nodeData = data as unknown as PromptNodeRuntimeData;

  const updateNodeData = canvasStoreApi.updateNodeData;
  const { permissions } = usePermission();
  const isExpanded = nodeData.isExpanded ?? true;
  const { controlsCollapsed, onPreviewDoubleClick } = useNodeControllerCollapse(id as string, {
    isControllerCollapsed: (nodeData as { isControllerCollapsed?: boolean }).isControllerCollapsed,
  });
  const [localPrompt, setLocalPrompt] = useState(nodeData.prompt || '');
  const [localNegativePrompt, setLocalNegativePrompt] = useState(nodeData.negativePrompt || '');
  const [isNegExpanded, setIsNegExpanded] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showTemplateLib, setShowTemplateLib] = useState(false);
  const [showMicroExpressionLib, setShowMicroExpressionLib] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [microExpressionSearch, setMicroExpressionSearch] = useState('');
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<Array<{ name: string; en: string }>>([]);
  const [selectedMicroExpressions, setSelectedMicroExpressions] = useState<Array<{ name: string; en: string }>>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [activeMicroExpressionCategory, setActiveMicroExpressionCategory] = useState<string>('all');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<{ name: string; en: string; group: string }[]>([]);
  const [isTextareaExpanded, setIsTextareaExpanded] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [, setIsNegComposing] = useState(false);
  const [showNegPresets, setShowNegPresets] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedModel, setSelectedModel] = useState<OptimizeModelId>(nodeData.optimizeModel || DEFAULT_PROMPT_TEXT_MODEL_ID);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiSearchLockRef = useRef(false);

  const {
    slashOpen,
    slashCommands,
    onTextChange: onSlashTextChange,
    applySlashCommand,
  } = useAICGSlashConnect(id as string, 'prompt', 'promptOutput');

  // 同步外部更新（连线传入、脚本节点等）
  useEffect(() => {
    if (nodeData.prompt !== undefined && nodeData.prompt !== localPrompt) {
      setLocalPrompt(nodeData.prompt);
    }
    if (nodeData.negativePrompt !== undefined && nodeData.negativePrompt !== localNegativePrompt) {
      setLocalNegativePrompt(nodeData.negativePrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeData.prompt, nodeData.negativePrompt]);

  // 同步 optimizeModel
  useEffect(() => {
    if (nodeData.optimizeModel && nodeData.optimizeModel !== selectedModel) {
      setSelectedModel(nodeData.optimizeModel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeData.optimizeModel]);

  useEffect(() => {
    return () => { aiSearchLockRef.current = false; };
  }, []);

  const promptType = nodeData.promptType || 'video';
  const combos = promptType === 'video' ? VIDEO_COMBOS : IMAGE_COMBOS;

  const allItems = useMemo(() => {
    const items: { name: string; en: string; group: string; color: string; Icon: React.ComponentType<{ className?: string }> }[] = [];
    combos.forEach(g => {
      g.items.forEach(item => {
        items.push({ ...item, group: g.group, color: g.color, Icon: g.icon });
      });
    });
    return items;
  }, [combos]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    combos.forEach(g => cats.add(g.group));
    return ['all', ...Array.from(cats)] as CategoryFilter[];
  }, [combos]);

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (activeCategory !== 'all') {
      items = items.filter(i => i.group === activeCategory);
    }
    if (templateSearch.trim()) {
      const q = templateSearch.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.en.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q)
      );
    }
    return items;
  }, [allItems, activeCategory, templateSearch]);

  const microExpressionCategories = useMemo(() => ['all', ...MICRO_EXPRESSION_COMBOS.map(g => g.group)], []);
  const filteredMicroExpressionGroups = useMemo(() => {
    const q = microExpressionSearch.trim().toLowerCase();
    return MICRO_EXPRESSION_COMBOS
      .filter(group => activeMicroExpressionCategory === 'all' || group.group === activeMicroExpressionCategory)
      .map(group => ({
        ...group,
        items: q
          ? group.items.filter(item =>
              item.name.toLowerCase().includes(q) ||
              item.en.toLowerCase().includes(q) ||
              group.group.toLowerCase().includes(q)
            )
          : group.items,
      }))
      .filter(group => group.items.length > 0);
  }, [activeMicroExpressionCategory, microExpressionSearch]);


  const handlePromptCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    const value = (e.target as HTMLTextAreaElement).value;
    setLocalPrompt(value);
    updateNodeData(id, { prompt: value });
  };

  const handleNegativePromptInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalNegativePrompt(value);
  };

  const handleNegCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsNegComposing(false);
    const value = (e.target as HTMLTextAreaElement).value;
    setLocalNegativePrompt(value);
    updateNodeData(id, { negativePrompt: value });
  };

  const handleDelete = () => {
    useCanvasStore.getState().deleteNode(id);
    nodeEventBus.emitNodeDeleted(id as string);
  };

  const rebuildPromptFromSelections = (
    nextTemplates: Array<{ name: string; en: string }>,
    nextMicroExpressions: Array<{ name: string; en: string }>,
  ) => {
    const rebuilt = [...nextTemplates, ...nextMicroExpressions].map(t => t.en).join('，');
    setLocalPrompt(rebuilt);
    updateNodeData(id, { prompt: rebuilt });
  };

  const handleTemplateSelect = (name: string, en: string) => {
    const existingIndex = selectedTemplates.findIndex(t => t.name === name && t.en === en);
    if (existingIndex >= 0) {
      const newSelected = selectedTemplates.filter((_, i) => i !== existingIndex);
      setSelectedTemplates(newSelected);
      rebuildPromptFromSelections(newSelected, selectedMicroExpressions);
    } else {
      if (selectedTemplates.length >= 6) {
        toast.error('最多只能选择 6 个模板片段');
        return;
      }
      const newSelected = [...selectedTemplates, { name, en }];
      setSelectedTemplates(newSelected);
      rebuildPromptFromSelections(newSelected, selectedMicroExpressions);
    }
  };

  const handleMicroExpressionSelect = (name: string, en: string) => {
    const existingIndex = selectedMicroExpressions.findIndex(t => t.name === name && t.en === en);
    if (existingIndex >= 0) {
      const newSelected = selectedMicroExpressions.filter((_, i) => i !== existingIndex);
      setSelectedMicroExpressions(newSelected);
      rebuildPromptFromSelections(selectedTemplates, newSelected);
    } else {
      if (selectedMicroExpressions.length >= 6) {
        toast.error('最多只能选择 6 个微表情片段');
        return;
      }
      const newSelected = [...selectedMicroExpressions, { name, en }];
      setSelectedMicroExpressions(newSelected);
      rebuildPromptFromSelections(selectedTemplates, newSelected);
    }
  };

  const handleAiSearch = useCallback(async () => {
    if (!templateSearch.trim() || isAiSearching || aiSearchLockRef.current) return;
    aiSearchLockRef.current = true;
    setIsAiSearching(true);
    setAiResults([]);
    try {
      const agentCategory = classifyPromptAgent(templateSearch, promptType);
      const result = await promptOptimizerService.optimizePrompt(
        `根据关键词"${templateSearch}"，生成4个专业的${promptType === 'video' ? '视频' : '图片'}创作提示词片段。每个片段用逗号分隔，只返回中文提示词，不要编号和解释。`,
        promptType, agentCategory
      );
      if (result.success && result.optimizedPrompt) {
        const fragments = result.optimizedPrompt
          .split(/[，,。\n]/)
          .map(s => s.trim().replace(/^\d+[.、)\]]\s*/, ''))
          .filter(s => s.length > 4 && s.length < 80);
        setAiResults(fragments.map(f => ({ name: f.substring(0, 6), en: f, group: 'AI推荐' })));
      } else if (result.error) {
        toast.error('AI搜索失败: ' + result.error);
      }
    } catch (error) {
      console.error('[PromptNode] AI搜索失败:', error);
    } finally {
      setIsAiSearching(false);
      setTimeout(() => { aiSearchLockRef.current = false; }, 2000);
    }
  }, [templateSearch, promptType, selectedModel, isAiSearching]);

  const handleOptimize = useCallback(async () => {
    if (!localPrompt.trim() || isOptimizing) return;
    const quota = await checkQuotaOrFail('prompt', permissions);
    if (!quota.allowed) {
      toast.error(quota.message);
      return;
    }
    setIsOptimizing(true);
    try {
      const agentCategory = classifyPromptAgent(localPrompt, promptType);
      const result = await promptOptimizerService.optimizePrompt(
        localPrompt, promptType, agentCategory
      );
      if (result.success && result.optimizedPrompt) {
        setLocalPrompt(result.optimizedPrompt);
        setSelectedTemplates([]);
        setSelectedMicroExpressions([]);
        updateNodeData(id, {
          prompt: result.optimizedPrompt,
          optimized: true,
        });
        toast.success('提示词已增强优化', {
          description: `使用模型: ${OPTIMIZE_MODELS.find(m => m.id === selectedModel)?.model || selectedModel}`,
        });
      } else {
        toast.error(result.error || '优化失败，请重试');
      }
    } catch (error) {
      console.error('[PromptNode] 优化失败:', error);
      toast.error('优化请求失败，请检查网络后重试');
    } finally {
      setIsOptimizing(false);
    }
  }, [localPrompt, promptType, selectedModel, isOptimizing, permissions, id, updateNodeData]);

  const qualityAnalysis = useMemo(() => {
    if (!localPrompt.trim() || localPrompt.trim().length < 5) return null;
    return promptQualityAnalyzer.analyze(localPrompt);
  }, [localPrompt]);

  const promptScore = qualityAnalysis?.metrics.score ?? 0;
  const [showQualitySuggestions, setShowQualitySuggestions] = useState(false);

  const scoreColor = promptScore > 0 ? 'text-white/82' : 'text-white/30';
  const scoreBarColor = promptScore >= 75 ? 'bg-white/78' : promptScore >= 60 ? 'bg-white/62' : promptScore >= 40 ? 'bg-white/45' : 'bg-red-500/75';
  const charWarning = localPrompt.length > MAX_PROMPT_LENGTH * 0.9;
  const selectedModelInfo = OPTIMIZE_MODELS.find(m => m.id === selectedModel);
  const quotaBadge = getQuotaBadge('prompt', permissions);
  const promptTarget = promptType === 'video'
    ? { label: '视频', Icon: Video, accent: 'rose', subtitle: '镜头 / 节奏 / 运动' }
    : { label: '图片', Icon: Camera, accent: 'violet', subtitle: '构图 / 光影 / 风格' };
  const TargetIcon = promptTarget.Icon;
  const promptStats = [
    { label: '质量', value: promptScore > 0 ? `${promptScore}` : '--', tone: scoreColor },
    { label: '片段', value: `${selectedTemplates.length}/6`, tone: selectedTemplates.length > 0 ? 'text-white/78' : 'text-white/35' },
    { label: '字符', value: `${localPrompt.length}`, tone: charWarning ? 'text-white/78' : 'text-white/45' },
  ];

  return (    <div className="group relative">
      <NodeResizer
        color="#ffffff"
        handleClassName={AICG_HANDLE_CLASS}
        lineClassName="!hidden"
        minWidth={580}
        minHeight={240}
        isVisible={selected as boolean}
      />

      {/* 模板库弹出面板 */}
      {showTemplateLib && (
        <div
          className="nodrag nowheel absolute left-0 top-[calc(100%+10px)] z-[9997] overflow-hidden rounded-[18px] border border-white/[0.1] bg-[#0d0d0d] shadow-[0_24px_70px_rgba(0,0,0,0.72)] backdrop-blur-2xl"
          style={{ width: `${PROMPT_NODE_WIDTH}px`, maxHeight: '540px' }}
        >
          <div className="border-b border-white/[0.06] bg-white/[0.025] px-3.5 py-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-white/72">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12px] font-semibold text-white/92">提示词资产库</span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-semibold text-white/42">
                      {promptTarget.label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[9px] text-white/35">
                    搜索、组合和生成专业提示词片段
                  </p>
                </div>
                {selectedTemplates.length > 0 && (
                  <span className="rounded-full border border-white/12 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-white/72">
                    {selectedTemplates.length}/6
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {selectedTemplates.length > 0 && (
                  <button
                    onClick={() => { setSelectedTemplates([]); }}
                    className="rounded-md px-2 py-1 text-[9px] font-medium text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/75"
                  >
                    清空
                  </button>
                )}
                <button onClick={() => setShowTemplateLib(false)} className="rounded-lg p-1.5 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white">
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAiSearch(); }}
                  placeholder="搜索片段，回车触发 AI 推荐"
                  className="h-8 w-full rounded-xl border border-white/[0.07] bg-black/35 pl-8 pr-2.5 text-[11px] text-white/82 outline-none transition-all placeholder:text-white/25 focus:border-white/28 focus:bg-black/45"
                />
              </div>
              <button
                onClick={handleAiSearch}
                disabled={isAiSearching || !templateSearch.trim()}
                className={cn(
                  'flex h-8 min-w-8 items-center justify-center rounded-xl border px-2.5 text-[10px] font-semibold transition-all',
                  isAiSearching || !templateSearch.trim()
                    ? 'border-white/[0.06] bg-white/[0.035] text-white/24'
                    : 'border-white/18 bg-white/[0.08] text-white hover:border-white/30 hover:bg-white/[0.12]'
                )}
                title="AI 推荐片段"
              >
                {isAiSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="max-h-[408px] overflow-y-auto px-3 py-3 custom-scrollbar">
            {aiResults.length > 0 && (
              <div className="mb-3 rounded-2xl border border-white/[0.1] bg-white/[0.035] p-2.5">
                <div className="mb-2 flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-white/72" />
                  <span className="text-[10px] font-semibold text-white/82">AI 推荐</span>
                  <div className="h-px flex-1 bg-white/[0.08]" />
                </div>
                <div className="grid gap-1.5">
                  {aiResults.map((item, i) => (
                    <button
                      key={`ai-${i}`}
                      onClick={() => handleTemplateSelect(item.name, item.en)}
                      className="rounded-xl border border-white/[0.08] bg-black/18 px-2.5 py-2 text-left text-[10px] leading-relaxed text-white/76 transition-all hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white"
                    >
                      {item.en}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="sticky top-0 z-10 -mx-3 mb-3 border-b border-white/[0.05] bg-[#0d0d0d] px-3 pb-2 backdrop-blur-xl">
              <div className="flex gap-1 overflow-x-auto pb-[3px] scrollbar-none">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-semibold transition-all',
                      activeCategory === cat
                        ? 'border-white/24 bg-white/[0.08] text-white'
                        : 'border-white/[0.06] bg-white/[0.025] text-white/36 hover:border-white/[0.1] hover:text-white/68'
                    )}
                  >
                    {cat === 'all' ? '全部' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {activeCategory === 'all' ? (
                combos.map(group => (
                  <div key={group.group} className="rounded-2xl border border-white/[0.055] bg-white/[0.025] p-2.5">
                    <div className="mb-2 flex items-center gap-1.5">
                      <group.icon className="h-3.5 w-3.5 text-white/42" />
                      <span className="text-[10px] font-semibold text-white/62">{group.group}</span>
                      <div className="h-px flex-1 bg-white/[0.055]" />
                      <span className="text-[8px] text-white/24">{group.items.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map(item => {
                        const isSelected = selectedTemplates.some(t => t.name === item.name && t.en === item.en);
                        return (
                          <button
                            key={item.name}
                            onClick={() => handleTemplateSelect(item.name, item.en)}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-medium transition-all',
                              isSelected
                                ? 'border-white/24 bg-white/[0.08] text-white'
                                : 'border-white/[0.06] bg-black/18 text-white/58 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/86'
                            )}
                          >
                            {isSelected ? <Check className="h-2.5 w-2.5" /> : <span className="text-white/25">+</span>}
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {filteredItems.map(item => {
                    const isSelected = selectedTemplates.some(t => t.name === item.name && t.en === item.en);
                    return (
                      <button
                        key={item.name}
                        onClick={() => handleTemplateSelect(item.name, item.en)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[9px] font-medium transition-all',
                          isSelected
                            ? 'border-white/24 bg-white/[0.08] text-white'
                            : 'border-white/[0.06] bg-white/[0.03] text-white/62 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white'
                        )}
                      >
                        {isSelected ? <Check className="h-2.5 w-2.5" /> : <span className="text-white/25">+</span>}
                        {item.name}
                      </button>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <div className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.025] py-7 text-center text-[10px] text-white/32">
                      未找到匹配片段，可以使用 AI 推荐生成
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showMicroExpressionLib && promptType === 'video' && (
        <div
          className="nodrag nowheel absolute left-0 top-[calc(100%+10px)] z-[9998] overflow-hidden rounded-[18px] border border-white/[0.1] bg-[#0d0d0d] shadow-[0_24px_70px_rgba(0,0,0,0.72)] backdrop-blur-2xl"
          style={{ width: `${PROMPT_NODE_WIDTH}px`, maxHeight: '560px' }}
        >
          <div className="border-b border-white/[0.06] bg-white/[0.025] px-3.5 py-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-white/72">
                  <Smile className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12px] font-semibold text-white/92">视频微表情库</span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-semibold text-white/42">
                      影视表演
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[9px] text-white/35">
                    人物微表情、喜怒哀乐、情绪转场和对白同步
                  </p>
                </div>
                {selectedMicroExpressions.length > 0 && (
                  <span className="rounded-full border border-white/12 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-white/72">
                    {selectedMicroExpressions.length}/6
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {selectedMicroExpressions.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedMicroExpressions([]);
                      rebuildPromptFromSelections(selectedTemplates, []);
                    }}
                    className="rounded-md px-2 py-1 text-[9px] font-medium text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/75"
                  >
                    清空
                  </button>
                )}
                <button onClick={() => setShowMicroExpressionLib(false)} className="rounded-lg p-1.5 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white">
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
              <input
                type="text"
                value={microExpressionSearch}
                onChange={(e) => setMicroExpressionSearch(e.target.value)}
                placeholder="搜索：微笑、愤怒、泪意、惊惧、转场、眨眼..."
                className="h-8 w-full rounded-xl border border-white/[0.07] bg-black/35 pl-8 pr-2.5 text-[11px] text-white/82 outline-none transition-all placeholder:text-white/25 focus:border-white/28 focus:bg-black/45"
              />
            </div>
          </div>
          <div className="max-h-[428px] overflow-y-auto px-3 py-3 custom-scrollbar">
            <div className="sticky top-0 z-10 -mx-3 mb-3 border-b border-white/[0.05] bg-[#0d0d0d] px-3 pb-2 backdrop-blur-xl">
              <div className="flex gap-1 overflow-x-auto scrollbar-none">
                {microExpressionCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveMicroExpressionCategory(cat)}
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-semibold transition-all',
                      activeMicroExpressionCategory === cat
                        ? 'border-white/24 bg-white/[0.08] text-white'
                        : 'border-white/[0.06] bg-white/[0.025] text-white/36 hover:border-white/[0.1] hover:text-white/68'
                    )}
                  >
                    {cat === 'all' ? '全部' : cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {filteredMicroExpressionGroups.map(group => (
                <div key={group.group} className="rounded-2xl border border-white/[0.055] bg-white/[0.025] p-2.5">
                  <div className="mb-2 flex items-center gap-1.5">
                    <group.icon className="h-3.5 w-3.5 text-white/42" />
                    <span className="text-[10px] font-semibold text-white/62">{group.group}</span>
                    <div className="h-px flex-1 bg-white/[0.055]" />
                    <span className="text-[8px] text-white/24">{group.items.length}</span>
                  </div>
                  <div className="grid gap-1.5">
                    {group.items.map(item => {
                      const isSelected = selectedMicroExpressions.some(t => t.name === item.name && t.en === item.en);
                      return (
                        <button
                          key={item.name}
                          onClick={() => handleMicroExpressionSelect(item.name, item.en)}
                          className={cn(
                            'rounded-xl border px-2.5 py-2 text-left transition-all',
                            isSelected
                              ? 'border-white/24 bg-white/[0.08] text-white'
                              : 'border-white/[0.06] bg-black/18 text-white/62 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white'
                          )}
                        >
                          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold">
                            {isSelected ? <Check className="h-2.5 w-2.5" /> : <span className="text-white/25">+</span>}
                            {item.name}
                          </div>
                          <div className="text-[9px] leading-relaxed text-white/44">{item.en}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filteredMicroExpressionGroups.length === 0 && (
                <div className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.025] py-7 text-center text-[10px] text-white/32">
                  未找到匹配的微表情片段
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="prompt"
        inputTip="文本输入"
        outputId="promptOutput"
        outputTip="提示词输出"
      />

      {/* 主容器 */}
      <AICGNodeShell
        variant="glass-stack"
        aicgType="text"
        title="提示词"
        subtitle={`${promptTarget.label}提示词控制器 · ${promptTarget.subtitle}`}
        selected={selected}
        width={PROMPT_NODE_WIDTH}
        onPreviewDoubleClick={onPreviewDoubleClick}
        onDelete={handleDelete}
        controlsCollapsed={controlsCollapsed}
        controlPaneClassName={showModelSelector ? 'overflow-visible' : undefined}
        preview={null}
        controls={
          isExpanded && !controlsCollapsed ? (
          <div className="space-y-3 bg-[#101012] p-3.5">
            <div className="rounded-[18px] border border-white/[0.075] bg-[#101012] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border',
                    promptType === 'video'
                      ? 'border-white/16 bg-white/[0.06] text-white/76'
                      : 'border-white/16 bg-white/[0.06] text-white/76',
                  )}>
                    <TargetIcon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12px] font-semibold text-white/92">Prompt Architect</span>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 text-[9px] font-semibold text-white/42">
                        {promptTarget.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-white/34">
                      结构化创意描述、反向词、模板片段和智能增强
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {promptStats.map((stat) => (
                    <div key={stat.label} className="min-w-[54px] rounded-xl border border-white/[0.055] bg-white/[0.03] px-2 py-1.5 text-center">
                      <div className={cn('text-[12px] font-bold leading-none tabular-nums', stat.tone)}>{stat.value}</div>
                      <div className="mt-1 text-[8px] font-medium text-white/26">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateNodeData(id, { promptType: 'video' })}
                  className={cn(
                    'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[10px] font-semibold transition-all',
                    promptType === 'video'
                      ? 'border-white/24 bg-white/[0.08] text-white'
                      : 'border-white/[0.06] bg-white/[0.025] text-white/38 hover:text-white/70',
                  )}
                  title="为视频生成优化提示词"
                >
                  <Video className="h-3.5 w-3.5" />
                  视频结构
                </button>
                <button
                  type="button"
                  onClick={() => updateNodeData(id, { promptType: 'image' })}
                  className={cn(
                    'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[10px] font-semibold transition-all',
                    promptType === 'image'
                      ? 'border-white/24 bg-white/[0.08] text-white'
                      : 'border-white/[0.06] bg-white/[0.025] text-white/38 hover:text-white/70',
                  )}
                  title="为图片生成优化提示词"
                >
                  <Camera className="h-3.5 w-3.5" />
                  图片结构
                </button>
                <div className="flex h-8 min-w-0 flex-[1.4] items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5">
                  <Gauge className={cn('h-3.5 w-3.5', promptScore > 0 ? scoreColor : 'text-white/28')} />
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.065]">
                    <div className={cn('h-full rounded-full transition-all', promptScore > 0 ? scoreBarColor : 'bg-white/15')} style={{ width: `${promptScore || 8}%` }} />
                  </div>
                  <span className={cn('text-[9px] font-bold tabular-nums', promptScore > 0 ? scoreColor : 'text-white/30')}>
                    {promptScore > 0 ? promptScore : '--'}
                  </span>
                </div>
              </div>
            </div>

            {/* 提示词输入区 */}
            <AICGNodePromptBar
              nodeId={id as string}
              value={localPrompt}
              inputRef={textareaRef}
              rows={isTextareaExpanded ? 11 : 6}
              hideExpandButton
              onChange={(val) => {
                if (!isComposing && val.length > MAX_PROMPT_LENGTH) return;
                setLocalPrompt(val);
                onSlashTextChange(val);
              }}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={handlePromptCompositionEnd}
              onFocus={() => setIsPromptFocused(true)}
              onBlur={() => {
                setIsPromptFocused(false);
                updateNodeData(id, { prompt: localPrompt });
              }}
              placeholder="输入主体、场景、镜头、光影、风格与限制条件..."
              className="group/input"
              onPointerDownCapture={(e) => e.stopPropagation()}
              onMouseDownCapture={(e) => e.stopPropagation()}
              textareaClassName={cn(
                'rounded-[12px] bg-transparent p-3.5 text-[13px] leading-[1.65] text-white/88 scrollbar-none placeholder:text-white/24',
                isTextareaExpanded ? 'min-h-[280px]' : 'min-h-[168px]',
                isPromptFocused && 'border-white/28 bg-[#101012] ring-1 ring-white/12',
              )}
              slashMenu={
                slashOpen && slashCommands.length > 0 ? (
                  <AICGSlashMenu
                    commands={slashCommands}
                    className="absolute bottom-full left-2 z-50 mb-1"
                    onSelect={(cmd) => {
                      const next = applySlashCommand(cmd, () => {
                        const line = localPrompt.split('\n').pop() || '';
                        const idx = line.lastIndexOf('/');
                        const prefix = localPrompt.slice(0, localPrompt.length - line.length);
                        return idx >= 0 ? prefix + line.slice(0, idx) : localPrompt;
                      });
                      if (typeof next === 'string') {
                        setLocalPrompt(next);
                        updateNodeData(id, { prompt: next });
                      }
                    }}
                  />
                ) : undefined
              }
              inputOverlay={
                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/input:opacity-100">
                  <button
                    type="button"
                    onClick={() => setIsTextareaExpanded(!isTextareaExpanded)}
                    className="nodrag rounded border border-white/5 bg-black/40 p-1 text-white/40 transition-all hover:bg-black/60 hover:text-white/70"
                    title={isTextareaExpanded ? '收起' : '展开'}
                  >
                    {isTextareaExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                  </button>
                </div>
              }
            />

            <div className="relative flex flex-wrap items-center justify-between gap-2 rounded-[16px] border border-white/[0.065] bg-[#101012] px-2.5 py-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {/* 质量指示器 */}
                {promptScore > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowQualitySuggestions((p) => !p)}
                      className="nodrag flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-black/20 px-2 py-1.5 transition-all hover:bg-white/[0.055]"
                      title={qualityAnalysis?.scoreLabel || ''}
                    >
                      <div className="w-12 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', scoreBarColor)} style={{ width: `${promptScore}%` }} />
                      </div>
                      <span className={cn('text-[9px] font-bold tabular-nums', scoreColor)}>{promptScore}</span>
                    </button>
                    {showQualitySuggestions && qualityAnalysis && (
                      <div className="nodrag nowheel absolute bottom-full left-0 mb-1 z-50 w-64 rounded-lg border border-white/10 bg-[#0a0a0c]/95 backdrop-blur-xl p-2.5 shadow-2xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold" style={{ color: qualityAnalysis.scoreColor }}>
                            {qualityAnalysis.scoreLabel}
                          </span>
                          <span className="text-[9px] text-white/40">{promptScore}/100</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                          {[
                            { label: '长度', val: qualityAnalysis.metrics.lengthScore },
                            { label: '关键词', val: qualityAnalysis.metrics.keywordScore },
                            { label: '结构', val: qualityAnalysis.metrics.structureScore },
                            { label: '多样性', val: qualityAnalysis.metrics.varietyScore },
                          ].map((dim) => (
                            <div key={dim.label} className="flex items-center gap-1">
                              <span className="text-[8px] text-white/40 w-8">{dim.label}</span>
                              <div className="flex-1 h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full', dim.val >= 70 ? 'bg-white/72' : dim.val >= 40 ? 'bg-white/50' : 'bg-red-500/75')}
                                  style={{ width: `${dim.val}%` }}
                                />
                              </div>
                              <span className="text-[8px] tabular-nums text-white/50">{dim.val}</span>
                            </div>
                          ))}
                        </div>
                        {qualityAnalysis.suggestions.length > 0 && (
                          <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-none">
                            {qualityAnalysis.suggestions.slice(0, 4).map((sug, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  'text-[9px] leading-relaxed rounded px-1.5 py-1',
                                  sug.type === 'positive' ? 'text-white/68 bg-white/[0.035]' : 'text-white/58 bg-white/[0.025]',
                                )}
                              >
                                {sug.message}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 字数 */}
                <span className={cn(
                  'rounded-lg border border-white/[0.045] bg-black/15 px-2 py-1 text-[9px] font-medium tabular-nums',
                  charWarning ? 'text-white/70' : 'text-white/20'
                )}>
                  {localPrompt.length}/{MAX_PROMPT_LENGTH}
                </span>

                {/* 反向提示词按钮 */}
                <button
                  onClick={() => setIsNegExpanded(!isNegExpanded)}
                  className={cn(
                    'flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-medium transition-all',
                    isNegExpanded
                      ? 'bg-red-500/15 text-red-300 border border-red-500/20'
                      : localNegativePrompt
                        ? 'border-white/[0.06] bg-white/[0.03] text-white/48 hover:text-white/70'
                        : 'border-white/[0.045] text-white/28 hover:bg-white/[0.03] hover:text-white/50'
                  )}
                >
                  <AlertCircle className="w-2.5 h-2.5" />
                  反向词
                  {localNegativePrompt && !isNegExpanded && (
                    <span className="w-1 h-1 rounded-full bg-red-400" />
                  )}
                </button>

                {/* 模板库按钮 */}
                <button
                  onClick={() => {
                    setShowTemplateLib(!showTemplateLib);
                    if (!showTemplateLib) setShowMicroExpressionLib(false);
                  }}
                  className={cn(
                    'flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-medium transition-all',
                    showTemplateLib
                      ? 'bg-white/[0.08] text-white border border-white/20'
                      : 'border-white/[0.045] text-white/32 hover:bg-white/[0.03] hover:text-white/56'
                  )}
                >
                  <BookOpen className="w-2.5 h-2.5" />
                  模板
                  {selectedTemplates.length > 0 && (
                    <span className="px-1 py-0 rounded bg-white/[0.08] text-white/72 text-[8px]">
                      {selectedTemplates.length}
                    </span>
                  )}
                </button>

                {promptType === 'video' && (
                  <button
                      onClick={() => {
                        setShowMicroExpressionLib(!showMicroExpressionLib);
                        if (!showMicroExpressionLib) setShowTemplateLib(false);
                      }}
                      className={cn(
                        'flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-medium transition-all',
                        showMicroExpressionLib
                          ? 'bg-white/[0.08] text-white border border-white/20'
                          : 'border-white/[0.045] text-white/32 hover:bg-white/[0.03] hover:text-white/56'
                      )}
                      title="视频人物微表情模板库"
                    >
                      <Smile className="w-2.5 h-2.5" />
                      微表情
                      {selectedMicroExpressions.length > 0 && (
                        <span className="px-1 py-0 rounded bg-white/[0.08] text-white/72 text-[8px]">
                          {selectedMicroExpressions.length}
                        </span>
                      )}
                    </button>
                  )}
                </div>

              <div className="flex min-w-0 items-center gap-1">
                {/* 模型选择器 */}
                <div className="relative min-w-0">
                  <button
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    className={cn(
                      'flex h-8 w-[118px] items-center gap-1.5 rounded-xl border px-1.5 text-left text-[9px] font-medium transition-all nodrag shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                      showModelSelector
                        ? 'border-white/18 bg-white/[0.1] text-white'
                        : 'border-white/[0.1] bg-white/[0.065] text-white/82 hover:border-white/18 hover:bg-white/[0.1]'
                    )}
                    title="优化模型"
                  >
                    {(() => {
                      const icon = getTextModelIcon(selectedModelInfo?.id || 'auto');
                      return <icon.component size={16} />;
                    })()}
                    <span className="min-w-0 flex flex-1 flex-col leading-none">
                      <span className="block truncate text-[10px] font-bold text-white/92">{selectedModelInfo?.name || '智能路由'}</span>
                      <span className="mt-0.5 block truncate text-[8px] text-white/42">{selectedModelInfo?.model || '自动'}</span>
                    </span>
                    {selectedModelInfo && 'credits' in selectedModelInfo && typeof selectedModelInfo.credits === 'number' ? (
                      <span className="rounded border border-white/[0.08] bg-black/20 px-1 py-0.5 text-[8px] font-bold text-white/62">{selectedModelInfo.credits}</span>
                    ) : null}
                    <ChevronDown className={cn('w-2.5 h-2.5 shrink-0 text-white/58 transition-transform', showModelSelector && 'rotate-180')} />
                  </button>
                  {showModelSelector && (
                    <div className="absolute bottom-full right-0 mb-1.5 w-72 bg-[#101012] border border-white/12 rounded-2xl shadow-2xl z-50 overflow-hidden nodrag nowheel" onPointerDownCapture={(e) => e.stopPropagation()}>
                      <div className="px-2.5 py-1.5 border-b border-white/5">
                        <span className="text-[9px] font-bold text-white/50">选择优化模型</span>
                      </div>
                      <div className="max-h-[280px] overflow-y-auto nowheel p-1.5">
                        {VISIBLE_OPTIMIZE_MODELS.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedModel(model.id);
                              updateNodeData(id, { optimizeModel: model.id });
                              setShowModelSelector(false);
                            }}
                            className={cn(
                              'w-full flex items-center gap-2.5 rounded-xl bg-white/[0.045] px-2.5 py-2 text-left transition-all hover:bg-white/[0.1] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
                              selectedModel === model.id && 'bg-white/[0.14] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]'
                            )}
                          >
                            {(() => {
                              const icon = getTextModelIcon(model.id);
                              return <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg"><icon.component size={22} /></span>;
                            })()}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-[11px] font-bold text-white/92">{model.name}</span>
                                {'credits' in model && typeof model.credits === 'number' && (
                                  <span className="shrink-0 text-[8px] font-bold text-white/72 bg-black/25 px-1 py-0.5 rounded border border-white/[0.08]">{model.credits}积分/次</span>
                                )}
                                {selectedModel === model.id && <Check className="w-3 h-3 shrink-0 text-cyan-200" />}
                              </div>
                              <span className="block truncate text-[9px] text-white/58">{model.desc}</span>
                              {'displayModel' in model && (
                                <span className="block truncate text-[8px] text-white/42">{model.displayModel}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 智能增强按钮 */}
                <button
                  onClick={handleOptimize}
                  disabled={isOptimizing || !localPrompt.trim()}
                  className={cn(
                    'flex h-8 items-center gap-1 rounded-xl px-2 text-[10px] font-bold transition-all',
                    isOptimizing || !localPrompt.trim()
                      ? 'bg-white/[0.03] text-white/20 cursor-not-allowed'
                      : 'border border-white/20 bg-white/[0.1] text-white hover:border-white/32 hover:bg-white/[0.14] shadow-lg shadow-black/20 active:scale-95'
                  )}
                >
                  {isOptimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  增强
                  {quotaBadge.text ? (
                    <span className={cn('px-1 py-0 rounded text-[8px] font-mono bg-black/20', quotaBadge.color)}>{quotaBadge.text}</span>
                  ) : null}
                </button>
              </div>
            </div>

            {/* 反向提示词展开区 */}
            {isNegExpanded && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-medium text-white/30">反向提示词</span>
                  <button
                    onClick={() => setShowNegPresets(!showNegPresets)}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[8px] font-medium transition-all',
                      showNegPresets ? 'bg-red-500/15 text-red-300' : 'text-white/25 hover:text-white/40 hover:bg-white/[0.03]'
                    )}
                  >
                    预设
                  </button>
                </div>
                {showNegPresets && (
                  <div className="flex flex-wrap gap-1">
                    {NEGATIVE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setLocalNegativePrompt(preset.value);
                          updateNodeData(id, { negativePrompt: preset.value });
                        }}
                        className="px-1.5 py-0.5 text-[9px] rounded bg-red-500/10 border border-red-500/15 text-red-300/70 hover:bg-red-500/20 hover:text-red-200 transition-all"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  value={localNegativePrompt}
                  onChange={handleNegativePromptInput}
                  onCompositionStart={(e) => {
                    e.stopPropagation();
                    setIsNegComposing(true);
                  }}
                  onCompositionEnd={(e) => {
                    e.stopPropagation();
                    handleNegCompositionEnd(e);
                  }}
                  onFocus={(e) => {
                    e.stopPropagation();
                    setIsPromptFocused(true);
                  }}
                  onBlur={(e) => {
                    e.stopPropagation();
                    updateNodeData(id, { negativePrompt: localNegativePrompt });
                  }}
                  placeholder="不希望出现的内容..."
                  className="w-full h-24 resize-none rounded-[16px] border border-white/[0.06] bg-black/30 p-3 text-[12px] leading-relaxed text-white/80 transition-all nodrag nowheel select-text placeholder:text-white/24 hover:border-white/[0.1] focus:border-red-400/28 focus:bg-black/45"
                  style={{ userSelect: 'text' }}
                  onKeyDown={(e) => e.stopPropagation()}
                  onKeyUp={(e) => e.stopPropagation()}
                  onInput={(e) => e.stopPropagation()}
                  onBeforeInput={(e) => e.stopPropagation()}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onMouseDownCapture={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
          ) : null
        }
      />

    </div>
  );
});

PromptNode.displayName = 'PromptNode';

export default PromptNode;
