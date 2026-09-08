/**
 * AICG 工作流模板 — 一键插入完整流水线（精确端口连线）
 */

import type { Edge, Node } from '@xyflow/react';
import { CANVAS_MATERIAL_PRESETS, type CanvasMaterialPreset } from '@/config/material-presets';
import { generateId } from '@/lib/utils';
import {
  buildNodeDataFromDefinition,
  NODE_TYPES,
  type NodeTypeDefinition,
} from '@/types/node-system';
import { getDefaultTargetHandle } from '@/services/node-handle-adjacency';
import {
  CANVAS_NODE_HORIZONTAL_GAP,
  CANVAS_NODE_VERTICAL_GAP,
  getCanvasNodeDimensions,
} from '@/lib/canvas-node-dimensions';
import {
  completeWorkflowNodeData,
  ensureWorkflowNodesHaveVideo,
} from '@/services/workflow-marketplace-completeness';

export interface AICGWorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'script' | 'image' | 'video' | 'tool' | 'commerce' | 'character' | 'music' | 'space';
  scene?: string;
  tags?: string[];
  coverTone?: 'cyan' | 'violet' | 'amber' | 'emerald' | 'rose' | 'blue';
  /** 节点类型列表，按布局顺序 */
  steps: Array<{
    nodeType: string;
    offsetX: number;
    offsetY?: number;
    initialData?: Record<string, unknown>;
  }>;
  /** 连线索引 [sourceStep, targetStep, sourceHandle?, targetHandle?] */
  links: Array<[number, number, string?, string?]>;
}

const imageInputStepData = (label: string, preset: CanvasMaterialPreset, role: string) => ({
  label,
  title: label,
  materialPresetId: preset.id,
  materialRole: role,
  sourceFolder: preset.sourceFolder,
  resourceDir: preset.resourceDir,
  publicResourceUrl: preset.publicResourceUrl,
  workflowFiles: preset.workflowFiles,
  loraFiles: preset.loraFiles,
  prompt: `输入${role === 'primary' ? '主体' : '参考'}图片素材，来自预设「${preset.name}」，作为后续生图与生视频的输入源`,
});

const imagePresetStepData = (preset: CanvasMaterialPreset) => ({
  label: preset.name,
  title: preset.name,
  prompt: preset.promptTemplate,
  params: {
    ...preset.defaultParams,
    prompt: preset.promptTemplate,
    materialPresetId: preset.id,
    sourceFolder: preset.sourceFolder,
    resourceDir: preset.resourceDir,
    publicResourceUrl: preset.publicResourceUrl,
    workflowFiles: preset.workflowFiles,
    loraFiles: preset.loraFiles,
    customNodeDirs: preset.customNodeDirs || [],
    promptOptions: preset.promptOptions || [],
    materialWorkflowType: preset.workflowType,
  },
});

const videoPresetStepData = (preset: CanvasMaterialPreset) => ({
  label: `${preset.name} · 片头`,
  title: `${preset.name} · 片头`,
  prompt: preset.promptTemplate,
  params: {
    ...preset.defaultParams,
    prompt: preset.promptTemplate,
    materialPresetId: preset.id,
    sourceFolder: preset.sourceFolder,
    resourceDir: preset.resourceDir,
    publicResourceUrl: preset.publicResourceUrl,
    workflowFiles: preset.workflowFiles,
    loraFiles: preset.loraFiles,
    promptOptions: preset.promptOptions || [],
    materialWorkflowType: preset.workflowType,
  },
});

function createMaterialWorkflowTemplate(preset: CanvasMaterialPreset): AICGWorkflowTemplate {
  const isPair = preset.inputCount === 2;
  const imageStepIndex = isPair ? 2 : 1;
  const videoStepIndex = isPair ? 3 : 2;
  const outputStepIndex = videoStepIndex + 1;

  const steps: AICGWorkflowTemplate['steps'] = [
    {
      nodeType: 'imageInput',
      offsetX: 0,
      initialData: imageInputStepData(isPair ? '图1 / 主体图' : '输入图片', preset, 'primary'),
    },
  ];

  if (isPair) {
    steps.push({
      nodeType: 'imageInput',
      offsetX: 0,
      offsetY: 320,
      initialData: imageInputStepData('图2 / 参考图', preset, 'reference'),
    });
  }

  steps.push({
    nodeType: 'aiImage',
    offsetX: 520,
    initialData: imagePresetStepData(preset),
  });

  steps.push({
    nodeType: 'aiVideo',
    offsetX: 1040,
    initialData: videoPresetStepData(preset),
  });

  steps.push({
    nodeType: 'output',
    offsetX: 1560,
    initialData: {
      label: `${preset.name} · 输出`,
      title: `${preset.name} · 输出`,
      materialPresetId: preset.id,
      resourceDir: preset.resourceDir,
      publicResourceUrl: preset.publicResourceUrl,
      prompt: `统一收集 ${preset.name} 的生图与视频结果，导出为最终交付素材`,
    },
  });

  const links: AICGWorkflowTemplate['links'] = [[0, imageStepIndex, 'imageOutput', 'input']];

  if (isPair) {
    links.push([1, imageStepIndex, 'imageOutput', 'image']);
  }

  links.push([imageStepIndex, videoStepIndex, 'output', 'input']);
  links.push([videoStepIndex, outputStepIndex, 'output', 'video']);

  return {
    id: preset.aicgWorkflowId,
    name: preset.name,
    description: preset.description,
    category: preset.workflowCategory,
    scene: preset.scene,
    tags: preset.tags,
    coverTone: preset.coverTone,
    steps,
    links,
  };
}

const MATERIAL_AICG_WORKFLOW_TEMPLATES = CANVAS_MATERIAL_PRESETS.map(
  createMaterialWorkflowTemplate
);

