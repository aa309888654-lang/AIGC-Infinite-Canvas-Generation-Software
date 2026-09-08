-- Payment: 添加完整退款字段
ALTER TABLE "payments" ADD COLUMN "refundStatus" TEXT;
ALTER TABLE "payments" ADD COLUMN "refundNo" TEXT;
ALTER TABLE "payments" ADD COLUMN "refundReason" TEXT;
ALTER TABLE "payments" ADD COLUMN "refundedAt" DATETIME;
ALTER TABLE "payments" ADD COLUMN "refundedBy" TEXT;

-- MembershipOrder: 添加完整退款字段
ALTER TABLE "membership_orders" ADD COLUMN "refundStatus" TEXT;
ALTER TABLE "membership_orders" ADD COLUMN "refundNo" TEXT;
ALTER TABLE "membership_orders" ADD COLUMN "refundReason" TEXT;
ALTER TABLE "membership_orders" ADD COLUMN "refundedAt" DATETIME;
ALTER TABLE "membership_orders" ADD COLUMN "refundedBy" TEXT;

-- 索引：按退款状态筛选
CREATE INDEX "payments_refundStatus_idx" ON "payments"("refundStatus");
CREATE INDEX "membership_orders_refundStatus_idx" ON "membership_orders"("refundStatus");
