/**
 * AI 音效匹配服务
 * 提供智能音效推荐、环境音生成、音频风格匹配等功能
 */
import { generateId } from '@/lib/utils';

export type SoundCategory = 
  | 'transition' 
  | 'ambient' 
  | 'nature' 
  | 'ui' 
  | 'action' 
  | 'emotional' 
  | 'comedic'
  | 'dramatic';

export type Mood = 
  | 'happy' 
  | 'sad' 
  | 'exciting' 
  | 'calm' 
  | 'tense' 
  | 'mysterious'
  | 'inspiring'
  | 'dramatic';

export interface SoundEffect {
  id: string;
  name: string;
  category: SoundCategory;
  tags: string[];
  duration: number;
  url?: string;
  waveform?: number[];
  intensity: number;
  mood: Mood[];
}

export interface SoundMatchResult {
  effect: SoundEffect;
  similarity: number;
  reason: string;
  suggestedStartTime: number;
  suggestedDuration: number;
  volume: number;
}

export interface AudioScene {
  id: string;
  name: string;
  description: string;
  effects: SoundEffect[];
  backgroundMusic?: SoundEffect;
  ambientSound?: SoundEffect;
  masterVolume: number;
}

export interface SoundTransition {
  from: SoundEffect | null;
  to: SoundEffect | null;
  type: 'cut' | 'fade' | 'crossfade' | 'layered';
  duration: number;
}

