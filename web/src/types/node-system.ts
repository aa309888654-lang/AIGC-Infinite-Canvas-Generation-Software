/**
 * 节点控制器系统类型定义
 * 参考ComfyUI的交互模式和架构设计
 */

import { Node, Edge } from '@xyflow/react';
import { DEFAULT_GRID_DIRECTOR_PARAMS } from '@/components/canvas/nodes/grid-director-core';
import {
  DEFAULT_DIRECTOR3D_PARAMS,
  DEFAULT_PANORAMA_VIEW,
} from '@/components/canvas/nodes/director3d-core';
import {
  CANVAS_NODE_HORIZONTAL_GAP,
  getCanvasNodeDimensions,
  withCanvasNodeDefaultSize,
} from '@/lib/canvas-node-dimensions';

// ==================== 节点端口类型 ====================
export type PortType = 'string' | 'image' | 'video' | 'audio' | 'prompt';

// 端口默认值类型
export type PortValue = string | number | boolean;

export interface PortConfig {
  id: string;
  name: string;
  type: PortType;
  optional?: boolean;
  multiple?: boolean;
}

// ==================== 节点分类 ====================
export type NodeCategory =
  | 'input'
  | 'output'
  | 'processing'
  | 'effect'
  | 'text'
  | 'audio'
  | 'image'
  | 'video'
  | 'utility';

// ==================== 节点类型定义 ====================
export interface NodeTypeDefinition {
  id: string;
  name: string;
  category: NodeCategory;
  description: string;
  icon: string;
  color: string;

  // 输入端口
  inputPorts: PortConfig[];

  // 输出端口
  outputPorts: PortConfig[];

  // 默认参数
  defaultParams: Record<string, unknown>;

  // 向后兼容标记
  /** @deprecated 标记为已弃用 */
  deprecated?: boolean;
  /** 替代节点类型ID */
  replacedBy?: string;
}

