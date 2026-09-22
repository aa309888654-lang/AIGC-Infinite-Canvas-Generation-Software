/**
 * clip-intelligence-service — 剪辑智能服务（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

import type { ClipKind } from '@/lib/params/types';

export interface ClipIntelligenceReportItem {
  clipId: string;
  kind: ClipKind;
  [key: string]: any;
}

export interface ClipIntelligenceReportSummary {
  totalClips: number;
  visualClips: number;
  audioClips: number;
  dominantMood: string;
  [key: string]: any;
}

export interface ClipIntelligenceReport {
  id: string;
  clipId: string;
  summary: ClipIntelligenceReportSummary;
  tags: string[];
  confidence: number;
  items: ClipIntelligenceReportItem[];
  visualItems: ClipIntelligenceReportItem[];
  audioItems: ClipIntelligenceReportItem[];
  dominantMood: string;
  totalClips: number;
  visualClips: number;
  audioClips: number;
  [key: string]: any;
}

export class ClipIntelligenceService {
  async analyzeClip(_clip: any): Promise<ClipIntelligenceReport | null> {
    return null;
  }

  async getReport(_clipId: string): Promise<ClipIntelligenceReport | null> {
    return null;
  }

  async batchAnalyze(_clips: any[]): Promise<Map<string, ClipIntelligenceReport>> {
    return new Map();
  }

  analyzeCurrentTimeline(): ClipIntelligenceReport {
    return {
      id: '',
      clipId: '',
      summary: { totalClips: 0, visualClips: 0, audioClips: 0, dominantMood: 'neutral' },
      tags: [],
      confidence: 0,
      items: [],
      visualItems: [],
      audioItems: [],
      dominantMood: 'neutral',
      totalClips: 0,
      visualClips: 0,
      audioClips: 0,
    };
  }
}

export const clipIntelligenceService = new ClipIntelligenceService();