-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "customDomain" TEXT,
ADD COLUMN     "customDomainVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_customDomain_key" ON "Listing"("customDomain");
