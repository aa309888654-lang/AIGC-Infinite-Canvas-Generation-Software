import { BaseProvider } from './base-provider';
import { VideoParams, ImageParams, GenerationResult, ApiProviderConfig } from '../types/api';
import { logger } from '../utils/logger';
import axios from 'axios';

/**
 * DeepSeek 文本模型 Provider
 *
 * 直连 DeepSeek API (https://api.deepseek.com)
 * 支持：
 *   - deepseek-chat (DeepSeek V3)
 *   - deepseek-reasoner (DeepSeek R1)
 *
 * 文档：https://platform.deepseek.com/api-docs
 */
export class DeepSeekProvider extends BaseProvider {
  readonly name = 'deepseek';
  readonly supportedModes = ['text_generation', 'chat'];

  protected getDefaultEndpoint(): string {
    return 'https://api.deepseek.com';
  }

  private buildHeaders(config: ApiProviderConfig): Record<string, string> {
    return {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async generateVideo(params: VideoParams, config: ApiProviderConfig): Promise<GenerationResult> {
    return this.makeFailedTaskResult('', new Error('DeepSeek 不支持视频生成'));
  }

  async generateImage(params: ImageParams, config: ApiProviderConfig): Promise<GenerationResult> {
    return this.makeFailedTaskResult('', new Error('DeepSeek 不支持图片生成'));
  }

  async generateAudio(params: any, config: ApiProviderConfig): Promise<GenerationResult> {
    return this.makeFailedTaskResult('', new Error('DeepSeek 不支持音频生成'));
  }

  /**
   * 文本生成（Chat Completions）
   */
  async generateText(prompt: string, config: ApiProviderConfig, model?: string): Promise<{
    content: string;
    model: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    const endpoint = this.getEndpoint(config).replace(/\/+$/, '');
    const url = `${endpoint}/chat/completions`;
    const headers = this.buildHeaders(config);
    const actualModel = model || 'deepseek-chat';

    const body = {
      model: actualModel,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    };

    logger.info(`[DeepSeek] 文本生成请求: model=${actualModel}, promptLen=${prompt.length}`);

    try {
      const response = await axios.post(url, body, {
        headers,
        timeout: 120000,
      });

      const data = response.data;
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage;

      logger.info(`[DeepSeek] 文本生成完成: model=${actualModel}, contentLen=${content.length}, usage=${JSON.stringify(usage)}`);

      return {
        content,
        model: data.model || actualModel,
        usage,
      };
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[DeepSeek] 文本生成失败: ${message}`);
      throw new Error(`DeepSeek 文本生成失败: ${message}`);
    }
  }

  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    return this.makeFailedTaskResult(taskId, new Error('DeepSeek 不支持任务状态查询'));
  }
}