// ==================== 节点类型定义 ====================
export const NODE_TYPES: NodeTypeDefinition[] = [
  // ==================== 输入类节点 ====================
  {
    id: 'prompt',
    name: '提示词',
    category: 'input',
    description: '输入文本提示词',
    icon: '📝',
    color: '#6610F2',
    inputPorts: [],
    outputPorts: [{ id: 'promptOutput', name: '提示词', type: 'prompt' }],
    defaultParams: {
      prompt: '',
      negativePrompt: '',
      promptType: 'video',
      optimizeModel: 'auto',
    },
  },
  {
    id: 'aiGenText',
    name: '文本节点',
    category: 'input',
    description: 'AI 生成文本 / 剧本解析分镜 — 同一节点切换工作区',
    icon: '✨',
    color: '#7c3aed',
    inputPorts: [
      { id: 'promptInput', name: '提示词输入', type: 'prompt', optional: true },
      { id: 'input', name: '剧本文本输入', type: 'string', optional: true },
    ],
    outputPorts: [
      { id: 'textOutput', name: '文本输出', type: 'string' },
      { id: 'scenes', name: '分镜输出', type: 'string' },
      { id: 'script', name: '剧本输出', type: 'string' },
    ],
    defaultParams: {
      textWorkspace: 'generate',
      prompt: '',
      outputText: '',
      model: 'sensenova-6.7-flash-lite',
      systemPrompt: '',
      enableThinking: false,
      variableName: 'text_output',
      scriptParams: {
        script: '',
        scenes: [],
        style: '摄影写真',
        model: 'doubao-seedream-5-0-lite',
        scriptType: 'cinematic',
        tone: 'casual',
      },
    },
  },
  {
    id: 'imageInput',
    name: '图片输入',
    category: 'input',
    description: '输入图片文件',
    icon: '🖼️',
    color: '#2ECC71',
    inputPorts: [{ id: 'input', name: '图片输入', type: 'image', optional: true }],
    outputPorts: [{ id: 'imageOutput', name: '图片', type: 'image' }],
    defaultParams: {},
  },
  {
    id: 'videoInput',
    name: '视频输入',
    category: 'input',
    description: '输入视频文件',
    icon: '🎬',
    color: '#3498DB',
    inputPorts: [{ id: 'input', name: '视频输入', type: 'video', optional: true }],
    outputPorts: [{ id: 'videoOutput', name: '视频', type: 'video' }],
    defaultParams: {},
  },
  {
    id: 'frameExtractor',
    name: '视频抽帧',
    category: 'video',
    description: '从视频中抽取关键帧并作为图片输出',
    icon: '🎞️',
    color: '#F59E0B',
    inputPorts: [{ id: 'input', name: '视频输入', type: 'video', optional: true }],
    outputPorts: [{ id: 'output', name: '图片帧', type: 'image', multiple: true }],
    defaultParams: {
      frameCount: 10,
      intervalSeconds: 1,
      extractionMode: 'even',
      quality: 'high',
      outputFormat: 'image/jpeg',
    },
  },
  {
    id: 'audioInput',
    name: '音频输入',
    category: 'input',
    description: '输入音频文件',
    icon: '🎵',
    color: '#EC4899',
    inputPorts: [{ id: 'input', name: '音频输入', type: 'audio', optional: true }],
    outputPorts: [{ id: 'audioOutput', name: '音频', type: 'audio' }],
    defaultParams: {
      volume: 100,
      playbackRate: 1,
      loop: false,
    },
  },
  {
    id: 'audioGen',
    name: '音频',
    category: 'video',
    description: '上传/预览音频，AI 语音合成或音乐生成',
    icon: '🎙️',
    color: '#EC4899',
    inputPorts: [{ id: 'prompt', name: '文本/歌词', type: 'string', optional: true }],
    outputPorts: [{ id: 'audioOutput', name: '音频', type: 'audio' }],
    defaultParams: {
      modelProvider: 'stepfun',
      modelId: 'stepaudio-2.5-tts',
      text: '',
      mode: 'tts',
      voiceId: 'cixingnansheng',
      speed: 1,
      vol: 1,
      pitch: 0,
      format: 'mp3',
    },
  },
  // ==================== 图片生成类节点 ====================
  // 已移除已弃用的 imageGen 节点，请使用 aiImage 代替
  // 已移除已弃用的 videoGen 节点，请使用 advancedVideoGen 代替

  {
    id: 'aiVideo',
    name: 'AI视频',
    category: 'video',
    description: '统一 AI 视频入口 - 按模型动态切换文生视频、图生视频、首尾帧、多参考等参数',
    icon: '🎞️',
    color: '#FF6B00',
    inputPorts: [
      { id: 'input', name: '输入', type: 'image', optional: true, multiple: true },
      { id: 'prompt', name: '提示词', type: 'prompt', optional: true },
      { id: 'referenceImage', name: '参考图', type: 'image', optional: true, multiple: true },
      { id: 'referenceImage1', name: '参考图 1', type: 'image', optional: true },
      { id: 'referenceImage2', name: '参考图 2', type: 'image', optional: true },
      { id: 'referenceImage3', name: '参考图 3', type: 'image', optional: true },
      { id: 'referenceImage4', name: '参考图 4', type: 'image', optional: true },
      { id: 'referenceImage5', name: '参考图 5', type: 'image', optional: true },
      { id: 'referenceImage6', name: '参考图 6', type: 'image', optional: true },
      { id: 'firstFrame', name: '首帧', type: 'image', optional: true },
      { id: 'lastFrame', name: '尾帧', type: 'image', optional: true },
      { id: 'video', name: '视频参考', type: 'video', optional: true },
    ],
    outputPorts: [
      { id: 'output', name: '生成视频', type: 'video' },
      // P3-5: 移除冗余的 `video` 输出端口（与 `output` 重复，UI 未渲染）
      // 旧工作流中 sourceHandle='video' 的边仍可通过 inferPortType('video')='video' 兜底解析。
    ],
    defaultParams: {
      modelId: 'agnes-video-v2.0',
      modelProvider: 'agnes',
      provider: 'agnes',
      generationMode: 'text_to_video',
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 4,
      motionStrength: 5,
      cameraMovement: 'auto',
      prompt: '',
      negativePrompt: '模糊, 低清, 变形, 崩坏, 最差画质',
      promptEnhancer: true,
      generateAudio: false,
      characterConsistency: 8,
      styleStrength: 5,
      clipCount: 1,
      seed: -1,
    },
  },

  {
    id: 'aicgVideoGen',
    name: 'AICG 视频节点',
    category: 'video',
    description: 'AICG 风格视频生成 — 文生视频 / 图生视频 / 首尾帧 / 多模态参考',
    icon: '🎬',
    color: '#E91E63',
    deprecated: true,
    replacedBy: 'aiVideo',
    inputPorts: [
      { id: 'input', name: '输入', type: 'image', optional: true, multiple: true },
      { id: 'prompt', name: '提示词', type: 'prompt', optional: true },
      { id: 'referenceImage', name: '参考图', type: 'image', optional: true },
      { id: 'firstFrame', name: '首帧', type: 'image', optional: true },
      { id: 'lastFrame', name: '尾帧', type: 'image', optional: true },
      { id: 'video', name: '视频参考', type: 'video', optional: true },
    ],
    outputPorts: [{ id: 'output', name: '生成视频', type: 'video' }],
    defaultParams: {
      provider: 'agnes',
      modelId: 'agnes-video-v2.0',
      generationMode: 'text_to_video',
      resolution: '720p',
      aspectRatio: '16:9',
      duration: 4,
      prompt: '',
      negativePrompt: '模糊, 低清, 变形, 崩坏, 最差画质',
      promptEnhancer: true,
      webSearch: false,
      returnLastFrame: false,
      generateAudio: false,
      keepOriginalSound: false,
      cameraMovement: 'auto',
      multiShot: false,
      referenceType: 'feature',
      seed: -1,
      characterConsistency: 8,
      styleStrength: 5,
      referenceImages: [],
      promptReferences: [],
      edgeRoleMap: {},
      audioGeneration: 'music',
    },
  },

  {
    id: 'script',
    name: '脚本节点',
    category: 'input',
    description: '专门脚本能力，支持剧本、视频参考、角色参考生成分镜脚本',
    icon: '📜',
    color: '#10B981',
    inputPorts: [
      { id: 'input', name: '剧本文本输入', type: 'string', optional: true },
      { id: 'videoReference', name: '视频参考', type: 'video', optional: true },
      { id: 'characterReference', name: '角色参考', type: 'image', optional: true },
    ],
    outputPorts: [
      { id: 'scenes', name: '分镜输出', type: 'string' },
      { id: 'script', name: '剧本输出', type: 'string' },
    ],
    defaultParams: {
      script: '',
      scenes: [],
      style: '摄影写真',
      model: 'doubao-seedream-5-0-lite',
      scriptType: 'cinematic',
      tone: 'casual',
      scriptSourceMode: 'text',
      referenceVideoUrl: '',
      referenceCharacterNote: '',
    },
  },
  {
    id: 'adCopyText',
    name: '广告词',
    category: 'text',
    description: '独立广告文案轻节点：只负责卖点、钩子、CTA，不集成生图/生视频功能',
    icon: '📣',
    color: '#F97316',
    inputPorts: [{ id: 'input', name: '产品/脚本输入', type: 'string', optional: true }],
    outputPorts: [
      { id: 'output', name: '广告文案', type: 'string' },
      { id: 'prompt', name: '生成提示词', type: 'prompt', optional: true },
    ],
    defaultParams: {
      prompt: '请围绕产品核心卖点生成 3 条短视频广告词，包含开场钩子、利益点、行动号召。',
      copyType: 'short_ad',
      platform: 'short_video',
      tone: 'conversion',
    },
  },
  {
    id: 'brandCopyText',
    name: '品牌文案',
    category: 'text',
    description: '独立品牌文案轻节点：输出品牌主张、海报标题与视觉关键词',
    icon: '🏷️',
    color: '#A855F7',
    inputPorts: [{ id: 'input', name: '品牌资料输入', type: 'string', optional: true }],
    outputPorts: [
      { id: 'output', name: '品牌文案', type: 'string' },
      { id: 'prompt', name: '视觉提示词', type: 'prompt', optional: true },
    ],
    defaultParams: {
      prompt: '请根据品牌定位生成品牌主张、海报标题、视觉关键词和一段适合 AI 生图的画面描述。',
      copyType: 'brand',
      tone: 'premium',
      visualKeywords: [],
    },
  },

  // ==================== 图像处理节点 ====================
  // 已移除已弃用的 imageAnalysis 节点，请使用 unifiedImageStudio 代替
  // 已移除已弃用的 inpainting 节点，请使用 unifiedImageStudio 代替
  // 已移除已弃用的 outpainting 节点，请使用 unifiedImageStudio 代替

  // ==================== 图片生成节点 ====================
  {
    id: 'aiImage',
    name: 'AI图片',
    category: 'image',
    description: '统一 AI 图片入口 - 按模型动态切换文生图、图生图、参考图、高清、局部重绘等参数',
    icon: '🖼️',
    color: '#8B5CF6',
    inputPorts: [
      { id: 'input', name: '输入', type: 'image', optional: true, multiple: true },
      { id: 'prompt', name: '提示词', type: 'prompt', optional: true },
      { id: 'image', name: '参考图', type: 'image', optional: true, multiple: true },
    ],
    outputPorts: [{ id: 'output', name: '生成图片', type: 'image' }],
    defaultParams: {
      modelId: 'agnes-image-2.1-flash',
      modelProvider: 'agnes',
      generationMode: 'text_to_image',
      aspectRatio: '16:9',
      imageSize: '3840x2160',
      imageCount: 1,
      style: 'cinematic',
      quality: 'high',
      prompt: '',
      negativePrompt: '模糊, 低清, 畸形, 多余手指, 文字错误',
      promptEnhancer: true,
      seed: -1,
    },
  },

  // 已移除已弃用的 imageGridSplitter 节点，请使用 gridDirector 代替

  // ==================== 智能抠图节点 ====================
  {
    id: 'localMatting',
    name: '智能抠图',
    category: 'image',
    description: '使用本地 ONNX 模型进行抠图，不依赖网络',
    icon: '✂️',
    color: '#10B981',
    inputPorts: [{ id: 'image', name: '图片输入', type: 'image' }],
    outputPorts: [
      { id: 'output', name: '图片输出', type: 'image' },
      { id: 'mask', name: '蒙版输出', type: 'image', optional: true },
    ],
    defaultParams: {
      modelType: 'bria',
      inferenceEngine: 'onnx',
      edgeRefinement: 'medium',
      featherRadius: 1,
      decontaminateColors: true,
      backgroundColor: 'transparent',
    },
  },

  // ==================== 视频超分节点（提升清晰度）====================
  {
    id: 'videoUpscale',
    name: '提升清晰度',
    category: 'video',
    description: '基于深度学习的视频超分，智能提升视频分辨率至1080P，增强画面细节',
    icon: '✨',
    color: '#06B6D4',
    inputPorts: [{ id: 'video', name: '视频输入', type: 'video' }],
    outputPorts: [{ id: 'output', name: '高清视频输出', type: 'video' }],
    defaultParams: {
      targetWidth: 1920,
      targetHeight: 1080,
      autoExecute: false,
    },
  },

  {
    id: 'characterLibrary',
    name: '角色库',
    category: 'video',
    description: '从角色资产中心选择角色，并输出角色参考图、服装参考图与角色 payload',
    icon: '📚',
    color: '#8B5CF6',
    inputPorts: [],
    outputPorts: [
      { id: 'characterRef', name: '角色参考图', type: 'image' },
      { id: 'outfitRef', name: '服装参考图', type: 'image', optional: true },
      { id: 'payload', name: '角色 payload', type: 'string' },
    ],
    defaultParams: {
      selectedCharacterId: '',
    },
  },
  {
    id: 'sceneLibrary',
    name: '场景库',
    category: 'video',
    description: '从场景资产中心选择场景，并输出场景参考图与场景 payload',
    icon: '🏞️',
    color: '#10B981',
    inputPorts: [],
    outputPorts: [
      { id: 'sceneRef', name: '场景参考图', type: 'image' },
      { id: 'payload', name: '场景 payload', type: 'string' },
    ],
    defaultParams: {
      selectedSceneId: '',
    },
  },
  {
    id: 'propLibrary',
    name: '道具库',
    category: 'video',
    description: '从道具资产中心选择道具，并输出道具参考图与道具 payload',
    icon: '🗡️',
    color: '#F97316',
    inputPorts: [],
    outputPorts: [
      { id: 'propRef', name: '道具参考图', type: 'image' },
      { id: 'payload', name: '道具 payload', type: 'string' },
    ],
    defaultParams: {
      selectedPropId: '',
    },
  },
  {
    id: 'gridDirector',
    name: '分镜导演',
    category: 'video',
    description: '统一宫格生成、分镜编排与混合流程 - 支持快速宫格/魔法分镜/高级导演三种模式',
    icon: '🎬',
    color: '#F59E0B',
    inputPorts: [
      { id: 'scriptInput', name: '剧本/分镜输入', type: 'string', optional: true, multiple: true },
      { id: 'imageInput', name: '图片参考', type: 'image', optional: true, multiple: true },
      { id: 'characterRef', name: '角色参考', type: 'image', optional: true, multiple: true },
      { id: 'input', name: '兼容输入', type: 'image', optional: true, multiple: true },
    ],
    outputPorts: [
      { id: 'output', name: '输出', type: 'image' },
      { id: 'scenes', name: '分镜数据', type: 'string' },
    ],
    defaultParams: DEFAULT_GRID_DIRECTOR_PARAMS as any as Record<string, unknown>,
  },
  {
    id: 'scriptStoryboard',
    name: '剧本分镜',
    category: 'video',
    description: '将剧本文本拆解为可生成的分镜画面，输出分镜数据与画面结果',
    icon: '🎞️',
    color: '#F59E0B',
    inputPorts: [
      { id: 'scriptInput', name: '剧本输入', type: 'string', optional: true, multiple: true },
      { id: 'imageInput', name: '图片参考', type: 'image', optional: true, multiple: true },
      { id: 'characterRef', name: '角色参考', type: 'image', optional: true, multiple: true },
      { id: 'input', name: '兼容输入', type: 'image', optional: true, multiple: true },
    ],
    outputPorts: [
      { id: 'output', name: '分镜画面', type: 'image' },
      { id: 'scenes', name: '分镜数据', type: 'string' },
    ],
    defaultParams: {
      ...DEFAULT_GRID_DIRECTOR_PARAMS,
      mode: 'storyboard',
      preset: 'magic_storyboard',
      layout: '4x6',
      rows: 6,
      cols: 4,
      shotStrategy: 'story',
    } as any as Record<string, unknown>,
  },
  {
    id: 'storyboardMaker',
    name: '制作故事版',
    category: 'video',
    description:
      '从一句话创意、脚本或参考素材生成可执行故事版，输出分镜表、镜头提示词和视频生成蓝图',
    icon: '🎬',
    color: '#F97316',
    inputPorts: [
      { id: 'input', name: '创意/脚本输入', type: 'string', optional: true, multiple: true },
      { id: 'scriptInput', name: '剧本输入', type: 'string', optional: true, multiple: true },
      { id: 'imageInput', name: '视觉参考', type: 'image', optional: true, multiple: true },
      { id: 'videoReference', name: '视频参考', type: 'video', optional: true },
      { id: 'characterReference', name: '角色参考', type: 'image', optional: true, multiple: true },
    ],
    outputPorts: [
      { id: 'scenes', name: '故事版分镜', type: 'string' },
      { id: 'script', name: '故事脚本', type: 'string' },
      { id: 'prompt', name: '视频提示词', type: 'prompt' },
    ],
    defaultParams: {
      script: '',
      scenes: [],
      style: '电影感写实',
      model: 'deepseek-v4-pro',
      scriptType: 'story',
      tone: 'suspense',
      scriptSourceMode: 'text',
      storyboardMode: 'beat_to_storyboard',
      storyboardOutputMode: 'director_storyboard_sheet',
      storyboardPanelCount: 12,
      storyboardOutputSize: '1672x941',
      aspectRatio: '16:9',
      targetDuration: 30,
    },
  },
  {
    id: 'cameraPath',
    name: '镜头路径',
    category: 'video',
    description: '在图片上绘制镜头运动路径，输出 Seedance 运镜提示词和原始图片',
    icon: '🧭',
    color: '#FF584D',
    inputPorts: [{ id: 'image', name: '输入图片', type: 'image', optional: true }],
    outputPorts: [
      { id: 'output', name: '镜头路径', type: 'string' },
      { id: 'prompt', name: '运镜提示词', type: 'prompt' },
      { id: 'image', name: '原图', type: 'image' },
    ],
    defaultParams: {
      mode: 'smart',
      semantics: 'screen_tracking',
      durationSec: 5,
      preferredModelId: 'doubao-seedance-2-0',
      preferredModelProvider: 'doubao',
      cameraPathJson: '',
      prompt: '',
    },
  },
  {
    id: 'storyboardEdit',
    name: '分镜编辑',
    category: 'video',
    description: '独立分镜编辑轻节点：负责镜头重排、宫格裁剪、补镜提示与节奏标记',
    icon: '✂️',
    color: '#F59E0B',
    inputPorts: [
      { id: 'scriptInput', name: '分镜/剧本输入', type: 'string', optional: true, multiple: true },
      { id: 'imageInput', name: '分镜图片输入', type: 'image', optional: true, multiple: true },
    ],
    outputPorts: [
      { id: 'output', name: '编辑后分镜', type: 'string' },
      { id: 'scenes', name: '镜头清单', type: 'string' },
    ],
    defaultParams: {
      prompt: '请把输入分镜整理为可执行镜头清单，标记景别、运镜、时长、裁剪重点与补镜建议。',
      editMode: 'shot_reorder',
      layout: '4x6',
      preserveContinuity: true,
    },
  },

  {
    id: 'characterConsistency',
    name: '角色一致性',
    category: 'video',
    description: '角色特征提取与跨镜头一致性保持',
    icon: '👤',
    color: '#10B981',
    inputPorts: [
      { id: 'characterImage', name: '角色图片', type: 'image' },
      { id: 'targetImage', name: '目标图片', type: 'image', optional: true },
    ],
    outputPorts: [{ id: 'output', name: '输出', type: 'image' }],
    defaultParams: {
      consistencyStrength: 0.85,
      faceEnhance: true,
      preserveExpression: true,
      characterName: '',
    },
  },

  // ==================== 批量处理节点 ====================
  {
    id: 'batchProcess',
    name: '批量处理',
    category: 'video',
    description: '批量执行工作流，支持并行/串行',
    icon: '⚡',
    color: '#6366F1',
    inputPorts: [{ id: 'input', name: '输入数据', type: 'string', optional: true }],
    outputPorts: [{ id: 'results', name: '结果集', type: 'string' }],
    defaultParams: {
      batchSize: 4,
      parallel: true,
      retryOnFail: true,
      maxRetries: 3,
      delayBetweenBatches: 1000,
      workflowPayload: '',
      batchItems: [],
    },
  },

  // ==================== 图片拼接节点 ====================
  {
    id: 'imageCollage',
    name: '图片拼图',
    category: 'image',
    description: 'AICG 图片节点的卫星工具：多图拼接、模板排版与导出',
    icon: '🧩',
    color: '#8B5CF6',
    inputPorts: [{ id: 'input', name: '图片输入', type: 'image', optional: true, multiple: true }],
    outputPorts: [{ id: 'output', name: '拼图输出', type: 'image' }],
    defaultParams: {
      presetId: 'grid-2x2',
      aspectRatio: '1:1',
      gap: 8,
      padding: 12,
      background: '#1a1a2e',
      borderRadius: 8,
      exportResolution: '2K',
      items: [],
      textOverlays: [],
      layoutMode: 'grid',
      animate: false,
    },
  },

  // ==================== 3D类节点 ====================
  {
    id: 'director3D',
    name: '3D导演台',
    category: 'video',
    description: '3D场景编辑器 - 支持人偶/方块摆放、多机位管理、焦距调节、相机提示词生成',
    icon: '🎥',
    color: '#8B5CF6',
    inputPorts: [{ id: 'input', name: '全景图/参考图', type: 'image', optional: true }],
    outputPorts: [
      { id: 'output', name: '3D截图', type: 'image' },
      { id: 'prompt', name: '相机提示词', type: 'prompt' },
    ],
    defaultParams: {
      ...DEFAULT_DIRECTOR3D_PARAMS,
      view: { ...DEFAULT_DIRECTOR3D_PARAMS.view },
      panoramaView: { ...DEFAULT_DIRECTOR3D_PARAMS.panoramaView },
      objects: [],
      cameras: [],
      cameraPresets: [],
    },
  },
  {
    id: 'multiAngle',
    name: '多角度',
    category: 'image',
    description: '基于输入图片生成正面、侧面、背面、俯视、仰视、细节等多角度视图提示词与结果面板',
    icon: '◈',
    color: '#8B5CF6',
    inputPorts: [{ id: 'input', name: '参考图片', type: 'image', optional: true }],
    outputPorts: [
      { id: 'output', name: '多角度结果', type: 'image' },
      { id: 'prompt', name: '多角度提示词', type: 'prompt', optional: true },
    ],
    defaultParams: {
      mode: 'multiAngle',
      selectedAngles: ['front', 'left', 'right', 'back', 'top', 'detail'],
      prompt: '基于输入图片生成多角度视图，保持主体一致、结构一致、材质一致。',
      consistencyStrength: 0.9,
    },
  },

  {
    id: 'panorama360',
    name: '360°全景图',
    category: 'video',
    description: '360度全景图浏览 - 支持全景图上传、视角控制、FOV调节、自动旋转',
    icon: '🌐',
    color: '#06B6D4',
    inputPorts: [{ id: 'input', name: '全景图输入', type: 'image', optional: true }],
    outputPorts: [
      { id: 'imageOutput', name: '全景图输出', type: 'image' },
      { id: 'output', name: '全景视角数据', type: 'string' },
      { id: 'viewData', name: '视角数据', type: 'string', optional: true },
      { id: 'prompt', name: '全景提示词', type: 'prompt' },
    ],
    defaultParams: {
      ...DEFAULT_DIRECTOR3D_PARAMS,
      mode: 'panorama360',
      panoramaView: { ...DEFAULT_PANORAMA_VIEW },
      objects: [],
      cameras: [],
      cameraPresets: [],
    },
  },
  // ==================== 宫格切分节点 ====================
  {
    id: 'gridSplitter',
    name: '宫格切分',
    category: 'image',
    description: 'AICG 图片节点的卫星工具：将图片切分为 2x2 / 3x3 / 4x4 / 5x5 宫格',
    icon: '▦',
    color: '#06B6D4',
    inputPorts: [{ id: 'input', name: '图片输入', type: 'image', optional: true }],
    outputPorts: [{ id: 'output', name: '选中格子输出', type: 'image' }],
    defaultParams: {
      layout: '3x3',
      rows: 3,
      cols: 3,
      selectedCells: [],
      gap: 2,
      splitBackgroundColor: '#0a0a0a',
    },
  },

  // ==================== 输出类节点 ====================
  {
    id: 'output',
    name: '输出',
    category: 'video',
    description: '输出最终结果 - 支持图片、视频等多种格式',
    icon: '📤',
    color: '#00E5FF',
    inputPorts: [
      { id: 'image', name: '图片输入', type: 'image', optional: true },
      { id: 'video', name: '视频输入', type: 'video', optional: true },
      { id: 'audio', name: '音频输入', type: 'audio', optional: true },
    ],
    outputPorts: [],
    defaultParams: {
      format: 'auto',
      quality: 'high',
      metadata: true,
    },
  },

  // ==================== 工具类节点 ====================
];

