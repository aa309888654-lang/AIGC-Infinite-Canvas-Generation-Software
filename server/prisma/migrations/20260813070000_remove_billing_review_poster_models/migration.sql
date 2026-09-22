-- DropIndex
DROP INDEX "daily_usage_userId_date_key";
DROP INDEX "daily_usage_date_idx";
DROP INDEX "daily_usage_userId_idx";
DROP INDEX "email_send_logs_createdAt_idx";
DROP INDEX "email_send_logs_status_idx";
DROP INDEX "email_send_logs_type_idx";
DROP INDEX "email_send_logs_email_idx";
DROP INDEX "email_verifications_expiresAt_idx";
DROP INDEX "email_verifications_status_idx";
DROP INDEX "email_verifications_email_idx";
DROP INDEX "ip_points_grants_createdAt_idx";
DROP INDEX "ip_points_grants_ip_idx";
DROP INDEX "ip_points_grants_userId_idx";
DROP INDEX "manual_membership_requests_status_idx";
DROP INDEX "manual_membership_requests_userId_idx";
DROP INDEX "membership_orders_refundStatus_idx";
DROP INDEX "membership_orders_createdAt_idx";
DROP INDEX "membership_orders_status_idx";
DROP INDEX "membership_orders_userId_idx";
DROP INDEX "membership_orders_orderNo_key";
DROP INDEX "memberships_name_key";
DROP INDEX "payment_logs_createdAt_idx";
DROP INDEX "payment_logs_status_idx";
DROP INDEX "payment_logs_userId_idx";
DROP INDEX "payment_logs_orderNo_key";
DROP INDEX "payments_refundStatus_idx";
DROP INDEX "payments_status_idx";
DROP INDEX "payments_userId_idx";
DROP INDEX "payments_orderNo_key";
DROP INDEX "points_alerts_userId_key";
DROP INDEX "points_orders_createdAt_idx";
DROP INDEX "points_orders_status_idx";
DROP INDEX "points_orders_userId_idx";
DROP INDEX "points_orders_orderNo_key";
DROP INDEX "points_transactions_idempotencyKey_key";
DROP INDEX "points_transactions_expiresAt_idx";
DROP INDEX "points_transactions_createdAt_idx";
DROP INDEX "points_transactions_type_idx";
DROP INDEX "points_transactions_userId_idx";
DROP INDEX "poster_brief_versions_projectId_version_key";
DROP INDEX "poster_candidates_generationRunId_rank_idx";
DROP INDEX "poster_generation_runs_templateId_idx";
DROP INDEX "poster_generation_runs_status_idx";
DROP INDEX "poster_generation_runs_projectId_createdAt_idx";
DROP INDEX "poster_generation_runs_idempotencyKey_key";
DROP INDEX "poster_projects_status_idx";
DROP INDEX "poster_projects_userId_updatedAt_idx";
DROP INDEX "poster_quality_reports_degraded_idx";
DROP INDEX "poster_quality_reports_candidateId_createdAt_idx";
DROP INDEX "processed_payment_callbacks_processedAt_idx";
DROP INDEX "processed_payment_callbacks_outTradeNo_key";
DROP INDEX "sms_verifications_expiresAt_idx";
DROP INDEX "sms_verifications_status_idx";
DROP INDEX "sms_verifications_phone_idx";
DROP INDEX "user_memberships_userId_status_endAt_idx";
DROP INDEX "user_memberships_status_idx";
DROP INDEX "user_memberships_membershipId_idx";
DROP INDEX "user_memberships_userId_idx";
DROP INDEX "user_registrations_userId_idx";

PRAGMA foreign_keys=off;
DROP TABLE "daily_usage";
DROP TABLE "email_send_logs";
DROP TABLE "email_verifications";
DROP TABLE "ip_points_grants";
DROP TABLE "manual_membership_requests";
DROP TABLE "membership_orders";
DROP TABLE "memberships";
DROP TABLE "payment_logs";
DROP TABLE "payments";
DROP TABLE "points_alerts";
DROP TABLE "points_orders";
DROP TABLE "points_transactions";
DROP TABLE "poster_brief_versions";
DROP TABLE "poster_candidates";
DROP TABLE "poster_generation_runs";
DROP TABLE "poster_projects";
DROP TABLE "poster_quality_reports";
DROP TABLE "processed_payment_callbacks";
DROP TABLE "sms_verifications";
DROP TABLE "user_memberships";
DROP TABLE "user_registrations";
PRAGMA foreign_keys=on;

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "params" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "result" TEXT,
    "error" TEXT,
    "taskId" TEXT,
    "providerTaskId" TEXT,
    "model" TEXT,
    "provider" TEXT,
    "outputUrl" TEXT,
    "cosUrl" TEXT,
    "thumbnailUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("cosUrl", "createdAt", "error", "id", "model", "outputUrl", "params", "progress", "prompt", "provider", "providerTaskId", "result", "status", "taskId", "thumbnailUrl", "type", "updatedAt", "userId") SELECT "cosUrl", "createdAt", "error", "id", "model", "outputUrl", "params", "progress", "prompt", "provider", "providerTaskId", "result", "status", "taskId", "thumbnailUrl", "type", "updatedAt", "userId" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
CREATE UNIQUE INDEX "tasks_taskId_key" ON "tasks"("taskId");
CREATE INDEX "tasks_userId_idx" ON "tasks"("userId");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
CREATE INDEX "tasks_createdAt_idx" ON "tasks"("createdAt");
CREATE TABLE "new_user_quotas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "storageLimit" BIGINT,
    "fileLimit" INTEGER,
    "resetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_quotas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_quotas" ("createdAt", "fileLimit", "id", "resetAt", "storageLimit", "updatedAt", "userId") SELECT "createdAt", "fileLimit", "id", "resetAt", "storageLimit", "updatedAt", "userId" FROM "user_quotas";
DROP TABLE "user_quotas";
ALTER TABLE "new_user_quotas" RENAME TO "user_quotas";
CREATE UNIQUE INDEX "user_quotas_userId_key" ON "user_quotas"("userId");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailCipher" TEXT,
    "emailHash" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "phoneCipher" TEXT,
    "phoneHash" TEXT,
    "deviceIdHash" TEXT,
    "avatar" TEXT,
    "last_login_at" DATETIME,
    "last_login_ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("avatar", "createdAt", "deviceIdHash", "email", "emailCipher", "emailHash", "id", "isActive", "last_login_at", "last_login_ip", "password", "phone", "phoneCipher", "phoneHash", "role", "updatedAt", "username") SELECT "avatar", "createdAt", "deviceIdHash", "email", "emailCipher", "emailHash", "id", "isActive", "last_login_at", "last_login_ip", "password", "phone", "phoneCipher", "phoneHash", "role", "updatedAt", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "users_deviceIdHash_key" ON "users"("deviceIdHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
