import { API_BASE_URL } from '@/lib/api-config';
import { generateId } from '@/lib/utils';
import { getViteEnvValue } from '@/lib/vite-env';

const LOCAL_STORAGE_KEY = 'canvas-projects-local';
const ACTIVE_PROJECT_KEY = 'canvas-active-project-id';
const ACTIVE_PROJECT_META_KEY = 'canvas-active-project-meta';
const CLOUD_SYNCED_KEY = 'canvas-cloud-synced-ids';
const LOCAL_MAX_PROJECTS = 120;
const LOCAL_AUTO_SAVE_INTERVAL = 60_000;
const CLOUD_AUTO_SAVE_INTERVAL = 300_000;
const LOCAL_STORAGE_SOFT_LIMIT = 4_200_000;
const HEAVY_DATA_URL_RE = /^data:(image|video|audio)\//i;

interface ActiveCanvasProjectMeta {
  projectId: string;
  projectRoot: string | null;
  manifestPath: string | null;
}

function resolveCanvasApiBase(): string {
  const omniRouteUrl = getViteEnvValue('VITE_OMNIROUTE_URL');
  if (omniRouteUrl) {
    return omniRouteUrl.endsWith('/api/v1')
      ? omniRouteUrl
      : `${omniRouteUrl.replace(/\/$/, '')}/api/v1`;
  }
  return API_BASE_URL;
}

const API_BASE = resolveCanvasApiBase();

function getAuthToken(): string | null {
  try {
    return localStorage.getItem('authToken') || localStorage.getItem('auth-token') || localStorage.getItem('token');
  } catch {
    return null;
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const TRANSIENT_NODE_KEYS = [
  'measured',
  'selected',
  'dragging',
  'isConnectable',
  'positionAbsolute',
  'zIndex',
] as const;

interface CanvasProjectMeta {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  isFavorite: boolean;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
  revision?: number;
  syncConflict?: 'conflict_requires_reload';
}

interface CanvasProjectData extends CanvasProjectMeta {
  nodes: unknown[];
  edges: unknown[];
  viewport?: { x: number; y: number; zoom: number };
}

type GetCurrentDataFn = () => {
  nodes: unknown[];
  edges: unknown[];
  viewport?: { x: number; y: number; zoom: number };
};

function compactValue(value: unknown): unknown {
  if (typeof value === 'string' && HEAVY_DATA_URL_RE.test(value)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => compactValue(item))
      .filter((item) => item !== undefined);
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const compacted = compactValue(child);
      if (compacted !== undefined) output[key] = compacted;
    }
    return output;
  }
  return value;
}

function compactNodeData(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned = compactValue(data) as Record<string, unknown>;
  for (const key of ['previewDataUrl', 'thumbnailDataUrl', 'imageDataUrl', 'videoDataUrl', 'audioDataUrl']) {
    delete cleaned[key];
  }
  return cleaned;
}

function compressNodes(nodes: unknown[]): unknown[] {
  return nodes.map((node) => {
    const cleaned = { ...(node as Record<string, unknown>) };
    for (const key of TRANSIENT_NODE_KEYS) {
      delete cleaned[key];
    }
    if (cleaned.data && typeof cleaned.data === 'object') {
      const data = compactNodeData(cleaned.data as Record<string, unknown>);
      delete data.measured;
      delete data.selected;
      cleaned.data = data;
    }
    return cleaned;
  });
}

function compressProject(project: CanvasProjectData): CanvasProjectData {
  return {
    ...project,
    nodes: compressNodes(project.nodes),
  };
}

function nowISO(): string {
  return new Date().toISOString();
}

class CanvasProjectService {
  private localAutoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private cloudAutoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private getCurrentData: GetCurrentDataFn | null = null;
  private debouncedSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly DEBOUNCED_SAVE_MS = 3_000;

