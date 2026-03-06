import { Injectable, NotFoundException } from '@nestjs/common'
import { ListingStatus, Prisma } from '@prisma/client'

import { PrismaService } from '@/common/prisma/prisma.service'
import type { CreateListingDto } from '@/listings/dto/create-listing.dto'
import { createListingPublicId } from '@/shared/id.utils'
import { asObject, deepMerge, toFiniteNumber, toStringOrEmpty } from '@/shared/json.utils'

@Injectable()
export class ListingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureOwnerByClerkUserId(clerkUserId: string) {
    return this.prisma.user.upsert({
      where: { clerkUserId },
      update: {},
      create: {
        clerkUserId,
        role: 'HOST',
      },
    })
  }

  async findListingOrThrow(publicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${publicId} not found`)
    }

    return listing
  }

  async createListing(payload: CreateListingDto, ownerClerkUserId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      let ownerId: string | null = null

      if (ownerClerkUserId) {
        const owner = await this.ensureOwnerByClerkUserId(ownerClerkUserId)
        ownerId = owner.id
      }

      const listingPublicId = toStringOrEmpty(payload.core?.id) || createListingPublicId()
      const statusFromPayload = toStringOrEmpty(payload.core?.status).toUpperCase()
      const normalizedStatus =
        statusFromPayload in ListingStatus ? (statusFromPayload as ListingStatus) : ListingStatus.DRAFT

      const listing = await tx.listing.create({
        data: {
          publicId: listingPublicId,
          ownerId,
          status: normalizedStatus,
          hasPendingChanges: true,
          core: {
            create: {
              data: asObject(payload.core),
            },
          },
          bookings: {
            create: {
              data: asObject(payload.bookings),
            },
          },
          medias: {
            create: {
              data: asObject(payload.medias),
            },
          },
          arrival: {
            create: {
              data: asObject(payload.arrival),
            },
          },
          notes: {
            create: {
              data: asObject(payload.notes),
            },
          },
          comments: {
            create: {
              data: asObject(payload.comments),
            },
          },
          host: {
            create: {
              data: asObject(payload.host),
            },
          },
        },
      })

      return listing
    })
  }

  async getUserListings(userId: string) {
    const listings = await this.prisma.listing.findMany({
      where: {
        owner: {
          clerkUserId: userId,
        },
      },
      include: {
        core: true,
        medias: true,
        bookings: true,
        notes: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    return listings.map((listing) => mapListingCard(listing))
  }

  async getPublicListings() {
    const listings = await this.prisma.listing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
      },
      include: {
        core: true,
        medias: true,
        bookings: true,
        notes: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    })

    return listings.map((listing) => mapListingCard(listing))
  }

  async getCoreResource(listingPublicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
      include: { core: true },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    return asObject(listing.core?.data)
  }

  async patchCoreResource(listingPublicId: string, patch: Record<string, unknown>) {
    const listing = await this.findListingOrThrow(listingPublicId)

    const existing = await this.prisma.listingCore.findUnique({
      where: { listingId: listing.id },
    })

    const merged = deepMerge(asObject(existing?.data), patch)

    await this.prisma.$transaction(async (tx) => {
      await tx.listingCore.upsert({
        where: { listingId: listing.id },
        update: { data: merged },
        create: { listingId: listing.id, data: merged },
      })

      await tx.listing.update({
        where: { id: listing.id },
        data: {
          hasPendingChanges: true,
          status: resolveStatusFromCore(merged),
        },
      })
    })

    return merged
  }

  async getHostResource(listingPublicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
      include: { host: true },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    return asObject(listing.host?.data)
  }

  async patchHostResource(listingPublicId: string, patch: Record<string, unknown>) {
    const listing = await this.findListingOrThrow(listingPublicId)

    const existing = await this.prisma.listingHost.findUnique({
      where: { listingId: listing.id },
    })

    const merged = deepMerge(asObject(existing?.data), patch)

    await this.prisma.$transaction(async (tx) => {
      await tx.listingHost.upsert({
        where: { listingId: listing.id },
        update: { data: merged },
        create: { listingId: listing.id, data: merged },
      })

      await tx.listing.update({
        where: { id: listing.id },
        data: { hasPendingChanges: true },
      })
    })

    return merged
  }
}

function mapListingCard(listing: {
  publicId: string
  status: ListingStatus
  hasPendingChanges: boolean
  core: { data: Prisma.JsonValue } | null
  medias: { data: Prisma.JsonValue } | null
  bookings: { data: Prisma.JsonValue } | null
  notes: { data: Prisma.JsonValue } | null
}) {
  const core = asObject(listing.core?.data)
  const medias = asObject(listing.medias?.data)
  const bookings = asObject(listing.bookings?.data)
  const notes = asObject(listing.notes?.data)

  const imagesRaw = Array.isArray(medias.images) ? medias.images : []
  const images = imagesRaw
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry, index) => ({
      src: toStringOrEmpty(entry.src),
      alt: toStringOrEmpty(entry.alt) || undefined,
      position: Number.isFinite(Number(entry.position)) ? Number(entry.position) : index,
    }))
    .filter((entry) => entry.src)

  const ratingContainer = asObject(notes.note)

  return {
    listingId: listing.publicId,
    title: toStringOrEmpty(core.title),
    status: toStringOrEmpty(core.status) || listing.status.toLowerCase(),
    hasPendingChanges: listing.hasPendingChanges,
    coverSrc: images[0]?.src,
    images,
    guestCapacity: toFiniteNumber(core.guest_capacity, 0),
    pricePerNight: toFiniteNumber(bookings.price, 0),
    rating: toFiniteNumber(ratingContainer.note, 0),
  }
}

function resolveStatusFromCore(core: Prisma.JsonObject): ListingStatus {
  const coreStatus = toStringOrEmpty(core.status).toUpperCase()
  if (coreStatus === 'ACTIVE' || coreStatus === 'PUBLISHED') return ListingStatus.ACTIVE
  if (coreStatus === 'PAUSED') return ListingStatus.PAUSED
  if (coreStatus === 'ARCHIVED') return ListingStatus.ARCHIVED
  if (coreStatus === 'BLOCKED') return ListingStatus.BLOCKED
  if (coreStatus === 'DELETED') return ListingStatus.DELETED
  return ListingStatus.DRAFT
}
