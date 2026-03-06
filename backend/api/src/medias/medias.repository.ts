import { Injectable, NotFoundException } from '@nestjs/common'
import { MediaType, type Listing, type Prisma } from '@prisma/client'

import { PrismaService } from '@/common/prisma/prisma.service'
import { asObject, deepMerge, isPlainObject, toNonNegativeInt, toStringOrEmpty } from '@/shared/json.utils'

@Injectable()
export class MediasRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async findListingOrThrow(listingPublicId: string): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    return listing
  }

  async getMediasResource(listingPublicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
      include: { medias: true },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    return asObject(listing.medias?.data)
  }

  async patchMediasResource(listingPublicId: string, patch: Record<string, unknown>) {
    const listing = await this.findListingOrThrow(listingPublicId)

    const existing = await this.prisma.listingMedias.findUnique({
      where: { listingId: listing.id },
    })

    const merged = deepMerge(asObject(existing?.data), patch)

    await this.prisma.$transaction(async (tx) => {
      await tx.listingMedias.upsert({
        where: { listingId: listing.id },
        update: { data: merged },
        create: { listingId: listing.id, data: merged },
      })

      await tx.listing.update({
        where: { id: listing.id },
        data: { hasPendingChanges: true },
      })

      await this.syncMediaAssets(tx, listing.id, merged)
    })

    return merged
  }

  private async syncMediaAssets(
    tx: Prisma.TransactionClient,
    listingId: string,
    mediasPayload: Record<string, unknown>,
  ) {
    const images = Array.isArray(mediasPayload.images)
      ? mediasPayload.images.filter((entry): entry is Record<string, unknown> => isPlainObject(entry))
      : []

    const videos = Array.isArray(mediasPayload.videos)
      ? mediasPayload.videos.filter((entry): entry is Record<string, unknown> => isPlainObject(entry))
      : []

    const assets = [
      ...images.map((entry, index) => ({
        listingId,
        type: MediaType.IMAGE,
        url: toStringOrEmpty(entry.src),
        alt: toStringOrEmpty(entry.alt) || null,
        position: toNonNegativeInt(entry.position, index),
        metadata: asObject(entry),
      })),
      ...videos.map((entry, index) => ({
        listingId,
        type: MediaType.VIDEO,
        url: toStringOrEmpty(entry.src),
        alt: toStringOrEmpty(entry.alt) || null,
        position: toNonNegativeInt(entry.position, index),
        metadata: asObject(entry),
      })),
    ].filter((asset) => asset.url)

    await tx.mediaAsset.deleteMany({
      where: { listingId },
    })

    if (!assets.length) return

    await tx.mediaAsset.createMany({
      data: assets,
    })
  }
}
