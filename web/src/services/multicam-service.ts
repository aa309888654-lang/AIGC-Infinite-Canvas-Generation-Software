import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type SyncMethod = 'audio' | 'timecode' | 'manual' | 'auto';

export type CameraLayout = 
  | 'grid-2x2'
  | 'grid-3x3'
  | 'grid-4x4'
  | 'switching'
  | 'pip'
  | 'split-vertical'
  | 'split-horizontal'
  | 'custom';

export interface CameraSource {
  id: string;
  name: string;
  sourcePath: string;
  duration: number;
  startTime: number;
  audioTrack?: number;
  isSelected: boolean;
  color: string;
}

export interface MultiCamTrack {
  id: string;
  cameraId: string;
  clips: MultiCamClip[];
  isAudioSource: boolean;
  volume: number;
  muted: boolean;
}

export interface MultiCamClip {
  id: string;
  cameraId: string;
  startTime: number;
  endTime: number;
  sourceStart: number;
  sourceEnd: number;
  isSelected: boolean;
}

export interface SwitchPoint {
  id: string;
  time: number;
  fromCameraId: string;
  toCameraId: string;
  transition: string;
  duration: number;
}

export interface MultiCamSettings {
  layout: CameraLayout;
  syncMethod: SyncMethod;
  autoSwitch: boolean;
  switchThreshold: number;
  masterAudio: string | null;
  showAllCameras: boolean;
  previewQuality: 'low' | 'medium' | 'high';
}

export interface MultiCamProject {
  id: string;
  name: string;
  cameras: CameraSource[];
  tracks: MultiCamTrack[];
  switchPoints: SwitchPoint[];
  settings: MultiCamSettings;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MultiCamJob {
  id: string;
  projectId: string;
  status: 'pending' | 'syncing' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputUrl?: string;
  error?: string;
}

export interface MultiCamState {
  currentProject: MultiCamProject | null;
  projects: MultiCamProject[];
  jobs: MultiCamJob[];
  activeJobId: string | null;
  selectedCameraIds: string[];
  currentTime: number;
}

interface MultiCamStore extends MultiCamState {
  createProject: (name: string) => string;
  loadProject: (projectId: string) => void;
  updateProject: (updates: Partial<MultiCamProject>) => void;
  
  addCamera: (camera: Omit<CameraSource, 'id' | 'isSelected' | 'color'>) => void;
  removeCamera: (cameraId: string) => void;
  updateCamera: (cameraId: string, updates: Partial<CameraSource>) => void;
  
  addSwitchPoint: (switchPoint: Omit<SwitchPoint, 'id'>) => void;
  removeSwitchPoint: (switchPointId: string) => void;
  updateSwitchPoint: (switchPointId: string, updates: Partial<SwitchPoint>) => void;
  
  updateSettings: (settings: Partial<MultiCamSettings>) => void;
  
  syncCameras: (method: SyncMethod) => void;
  autoDetectSwitches: () => void;
  
  startExport: () => string;
  updateJobProgress: (jobId: string, progress: number) => void;
  completeJob: (jobId: string, outputUrl: string) => void;
  failJob: (jobId: string, error: string) => void;
  
  setSelectedCameras: (cameraIds: string[]) => void;
  setCurrentTime: (time: number) => void;
}

const CAMERA_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#9CA3AF',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];

const DEFAULT_SETTINGS: MultiCamSettings = {
  layout: 'switching',
  syncMethod: 'audio',
  autoSwitch: false,
  switchThreshold: 0.5,
  masterAudio: null,
  showAllCameras: true,
  previewQuality: 'medium',
};

const createEmptyProject = (name: string): MultiCamProject => ({
  id: `multicam-${Date.now()}`,
  name,
  cameras: [],
  tracks: [],
  switchPoints: [],
  settings: DEFAULT_SETTINGS,
  duration: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const useMultiCamStore = create<MultiCamStore>()(
  immer((set, get) => ({
    currentProject: null,
    projects: [],
    jobs: [],
    activeJobId: null,
    selectedCameraIds: [],
    currentTime: 0,

    createProject: (name) => {
      const project = createEmptyProject(name);
      set((state) => {
        state.projects.push(project);
        state.currentProject = project;
      });
      return project.id;
    },

    loadProject: (projectId) =>
      set((state) => {
        const project = state.projects.find((p) => p.id === projectId);
        if (project) {
          state.currentProject = project;
        }
      }),

    updateProject: (updates) =>
      set((state) => {
        if (state.currentProject) {
          Object.assign(state.currentProject, updates, { updatedAt: new Date() });
        }
      }),

    addCamera: (camera) =>
      set((state) => {
        if (!state.currentProject) return;
        
        const colorIndex = state.currentProject.cameras.length % CAMERA_COLORS.length;
        const newCamera: CameraSource = {
          ...camera,
          id: `camera-${Date.now()}`,
          isSelected: false,
          color: CAMERA_COLORS[colorIndex],
        };
        
        state.currentProject.cameras.push(newCamera);
        
        if (camera.duration > state.currentProject.duration) {
          state.currentProject.duration = camera.duration;
        }
      }),

    removeCamera: (cameraId) =>
      set((state) => {
        if (!state.currentProject) return;
        state.currentProject.cameras = state.currentProject.cameras.filter((c) => c.id !== cameraId);
        state.currentProject.tracks = state.currentProject.tracks.filter((t) => t.cameraId !== cameraId);
        state.currentProject.switchPoints = state.currentProject.switchPoints.filter(
          (s) => s.fromCameraId !== cameraId && s.toCameraId !== cameraId
        );
      }),

    updateCamera: (cameraId, updates) =>
      set((state) => {
        if (!state.currentProject) return;
        const camera = state.currentProject.cameras.find((c) => c.id === cameraId);
        if (camera) {
          Object.assign(camera, updates);
        }
      }),

    addSwitchPoint: (switchPoint) =>
      set((state) => {
        if (!state.currentProject) return;
        state.currentProject.switchPoints.push({
          ...switchPoint,
          id: `switch-${Date.now()}`,
        });
        state.currentProject.switchPoints.sort((a, b) => a.time - b.time);
      }),

    removeSwitchPoint: (switchPointId) =>
      set((state) => {
        if (!state.currentProject) return;
        state.currentProject.switchPoints = state.currentProject.switchPoints.filter(
          (s) => s.id !== switchPointId
        );
      }),

    updateSwitchPoint: (switchPointId, updates) =>
      set((state) => {
        if (!state.currentProject) return;
        const switchPoint = state.currentProject.switchPoints.find((s) => s.id === switchPointId);
        if (switchPoint) {
          Object.assign(switchPoint, updates);
        }
      }),

    updateSettings: (newSettings) =>
      set((state) => {
        if (!state.currentProject) return;
        Object.assign(state.currentProject.settings, newSettings);
      }),

    syncCameras: (method) =>
      set((state) => {
        if (!state.currentProject) return;
        state.currentProject.settings.syncMethod = method;
      }),

    autoDetectSwitches: () =>
      set((state) => {
        if (!state.currentProject) return;
      }),

    startExport: () => {
      const projectId = get().currentProject?.id;
      if (!projectId) return '';
      
      const jobId = `export-${Date.now()}`;
      const job: MultiCamJob = {
        id: jobId,
        projectId,
        status: 'pending',
        progress: 0,
      };

      set((state) => {
        state.jobs.push(job);
        state.activeJobId = jobId;
      });

      return jobId;
    },

    updateJobProgress: (jobId, progress) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.progress = progress;
          job.status = 'processing';
        }
      }),

    completeJob: (jobId, outputUrl) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'completed';
          job.progress = 100;
          job.outputUrl = outputUrl;
        }
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      }),

