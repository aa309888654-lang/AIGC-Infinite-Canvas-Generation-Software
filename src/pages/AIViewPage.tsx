import { getAuthToken, clearAuthToken } from '@/lib/auth-check';
import { API_BASE_URL } from '@/lib/api-config';
import React, { useEffect, useState, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { PUBLIC_URLS } from '@/config/resources';
import OptimizedImage from '@/components/ui/OptimizedImage';
import VideoThumbnail from '@/components/ui/VideoThumbnail';
import {
  Video,
  Image,
  Sparkles,
  Clock,
  LayoutGrid,
  Settings,
  Loader2,
  Maximize2,
  Play,
  Download,
  Trash2,
  Zap,
  Eye,
  X,
  Menu,
  AlertCircle,
  SlidersHorizontal,
  ChevronDown,
  Film,
  RefreshCw,
  Star,
  BrainCircuit,
  Gauge,
  Clapperboard,
  Layers,
  Type,
  Send,
  PartyPopper,
  Atom,
  Skull,
  Swords,
  Brush,
} from 'lucide-react';
import MedusaIcon from '@/components/ui/MedusaIcon';

const navMedusaIcons: Record<string, string> = {
  queue: 'clock',
  gallery: 'eye',
  home: 'house',
};

import { ModelSelector } from '@/components/ui/ModelSelector';
import { ParameterPanel, ParameterGrid, Divider, SkillButton } from '@/components/ui/ParameterPanel';
import { cn } from '@/lib/utils';
import { navigateTo } from '@/routes';
import UserProfileDropdown from '@/components/ui/UserProfileDropdown';
import {
  useMembershipStore,
  getTierDisplayName,
  canUseFeature,
} from '@/store/useMembershipStore';
import { usePermission } from '@/hooks/usePermission';
import { checkQuotaOrFail } from '@/lib/quota-helper';
import { useFileStore } from '@/store/useFileStore';
import { useResponsive } from '@/hooks/useResponsive';
import { calculateVideoExpectedPoints } from '@/lib/pricing-rules';
import type { QuotaFeature } from '@/lib/quota-helper';
import { unifiedAPIModelService, UnifiedModelConfig } from '@/services/unified-api-model-service';
import { getModelSupportedResolutions } from '@/config/model-resolutions';
import { promptOptimizerService, classifyPromptAgent, type ProfessionalCategory } from '@/services/prompt-optimizer-api';
import { DEFAULT_PROMPT_TEXT_MODEL_ID } from '@/config/prompt-optimizer-models';
import useUnifiedAPIConfigStore from '@/store/useUnifiedAPIConfigStore';
import realAPIExecutor from '@/store/real-api-executor';
import { toast } from 'sonner';
import type { ImageGenerationParams, VideoGenerationParams } from '@/types/ai-models';
import InspirationSection from './ai-view/InspirationSection';
import { EXCLUDED_VIDEO_MODELS } from './ai-view/config';
import { loadGenerationsFromStorage, saveGenerationsToStorage, mergeGenerations } from './ai-view/storage';
import type {
  SectionId,
  GenerationItem,
  UnifiedParams,
  PromptOptimizationStrategy,
  InspirationItem,
} from './ai-view/types';
import { DEFAULT_IMAGE_STYLE_PARAMS } from './ai-view/types';
import './ai-view/ai-view.css';
import AiStudioHubParticles from './ai-view/AiStudioHubParticles';
import './ai-view/studio-hub.css';

const LoginModal = lazy(() => import('@/components/membership/LoginModal'));

const CINE_PRESETS = [
  { id: '1', name: '史诗', desc: '宏大叙事，壮阔场景', icon: Film, color: '#6366F1' },
  { id: '2', name: '浪漫', desc: '唯美情感，温馨氛围', icon: Sparkles, color: '#EC4899' },
  { id: '3', name: '悬疑', desc: '紧张节奏，悬念迭起', icon: Eye, color: '#8B5CF6' },
  { id: '4', name: '喜剧', desc: '轻松诙谐，欢乐氛围', icon: PartyPopper, color: '#F59E0B' },
  { id: '5', name: '科幻', desc: '未来科技，炫酷特效', icon: Atom, color: '#06B6D4' },
  { id: '6', name: '恐怖', desc: '惊悚氛围，紧张刺激', icon: Skull, color: '#EF4444' },
  { id: '7', name: '动作', desc: '激烈打斗，快节奏', icon: Swords, color: '#F97316' },
  { id: '8', name: '文艺', desc: '细腻情感，文艺气息', icon: Brush, color: '#10B981' },
];

const IMAGE_TEMPLATES = [
  {
    src: '/templates/template-1.webp',
    label: '古风舞者·光影',
    prompt: '【构图】三分法，舞者居右1/3，下摆展开形成视觉引导线；【光影】右上方45°追光+轮廓光，暗部低补光，3300K暖色温；【色调】正红主调金牡丹刺绣墨黑滚边，对比统一；【镜头85mm f2.8浅景深，虚化灯光光斑；【环境】中式古典舞台，红灯笼绸幔留白；【材质】丝绸光泽苏绣凹凸+金线反光；【风格】海派月份牌+复古胶片质感；【细节】水袖轨迹丁达尔光束烟雾',
  },
  {
    src: '/templates/template-2.webp',
    label: '古风舞者·光影II',
    prompt: '【构图】三分法，舞者居右1/3，下摆展开形成视觉引导线；【光影】右上方45°追光+轮廓光，暗部低补光，3300K暖色温；【色调】正红主调金牡丹刺绣墨黑滚边，对比统一；【镜头85mm f2.8浅景深，虚化灯光光斑；【环境】中式古典舞台，红灯笼绸幔留白；【材质】丝绸光泽苏绣凹凸+金线反光；【风格】海派月份牌+复古胶片质感；【细节】水袖轨迹丁达尔光束烟雾',
  },
  {
    src: '/templates/template-3.webp',
    label: '古风舞者·光影III',
    prompt: '【构图】三分法，舞者居右1/3，下摆展开形成视觉引导线；【光影】右上方45°追光+轮廓光，暗部低补光，3300K暖色温；【色调】正红主调金牡丹刺绣墨黑滚边，对比统一；【镜头85mm f2.8浅景深，虚化灯光光斑；【环境】中式古典舞台，红灯笼绸幔留白；【材质】丝绸光泽苏绣凹凸+金线反光；【风格】海派月份牌+复古胶片质感；【细节】水袖轨迹丁达尔光束烟雾',
  },
  {
    src: '/templates/template-4.webp',
    label: '古风舞者·光影IV',
    prompt: '【构图】三分法，舞者居右1/3，下摆展开形成视觉引导线；【光影】右上方45°追光+轮廓光，暗部低补光，3300K暖色温；【色调】正红主调金牡丹刺绣墨黑滚边，对比统一；【镜头85mm f2.8浅景深，虚化灯光光斑；【环境】中式古典舞台，红灯笼绸幔留白；【材质】丝绸光泽苏绣凹凸+金线反光；【风格】海派月份牌+复古胶片质感；【细节】水袖轨迹丁达尔光束烟雾',
  },
  {
    src: '/templates/template-5.webp',
    label: '汉服舞者·园林',
    prompt: '汉服美女在舞蹈。三分法构图，舞者位于左1/3交叉点处，伦勃朗光轮廓光立体照明，空气感光斑提升空间层次。魏晋风低饱和配色：黛青为主、朱砂红点缀、鎏金高光。85mm广角低机位仰拍，凝固裙袂展开的动态瞬间。中式园林月洞门前景，浅景深虚化。绢帛汉服面料，轻薄半透明质感，织金纹样。东方古典美学，敦煌壁画色彩体系，工笔画质感。衣袂飘带运动轨迹，动态模糊，粒子光斑营造梦境感，四角压暗聚焦主体',
  },
  {
    src: '/templates/template-6.webp',
    label: '汉服仕女·金殿',
    prompt: '古风美女，身着正红色金线绣纹大袖汉服，手持纨扇，头戴点翠凤冠、东珠步摇，蛾眉杏眼，朱唇梅花妆。身后宫廷金銮殿，蟠龙金柱矗立，牡丹双凤屏风相隔，宫灯高照，烛光摇曳，焚香盈袖。色调以朱砂红为基，鎏金勾勒，云锦紫过渡，宝石蓝点缀。中轴对称构图，画面金碧辉煌，雍容华贵，意境深远。风吹衣袂环佩叮当，轻纱曼舞，仪态万千',
  },
  {
    src: '/templates/template-7.webp',
    label: '新中式舞者·追光I',
    prompt: '构图：三分法，舞者居右黄金分割点，对角线延展动态张力。光影：45°顶光追灯，丝绸光泽与明暗对比突出主体。色调：正红、墨黑、金色高对比，新中式古典风。镜头：85mm中焦，浅景深侧拍。环境：深色舞台背景，留白空间。材质：丝绸舞衣光泽质感。风格：新中式古典舞蹈摄影。细节：舞姿动态定格，衣袂飘逸',
  },
  {
    src: '/templates/template-8.webp',
    label: '新中式舞者·追光II',
    prompt: '构图：三分法，舞者居右黄金分割点，对角线延展动态张力。光影：45°顶光追灯，丝绸光泽与明暗对比突出主体。色调：正红、墨黑、金色高对比，新中式古典风。镜头：85mm中焦，浅景深侧拍。环境：深色舞台背景，留白空间。材质：丝绸舞衣光泽质感。风格：新中式古典舞蹈摄影。细节：舞姿动态定格，衣袂飘逸',
  },
  {
    src: '/templates/template-9.webp',
    label: '新中式舞者·追光III',
    prompt: '构图：三分法，舞者居右黄金分割点，对角线延展动态张力。光影：45°顶光追灯，丝绸光泽与明暗对比突出主体。色调：正红、墨黑、金色高对比，新中式古典风。镜头：85mm中焦，浅景深侧拍。环境：深色舞台背景，留白空间。材质：丝绸舞衣光泽质感。风格：新中式古典舞蹈摄影。细节：舞姿动态定格，衣袂飘逸',
  },
  {
    src: '/templates/template-10.webp',
    label: '新中式舞者·追光IV',
    prompt: '构图：三分法，舞者居右黄金分割点，对角线延展动态张力。光影：45°顶光追灯，丝绸光泽与明暗对比突出主体。色调：正红、墨黑、金色高对比，新中式古典风。镜头：85mm中焦，浅景深侧拍。环境：深色舞台背景，留白空间。材质：丝绸舞衣光泽质感。风格：新中式古典舞蹈摄影。细节：舞姿动态定格，衣袂飘逸',
  },
];

const LOCAL_INSPIRATION_IMAGES: InspirationItem[] = [
  {
    id: '0',
    src: '/inspiration/desktop-photos/0.webp',
    title: '日落海边',
    prompt: '金色夕阳余晖洒落在绵延的沙滩上，海浪轻轻拍打着岸边，天空被染成橙红渐变到深紫色的壮丽色彩，远处帆船剪影飘摇，电影感构图，广角视野，光线从右上方45度角照射，温暖而柔和的氛围。8K超高清写实摄影风格',
  },
  {
    id: '1',
    src: '/inspiration/desktop-photos/1.webp',
    title: '城市夜景',
    prompt: '繁华都市的璀璨夜景，高楼大厦的霓虹灯光倒映在湿润的街道上，雨后的城市显得格外通透，蓝紫色调的城市灯光，人群匆匆行走，Sony微单相机拍摄，高感光度噪点控制优秀，电影感色调，电影变形宽银幕镜头风格',
  },
  {
    id: '2',
    src: '/inspiration/desktop-photos/2.webp',
    title: '森林小径',
    prompt: '清晨阳光穿透茂密的森林树冠，在林间小径上形成梦幻的光柱，苔藓覆盖的石板路，两侧是苍翠的蕨类植物和野花，薄雾缭绕增添神秘感，自然纪录片级别的生态摄影，景深层次分明，尼康长焦镜头捕捉，苔藓绿与金色阳光的对比色调',
  },
  {
    id: '3',
    src: '/inspiration/desktop-photos/3.webp',
    title: '雪山峰顶',
    prompt: '巍峨雪山的震撼全景，终年积雪的山峰在晨曦中呈现粉红色光泽，山脚下是苍翠的针叶林，壮阔的自然风光，完美的三分法构图，天空与雪山比例1:2，艺术画意境与现代摄影的结合，高动态范围成像，云海翻涌其间',
  },
  {
    id: '4',
    src: '/inspiration/desktop-photos/4.webp',
    title: '咖啡馆角落',
    prompt: '温馨的咖啡馆一隅，原木桌椅搭配复古工业风装饰，暖黄色灯光营造舒适氛围，桌上有精致的咖啡杯和翻开的书籍，背景是朦胧的城市街景，浅景深虚化效果突出主体，Canon单反相机拍摄，咖啡香气仿佛从画面中飘出，下午茶时光的慵懒氛围',
  },
  {
    id: '6',
    src: '/inspiration/desktop-photos/6.webp',
    title: '古镇小巷',
    prompt: '江南水乡古镇的青石板小巷，两旁是白墙黛瓦的传统建筑，屋檐下悬挂的红灯笼随风轻摇，石拱桥横跨小河，乌篷船缓缓划过，生活气息浓厚的街景，晨雾笼罩增添诗意，经典传统建筑美学，徕卡相机的人文摄影风格，色彩清淡雅致',
  },
  {
    id: '7',
    src: '/inspiration/desktop-photos/7.webp',
    title: '极光夜空',
    prompt: '神秘绚丽的北极光在夜空中舞动，翠绿色和紫色的光带倒映在平静的湖面上，繁星点点，壮丽的自然奇观，长曝光摄影技术捕捉光轨，冰岛冬季夜空，远景为积雪的山脉，超宽画幅展现宇宙的浩瀚，HDR合成技术保留高光与暗部细节',
  },
  {
    id: '8',
    src: '/inspiration/desktop-photos/8.webp',
    title: '樱花树下',
    prompt: '粉白色的樱花花瓣漫天飞舞，樱花树下的日式庭院，木质长椅和石灯笼点缀其间，柔和的侧光营造梦幻氛围，典型的日系小清新摄影风格，逆光拍摄捕捉花瓣的通透感，后期轻微过曝增加空气感，浅景深突出主体，春季限定的浪漫氛围',
  },
  {
    id: '9',
    src: '/inspiration/desktop-photos/9.webp',
    title: '沙漠驼队',
    prompt: '金色沙漠中的驼队剪影，夕阳西下时分骆驼商队缓缓前行，沙丘起伏的优美线条，大漠孤烟直的壮阔意境，丝绸之路的古老画面，暖橙色渐变的黄昏色调，长焦镜头压缩空间感，剪影效果突出主体线条，大疆无人机航拍视角',
  },
  {
    id: '11',
    src: '/inspiration/desktop-photos/11.webp',
    title: '热带海滩',
    prompt: '椰林树影下的碧蓝海水和细白沙滩，热带度假天堂的典型画面，玻璃般透明的海水，远处帆船点点，棕榈叶在微风中轻摇，正午阳光从头顶照射形成波光粼粼的效果，东南亚海岛风情，高饱和度蓝色和绿色，GoPro广角运动相机风格',
  },
  {
    id: '12',
    src: '/inspiration/desktop-photos/12.webp',
    title: '雨后彩虹',
    prompt: '暴风雨后横跨天际的完整彩虹，七色光谱清晰可见，彩虹两端消失在地平线上，远处是现代化的都市天际线，城市与自然的和谐画面，雨后的清新空气感，彩虹周围残留的乌云形成对比构图，城市风光与天气现象的结合，风光摄影的完美时机',
  },
  {
    id: '13',
    src: '/inspiration/desktop-photos/13.webp',
    title: '红叶秋景',
    prompt: '金秋时节漫山遍野的红叶，枫叶由橙黄渐变到深红层层叠叠，传统庭院中的红叶与枯山水相映成趣，古朴的木质亭台点缀其间，禅意十足的古典美学，秋日的温暖阳光穿透树叶，后期调色偏暖偏暗，电影感构图，Canon EF长焦镜头',
  },
  {
    id: '14',
    src: '/inspiration/desktop-photos/14.webp',
    title: '星空银河',
    prompt: '远离光污染的高原夜空，璀璨银河横跨天际，无数星辰闪烁，北斗七星清晰可见，壮阔的星空全景，深邃的宇宙之美，长曝光拍摄捕捉星光轨迹，高感光度全画幅相机，地景为起伏的山峦剪影，完美的三分法构图天空与地景比例，天文摄影级别的清晰度',
  },
  {
    id: '15',
    src: '/inspiration/desktop-photos/15.webp',
    title: '竹林小溪',
    prompt: '翠绿竹林中的清澈小溪，流水潺潺穿过青苔覆盖的石块，斑驳的光影从竹叶间洒落，古典园林的意境之美，虚实结合的绘画风格，水面倒映翠竹形成对称构图，宁静致远的禅意氛围，佳能微单相机的柔和色调，典型的现代古典美学空间',
  },
];

const VIDEO_INSPIRATION_IMAGES: InspirationItem[] = [
  {
    id: 'v1',
    src: '/showcase-images/1.webp',
    title: '图片智能编辑',
    prompt: 'AI辅助图片处理与优化，局部重绘精细调整，画布外延扩展场景，智能抠图与风格迁移',
  },
  {
    id: 'v2',
    src: '/showcase-images/2.webp',
    title: 'AI音乐创作',
    prompt: '智能生成背景音乐，风格与情感控制，多乐器配置，节奏与旋律定制，适配各类视频场景',
  },
  {
    id: 'v3',
    src: '/showcase-images/3.webp',
    title: '视频剪辑工具',
    prompt: '专业级视频剪辑处理，多轨道时间线编辑，智能字幕生成，转场特效与调色，一键导出多格式',
  },
  {
    id: 'v4',
    src: '/showcase-images/4.webp',
    title: '智能配音系统',
    prompt: '多语言AI语音合成，情感控制与语速调节，对白自动匹配唇形，音量平衡与音效叠加',
  },
  {
    id: 'v5',
    src: '/showcase-images/5.webp',
    title: '批量处理引擎',
    prompt: '高效批量内容生成，队列管理智能调度，统一参数批量应用，自动命名与分类存储',
  },
  {
    id: 'v6',
    src: '/showcase-images/6.webp',
    title: 'AI角色设计',
    prompt: '智能生成游戏与动画角色，多角度角色一致性，服装与配饰定制，表情与动作设计',
  },
  {
    id: 'v7',
    src: '/showcase-images/7.webp',
    title: '场景概念图',
    prompt: '快速生成游戏与影视场景，概念艺术风格渲染，环境氛围营造，光影与材质精细控制',
  },
  {
    id: 'v8',
    src: '/showcase-images/8.webp',
    title: '3D模型渲染',
    prompt: 'AI辅助3D建模与渲染，材质贴图智能生成，光照环境模拟，多角度输出与动画预览',
  },
  {
    id: 'v9',
    src: '/showcase-images/9.webp',
    title: '动态海报',
    prompt: '一键生成动态宣传海报，文字排版与视觉冲击，品牌色系自动匹配，适配多平台尺寸',
  },
  {
    id: 'v10',
    src: '/showcase-images/12.webp',
    title: '视频特效合成',
    prompt: '电影级视觉特效制作，粒子特效与光效合成，绿幕抠像与场景融合，调色与后期处理',
  },
  {
    id: 'v11',
    src: '/showcase-images/13.webp',
    title: '智能文案生成',
    prompt: 'AI辅助内容创作与优化，多风格文案输出，关键词智能扩展，SEO优化与平台适配',
  },
];

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '1:1', label: '1:1' },
  { value: '21:9', label: '21:9' },
  { value: 'adaptive', label: '自适应' },
];

