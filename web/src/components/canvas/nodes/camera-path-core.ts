export type CameraPathMode = 'smart' | 'strict';
export type CameraPathSemantics = 'screen_tracking' | 'camera_translation' | 'flythrough';
export type CameraWaypointKind = 'start' | 'waypoint' | 'end';

export interface CameraPathPoint {
  x: number;
  y: number;
}

export interface CameraPathWaypoint extends CameraPathPoint {
  id: string;
  kind: CameraWaypointKind;
  label: string;
  pointIndex: number;
  progress: number;
  timeSec: number;
}

export interface CameraPathDocument {
  schemaVersion: 1;
  mode: CameraPathMode;
  semantics: CameraPathSemantics;
  durationSec: number;
  points: CameraPathPoint[];
  waypoints: CameraPathWaypoint[];
  promptMotionText: string;
  updatedAt: string;
}

export interface CameraPathHistoryState {
  entries: Array<CameraPathDocument | null>;
  index: number;
}

const EPSILON = 1e-6;

export function clampNormalized(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function normalizedDistance(a: CameraPathPoint, b: CameraPathPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function appendCameraPathPointCapped(
  points: CameraPathPoint[],
  point: CameraPathPoint,
  maxPoints = 600
): CameraPathPoint[] {
  const limit = Math.max(2, Math.floor(maxPoints));
  if (points.length < limit) return [...points, point];
  return [...points.slice(0, limit - 1), point];
}

export function appendCameraPathHistory(
  history: Array<CameraPathDocument | null> | undefined,
  index: number,
  current: CameraPathDocument | null,
  next: CameraPathDocument | null,
  maxEntries = 20
): CameraPathHistoryState {
  const entries = history?.length ? history : [current];
  const safeIndex = Math.min(entries.length - 1, Math.max(0, Math.floor(index)));
  const nextEntries = [...entries.slice(0, safeIndex + 1), next].slice(-Math.max(2, maxEntries));
  return { entries: nextEntries, index: nextEntries.length - 1 };
}

function pointToSegmentDistance(
  point: CameraPathPoint,
  start: CameraPathPoint,
  end: CameraPathPoint
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return normalizedDistance(point, start);
  const t = Math.min(
    1,
    Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
  );
  return normalizedDistance(point, { x: start.x + t * dx, y: start.y + t * dy });
}

function simplifyRange(
  points: CameraPathPoint[],
  first: number,
  last: number,
  tolerance: number,
  keep: Set<number>
): void {
  let maxDistance = 0;
  let maxIndex = -1;
  for (let index = first + 1; index < last; index += 1) {
    const distance = pointToSegmentDistance(points[index], points[first], points[last]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }
  if (maxIndex < 0 || maxDistance <= tolerance) return;
  keep.add(maxIndex);
  simplifyRange(points, first, maxIndex, tolerance, keep);
  simplifyRange(points, maxIndex, last, tolerance, keep);
}

export function simplifyCameraPath(
  input: CameraPathPoint[],
  minDistance = 0.002,
  tolerance = 0.004
): CameraPathPoint[] {
  const deduplicated: CameraPathPoint[] = [];
  for (const point of input) {
    const normalized = { x: clampNormalized(point.x), y: clampNormalized(point.y) };
    const previous = deduplicated[deduplicated.length - 1];
    if (!previous || normalizedDistance(previous, normalized) >= minDistance) {
      deduplicated.push(normalized);
    }
  }
  if (deduplicated.length <= 2) return deduplicated;

  const keep = new Set<number>([0, deduplicated.length - 1]);
  simplifyRange(deduplicated, 0, deduplicated.length - 1, tolerance, keep);
  return [...keep]
    .sort((a, b) => a - b)
    .map((index) => deduplicated[index]);
}

function buildCumulativeLengths(points: CameraPathPoint[]): number[] {
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + normalizedDistance(points[index - 1], points[index]));
  }
  return cumulative;
}

export function createCameraWaypoints(
  points: CameraPathPoint[],
  durationSec: number,
  intermediateCount = 3
): CameraPathWaypoint[] {
  if (points.length < 2) return [];
  const safeDuration = Math.max(1, durationSec);
  const cumulative = buildCumulativeLengths(points);
  const total = cumulative[cumulative.length - 1];
  if (total <= EPSILON) return [];
  const count = Math.max(0, Math.min(12, Math.floor(intermediateCount)));
  const waypoints: CameraPathWaypoint[] = [];

  for (let waypointIndex = 0; waypointIndex < count + 2; waypointIndex += 1) {
    const progress = waypointIndex / (count + 1);
    const targetLength = total * progress;
    let pointIndex = cumulative.findIndex((length) => length >= targetLength);
    if (pointIndex < 0) pointIndex = points.length - 1;
    if (pointIndex > 0) {
      const previousDistance = Math.abs(cumulative[pointIndex - 1] - targetLength);
      const currentDistance = Math.abs(cumulative[pointIndex] - targetLength);
      if (previousDistance < currentDistance) pointIndex -= 1;
    }
    const kind: CameraWaypointKind =
      waypointIndex === 0 ? 'start' : waypointIndex === count + 1 ? 'end' : 'waypoint';
    const label =
      kind === 'start' ? '镜头起点' : kind === 'end' ? '镜头终点' : `镜头${waypointIndex}`;
    waypoints.push({
      id: kind === 'waypoint' ? `shot_${waypointIndex}` : kind,
      kind,
      label,
      pointIndex,
      progress,
      timeSec: Number((safeDuration * progress).toFixed(2)),
      ...points[pointIndex],
    });
  }
  return waypoints;
}

export function sampleCameraPathAtProgress(
  points: CameraPathPoint[],
  rawProgress: number
): CameraPathPoint | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0];
  const progress = clampNormalized(rawProgress);
  const cumulative = buildCumulativeLengths(points);
  const total = cumulative[cumulative.length - 1];
  if (total <= EPSILON) return points[0];
  const target = total * progress;
  let endIndex = cumulative.findIndex((length) => length >= target);
  if (endIndex <= 0) return points[0];
  if (endIndex < 0) return points[points.length - 1];
  const startIndex = endIndex - 1;
  const segmentLength = cumulative[endIndex] - cumulative[startIndex];
  const localProgress = segmentLength <= EPSILON ? 0 : (target - cumulative[startIndex]) / segmentLength;
  return {
    x: points[startIndex].x + (points[endIndex].x - points[startIndex].x) * localProgress,
    y: points[startIndex].y + (points[endIndex].y - points[startIndex].y) * localProgress,
  };
}

