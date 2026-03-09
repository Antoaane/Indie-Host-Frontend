import type { Listing, Prisma, PrismaClient, User } from '@prisma/client';

import { deepMerge, asObject, toNumber } from '../../lib/json.js';
import { buildListingId } from '../../lib/id.js';
import type { RequestAuth } from '../../types/auth.js';
import { buildHostProfileFromUser, upsertUserFromAuth } from '../users/users.repository.js';
import { buildDefaultResource, type ListingResourceKey } from './listings.constants.js';
import type { CreateListingInput } from './listings.schemas.js';

type ListingRecord = Listing & { owner: User | null };

type ListingSectionBundle = {
  core: Record<string, unknown>;
  bookings: Record<string, unknown>;
  medias: Record<string, unknown>;
  arrival: Record<string, unknown>;
  notes: Record<string, unknown>;
  comments: Record<string, unknown>;
  host: Record<string, unknown>;
};

function toJsonInput(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class ListingsService {
  constructor(private readonly prisma: PrismaClient) {}

  private extractStatus(core: Record<string, unknown>): string {
    const status = core.status;
    if (typeof status === 'string' && status.trim()) return status.trim().toLowerCase();
    return 'draft';
  }

  private buildFallbackBundle(listingId: string): ListingSectionBundle {
    return {
      core: buildDefaultResource('core', listingId),
      bookings: buildDefaultResource('bookings', listingId),
      medias: buildDefaultResource('medias', listingId),
      arrival: buildDefaultResource('arrival', listingId),
      notes: buildDefaultResource('notes', listingId),
      comments: buildDefaultResource('comments', listingId),
      host: buildDefaultResource('host', listingId),
    };
  }

  private toSections(listing: ListingRecord): ListingSectionBundle {
    return {
      core: asObject(listing.core, buildDefaultResource('core', listing.id)),
      bookings: asObject(listing.bookings, buildDefaultResource('bookings', listing.id)),
      medias: asObject(listing.medias, buildDefaultResource('medias', listing.id)),
      arrival: asObject(listing.arrival, buildDefaultResource('arrival', listing.id)),
      notes: asObject(listing.notes, buildDefaultResource('notes', listing.id)),
      comments: asObject(listing.comments, buildDefaultResource('comments', listing.id)),
      host: asObject(listing.host, buildHostProfileFromUser(listing.owner)),
    };
  }

  async createListing(payload: CreateListingInput, auth: RequestAuth | null) {
    const owner = await upsertUserFromAuth(this.prisma, auth);
    const requestedId = typeof payload.core?.id === 'string' ? payload.core.id : '';

    const baseId = buildListingId(requestedId);
    let listingId = baseId;
    let index = 1;

    while (await this.prisma.listing.findUnique({ where: { id: listingId }, select: { id: true } })) {
      listingId = `${baseId}-${index}`;
      index += 1;
    }

    const defaults = this.buildFallbackBundle(listingId);
    const core = payload.core ? deepMerge(defaults.core, payload.core) : defaults.core;
    const bookings = payload.bookings ? deepMerge(defaults.bookings, payload.bookings) : defaults.bookings;
    const medias = payload.medias ? deepMerge(defaults.medias, payload.medias) : defaults.medias;
    const arrival = payload.arrival ? deepMerge(defaults.arrival, payload.arrival) : defaults.arrival;
    const notes = payload.notes ? deepMerge(defaults.notes, payload.notes) : defaults.notes;
    const comments = payload.comments ? deepMerge(defaults.comments, payload.comments) : defaults.comments;
    const host = payload.host ? deepMerge(buildHostProfileFromUser(owner), payload.host) : buildHostProfileFromUser(owner);

    await this.prisma.listing.create({
      data: {
        id: listingId,
        ownerId: owner?.id ?? null,
        status: this.extractStatus(core),
        core: toJsonInput(core),
        bookings: toJsonInput(bookings),
        medias: toJsonInput(medias),
        arrival: toJsonInput(arrival),
        notes: toJsonInput(notes),
        comments: toJsonInput(comments),
        host: toJsonInput(host),
      },
    });

    return { listingId };
  }

  async getListingResource(resource: ListingResourceKey, listingId: string) {
    const select = {
      id: true,
      [resource]: true,
    } as Prisma.ListingSelect;

    if (resource === 'host') {
      select.owner = true;
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select,
    });

    if (!listing) return null;

    const owner = (listing as { owner?: User | null }).owner ?? null;
    const fallback = resource === 'host'
      ? buildHostProfileFromUser(owner)
      : buildDefaultResource(resource, listingId);
    const rawValue = (listing as Record<string, unknown>)[resource];
    return asObject(rawValue, fallback);
  }

  async getListingBundle(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { owner: true },
    });

    if (!listing) return null;

    return this.toSections(listing);
  }

  async patchListingResource(args: {
    listingId: string;
    resource: ListingResourceKey;
    patch: Record<string, unknown>;
    auth: RequestAuth | null;
  }) {
    const { listingId, resource, patch, auth } = args;
    const select = {
      id: true,
      ownerId: true,
      [resource]: true,
    } as Prisma.ListingSelect;

    if (resource === 'host') {
      select.owner = true;
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select,
    });

    if (!listing) return null;

    const actor = await upsertUserFromAuth(this.prisma, auth);

    if (listing.ownerId && (!actor || listing.ownerId !== actor.id)) {
      return 'forbidden' as const;
    }

    const owner = (listing as { owner?: User | null }).owner ?? null;
    const fallback = resource === 'host'
      ? buildHostProfileFromUser(owner)
      : buildDefaultResource(resource, listingId);
    const rawValue = (listing as Record<string, unknown>)[resource];
    const currentValue = asObject(rawValue, fallback);
    const merged = deepMerge(currentValue, patch);

    const data: Prisma.ListingUpdateInput = {
      updatedAt: new Date(),
    };

    if (resource === 'core') {
      data.core = toJsonInput(merged);
      data.status = this.extractStatus(merged);
    }
    if (resource === 'bookings') data.bookings = toJsonInput(merged);
    if (resource === 'medias') data.medias = toJsonInput(merged);
    if (resource === 'arrival') data.arrival = toJsonInput(merged);
    if (resource === 'notes') data.notes = toJsonInput(merged);
    if (resource === 'comments') data.comments = toJsonInput(merged);
    if (resource === 'host') data.host = toJsonInput(merged);

    if (!listing.ownerId && actor) {
      data.owner = {
        connect: { id: actor.id },
      };
    }

    await this.prisma.listing.update({
      where: { id: listingId },
      data,
    });

    return merged;
  }

  listUserCards(listings: Listing[]) {
    return listings.map((listing) => {
      const core = asObject(listing.core, buildDefaultResource('core', listing.id));
      const bookings = asObject(listing.bookings, buildDefaultResource('bookings', listing.id));
      const medias = asObject(listing.medias, buildDefaultResource('medias', listing.id));
      const notes = asObject(listing.notes, buildDefaultResource('notes', listing.id));

      const images = Array.isArray(medias.images)
        ? medias.images.filter((image) => Boolean(image) && typeof image === 'object') as Array<Record<string, unknown>>
        : [];

      const coverSrc = typeof images[0]?.src === 'string' ? images[0].src : undefined;
      const noteRecord = asObject(notes.note);

      return {
        listingId: listing.id,
        title: typeof core.title === 'string' ? core.title : undefined,
        status: typeof core.status === 'string' ? core.status : listing.status,
        hasPendingChanges: Boolean(listing.hasPendingChanges),
        coverSrc,
        images,
        guestCapacity: toNumber(core.guest_capacity, 0) || undefined,
        pricePerNight: toNumber(bookings.price, 0) || undefined,
        rating: toNumber(noteRecord.note, toNumber(notes.note, 0)) || undefined,
      };
    });
  }
}