// ==================== 工作流类型 ====================
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: Date;
  updatedAt: Date;
}

// ==================== 端口连接验证 ====================
export interface ConnectionValidation {
  valid: boolean;
  error?: string;
}

export type PortDirection = 'source' | 'target';

type PortTypeMapKey = `${string}:${string}:${PortDirection}`;

export function buildPortMapsFromDefinitions(definitions: NodeTypeDefinition[]): {
  typeMap: Record<PortTypeMapKey, PortType>;
  multipleMap: Record<PortTypeMapKey, boolean>;
} {
  const typeMap: Record<PortTypeMapKey, PortType> = {};
  const multipleMap: Record<PortTypeMapKey, boolean> = {};
  for (const def of definitions) {
    for (const port of def.outputPorts) {
      const key: PortTypeMapKey = `${def.id}:${port.id}:source`;
      typeMap[key] = port.type;
      if (port.multiple) multipleMap[key] = true;
    }
    for (const port of def.inputPorts) {
      const key: PortTypeMapKey = `${def.id}:${port.id}:target`;
      typeMap[key] = port.type;
      if (port.multiple) multipleMap[key] = true;
    }
  }
  return { typeMap, multipleMap };
}

const { typeMap: DEFINED_PORT_TYPES, multipleMap: DEFINED_PORT_MULTIPLES } =
  buildPortMapsFromDefinitions(NODE_TYPES);

