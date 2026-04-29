import type { Listing, Prisma, PrismaClient, User } from '@prisma/client';

import { env } from '../../config/env.js';
import { deepMerge, asObject, toNumber } from '../../lib/json.js';
import { buildListingId, buildReservationId } from '../../lib/id.js';
import { toPrismaJson } from '../../lib/prisma.js';
import { hasAdminAccess } from '../../lib/authRole.js';
import { buildRequestAuthFromClerkUser, fetchClerkUserById, type ClerkUserProfile } from '../../lib/clerkUsers.js';
import type { RequestAuth } from '../../types/auth.js';
import {
  buildHostProfileFromUser,
  isDeprecatedHostIdentity,
  resolveUserByIdentifier,
  upsertUserFromAuth,
} from '../users/users.repository.js';
import { buildDefaultResource, type ListingResourceKey } from './listings.constants.js';
import type { CreateListingInput } from './listings.schemas.js';

type ListingRecord = Listing & { owner: User | null };
type OwnerIdentitySource = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  hostProfile?: unknown;
  clerkUserId?: string | null;
  externalUserId?: string | null;
};
type ListingCardOwner = Pick<
  User,
  'id' | 'email' | 'firstName' | 'lastName' | 'displayName' | 'avatarUrl' | 'hostProfile' | 'clerkUserId' | 'externalUserId'
>;
type ListingCardRecord = Listing & { owner?: ListingCardOwner | null };

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

export type TransferListingOwnershipResult = {
  listingId: string;
  previousOwnerId: string | null;
  ownerId: string;
  transferredAtISO: string;
  trial: {
    applied: boolean;
    days: number;
    startsAtISO: string | null;
    endsAtISO: string | null;
  };
};

const PUBLICATION_ELIGIBLE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
]);
const ADMIN_LISTING_TRANSFER_TRIAL_SOURCE = 'admin_listing_transfer';
const DAY_MS = 24 * 60 * 60 * 1000;

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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readOwnerUsernameFromHostProfile(hostProfile: unknown): string | null {
  const record = asRecord(hostProfile);
  if (!record) return null;

  const candidates = [
    record.pseudo,
    record.displayName,
    record.display_name,
    record.name,
    record.username,
    record.userName,
    record.user_name,
  ];

  for (const candidate of candidates) {
    const normalized = readString(candidate);
    if (!normalized) continue;
    if (isDeprecatedHostIdentity(normalized)) continue;
    return normalized;
  }

  return null;
}

function isLikelyClerkUserId(value: string): boolean {
  return /^user_[a-zA-Z0-9]+$/.test(value);
}

function readOwnerLookupClerkUserId(owner: Pick<OwnerIdentitySource, 'clerkUserId' | 'externalUserId'> | null | undefined): string | null {
  const clerkUserId = readString(owner?.clerkUserId);
  if (clerkUserId && isLikelyClerkUserId(clerkUserId)) return clerkUserId;

  const externalUserId = readString(owner?.externalUserId);
  if (externalUserId && isLikelyClerkUserId(externalUserId)) return externalUserId;

  return null;
}

function readOwnerUsername(owner: OwnerIdentitySource | null | undefined, clerkUser: ClerkUserProfile | null): string | null {
  const fromHostProfile = readOwnerUsernameFromHostProfile(owner?.hostProfile);
  if (fromHostProfile) return fromHostProfile;

  const clerkUsername = readString(clerkUser?.username);
  if (clerkUsername && !isDeprecatedHostIdentity(clerkUsername)) return clerkUsername;

  return null;
}

function readEmailLocalPart(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const localPart = trimmed.split('@')[0]?.trim() ?? '';
  return localPart || null;
}

