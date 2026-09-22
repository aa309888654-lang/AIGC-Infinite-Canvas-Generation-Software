/**
 * v3 核心层 — 运行时节点注册表
 * 种子：NODE_TYPES · 扩展：JSON manifest · 插件
 */
import {
  NODE_TYPES,
  type NodeCategory,
  type NodeTypeDefinition,
  buildNodeDataFromDefinition,
} from '@/types/node-system';
import type { NodeManifest, NodeManifestFile } from './types/node-manifest';
import gridDirectorManifest from '@/config/nodes/grid-director.json';
import aiGenTextManifest from '@/config/nodes/ai-gen-text.json';
import batchProcessManifest from '@/config/nodes/batch-process.json';
import localMattingManifest from '@/config/nodes/local-matting.json';
import videoUpscaleManifest from '@/config/nodes/video-upscale.json';
import audioGenManifest from '@/config/nodes/audio-gen.json';
import director3DManifest from '@/config/nodes/director3d.json';
import characterLibraryManifest from '@/config/nodes/character-library.json';
import sceneLibraryManifest from '@/config/nodes/scene-library.json';
import propLibraryManifest from '@/config/nodes/prop-library.json';
import promptManifest from '@/config/nodes/prompt.json';
import imageInputManifest from '@/config/nodes/image-input.json';
import videoInputManifest from '@/config/nodes/video-input.json';
import frameExtractorManifest from '@/config/nodes/frame-extractor.json';
import audioInputManifest from '@/config/nodes/audio-input.json';
import aiVideoManifest from '@/config/nodes/ai-video.json';
import scriptManifest from '@/config/nodes/script.json';
import adCopyTextManifest from '@/config/nodes/ad-copy-text.json';
import brandCopyTextManifest from '@/config/nodes/brand-copy-text.json';
import aiImageManifest from '@/config/nodes/ai-image.json';
import scriptStoryboardManifest from '@/config/nodes/script-storyboard.json';
import storyboardMakerManifest from '@/config/nodes/storyboard-maker.json';
import cameraPathManifest from '@/config/nodes/camera-path.json';
import storyboardEditManifest from '@/config/nodes/storyboard-edit.json';
import characterConsistencyManifest from '@/config/nodes/character-consistency.json';
import imageCollageManifest from '@/config/nodes/image-collage.json';
import multiAngleManifest from '@/config/nodes/multi-angle.json';
import panorama360Manifest from '@/config/nodes/panorama-360.json';
import gridSplitterManifest from '@/config/nodes/grid-splitter.json';
import outputManifest from '@/config/nodes/output.json';

const manifestFiles = [
  gridDirectorManifest,
  aiGenTextManifest,
  batchProcessManifest,
  localMattingManifest,
  videoUpscaleManifest,
  audioGenManifest,
  director3DManifest,
  characterLibraryManifest,
  sceneLibraryManifest,
  propLibraryManifest,
  promptManifest,
  imageInputManifest,
  videoInputManifest,
  frameExtractorManifest,
  audioInputManifest,
  aiVideoManifest,
  scriptManifest,
  adCopyTextManifest,
  brandCopyTextManifest,
  aiImageManifest,
  scriptStoryboardManifest,
  storyboardMakerManifest,
  cameraPathManifest,
  storyboardEditManifest,
  characterConsistencyManifest,
  imageCollageManifest,
  multiAngleManifest,
  panorama360Manifest,
  gridSplitterManifest,
  outputManifest,
] as NodeManifestFile[];

const NODE_EXECUTION_HANDLERS: Record<string, string> = {
  aiImage: 'image-gen',
  localMatting: 'local-matting',
  characterConsistency: 'image-gen',
  multiAngle: 'image-gen',

  aiVideo: 'video-gen',
  videoUpscale: 'video-upscale',

  aiGenText: 'ai-gen-text',
  script: 'ai-gen-text',
  adCopyText: 'ai-gen-text',
  brandCopyText: 'ai-gen-text',
  storyboardEdit: 'ai-gen-text',
  storyboardMaker: 'ai-gen-text',

  audioGen: 'audio-gen',

  gridDirector: 'grid-director',
  scriptStoryboard: 'grid-director',
};

