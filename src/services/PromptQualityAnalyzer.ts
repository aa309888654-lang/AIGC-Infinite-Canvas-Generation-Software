/**
 * 提示词质量分析器
 * 实时评估提示词质量，生成改进建议
 * 支持多维度评分：长度、关键词、结构、多样性
 */

import { QualityMetrics, QualitySuggestion } from './PromptService';

// ==================== 关键词库 ====================

const KEYWORD_DATABASE = {
  quality: [
    'masterpiece', 'high quality', 'detailed', 'sharp', 'clear',
    'beautiful', 'stunning', 'amazing', 'professional', 'cinematic',
    '8k', '4k', 'hd', 'ultra', 'award-winning', 'breathtaking',
    'exquisite', 'magnificent', 'splendid', 'gorgeous', 'elegant'
  ],
  style: [
    'photorealistic', 'oil painting', 'watercolor', 'digital art',
    'anime', 'concept art', 'illustration', 'photography', '3d render',
    'hyperrealistic', 'surrealism', 'impressionism', 'expressionism',
    'minimalist', 'vintage', 'modern', 'abstract', 'realistic'
  ],
  composition: [
    'centered', 'rule of thirds', 'symmetrical', 'dynamic',
    'balanced', 'leading lines', 'foreground', 'background',
    'depth of field', 'bokeh', 'close-up', 'wide shot', 'extreme close-up',
    "bird's eye view", "worm's eye view", 'overhead shot', 'low angle',
    'high angle', 'dutch angle', 'panorama', 'portrait orientation',
    'landscape orientation', 'square format'
  ],
  lighting: [
    'dramatic lighting', 'soft lighting', 'natural light', 'studio lighting',
    'golden hour', 'blue hour', 'rim light', 'backlight', 'ambient occlusion',
    'neon lights', 'candlelight', 'moonlight', 'spotlight', 'floodlight',
    'diffused light', 'harsh light', 'side lighting', 'front lighting',
    'rembrandt lighting', 'chiaroscuro', 'high key', 'low key'
  ],
  detail: [
    'intricate', 'elaborate', 'highly detailed', 'complex',
    'fine details', 'textured', 'ornate', 'meticulous', 'precise',
    'crisp', 'defined', 'refined', 'polished', 'rich in detail',
    'hyper-detailed', 'ultra-detailed', 'exquisitely crafted'
  ],
  mood: [
    'serene', 'melancholic', 'joyful', 'mysterious', 'ethereal',
    'nostalgic', 'whimsical', 'dramatic', 'peaceful', 'tense',
    'romantic', 'ominous', 'hopeful', 'despairing', 'tranquil',
    'energetic', 'calm', 'chaotic', 'orderly', 'dreamlike'
  ],
  color: [
    'vibrant colors', 'muted tones', 'pastel colors', 'monochromatic',
    'warm palette', 'cool palette', 'complementary colors', 'analogous colors',
    'neon colors', 'earth tones', 'pastel shades', 'bold colors', 'subtle hues',
    'rainbow gradient', 'gradient background', 'color harmony', 'color contrast'
  ],
  technical: [
    '24fps', '30fps', '60fps', '120fps',
    '4k resolution', '1080p', '720p', '8k',
    'cinematic aspect ratio', 'widescreen', 'vertical video', 'square frame',
    'slow motion', 'time-lapse', 'hyperlapse', 'motion blur',
    'depth of field', 'shallow focus', 'rack focus', 'follow focus'
  ]
};

const NEGATIVE_KEYWORDS = [
  'low quality', 'blurry', 'distorted', 'deformed', 'bad anatomy',
  'extra limbs', 'missing fingers', 'poorly drawn', 'watermark',
  'signature', 'cropped', 'out of frame', 'jpeg artifacts', 'compression artifacts',
  'ugly', 'disgusting', 'gross', 'repulsive', 'amateurish',
  'beginner', 'novice', 'unskilled', 'incompetent', 'mediocre'
];

// ==================== 分析器类 ====================

class PromptQualityAnalyzer {