function resolveOwnerDisplayName(owner: OwnerIdentitySource | null | undefined, clerkUser: ClerkUserProfile | null): string | null {
  const directDisplayName = readString(owner?.displayName);
  if (directDisplayName && !isDeprecatedHostIdentity(directDisplayName)) return directDisplayName;

  const fullName = [owner?.firstName, owner?.lastName].filter(Boolean).join(' ').trim();
  if (fullName && !isDeprecatedHostIdentity(fullName)) return fullName;

  const ownerUsername = readOwnerUsername(owner, clerkUser);
  if (ownerUsername) return ownerUsername;

  const clerkDisplayName = readString(clerkUser?.displayName);
  if (clerkDisplayName && !isDeprecatedHostIdentity(clerkDisplayName)) return clerkDisplayName;

  const clerkFullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim();
  if (clerkFullName && !isDeprecatedHostIdentity(clerkFullName)) return clerkFullName;

  return readEmailLocalPart(readString(clerkUser?.email) ?? readString(owner?.email));
}

function resolveOwnerEmail(owner: OwnerIdentitySource | null | undefined, clerkUser: ClerkUserProfile | null): string | null {
  return readString(clerkUser?.email) ?? readString(owner?.email);
}

function resolveOwnerAvatarUrl(owner: OwnerIdentitySource | null | undefined, clerkUser: ClerkUserProfile | null): string | null {
  return readString(clerkUser?.avatarUrl) ?? readString(owner?.avatarUrl);
}

function mergeHostResourceWithDynamicIdentity(rawHost: unknown, dynamicHost: Record<string, unknown>): Record<string, unknown> {
  const hostRecord = asObject(rawHost) ?? {};
  const dynamicName = readString(dynamicHost.name) ?? '';
  const dynamicAvatar = readString(dynamicHost.avatar) ?? '';

  const merged: Record<string, unknown> = {
    ...dynamicHost,
    ...hostRecord,
    name: dynamicName,
    avatar: dynamicAvatar,
  };

  if (dynamicName) {
    merged.displayName = dynamicName;
    merged.pseudo = dynamicName;
  } else {
    delete merged.displayName;
    delete merged.pseudo;
  }

  return merged;
}

function readHostResourceIdentityName(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) return null;

  return (
    readString(record.name)
    ?? readString(record.displayName)
    ?? readString(record.display_name)
    ?? readString(record.pseudo)
    ?? null
  );
}

