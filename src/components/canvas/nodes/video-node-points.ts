export function resolveVideoNodePointsPerSecond(
  configuredPointsPerSecond: number,
  isCustomModel: boolean,
): number {
  return isCustomModel ? 1 : configuredPointsPerSecond;
}

export function resolveVideoNodePoints(
  configuredPoints: number,
  durationSeconds: number,
  isCustomModel: boolean,
): number {
  return isCustomModel
    ? Math.max(1, Math.floor(Number(durationSeconds) || 0))
    : configuredPoints;
}
