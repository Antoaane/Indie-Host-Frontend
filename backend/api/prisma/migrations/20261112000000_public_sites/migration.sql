-- CreateTable
CREATE TABLE "PublicSite" (
    "hostname" TEXT NOT NULL,
    "rootListingId" TEXT,
    "googleToken" TEXT,
    "googleVerifiedAt" TIMESTAMP(3),
    "googleOwnersSyncedAt" TIMESTAMP(3),
    "googleAddedAt" TIMESTAMP(3),
    "sitemapSubmittedAt" TIMESTAMP(3),
    "contentUpdatedAt" TIMESTAMP(3),
    "indexNowPingedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicSite_pkey" PRIMARY KEY ("hostname")
);
