import { Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '@/common/prisma/prisma.service'
import { asObject, deepMerge } from '@/shared/json.utils'

@Injectable()
export class NotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getNotesResource(listingPublicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
      include: { notes: true },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    return asObject(listing.notes?.data)
  }

  async patchNotesResource(listingPublicId: string, patch: Record<string, unknown>) {
    const listing = await this.prisma.listing.findUnique({ where: { publicId: listingPublicId } })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    const existing = await this.prisma.listingNotes.findUnique({
      where: { listingId: listing.id },
    })

    const merged = deepMerge(asObject(existing?.data), patch)

    await this.prisma.$transaction(async (tx) => {
      await tx.listingNotes.upsert({
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
