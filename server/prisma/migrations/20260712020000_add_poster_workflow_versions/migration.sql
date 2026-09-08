ALTER TABLE "poster_generation_runs" ADD COLUMN "templateId" TEXT;
ALTER TABLE "poster_generation_runs" ADD COLUMN "promptVersion" TEXT NOT NULL DEFAULT 'gpt-image-2-native-text-v1';
ALTER TABLE "poster_generation_runs" ADD COLUMN "layoutRuleVersion" TEXT NOT NULL DEFAULT 'poster-layout-v1';
ALTER TABLE "poster_generation_runs" ADD COLUMN "qualityRuleVersion" TEXT NOT NULL DEFAULT 'poster-three-gates-v1';
ALTER TABLE "poster_generation_runs" ADD COLUMN "refinementVersion" TEXT NOT NULL DEFAULT 'gpt-image-2-native-refine-v1';

CREATE INDEX "poster_generation_runs_templateId_idx" ON "poster_generation_runs"("templateId");
