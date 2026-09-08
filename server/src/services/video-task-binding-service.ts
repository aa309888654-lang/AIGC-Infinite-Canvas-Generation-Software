import { redisService } from './redis-service';

export type VideoBindingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface VideoTaskBinding {
  localTaskId: string;
  providerTaskId: string;
  provider: string;
  model: string;
  keyId: string;
  leaseToken: string;
  status: VideoBindingStatus;
  createdAt: string;
  expiresAt: string;
}

export interface BindVideoTaskInput {
  localTaskId: string;
  providerTaskId: string;
  provider: string;
  model: string;
  keyId: string;
  leaseToken: string;
  status: VideoBindingStatus;
}

const BINDING_TTL_SECONDS = 2 * 60 * 60;

class VideoTaskBindingService {
  private localKey(localTaskId: string): string {
    return `video:task-binding:local:${localTaskId}`;
  }

  private providerKey(provider: string, providerTaskId: string): string {
    return `video:task-binding:provider:${provider}:${providerTaskId}`;
  }

  async bind(input: BindVideoTaskInput): Promise<VideoTaskBinding> {
    const binding: VideoTaskBinding = {
      ...input,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + BINDING_TTL_SECONDS * 1000).toISOString(),
    };

    await redisService.setJson(this.localKey(binding.localTaskId), binding, BINDING_TTL_SECONDS);
    await redisService.setJson(
      this.providerKey(binding.provider, binding.providerTaskId),
      binding,
      BINDING_TTL_SECONDS
    );

    return binding;
  }

  async getByLocalTaskId(localTaskId: string): Promise<VideoTaskBinding | null> {
    return redisService.getJson<VideoTaskBinding>(this.localKey(localTaskId));
  }

  async getByProviderTaskId(provider: string, providerTaskId: string): Promise<VideoTaskBinding | null> {
    return redisService.getJson<VideoTaskBinding>(this.providerKey(provider, providerTaskId));
  }

  async clear(binding: Pick<VideoTaskBinding, 'localTaskId' | 'provider' | 'providerTaskId'>): Promise<void> {
    await redisService.deleteKeys([
      this.localKey(binding.localTaskId),
      this.providerKey(binding.provider, binding.providerTaskId),
    ]);
  }
}

export const videoTaskBindingService = new VideoTaskBindingService();
