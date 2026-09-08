export function resolveCustomImagePoints(imageCount: number): number {
  return Math.max(1, Math.floor(Number(imageCount) || 0));
}

export function resolveCustomVideoPoints(durationSeconds: number): number {
  return Math.max(1, Math.floor(Number(durationSeconds) || 0));
}