    failJob: (jobId, error) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'failed';
          job.error = error;
        }
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      }),

    setSelectedCameras: (cameraIds) =>
      set((state) => {
        state.selectedCameraIds = cameraIds;
      }),

    setCurrentTime: (time) =>
      set((state) => {
        state.currentTime = time;
      }),
  }))
);

export class MultiCamService {
  private static instance: MultiCamService;

  static getInstance(): MultiCamService {
    if (!MultiCamService.instance) {
      MultiCamService.instance = new MultiCamService();
    }
    return MultiCamService.instance;
  }

  getLayouts(): { id: CameraLayout; name: string; description: string }[] {
    return [
      { id: 'switching', name: '切换', description: '自动切换不同机位' },
      { id: 'grid-2x2', name: '2x2网格', description: '4机位网格布局' },
      { id: 'grid-3x3', name: '3x3网格', description: '9机位网格布局' },
      { id: 'pip', name: '画中画', description: '主画面+小窗口' },
      { id: 'split-vertical', name: '垂直分割', description: '左右分屏' },
      { id: 'split-horizontal', name: '水平分割', description: '上下分屏' },
    ];
  }

  getSyncMethods(): { id: SyncMethod; name: string }[] {
    return [
      { id: 'audio', name: '音频同步' },
      { id: 'timecode', name: '时间码同步' },
      { id: 'manual', name: '手动同步' },
      { id: 'auto', name: '自动检测' },
    ];
  }

  getTransitions(): string[] {
    return ['cut', 'dissolve', 'fade', 'wipe', 'zoom'];
  }

  generateFFmpegMultiCamCommand(
    project: MultiCamProject,
    outputPath: string
  ): string {
    const inputs = project.cameras.map((c) => `-i "${c.sourcePath}"`).join(' ');
    
    let filterComplex = '';
    
    if (project.settings.layout === 'switching') {
      const switchPoints = project.switchPoints;
      filterComplex = this.generateSwitchingFilter(project.cameras, switchPoints);
    } else if (project.settings.layout === 'grid-2x2') {
      filterComplex = this.generateGridFilter(project.cameras, 2);
    } else if (project.settings.layout === 'pip') {
      filterComplex = this.generatePIPFilter(project.cameras);
    }
    
    return `ffmpeg ${inputs} -filter_complex "${filterComplex}" -map "[out]" "${outputPath}"`;
  }

  private generateSwitchingFilter(_cameras: CameraSource[], _switchPoints: SwitchPoint[]): string {
    return `[0:v]format=yuv420p[out]`;
  }

  private generateGridFilter(cameras: CameraSource[], gridSize: number): string {
    const inputs = cameras.slice(0, gridSize * gridSize);
    const scaleFilter = inputs.map((_, i) => `[${i}:v]scale=iw/${gridSize}:ih/${gridSize}[v${i}]`).join(';');
    const hstack = inputs.map((_, i) => `[v${i}]`).join('');
    return `${scaleFilter};${hstack}hstack=inputs=${inputs.length}[out]`;
  }

  private generatePIPFilter(cameras: CameraSource[]): string {
    if (cameras.length < 2) return '[0:v][out]';
    return `[0:v][1:v]overlay=W-w-10:H-h-10[out]`;
  }

  estimateExportTime(duration: number, cameraCount: number, layout: CameraLayout): number {
    const baseTime = duration * 0.5;
    const layoutFactor = layout === 'switching' ? 1 : layout.includes('grid') ? 1.5 : 1.2;
    return Math.ceil(baseTime * cameraCount * layoutFactor);
  }
}

export const multiCamService = MultiCamService.getInstance();
