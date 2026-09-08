export type ShotStatus =
  | 'draft'
  | 'planned'
  | 'nodes_created'
  | 'image_generating'
  | 'image_ready'
  | 'video_generating'
  | 'video_ready'
  | 'selected'
  | 'failed';

export type ShotCamera =
  | 'wide'
  | 'medium'
  | 'close'
  | 'tracking'
  | 'push'
  | 'orbit'
  | 'static';

export interface ShotNodeLinks {
  textNodeId?: string;
  imageNodeId?: string;
  videoNodeId?: string;
  outputNodeId?: string;
}

export interface Shot {
  id: string;
  index: number;
  title: string;
  scriptText: string;
  scene: string;
  characters: string[];
  visualPrompt: string;
  camera: ShotCamera;
  duration: number;
  aspectRatio: string;
  status: ShotStatus;
  nodeLinks?: ShotNodeLinks;
  selectedImageVersionId?: string;
  selectedVideoVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShotGenerationInput {
  script: string;
  aspectRatio?: string;
  defaultDuration?: number;
}

export interface ShotNodeFactoryOptions {
  origin: { x: number; y: number };
  horizontalGap?: number;
  verticalGap?: number;
}
