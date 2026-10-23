-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailRemindersOptOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "HostNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HostNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HostNotification_dedupeKey_key" ON "HostNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "HostNotification_userId_kind_idx" ON "HostNotification"("userId", "kind");

-- CreateIndex
CREATE INDEX "HostNotification_kind_refId_createdAt_idx" ON "HostNotification"("kind", "refId", "createdAt");

-- CreateIndex
CREATE INDEX "HostNotification_createdAt_idx" ON "HostNotification"("createdAt");

-- AddForeignKey
ALTER TABLE "HostNotification" ADD CONSTRAINT "HostNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
