import prisma from '../lib/prisma';

export interface ProjectContextCanvasSnapshot {
  nodes: Record<string, any>[];
  edges: Record<string, any>[];
}

export interface ProjectContextSnapshot {
  projectId?: string;
  sessionId?: string;
  revision: number;
  updatedAt: number;
  canvas: ProjectContextCanvasSnapshot;
}

export interface ProjectContextIdentity {
  /** CanvasProject owner. Required whenever projectId is supplied. */
  userId?: string;
  projectId?: string;
  /** Compatibility correlation id only. It is never used as the production key. */
  sessionId?: string;
}

export interface ProjectContextUpsert extends ProjectContextIdentity {
  canvas: ProjectContextCanvasSnapshot;
}

export interface ProjectContextStore {
  get(key: string): Promise<ProjectContextSnapshot | undefined>;
  set(key: string, snapshot: ProjectContextSnapshot): Promise<void>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function legacyKey(sessionId: string): string {
  return `session:${sessionId}`;
}

/** Explicitly injectable test/development fallback. Never selected for projectId requests. */
export class MemoryProjectContextStore implements ProjectContextStore {
  private readonly contexts = new Map<string, ProjectContextSnapshot>();

  async get(key: string): Promise<ProjectContextSnapshot | undefined> {
    const value = this.contexts.get(key);
    return value ? clone(value) : undefined;
  }

  async set(key: string, snapshot: ProjectContextSnapshot): Promise<void> {
    this.contexts.set(key, clone(snapshot));
  }
}

class DisabledLegacyProjectContextStore implements ProjectContextStore {
  async get(): Promise<undefined> { return undefined; }
  async set(): Promise<void> { throw new Error('session_canvas_fallback_disabled'); }
}

type CanvasProjectDelegate = {
  findFirst(args: any): Promise<any>;
  updateMany(args: any): Promise<{ count: number }>;
};

/**
 * CanvasProject adapter. `nodes` and `edges` in Prisma are the canonical state;
 * no process-local cache is consulted for project-backed reads or writes.
 */
export class PrismaCanvasProjectContextStore {
  constructor(private readonly canvasProject: CanvasProjectDelegate = prisma.canvasProject as any) {}

  async read(identity: Required<Pick<ProjectContextIdentity, 'projectId' | 'userId'>> & Pick<ProjectContextIdentity, 'sessionId'>): Promise<ProjectContextSnapshot | undefined> {
    const project = await this.canvasProject.findFirst({
      where: { id: identity.projectId, userId: identity.userId },
      select: { id: true, nodes: true, edges: true, revision: true, updatedAt: true },
    });
    if (!project) return undefined;

    return {
      projectId: project.id,
      sessionId: identity.sessionId,
      revision: project.revision,
      updatedAt: project.updatedAt.getTime(),
      canvas: {
        nodes: parseCanvasArray(project.nodes),
        edges: parseCanvasArray(project.edges),
      },
    };
  }

  async mutate(
    identity: Required<Pick<ProjectContextIdentity, 'projectId' | 'userId'>> & Pick<ProjectContextIdentity, 'sessionId'>,
    mutator: (canvas: ProjectContextCanvasSnapshot) => ProjectContextCanvasSnapshot | void,
  ): Promise<ProjectContextSnapshot | undefined> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await this.read(identity);
      if (!current) return undefined;
      const canvas = clone(current.canvas);
      const next = mutator(canvas) || canvas;
      const updated = await this.canvasProject.updateMany({
        where: { id: identity.projectId, userId: identity.userId, revision: current.revision },
        data: {
          nodes: JSON.stringify(next.nodes),
          edges: JSON.stringify(next.edges),
          revision: { increment: 1 },
        },
      });
      if (updated.count === 1) {
        const saved = await this.read(identity);
        if (saved) return saved;
      }
    }
    throw new Error('canvas_project_concurrent_update_conflict');
  }
}

