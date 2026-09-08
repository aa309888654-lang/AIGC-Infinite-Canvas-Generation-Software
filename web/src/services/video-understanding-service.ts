import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';

export interface VideoAnalysisResult {
  success: boolean;
  analysis?: string;
  snapshotUrl?: string | null;
  provider?: string;
  error?: string;
}

/** 调用后端 Skill API 理解参考视频（节奏、运镜、场景） */
export async function analyzeVideoForScript(
  videoUrl: string,
  notes?: string,
): Promise<VideoAnalysisResult> {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: '请先登录后再使用视频参考理解' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/aicg-skills/video-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ videoUrl, notes: notes?.trim() || undefined }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || `视频理解失败 (${response.status})`,
      };
    }

    return {
      success: true,
      analysis: data.analysis,
      snapshotUrl: data.snapshotUrl,
      provider: data.provider,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '网络错误',
    };
  }
}
