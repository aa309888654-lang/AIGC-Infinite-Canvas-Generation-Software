import { randomUUID } from 'crypto';
import prisma from '../lib/prisma';

export type PosterChatRole = 'user' | 'assistant';

export interface PosterChatMessage {
  role: PosterChatRole;
  content: string;
}

export interface PosterBriefV2 {
  designMode?: 'template' | 'free';
  sessionId?: string;
  userGoal?: string;
  posterType?: string;
  aspectRatio?: string;
  textBlocks?: {
    title?: string;
    subtitle?: string;
    body?: string;
    date?: string;
    location?: string;
    organizer?: string;
    contact?: string;
    cta?: string;
    benefits?: string[];
  };
  visualDirection?: {
    style?: string[];
    colorTone?: string[];
    mood?: string[];
    heroSubject?: string;
    composition?: string;
    materials?: string[];
    lighting?: string;
  };
  brandKit?: {
    name?: string;
    colors?: string[];
    logoAssetId?: string;
    qrAssetId?: string;
  };
  constraints?: {
    mustHave?: string[];
    mustAvoid?: string[];
    referenceAssetIds?: string[];
  };
}

export interface HomePosterSession {
  sessionId: string;
  userId: string;
  messages: PosterChatMessage[];
  brief?: PosterBriefV2;
  compiledPrompt?: string;
  referenceImages: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PosterGenerationRunInput {
  projectId: string;
  idempotencyKey: string;
  prompt: string;
  requestPayload: Record<string, unknown>;
  model: 'doubao-seedream-5-0-lite' | 'doubao-seedream-5-0-pro';
  provider: string;
  templateId?: string;
  versions: {
    promptCompiler: string;
    layoutRules: string;
    qualityRules: string;
    refinement: string;
  };
}

export interface PosterGenerationRunRecord {
  id: string;
  status: string;
  providerTaskId: string | null;
  imageUrls: string[];
  created: boolean;
}

export interface PosterProjectRecoveryState {
  session: HomePosterSession;
  runs: Array<{
    id: string;
    status: string;
    providerTaskId: string | null;
    model: string;
    textRenderMode: string;
    imageUrls: string[];
    createdAt: number;
    templateId: string | null;
    promptVersion: string;
    layoutRuleVersion: string;
    qualityRuleVersion: string;
    refinementVersion: string;
  }>;
}

function parseJsonArray<T>(value: string, isValid: (item: unknown) => item is T): T[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isValid) : [];
  } catch {
    return [];
  }
}

function isPosterMessage(value: unknown): value is PosterChatMessage {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string';
}

function parseBrief(value: string | null): PosterBriefV2 | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as PosterBriefV2 : undefined;
  } catch {
    return undefined;
  }
}

function toSession(project: {
  id: string;
  userId: string;
  messages: string;
  brief: string | null;
  compiledPrompt: string | null;
  referenceImages: string;
  createdAt: Date;
  updatedAt: Date;
}): HomePosterSession {
  return {
    sessionId: project.id,
    userId: project.userId,
    messages: parseJsonArray(project.messages, isPosterMessage),
    brief: parseBrief(project.brief),
    compiledPrompt: project.compiledPrompt || undefined,
    referenceImages: parseJsonArray(project.referenceImages, (item): item is string => typeof item === 'string'),
    createdAt: project.createdAt.getTime(),
    updatedAt: project.updatedAt.getTime(),
  };
}

function projectName(session: HomePosterSession): string {
  return session.brief?.textBlocks?.title?.slice(0, 80) || '未命名海报';
}

export async function createPosterProject(userId: string): Promise<HomePosterSession> {
  const project = await prisma.posterProject.create({
    data: {
      id: `hp_${randomUUID()}`,
      userId,
      textRenderMode: 'native',
    },
  });
  return toSession(project);
}

export async function getPosterProject(sessionId: string, userId: string): Promise<HomePosterSession | null> {
  const project = await prisma.posterProject.findFirst({
    where: { id: sessionId, userId },
  });
  return project ? toSession(project) : null;
}