export const AICG_WORKFLOW_TEMPLATES: AICGWorkflowTemplate[] = [
  // ─── 电商 / 广告 ──────────────────────────────────────────────
  {
    id: 'aicg-script-director',
    name: '剧本 → 分镜导演',
    description: '脚本解析后进入连贯分镜编排，生成分镜图与动态视频',
    category: 'script',
    scene: '短剧分镜',
    tags: ['剧本', '分镜', '图片', '视频'],
    steps: [
      {
        nodeType: 'script',
        offsetX: 0,
        initialData: {
          label: '雨夜少女剧本',
          script:
            '一个少女在雨夜的东京街头撑着透明伞，霓虹灯倒映在水洼中。她停下脚步，转头看向镜头，眼中带着淡淡的忧伤。镜头缓缓推近，雨滴打在伞面上溅起水花。',
          scriptType: 'cinematic',
          tone: 'emotional',
          style: '电影感',
          model: 'doubao-seedream-5-0-lite',
          prompt: '雨夜东京街头，少女撑透明伞，霓虹灯倒映水洼，电影感分镜脚本',
        },
      },
      {
        nodeType: 'gridDirector',
        offsetX: 520,
        initialData: {
          label: '分镜导演',
          prompt: '基于剧本生成连贯分镜编排，标注景别、运镜、时长与画面重点',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 1040,
        initialData: {
          label: '分镜生图',
          prompt:
            '电影感画面，深夜东京街头暴雨，霓虹灯倒映湿地，年轻女子撑透明伞前行，赛博朋克冷蓝调，雨丝清晰，景深虚化，4K',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '16:9',
            imageSize: '2560x1440',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1560,
        initialData: {
          label: '分镜生视频',
          prompt: '雨夜街头，镜头缓缓推进，女子撑伞前行，雨丝飘落，霓虹灯闪烁，电影感运镜',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '16:9',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
    ],
    links: [
      [0, 1, 'scenes', 'scriptInput'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'input'],
    ],
  },
  {
    id: 'aicg-ecommerce-product-showcase',
    name: '电商产品种草流水线',
    description: '产品图 → 智能抠图 → 场景生图 → 视频合成 → 导出，适配小红书/抖音带货',
    category: 'commerce',
    scene: '商品展示',
    tags: ['电商', '种草', '抠图', '视频'],
    coverTone: 'amber',
    steps: [
      {
        nodeType: 'imageInput',
        offsetX: 0,
        initialData: {
          label: '产品原图',
          imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80',
        },
      },
      {
        nodeType: 'localMatting',
        offsetX: 460,
        initialData: {
          label: '智能抠图',
          prompt: '使用本地模型对产品主体抠图，输出透明背景 PNG，保留细节边缘',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 920,
        initialData: {
          label: '场景生图',
          prompt:
            '护肤品玻璃瓶放置在大理石台面上，背景是柔和的暖色调浴室场景，晨光从左侧窗户洒入，水蒸气缭绕，高端护肤品广告摄影风格，景深虚化，8K超清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'image_to_image',
            aspectRatio: '3:4',
            imageSize: '1536x2048',
            imageCount: 1,
            promptEnhancer: true,
            negativePrompt: '模糊, 低清, 畸形, 多余手指, 文字错误',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1380,
        initialData: {
          label: '产品展示视频',
          prompt: '镜头从产品左侧缓缓推近，水蒸气飘动，光影微变，高级感产品展示',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '3:4',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1840,
        initialData: {
          label: '导出',
          prompt: '导出场景图与产品展示视频，适配小红书/抖音带货',
        },
      },
    ],
    links: [
      [0, 1, 'imageOutput', 'image'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'video'],
    ],
  },
  {
    id: 'xt-ad-copy-media',
    name: '广告词 → 图片 → 视频',
    description: '广告文案、画面生成、视频生成与配音合成的轻量链路',
    category: 'commerce',
    scene: '商品展示',
    tags: ['广告词', '商品', '配音'],
    coverTone: 'amber',
    steps: [
      {
        nodeType: 'adCopyText',
        offsetX: 0,
        initialData: {
          prompt:
            '请为「便携式胶囊咖啡机」生成3条短视频广告词，包含：1) 开场钩子(3秒内抓住注意力) 2) 核心卖点(续航30杯/USB-C充电/兼容胶囊) 3) 行动号召。风格：年轻活力，适合小红书种草。',
          copyType: 'short_ad',
          platform: 'short_video',
          tone: 'conversion',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 460,
        initialData: {
          label: '广告主视觉',
          prompt:
            '便携式胶囊咖啡机产品图，放置在户外露营木桌上，背景是模糊的山林景色，晨光柔和，产品金属质感细腻，水滴凝结在胶囊上，商业摄影风格，景深虚化，8K高清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '16:9',
            imageSize: '2560x1440',
            imageCount: 1,
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 920,
        initialData: {
          label: '广告视频',
          prompt:
            '镜头环绕咖啡机缓缓旋转，咖啡从胶囊中萃取流出，蒸汽升腾，光影变化丰富，高级感产品广告',
          params: {
            provider: 'doubao',
            modelId: 'doubao-seedance-2-0',
            generationMode: 'image_to_video',
            aspectRatio: '16:9',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'audioGen',
        offsetX: 460,
        offsetY: 420,
        initialData: {
          label: '广告配音',
          prompt: '年轻活力女声播报广告词，语速稍快，节奏明快，适合小红书种草风格',
          params: { mode: 'tts', voice: 'female_young', speed: 1.1 },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1380,
        initialData: {
          label: '导出',
          prompt: '导出广告视频成片',
        },
      },
    ],
    links: [
      [0, 1, 'prompt', 'prompt'],
      [1, 2, 'output', 'input'],
      [0, 3, 'output', 'prompt'],
      [2, 4, 'output', 'video'],
    ],
  },
  {
    id: 'xt-brand-campaign',
    name: '品牌文案 → 广告词 → 生图 → 视频',
    description: '品牌主张、广告口播、海报视觉与品牌视频拆为多个轻节点协作',
    category: 'commerce',
    scene: '品牌传播',
    tags: ['品牌', '文案', '海报', '视频'],
    coverTone: 'violet',
    steps: [
      {
        nodeType: 'brandCopyText',
        offsetX: 0,
        initialData: {
          prompt:
            '请为「茶颜悦色」新中式茶饮品牌生成品牌文案，包含：1) 品牌主张(一句话) 2) 海报标题(5字以内) 3) 视觉关键词(用于AI生图) 4) 画面描述(一段适合AI生图的描述)。风格：东方美学，简约高级。',
          copyType: 'brand_statement',
          platform: 'brand_campaign',
          tone: 'brand',
        },
      },
      {
        nodeType: 'adCopyText',
        offsetX: 460,
        initialData: {
          prompt: '请基于品牌调性生成3条社交媒体广告口播文案，每条15秒，包含品牌主张和行动号召。',
          copyType: 'short_ad',
          platform: 'short_video',
          tone: 'brand',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 920,
        initialData: {
          label: '品牌海报',
          prompt:
            '新中式茶饮海报，水墨风格，一只白瓷茶杯置于原木茶席上，背景是淡墨山水，茶汤金色透亮，蒸汽如丝，东方美学，留白构图，8K高清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '3:4',
            imageSize: '1536x2048',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1380,
        initialData: {
          label: '品牌视频',
          prompt:
            '镜头缓缓推近茶杯，茶汤微波荡漾，蒸汽袅袅升起，水墨山水背景若隐若现，东方美学动态展示',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '3:4',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1840,
        initialData: {
          label: '导出',
          prompt: '导出品牌海报与品牌视频',
        },
      },
    ],
    links: [
      [0, 1, 'output', 'input'],
      [0, 2, 'prompt', 'prompt'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'video'],
    ],
  },
  // ─── 短剧 / 故事 ──────────────────────────────────────────────
  {
    id: 'aicg-story-pipeline',
    name: 'AICG 短剧流水线',
    description: '剧本 → 分镜 → 生图 → 生视频 → 合成 → 导出',
    category: 'script',
    scene: '短剧分镜',
    tags: ['短剧', '分镜', '成片'],
    coverTone: 'cyan',
    steps: [
      {
        nodeType: 'script',
        offsetX: 0,
        initialData: {
          label: '短剧·雨夜邂逅',
          script:
            '【第一集·雨夜邂逅】\n\n场景：深夜，城市天桥下\n\n女主（林小雨，25岁，白领）加班后独自走在天桥下，突然下起暴雨。她躲到天桥下避雨，浑身湿透。\n\n男主（陆深，28岁，建筑师）撑着黑伞经过，看到她瑟缩的身影，犹豫片刻后递出伞。\n\n陆深：「给你。」\n林小雨抬头，雨水模糊了视线：「你……会用什么？」\n陆深微微一笑：「我有帽子。」说完转身走进雨中。\n\n林小雨握着尚有余温的伞柄，看着他的背影消失在霓虹灯下。',
          scriptType: 'short_drama',
          tone: 'romantic',
          style: '电影感',
          model: 'doubao-seedream-5-0-lite',
          prompt: '雨夜城市天桥下，男女主邂逅的浪漫短剧脚本，电影感叙事',
        },
      },
      {
        nodeType: 'gridDirector',
        offsetX: 520,
        initialData: {
          label: '分镜导演',
          prompt: '基于短剧脚本生成连贯分镜编排，标注景别、运镜、时长与画面重点',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 1040,
        initialData: {
          label: '分镜生图',
          prompt:
            '电影感画面，深夜城市天桥下暴雨，霓虹灯倒映湿地，年轻女子蜷缩躲避，远处男子撑黑伞走来，赛博朋克风格，冷蓝调，雨丝清晰，景深虚化，4K',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '16:9',
            imageSize: '2560x1440',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1560,
        initialData: {
          label: '分镜生视频',
          prompt: '雨夜天桥下，镜头缓缓推进，女子抬头，男子递伞，雨丝飘落，霓虹灯闪烁，电影感运镜',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '16:9',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 2080,
        initialData: {
          label: '导出',
          prompt: '导出短剧成片与分镜素材',
        },
      },
    ],
    links: [
      [0, 1, 'scenes', 'scriptInput'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'video'],
    ],
  },
  {
    id: 'aicg-text-image-video',
    name: '文本 → 生图 → 生视频',
    description: '提示词驱动完整生产链',
    category: 'video',
    scene: '通用生成',
    tags: ['文本', '图片', '视频'],
    steps: [
      {
        nodeType: 'aiGenText',
        offsetX: 0,
        initialData: {
          label: '文本提示词',
          prompt:
            '一只橘色猫咪戴着迷你厨师帽，站在厨房台面上，用小爪子拨弄着一颗草莓。阳光从窗户洒入，照亮了它蓬松的毛发。画面温馨可爱，背景虚化。',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 480,
        initialData: {
          label: 'AI 生图',
          prompt:
            '一只橘色猫咪戴着迷你白色厨师帽，站在木质厨房台面上，前爪拨弄一颗鲜红草莓，阳光从左侧窗户洒入，毛发蓬松发光，温馨可爱，景深虚化，8K超清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '1:1',
            imageSize: '2048x2048',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 960,
        initialData: {
          label: 'AI 生视频',
          prompt: '橘猫用爪子轻轻拨弄草莓，草莓滚动，猫咪歪头追逐，毛发随动作轻摆，阳光中尘埃飞舞',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '1:1',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1440,
        initialData: {
          label: '导出',
          prompt: '导出生成的图片与视频',
        },
      },
    ],
    links: [
      [0, 1, 'textOutput', 'input'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'video'],
    ],
  },
  {
    id: 'xt-storyboard-edit-pipeline',
    name: '剧本分镜 → 分镜编辑 → 视频',
    description: '剧本拆镜、分镜编辑、批量生图、生视频拆为独立节点链路',
    category: 'script',
    scene: '短剧分镜',
    tags: ['剧本', '分镜编辑', '视频'],
    coverTone: 'cyan',
    steps: [
      {
        nodeType: 'script',
        offsetX: 0,
        initialData: {
          label: '产品宣传片脚本',
          script:
            '【产品宣传片脚本】\n\n镜头1：产品全景，黑色背景，聚光灯打在产品上，旋转展示\n镜头2：特写，产品细节，金属质感，反光\n镜头3：使用场景，产品放置在真实环境中，人物手部入画\n镜头4：品牌Logo + Slogan，渐入结尾',
          scriptType: 'commercial',
          tone: 'professional',
          style: '商业广告',
          model: 'doubao-seedream-5-0-lite',
          prompt: '产品宣传片分镜脚本，包含全景、特写、场景、Logo四个镜头',
        },
      },
      {
        nodeType: 'scriptStoryboard',
        offsetX: 500,
        initialData: {
          label: '剧本拆镜',
          prompt: '将宣传片脚本拆解为可执行分镜，标注每个镜头的时长、景别、运镜方式',
        },
      },
      {
        nodeType: 'storyboardEdit',
        offsetX: 1000,
        initialData: {
          label: '分镜编辑',
          prompt: '对拆镜结果进行编辑调整，优化镜头顺序与节奏',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 1500,
        initialData: {
          label: '分镜生图',
          prompt:
            '产品全景，纯黑背景，单点聚光灯，产品居中悬浮，金属质感强烈，反光锐利，高端商业摄影，8K',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '16:9',
            imageSize: '2560x1440',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 2000,
        initialData: {
          label: '分镜生视频',
          prompt: '产品在黑色背景中缓缓旋转，聚光灯跟随，金属表面反光流动，高端产品展示动画',
          params: {
            provider: 'doubao',
            modelId: 'doubao-seedance-2-0',
            generationMode: 'image_to_video',
            aspectRatio: '16:9',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 2500,
        initialData: {
          label: '导出',
          prompt: '导出宣传片成片与分镜素材',
        },
      },
    ],
    links: [
      [0, 1, 'scenes', 'scriptInput'],
      [1, 2, 'scenes', 'scriptInput'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'input'],
      [4, 5, 'output', 'video'],
    ],
  },
  // ─── 角色设计 ──────────────────────────────────────────────────
  {
    id: 'aicg-character-pipeline',
    name: '角色库 → 一致性 → 生图 → 视频',
    description: '角色三视图保持外观生图，并生成角色动态视频',
    category: 'character',
    scene: '角色一致性',
    tags: ['角色', '一致性', '生图', '视频'],
    coverTone: 'rose',
    steps: [
      {
        nodeType: 'characterLibrary',
        offsetX: 0,
        initialData: {
          label: '角色参考',
          characterName: '林小雨',
          characterDescription: '25岁女性，齐肩短发，圆脸，大眼睛，穿着米白色风衣，气质温柔知性',
          prompt: '维护角色「林小雨」的参考图与设定，确保后续生成中外观、服装、气质保持一致',
        },
      },
      {
        nodeType: 'characterConsistency',
        offsetX: 480,
        initialData: {
          label: '一致性校准',
          prompt: '基于角色库参考图，校准面部特征、发型与服装，确保多张生图角色一致性',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 960,
        initialData: {
          label: '角色生图',
          prompt:
            '25岁亚洲女性，齐肩黑色短发，圆脸大眼，穿着米白色风衣，站在樱花树下，花瓣飘落，柔和逆光，日系清新风格，半身像，景深虚化，8K高清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'reference',
            aspectRatio: '3:4',
            imageSize: '1536x2048',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1440,
        initialData: {
          label: '角色动态视频',
          prompt:
            '樱花树下，女子微微抬头，花瓣随风飘落，她伸手轻触花瓣，风衣衣摆轻摆，柔和逆光，日系电影感运镜',
          params: {
            provider: 'doubao',
            modelId: 'doubao-seedance-2-0',
            generationMode: 'image_to_video',
            aspectRatio: '3:4',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
    ],
    links: [
      [0, 1, 'characterRef', 'characterImage'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'input'],
    ],
  },
  {
    id: 'xt-character-angle-pipeline',
    name: '角色库 → 多角度 → 一致性',
    description: '角色参考、多角度、角色一致性、图片/视频生成拆节点配合',
    category: 'character',
    scene: '角色一致性',
    tags: ['角色', '多角度', '一致性'],
    coverTone: 'rose',
    steps: [
      {
        nodeType: 'characterLibrary',
        offsetX: 0,
        initialData: {
          label: '角色参考',
          characterName: '陆深',
          characterDescription: '28岁男性，短碎发，棱角分明，穿深灰色大衣，气质沉稳冷峻',
          prompt: '维护角色「陆深」的参考图与设定，确保多角度生成中外观与气质一致',
        },
      },
      {
        nodeType: 'multiAngle',
        offsetX: 460,
        initialData: {
          label: '多角度参考',
          prompt: '生成角色正面、侧面、背面多角度参考图，保持人物特征一致',
        },
      },
      {
        nodeType: 'characterConsistency',
        offsetX: 920,
        initialData: {
          label: '一致性校准',
          prompt: '基于多角度参考与角色库，校准面部、发型、服装一致性',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 1380,
        initialData: {
          label: '角色多角度生图',
          prompt:
            '28岁亚洲男性，短碎发，棱角分明的脸庞，穿深灰色长款大衣，站在城市天台上，背景是黄昏天空，风吹动衣摆，侧面半身像，电影感，8K',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'reference',
            aspectRatio: '3:4',
            imageSize: '1536x2048',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1840,
        initialData: {
          label: '角色动态视频',
          prompt: '男子站在天台上，风吹动大衣衣摆，他缓缓转头看向镜头，黄昏光线变化，电影感运镜',
          params: {
            provider: 'doubao',
            modelId: 'doubao-seedance-2-0',
            generationMode: 'image_to_video',
            aspectRatio: '3:4',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
    ],
    links: [
      [0, 1, 'characterRef', 'input'],
      [0, 2, 'characterRef', 'characterImage'],
      [1, 2, 'output', 'targetImage'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'input'],
    ],
  },
  // ─── 图片处理 ──────────────────────────────────────────────────
  {
    id: 'aicg-matting-collage',
    name: '抠图 → 生图 → 视频 → 导出',
    description: '本地抠图后进入图片生成、视频生成与排版导出',
    category: 'tool',
    scene: '图片处理',
    tags: ['抠图', '图片', '视频', '导出'],
    steps: [
      {
        nodeType: 'imageInput',
        offsetX: 0,
        initialData: {
          label: '原图上传',
          imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
        },
      },
      {
        nodeType: 'localMatting',
        offsetX: 480,
        initialData: {
          label: '本地抠图',
          prompt: '使用本地模型对产品主体进行抠图，输出透明背景 PNG，保留细节边缘',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 960,
        initialData: {
          label: '场景合成',
          prompt:
            '产品置于极简白色台面上，背景为柔和渐变灰色，左上角悬浮一片绿叶投影，光影自然，电商白底图风格，8K高清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'image_to_image',
            aspectRatio: '1:1',
            imageSize: '2048x2048',
            imageCount: 1,
            promptEnhancer: true,
            negativePrompt: '模糊, 低清, 畸形, 多余手指, 文字错误',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1440,
        initialData: {
          label: '产品展示视频',
          prompt: '镜头从产品左侧缓缓推近，绿叶投影轻摆，光影微变，电商产品展示风格',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '1:1',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1920,
        initialData: {
          label: '导出',
          prompt: '统一收集合成图与展示视频，导出为最终交付素材',
        },
      },
    ],
    links: [
      [0, 1, 'imageOutput', 'image'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'video'],
    ],
  },
  {
    id: 'aicg-image-upscale-pipeline',
    name: '图片 → 高清放大 → 视频 → 导出',
    description: '低清图片通过 AI 超分放大到 4K，并生成动态视频',
    category: 'tool',
    scene: '图片处理',
    tags: ['高清', '超分', '4K', '视频'],
    coverTone: 'amber',
    steps: [
      {
        nodeType: 'imageInput',
        offsetX: 0,
        initialData: {
          label: '低清原图',
          imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=60',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 520,
        initialData: {
          label: 'AI 高清放大',
          prompt: '提升画质细节，保持原图构图和色彩，超分辨率增强，4K',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'upscale',
            aspectRatio: '16:9',
            imageSize: '3840x2160',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1040,
        initialData: {
          label: '画面动态化',
          prompt: '镜头缓缓推进山景，云海流动，光影变化，电影感自然风景动态展示',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '16:9',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1560,
        initialData: {
          label: '导出',
          prompt: '导出4K高清图片与动态视频素材',
        },
      },
    ],
    links: [
      [0, 1, 'imageOutput', 'input'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'video'],
    ],
  },
  {
    id: 'aicg-image-grid-video',
    name: '图片 → 生图 → 分镜 → 视频',
    description: '图片素材进入分镜编排，先生图再生成视频片段',
    category: 'video',
    scene: '宫格故事板',
    tags: ['图片', '分镜', '视频'],
    steps: [
      {
        nodeType: 'imageInput',
        offsetX: 0,
        initialData: {
          label: '图片素材',
          imageUrl: 'https://images.unsplash.com/photo-1682687220742-aba13b6e5095?w=800&q=80',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 480,
        initialData: {
          label: '宫格生图',
          prompt: '基于素材风格延展生成宫格分镜图，色调统一，构图连贯，故事板风格，8K高清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'image_to_image',
            aspectRatio: '16:9',
            imageSize: '2560x1440',
          },
        },
      },
      {
        nodeType: 'gridDirector',
        offsetX: 960,
        initialData: {
          label: '分镜导演',
          prompt: '将生图按宫格排布为连贯分镜，标注景别、运镜、时长与画面重点',
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1440,
        initialData: {
          label: '分镜视频',
          prompt: '图片内容动态化，镜头缓缓推进，景深变化，画面从静态变为动态电影感',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '16:9',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1920,
        initialData: {
          label: '导出',
          prompt: '导出宫格分镜图与视频片段',
        },
      },
    ],
    links: [
      [0, 1, 'imageOutput', 'input'],
      [1, 2, 'output', 'imageInput'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'video'],
    ],
  },
  {
    id: 'aicg-video-frame-extract',
    name: '视频 → 抽帧 → 生图 → 视频 → 导出',
    description: '上传视频后提取关键帧，生图增强后再生成动态视频',
    category: 'tool',
    scene: '视频素材处理',
    tags: ['视频', '抽帧', '关键帧', '生图'],
    coverTone: 'amber',
    steps: [
      {
        nodeType: 'videoInput',
        offsetX: 0,
        initialData: { label: '视频素材', title: '视频素材' },
      },
      {
        nodeType: 'frameExtractor',
        offsetX: 520,
        initialData: {
          label: '关键帧提取',
          prompt: '按场景变化自动提取关键帧，保留构图与主体清晰的关键画面',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 1040,
        initialData: {
          label: '帧增强生图',
          prompt: '基于关键帧延展生成同风格画面，提升清晰度与色彩，电影感构图，8K',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'image_to_image',
            aspectRatio: '16:9',
            imageSize: '2560x1440',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1560,
        initialData: {
          label: '动态视频',
          prompt: '镜头缓缓推进，画面由静变动，光影流动，电影感运镜',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '16:9',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 2080,
        initialData: {
          label: '导出',
          prompt: '导出关键帧、增强图与动态视频',
        },
      },
    ],
    links: [
      [0, 1, 'videoOutput', 'input'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'video'],
    ],
  },
  {
    id: 'aicg-audio-video',
    name: '生图 → 音频 → 视频 → 导出',
    description: 'AI生图配合背景音乐生成视频成片',
    category: 'music',
    scene: '音乐视频',
    tags: ['音频', '视频', '生图', '导出'],
    coverTone: 'emerald',
    steps: [
      {
        nodeType: 'aiImage',
        offsetX: 0,
        initialData: {
          label: '视频封面图',
          prompt:
            '宁静的湖面日落，远山剪影，金色阳光洒在水面上，云层层次丰富，电影感静态画面，8K高清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '16:9',
            imageSize: '2560x1440',
          },
        },
      },
      {
        nodeType: 'audioGen',
        offsetX: 480,
        offsetY: 360,
        initialData: {
          label: '背景音乐',
          prompt: '轻柔钢琴曲，适合产品展示，节奏舒缓，30秒',
          params: { mode: 'music', duration: 30 },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 960,
        initialData: {
          label: '视频增强',
          prompt: '镜头缓慢推进，画面稳定，光影柔和变化，湖面微波荡漾，云层缓缓流动',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '16:9',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1440,
        initialData: {
          label: '导出',
          prompt: '合成视频与背景音乐，导出最终成片',
        },
      },
    ],
    links: [
      [0, 2, 'output', 'input'],
      [1, 2, 'audioOutput', 'input'],
      [2, 3, 'output', 'video'],
    ],
  },
  {
    id: 'aicg-3d-panorama',
    name: '3D 导演 → 全景 → 生图 → 视频',
    description: '多机位预演后全景生图，并生成空间漫游视频',
    category: 'space',
    scene: '空间预览',
    tags: ['3D', '全景', '生图', '视频'],
    coverTone: 'blue',
    steps: [
      {
        nodeType: 'director3D',
        offsetX: 0,
        initialData: {
          label: '3D 机位预演',
          title: '3D 机位预演',
          prompt: '在3D场景中预演多个机位与运镜路径，输出全景拍摄方案',
        },
      },
      {
        nodeType: 'panorama360',
        offsetX: 480,
        initialData: {
          label: '360全景',
          prompt: '基于机位预演生成360度全景图，覆盖完整空间视角',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 960,
        initialData: {
          label: '全景生图',
          prompt:
            '现代简约客厅全景，落地窗外是城市天际线，黄昏暖光洒入，家具线条简洁，大理石地面反光，建筑摄影风格，8K',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '16:9',
            imageSize: '2560x1440',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1440,
        initialData: {
          label: '空间漫游视频',
          prompt: '镜头在客厅中缓缓推进，阳光角度变化，光影在地面流动，空间漫游沉浸感',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '16:9',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
    ],
    links: [
      [0, 1, 'output', 'input'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'input'],
    ],
  },
  {
    id: 'aicg-batch-output',
    name: '批量文案 → 生图 → 视频 → 导出',
    description: '批量生成营销文案、配图与视频，统一收集后导出',
    category: 'tool',
    scene: '批量生产',
    tags: ['批量', '生图', '视频', '导出'],
    steps: [
      {
        nodeType: 'batchProcess',
        offsetX: 0,
        initialData: {
          label: '批量调度',
          prompt: '批量调度多个生成任务，统一收集结果后导出',
        },
      },
      {
        nodeType: 'aiGenText',
        offsetX: 520,
        initialData: {
          label: '营销文案',
          prompt:
            '请为以下产品批量生成5条不同风格的营销文案，涵盖：文艺风、专业风、活泼风、简约风、奢华风。产品：智能护眼台灯，无极调光，续航48小时。',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 1040,
        initialData: {
          label: '批量配图',
          prompt:
            '智能护眼台灯产品图，极简白色书桌场景，温暖柔和的阅读光，背景虚化，商业摄影风格，8K高清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '1:1',
            imageSize: '2048x2048',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1560,
        initialData: {
          label: '批量视频',
          prompt: '台灯光线缓缓亮起，书桌场景光影流动，灯臂微调，温馨阅读氛围动态展示',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '1:1',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 2080,
        initialData: {
          label: '批量导出',
          prompt: '统一收集文案、配图与视频，批量导出',
        },
      },
    ],
    links: [
      [0, 1, 'results', 'input'],
      [1, 2, 'textOutput', 'prompt'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'video'],
    ],
  },
  {
    id: 'xt-vr360-video-pipeline',
    name: '360全景 → 生图 → 视频',
    description: '全景浏览、生图增强与视频生成链路',
    category: 'space',
    scene: '空间预览',
    tags: ['全景', '生图', '视频'],
    coverTone: 'blue',
    steps: [
      {
        nodeType: 'panorama360',
        offsetX: 0,
        initialData: {
          label: '360全景图',
          title: '360全景图',
          prompt: '导入或生成360度全景图，作为VR漫游的空间基础',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 500,
        initialData: {
          label: '全景增强图',
          prompt: '基于全景视角延展生成高分辨率空间图，增强细节与光影，建筑摄影风格，8K',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '16:9',
            imageSize: '2560x1440',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1000,
        initialData: {
          label: 'VR 视频',
          prompt: '全景视角缓缓移动，空间沉浸感，光影随视角变化',
          params: {
            provider: 'doubao',
            modelId: 'doubao-seedance-2-0',
            generationMode: 'image_to_video',
            aspectRatio: '16:9',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1500,
        initialData: {
          label: '导出',
          prompt: '导出全景图、增强图与VR视频',
        },
      },
    ],
    links: [
      [0, 1, 'prompt', 'prompt'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'video'],
    ],
  },
  // ─── 人像 / 写真 ──────────────────────────────────────────────
  {
    id: 'aicg-portrait-studio',
    name: '人像写真 → 精修 → 动态视频',
    description: '人物参考 → 风格写真 → 高清精修 → 动态视频 → 导出',
    category: 'image',
    scene: '人像写真',
    tags: ['人像', '写真', '精修', '视频'],
    coverTone: 'rose',
    steps: [
      {
        nodeType: 'imageInput',
        offsetX: 0,
        initialData: {
          label: '人物参考图',
          imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 480,
        initialData: {
          label: '风格写真',
          prompt:
            '年轻女性肖像，柔和的窗边自然光，皮肤通透有光泽，发丝轻盈，眼神温柔，浅景深，胶片质感，电影感色调，8K高清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'reference',
            aspectRatio: '3:4',
            imageSize: '1536x2048',
            imageCount: 1,
            style: 'cinematic',
            quality: 'high',
            promptEnhancer: true,
            negativePrompt: '模糊, 低清, 畸形, 多余手指, 文字错误, 扭曲, 不对称, 瑕疵',
          },
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 960,
        initialData: {
          label: '高清精修',
          prompt: '保留原图细节，提升清晰度和质感，皮肤自然磨皮保留纹理，光影更立体，色彩更通透',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'upscale',
            aspectRatio: '3:4',
            imageSize: '3072x4096',
            imageCount: 1,
            quality: 'high',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1440,
        initialData: {
          label: '人像动态视频',
          prompt:
            '女子微微侧头，发丝随风轻摆，眼神温柔地看向镜头，窗边光影缓缓变化，胶片质感电影感人像动态',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '3:4',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1920,
        initialData: {
          label: '导出',
          prompt: '导出写真图、精修图与人像动态视频',
        },
      },
    ],
    links: [
      [0, 1, 'imageOutput', 'image'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'video'],
    ],
  },
  // ─── 老照片修复 ──────────────────────────────────────────────
  {
    id: 'aicg-old-photo-restore',
    name: '老照片修复 → 上色 → 动态视频',
    description: '老照片 → AI修复 → 智能上色 → 高清放大 → 动态视频 → 导出',
    category: 'tool',
    scene: '图片修复',
    tags: ['老照片', '修复', '上色', '高清', '视频'],
    coverTone: 'amber',
    steps: [
      {
        nodeType: 'imageInput',
        offsetX: 0,
        initialData: {
          label: '老照片',
          imageUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=60',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 480,
        initialData: {
          label: 'AI 修复',
          prompt: '修复老照片，去除划痕、斑点、折痕，恢复面部细节，增强清晰度，还原照片本来面貌',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'image_to_image',
            aspectRatio: '3:4',
            imageSize: '1536x2048',
            imageCount: 1,
            promptEnhancer: false,
            negativePrompt: '划痕, 斑点, 折痕, 模糊, 褪色, 损坏',
          },
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 960,
        initialData: {
          label: '智能上色',
          prompt:
            '为黑白照片自然上色，皮肤色红润自然，衣服色彩复古真实，背景色调柔和有年代感，整体色调和谐统一',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'image_to_image',
            aspectRatio: '3:4',
            imageSize: '1536x2048',
            imageCount: 1,
            style: 'photorealistic',
            quality: 'high',
            promptEnhancer: false,
          },
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 1440,
        initialData: {
          label: '高清放大',
          prompt: '超分辨率放大，保留细节，增强画质，4K高清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'upscale',
            aspectRatio: '3:4',
            imageSize: '3072x4096',
            imageCount: 1,
            quality: 'high',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1920,
        initialData: {
          label: '老照片动态视频',
          prompt: '人物微微呼吸起伏，发丝轻摆，光影缓缓流动，老照片复原为动态影像，怀旧电影感',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '3:4',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 2400,
        initialData: {
          label: '导出',
          prompt: '导出修复图、上色图、高清图与动态视频',
        },
      },
    ],
    links: [
      [0, 1, 'imageOutput', 'input'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'input'],
      [4, 5, 'output', 'video'],
    ],
  },
  // ─── 动漫角色设计 ──────────────────────────────────────────────
  {
    id: 'aicg-anime-character-design',
    name: '动漫角色 → 三视图 → 表情 → 动态视频',
    description: '角色描述 → 立绘 → 三视图 → 表情 → 动态视频 → 输出',
    category: 'character',
    scene: '角色设计',
    tags: ['动漫', '角色设计', '三视图', '表情', '视频'],
    coverTone: 'violet',
    steps: [
      {
        nodeType: 'aiGenText',
        offsetX: 0,
        initialData: {
          prompt:
            '设计一个16岁的动漫少女角色：粉色双马尾长发，蓝色大眼睛，穿白色水手服配红色蝴蝶结，性格活泼开朗，喜欢音乐和画画。请输出详细的角色外貌描述，包括发型、五官、服装、配饰、身高体型等。',
          textWorkspace: 'generate',
          model: 'sensenova-6.7-flash-lite',
          label: '角色设定',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 480,
        initialData: {
          label: '角色正面立绘',
          prompt:
            '动漫风格少女角色立绘，粉色双马尾长发，蓝色大眼睛，白色水手服配红色蝴蝶结，正面站姿，全身像，白色背景，角色设计稿风格，线条清晰，色彩明快，高质量动漫插画，8K',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '2:3',
            imageSize: '1536x2304',
            imageCount: 1,
            style: 'anime',
            quality: 'high',
            promptEnhancer: true,
            negativePrompt: '模糊, 低清, 畸形, 多余手指, 文字错误, 扭曲',
          },
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 960,
        initialData: {
          label: '多角度视图',
          prompt:
            '同一动漫角色的三视图：正面、侧面、背面，粉色双马尾长发，白色水手服，角色设计参考图，等比例，同一角色，设计稿风格，简洁背景，动漫风格',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'reference',
            aspectRatio: '16:9',
            imageSize: '2560x1440',
            imageCount: 1,
            style: 'anime',
            quality: 'high',
            promptEnhancer: true,
          },
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 1440,
        initialData: {
          label: '表情设定',
          prompt:
            '同一动漫角色的六种表情变化：开心、生气、害羞、惊讶、难过、调皮，粉色双马尾，蓝色眼睛，动漫风格头像，整齐排列，表情参考图，高质量插画',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'reference',
            aspectRatio: '16:9',
            imageSize: '2560x1440',
            imageCount: 1,
            style: 'anime',
            quality: 'high',
            promptEnhancer: true,
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1920,
        initialData: {
          label: '角色动态视频',
          prompt:
            '动漫少女眨眼，双马尾随风轻摆，微微歪头微笑，蝴蝶结轻颤，日系动漫角色立绘动态展示',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '2:3',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 2400,
        initialData: {
          label: '导出',
          prompt: '导出角色立绘、三视图、表情图与动态视频',
        },
      },
    ],
    links: [
      [0, 1, 'textOutput', 'prompt'],
      [1, 2, 'output', 'image'],
      [2, 3, 'output', 'image'],
      [3, 4, 'output', 'input'],
      [4, 5, 'output', 'video'],
    ],
  },
  // ─── 产品主图一键生成 ──────────────────────────────────────────
  {
    id: 'aicg-product-main-image',
    name: '产品主图 → 多风格 → 视频 → 导出',
    description: '产品文案 → 多风格主图 → 产品视频 → 导出',
    category: 'commerce',
    scene: '电商主图',
    tags: ['电商', '主图', '文案', '多风格', '视频'],
    coverTone: 'amber',
    steps: [
      {
        nodeType: 'adCopyText',
        offsetX: 0,
        initialData: {
          prompt:
            '为「蓝牙无线耳机」生成电商主图文案：产品特点-主动降噪、40小时续航、IPX5防水、佩戴舒适。目标平台：京东/天猫。风格：科技感高端。需要5个不同角度的主图标题文案。',
          copyType: 'short_ad',
          platform: 'ecommerce',
          tone: 'conversion',
          label: '主图文案',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 480,
        initialData: {
          label: '科技风主图',
          prompt:
            '黑色蓝牙无线耳机悬浮在空中，深蓝色科技感背景，环绕着发光的音波粒子，产品金属质感强烈，灯光从上方打下来，产品倒影在光面上，电商主图风格，高端科技感，8K超清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '1:1',
            imageSize: '2048x2048',
            imageCount: 1,
            style: 'product_shot',
            quality: 'high',
            promptEnhancer: true,
            negativePrompt: '模糊, 低清, 畸形, 多余手指, 文字错误, 水印',
          },
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 960,
        initialData: {
          label: '生活场景图',
          prompt:
            '年轻人戴着白色无线耳机在城市街头跑步，清晨阳光，运动场景，活力感，产品自然融入生活，背景虚化，商业摄影风格，电商详情页场景图，8K',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '1:1',
            imageSize: '2048x2048',
            imageCount: 1,
            style: 'lifestyle',
            quality: 'high',
            promptEnhancer: true,
          },
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 1440,
        initialData: {
          label: '极简白底图',
          prompt:
            '白色蓝牙无线耳机产品图，纯白色背景，产品居中，柔和无影灯光，产品细节清晰，电商主图白底图标准，专业产品摄影，8K高清',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '1:1',
            imageSize: '2048x2048',
            imageCount: 1,
            style: 'minimal',
            quality: 'high',
            promptEnhancer: true,
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1920,
        initialData: {
          label: '产品主图视频',
          prompt: '耳机悬浮缓缓旋转，音波粒子环绕流动，灯光渐变，科技感产品主图动态展示',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            aspectRatio: '1:1',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 2400,
        initialData: {
          label: '导出',
          prompt: '导出多风格主图与产品视频',
        },
      },
    ],
    links: [
      [0, 1, 'prompt', 'prompt'],
      [0, 2, 'prompt', 'prompt'],
      [0, 3, 'prompt', 'prompt'],
      [1, 4, 'output', 'input'],
      [4, 5, 'output', 'video'],
    ],
  },
  // ─── 知识科普短视频 ────────────────────────────────────────────
  {
    id: 'aicg-educational-shorts',
    name: '知识科普短视频',
    description: '选题 → 文案脚本 → 分镜生图 → 视频合成 → 配音 → 导出',
    category: 'video',
    scene: '知识短视频',
    tags: ['科普', '知识', '短视频', '配音'],
    coverTone: 'blue',
    steps: [
      {
        nodeType: 'aiGenText',
        offsetX: 0,
        initialData: {
          prompt:
            '请写一个60秒的科普短视频脚本，主题是「为什么天空是蓝色的？」。要求：1) 开头3秒钩子 2) 用通俗语言解释瑞利散射原理 3) 配合画面描述 4) 结尾互动提问。风格：轻松有趣，适合抖音/B站。',
          textWorkspace: 'generate',
          model: 'sensenova-6.7-flash-lite',
          label: '科普脚本',
        },
      },
      {
        nodeType: 'script',
        offsetX: 480,
        initialData: {
          label: '分镜脚本',
          script:
            '【科普短视频：为什么天空是蓝色的？】\n\n镜头1(0-5s)：天空特写，蓝色渐变，白云飘过\n旁白：你有没有想过，为什么天空是蓝色的，而不是绿色或紫色？\n\n镜头2(5-20s)：太阳光穿过大气层的示意图，不同颜色的光波\n旁白：其实这都要怪一种叫「瑞利散射」的物理现象。太阳光看起来是白色的，但它其实是由红橙黄绿青蓝紫七种颜色的光组成的。\n\n镜头3(20-40s)：大气分子散射蓝光的动画效果\n旁白：当太阳光进入大气层时，波长较短的蓝紫光最容易被空气分子撞得到处乱飞，散射到整个天空中。所以我们抬头看到的天空就是蓝色的啦。\n\n镜头4(40-55s)：日出日落时橙红色天空的画面\n旁白：那你知道为什么日出日落时天空又变成橙红色吗？评论区告诉我答案！',
          scriptType: 'educational',
          tone: 'casual',
          style: '科普动画',
          model: 'doubao-seedream-5-0-lite',
          prompt: '60秒科普短视频分镜脚本，包含天空特写、瑞利散射示意、散射动画、日落互动四个镜头',
        },
      },
      {
        nodeType: 'gridDirector',
        offsetX: 960,
        initialData: {
          label: '分镜导演',
          prompt: '将科普脚本编排为连贯分镜，标注景别、运镜、时长与画面重点',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 1440,
        initialData: {
          label: '分镜主图',
          prompt:
            '美丽的蓝天和白云，阳光从云层中射出，画面通透清澈，摄影质感，科普视频封面风格，高质量，8K',
          params: {
            modelId: 'agnes-image-2.1-flash',
            modelProvider: 'agnes',
            generationMode: 'text_to_image',
            aspectRatio: '16:9',
            imageSize: '2560x1440',
            imageCount: 1,
            style: 'photorealistic',
            quality: 'high',
            promptEnhancer: true,
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1920,
        initialData: {
          label: '科普视频',
          prompt: '蓝天白云缓缓移动，阳光穿透云层洒下，光线流动，宁静祥和，科普视频开场画面',
          params: {
            provider: 'doubao',
            modelId: 'doubao-seedance-2-0',
            generationMode: 'image_to_video',
            aspectRatio: '16:9',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'audioGen',
        offsetX: 1440,
        offsetY: 520,
        initialData: {
          label: '旁白配音',
          prompt: '年轻女声旁白，语速适中，轻松亲切，适合科普短视频风格',
          params: { mode: 'tts', voice: 'female_young', speed: 1.0 },
        },
      },
      {
        nodeType: 'output',
        offsetX: 2400,
        initialData: {
          label: '导出',
          prompt: '导出科普短视频成片',
        },
      },
    ],
    links: [
      [0, 1, 'textOutput', 'input'],
      [1, 2, 'scenes', 'scriptInput'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'input'],
      [1, 5, 'script', 'prompt'],
      [4, 6, 'output', 'video'],
      [5, 6, 'output', 'audio'],
    ],
  },
  // ─── Qwen-Edit 2509 智能图像编辑 ────────────────────────────────
  {
    id: 'aicg-qwen-image-edit',
    name: 'Qwen-Edit · 智能图像编辑',
    description: '基于 Qwen-Image-Edit 2509 的多图编辑工作流，支持角色一致性、文字编辑、局部重绘',
    category: 'image',
    scene: '图像编辑',
    tags: ['Qwen-Edit', '图像编辑', '多图编辑', '角色一致性'],
    coverTone: 'cyan',
    steps: [
      {
        nodeType: 'imageInput',
        offsetX: 0,
        initialData: {
          label: '主体图片',
          title: '主体图片',
          prompt: '输入需要编辑的主体图片，作为图像编辑的基础素材',
        },
      },
      {
        nodeType: 'imageInput',
        offsetX: 0,
        offsetY: 320,
        initialData: {
          label: '参考图片',
          title: '参考图片（可选）',
          prompt: '输入参考图片，用于风格迁移、光影迁移或参考图编辑',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 520,
        initialData: {
          label: 'Qwen-Edit 图像编辑',
          title: 'Qwen-Edit 图像编辑',
          prompt: '参考图2的结构和色调，对图1进行定向编辑，保持主体一致性，精细控制文字和局部区域',
          params: {
            modelId: 'qwen-edit-2509',
            modelProvider: 'comfyui',
            generationMode: 'image_to_image',
            imageSize: '2K',
            aspectRatio: 'auto',
            steps: 28,
            cfgScale: 7,
            negativePrompt: '模糊, 低清, 畸形, 多余手指, 文字错误, 扭曲',
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1040,
        initialData: {
          label: '编辑结果动态化',
          title: '编辑结果动态化',
          prompt: '将编辑后的图像动态化，镜头缓缓推进，画面微变，保持编辑效果稳定',
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            generationMode: 'image_to_video',
            resolution: '1080p',
            duration: 5,
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1560,
        initialData: {
          label: '导出',
          title: '导出',
          prompt: '导出编辑后的图像与动态视频',
        },
      },
    ],
    links: [
      [0, 2, 'imageOutput', 'input'],
      [1, 2, 'imageOutput', 'image'],
      [2, 3, 'output', 'input'],
      [3, 4, 'output', 'video'],
    ],
  },
  // ─── Wan 2.2 Animate 角色动画 ────────────────────────────────────
  {
    id: 'aicg-wan22-animate',
    name: 'Wan 2.2 · 角色动画',
    description: '基于 Wan 2.2 Animate 的角色替换与动作迁移工作流，支持 Mix/Move 双模式',
    category: 'video',
    scene: '角色动画',
    tags: ['Wan2.2', '角色动画', '动作迁移', '角色替换'],
    coverTone: 'amber',
    steps: [
      {
        nodeType: 'imageInput',
        offsetX: 0,
        initialData: {
          label: '角色参考图',
          title: '角色参考图',
          prompt: '输入需要动画化的角色图片，保持角色风格与特征',
        },
      },
      {
        nodeType: 'videoInput',
        offsetX: 0,
        offsetY: 320,
        initialData: {
          label: '动作参考视频',
          title: '动作参考视频',
          prompt: '输入包含动作和表情的参考视频，用于动作迁移',
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 520,
        initialData: {
          label: 'Wan 2.2 Animate',
          title: 'Wan 2.2 Animate',
          prompt:
            '角色保持参考图风格，跟随输入视频动作和表情，自然环境融合，支持角色替换和动作迁移',
          params: {
            modelId: 'wan2.2-animate-14b',
            modelProvider: 'comfyui',
            generationMode: 'image_to_video',
            resolution: '1080p',
            duration: 5,
            cameraMovement: 'auto',
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1040,
        initialData: {
          label: '导出',
          title: '导出',
          prompt: '导出角色动画视频',
        },
      },
    ],
    links: [
      [0, 2, 'imageOutput', 'input'],
      [1, 2, 'videoOutput', 'video'],
      [2, 3, 'output', 'video'],
    ],
  },
  // ─── Wan 2.2 I2V 图生视频 ────────────────────────────────────────
  {
    id: 'aicg-wan22-i2v',
    name: 'Wan 2.2 · 图生视频',
    description: '基于 Wan 2.2 I2V 的高清图生视频工作流，采用 MoE 架构，支持 720P 输出',
    category: 'video',
    scene: '图生视频',
    tags: ['Wan2.2', '图生视频', 'I2V', 'MoE', '高清视频'],
    coverTone: 'blue',
    steps: [
      {
        nodeType: 'imageInput',
        offsetX: 0,
        initialData: {
          label: '输入图片',
          title: '输入图片',
          prompt: '输入需要转换为视频的静态图片，作为视频生成的起始帧',
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 520,
        initialData: {
          label: 'Wan 2.2 I2V',
          title: 'Wan 2.2 I2V',
          prompt: '缓慢推镜头，主体保持稳定，背景有自然动态，电影级画质，平滑过渡，光影细腻变化',
          params: {
            modelId: 'wan2.2-i2v-14b',
            modelProvider: 'comfyui',
            generationMode: 'image_to_video',
            resolution: '720p',
            duration: 4,
            cameraMovement: 'slow_pan',
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1040,
        initialData: {
          label: '导出',
          title: '导出',
          prompt: '导出高清图生视频',
        },
      },
    ],
    links: [
      [0, 1, 'imageOutput', 'input'],
      [1, 2, 'output', 'video'],
    ],
  },
  // ─── 多角度拆分堆栈 ────────────────────────────────────────────────
  {
    id: 'aicg-multiangle-stack',
    name: '多角度拆分堆栈 · 5视角视频',
    description: '单图输入生成5个角度静态图，再用 Wan 2.2 动画化并堆叠为 9:16 竖屏视频',
    category: 'video',
    scene: '多角度视频',
    tags: ['多角度', '拆分堆栈', '9:16', 'Qwen-Edit', 'Wan2.2', '竖屏'],
    coverTone: 'rose',
    steps: [
      {
        nodeType: 'imageInput',
        offsetX: 0,
        initialData: {
          label: '源图片',
          title: '源图片',
          prompt: '输入需要多角度展示的源图片，作为多角度生成的基础',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 520,
        initialData: {
          label: '多角度生图',
          title: '多角度生图',
          prompt: '从5个角度展示主体：正面、左侧、右侧、俯视、仰视，保持角色一致性，多角度同步生成',
          params: {
            modelId: 'qwen-edit-2511',
            modelProvider: 'comfyui',
            generationMode: 'multi_angle',
            imageSize: '2K',
            aspectRatio: '9:16',
            imageCount: 5,
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1040,
        initialData: {
          label: '多角度动画',
          title: '多角度动画',
          prompt: '5个角度同步动画化，镜头稳定，保持角色特征一致，竖屏展示',
          params: {
            modelId: 'wan2.2-i2v-14b',
            modelProvider: 'comfyui',
            generationMode: 'image_to_video',
            resolution: '1080p',
            duration: 5,
            outputRatio: '9:16',
          },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1560,
        initialData: {
          label: '导出',
          title: '导出',
          prompt: '导出5个角度的静态图与拆分堆栈视频',
        },
      },
    ],
    links: [
      [0, 1, 'imageOutput', 'input'],
      [1, 2, 'output', 'input'],
      [2, 3, 'output', 'video'],
    ],
  },
  // ─── 连贯场景故事叙事 ──────────────────────────────────────────────
  {
    id: 'aicg-coherent-scenes',
    name: '连贯场景 · 故事叙事',
    description:
      'Qwen-Image-Edit 生成连贯关键帧 → Wan 2.2 动画化 → 音效合成，适合叙事艺术与动画预览',
    category: 'script',
    scene: '故事叙事',
    tags: ['连贯场景', '叙事', '故事板', 'Qwen-Edit', 'Wan2.2', 'Foley'],
    coverTone: 'violet',
    steps: [
      {
        nodeType: 'aiGenText',
        offsetX: 0,
        initialData: {
          label: '场景描述',
          title: '场景描述',
          prompt:
            '场景1：建立镜头，全景展示环境；场景2：中景，角色进入；场景3：特写，情感表达；保持光线和色调一致，电影感叙事',
        },
      },
      {
        nodeType: 'aiImage',
        offsetX: 520,
        initialData: {
          label: '关键帧生图',
          title: '关键帧生图',
          prompt: '基于场景描述生成连贯关键帧，保持光线、色调、角色一致性，电影感构图，多镜头序列',
          params: {
            modelId: 'qwen-edit-2509',
            modelProvider: 'comfyui',
            generationMode: 'image_to_image',
            imageSize: '2K',
            aspectRatio: '16:9',
            imageCount: 3,
          },
        },
      },
      {
        nodeType: 'aiVideo',
        offsetX: 1040,
        initialData: {
          label: '场景动画',
          title: '场景动画',
          prompt: '将关键帧动画化，镜头连续推进，场景间过渡自然，电影感运镜，保持叙事连贯性',
          params: {
            modelId: 'wan2.2-i2v-14b',
            modelProvider: 'comfyui',
            generationMode: 'image_to_video',
            resolution: '1080p',
            duration: 8,
            cameraMovement: 'continuous',
          },
        },
      },
      {
        nodeType: 'audioGen',
        offsetX: 1040,
        offsetY: 320,
        initialData: {
          label: '场景音效',
          title: '场景音效',
          prompt: '生成场景相关的环境音效和Foley音效，增强沉浸感',
          params: { mode: 'foley', duration: 8 },
        },
      },
      {
        nodeType: 'output',
        offsetX: 1560,
        initialData: {
          label: '导出',
          title: '导出',
          prompt: '导出连贯场景视频与音效',
        },
      },
    ],
    links: [
      [0, 1, 'textOutput', 'prompt'],
      [1, 2, 'output', 'input'],
      [2, 4, 'output', 'video'],
      [3, 4, 'audioOutput', 'audio'],
    ],
  },
  ...MATERIAL_AICG_WORKFLOW_TEMPLATES,
];

function getDef(nodeType: string) {
  return NODE_TYPES.find((n) => n.id === nodeType);
}

function defaultSourceHandle(nodeType: string): string {
  const def = getDef(nodeType);
  return def?.outputPorts[0]?.id || 'output';
}

function normalizeWorkflowStepPositions(
  steps: AICGWorkflowTemplate['steps']
): Array<{ x: number; y: number }> {
  const columns = Array.from(new Set(steps.map((step) => step.offsetX))).sort((a, b) => a - b);
  const rows = Array.from(new Set(steps.map((step) => step.offsetY ?? 0))).sort((a, b) => a - b);

  const columnWidths = new Map(
    columns.map((column) => [
      column,
      Math.max(
        ...steps
          .filter((step) => step.offsetX === column)
          .map((step) => getCanvasNodeDimensions(step.nodeType).width)
      ),
    ])
  );

  const rowHeights = new Map(
    rows.map((row) => [
      row,
      Math.max(
        ...steps
          .filter((step) => (step.offsetY ?? 0) === row)
          .map((step) => getCanvasNodeDimensions(step.nodeType).height)
      ),
    ])
  );

  const columnPositions = new Map<number, number>();
  let nextX = 0;
  for (const column of columns) {
    columnPositions.set(column, nextX);
    nextX += (columnWidths.get(column) || 0) + CANVAS_NODE_HORIZONTAL_GAP;
  }

  const rowPositions = new Map<number, number>();
  let nextY = 0;
  for (const row of rows) {
    rowPositions.set(row, nextY);
    nextY += (rowHeights.get(row) || 0) + CANVAS_NODE_VERTICAL_GAP;
  }

  return steps.map((step) => ({
    x: columnPositions.get(step.offsetX) ?? step.offsetX,
    y: rowPositions.get(step.offsetY ?? 0) ?? step.offsetY ?? 0,
  }));
}

function buildNodeDataWithInitialData(
  def: NodeTypeDefinition,
  initialData: Record<string, unknown>
): Record<string, unknown> {
  const base = buildNodeDataFromDefinition(def);
  const baseParams = (base.params as Record<string, unknown>) || {};
  const initialParams = (initialData.params as Record<string, unknown>) || {};
  const mergedParams = { ...baseParams, ...initialParams };
  return {
    ...base,
    ...initialData,
    params: mergedParams,
  };
}

export function instantiateAICGWorkflow(
  template: AICGWorkflowTemplate,
  origin: { x: number; y: number }
): { nodes: Node[]; edges: Edge[] } {
  const nodeIds: string[] = [];
  const nodes: Node[] = [];
  const normalizedPositions = normalizeWorkflowStepPositions(template.steps);

  for (const [index, step] of template.steps.entries()) {
    const def = getDef(step.nodeType);
    if (!def) continue;
    const id = generateId();
    const normalizedPosition = normalizedPositions[index] || {
      x: step.offsetX,
      y: step.offsetY ?? 0,
    };
    nodeIds.push(id);
    const baseData = buildNodeDataWithInitialData(def, step.initialData || {});
    nodes.push({
      id,
      type: step.nodeType,
      position: {
        x: origin.x + normalizedPosition.x,
        y: origin.y + normalizedPosition.y,
      },
      data: completeWorkflowNodeData(step.nodeType, baseData, {
        templateId: template.id,
        templateName: template.name,
        templateDescription: template.description,
        nodeDescription: def.description,
        stepIndex: index,
      }),
    });
  }

  const edges: Edge[] = [];
  for (const [si, ti, sh, th] of template.links) {
    const sourceId = nodeIds[si];
    const targetId = nodeIds[ti];
    if (!sourceId || !targetId) continue;
    const sourceType = template.steps[si]?.nodeType;
    const targetType = template.steps[ti]?.nodeType;
    edges.push({
      id: `aicg-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      sourceHandle: sh || defaultSourceHandle(sourceType),
      targetHandle: th || getDefaultTargetHandle(targetType, sourceType),
      animated: true,
      type: 'comfyui',
    });
  }

  return { nodes: ensureWorkflowNodesHaveVideo(nodes, template.id), edges };
}

export function getAICGWorkflowTemplate(id: string): AICGWorkflowTemplate | undefined {
  return AICG_WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
