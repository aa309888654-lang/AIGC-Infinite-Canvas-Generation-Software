export type GenerationMediaType = 'image' | 'video' | 'audio' | 'text';

export type GenerationVersionSource = 'node-sync' | 'manual';

export interface GenerationVersion {
  id: string;
  shotId: string;
  nodeId: string;
  nodeType?: string;
  mediaType: GenerationMediaType;
  url: string;
  prompt?: string;
  modelId?: string;
  params?: Record<string, unknown>;
  selected: boolean;
  favorite?: boolean;
  source: GenerationVersionSource;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationVersionInput {
  shotId: string;
  nodeId: string;
  nodeType?: string;
  mediaType: GenerationMediaType;
  url: string;
  prompt?: string;
  modelId?: string;
  params?: Record<string, unknown>;
  source?: GenerationVersionSource;
}