export async function getPosterProjectRecoveryState(
  sessionId: string,
  userId: string,
): Promise<PosterProjectRecoveryState | null> {
  const project = await prisma.posterProject.findFirst({
    where: { id: sessionId, userId },
    include: {
      generationRuns: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { candidates: { orderBy: { rank: 'asc' } } },
      },
    },
  });
  if (!project) return null;
  return {
    session: toSession(project),
    runs: project.generationRuns.map((run) => ({
      id: run.id,
      status: run.status,
      providerTaskId: run.providerTaskId,
      model: run.model,
      textRenderMode: run.textRenderMode,
      imageUrls: run.candidates.map((candidate) => candidate.imageUrl),
      createdAt: run.createdAt.getTime(),
      templateId: run.templateId,
      promptVersion: run.promptVersion,
      layoutRuleVersion: run.layoutRuleVersion,
      qualityRuleVersion: run.qualityRuleVersion,
      refinementVersion: run.refinementVersion,
    })),
  };
}

export async function savePosterProject(session: HomePosterSession): Promise<void> {
  const brief = session.brief ? JSON.stringify(session.brief) : null;
  await prisma.$transaction(async (tx) => {
    const project = await tx.posterProject.findUnique({
      where: { id: session.sessionId },
      select: { brief: true },
    });
    if (!project || project.brief !== brief) {
      const latest = await tx.posterBriefVersion.findFirst({
        where: { projectId: session.sessionId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      if (brief) {
        await tx.posterBriefVersion.create({
          data: {
            projectId: session.sessionId,
            version: (latest?.version || 0) + 1,
            brief,
          },
        });
      }
    }
    await tx.posterProject.update({
      where: { id: session.sessionId },
      data: {
        name: projectName(session),
        messages: JSON.stringify(session.messages),
        brief,
        compiledPrompt: session.compiledPrompt || null,
        referenceImages: JSON.stringify(session.referenceImages.slice(-4)),
        status: 'draft',
        textRenderMode: 'native',
      },
    });
  });
}

export async function getOrCreateGenerationRun(input: PosterGenerationRunInput): Promise<PosterGenerationRunRecord> {
  const existing = await prisma.posterGenerationRun.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { candidates: { orderBy: { rank: 'asc' } } },
  });
  if (existing) {
    if (existing.projectId !== input.projectId) throw new Error('生成请求幂等键冲突');
    return {
      id: existing.id,
      status: existing.status,
      providerTaskId: existing.providerTaskId,
      imageUrls: existing.candidates.map((candidate) => candidate.imageUrl),
      created: false,
    };
  }

  const run = await prisma.posterGenerationRun.create({
    data: {
      projectId: input.projectId,
      idempotencyKey: input.idempotencyKey,
      model: input.model,
      provider: input.provider,
      textRenderMode: 'native',
      prompt: input.prompt,
      requestPayload: JSON.stringify(input.requestPayload),
      templateId: input.templateId || null,
      promptVersion: input.versions.promptCompiler,
      layoutRuleVersion: input.versions.layoutRules,
      qualityRuleVersion: input.versions.qualityRules,
      refinementVersion: input.versions.refinement,
    },
  });
  return { id: run.id, status: run.status, providerTaskId: null, imageUrls: [], created: true };
}

export async function completePosterGenerationRun(options: {
  runId: string;
  status: 'queued' | 'completed' | 'failed';
  providerTaskId?: string;
  imageUrls?: string[];
  error?: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.posterGenerationRun.update({
      where: { id: options.runId },
      data: {
        status: options.status,
        providerTaskId: options.providerTaskId || null,
        error: options.error || null,
      },
    });
    if (options.status === 'completed' && options.imageUrls?.length) {
      await tx.posterCandidate.deleteMany({ where: { generationRunId: options.runId } });
      await tx.posterCandidate.createMany({
        data: options.imageUrls.map((imageUrl, index) => ({
          generationRunId: options.runId,
          imageUrl,
          rank: index + 1,
          status: 'generated',
        })),
      });
    }
  });
}

export async function persistPosterQualityReport(options: {
  candidateId: string;
  report: unknown;
  engine?: string;
  degraded: boolean;
}): Promise<void> {
  await prisma.posterQualityReport.create({
    data: {
      candidateId: options.candidateId,
      report: JSON.stringify(options.report),
      engine: options.engine || null,
      degraded: options.degraded,
      status: options.degraded ? 'degraded' : 'completed',
    },
  });
}
