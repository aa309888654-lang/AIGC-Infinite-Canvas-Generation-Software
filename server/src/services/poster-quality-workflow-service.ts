import prisma from '../lib/prisma';
import {
  inspectPosterQuality,
  type PosterQualityInspectionInput,
  type PosterQualityInspectionResult,
} from './poster-quality-inspection-service';
import { persistPosterQualityReport } from './poster-project-service';

function parseBriefExpectedText(briefValue: string | null): PosterQualityInspectionInput['expectedText'] {
  if (!briefValue) return undefined;
  try {
    const parsed: unknown = JSON.parse(briefValue);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const brief = parsed as Record<string, unknown>;
    if (!brief.textBlocks || typeof brief.textBlocks !== 'object') return undefined;
    const text = brief.textBlocks as Record<string, unknown>;
    const value = (key: string): string | undefined => typeof text[key] === 'string' ? text[key] as string : undefined;
    return {
      title: value('title'),
      subtitle: value('subtitle'),
      organizer: value('organizer'),
      date: value('date'),
      location: value('location'),
      contact: value('contact'),
      cta: value('cta'),
      description: value('body'),
      benefits: Array.isArray(text.benefits)
        ? text.benefits.filter((item): item is string => typeof item === 'string')
        : [],
    };
  } catch {
    return undefined;
  }
}

export async function inspectPosterGenerationCandidate(options: {
  runId: string;
  userId: string;
  imageUrl: string;
  tier?: string;
}): Promise<{ candidateId: string; report: PosterQualityInspectionResult }> {
  const run = await prisma.posterGenerationRun.findFirst({
    where: { id: options.runId, project: { userId: options.userId } },
    include: { project: { select: { brief: true } }, candidates: true },
  });
  if (!run) throw new Error('海报生成运行不存在或无权访问');

  const existing = run.candidates.find((candidate) => candidate.imageUrl === options.imageUrl);
  const candidate = existing || await prisma.posterCandidate.create({
    data: {
      generationRunId: run.id,
      imageUrl: options.imageUrl,
      rank: run.candidates.length + 1,
      status: 'generated',
    },
  });
  const report = await inspectPosterQuality({
    imageUrl: options.imageUrl,
    tier: options.tier || 'standard',
    expectedText: parseBriefExpectedText(run.project.brief),
  });
  await persistPosterQualityReport({
    candidateId: candidate.id,
    report,
    engine: [report.engine.ocr, report.engine.vlm].filter(Boolean).join('/'),
    degraded: report.degraded,
  });
  const qualityStatus = report.degraded ? 'quality_degraded' : report.passed ? 'quality_passed' : 'quality_failed';
  await prisma.$transaction([
    prisma.posterCandidate.update({ where: { id: candidate.id }, data: { qualityStatus } }),
    prisma.posterGenerationRun.update({ where: { id: run.id }, data: { status: qualityStatus } }),
  ]);
  return { candidateId: candidate.id, report };
}
