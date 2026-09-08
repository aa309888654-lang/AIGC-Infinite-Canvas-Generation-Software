-- P0: authoritative, restart-safe poster project and generation records.
CREATE TABLE "poster_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '未命名海报',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "textRenderMode" TEXT NOT NULL DEFAULT 'native',
    "messages" TEXT NOT NULL DEFAULT '[]',
    "brief" TEXT,
    "compiledPrompt" TEXT,
    "referenceImages" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "poster_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "poster_brief_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "brief" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "poster_brief_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "poster_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "poster_generation_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "model" TEXT NOT NULL DEFAULT 'gpt-image-2',
    "provider" TEXT,
    "textRenderMode" TEXT NOT NULL DEFAULT 'native',
    "prompt" TEXT NOT NULL,
    "requestPayload" TEXT,
    "providerTaskId" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "poster_generation_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "poster_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "poster_candidates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationRunId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "rank" INTEGER,
    "qualityStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "poster_candidates_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "poster_generation_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "poster_quality_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "engine" TEXT,
    "report" TEXT NOT NULL,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "poster_quality_reports_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "poster_candidates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "poster_projects_userId_updatedAt_idx" ON "poster_projects"("userId", "updatedAt" DESC);
CREATE INDEX "poster_projects_status_idx" ON "poster_projects"("status");
CREATE UNIQUE INDEX "poster_brief_versions_projectId_version_key" ON "poster_brief_versions"("projectId", "version");
CREATE UNIQUE INDEX "poster_generation_runs_idempotencyKey_key" ON "poster_generation_runs"("idempotencyKey");
CREATE INDEX "poster_generation_runs_projectId_createdAt_idx" ON "poster_generation_runs"("projectId", "createdAt");
CREATE INDEX "poster_generation_runs_status_idx" ON "poster_generation_runs"("status");
CREATE INDEX "poster_candidates_generationRunId_rank_idx" ON "poster_candidates"("generationRunId", "rank");
CREATE INDEX "poster_quality_reports_candidateId_createdAt_idx" ON "poster_quality_reports"("candidateId", "createdAt");
CREATE INDEX "poster_quality_reports_degraded_idx" ON "poster_quality_reports"("degraded");
