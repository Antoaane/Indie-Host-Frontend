import type { Listing, Prisma, PrismaClient, User } from '@prisma/client';

import { env } from '../../config/env.js';
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

export type ListingDomainRecord = {
  listingId: string;
  subdomainSlug: string | null;
  hostname: string | null;
  publicUrl: string | null;
};

export type ListingDomainAvailability = {
  slug: string;
  available: boolean;
  hostname: string;
  publicUrl: string;
  reason: string | null;
};

export type ListingHostnameResolution = {
  listingId: string;
  subdomainSlug: string;
  hostname: string;
  publicUrl: string;
};

export type ListingSitemapEntry = {
  listingId: string;
  publicUrl: string;
  updatedAt: string;
};

type ListingPublicationReadiness = {
  canPublish: boolean;
  hasAuthenticatedUser: boolean;
  hasActiveSubscription: boolean;
  hasConnectAccount: boolean;
  connectOnboardingCompleted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  missingRequirements: string[];
};

const PUBLICATION_ELIGIBLE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
]);

function toJsonInput(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeRootDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^\*\./, '').replace(/\/+$/, '');
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function sanitizeHostname(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return '';

  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0]?.trim().toLowerCase() ?? '';
  }
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

class ListingPublicationForbiddenError extends Error {
  readonly statusCode = 403;
  readonly code = 'LISTING_PUBLICATION_REQUIREMENTS_NOT_MET';

  constructor(public readonly details: ListingPublicationReadiness) {
    super('Publishing requires an active subscription and a fully configured Stripe Connect account.');
  }
}

export class ListingsService {
  private readonly rootDomain = normalizeRootDomain(env.PUBLIC_LISTING_ROOT_DOMAIN);
  private readonly reservedSlugs = new Set([
    'www',
    'app',
    'api',
    'admin',
    'pricing',
    'editor',
    'management',
    'domains',
    'messagerie',
    'sign-in',
    'sign-up',
    'donation',
    'listing',
    'listing-guide',
    'health',
  ]);

  constructor(private readonly prisma: PrismaClient) {}

  private extractStatus(core: Record<string, unknown>): string {
    const status = core.status;
    if (typeof status === 'string' && status.trim()) return status.trim().toLowerCase();
    return 'draft';
  }

  private buildPublicationReadiness(user: User | null | undefined): ListingPublicationReadiness {
    const hasAuthenticatedUser = Boolean(user);
    const profile = user ? asObject(user.stripeConnectProfile) : {};
    const billing = asObject(profile.billing);

    const subscriptionStatus = readString(billing.status)?.toLowerCase() ?? null;
    const hasActiveSubscription = Boolean(
      subscriptionStatus
      && PUBLICATION_ELIGIBLE_SUBSCRIPTION_STATUSES.has(subscriptionStatus),
    );

    const accountIdFromProfile = readString(profile.accountId);
    const hasConnectAccount = Boolean(user?.stripeConnectAccountId ?? accountIdFromProfile);
    const onboardingStatus = readString(profile.onboardingStatus) ?? 'not_started';
    const connectOnboardingCompleted = onboardingStatus === 'completed';
    const chargesEnabled = readBoolean(profile.chargesEnabled, false);
    const payoutsEnabled = readBoolean(profile.payoutsEnabled, false);

    const missingRequirements: string[] = [];
    if (!hasAuthenticatedUser) missingRequirements.push('authenticated_user');
    if (!hasActiveSubscription) missingRequirements.push('active_subscription');
    if (!hasConnectAccount) missingRequirements.push('stripe_connect_account');
    if (!connectOnboardingCompleted) missingRequirements.push('stripe_connect_onboarding');
    if (!chargesEnabled) missingRequirements.push('stripe_connect_charges_enabled');
    if (!payoutsEnabled) missingRequirements.push('stripe_connect_payouts_enabled');

    return {
      canPublish: missingRequirements.length === 0,
      hasAuthenticatedUser,
      hasActiveSubscription,
      hasConnectAccount,
      connectOnboardingCompleted,
      chargesEnabled,
      payoutsEnabled,
      missingRequirements,
    };
  }

