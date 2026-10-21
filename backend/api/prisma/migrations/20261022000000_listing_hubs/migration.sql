-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'listing',
ADD COLUMN     "parentListingId" TEXT;

-- CreateIndex
CREATE INDEX "Listing_kind_idx" ON "Listing"("kind");

-- CreateIndex
CREATE INDEX "Listing_parentListingId_idx" ON "Listing"("parentListingId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_parentListingId_fkey" FOREIGN KEY ("parentListingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
