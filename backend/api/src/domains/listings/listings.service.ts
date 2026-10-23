import { randomBytes } from 'node:crypto';
import { promises as dns } from 'node:dns';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { Listing, Prisma, PrismaClient, User } from '@prisma/client';

import { env } from '../../config/env.js';
import { deepMerge, asObject, isObject, toNumber } from '../../lib/json.js';
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
import { LISTING_LIMIT_COUNTED_STATUSES, resolveMaxActiveListingsFromBilling } from '../payments/plans.catalog.js';
import { buildDefaultResource, type ListingResourceKey } from './listings.constants.js';
import {
  isRedactedPatch,
  redactListingSectionForPublic,
  resolveListingAccessForOwner,
} from './listings.access.js';
import type { CreateGuideReviewInput, CreateListingInput } from './listings.schemas.js';
import { parseGuideAccessKey, toIsoDay, verifyGuideAccessKey } from '../../lib/guideKey.js';
import { resolvePublicBaseUrl } from '../../lib/mailer.js';
import { hostNotifications } from '../notifications/hostNotifications.js';
import { sanitizeListingSection, sanitizePlainText } from '../../lib/sanitizeHtml.js';

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

export type ListingCustomDomainStatus = 'none' | 'pending' | 'verified';

export type ListingCustomDomainTargets = {
  ipv4: string | null;
  cname: string | null;
};

/**
 * Enregistrement TXT qui prouve la propriété du domaine. `names` : noms acceptés, le premier est celui
 * du domaine rattaché, le second (pour `www.x.fr`) celui de l'apex `x.fr`, valable pour les deux adresses.
 */
export type ListingCustomDomainTxtRecord = {
  names: string[];
  value: string;
};

export type ListingDomainRecord = {
  listingId: string;
  subdomainSlug: string | null;
  hostname: string | null;
  publicUrl: string | null;
  customDomain: string | null;
  customDomainStatus: ListingCustomDomainStatus;
  customDomainUrl: string | null;
  customDomainVerifiedAt: string | null;
  customDomainTargets: ListingCustomDomainTargets;
  customDomainVerificationToken: string | null;
  customDomainVerificationRecord: ListingCustomDomainTxtRecord | null;
};

export type ListingCustomDomainCheck = {
  ok: boolean;
  reason: string | null;
};

export type ListingCustomDomainVerification = {
  ok: boolean;
  resolvedAddresses: string[];
  reason: string | null;
  checks: {
    // Résolution A / CNAME vers le VPS : indispensable au certificat et au routage.
    address: ListingCustomDomainCheck;
    // TXT `_indiehost-verification.<domaine>` : preuve de propriété de la zone DNS.
    ownership: ListingCustomDomainCheck;
  };
};

const DOMAIN_RECORD_SELECT = {
  id: true,
  ownerId: true,
  subdomainSlug: true,
  customDomain: true,
  customDomainVerifiedAt: true,
  customDomainVerificationToken: true,
  kind: true,
  parentListingId: true,
  core: true,
} satisfies Prisma.ListingSelect;

export type ListingKind = 'listing' | 'hub';

export type ListingHubSummary = {
  listingId: string;
  title: string;
  status: string;
  hostname: string | null;
  publicUrl: string | null;
};

export type ListingHubChildCard = {
  listingId: string;
  slug: string;
  title: string;
  status: string;
  city: string | null;
  region: string | null;
  coverSrc: string | null;
  pricePerNight: number | null;
  guestCapacity: number | null;
  roomsCount: number | null;
  publicPath: string;
};

function normalizeListingKind(value: unknown): ListingKind {
  return typeof value === 'string' && value.trim().toLowerCase() === 'hub' ? 'hub' : 'listing';
}

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
  // Limite de logements en gestion du plan (null = illimité, ex. super admin).
  maxActiveListings: number | null;
  activeListings: number | null;
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
const LISTING_LIMIT_REQUIREMENT = 'listing_limit_reached';
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

const CUSTOM_DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function normalizeCustomDomain(value: string): string {
  return sanitizeHostname(value).replace(/\.$/, '');
}

function isIpAddress(value: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) || value.includes(':');
}

function isValidCustomDomain(hostname: string): boolean {
  if (!hostname || hostname.length > 253 || isIpAddress(hostname)) return false;
  const labels = hostname.split('.');
  if (labels.length < 2) return false;
  if (!labels.every((label) => CUSTOM_DOMAIN_LABEL_PATTERN.test(label))) return false;
  const tld = labels[labels.length - 1] ?? '';
  return tld.length >= 2 && !/^\d+$/.test(tld);
}

// `www.gite.fr` et `gite.fr` désignent le même site : on refuse qu'ils soient rattachés à deux annonces.
function buildCustomDomainTwin(hostname: string): string {
  return hostname.startsWith('www.') ? hostname.slice(4) : `www.${hostname}`;
}

const CUSTOM_DOMAIN_TXT_LABEL = '_indiehost-verification';
const CUSTOM_DOMAIN_TXT_VALUE_PREFIX = 'indiehost-verification=';
const CUSTOM_DOMAIN_TXT_NOT_FOUND_REASON = 'Enregistrement TXT introuvable ou différent';

// 24 octets → 32 caractères base64url : imprévisible, sans caractère gênant dans une zone DNS.
function generateCustomDomainVerificationToken(): string {
  return randomBytes(24).toString('base64url');
}

// Noms TXT acceptés : celui du domaine rattaché, et pour `www.x.fr` aussi l'apex `x.fr`
// (un seul enregistrement couvre alors les deux adresses, qu'on refuse déjà de séparer).
function buildCustomDomainTxtNames(domain: string): string[] {
  const names = [`${CUSTOM_DOMAIN_TXT_LABEL}.${domain}`];
  if (domain.startsWith('www.')) names.push(`${CUSTOM_DOMAIN_TXT_LABEL}.${domain.slice(4)}`);
  return names;
}

