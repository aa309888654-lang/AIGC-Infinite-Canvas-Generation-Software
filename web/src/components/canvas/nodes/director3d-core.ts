import * as THREE from 'three';

export type PanoramaSceneMode = 'scene' | 'panorama360';
export type Scene3DTool = 'navigate' | 'move' | 'rotate' | 'scale';
export type EnvironmentMode = 'day' | 'night';
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type KeyframeProperty = 'position' | 'rotation' | 'scale' | 'view';
export type CaptureAspect = 'free' | '16:9' | '9:16' | '4:3' | '2.35:1' | '1:1';
export type CompositionGuide = 'off' | 'thirds' | 'safe' | 'center';
export type LightingPreset = 'studio' | 'cinematic' | 'soft' | 'silhouette';
export type RenderQuality = 'auto' | 'performance' | 'quality';
export type MannequinGender = 'male' | 'female';
export type MannequinColorKey = 'gray' | 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'cyan' | 'black' | 'white';

export interface Camera3D {
  id: string;
  name: string;
  yaw: number;
  pitch: number;
  distance: number;
  focalLength: number;
  position: { x: number; y: number; z: number };
}

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'distributeH' | 'distributeV' | 'groundSnap';

export interface SceneObject3D {
  id: string;
  type: 'mannequin' | 'cube' | 'model';
  name: string;
  gender?: MannequinGender;
  colorKey: MannequinColorKey;
  modelUrl?: string;
  modelAssetId?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  visible?: boolean;
  locked?: boolean;
}

export interface MinimapObject {
  id: string;
  name: string;
  type: 'mannequin' | 'cube' | 'model';
  x2d: number;
  z2d: number;
}

export interface MinimapData {
  objects: MinimapObject[];
  cameraX: number;
  cameraZ: number;
  cameraYaw: number;
  worldExtent: number;
}

export interface SceneView {
  target: { x: number; y: number; z: number };
  orbitYaw: number;
  orbitPitch: number;
  orbitDistance: number;
  focalLength: number;
}

