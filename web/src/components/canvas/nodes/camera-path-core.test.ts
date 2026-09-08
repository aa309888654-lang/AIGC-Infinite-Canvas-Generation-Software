import {
  appendCameraPathHistory,
  appendCameraPathPointCapped,
  buildCameraPathDocument,
  buildSeedanceCameraPrompt,
  commitCameraWaypointMove,
  createCameraWaypoints,
  sampleCameraPathAtProgress,
  simplifyCameraPath,
} from './camera-path-core';

describe('camera path core', () => {
  it('normalizes and simplifies noisy path points while preserving endpoints', () => {
    const points = simplifyCameraPath([
      { x: -1, y: 0.2 },
      { x: 0.001, y: 0.201 },
      { x: 0.5, y: 0.5 },
      { x: 0.501, y: 0.501 },
      { x: 2, y: 0.8 },
    ]);

    expect(points[0]).toEqual({ x: 0, y: 0.2 });
    expect(points[points.length - 1]).toEqual({ x: 1, y: 0.8 });
    expect(points.length).toBeLessThanOrEqual(3);
  });

  it('creates start, three numbered shots, and end in time order', () => {
    const waypoints = createCameraWaypoints(
      [
        { x: 0.1, y: 0.8 },
        { x: 0.3, y: 0.7 },
        { x: 0.5, y: 0.5 },
        { x: 0.7, y: 0.3 },
        { x: 0.9, y: 0.1 },
      ],
      8,
      3
    );

    expect(waypoints.map((item) => item.label)).toEqual([
      '镜头起点',
      '镜头1',
      '镜头2',
      '镜头3',
      '镜头终点',
    ]);
    expect(waypoints.map((item) => item.timeSec)).toEqual([0, 2, 4, 6, 8]);
    expect(waypoints.map((item) => item.progress)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('samples a polyline by arc length rather than point index', () => {
    const point = sampleCameraPathAtProgress(
      [
        { x: 0, y: 0 },
        { x: 0.8, y: 0 },
        { x: 0.8, y: 0.2 },
      ],
      0.5
    );

    expect(point?.x).toBeCloseTo(0.5, 5);
    expect(point?.y).toBeCloseTo(0, 5);
  });

  it('builds a serializable Seedance path document with locked shot order', () => {
    const document = buildCameraPathDocument({
      points: [
        { x: 0.8, y: 0.8 },
        { x: 0.2, y: 0.7 },
        { x: 0.55, y: 0.45 },
        { x: 0.7, y: 0.15 },
      ],
      durationSec: 8,
      mode: 'strict',
      semantics: 'camera_translation',
    });

    expect(document).not.toBeNull();
    expect(document?.waypoints).toHaveLength(5);
    expect(document?.promptMotionText).toContain('严格复现');
    expect(document?.promptMotionText).toContain('镜头1');
    expect(document?.promptMotionText).toContain('镜头3');
    expect(document?.promptMotionText).toContain('不得反向运动');
    expect(() => JSON.stringify(document)).not.toThrow();
  });

  it('rejects a path that is too short', () => {
    expect(
      buildCameraPathDocument({
        points: [
          { x: 0.5, y: 0.5 },
          { x: 0.505, y: 0.505 },
        ],
        durationSec: 5,
        mode: 'smart',
        semantics: 'screen_tracking',
      })
    ).toBeNull();
  });

  it('describes screen direction for each segment', () => {
    const prompt = buildSeedanceCameraPrompt(
      createCameraWaypoints(
        [
          { x: 0.8, y: 0.8 },
          { x: 0.2, y: 0.2 },
        ],
        4,
        0
      ),
      'screen_tracking',
      'smart'
    );

    expect(prompt).toContain('向左并向上');
    expect(prompt).toContain('单一连续镜头');
  });

  it('caps dense pointer samples while preserving the latest endpoint', () => {
    let points = Array.from({ length: 5 }, (_, index) => ({ x: index / 10, y: 0.2 }));
    points = appendCameraPathPointCapped(points, { x: 0.95, y: 0.8 }, 5);
    expect(points).toHaveLength(5);
    expect(points[4]).toEqual({ x: 0.95, y: 0.8 });
  });

  it('keeps the dragged waypoint at the committed pointer position', () => {
    const document = buildCameraPathDocument({
      points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }, { x: 0.5, y: 0.5 }, { x: 0.7, y: 0.7 }, { x: 0.9, y: 0.9 }],
      durationSec: 5,
      mode: 'smart',
      semantics: 'screen_tracking',
    });
    expect(document).not.toBeNull();
    const moved = commitCameraWaypointMove(document!, 'shot_2', { x: 0.8, y: 0.2 });
    expect(moved.waypoints.find((item) => item.id === 'shot_2')).toEqual(
      expect.objectContaining({ x: 0.8, y: 0.2 })
    );
    expect(moved.points[moved.waypoints.find((item) => item.id === 'shot_2')!.pointIndex]).toEqual({ x: 0.8, y: 0.2 });
  });

  it('persists undo history, truncates redo branches, and enforces its limit', () => {
    const first = buildCameraPathDocument({ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], durationSec: 5, mode: 'smart', semantics: 'screen_tracking' })!;
    const second = commitCameraWaypointMove(first, 'end', { x: 0.8, y: 1 });
    const branched = appendCameraPathHistory([null, first, second], 1, first, null, 3);
    expect(branched.entries).toEqual([null, first, null]);
    expect(branched.index).toBe(2);
  });
});