  analyze(text: string): {
    metrics: QualityMetrics;
    suggestions: QualitySuggestion[];
    scoreLabel: string;
    scoreColor: string;
  } {
    const lowerText = text.toLowerCase();
    const words = text.split(/\s+/);

    const metrics: QualityMetrics = {
      score: 0,
      lengthScore: this.calculateLengthScore(text),
      keywordScore: this.calculateKeywordScore(lowerText),
      structureScore: this.calculateStructureScore(text, words, lowerText),
      varietyScore: this.calculateVarietyScore(words),
    };

    metrics.score = Math.round(
      metrics.lengthScore * 0.15 +
      metrics.keywordScore * 0.40 +
      metrics.structureScore * 0.25 +
      metrics.varietyScore * 0.20
    );

    const suggestions = this.generateSuggestions(text, lowerText, metrics);
    const { label, color } = this.getScoreInfo(metrics.score);

    return {
      metrics,
      suggestions,
      scoreLabel: label,
      scoreColor: color,
    };
  }

  private calculateLengthScore(text: string): number {
    const charCount = text.length;

    if (charCount < 10) return 10;
    if (charCount < 30) return 30;
    if (charCount < 60) return 70;
    if (charCount <= 200) return 100;
    if (charCount <= 400) return 85;
    if (charCount <= 600) return 65;
    return 45;
  }

  private calculateKeywordScore(lowerText: string): number {
    let positiveScore = 0;
    let negativePenalty = 0;

    for (const category of Object.values(KEYWORD_DATABASE)) {
      const matches = category.filter(kw => lowerText.includes(kw.toLowerCase()));
      positiveScore += matches.length * 8;
    }

    for (const negKw of NEGATIVE_KEYWORDS) {
      if (lowerText.includes(negKw.toLowerCase())) {
        negativePenalty += 15;
      }
    }

    return Math.max(0, Math.min(100, positiveScore - negativePenalty));
  }

