/**
 * Skills Index
 * 技能包统一导出
 */

export const SKILLS = {
  VIDEO_EDITING: {
    id: 'video-editing-skill',
    name: 'Video Editing',
    description: '专业视频编辑技能包',
    category: 'video',
    file: 'video-editing-skill.md',
  },
  VOICE_OVER: {
    id: 'voice-over-skill',
    name: 'Voice Over',
    description: 'AI配音技能包',
    category: 'voice',
    file: 'voice-over-skill.md',
  },
  MUSIC_GENERATION: {
    id: 'music-generation-skill',
    name: 'Music Generation',
    description: 'AI音乐生成技能包',
    category: 'music',
    file: 'music-generation-skill.md',
  },
  NODE_DEVELOPMENT: {
    id: 'node-development-skill',
    name: 'Node Development',
    description: 'React Flow节点开发技能包',
    category: 'node',
    file: 'node-development-skill.md',
  },
  OPEN_SOURCE_SEARCH: {
    id: 'open-source-search-skill',
    name: 'Open Source Search',
    description: '开源搜索技能包',
    category: 'search',
    file: 'open-source-search-skill.md',
  },
} as const;

export type SkillId = keyof typeof SKILLS;
export type SkillInfo = (typeof SKILLS)[SkillId];

/**
 * 获取技能信息
 */
export function getSkillInfo(id: SkillId): SkillInfo {
  return SKILLS[id];
}

/**
 * 获取所有技能
 */
export function getAllSkills(): SkillInfo[] {
  return Object.values(SKILLS);
}

/**
 * 按分类获取技能
 */
export function getSkillsByCategory(category: string): SkillInfo[] {
  return Object.values(SKILLS).filter((skill) => skill.category === category);
}

/**
 * 加载技能内容
 */
export async function loadSkillContent(skillId: SkillId): Promise<string> {
  const skill = SKILLS[skillId];
  try {
    // 动态导入 markdown 文件
    const content = await import(`./${skill.file}`);
    return content.default || content;
  } catch {
    return `Skill: ${skill.name}\n\nDescription: ${skill.description}`;
  }
}

/**
 * 技能分类
 */
export const SKILL_CATEGORIES = {
  video: ['video-editing-skill'],
  voice: ['voice-over-skill'],
  music: ['music-generation-skill'],
  node: ['node-development-skill'],
  search: ['open-source-search-skill'],
} as const;
