-- Make contact-binding rewards idempotent and limit email-code guessing.
ALTER TABLE "points_transactions" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "email_verifications" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "points_transactions_idempotencyKey_key"
ON "points_transactions"("idempotencyKey");
