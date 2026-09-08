/**
 * v3 声明层 — 节点 Manifest 类型
 */
import type { NodeCategory, PortConfig, PortType } from '@/types/node-system';

export type ResultMediaType = 'image' | 'video' | 'audio' | 'text' | 'none';

export interface NodeModelPolicy {
  mediaType: 'image' | 'video' | 'text' | 'audio' | 'none';
  allowedProviders?: string[];
  allowedModelIds?: string[];
  excludedModelIds?: string[];
  excludeIdPatterns?: string[];
  requireCapabilities?: string[];
  defaultModelId?: string;
  fallbackModels?: Array<{ modelId: string; provider: string; name?: string }>;
  useTextModelGroups?: boolean;
}

export interface NodeUIManifest {
  shell?: 'glass' | 'glass-stack' | 'classic' | 'agent';
  promptPanel?: boolean;
  resultRenderer?: ResultMediaType;
  toolbar?: 'default' | 'agent' | 'minimal';
  /** 不在节点资源库展示（卫星节点） */
  hiddenFromPalette?: boolean;
}

export interface ParamFieldSchema {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  label?: string;
}

export interface NodeExecutionManifest {
  executable?: boolean;
  handler?: string;
  mode?: 'sync' | 'async' | 'agent';
  maxRetries?: number;
  timeout?: number;
  requiredParams?: ParamFieldSchema[];
}

export interface NodeManifest {
  id: string;
  name: string;
  category: NodeCategory;
  description: string;
  icon: string;
  color: string;
  inputPorts: PortConfig[];
  outputPorts: PortConfig[];
  defaultParams: Record<string, unknown>;
  deprecated?: boolean;
  replacedBy?: string;
  ui?: NodeUIManifest;
  execution?: NodeExecutionManifest;
  models?: NodeModelPolicy;
  source?: 'legacy' | 'json' | 'plugin';
}

export interface NodeManifestFile {
  id: string;
  name: string;
  category: NodeCategory;
  description: string;
  icon: string;
  color: string;
  ports?: {
    inputs?: PortConfig[];
    outputs?: PortConfig[];
  };
  inputPorts?: PortConfig[];
  outputPorts?: PortConfig[];
  defaultParams?: Record<string, unknown>;
  deprecated?: boolean;
  replacedBy?: string;
  ui?: NodeUIManifest;
  execution?: NodeExecutionManifest;
  models?: NodeModelPolicy;
}
