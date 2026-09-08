export interface GenerationEstimate {
  requestCount: number;
  points: number;
  timeLabel: string;
  summary: string;
}

function formatTimeRange(minSeconds: number, maxSeconds: number): string {
  const format = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}min`;
  };
  return `${format(minSeconds)}-${format(maxSeconds)}`;
}

export function estimateMultiAngleGeneration(angleCount: number, points: number): GenerationEstimate {
  const requestCount = Math.max(0, Math.floor(angleCount));
  const minSeconds = Math.max(20, requestCount * 25);
  const maxSeconds = Math.max(45, requestCount * 60);
  const timeLabel = formatTimeRange(minSeconds, maxSeconds);
  return {
    requestCount,
    points,
    timeLabel,
    summary: `${requestCount}次生成 · 约${timeLabel}`,
  };
}

export function estimateGridDirectorGeneration(
  frameCount: number,
  points: number,
  mode: 'grid' | 'storyboard' | 'hybrid' | 'split',
): GenerationEstimate {
  if (mode === 'split') {
    return {
      requestCount: 0,
      points: 0,
      timeLabel: '<10s',
      summary: '本地处理 · 免费',
    };
  }

  const normalizedFrameCount = Math.max(0, Math.floor(frameCount));
  const requestCount = mode === 'hybrid' ? normalizedFrameCount * 2 : normalizedFrameCount;
  const minSeconds = Math.max(30, requestCount * 25);
  const maxSeconds = Math.max(60, requestCount * 75);
  const timeLabel = formatTimeRange(minSeconds, maxSeconds);
  return {
    requestCount,
    points,
    timeLabel,
    summary: `${requestCount}次生成 · 约${timeLabel}`,
  };
}