class AISoundEffectsService {
  private soundLibrary: SoundEffect[] = [
    {
      id: 'sfx-001',
      name: '清脆点击',
      category: 'ui',
      tags: ['click', 'button', 'positive', 'interface'],
      duration: 0.3,
      intensity: 0.5,
      mood: ['happy']
    },
    {
      id: 'sfx-002',
      name: '悬停反馈',
      category: 'ui',
      tags: ['hover', 'soft', 'gentle'],
      duration: 0.2,
      intensity: 0.3,
      mood: ['calm']
    },
    {
      id: 'sfx-003',
      name: '成功提示',
      category: 'ui',
      tags: ['success', 'complete', 'positive', 'notification'],
      duration: 1.0,
      intensity: 0.7,
      mood: ['happy', 'exciting']
    },
    {
      id: 'sfx-004',
      name: '警告音',
      category: 'ui',
      tags: ['warning', 'alert', 'attention'],
      duration: 0.5,
      intensity: 0.8,
      mood: ['tense']
    },
    {
      id: 'sfx-005',
      name: '错误提示',
      category: 'ui',
      tags: ['error', 'fail', 'negative'],
      duration: 0.8,
      intensity: 0.9,
      mood: ['sad', 'tense']
    },
    {
      id: 'sfx-006',
      name: '平滑转场',
      category: 'transition',
      tags: ['smooth', 'whoosh', 'sweep'],
      duration: 1.5,
      intensity: 0.6,
      mood: ['calm']
    },
    {
      id: 'sfx-007',
      name: '戏剧转场',
      category: 'transition',
      tags: ['dramatic', 'impact', 'sting'],
      duration: 2.0,
      intensity: 1.0,
      mood: ['dramatic', 'exciting']
    },
    {
      id: 'sfx-008',
      name: '快速切换',
      category: 'transition',
      tags: ['quick', 'snap', 'sharp'],
      duration: 0.3,
      intensity: 0.7,
      mood: ['exciting']
    },
    {
      id: 'sfx-009',
      name: '雨声',
      category: 'ambient',
      tags: ['rain', 'weather', 'nature', 'calming'],
      duration: 60,
      intensity: 0.6,
      mood: ['calm', 'sad', 'mysterious']
    },
    {
      id: 'sfx-010',
      name: '海浪声',
      category: 'ambient',
      tags: ['ocean', 'sea', 'waves', 'beach'],
      duration: 60,
      intensity: 0.7,
      mood: ['calm', 'inspiring']
    },
    {
      id: 'sfx-011',
      name: '森林鸟鸣',
      category: 'nature',
      tags: ['birds', 'forest', 'morning', 'peaceful'],
      duration: 60,
      intensity: 0.5,
      mood: ['calm', 'happy']
    },
    {
      id: 'sfx-012',
      name: '雷声',
      category: 'nature',
      tags: ['thunder', 'storm', 'dramatic', 'scary'],
      duration: 3,
      intensity: 1.0,
      mood: ['dramatic', 'tense', 'mysterious']
    },
    {
      id: 'sfx-013',
      name: '篝火噼啪',
      category: 'ambient',
      tags: ['fire', 'campfire', 'warm', 'cozy'],
      duration: 60,
      intensity: 0.5,
      mood: ['calm', 'inspiring']
    },
    {
      id: 'sfx-014',
      name: '城市交通',
      category: 'ambient',
      tags: ['city', 'urban', 'traffic', 'busy'],
      duration: 60,
      intensity: 0.7,
      mood: ['exciting', 'tense']
    },
    {
      id: 'sfx-015',
      name: '咖啡馆',
      category: 'ambient',
      tags: ['cafe', 'chatter', 'relaxed', 'social'],
      duration: 60,
      intensity: 0.5,
      mood: ['calm', 'happy']
    },
    {
      id: 'sfx-016',
      name: '脚步',
      category: 'action',
      tags: ['walk', 'footsteps', 'movement'],
      duration: 0.5,
      intensity: 0.6,
      mood: ['calm']
    },
    {
      id: 'sfx-017',
      name: '开门声',
      category: 'action',
      tags: ['door', 'open', 'creak'],
      duration: 0.8,
      intensity: 0.5,
      mood: ['mysterious']
    },
    {
      id: 'sfx-018',
      name: '打字声',
      category: 'action',
      tags: ['typing', 'keyboard', 'work'],
      duration: 1,
      intensity: 0.4,
      mood: ['calm']
    },
    {
      id: 'sfx-019',
      name: '欢呼声',
      category: 'emotional',
      tags: ['crowd', 'cheer', 'celebration', 'applause'],
      duration: 5,
      intensity: 0.9,
      mood: ['happy', 'exciting']
    },
    {
      id: 'sfx-020',
      name: '心跳声',
      category: 'emotional',
      tags: ['heartbeat', 'tension', 'fear', 'anxiety'],
      duration: 2,
      intensity: 0.8,
      mood: ['tense', 'mysterious', 'sad']
    },
    {
      id: 'sfx-021',
      name: '倒计时',
      category: 'ui',
      tags: ['countdown', 'tension', 'anticipation'],
      duration: 5,
      intensity: 0.7,
      mood: ['tense', 'exciting']
    },
    {
      id: 'sfx-022',
      name: '火箭发射',
      category: 'action',
      tags: ['rocket', 'launch', 'whoosh', 'explosion'],
      duration: 4,
      intensity: 1.0,
      mood: ['exciting', 'dramatic']
    },
    {
      id: 'sfx-023',
      name: '笑声',
      category: 'comedic',
      tags: ['laugh', 'comedy', 'funny', 'happy'],
      duration: 3,
      intensity: 0.7,
      mood: ['happy']
    },
    {
      id: 'sfx-024',
      name: '奇怪音效',
      category: 'comedic',
      tags: ['boing', 'splat', 'cartoon', 'funny'],
      duration: 1,
      intensity: 0.6,
      mood: ['happy']
    },
    {
      id: 'sfx-025',
      name: '低语',
      category: 'emotional',
      tags: ['whisper', 'mysterious', 'scary', 'ghost'],
      duration: 3,
      intensity: 0.4,
      mood: ['mysterious', 'sad']
    }
  ];

  getAllEffects(): SoundEffect[] {
    return [...this.soundLibrary];
  }

  getEffectsByCategory(category: SoundCategory): SoundEffect[] {
    return this.soundLibrary.filter(e => e.category === category);
  }

  getEffectsByMood(mood: Mood): SoundEffect[] {
    return this.soundLibrary.filter(e => e.mood.includes(mood));
  }