function buildCustomDomainTxtRecord(domain: string, token: string | null): ListingCustomDomainTxtRecord | null {
  if (!token) return null;
  return {
    names: buildCustomDomainTxtNames(domain),
    value: `${CUSTOM_DOMAIN_TXT_VALUE_PREFIX}${token}`,
  };
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

// Nom public de l'hôte : prénom (et nom) ou pseudo, jamais la partie locale de l'e-mail.
// Sans nom, `null` : le front affiche « votre hôte ».
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

  return null;
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

  constructor(public readonly details: ListingPublicationReadiness, message?: string) {
    super(message ?? 'Publishing requires an active subscription and a fully configured Stripe Connect account.');
  }
}

// ---- Avis voyageur depuis le guide d'arrivée ----

// Même pagination que l'éditeur et la page publique : `comments.comments` est un tableau de pages de 10 avis.
const GUIDE_REVIEW_PAGE_SIZE = 10;

export type GuideReview = {
  id: string;
  reservationId: string;
  createdAt: string;
  rating: number;
  text: string;
  author: string;
  stayDates: { start: string; end: string };
};

type GuideReviewAccess = {
  reservationId: string;
  listingId: string;
  guestName: string;
  startDate: Date;
  endDate: Date;
  comments: Record<string, unknown>;
};

// Texte brut : balises HTML retirées, entités décodées, caractères de contrôle supprimés, espaces et
// sauts de ligne normalisés (la page publique passe de toute façon par sanitizeHtml côté front).
function sanitizeReviewText(value: string): string {
  return sanitizePlainText(value, { multiline: true });
}

function readCommentPages(comments: Record<string, unknown>): Record<string, unknown>[][] {
  const pages = Array.isArray(comments.comments) ? comments.comments : [];
  return pages.map((page) => (Array.isArray(page) ? page.filter(isObject) : []));
}

function findGuideReviewEntry(comments: Record<string, unknown>, reservationId: string): Record<string, unknown> | null {
  for (const page of readCommentPages(comments)) {
    for (const entry of page) {
      if (readString(entry.reservationId) === reservationId) return entry;
    }
  }
  return null;
}

function prependCommentEntry(comments: Record<string, unknown>, entry: Record<string, unknown>): Record<string, unknown>[][] {
  const pages = readCommentPages(comments);
  if (!pages.length) pages.push([]);
  pages[0]!.unshift(entry);

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]!;
    if (page.length <= GUIDE_REVIEW_PAGE_SIZE) continue;
    const overflow = page.splice(GUIDE_REVIEW_PAGE_SIZE);
    if (!pages[index + 1]) pages[index + 1] = [];
    pages[index + 1]!.unshift(...overflow);
  }

  return pages;
}

function toGuideReview(entry: Record<string, unknown>): GuideReview {
  const stayDates = asObject(entry['stay-dates']);
  return {
    id: readString(entry.id) ?? '',
    reservationId: readString(entry.reservationId) ?? '',
    createdAt: readString(entry.createdAt) ?? '',
    rating: Math.min(5, Math.max(1, Math.round(toNumber(entry.rating ?? entry.note, 5)))),
    text: readString(entry.text) ?? readString(entry.comment) ?? '',
    author: readString(entry.author) ?? readString(entry.name) ?? '',
    stayDates: {
      start: readString(stayDates.start) ?? '',
      end: readString(stayDates.end) ?? '',
    },
  };
}

// L'avis s'ouvre après la première nuit (jour UTC d'arrivée + 1), comme l'indique le guide.
function resolveGuideReviewAvailableFrom(startDate: Date): Date {
  return new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()) + DAY_MS);
}

export class ListingsService {
  private readonly rootDomain = normalizeRootDomain(env.PUBLIC_LISTING_ROOT_DOMAIN);
  private readonly customDomainTargets: ListingCustomDomainTargets = {
    ipv4: env.CUSTOM_DOMAIN_TARGET_IPV4 || null,
    cname: normalizeRootDomain(env.CUSTOM_DOMAIN_CNAME_TARGET) || null,
  };
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
    // Sous-domaines déjà pris dans le DNS (envoi des e-mails, Clerk, cible des domaines personnalisés).
    'mail',
    'clerk',
    'accounts',
    'clkmail',
    'custom',
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
    // Le super admin configure et publie à la place d'un client : aucune condition de facturation ni de limite.
    if (options?.allowAdmin) {
      return {
        canPublish: true,
        hasAuthenticatedUser: true,
        hasActiveSubscription: true,
        hasConnectAccount: true,
        connectOnboardingCompleted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        missingRequirements: [],
        maxActiveListings: null,
        activeListings: null,
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
      maxActiveListings: hasActiveSubscription ? resolveMaxActiveListingsFromBilling(billing) : 0,
      activeListings: null,
    };
  }

