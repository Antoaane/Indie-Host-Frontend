-- CreateTable
CREATE TABLE "ServiceHealthBucket" (
    "serviceId" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "worstStatus" TEXT NOT NULL,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "trackedSamples" INTEGER NOT NULL DEFAULT 0,
    "downSamples" INTEGER NOT NULL DEFAULT 0,
    "latencySumMs" INTEGER NOT NULL DEFAULT 0,
    "latencyCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceHealthBucket_pkey" PRIMARY KEY ("serviceId","bucketStart")
);

-- CreateTable
CREATE TABLE "ServiceHealthIncident" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceHealthIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceHealthAlertState" (
    "serviceId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceHealthAlertState_pkey" PRIMARY KEY ("serviceId")
);

-- CreateIndex
CREATE INDEX "ServiceHealthBucket_bucketStart_idx" ON "ServiceHealthBucket"("bucketStart");

-- CreateIndex
CREATE INDEX "ServiceHealthIncident_occurredAt_idx" ON "ServiceHealthIncident"("occurredAt");

-- CreateIndex
CREATE INDEX "ServiceHealthIncident_serviceId_occurredAt_idx" ON "ServiceHealthIncident"("serviceId", "occurredAt");

