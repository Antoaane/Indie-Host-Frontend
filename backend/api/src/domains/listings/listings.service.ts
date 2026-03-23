import type { Listing, Prisma, PrismaClient, User } from '@prisma/client';

import { env } from '../../config/env.js';
import { deepMerge, asObject, toNumber } from '../../lib/json.js';
import { buildListingId, buildReservationId } from '../../lib/id.js';
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

export type ListingSlugResolution = {
  listingId: string;
  slug: string;
  publicUrl: string;
};

type ResolveListingByHostnameInput = {
  hostname: string;
  listingSlug?: string | null;
  auth?: RequestAuth | null;
};

type CheckSubdomainAvailabilityInput = {
  excludeListingId?: string;
  auth?: RequestAuth | null;
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

function stripAccents(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizePublicListingSlug(value: unknown): string {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input) return '';

  return stripAccents(input)
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

const TRANSIENT_LISTING_SLUG_PATTERN = /^(?:landing|listing)-preview(?:-[a-z0-9]+)?$/i;

function isTransientListingSlug(value: string): boolean {
  return TRANSIENT_LISTING_SLUG_PATTERN.test(value);
}

function buildListingSlugFromCore(core: Record<string, unknown>, listingId: string): string {
  const fromExisting = normalizePublicListingSlug(core.slug);
  if (fromExisting && !isTransientListingSlug(fromExisting)) return fromExisting;

  const fromTitle = normalizePublicListingSlug(core.title);
  if (fromTitle) return fromTitle;

  const fromListingId = normalizePublicListingSlug(listingId);
  if (fromListingId && !isTransientListingSlug(fromListingId)) return fromListingId;

  return 'annonce';
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

  private hasSelectedSubscriptionPlan(user: User | null | undefined): boolean {
    if (!user) return false;
    const profile = asObject(user.stripeConnectProfile);
    const billing = asObject(profile.billing);
    const activePlanCode = readString(billing.planCode);
    const pendingPlanCode = readString(billing.pendingPlanCode);
    return Boolean(activePlanCode || pendingPlanCode);
  }

  private isActorOwner(listingOwnerId: string | null, actor: User | null) {
    if (!listingOwnerId || !actor) return false;
    return listingOwnerId === actor.id;
  }

  private getListingStatus(listing: Pick<Listing, 'id' | 'status' | 'core'>): string {
    const core = asObject(listing.core, buildDefaultResource('core', listing.id));
    const coreStatus = readString(core.status)?.toLowerCase();
    if (coreStatus) return coreStatus;

    const listingStatus = readString(listing.status)?.toLowerCase();
    return listingStatus ?? 'draft';
  }

  private async buildUniqueListingSlug(baseSlug: string, exceptListingId?: string): Promise<string> {
    const normalizedBase = normalizePublicListingSlug(baseSlug) || 'annonce';
    const listings = await this.prisma.listing.findMany({
      select: {
        id: true,
        core: true,
      },
    });

    const takenSlugs = new Set<string>();

    for (const listing of listings) {
      if (exceptListingId && listing.id === exceptListingId) continue;
      const core = asObject(listing.core, buildDefaultResource('core', listing.id));
      const candidateSlug = buildListingSlugFromCore(core, listing.id);
      if (candidateSlug) {
        takenSlugs.add(candidateSlug);
      }
    }

    if (!takenSlugs.has(normalizedBase)) return normalizedBase;

    let suffix = 2;
    let candidate = `${normalizedBase}-${suffix}`;
    while (takenSlugs.has(candidate)) {
      suffix += 1;
      candidate = `${normalizedBase}-${suffix}`;
    }

    return candidate;
  }

  private buildManagedListingPublicUrl(subdomainSlug: string, listingSlug?: string | null): string {
    const baseUrl = this.buildListingPublicUrl(subdomainSlug);
    const normalizedListingSlug = normalizePublicListingSlug(listingSlug ?? '');
    if (!normalizedListingSlug) return baseUrl;
    return `${baseUrl}/${normalizedListingSlug}`;
  }

  private normalizeReservationId(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
  }

  private async reservationIdExistsOnAnotherListing(reservationId: string, listingId: string): Promise<boolean> {
    const existing = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        listingId: true,
      },
    });

    if (!existing) return false;
    return existing.listingId !== listingId;
  }

  private async ensureBookingReservationId(preferredId: string | null, listingId: string, usedIds: Set<string>): Promise<string> {
    let candidate = preferredId ?? buildReservationId(listingId);
    let attempts = 0;

    while (attempts < 20) {
      const alreadyUsedInPayload = usedIds.has(candidate);
      const existsOnAnotherListing = await this.reservationIdExistsOnAnotherListing(candidate, listingId);

      if (!alreadyUsedInPayload && !existsOnAnotherListing) {
        return candidate;
      }

      candidate = buildReservationId(listingId);
      attempts += 1;
    }

    return `${buildReservationId(listingId)}-${Date.now().toString(36)}`;
  }

  private async normalizeBookingsResourceValue(listingId: string, value: Record<string, unknown>): Promise<Record<string, unknown>> {
    const reservationsRaw = Array.isArray(value.reservations)
      ? value.reservations.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      : [];

    const usedReservationIds = new Set<string>();
    const normalizedReservations: Array<Record<string, unknown>> = [];

    for (const reservation of reservationsRaw) {
      const preferredId = this.normalizeReservationId(reservation.id);
      const reservationId = await this.ensureBookingReservationId(preferredId, listingId, usedReservationIds);
      usedReservationIds.add(reservationId);

      normalizedReservations.push({
        ...reservation,
        id: reservationId,
      });
    }

    const bookedDaysRaw = Array.isArray(value['booked-days'])
      ? value['booked-days'].filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      : [];
    const externalBookedDaysRaw = Array.isArray(value['external-booked-days'])
      ? value['external-booked-days'].filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      : [];

    const bookedDaysByRange = new Map<string, { start: string; end: string }>();
    const externalBookedDaysByRange = new Map<string, { start: string; end: string }>();

    for (const item of bookedDaysRaw) {
      const start = typeof item.start === 'string' ? item.start.trim() : '';
      const end = typeof item.end === 'string' ? item.end.trim() : '';
      if (!start || !end) continue;
      bookedDaysByRange.set(`${start}__${end}`, { start, end });
    }

    for (const item of externalBookedDaysRaw) {
      const start = typeof item.start === 'string' ? item.start.trim() : '';
      const end = typeof item.end === 'string' ? item.end.trim() : '';
      if (!start || !end) continue;
      const range = { start, end };
      externalBookedDaysByRange.set(`${start}__${end}`, range);
      bookedDaysByRange.set(`${start}__${end}`, range);
    }

    for (const reservation of normalizedReservations) {
      const start = typeof reservation.start === 'string' ? reservation.start.trim() : '';
      const end = typeof reservation.end === 'string' ? reservation.end.trim() : '';
      if (!start || !end) continue;
      bookedDaysByRange.set(`${start}__${end}`, { start, end });
    }

    return {
      ...value,
      reservations: normalizedReservations,
      'booked-days': Array.from(bookedDaysByRange.values()),
      'external-booked-days': Array.from(externalBookedDaysByRange.values()),
    };
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

  private async toDomainRecord(listing: {
    id: string;
    ownerId: string | null;
    subdomainSlug: string | null;
    core: unknown;
  }): Promise<ListingDomainRecord> {
    const normalizedSubdomain = typeof listing.subdomainSlug === 'string' && listing.subdomainSlug.trim()
      ? normalizeSlug(listing.subdomainSlug)
      : null;

    if (!normalizedSubdomain) {
      return {
        listingId: listing.id,
        subdomainSlug: null,
        hostname: null,
        publicUrl: null,
      };
    }

    const listingCore = asObject(listing.core, buildDefaultResource('core', listing.id));
    const listingSlug = buildListingSlugFromCore(listingCore, listing.id);

    const ownerScopedCount = listing.ownerId
      ? await this.prisma.listing.count({
          where: {
            ownerId: listing.ownerId,
            subdomainSlug: normalizedSubdomain,
          },
        })
      : 1;

    const publicUrl = ownerScopedCount > 1
      ? this.buildManagedListingPublicUrl(normalizedSubdomain, listingSlug)
      : this.buildListingPublicUrl(normalizedSubdomain);

    return {
      listingId: listing.id,
      subdomainSlug: normalizedSubdomain,
      hostname: this.buildListingHostname(normalizedSubdomain),
      publicUrl,
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
        core: true,
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
    const core = asObject(listing.core, buildDefaultResource('core', listing.id));
    const slug = buildListingSlugFromCore(core, listing.id);

    return {
      core: {
        ...core,
        id: listing.id,
        slug,
      },
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
    core.id = listingId;
    const requestedSlug = buildListingSlugFromCore(core, listingId);
    core.slug = await this.buildUniqueListingSlug(requestedSlug);
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

  async getListingBundle(listingId: string, auth: RequestAuth | null = null) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { owner: true },
    });

    if (!listing) return null;
    const actor = await upsertUserFromAuth(this.prisma, auth);
    const isOwner = this.isActorOwner(listing.ownerId, actor);

    if (!isOwner && this.getListingStatus(listing) === 'deleted') {
      return null;
    }

    return this.toSections(listing);
  }

  async getListingDomain(listingId: string, auth: RequestAuth | null) {
    const access = await this.findOwnedListing(listingId, auth);
    if (!access) return null;
    if (access === 'forbidden') return 'forbidden' as const;
    return this.toDomainRecord(access.listing);
  }

  async checkSubdomainAvailability(slug: string, options?: CheckSubdomainAvailabilityInput): Promise<ListingDomainAvailability> {
    const normalizedSlug = normalizeSlug(slug);
    const hostname = this.buildListingHostname(normalizedSlug);
    const publicUrl = this.buildListingPublicUrl(normalizedSlug);
    const actor = await upsertUserFromAuth(this.prisma, options?.auth ?? null);

    if (this.reservedSlugs.has(normalizedSlug)) {
      return {
        slug: normalizedSlug,
        available: false,
        hostname,
        publicUrl,
        reason: 'Ce sous-domaine est réservé.',
      };
    }

    if (!this.hasSelectedSubscriptionPlan(actor)) {
      return {
        slug: normalizedSlug,
        available: false,
        hostname,
        publicUrl,
        reason: 'Un plan d abonnement est requis pour réserver un sous-domaine.',
      };
    }

    let allowedExcludeListingId: string | undefined;
    const requestedExcludeListingId = options?.excludeListingId?.trim();
    if (requestedExcludeListingId) {
      const candidate = await this.prisma.listing.findUnique({
        where: { id: requestedExcludeListingId },
        select: { id: true, ownerId: true },
      });
      if (candidate && actor && (!candidate.ownerId || candidate.ownerId === actor.id)) {
        allowedExcludeListingId = candidate.id;
      }
    }

    const existing = await this.prisma.listing.findMany({
      where: { subdomainSlug: normalizedSlug },
      select: { id: true, ownerId: true },
    });

    const blockedByAnotherAccount = existing.some((item) => {
      if (allowedExcludeListingId && item.id === allowedExcludeListingId) return false;
      if (!item.ownerId) return true;
      return item.ownerId !== actor?.id;
    });

    return {
      slug: normalizedSlug,
      available: !blockedByAnotherAccount,
      hostname,
      publicUrl,
      reason: blockedByAnotherAccount ? 'Ce sous-domaine est déjà pris par un autre compte.' : null,
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
    if (!this.hasSelectedSubscriptionPlan(access.actor)) return 'subscription_required' as const;

    const normalizedSlug = normalizeSlug(args.slug);
    const availability = await this.checkSubdomainAvailability(normalizedSlug, {
      excludeListingId: args.listingId,
      auth: args.auth,
    });
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
        ownerId: true,
        subdomainSlug: true,
        core: true,
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
        ownerId: true,
        subdomainSlug: true,
        core: true,
      },
    });

    return this.toDomainRecord(updated);
  }

  async resolveListingByHostname(input: ResolveListingByHostnameInput): Promise<ListingHostnameResolution | null> {
    const managedSubdomain = this.extractManagedSlug(input.hostname);
    if (!managedSubdomain) return null;

    const actor = await upsertUserFromAuth(this.prisma, input.auth ?? null);
    const listings = await this.prisma.listing.findMany({
      where: { subdomainSlug: managedSubdomain },
      select: {
        id: true,
        ownerId: true,
        status: true,
        core: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const visibleListings = listings.filter((listing) => {
      const isOwner = this.isActorOwner(listing.ownerId, actor);
      if (isOwner) return true;
      return this.getListingStatus(listing) !== 'deleted';
    });

    if (!visibleListings.length) return null;

    const normalizedListingSlug = normalizePublicListingSlug(input.listingSlug ?? '');
    if (normalizedListingSlug) {
      const matched = visibleListings.find((listing) => {
        const listingCore = asObject(listing.core, buildDefaultResource('core', listing.id));
        return buildListingSlugFromCore(listingCore, listing.id) === normalizedListingSlug;
      });
      if (!matched) return null;

      return {
        listingId: matched.id,
        subdomainSlug: managedSubdomain,
        hostname: this.buildListingHostname(managedSubdomain),
        publicUrl: this.buildManagedListingPublicUrl(managedSubdomain, normalizedListingSlug),
      };
    }

    if (visibleListings.length !== 1) {
      return null;
    }

    const matched = visibleListings[0];
    if (!matched) return null;
    return {
      listingId: matched.id,
      subdomainSlug: managedSubdomain,
      hostname: this.buildListingHostname(managedSubdomain),
      publicUrl: this.buildListingPublicUrl(managedSubdomain),
    };
  }

  async resolveListingBySlug(slug: string, auth: RequestAuth | null = null): Promise<ListingSlugResolution | null> {
    const normalizedSlug = normalizePublicListingSlug(slug);
    if (!normalizedSlug) return null;

    const actor = await upsertUserFromAuth(this.prisma, auth);
    const listings = await this.prisma.listing.findMany({
      select: {
        id: true,
        ownerId: true,
        status: true,
        subdomainSlug: true,
        core: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    for (const listing of listings) {
      if (listing.subdomainSlug) continue;
      const core = asObject(listing.core, buildDefaultResource('core', listing.id));
      const listingSlug = buildListingSlugFromCore(core, listing.id);
      if (listingSlug !== normalizedSlug) continue;

      const isOwner = this.isActorOwner(listing.ownerId, actor);
      if (!isOwner && this.getListingStatus(listing) === 'deleted') {
        continue;
      }

      return {
        listingId: listing.id,
        slug: listingSlug,
        publicUrl: `/${listingSlug}`,
      };
    }

    return null;
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
        ownerId: true,
        subdomainSlug: true,
        core: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const ownerScopedSubdomainCounts = new Map<string, number>();

    for (const listing of listings) {
      if (!listing.ownerId || !listing.subdomainSlug) continue;
      const key = `${listing.ownerId}::${listing.subdomainSlug}`;
      ownerScopedSubdomainCounts.set(key, (ownerScopedSubdomainCounts.get(key) ?? 0) + 1);
    }

    return listings
      .filter((listing): listing is typeof listing & { subdomainSlug: string } => Boolean(listing.subdomainSlug))
      .map((listing) => {
        const listingCore = asObject(listing.core, buildDefaultResource('core', listing.id));
        const listingSlug = buildListingSlugFromCore(listingCore, listing.id);
        const ownerScopedCount = listing.ownerId
          ? ownerScopedSubdomainCounts.get(`${listing.ownerId}::${listing.subdomainSlug}`) ?? 1
          : 1;
        const publicUrl = ownerScopedCount > 1
          ? this.buildManagedListingPublicUrl(listing.subdomainSlug, listingSlug)
          : this.buildListingPublicUrl(listing.subdomainSlug);

        return {
          listingId: listing.id,
          publicUrl,
          updatedAt: listing.updatedAt.toISOString(),
        };
      });
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
    let normalizedMerged = resource === 'bookings'
      ? await this.normalizeBookingsResourceValue(listingId, merged)
      : merged;

    const data: Prisma.ListingUpdateInput = {
      updatedAt: new Date(),
    };

    if (resource === 'core') {
      normalizedMerged.id = listingId;
      const currentSlug = normalizePublicListingSlug(currentValue.slug);
      if (currentSlug && !isTransientListingSlug(currentSlug)) {
        normalizedMerged.slug = currentSlug;
      } else {
        const requestedSlug = buildListingSlugFromCore(normalizedMerged, listingId);
        normalizedMerged.slug = await this.buildUniqueListingSlug(requestedSlug, listingId);
      }
      const nextStatus = this.extractStatus(normalizedMerged);
      if (nextStatus === 'published') {
        this.assertCanPublishListing(actor);
      }
      data.core = toJsonInput(normalizedMerged);
      data.status = nextStatus;
    }
    if (resource === 'bookings') data.bookings = toJsonInput(normalizedMerged);
    if (resource === 'medias') data.medias = toJsonInput(normalizedMerged);
    if (resource === 'arrival') data.arrival = toJsonInput(normalizedMerged);
    if (resource === 'notes') data.notes = toJsonInput(normalizedMerged);
    if (resource === 'comments') data.comments = toJsonInput(normalizedMerged);
    if (resource === 'host') data.host = toJsonInput(normalizedMerged);

    if (!listing.ownerId && actor) {
      data.owner = {
        connect: { id: actor.id },
      };
    }

    await this.prisma.listing.update({
      where: { id: listingId },
      data,
    });

    return normalizedMerged;
  }

  listUserCards(listings: Listing[]) {
    const ownerScopedSubdomainCounts = new Map<string, number>();
    for (const listing of listings) {
      if (!listing.ownerId || !listing.subdomainSlug) continue;
      const key = `${listing.ownerId}::${listing.subdomainSlug}`;
      ownerScopedSubdomainCounts.set(key, (ownerScopedSubdomainCounts.get(key) ?? 0) + 1);
    }

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
      const slug = buildListingSlugFromCore(core, listing.id);
      const ownerScopedCount = listing.ownerId && listing.subdomainSlug
        ? ownerScopedSubdomainCounts.get(`${listing.ownerId}::${listing.subdomainSlug}`) ?? 1
        : 1;
      const publicUrl = listing.subdomainSlug
        ? ownerScopedCount > 1
          ? this.buildManagedListingPublicUrl(listing.subdomainSlug, slug)
          : this.buildListingPublicUrl(listing.subdomainSlug)
        : undefined;

      return {
        listingId: listing.id,
        slug,
        subdomainSlug: listing.subdomainSlug ?? undefined,
        publicUrl,
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
