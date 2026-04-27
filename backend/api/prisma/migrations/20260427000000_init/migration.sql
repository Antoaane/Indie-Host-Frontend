-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MessageAuthorRole" AS ENUM ('host', 'guest', 'system');

-- CreateEnum
CREATE TYPE "MessageState" AS ENUM ('sent', 'delivered', 'read');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "externalUserId" TEXT,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "hostProfile" JSONB,
    "stripeConnectAccountId" TEXT,
    "stripeConnectProfile" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "subdomainSlug" TEXT,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "hasPendingChanges" BOOLEAN NOT NULL DEFAULT false,
    "core" JSONB NOT NULL,
    "bookings" JSONB NOT NULL,
    "medias" JSONB NOT NULL,
    "arrival" JSONB NOT NULL,
    "notes" JSONB NOT NULL,
    "comments" JSONB NOT NULL,
    "host" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestAvatar" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "nights" INTEGER NOT NULL,
    "message" TEXT,
    "internalNote" TEXT,
    "guests" JSONB NOT NULL,
    "payment" JSONB NOT NULL,
    "contact" JSONB NOT NULL,
    "messaging" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "reservationId" TEXT,
    "hostUserId" TEXT,
    "guestUserId" TEXT,
    "guestTempId" TEXT,
    "subject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "reservationId" TEXT,
    "authorRole" "MessageAuthorRole" NOT NULL,
    "authorUserId" TEXT,
    "guestTempId" TEXT,
    "body" TEXT NOT NULL,
    "state" "MessageState" NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "reservationId" TEXT,
    "userId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeConnectedAccountId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "amountMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "paymentChoice" TEXT,
    "chargeNowAmountMinor" INTEGER,
    "deferredAmountMinor" INTEGER,
    "deferredMode" TEXT,
    "deferredDueDate" TIMESTAMP(3),
    "metadata" JSONB,
    "rawRequest" JSONB,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSync" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT,
    "sourceUrl" TEXT,
    "rawIcs" TEXT,
    "timezone" TEXT,
    "lastStatus" TEXT,
    "lastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "calendarSyncId" TEXT,
    "reservationId" TEXT,
    "externalUid" TEXT,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_externalUserId_key" ON "User"("externalUserId");

-- CreateIndex
CREATE INDEX "Listing_subdomainSlug_idx" ON "Listing"("subdomainSlug");

-- CreateIndex
CREATE INDEX "Listing_ownerId_idx" ON "Listing"("ownerId");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Reservation_listingId_idx" ON "Reservation"("listingId");

-- CreateIndex
CREATE INDEX "Reservation_startDate_idx" ON "Reservation"("startDate");

-- CreateIndex
CREATE INDEX "Reservation_endDate_idx" ON "Reservation"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_reservationId_key" ON "Conversation"("reservationId");

-- CreateIndex
CREATE INDEX "Conversation_listingId_idx" ON "Conversation"("listingId");

-- CreateIndex
CREATE INDEX "Conversation_hostUserId_idx" ON "Conversation"("hostUserId");

-- CreateIndex
CREATE INDEX "Conversation_guestTempId_idx" ON "Conversation"("guestTempId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_listingId_idx" ON "Message"("listingId");

-- CreateIndex
CREATE INDEX "Message_reservationId_idx" ON "Message"("reservationId");

-- CreateIndex
CREATE INDEX "Message_sentAt_idx" ON "Message"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Payment_listingId_idx" ON "Payment"("listingId");

-- CreateIndex
CREATE INDEX "Payment_reservationId_idx" ON "Payment"("reservationId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "CalendarSync_listingId_idx" ON "CalendarSync"("listingId");

-- CreateIndex
CREATE INDEX "CalendarSync_listingId_lastSyncedAt_idx" ON "CalendarSync"("listingId", "lastSyncedAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_listingId_idx" ON "CalendarEvent"("listingId");

-- CreateIndex
CREATE INDEX "CalendarEvent_calendarSyncId_idx" ON "CalendarEvent"("calendarSyncId");

-- CreateIndex
CREATE INDEX "CalendarEvent_reservationId_idx" ON "CalendarEvent"("reservationId");

-- CreateIndex
CREATE INDEX "CalendarEvent_startDate_idx" ON "CalendarEvent"("startDate");

-- CreateIndex
CREATE INDEX "CalendarEvent_endDate_idx" ON "CalendarEvent"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_listingId_externalUid_source_key" ON "CalendarEvent"("listingId", "externalUid", "source");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_listingId_reservationId_source_key" ON "CalendarEvent"("listingId", "reservationId", "source");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSync" ADD CONSTRAINT "CalendarSync_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_calendarSyncId_fkey" FOREIGN KEY ("calendarSyncId") REFERENCES "CalendarSync"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
