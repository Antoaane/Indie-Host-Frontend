import { Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '@/common/prisma/prisma.service'
import { asObject, deepMerge } from '@/shared/json.utils'

@Injectable()
export class ArrivalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getArrivalResource(listingPublicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
      include: { arrival: true },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    return asObject(listing.arrival?.data)
  }

  async patchArrivalResource(listingPublicId: string, patch: Record<string, unknown>) {
    const listing = await this.prisma.listing.findUnique({ where: { publicId: listingPublicId } })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    const existing = await this.prisma.listingArrival.findUnique({
      where: { listingId: listing.id },
    })

    const merged = deepMerge(asObject(existing?.data), patch)

    await this.prisma.$transaction(async (tx) => {
      await tx.listingArrival.upsert({
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
