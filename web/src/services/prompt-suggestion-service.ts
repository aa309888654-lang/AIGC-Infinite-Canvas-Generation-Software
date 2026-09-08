/**
 * Prompt Suggestion Service
 * Provides AI-powered suggestions for prompt optimization
 */

export interface PromptSuggestion {
  type: 'style' | 'quality' | 'technique' | 'detail';
  text: string;
  confidence: number;
  reason?: string;
}

export interface PromptAnalysis {
  length: number;
  hasStyle: boolean;
  hasQuality: boolean;
  hasTechnique: boolean;
  missingDetails: string[];
  suggestions: PromptSuggestion[];
}

export interface HistoryRecord {
  prompt: string;
  success: boolean;
  rating?: number;
  style?: string;
  tags?: string[];
}

/**
 * Prompt Suggestion Service
 * Analyzes prompts and provides optimization suggestions
 */
export class PromptSuggestionService {
  private history: HistoryRecord[] = [];

  constructor() {
    // Initialize with any default history if needed
  }

  /**
   * Add a prompt to history
   */
  addToHistory(record: HistoryRecord): void {
    this.history.push(record);
    // Keep only last 100 records
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
  }

  /**
   * Analyze a prompt and provide suggestions
   */
  analyze(prompt: string): PromptAnalysis {
    const suggestions: PromptSuggestion[] = [];
    const missingDetails: string[] = [];

    // Check prompt length
    if (prompt.length < 20) {
      missingDetails.push('prompt is too short');
      suggestions.push({
        type: 'detail',
        text: 'Add more descriptive details',
        confidence: 0.9,
        reason: 'Short prompts may result in lower quality output'
      });
    }

    // Check for style keywords
    const styleKeywords = ['realistic', 'anime', 'digital art', 'oil painting', 'watercolor', '3d render', 'cinematic'];
    const hasStyle = styleKeywords.some(kw => prompt.toLowerCase().includes(kw));

    if (!hasStyle) {
      suggestions.push({
        type: 'style',
        text: 'Consider adding an art style',
        confidence: 0.7,
        reason: 'Style keywords can significantly improve output quality'
      });
    }

    // Check for quality keywords
    const qualityKeywords = ['high quality', 'detailed', 'professional', '8k', 'ultra hd'];
    const hasQuality = qualityKeywords.some(kw => prompt.toLowerCase().includes(kw));

    if (!hasQuality) {
      suggestions.push({
        type: 'quality',
        text: 'Add quality modifiers like "high quality" or "detailed"',
        confidence: 0.75,
        reason: 'Quality keywords help improve output'
      });
    }

    // Check for technique keywords
    const techniqueKeywords = ['depth of field', 'cinematic lighting', 'rule of thirds', 'symmetric'];
    const hasTechnique = techniqueKeywords.some(kw => prompt.toLowerCase().includes(kw));

    if (!hasTechnique && prompt.length > 50) {
      suggestions.push({
        type: 'technique',
        text: 'Consider adding photographic techniques',
        confidence: 0.6,
        reason: 'Photography techniques can enhance composition'
      });
    }

    // Get history-based suggestions
    const historySuggestions = this.getHistoryBasedSuggestions(prompt);
    suggestions.push(...historySuggestions);

    return {
      length: prompt.length,
      hasStyle,
      hasQuality,
      hasTechnique,
      missingDetails,
      suggestions: suggestions.sort((a, b) => b.confidence - a.confidence)
    };
  }

  /**
   * Get suggestions based on successful history
   */
  private getHistoryBasedSuggestions(prompt: string): PromptSuggestion[] {
    const suggestions: PromptSuggestion[] = [];
    const lowerPrompt = prompt.toLowerCase();

    // Find successful prompts with ratings >= 4
    const successfulPrompts = this.history.filter(r => r.success && (r.rating || 0) >= 4);

    if (successfulPrompts.length === 0) return suggestions;

    // Extract common styles from successful prompts
    const styleCounts = new Map<string, number>();
    successfulPrompts.forEach(record => {
      if (record.style) {
        styleCounts.set(record.style, (styleCounts.get(record.style) || 0) + 1);
      }
    });

    // Get top 3 styles
    const topStyles = Array.from(styleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    topStyles.forEach(([style, count]) => {
      if (!lowerPrompt.includes(style.toLowerCase())) {
        suggestions.push({
          type: 'style',
          text: `Try the ${style} style (${count} historical successes)`,
          confidence: 0.7,
          reason: 'Based on your successful prompts'
        });
      }
    });

    return suggestions;
  }

  /**
   * Get all suggestions sorted by confidence
   */
  getSuggestions(prompt: string): PromptSuggestion[] {
    const analysis = this.analyze(prompt);
    return analysis.suggestions;
  }
}

export const promptSuggestionService = new PromptSuggestionService();
export default PromptSuggestionService;