  searchEffects(query: string): SoundEffect[] {
    const lowerQuery = query.toLowerCase();
    return this.soundLibrary.filter(e => 
      e.name.toLowerCase().includes(lowerQuery) ||
      e.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async matchSoundToScene(
    sceneDescription: string,
    options?: {
      preferredCategories?: SoundCategory[];
      preferredMoods?: Mood[];
      maxResults?: number;
    }
  ): Promise<SoundMatchResult[]> {
    const results: SoundMatchResult[] = [];
    const sceneWords = sceneDescription.toLowerCase().split(/\s+/);
    const sceneMoods = this.detectMoods(sceneDescription);

    for (const effect of this.soundLibrary) {
      let similarity = 0;
      const reasons: string[] = [];

      const tagMatches = effect.tags.filter(tag => 
        sceneWords.some(word => tag.toLowerCase().includes(word))
      );
      similarity += tagMatches.length * 15;

      if (tagMatches.length > 0) {
        reasons.push(`标签匹配: ${tagMatches.join(', ')}`);
      }

      const moodMatches = effect.mood.filter(m => sceneMoods.includes(m));
      similarity += moodMatches.length * 20;

      if (moodMatches.length > 0) {
        reasons.push(`情绪匹配: ${moodMatches.join(', ')}`);
      }

      if (options?.preferredCategories?.includes(effect.category)) {
        similarity += 10;
        reasons.push(`类别偏好: ${effect.category}`);
      }

      if (options?.preferredMoods?.some(m => effect.mood.includes(m))) {
        similarity += 10;
      }

      if (similarity > 20) {
        results.push({
          effect,
          similarity: Math.min(100, similarity),
          reason: reasons.join('; '),
          suggestedStartTime: 0,
          suggestedDuration: effect.duration,
          volume: effect.intensity
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, options?.maxResults || 5);
  }

  private detectMoods(text: string): Mood[] {
    const moods: Mood[] = [];
    const moodKeywords: Record<Mood, string[]> = {
      happy: ['开心', '快乐', '高兴', '欢快', 'happy', 'joy', 'fun', 'celebrate'],
      sad: ['悲伤', '难过', '伤心', 'sad', 'sorrow', 'cry', 'melancholy'],
      exciting: ['兴奋', '激动', '刺激', '紧张', 'exciting', 'thrilling', 'action'],
      calm: ['平静', '安静', '放松', '舒缓', 'calm', 'peaceful', 'relax', 'gentle'],
      tense: ['紧张', '悬疑', '恐怖', '害怕', 'tense', 'scary', 'fear', 'horror'],
      mysterious: ['神秘', '悬疑', '未知', 'mysterious', 'mystery', 'unknown', 'dark'],
      inspiring: ['励志', '鼓舞', '感动', 'inspiring', 'inspire', 'motivate', 'triumph'],
      dramatic: ['戏剧', '戏剧性', '震撼', 'dramatic', 'epic', 'intense', 'powerful']
    };

    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      if (keywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) {
        moods.push(mood as Mood);
      }
    }

    return moods.length > 0 ? moods : ['calm'];
  }

  async generateAmbientSoundscape(
    sceneType: string,
    duration: number,
    options?: {
      intensity?: number;
      variation?: boolean;
    }
  ): Promise<SoundEffect[]> {
    const soundscapes: SoundEffect[] = [];

    const ambientConfig = this.getAmbientConfiguration(sceneType);

    for (const layer of ambientConfig.layers) {
      const matchingEffects = this.getEffectsByCategory(layer.category as SoundCategory);
      
      if (matchingEffects.length > 0) {
        const selectedEffect = matchingEffects[Math.floor(Math.random() * matchingEffects.length)];
        soundscapes.push({
          ...selectedEffect,
          id: generateId(),
          duration,
          intensity: (layer.intensity || 0.5) * (options?.intensity || 1)
        });
      }
    }

    return soundscapes;
  }

  private getAmbientConfiguration(sceneType: string): {
    layers: Array<{ category: string; intensity: number; probability: number }>;
  } {
    const configurations: Record<string, ReturnType<typeof this.getAmbientConfiguration>> = {
      nature: {
        layers: [
          { category: 'nature', intensity: 0.8, probability: 0.9 },
          { category: 'ambient', intensity: 0.4, probability: 0.6 }
        ]
      },
      urban: {
        layers: [
          { category: 'ambient', intensity: 0.7, probability: 0.9 },
          { category: 'action', intensity: 0.3, probability: 0.5 }
        ]
      },
      indoor: {
        layers: [
          { category: 'ambient', intensity: 0.6, probability: 0.9 },
          { category: 'action', intensity: 0.2, probability: 0.4 }
        ]
      },
      emotional: {
        layers: [
          { category: 'emotional', intensity: 0.8, probability: 0.9 },
          { category: 'ambient', intensity: 0.3, probability: 0.5 }
        ]
      }
    };

    return configurations[sceneType] || configurations.indoor;
  }

  createSoundTransition(
    currentEffect: SoundEffect | null,
    nextEffect: SoundEffect,
    transitionType: SoundTransition['type'] = 'fade'
  ): SoundTransition {
    return {
      from: currentEffect,
      to: nextEffect,
      type: transitionType,
      duration: transitionType === 'crossfade' ? 1.0 : transitionType === 'fade' ? 0.5 : 0.2
    };
  }

  calculateVolumeForMood(mood: Mood, baseVolume: number = 1.0): number {
    const volumeModifiers: Record<Mood, number> = {
      happy: 0.8,
      sad: 0.6,
      exciting: 1.0,
      calm: 0.5,
      tense: 0.9,
      mysterious: 0.4,
      inspiring: 0.85,
      dramatic: 0.95
    };

    return baseVolume * (volumeModifiers[mood] || 0.7);
  }

  async recommendBackgroundMusic(
    sceneDescription: string,
    options?: {
      style?: 'epic' | 'soft' | 'upbeat' | 'dramatic';
      tempo?: 'slow' | 'medium' | 'fast';
    }
  ): Promise<SoundEffect[]> {
    const recommendations: SoundEffect[] = [];

    const moodKeywords = this.detectMoods(sceneDescription);
    const primaryMood = moodKeywords[0] || 'calm';

    const styleMatch = this.soundLibrary.filter(e => {
      const tagMatch = e.tags.some(tag => {
        if (options?.style === 'epic' && ['dramatic', 'orchestra', 'epic'].includes(tag)) return true;
        if (options?.style === 'soft' && ['calm', 'gentle', 'piano'].includes(tag)) return true;
        if (options?.style === 'upbeat' && ['happy', 'upbeat', 'energetic'].includes(tag)) return true;
        if (options?.style === 'dramatic' && ['dramatic', 'tension', 'dark'].includes(tag)) return true;
        return false;
      });
      return tagMatch;
    });

    recommendations.push(...styleMatch);

    if (recommendations.length < 3) {
      const moodMatch = this.getEffectsByMood(primaryMood);
      recommendations.push(...moodMatch.slice(0, 3 - recommendations.length));
    }

    return recommendations.slice(0, 5);
  }

  mixSounds(
    sounds: Array<{ effect: SoundEffect; volume: number; startTime: number; duration?: number }>,
    _totalDuration: number
  ): AudioScene {
    const sceneId = generateId();

    const effects = sounds.map(s => ({
      ...s.effect,
      id: generateId(),
      intensity: s.effect.intensity * s.volume
    }));

    const backgroundMusic = effects.find(e => e.category === 'ambient' && e.duration > 10);
    const ambientSound = effects.find(e => e.category === 'nature' || e.category === 'ambient');

    return {
      id: sceneId,
      name: `混音场景 ${Date.now()}`,
      description: `混合了 ${effects.length} 个音效`,
      effects,
      backgroundMusic,
      ambientSound,
      masterVolume: 0.8
    };
  }

  generateFoleyForScene(
    sceneType: string,
    duration: number
  ): SoundEffect[] {
    const foleyEffects: SoundEffect[] = [];

    const foleyMap: Record<string, string[]> = {
      walking: ['sfx-016'],
      door: ['sfx-017'],
      typing: ['sfx-018'],
      nature: ['sfx-011', 'sfx-009'],
      city: ['sfx-014'],
      indoor: ['sfx-015']
    };

    const effectIds = foleyMap[sceneType] || [];

    for (const id of effectIds) {
      const effect = this.soundLibrary.find(e => e.id === id);
      if (effect) {
        foleyEffects.push({
          ...effect,
          id: generateId(),
          duration: duration / effectIds.length
        });
      }
    }

    return foleyEffects;
  }

  exportScene(scene: AudioScene): string {
    return JSON.stringify(scene, null, 2);
  }

  importScene(jsonString: string): AudioScene | null {
    try {
      const scene = JSON.parse(jsonString) as AudioScene;
      if (!scene.id || !scene.effects) {
        throw new Error('Invalid scene format');
      }
      return {
        ...scene,
        id: generateId()
      };
    } catch (error) {
      console.error('[音效] 场景导入失败:', error);
      return null;
    }
  }

  getCategories(): SoundCategory[] {
    return ['transition', 'ambient', 'nature', 'ui', 'action', 'emotional', 'comedic', 'dramatic'];
  }

  getMoods(): Mood[] {
    return ['happy', 'sad', 'exciting', 'calm', 'tense', 'mysterious', 'inspiring'];
  }
}

export const aiSoundEffectsService = new AISoundEffectsService();
