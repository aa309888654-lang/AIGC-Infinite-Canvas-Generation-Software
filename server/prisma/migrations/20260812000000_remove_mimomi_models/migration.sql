-- CreateTable
CREATE TABLE "voice_chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voice_chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "voice_chat_messages_userId_sessionId_createdAt_idx" ON "voice_chat_messages"("userId", "sessionId", "createdAt");

-- MigrateData
INSERT INTO "voice_chat_messages" ("id", "userId", "sessionId", "role", "content", "createdAt")
SELECT "id", "userId", "sessionId", "role", "content", "createdAt" FROM "mimomi_chat_messages";

-- DropTable
DROP TABLE "mimomi_dialogue_records";
DROP TABLE "mimomi_chat_messages";
DROP TABLE "mimomi_project_memories";
DROP TABLE "task_steps";
DROP TABLE "task_plans";
DROP TABLE "mimomi_interaction_events";
DROP TABLE "mimomi_pet_states";
DROP TABLE "mimomi_reminders";
DROP TABLE "mimomi_memories";
DROP TABLE "mimomi_user_profiles";
DROP TABLE "mimomi_emotion_events";
DROP TABLE "mimomi_emotion_states";