const RESOLUTIONS = [
  { value: '720p', label: '720P' },
  { value: '1080p', label: '1080P' },
  { value: '2k', label: '2K' },
  { value: '4k', label: '4K' },
];

const DURATIONS = [4, 5, 6, 8, 10, 15].map((value) => ({ value, label: `${value}秒` }));
const VIDU_DURATIONS = [4, 8, 16].map((value) => ({ value, label: `${value}秒` }));

const GENERATION_MODES = [
  { value: 'text_to_video', label: '文生视频' },
  { value: 'image_to_video', label: '图生视频' },
  { value: 'first_last_frame', label: '首尾帧' },
  { value: 'video_to_video', label: '视频重绘' },
  { value: 'reference_to_video', label: '多模态参考' },
];

const IMAGE_GENERATION_MODES = [
  { value: 'text_to_image', label: '文生图' },
  { value: 'image_to_image', label: '图生图' },
  { value: 'reference', label: '图片参考' },
  { value: 'character_reference', label: '人物参考' },
];

const IMAGE_COUNTS = [
  { value: 1, label: '1张' },
  { value: 2, label: '2张' },
  { value: 4, label: '4张' },
];

const IMAGE_ART_STYLES = [
  { id: 'realistic', name: '写实摄影', color: 'accent-primary', prompt: 'photorealistic, hyperrealistic, 8k uhd, high detail' },
  { id: 'anime', name: '动漫插画', color: 'accent-primary', prompt: 'anime style, manga illustration, cel shading, vibrant colors' },
  { id: 'oil_painting', name: '油画', color: 'accent-primary', prompt: 'oil painting, textured brush strokes, classical art style' },
  { id: 'watercolor', name: '水彩', color: 'accent-primary', prompt: 'watercolor painting, soft washes, delicate transparency' },
  { id: 'concept_art', name: '概念艺术', color: 'accent-primary', prompt: 'concept art, digital painting, artstation trending' },
  { id: 'pixel_art', name: '像素风', color: 'accent-primary', prompt: 'pixel art, retro game style, 16-bit aesthetic' },
  { id: 'cyberpunk', name: '赛博朋克', color: 'accent-primary', prompt: 'cyberpunk style, neon lights, futuristic dystopia' },
  { id: 'fantasy', name: '奇幻魔法', color: 'accent-primary', prompt: 'fantasy art, magical atmosphere, ethereal glow' },
  { id: 'minimalist', name: '极简主义', color: 'accent-primary', prompt: 'minimalist design, clean lines, simple composition' },
  { id: 'comic', name: '漫画风格', color: 'accent-primary', prompt: 'comic book style, bold outlines, halftone dots' },
  { id: '3d_render', name: '3D渲染', color: 'accent-primary', prompt: '3D render, octane render, cinema 4D, volumetric lighting' },
  { id: 'ink_wash', name: '水墨画', color: 'accent-primary', prompt: 'Chinese ink wash painting, sumi-e, brush strokes, elegant' },
  { id: 'pop_art', name: '波普艺术', color: 'accent-primary', prompt: 'pop art style, bold colors, Andy Warhol inspired' },
  { id: 'impressionist', name: '印象派', color: 'accent-primary', prompt: 'impressionist painting, light and color, Monet style' },
  { id: 'surrealism', name: '超现实', color: 'accent-primary', prompt: 'surrealism, dreamlike, Salvador Dali inspired' },
  { id: 'flat_design', name: '扁平插画', color: 'accent-primary', prompt: 'flat design illustration, vector art, clean geometric shapes' },
];

const IMAGE_LIGHTING = [
  { id: 'natural', name: '自然光', prompt: 'natural lighting, soft daylight' },
  { id: 'golden_hour', name: '黄金时刻', prompt: 'golden hour lighting, warm sunset glow' },
  { id: 'studio', name: '影棚灯光', prompt: 'studio lighting, professional three-point lighting' },
  { id: 'dramatic', name: '戏剧光', prompt: 'dramatic lighting, strong contrast, chiaroscuro' },
  { id: 'neon', name: '霓虹灯光', prompt: 'neon lighting, colorful glow, urban atmosphere' },
  { id: 'moonlight', name: '月光', prompt: 'moonlight, cool blue tones, serene night' },
  { id: 'backlit', name: '逆光', prompt: 'backlit, silhouette, rim lighting' },
  { id: 'volumetric', name: '体积光', prompt: 'volumetric lighting, god rays, atmospheric haze' },
  { id: 'rim_light', name: '轮廓光', prompt: 'rim light, edge lighting, dramatic separation' },
  { id: 'soft_diffused', name: '柔光', prompt: 'soft diffused lighting, even illumination, no harsh shadows' },
  { id: 'hard_light', name: '硬光', prompt: 'hard lighting, sharp shadows, high contrast' },
  { id: 'bioluminescent', name: '生物发光', prompt: 'bioluminescent lighting, magical glow, underwater or forest' },
];

const IMAGE_COMPOSITION = [
  { id: 'center', name: '居中构图', prompt: 'centered composition, symmetrical framing' },
  { id: 'rule_of_thirds', name: '三分法', prompt: 'rule of thirds composition, balanced placement' },
  { id: 'golden_ratio', name: '黄金比例', prompt: 'golden ratio composition, fibonacci spiral' },
  { id: 'leading_lines', name: '引导线', prompt: 'leading lines composition, depth and perspective' },
  { id: 'frame_in_frame', name: '框中框', prompt: 'frame within frame composition, natural framing elements' },
  { id: 'symmetry', name: '对称构图', prompt: 'symmetrical composition, mirror effect' },
  { id: 'diagonal', name: '对角线', prompt: 'diagonal composition, dynamic energy' },
  { id: 'closeup', name: '特写', prompt: 'close-up shot, macro detail, shallow depth of field' },
  { id: 'wide_angle', name: '广角', prompt: 'wide angle shot, expansive view, dramatic perspective' },
  { id: 'birds_eye', name: '俯瞰', prompt: "bird's eye view, overhead perspective, aerial shot" },
  { id: 'low_angle', name: '仰拍', prompt: 'low angle shot, looking up, powerful perspective' },
  { id: 'dutch_angle', name: '倾斜构图', prompt: 'dutch angle, tilted camera, dynamic tension' },
];

const IMAGE_MEDIUM = [
  { id: 'digital', name: '数字绘画', prompt: 'digital art, digital painting' },
  { id: 'photography', name: '摄影', prompt: 'photography, DSLR, professional photo' },
  { id: 'illustration', name: '插画', prompt: 'illustration, editorial art' },
  { id: 'sculpture', name: '雕塑', prompt: 'sculpture, 3D art, marble or clay' },
  { id: 'collage', name: '拼贴', prompt: 'mixed media collage, artistic assemblage' },
  { id: 'sketch', name: '素描', prompt: 'pencil sketch, graphite drawing, detailed linework' },
  { id: 'charcoal', name: '炭笔画', prompt: 'charcoal drawing, dramatic shading, expressive strokes' },
  { id: 'pastel', name: '色粉画', prompt: 'pastel drawing, soft colors, chalky texture' },
  { id: 'linocut', name: '版画', prompt: 'linocut print, woodblock print, graphic art' },
  { id: 'stained_glass', name: '彩色玻璃', prompt: 'stained glass art, luminous colors, lead came' },
];

const IMAGE_COLOR_MOODS = [
  { id: 'warm', name: '暖色系', color: 'accent-primary', prompt: 'warm color palette, oranges, reds, yellows' },
  { id: 'cool', name: '冷色系', color: 'accent-primary', prompt: 'cool color palette, blues, greens, purples' },
  { id: 'muted', name: '低饱和', color: 'accent-primary', prompt: 'muted colors, desaturated, subtle tones' },
  { id: 'vibrant', name: '高饱和', color: 'accent-primary', prompt: 'vibrant saturated colors, vivid and bold' },
  { id: 'monochrome', name: '单色', color: 'accent-primary', prompt: 'monochrome, black and white' },
  { id: 'pastel_palette', name: '马卡龙色', color: 'accent-primary', prompt: 'pastel color palette, soft sweet tones' },
  { id: 'earth_tones', name: '大地色', color: 'accent-primary', prompt: 'earth tones, natural browns, greens, ochres' },
  { id: 'neon_colors', name: '霓虹色', color: 'accent-primary', prompt: 'neon colors, glowing electric hues' },
  { id: 'jewel_tones', name: '宝石色', color: 'accent-primary', prompt: 'jewel tones, rich deep colors, ruby sapphire emerald' },
  { id: 'sepia', name: '复古色调', color: 'accent-primary', prompt: 'sepia tone, vintage color grading, retro feel' },
];

