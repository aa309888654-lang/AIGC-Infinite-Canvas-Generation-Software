export interface CharacterAsset {
  id: string;
  name: string;
  summary: string;
  primaryImage: string;
  outfitImage?: string;
  prompt: string;
  negativePrompt?: string;
  tags: string[];
  defaultVoiceAssetId?: string;
}

export interface VoiceAsset {
  id: string;
  name: string;
  provider: string;
  voiceId: string;
  language: string;
  genderStyle: string;
  styleTags: string[];
  previewText: string;
  previewAudioUrl?: string;
  defaultRate?: number;
  defaultEmotion?: string;
}

export interface ProjectCharacterReference {
  characterAssetId: string;
  overrides: Partial<CharacterAsset>;
}

export interface ProjectVoiceReference {
  voiceAssetId: string;
  overrides: Partial<VoiceAsset>;
}

export interface CharacterAssetPayload {
  characterId: string;
  name: string;
  summary: string;
  primaryImage: string;
  outfitImage?: string;
  prompt: string;
  negativePrompt?: string;
  tags: string[];
  defaultVoiceAssetId?: string;
}

// ========== 场景库 ==========

export interface SceneAsset {
  id: string;
  name: string;
  summary: string;
  primaryImage: string;
  lightingPrompt?: string;
  environmentPrompt?: string;
  prompt: string;
  negativePrompt?: string;
  tags: string[];
}

export interface ProjectSceneReference {
  sceneAssetId: string;
  overrides: Partial<SceneAsset>;
}

export interface SceneAssetPayload {
  sceneId: string;
  name: string;
  summary: string;
  primaryImage: string;
  lightingPrompt?: string;
  environmentPrompt?: string;
  prompt: string;
  negativePrompt?: string;
  tags: string[];
}

// ========== 道具库 ==========

export interface PropAsset {
  id: string;
  name: string;
  summary: string;
  primaryImage: string;
  materialTags: string[];
  prompt: string;
  negativePrompt?: string;
  tags: string[];
}

export interface ProjectPropReference {
  propAssetId: string;
  overrides: Partial<PropAsset>;
}

export interface PropAssetPayload {
  propId: string;
  name: string;
  summary: string;
  primaryImage: string;
  materialTags: string[];
  prompt: string;
  negativePrompt?: string;
  tags: string[];
}
