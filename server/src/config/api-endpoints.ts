export const API_ENDPOINTS = {
  DASHSCOPE_CHAT: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  VOLCES_CHAT: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  MINIMAX_CHAT: 'https://api.minimax.chat/v1/chat/completions',
  MINIMAX_MEDIA: 'https://api.minimaxi.com',
  MINIMAX_VIDEO: 'https://api.minimaxi.com/v1/video_generation',
  XUNFEI_CHAT: 'https://spark-api-open.xf-yun.com/v2/chat/completions',
  DOUBAO_VIDEO: 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
} as const;

export const getEndpoint = (provider: string, type: 'chat' | 'video' | 'image' | 'tts' = 'chat'): string => {
  const key = `${provider.toUpperCase()}_${type.toUpperCase()}` as keyof typeof API_ENDPOINTS;
  return API_ENDPOINTS[key] || '';
};
