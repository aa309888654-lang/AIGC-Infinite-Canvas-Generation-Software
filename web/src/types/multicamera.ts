export interface MultiCameraAngle {
  id: string;
  name: string;
  angle: number;
  color: string;
  sourceId: string;
  thumbnailUrl?: string;
  isActive: boolean;
  audioEnabled: boolean;
  volume: number;
}

export interface MultiCameraGroup {
  id: string;
  name: string;
  angles: MultiCameraAngle[];
  switchPoints: MultiCameraSwitchPoint[];
  currentAngleId: string;
  syncSource: 'audio' | 'timecode' | 'marker';
  syncOffset: number;
}

export interface MultiCameraSwitchPoint {
  id: string;
  time: number;
  fromAngleId: string;
  toAngleId: string;
  transition: 'cut' | 'fade' | 'dissolve';
  transitionDuration: number;
}

export interface MultiCameraProject {
  groups: MultiCameraGroup[];
  activeGroupId: string | null;
  isMultiCamMode: boolean;
}

export const MULTICAMERA_COLORS = [
  '#ff6b6b',
  '#4ecdc4',
  '#45b7d1',
  '#96ceb4',
  '#ffeaa7',
  '#dfe6e9',
  '#fab1a0',
  '#ff7675',
];

export function createMultiCameraGroup(name: string, angleCount: number = 2): MultiCameraGroup {
  const angles: MultiCameraAngle[] = [];
  const angleNames = ['机位 A', '机位 B', '机位 C', '机位 D', '机位 E', '机位 F', '机位 G', '机位 H'];
  
  for (let i = 0; i < angleCount; i++) {
    angles.push({
      id: `angle-${Date.now()}-${i}`,
      name: angleNames[i] || `机位 ${i + 1}`,
      angle: i,
      color: MULTICAMERA_COLORS[i % MULTICAMERA_COLORS.length],
      sourceId: `source-${i}`,
      isActive: i === 0,
      audioEnabled: true,
      volume: 1,
    });
  }
  
  return {
    id: `multicam-${Date.now()}`,
    name,
    angles,
    switchPoints: [],
    currentAngleId: angles[0]?.id || '',
    syncSource: 'audio',
    syncOffset: 0,
  };
}

export function createSwitchPoint(
  time: number,
  toAngleId: string,
  transition: MultiCameraSwitchPoint['transition'] = 'cut'
): MultiCameraSwitchPoint {
  return {
    id: `switch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    time,
    fromAngleId: '',
    toAngleId,
    transition,
    transitionDuration: transition === 'cut' ? 0 : 0.5,
  };
}

export function getActiveAngle(group: MultiCameraGroup, time: number): MultiCameraAngle | null {
  const sortedSwitches = [...group.switchPoints].sort((a, b) => a.time - b.time);
  
  let activeAngleId = group.angles[0]?.id || null;
  
  for (const switchPoint of sortedSwitches) {
    if (switchPoint.time <= time) {
      activeAngleId = switchPoint.toAngleId;
    } else {
      break;
    }
  }
  
  return group.angles.find(a => a.id === activeAngleId) || null;
}

export function generateMultiCamPreview(
  group: MultiCameraGroup,
  angleCount: number = 4
): string[] {
  const previews: string[] = [];
  
  for (let i = 0; i < Math.min(angleCount, group.angles.length); i++) {
    previews.push(group.angles[i]?.thumbnailUrl || '');
  }
  
  return previews;
}