function parseCanvasArray(value: string): Record<string, any>[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class ProjectContextService {
  private readonly prismaStore: PrismaCanvasProjectContextStore;
  private readonly legacyStore: ProjectContextStore;

  constructor(options: { canvasProject?: CanvasProjectDelegate; legacyStore?: ProjectContextStore } = {}) {
    this.prismaStore = new PrismaCanvasProjectContextStore(options.canvasProject);
    this.legacyStore = options.legacyStore || (
      process.env.ALLOW_SESSION_CANVAS_FALLBACK === 'true'
        ? new MemoryProjectContextStore()
        : new DisabledLegacyProjectContextStore()
    );
  }

  async read(identity: ProjectContextIdentity): Promise<ProjectContextSnapshot | undefined> {
    if (identity.projectId) {
      if (!identity.userId) throw new Error('userId_required_for_project_context');
      const snapshot = await this.prismaStore.read({ projectId: identity.projectId, userId: identity.userId, sessionId: identity.sessionId });
      if (!snapshot) throw new Error('canvas_project_not_found_or_forbidden');
      return snapshot;
    }
    if (!identity.sessionId) return undefined;
    return this.legacyStore.get(legacyKey(identity.sessionId));
  }

  async upsert(input: ProjectContextUpsert): Promise<ProjectContextSnapshot> {
    if (input.projectId) {
      if (!input.userId) throw new Error('userId_required_for_project_context');
      const saved = await this.prismaStore.mutate(
        { projectId: input.projectId, userId: input.userId, sessionId: input.sessionId },
        () => clone(input.canvas),
      );
      if (!saved) throw new Error('canvas_project_not_found_or_forbidden');
      return saved;
    }
    if (!input.sessionId) throw new Error('projectId_or_sessionId_required');
    const key = legacyKey(input.sessionId);
    const previous = await this.legacyStore.get(key);
    const snapshot: ProjectContextSnapshot = {
      sessionId: input.sessionId,
      revision: (previous?.revision || 0) + 1,
      updatedAt: Date.now(),
      canvas: clone(input.canvas),
    };
    await this.legacyStore.set(key, snapshot);
    return snapshot;
  }

  async mutateProject(
    identity: ProjectContextIdentity,
    mutator: (canvas: ProjectContextCanvasSnapshot) => ProjectContextCanvasSnapshot | void,
    canvasProject?: CanvasProjectDelegate,
  ): Promise<ProjectContextSnapshot> {
    if (identity.projectId) {
      if (!identity.userId) throw new Error('userId_required_for_project_context');
      const store = canvasProject ? new PrismaCanvasProjectContextStore(canvasProject) : this.prismaStore;
      const saved = await store.mutate(
        { projectId: identity.projectId, userId: identity.userId, sessionId: identity.sessionId },
        mutator,
      );
      if (!saved) throw new Error('canvas_project_not_found_or_forbidden');
      return saved;
    }
    const current = await this.read(identity);
    const canvas = clone(current?.canvas || { nodes: [], edges: [] });
    return this.upsert({ ...identity, canvas: mutator(canvas) || canvas });
  }

  async summarize(identity: ProjectContextIdentity) {
    const snapshot = await this.read(identity);
    const nodes = snapshot?.canvas.nodes || [];
    const edges = snapshot?.canvas.edges || [];
    const statusCount = (status: string) => nodes.filter((node) => String(node?.status || '').toLowerCase() === status).length;
    const keyNodes = nodes.slice(0, 20).map((node) => ({
      id: String(node?.id || ''),
      type: String(node?.type || node?.nodeType || ''),
      label: String(node?.data?.label || node?.label || '').slice(0, 120),
      status: String(node?.data?.status || node?.status || ''),
      selected: node?.selected === true,
    }));
    return {
      projectId: snapshot?.projectId,
      sessionId: snapshot?.sessionId,
      revision: snapshot?.revision || 0,
      updatedAt: snapshot?.updatedAt,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      runningCount: statusCount('running'),
      failedCount: statusCount('failed'),
      completedCount: statusCount('completed'),
      keyNodes,
      edges: edges.slice(0, 30).map((edge) => ({
        id: String(edge?.id || ''),
        source: String(edge?.source || ''),
        sourceHandle: edge?.sourceHandle ? String(edge.sourceHandle) : undefined,
        target: String(edge?.target || ''),
        targetHandle: edge?.targetHandle ? String(edge.targetHandle) : undefined,
      })),
    };
  }
}

export const projectContextService = new ProjectContextService();
