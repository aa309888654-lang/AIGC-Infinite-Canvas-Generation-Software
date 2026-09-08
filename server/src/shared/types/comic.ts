export interface ComicCharacter {
  id: string;
  name: string;
  description: string;
  appearance: string;
  personality: string;
  outfit: string;
  traits: string[];
  imageUrl?: string;
  voiceId?: string;
}

export interface ComicScene {
  id: string;
  name: string;
  location: string;
  timeOfDay: string;
  mood: string;
  description: string;
  elements: string[];
  imageUrl?: string;
  dialogues: ComicDialogue[];
}

export interface ComicDialogue {
  characterId: string;
  characterName: string;
  text: string;
  emotion?: string;
  action?: string;
  audioUrl?: string;
}

export interface ComicCharacterInput {
  id?: string;
  name: string;
  description: string;
  appearance: string;
  personality: string;
  outfit: string;
  traits: string[];
  imageUrl?: string;
  voiceId?: string;
}

export interface ComicSceneInput {
  id?: string;
  name: string;
  location: string;
  timeOfDay: string;
  mood: string;
  description: string;
  elements: string[];
  imageUrl?: string;
  dialogues?: ComicDialogue[];
}

export interface ComicAssetInput {
  id?: string;
  name: string;
  description: string;
  category?: string;
  material?: string;
  function?: string;
  imageUrl?: string;
}

export interface ComicScript {
  title: string;
  scenes: ComicScene[];
  totalPanels: number;
  characters: ComicCharacter[];
}

export interface ComicProject {
  title?: string;
  style?: string;
  characters?: ComicCharacter[];
  scenes?: ComicScene[];
  timeline?: ComicPanel[];
  [key: string]: any;
}

export interface ComicPanel {
  id: string;
  panelNumber: number;
  script: string;
  description?: string;
  dialogues: ComicDialogue[];
  duration: number;
  transitions: { type: string; duration: number };
  camera: { x: number; y: number; zoom: number; rotation: number };
  elements: string[];
  backgroundColor: string;
  backgroundImage: string | null;
  layout: 'single' | 'double' | 'triple' | 'quad';
}

export type ComicStyle = 'anime' | 'manga' | 'real' | 'chibi';

export type VideoProvider = 'doubao' | 'vidu' | 'minimax';

export interface VideoGenerationOptions {
  referenceImageUrl?: string;
  referenceImageRole?: 'first_frame' | 'last_frame';
  controlNetEnabled?: boolean;
  controlNetType?: 'pose' | 'canny' | 'depth' | 'seg';
  controlNetStrength?: number;
  ipAdapterEnabled?: boolean;
  ipAdapterStrength?: number;
}