export interface PanoramaView {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface CameraPreset {
  id: string;
  name: string;
  slot: number;
  view: SceneView;
  createdAt: number;
}

export interface SceneHistoryEntry {
  id: string;
  timestamp: number;
  description: string;
  objects: SceneObject3D[];
  view: SceneView;
}

export interface Keyframe {
  id: string;
  time: number;
  value: number[];
  easing: EasingType;
}

export interface KeyframeTrack {
  id: string;
  objectId: string | 'camera';
  property: KeyframeProperty;
  keyframes: Keyframe[];
}

export interface AnimationState {
  tracks: KeyframeTrack[];
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  fps: number;
}

export interface Scene3DExport {
  version: string;
  name: string;
  objects: SceneObject3D[];
  cameras: Camera3D[];
  cameraPresets: CameraPreset[];
  view: SceneView;
  environment: EnvironmentMode;
  compositionGuide?: CompositionGuide;
  lightingPreset?: LightingPreset;
  exposure?: number;
  renderQuality?: RenderQuality;
  createdAt: number;
}

export interface SceneDiagnostics {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  pixelRatio: number;
  renderQuality: RenderQuality;
  renderMode: 'on-demand' | 'continuous';
}

export interface Director3DParams {
  mode: PanoramaSceneMode;
  tool: Scene3DTool;
  environment: EnvironmentMode;
  view: SceneView;
  objects: SceneObject3D[];
  cameras: Camera3D[];
  cameraPresets: CameraPreset[];
  captureAspect: CaptureAspect;
  compositionGuide: CompositionGuide;
  lightingPreset: LightingPreset;
  exposure: number;
  renderQuality: RenderQuality;
  showDiagnostics: boolean;
  showGrid: boolean;
  isEditing: boolean;
  isCollapsed: boolean;
  isFullscreen: boolean;
  panoramaImageUrl: string;
  panoramaAssetId?: string;
  panoramaView: PanoramaView;
  autoRotate: boolean;
  autoRotateSpeed: number;
  selectedObjectId: string | null;
  selectedObjectIds: string[];
  environmentHDRUrl?: string;
  environmentHDRAssetId?: string;
  environmentHDRIntensity?: number;
  extractedAngleAssetIds?: Record<string, string>;
  extractedAngleUrls?: Record<string, string>;
  prompt?: string;
  output?: string;
  viewData?: string;
  animation?: AnimationState;
}

export const PANORAMA_SCENE_CAMERA_LIMIT = 10;

export const PANORAMA_SCENE_DEFAULT_SIZE = { width: 1024, height: 576 };
export const PANORAMA_SCENE_COLLAPSED_MAX_SIZE = 288;

export const CAMERA_CONSTRAINTS = {
  scene: {
    orbitPitch: { min: -1.35, max: 1.35 },
    orbitDistance: { min: 0.05, max: 120 },
    focalLength: { min: 16, max: 135, default: 50 },
    sensorWidthMm: 36,
  },
  panorama: {
    pitch: { min: (-85 * Math.PI) / 180, max: (85 * Math.PI) / 180, default: 0 },
    fov: { min: 35, max: 80, default: 55 },
  },
};

export const RENDER_CONSTRAINTS = {
  exposure: { min: 0.4, max: 2.2, default: 1 },
  bvhTriangleThreshold: 500,
};

export const LIGHTING_PRESETS: Record<LightingPreset, {
  label: string;
  ambient: number;
  key: number;
  fill: number;
  rim: number;
  keyColor: number;
  fillColor: number;
  rimColor: number;
}> = {
  studio: {
    label: '棚拍', ambient: 0.42, key: 1.2, fill: 0.55, rim: 0.75,
    keyColor: 0xffffff, fillColor: 0xd9e7ff, rimColor: 0xffffff,
  },
  cinematic: {
    label: '电影', ambient: 0.22, key: 1.55, fill: 0.28, rim: 1.25,
    keyColor: 0xffd6b0, fillColor: 0x8fb8ff, rimColor: 0xb9d4ff,
  },
  soft: {
    label: '柔光', ambient: 0.68, key: 0.72, fill: 0.48, rim: 0.22,
    keyColor: 0xfff4df, fillColor: 0xe7efff, rimColor: 0xffffff,
  },
  silhouette: {
    label: '轮廓', ambient: 0.08, key: 0.2, fill: 0.06, rim: 2.15,
    keyColor: 0xffd4a8, fillColor: 0x7399ff, rimColor: 0xaac8ff,
  },
};

export const DEFAULT_SCENE_VIEW: SceneView = {
  target: { x: 0, y: 1.2, z: 0 },
  orbitYaw: Math.PI / 4,
  orbitPitch: Math.PI / 4,
  orbitDistance: 9,
  focalLength: 50,
};

export const DEFAULT_PANORAMA_VIEW: PanoramaView = {
  yaw: 0,
  pitch: 0,
  fov: 55,
};

export const MANNEQUIN_COLORS: Record<MannequinColorKey, { name: string; hex: string; cssVar: string }> = {
  gray: { name: '灰色', hex: '#6B7280', cssVar: '--panorama-scene-swatch-gray' },
  red: { name: '红色', hex: '#EF4444', cssVar: '--panorama-scene-swatch-red' },
  blue: { name: '蓝色', hex: '#3B82F6', cssVar: '--panorama-scene-swatch-blue' },
  green: { name: '绿色', hex: '#22C55E', cssVar: '--panorama-scene-swatch-green' },
  yellow: { name: '黄色', hex: '#EAB308', cssVar: '--panorama-scene-swatch-yellow' },
  purple: { name: '紫色', hex: '#A855F7', cssVar: '--panorama-scene-swatch-purple' },
  cyan: { name: '青色', hex: '#06B6D4', cssVar: '--panorama-scene-swatch-cyan' },
  black: { name: '黑色', hex: '#1F2937', cssVar: '--panorama-scene-swatch-black' },
  white: { name: '白色', hex: '#F9FAFB', cssVar: '--panorama-scene-swatch-white' },
};

export const MANNEQUIN_TARGET_HEIGHT = 1.92;
export const MALE_UPPER_ARM_DROP = 1.34;
export const FEMALE_UPPER_ARM_DROP = 1.38;

export const GRID_MINOR_STEP = 1;
export const GRID_MAJOR_STEP = 10;
export const GRID_BASE_SPAN = 220;

export const SELECTION_RING = {
  outer: { innerRadius: 0.62, outerRadius: 0.72, segments: 40, opacity: 0.12, yOffset: 0.016 },
  middle: { radius: 0.62, segments: 40, opacity: 0.38, yOffset: 0.02 },
  inner: { innerRadius: 0.28, outerRadius: 0.38, segments: 40, opacity: 0.98, yOffset: 0.024 },
  color: 0x3b82f6,
};

export const GIZMO = {
  axisLength: 1.35,
  scaleLength: 1.22,
  rotateRadius: 1.22 * 0.5,
  planeOffset: 0.38,
  planeSize: 0.42,
  moveShaftLength: 1.2,
  moveHeadLength: 0.18,
  lineWidth: 2.5,
  headRadius: 0.1,
  colors: {
    x: 0xef4444,
    y: 0x22c55e,
    z: 0x3b82f6,
    xy: 0x888800,
    yz: 0x008888,
    xz: 0x880088,
    rotate: 0x3b82f6,
    scale: 0xf59e0b,
  },
};

export type GizmoAxis = 'x' | 'y' | 'z' | 'xy' | 'yz' | 'xz';

export interface GizmoDragState {
  axis: GizmoAxis;
  startMouseX: number;
  startMouseY: number;
  startPosition: THREE.Vector3;
  startScale: THREE.Vector3;
  startRotation: THREE.Euler;
  startObjectMatrix: THREE.Matrix4;
  startCameraPosition: THREE.Vector3;
  screenAxis: THREE.Vector3;
  screenPerp: THREE.Vector3;
  screenCenter: THREE.Vector3;
}

export interface ObjectTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

export const VIEW_DAMPING = {
  timeConstantMs: 120,
  windowMs: 220,
  maxDtMs: 64,
  settleEpsilon: 0.0005,
};

export const CAPTURE_ASPECTS: { key: CaptureAspect; label: string; widthRatio: number; heightRatio: number }[] = [
  { key: 'free', label: '自由', widthRatio: 1, heightRatio: 1 },
  { key: '16:9', label: '16:9', widthRatio: 16, heightRatio: 9 },
  { key: '9:16', label: '9:16', widthRatio: 9, heightRatio: 16 },
  { key: '4:3', label: '4:3', widthRatio: 4, heightRatio: 3 },
  { key: '2.35:1', label: '2.35:1', widthRatio: 2.35, heightRatio: 1 },
  { key: '1:1', label: '1:1', widthRatio: 1, heightRatio: 1 },
];

export const VIEWPORT_OVERLAY = {
  day: {
    overlay: 'radial-gradient(circle at 50% 66%, rgba(255,255,255,0.2), transparent 40%), linear-gradient(180deg, #f2f5fa 0%, #e4e9f0 22%, #d5dbe4 46%, #c4cad3 72%, #b6bcc6 100%)',
    shadow: 'inset 0 0 0 1px rgba(255,255,255,0.36)',
  },
  night: {
    overlay: 'radial-gradient(circle at 50% 68%, rgba(255,255,255,0.09), transparent 38%), linear-gradient(180deg, #686e77 0%, #5a5f68 22%, #4a4f57 46%, #3a3e45 72%, #303238 100%)',
    shadow: 'none',
  },
};

export const TOOLBAR_THEME = {
  day: {
    fg: 'rgba(0,0,0,0.8)',
    weakFg: 'rgba(0,0,0,0.5)',
    border: 'rgba(0,0,0,0.2)',
    bg: 'rgba(255,255,255,0.62)',
    menuBg: 'rgba(255,255,255,0.62)',
    shadow: '0 8px 28px rgba(20,20,24,0.16)',
  },
  night: {
    fg: 'rgba(255,255,255,0.9)',
    weakFg: 'rgba(255,255,255,0.6)',
    border: 'rgba(255,255,255,0.08)',
    bg: 'rgba(20,24,34,0.6)',
    menuBg: 'rgba(20,24,34,0.6)',
    shadow: '0 10px 28px rgba(0,0,0,0.35)',
  },
  editMode: {
    fg: 'rgba(255,255,255,0.9)',
    weakFg: 'rgba(255,255,255,0.6)',
    border: 'rgba(255,255,255,0.08)',
    bg: 'rgba(18,22,30,0.44)',
    menuBg: 'rgba(20,24,34,0.6)',
    shadow: '0 10px 28px rgba(0,0,0,0.35)',
  },
};

export const DEFAULT_DIRECTOR3D_PARAMS: Director3DParams = {
  mode: 'scene',
  tool: 'navigate',
  environment: 'day',
  view: { ...DEFAULT_SCENE_VIEW },
  objects: [],
  cameras: [],
  cameraPresets: [],
  captureAspect: 'free',
  compositionGuide: 'thirds',
  lightingPreset: 'studio',
  exposure: RENDER_CONSTRAINTS.exposure.default,
  renderQuality: 'auto',
  showDiagnostics: false,
  showGrid: true,
  isEditing: false,
  isCollapsed: false,
  isFullscreen: false,
  panoramaImageUrl: '',
  panoramaView: { ...DEFAULT_PANORAMA_VIEW },
  autoRotate: false,
  autoRotateSpeed: 0.001,
  selectedObjectId: null,
  selectedObjectIds: [],
};

export function clampExposure(exposure: number): number {
  return Math.max(RENDER_CONSTRAINTS.exposure.min, Math.min(RENDER_CONSTRAINTS.exposure.max, exposure));
}

export function resolveRenderPixelRatio(
  quality: RenderQuality,
  devicePixelRatio: number,
  deviceMemoryGb?: number,
): number {
  const dpr = Math.max(0.75, devicePixelRatio || 1);
  if (quality === 'performance') return Math.min(dpr, 1);
  if (quality === 'quality') return Math.min(dpr, 2);
  const memoryLimited = typeof deviceMemoryGb === 'number' && deviceMemoryGb <= 4;
  return Math.min(dpr, memoryLimited ? 1 : 1.5);
}

export function focalLengthToFov(focalLengthMm: number, sensorWidthMm = 36): number {
  return 2 * Math.atan(sensorWidthMm / (2 * focalLengthMm)) * (180 / Math.PI);
}

export function fovToFocalLength(fovDeg: number, sensorWidthMm = 36): number {
  return (sensorWidthMm / 2) / Math.tan((fovDeg * Math.PI) / 360);
}

export function clampSceneFocalLength(fl: number): number {
  return Math.max(CAMERA_CONSTRAINTS.scene.focalLength.min, Math.min(CAMERA_CONSTRAINTS.scene.focalLength.max, fl));
}

export function clampSceneOrbitPitch(pitch: number): number {
  return Math.max(CAMERA_CONSTRAINTS.scene.orbitPitch.min, Math.min(CAMERA_CONSTRAINTS.scene.orbitPitch.max, pitch));
}

export function clampSceneOrbitDistance(dist: number): number {
  return Math.max(CAMERA_CONSTRAINTS.scene.orbitDistance.min, Math.min(CAMERA_CONSTRAINTS.scene.orbitDistance.max, dist));
}

export function clampPanoramaPitch(pitch: number): number {
  return Math.max(CAMERA_CONSTRAINTS.panorama.pitch.min, Math.min(CAMERA_CONSTRAINTS.panorama.pitch.max, pitch));
}

export function clampPanoramaFov(fov: number): number {
  return Math.max(CAMERA_CONSTRAINTS.panorama.fov.min, Math.min(CAMERA_CONSTRAINTS.panorama.fov.max, fov));
}

export function createDefaultCamera(index: number): Camera3D {
  return {
    id: `cam-${Date.now()}-${index}`,
    name: `机位 ${index + 1}`,
    yaw: 0,
    pitch: 0,
    distance: 9,
    focalLength: 50,
    position: { x: 0, y: 1.6, z: 9 },
  };
}

export function createMannequin(gender: MannequinGender, colorKey: MannequinColorKey, index: number = 0): SceneObject3D {
  const offset = index * 1.5;
  return {
    id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'mannequin',
    name: `${gender === 'male' ? '男' : '女'}人偶${index > 0 ? ` ${index + 1}` : ''}`,
    gender,
    colorKey,
    position: { x: offset, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

export function createCube(index: number = 0): SceneObject3D {
  const offset = index * 1.5;
  return {
    id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'cube',
    name: `方块${index > 0 ? ` ${index + 1}` : ''}`,
    colorKey: 'blue',
    position: { x: offset, y: 0.5, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

export function createModelObject(modelUrl: string, name: string, index: number = 0): SceneObject3D {
  const offset = index * 1.5;
  return {
    id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'model',
    name: name || `模型${index > 0 ? ` ${index + 1}` : ''}`,
    modelUrl,
    colorKey: 'white',
    position: { x: offset, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

export function yawToDirection(yaw: number): string {
  const deg = ((yaw * 180) / Math.PI + 360) % 360;
  if (deg < 22.5 || deg >= 337.5) return 'front view';
  if (deg < 67.5) return 'right-front view';
  if (deg < 112.5) return 'right side view';
  if (deg < 157.5) return 'right-rear view';
  if (deg < 202.5) return 'rear view';
  if (deg < 247.5) return 'left-rear view';
  if (deg < 292.5) return 'left side view';
  return 'left-front view';
}

export function pitchToAngle(pitch: number): string {
  const deg = (pitch * 180) / Math.PI;
  if (deg < -20) return 'low-angle shot';
  if (deg < 20) return 'eye-level shot';
  if (deg < 50) return 'high-angle shot';
  return 'top-down shot';
}

export function focalLengthToShot(focalLength: number): string {
  if (focalLength <= 24) return 'full shot';
  if (focalLength <= 50) return 'medium shot';
  if (focalLength <= 85) return 'medium close-up';
  return 'close-up';
}

export function cameraToPrompt(view: SceneView): string {
  const direction = yawToDirection(view.orbitYaw);
  const angle = pitchToAngle(view.orbitPitch);
  const shot = focalLengthToShot(view.focalLength);
  return `${shot}, ${angle}, ${direction}`;
}

export function panoramaToPrompt(pv: PanoramaView): string {
  const yawDeg = ((pv.yaw * 180) / Math.PI).toFixed(0);
  const pitchDeg = ((pv.pitch * 180) / Math.PI).toFixed(0);
  return `360 degree panoramic view, immersive, equirectangular projection, yaw ${yawDeg}°, pitch ${pitchDeg}°, field of view ${pv.fov.toFixed(0)}°`;
}

/** 全景多角度提取预设 */
export interface PanoramaExtractAngle {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
  fov: number;
}

export const PANORAMA_EXTRACT_ANGLES: PanoramaExtractAngle[] = [
  { id: 'front', label: '正面', yaw: 0, pitch: 0, fov: 60 },
  { id: 'right', label: '右侧', yaw: Math.PI / 2, pitch: 0, fov: 60 },
  { id: 'back', label: '背面', yaw: Math.PI, pitch: 0, fov: 60 },
  { id: 'left', label: '左侧', yaw: -Math.PI / 2, pitch: 0, fov: 60 },
  { id: 'top', label: '俯视', yaw: 0, pitch: Math.PI / 3, fov: 65 },
  { id: 'bottom', label: '仰视', yaw: 0, pitch: -Math.PI / 3, fov: 65 },
  { id: 'front-right', label: '右前', yaw: Math.PI / 4, pitch: 0, fov: 55 },
  { id: 'front-left', label: '左前', yaw: -Math.PI / 4, pitch: 0, fov: 55 },
];

export function resolveSceneCameraPose(view: SceneView): { position: THREE.Vector3; target: THREE.Vector3; fov: number } {
  const { target, orbitYaw, orbitPitch, orbitDistance, focalLength } = view;
  const cp = Math.cos(orbitPitch);
  const sp = Math.sin(orbitPitch);
  const cy = Math.cos(orbitYaw);
  const sy = Math.sin(orbitYaw);
  const camX = target.x + orbitDistance * cp * sy;
  const camY = target.y + orbitDistance * sp;
  const camZ = target.z + orbitDistance * cp * cy;
  return {
    position: new THREE.Vector3(camX, camY, camZ),
    target: new THREE.Vector3(target.x, target.y, target.z),
    fov: focalLengthToFov(focalLength),
  };
}

export function dampAngle(current: number, target: number, dt: number, timeConstant: number = VIEW_DAMPING.timeConstantMs): number {
  const diff = target - current;
  if (Math.abs(diff) < VIEW_DAMPING.settleEpsilon) return target;
  const factor = 1 - Math.exp(-dt / timeConstant);
  return current + diff * factor;
}

export function dampScalar(current: number, target: number, dt: number, timeConstant: number = VIEW_DAMPING.timeConstantMs): number {
  const diff = target - current;
  if (Math.abs(diff) < VIEW_DAMPING.settleEpsilon) return target;
  const factor = 1 - Math.exp(-dt / timeConstant);
  return current + diff * factor;
}

export function mannequinColorHex(key: MannequinColorKey): string {
  return MANNEQUIN_COLORS[key]?.hex ?? '#3B82F6';
}