const IMAGE_CAMERA_SETTINGS = [
  { id: 'auto', name: '自动', prompt: '' },
  { id: '35mm', name: '35mm 定焦', prompt: 'shot on 35mm lens, natural perspective' },
  { id: '50mm', name: '50mm 标准', prompt: 'shot on 50mm lens, standard focal length, natural look' },
  { id: '85mm', name: '85mm 人像', prompt: 'shot on 85mm portrait lens, beautiful bokeh' },
  { id: 'wide_14mm', name: '14mm 超广角', prompt: 'shot on 14mm ultra wide angle lens, dramatic perspective' },
  { id: 'fisheye', name: '鱼眼', prompt: 'fisheye lens, extreme wide angle distortion' },
  { id: 'macro', name: '微距', prompt: 'macro lens, extreme close-up detail' },
  { id: 'tilt_shift', name: '移轴', prompt: 'tilt-shift lens, miniature effect, selective focus' },
  { id: 'telephoto', name: '长焦', prompt: 'telephoto lens, compressed perspective, background blur' },
];

const IMAGE_DEPTH_OF_FIELD = [
  { id: 'auto', name: '自动', prompt: '' },
  { id: 'shallow', name: '浅景深', prompt: 'shallow depth of field, f/1.4, creamy bokeh' },
  { id: 'medium', name: '中等景深', prompt: 'medium depth of field, f/4, balanced focus' },
  { id: 'deep', name: '深景深', prompt: 'deep depth of field, f/11, everything in focus' },
  { id: 'tilt_shift_dof', name: '移轴虚化', prompt: 'tilt-shift miniature effect, selective focus plane' },
];

const IMAGE_DETAIL_LEVELS = [
  { id: 'standard', name: '标准', prompt: 'standard detail' },
  { id: 'high', name: '高细节', prompt: 'extremely detailed, intricate details, fine textures' },
  { id: 'ultra', name: '超高细节', prompt: 'ultra high detail, 8K resolution, photorealistic textures, sharp focus' },
  { id: 'minimal', name: '简约', prompt: 'clean minimal detail, simple and elegant' },
];

const CAPABILITY_MODE_MAP: Record<string, string[]> = {
  text_to_video: ['text-to-video', 'text-to-video-with-sample'],
  image_to_video: ['image-to-video'],
  first_last_frame: ['first-last-frame'],
  video_to_video: ['video-to-video'],
  reference_to_video: ['multi-reference', 'video-reference', 'audio-reference'],
};

const PROVIDER_LABELS: Record<string, string> = {
  doubao: '豆包 Seedance',
  vidu: 'Vidu',
  hailuo: 'Hailuo',
  minimax: 'MiniMax',
  kling: '可灵 Kling',
};

const CAMERA_PRESETS = [
  { value: 'auto', label: '自动' },
  { value: 'static', label: '静止' },
  { value: 'zoom_in', label: '推近 Zoom In' },
  { value: 'zoom_out', label: '拉远 Zoom Out' },
  { value: 'pan_left', label: '左移 Pan Left' },
  { value: 'pan_right', label: '右移 Pan Right' },
  { value: 'tilt_up', label: '仰拍 Tilt Up' },
  { value: 'tilt_down', label: '俯拍 Tilt Down' },
  { value: 'orbit', label: '环绕 Orbit' },
  { value: 'crane', label: '升降 Crane' },
  { value: 'dolly', label: '跟拍 Dolly' },
  { value: 'dutch_tilt', label: '斜角 Dutch Tilt' },
];

const VIDEO_PRESETS = [
  { value: 'cinematic', label: '电影感' },
  { value: 'anime', label: '动漫风' },
  { value: 'documentary', label: '纪录片' },
  { value: 'commercial', label: '广告片' },
  { value: 'music_video', label: 'MV' },
  { value: 'slow_motion', label: '慢动作' },
  { value: 'timelapse', label: '延时摄影' },
  { value: 'vlog', label: 'Vlog' },
  { value: 'none', label: '无预设' },
];

const IMAGE_PROVIDER_LABELS: Record<string, string> = {
  minimax: 'MiniMax',
  openai: '第三方GPT',
  anthropic: '第三方Claude',
  doubao: '豆包 Seedream',
  flux: 'Flux',
  kling: '可灵',
};

const GPT_IMAGE_STYLES = [
  { value: 'vivid', label: '生动' },
  { value: 'natural', label: '自然' },
];

const GPT_IMAGE_QUALITY = [
  { value: 'auto', label: '自动' },
  { value: 'low', label: '快速' },
  { value: 'medium', label: '标准' },
  { value: 'high', label: '高清' },
];

const NANO_THINKING_LEVELS = [
  { value: 'minimal', label: '极速' },
  { value: 'low', label: '快速' },
  { value: 'medium', label: '标准' },
  { value: 'high', label: '深度' },
];

const NANO_IMAGE_SIZES = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];

const FLUX_OUTPUT_FORMATS = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
];