  getLocalStore(): CanvasProjectData[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as CanvasProjectData[];
    } catch {
      return [];
    }
  }

  private setLocalStore(projects: CanvasProjectData[]): void {
    const sorted = [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    let next = sorted;
    let payload = JSON.stringify(next);

    while (payload.length > LOCAL_STORAGE_SOFT_LIMIT && next.length > 1) {
      next = next.slice(0, Math.max(1, Math.floor(next.length * 0.75)));
      payload = JSON.stringify(next);
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, payload);
    } catch (err) {
      try {
        const minimal = next.slice(0, 12).map((project) => ({
          ...project,
          nodes: project.id === this.getCurrentProjectId() ? project.nodes : [],
          edges: project.id === this.getCurrentProjectId() ? project.edges : [],
        }));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(minimal));
        console.warn('[CanvasProjectService] localStorage 空间不足，已自动保留当前项目和最近项目索引');
      } catch (fallbackErr) {
        console.warn('[CanvasProjectService] localStorage 写入失败，已跳过本次本地保存:', fallbackErr || err);
      }
    }
  }

  private evictOldLocal(projects: CanvasProjectData[]): CanvasProjectData[] {
    if (projects.length <= LOCAL_MAX_PROJECTS) return projects;
    const sorted = [...projects].sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? 1 : -1;
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });
    return sorted.slice(projects.length - LOCAL_MAX_PROJECTS);
  }

  saveLocal(project: CanvasProjectData): void {
    const compressed = compressProject(project);
    const projects = this.getLocalStore();
    const index = projects.findIndex((p) => p.id === compressed.id);
    if (index >= 0) {
      projects[index] = compressed;
    } else {
      projects.push(compressed);
    }
    const evicted = this.evictOldLocal(projects);
    this.setLocalStore(evicted);
  }

  loadLocal(id: string): CanvasProjectData | null {
    const projects = this.getLocalStore();
    return projects.find((p) => p.id === id) ?? null;
  }

  listLocal(): CanvasProjectMeta[] {
    const projects = this.getLocalStore();
    return projects.map(({ nodes, edges, viewport, ...meta }) => ({
      ...meta,
      nodeCount: nodes?.length ?? 0,
    }));
  }

  deleteLocal(id: string): void {
    const projects = this.getLocalStore().filter((p) => p.id !== id);
    this.setLocalStore(projects);
  }

  clearOldLocal(): void {
    const projects = this.getLocalStore();
    const evicted = this.evictOldLocal(projects);
    if (evicted.length < projects.length) {
      this.setLocalStore(evicted);
    }
  }

  async saveCloud(project: CanvasProjectData): Promise<void> {
    const compressed = compressProject(project);
    const syncedIds = this.getCloudSyncedIds();
    const isSynced = syncedIds.has(project.id);
    if (isSynced) {
      try {
        const revision = project.revision;
        if (!Number.isInteger(revision)) {
          project.syncConflict = 'conflict_requires_reload';
          this.saveLocal(project);
          throw new Error('conflict_requires_reload');
        }
        const saved = await apiRequest<{ data?: CanvasProjectData }>(`/canvas-project/${project.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...compressed, revision }),
        });
        if (saved.data?.revision !== undefined) {
          project.revision = saved.data.revision;
          delete project.syncConflict;
          this.saveLocal(project);
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'HTTP 409') {
          project.syncConflict = 'conflict_requires_reload';
          this.saveLocal(project);
          throw new Error('conflict_requires_reload');
        }
        if (err instanceof Error && err.message === 'HTTP 404') {
          const created = await apiRequest<{ data?: CanvasProjectData }>('/canvas-project', {
            method: 'POST',
            body: JSON.stringify(compressed),
          });
          if (created.data?.revision !== undefined) {
            project.revision = created.data.revision;
            delete project.syncConflict;
            this.saveLocal(project);
          }
        } else {
          throw err;
        }
      }
    } else {
      const created = await apiRequest<{ data?: CanvasProjectData }>('/canvas-project', {
        method: 'POST',
        body: JSON.stringify(compressed),
      });
      if (created.data?.revision !== undefined) {
        project.revision = created.data.revision;
        delete project.syncConflict;
        this.saveLocal(project);
      }
      this.markCloudSynced(project.id);
    }
  }

  async loadCloud(id: string): Promise<CanvasProjectData | null> {
    try {
      const res = await apiRequest<{ data?: CanvasProjectData }>(
        `/canvas-project/${id}`,
        { method: 'GET' }
      );
      return res?.data ?? null;
    } catch {
      return null;
    }
  }

  async listCloud(): Promise<CanvasProjectMeta[]> {
    try {
      const res = await apiRequest<{ data?: CanvasProjectMeta[] }>(
        '/canvas-project',
        { method: 'GET' }
      );
      return res?.data ?? [];
    } catch {
      return [];
    }
  }

  async deleteCloud(id: string): Promise<void> {
    try {
      await apiRequest(`/canvas-project/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('[CanvasProjectService] 云端删除失败:', err);
    }
  }

  async syncToCloud(localProject: CanvasProjectData): Promise<void> {
    try {
      await this.saveCloud(localProject);
    } catch (err) {
      console.warn('[CanvasProjectService] 同步到云端失败:', err);
    }
  }

  getCurrentProjectId(): string | null {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  }

  getActiveProjectMeta(): ActiveCanvasProjectMeta | null {
    try {
      const raw = localStorage.getItem(ACTIVE_PROJECT_META_KEY);
      return raw ? JSON.parse(raw) as ActiveCanvasProjectMeta : null;
    } catch {
      return null;
    }
  }

  setCurrentProjectId(id: string | null): void {
    if (id) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  }

  private setActiveProjectMeta(meta: ActiveCanvasProjectMeta | null): void {
    if (meta) {
      localStorage.setItem(ACTIVE_PROJECT_META_KEY, JSON.stringify(meta));
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_META_KEY);
    }
  }

  private getCloudSyncedIds(): Set<string> {
    try {
      const raw = localStorage.getItem(CLOUD_SYNCED_KEY);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set();
    }
  }

  private markCloudSynced(id: string): void {
    const ids = this.getCloudSyncedIds();
    ids.add(id);
    localStorage.setItem(CLOUD_SYNCED_KEY, JSON.stringify([...ids]));
  }

  private unmarkCloudSynced(id: string): void {
    const ids = this.getCloudSyncedIds();
    ids.delete(id);
    localStorage.setItem(CLOUD_SYNCED_KEY, JSON.stringify([...ids]));
  }

  initProject(name?: string): string {
    const id = generateId();
    const timestamp = nowISO();
    const projectRoot = `projects/${id}`;
    const project: CanvasProjectData = {
      id,
      name: name ?? `未命名项目 ${new Date().toLocaleString('zh-CN')}`,
      isFavorite: false,
      nodeCount: 0,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.saveLocal(project);
    this.setCurrentProjectId(id);
    this.setActiveProjectMeta({
      projectId: id,
      projectRoot,
      manifestPath: `${projectRoot}/project.manifest.json`,
    });
    return id;
  }

  async loadProject(id: string): Promise<CanvasProjectData | null> {
    const local = this.loadLocal(id);
    if (local) {
      this.setCurrentProjectId(id);
      this.setActiveProjectMeta({
        projectId: id,
        projectRoot: `projects/${id}`,
        manifestPath: `projects/${id}/project.manifest.json`,
      });
      return local;
    }
    const cloud = await this.loadCloud(id);
    if (cloud) {
      this.saveLocal(cloud);
      this.setCurrentProjectId(id);
      this.setActiveProjectMeta({
        projectId: id,
        projectRoot: `projects/${id}`,
        manifestPath: `projects/${id}/project.manifest.json`,
      });
    }
    return cloud;
  }

  async listProjects(): Promise<CanvasProjectMeta[]> {
    const localMetas = this.listLocal();
    let cloudMetas: CanvasProjectMeta[] = [];
    try {
      cloudMetas = await this.listCloud();
    } catch {
      // 云端不可用时仅返回本地列表
    }

    const merged = new Map<string, CanvasProjectMeta>();
    for (const meta of localMetas) {
      merged.set(meta.id, meta);
    }
    for (const meta of cloudMetas) {
      if (!merged.has(meta.id)) {
        merged.set(meta.id, meta);
      }
    }

    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async deleteProject(id: string): Promise<void> {
    this.deleteLocal(id);
    this.unmarkCloudSynced(id);
    await this.deleteCloud(id);
    if (this.getCurrentProjectId() === id) {
      this.setCurrentProjectId(null);
      this.setActiveProjectMeta(null);
    }
  }

  renameProject(id: string, name: string): void {
    const projects = this.getLocalStore();
    const project = projects.find((p) => p.id === id);
    if (project) {
      project.name = name;
      project.updatedAt = nowISO();
      this.setLocalStore(projects);
    }
    this.saveCloud({ ...project!, name, updatedAt: nowISO() }).catch(() => { /* noop */ });
  }

  startAutoSave(getCurrentData: GetCurrentDataFn): void {
    this.stopAutoSave();
    this.getCurrentData = getCurrentData;

    this.localAutoSaveTimer = setInterval(() => {
      this.performLocalSave();
    }, LOCAL_AUTO_SAVE_INTERVAL);

    this.cloudAutoSaveTimer = setInterval(() => {
      this.performCloudSave();
    }, CLOUD_AUTO_SAVE_INTERVAL);
  }

  stopAutoSave(): void {
    if (this.localAutoSaveTimer) {
      clearInterval(this.localAutoSaveTimer);
      this.localAutoSaveTimer = null;
    }
    if (this.cloudAutoSaveTimer) {
      clearInterval(this.cloudAutoSaveTimer);
      this.cloudAutoSaveTimer = null;
    }
    if (this.debouncedSaveTimer) {
      clearTimeout(this.debouncedSaveTimer);
      this.debouncedSaveTimer = null;
    }
  }

  saveNow(): void {
    if (this.debouncedSaveTimer) {
      clearTimeout(this.debouncedSaveTimer);
      this.debouncedSaveTimer = null;
    }
    this.performLocalSave();
    this.performCloudSave();
  }

  scheduleDebouncedSave(): void {
    if (this.debouncedSaveTimer) {
      clearTimeout(this.debouncedSaveTimer);
    }
    this.debouncedSaveTimer = setTimeout(() => {
      this.debouncedSaveTimer = null;
      this.performLocalSave();
    }, CanvasProjectService.DEBOUNCED_SAVE_MS);
  }

  flushDebouncedSave(): void {
    if (this.debouncedSaveTimer) {
      clearTimeout(this.debouncedSaveTimer);
      this.debouncedSaveTimer = null;
    }
    this.performLocalSave();
  }

  private performLocalSave(): void {
    if (!this.getCurrentData) return;

    let projectId = this.getCurrentProjectId();
    const { nodes, edges, viewport } = this.getCurrentData();

    if (!projectId && nodes.length > 0) {
      projectId = this.initProject();
    }
    if (!projectId) return;

    const existing = this.loadLocal(projectId);
    const timestamp = nowISO();

    const project: CanvasProjectData = {
      id: projectId,
      name: existing?.name ?? '未命名项目',
      description: existing?.description,
      thumbnail: existing?.thumbnail,
      isFavorite: existing?.isFavorite ?? false,
      nodeCount: nodes.length,
      nodes,
      edges,
      viewport,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      revision: existing?.revision,
      syncConflict: existing?.syncConflict,
    };

    this.saveLocal(project);
  }

  private performCloudSave(): void {
    if (!this.getCurrentData) return;

    let projectId = this.getCurrentProjectId();
    const { nodes, edges, viewport } = this.getCurrentData();

    if (!projectId && nodes.length > 0) {
      projectId = this.initProject();
    }
    if (!projectId) return;

    const existing = this.loadLocal(projectId);
    const timestamp = nowISO();

    const project: CanvasProjectData = {
      id: projectId,
      name: existing?.name ?? '未命名项目',
      description: existing?.description,
      thumbnail: existing?.thumbnail,
      isFavorite: existing?.isFavorite ?? false,
      nodeCount: nodes.length,
      nodes,
      edges,
      viewport,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      revision: existing?.revision,
      syncConflict: existing?.syncConflict,
    };

    this.syncToCloud(project);
  }
}

export const canvasProjectService = new CanvasProjectService();