const NODE_RESULT_RENDERERS: Record<string, NodeManifest['ui']> = {
  aiImage: { shell: 'glass-stack', promptPanel: true, resultRenderer: 'image', toolbar: 'default' },
  imageAnalysis: {
    shell: 'glass-stack',
    promptPanel: true,
    resultRenderer: 'image',
    toolbar: 'default',
  },
  inpainting: {
    shell: 'glass-stack',
    promptPanel: true,
    resultRenderer: 'image',
    toolbar: 'default',
  },
  outpainting: {
    shell: 'glass-stack',
    promptPanel: true,
    resultRenderer: 'image',
    toolbar: 'default',
  },
  localMatting: {
    shell: 'glass-stack',
    promptPanel: true,
    resultRenderer: 'image',
    toolbar: 'default',
  },
  videoUpscale: {
    shell: 'glass-stack',
    promptPanel: false,
    resultRenderer: 'video',
    toolbar: 'default',
  },
  characterConsistency: {
    shell: 'glass-stack',
    promptPanel: true,
    resultRenderer: 'image',
    toolbar: 'default',
  },
  imageCollage: { hiddenFromPalette: true, shell: 'glass', resultRenderer: 'image' },
  gridSplitter: { hiddenFromPalette: true, shell: 'glass', resultRenderer: 'image' },
  multiAngle: {
    shell: 'glass-stack',
    promptPanel: true,
    resultRenderer: 'image',
    toolbar: 'default',
  },
  panorama360: {
    shell: 'glass-stack',
    promptPanel: true,
    resultRenderer: 'text',
    toolbar: 'default',
  },

  aiVideo: { shell: 'glass-stack', promptPanel: true, resultRenderer: 'video', toolbar: 'default' },
  videoGen: {
    shell: 'glass-stack',
    promptPanel: true,
    resultRenderer: 'video',
    toolbar: 'default',
  },
  frameExtractor: { shell: 'glass', resultRenderer: 'image', toolbar: 'minimal' },

  aiGenText: { shell: 'glass', promptPanel: true, resultRenderer: 'text', toolbar: 'default' },
  textInput: { shell: 'glass', promptPanel: true, resultRenderer: 'text', toolbar: 'default' },
  script: { shell: 'glass', promptPanel: true, resultRenderer: 'text', toolbar: 'default' },
  adCopyText: { shell: 'glass', promptPanel: true, resultRenderer: 'text', toolbar: 'default' },
  brandCopyText: { shell: 'glass', promptPanel: true, resultRenderer: 'text', toolbar: 'default' },
  storyboardEdit: { shell: 'glass', promptPanel: true, resultRenderer: 'text', toolbar: 'default' },
  storyboardMaker: {
    shell: 'glass',
    promptPanel: true,
    resultRenderer: 'text',
    toolbar: 'default',
  },

  audioGen: {
    shell: 'glass-stack',
    promptPanel: true,
    resultRenderer: 'audio',
    toolbar: 'default',
  },

  gridDirector: {
    shell: 'glass-stack',
    promptPanel: true,
    resultRenderer: 'image',
    toolbar: 'default',
  },
  scriptStoryboard: {
    shell: 'glass-stack',
    promptPanel: true,
    resultRenderer: 'image',
    toolbar: 'default',
  },
  batchProcess: { shell: 'glass', promptPanel: true, resultRenderer: 'text', toolbar: 'default' },
  director3D: {
    shell: 'glass-stack',
    promptPanel: true,
    resultRenderer: 'text',
    toolbar: 'default',
  },
  output: { shell: 'glass', resultRenderer: 'none', toolbar: 'minimal' },
};

const HIDDEN_PALETTE_NODE_IDS = new Set(['imageCollage', 'gridSplitter']);

const CANONICAL_NODE_TYPE_ALIASES: Record<string, string> = {
  imageGen: 'aiImage',
  imageAnalysis: 'aiImage',
  inpainting: 'aiImage',
  outpainting: 'aiImage',
  unifiedImageStudio: 'aiImage',
  aicgImageGen: 'aiImage',
  videoGen: 'aiVideo',
  advancedVideoGen: 'aiVideo',
  aicgVideoGen: 'aiVideo',
  photoGrid: 'gridDirector',
  magicStoryboard: 'gridDirector',
  imageGridSplitter: 'gridSplitter',
};

const COMPATIBILITY_NODE_MANIFESTS: NodeManifest[] = [
  {
    id: 'textInput', name: '文本输入', category: 'input', description: '输入文本或提示词',
    icon: 'Type', color: '#64748b', inputPorts: [],
    outputPorts: [{ id: 'output', name: '文本', type: 'string' }], defaultParams: { text: '' },
    execution: { executable: false, mode: 'sync' }, source: 'legacy',
  },
  {
    id: 'vr360Preview', name: 'VR 360 预览', category: 'output', description: '预览 360 度全景结果',
    icon: 'Glasses', color: '#0891b2',
    inputPorts: [{ id: 'input', name: '全景输入', type: 'image' }], outputPorts: [], defaultParams: {},
    execution: { executable: false, mode: 'sync' }, source: 'legacy',
  },
];

export function resolveCanonicalNodeType(id: string): string {
  return CANONICAL_NODE_TYPE_ALIASES[id] || id;
}

function getManifestFiles(): NodeManifestFile[] {
  return manifestFiles.filter((file): file is NodeManifestFile => !!file?.id);
}

function legacyToManifest(def: NodeTypeDefinition): NodeManifest {
  const handler = NODE_EXECUTION_HANDLERS[def.id];

  return {
    id: def.id,
    name: def.name,
    category: def.category,
    description: def.description,
    icon: def.icon,
    color: def.color,
    inputPorts: def.inputPorts,
    outputPorts: def.outputPorts,
    defaultParams: def.defaultParams,
    deprecated: def.deprecated,
    replacedBy: def.replacedBy,
    source: 'legacy',
    ui: NODE_RESULT_RENDERERS[def.id] ?? {
      shell: 'glass',
      promptPanel: def.category === 'input' || def.category === 'image' || def.category === 'video',
      resultRenderer:
        def.category === 'image' ? 'image' : def.category === 'video' ? 'video' : 'none',
      hiddenFromPalette: HIDDEN_PALETTE_NODE_IDS.has(def.id),
    },
    execution: {
      executable: !!handler,
      handler,
      mode: 'async',
      maxRetries: 2,
    },
  };
}

