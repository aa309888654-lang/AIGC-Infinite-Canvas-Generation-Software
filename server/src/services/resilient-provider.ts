import { IApiProvider } from './base-provider';
import { VideoParams, ImageParams, AudioParams, GenerationResult, ApiProviderConfig } from '../types/api';

export class ResilientProvider implements IApiProvider {
  readonly name: string;
  readonly supportedModes: string[];
  private provider: IApiProvider;

  constructor(provider: IApiProvider) {
    this.provider = provider;
    this.name = provider.name;
    this.supportedModes = provider.supportedModes;
  }

  async generateVideo(params: VideoParams, config: ApiProviderConfig): Promise<GenerationResult> {
    return this.provider.generateVideo(params, config);
  }

  async generateImage(params: ImageParams, config: ApiProviderConfig): Promise<GenerationResult> {
    return this.provider.generateImage(params, config);
  }

  async generateAudio(params: AudioParams, config: ApiProviderConfig): Promise<GenerationResult> {
    return this.provider.generateAudio(params, config);
  }

  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    return this.provider.getTaskStatus(taskId, config);
  }
}