  private calculateStructureScore(text: string, words: string[], lowerText: string): number {
    let score = 0;

    const hasPunctuation = /[;,，；.。:：]/.test(text);
    if (hasPunctuation) score += 25;

    const segments = text.split(/[;,，；]/);
    if (segments.length >= 2 && segments.length <= 6) score += 20;
    else if (segments.length > 6) score += 10;

    if (/^(a|an|the|一个|一只|一张|一幅|一位)/i.test(text)) {
      score += 20;
    }

    if (/\b(in|with|using|style|quality|rendered|painted|shot)\b/i.test(text)) {
      score += 15;
    }

    if (/\d+/.test(text)) score += 10;

    if (/\b(but|while|however|although|yet|whereas|vs\.)\b/i.test(lowerText)) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private calculateVarietyScore(words: string[]): number {
    if (words.length === 0) return 0;

    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const varietyRatio = uniqueWords.size / words.length;

    if (varietyRatio < 0.3) return 20;
    if (varietyRatio < 0.5) return 55;
    if (varietyRatio <= 0.85) return 100;
    if (varietyRatio <= 1.0) return 80;
    return 90;
  }

  private generateSuggestions(
    text: string,
    lowerText: string,
    metrics: QualityMetrics
  ): QualitySuggestion[] {
    const suggestions: QualitySuggestion[] = [];

    if (text.length < 30) {
      suggestions.push({
        type: 'improvement',
        message: '提示词较短，建议添加更多细节描述以提升生成效果（推荐 50-200 字符）',
        impact: 20,
      });
    } else if (text.length > 400) {
      suggestions.push({
        type: 'improvement',
        message: '提示词较长，可能影响生成效果，建议精简到 100-250 字符',
        impact: 10,
      });
    } else {
      suggestions.push({
        type: 'positive',
        message: `✓ 提示词长度适中 (${text.length} 字符)`,
        impact: 0,
      });
    }

    if (metrics.keywordScore < 30) {
      suggestions.push({
        type: 'improvement',
        message: '💡 建议添加质量描述词：high quality, detailed, cinematic, 8k',
        impact: 18,
      });

      const missingCategories = this.findMissingCategories(lowerText);
      if (missingCategories.length > 0) {
        suggestions.push({
          type: 'positive',
          message: `🎯 可尝试添加${missingCategories.join('、')}相关词汇`,
          impact: 12,
        });
      }
    } else if (metrics.keywordScore >= 60) {
      suggestions.push({
        type: 'positive',
        message: '✓ 包含丰富的专业术语，质量很高！',
        impact: 0,
      });
    }

    if (metrics.structureScore < 40) {
      suggestions.push({
        type: 'improvement',
        message: '📝 建议使用逗号分隔多个描述元素，如："主体, 风格, 光线, 构图"',
        impact: 15,
      });
    } else {
      suggestions.push({
        type: 'positive',
        message: '✓ 提示词结构清晰，易于理解',
        impact: 0,
      });
    }

    if (!lowerText.includes('negative') && !lowerText.includes('no')) {
      if (text.length > 50) {
        suggestions.push({
          type: 'improvement',
          message: '⚠️ 建议添加负面提示词（negative prompt）以避免不良效果',
          impact: 8,
        });
      }
    }

    if (!this.hasStyleKeywords(lowerText)) {
      const styleSuggestions = this.getStyleRecommendations(lowerText);
      if (styleSuggestions.length > 0) {
        suggestions.push({
          type: 'positive',
          message: `🎨 风格推荐：${styleSuggestions.slice(0, 3).join(' 或 ')}`,
          impact: 5,
        });
      }
    }

    if (!this.hasLightingKeywords(lowerText)) {
      const lightingRecs = this.getLightingRecommendations(lowerText);
      if (lightingRecs.length > 0) {
        suggestions.push({
          type: 'positive',
          message: `💡 光线推荐：${lightingRecs.slice(0, 2).join(' 或 ')}`,
          impact: 5,
        });
      }
    }

    return suggestions.sort((a, b) => b.impact - a.impact);
  }

  private findMissingCategories(text: string): string[] {
    const missing: string[] = [];

    const categoryMap: Record<string, string[]> = {
      风格: KEYWORD_DATABASE.style.slice(0, 5),
      光线: KEYWORD_DATABASE.lighting.slice(0, 5),
      构图: KEYWORD_DATABASE.composition.slice(0, 5),
      细节: KEYWORD_DATABASE.detail.slice(0, 5),
    };

    for (const [name, keywords] of Object.entries(categoryMap)) {
      const hasAny = keywords.some(kw => text.includes(kw.toLowerCase()));
      if (!hasAny) {
        missing.push(name);
      }
    }

    return missing;
  }

  private hasStyleKeywords(text: string): boolean {
    return KEYWORD_DATABASE.style.some(kw => text.includes(kw.toLowerCase()));
  }

  private hasLightingKeywords(text: string): boolean {
    return KEYWORD_DATABASE.lighting.some(kw => text.includes(kw.toLowerCase()));
  }

  private getStyleRecommendations(text: string): string[] {
    const available = KEYWORD_DATABASE.style.filter(
      kw => !text.includes(kw.toLowerCase())
    );
    return this.randomPick(available, 5);
  }

  private getLightingRecommendations(text: string): string[] {
    const available = KEYWORD_DATABASE.lighting.filter(
      kw => !text.includes(kw.toLowerCase())
    );
    return this.randomPick(available, 3);
  }

  private randomPick<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, array.length));
  }

  private getScoreInfo(score: number): { label: string; color: string } {
    if (score >= 90) return { label: '优秀 ⭐⭐⭐⭐⭐', color: '#22c55e' };
    if (score >= 75) return { label: '良好 ⭐⭐⭐⭐', color: '#84cc16' };
    if (score >= 60) return { label: '中等 ⭐⭐⭐', color: '#eab308' };
    if (score >= 40) return { label: '一般 ⭐⭐', color: '#f97316' };
    return { label: '需改善 ⭐', color: '#ef4444' };
  }

  batchAnalyze(texts: string[]): Array<{
    text: string;
    result: ReturnType<PromptQualityAnalyzer['analyze']>;
  }> {
    return texts.map(text => ({
      text,
      result: this.analyze(text),
    }));
  }

  quickScore(text: string): number {
    const { metrics } = this.analyze(text);
    return metrics.score;
  }
}

// ==================== 单例导出 ====================

export const promptQualityAnalyzer = new PromptQualityAnalyzer();

export function createQualityAnalyzer(): PromptQualityAnalyzer {
  return new PromptQualityAnalyzer();
}
