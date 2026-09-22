import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import {
  type SceneView,
  type PanoramaView,
  type SceneObject3D,
  type Scene3DTool,
  type MannequinColorKey,
  type EnvironmentMode,
  type CameraPreset,
  type GizmoAxis,
  type GizmoDragState,
  type ObjectTransform,
  type EasingType,
  type MinimapData,
  type AlignMode,
  type LightingPreset,
  type RenderQuality,
  type SceneDiagnostics,
  MANNEQUIN_TARGET_HEIGHT,
  GRID_MINOR_STEP,
  GRID_MAJOR_STEP,
  GRID_BASE_SPAN,
  SELECTION_RING,
  GIZMO,
  VIEW_DAMPING,
  LIGHTING_PRESETS,
  RENDER_CONSTRAINTS,
  focalLengthToFov,
  clampExposure,
  resolveRenderPixelRatio,
  resolveSceneCameraPose,
  mannequinColorHex,
  dampAngle,
  dampScalar,
} from './director3d-core';

const THEME_COLORS = {
  day: {
    background: 0xd5dbe3,
    ground: 0xc6cbd3,
    fog: 0xcfd6de,
    grid: 0x9ba3ad,
    gridMajor: 0x7f8894,
    ambient: 0xffffff,
    ambientIntensity: 0.7,
    directional: 0xffffff,
    directionalIntensity: 1.0,
  },
  night: {
    background: 0x2f3136,
    ground: 0x3a3a3f,
    fog: 0x5b6068,
    grid: 0x4a4d55,
    gridMajor: 0x6a6f7a,
    ambient: 0x8899bb,
    ambientIntensity: 0.35,
    directional: 0xaabbdd,
    directionalIntensity: 0.5,
  },
};

type ModelCache = { male: THREE.Group | null; female: THREE.Group | null };

interface DampingState {
  currentView: SceneView;
  targetView: SceneView;
  lastTime: number;
  isAnimating: boolean;
}

