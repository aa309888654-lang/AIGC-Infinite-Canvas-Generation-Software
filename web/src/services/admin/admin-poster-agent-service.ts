import { apiClient } from '@/lib/api-client';

export interface PosterAgentRuntimeConfig {
  apiBasePath: string;
  adminBasePath: string;
  defaultModelId: string;
  modelCount: number;
  autoRoutingEnabled: boolean;
  creditPrecheckPoints: number;
  internalChatEndpoint: string;
  knowledgeSource: string;
  capabilities: string[];
}

export interface PosterAgentModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  resolvedProvider: string;
  isDefault: boolean;
}

export interface PosterAgentKnowledgeOverview {
  totalTemplates: number;
  highQualityTemplates: number;
  designTypes: string[];
  industries: string[];
  styleSystems: Record<string, string[]>;
  colorSchemes: Record<string, { ratio: string; colors: string[]; useCase: string }>;
  layoutPreferences: Record<string, string>;
}

export interface PosterAgentRoutingSample {
  text: string;
  modelId: string;
}

export interface PosterAgentEndpoint {
  method: string;
  path: string;
  name: string;
  auth: boolean;
}

export interface PosterAgentOverview {
  runtime: PosterAgentRuntimeConfig;
  models: PosterAgentModel[];
  knowledge: PosterAgentKnowledgeOverview;
  routingSamples: PosterAgentRoutingSample[];
  endpoints: PosterAgentEndpoint[];
}

export interface PosterAgentHealth {
  status: string;
  timestamp: string;
  modelCount: number;
  defaultModelId: string;
  autoRoutingEnabled: boolean;
  internalChatEndpoint: string;
}

class AdminPosterAgentService {
  getOverview(): Promise<{ success: boolean; data: PosterAgentOverview; error?: string }> {
    return apiClient.get('/admin/poster-agent/overview', { maxRetries: 0 });
  }

  getHealth(): Promise<{ success: boolean; data: PosterAgentHealth; error?: string }> {
    return apiClient.get('/admin/poster-agent/health', { maxRetries: 0 });
  }
}

export const adminPosterAgentService = new AdminPosterAgentService();
