-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailCipher" TEXT,
    "emailHash" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "apiQuota" INTEGER NOT NULL DEFAULT 100,
    "usedQuota" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "phoneCipher" TEXT,
    "phoneHash" TEXT,
    "avatar" TEXT,
    "last_login_at" DATETIME,
    "last_login_ip" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "pointsBalance" REAL NOT NULL DEFAULT 0,
    "frozenPoints" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
    "profile" TEXT,
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
CREATE TABLE "mimomi_chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mimomi_chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_notification_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "typesEnabled" TEXT NOT NULL DEFAULT 'system,task,payment',
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_notification_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "size" INTEGER,
    "mimeType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "storagePath" TEXT,
    "url" TEXT,
    "cosUrl" TEXT,
    "thumbnailUrl" TEXT,
    "metadata" TEXT,
    "folder" TEXT NOT NULL DEFAULT '/',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_participations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prizeWon" TEXT,
    "redeemedAt" DATETIME,
    "expiresAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaign_participations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "messages" TEXT NOT NULL DEFAULT '[]',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    CONSTRAINT "tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_memberships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "startAt" DATETIME,
    "endAt" DATETIME,
    "nextGrantAt" DATETIME,
    "grantPolicy" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_memberships_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "character_library" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "appearance" TEXT NOT NULL DEFAULT '',
    "personality" TEXT NOT NULL DEFAULT '',
    "outfit" TEXT NOT NULL DEFAULT '',
    "traits" TEXT NOT NULL DEFAULT '[]',
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "groupType" TEXT NOT NULL DEFAULT 'MAIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "character_library_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "character_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "variantType" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "expression" TEXT,
    "pose" TEXT,
    "outfit" TEXT,
    "angle" TEXT,
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "prompt" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "character_variants_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "character_library" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "character_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "sceneId" TEXT,
    "sceneName" TEXT,
    "usageContext" TEXT,
    "generatedImage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "character_usage_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "character_library" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE TABLE "character_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "description" TEXT NOT NULL DEFAULT '',
    "prompt" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "provider" TEXT,
    "models" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsed" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasks" (
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
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "method" TEXT,
    "orderNo" TEXT,
    "transactionId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "payment_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "channel" TEXT,
    "transactionId" TEXT,
    "tradeNo" TEXT,
    "qrCodeImage" TEXT,
    "refundAmount" REAL,
    "refundStatus" TEXT,
    "refundNo" TEXT,
    "refundReason" TEXT,
    "refundedAt" DATETIME,
    "refundedBy" TEXT,
    "paidAt" DATETIME,
    "expiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "manual_membership_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "duration" TEXT NOT NULL DEFAULT 'monthly',
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentProof" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "manual_membership_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "login_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "device" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "params" TEXT,
    "status" INTEGER NOT NULL,
    "duration" INTEGER,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_quotas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dailyLimit" INTEGER NOT NULL DEFAULT 100,
    "dailyUsed" INTEGER NOT NULL DEFAULT 0,
    "monthlyLimit" INTEGER NOT NULL DEFAULT 1000,
    "monthlyUsed" INTEGER NOT NULL DEFAULT 0,
    "concurrentLimit" INTEGER NOT NULL DEFAULT 3,
    "concurrentUsed" INTEGER NOT NULL DEFAULT 0,
    "storageLimit" BIGINT,
    "fileLimit" INTEGER,
    "apiCallsLimit" INTEGER,
    "resetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_quotas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "membership_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "duration" TEXT NOT NULL DEFAULT 'monthly',
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentProof" TEXT,
    "paidAt" DATETIME,
    "expiresAt" DATETIME,
    "refundAmount" REAL NOT NULL DEFAULT 0,
    "refundStatus" TEXT,
    "refundNo" TEXT,
    "refundReason" TEXT,
    "refundedAt" DATETIME,
    "refundedBy" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "membership_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "processed_payment_callbacks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outTradeNo" TEXT NOT NULL,
    "tradeNo" TEXT,
    "totalFee" REAL NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error" TEXT,
    "metadata" TEXT
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "price" REAL NOT NULL,
    "monthlyPrice" REAL,
    "quarterlyPrice" REAL,
    "yearlyPrice" REAL,
    "duration" TEXT NOT NULL DEFAULT 'monthly',
    "quota" INTEGER NOT NULL DEFAULT 0,
    "monthlyGiftPoints" INTEGER NOT NULL DEFAULT 0,
    "features" TEXT NOT NULL DEFAULT '[]',
    "limits" TEXT,
    "grantPolicy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "provider_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "endpoint" TEXT,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "rateLimit" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "provider_api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerName" TEXT NOT NULL,
    "keyLabel" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "modelScope" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "maxConcurrency" INTEGER NOT NULL DEFAULT 1,
    "quotaTotal" INTEGER NOT NULL DEFAULT 0,
    "quotaUsed" INTEGER NOT NULL DEFAULT 0,
    "quotaRemaining" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isExhausted" BOOLEAN NOT NULL DEFAULT false,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailureAt" DATETIME,
    "disabledAt" DATETIME,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "exhaustedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "provider_api_keys_providerName_fkey" FOREIGN KEY ("providerName") REFERENCES "provider_configs" ("provider") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_registrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "registrationMethod" TEXT NOT NULL DEFAULT 'email',
    "referralCode" TEXT,
    "metadata" TEXT,
    "approvalAdminId" TEXT,
    "approvalNote" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ip_points_grants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "ip" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "adminId" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ip_points_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_rate_limits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT,
    "limitType" TEXT NOT NULL DEFAULT 'fixed',
    "limit" INTEGER NOT NULL,
    "window" INTEGER NOT NULL DEFAULT 60,
    "dailyLimit" INTEGER NOT NULL DEFAULT 1000,
    "dailyUsed" INTEGER NOT NULL DEFAULT 0,
    "monthlyLimit" INTEGER NOT NULL DEFAULT 10000,
    "monthlyUsed" INTEGER NOT NULL DEFAULT 0,
    "minuteLimit" INTEGER NOT NULL DEFAULT 60,
    "secondLimit" INTEGER NOT NULL DEFAULT 10,
    "concurrentLimit" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_rate_limits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "points_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 100,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastAlertAt" DATETIME,
    "alertCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "points_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "frontend_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "userAgent" TEXT NOT NULL,
    "screenWidth" INTEGER,
    "screenHeight" INTEGER,
    "viewportWidth" INTEGER,
    "viewportHeight" INTEGER,
    "deviceType" TEXT,
    "browserName" TEXT,
    "browserVersion" TEXT,
    "osName" TEXT,
    "osVersion" TEXT,
    "language" TEXT,
    "timezone" TEXT,
    "ipAddress" TEXT,
    "country" TEXT,
    "city" TEXT,
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" DATETIME,
    "duration" INTEGER,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "isBounce" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "frontend_page_views" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "pageTitle" TEXT,
    "referrer" TEXT,
    "viewportWidth" INTEGER,
    "viewportHeight" INTEGER,
    "scrollDepth" INTEGER,
    "timeOnPage" INTEGER,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "frontend_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "label" TEXT,
    "value" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "songs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "composer" TEXT,
    "lyricist" TEXT,
    "arranger" TEXT,
    "producer" TEXT,
    "album" TEXT,
    "genre" TEXT,
    "year" TEXT,
    "comment" TEXT,
    "lyrics" TEXT,
    "lrc" TEXT,
    "audioUrl" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "duration" INTEGER,
    "model" TEXT,
    "provider" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "songs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorites_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "play_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "completion" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "play_history_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "play_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "frontend_errors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "url" TEXT,
    "lineNo" INTEGER,
    "colNo" INTEGER,
    "userAgent" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "daily_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "musicCount" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "audioMinutes" REAL NOT NULL DEFAULT 0,
    "promptOptimizationCount" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "api_call_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userApiKeyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "inputCost" REAL NOT NULL DEFAULT 0,
    "outputCost" REAL NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "statusCode" INTEGER,
    "requestId" TEXT,
    "errorMessage" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_call_logs_userApiKeyId_fkey" FOREIGN KEY ("userApiKeyId") REFERENCES "user_api_keys" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "api_call_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "keyName" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT,
    "provider" TEXT,
    "models" TEXT,
    "permissions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "rateLimit" INTEGER NOT NULL DEFAULT 60,
    "rateLimitWindow" TEXT NOT NULL DEFAULT 'minute',
    "expiresAt" DATETIME,
    "lastUsedAt" DATETIME,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "points_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balanceBefore" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "adminId" TEXT,
    "adminUsername" TEXT,
    "orderNo" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "points_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "points_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "transactionId" TEXT,
    "qrCodeImage" TEXT,
    "qrCode" TEXT,
    "paidAt" DATETIME,
    "expiredAt" DATETIME,
    "refundAmount" REAL NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "points_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_operation_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "adminUsername" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetName" TEXT,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "email_send_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "messageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sms_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT '86',
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'login',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'register',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "enhanced_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "category" TEXT NOT NULL DEFAULT 'SYSTEM',
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "duration" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "audit_archives" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "archiveDate" DATETIME NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "logCount" INTEGER NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'json',
    "compressed" BOOLEAN NOT NULL DEFAULT true,
    "checksum" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "chat_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderId" TEXT,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "canvas_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '未命名工程',
    "description" TEXT,
    "nodes" TEXT NOT NULL DEFAULT '[]',
    "edges" TEXT NOT NULL DEFAULT '[]',
    "viewport" TEXT,
    "thumbnail" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "canvas_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "community_posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '综合讨论',
    "images" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "community_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "community_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "community_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "community_comments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "community_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "community_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "community_post_likes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_post_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "community_post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "community_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "community_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "software_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "releaseNotes" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'win',
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "isLatest" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

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
CREATE INDEX "mimomi_chat_messages_userId_sessionId_createdAt_idx" ON "mimomi_chat_messages"("userId", "sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_settings_userId_key" ON "user_notification_settings"("userId");

-- CreateIndex
CREATE INDEX "user_files_userId_idx" ON "user_files"("userId");

-- CreateIndex
CREATE INDEX "user_files_fileType_idx" ON "user_files"("fileType");

-- CreateIndex
CREATE INDEX "user_files_folder_idx" ON "user_files"("folder");

-- CreateIndex
CREATE INDEX "user_files_isDeleted_idx" ON "user_files"("isDeleted");

-- CreateIndex
CREATE INDEX "user_files_createdAt_idx" ON "user_files"("createdAt");

-- CreateIndex
CREATE INDEX "campaign_participations_userId_idx" ON "campaign_participations"("userId");

-- CreateIndex
CREATE INDEX "campaign_participations_campaignId_idx" ON "campaign_participations"("campaignId");

-- CreateIndex
CREATE INDEX "tickets_userId_idx" ON "tickets"("userId");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "user_memberships_userId_idx" ON "user_memberships"("userId");

-- CreateIndex
CREATE INDEX "user_memberships_membershipId_idx" ON "user_memberships"("membershipId");

-- CreateIndex
CREATE INDEX "user_memberships_status_idx" ON "user_memberships"("status");

-- CreateIndex
CREATE INDEX "user_memberships_userId_status_endAt_idx" ON "user_memberships"("userId", "status", "endAt");

-- CreateIndex
CREATE INDEX "character_library_userId_idx" ON "character_library"("userId");

-- CreateIndex
CREATE INDEX "character_library_groupType_idx" ON "character_library"("groupType");

-- CreateIndex
CREATE INDEX "character_library_createdAt_idx" ON "character_library"("createdAt");

-- CreateIndex
CREATE INDEX "character_variants_characterId_idx" ON "character_variants"("characterId");

-- CreateIndex
CREATE INDEX "character_variants_variantType_idx" ON "character_variants"("variantType");

-- CreateIndex
CREATE INDEX "character_usage_characterId_idx" ON "character_usage"("characterId");

-- CreateIndex
CREATE INDEX "character_usage_createdAt_idx" ON "character_usage"("createdAt");

-- CreateIndex
CREATE INDEX "scene_library_userId_idx" ON "scene_library"("userId");

-- CreateIndex
CREATE INDEX "scene_library_createdAt_idx" ON "scene_library"("createdAt");

-- CreateIndex
CREATE INDEX "prop_library_userId_idx" ON "prop_library"("userId");

-- CreateIndex
CREATE INDEX "prop_library_createdAt_idx" ON "prop_library"("createdAt");

-- CreateIndex
CREATE INDEX "character_templates_userId_idx" ON "character_templates"("userId");

-- CreateIndex
CREATE INDEX "character_templates_category_idx" ON "character_templates"("category");

-- CreateIndex
CREATE INDEX "character_templates_isPublic_idx" ON "character_templates"("isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_taskId_key" ON "tasks"("taskId");

-- CreateIndex
CREATE INDEX "tasks_userId_idx" ON "tasks"("userId");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_createdAt_idx" ON "tasks"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_logs_orderNo_key" ON "payment_logs"("orderNo");

-- CreateIndex
CREATE INDEX "payment_logs_userId_idx" ON "payment_logs"("userId");

-- CreateIndex
CREATE INDEX "payment_logs_status_idx" ON "payment_logs"("status");

-- CreateIndex
CREATE INDEX "payment_logs_createdAt_idx" ON "payment_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderNo_key" ON "payments"("orderNo");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_refundStatus_idx" ON "payments"("refundStatus");

-- CreateIndex
CREATE INDEX "manual_membership_requests_userId_idx" ON "manual_membership_requests"("userId");

-- CreateIndex
CREATE INDEX "manual_membership_requests_status_idx" ON "manual_membership_requests"("status");

-- CreateIndex
CREATE INDEX "login_logs_userId_idx" ON "login_logs"("userId");

-- CreateIndex
CREATE INDEX "login_logs_createdAt_idx" ON "login_logs"("createdAt");

-- CreateIndex
CREATE INDEX "usage_logs_userId_idx" ON "usage_logs"("userId");

-- CreateIndex
CREATE INDEX "usage_logs_createdAt_idx" ON "usage_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_quotas_userId_key" ON "user_quotas"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "membership_orders_orderNo_key" ON "membership_orders"("orderNo");

-- CreateIndex
CREATE INDEX "membership_orders_userId_idx" ON "membership_orders"("userId");

-- CreateIndex
CREATE INDEX "membership_orders_status_idx" ON "membership_orders"("status");

-- CreateIndex
CREATE INDEX "membership_orders_createdAt_idx" ON "membership_orders"("createdAt");

-- CreateIndex
CREATE INDEX "membership_orders_refundStatus_idx" ON "membership_orders"("refundStatus");

-- CreateIndex
CREATE UNIQUE INDEX "processed_payment_callbacks_outTradeNo_key" ON "processed_payment_callbacks"("outTradeNo");

-- CreateIndex
CREATE INDEX "processed_payment_callbacks_processedAt_idx" ON "processed_payment_callbacks"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_name_key" ON "memberships"("name");

-- CreateIndex
CREATE UNIQUE INDEX "provider_configs_provider_key" ON "provider_configs"("provider");

-- CreateIndex
CREATE INDEX "provider_api_keys_providerName_isActive_isExhausted_idx" ON "provider_api_keys"("providerName", "isActive", "isExhausted");

-- CreateIndex
CREATE UNIQUE INDEX "provider_api_keys_providerName_keyLabel_key" ON "provider_api_keys"("providerName", "keyLabel");

-- CreateIndex
CREATE INDEX "user_registrations_userId_idx" ON "user_registrations"("userId");

-- CreateIndex
CREATE INDEX "ip_points_grants_userId_idx" ON "ip_points_grants"("userId");

-- CreateIndex
CREATE INDEX "ip_points_grants_ip_idx" ON "ip_points_grants"("ip");

-- CreateIndex
CREATE INDEX "ip_points_grants_createdAt_idx" ON "ip_points_grants"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "points_alerts_userId_key" ON "points_alerts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "frontend_sessions_sessionId_key" ON "frontend_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "frontend_sessions_sessionId_idx" ON "frontend_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "frontend_sessions_userId_idx" ON "frontend_sessions"("userId");

-- CreateIndex
CREATE INDEX "frontend_sessions_startTime_idx" ON "frontend_sessions"("startTime");

-- CreateIndex
CREATE INDEX "frontend_page_views_sessionId_idx" ON "frontend_page_views"("sessionId");

-- CreateIndex
CREATE INDEX "frontend_page_views_pageUrl_idx" ON "frontend_page_views"("pageUrl");

-- CreateIndex
CREATE INDEX "frontend_page_views_timestamp_idx" ON "frontend_page_views"("timestamp");

-- CreateIndex
CREATE INDEX "frontend_events_sessionId_idx" ON "frontend_events"("sessionId");

-- CreateIndex
CREATE INDEX "frontend_events_category_idx" ON "frontend_events"("category");

-- CreateIndex
CREATE INDEX "frontend_events_timestamp_idx" ON "frontend_events"("timestamp");

-- CreateIndex
CREATE INDEX "songs_userId_idx" ON "songs"("userId");

-- CreateIndex
CREATE INDEX "songs_title_idx" ON "songs"("title");

-- CreateIndex
CREATE INDEX "songs_genre_idx" ON "songs"("genre");

-- CreateIndex
CREATE INDEX "songs_createdAt_idx" ON "songs"("createdAt");

-- CreateIndex
CREATE INDEX "favorites_userId_idx" ON "favorites"("userId");

-- CreateIndex
CREATE INDEX "favorites_songId_idx" ON "favorites"("songId");

-- CreateIndex
CREATE INDEX "favorites_createdAt_idx" ON "favorites"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_songId_key" ON "favorites"("userId", "songId");

-- CreateIndex
CREATE INDEX "play_history_userId_idx" ON "play_history"("userId");

-- CreateIndex
CREATE INDEX "play_history_songId_idx" ON "play_history"("songId");

-- CreateIndex
CREATE INDEX "play_history_playedAt_idx" ON "play_history"("playedAt");

-- CreateIndex
CREATE INDEX "frontend_errors_sessionId_idx" ON "frontend_errors"("sessionId");

-- CreateIndex
CREATE INDEX "frontend_errors_errorType_idx" ON "frontend_errors"("errorType");

-- CreateIndex
CREATE INDEX "frontend_errors_timestamp_idx" ON "frontend_errors"("timestamp");

-- CreateIndex
CREATE INDEX "daily_usage_userId_idx" ON "daily_usage"("userId");

-- CreateIndex
CREATE INDEX "daily_usage_date_idx" ON "daily_usage"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_usage_userId_date_key" ON "daily_usage"("userId", "date");

-- CreateIndex
CREATE INDEX "api_call_logs_userApiKeyId_createdAt_idx" ON "api_call_logs"("userApiKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "api_call_logs_userId_createdAt_idx" ON "api_call_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "api_call_logs_provider_createdAt_idx" ON "api_call_logs"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "api_call_logs_createdAt_idx" ON "api_call_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_api_keys_apiKey_key" ON "user_api_keys"("apiKey");

-- CreateIndex
CREATE INDEX "user_api_keys_userId_idx" ON "user_api_keys"("userId");

-- CreateIndex
CREATE INDEX "user_api_keys_isActive_idx" ON "user_api_keys"("isActive");

-- CreateIndex
CREATE INDEX "points_transactions_userId_idx" ON "points_transactions"("userId");

-- CreateIndex
CREATE INDEX "points_transactions_type_idx" ON "points_transactions"("type");

-- CreateIndex
CREATE INDEX "points_transactions_createdAt_idx" ON "points_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "points_transactions_expiresAt_idx" ON "points_transactions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "points_orders_orderNo_key" ON "points_orders"("orderNo");

-- CreateIndex
CREATE INDEX "points_orders_userId_idx" ON "points_orders"("userId");

-- CreateIndex
CREATE INDEX "points_orders_status_idx" ON "points_orders"("status");

-- CreateIndex
CREATE INDEX "points_orders_createdAt_idx" ON "points_orders"("createdAt");

-- CreateIndex
CREATE INDEX "admin_operation_logs_adminId_idx" ON "admin_operation_logs"("adminId");

-- CreateIndex
CREATE INDEX "admin_operation_logs_action_idx" ON "admin_operation_logs"("action");

-- CreateIndex
CREATE INDEX "admin_operation_logs_targetType_idx" ON "admin_operation_logs"("targetType");

-- CreateIndex
CREATE INDEX "admin_operation_logs_targetId_idx" ON "admin_operation_logs"("targetId");

-- CreateIndex
CREATE INDEX "admin_operation_logs_createdAt_idx" ON "admin_operation_logs"("createdAt");

-- CreateIndex
CREATE INDEX "admin_operation_logs_status_idx" ON "admin_operation_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "email_send_logs_email_idx" ON "email_send_logs"("email");

-- CreateIndex
CREATE INDEX "email_send_logs_type_idx" ON "email_send_logs"("type");

-- CreateIndex
CREATE INDEX "email_send_logs_status_idx" ON "email_send_logs"("status");

-- CreateIndex
CREATE INDEX "email_send_logs_createdAt_idx" ON "email_send_logs"("createdAt");

-- CreateIndex
CREATE INDEX "sms_verifications_phone_idx" ON "sms_verifications"("phone");

-- CreateIndex
CREATE INDEX "sms_verifications_status_idx" ON "sms_verifications"("status");

-- CreateIndex
CREATE INDEX "sms_verifications_expiresAt_idx" ON "sms_verifications"("expiresAt");

-- CreateIndex
CREATE INDEX "email_verifications_email_idx" ON "email_verifications"("email");

-- CreateIndex
CREATE INDEX "email_verifications_status_idx" ON "email_verifications"("status");

-- CreateIndex
CREATE INDEX "email_verifications_expiresAt_idx" ON "email_verifications"("expiresAt");

-- CreateIndex
CREATE INDEX "enhanced_audit_logs_userId_idx" ON "enhanced_audit_logs"("userId");

-- CreateIndex
CREATE INDEX "enhanced_audit_logs_adminId_idx" ON "enhanced_audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "enhanced_audit_logs_action_idx" ON "enhanced_audit_logs"("action");

-- CreateIndex
CREATE INDEX "enhanced_audit_logs_resource_idx" ON "enhanced_audit_logs"("resource");

-- CreateIndex
CREATE INDEX "enhanced_audit_logs_createdAt_idx" ON "enhanced_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "enhanced_audit_logs_severity_idx" ON "enhanced_audit_logs"("severity");

-- CreateIndex
CREATE INDEX "enhanced_audit_logs_category_idx" ON "enhanced_audit_logs"("category");

-- CreateIndex
CREATE INDEX "enhanced_audit_logs_status_idx" ON "enhanced_audit_logs"("status");

-- CreateIndex
CREATE INDEX "enhanced_audit_logs_expiresAt_idx" ON "enhanced_audit_logs"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_archives_archiveDate_idx" ON "audit_archives"("archiveDate");

-- CreateIndex
CREATE INDEX "audit_archives_status_idx" ON "audit_archives"("status");

-- CreateIndex
CREATE INDEX "chat_conversations_userId_idx" ON "chat_conversations"("userId");

-- CreateIndex
CREATE INDEX "chat_conversations_status_idx" ON "chat_conversations"("status");

-- CreateIndex
CREATE INDEX "chat_conversations_lastMessageAt_idx" ON "chat_conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_idx" ON "chat_messages"("conversationId");

-- CreateIndex
CREATE INDEX "chat_messages_senderType_idx" ON "chat_messages"("senderType");

-- CreateIndex
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_isRead_idx" ON "chat_messages"("isRead");

-- CreateIndex
CREATE INDEX "canvas_projects_userId_idx" ON "canvas_projects"("userId");

-- CreateIndex
CREATE INDEX "canvas_projects_userId_updatedAt_idx" ON "canvas_projects"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "canvas_projects_userId_isFavorite_idx" ON "canvas_projects"("userId", "isFavorite");

-- CreateIndex
CREATE INDEX "community_posts_userId_idx" ON "community_posts"("userId");

-- CreateIndex
CREATE INDEX "community_posts_category_idx" ON "community_posts"("category");

-- CreateIndex
CREATE INDEX "community_posts_status_idx" ON "community_posts"("status");

-- CreateIndex
CREATE INDEX "community_posts_createdAt_idx" ON "community_posts"("createdAt");

-- CreateIndex
CREATE INDEX "community_posts_isPinned_idx" ON "community_posts"("isPinned");

-- CreateIndex
CREATE INDEX "community_comments_postId_idx" ON "community_comments"("postId");

-- CreateIndex
CREATE INDEX "community_comments_userId_idx" ON "community_comments"("userId");

-- CreateIndex
CREATE INDEX "community_comments_parentId_idx" ON "community_comments"("parentId");

-- CreateIndex
CREATE INDEX "community_comments_createdAt_idx" ON "community_comments"("createdAt");

-- CreateIndex
CREATE INDEX "community_post_likes_postId_idx" ON "community_post_likes"("postId");

-- CreateIndex
CREATE INDEX "community_post_likes_userId_idx" ON "community_post_likes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_post_likes_postId_userId_key" ON "community_post_likes"("postId", "userId");

-- CreateIndex
CREATE INDEX "community_applications_userId_idx" ON "community_applications"("userId");

-- CreateIndex
CREATE INDEX "community_applications_status_idx" ON "community_applications"("status");

-- CreateIndex
CREATE INDEX "community_applications_createdAt_idx" ON "community_applications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "software_versions_version_key" ON "software_versions"("version");

-- CreateIndex
CREATE INDEX "software_versions_version_idx" ON "software_versions"("version");

-- CreateIndex
CREATE INDEX "software_versions_platform_isLatest_idx" ON "software_versions"("platform", "isLatest");

-- CreateIndex
CREATE INDEX "software_versions_isActive_createdAt_idx" ON "software_versions"("isActive", "createdAt");

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

