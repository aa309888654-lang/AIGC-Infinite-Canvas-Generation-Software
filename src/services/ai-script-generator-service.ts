/**
 * AI 脚本生成服务
 * 提供智能脚本生成、分镜规划、文案创作等功能
 */
import { generateId } from '@/lib/utils';

export interface ScriptScene {
  id: string;
  sceneNumber: number;
  title: string;
  description: string;
  duration: number;
  shotType: 'wide' | 'medium' | 'closeup' | 'detail' | 'pov' | 'tracking';
  cameraMovement: 'static' | 'pan' | 'tilt' | 'dolly' | 'crane' | 'handheld';
  dialogue?: string;
  narration?: string;
  visualNotes: string;
  music?: string;
  transitions?: string[];
}

export interface ScriptSection {
  id: string;
  type: 'intro' | 'main' | 'conclusion';
  scenes: ScriptScene[];
  totalDuration: number;
  keyMessage: string;
  style?: string;
}

export interface GeneratedScript {
  id: string;
  title: string;
  topic: string;
  style: 'cinematic' | 'vlog' | 'commercial' | 'documentary' | 'tutorial';
  duration: number;
  sections: ScriptSection[];
  fullScript: string;
  tags: string[];
  createdAt: number;
}

export interface ScriptGenerationOptions {
  topic: string;
  style?: 'cinematic' | 'vlog' | 'commercial' | 'documentary' | 'tutorial';
  targetDuration?: number;
  audience?: string;
  tone?: 'formal' | 'casual' | 'humorous' | 'inspirational';
  includeNarration?: boolean;
  sceneCount?: number;
}

class AIScriptGeneratorService {
  private sceneTemplates = {
    cinematic: {
      avgDuration: 8,
      transitions: ['淡入淡出', '叠化', '推进', '横摇'],
      shots: ['全景', '中景', '特写'] as const
    },
    vlog: {
      avgDuration: 15,
      transitions: ['跳转', '缩放', '滑动'],
      shots: ['中景', '自拍视角', '跟随'] as const
    },
    commercial: {
      avgDuration: 5,
      transitions: ['快速切换', '强调', '定格'],
      shots: ['特写', '产品展示', '对比'] as const
    },
    documentary: {
      avgDuration: 20,
      transitions: ['自然过渡', '叠化'],
      shots: ['全景', '中景', '采访'] as const
    },
    tutorial: {
      avgDuration: 12,
      transitions: ['标注', '高亮', '放大'],
      shots: ['屏幕录制', '手部特写', '演示'] as const
    }
  };

  async generateScript(options: ScriptGenerationOptions): Promise<GeneratedScript> {
    const {
      topic,
      style = 'vlog',
      targetDuration = 60,
      tone = 'casual',
      includeNarration = true,
      sceneCount
    } = options;

    const template = this.sceneTemplates[style];
    const calculatedSceneCount = sceneCount || Math.ceil(targetDuration / template.avgDuration);
    const actualDuration = calculatedSceneCount * template.avgDuration;

    const sections = this.generateSections(topic, style, calculatedSceneCount, template, includeNarration);
    const fullScript = this.generateFullScript(topic, sections, tone, includeNarration);

    return {
      id: generateId(),
      title: this.generateTitle(topic, style),
      topic,
      style,
      duration: actualDuration,
      sections,
      fullScript,
      tags: this.generateTags(topic, style),
      createdAt: Date.now()
    };
  }

  private generateSections(
    topic: string,
    style: string,
    sceneCount: number,
    template: any,
    includeNarration: boolean
  ): ScriptSection[] {
    const sections: ScriptSection[] = [];
    const introCount = Math.max(1, Math.floor(sceneCount * 0.2));
    const mainCount = Math.floor(sceneCount * 0.6);
    const conclusionCount = sceneCount - introCount - mainCount;

    sections.push(this.createSection('intro', topic, style, introCount, template, includeNarration));
    sections.push(this.createSection('main', topic, style, mainCount, template, includeNarration));
    sections.push(this.createSection('conclusion', topic, style, conclusionCount, template, includeNarration));

    return sections;
  }