const FLUX_SAFETY_LEVELS = [
  { value: '0', label: '0 (最严格)' },
  { value: '1', label: '1' },
  { value: '2', label: '2 (默认)' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5 (宽松)' },
];

const CREATIVE_STYLES = [
  { value: 'none', label: '原图' },
  { value: 'cinematic', label: '电影感' },
  { value: 'anime', label: '日漫风' },
  { value: 'cyberpunk', label: '赛博朋克' },
  { value: '3d-render', label: '3D大片' },
  { value: 'oil-painting', label: '古典油画' },
];

const SEEDREAM_RESOLUTION_TIERS = [
  { value: '2k', label: '2K' },
  { value: '3k', label: '3K' },
  { value: '4k', label: '4K' },
];

const AIViewPage: React.FC = () => {
  const location = useLocation();
  const { isDesktop } = useResponsive();
  const { membership } = useMembershipStore();
  const { isLoadingCloudFiles, fetchCloudFiles, softDeleteCloudFile, deleteFile } = useFileStore();
  const { permissions } = usePermission();
  const fetchProviderConfigs = useUnifiedAPIConfigStore((state) => state.fetchProviderConfigs);
  const providerConfigs = useUnifiedAPIConfigStore((state) => state.providerConfigs);

  const pageRef = useRef<HTMLDivElement>(null);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [autoEditingFromUrl, setAutoEditingFromUrl] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('queue');
  const [creationMode, setCreationMode] = useState<'video' | 'image'>('video');

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get('tab');
    const section = searchParams.get('section');
    const urlPrompt = searchParams.get('prompt');
    const autoEdit = searchParams.get('autoEdit');
    if (section === 'gallery' || tab === 'gallery') {
      setActiveSection('gallery');
    } else if (section === 'queue' || tab === 'queue') {
      setActiveSection('queue');
    }
    if (urlPrompt) {
      setPrompt(urlPrompt);
    }
    if (autoEdit === 'true') {
      setAutoEditingFromUrl(true);
    }
    const url = new URL(window.location.href);
    const transientParams = ['prompt', 'autoEdit', 'returnTo'];
    transientParams.forEach((key) => url.searchParams.delete(key));
    const nextSearch = url.searchParams.toString();
    window.history.replaceState({}, '', nextSearch ? `${url.pathname}?${nextSearch}` : url.pathname);
  }, [location.search]);

  useEffect(() => {
    if (activeSection === 'creation') {
      setActiveSection('queue');
    }
  }, [activeSection]);

  useEffect(() => {
    if (pageRef.current) {
      pageRef.current.scrollTop = 0;
      pageRef.current.scrollLeft = 0;
    }
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    requestAnimationFrame(() => {
      if (pageRef.current) {
        pageRef.current.scrollTop = 0;
        pageRef.current.scrollLeft = 0;
      }
      if (mainRef.current) {
        mainRef.current.scrollTop = 0;
      }
      if (mainContentRef.current) {
        mainContentRef.current.scrollTop = 0;
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    });
  }, [activeSection]);

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paramPanelOpen, setParamPanelOpen] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [mobileMaterialPlacement, setMobileMaterialPlacement] = useState<'top' | 'bottom'>('bottom');

  const [selectedVideoModel, setSelectedVideoModel] = useState('google_omni');
  const [selectedImageModel, setSelectedImageModel] = useState('doubao-seedream-5-0-pro');

  const [imageStyleParams] = useState(DEFAULT_IMAGE_STYLE_PARAMS);

  const importedFolderInfo = useMemo(() => ({
    name: '本地素材',
    count: creationMode === 'video' ? VIDEO_INSPIRATION_IMAGES.length : LOCAL_INSPIRATION_IMAGES.length,
  }), [creationMode]);

  const [params, setParams] = useState<UnifiedParams>({
    aspectRatio: '16:9',
    resolution: '720p',
    duration: 5,
    generationMode: 'text_to_video',
    motionStrength: 0.5,
    motionAmplitude: 'auto',
    cfgScale: 7.0,
    seed: -1,
    webSearch: false,
    returnLastFrame: false,
    audioGeneration: 'none',
    cameraMovement: 'auto',
    multiShot: false,
    viduStyle: 'general',
    filmEmulation: false,
    grainSize: 0,
    creativeStyle: 'none',
    characterConsistency: 0.8,
    referenceImages: [],
    referenceVideos: [],
    referenceAudios: [],
    imageCount: 1,
    promptEnhancer: true,
    promptOptimizer: false,
    hdMode: false,
    watermark: false,
    style: '',
    strength: 0.5,
    frameInterpolation: false,
    loopToggle: false,
    minimaxMotionLevel: 5,
    gptImageStyle: 'vivid',
    gptImageQuality: 'auto',
    thinkingLevel: 'minimal',
    imageSize: '1K',
    fluxFormat: 'jpeg',
    fluxSafety: 2,
    seedreamResolutionTier: '2k',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingLock = useRef(false);
  const [generations, setGenerations] = useState<GenerationItem[]>(() => loadGenerationsFromStorage());

  useEffect(() => {
    saveGenerationsToStorage(generations);
  }, [generations]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [selectedGeneration, setSelectedGeneration] = useState<GenerationItem | null>(null);
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'video' | 'image'>('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const currentMembershipLevel = membership?.membershipLevel || 'trial';

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const handleGenerateRef = useRef<() => void>(() => {});

  // ?LandingPage 接收提示词并自动执行
  useEffect(() => {
    const pendingPrompt = localStorage.getItem('jimeng_promptInput');
    
    if (pendingPrompt) {
      try {
        const parsedPrompt = JSON.parse(pendingPrompt);
        setPrompt(parsedPrompt);
        
        // 自动执行生成
        setTimeout(() => {
          handleGenerateRef.current();
        }, 800);
      } catch (e) {
        console.error('Failed to parse pending prompt', e);
      }
      
      localStorage.removeItem('jimeng_promptInput');
      localStorage.removeItem('jimeng_promptMode');
    }
  }, []);

  useEffect(() => {
    if (!autoEditingFromUrl) return;
    const timer = setTimeout(() => {
      handleGenerateRef.current();
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoEditingFromUrl, activeSection]);

  // 加载文件到FileStore
  const loadFilesFromStore = useCallback(() => {
    const storeFiles = useFileStore.getState().files;
    const historyItems: GenerationItem[] = storeFiles
      .filter((f) => f.type === 'video' || f.type === 'image')
      .map((f) => ({
        id: f.id,
        type: f.type as 'video' | 'image',
        prompt: f.name,
        status: 'done' as const,
        resultUrl: f.url,
        thumbnail: f.thumbnailUrl || f.url,
        createdAt: new Date(f.createdAt),
      }));
    if (historyItems.length > 0) {
      setGenerations((currentGenerations) => {
        const merged = mergeGenerations(currentGenerations, historyItems);
        return merged;
      });
    }
  }, []);

  // 定期同步云端文件
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      // 首次加载和切换到作品集时同步
      fetchCloudFiles();
    }
  }, [activeSection, membership?.isLoggedIn, fetchCloudFiles]);

  // ?FileStore 加载历史记录
  useEffect(() => {
    loadFilesFromStore();

    // 订阅 FileStore 变化，实时更新
    const unsubscribe = useFileStore.subscribe(() => {
      loadFilesFromStore();
    });

    return () => {
      unsubscribe();
    };
  }, [loadFilesFromStore]);

  useEffect(() => {
    fetchProviderConfigs();
  }, [fetchProviderConfigs]);

  const [videoModels, setVideoModels] = useState<UnifiedModelConfig[]>([]);
  const [imageModels, setImageModels] = useState<UnifiedModelConfig[]>([]);

  useEffect(() => {
    try {
      const vModels = unifiedAPIModelService
        .getModelsByType('video')
        .filter((m) => {
          if (EXCLUDED_VIDEO_MODELS.has(m.modelId)) return false;
          const modelId = (m.modelId || '').toLowerCase();
          const name = (m.modelInfo?.name || '').toLowerCase();
          const audioKeywords = ['speech', 'tts', 'music', 'audio', 'voice', 'sound', 'lyrics', 'cover'];
          if (audioKeywords.some(k => modelId.includes(k) || name.includes(k))) return false;
          const caps = (m.modelInfo?.capabilities || []).map((c: string) => c.toLowerCase());
          const hasVideoCap = caps.some((c: string) =>
            c.includes('video') || c.includes('text_to_video') || c.includes('image_to_video')
          );
          const videoKeywords = ['seedance', 'vidu', 'hailuo', 'video', 'cogvideox', 'pixverse', 'kling', 'google_omni', 'veo'];
          const hasVideoId = videoKeywords.some(k => modelId.includes(k));
          return hasVideoCap || hasVideoId;
        });
      setVideoModels(vModels);
    } catch (e) {
      console.warn('Failed to load video models on init', e);
    }
  }, [providerConfigs, EXCLUDED_VIDEO_MODELS]);

  useEffect(() => {
    try {
      setImageModels(unifiedAPIModelService.getModelsByType('image'));
    } catch (e) {
      console.warn('Failed to load image models on init', e);
    }
  }, [providerConfigs]);

  const isVideoMode = activeSection === 'creation';
  const models = isVideoMode ? videoModels : imageModels;
  const selectedModelId = isVideoMode ? selectedVideoModel : selectedImageModel;
  const currentModel = useMemo(
    () => models.find((m) => m.modelId === selectedModelId),
    [models, selectedModelId]
  );
  const accentColor = 'accent-primary';

  const dynamicOptions = useMemo(() => {
    if (!currentModel || !currentModel.modelInfo) {
      return {
        modes: isVideoMode ? GENERATION_MODES : IMAGE_GENERATION_MODES,
        resolutions: RESOLUTIONS,
        durations: DURATIONS,
        ratios: ASPECT_RATIOS,
        imageCounts: IMAGE_COUNTS,
        capabilities: [] as string[],
      };
    }

    const info = currentModel.modelInfo;
    const caps = info.capabilities || [];

    if (isVideoMode) {
      const maxRes = info.maxResolution || '1080p';
      const maxDur = info.maxDuration || 10;
      const supportedModes = info.supportedModes || [];

      const resRank: Record<string, number> = {
        '480p': 1,
        '720p': 2,
        '768p': 2.5,
        '1080p': 3,
        '2k': 4,
        '4k': 5,
      };
      const maxResKey = maxRes.toLowerCase().includes('4k')
        ? '4k'
        : maxRes.toLowerCase().includes('1080')
          ? '1080p'
          : maxRes.toLowerCase().includes('768')
            ? '768p'
            : maxRes.toLowerCase().includes('720')
              ? '720p'
              : maxRes.toLowerCase().includes('480')
                ? '480p'
                : maxRes.toLowerCase().includes('2k')
                  ? '2k'
                  : '1080p';

      const filteredRes = RESOLUTIONS.filter((r) => (resRank[r.value] || 0) <= (resRank[maxResKey] || 3));

      let filteredDurations = DURATIONS.filter((d) => d.value <= maxDur);
      if (info.supportedDurations) {
        filteredDurations = DURATIONS.filter(
          (d) => info.supportedDurations?.includes(d.value)
        );
      } else if (currentModel.provider === 'vidu') {
        filteredDurations = VIDU_DURATIONS;
      } else if (currentModel.provider === 'hailuo' && !filteredDurations.some((d) => d.value === 6)) {
        filteredDurations.push(DURATIONS.find((d) => d.value === 6)!);
      }

      let filteredModes = GENERATION_MODES.filter((mode) =>
        CAPABILITY_MODE_MAP[mode.value]?.some((cap) => caps.includes(cap))
      );

      if (Array.isArray(supportedModes) && supportedModes.length > 0) {
        const normalizedModes = supportedModes.map((s: string) => s.replace(/-/g, '_').toLowerCase());
        filteredModes = GENERATION_MODES.filter((m) => normalizedModes.includes(m.value));
      }

      if (filteredModes.length === 0) {
        filteredModes = GENERATION_MODES.filter((mode) =>
          CAPABILITY_MODE_MAP[mode.value]?.some((cap) => caps.includes(cap))
        );
      }

      let filteredRatios = ASPECT_RATIOS;
      if (info.supportedAspectRatios) {
        filteredRatios = ASPECT_RATIOS.filter((r) => info.supportedAspectRatios.includes(r.value));
      }

      return {
        modes: filteredModes,
        resolutions: filteredRes,
        durations: filteredDurations,
        ratios: filteredRatios,
        imageCounts: IMAGE_COUNTS,
        capabilities: caps,
      };
    }

    const supportedModes = info.supportedModes || {};
    let filteredImageModes = IMAGE_GENERATION_MODES;
    if (Array.isArray(supportedModes) && supportedModes.length > 0) {
      const normalizedModes = supportedModes.map((s: string) => s.replace(/-/g, '_').toLowerCase());
      filteredImageModes = IMAGE_GENERATION_MODES.filter((m) => normalizedModes.includes(m.value));
    } else if (supportedModes && typeof supportedModes === 'object' && !Array.isArray(supportedModes)) {
      const imageSupportedModes = supportedModes as Partial<
        Record<'textToImage' | 'imageToImage' | 'reference' | 'characterReference', boolean>
      >;
      filteredImageModes = IMAGE_GENERATION_MODES.filter((mode) => {
        if (mode.value === 'text_to_image') return Boolean(imageSupportedModes.textToImage);
        if (mode.value === 'image_to_image') return Boolean(imageSupportedModes.imageToImage);
        if (mode.value === 'reference') return Boolean(imageSupportedModes.reference);
        if (mode.value === 'character_reference') {
          return Boolean(imageSupportedModes.characterReference);
        }
        return true;
      });
    }

    const modelResolutions = getModelSupportedResolutions(currentModel.modelId);
    const filteredImageResolutions = modelResolutions.map((r) => ({
      value: r.value,
      label: r.label,
      aspectRatio: r.aspectRatio,
    }));

    const filteredImageRatios = info.supportedAspectRatios
      ? ASPECT_RATIOS.filter((r) => info.supportedAspectRatios.includes(r.value))
      : Array.from(new Set(modelResolutions.map((r) => r.aspectRatio))).map((ar) => ({
          value: ar,
          label: ar,
        }));

    return {
      modes: filteredImageModes,
      resolutions: filteredImageResolutions,
      durations: DURATIONS,
      ratios: filteredImageRatios.length > 0 ? filteredImageRatios : ASPECT_RATIOS,
      imageCounts: caps.includes('multi-image-output') ? IMAGE_COUNTS : [IMAGE_COUNTS[0]],
      capabilities: caps,
    };
  }, [currentModel, isVideoMode]);

  useEffect(() => {
    if (!currentModel) return;
    setParams((prev) => {
      const updates: Partial<UnifiedParams> = {};
      if (isVideoMode && !dynamicOptions.modes.some((m) => m.value === prev.generationMode)) {
        updates.generationMode = dynamicOptions.modes[0]?.value || 'text_to_video';
      }
      if (!isVideoMode && !dynamicOptions.modes.some((m) => m.value === prev.generationMode)) {
        updates.generationMode = dynamicOptions.modes[0]?.value || 'text_to_image';
      }
      if (!dynamicOptions.resolutions.some((r) => r.value === prev.resolution)) {
        updates.resolution =
          dynamicOptions.resolutions.find((r) => r.value === '2k')?.value ||
          dynamicOptions.resolutions.find((r) => r.value === '1080p')?.value ||
          dynamicOptions.resolutions[0].value;
      }
      if (
        isVideoMode &&
        prev.duration !== -1 &&
        !dynamicOptions.durations.some((d) => d.value === prev.duration)
      ) {
        updates.duration =
          dynamicOptions.durations.find((d) => d.value === 10)?.value ||
          dynamicOptions.durations[0].value;
      }
      if (!dynamicOptions.ratios.some((r) => r.value === prev.aspectRatio)) {
        updates.aspectRatio = dynamicOptions.ratios[0]?.value || '16:9';
      }

      const caps = dynamicOptions.capabilities;
      if (!caps.includes('motion-amplitude') && prev.motionAmplitude !== 'auto') {
        updates.motionAmplitude = 'auto';
      }
      if (!caps.includes('vidu-style') && prev.viduStyle !== 'general') {
        updates.viduStyle = 'general';
      }
      if (!caps.includes('audio-generation') && prev.audioGeneration !== 'none') {
        updates.audioGeneration = 'none';
      }
      if (!caps.includes('web-search') && prev.webSearch) {
        updates.webSearch = false;
      }
      if (!caps.includes('return-last-frame') && prev.returnLastFrame) {
        updates.returnLastFrame = false;
      }
      if (!caps.includes('frame-interpolation') && prev.frameInterpolation) {
        updates.frameInterpolation = false;
      }
      if (!caps.includes('loop-video') && prev.loopToggle) {
        updates.loopToggle = false;
      }
      if (!caps.includes('creative-style') && prev.creativeStyle !== 'none') {
        updates.creativeStyle = 'none';
      }
      if (!caps.includes('film-emulation') && prev.filmEmulation) {
        updates.filmEmulation = false;
      }
      if (!caps.includes('grain-control') && prev.grainSize !== 0) {
        updates.grainSize = 0;
      }
      if (!caps.includes('style-control') && prev.style !== 'none') {
        updates.style = 'none';
      }
      if (!caps.includes('character-reference') && prev.characterConsistency !== 0.8) {
        updates.characterConsistency = 0.8;
      }
      if (!caps.includes('watermark') && prev.watermark) {
        updates.watermark = false;
      }
      if (!caps.includes('hd-mode') && prev.hdMode) {
        updates.hdMode = false;
      }
      if (!caps.includes('multi-image-output') && prev.imageCount !== 1) {
        updates.imageCount = 1;
      }
      if (Object.keys(updates).length > 0) return { ...prev, ...updates };
      return prev;
    });
  }, [currentModel, dynamicOptions, isVideoMode]);

  const expectedPoints = useMemo(() => {
    if (isVideoMode) {
      return calculateVideoExpectedPoints(
        selectedVideoModel,
        params.resolution,
        params.duration,
        currentMembershipLevel
      );
    }
    // 图片积分计算
    if (currentModel?.modelId === 'image-01') return 40;
    if (currentModel?.modelId === 'doubao-seedream-5-0-pro') return 30;
    if (currentModel?.modelId === 'sensenova-u1-fast') return 5 * (params.imageCount || 1);
    if (currentModel?.modelId === 'flux') return 50;
    if (currentModel?.modelId === 'seedream-5.0-lite') return 40;
    return 100;
  }, [
    isVideoMode,
    selectedVideoModel,
    currentModel?.modelId,
    params.resolution,
    params.duration,
    params.imageCount,
    currentMembershipLevel,
  ]);

  const currentProvider = currentModel?.provider || '';
  const currentModelId = currentModel?.modelId || '';
  const isViduFamily = currentModelId.includes('vidu');
  const isHailuoFamily = currentProvider === 'hailuo' || currentModelId.includes('hailuo');
  const isDoubaoFamily = currentProvider === 'doubao';
  const isMinimaxImageFamily = !isVideoMode && currentProvider === 'minimax';
  const isSeedreamFamily =
    !isVideoMode &&
    (currentModelId.includes('seedream') || currentModelId.includes('doubao-seedream'));

  const supportsPromptOptimization = isVideoMode
    ? dynamicOptions.capabilities.includes('prompt-enhancer') &&
      !dynamicOptions.capabilities.includes('no-enhancer')
    : dynamicOptions.capabilities.includes('prompt-optimizer') ||
      dynamicOptions.capabilities.includes('prompt-enhancer');
  const supportsNegativePrompt = dynamicOptions.capabilities.includes('negative-prompt');
  const promptOptimizationStrategy: PromptOptimizationStrategy = isVideoMode
    ? isHailuoFamily
        ? {
            category: 'cinema-director',
            useStructuredBuilder: true,
            buttonLabel: 'Hailuo 电影优化',
            helperText: '强化电影感运镜、动态层次和画面氛围',
          }
        : isViduFamily
          ? {
              category: 'cinematic',
              useStructuredBuilder: false,
              buttonLabel: 'Vidu 镜头优化',
              helperText: 'Vidu 的动作幅度、运镜和画面风格优化',
            }
          : isDoubaoFamily
            ? {
                category: 'film-director',
                useStructuredBuilder: false,
                buttonLabel: '豆包影视优化',
                helperText: '面向 Seedance 的叙事、镜头和节奏进行综合优化',
              }
            : {
                category: 'film-director',
                useStructuredBuilder: false,
                buttonLabel: '视频提示词优化',
                helperText: '使用综合型影视创作链路优化视频描述',
              }
    : isSeedreamFamily
      ? {
          category: 'cinema-director',
          useStructuredBuilder: true,
          buttonLabel: 'Seedream 画面润色',
          helperText: '补强构图、光影、色调和画面氛围',
        }
      : isMinimaxImageFamily
        ? {
            category: 'cinema-director',
            useStructuredBuilder: true,
            buttonLabel: 'MiniMax 构图优化',
            helperText: '针对构图、镜头感和细节质感进行图片优化',
          }
        : {
            category: 'cinema-director',
            useStructuredBuilder: true,
            buttonLabel: '图片提示词优化',
            helperText: '补强构图、光影、风格和细节描述',
          };

  useEffect(() => {
    if (!supportsNegativePrompt && negativePrompt) {
      setNegativePrompt('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- negativePrompt is intentionally excluded: the effect only needs to react to supportsNegativePrompt changes
  }, [supportsNegativePrompt]);

  const buildImagePrompt = useCallback(() => {
    const parts: string[] = [];
    const userPrompt = prompt.trim();
    if (userPrompt) parts.push(userPrompt);

    const style = IMAGE_ART_STYLES.find(s => s.id === imageStyleParams.artStyle);
    if (style) parts.push(style.prompt);

    const light = IMAGE_LIGHTING.find(l => l.id === imageStyleParams.lighting);
    if (light) parts.push(light.prompt);

    const comp = IMAGE_COMPOSITION.find(c => c.id === imageStyleParams.composition);
    if (comp) parts.push(comp.prompt);

    const med = IMAGE_MEDIUM.find(m => m.id === imageStyleParams.medium);
    if (med) parts.push(med.prompt);

    const color = IMAGE_COLOR_MOODS.find(c => c.id === imageStyleParams.colorMood);
    if (color) parts.push(color.prompt);

    const cam = IMAGE_CAMERA_SETTINGS.find(c => c.id === imageStyleParams.cameraSetting);
    if (cam && cam.prompt) parts.push(cam.prompt);

    const dof = IMAGE_DEPTH_OF_FIELD.find(d => d.id === imageStyleParams.dof);
    if (dof && dof.prompt) parts.push(dof.prompt);

    const detail = IMAGE_DETAIL_LEVELS.find(d => d.id === imageStyleParams.detailLevel);
    if (detail && detail.prompt) parts.push(detail.prompt);

    if (imageStyleParams.customKeywords.trim()) parts.push(imageStyleParams.customKeywords.trim());

    return parts.join(', ');
  }, [prompt, imageStyleParams]);

  const handleGenerate = async () => {
    if (isGeneratingLock.current) return;
    isGeneratingLock.current = true;
    const finalPrompt = !isVideoMode ? buildImagePrompt() : prompt.trim();
    if (!finalPrompt) { isGeneratingLock.current = false; return; }
    const feature: QuotaFeature = isVideoMode ? 'video' : 'image';
    const quota = await checkQuotaOrFail(feature, permissions);
    if (!quota.allowed) {
      toast.error(quota.message);
      isGeneratingLock.current = false;
      return;
    }

    setIsGenerating(true);

    // 自动保存提示词到后端
    fetch('/api/v1/prompt-logs/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: finalPrompt,
        negativePrompt: negativePrompt || '',
        model: currentModel?.modelId || '',
        provider: currentModel?.provider || '',
        type: isVideoMode ? 'video' : 'image',
        source: 'ai-view',
      }),
    }).catch((error) => {
      // 提示词日志保存失败不应阻塞生成流程，但记录错误便于排查
      console.warn('[AIView] 提示词日志保存失败:', error);
    });

    const newItem: GenerationItem = {
      id: `task-${Date.now()}`,
      type: isVideoMode ? 'video' : 'image',
      prompt: finalPrompt,
      status: 'generating',
      createdAt: new Date(),
    };
    setGenerations((prev) => [newItem, ...prev]);
    setActiveSection('queue');

    try {
      const sanitizedParams: UnifiedParams = {
        ...params,
        motionAmplitude: dynamicOptions.capabilities.includes('motion-amplitude')
          ? params.motionAmplitude
          : 'auto',
        viduStyle: dynamicOptions.capabilities.includes('vidu-style')
          ? params.viduStyle
          : 'general',
        audioGeneration: dynamicOptions.capabilities.includes('audio-generation')
          ? params.audioGeneration
          : 'none',
        webSearch: dynamicOptions.capabilities.includes('web-search') ? params.webSearch : false,
        returnLastFrame: dynamicOptions.capabilities.includes('return-last-frame')
          ? params.returnLastFrame
          : false,
        frameInterpolation: dynamicOptions.capabilities.includes('frame-interpolation')
          ? params.frameInterpolation
          : false,
        loopToggle: dynamicOptions.capabilities.includes('loop-video') ? params.loopToggle : false,
        creativeStyle: dynamicOptions.capabilities.includes('creative-style')
          ? params.creativeStyle
          : 'none',
        filmEmulation: dynamicOptions.capabilities.includes('film-emulation')
          ? params.filmEmulation
          : false,
        grainSize: dynamicOptions.capabilities.includes('grain-control') ? params.grainSize : 0,
        style: dynamicOptions.capabilities.includes('style-control') ? params.style : 'none',
        characterConsistency: dynamicOptions.capabilities.includes('character-reference')
          ? params.characterConsistency
          : 0.8,
        hdMode: dynamicOptions.capabilities.includes('hd-mode') ? params.hdMode : false,
        watermark: dynamicOptions.capabilities.includes('watermark') ? params.watermark : false,
        imageCount: params.imageCount,
        promptEnhancer: supportsPromptOptimization ? params.promptEnhancer : false,
        promptOptimizer: dynamicOptions.capabilities.includes('prompt-optimizer')
          ? params.promptOptimizer
          : false,
        multiShot: dynamicOptions.capabilities.includes('omni-video') ? params.multiShot : false,
      };

      const executeParams = {
        ...sanitizedParams,
        modelProvider: currentModel?.provider,
        modelId: currentModel?.modelId,
        prompt: finalPrompt,
        negativePrompt: supportsNegativePrompt ? negativePrompt : '',
      };

      const result = isVideoMode
        ? await realAPIExecutor.executeVideoGen({
            id: newItem.id,
            params: executeParams as VideoGenerationParams,
          })
        : await realAPIExecutor.executeImageGen({
            id: newItem.id,
            params: executeParams as ImageGenerationParams,
          });

      setGenerations((prev) =>
        prev.map((item) =>
          item.id === newItem.id
            ? {
                ...item,
                status:
                  result.status === 'completed'
                    ? 'done'
                    : result.status === 'failed'
                      ? 'failed'
                      : 'generating',
                resultUrl: result.resultUrl,
                thumbnail: isVideoMode
                  ? ((result as any).thumbnailUrl
                    ? (result as any).thumbnailUrl
                    : undefined)
                  : result.resultUrl,
                error: result.error,
              }
            : item
        )
      );

      if (result.status === 'completed') {
        toast.success('生成成功，已同步至我的作品');

        // 检查是否需要回到LandingPage
        const returnTo = new URLSearchParams(window.location.search).get('returnTo');
        if (returnTo === 'landing' && result.resultUrl) {
          // 保存生成结果到localStorage，通知 LandingPage
          const generatedResult = {
            url: result.resultUrl,
            type: isVideoMode ? 'video' : 'image',
            prompt: prompt.trim(),
            timestamp: Date.now(),
          };
          localStorage.setItem('jimeng_generated_result', JSON.stringify(generatedResult));
        }

        if (result.resultUrl) {
          const fileType = isVideoMode ? 'video' : 'image';
          const timestamp = new Date().toLocaleString('zh-CN', { 
            year: 'numeric', month: '2-digit', day: '2-digit', 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
          }).replace(/[/:]/g, '-').replace(/,/g, '');
          const fileName = `${isVideoMode ? '视频' : '图片'}_${timestamp}.${isVideoMode ? 'mp4' : 'png'}`;
          const modelName = currentModel?.modelInfo?.name || currentModelId || 'unknown';
          const modelProvider = currentModel?.provider || 'unknown';

          void useFileStore.getState().registerGeneratedFile({
            name: fileName,
            type: fileType,
            url: result.resultUrl,
            thumbnailUrl: (result as any as { thumbnailUrl?: string }).thumbnailUrl || result.resultUrl,
            size: (result as any as { size?: number }).size || 0,
            metadata: {
              format: isVideoMode ? 'video/mp4' : 'image/png',
              model: modelName,
              provider: modelProvider,
              prompt: prompt.trim(),
              generationId: newItem.id,
            },
          });
        }

        // 强制刷新会员积分显示
        useMembershipStore.getState().refreshMembership();

        if (result.status === 'completed' && autoEditingFromUrl && isVideoMode && result.resultUrl) {
          toast.success('视频生成完成，正在准备自动剪辑...', { duration: 3000 });
          setTimeout(() => {
            navigateTo('/1?autoEdit=true&videoUrl=' + encodeURIComponent(result.resultUrl || ''));
          }, 1500);
        }
      } else if (result.status === 'failed') {
        toast.error(`生成失败: ${result.error}`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      toast.error(`执行出错: ${errorMessage}`);
      setGenerations((prev) =>
        prev.map((item) =>
          item.id === newItem.id ? { ...item, status: 'failed', error: errorMessage } : item
        )
      );
    } finally {
      isGeneratingLock.current = false;
      setIsGenerating(false);
    }
  };
  handleGenerateRef.current = handleGenerate;

  const handleOptimize = async () => {
    if (!prompt.trim()) return;
    const quota = await checkQuotaOrFail('prompt', permissions);
    if (!quota.allowed) {
      toast.error(quota.message);
      return;
    }
    setIsOptimizing(true);
    setOptimizeError(null);

    try {
      const scenario = isVideoMode ? 'video' : 'image';
      let contentToOptimize = prompt.trim();
      let structuredFallback = '';

      if (promptOptimizationStrategy.useStructuredBuilder) {
        const { cinemaPromptBuilder } = await import('@/services/cinema-prompt-builder');
        const structured = cinemaPromptBuilder.build({
          subject: prompt.trim(),
          mode: scenario,
        });

        contentToOptimize = structured.expandedPrompt;
        structuredFallback = structured.expandedPrompt;

        if (!negativePrompt.trim() && supportsNegativePrompt && structured.negativePrompt) {
          setNegativePrompt(structured.negativePrompt);
        }
      }

      const promptBasedCategory = classifyPromptAgent(contentToOptimize, scenario);
      const effectiveCategory = promptBasedCategory || promptOptimizationStrategy.category;
      const result = await promptOptimizerService.optimizePrompt(
        contentToOptimize,
        scenario,
        effectiveCategory
      );

      if (result.success && result.optimizedPrompt) {
        setPrompt(result.optimizedPrompt);
        toast.success('提示词优化完成');
        return;
      }

      if (structuredFallback) {
        setPrompt(structuredFallback);
        setOptimizeError('大模型优化暂时不可用，已回退为结构化扩写结果');
        toast.warning('已使用结构化扩写作为降级结果');
        return;
      }

      throw new Error(result.error || '优化失败');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '优化服务暂时不可用';
      console.error('[AIView] 提示词优化失', error);
      setOptimizeError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleDelete = useCallback((id: string) => {
    if (!id) {
      console.error('[AIView] Delete: invalid id');
      return;
    }
    if (!confirm('确定要删除这个作品吗?')) return;
    
    const currentGenerations = generations ?? [];
    const updated = currentGenerations.filter((g) => g.id !== id);
    setGenerations(updated);
    saveGenerationsToStorage(updated);
    
    try {
      deleteFile(id);
      softDeleteCloudFile(id);
    } catch (e) {
      console.warn('[AIView] FileStore delete error:', e);
    }
    
    toast.success('已删除');
  }, [generations, deleteFile, softDeleteCloudFile]);

  const navigateToCreationWithMode = useCallback((_mode: 'video' | 'image', itemPrompt: string) => {
    setPrompt(itemPrompt);
    setActiveSection('queue');
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, []);

  const filteredGenerations = useMemo(() => {
    const doneItems = generations.filter((g) => g.status === 'done');
    if (galleryFilter === 'all') return doneItems;
    return doneItems.filter((g) => g.type === galleryFilter);
  }, [generations, galleryFilter]);
  const isCompactLayout = !isDesktop;
  const materialPlacement = isCompactLayout ? mobileMaterialPlacement : 'top';
  const isSectionNavActive = (id: SectionId) => activeSection === id;

  const navItems = [
    {
      id: 'queue' as SectionId,
      label: '任务队列',
      icon: Clock,
      badge: generations.filter((g) => g.status === 'generating').length || null,
    },
    { id: 'gallery' as SectionId, label: '我的作品', icon: LayoutGrid },
  ];

  useEffect(() => {
    if (isDesktop) {
      setSidebarOpen(false);
      setParamPanelOpen(false);
    }
  }, [isDesktop]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  const handleCopyPrompt = useCallback((item: InspirationItem) => {
    navigator.clipboard.writeText(item.prompt).then(() => {
      setCopiedId(item.id);
      toast.success('提示词已复制到剪贴板');
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      toast.error('复制失败');
    });
  }, []);

  const handleGenerateSingleImage = useCallback(async (item: InspirationItem) => {
    if (generatingId) return;
    setGeneratingId(item.id);
    toast.loading(`正在为「${item.title}」生成图片..`, { id: 'generate-image' });

    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/image/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: item.prompt,
          model: 'image-01',
          aspectRatio: '16:9',
          imageCount: 1,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `API Error: ${response.status}`);
      }

      if (result.data?.status === 'failed' || result.data?.error) {
        throw new Error(result.data.error || '图片生成失败');
      }

      const imageUrl = result.data?.resultUrl;

      if (imageUrl) {
        const index = LOCAL_INSPIRATION_IMAGES.findIndex(img => img.id === item.id);
        if (index !== -1) {
          setLocalInspirationImages(prev => prev.map((img, i) => i === index ? { ...img, src: imageUrl } : img));
          toast.success(`「${item.title}」图片生成成功！`, { id: 'generate-image' });
        }
      } else {
        throw new Error(result.data?.error || '未获取到图片URL');
      }
    } catch (error) {
      console.error('生成失败:', error);
      toast.error(`「${item.title}」生成失败: ${error instanceof Error ? error.message : '未知错误'}`, { id: 'generate-image' });
    } finally {
      setGeneratingId(null);
    }
  }, [generatingId]);

  const handleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleCopyPromptStable = useCallback((e: React.MouseEvent, item: InspirationItem) => {
    e.stopPropagation();
    handleCopyPrompt(item);
  }, [handleCopyPrompt]);

  const handleGenerateStable = useCallback((e: React.MouseEvent, item: InspirationItem) => {
    e.stopPropagation();
    handleGenerateSingleImage(item);
  }, [handleGenerateSingleImage]);

  const [localInspirationImages, setLocalInspirationImages] = useState(
    () => creationMode === 'video' ? VIDEO_INSPIRATION_IMAGES : LOCAL_INSPIRATION_IMAGES
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  useEffect(() => {
    setLocalInspirationImages(
      creationMode === 'video' ? VIDEO_INSPIRATION_IMAGES : LOCAL_INSPIRATION_IMAGES
    );
  }, [creationMode]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingCount(files.length);
    const newImages: typeof LOCAL_INSPIRATION_IMAGES = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        toast.error(`文件 ${file.name} 不是图片格式`);
        continue;
      }

      try {
        const reader = new FileReader();
        const imageData = await new Promise<{ src: string; title: string; id: string }>((resolve, reject) => {
          reader.onload = (e) => {
            const id = `uploaded_${Date.now()}_${i}`;
            resolve({
              id,
              src: e.target?.result as string,
              title: file.name.replace(/\.[^/.]+$/, ''),
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newImages.push({
          ...imageData,
          prompt: '',
        });
      } catch (error) {
        console.error('读取文件失败:', error);
        toast.error(`读取文件 ${file.name} 失败`);
      }
    }

    if (newImages.length > 0) {
      setLocalInspirationImages((prev) => [...prev, ...newImages]);
      toast.success(`成功上传 ${newImages.length} 张图片`);
    }

    setUploadingCount(0);
    if (event.target) {
      event.target.value = '';
    }
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const [imageUrlInput, setImageUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleAddImageFromUrl = useCallback(() => {
    if (!imageUrlInput.trim()) {
      toast.error('请输入图片链接');
      return;
    }

    const url = imageUrlInput.trim();
    const isValidUrl = url.startsWith('http://') || url.startsWith('https://');

    if (!isValidUrl) {
      toast.error('请输入有效的图片链接（以 http:// ?https:// 开头）');
      return;
    }

    const id = `url_${Date.now()}`;
    const urlParts = url.split('/');
    const fileName = urlParts[urlParts.length - 1] || '网络图片';
    const title = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    setLocalInspirationImages((prev) => [
      ...prev,
      {
        id,
        src: url,
        title,
        prompt: '',
      },
    ]);

    toast.success('成功添加图片链接');
    setImageUrlInput('');
    setShowUrlInput(false);
  }, [imageUrlInput]);

  const handleUrlKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddImageFromUrl();
    }
  }, [handleAddImageFromUrl]);

  const [isLoadingShowcase, setIsLoadingShowcase] = useState(false);

  const handleLoadShowcaseImages = useCallback(async () => {
    setIsLoadingShowcase(true);
    
    try {
      const showcaseImages = [
        { id: '11', src: '/showcase-images/1.webp', title: '图片智能编辑' },
        { id: '12', src: '/showcase-images/2.webp', title: 'AI音乐创作' },
        { id: '13', src: '/showcase-images/3.webp', title: '视频剪辑工具' },
        { id: '14', src: '/showcase-images/4.webp', title: '智能配音系统' },
        { id: '15', src: '/showcase-images/5.webp', title: '批量处理引擎' },
        { id: '16', src: '/showcase-images/6.webp', title: 'AI角色设计' },
        { id: '17', src: '/showcase-images/7.webp', title: '场景概念' },
        { id: '18', src: '/showcase-images/8.webp', title: '3D模型渲染' },
        { id: '19', src: '/showcase-images/9.webp', title: '动态海报' },
        { id: '20', src: '/showcase-images/11.webp', title: 'AI绘画工作流' },
        { id: '21', src: '/showcase-images/12.webp', title: '视频特效合成' },
        { id: '22', src: '/showcase-images/13.webp', title: '智能文案生成' },
        { id: '23', src: '/showcase-images/14.webp', title: '虚拟主播' },
        { id: '24', src: '/showcase-images/15.webp', title: 'AI音效设计' },
      ];

      const formattedImages = showcaseImages.map((img) => ({
        id: img.id,
        src: img.src,
        title: img.title,
        prompt: '',
      }));

      setLocalInspirationImages((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newImages = formattedImages.filter((img) => !existingIds.has(img.id));
        return [...prev, ...newImages];
      });

      toast.success(`成功加载 ${showcaseImages.length} 张示例图片`);
    } catch (error) {
      console.error('加载示例图片失败:', error);
      toast.error('加载示例图片失败');
    } finally {
      setIsLoadingShowcase(false);
    }
  }, []);

  const localInspirationImagesRef = useRef(localInspirationImages);
  localInspirationImagesRef.current = localInspirationImages;

  const handleBatchGenerate = useCallback(async () => {
    if (isBatchGenerating) return;
    setIsBatchGenerating(true);
    toast.loading('正在批量生成图片，请耐心等待...', { id: 'batch-generate' });

    const currentImages = [...localInspirationImagesRef.current];
    let successCount = 0;
    const totalCount = currentImages.length;
    const token = getAuthToken();

    for (let i = 0; i < currentImages.length; i++) {
      const item = currentImages[i];
      toast.loading(`正在生成 ${i + 1}/${totalCount}: ${item.title}...`, { id: 'batch-generate' });

      try {
        const response = await fetch(`${API_BASE_URL}/image/generate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: item.prompt,
            model: 'image-01',
            aspectRatio: '16:9',
            imageCount: 1,
          }),
        });

        const result = await response.json();
        if (response.ok && result.success) {
          const imageUrl = result.data?.resultUrl;
          if (imageUrl) {
            currentImages[i] = {
              ...currentImages[i],
              src: imageUrl,
            };
            successCount++;
          }
        }
      } catch (error) {
        console.error(`生成失败 ${item.title}:`, error);
      }

      if (i < currentImages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }

    setLocalInspirationImages(currentImages);
    setIsBatchGenerating(false);
    
    if (successCount > 0) {
      toast.success(`批量生成完成！成功${successCount}/${totalCount} 张`, { id: 'batch-generate' });
      const resultCode = `const LOCAL_INSPIRATION_IMAGES = ${JSON.stringify(currentImages, null, 2)};`;
      navigator.clipboard.writeText(resultCode).then(() => {
        toast.success('生成代码已复制到剪贴板，请更新AIViewPage.tsx', { id: 'copy-result' });
      });
    } else {
      toast.error('批量生成失败，请检查网络连接', { id: 'batch-generate' });
    }
  }, [isBatchGenerating]);

  const handleToggleMaterialPlacement = useCallback(() => {
    setMobileMaterialPlacement((prev) => (prev === 'top' ? 'bottom' : 'top'));
  }, []);

  const handleToggleUrlInput = useCallback(() => {
    setShowUrlInput((prev) => !prev);
  }, []);

  const handleImageUrlInputChange = useCallback((value: string) => {
    setImageUrlInput(value);
  }, []);

  const MobileQuickStart = () => {
    if (!isCompactLayout) return null;

    return (
      <div className="mb-4 rounded-2xl border border-gray-800 bg-gray-950/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white">开始创作</p>
            <p className="mt-1 text-xs text-white">AI 智能图片视频创作</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {[

            { id: 'queue' as SectionId, label: '任务队列', icon: Clock },
            { id: 'gallery' as SectionId, label: '我的作品', icon: LayoutGrid },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
                isSectionNavActive(item.id)
                  ? 'border-gray-800 bg-gray-950/80 text-white'
                  : 'border-gray-800 bg-gray-950/80 text-white'
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-elevated/5">
                <item.icon size={18} fill="currentColor" strokeWidth={1.5} />
              </div>
              <span className="text-sm font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const MobileParamsPanel = () => {
    if (!isCompactLayout || activeSection !== 'creation') {
      return null;
    }

    return (
      <div className="mb-4 rounded-2xl border border-gray-800 bg-gray-950/80 p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white">
              {isVideoMode ? '视频生成参数' : '图片生成参数'}
            </p>
            <p className="mt-1 text-xs text-white">
              直接在这里调整核心选项，更多参数可继续展开
            </p>
          </div>
          <button
            onClick={() => setParamPanelOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-800 bg-gray-950/80 px-3 py-1.5 text-xs font-semibold text-white"
          >
            <SlidersHorizontal size={14} />
            更多参数
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white uppercase tracking-wider">
              模型
            </label>
            <div className="relative">
              <select
                value={selectedModelId}
                onChange={(e) =>
                  isVideoMode
                    ? setSelectedVideoModel(e.target.value)
                    : setSelectedImageModel(e.target.value)
                }
                
                className="w-full h-11 px-3 pr-10 bg-gray-950/80 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/50/50 appearance-none transition-all"
              >
                {models.map((m) => (
                  <option key={m.modelId} value={m.modelId} className="bg-gray-950/80 text-white">
                    {m.modelInfo?.name || m.modelId}
                  </option>
                ))}
              </select>
                      <ChevronDown
                        size={20}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white pointer-events-none"
                      />
            </div>
            {currentModel?.modelInfo?.description && (
              <p className="text-[11px] text-white line-clamp-2">
                {currentModel.modelInfo.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                生成模式
              </label>
              <div className="relative">
                <select
                  value={params.generationMode}
                  onChange={(e) => setParams({ ...params, generationMode: e.target.value })}
                  
                  className="w-full h-11 px-3 pr-10 bg-gray-950/80 border border-gray-800 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/50/50 appearance-none"
                >
                  {dynamicOptions.modes.map((mode) => (
                    <option key={mode.value} value={mode.value} className="bg-gray-950/80 text-white">
                      {mode.label}
                    </option>
                  ))}
                </select>
                              <ChevronDown
                                size={18}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white pointer-events-none"
                              />
              </div>
            </div>

            {isVideoMode && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                时长
              </label>
              <div className="relative">
                <select
                  value={params.duration}
                  onChange={(e) =>
                    setParams({
                      ...params,
                      duration: Number(e.target.value),
                    })
                  }
                  
                  className="w-full h-11 px-3 pr-10 bg-gray-950/80 border border-gray-800 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/50/50 appearance-none"
                >
                  {dynamicOptions.durations.map((item) => (
                    <option key={item.value} value={item.value} className="bg-gray-950/80 text-white">
                      {item.label}
                    </option>
                  ))}
                </select>
                              <ChevronDown
                                size={18}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white pointer-events-none"
                              />
              </div>
            </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                分辨
              </label>
              <div className="relative">
                <select
                  value={params.resolution}
                  onChange={(e) => setParams({ ...params, resolution: e.target.value })}
                  
                  className="w-full h-11 px-3 pr-10 bg-gray-950/80 border border-gray-800 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/50/50 appearance-none"
                >
                  {dynamicOptions.resolutions.map((resolution) => (
                    <option
                      key={resolution.value}
                      value={resolution.value}
                      className="bg-gray-950/80 text-white"
                    >
                      {resolution.label}
                    </option>
                  ))}
                </select>
                              <ChevronDown
                                size={18}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white pointer-events-none"
                              />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                画面比例
              </label>
              <div className="relative">
                <select
                  value={params.aspectRatio}
                  onChange={(e) => setParams({ ...params, aspectRatio: e.target.value })}
                  
                  className="w-full h-11 px-3 pr-10 bg-gray-950/80 border border-gray-800 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/50/50 appearance-none"
                >
                  {dynamicOptions.ratios.map((ratio) => (
                    <option key={ratio.value} value={ratio.value} className="bg-gray-950/80 text-white">
                      {ratio.label}
                    </option>
                  ))}
                </select>
                              <ChevronDown
                                size={18}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white pointer-events-none"
                              />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MobilePromptPanel = () => {
    if (!isCompactLayout || activeSection !== 'creation') {
      return null;
    }

    return (
      <div className="mb-4 rounded-2xl border border-gray-800 bg-elevated/95 p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-white">
              {isVideoMode ? '视频提示词' : '图片提示词'}
            </p>
            <p className="mt-1 text-[11px] text-white">
              {isVideoMode ? '默认直接开始视频生成' : '输入描述后直接生成图片'}
            </p>
          </div>
          <span
            className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-white bg-gradient-primary"
          >
            {isVideoMode ? '生成视频' : '生成图片'}
          </span>
        </div>

        <div className="relative group">
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <button
              onClick={handleOptimize}
              disabled={isOptimizing || !prompt.trim()}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all',
                isVideoMode
                  ? 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
                  : 'bg-gray-50 text-white hover:bg-[#6d28d9]',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
              title={promptOptimizationStrategy.helperText}
            >
              {isOptimizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} fill="currentColor" strokeWidth={1.5} />}
              {isOptimizing ? '优化中' : '优化'}
            </button>
          </div>

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                isVideoMode
                  ? '描述视频内容，例如：阳光穿过树叶缝隙，一只橘猫在草地上打滚，电影质感'
                  : '描述图片内容，例如：赛博朋克风格未来城市，雨夜街道，霓虹倒影'
              }
              className={cn(
                'w-full rounded-2xl border border-gray-800 bg-gray-950/80 p-4 pt-12 text-sm text-white placeholder:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/50/50 resize-none transition-all',
                isPromptExpanded ? 'min-h-[300px]' : 'min-h-[200px]'
              )}
              rows={isPromptExpanded ? 14 : 8}
            />
            <button
              onClick={() => setIsPromptExpanded(!isPromptExpanded)}
              className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-elevated/5 hover:bg-elevated/5 border border-gray-800 text-white hover:text-white transition-all"
              title={isPromptExpanded ? '收起' : '展开'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn('transition-transform', isPromptExpanded && 'rotate-180')}
              >
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>
            <div className="absolute bottom-3 left-3 text-[10px] font-medium text-white">
              {prompt.length} / 2000
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[11px] text-white">
          <Sparkles size={12} fill="currentColor" strokeWidth={1.5} className={cn(isVideoMode ? 'text-white' : 'text-white')} />
          <span>{promptOptimizationStrategy.helperText}</span>
        </div>

        <div className="mt-3">
          <p className="mb-2 text-xs font-medium text-white">快速灵感</p>
          <div className="flex flex-wrap gap-2">
            {CINE_PRESETS.slice(0, isVideoMode ? 4 : 4).map((preset) => (
              <button
                key={preset.id}
                onClick={() =>
                  setPrompt((prev) =>
                    prev ? `${prev}?{preset.name}?{preset.desc}` : `${preset.name}?{preset.desc}`
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-950/80 px-2.5 py-1.5 text-xs font-medium text-white transition-all hover:border-accent-primary/30 hover:bg-gray-50/10 hover:text-white"
              >
                <preset.icon size={12} fill="currentColor" strokeWidth={1.5} style={{ color: preset.color }} className="genre-icon-glow" />
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="flex-1 rounded-xl py-3.5 text-[13px] font-medium text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(135deg, ${accentColor} 0%, ${
                isVideoMode ? 'accent-primary' : 'accent-primary'
              } 100%)`,
              boxShadow: `0 8px 32px rgba(59, 130, 246, 0.35), 0 0 60px rgba(59, 130, 246, 0.15)`,
            }}
          >
            {isGenerating ? (
              <>
                <div className="relative w-5 h-5">
                  <svg className="w-5 h-5 -rotate-90 ai-progress-ring" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                    <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="50.3" strokeDashoffset="12.6" strokeLinecap="round" className="transition-all duration-300" />
                  </svg>
                </div>
                生成中..
              </>
            ) : (
              <>
                <Sparkles size={18} fill="currentColor" strokeWidth={1.5} className="text-white" /> {isVideoMode ? '生成视频' : '生成图片'}
              </>
            )}
          </button>
          {isVideoMode && (
            <div className="shrink-0 rounded-2xl border border-gray-800 bg-gray-50/10 px-3 py-2.5 text-[11px] font-bold text-white">
              {expectedPoints} 积分
            </div>
          )}
        </div>
      </div>
    );
  };

return (
    <div
      ref={pageRef}
      className={cn(
        'relative w-full flex flex-col lg:flex-row bg-gray-950 text-white font-sans overflow-x-hidden ai-view-bg ai-view-responsive-shell',
        ['queue', 'gallery'].includes(activeSection) && 'ai-view-theme-poster-dark',
        isDesktop ? 'h-screen overflow-hidden' : 'h-[100dvh] overflow-hidden'
      )}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Sci-fi deep space background */}
        <div
          className="absolute inset-0 pointer-events-none z-0 sci-fi-deepfield"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(224, 155, 109, 0.06) 0%, rgba(240, 194, 127, 0.03) 18%, transparent 45%), radial-gradient(ellipse at 20% 12%, rgba(224, 155, 109, 0.04) 0%, transparent 48%), radial-gradient(ellipse at 82% 78%, rgba(224, 155, 109, 0.03) 0%, transparent 42%), linear-gradient(180deg, #FFF8F0 0%, #FFFFFF 45%, #FFF8F0 100%)',
          }}
        />
        {/* 科幻扫描层 */}
        <div className="absolute inset-0 pointer-events-none z-0 sci-fi-scanlines" />
        {/* 科技环轨 */}
        <div className="absolute left-1/2 top-[10%] z-0 pointer-events-none sci-fi-orbit sci-fi-orbit--a" />
        <div className="absolute left-1/2 top-[22%] z-0 pointer-events-none sci-fi-orbit sci-fi-orbit--b" />
        {/* 数据流层 */}
        <div className="absolute inset-0 pointer-events-none z-0 sci-fi-data-streams" />
        {/* Sci-fi grid overlay */}
        <div className="absolute inset-0 pointer-events-none z-0 sci-fi-grid opacity-30" />
        {/* Animated glow orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-[#3b82f6]/5 blur-3xl sci-fi-aurora-1 pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl sci-fi-aurora-2 pointer-events-none" />
        {/* Corner decorations */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-[#3b82f6]/20 rounded-tl-lg pointer-events-none" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-[#3b82f6]/20 rounded-tr-lg pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-[#3b82f6]/20 rounded-bl-lg pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-[#3b82f6]/20 rounded-br-lg pointer-events-none" />
      </div>
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        name="ai-view-image-upload"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />
      {isCompactLayout && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
<aside
        className={cn(
          'border-r flex flex-col shrink-0 z-40 transition-all duration-300',
          'bg-[#FFF8F0]/95 backdrop-blur-2xl border-[#E09B6D]/10',
          isDesktop
            ? sidebarCollapsed
              ? 'w-[72px]'
              : 'w-[300px]'
            : sidebarOpen
              ? 'fixed inset-y-0 left-0 w-[320px] animate-slide-in-left'
              : 'hidden'
        )}
      >
        {/* Logo区域 */}
        <div className={cn('h-18 flex items-center border-b border-[#3b82f6]/10 py-5', sidebarCollapsed && isDesktop ? 'justify-center px-3' : 'px-5')}>
          <button
            onClick={() => navigateTo('/')}
            className="flex items-center gap-3 text-white hover:text-white transition-colors group"
          >
            <div className="w-9 h-9 rounded-[10px] overflow-hidden shrink-0 shadow-lg shadow-[#3b82f6]/20 ring-1 ring-[#3b82f6]/20">
                <img src={PUBLIC_URLS.logo} alt="小天画布" className="w-full h-full object-cover" style={{ borderRadius: 10 }} />
            </div>
            {(!sidebarCollapsed || !isDesktop) && (
              <div className="text-left leading-none">
                  <span className="font-semibold text-[15px] tracking-tight block text-white leading-tight">小天画布</span>
                <span className="text-[10px] text-white font-mono leading-none mt-0.5 block">AI CREATION SYSTEM</span>
              </div>
            )}
          </button>
          {isDesktop && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="ml-auto p-1.5 rounded-lg text-white hover:text-white hover:bg-[#3b82f6]/10 transition-all"
              title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
            >
              <MedusaIcon name="sidebar-left" size={16} className={cn('transition-transform text-white', sidebarCollapsed && 'rotate-180')} />
            </button>
          )}
        </div>

        {/* 导航菜单 */}
        <nav className={cn('flex-1 py-3 space-y-5 overflow-y-auto', sidebarCollapsed && isDesktop ? 'px-2' : 'px-3')}>
          {/* 创作模式 */}
          <div>
            {(!sidebarCollapsed || !isDesktop) && (
              <div className="flex items-center gap-2 mb-2 px-2">
                <span className="text-[11px] font-semibold text-white uppercase tracking-widest font-mono">
                  创作模式
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              {navItems.slice(0, 1).map((item) => {
                const isActive = isSectionNavActive(item.id);
                const navDesc =
                  item.id === 'queue'
                    ? '查看生成进度与状态'
                    : item.label;
                return (
                <button
                  key={item.id}
                  data-nav-id={item.id}
                  onClick={() => {
                    if ('isHome' in item && item.isHome) {
                      navigateTo('/');
                      if (!isDesktop) setSidebarOpen(false);
                    } else {
                      setActiveSection(item.id);
                      if (!isDesktop) setSidebarOpen(false);
                    }
                  }}
                  className={cn(
                    'flex items-center rounded-xl text-base transition-all duration-200 group',
                    sidebarCollapsed && isDesktop
                      ? 'w-14 h-14 justify-center mx-auto'
                      : 'w-full gap-3.5 px-3.5 py-3.5 min-h-[72px]',
                    isActive
                      ? 'bg-[#3b82f6]/14 text-white font-semibold border border-[#3b82f6]/35 border-l-[3px] border-l-[#3b82f6] shadow-md shadow-[#3b82f6]/10'
                      : 'text-white border border-white/10 hover:bg-[#3b82f6]/5 hover:border-[#3b82f6]/30 hover:text-white font-medium'
                  )}
                  title={sidebarCollapsed && isDesktop ? item.label : undefined}
                >
                  <div
                    className={cn(
                      'rounded-[10px] flex items-center justify-center transition-colors shrink-0',
                      sidebarCollapsed && isDesktop ? 'w-10 h-10' : 'w-11 h-11',
                      isActive
                        ? 'bg-[#3b82f6]/15 shadow-lg shadow-[#3b82f6]/15 ring-1 ring-[#3b82f6]/25'
                        : 'bg-transparent'
                    )}
                  >
                    {navMedusaIcons[item.id] ? (
                      <MedusaIcon name={navMedusaIcons[item.id]} size={22} className={isActive ? 'text-[#3b82f6]' : 'text-white group-hover:text-white'} />
                    ) : (
                      <item.icon
                        size={22}
                        fill='none'
                        strokeWidth={2}
                        className={isActive ? 'text-[#3b82f6]' : 'text-white group-hover:text-white'}
                      />
                    )}
                  </div>
                  {(!sidebarCollapsed || !isDesktop) && (
                    <div className="text-left min-w-0 flex-1">
                      <div className="text-[15px] font-bold leading-snug">{item.label}</div>
                      <div className="text-[12px] text-white font-normal mt-1 opacity-90">
                        {navDesc}
                      </div>
                    </div>
                  )}
                </button>
              );})}
            </div>
          </div>

          {/* 资源 */}
          <div>
            {(!sidebarCollapsed || !isDesktop) && (
              <div className="flex items-center gap-2 mb-2 px-2">
                <span className="text-[11px] font-semibold text-white uppercase tracking-widest font-mono">
                  资源
                </span>
              </div>
            )}
            <div className="space-y-0.5">
              {navItems.slice(1).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    if (!isDesktop) setSidebarOpen(false);
                  }}
                  className={cn(
                    'flex items-center rounded-[10px] text-sm transition-colors duration-200',
                    sidebarCollapsed && isDesktop
                      ? 'w-12 h-12 justify-center mx-auto'
                      : 'w-full justify-between px-3 py-3',
                    activeSection === item.id
? 'bg-[#3b82f6]/10 text-white font-medium border border-[#3b82f6]/35 border-l-2 border-l-[#3b82f6]'
                      : 'text-white border border-white/10 hover:bg-[#3b82f6]/5 hover:border-[#3b82f6]/30 hover:text-white font-medium'
                  )}
                  title={sidebarCollapsed && isDesktop ? item.label : undefined}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-[10px] flex items-center justify-center transition-colors shrink-0',
                        activeSection === item.id ? 'bg-[#3b82f6]/15 shadow-lg shadow-[#3b82f6]/15' : 'bg-transparent'
                      )}
                    >
                      {navMedusaIcons[item.id] ? (
                        <MedusaIcon name={navMedusaIcons[item.id]} size={18} className={activeSection === item.id ? 'text-[#3b82f6]' : 'text-white'} />
                      ) : (
                        <item.icon
                          size={18}
                          fill='none'
                          strokeWidth={2}
                          className={activeSection === item.id ? 'text-[#3b82f6]' : 'text-white'}
                        />
                      )}
                    </div>
                    {(!sidebarCollapsed || !isDesktop) && <span className="leading-tight text-sm">{item.label}</span>}
                  </div>
                  {item.badge && (!sidebarCollapsed || !isDesktop) && (
                    <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-[#3b82f6]/20 text-[10px] font-semibold text-white border border-[#3b82f6]/20">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>


        </nav>

        {/* 底部返回按钮 */}
        <div className={cn('border-t border-[#3b82f6]/10', sidebarCollapsed && isDesktop ? 'p-2' : 'p-3')}>
          {(!sidebarCollapsed || !isDesktop) && (
            <div className="flex items-center gap-2 mb-2 px-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 sci-fi-pulse-dot" />
              <span className="text-[10px] text-white font-mono">NEURAL NETWORK ACTIVE</span>
            </div>
          )}
          <button
            onClick={() => navigateTo('/')}
            className={cn(
          'flex items-center text-sm text-white hover:text-white hover:bg-[#3b82f6]/10 rounded-[10px] transition-all group font-medium',
              sidebarCollapsed && isDesktop
                ? 'w-12 h-12 justify-center mx-auto'
                : 'w-full gap-3 px-2.5 py-2.5'
            )}
            title={sidebarCollapsed && isDesktop ? '返回主页' : undefined}
          >
            <div className={cn('rounded-[8px] bg-[#3b82f6]/5 flex items-center justify-center group-hover:bg-[#3b82f6]/10 transition-colors shrink-0', sidebarCollapsed && isDesktop ? 'w-9 h-9' : 'w-8 h-8')}>
              <MedusaIcon name="arrow-left" size={16} className="text-white" />
            </div>
            {(!sidebarCollapsed || !isDesktop) && '返回主页'}
          </button>
        </div>
      </aside>

      <main
        ref={mainRef}
        className={cn(
          'flex-1 flex flex-col bg-transparent relative z-10 items-center',
          isDesktop ? 'h-full overflow-hidden' : 'h-full overflow-hidden'
        )}
      >
        <header
          className={cn(
            'backdrop-blur-xl bg-[#FFFFFF]/80 border-b border-[#E09B6D]/10 shrink-0 z-[1000] sticky top-0 w-full',
            isDesktop ? 'h-14' : 'h-12'
          )}
        >
          <div className="max-w-5xl mx-auto w-full flex items-center justify-between px-4 md:px-8 lg:px-12 h-full">
          <div className="flex items-center gap-3">
            {!isDesktop && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-1 rounded-lg text-white hover:bg-[#3b82f6]/10 hover:text-white transition-all"
              >
                <Menu size={18} strokeWidth={2} />
              </button>
            )}
            <div className="flex items-center gap-2">
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-2">
            {membership?.isLoggedIn ? (
              <div className="hover:bg-[#3b82f6]/10 rounded-lg transition-colors">
                <UserProfileDropdown />
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className={cn(
                  'rounded-lg text-white font-medium hover:brightness-110 transition-all active:scale-[0.97] bg-[#3b82f6] shadow-md shadow-[#3b82f6]/20',
                  isDesktop ? 'px-4 py-2 text-[13px]' : 'px-3 py-1.5 text-xs'
                )}
              >
                登录
              </button>
            )}
            {isDesktop && (
              <button className="hidden p-2 rounded-lg text-white hover:bg-[#3b82f6]/10 hover:text-white transition-all">
                <Settings size={18} strokeWidth={1.8} />
              </button>
            )}
          </div>
          </div>
        </header>

        <div
          ref={mainContentRef}
          className="flex-1 flex flex-col relative items-center w-full min-h-0 overflow-hidden"
        >
          {isCompactLayout && paramPanelOpen && (
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
            onClick={() => setParamPanelOpen(false)}
            />
          )}

          {activeSection === 'queue' && (
            <div className="ai-studio-scene ai-studio-scene--queue flex flex-col w-full flex-1 min-h-0 overflow-hidden relative">
              <div className="ai-studio-scene__backdrop" aria-hidden>
                <div className="ai-studio-scene__grid" />
                <div className="ai-studio-scene__gradient" />
              </div>
              <AiStudioHubParticles />
              <div className="ai-studio-scene__scroll hide-scrollbar">
                <div className="ai-studio-scene__inner">
                  <div className="ai-studio-hero__toolbar ai-studio-hero">
                    <div>
                      <div className="ai-studio-hero__badge">
                        <span className="ai-studio-hero__badge-dot" />
                        NEURAL TASK PIPELINE
                      </div>
                      <h2 className="ai-studio-hero__title">智能任务中心</h2>
                      <p className="ai-studio-hero__desc">
                        实时追踪 AI 生成管道，智能同步任务状态、进度与结果，让每一次创作可观测、可回溯。
                      </p>
                    </div>
                    {generations.filter((g) => g.status === 'generating').length > 0 && (
                      <span className="ai-studio-live-badge">
                        <Loader2 size={12} className="animate-spin" />
                        {generations.filter((g) => g.status === 'generating').length} 项生成中
                      </span>
                    )}
                  </div>

                  {generations.length > 0 && (
                    <div className="ai-studio-stats">
                      <div className="ai-studio-stat">
                        <div>
                          <div className="ai-studio-stat__value">{generations.length}</div>
                          <div className="ai-studio-stat__label">全部任务</div>
                        </div>
                      </div>
                      <div className={cn('ai-studio-stat', generations.some((g) => g.status === 'generating') && 'ai-studio-stat--active')}>
                        <div>
                          <div className="ai-studio-stat__value">{generations.filter((g) => g.status === 'generating').length}</div>
                          <div className="ai-studio-stat__label">生成中</div>
                        </div>
                      </div>
                      <div className="ai-studio-stat">
                        <div>
                          <div className="ai-studio-stat__value">{generations.filter((g) => g.status === 'done').length}</div>
                          <div className="ai-studio-stat__label">已完成</div>
                        </div>
                      </div>
                      <div className="ai-studio-stat">
                        <div>
                          <div className="ai-studio-stat__value">{generations.filter((g) => g.status === 'failed').length}</div>
                          <div className="ai-studio-stat__label">需处理</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {generations.length === 0 ? (
                    <div className="ai-studio-empty">
                      <div className="ai-studio-empty__icon">
                        <span className="ai-studio-empty__icon-glow" aria-hidden />
                        <BrainCircuit size={30} strokeWidth={1.5} />
                      </div>
                      <p className="ai-studio-empty__title">任务队列空闲</p>
                      <p className="ai-studio-empty__desc">
                        启动图片或视频生成后，AI 将自动创建任务并在此实时展示状态与进度。
                      </p>
                      <button
                        onClick={() => { navigateTo('/'); }}
                        className="ai-studio-empty__cta"
                      >
                        <Sparkles size={14} />
                        去开始创作
                      </button>
                    </div>
                  ) : (
                    <div className="ai-studio-queue-list">
                      {generations.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            'ai-studio-queue-card',
                            item.status === 'generating' && 'ai-studio-queue-card--generating',
                            item.status === 'failed' && 'ai-studio-queue-card--failed'
                          )}
                        >
                          <div className="ai-studio-queue-thumb">
                        {item.status === 'generating' ? (
                          <div className="flex flex-col items-center gap-1">
                            <Loader2 size={20} className="animate-spin text-white" />
                            <span className="text-[10px] text-white font-medium">生成中</span>
                          </div>
                        ) : item.status === 'done' && item.thumbnail ? (
                          item.type === 'video' ? (
                            <div className="relative w-full h-full">
                              <OptimizedImage
                                src={item.thumbnail}
                                alt={item.prompt}
                                className="w-full h-full"
                                thumbnailSize={160}
                                format="webp"
                                quality={70}
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <Play size={16} fill="white" className="text-white" />
                              </div>
                            </div>
                          ) : (
                            <OptimizedImage
                              src={item.thumbnail}
                              alt={item.prompt}
                              className="w-full h-full"
                              thumbnailSize={160}
                              format="webp"
                              quality={70}
                            />
                          )
                        ) : item.status === 'failed' ? (
                          <AlertCircle size={20} className="text-white" />
                        ) : (
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', item.type === 'video' ? 'bg-gray-50/10' : 'bg-gray-50/20')}>
                            {item.type === 'video' ? <Video size={16} className="text-white" /> : <Image size={16} className="text-white" />}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="ai-studio-tag ai-studio-tag--type">
                            {item.type === 'video' ? '视频' : '图片'}
                          </span>
                          <span className={cn(
                            'ai-studio-tag',
                            item.status === 'generating' && 'ai-studio-tag--generating',
                            item.status === 'done' && 'ai-studio-tag--done',
                            item.status === 'failed' && 'ai-studio-tag--failed',
                            item.status !== 'generating' && item.status !== 'done' && item.status !== 'failed' && 'ai-studio-tag--pending'
                          )}>
                            {item.status === 'generating' ? '生成中' : item.status === 'done' ? '已完成' : item.status === 'failed' ? '失败' : '等待中'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-100 line-clamp-2 mb-1">{item.prompt}</p>
                        <p className="text-[11px] text-slate-400">
                          {item.createdAt instanceof Date
                            ? item.createdAt.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : new Date(item.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {item.status === 'failed' && item.error && (
                          <p className="text-[11px] text-red-300/80 mt-1 line-clamp-1">{item.error}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {item.status === 'done' && item.resultUrl && (
                          <>
                            <button
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = item.resultUrl!;
                                a.download = `${item.type === 'video' ? '视频' : '图片'}_${Date.now()}.${item.type === 'video' ? 'mp4' : 'png'}`;
                                a.target = '_blank';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                              className="ai-studio-action-btn"
                              title="下载"
                            >
                              <Download size={16} />
                            </button>
                            <button
                              onClick={() => {
                                navigateToCreationWithMode(item.type, item.prompt);
                              }}
                              className="ai-studio-action-btn"
                              title="使用相同提示词重新生成"
                            >
                              <Sparkles size={16} />
                            </button>
                          </>
                        )}
                        {item.status === 'failed' && (
                          <button
                            onClick={() => {
                              navigateToCreationWithMode(item.type, item.prompt);
                            }}
                            className="ai-studio-action-btn"
                            title="重试"
                          >
                            <Zap size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="ai-studio-action-btn"
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'gallery' && (
            <div className="ai-studio-scene ai-studio-scene--gallery flex flex-col w-full flex-1 min-h-0 overflow-hidden relative">
              <div className="ai-studio-scene__backdrop" aria-hidden>
                <div className="ai-studio-scene__grid" />
                <div className="ai-studio-scene__gradient" />
              </div>
              <AiStudioHubParticles />
              <div className="ai-studio-scene__scroll hide-scrollbar">
                <div className="ai-studio-scene__inner">
                  <div className="ai-studio-hero__toolbar ai-studio-hero">
                    <div>
                      <div className="ai-studio-hero__badge">
                        <span className="ai-studio-hero__badge-dot" />
                        CREATIVE ASSET HUB
                      </div>
                      <h2 className="ai-studio-hero__title">创作资产库</h2>
                      <p className="ai-studio-hero__desc">
                        智能归档全部 AI 生成成果，支持分类筛选、预览复用与云端同步，构建您的专属创意资产。
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchCloudFiles()}
                        className={cn('ai-studio-icon-btn', isLoadingCloudFiles && 'animate-spin text-[#93c5fd]')}
                        title="同步云端作品"
                      >
                        <RefreshCw size={16} strokeWidth={1.8} />
                      </button>
                      <div className="ai-studio-filters">
                        {(['all', 'image', 'video'] as const).map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setGalleryFilter(filter)}
                            className={cn(
                              'ai-studio-filter-btn',
                              galleryFilter === filter && 'ai-studio-filter-btn--active'
                            )}
                          >
                            {filter === 'all' ? '全部' : filter === 'image' ? '图片' : '视频'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {!isLoadingCloudFiles && filteredGenerations.length > 0 && (
                    <div className="ai-studio-stats">
                      <div className="ai-studio-stat ai-studio-stat--active">
                        <div>
                          <div className="ai-studio-stat__value">{filteredGenerations.length}</div>
                          <div className="ai-studio-stat__label">当前展示</div>
                        </div>
                      </div>
                      <div className="ai-studio-stat">
                        <div>
                          <div className="ai-studio-stat__value">{generations.filter((g) => g.status === 'done' && g.type === 'image').length}</div>
                          <div className="ai-studio-stat__label">图片资产</div>
                        </div>
                      </div>
                      <div className="ai-studio-stat">
                        <div>
                          <div className="ai-studio-stat__value">{generations.filter((g) => g.status === 'done' && g.type === 'video').length}</div>
                          <div className="ai-studio-stat__label">视频资产</div>
                        </div>
                      </div>
                    </div>
                  )}

              {isLoadingCloudFiles ? (
                <div className="ai-studio-empty">
                  <Loader2 size={36} className="animate-spin text-[#93c5fd] mb-4" />
                  <p className="ai-studio-empty__title">正在同步云端资产</p>
                  <p className="ai-studio-empty__desc">AI 正在拉取您的历史作品，请稍候...</p>
                </div>
              ) : filteredGenerations.length === 0 ? (
                <div className="ai-studio-empty">
                  <div className="ai-studio-empty__icon">
                    <span className="ai-studio-empty__icon-glow" aria-hidden />
                    <LayoutGrid size={30} strokeWidth={1.5} />
                  </div>
                  <p className="ai-studio-empty__title">资产库暂无内容</p>
                  <p className="ai-studio-empty__desc">
                    完成的生成结果将自动沉淀至此，支持按类型筛选、预览下载与提示词复用。
                  </p>
                  <button
                    onClick={() => { navigateTo('/'); }}
                    className="ai-studio-empty__cta"
                  >
                    <Sparkles size={14} />
                    去开始创作
                  </button>
                </div>
              ) : (
                <div className="ai-studio-gallery-grid">
                  {filteredGenerations.map((item) => (
                    <div
                      key={item.id}
                      className="group ai-studio-gallery-card"
                      onClick={() => setSelectedGeneration(item)}
                    >
                      <div className="aspect-square overflow-hidden bg-elevated/5">
                        {item.type === 'video' && (item.thumbnail || item.resultUrl) ? (
                          <div className="relative w-full h-full">
                            {item.thumbnail && /\.(jpg|jpeg|png|webp|gif|avif|bmp)(\?.*)?$/i.test(item.thumbnail) ? (
                              <OptimizedImage
                                src={item.thumbnail}
                                alt={item.prompt}
                                className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                                thumbnailSize={400}
                                format="webp"
                                quality={70}
                              />
                            ) : item.thumbnail && item.thumbnail.includes('ci-process=snapshot') ? (
                              <OptimizedImage
                                src={item.thumbnail}
                                alt={item.prompt}
                                className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                                thumbnailSize={400}
                                format="webp"
                                quality={70}
                              />
                            ) : item.thumbnail && !/\.(mp4|webm|mov|avi|m4v)(\?.*)?$/i.test(item.thumbnail) ? (
                              <OptimizedImage
                                src={item.thumbnail}
                                alt={item.prompt}
                                className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                                thumbnailSize={400}
                                format="webp"
                                quality={70}
                              />
                            ) : (
                              <VideoThumbnail
                                src={item.resultUrl || item.thumbnail}
                                className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                              />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                              <div className="w-10 h-10 rounded-full bg-elevated/90 flex items-center justify-center shadow-lg">
                                <Play size={18} fill="currentColor" className="text-white ml-0.5" />
                              </div>
                            </div>
                          </div>
                        ) : item.type === 'image' && item.resultUrl ? (
                          <OptimizedImage
                            src={item.resultUrl}
                            alt={item.prompt}
                            className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                            thumbnailSize={400}
                            format="webp"
                            quality={75}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {item.type === 'video' ? <Video size={24} className="text-white" /> : <Image size={24} className="text-white" />}
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3 pt-8">
                        <p className="text-xs text-white font-medium line-clamp-2 leading-tight">{item.prompt}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={cn(
                            'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold',
                            item.type === 'video' ? 'bg-[#3b82f6] text-white' : 'bg-[#3b82f6]/80 text-white'
                          )}>
                            {item.type === 'video' ? '视频' : '图片'}
                          </span>
                          <span className="text-[10px] text-white">
                            {item.createdAt instanceof Date
                              ? item.createdAt.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
                              : new Date(item.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const a = document.createElement('a');
                            a.href = item.resultUrl!;
                            a.download = `${item.type === 'video' ? '视频' : '图片'}_${Date.now()}.${item.type === 'video' ? 'mp4' : 'png'}`;
                            a.target = '_blank';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                          className="w-7 h-7 rounded-lg bg-elevated/90 shadow-sm flex items-center justify-center text-white hover:text-white transition-colors"
                          title="下载"
                        >
                          <Download size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
                          className="w-7 h-7 rounded-lg bg-elevated/90 shadow-sm flex items-center justify-center text-white hover:text-white transition-colors"
                          title="删除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedGeneration && (
                <div
                  className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                  onClick={() => setSelectedGeneration(null)}
                >
                  <div
                    className="relative max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden bg-elevated shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setSelectedGeneration(null)}
                      className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    >
                      <X size={16} />
                    </button>
                    <div className="flex flex-col">
                      <div className="flex-1 flex items-start justify-center min-h-[300px] max-h-[60vh] bg-elevated">
                        {selectedGeneration.type === 'video' && selectedGeneration.resultUrl ? (
                          <video
                            src={selectedGeneration.resultUrl}
                            controls
                            autoPlay
                            className="max-w-full max-h-[60vh] object-contain"
                          />
                        ) : selectedGeneration.type === 'image' && selectedGeneration.resultUrl ? (
                          <img
                            src={selectedGeneration.resultUrl}
                            alt={selectedGeneration.prompt}
                            className="max-w-full max-h-[60vh] object-contain"
                          />
                        ) : null}
                      </div>
                      <div className="p-4">
                        <p className="text-sm text-white line-clamp-3">{selectedGeneration.prompt}</p>
                        <div className="flex items-center gap-3 mt-3">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold',
                            selectedGeneration.type === 'video' ? 'bg-gray-50/10 text-white' : 'bg-gray-50/10 text-white'
                          )}>
                            {selectedGeneration.type === 'video' ? '视频' : '图片'}
                          </span>
                          <span className="text-[11px] text-white">
                            {selectedGeneration.createdAt instanceof Date
                              ? selectedGeneration.createdAt.toLocaleString('zh-CN')
                              : new Date(selectedGeneration.createdAt).toLocaleString('zh-CN')}
                          </span>
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = selectedGeneration.resultUrl!;
                                a.download = `${selectedGeneration.type === 'video' ? '视频' : '图片'}_${Date.now()}.${selectedGeneration.type === 'video' ? 'mp4' : 'png'}`;
                                a.target = '_blank';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3b82f6] text-white text-xs font-medium hover:bg-gray-50/20 transition-colors"
                            >
                              <Download size={12} />
                              下载
                            </button>
                            <button
                              onClick={() => {
                                handleDelete(selectedGeneration.id);
                                setSelectedGeneration(null);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50/10 text-white text-xs font-medium hover:bg-gray-50/10 transition-colors"
                            >
                              <Trash2 size={12} />
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
                </div>
              </div>
            </div>
          )}

          {!isDesktop && (activeSection === 'queue' || activeSection === 'gallery') && (
            <nav className="sticky bottom-0 left-0 right-0 z-20 flex items-center justify-around gap-1 px-2 py-2 border-t border-[#E09B6D]/10 bg-[#FFF8F0]/95 backdrop-blur-xl safe-area-bottom">
              {[
                { id: 'queue' as SectionId, label: '队列', icon: Clock },
                { id: 'gallery' as SectionId, label: '画廊', icon: LayoutGrid },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                  }}
                  className={cn(
                    'relative flex flex-col items-center justify-center py-2 px-3 min-w-[56px] transition-colors',
                    isSectionNavActive(item.id) ? 'text-[#2D1F0E]' : 'text-[#2D1F0E]/65 hover:text-[#2D1F0E]/85'
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center mb-0.5 transition-colors',
                      isSectionNavActive(item.id) ? 'bg-[#E09B6D]/18 shadow-xl shadow-[#E09B6D]/15 border border-[#E09B6D]/24' : 'bg-transparent'
                    )}
                  >
                    <item.icon size={20} fill='none' strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] font-semibold font-mono">{item.label}</span>
                </button>
              ))}
            </nav>
          )}
        </div>
      </main>
      <Suspense fallback={null}>
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSwitchToMembership={() => {
            setShowLoginModal(false);
            navigateTo('/');
          }}
          onLoginSuccess={() => {
            setShowLoginModal(false);
          }}
        />
      </Suspense>
    </div>
  );
};

export default AIViewPage;
