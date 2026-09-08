ALTER TABLE "users" ADD COLUMN "rechargePointsBalance" REAL NOT NULL DEFAULT 0;
ALTER TABLE "points_transactions" ADD COLUMN "rechargeAmount" REAL NOT NULL DEFAULT 0;

UPDATE "points_transactions"
SET "rechargeAmount" = "amount"
WHERE "amount" > 0 AND LOWER("type") IN ('recharge', 'purchase');

UPDATE "users"
SET "rechargePointsBalance" = CASE
  WHEN "pointsBalance" <= 0 THEN 0
  WHEN "pointsBalance" < COALESCE((
    SELECT SUM("rechargeAmount")
    FROM "points_transactions"
    WHERE "points_transactions"."userId" = "users"."id"
      AND "rechargeAmount" > 0
  ), 0) THEN "pointsBalance"
  ELSE COALESCE((
    SELECT SUM("rechargeAmount")
    FROM "points_transactions"
    WHERE "points_transactions"."userId" = "users"."id"
      AND "rechargeAmount" > 0
  ), 0)
END;
