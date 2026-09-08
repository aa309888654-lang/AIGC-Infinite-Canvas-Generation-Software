/**
 * 视频模型兼容性工具
 * 视频模型禁止自动转模型。
 *
 * 池繁忙、上游临时错误和恢复流程都只能使用用户明确选择的模型，
 * 不得以“兼容”名义降级到同系列或跨系列模型。
 */

export interface CompatibleModelsOptions {
  provider?: string;
  requestedModel?: string;
}

export function getCompatibleLeaseModels(options: CompatibleModelsOptions | string, requestedModel?: string): string[] {
  let provider: string | undefined;
  let model: string | undefined;

  if (typeof options === 'string') {
    provider = options;
    model = requestedModel;
  } else {
    provider = options.provider;
    model = options.requestedModel;
  }

  const requested = model || 'viduq3-turbo';
  void provider;
  return [requested];
}
