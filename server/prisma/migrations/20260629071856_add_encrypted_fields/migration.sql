-- AlterTable
ALTER TABLE "points_transactions" ADD COLUMN "expiresAt" DATETIME;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "emailCipher" TEXT;
ALTER TABLE "users" ADD COLUMN "emailHash" TEXT;
ALTER TABLE "users" ADD COLUMN "phoneCipher" TEXT;
ALTER TABLE "users" ADD COLUMN "phoneHash" TEXT;

-- CreateTable
CREATE TABLE "mimomi_emotion_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "emotion" TEXT NOT NULL DEFAULT 'calm',
    "intensity" INTEGER NOT NULL DEFAULT 40,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mimomi_emotion_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mimomi_emotion_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stateId" TEXT,
    "emotion" TEXT NOT NULL,
    "intensity" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "eventData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mimomi_emotion_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mimomi_emotion_events_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "mimomi_emotion_states" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mimomi_user_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "objectName" TEXT NOT NULL,
    "profileVersion" INTEGER NOT NULL DEFAULT 1,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "lastSummaryAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mimomi_user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mimomi_memories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "objectName" TEXT NOT NULL,
    "summary" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "vectorId" TEXT,
    "importance" REAL NOT NULL DEFAULT 0.5,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "decayScore" REAL NOT NULL DEFAULT 1.0,
    "forgottenAt" DATETIME,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mimomi_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mimomi_reminders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cron" TEXT,
    "message" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" DATETIME,
    "lastRunDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mimomi_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mimomi_pet_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "affinity" INTEGER NOT NULL DEFAULT 62,
    "energy" INTEGER NOT NULL DEFAULT 84,
    "hunger" INTEGER NOT NULL DEFAULT 18,
    "cleanliness" INTEGER NOT NULL DEFAULT 88,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "strokeCount" INTEGER NOT NULL DEFAULT 0,
    "skinId" TEXT NOT NULL DEFAULT 'default',
    "accessories" TEXT,
    "nickname" TEXT,
    "lastFedAt" DATETIME,
    "lastPetAt" DATETIME,
    "lastPlayedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mimomi_pet_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mimomi_interaction_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stateId" TEXT,
    "action" TEXT NOT NULL,
    "affinityDelta" INTEGER NOT NULL DEFAULT 0,
    "importance" REAL NOT NULL DEFAULT 0.3,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mimomi_interaction_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mimomi_interaction_events_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "mimomi_pet_states" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "goal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "doneSteps" INTEGER NOT NULL DEFAULT 0,
    "result" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "task_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "actionKey" TEXT,
    "actionPayload" TEXT,
    "assignedAgent" TEXT NOT NULL DEFAULT 'executor',
    "parentPlanId" TEXT,
    "dependsOn" TEXT,
    "parallelGroup" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "task_steps_planId_fkey" FOREIGN KEY ("planId") REFERENCES "task_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mimomi_project_memories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "objectName" TEXT NOT NULL,
    "vectorId" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mimomi_project_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mimomi_project_memories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "canvas_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scene_library" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "primaryImage" TEXT,
    "lightingPrompt" TEXT NOT NULL DEFAULT '',
    "environmentPrompt" TEXT NOT NULL DEFAULT '',
    "prompt" TEXT NOT NULL DEFAULT '',
    "negativePrompt" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "scene_library_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prop_library" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "primaryImage" TEXT,
    "materialTags" TEXT NOT NULL DEFAULT '[]',
    "prompt" TEXT NOT NULL DEFAULT '',
    "negativePrompt" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "prop_library_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "site_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'system',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "audience" TEXT NOT NULL DEFAULT 'all',
    "show_in_login" BOOLEAN NOT NULL DEFAULT true,
    "auto_popup" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "link_url" TEXT,
    "link_label" TEXT,
    "starts_at" DATETIME,
    "ends_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "site_message_reads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "read_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "site_message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "site_messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prompt_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "prompt" TEXT NOT NULL,
    "negative_prompt" TEXT NOT NULL DEFAULT '',
    "model" TEXT,
    "provider" TEXT,
    "type" TEXT NOT NULL DEFAULT 'image',
    "source" TEXT NOT NULL DEFAULT 'ai-view',
    "optimized_prompt" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "mimomi_emotion_states_userId_key" ON "mimomi_emotion_states"("userId");