  /**
   * Vérifie les prérequis de facturation puis la limite de logements du plan
   * (annonces en ligne : publiées, en pause ou gelées ; `listingId` exclut l'annonce en cours).
   */
  private async assertCanPublishListing(
    user: User | null | undefined,
    options?: { allowAdmin?: boolean; listingId?: string | null },
  ): Promise<void> {
    const readiness = this.buildPublicationReadiness(user, options);
    if (!readiness.canPublish) {
      throw new ListingPublicationForbiddenError(readiness);
    }

    if (options?.allowAdmin || !user || readiness.maxActiveListings === null) return;

    const activeListings = await this.prisma.listing.count({
      where: {
        ownerId: user.id,
        kind: 'listing',
        status: { in: [...LISTING_LIMIT_COUNTED_STATUSES] },
        ...(options?.listingId ? { id: { not: options.listingId } } : {}),
      },
    });

    if (activeListings >= readiness.maxActiveListings) {
      throw new ListingPublicationForbiddenError(
        {
          ...readiness,
          canPublish: false,
          missingRequirements: [LISTING_LIMIT_REQUIREMENT],
          activeListings,
        },
        `Votre plan permet ${readiness.maxActiveListings} logement${readiness.maxActiveListings > 1 ? 's' : ''} en ligne et vous en avez déjà ${activeListings}. Ajoutez un logement supplémentaire ou mettez une annonce en brouillon.`,
      );
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

  private buildCustomDomainFields(listing: {
    customDomain: string | null;
    customDomainVerifiedAt: Date | null;
    customDomainVerificationToken: string | null;
  }) {
    const customDomain = readString(listing.customDomain)?.toLowerCase() ?? null;
    const verifiedAt = customDomain ? listing.customDomainVerifiedAt : null;
    const customDomainStatus: ListingCustomDomainStatus = !customDomain ? 'none' : verifiedAt ? 'verified' : 'pending';
    const token = customDomain ? readString(listing.customDomainVerificationToken) : null;

    return {
      customDomain,
      customDomainStatus,
      customDomainUrl: customDomain ? `https://${customDomain}` : null,
      customDomainVerifiedAt: verifiedAt ? verifiedAt.toISOString() : null,
      customDomainTargets: this.customDomainTargets,
      customDomainVerificationToken: token,
      customDomainVerificationRecord: customDomain ? buildCustomDomainTxtRecord(customDomain, token) : null,
    };
  }

  private async toDomainRecord(listing: {
    id: string;
    ownerId: string | null;
    subdomainSlug: string | null;
    customDomain: string | null;
    customDomainVerifiedAt: Date | null;
    customDomainVerificationToken: string | null;
    core: unknown;
  }): Promise<ListingDomainRecord> {
    const normalizedSubdomain = typeof listing.subdomainSlug === 'string' && listing.subdomainSlug.trim()
      ? normalizeSlug(listing.subdomainSlug)
      : null;
    const customDomainFields = this.buildCustomDomainFields(listing);

    if (!normalizedSubdomain) {
      return {
        listingId: listing.id,
        subdomainSlug: null,
        hostname: null,
        publicUrl: null,
        ...customDomainFields,
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
      ...customDomainFields,
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
      select: DOMAIN_RECORD_SELECT,
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

  /**
   * Propriétaire d'une annonce en création : l'utilisateur authentifié, sauf si un admin
   * crée l'annonce au nom d'un client (`ownerId`), auquel cas elle lui appartient directement.
   */
  private async resolveListingOwnerForCreation(
    actor: User | null,
    requestedOwnerId: string | undefined,
    auth: RequestAuth | null,
  ): Promise<User | null> {
    const ownerId = requestedOwnerId?.trim();
    if (!ownerId || !hasAdminAccess(auth) || ownerId === actor?.id || ownerId === actor?.clerkUserId) return actor;

    const existing = await resolveUserByIdentifier(this.prisma, ownerId);
    if (existing) return existing;

    // Client Clerk jamais connecté au dashboard : on crée sa fiche à partir de son profil.
    const clerkUser = await fetchClerkUserById(ownerId);
    if (!clerkUser) return actor;
    return (await upsertUserFromAuth(this.prisma, buildRequestAuthFromClerkUser(clerkUser))) ?? actor;
  }

  async createListing(payload: CreateListingInput, auth: RequestAuth | null) {
    const actor = await upsertUserFromAuth(this.prisma, auth);
    const owner = await this.resolveListingOwnerForCreation(actor, payload.ownerId, auth);
    const requestedId = typeof payload.core?.id === 'string' ? payload.core.id : '';

    const baseId = buildListingId(requestedId);
    let listingId = baseId;
    let index = 1;

    while (await this.prisma.listing.findUnique({ where: { id: listingId }, select: { id: true } })) {
      listingId = `${baseId}-${index}`;
      index += 1;
    }

    const defaults = this.buildFallbackBundle(listingId);
    // Textes fournis par le client nettoyés à l'écriture (HTML Quill borné, texte brut ailleurs) ;
    // `bookings` et `medias` n'ont pas de texte libre affiché.
    const core = sanitizeListingSection('core', payload.core ? deepMerge(defaults.core, payload.core) : defaults.core);
    const bookings = payload.bookings ? deepMerge(defaults.bookings, payload.bookings) : defaults.bookings;
    const medias = payload.medias ? deepMerge(defaults.medias, payload.medias) : defaults.medias;
    const arrival = sanitizeListingSection('arrival', payload.arrival ? deepMerge(defaults.arrival, payload.arrival) : defaults.arrival);
    const notes = sanitizeListingSection('notes', payload.notes ? deepMerge(defaults.notes, payload.notes) : defaults.notes);
    const comments = sanitizeListingSection('comments', payload.comments ? deepMerge(defaults.comments, payload.comments) : defaults.comments);
    const host = sanitizeListingSection('host', payload.host ? deepMerge(buildHostProfileFromUser(owner), payload.host) : buildHostProfileFromUser(owner));
    core.id = listingId;
    const requestedSlug = buildListingSlugFromCore(core, listingId);
    core.slug = await this.buildUniqueListingSlug(requestedSlug);
    const listingStatus = this.extractStatus(core);

    if (listingStatus === 'published') {
      await this.assertCanPublishListing(owner, {
        allowAdmin: hasAdminAccess(auth),
        listingId,
      });
    }

    await this.prisma.listing.create({
      data: {
        id: listingId,
        ownerId: owner?.id ?? null,
        status: listingStatus,
        kind: normalizeListingKind(core.kind),
        core: toJsonInput(core),
        bookings: toJsonInput(bookings),
        medias: toJsonInput(medias),
        arrival: toJsonInput(arrival),
        notes: toJsonInput(notes),
        comments: toJsonInput(comments),
        host: toJsonInput(host),
      },
    });

    if (listingStatus === 'published') void this.notifyListingPublication(listingId);

    return { listingId };
  }

  async getListingResource(resource: ListingResourceKey, listingId: string, auth: RequestAuth | null = null) {
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

    const value = asObject(rawValue, fallback);
    if (resource !== 'bookings' && resource !== 'arrival') return value;

    const ownerId = (listing as { ownerId?: string | null }).ownerId ?? null;
    const access = await resolveListingAccessForOwner(this.prisma, ownerId, auth);
    return access.canReadPrivate ? value : redactListingSectionForPublic(resource, value);
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

    if (isOwner) return sections;
    return {
      ...sections,
      bookings: redactListingSectionForPublic('bookings', sections.bookings),
      arrival: redactListingSectionForPublic('arrival', sections.arrival),
    };
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
      select: DOMAIN_RECORD_SELECT,
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
      select: DOMAIN_RECORD_SELECT,
    });

    return this.toDomainRecord(updated);
  }

  // --- Pages principales (annonces mères) -----------------------------------

  private toHubSummary(hub: {
    id: string;
    status: string;
    core: Prisma.JsonValue;
    subdomainSlug: string | null;
    customDomain: string | null;
  }): ListingHubSummary {
    const core = asObject(hub.core, buildDefaultResource('core', hub.id));
    const hostname = readString(hub.customDomain)
      ?? (hub.subdomainSlug ? this.buildListingHostname(hub.subdomainSlug) : null);
    return {
      listingId: hub.id,
      title: readString(core.title) ?? 'Page principale',
      status: this.getListingStatus(hub),
      hostname,
      publicUrl: hostname ? `https://${hostname}` : null,
    };
  }

  private toHubChildCard(child: {
    id: string;
    status: string;
    core: Prisma.JsonValue;
    bookings: Prisma.JsonValue;
    medias: Prisma.JsonValue;
  }): ListingHubChildCard {
    const core = asObject(child.core, buildDefaultResource('core', child.id));
    const bookings = asObject(child.bookings, buildDefaultResource('bookings', child.id));
    const medias = asObject(child.medias, buildDefaultResource('medias', child.id));
    const images = Array.isArray(medias.images) ? medias.images : [];
    const firstImage = asObject(images[0]);
    const slug = buildListingSlugFromCore(core, child.id);
    const rooms = Array.isArray(core.rooms) ? core.rooms.length : null;

    return {
      listingId: child.id,
      slug,
      title: readString(core.title) ?? 'Logement',
      status: this.getListingStatus(child),
      city: readString(core.city),
      region: readString(core.region),
      coverSrc: readString(firstImage.src),
      pricePerNight: toNumber(bookings.price, 0) || null,
      guestCapacity: toNumber(core.guest_capacity, 0) || null,
      roomsCount: rooms,
      publicPath: `/${slug}`,
    };
  }

  /** Enfant d'une page principale désigné par son slug (URL `https://<hôte de la page>/<slug>`). */
  private async findHubChildBySlug(hubId: string, slug: string): Promise<{ id: string } | null> {
    const normalizedSlug = normalizePublicListingSlug(slug);
    if (!normalizedSlug) return null;

    const children = await this.prisma.listing.findMany({
      where: { parentListingId: hubId, status: { not: 'deleted' } },
      select: { id: true, core: true },
    });

    const matched = children.find((child) => {
      const core = asObject(child.core, buildDefaultResource('core', child.id));
      return buildListingSlugFromCore(core, child.id) === normalizedSlug;
    });
    return matched ? { id: matched.id } : null;
  }

  async listHubsForOwner(args: { auth: RequestAuth | null; ownerId?: string | null }): Promise<ListingHubSummary[]> {
    const actor = await upsertUserFromAuth(this.prisma, args.auth);
    const allowAdmin = hasAdminAccess(args.auth);

    let ownerId = actor?.id ?? null;
    const requestedOwnerId = args.ownerId?.trim();
    if (requestedOwnerId && allowAdmin) {
      const target = await resolveUserByIdentifier(this.prisma, requestedOwnerId);
      ownerId = target?.id ?? null;
    }
    if (!ownerId) return [];

    const hubs = await this.prisma.listing.findMany({
      where: { ownerId, kind: 'hub', status: { not: 'deleted' } },
      select: { id: true, status: true, core: true, subdomainSlug: true, customDomain: true },
      orderBy: { updatedAt: 'desc' },
    });

    return hubs.map((hub) => this.toHubSummary(hub));
  }

  async getListingParent(listingId: string, auth: RequestAuth | null) {
    const access = await this.findOwnedListing(listingId, auth);
    if (!access) return null;
    if (access === 'forbidden') return 'forbidden' as const;

    const parentId = access.listing.parentListingId;
    if (!parentId) return { listingId, parentListingId: null, parent: null };

    const parent = await this.prisma.listing.findUnique({
      where: { id: parentId },
      select: { id: true, status: true, core: true, subdomainSlug: true, customDomain: true },
    });

    return {
      listingId,
      parentListingId: parent ? parent.id : null,
      parent: parent ? this.toHubSummary(parent) : null,
    };
  }

  /** Rattache (ou détache) une annonce à une page principale du même propriétaire. */
  async setListingParent(args: {
    listingId: string;
    parentListingId: string | null;
    auth: RequestAuth | null;
  }) {
    const access = await this.findOwnedListing(args.listingId, args.auth);
    if (!access) return null;
    if (access === 'forbidden') return 'forbidden' as const;

    if (access.listing.kind === 'hub') {
      return { type: 'invalid' as const, reason: 'Une page principale ne peut pas être rattachée à une autre page.' };
    }

    let parent: { id: string; ownerId: string | null; status: string; core: Prisma.JsonValue; subdomainSlug: string | null; customDomain: string | null } | null = null;
    if (args.parentListingId) {
      const candidate = await this.prisma.listing.findUnique({
        where: { id: args.parentListingId },
        select: { id: true, ownerId: true, kind: true, status: true, core: true, subdomainSlug: true, customDomain: true },
      });
      if (!candidate || candidate.kind !== 'hub' || this.getListingStatus(candidate) === 'deleted') {
        return { type: 'invalid' as const, reason: 'Page principale introuvable.' };
      }
      if (candidate.ownerId !== access.listing.ownerId) {
        return { type: 'invalid' as const, reason: 'La page principale doit appartenir au même propriétaire que l’annonce.' };
      }
      parent = candidate;
    }

    const updated = await this.prisma.listing.update({
      where: { id: args.listingId },
      data: { parentListingId: parent?.id ?? null },
      select: { id: true, parentListingId: true },
    });

    return {
      listingId: updated.id,
      parentListingId: updated.parentListingId,
      parent: parent ? this.toHubSummary(parent) : null,
    };
  }

  /**
   * Logements rattachés à une page principale.
   * `publicOnly` : uniquement les annonces en ligne (page publique) ; sinon toutes sauf supprimées (éditeur).
   */
  async listHubChildren(args: { hubId: string; auth: RequestAuth | null; publicOnly: boolean }) {
    const hub = await this.prisma.listing.findUnique({
      where: { id: args.hubId },
      select: { id: true, ownerId: true, kind: true, status: true, core: true },
    });
    if (!hub || hub.kind !== 'hub') return null;
    if (this.getListingStatus(hub) === 'deleted') return null;

    if (!args.publicOnly) {
      const actor = await upsertUserFromAuth(this.prisma, args.auth);
      if (!this.isActorOwner(hub.ownerId, actor, { allowAdmin: hasAdminAccess(args.auth) })) return 'forbidden' as const;
    }

    const children = await this.prisma.listing.findMany({
      where: {
        parentListingId: hub.id,
        status: args.publicOnly ? { in: ['published', 'blocked'] } : { not: 'deleted' },
      },
      select: { id: true, status: true, core: true, bookings: true, medias: true },
      orderBy: { updatedAt: 'desc' },
    });

    return children
      .map((child) => this.toHubChildCard(child))
      .sort((left, right) => left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' }));
  }

  async upsertListingCustomDomain(args: {
    listingId: string;
    domain: string;
    auth: RequestAuth | null;
  }) {
    const access = await this.findOwnedListing(args.listingId, args.auth);
    if (!access) return null;
    if (access === 'forbidden') return 'forbidden' as const;
    if (!this.hasSelectedSubscriptionPlan(access.actor, {
      allowAdmin: hasAdminAccess(args.auth),
    })) return 'subscription_required' as const;

    const domain = normalizeCustomDomain(args.domain);
    if (!isValidCustomDomain(domain)) {
      return {
        type: 'invalid' as const,
        reason: 'Saisissez un nom de domaine valide, par exemple www.gite-belair.fr.',
      };
    }
    if (this.rootDomain && (domain === this.rootDomain || domain.endsWith(`.${this.rootDomain}`))) {
      return {
        type: 'invalid' as const,
        reason: `Les adresses *.${this.rootDomain} se configurent via le sous-domaine IndieHost.`,
      };
    }

    const conflictReason = 'Ce nom de domaine est déjà rattaché à une autre annonce.';
    const conflict = await this.prisma.listing.findFirst({
      where: {
        id: { not: args.listingId },
        customDomain: { in: [domain, buildCustomDomainTwin(domain)] },
      },
      select: { id: true },
    });
    if (conflict) {
      return { type: 'conflict' as const, reason: conflictReason };
    }

    const unchanged = access.listing.customDomain === domain;
    // Nouveau domaine (ou domaine repris après un détachement) : nouveau jeton et vérification à refaire.
    // Un domaine déjà vérifié qui est simplement réenregistré garde son état ; un domaine en attente sans jeton
    // (rattaché avant l'introduction du TXT) en reçoit un.
    const verificationToken = unchanged && access.listing.customDomainVerificationToken
      ? access.listing.customDomainVerificationToken
      : generateCustomDomainVerificationToken();
    let updated;
    try {
      updated = await this.prisma.listing.update({
        where: { id: args.listingId },
        data: {
          customDomain: domain,
          customDomainVerificationToken: verificationToken,
          ...(unchanged ? {} : { customDomainVerifiedAt: null }),
          ...(access.listing.ownerId || !access.actor
            ? {}
            : {
                owner: {
                  connect: { id: access.actor.id },
                },
              }),
        },
        select: DOMAIN_RECORD_SELECT,
      });
    } catch (error) {
      // Course entre deux rattachements du même domaine : l'index unique tranche.
      if ((error as { code?: unknown })?.code === 'P2002') {
        return { type: 'conflict' as const, reason: conflictReason };
      }
      throw error;
    }

    // Déjà vérifié et inchangé : rien à refaire.
    if (updated.customDomainVerifiedAt) return this.toDomainRecord(updated);

    // Vérification immédiate (best effort) : si les deux enregistrements sont déjà en place
    // (par exemple après un détachement/rattachement rapide), le domaine est actif tout de suite.
    const verification = await this.verifyCustomDomainDns(domain, verificationToken);
    if (verification.ok) {
      return this.markCustomDomainVerified(args.listingId);
    }

    return this.toDomainRecord(updated);
  }

  async verifyListingCustomDomain(args: {
    listingId: string;
    auth: RequestAuth | null;
  }) {
    const access = await this.findOwnedListing(args.listingId, args.auth);
    if (!access) return null;
    if (access === 'forbidden') return 'forbidden' as const;

    const domain = readString(access.listing.customDomain);
    if (!domain) return 'no_custom_domain' as const;

    // Un domaine vérifié le reste : on ne redemande jamais la preuve de propriété à un hôte déjà en ligne.
    if (access.listing.customDomainVerifiedAt) {
      const record = await this.toDomainRecord(access.listing);
      const ok: ListingCustomDomainCheck = { ok: true, reason: null };
      return {
        record,
        verification: { ok: true, resolvedAddresses: [], reason: null, checks: { address: ok, ownership: ok } },
      };
    }

    // Domaine en attente rattaché avant l'introduction du TXT : on lui donne son jeton, l'hôte publie le TXT.
    let token = readString(access.listing.customDomainVerificationToken);
    if (!token) {
      token = generateCustomDomainVerificationToken();
      await this.prisma.listing.update({
        where: { id: args.listingId },
        data: { customDomainVerificationToken: token },
        select: { id: true },
      });
      access.listing.customDomainVerificationToken = token;
    }

    const verification = await this.verifyCustomDomainDns(domain, token);
    const record = verification.ok
      ? await this.markCustomDomainVerified(args.listingId)
      : await this.toDomainRecord(access.listing);

    return { record, verification };
  }

  async deleteListingCustomDomain(args: {
    listingId: string;
    auth: RequestAuth | null;
  }) {
    const access = await this.findOwnedListing(args.listingId, args.auth);
    if (!access) return null;
    if (access === 'forbidden') return 'forbidden' as const;

    const updated = await this.prisma.listing.update({
      where: { id: args.listingId },
      data: {
        customDomain: null,
        customDomainVerifiedAt: null,
        customDomainVerificationToken: null,
      },
      select: DOMAIN_RECORD_SELECT,
    });

    void this.syncCustomDomainsFile();
    return this.toDomainRecord(updated);
  }

  private async markCustomDomainVerified(listingId: string): Promise<ListingDomainRecord> {
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { customDomainVerifiedAt: new Date() },
      select: DOMAIN_RECORD_SELECT,
    });

    void this.syncCustomDomainsFile();
    return this.toDomainRecord(updated);
  }

  /**
   * Un domaine n'est actif qu'une fois les deux contrôles passés : la résolution A / CNAME vers le VPS
   * (sinon ni certificat ni routage) et le TXT de propriété (sinon le premier compte qui déclare un domaine
   * déjà pointé vers le VPS se l'approprie). Les deux sont faits à chaque fois pour afficher l'état de chacun.
   */
  private async verifyCustomDomainDns(domain: string, token: string): Promise<ListingCustomDomainVerification> {
    const [address, ownership] = await Promise.all([
      this.checkCustomDomainAddress(domain),
      this.checkCustomDomainOwnership(domain, token),
    ]);

    const reasons = [address.check.reason, ownership.reason].filter((reason): reason is string => Boolean(reason));
    return {
      ok: address.check.ok && ownership.ok,
      resolvedAddresses: address.resolvedAddresses,
      reason: reasons.length ? reasons.join(' ') : null,
      checks: { address: address.check, ownership },
    };
  }

  private async checkCustomDomainAddress(domain: string): Promise<{ check: ListingCustomDomainCheck; resolvedAddresses: string[] }> {
    const targetIpv4 = this.customDomainTargets.ipv4;
    if (!targetIpv4) {
      return {
        check: { ok: false, reason: 'La vérification DNS n’est pas configurée sur ce serveur (CUSTOM_DOMAIN_TARGET_IPV4).' },
        resolvedAddresses: [],
      };
    }

    // resolve4 suit les CNAME : un CNAME vers la cible IndieHost aboutit aussi à l'IP attendue.
    let resolvedAddresses: string[];
    try {
      resolvedAddresses = await dns.resolve4(domain);
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      const reason = code === 'ENOTFOUND' || code === 'ENODATA'
        ? `Aucun enregistrement A ou CNAME trouvé pour ${domain}. Créez l’enregistrement puis réessayez (la propagation peut prendre jusqu’à 24 h).`
        : `Impossible de résoudre ${domain} pour le moment (${typeof code === 'string' ? code : 'erreur DNS'}).`;
      return { check: { ok: false, reason }, resolvedAddresses: [] };
    }

    if (resolvedAddresses.includes(targetIpv4)) {
      return { check: { ok: true, reason: null }, resolvedAddresses };
    }

    return {
      check: { ok: false, reason: `${domain} pointe vers ${resolvedAddresses.join(', ')} au lieu de ${targetIpv4}.` },
      resolvedAddresses,
    };
  }

  // TXT `_indiehost-verification.<domaine>` (ou l'apex pour `www.`) dont une valeur vaut exactement
  // `indiehost-verification=<jeton>` (segments recollés, espaces de bord retirés, casse respectée).
  private async checkCustomDomainOwnership(domain: string, token: string): Promise<ListingCustomDomainCheck> {
    const expected = `${CUSTOM_DOMAIN_TXT_VALUE_PREFIX}${token}`;
    const names = buildCustomDomainTxtNames(domain);
    let transientCode: string | null = null;

    for (const name of names) {
      let records: string[][];
      try {
        records = await dns.resolveTxt(name);
      } catch (error) {
        const code = (error as { code?: unknown })?.code;
        if (code !== 'ENOTFOUND' && code !== 'ENODATA') {
          transientCode = typeof code === 'string' ? code : 'erreur DNS';
        }
        continue;
      }

      const values = records.map((chunks) => chunks.join('').trim());
      if (values.includes(expected)) return { ok: true, reason: null };
    }

    const namesLabel = names.join(' ou ');
    if (transientCode) {
      return {
        ok: false,
        reason: `Impossible de lire l’enregistrement TXT ${namesLabel} pour le moment (${transientCode}). Réessayez dans quelques minutes.`,
      };
    }

    return {
      ok: false,
      reason: `${CUSTOM_DOMAIN_TXT_NOT_FOUND_REASON} : créez un TXT ${namesLabel} avec la valeur ${expected}, puis réessayez (la propagation peut prendre jusqu’à 24 h).`,
    };
  }

  /**
   * Liste des domaines vérifiés, lue par le conteneur certbot pour émettre les certificats HTTPS.
   * Écriture atomique (tmp + rename) pour que certbot ne lise jamais un fichier partiel.
   */
  async syncCustomDomainsFile(): Promise<void> {
    const filePath = env.CUSTOM_DOMAINS_FILE;
    if (!filePath) return;

    try {
      const listings = await this.prisma.listing.findMany({
        where: {
          customDomain: { not: null },
          customDomainVerifiedAt: { not: null },
        },
        select: { customDomain: true },
        orderBy: { customDomain: 'asc' },
      });

      const domains = listings
        .map((listing) => readString(listing.customDomain)?.toLowerCase() ?? '')
        .filter((domain) => isValidCustomDomain(domain));
      const content = domains.length ? `${domains.join('\n')}\n` : '';

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const tmpPath = `${filePath}.tmp`;
      await fs.writeFile(tmpPath, content, 'utf-8');
      await fs.rename(tmpPath, filePath);
    } catch (error) {
      console.error('[ListingsService] failed to sync custom domains file', error);
    }
  }

  private async resolveListingByCustomDomain(hostname: string, listingSlug?: string | null): Promise<ListingHostnameResolution | null> {
    const domain = normalizeCustomDomain(hostname);
    if (!isValidCustomDomain(domain)) return null;

    // Seul un domaine dont la vérification DNS a abouti sert une annonce : un domaine simplement
    // déclaré ne doit pas détourner le trafic.
    const listings = await this.prisma.listing.findMany({
      where: {
        customDomain: { in: [domain, buildCustomDomainTwin(domain)] },
        customDomainVerifiedAt: { not: null },
      },
      select: {
        id: true,
        status: true,
        kind: true,
        core: true,
        subdomainSlug: true,
        customDomain: true,
      },
      orderBy: { customDomainVerifiedAt: 'desc' },
    });

    const matched = listings.find((listing) => this.getListingStatus(listing) !== 'deleted');
    if (!matched) return null;

    const resolution = {
      subdomainSlug: matched.subdomainSlug ? normalizeSlug(matched.subdomainSlug) : '',
      hostname: domain,
      publicUrl: `https://${matched.customDomain ?? domain}`,
    };

    // `https://www.gite.fr/<slug>` : un logement rattaché à la page principale du domaine.
    const normalizedListingSlug = normalizePublicListingSlug(listingSlug ?? '');
    if (normalizedListingSlug) {
      if (matched.kind !== 'hub') return null;
      const child = await this.findHubChildBySlug(matched.id, normalizedListingSlug);
      if (!child) return null;
      return { listingId: child.id, ...resolution, publicUrl: `${resolution.publicUrl}/${normalizedListingSlug}` };
    }

    return { listingId: matched.id, ...resolution };
  }

  async resolveListingByHostname(input: ResolveListingByHostnameInput): Promise<ListingHostnameResolution | null> {
    const managedSubdomain = this.extractManagedSlug(input.hostname);
    if (!managedSubdomain) return this.resolveListingByCustomDomain(input.hostname, input.listingSlug);

    const auth = input.auth ?? null;
    const actor = await upsertUserFromAuth(this.prisma, auth);
    const allowAdmin = hasAdminAccess(auth);
    const listings = await this.prisma.listing.findMany({
      where: { subdomainSlug: managedSubdomain },
      select: {
        id: true,
        ownerId: true,
        status: true,
        kind: true,
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

    const hub = visibleListings.find((listing) => listing.kind === 'hub') ?? null;

    const normalizedListingSlug = normalizePublicListingSlug(input.listingSlug ?? '');
    if (normalizedListingSlug) {
      const matchedBySlug = visibleListings.find((listing) => {
        const listingCore = asObject(listing.core, buildDefaultResource('core', listing.id));
        return buildListingSlugFromCore(listingCore, listing.id) === normalizedListingSlug;
      });
      // Sinon, un logement rattaché à la page principale de ce sous-domaine.
      const matched = matchedBySlug ?? (hub ? await this.findHubChildBySlug(hub.id, normalizedListingSlug) : null);
      if (!matched) return null;

      return {
        listingId: matched.id,
        subdomainSlug: managedSubdomain,
        hostname: this.buildListingHostname(managedSubdomain),
        publicUrl: this.buildManagedListingPublicUrl(managedSubdomain, normalizedListingSlug),
      };
    }

    // Plusieurs annonces sur le même sous-domaine : la page principale, s'il y en a une, répond à la racine.
    const matched = visibleListings.length === 1 ? visibleListings[0] : hub;
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
    if (isRedactedPatch(patch)) return 'redacted' as const;

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
    // Nettoyage à l'écriture sur la valeur fusionnée : un enregistrement assainit aussi le contenu
    // déjà stocké de la section (le front assainit par ailleurs au rendu).
    const merged = sanitizeListingSection(resource, deepMerge(currentValue, patch));
    let normalizedMerged = resource === 'bookings'
      ? await this.normalizeBookingsResourceValue(listingId, merged)
      : merged;

    const data: Prisma.ListingUpdateInput = {
      updatedAt: new Date(),
    };
    let publishedNow = false;

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
      if (allowAdmin) {
        // Gel posé par un admin : marqué pour que le propriétaire ne puisse pas le lever.
        if (nextStatus === 'blocked' && currentStatus !== 'blocked') normalizedMerged.blockedBy = 'admin';
        if (nextStatus !== 'blocked') delete normalizedMerged.blockedBy;
      } else {
        const frozenByAdmin = currentStatus === 'blocked' && currentValue.blockedBy === 'admin';
        if ((frozenByAdmin || currentStatus === 'deleted') && nextStatus !== currentStatus) {
          return 'forbidden' as const;
        }
        // Type et marqueur de gel fixés par le serveur : passer en page principale sortirait
        // l'annonce du compte des logements du plan.
        if (currentValue.kind === undefined) delete normalizedMerged.kind;
        else normalizedMerged.kind = currentValue.kind;
        if (currentValue.blockedBy === undefined) delete normalizedMerged.blockedBy;
        else normalizedMerged.blockedBy = currentValue.blockedBy;
      }
      if (nextStatus === 'published' && (!allowAdmin || currentStatus !== 'published')) {
        await this.assertCanPublishListing(actor, { allowAdmin, listingId });
      }
      publishedNow = nextStatus === 'published' && currentStatus !== 'published';
      data.core = toJsonInput(normalizedMerged);
      data.status = nextStatus;
      data.kind = normalizeListingKind(normalizedMerged.kind);
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

    await this.prisma.listing.update({
      where: { id: listingId },
      data,
    });

    if (publishedNow) void this.notifyListingPublication(listingId);

    return normalizedMerged;
  }

  // Résout la réservation visée par une clé de guide et vérifie la signature (sans compte Clerk).
  private async resolveGuideReviewAccess(guideKey: string): Promise<GuideReviewAccess | 'forbidden' | null> {
    const parsed = parseGuideAccessKey(guideKey);
    if (!parsed) return 'forbidden';

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: parsed.reservationId },
      select: {
        id: true,
        listingId: true,
        guestName: true,
        startDate: true,
        endDate: true,
        contact: true,
        listing: { select: { comments: true } },
      },
    });
    if (!reservation) return null;
    if (!verifyGuideAccessKey(guideKey, reservation)) return 'forbidden';

    return {
      reservationId: reservation.id,
      listingId: reservation.listingId,
      guestName: reservation.guestName,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      comments: asObject(reservation.listing.comments, buildDefaultResource('comments', reservation.listingId)),
    };
  }

  private buildGuideReviewStatus(access: GuideReviewAccess, now = new Date()) {
    const availableFrom = resolveGuideReviewAvailableFrom(access.startDate);
    const existing = findGuideReviewEntry(access.comments, access.reservationId);
    return {
      reservationId: access.reservationId,
      listingId: access.listingId,
      availableFromISO: availableFrom.toISOString(),
      canReview: !existing && now.getTime() >= availableFrom.getTime(),
      review: existing ? toGuideReview(existing) : null,
    };
  }

  async getGuideReview(guideKey: string) {
    const access = await this.resolveGuideReviewAccess(guideKey);
    if (!access || access === 'forbidden') return access;
    return this.buildGuideReviewStatus(access);
  }

  async createGuideReview(guideKey: string, input: CreateGuideReviewInput) {
    const access = await this.resolveGuideReviewAccess(guideKey);
    if (!access || access === 'forbidden') return access;

    const text = sanitizeReviewText(input.text);
    if (text.length < 10) return 'invalid_text' as const;
    const author = sanitizeReviewText(input.author ?? '').slice(0, 80) || access.guestName.trim() || 'Voyageur';
    const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
    const now = new Date();

    // Relecture dans la transaction : deux envois simultanés ne doivent produire qu'un seul avis.
    const result = await this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: access.listingId },
        select: { id: true, comments: true },
      });
      if (!listing) return null;

