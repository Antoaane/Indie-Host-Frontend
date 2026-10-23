-- Suivi des webhooks Stripe (payments.webhooks.ts) : remboursements échoués et litiges
-- reportés sur la ligne Payment, et journal des événements déjà traités (idempotence).

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "refundStatus" TEXT,
ADD COLUMN     "refundFailureReason" TEXT,
ADD COLUMN     "refundedAmountMinor" INTEGER,
ADD COLUMN     "refundUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "disputeId" TEXT,
ADD COLUMN     "disputeStatus" TEXT,
ADD COLUMN     "disputeReason" TEXT,
ADD COLUMN     "disputeAmountMinor" INTEGER,
ADD COLUMN     "disputeUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_disputeStatus_idx" ON "Payment"("disputeStatus");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_createdAt_idx" ON "StripeWebhookEvent"("createdAt");
