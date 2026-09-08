import { apiClient } from '@/lib/api-client';

export interface RewardConfig {
  registration_bonus: number;
  registration_bonus_expiry_days: number;
  daily_claim: number;
  daily_claim_expiry_days: number;
  bind_contact_reward: number;
  bind_contact_reward_expiry_days: number;
  invite_registration_reward: number;
  invite_recharge_reward: number;
  invite_recharge_threshold: number;
  invite_reward_expiry_days: number;
}

export interface ConfigDefinition {
  key: string;
  label: string;
  description: string;
  defaultValue: number;
  group: string;
  type: string;
  min: number;
}

export interface RewardConfigResponse {
  success: boolean;
  data: {
    config: RewardConfig;
    definitions: ConfigDefinition[];
    defaults: Record<string, number>;
  };
}

class PointsRewardConfigService {
  async get(): Promise<RewardConfigResponse> {
    return apiClient.get('/admin/points/reward-config');
  }

  async update(config: Partial<RewardConfig>): Promise<{ success: boolean; message?: string }> {
    return apiClient.put('/admin/points/reward-config', config);
  }
}

export const pointsRewardConfigService = new PointsRewardConfigService();