  private assertCanPublishListing(user: User | null | undefined) {
    const readiness = this.buildPublicationReadiness(user);
    if (!readiness.canPublish) {
      throw new ListingPublicationForbiddenError(readiness);
    }
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

  private buildListingHostname(slug: string): string {
    return `${normalizeSlug(slug)}.${this.rootDomain}`;
  }

  private buildListingPublicUrl(slug: string): string {
    return `https://${this.buildListingHostname(slug)}`;
  }

  private toDomainRecord(listing: { id: string; subdomainSlug: string | null }): ListingDomainRecord {
    const slug = typeof listing.subdomainSlug === 'string' && listing.subdomainSlug.trim()
      ? normalizeSlug(listing.subdomainSlug)
      : null;

    return {
      listingId: listing.id,
      subdomainSlug: slug,
      hostname: slug ? this.buildListingHostname(slug) : null,
      publicUrl: slug ? this.buildListingPublicUrl(slug) : null,
    };
  }

  private extractManagedSlug(hostname: string): string | null {
    const normalizedHostname = sanitizeHostname(hostname);
    if (!normalizedHostname || !this.rootDomain) return null;
    if (normalizedHostname === this.rootDomain || normalizedHostname === `www.${this.rootDomain}`) return null;
    if (!normalizedHostname.endsWith(`.${this.rootDomain}`)) return null;

    const slug = normalizedHostname.slice(0, -(this.rootDomain.length + 1));
    if (!slug || slug.includes('.')) return null;
    return normalizeSlug(slug);
  }

  private async findOwnedListing(listingId: string, auth: RequestAuth | null) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        ownerId: true,
        subdomainSlug: true,
      },
    });

    if (!listing) return null;

    const actor = await upsertUserFromAuth(this.prisma, auth);
    if (listing.ownerId && (!actor || listing.ownerId !== actor.id)) {
      return 'forbidden' as const;
    }

    return { listing, actor };
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
    const listingStatus = this.extractStatus(core);

    if (listingStatus === 'published') {
      this.assertCanPublishListing(owner);
    }

    await this.prisma.listing.create({
      data: {
        id: listingId,
        ownerId: owner?.id ?? null,
        status: listingStatus,
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

  async getListingDomain(listingId: string, auth: RequestAuth | null) {
    const access = await this.findOwnedListing(listingId, auth);
    if (!access) return null;
    if (access === 'forbidden') return 'forbidden' as const;
    return this.toDomainRecord(access.listing);
  }

  async checkSubdomainAvailability(slug: string, excludeListingId?: string): Promise<ListingDomainAvailability> {
    const normalizedSlug = normalizeSlug(slug);
    const hostname = this.buildListingHostname(normalizedSlug);
    const publicUrl = this.buildListingPublicUrl(normalizedSlug);

    if (this.reservedSlugs.has(normalizedSlug)) {
      return {
        slug: normalizedSlug,
        available: false,
        hostname,
        publicUrl,
        reason: 'Ce sous-domaine est réservé.',
      };
    }

    const existing = await this.prisma.listing.findUnique({
      where: { subdomainSlug: normalizedSlug },
      select: { id: true },
    });

    const isOwnedByExcludedListing = Boolean(existing && excludeListingId && existing.id === excludeListingId);

    return {
      slug: normalizedSlug,
      available: !existing || isOwnedByExcludedListing,
      hostname,
      publicUrl,
      reason: !existing || isOwnedByExcludedListing ? null : 'Ce sous-domaine est déjà pris.',
    };
  }

  async upsertListingDomain(args: {
    listingId: string;
    slug: string;
    auth: RequestAuth | null;
  }) {
    const access = await this.findOwnedListing(args.listingId, args.auth);
    if (!access) return null;
    if (access === 'forbidden') return 'forbidden' as const;

    const normalizedSlug = normalizeSlug(args.slug);
    const availability = await this.checkSubdomainAvailability(normalizedSlug, args.listingId);
    if (!availability.available) {
      return 'conflict' as const;
    }

    const updated = await this.prisma.listing.update({
      where: { id: args.listingId },
      data: {
        subdomainSlug: normalizedSlug,
        ...(access.listing.ownerId || !access.actor
          ? {}
          : {
              owner: {
                connect: { id: access.actor.id },
              },
            }),
      },
      select: {
        id: true,
        subdomainSlug: true,
      },
    });

    return this.toDomainRecord(updated);
  }

  async deleteListingDomain(args: {
    listingId: string;
    auth: RequestAuth | null;
  }) {
    const access = await this.findOwnedListing(args.listingId, args.auth);
    if (!access) return null;
    if (access === 'forbidden') return 'forbidden' as const;

    const updated = await this.prisma.listing.update({
      where: { id: args.listingId },
      data: {
        subdomainSlug: null,
      },
      select: {
        id: true,
        subdomainSlug: true,
      },
    });

    return this.toDomainRecord(updated);
  }

  async resolveListingByHostname(hostname: string): Promise<ListingHostnameResolution | null> {
    const slug = this.extractManagedSlug(hostname);
    if (!slug) return null;

    const listing = await this.prisma.listing.findUnique({
      where: { subdomainSlug: slug },
      select: {
        id: true,
        subdomainSlug: true,
      },
    });

    if (!listing?.subdomainSlug) return null;

    return {
      listingId: listing.id,
      subdomainSlug: listing.subdomainSlug,
      hostname: this.buildListingHostname(listing.subdomainSlug),
      publicUrl: this.buildListingPublicUrl(listing.subdomainSlug),
    };
  }

  async listSitemapEntries(): Promise<ListingSitemapEntry[]> {
    const listings = await this.prisma.listing.findMany({
      where: {
        status: 'published',
        NOT: {
          subdomainSlug: null,
        },
      },
      select: {
        id: true,
        subdomainSlug: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return listings
      .filter((listing): listing is typeof listing & { subdomainSlug: string } => Boolean(listing.subdomainSlug))
      .map((listing) => ({
        listingId: listing.id,
        publicUrl: this.buildListingPublicUrl(listing.subdomainSlug),
        updatedAt: listing.updatedAt.toISOString(),
      }));
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
      const nextStatus = this.extractStatus(merged);
      if (nextStatus === 'published') {
        this.assertCanPublishListing(actor);
      }
      data.core = toJsonInput(merged);
      data.status = nextStatus;
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
        subdomainSlug: listing.subdomainSlug ?? undefined,
        publicUrl: listing.subdomainSlug ? this.buildListingPublicUrl(listing.subdomainSlug) : undefined,
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
