CREATE TABLE "mimomi_dialogue_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "guestId" TEXT,
    "sessionId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "provider" TEXT,
    "safetyCategory" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "eligibleForImprovement" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mimomi_dialogue_records_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "mimomi_dialogue_records_sessionId_createdAt_idx"
  ON "mimomi_dialogue_records"("sessionId", "createdAt");
CREATE INDEX "mimomi_dialogue_records_channel_createdAt_idx"
  ON "mimomi_dialogue_records"("channel", "createdAt");
CREATE INDEX "mimomi_dialogue_records_blocked_eligibleForImprovement_createdAt_idx"
  ON "mimomi_dialogue_records"("blocked", "eligibleForImprovement", "createdAt");
CREATE INDEX "mimomi_dialogue_records_userId_createdAt_idx"
  ON "mimomi_dialogue_records"("userId", "createdAt");