  private createSection(
    type: 'intro' | 'main' | 'conclusion',
    topic: string,
    style: string,
    sceneCount: number,
    template: any,
    includeNarration: boolean
  ): ScriptSection {
    const scenes: ScriptScene[] = [];
    let totalDuration = 0;

    const sectionConfigs = {
      intro: { durationRatio: 0.8, focus: '吸引注意' },
      main: { durationRatio: 1.2, focus: '核心内容' },
      conclusion: { durationRatio: 0.8, focus: '总结升华' }
    };

    const config = sectionConfigs[type];

    for (let i = 0; i < sceneCount; i++) {
      const scene = this.generateScene(
        type,
        i + 1,
        topic,
        style,
        template,
        config,
        includeNarration
      );
      scenes.push(scene);
      totalDuration += scene.duration;
    }

    return {
      id: generateId(),
      type,
      scenes,
      totalDuration,
      keyMessage: this.getSectionMessage(type, topic)
    };
  }

  private generateScene(
    sectionType: string,
    sceneNumber: number,
    topic: string,
    style: string,
    template: any,
    config: { durationRatio: number; focus: string },
    includeNarration: boolean
  ): ScriptScene {
    const shotTypes = ['wide', 'medium', 'closeup', 'detail', 'pov', 'tracking'] as const;
    const cameraMovements = ['static', 'pan', 'tilt', 'dolly', 'crane', 'handheld'] as const;

    const shotType = shotTypes[Math.floor(Math.random() * shotTypes.length)];
    const cameraMovement = cameraMovements[Math.floor(Math.random() * cameraMovements.length)];

    const baseDuration = template.avgDuration * config.durationRatio;
    const duration = baseDuration + (Math.random() * 4 - 2);

    return {
      id: generateId(),
      sceneNumber,
      title: this.generateSceneTitle(sectionType, sceneNumber, topic),
      description: this.generateSceneDescription(topic, shotType, style),
      duration: Math.max(3, Math.min(duration, 30)),
      shotType,
      cameraMovement,
      dialogue: Math.random() > 0.7 ? this.generateDialogue(topic) : undefined,
      narration: includeNarration && Math.random() > 0.5 ? this.generateNarration(topic, config.focus) : undefined,
      visualNotes: this.generateVisualNotes(shotType, cameraMovement, style),
      music: this.generateMusicSuggestion(style, sceneNumber),
      transitions: [template.transitions[Math.floor(Math.random() * template.transitions.length)]]
    };
  }

  private generateTitle(topic: string, style: string): string {
    const titles: Record<string, string[]> = {
      cinematic: [
        `光影之间的故事：${topic}`,
        `影像诗篇：${topic}`,
        `镜头里的世界：${topic}`
      ],
      vlog: [
        `聊聊${topic}那些事儿`,
        `关于${topic}我想说`,
        `${topic}的真实体验`
      ],
      commercial: [
        `${topic} - 改变从这一刻开始`,
        `发现${topic}的魅力`,
        `${topic} - 您的最佳选择`
      ],
      documentary: [
        `${topic}：深度探索`,
        `走进${topic}的世界`,
        `${topic}背后的故事`
      ],
      tutorial: [
        `${topic}完整教程`,
        `一文读懂${topic}`,
        `${topic}入门到精通`
      ]
    };

    const styleTitles = titles[style] || titles.vlog;
    return styleTitles[Math.floor(Math.random() * styleTitles.length)];
  }

  private generateSceneTitle(sectionType: string, _sceneNumber: number, _topic: string): string {
    const titles: Record<string, string[]> = {
      intro: ['开场画面', '引入主题', '设置氛围', '开场白'],
      main: ['核心内容展开', '深入分析', '详细讲解', '关键环节'],
      conclusion: ['总结回顾', '收尾升华', '结束语', '呼吁行动']
    };

    const sectionTitles = titles[sectionType] || titles.main;
    return sectionTitles[Math.floor(Math.random() * sectionTitles.length)];
  }

