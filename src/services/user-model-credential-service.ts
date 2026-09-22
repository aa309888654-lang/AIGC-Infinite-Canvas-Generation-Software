import { apiClient } from '@/lib/api-client';

export interface UserModelCredentialMeta {
  provider: string;
  enabled: boolean;
  displayName?: string;
  protocol?: 'openai' | 'anthropic';
  selectedModel: string;
  baseUrl: string;
  hasCredentials: boolean;
  maskedApiKey?: string;
  updatedAt: string;
}

export interface UserModelCredentialInput {
  enabled?: boolean;
  displayName?: string;
  protocol?: 'openai' | 'anthropic';
  selectedModel?: string;
  baseUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  accessKey?: string;
  secretKey?: string;
  clearSecretFields?: boolean;
}

class UserModelCredentialService {
  async list(): Promise<{ entries: UserModelCredentialMeta[]; usedBytes: number; limitBytes: number }> {
    const response = await apiClient.get<{ success: boolean; data: { entries: UserModelCredentialMeta[]; usedBytes: number; limitBytes: number } }>('/user-model-credentials');
    return response.data;
  }

  async save(provider: string, input: UserModelCredentialInput) {
    return apiClient.put<{ success: boolean; data: { entry: UserModelCredentialMeta; usedBytes: number; limitBytes: number } }>(
      `/user-model-credentials/${encodeURIComponent(provider)}`,
      input,
      { maxRetries: 0 }
    );
  }

  async remove(provider: string) {
    return apiClient.delete<{ success: boolean; data: { usedBytes: number; limitBytes: number } }>(
      `/user-model-credentials/${encodeURIComponent(provider)}`,
      { maxRetries: 0 }
    );
  }
}

export const userModelCredentialService = new UserModelCredentialService();
