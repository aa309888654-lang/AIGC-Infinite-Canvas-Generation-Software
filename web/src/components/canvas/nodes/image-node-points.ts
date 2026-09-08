export function resolveImageNodePoints(
  unitPoints: number,
  imageCount: number,
  isCustomModel: boolean,
): number {
  const normalizedCount = Math.max(1, Math.floor(Number(imageCount) || 0));
  return isCustomModel ? normalizedCount : unitPoints * normalizedCount;
}