function fileToManifest(file: NodeManifestFile): NodeManifest {
  return {
    id: file.id,
    name: file.name,
    category: file.category,
    description: file.description,
    icon: file.icon,
    color: file.color,
    inputPorts: file.inputPorts ?? file.ports?.inputs ?? [],
    outputPorts: file.outputPorts ?? file.ports?.outputs ?? [],
    defaultParams: file.defaultParams ?? {},
    deprecated: file.deprecated,
    replacedBy: file.replacedBy,
    ui: file.ui,
    execution: file.execution,
    models: file.models,
    source: 'json',
  };
}

function manifestToLegacy(m: NodeManifest): NodeTypeDefinition {
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    description: m.description,
    icon: m.icon,
    color: m.color,
    inputPorts: m.inputPorts,
    outputPorts: m.outputPorts,
    defaultParams: m.defaultParams,
    deprecated: m.deprecated,
    replacedBy: m.replacedBy,
  };
}

class NodeRegistry {
  private nodes = new Map<string, NodeManifest>();
  private initialized = false;

  /** 从 NODE_TYPES 种子 + 已加载 JSON 初始化 */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    for (const def of NODE_TYPES) {
      this.nodes.set(def.id, legacyToManifest(def));
    }
    for (const manifest of COMPATIBILITY_NODE_MANIFESTS) {
      this.nodes.set(manifest.id, manifest);
    }
    for (const file of getManifestFiles()) {
      this.registerFromFile(file);
    }
  }

  register(manifest: NodeManifest): void {
    this.init();
    const existing = this.nodes.get(manifest.id);
    if (existing && existing.source === 'legacy' && manifest.source === 'json') {
      // JSON 覆盖 legacy 的 ui/execution 元数据，保留 ports 若 JSON 为空
      this.nodes.set(manifest.id, {
        ...existing,
        ...manifest,
        inputPorts: manifest.inputPorts.length ? manifest.inputPorts : existing.inputPorts,
        outputPorts: manifest.outputPorts.length ? manifest.outputPorts : existing.outputPorts,
        defaultParams: Object.keys(manifest.defaultParams).length
          ? manifest.defaultParams
          : existing.defaultParams,
        deprecated: manifest.deprecated ?? existing.deprecated,
        replacedBy: manifest.replacedBy ?? existing.replacedBy,
        source: 'json',
      });
      return;
    }
    this.nodes.set(manifest.id, manifest);
  }

  registerFromFile(file: NodeManifestFile): void {
    this.register(fileToManifest(file));
  }

  get(id: string): NodeManifest | undefined {
    this.init();
    const direct = this.nodes.get(id);
    if (direct?.deprecated && direct.replacedBy) {
      return (
        this.nodes.get(direct.replacedBy) ??
        this.nodes.get(resolveCanonicalNodeType(direct.replacedBy)) ??
        direct
      );
    }
    return direct ?? this.nodes.get(resolveCanonicalNodeType(id));
  }

  getAll(): NodeManifest[] {
    this.init();
    return Array.from(this.nodes.values());
  }

  getActive(): NodeManifest[] {
    return this.getAll().filter((n) => !n.deprecated);
  }

  getByCategory(category: NodeCategory): NodeManifest[] {
    return this.getActive().filter((n) => n.category === category);
  }

  getPaletteNodes(): NodeManifest[] {
    return this.getActive().filter((n) => !n.ui?.hiddenFromPalette);
  }

  toLegacyDefinition(id: string): NodeTypeDefinition | undefined {
    const m = this.get(id);
    return m ? manifestToLegacy(m) : undefined;
  }

  getActiveLegacyDefinitions(): NodeTypeDefinition[] {
    return this.getActive().map(manifestToLegacy);
  }

  getPaletteLegacyDefinitions(): NodeTypeDefinition[] {
    return this.getPaletteNodes().map(manifestToLegacy);
  }

  buildNodeData(id: string): Record<string, unknown> | null {
    const def = this.toLegacyDefinition(id);
    if (!def) return null;
    return buildNodeDataFromDefinition(def);
  }

  isExecutable(id: string): boolean {
    const m = this.get(id);
    if (!m) return false;
    return m.execution?.executable === true;
  }
}

export const nodeRegistry = new NodeRegistry();

/** 供节点面板 / QuickAdd 使用，返回全部未弃用节点。 */
export function getActiveRegistryDefinitions(): NodeTypeDefinition[] {
  return nodeRegistry.getActiveLegacyDefinitions();
}

export function resolveNodeDefinition(id: string): NodeTypeDefinition | undefined {
  return nodeRegistry.toLegacyDefinition(id) ?? NODE_TYPES.find((n) => n.id === id);
}