-- CreateIndex
CREATE INDEX "mimomi_emotion_events_userId_createdAt_idx" ON "mimomi_emotion_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "mimomi_emotion_events_source_idx" ON "mimomi_emotion_events"("source");

-- CreateIndex
CREATE UNIQUE INDEX "mimomi_user_profiles_userId_key" ON "mimomi_user_profiles"("userId");

-- CreateIndex
CREATE INDEX "mimomi_memories_userId_createdAt_idx" ON "mimomi_memories"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "mimomi_memories_userId_forgottenAt_idx" ON "mimomi_memories"("userId", "forgottenAt");

-- CreateIndex
CREATE INDEX "mimomi_reminders_userId_enabled_idx" ON "mimomi_reminders"("userId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "mimomi_pet_states_userId_key" ON "mimomi_pet_states"("userId");

-- CreateIndex
CREATE INDEX "mimomi_interaction_events_userId_createdAt_idx" ON "mimomi_interaction_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "mimomi_interaction_events_action_idx" ON "mimomi_interaction_events"("action");

-- CreateIndex
CREATE INDEX "task_plans_userId_idx" ON "task_plans"("userId");

-- CreateIndex
CREATE INDEX "task_plans_status_idx" ON "task_plans"("status");

-- CreateIndex
CREATE INDEX "task_steps_planId_stepIndex_idx" ON "task_steps"("planId", "stepIndex");

-- CreateIndex
CREATE INDEX "task_steps_status_idx" ON "task_steps"("status");

-- CreateIndex
CREATE INDEX "mimomi_project_memories_userId_projectId_idx" ON "mimomi_project_memories"("userId", "projectId");

-- CreateIndex
CREATE INDEX "mimomi_project_memories_category_idx" ON "mimomi_project_memories"("category");

-- CreateIndex
CREATE INDEX "scene_library_userId_idx" ON "scene_library"("userId");

-- CreateIndex
CREATE INDEX "scene_library_createdAt_idx" ON "scene_library"("createdAt");

-- CreateIndex
CREATE INDEX "prop_library_userId_idx" ON "prop_library"("userId");

-- CreateIndex
CREATE INDEX "prop_library_createdAt_idx" ON "prop_library"("createdAt");

-- CreateIndex
CREATE INDEX "site_messages_is_active_sort_order_idx" ON "site_messages"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "site_messages_audience_idx" ON "site_messages"("audience");

-- CreateIndex
CREATE INDEX "site_message_reads_user_id_idx" ON "site_message_reads"("user_id");

-- CreateIndex
CREATE INDEX "site_message_reads_message_id_idx" ON "site_message_reads"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_message_reads_user_id_message_id_key" ON "site_message_reads"("user_id", "message_id");

-- CreateIndex
CREATE INDEX "prompt_logs_user_id_idx" ON "prompt_logs"("user_id");

-- CreateIndex
CREATE INDEX "prompt_logs_type_idx" ON "prompt_logs"("type");

-- CreateIndex
CREATE INDEX "prompt_logs_source_idx" ON "prompt_logs"("source");

-- CreateIndex
CREATE INDEX "prompt_logs_created_at_idx" ON "prompt_logs"("created_at");

-- CreateIndex
CREATE INDEX "points_transactions_expiresAt_idx" ON "points_transactions"("expiresAt");

-- CreateIndex
CREATE INDEX "user_memberships_userId_status_endAt_idx" ON "user_memberships"("userId", "status", "endAt");
