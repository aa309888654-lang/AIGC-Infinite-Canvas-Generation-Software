export interface UnifiedApiRequest {
  taskId: string;
  model: string;
  type: 'image' | 'video';
  parameters: Record<string, unknown>;
  webhookUrl?: string;
  createdAt: number;
}

export interface UnifiedApiResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  resultUrl?: string;
  error?: string;
  createdAt: number;
  estimatedTime?: number; // 预估剩余时间(秒)
  costMs: number; // 耗时(毫秒)
  rawResponse?: unknown;
}