const PORT_TYPE_MAP: Record<PortTypeMapKey, PortType> = {
  ...DEFINED_PORT_TYPES,
  // 输出节点端口映射（output 节点未在 NODE_TYPES 中定义，需手动补齐）
  'output:image:target': 'image',
  'output:video:target': 'video',
  'output:audio:target': 'audio',
  // aiVideo 的 prompt 目标端口（部分旧模板未通过 NODE_TYPES 解析到）
  'aiVideo:prompt:target': 'prompt',
  // 分镜导演节点（部分端口在 NODE_TYPES 中以别名定义，手动补齐确保旧工作流兼容）
  'gridDirector:scriptInput:target': 'string',
  'gridDirector:imageInput:target': 'image',
  'gridDirector:characterRef:target': 'image',
  'gridDirector:input:target': 'image',
  // 360全景图节点（viewData/prompt 在旧工作流中作为 source 使用）
  'panorama360:viewData:source': 'string',
  'panorama360:prompt:source': 'prompt',
  // 卫星节点 / 旧工作流兼容节点
  'imageCollage:input:target': 'image',
  'gridSplitter:input:target': 'image',
  // 批量处理节点（results 在 NODE_TYPES 中是 string 数组，手动补齐）
  'batchProcess:results:source': 'string',
  'batchProcess:input:target': 'string',
  // 轻量任务节点端口补齐
  'adCopyText:input:target': 'string',
  'brandCopyText:input:target': 'string',
  'storyboardMaker:input:target': 'string',
  'storyboardMaker:scriptInput:target': 'string',
  'storyboardMaker:imageInput:target': 'image',
  'storyboardMaker:videoReference:target': 'video',
  'storyboardMaker:characterReference:target': 'image',
  'storyboardMaker:scenes:source': 'string',
  'storyboardMaker:script:source': 'string',
  'storyboardMaker:prompt:source': 'prompt',
  'storyboardEdit:scriptInput:target': 'string',
  'storyboardEdit:imageInput:target': 'image',
};