function hasLegacyHostIdentity(value: unknown): boolean {
  const identity = readHostResourceIdentityName(value);
  if (!identity) return false;
  return isDeprecatedHostIdentity(identity);
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

  private buildPublicationReadiness(
    user: User | null | undefined,
    options?: { allowAdmin?: boolean },
  ): ListingPublicationReadiness {
    if (options?.allowAdmin) {
      return {
        canPublish: false,
        hasAuthenticatedUser: true,
        hasActiveSubscription: true,
        hasConnectAccount: true,
        connectOnboardingCompleted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        missingRequirements: ['admin_publish_forbidden'],
      };
    }

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

  private assertCanPublishListing(
    user: User | null | undefined,
    options?: { allowAdmin?: boolean },
  ) {
    const readiness = this.buildPublicationReadiness(user, options);
    if (!readiness.canPublish) {
      throw new ListingPublicationForbiddenError(readiness);
    }
  }

  private hasSelectedSubscriptionPlan(
    user: User | null | undefined,
    options?: { allowAdmin?: boolean },
  ): boolean {
    if (options?.allowAdmin) return true;
    if (!user) return false;
    const profile = asObject(user.stripeConnectProfile);
    const billing = asObject(profile.billing);
    const activePlanCode = readString(billing.planCode);
    const pendingPlanCode = readString(billing.pendingPlanCode);
    return Boolean(activePlanCode || pendingPlanCode);
  }

  private isActorOwner(
    listingOwnerId: string | null,
    actor: User | null,
    options?: { allowAdmin?: boolean },
  ) {
    if (options?.allowAdmin) return true;
    if (!listingOwnerId || !actor) return false;
    return listingOwnerId === actor.id;
  }

  private normalizeTrialDays(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(365, Math.trunc(parsed)));
  }

  private buildTransferredListingTrialBilling(
    user: User,
    listingId: string,
    grantedByUserId: string | null,
    trialDays: number,
  ) {
    const now = new Date();
    const startsAtISO = now.toISOString();
    const endsAtISO = new Date(now.getTime() + (trialDays * DAY_MS)).toISOString();

    const profile = asObject(user.stripeConnectProfile);
    const currentBilling = asObject(profile.billing);
    const currentStatus = readString(currentBilling.status)?.toLowerCase() ?? null;
    const hasOngoingSubscription = currentStatus === 'active' || currentStatus === 'trialing';

    if (hasOngoingSubscription) {
      return {
        applied: false,
        startsAtISO: null,
        endsAtISO: null,
        stripeConnectProfile: profile,
      };
    }

    const nextBilling = {
      ...currentBilling,
      giftedTrialSource: ADMIN_LISTING_TRANSFER_TRIAL_SOURCE,
      giftedTrialListingId: listingId,
      giftedTrialGrantedByUserId: grantedByUserId,
      giftedTrialGrantedAtISO: startsAtISO,
      giftedTrialEndsAtISO: endsAtISO,
      giftedTrialExpiredAtISO: null,
    } as Record<string, unknown>;

    nextBilling.planCode = 'indiehost';
    nextBilling.status = 'trialing';
    nextBilling.currentPeriodEndISO = endsAtISO;
    nextBilling.cancelAtPeriodEnd = true;
    nextBilling.pendingPlanCode = null;
    nextBilling.pendingCheckoutSessionId = null;
    nextBilling.updatedAtISO = startsAtISO;

    return {
      applied: true,
      startsAtISO,
      endsAtISO,
      stripeConnectProfile: {
        ...profile,
        billing: nextBilling,
      },
    };
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
    const allowAdmin = hasAdminAccess(auth);
    if (listing.ownerId && !allowAdmin && (!actor || listing.ownerId !== actor.id)) {
      return 'forbidden' as const;
    }

    return { listing, actor };
  }

  private async buildDynamicOwnerHostProfile(owner: User | null): Promise<Record<string, unknown>> {
    if (!owner) {
      return buildHostProfileFromUser(owner);
    }

    const lookupClerkUserId = readOwnerLookupClerkUserId(owner);
    const clerkOwner = lookupClerkUserId ? await fetchClerkUserById(lookupClerkUserId) : null;
    const resolvedDisplayName = resolveOwnerDisplayName(owner, clerkOwner);
    const resolvedEmail = resolveOwnerEmail(owner, clerkOwner);
    const resolvedAvatarUrl = resolveOwnerAvatarUrl(owner, clerkOwner);
    const resolvedFirstName = readString(clerkOwner?.firstName) ?? readString(owner.firstName);
    const resolvedLastName = readString(clerkOwner?.lastName) ?? readString(owner.lastName);

    const enrichedOwner: User = {
      ...owner,
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      displayName: resolvedDisplayName ?? null,
      email: resolvedEmail ?? null,
      avatarUrl: resolvedAvatarUrl ?? null,
    };

    return buildHostProfileFromUser(enrichedOwner);
  }

  private async toSections(listing: ListingRecord): Promise<ListingSectionBundle> {
    const core = asObject(listing.core, buildDefaultResource('core', listing.id));
    const slug = buildListingSlugFromCore(core, listing.id);
    const dynamicHostProfile = await this.buildDynamicOwnerHostProfile(listing.owner);
    const host = mergeHostResourceWithDynamicIdentity(listing.host, dynamicHostProfile);

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
      host,
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
      this.assertCanPublishListing(owner, {
        allowAdmin: hasAdminAccess(auth),
      });
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
      ? await this.buildDynamicOwnerHostProfile(owner)
      : buildDefaultResource(resource, listingId);
    const rawValue = (listing as Record<string, unknown>)[resource];
    if (resource === 'host') {
      const resolvedHost = mergeHostResourceWithDynamicIdentity(rawValue, fallback);
      if (hasLegacyHostIdentity(rawValue)) {
        await this.prisma.listing.update({
          where: { id: listingId },
          data: {
            host: toPrismaJson(resolvedHost),
          },
        });
      }
      return resolvedHost;
    }

    return asObject(rawValue, fallback);
  }

  async getListingBundle(listingId: string, auth: RequestAuth | null = null) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { owner: true },
    });

    if (!listing) return null;
    const actor = await upsertUserFromAuth(this.prisma, auth);
    const isOwner = this.isActorOwner(listing.ownerId, actor, {
      allowAdmin: hasAdminAccess(auth),
    });

    if (!isOwner && this.getListingStatus(listing) === 'deleted') {
      return null;
    }

    const sections = await this.toSections(listing);
    if (hasLegacyHostIdentity(listing.host)) {
      await this.prisma.listing.update({
        where: { id: listing.id },
        data: {
          host: toPrismaJson(sections.host),
        },
      });
    }

    return sections;
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
    const auth = options?.auth ?? null;
    const allowAdmin = hasAdminAccess(auth);
    const actor = await upsertUserFromAuth(this.prisma, auth);

    if (this.reservedSlugs.has(normalizedSlug)) {
      return {
        slug: normalizedSlug,
        available: false,
        hostname,
        publicUrl,
        reason: 'Ce sous-domaine est réservé.',
      };
    }

    if (!this.hasSelectedSubscriptionPlan(actor, { allowAdmin })) {
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
      if (candidate && (allowAdmin || (actor && (!candidate.ownerId || candidate.ownerId === actor.id)))) {
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
    if (!this.hasSelectedSubscriptionPlan(access.actor, {
      allowAdmin: hasAdminAccess(args.auth),
    })) return 'subscription_required' as const;

    const normalizedSlug = normalizeSlug(args.slug);
    const availability = await this.checkSubdomainAvailability(normalizedSlug, {
      excludeListingId: args.listingId,
      auth: args.auth,
    });
    if (!availability.available) {
      return {
        type: 'conflict' as const,
        reason: availability.reason,
      };
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

    const auth = input.auth ?? null;
    const actor = await upsertUserFromAuth(this.prisma, auth);
    const allowAdmin = hasAdminAccess(auth);
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
      const isOwner = this.isActorOwner(listing.ownerId, actor, { allowAdmin });
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
    const allowAdmin = hasAdminAccess(auth);
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

      const isOwner = this.isActorOwner(listing.ownerId, actor, { allowAdmin });
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
    const allowAdmin = hasAdminAccess(auth);

    if (listing.ownerId && !allowAdmin && (!actor || listing.ownerId !== actor.id)) {
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
      const currentStatus = this.extractStatus(currentValue);
      const nextStatus = this.extractStatus(normalizedMerged);
      if (nextStatus === 'published' && (!allowAdmin || currentStatus !== 'published')) {
        this.assertCanPublishListing(actor, { allowAdmin });
      }
      data.core = toJsonInput(normalizedMerged);
      data.status = nextStatus;
    }
    if (resource === 'bookings') data.bookings = toJsonInput(normalizedMerged);
    if (resource === 'medias') data.medias = toJsonInput(normalizedMerged);
    if (resource === 'arrival') data.arrival = toJsonInput(normalizedMerged);
    if (resource === 'notes') data.notes = toJsonInput(normalizedMerged);
    if (resource === 'comments') data.comments = toJsonInput(normalizedMerged);
    if (resource === 'host') {
      const dynamicHostProfile = await this.buildDynamicOwnerHostProfile(owner);
      normalizedMerged = mergeHostResourceWithDynamicIdentity(normalizedMerged, dynamicHostProfile);
      data.host = toJsonInput(normalizedMerged);
    }

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

  async transferListingOwnership(args: {
    listingId: string;
    targetUserId: string;
    trialDays?: number;
    auth: RequestAuth | null;
  }) {
    if (!hasAdminAccess(args.auth)) return 'forbidden' as const;

    const [actor, listing] = await Promise.all([
      upsertUserFromAuth(this.prisma, args.auth),
      this.prisma.listing.findUnique({
        where: { id: args.listingId },
        select: {
          id: true,
          ownerId: true,
        },
      }),
    ]);

    if (!listing) return null;

    let targetUser = await resolveUserByIdentifier(this.prisma, args.targetUserId);
    if (!targetUser) {
      const clerkUser = await fetchClerkUserById(args.targetUserId);
      if (clerkUser) {
        const authPayload = buildRequestAuthFromClerkUser(clerkUser);
        targetUser = await upsertUserFromAuth(this.prisma, authPayload);
      }
    }

    if (!targetUser) return 'target_not_found' as const;

    const normalizedTrialDays = this.normalizeTrialDays(args.trialDays);
    const transferredAt = new Date();
    const transferredAtISO = transferredAt.toISOString();
    const hostProfile = buildHostProfileFromUser(targetUser);

    let trialApplied = false;
    let trialStartsAtISO: string | null = null;
    let trialEndsAtISO: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id: listing.id },
        data: {
          owner: {
            connect: { id: targetUser.id },
          },
          host: toPrismaJson(hostProfile),
          updatedAt: transferredAt,
        },
      });

      await tx.conversation.updateMany({
        where: {
          listingId: listing.id,
        },
        data: {
          hostUserId: targetUser.id,
        },
      });

      await tx.message.updateMany({
        where: {
          listingId: listing.id,
          authorRole: 'host',
        },
        data: {
          authorUserId: targetUser.id,
        },
      });

      if (normalizedTrialDays > 0) {
        const transferTrial = this.buildTransferredListingTrialBilling(
          targetUser,
          listing.id,
          actor?.id ?? null,
          normalizedTrialDays,
        );

        trialApplied = transferTrial.applied;
        trialStartsAtISO = transferTrial.startsAtISO;
        trialEndsAtISO = transferTrial.endsAtISO;
        if (trialApplied) {
          await tx.user.update({
            where: { id: targetUser.id },
            data: {
              stripeConnectProfile: toPrismaJson(transferTrial.stripeConnectProfile),
            },
          });
        }
      }
    });

    return {
      listingId: listing.id,
      previousOwnerId: listing.ownerId,
      ownerId: targetUser.id,
      transferredAtISO,
      trial: {
        applied: trialApplied,
        days: normalizedTrialDays,
        startsAtISO: trialStartsAtISO,
        endsAtISO: trialEndsAtISO,
      },
    } satisfies TransferListingOwnershipResult;
  }

  async listUserCards(listings: ListingCardRecord[]) {
    const ownerScopedSubdomainCounts = new Map<string, number>();
    for (const listing of listings) {
      if (!listing.ownerId || !listing.subdomainSlug) continue;
      const key = `${listing.ownerId}::${listing.subdomainSlug}`;
      ownerScopedSubdomainCounts.set(key, (ownerScopedSubdomainCounts.get(key) ?? 0) + 1);
    }

    const ownerClerkIds = new Set<string>();
    for (const listing of listings) {
      const ownerLookupId = readOwnerLookupClerkUserId(listing.owner ?? null);
      if (!ownerLookupId) continue;
      ownerClerkIds.add(ownerLookupId);
    }

    const clerkUsersById = new Map<string, ClerkUserProfile | null>();
    await Promise.all(
      [...ownerClerkIds].map(async (ownerClerkId) => {
        const clerkUser = await fetchClerkUserById(ownerClerkId);
        clerkUsersById.set(ownerClerkId, clerkUser);
      }),
    );

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
      const owner = listing.owner ?? null;
      const ownerLookupId = readOwnerLookupClerkUserId(owner);
      const clerkOwner = ownerLookupId ? (clerkUsersById.get(ownerLookupId) ?? null) : null;
      const ownerDisplayName = resolveOwnerDisplayName(owner, clerkOwner);
      const ownerEmail = resolveOwnerEmail(owner, clerkOwner);
      const ownerUsername = readOwnerUsername(owner, clerkOwner);
      const ownerAvatarUrl = resolveOwnerAvatarUrl(owner, clerkOwner);

      return {
        listingId: listing.id,
        slug,
        subdomainSlug: listing.subdomainSlug ?? undefined,
        publicUrl,
        ownerId: listing.ownerId ?? undefined,
        ownerDisplayName: ownerDisplayName || undefined,
        ownerEmail: ownerEmail || undefined,
        ownerUsername: ownerUsername || undefined,
        ownerAvatarUrl: ownerAvatarUrl || undefined,
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