      const comments = asObject(listing.comments, buildDefaultResource('comments', access.listingId));
      const status = this.buildGuideReviewStatus({ ...access, comments }, now);
      if (status.review) return 'already_reviewed' as const;
      if (!status.canReview) return 'locked' as const;

      const entry: Record<string, unknown> = {
        id: `review-${access.reservationId}`,
        source: 'indiehost',
        reservationId: access.reservationId,
        createdAt: now.toISOString(),
        // Clés lues par la page publique (`useParseContent.parseComments`).
        'profile-pic': '',
        name: author,
        note: rating,
        comment: text,
        'stay-dates': {
          start: toIsoDay(access.startDate),
          end: toIsoDay(access.endDate),
        },
        // Alias explicites.
        author,
        rating,
        text,
      };

      const nextComments = { ...comments, comments: prependCommentEntry(comments, entry) };
      await tx.listing.update({
        where: { id: access.listingId },
        data: { comments: toJsonInput(nextComments), updatedAt: now },
      });

      return toGuideReview(entry);
    });

    if (result && typeof result === 'object') {
      void this.resolveListingPublicUrl(access.listingId).then((listingUrl) => hostNotifications.reviewReceived(this.prisma, {
        listingId: access.listingId,
        reservationId: access.reservationId,
        author,
        rating,
        text,
        listingUrl,
      })).catch((error) => {
        console.error('[listings] e-mail d’avis à l’hôte non envoyé', { listingId: access.listingId, error });
      });
    }

    return result;
  }

  /** Adresse publique d'une annonce (domaine personnalisé vérifié, sinon sous-domaine), pour les e-mails. */
  private async resolveListingPublicUrl(listingId: string): Promise<string | null> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        ownerId: true,
        subdomainSlug: true,
        customDomain: true,
        customDomainVerifiedAt: true,
        customDomainVerificationToken: true,
        core: true,
      },
    });
    if (!listing) return null;
    if (listing.customDomain && listing.customDomainVerifiedAt) return `https://${listing.customDomain}`;
    const record = await this.toDomainRecord(listing);
    return record.publicUrl;
  }

  /** E-mail à l'hôte après une mise en ligne (annonce en ligne, dernière place de l'offre utilisée). */
  private async notifyListingPublication(listingId: string): Promise<void> {
    try {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        select: { kind: true, core: true, owner: true },
      });
      if (!listing?.owner) return;

      const publicUrl = await this.resolveListingPublicUrl(listingId)
        ?? `${resolvePublicBaseUrl()}/${buildListingSlugFromCore(asObject(listing.core, buildDefaultResource('core', listingId)), listingId)}`;

      // Les pages principales ne comptent pas dans la limite de l'offre.
      let allowance: { planCode: unknown; activeListings: number; maxActiveListings: number } | null = null;
      const maxActiveListings = this.buildPublicationReadiness(listing.owner).maxActiveListings;
      if (normalizeListingKind(asObject(listing.core).kind) === 'listing' && maxActiveListings) {
        const activeListings = await this.prisma.listing.count({
          where: { ownerId: listing.owner.id, kind: 'listing', status: { in: [...LISTING_LIMIT_COUNTED_STATUSES] } },
        });
        const billing = asObject(asObject(listing.owner.stripeConnectProfile).billing);
        allowance = { planCode: billing.planCode, activeListings, maxActiveListings };
      }

      await hostNotifications.listingPublished(this.prisma, { listingId, publicUrl, allowance });
    } catch (error) {
      console.error('[listings] e-mail de mise en ligne non envoyé', { listingId, error });
    }
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
        kind: normalizeListingKind(listing.kind),
        parentListingId: listing.parentListingId ?? undefined,
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