const PORT_MULTIPLE_MAP: Record<PortTypeMapKey, boolean> = {
  ...DEFINED_PORT_MULTIPLES,
  'aicgVideoGen:input:target': true,
  'aiVideo:input:target': true,
  'aiVideo:referenceImage:target': true,
  'aiImage:input:target': true,
  'aiImage:image:target': true,
  // 分镜导演节点 - 支持多输入
  'gridDirector:scriptInput:target': true,
  'gridDirector:imageInput:target': true,
  'gridDirector:characterRef:target': true,
  'gridDirector:input:target': true,
  // 故事版节点 - 支持多输入
  'storyboardMaker:input:target': true,
  'storyboardMaker:scriptInput:target': true,
  'storyboardMaker:imageInput:target': true,
  'storyboardMaker:characterReference:target': true,
  // 分镜编辑节点 - 支持多输入
  'storyboardEdit:scriptInput:target': true,
  'storyboardEdit:imageInput:target': true,
  // 批量处理节点 - 支持多数据输入
  'batchProcess:input:target': true,
};

export function getPortType(
  nodeType: string,
  handleId: string,
  direction: PortDirection
): PortType | null {
  const key: PortTypeMapKey = `${nodeType}:${handleId}:${direction}`;
  return PORT_TYPE_MAP[key] ?? null;
}