export class Scene3DBridge {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private gridGroup: THREE.Group;
  private objectsGroup: THREE.Group;
  private panoramaSphere: THREE.Mesh | null = null;
  private panoramaTexture: THREE.Texture | null = null;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private modelCache: ModelCache = { male: null, female: null };
  private object3DMap = new Map<string, THREE.Object3D>();
  private selectionGroup: THREE.Group | null = null;
  private gizmoGroup: THREE.Group | null = null;
  private animationId: number = 0;
  private container: HTMLElement;
  private env: EnvironmentMode = 'day';
  private mode: 'scene' | 'panorama360' = 'scene';
  private autoRotateSpeed = 0.001;
  private isAutoRotating = false;
  private currentPanoramaView: PanoramaView = { yaw: 0, pitch: 0, fov: 55 };
  private lastPanoramaViewEmit = 0;
  private onPanoramaViewChange: ((view: PanoramaView) => void) | null = null;
  private modelLoadPromise: Promise<void>;
  private selectedObjectId: string | null = null;
  private currentTool: Scene3DTool = 'navigate';
  private dampingState: DampingState | null = null;
  private raycaster = new THREE.Raycaster();
  private gizmoDragState: GizmoDragState | null = null;
  private objectDragState: { startMouseX: number; startMouseY: number; startPosition: THREE.Vector3; startRotation: THREE.Euler; startScale: THREE.Vector3; dragPlane: THREE.Plane } | null = null;
  private onTransformChange: ((objectId: string, transform: ObjectTransform) => void) | null = null;
  private environmentMap: THREE.Texture | null = null;
  private environmentIntensity: number = 1;
  private pmremGenerator: THREE.PMREMGenerator | null = null;
  private lightingPreset: LightingPreset = 'studio';
  private renderQuality: RenderQuality = 'auto';
  private needsRender = true;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth || 1024;
    const h = container.clientHeight || 576;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.resolvePixelRatio('auto'));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.classList.add('nodrag', 'nowheel');
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.05, 500);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.directionalLight.position.set(5, 10, 7);
    this.directionalLight.castShadow = false;
    this.scene.add(this.directionalLight);

    this.fillLight = new THREE.DirectionalLight(0xd9e7ff, 0.55);
    this.fillLight.position.set(-5, 4, 3);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xffffff, 0.75);
    this.rimLight.position.set(0, 6, -7);
    this.scene.add(this.rimLight);

    this.gridGroup = new THREE.Group();
    this.objectsGroup = new THREE.Group();
    this.scene.add(this.gridGroup);
    this.scene.add(this.objectsGroup);

    this.applyEnvironment('day');
    this.buildGrid();
    this.modelLoadPromise = this.preloadModelCache();

    this.startRenderLoop();
  }

  private createGLTFLoader(): GLTFLoader {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader;
  }

  private resolvePixelRatio(quality: RenderQuality): number {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return resolveRenderPixelRatio(quality, window.devicePixelRatio, memory);
  }

  private invalidate(frames = 1) {
    if (this.disposed) return;
    this.needsRender = true;
    if (frames > 1) {
      requestAnimationFrame(() => this.invalidate(frames - 1));
    }
  }

  private async preloadModelCache() {
    const loader = this.createGLTFLoader();
    const basePath = '/assets/characters/quaternius/universal-base/';
    const loadModel = async (gender: 'male' | 'female', fileName: string) => {
      try {
        const gltf = await loader.loadAsync(basePath + fileName);
        this.modelCache[gender] = gltf.scene;
      } catch (error) {
        console.warn(`[Scene3DBridge] ${fileName} 加载失败，已使用内置低模角色降级:`, error);
        this.modelCache[gender] = this.createFallbackMannequin(gender);
      }
    };

    await Promise.all([
      loadModel('male', 'Superhero_Male_FullBody.gltf'),
      loadModel('female', 'Superhero_Female_FullBody.gltf'),
    ]);
  }

  private createFallbackMannequin(gender: 'male' | 'female'): THREE.Group {
    const group = new THREE.Group();
    const bodyH = gender === 'male' ? 0.9 : 0.82;
    const bodyW = gender === 'male' ? 0.38 : 0.3;
    const bodyD = gender === 'male' ? 0.22 : 0.18;
    const headR = 0.14;
    const legH = 0.88;
    const legW = 0.12;

    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), mat);
    body.position.y = legH + bodyH / 2;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), mat);
    head.position.y = legH + bodyH + headR + 0.02;
    group.add(head);

    const legGeo = new THREE.BoxGeometry(legW, legH, legW);
    const leftLeg = new THREE.Mesh(legGeo, mat);
    leftLeg.position.set(-bodyW / 4, legH / 2, 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, mat);
    rightLeg.position.set(bodyW / 4, legH / 2, 0);
    group.add(rightLeg);

    const armH = 0.7;
    const armW = 0.09;
    const armGeo = new THREE.BoxGeometry(armW, armH, armW);
    const leftArm = new THREE.Mesh(armGeo, mat);
    leftArm.position.set(-bodyW / 2 - armW / 2, legH + bodyH * 0.6, 0);
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, mat);
    rightArm.position.set(bodyW / 2 + armW / 2, legH + bodyH * 0.6, 0);
    group.add(rightArm);

    const totalH = legH + bodyH + headR * 2 + 0.02;
    const scale = MANNEQUIN_TARGET_HEIGHT / totalH;
    group.scale.setScalar(scale);
    group.position.y = 0;

    return group;
  }

  private buildGrid() {
    while (this.gridGroup.children.length) {
      const child = this.gridGroup.children[0];
      this.gridGroup.remove(child);
      this.disposeObject3DResources(child);
    }
    const theme = THEME_COLORS[this.env];
    const half = GRID_BASE_SPAN / 2;

    const minorMat = new THREE.LineBasicMaterial({ color: theme.grid, transparent: true, opacity: 0.3 });
    const majorMat = new THREE.LineBasicMaterial({ color: theme.gridMajor, transparent: true, opacity: 0.5 });
    const minorVertices: number[] = [];
    const majorVertices: number[] = [];

    for (let i = -half; i <= half; i += GRID_MINOR_STEP) {
      const isMajor = i % GRID_MAJOR_STEP === 0;
      const vertices = isMajor ? majorVertices : minorVertices;
      vertices.push(i, 0, -half, i, 0, half, -half, 0, i, half, 0, i);
    }

    const minorGeometry = new THREE.BufferGeometry();
    minorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(minorVertices, 3));
    this.gridGroup.add(new THREE.LineSegments(minorGeometry, minorMat));

    const majorGeometry = new THREE.BufferGeometry();
    majorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(majorVertices, 3));
    this.gridGroup.add(new THREE.LineSegments(majorGeometry, majorMat));
  }

  applyEnvironment(env: EnvironmentMode) {
    this.env = env;
    const theme = THEME_COLORS[env];
    this.scene.background = new THREE.Color(theme.background);
    this.scene.fog = new THREE.Fog(theme.fog, 30, 120);
    this.applyLightingPreset();
    this.buildGrid();
    this.invalidate();
  }

  setLightingPreset(preset: LightingPreset) {
    this.lightingPreset = preset;
    this.applyLightingPreset();
    this.invalidate(2);
  }

  private applyLightingPreset() {
    const preset = LIGHTING_PRESETS[this.lightingPreset];
    const environmentScale = this.env === 'night' ? 0.66 : 1;
    this.ambientLight.color.set(this.env === 'night' ? 0x8799bd : 0xffffff);
    this.ambientLight.intensity = preset.ambient * environmentScale;
    this.directionalLight.color.set(preset.keyColor);
    this.directionalLight.intensity = preset.key * environmentScale;
    this.fillLight.color.set(preset.fillColor);
    this.fillLight.intensity = preset.fill * environmentScale;
    this.rimLight.color.set(preset.rimColor);
    this.rimLight.intensity = preset.rim * environmentScale;
  }

  setExposure(exposure: number) {
    this.renderer.toneMappingExposure = clampExposure(exposure);
    this.invalidate();
  }

  setRenderQuality(quality: RenderQuality) {
    this.renderQuality = quality;
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    this.renderer.setPixelRatio(this.resolvePixelRatio(quality));
    this.renderer.setSize(size.x, size.y, false);
    this.invalidate(2);
  }

  getDiagnostics(): SceneDiagnostics {
    const info = this.renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      pixelRatio: this.renderer.getPixelRatio(),
      renderQuality: this.renderQuality,
      renderMode: this.isAutoRotating || this.dampingState?.isAnimating ? 'continuous' : 'on-demand',
    };
  }

  setMode(mode: 'scene' | 'panorama360') {
    this.mode = mode;
    this.gridGroup.visible = mode === 'scene';
    this.objectsGroup.visible = mode === 'scene';
    if (mode === 'panorama360' && !this.panoramaSphere) {
      this.buildPanoramaSphere();
    }
    if (mode === 'scene') {
      if (this.panoramaSphere) this.panoramaSphere.visible = false;
    } else {
      if (this.panoramaSphere) this.panoramaSphere.visible = true;
    }
    this.invalidate();
  }

  private buildPanoramaSphere() {
    const geo = new THREE.SphereGeometry(50, 64, 32);
    geo.scale(-1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.FrontSide });
    this.panoramaSphere = new THREE.Mesh(geo, mat);
    this.scene.add(this.panoramaSphere);
  }

  private panoramaLoadToken = 0;

  async loadPanoramaImage(url: string) {
    await this.modelLoadPromise;
    if (!this.panoramaSphere) this.buildPanoramaSphere();
    const token = ++this.panoramaLoadToken;
    const loader = new THREE.TextureLoader();
    try {
      const newTexture = await loader.loadAsync(url);
      // 检查是否是最新的请求，避免竞态导致旧纹理覆盖新纹理
      if (token !== this.panoramaLoadToken) {
        newTexture.dispose();
        return;
      }
      if (this.panoramaTexture) this.panoramaTexture.dispose();
      this.panoramaTexture = newTexture;
      this.panoramaTexture.colorSpace = THREE.SRGBColorSpace;
      (this.panoramaSphere!.material as THREE.MeshBasicMaterial).map = this.panoramaTexture;
      (this.panoramaSphere!.material as THREE.MeshBasicMaterial).color.set(0xffffff);
      (this.panoramaSphere!.material as THREE.MeshBasicMaterial).needsUpdate = true;
      this.invalidate(2);
    } catch {
      if (token === this.panoramaLoadToken) {
        (this.panoramaSphere!.material as THREE.MeshBasicMaterial).color.set(0x888888);
      }
    }
  }

  applySceneView(view: SceneView, animated: boolean = false) {
    if (animated && this.dampingState) {
      this.dampingState.targetView = { ...view, target: { ...view.target } };
      this.dampingState.isAnimating = true;
      return;
    }
    const pose = resolveSceneCameraPose(view);
    this.camera.position.copy(pose.position);
    this.camera.lookAt(pose.target);
    this.camera.fov = pose.fov;
    this.camera.updateProjectionMatrix();
    if (this.dampingState) {
      this.dampingState.currentView = { ...view, target: { ...view.target } };
      this.dampingState.targetView = { ...view, target: { ...view.target } };
      this.dampingState.isAnimating = false;
    }
    this.invalidate();
  }

  startDampedViewTransition(targetView: SceneView) {
    if (!this.dampingState) {
      this.dampingState = {
        currentView: { ...targetView, target: { ...targetView.target } },
        targetView: { ...targetView, target: { ...targetView.target } },
        lastTime: performance.now(),
        isAnimating: false,
      };
    }
    this.dampingState.targetView = { ...targetView, target: { ...targetView.target } };
    this.dampingState.isAnimating = true;
    this.dampingState.lastTime = performance.now();
    this.invalidate(VIEW_DAMPING.windowMs > 0 ? 2 : 1);
  }

  private tickDamping(now: number) {
    if (!this.dampingState || !this.dampingState.isAnimating) return;
    const ds = this.dampingState;
    const dt = Math.min(now - ds.lastTime, VIEW_DAMPING.maxDtMs);
    ds.lastTime = now;

    const tc = VIEW_DAMPING.timeConstantMs;
    ds.currentView.orbitYaw = dampAngle(ds.currentView.orbitYaw, ds.targetView.orbitYaw, dt, tc);
    ds.currentView.orbitPitch = dampAngle(ds.currentView.orbitPitch, ds.targetView.orbitPitch, dt, tc);
    ds.currentView.orbitDistance = dampScalar(ds.currentView.orbitDistance, ds.targetView.orbitDistance, dt, tc);
    ds.currentView.focalLength = dampScalar(ds.currentView.focalLength, ds.targetView.focalLength, dt, tc);
    ds.currentView.target.x = dampScalar(ds.currentView.target.x, ds.targetView.target.x, dt, tc);
    ds.currentView.target.y = dampScalar(ds.currentView.target.y, ds.targetView.target.y, dt, tc);
    ds.currentView.target.z = dampScalar(ds.currentView.target.z, ds.targetView.target.z, dt, tc);

    const settled =
      Math.abs(ds.currentView.orbitYaw - ds.targetView.orbitYaw) < VIEW_DAMPING.settleEpsilon &&
      Math.abs(ds.currentView.orbitPitch - ds.targetView.orbitPitch) < VIEW_DAMPING.settleEpsilon &&
      Math.abs(ds.currentView.orbitDistance - ds.targetView.orbitDistance) < VIEW_DAMPING.settleEpsilon &&
      Math.abs(ds.currentView.focalLength - ds.targetView.focalLength) < VIEW_DAMPING.settleEpsilon;

    if (settled) {
      ds.currentView = { ...ds.targetView, target: { ...ds.targetView.target } };
      ds.isAnimating = false;
    }

    const pose = resolveSceneCameraPose(ds.currentView);
    this.camera.position.copy(pose.position);
    this.camera.lookAt(pose.target);
    this.camera.fov = pose.fov;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  applyPanoramaView(pv: PanoramaView) {
    this.currentPanoramaView = { ...pv };
    this.camera.fov = pv.fov;
    this.camera.updateProjectionMatrix();
    const cp = Math.cos(pv.pitch);
    const sp = Math.sin(pv.pitch);
    const cy = Math.cos(pv.yaw);
    const sy = Math.sin(pv.yaw);
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(cp * sy, sp, cp * cy);
    this.invalidate();
  }

  async syncObjects(objects: SceneObject3D[]) {
    await this.modelLoadPromise;
    const existingIds = new Set(objects.map((o) => o.id));
    for (const [id, obj3d] of this.object3DMap) {
      if (!existingIds.has(id)) {
        this.objectsGroup.remove(obj3d);
        this.disposeObject3DResources(obj3d);
        this.object3DMap.delete(id);
      }
    }
    for (const obj of objects) {
      let obj3d = this.object3DMap.get(obj.id);
      if (!obj3d) {
        obj3d = await this.createObject3D(obj);
        if (obj3d) {
          this.objectsGroup.add(obj3d);
          this.object3DMap.set(obj.id, obj3d);
        }
      }
      if (obj3d) {
        obj3d.position.set(obj.position.x, obj.position.y, obj.position.z);
        obj3d.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
        obj3d.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
        obj3d.visible = obj.visible !== false;
        obj3d.userData.locked = obj.locked === true;
        obj3d.userData.name = obj.name;
        this.applyObjectColor(obj3d, obj.colorKey);
      }
    }
    if (this.selectedObjectId) {
      this.buildSelectionRing(this.selectedObjectId);
    }
    this.updateGizmo();
    this.invalidate(2);
  }

  private async createObject3D(obj: SceneObject3D): Promise<THREE.Object3D | null> {
    if (obj.type === 'cube') {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial({ color: mannequinColorHex(obj.colorKey), roughness: 0.4 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.5;
      const group = new THREE.Group();
      group.add(mesh);
      this.attachObjectMetadata(group, obj);
      return group;
    }
    if (obj.type === 'mannequin') {
      const source = obj.gender === 'female' ? this.modelCache.female : this.modelCache.male;
      if (!source) {
        const fallback = this.createFallbackMannequin(obj.gender || 'male');
        this.attachObjectMetadata(fallback, obj);
        return fallback;
      }
      const clone = source.clone(true);
      // 深拷贝材质，避免共享材质导致颜色/高亮串改
      clone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.geometry) {
            mesh.geometry = mesh.geometry.clone();
          }
          if (mesh.material) {
            mesh.material = (mesh.material as THREE.Material).clone();
          }
        }
      });
      this.attachObjectMetadata(clone, obj);
      return clone;
    }
    if (obj.type === 'model' && obj.modelUrl) {
      const model = await this.loadGLTFModel(obj.modelUrl, obj.name);
      if (model) this.attachObjectMetadata(model, obj);
      return model;
    }
    return null;
  }

  /** 将对象元信息写入 userData，供 getObjectsState() 读取 */
  private attachObjectMetadata(obj3d: THREE.Object3D, obj: SceneObject3D) {
    obj3d.userData.type = obj.type;
    obj3d.userData.name = obj.name;
    obj3d.userData.gender = obj.gender;
    obj3d.userData.colorKey = obj.colorKey;
    obj3d.userData.modelUrl = obj.modelUrl;
    obj3d.userData.modelAssetId = obj.modelAssetId;
    obj3d.userData.locked = obj.locked === true;
  }

  private applyObjectColor(obj3d: THREE.Object3D, colorKey: MannequinColorKey) {
    const hex = mannequinColorHex(colorKey);
    obj3d.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          (mesh.material as THREE.MeshStandardMaterial).color.set(hex);
        }
      }
    });
  }

  private applySelectionEmphasis(objectId: string | null) {
    for (const [, obj3d] of this.object3DMap) {
      obj3d.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (objectId && this.object3DMap.get(objectId) === obj3d) {
              mat.emissive.set(SELECTION_RING.color);
              mat.emissiveIntensity = 0.2;
            } else {
              mat.emissiveIntensity = 0;
            }
          }
        }
      });
    }
  }

  setSelectedObject(objectId: string | null) {
    this.selectedObjectId = objectId;
    this.buildSelectionRing(objectId);
    this.applySelectionEmphasis(objectId);
    this.updateGizmo();
    this.invalidate();
  }

  setTool(tool: Scene3DTool) {
    this.currentTool = tool;
    this.updateGizmo();
    this.invalidate();
  }

  private buildSelectionRing(objectId: string | null) {
    if (this.selectionGroup) {
      this.disposeObject3DResources(this.selectionGroup);
      this.selectionGroup.parent?.remove(this.selectionGroup);
      this.selectionGroup = null;
    }
    if (!objectId) return;
    const obj3d = this.object3DMap.get(objectId);
    if (!obj3d) return;

    this.selectionGroup = new THREE.Group();
    const ringColor = SELECTION_RING.color;

    const outerGeo = new THREE.RingGeometry(
      SELECTION_RING.outer.innerRadius,
      SELECTION_RING.outer.outerRadius,
      SELECTION_RING.outer.segments
    );
    const outerMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: SELECTION_RING.outer.opacity,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.rotation.x = -Math.PI / 2;
    outerMesh.position.y = SELECTION_RING.outer.yOffset;
    this.selectionGroup.add(outerMesh);

    const middleGeo = new THREE.CircleGeometry(
      SELECTION_RING.middle.radius,
      SELECTION_RING.middle.segments
    );
    const middleMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: SELECTION_RING.middle.opacity,
    });
    const middleMesh = new THREE.Mesh(middleGeo, middleMat);
    middleMesh.rotation.x = -Math.PI / 2;
    middleMesh.position.y = SELECTION_RING.middle.yOffset;
    this.selectionGroup.add(middleMesh);

    const innerGeo = new THREE.RingGeometry(
      SELECTION_RING.inner.innerRadius,
      SELECTION_RING.inner.outerRadius,
      SELECTION_RING.inner.segments
    );
    const innerMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: SELECTION_RING.inner.opacity,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.rotation.x = -Math.PI / 2;
    innerMesh.position.y = SELECTION_RING.inner.yOffset;
    this.selectionGroup.add(innerMesh);

    obj3d.add(this.selectionGroup);
  }

  private updateGizmo() {
    if (this.gizmoGroup) {
      this.disposeObject3DResources(this.gizmoGroup);
      this.gizmoGroup.parent?.remove(this.gizmoGroup);
      this.gizmoGroup = null;
    }
    if (!this.selectedObjectId || this.currentTool === 'navigate') return;
    const obj3d = this.object3DMap.get(this.selectedObjectId);
    if (!obj3d) return;

    this.gizmoGroup = new THREE.Group();

    if (this.currentTool === 'move') {
      this.buildMoveGizmo();
    } else if (this.currentTool === 'scale') {
      this.buildScaleGizmo();
    } else if (this.currentTool === 'rotate') {
      this.buildRotateGizmo();
    }

    if (this.gizmoGroup.children.length > 0) {
      obj3d.add(this.gizmoGroup);
    }
  }

  private buildMoveGizmo() {
    const g = this.gizmoGroup!;
    const len = GIZMO.moveShaftLength;
    const headLen = GIZMO.moveHeadLength;

    const axes: { dir: THREE.Vector3; color: number }[] = [
      { dir: new THREE.Vector3(1, 0, 0), color: GIZMO.colors.x },
      { dir: new THREE.Vector3(0, 1, 0), color: GIZMO.colors.y },
      { dir: new THREE.Vector3(0, 0, 1), color: GIZMO.colors.z },
    ];

    for (const axis of axes) {
      const axisKey: GizmoAxis = axis.dir.x === 1 ? 'x' : axis.dir.y === 1 ? 'y' : 'z';
      const mat = new THREE.LineBasicMaterial({ color: axis.color, linewidth: GIZMO.lineWidth, depthTest: false });
      const start = new THREE.Vector3(0, 0, 0);
      const end = axis.dir.clone().multiplyScalar(len);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
      const line = new THREE.Line(lineGeo, mat);
      line.userData.axis = axisKey;
      g.add(line);

      const coneGeo = new THREE.ConeGeometry(GIZMO.headRadius, headLen, 12);
      const coneMat = new THREE.MeshBasicMaterial({ color: axis.color, depthTest: false, transparent: true, opacity: 0.9 });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(axis.dir.clone().multiplyScalar(len + headLen / 2));
      if (axis.dir.x === 1) cone.rotation.z = -Math.PI / 2;
      else if (axis.dir.z === 1) cone.rotation.x = Math.PI / 2;
      cone.userData.axis = axisKey;
      g.add(cone);
    }

    const planeSize = GIZMO.planeSize;
    const planeOffset = GIZMO.planeOffset;
    const planes: { pos: THREE.Vector3; color: number }[] = [
      { pos: new THREE.Vector3(planeOffset, planeOffset, 0), color: GIZMO.colors.xz },
      { pos: new THREE.Vector3(planeOffset, 0, planeOffset), color: GIZMO.colors.xy },
      { pos: new THREE.Vector3(0, planeOffset, planeOffset), color: GIZMO.colors.yz },
    ];

    for (const p of planes) {
      const planeAxis: GizmoAxis = p.pos.x === 0 ? 'yz' : p.pos.y === 0 ? 'xz' : 'xy';
      const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
      const planeMat = new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.15, depthTest: false, side: THREE.DoubleSide });
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.position.copy(p.pos);
      if (p.pos.y === 0) planeMesh.rotation.x = -Math.PI / 2;
      else if (p.pos.x === 0) planeMesh.rotation.y = Math.PI / 2;
      planeMesh.userData.axis = planeAxis;
      g.add(planeMesh);
    }
  }

  private buildScaleGizmo() {
    const g = this.gizmoGroup!;
    const len = GIZMO.scaleLength;

    const axes: { dir: THREE.Vector3; color: number }[] = [
      { dir: new THREE.Vector3(1, 0, 0), color: GIZMO.colors.x },
      { dir: new THREE.Vector3(0, 1, 0), color: GIZMO.colors.y },
      { dir: new THREE.Vector3(0, 0, 1), color: GIZMO.colors.z },
    ];

    for (const axis of axes) {
      const axisKey: GizmoAxis = axis.dir.x === 1 ? 'x' : axis.dir.y === 1 ? 'y' : 'z';
      const mat = new THREE.LineBasicMaterial({ color: axis.color, linewidth: GIZMO.lineWidth, depthTest: false });
      const start = new THREE.Vector3(0, 0, 0);
      const end = axis.dir.clone().multiplyScalar(len);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
      const line = new THREE.Line(lineGeo, mat);
      line.userData.axis = axisKey;
      g.add(line);

      const boxGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const boxMat = new THREE.MeshBasicMaterial({ color: axis.color, depthTest: false, transparent: true, opacity: 0.9 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.copy(axis.dir.clone().multiplyScalar(len + 0.06));
      box.userData.axis = axisKey;
      g.add(box);
    }
  }

  private buildRotateGizmo() {
    const g = this.gizmoGroup!;
    const radius = GIZMO.rotateRadius;

    const rings: { axis: THREE.Vector3; color: number }[] = [
      { axis: new THREE.Vector3(1, 0, 0), color: GIZMO.colors.x },
      { axis: new THREE.Vector3(0, 1, 0), color: GIZMO.colors.y },
      { axis: new THREE.Vector3(0, 0, 1), color: GIZMO.colors.z },
    ];

    for (const ring of rings) {
      const axisKey: GizmoAxis = ring.axis.x === 1 ? 'x' : ring.axis.y === 1 ? 'y' : 'z';
      const segments = 64;
      const points: THREE.Vector3[] = [];
      const perpendicular = new THREE.Vector3();
      if (Math.abs(ring.axis.y) < 0.9) {
        perpendicular.crossVectors(ring.axis, new THREE.Vector3(0, 1, 0)).normalize();
      } else {
        perpendicular.crossVectors(ring.axis, new THREE.Vector3(1, 0, 0)).normalize();
      }
      const secondPerp = new THREE.Vector3().crossVectors(ring.axis, perpendicular).normalize();

      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const point = perpendicular.clone().multiplyScalar(Math.cos(angle) * radius)
          .add(secondPerp.clone().multiplyScalar(Math.sin(angle) * radius));
        points.push(point);
      }

      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({ color: ring.color, linewidth: GIZMO.lineWidth, depthTest: false, transparent: true, opacity: 0.8 });
      const line = new THREE.Line(lineGeo, lineMat);
      line.userData.axis = axisKey;
      g.add(line);
    }
  }

  setShowGrid(show: boolean) {
    this.gridGroup.visible = show && this.mode === 'scene';
    this.invalidate();
  }

  setAutoRotate(enabled: boolean, speed: number = 0.001) {
    this.isAutoRotating = enabled;
    this.autoRotateSpeed = speed;
    this.invalidate();
  }

  setPanoramaViewChangeCallback(cb: ((view: PanoramaView) => void) | null) {
    this.onPanoramaViewChange = cb;
  }

  captureViewport(
    aspect: { widthRatio: number; heightRatio: number } = { widthRatio: 1, heightRatio: 1 },
    transparentBackground: boolean = false,
    watermark: boolean = false,
    watermarkInfo?: { focalLength: number; pitchDeg: number; yawDeg: number }
  ): string | null {
    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;
    let cw = w;
    let ch = h;
    if (aspect.widthRatio !== aspect.heightRatio) {
      const targetAspect = aspect.widthRatio / aspect.heightRatio;
      const currentAspect = w / h;
      if (currentAspect > targetAspect) {
        cw = Math.round(h * targetAspect);
      } else {
        ch = Math.round(w / targetAspect);
      }
    }

    const originalBg = this.scene.background;
    const originalFog = this.scene.fog;
    const originalGridVisible = this.gridGroup.visible;

    if (transparentBackground) {
      this.scene.background = null;
      this.scene.fog = null;
      this.gridGroup.visible = false;
      this.renderer.setClearAlpha(0);
    }

    this.renderer.render(this.scene, this.camera);

    if (transparentBackground) {
      this.scene.background = originalBg;
      this.scene.fog = originalFog;
      this.gridGroup.visible = originalGridVisible;
      this.renderer.setClearAlpha(1);
      this.invalidate(2);
    }

    const canvas = this.renderer.domElement;
    const sx = Math.max(0, Math.round((w - cw) / 2));
    const sy = Math.max(0, Math.round((h - ch) / 2));
    try {
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = cw;
      tmpCanvas.height = ch;
      const ctx = tmpCanvas.getContext('2d');
      if (ctx) {
        if (transparentBackground) {
          ctx.clearRect(0, 0, cw, ch);
        }
        ctx.drawImage(canvas, sx, sy, cw, ch, 0, 0, cw, ch);
        if (watermark && watermarkInfo) {
          const pitchLabel = (() => {
            const d = watermarkInfo.pitchDeg;
            if (d < -20) return '仰视';
            if (d < 20) return '平视';
            if (d < 50) return '俯视45°';
            return '俯视90°';
          })();
          const dateStr = new Date().toLocaleString('zh-CN');
          const text1 = `${watermarkInfo.focalLength}mm`;
          const text2 = `${pitchLabel}`;
          const text3 = dateStr;
          const fontSize = Math.max(12, Math.round(cw * 0.022));
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          const pad = Math.round(fontSize * 0.6);
          const lineH = fontSize * 1.35;
          ctx.fillText(text1, pad, ch - pad - lineH * 2);
          ctx.fillText(text2, pad, ch - pad - lineH);
          ctx.fillText(text3, pad, ch - pad);
        }
        return tmpCanvas.toDataURL('image/png');
      }
    } catch { /* fall through */ }
    return canvas.toDataURL('image/png');
  }

  private startRenderLoop() {
    const animate = () => {
      if (this.disposed) return;
      this.animationId = requestAnimationFrame(animate);
      const now = performance.now();
      this.tickDamping(now);
      if (this.isAutoRotating && this.mode === 'panorama360') {
        const nextView = {
          ...this.currentPanoramaView,
          yaw: this.currentPanoramaView.yaw + this.autoRotateSpeed,
        };
        this.applyPanoramaView(nextView);
        if (this.onPanoramaViewChange && now - this.lastPanoramaViewEmit > 250) {
          this.lastPanoramaViewEmit = now;
          this.onPanoramaViewChange({ ...nextView });
        }
      }
      const isContinuous =
        this.isAutoRotating ||
        this.dampingState?.isAnimating === true ||
        this.gizmoDragState !== null ||
        this.objectDragState !== null;
      if (this.needsRender || isContinuous) {
        this.renderer.render(this.scene, this.camera);
        this.needsRender = false;
      }
    };
    animate();
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.invalidate(2);
  }

  getCanvasElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  saveCameraPreset(currentView: SceneView, slot: number, name?: string): CameraPreset {
    const preset: CameraPreset = {
      id: `preset-${Date.now()}-${slot}`,
      name: name?.trim() || `机位 ${slot}`,
      slot,
      view: { ...currentView, target: { ...currentView.target } },
      createdAt: Date.now(),
    };
    return preset;
  }

  loadCameraPreset(presetView: SceneView) {
    this.startDampedViewTransition({ ...presetView, target: { ...presetView.target } });
  }

  setTransformChangeCallback(cb: ((objectId: string, transform: ObjectTransform) => void) | null) {
    this.onTransformChange = cb;
  }

  private getMouseNDC(mouseX: number, mouseY: number): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((mouseX - rect.left) / rect.width) * 2 - 1,
      -((mouseY - rect.top) / rect.height) * 2 + 1
    );
  }

  pickObjectAt(mouseX: number, mouseY: number): string | null {
    if (this.mode !== 'scene') return null;
    const ndc = this.getMouseNDC(mouseX, mouseY);
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes: THREE.Mesh[] = [];
    for (const [, obj3d] of this.object3DMap) {
      obj3d.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          meshes.push(child as THREE.Mesh);
        }
      });
    }
    const intersects = this.raycaster.intersectObjects(meshes, false);
    if (intersects.length === 0) return null;
    const hit = intersects[0];
    let target = hit.object;
    while (target.parent && target.parent !== this.objectsGroup) {
      target = target.parent;
    }
    for (const [id, obj3d] of this.object3DMap) {
      if (obj3d === target) return id;
    }
    return null;
  }

  private getGizmoMeshes(): { mesh: THREE.Mesh | THREE.Line; axis: GizmoAxis }[] {
    const result: { mesh: THREE.Mesh | THREE.Line; axis: GizmoAxis }[] = [];
    if (!this.gizmoGroup) return result;
    for (const child of this.gizmoGroup.children) {
      if ((child as THREE.Mesh).isMesh || (child as THREE.Line).isLine) {
        const axis = (child.userData.axis as GizmoAxis) || 'x';
        result.push({ mesh: child as THREE.Mesh | THREE.Line, axis });
      }
    }
    return result;
  }

  pickGizmoAxis(mouseX: number, mouseY: number): GizmoAxis | null {
    if (!this.gizmoGroup || this.currentTool === 'navigate') return null;
    const ndc = this.getMouseNDC(mouseX, mouseY);
    this.raycaster.setFromCamera(ndc, this.camera);
    const gizmoMeshes = this.getGizmoMeshes();
    const meshes = gizmoMeshes.map((g) => g.mesh);
    const intersects = this.raycaster.intersectObjects(meshes, false);
    if (intersects.length === 0) return null;
    const hit = intersects[0].object;
    const found = gizmoMeshes.find((g) => g.mesh === hit);
    return found?.axis ?? null;
  }

  private getAxisVector(axis: GizmoAxis): THREE.Vector3 {
    switch (axis) {
      case 'x': return new THREE.Vector3(1, 0, 0);
      case 'y': return new THREE.Vector3(0, 1, 0);
      case 'z': return new THREE.Vector3(0, 0, 1);
      case 'xy': return new THREE.Vector3(1, 1, 0).normalize();
      case 'yz': return new THREE.Vector3(0, 1, 1).normalize();
      case 'xz': return new THREE.Vector3(1, 0, 1).normalize();
      default: return new THREE.Vector3(1, 0, 0);
    }
  }

  private worldAxisToScreen(axis: THREE.Vector3, objectWorldPos: THREE.Vector3): THREE.Vector3 {
    const start = objectWorldPos.clone();
    const end = objectWorldPos.clone().add(axis);
    start.project(this.camera);
    end.project(this.camera);
    return end.sub(start).normalize();
  }

  startGizmoDrag(axis: GizmoAxis, mouseX: number, mouseY: number) {
    if (!this.selectedObjectId) return;
    const obj3d = this.object3DMap.get(this.selectedObjectId);
    if (!obj3d) return;
    const worldPos = new THREE.Vector3();
    obj3d.getWorldPosition(worldPos);
    const screenCenter = worldPos.clone().project(this.camera);
    const screenAxis = this.worldAxisToScreen(this.getAxisVector(axis), worldPos);
    const screenPerp = new THREE.Vector3(-screenAxis.y, screenAxis.x, 0);
    this.gizmoDragState = {
      axis,
      startMouseX: mouseX,
      startMouseY: mouseY,
      startPosition: obj3d.position.clone(),
      startScale: obj3d.scale.clone(),
      startRotation: obj3d.rotation.clone(),
      startObjectMatrix: obj3d.matrixWorld.clone(),
      startCameraPosition: this.camera.position.clone(),
      screenAxis,
      screenPerp,
      screenCenter,
    };
  }

  updateGizmoDrag(mouseX: number, mouseY: number) {
    if (!this.gizmoDragState || !this.selectedObjectId) return;
    const obj3d = this.object3DMap.get(this.selectedObjectId);
    if (!obj3d) return;
    const ds = this.gizmoDragState;
    const dx = mouseX - ds.startMouseX;
    const dy = mouseY - ds.startMouseY;
    const screenDelta = new THREE.Vector2(dx, dy);
    if (this.currentTool === 'move') {
      const axisVec = this.getAxisVector(ds.axis);
      const worldAxis = axisVec.clone().transformDirection(obj3d.parent?.matrixWorld ?? new THREE.Matrix4());
      const screenWorldAxis = this.worldAxisToScreen(worldAxis, new THREE.Vector3().setFromMatrixPosition(ds.startObjectMatrix));
      const projectedDelta = screenDelta.dot(new THREE.Vector2(screenWorldAxis.x, screenWorldAxis.y));
      const sensitivity = 0.008;
      const moveDelta = worldAxis.multiplyScalar(projectedDelta * sensitivity);
      obj3d.position.copy(ds.startPosition).add(moveDelta);
    } else if (this.currentTool === 'scale') {
      const axisVec = this.getAxisVector(ds.axis);
      const worldAxis = axisVec.clone().transformDirection(obj3d.parent?.matrixWorld ?? new THREE.Matrix4());
      const screenWorldAxis = this.worldAxisToScreen(worldAxis, new THREE.Vector3().setFromMatrixPosition(ds.startObjectMatrix));
      const projectedDelta = screenDelta.dot(new THREE.Vector2(screenWorldAxis.x, screenWorldAxis.y));
      const sensitivity = 0.01;
      let scaleFactor = 1 + projectedDelta * sensitivity;
      scaleFactor = Math.max(0.1, scaleFactor);
      const newScale = ds.startScale.clone();
      if (ds.axis === 'x' || ds.axis === 'xy' || ds.axis === 'xz') newScale.x = ds.startScale.x * scaleFactor;
      if (ds.axis === 'y' || ds.axis === 'xy' || ds.axis === 'yz') newScale.y = ds.startScale.y * scaleFactor;
      if (ds.axis === 'z' || ds.axis === 'yz' || ds.axis === 'xz') newScale.z = ds.startScale.z * scaleFactor;
      obj3d.scale.copy(newScale);
    } else if (this.currentTool === 'rotate') {
      const axisVec = this.getAxisVector(ds.axis);
      const worldAxis = axisVec.clone().transformDirection(obj3d.parent?.matrixWorld ?? new THREE.Matrix4()).normalize();
      const screenWorldAxis = this.worldAxisToScreen(worldAxis, new THREE.Vector3().setFromMatrixPosition(ds.startObjectMatrix));
      const projectedDelta = screenDelta.dot(new THREE.Vector2(screenWorldAxis.x, screenWorldAxis.y));
      const sensitivity = 0.015;
      const angle = projectedDelta * sensitivity;
      const quat = new THREE.Quaternion().setFromAxisAngle(worldAxis, angle);
      const startQuat = new THREE.Quaternion().setFromEuler(ds.startRotation);
      obj3d.quaternion.copy(quat.multiply(startQuat));
    }
    this.buildSelectionRing(this.selectedObjectId);
    this.emitTransformChange(this.selectedObjectId, obj3d);
    this.invalidate();
  }

  endGizmoDrag() {
    this.gizmoDragState = null;
  }

  startObjectDrag(mouseX: number, mouseY: number) {
    if (!this.selectedObjectId) return;
    const obj3d = this.object3DMap.get(this.selectedObjectId);
    if (!obj3d) return;
    const ndc = this.getMouseNDC(mouseX, mouseY);
    this.raycaster.setFromCamera(ndc, this.camera);
    const worldPos = new THREE.Vector3();
    obj3d.getWorldPosition(worldPos);
    const normal = new THREE.Vector3(0, 1, 0);
    normal.transformDirection(this.camera.matrixWorld).negate();
    if (Math.abs(normal.y) < 0.3) normal.set(0, 1, 0);
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldPos);
    const intersect = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(dragPlane, intersect);
    this.objectDragState = {
      startMouseX: mouseX,
      startMouseY: mouseY,
      startPosition: obj3d.position.clone(),
      startRotation: obj3d.rotation.clone(),
      startScale: obj3d.scale.clone(),
      dragPlane,
    };
  }

  updateObjectDrag(mouseX: number, mouseY: number) {
    if (!this.objectDragState || !this.selectedObjectId) return;
    const obj3d = this.object3DMap.get(this.selectedObjectId);
    if (!obj3d) return;
    const ndc = this.getMouseNDC(mouseX, mouseY);
    this.raycaster.setFromCamera(ndc, this.camera);
    const intersect = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.objectDragState.dragPlane, intersect)) {
      const localIntersect = obj3d.parent?.worldToLocal(intersect.clone()) ?? intersect;
      const localStart = obj3d.parent?.worldToLocal(this.objectDragState.startPosition.clone()) ?? this.objectDragState.startPosition;
      const delta = localIntersect.sub(localStart);
      if (this.currentTool === 'move') {
        obj3d.position.copy(this.objectDragState.startPosition).add(delta);
      } else if (this.currentTool === 'scale') {
        const scaleDelta = delta.length() * 0.5;
        const direction = delta.dot(new THREE.Vector3(1, 0, 0)) >= 0 ? 1 : -1;
        const scaleFactor = Math.max(0.1, 1 + scaleDelta * direction * 0.01);
        obj3d.scale.setScalar(obj3d.scale.x * scaleFactor);
      } else if (this.currentTool === 'rotate') {
        const angleX = delta.z * 0.02;
        const angleY = delta.x * 0.02;
        obj3d.rotation.x = this.objectDragState.startRotation.x + angleX;
        obj3d.rotation.y = this.objectDragState.startRotation.y + angleY;
      }
      this.buildSelectionRing(this.selectedObjectId);
      this.emitTransformChange(this.selectedObjectId, obj3d);
      this.invalidate();
    }
  }

  endObjectDrag() {
    this.objectDragState = null;
  }

  isGizmoDragging(): boolean {
    return this.gizmoDragState !== null;
  }

  isObjectDragging(): boolean {
    return this.objectDragState !== null;
  }

  getMinimapData(worldExtent: number = 40): MinimapData {
    const objects: MinimapData['objects'] = [];
    for (const [id, obj3d] of this.object3DMap) {
      const worldPos = new THREE.Vector3();
      obj3d.getWorldPosition(worldPos);
      objects.push({
        id,
        name: '',
        type: 'cube',
        x2d: worldPos.x,
        z2d: worldPos.z,
      });
    }
    const camPos = this.camera.position;
    const camTarget = new THREE.Vector3();
    this.camera.getWorldDirection(camTarget);
    const camYaw = Math.atan2(camTarget.x, camTarget.z);
    return {
      objects,
      cameraX: camPos.x,
      cameraZ: camPos.z,
      cameraYaw: camYaw,
      worldExtent,
    };
  }

  alignObjects(objectIds: string[], mode: AlignMode) {
    if (objectIds.length < 2) return;
    const objs = objectIds
      .map((id) => ({ id, obj3d: this.object3DMap.get(id) }))
      .filter((o): o is { id: string; obj3d: THREE.Object3D } => !!o.obj3d);
    if (objs.length < 2) return;

    const positions = objs.map((o) => {
      const wp = new THREE.Vector3();
      o.obj3d.getWorldPosition(wp);
      return { id: o.id, obj3d: o.obj3d, pos: wp };
    });

    switch (mode) {
      case 'left': {
        const minX = Math.min(...positions.map((p) => p.pos.x));
        for (const p of positions) {
          p.obj3d.position.x -= (p.pos.x - minX);
        }
        break;
      }
      case 'right': {
        const maxX = Math.max(...positions.map((p) => p.pos.x));
        for (const p of positions) {
          p.obj3d.position.x += (maxX - p.pos.x);
        }
        break;
      }
      case 'top': {
        const maxZ = Math.max(...positions.map((p) => p.pos.z));
        for (const p of positions) {
          p.obj3d.position.z += (maxZ - p.pos.z);
        }
        break;
      }
      case 'bottom': {
        const minZ = Math.min(...positions.map((p) => p.pos.z));
        for (const p of positions) {
          p.obj3d.position.z -= (p.pos.z - minZ);
        }
        break;
      }
      case 'distributeH': {
        const sorted = [...positions].sort((a, b) => a.pos.x - b.pos.x);
        if (sorted.length < 2) break;
        const minX = sorted[0].pos.x;
        const maxX = sorted[sorted.length - 1].pos.x;
        const step = (maxX - minX) / (sorted.length - 1);
        for (let i = 0; i < sorted.length; i++) {
          sorted[i].obj3d.position.x = minX + step * i;
        }
        break;
      }
      case 'distributeV': {
        const sorted = [...positions].sort((a, b) => a.pos.z - b.pos.z);
        if (sorted.length < 2) break;
        const minZ = sorted[0].pos.z;
        const maxZ = sorted[sorted.length - 1].pos.z;
        const step = (maxZ - minZ) / (sorted.length - 1);
        for (let i = 0; i < sorted.length; i++) {
          sorted[i].obj3d.position.z = minZ + step * i;
        }
        break;
      }
      case 'groundSnap': {
        for (const p of positions) {
          p.obj3d.position.y = 0;
        }
        break;
      }
    }
    this.invalidate(2);
  }

  setObjectVisibility(id: string, visible: boolean) {
    const obj3d = this.object3DMap.get(id);
    if (obj3d) {
      obj3d.visible = visible;
      this.invalidate();
    }
  }

  setObjectLocked(id: string, locked: boolean) {
    const obj3d = this.object3DMap.get(id);
    if (obj3d) {
      obj3d.userData.locked = locked;
      this.invalidate();
    }
  }

  isObjectLocked(id: string): boolean {
    const obj3d = this.object3DMap.get(id);
    return obj3d?.userData.locked === true;
  }

  /**
   * 读取当前 bridge 中所有对象的最新变换状态，用于对齐等操作后同步回节点数据。
   * 返回的对象数组保留了 userData 中的元信息（id/type/name/gender/colorKey 等）。
   */
  getObjectsState(): SceneObject3D[] | null {
    const result: SceneObject3D[] = [];
    for (const [id, obj3d] of this.object3DMap) {
      const userData = obj3d.userData || {};
      result.push({
        id,
        type: (userData.type as SceneObject3D['type']) || 'cube',
        name: (userData.name as string) || `Object-${id}`,
        gender: userData.gender,
        colorKey: (userData.colorKey as MannequinColorKey) || 'gray',
        modelUrl: userData.modelUrl,
        modelAssetId: typeof userData.modelAssetId === 'string' ? userData.modelAssetId : undefined,
        position: { x: obj3d.position.x, y: obj3d.position.y, z: obj3d.position.z },
        rotation: { x: obj3d.rotation.x, y: obj3d.rotation.y, z: obj3d.rotation.z },
        scale: { x: obj3d.scale.x, y: obj3d.scale.y, z: obj3d.scale.z },
        visible: obj3d.visible,
        locked: userData.locked === true,
      });
    }
    return result.length > 0 ? result : null;
  }

  private emitTransformChange(objectId: string, obj3d: THREE.Object3D) {
    if (!this.onTransformChange) return;
    this.onTransformChange(objectId, {
      position: { x: obj3d.position.x, y: obj3d.position.y, z: obj3d.position.z },
      rotation: { x: obj3d.rotation.x, y: obj3d.rotation.y, z: obj3d.rotation.z },
      scale: { x: obj3d.scale.x, y: obj3d.scale.y, z: obj3d.scale.z },
    });
  }

  private applyEasing(t: number, easing: EasingType): number {
    switch (easing) {
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return t * (2 - t);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default:
        return t;
    }
  }

  animateToKeyframe(
    target: { objectId: string | 'camera'; property: string; value: number[] },
    duration: number,
    easing: EasingType,
    onComplete?: () => void
  ) {
    const startTime = performance.now();
    let startValue: number[] = [];

    if (target.objectId === 'camera') {
      if (target.property === 'view' && this.dampingState) {
        const cv = this.dampingState.currentView;
        startValue = [cv.orbitYaw, cv.orbitPitch, cv.orbitDistance, cv.focalLength, cv.target.x, cv.target.y, cv.target.z];
      } else {
        startValue = [...target.value];
      }
    } else {
      const obj3d = this.object3DMap.get(target.objectId);
      if (!obj3d) return;
      if (target.property === 'position') {
        startValue = [obj3d.position.x, obj3d.position.y, obj3d.position.z];
      } else if (target.property === 'rotation') {
        startValue = [obj3d.rotation.x, obj3d.rotation.y, obj3d.rotation.z];
      } else if (target.property === 'scale') {
        startValue = [obj3d.scale.x, obj3d.scale.y, obj3d.scale.z];
      }
    }

    if (startValue.length === 0) return;

    const len = Math.min(startValue.length, target.value.length);

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const rawT = Math.min(1, elapsed / Math.max(duration, 1));
      const t = this.applyEasing(rawT, easing);

      const interpolated: number[] = [];
      for (let i = 0; i < len; i++) {
        interpolated.push(startValue[i] + (target.value[i] - startValue[i]) * t);
      }

      if (target.objectId === 'camera') {
        if (target.property === 'view' && this.dampingState && interpolated.length >= 7) {
          this.dampingState.currentView.orbitYaw = interpolated[0];
          this.dampingState.currentView.orbitPitch = interpolated[1];
          this.dampingState.currentView.orbitDistance = interpolated[2];
          this.dampingState.currentView.focalLength = interpolated[3];
          this.dampingState.currentView.target.x = interpolated[4];
          this.dampingState.currentView.target.y = interpolated[5];
          this.dampingState.currentView.target.z = interpolated[6];
          this.dampingState.isAnimating = false;
          const pose = resolveSceneCameraPose(this.dampingState.currentView);
          this.camera.position.copy(pose.position);
          this.camera.lookAt(pose.target);
          this.camera.fov = pose.fov;
          this.camera.updateProjectionMatrix();
        }
      } else {
        const obj3d = this.object3DMap.get(target.objectId);
        if (obj3d) {
          if (target.property === 'position' && interpolated.length >= 3) {
            obj3d.position.set(interpolated[0], interpolated[1], interpolated[2]);
          } else if (target.property === 'rotation' && interpolated.length >= 3) {
            obj3d.rotation.set(interpolated[0], interpolated[1], interpolated[2]);
          } else if (target.property === 'scale' && interpolated.length >= 3) {
            obj3d.scale.set(interpolated[0], interpolated[1], interpolated[2]);
          }
        }
      }

      if (rawT < 1) {
        this.invalidate();
        requestAnimationFrame(tick);
      } else {
        this.invalidate();
        onComplete?.();
      }
    };

    requestAnimationFrame(tick);
  }

  applyAnimationFrame(trackValues: Map<string, number[]>) {
    for (const [trackKey, interpolated] of trackValues) {
      const [objectId, property] = trackKey.split('::');
      if (objectId === 'camera' && property === 'view' && interpolated.length >= 7) {
        const newView: import('./director3d-core').SceneView = {
          orbitYaw: interpolated[0],
          orbitPitch: interpolated[1],
          orbitDistance: interpolated[2],
          focalLength: interpolated[3],
          target: { x: interpolated[4], y: interpolated[5], z: interpolated[6] },
        };
        this.applySceneView(newView);
      } else if (objectId !== 'camera') {
        const obj3d = this.object3DMap.get(objectId);
        if (!obj3d) continue;
        if (property === 'position' && interpolated.length >= 3) {
          obj3d.position.set(interpolated[0], interpolated[1], interpolated[2]);
        } else if (property === 'rotation' && interpolated.length >= 3) {
          obj3d.rotation.set(interpolated[0], interpolated[1], interpolated[2]);
        } else if (property === 'scale' && interpolated.length >= 3) {
          obj3d.scale.set(interpolated[0], interpolated[1], interpolated[2]);
        }
      }
    }
    this.invalidate();
  }

  animateCameraToView(targetView: SceneView, durationMs: number) {
    this.startDampedViewTransition(targetView);
    if (!this.dampingState) return;
    const startView = { ...this.dampingState.currentView, target: { ...this.dampingState.currentView.target } };
    const startTime = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const rawT = Math.min(1, elapsed / Math.max(durationMs, 1));
      const t = this.applyEasing(rawT, 'ease-in-out');

      const lerp = (a: number, b: number) => a + (b - a) * t;
      const currentView: SceneView = {
        orbitYaw: lerp(startView.orbitYaw, targetView.orbitYaw),
        orbitPitch: lerp(startView.orbitPitch, targetView.orbitPitch),
        orbitDistance: lerp(startView.orbitDistance, targetView.orbitDistance),
        focalLength: lerp(startView.focalLength, targetView.focalLength),
        target: {
          x: lerp(startView.target.x, targetView.target.x),
          y: lerp(startView.target.y, targetView.target.y),
          z: lerp(startView.target.z, targetView.target.z),
        },
      };

      if (this.dampingState) {
        this.dampingState.currentView = { ...currentView, target: { ...currentView.target } };
        this.dampingState.isAnimating = false;
      }
      const pose = resolveSceneCameraPose(currentView);
      this.camera.position.copy(pose.position);
      this.camera.lookAt(pose.target);
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
      this.invalidate();

      if (rawT < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }

  async loadEnvironmentHDR(url: string): Promise<void> {
    try {
      if (!this.pmremGenerator) {
        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.pmremGenerator.compileEquirectangularShader();
      }
      const loader = new RGBELoader();
      const hdrTexture = await loader.loadAsync(url);
      hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
      const envMap = this.pmremGenerator.fromEquirectangular(hdrTexture).texture;
      hdrTexture.dispose();
      this.environmentMap = envMap;
      this.scene.environment = envMap;
      this.scene.background = envMap;
      this.scene.environmentIntensity = this.environmentIntensity;
      this.invalidate(3);
    } catch {
      const fallbackLoader = new THREE.TextureLoader();
      try {
        const texture = await fallbackLoader.loadAsync(url);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.environmentMap = texture;
        this.scene.environment = texture;
        this.scene.background = texture;
        this.invalidate(3);
      } catch { /* ignore */ }
    }
  }

  setEnvironmentIntensity(intensity: number) {
    this.environmentIntensity = Math.max(0, Math.min(2, intensity));
    if (this.scene.environment) {
      this.scene.environmentIntensity = this.environmentIntensity;
    }
    this.invalidate();
  }

  removeEnvironmentHDR() {
    if (this.environmentMap) {
      this.environmentMap.dispose();
      this.environmentMap = null;
    }
    this.scene.environment = null;
    const theme = THEME_COLORS[this.env];
    this.scene.background = new THREE.Color(theme.background);
    this.invalidate(2);
  }

  async loadGLTFModel(url: string, name: string): Promise<THREE.Group> {
    const loader = this.createGLTFLoader();
    const gltf = await loader.loadAsync(url);
    const group = new THREE.Group();
    group.add(gltf.scene);
    gltf.scene.position.set(0, 0, 0);
    this.accelerateModelRaycasting(gltf.scene);
    this.fitModelToScene(group);
    return group;
  }

  private accelerateModelRaycasting(root: THREE.Object3D) {
    root.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const position = mesh.geometry?.getAttribute('position');
      const triangleCount = mesh.geometry?.index
        ? mesh.geometry.index.count / 3
        : (position?.count ?? 0) / 3;
      if (!mesh.geometry || triangleCount < RENDER_CONSTRAINTS.bvhTriangleThreshold) return;
      try {
        computeBoundsTree.call(mesh.geometry);
        mesh.raycast = acceleratedRaycast;
        mesh.userData.__director3dBVH = true;
      } catch (error) {
        console.warn('[Scene3DBridge] BVH acceleration skipped:', error);
      }
    });
  }

  private fitModelToScene(group: THREE.Group) {
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 1.8;
    if (maxDim > 0) {
      const scaleFactor = targetSize / maxDim;
      group.scale.setScalar(scaleFactor);
    }
    group.position.y = -center.y * (targetSize / maxDim);
    const newBox = new THREE.Box3().setFromObject(group);
    if (newBox.min.y < 0) {
      group.position.y -= newBox.min.y;
    }
  }

  applyGravity(objects: SceneObject3D[]): SceneObject3D[] {
    return objects.map((obj) => {
      if (obj.position.y < 0) {
        return { ...obj, position: { ...obj.position, y: 0 } };
      }
      return obj;
    });
  }

  snapToGround(objectId: string) {
    const obj3d = this.object3DMap.get(objectId);
    if (!obj3d) return;
    const box = new THREE.Box3().setFromObject(obj3d);
    const bottomY = box.min.y;
    if (bottomY < 0 || Math.abs(bottomY) > 0.01) {
      obj3d.position.y -= bottomY;
    }
  }

  async loadUserModel(url: string, name: string): Promise<SceneObject3D> {
    const count = Array.from(this.object3DMap.keys()).length;
    const offset = count * 1.5;
    const id = `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const obj: SceneObject3D = {
      id,
      type: 'model',
      name: name || `模型`,
      modelUrl: url,
      colorKey: 'white',
      position: { x: offset, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };
    const obj3d = await this.createObject3D(obj);
    if (obj3d) {
      this.objectsGroup.add(obj3d);
      this.object3DMap.set(id, obj3d);
      obj3d.position.set(obj.position.x, obj.position.y, obj.position.z);
      obj3d.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
      obj3d.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
    }
    return obj;
  }

  applyGroundConstraint(objects: SceneObject3D[]): SceneObject3D[] {
    return objects.map((obj) => {
      const obj3d = this.object3DMap.get(obj.id);
      if (!obj3d) return obj;
      const box = new THREE.Box3().setFromObject(obj3d);
      if (box.min.y < 0) {
        const correction = -box.min.y;
        const newY = obj.position.y + correction;
        if (Math.abs(newY - obj.position.y) > 0.001) {
          obj3d.position.y = newY;
          return { ...obj, position: { ...obj.position, y: newY } };
        }
      }
      return obj;
    });
  }

  checkCollision(objectId1: string, objectId2: string): boolean {
    const obj1 = this.object3DMap.get(objectId1);
    const obj2 = this.object3DMap.get(objectId2);
    if (!obj1 || !obj2) return false;
    const box1 = new THREE.Box3().setFromObject(obj1);
    const box2 = new THREE.Box3().setFromObject(obj2);
    return box1.intersectsBox(box2);
  }

  /** 递归释放 Object3D 子树中的 geometry 和 material */
  private disposeObject3DResources(obj: THREE.Object3D) {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.userData.__director3dBVH && mesh.geometry) {
          try { disposeBoundsTree.call(mesh.geometry); } catch { /* geometry may already be released */ }
        }
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          (mesh.material as THREE.Material).dispose();
        }
      } else if ((child as THREE.Line).isLine) {
        const line = child as THREE.Line;
        line.geometry?.dispose();
        (line.material as THREE.Material)?.dispose();
      }
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationId);
    // 释放所有物体资源
    for (const [, obj3d] of this.object3DMap) {
      this.disposeObject3DResources(obj3d);
    }
    this.object3DMap.clear();
    this.objectsGroup.clear();
    // 释放网格资源
    this.disposeObject3DResources(this.gridGroup);
    this.gridGroup.clear();
    // 释放选择环和 gizmo 资源
    if (this.selectionGroup) {
      this.disposeObject3DResources(this.selectionGroup);
      this.selectionGroup.clear();
    }
    if (this.gizmoGroup) {
      this.disposeObject3DResources(this.gizmoGroup);
      this.gizmoGroup.clear();
    }
    if (this.environmentMap) {
      this.environmentMap.dispose();
      this.environmentMap = null;
    }
    if (this.pmremGenerator) {
      this.pmremGenerator.dispose();
      this.pmremGenerator = null;
    }
    if (this.panoramaTexture) this.panoramaTexture.dispose();
    if (this.panoramaSphere) {
      (this.panoramaSphere.material as THREE.MeshBasicMaterial).dispose();
      this.panoramaSphere.geometry.dispose();
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }

  /** 捕获当前全景视图为 PNG data URL（离屏渲染） */
  capturePanoramaViewAsDataURL(pv: PanoramaView, width = 1024, height = 768): string | null {
    if (!this.panoramaSphere || !this.panoramaTexture) return null;

    const currentFov = this.camera.fov;
    const currentAspect = this.camera.aspect;
    const currentPosition = this.camera.position.clone();
    const currentRotation = this.camera.rotation.clone();

    // 临时设置相机到目标视角
    this.camera.fov = pv.fov;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, 0);
    const cp = Math.cos(pv.pitch);
    const sp = Math.sin(pv.pitch);
    const cy = Math.cos(pv.yaw);
    const sy = Math.sin(pv.yaw);
    this.camera.lookAt(cp * sy, sp, cp * cy);

    // 设置渲染尺寸
    const origSize = new THREE.Vector2();
    this.renderer.getSize(origSize);
    this.renderer.setSize(width, height, false);

    // 渲染一帧
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');

    // 恢复原始状态（使用 rotation 而非 lookAt，避免 target 未定义导致方向错乱）
    this.renderer.setSize(origSize.x, origSize.y, false);
    this.camera.fov = currentFov;
    this.camera.aspect = currentAspect;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(currentPosition);
    this.camera.rotation.copy(currentRotation);
    this.invalidate(2);

    return dataUrl;
  }
}
