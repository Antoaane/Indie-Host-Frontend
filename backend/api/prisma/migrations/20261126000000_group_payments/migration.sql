-- Paiement à plusieurs : une réservation peut porter plusieurs paiements (un par part), d'où la fin de
-- l'unicité de Payment.reservationId, remplacée par un index simple.

-- DropIndex
DROP INDEX "Payment_reservationId_key";

-- CreateTable
CREATE TABLE "GroupPayment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "totalAmountMinor" INTEGER NOT NULL,
    "payersCount" INTEGER NOT NULL,
    "stripeConnectedAccountId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "publicBaseUrl" TEXT,
    "processingAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupPaymentShare" (
    "id" TEXT NOT NULL,
    "groupPaymentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentId" TEXT,
    "stripePaymentIntentId" TEXT,
    "invitationsSent" INTEGER NOT NULL DEFAULT 0,
    "invitedAt" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupPaymentShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupPayment_reservationId_key" ON "GroupPayment"("reservationId");

-- CreateIndex
CREATE INDEX "GroupPayment_listingId_idx" ON "GroupPayment"("listingId");

-- CreateIndex
CREATE INDEX "GroupPayment_status_expiresAt_idx" ON "GroupPayment"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupPaymentShare_paymentId_key" ON "GroupPaymentShare"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupPaymentShare_stripePaymentIntentId_key" ON "GroupPaymentShare"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "GroupPaymentShare_status_idx" ON "GroupPaymentShare"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GroupPaymentShare_groupPaymentId_position_key" ON "GroupPaymentShare"("groupPaymentId", "position");

-- CreateIndex
CREATE INDEX "Payment_reservationId_idx" ON "Payment"("reservationId");

-- AddForeignKey
ALTER TABLE "GroupPayment" ADD CONSTRAINT "GroupPayment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPayment" ADD CONSTRAINT "GroupPayment_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPaymentShare" ADD CONSTRAINT "GroupPaymentShare_groupPaymentId_fkey" FOREIGN KEY ("groupPaymentId") REFERENCES "GroupPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPaymentShare" ADD CONSTRAINT "GroupPaymentShare_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