export function isMultiplePort(
  nodeType: string,
  handleId: string,
  direction: PortDirection
): boolean {
  const key: PortTypeMapKey = `${nodeType}:${handleId}:${direction}`;
  return !!PORT_MULTIPLE_MAP[key];
}

const PORT_COMPATIBILITY: Record<PortType, PortType[]> = {
  string: ['string', 'prompt'],
  image: ['image', 'string'],
  video: ['video', 'string'],
  audio: ['audio', 'string'],
  prompt: ['prompt', 'string'],
};

export { PORT_COMPATIBILITY };

// ==================== 节点级连接规则（单一数据源） ====================

export interface NodeConnectionRule {
  /** 拒绝来自这些节点类型的直连 */
  denySources?: string[];
  /** 最大入边数量 */
  maxInputs?: number;
  /** 规则描述（用于错误提示） */
  description?: string;
}

/**
 * 节点级连接规则：以 NODE_TYPES 为单一数据源。
 * connection-rules.json 的 nodeRules 已迁移至此，避免两套规则分歧。
 */
export const NODE_CONNECTION_RULES: Record<string, NodeConnectionRule> = {
  aicgVideoGen: {
    denySources: ['localMatting'],
    description: '视频节点不接受抠图节点直连',
  },
  aiVideo: {
    denySources: ['localMatting'],
    description: '视频节点不接受抠图节点直连',
  },
  gridDirector: {
    maxInputs: 9,
    description: '分镜导演最多 9 路输入',
  },
};

export interface NodeConnectionValidation {
  valid: boolean;
  error?: string;
}

/**
 * 节点级规则验证（基于节点类型与现有边）。
 * 在 validatePortTypes 通过后调用，拦截特殊节点组合与输入上限。
 */
export function validateNodeConnection(
  sourceNodeType: string,
  targetNodeType: string,
  targetNodeId?: string,
  edges?: Array<{ target: string }>
): NodeConnectionValidation {
  const rule = NODE_CONNECTION_RULES[targetNodeType];
  if (!rule) return { valid: true };

  if (rule.denySources?.includes(sourceNodeType)) {
    return {
      valid: false,
      error: rule.description || `${sourceNodeType} 不能直连 ${targetNodeType}`,
    };
  }

  if (rule.maxInputs && targetNodeId && edges && edges.length > 0) {
    const existingInputs = edges.filter((e) => e.target === targetNodeId).length;
    if (existingInputs >= rule.maxInputs) {
      return {
        valid: false,
        error: rule.description || `${targetNodeType} 最多 ${rule.maxInputs} 路输入`,
      };
    }
  }

  return { valid: true };
}

const MIXED_MEDIA_INPUT_TARGETS = new Set<string>(['aicgVideoGen:input', 'aiVideo:input']);

const MIXED_IMAGE_INPUT_TARGETS = new Set<string>(['aiImage:input']);

function isMixedInputCompatible(
  sourcePortType: PortType,
  targetNodeType: string,
  targetHandleId: string
): boolean {
  const key = `${targetNodeType}:${targetHandleId}`;
  if (MIXED_MEDIA_INPUT_TARGETS.has(key)) {
    return ['image', 'prompt', 'string', 'video', 'audio'].includes(sourcePortType);
  }
  if (MIXED_IMAGE_INPUT_TARGETS.has(key)) {
    return ['image', 'prompt', 'string'].includes(sourcePortType);
  }
  return false;
}

export function validatePortConnection(
  sourcePort: PortConfig,
  targetPort: PortConfig
): ConnectionValidation {
  const sourceCompatible = PORT_COMPATIBILITY[sourcePort.type] || [];
  const isCompatible =
    sourceCompatible.includes(targetPort.type) || sourcePort.type === targetPort.type;

  if (!isCompatible) {
    return {
      valid: false,
      error: `类型不兼容: ${sourcePort.type} 无法连接到 ${targetPort.type}`,
    };
  }

  return { valid: true };
}

