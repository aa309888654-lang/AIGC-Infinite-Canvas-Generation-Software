ALTER TABLE "tasks" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "tasks" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "tasks" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "tasks" ADD COLUMN "reviewNote" TEXT;

CREATE INDEX "tasks_reviewStatus_idx" ON "tasks"("reviewStatus");
