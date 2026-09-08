import React from 'react';
import { Camera, Film, Palette, Sparkles, Box, Layers, Zap, Eye } from 'lucide-react';
import { applyChineseDefaultsToPrompt } from '@/lib/cultural-defaults';

export interface PromptTemplate {
  id: string;
  name: string;
  icon: React.ReactNode;
  prompt: string;
  params?: {
    resolution?: string;
    duration?: number;
    style?: string;
    quality?: string;
    aspectRatio?: string;
  };
}

export const QDRANT_STYLE_TEMPLATES_RAW: Record<string, { name: string; icon: React.ReactNode; color: string; templates: PromptTemplate[] }> = {
  qdrantStyles: {
    name: 'AI风格库',
    icon: <Sparkles className="w-3 h-3" />,
    color: '#8B5CF6',
    templates: [
      { id: 'q-photorealistic', name: '照片级写实', icon: <Camera className="w-3 h-3" />, prompt: '照片级写实效果，高清4K，细节丰富，专业摄影棚光效' },
      { id: 'q-cinematic', name: '电影质感', icon: <Film className="w-3 h-3" />, prompt: '电影质感，大片风格，cinematic，胶片色调，电影级灯光' },
      { id: 'q-anime', name: '动漫风格', icon: <Palette className="w-3 h-3" />, prompt: '动漫风格，日系anime，二次元，卡通渲染，赛璐璐上色' },
      { id: 'q-artistic', name: '艺术绘画', icon: <Layers className="w-3 h-3" />, prompt: '艺术绘画风格，油画质感，水彩手绘，插画艺术，笔触细腻' },
      { id: 'q-cyberpunk', name: '赛博朋克', icon: <Sparkles className="w-3 h-3" />, prompt: '赛博朋克风格，cyberpunk，霓虹灯光，未来科技，数字虚拟，电子机械' },
      { id: 'q-vintage', name: '复古怀旧', icon: <Film className="w-3 h-3" />, prompt: '复古怀旧风格，vintage，胶片质感，年代感，老电影滤镜' },
      { id: 'q-minimalist', name: '极简主义', icon: <Box className="w-3 h-3" />, prompt: '极简主义风格，minimalist，简约干净，大面积留白，纯色背景' },
      { id: 'q-fantasy', name: '奇幻魔法', icon: <Sparkles className="w-3 h-3" />, prompt: '奇幻魔法世界，fantasy，梦幻色调，魔法光效，童话氛围，神话生物' },
      { id: 'q-portrait', name: '人像特写', icon: <Camera className="w-3 h-3" />, prompt: '人像特写，portrait，面部精致特写，五官清晰，情绪表达，专业人像' },
      { id: 'q-landscape', name: '风景广角', icon: <Layers className="w-3 h-3" />, prompt: '风景广角，landscape，震撼景深，壮阔自然风光，广角构图，专业风光摄影' },
      { id: 'q-product', name: '产品展示', icon: <Box className="w-3 h-3" />, prompt: '产品展示，product，商业广告风格，电商主图，专业打光，纯白背景' },
      { id: 'q-fashion', name: '时尚潮流', icon: <Palette className="w-3 h-3" />, prompt: '时尚潮流风格，fashion，杂志大片，潮流穿搭，专业时尚摄影' },
      { id: 'q-sci-fi', name: '科幻未来', icon: <Zap className="w-3 h-3" />, prompt: '科幻未来风格，sci-fi，太空科技感，未来世界，科幻电影质感' },
      { id: 'q-gothic', name: '哥特暗系', icon: <Eye className="w-3 h-3" />, prompt: '哥特暗系风格，gothic，黑暗神秘，暗黑美学，哥特式元素' },
      { id: 'q-impressionist', name: '印象派', icon: <Palette className="w-3 h-3" />, prompt: '印象派风格，impressionist，莫奈雷诺阿，光影捕捉，色彩斑斓，朦胧美感' }
    ]
  }
};

export function getQdrantStyleTemplates(): Record<string, { name: string; icon: React.ReactNode; color: string; templates: PromptTemplate[] }> {
  const result: Record<string, { name: string; icon: React.ReactNode; color: string; templates: PromptTemplate[] }> = {};
  for (const [key, cat] of Object.entries(QDRANT_STYLE_TEMPLATES_RAW)) {
    result[key] = {
      ...cat,
      templates: cat.templates.map((t) => ({
        ...t,
        prompt: applyChineseDefaultsToPrompt(t.prompt),
      })),
    };
  }
  return result;
}

export const QDRANT_STYLE_TEMPLATES = getQdrantStyleTemplates();

export function getQdrantStyleTemplateById(id: string): PromptTemplate | undefined {
  for (const category of Object.values(QDRANT_STYLE_TEMPLATES)) {
    const found = category.templates.find(t => t.id === id);
    if (found) return found;
  }
  return undefined;
}

export function searchQdrantStyleTemplates(keyword: string): PromptTemplate[] {
  const lowerKeyword = keyword.toLowerCase();
  const results: PromptTemplate[] = [];
  for (const category of Object.values(QDRANT_STYLE_TEMPLATES)) {
    for (const template of category.templates) {
      if (
        template.name.toLowerCase().includes(lowerKeyword) ||
        template.prompt.toLowerCase().includes(lowerKeyword)
      ) {
        results.push(template);
      }
    }
  }
  return results;
}