export function validatePortTypes(
  sourceNodeType: string,
  sourceHandleId: string,
  targetNodeType: string,
  targetHandleId: string
): ConnectionValidation {
  let sourcePortType = getPortType(sourceNodeType, sourceHandleId, 'source');
  let targetPortType = getPortType(targetNodeType, targetHandleId, 'target');

  if (!sourcePortType) {
    sourcePortType = inferPortType(sourceHandleId);
  }
  if (!targetPortType) {
    targetPortType = inferPortType(targetHandleId);
  }

  if (!sourcePortType || !targetPortType) {
    return {
      valid: false,
      error: `无法解析端口类型: ${sourcePortType || sourceHandleId} → ${targetPortType || targetHandleId}`,
    };
  }

  const sourceCompatible = PORT_COMPATIBILITY[sourcePortType] || [];
  const isCompatible =
    sourceCompatible.includes(targetPortType) ||
    sourcePortType === targetPortType ||
    isMixedInputCompatible(sourcePortType, targetNodeType, targetHandleId);

  if (!isCompatible) {
    return {
      valid: false,
      error: `类型不兼容: ${sourcePortType}(${sourceNodeType}.${sourceHandleId}) 无法连接到 ${targetPortType}(${targetNodeType}.${targetHandleId})`,
    };
  }

  return { valid: true };
}

export function inferPortType(handleId: string): PortType | null {
  if (!handleId) return null;

  const lowerHandleId = handleId.toLowerCase();

  const explicitHandleTypes: Record<string, PortType> = {
    input: 'string',
    output: 'string',
    mask: 'image',
    result: 'string',
    results: 'string',
    payload: 'string',
    scenes: 'string',
    script: 'string',
    textoutput: 'string',
    promptoutput: 'prompt',
    audiooutput: 'audio',
    imageoutput: 'image',
    videooutput: 'video',
  };
  if (explicitHandleTypes[lowerHandleId]) {
    return explicitHandleTypes[lowerHandleId];
  }

  // 明确的端口ID映射
  if (
    [
      'input3',
      'firstframe',
      'lastframe',
      'referenceimage',
      'characterimage',
      'targetimage',
    ].includes(lowerHandleId)
  ) {
    return 'image';
  }
  if (['input4'].includes(lowerHandleId)) {
    return 'video';
  }

  // 基于关键词的推断（更严格的匹配）
  if (
    lowerHandleId === 'image' ||
    lowerHandleId.endsWith('image') ||
    lowerHandleId.includes('image')
  ) {
    return 'image';
  }
  if (
    lowerHandleId === 'video' ||
    lowerHandleId.endsWith('video') ||
    lowerHandleId.includes('video')
  ) {
    return 'video';
  }
  if (
    lowerHandleId === 'audio' ||
    lowerHandleId.endsWith('audio') ||
    lowerHandleId.includes('audio')
  ) {
    return 'audio';
  }
  if (
    lowerHandleId === 'prompt' ||
    lowerHandleId.endsWith('prompt') ||
    lowerHandleId.includes('prompt')
  ) {
    return 'prompt';
  }

  // 默认将未知控制端口视作文本，不再在渲染期输出重复警告
  return 'string';
}

// ==================== 节点模板 ====================
export interface NodeTemplate {
  id: string;
  name: string;
  description: string;
  category: NodeCategory;
  thumbnail?: string;
  nodeTypes: string[];
  connections: [string, string][];
}

export function buildNodeDataFromDefinition(def: NodeTypeDefinition): Record<string, unknown> {
  const params = JSON.parse(JSON.stringify(def.defaultParams || {})) as Record<string, unknown>;

  return withCanvasNodeDefaultSize(def.id, {
    label: def.name,
    type: def.id,
    params,
    ...params,
  });
}

function createTemplateNode(def: NodeTypeDefinition): Node {
  return {
    id: def.id,
    type: def.id,
    position: { x: 0, y: 0 },
    data: buildNodeDataFromDefinition(def),
  };
}

function getPreferredTemplatePorts(
  sourceDef: NodeTypeDefinition,
  targetDef: NodeTypeDefinition
): { sourcePort: PortConfig; targetPort: PortConfig } | null {
  const sourcePorts = sourceDef.outputPorts;
  const targetPorts = targetDef.inputPorts;

  for (const sourcePort of sourcePorts) {
    const semanticTarget = targetPorts.find((targetPort) => {
      if (sourcePort.type === 'prompt')
        return targetPort.type === 'prompt' || targetPort.id.toLowerCase().includes('prompt');
      if (sourcePort.type === 'image')
        return targetPort.type === 'image' || targetPort.id.toLowerCase().includes('image');
      if (sourcePort.type === 'video')
        return targetPort.type === 'video' || targetPort.id.toLowerCase().includes('video');
      if (sourcePort.type === 'audio')
        return targetPort.type === 'audio' || targetPort.id.toLowerCase().includes('audio');
      if (sourcePort.type === 'string')
        return targetPort.type === 'string' || targetPort.type === 'prompt';
      return targetPort.type === sourcePort.type;
    });
    if (semanticTarget && validatePortConnection(sourcePort, semanticTarget).valid) {
      return { sourcePort, targetPort: semanticTarget };
    }
  }

  for (const sourcePort of sourcePorts) {
    for (const targetPort of targetPorts) {
      if (validatePortConnection(sourcePort, targetPort).valid) {
        return { sourcePort, targetPort };
      }
    }
  }

  return null;
}