  private generateSceneDescription(topic: string, shotType: string, style: string): string {
    const descriptions = [
      `通过${this.getShotDescription(shotType)}的镜头语言，展现${topic}的核心要素`,
      `以${this.getShotDescription(shotType)}为视觉主体，传达${topic}的关键信息`,
      `运用${this.getShotDescription(shotType)}的构图方式，突出${topic}的重要细节`,
      `采用${this.getShotDescription(shotType)}的拍摄手法，营造${style}风格的视觉氛围`
    ];

    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private getShotDescription(shotType: string): string {
    const descriptions: Record<string, string> = {
      wide: '全景视角',
      medium: '中景画面',
      closeup: '特写镜头',
      detail: '细节捕捉',
      pov: '第一人称视角',
      tracking: '跟随运动'
    };
    return descriptions[shotType] || '中景画面';
  }

  private generateDialogue(topic: string): string {
    const dialogues = [
      `大家好，今天我们来聊聊${topic}`,
      `你有没有想过，${topic}到底有多重要？`,
      `让我来分享一下关于${topic}的经验`,
      `接下来，我会详细介绍${topic}的各个方面`,
      `这就是我理解的${topic}`
    ];
    return dialogues[Math.floor(Math.random() * dialogues.length)];
  }

  private generateNarration(topic: string, focus: string): string {
    const narrations = [
      `${focus}是本视频的核心主题`,
      `让我们一起深入了解${topic}`,
      `在这个片段中，我们将探讨${topic}的精髓`,
      `继续关注，接下来的内容将更加精彩`,
      `这就是${topic}带给我们的启示`
    ];
    return narrations[Math.floor(Math.random() * narrations.length)];
  }

  private generateVisualNotes(shotType: string, cameraMovement: string, style: string): string {
    const notes = [
      `注意光线方向，建议使用${style === 'cinematic' ? '电影感灯光' : '自然光'}`,
      `画面保持稳定${cameraMovement !== 'static' ? `，配合${cameraMovement === 'handheld' ? '手持稳定器' : '轨道运动'}` : ''}`,
      `${shotType === 'closeup' || shotType === 'detail' ? '特写需注意焦点准确' : '注意景深控制'}`,
      `整体色调统一，符合${style}风格定位`
    ];
    return notes.join('；') + '。';
  }

  private generateMusicSuggestion(style: string, _sceneNumber: number): string {
    const musicStyles: Record<string, string[]> = {
      cinematic: ['大气配乐', '钢琴独奏', '弦乐合奏', '氛围电子'],
      vlog: ['轻快流行', '清新民谣', '放松爵士', '活泼电子'],
      commercial: ['节奏感强', '品牌音乐', '正能量', '科技感'],
      documentary: ['深沉叙事', '自然音效', '纪录片配乐', '人文气息'],
      tutorial: ['背景轻音乐', '专注系', '简洁节奏', '无音乐']
    };

    const styleMusic = musicStyles[style] || musicStyles.tutorial;
    return styleMusic[Math.floor(Math.random() * styleMusic.length)];
  }

  private getSectionMessage(type: string, topic: string): string {
    const messages: Record<string, string> = {
      intro: `建立与观众的联系，引出${topic}主题`,
      main: `深入展开${topic}的核心内容和价值`,
      conclusion: `总结要点，唤起行动或思考`
    };
    return messages[type] || '';
  }

  private generateFullScript(
    topic: string,
    sections: ScriptSection[],
    tone: string,
    includeNarration: boolean
  ): string {
    let script = `# ${topic}\n\n`;
    script += `风格：${sections[0]?.style || 'vlog'} | 时长：约${this.calculateDuration(sections)}秒\n\n`;

    sections.forEach(section => {
      script += `## ${this.getSectionTitle(section.type)}\n\n`;
      script += `【${section.keyMessage}】\n\n`;

      section.scenes.forEach(scene => {
        script += `### 场景 ${scene.sceneNumber}：${scene.title}\n`;
        script += `- 时长：${scene.duration.toFixed(1)}秒\n`;
        script += `- 镜头：${this.getShotDescription(scene.shotType)} (${scene.shotType})\n`;
        script += `- 运动：${this.getCameraDescription(scene.cameraMovement)}\n`;
        script += `- 画面：${scene.description}\n`;

        if (scene.dialogue) {
          script += `- 对白："${scene.dialogue}"\n`;
        }

        if (scene.narration && includeNarration) {
          script += `- 旁白：${scene.narration}\n`;
        }

        if (scene.music) {
          script += `- 配乐：${scene.music}\n`;
        }

        if (scene.transitions?.length) {
          script += `- 转场：${scene.transitions.join(' → ')}\n`;
        }

        script += `- 备注：${scene.visualNotes}\n\n`;
      });
    });

    script += `\n---\n`;
    script += `生成的脚本仅供参考，可根据实际情况调整。\n`;
    script += `建议在实际拍摄前进行预演，确保节奏和内容的流畅性。\n`;

    return script;
  }

  private getSectionTitle(type: string): string {
    const titles: Record<string, string> = {
      intro: '第一部分：开场',
      main: '第二部分：核心内容',
      conclusion: '第三部分：收尾'
    };
    return titles[type] || '内容';
  }

  private getCameraDescription(movement: string): string {
    const descriptions: Record<string, string> = {
      static: '固定镜头',
      pan: '水平摇镜',
      tilt: '垂直摇镜',
      dolly: '推拉镜头',
      crane: '升降镜头',
      handheld: '手持跟拍'
    };
    return descriptions[movement] || '固定镜头';
  }

  private calculateDuration(sections: ScriptSection[]): number {
    return sections.reduce((sum, section) => sum + section.totalDuration, 0);
  }

  private generateTags(topic: string, style: string): string[] {
    const commonTags = [topic, style, '视频创作'];
    const styleTags: Record<string, string[]> = {
      cinematic: ['电影感', '专业', '高品质'],
      vlog: ['日常', '分享', '真实'],
      commercial: ['品牌', '营销', '推广'],
      documentary: ['纪实', '深度', '真实故事'],
      tutorial: ['教程', '教学', '学习']
    };

    return [...new Set([...commonTags, ...(styleTags[style] || [])])];
  }

  exportToJSON(script: GeneratedScript): string {
    return JSON.stringify(script, null, 2);
  }

  exportToMarkdown(script: GeneratedScript): string {
    return this.generateFullScript(script.topic, script.sections, 'casual', true);
  }

  importFromJSON(jsonString: string): GeneratedScript | null {
    try {
      const script = JSON.parse(jsonString) as GeneratedScript;
      if (!script.id || !script.sections) {
        throw new Error('Invalid script format');
      }
      return script;
    } catch (error) {
      console.error('[AI Script] 导入失败:', error);
      return null;
    }
  }

  async enhanceScene(
    scene: ScriptScene,
    enhancement: 'more_detail' | 'more_emotion' | 'more_action'
  ): Promise<ScriptScene> {
    const enhancements: Record<string, { description: string; duration: number }> = {
      more_detail: {
        description: '增加更多细节描写和特写镜头，丰富画面层次',
        duration: 3
      },
      more_emotion: {
        description: '加入更多情感表达和人物互动，提升感染力',
        duration: 5
      },
      more_action: {
        description: '增加动态镜头和动作描写，提升观赏性',
        duration: 4
      }
    };

    const enhancementData = enhancements[enhancement];

    return {
      ...scene,
      description: `${scene.description}。${enhancementData.description}`,
      duration: scene.duration + enhancementData.duration,
      visualNotes: `${scene.visualNotes} 特别强调${enhancement.replace('_', '')}效果。`
    };
  }

  getScriptStatistics(script: GeneratedScript) {
    const totalScenes = script.sections.reduce((sum, s) => sum + s.scenes.length, 0);
    const avgSceneDuration = script.duration / totalScenes;

    const shotDistribution: Record<string, number> = {};
    const cameraDistribution: Record<string, number> = {};

    script.sections.forEach(section => {
      section.scenes.forEach(scene => {
        shotDistribution[scene.shotType] = (shotDistribution[scene.shotType] || 0) + 1;
        cameraDistribution[scene.cameraMovement] = (cameraDistribution[scene.cameraMovement] || 0) + 1;
      });
    });

    return {
      totalDuration: script.duration,
      totalScenes,
      avgSceneDuration,
      sectionCount: script.sections.length,
      shotDistribution,
      cameraDistribution,
      hasNarration: script.sections.some(s => s.scenes.some(c => c.narration)),
      hasDialogue: script.sections.some(s => s.scenes.some(c => c.dialogue))
    };
  }
}

export const aiScriptGeneratorService = new AIScriptGeneratorService();
