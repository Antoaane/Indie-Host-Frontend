import type { PrismaClient } from '@prisma/client';

import { asObject, deepMerge } from '../../lib/json.js';
import { toPrismaJson } from '../../lib/prisma.js';

export class MediasService {
  constructor(private readonly prisma: PrismaClient) {}

  async getListingMedias(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { medias: true },
    });

    if (!listing) return null;

    return asObject(listing.medias, { images: [], videos: [] });
  }

  async patchListingMedias(listingId: string, patch: Record<string, unknown>) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { medias: true },
    });

    if (!listing) return null;

    const current = asObject(listing.medias, { images: [], videos: [] });
    const merged = deepMerge(current, patch);

    await this.prisma.listing.update({
      where: { id: listingId },
      data: { medias: toPrismaJson(merged) },
    });

    return merged;
  }
}