export function instantiateTemplate(
  template: NodeTemplate,
  definitions: NodeTypeDefinition[] = NODE_TYPES
): { nodes: Node[]; edges: Edge[] } {
  const defMap = new Map(definitions.map((d) => [d.id, d]));
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const idMap = new Map<string, string>();

  let offsetX = 0;
  for (const typeId of template.nodeTypes) {
    const def = defMap.get(typeId);
    if (!def) continue;
    const newId = `${typeId}_${generateTemplateId()}`;
    idMap.set(typeId, newId);
    const node = createTemplateNode(def);
    node.id = newId;
    node.position = { x: offsetX, y: 0 };
    nodes.push(node);
    offsetX += getCanvasNodeDimensions(typeId).width + CANVAS_NODE_HORIZONTAL_GAP;
  }

  for (const [sourceType, targetType] of template.connections) {
    const sourceId = idMap.get(sourceType);
    const targetId = idMap.get(targetType);
    if (!sourceId || !targetId) continue;

    const sourceDef = defMap.get(sourceType);
    const targetDef = defMap.get(targetType);
    if (!sourceDef || !targetDef) continue;

    const ports = getPreferredTemplatePorts(sourceDef, targetDef);
    if (!ports) continue;

    edges.push({
      id: `e_${sourceId}_${targetId}`,
      source: sourceId,
      target: targetId,
      sourceHandle: ports.sourcePort.id,
      targetHandle: ports.targetPort.id,
      type: 'smoothstep',
      animated: true,
    });
  }

  return { nodes, edges };
}

let templateIdCounter = 0;
function generateTemplateId(): string {
  return `tpl_${Date.now()}_${templateIdCounter++}`;
}

export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    id: 'text-to-image',
    name: '文生图',
    description: '使用提示词生成图片',
    category: 'image',
    nodeTypes: ['prompt', 'aiImage'],
    connections: [['prompt', 'aiImage']],
  },
  {
    id: 'text-to-video',
    name: '文生视频',
    description: '使用提示词生成视频',
    category: 'video',
    nodeTypes: ['prompt', 'aiVideo'],
    connections: [['prompt', 'aiVideo']],
  },
  {
    id: 'image-to-video',
    name: '图生视频',
    description: '使用图片和提示词生成视频',
    category: 'video',
    nodeTypes: ['prompt', 'imageInput', 'aiVideo'],
    connections: [
      ['prompt', 'aiVideo'],
      ['imageInput', 'aiVideo'],
    ],
  },
  {
    id: 'video-to-frames',
    name: '视频抽帧',
    description: '从视频中抽取关键帧并输出为图片',
    category: 'video',
    nodeTypes: ['videoInput', 'frameExtractor', 'output'],
    connections: [
      ['videoInput', 'frameExtractor'],
      ['frameExtractor', 'output'],
    ],
  },
  {
    id: 'image-to-image',
    name: '图生图',
    description: '使用参考图和提示词生成新图片',
    category: 'image',
    nodeTypes: ['prompt', 'imageInput', 'aiImage'],
    connections: [
      ['prompt', 'aiImage'],
      ['imageInput', 'aiImage'],
    ],
  },
  {
    id: 'image-analysis',
    name: '图像分析',
    description: '使用AI视觉模型分析理解图片内容',
    category: 'image',
    nodeTypes: ['imageInput', 'aiImage'],
    connections: [['imageInput', 'aiImage']],
  },
  {
    id: 'inpainting-workflow',
    name: '局部重绘',
    description: '上传图片和蒙版进行局部重绘修复',
    category: 'image',
    nodeTypes: ['imageInput', 'aiImage'],
    connections: [['imageInput', 'aiImage']],
  },
  {
    id: 'outpainting-workflow',
    name: '画布扩展',
    description: '将图片向四周扩展绘制更大的画布',
    category: 'image',
    nodeTypes: ['imageInput', 'aiImage'],
    connections: [['imageInput', 'aiImage']],
  },
  {
    id: 'unified-image-studio',
    name: '图像工作室',
    description: '统一图像工作站 - 一个节点完成生成/分析/重绘/拓展',
    category: 'image',
    nodeTypes: ['imageInput', 'aiImage'],
    connections: [['imageInput', 'aiImage']],
  },
  {
    id: 'local-matting',
    name: '智能抠图',
    description: '使用本地 ONNX 模型进行抠图，不依赖网络',
    category: 'image',
    nodeTypes: ['imageInput', 'localMatting'],
    connections: [['imageInput', 'localMatting']],
  },
  {
    id: 'script-to-image',
    name: '剧本生图',
    description: '从剧本解析分镜并批量生成图片',
    category: 'image',
    nodeTypes: ['script', 'aiImage'],
    connections: [['script', 'aiImage']],
  },
  {
    id: 'script-to-video',
    name: '剧本生视频',
    description: '从剧本解析分镜并批量生成视频',
    category: 'video',
    nodeTypes: ['script', 'aiVideo'],
    connections: [['script', 'aiVideo']],
  },
  {
    id: 'script-to-advanced-video',
    name: '剧本→高级视频',
    description: '从剧本解析分镜并使用高级视频生成',
    category: 'video',
    nodeTypes: ['script', 'aiVideo'],
    connections: [['script', 'aiVideo']],
  },
  {
    id: 'aicg-image-pipeline',
    name: 'AICG · 图片流水线',
    description: '图片输入 → 生图 → 宫格 → 视频（对齐 AICG imageNode/gridNode/storyVideo）',
    category: 'image',
    nodeTypes: ['imageInput', 'aiImage', 'gridSplitter', 'aiVideo'],
    connections: [
      ['imageInput', 'aiImage'],
      ['aiImage', 'gridSplitter'],
      ['gridSplitter', 'aiVideo'],
    ],
  },
  {
    id: 'aicg-text-pipeline',
    name: 'AICG · 文本流水线',
    description: '文本 → 分镜导演 → 生图 → 视频（对齐 textNode/directorStoryboard/storyVideo）',
    category: 'video',
    nodeTypes: ['aiGenText', 'gridDirector', 'aiImage', 'aiVideo'],
    connections: [
      ['aiGenText', 'gridDirector'],
      ['gridDirector', 'aiImage'],
      ['aiImage', 'aiVideo'],
    ],
  },
  {
    id: 'aicg-matting-pipeline',
    name: 'AICG · 抠图流水线',
    description: '图片 → 智能抠图 → 生图/视频（小天扩展能力）',
    category: 'image',
    nodeTypes: ['imageInput', 'localMatting', 'aiImage'],
    connections: [
      ['imageInput', 'localMatting'],
      ['localMatting', 'aiImage'],
    ],
  },
];