function horizontalDirection(deltaX: number): string {
  if (deltaX > 0.06) return '向右';
  if (deltaX < -0.06) return '向左';
  return '';
}

function verticalDirection(deltaY: number): string {
  if (deltaY > 0.06) return '向下';
  if (deltaY < -0.06) return '向上';
  return '';
}

function motionVerb(semantics: CameraPathSemantics): string {
  if (semantics === 'camera_translation') return '相机平滑移动';
  if (semantics === 'flythrough') return '相机沿空间路径穿行';
  return '镜头焦点平滑跟随';
}

export function buildSeedanceCameraPrompt(
  waypoints: CameraPathWaypoint[],
  semantics: CameraPathSemantics,
  mode: CameraPathMode
): string {
  if (waypoints.length < 2) return '';
  const segments = waypoints.slice(1).map((waypoint, index) => {
    const previous = waypoints[index];
    const directions = [
      horizontalDirection(waypoint.x - previous.x),
      verticalDirection(waypoint.y - previous.y),
    ].filter(Boolean);
    const direction = directions.length > 0 ? directions.join('并') : '沿路径前进';
    return `${previous.timeSec.toFixed(1)}s-${waypoint.timeSec.toFixed(1)}s：${motionVerb(semantics)}${direction}，从${previous.label}到达${waypoint.label}`;
  });
  const controlText =
    mode === 'strict'
      ? '严格复现所给镜头路径、关键点顺序与时间节奏。'
      : '按照所给镜头路径、关键点顺序与时间节奏连续运镜。';
  return [
    controlText,
    ...segments,
    '保持单一连续镜头；不得反向运动、跳过镜头点、改变镜头点顺序或增加切镜。',
    '路径线、箭头、数字和镜头标签仅为控制信息，不得出现在最终视频中。',
  ].join('\n');
}

export function buildCameraPathDocument(params: {
  points: CameraPathPoint[];
  durationSec: number;
  mode: CameraPathMode;
  semantics: CameraPathSemantics;
  intermediateCount?: number;
}): CameraPathDocument | null {
  const points = simplifyCameraPath(params.points);
  if (points.length < 2 || normalizedDistance(points[0], points[points.length - 1]) < 0.01) {
    return null;
  }
  const durationSec = Math.max(1, Math.min(15, Number(params.durationSec) || 5));
  const waypoints = createCameraWaypoints(points, durationSec, params.intermediateCount ?? 3);
  return {
    schemaVersion: 1,
    mode: params.mode,
    semantics: params.semantics,
    durationSec,
    points,
    waypoints,
    promptMotionText: buildSeedanceCameraPrompt(waypoints, params.semantics, params.mode),
    updatedAt: new Date().toISOString(),
  };
}

export function commitCameraWaypointMove(
  document: CameraPathDocument,
  waypointId: string,
  rawPoint: CameraPathPoint
): CameraPathDocument {
  const waypoint = document.waypoints.find((item) => item.id === waypointId);
  if (!waypoint) return document;
  const point = { x: clampNormalized(rawPoint.x), y: clampNormalized(rawPoint.y) };
  const points = document.points.map((item, index) =>
    index === waypoint.pointIndex ? point : item
  );
  const waypoints = document.waypoints.map((item) =>
    item.id === waypointId ? { ...item, ...point } : item
  );
  return {
    ...document,
    points,
    waypoints,
    promptMotionText: buildSeedanceCameraPrompt(waypoints, document.semantics, document.mode),
    updatedAt: new Date().toISOString(),
  };
}

export function cameraPathToSvgPoints(points: CameraPathPoint[]): string {
  return points.map((point) => `${point.x * 1000},${point.y * 1000}`).join(' ');
}
