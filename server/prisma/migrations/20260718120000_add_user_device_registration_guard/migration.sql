-- Enforce the product rule that one app/browser installation may register
-- only one account. NULL is retained for accounts created before this guard.
ALTER TABLE "users" ADD COLUMN "deviceIdHash" TEXT;
CREATE UNIQUE INDEX "users_deviceIdHash_key" ON "users"("deviceIdHash");
