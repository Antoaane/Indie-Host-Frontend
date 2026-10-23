import type { PrismaClient, User } from '@prisma/client';
import Stripe from 'stripe';

import { env } from '../../config/env.js';
import {
  EXTRA_LISTING_TEMPLATE,
  EXTRA_LISTINGS_MAX,
  LISTING_LIMIT_COUNTED_STATUSES,
  PLAN_CODES,
  PLAN_TEMPLATES,
  normalizeAddonCode,
  normalizePlanCode,
  readExtraListingsFromBilling,
  type SubscriptionPlanCode,
} from './plans.catalog.js';
import { asObject, toNumber } from '../../lib/json.js';
import { toPrismaJson } from '../../lib/prisma.js';
import { hasAdminAccess } from '../../lib/authRole.js';
import type { RequestAuth } from '../../types/auth.js';
import { resolveUserByIdentifier, upsertUserFromAuth } from '../users/users.repository.js';
import { computeReservationTotal, isReservationRangeAvailable } from './reservationPricing.js';

type CheckoutPaymentChoice = 'full' | 'split' | 'cash';
type CheckoutDeferredMode = 'none' | 'online' | 'cash';

type CreatePaymentIntentInput = {
  listingId: string;
  connectedAccountId: string;
  currency: string;
  reservation: Record<string, unknown>;
  payment: {
    choice: CheckoutPaymentChoice;
    totalAmount: number;
    chargeNowAmount: number;
    deferredAmount?: number;
    deferredMode?: CheckoutDeferredMode;
    deferredDueDateISO?: string | null;
  };
  metadata?: Record<string, string>;
};

type CreateConnectOnboardingLinkInput = {
  accountId?: string;
  refreshUrl: string;
  returnUrl: string;
  country?: string;
  hostStatus?: 'individual' | 'professional';
};

// Hébergement touristique (catégorie d'activité Stripe) : évite de la demander à l'hôte.
const STRIPE_CONNECT_LODGING_MCC = '7011';
const STRIPE_CONNECT_PRODUCT_DESCRIPTION =
  'Location saisonnière d’un logement meublé, réservée en direct sur le site de l’hôte (IndieHost).';

type ConnectAccountPrefill = Pick<
  Stripe.AccountCreateParams,
  'business_type' | 'business_profile' | 'email' | 'individual'
>;

type CreateConnectDashboardLinkInput = {
  accountId?: string;
};

type SyncConnectStateInput = {
  accountId?: string;
};

export type { SubscriptionPlanCode };

export type SubscriptionPlan = {
  code: SubscriptionPlanCode;
  name: string;
  description: string;
  maxActiveListings: number;
  currency: string;
  monthlyPriceMinor: number;
  billingInterval: string;
  stripePriceId: string | null;
  available: boolean;
  unavailableReason: string | null;
};

export type ExtraListingOffer = {
  code: 'extra_listing';
  name: string;
  description: string;
  currency: string;
  monthlyPriceMinor: number;
  billingInterval: string;
  stripePriceId: string | null;
  available: boolean;
  unavailableReason: string | null;
};

export type SubscriptionCatalog = {
  plans: SubscriptionPlan[];
  extraListing: ExtraListingOffer | null;
};

export type ListingAllowance = {
  includedListings: number;
  extraListings: number;
  maxActiveListings: number | null;
  activeListings: number;
  remaining: number | null;
};

type UpdateExtraListingsInput = {
  quantity: number;
};

export type UpdateExtraListingsResult = {
  state: 'updated' | 'subscription_required' | 'offer_unavailable' | 'quantity_in_use';
  mode: 'live' | 'mock';
  subscription: PublicBillingSnapshot | null;
  listingAllowance: ListingAllowance;
  message: string | null;
};

type AdminSubscriptionLinkInput = {
  userId: string;
  planCode: SubscriptionPlanCode;
  extraListings: number;
  successUrl: string;
  cancelUrl: string;
};

export type AdminSubscriptionLinkResult = {
  state: 'created' | 'plan_unavailable';
  mode: 'live' | 'mock';
  plan: SubscriptionPlan | null;
  url: string | null;
  sessionId: string | null;
  expiresAtISO: string | null;
  message: string | null;
};

type ComplimentaryPlanInput = {
  planCode: SubscriptionPlanCode;
  extraListings: number;
  endsAtISO: string | null;
};

export type ComplimentaryPlanResult =
  | { state: 'granted' | 'revoked'; subscriptionState: MySubscriptionStateResult; message: string | null }
  | { state: 'subscription_exists' | 'plan_unavailable'; subscriptionState: MySubscriptionStateResult; message: string };

type ActivateSubscriptionInput = {
  planCode: SubscriptionPlanCode;
  successUrl: string;
  cancelUrl: string;
};

type ConfirmCheckoutInput = {
  sessionId: string;
  planCode?: SubscriptionPlanCode;
};

type ConnectSummary = {
  accountId: string | null;
  onboardingStatus: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  defaultCurrency: string;
  transferSchedule: string;
  createdInFlow: boolean;
};

type PublicConnectSummary = Omit<ConnectSummary, 'createdInFlow'>;

type PublicationReadiness = {
  canPublish: boolean;
  hasActiveSubscription: boolean;
  hasConnectAccount: boolean;
  connectOnboardingCompleted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  missingRequirements: string[];
};

type BillingSnapshot = {
  customerId: string | null;
  subscriptionId: string | null;
  planCode: SubscriptionPlanCode | null;
  status: string | null;
  currentPeriodEndISO: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAtISO: string | null;
  pendingPlanCode: SubscriptionPlanCode | null;
  pendingCheckoutSessionId: string | null;
  // Logements inclus par le plan (figés à la synchro Stripe) et supplémentaires (quantité de l'item add-on).
  includedListings: number | null;
  extraListings: number;
  planItemId: string | null;
  extraListingItemId: string | null;
  // Plan offert par l'admin : actif sans abonnement Stripe, illimité ou jusqu'à une date.
  complimentary: boolean;
  complimentaryEndsAtISO: string | null;
  complimentaryGrantedByUserId: string | null;
  complimentaryGrantedAtISO: string | null;
  giftedTrialSource?: string | null;
  giftedTrialListingId?: string | null;
  giftedTrialGrantedByUserId?: string | null;
  giftedTrialGrantedAtISO?: string | null;
  giftedTrialEndsAtISO?: string | null;
  giftedTrialExpiredAtISO?: string | null;
};

type PublicBillingSnapshot = {
  subscriptionId: string | null;
  planCode: SubscriptionPlanCode | null;
  status: string | null;
  currentPeriodEndISO: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAtISO: string | null;
  pendingPlanCode: SubscriptionPlanCode | null;
  pendingCheckoutSessionId: string | null;
  includedListings: number | null;
  extraListings: number;
  complimentary: boolean;
  complimentaryEndsAtISO: string | null;
};

export type SubscriptionActivationResult = {
  state: 'plan_unavailable' | 'checkout_required' | 'updated' | 'already_active';
  mode: 'live' | 'mock';
  plan: SubscriptionPlan | null;
  subscription: PublicBillingSnapshot | null;
  connect: ConnectSummary;
  publicationReadiness: PublicationReadiness;
  checkout: {
    sessionId: string;
    url: string;
  } | null;
  message: string | null;
};

export type ConfirmSubscriptionCheckoutResult = {
  state: 'confirmed' | 'not_found';
  mode: 'live' | 'mock';
  plan: SubscriptionPlan | null;
  subscription: PublicBillingSnapshot | null;
  connect: ConnectSummary;
  publicationReadiness: PublicationReadiness;
  message: string | null;
};

export type MySubscriptionStateResult = {
  mode: 'live' | 'mock';
  plans: SubscriptionPlan[];
  extraListing: ExtraListingOffer | null;
  currentPlanCode: SubscriptionPlanCode | null;
  currentPlan: SubscriptionPlan | null;
  subscription: PublicBillingSnapshot | null;
  listingAllowance: ListingAllowance;
  connect: PublicConnectSummary;
  publicationReadiness: PublicationReadiness;
};

export type SyncConnectStateResult = {
  mode: 'live' | 'mock';
  connect: PublicConnectSummary;
  publicationReadiness: PublicationReadiness;
};

export type ConnectDashboardLinkResult = {
  mode: 'live' | 'mock';
  accountId: string;
  url: string;
};

type StripePlanCandidate = {
  product: Stripe.Product;
  price: Stripe.Price;
};

const SUBSCRIPTION_TRIAL_PERIOD_DAYS = 30;
const SUBSCRIPTION_TRIAL_RESERVATION_LIMIT = 15;
const SUBSCRIPTION_TRIAL_RESERVATION_LIMIT_ENABLED = false;

const ONGOING_SUBSCRIPTION_STATUSES = new Set([
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'incomplete',
]);

const PUBLICATION_ALLOWED_SUBSCRIPTION_STATUSES = new Set([
  'trialing',
  'active',
]);
const ADMIN_LISTING_TRANSFER_TRIAL_SOURCE = 'admin_listing_transfer';
const ADMIN_LISTING_TRANSFER_TRIAL_EXPIRED_STATUS = 'canceled';

const DAY_MS = 24 * 60 * 60 * 1000;
// Statuts Stripe qui valident une réservation (mêmes que le parcours de réservation du front).
const SETTLED_RESERVATION_PAYMENT_STATUSES = new Set(['succeeded', 'processing', 'requires_capture']);
const DEFAULT_CAPACITY = 1;
const MAX_CAPACITY = 50;
const DEFAULT_MIN_NIGHTS = 2;
const MAX_NIGHTS = 365;
const PAYMENT_DEPOSIT_PERCENT_MIN = 10;
const PAYMENT_DEPOSIT_PERCENT_MAX = 90;
const PAYMENT_BALANCE_DAYS_MAX = 365;

type OccupantCounts = {
  adults: number;
  children: number;
  babies: number;
  animals: number;
  pmr: number;
};

type ListingOccupancyRules = {
  capacity: number;
  adultsMin: number;
  adultsMax: number;
  childrenMax: number;
  babiesMax: number;
  animalsMax: number;
  pmrMax: number;
};

type ListingStayRules = {
  minNights: number;
  maxNights: number | null;
};

type ListingPaymentRules = {
  methods: {
    card: boolean;
    sepa: boolean;
    cash: boolean;
  };
  onlineEnabled: boolean;
  mode: 'full' | 'deposit';
  depositPercent: number;
  balance: {
    type: 'arrival' | 'before';
    days: number;
  };
  chargeNowRatioByChoice: Record<CheckoutPaymentChoice, number>;
  allowedChoices: CheckoutPaymentChoice[];
  blockedReasons: Partial<Record<CheckoutPaymentChoice, string>>;
};

type ListingReservationRules = {
  stay: ListingStayRules;
  occupancy: ListingOccupancyRules;
  payment: ListingPaymentRules;
};

type NormalizedReservationInput = {
  startISO: string;
  endISO: string;
  nights: number;
  totalAmountMinor: number;
  occupants: OccupantCounts;
};

type PaymentBreakdownValidation = {
  choice: CheckoutPaymentChoice;
  totalAmountMinor: number;
  chargeNowAmountMinor: number;
  deferredAmountMinor: number;
  deferredMode: CheckoutDeferredMode;
  deferredDueDateISO: string | null;
  ratio: number;
};

function toMinorUnit(amount: number): number {
  const normalized = Number.isFinite(amount) ? amount : 0;
  return Math.max(0, Math.round(normalized * 100));
}

function generateMockId(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
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

function readNullableInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

function toIsoFromUnixSeconds(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

function addQueryParam(url: string, key: string, value: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has(key)) {
      parsed.searchParams.set(key, value);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function addRawQueryParam(url: string, key: string, value: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has(key)) return parsed.toString();

    const hash = parsed.hash ?? '';
    parsed.hash = '';
    const base = parsed.toString();
    const separator = parsed.search ? '&' : '?';
    return `${base}${separator}${encodeURIComponent(key)}=${value}${hash}`;
  } catch {
    return url;
  }
}

function applyDefinedPatch(base: Record<string, unknown>, patch?: Record<string, unknown>): Record<string, unknown> {
  if (!patch) return { ...base };

  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    output[key] = value;
  }

  return output;
}

function nowIso(): string {
  return new Date().toISOString();
}

function oneMonthFromNowIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function daysFromNowIso(days: number): string {
  return new Date(Date.now() + (days * DAY_MS)).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTrialEligiblePlanCode(planCode: SubscriptionPlanCode | null | undefined): planCode is SubscriptionPlanCode {
  return planCode === 'indiehost' || planCode === 'superhost';
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(next)));
}

function normalizeRatio(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function toUtcDay(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const utc = Date.UTC(year, month - 1, day);
  const date = new Date(utc);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return utc;
}

function toIsoFromUtcDay(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function subtractDays(isoDate: string, days: number): string {
  const base = toUtcDay(isoDate);
  if (base === null) return isoDate;
  const normalizedDays = Math.max(0, Math.trunc(days));
  return toIsoFromUtcDay(base - normalizedDays * DAY_MS);
}

function normalizeIsoDate(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) return null;
  return toUtcDay(raw) === null ? null : raw;
}

function createBadRequestError(message: string, code = 'INVALID_PAYMENT_REQUEST', details?: Record<string, unknown>) {
  const error = new Error(message) as Error & {
    statusCode: number;
    code: string;
    details?: Record<string, unknown>;
  };
  error.statusCode = 400;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function createForbiddenRequestError(message: string, code = 'FORBIDDEN_REQUEST', details?: Record<string, unknown>) {
  const error = new Error(message) as Error & {
    statusCode: number;
    code: string;
    details?: Record<string, unknown>;
  };
  error.statusCode = 403;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function resolveLegacyPaymentRules(): ListingPaymentRules {
  return {
    methods: {
      card: true,
      sepa: true,
      cash: true,
    },
    onlineEnabled: true,
    mode: 'deposit',
    depositPercent: 50,
    balance: {
      type: 'arrival',
      days: 0,
    },
    chargeNowRatioByChoice: {
      full: 1,
      split: 0.5,
      cash: 0.25,
    },
    allowedChoices: [
      'full',
      'split',
      'cash',
    ],
    blockedReasons: {},
  };
}

function resolvePricingPaymentRules(pricing: Record<string, unknown>): ListingPaymentRules {
  if (!isRecord(pricing.payment)) {
    return resolveLegacyPaymentRules();
  }

  const rawPayment = asObject(pricing.payment);
  const rawMethods = asObject(rawPayment.methods);
  const rawBalance = asObject(rawPayment.balance);

  const methods = {
    card: rawMethods.card === undefined ? true : Boolean(rawMethods.card),
    sepa: Boolean(rawMethods.sepa),
    cash: Boolean(rawMethods.cash),
  };
  const onlineEnabled = methods.card || methods.sepa;
  const mode = rawPayment.mode === 'deposit' ? 'deposit' : 'full';
  const depositPercent = clampInteger(
    rawPayment.depositPercent,
    PAYMENT_DEPOSIT_PERCENT_MIN,
    PAYMENT_DEPOSIT_PERCENT_MAX,
    PAYMENT_DEPOSIT_PERCENT_MIN,
  );
  const balanceType = rawBalance.type === 'before' ? 'before' : 'arrival';
  const balanceDays = Number.isFinite(Number(rawBalance.days))
    ? clampInteger(rawBalance.days, 0, PAYMENT_BALANCE_DAYS_MAX, 0)
    : 0;

  const blockedReasons: Partial<Record<CheckoutPaymentChoice, string>> = {};
  const allowedChoices: CheckoutPaymentChoice[] = [];

  if (mode === 'full') {
    if (onlineEnabled) {
      allowedChoices.push('full');
    } else {
      blockedReasons.full = 'Aucun paiement en ligne n est autorise par l hote.';
    }

    blockedReasons.split = 'Cet hote exige un paiement integral a la reservation.';
    blockedReasons.cash = methods.cash
      ? 'Le paiement differe en especes n est pas autorise pour cette annonce.'
      : 'Le paiement en especes n est pas autorise par l hote.';
  } else {
    blockedReasons.full = 'Cet hote exige un acompte puis un solde.';

    if (onlineEnabled) {
      allowedChoices.push('split');
    } else {
      blockedReasons.split = 'Aucun paiement en ligne n est autorise par l hote.';
    }

    if (!methods.cash) {
      blockedReasons.cash = 'Le paiement en especes n est pas autorise par l hote.';
    } else if (!onlineEnabled) {
      blockedReasons.cash = 'Impossible de collecter l acompte en ligne pour cette annonce.';
    } else if (balanceType !== 'arrival') {
      blockedReasons.cash = 'Le solde est exige avant l arrivee, pas en especes le jour d arrivee.';
    } else {
      allowedChoices.push('cash');
    }
  }

  return {
    methods,
    onlineEnabled,
    mode,
    depositPercent,
    balance: {
      type: balanceType,
      days: balanceDays,
    },
    chargeNowRatioByChoice: {
      full: 1,
      split: mode === 'deposit' ? depositPercent / 100 : 1,
      cash: mode === 'deposit' ? depositPercent / 100 : 1,
    },
    allowedChoices,
    blockedReasons,
  };
}

function resolveStayRules(pricing: Record<string, unknown>): ListingStayRules {
  const rawStay = asObject(pricing.stay);
  const minNights = clampInteger(rawStay.minNights, 1, MAX_NIGHTS, DEFAULT_MIN_NIGHTS);
  const maxNights = Number.isFinite(Number(rawStay.maxNights))
    ? clampInteger(rawStay.maxNights, minNights, MAX_NIGHTS, minNights)
    : null;

  return {
    minNights,
    maxNights,
  };
}

function resolveOccupancyRules(pricing: Record<string, unknown>, capacity: number): ListingOccupancyRules {
  const raw = asObject(pricing.occupancy);
  const adultsMin = clampInteger(raw.adultsMin, 1, capacity, 1);
  const adultsMax = clampInteger(raw.adultsMax, adultsMin, capacity, capacity);

  const childrenAllowed = raw.allowChildren !== false;
  const babiesAllowed = raw.allowBabies !== false;
  const animalsAllowed = raw.allowAnimals !== false;
  const pmrAllowed = raw.allowPmr !== false;

  return {
    capacity,
    adultsMin,
    adultsMax,
    childrenMax: childrenAllowed ? clampInteger(raw.childrenMax, 0, capacity, capacity) : 0,
    babiesMax: babiesAllowed ? clampInteger(raw.babiesMax ?? raw.infantsMax, 0, capacity, capacity) : 0,
    animalsMax: animalsAllowed ? clampInteger(raw.animalsMax ?? raw.petsMax, 0, capacity, capacity) : 0,
    pmrMax: pmrAllowed ? clampInteger(raw.pmrMax, 0, capacity, capacity) : 0,
  };
}

function resolveListingReservationRules({
  core,
  bookings,
}: {
  core: Record<string, unknown>;
  bookings: Record<string, unknown>;
}): ListingReservationRules {
  const capacity = clampInteger(core.guest_capacity, DEFAULT_CAPACITY, MAX_CAPACITY, DEFAULT_CAPACITY);
  const pricing = asObject(bookings.pricing);

  return {
    stay: resolveStayRules(pricing),
    occupancy: resolveOccupancyRules(pricing, capacity),
    payment: resolvePricingPaymentRules(pricing),
  };
}

function normalizeReservationInput(
  reservation: Record<string, unknown>,
  rules: ListingReservationRules,
): NormalizedReservationInput {
  const startISO = normalizeIsoDate(reservation.startISO);
  const endISO = normalizeIsoDate(reservation.endISO);
  if (!startISO || !endISO) {
    throw createBadRequestError('Selection de dates invalide.', 'INVALID_RESERVATION_RANGE');
  }

  const startDay = toUtcDay(startISO);
  const endDay = toUtcDay(endISO);
  if (startDay === null || endDay === null || startDay >= endDay) {
    throw createBadRequestError('Selection de dates invalide.', 'INVALID_RESERVATION_RANGE');
  }

  const nights = Math.round((endDay - startDay) / DAY_MS);
  if (nights <= 0) {
    throw createBadRequestError('Selection de dates invalide.', 'INVALID_RESERVATION_RANGE');
  }

  const requestNights = toNumber(reservation.nights, nights);
  if (Number.isFinite(requestNights) && Math.max(1, Math.trunc(requestNights)) !== nights) {
    throw createBadRequestError('Le nombre de nuits est incoherent avec les dates.', 'INVALID_RESERVATION_NIGHTS');
  }

  if (nights < rules.stay.minNights) {
    throw createBadRequestError(`Sejour minimum: ${rules.stay.minNights} nuit(s).`, 'INVALID_RESERVATION_NIGHTS');
  }
  if (rules.stay.maxNights !== null && nights > rules.stay.maxNights) {
    throw createBadRequestError(`Sejour maximum: ${rules.stay.maxNights} nuit(s).`, 'INVALID_RESERVATION_NIGHTS');
  }

  const rawOccupants = asObject(reservation.occupants);
  const occupants: OccupantCounts = {
    adults: clampInteger(rawOccupants.adults, 0, MAX_CAPACITY, 1),
    children: clampInteger(rawOccupants.children, 0, MAX_CAPACITY, 0),
    babies: clampInteger(rawOccupants.babies, 0, MAX_CAPACITY, 0),
    animals: clampInteger(rawOccupants.animals, 0, MAX_CAPACITY, 0),
    pmr: clampInteger(rawOccupants.pmr, 0, MAX_CAPACITY, 0),
  };

  if (occupants.adults < rules.occupancy.adultsMin || occupants.adults > rules.occupancy.adultsMax) {
    throw createBadRequestError('Le nombre d adultes ne respecte pas les regles de l annonce.', 'INVALID_OCCUPANTS');
  }
  if (occupants.children > rules.occupancy.childrenMax) {
    throw createBadRequestError('Le nombre d enfants ne respecte pas les regles de l annonce.', 'INVALID_OCCUPANTS');
  }
  if (occupants.babies > rules.occupancy.babiesMax) {
    throw createBadRequestError('Le nombre de bebes ne respecte pas les regles de l annonce.', 'INVALID_OCCUPANTS');
  }
  if (occupants.animals > rules.occupancy.animalsMax) {
    throw createBadRequestError('Le nombre d animaux ne respecte pas les regles de l annonce.', 'INVALID_OCCUPANTS');
  }
  if (occupants.pmr > rules.occupancy.pmrMax) {
    throw createBadRequestError('Le nombre de voyageurs PMR ne respecte pas les regles de l annonce.', 'INVALID_OCCUPANTS');
  }

  const travelers = occupants.adults + occupants.children;
  if (travelers > rules.occupancy.capacity) {
    throw createBadRequestError('Capacite maximale depassee pour cette annonce.', 'INVALID_OCCUPANTS');
  }

  const totalAmountMinor = toMinorUnit(toNumber(reservation.total, 0));
  if (totalAmountMinor <= 0) {
    throw createBadRequestError('Le montant total de la reservation est invalide.', 'INVALID_RESERVATION_TOTAL');
  }

  return {
    startISO,
    endISO,
    nights,
    totalAmountMinor,
    occupants,
  };
}

function assertReservationRangeAvailable(bookings: Record<string, unknown>, startISO: string, endISO: string) {
  if (isReservationRangeAvailable(bookings, startISO, endISO)) return;
  const error = createBadRequestError('Ces dates ne sont plus disponibles.', 'RESERVATION_RANGE_UNAVAILABLE');
  error.statusCode = 409;
  throw error;
}

function resolveDeferredMode(choice: CheckoutPaymentChoice): CheckoutDeferredMode {
  if (choice === 'full') return 'none';
  if (choice === 'cash') return 'cash';
  return 'online';
}

function resolveDeferredDueDateISO(choice: CheckoutPaymentChoice, arrivalDateISO: string, paymentRules: ListingPaymentRules): string | null {
  if (choice === 'full') return null;
  if (choice === 'cash') return arrivalDateISO;
  if (paymentRules.balance.type === 'before' && paymentRules.balance.days > 0) {
    return subtractDays(arrivalDateISO, paymentRules.balance.days);
  }
  return arrivalDateISO;
}

function validatePaymentBreakdownInput({
  payment,
  reservation,
  paymentRules,
}: {
  payment: CreatePaymentIntentInput['payment'];
  reservation: NormalizedReservationInput;
  paymentRules: ListingPaymentRules;
}): PaymentBreakdownValidation {
  const choice = payment.choice;
  if (!paymentRules.allowedChoices.includes(choice)) {
    const blockedReason = paymentRules.blockedReasons[choice] ?? 'Option de paiement non autorisee pour cette annonce.';
    throw createBadRequestError(blockedReason, 'INVALID_PAYMENT_CHOICE');
  }

  const totalAmountMinor = toMinorUnit(payment.totalAmount);
  if (totalAmountMinor !== reservation.totalAmountMinor) {
    throw createBadRequestError('Le total de paiement est incoherent avec la reservation.', 'INVALID_PAYMENT_TOTAL');
  }

  const ratio = normalizeRatio(paymentRules.chargeNowRatioByChoice[choice], 1);
  const expectedChargeNowAmountMinor = Math.round(totalAmountMinor * ratio);
  const chargeNowAmountMinor = toMinorUnit(payment.chargeNowAmount);
  if (chargeNowAmountMinor !== expectedChargeNowAmountMinor) {
    throw createBadRequestError('Le montant a debiter immediatement ne correspond pas aux regles de paiement.', 'INVALID_CHARGE_NOW_AMOUNT');
  }
  if (chargeNowAmountMinor <= 0) {
    throw createBadRequestError('Le montant a debiter immediatement doit etre superieur a 0.', 'INVALID_CHARGE_NOW_AMOUNT');
  }

  const expectedDeferredAmountMinor = Math.max(0, totalAmountMinor - chargeNowAmountMinor);
  const deferredAmountMinor = payment.deferredAmount === undefined
    ? expectedDeferredAmountMinor
    : toMinorUnit(payment.deferredAmount);
  if (deferredAmountMinor !== expectedDeferredAmountMinor) {
    throw createBadRequestError('Le montant differe est incoherent avec les regles de paiement.', 'INVALID_DEFERRED_AMOUNT');
  }

  const deferredMode = resolveDeferredMode(choice);
  if (payment.deferredMode && payment.deferredMode !== deferredMode) {
    throw createBadRequestError('Le mode de paiement differe est invalide.', 'INVALID_DEFERRED_MODE');
  }

  const deferredDueDateISO = resolveDeferredDueDateISO(choice, reservation.startISO, paymentRules);
  const inputDeferredDueDate = normalizeIsoDate(payment.deferredDueDateISO);
  if (deferredDueDateISO !== inputDeferredDueDate) {
    throw createBadRequestError('La date de solde differe est invalide.', 'INVALID_DEFERRED_DUE_DATE');
  }

  return {
    choice,
    totalAmountMinor,
    chargeNowAmountMinor,
    deferredAmountMinor,
    deferredMode,
    deferredDueDateISO,
    ratio,
  };
}

function isSubscriptionOngoing(status: string | null): boolean {
  if (!status) return false;
  return ONGOING_SUBSCRIPTION_STATUSES.has(status);
}

export class PaymentsService {
  private readonly stripe: Stripe | null;

  constructor(private readonly prisma: PrismaClient) {
    this.stripe = env.STRIPE_SECRET_KEY
      ? new Stripe(env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-02-24.acacia',
        })
      : null;
  }

  private getExecutionMode(): 'live' | 'mock' {
    return this.stripe ? 'live' : 'mock';
  }

  private isTestStripeSecretKey(): boolean {
    return env.STRIPE_SECRET_KEY.trim().startsWith('sk_test_');
  }

  private getStripeConnectPlatformProfileDashboardUrl(): string {
    return this.isTestStripeSecretKey()
      ? 'https://dashboard.stripe.com/test/settings/connect/platform-profile'
      : 'https://dashboard.stripe.com/settings/connect/platform-profile';
  }

  private isStripeConnectPlatformProfileError(error: unknown): boolean {
    if (!isRecord(error)) return false;

    const message = readString(error.message)?.toLowerCase() ?? '';
    const code = readString(error.code)?.toLowerCase() ?? '';
    const type = readString(error.type)?.toLowerCase() ?? '';
    const statusCode = toNumber(error.statusCode, 0);

    if (statusCode !== 400 && statusCode !== 403) return false;

    if (message.includes('managing losses')) return true;
    if (message.includes('connect/platform-profile')) return true;
    if (message.includes('platform profile')) return true;
    if (code.includes('losses')) return true;
    if (type.includes('invalid_request_error') && message.includes('connect')) return true;
    return false;
  }

  private buildStripeConnectPlatformProfileError(error: unknown): Error {
    const dashboardUrl = this.getStripeConnectPlatformProfileDashboardUrl();
    const mode = this.isTestStripeSecretKey() ? 'test' : 'live';

    const wrapped = new Error(
      `Stripe Connect nécessite une validation du profil plateforme en mode ${mode}. `
      + `Ouvrez ${dashboardUrl}, confirmez les responsabilités, puis réessayez.`,
    ) as Error & {
      statusCode: number;
      code: string;
      details: Record<string, unknown>;
    };

    wrapped.statusCode = 400;
    wrapped.code = 'STRIPE_CONNECT_PLATFORM_PROFILE_REQUIRED';
    wrapped.details = {
      mode,
      dashboardUrl,
      stripeMessage: isRecord(error) ? readString(error.message) : null,
      stripeCode: isRecord(error) ? readString(error.code) : null,
      stripeType: isRecord(error) ? readString(error.type) : null,
    };

    return wrapped;
  }

  private getSubscriptionExecutionMode(): 'live' | 'mock' {
    return this.stripe ? 'live' : 'mock';
  }

  private computeApplicationFee(amountMinor: number): number {
    if (amountMinor <= 0) return 0;
    if (env.STRIPE_CONNECT_PLATFORM_FEE_BPS <= 0) return 0;
    return Math.max(0, Math.round((amountMinor * env.STRIPE_CONNECT_PLATFORM_FEE_BPS) / 10000));
  }

  private resolveListingConnectedAccountId(listingOwner: {
    stripeConnectAccountId: string | null;
    stripeConnectProfile: unknown;
  } | null): string | null {
    if (!listingOwner) return null;
    const profile = asObject(listingOwner.stripeConnectProfile);
    const profileAccountId = readString(profile.accountId);
    return readString(listingOwner.stripeConnectAccountId) ?? profileAccountId;
  }

  private validatePaymentIntentInput({
    input,
    listingCore,
    listingBookings,
  }: {
    input: CreatePaymentIntentInput;
    listingCore: Record<string, unknown>;
    listingBookings: Record<string, unknown>;
  }): {
    reservation: NormalizedReservationInput;
    payment: PaymentBreakdownValidation;
  } {
    const rules = resolveListingReservationRules({
      core: listingCore,
      bookings: listingBookings,
    });
    const normalizedReservation = normalizeReservationInput(input.reservation, rules);
    const expectedTotalAmountMinor = toMinorUnit(computeReservationTotal({
      core: listingCore,
      bookings: listingBookings,
      startISO: normalizedReservation.startISO,
      endISO: normalizedReservation.endISO,
      occupants: normalizedReservation.occupants,
    }));
    if (normalizedReservation.totalAmountMinor !== expectedTotalAmountMinor) {
      throw createBadRequestError(
        'Le tarif de ce séjour a changé. Rechargez la page pour voir le prix à jour.',
        'INVALID_RESERVATION_TOTAL',
      );
    }
    assertReservationRangeAvailable(listingBookings, normalizedReservation.startISO, normalizedReservation.endISO);

    const payment = validatePaymentBreakdownInput({
      payment: input.payment,
      reservation: normalizedReservation,
      paymentRules: rules.payment,
    });

    return {
      reservation: normalizedReservation,
      payment,
    };
  }

  private readStripeProfile(user: User): Record<string, unknown> {
    return asObject(user.stripeConnectProfile);
  }

  private readBillingSnapshot(user: User): BillingSnapshot {
    const profile = this.readStripeProfile(user);
    const billing = asObject(profile.billing);

    return {
      customerId: readString(billing.customerId),
      subscriptionId: readString(billing.subscriptionId),
      planCode: normalizePlanCode(billing.planCode),
      status: readString(billing.status),
      currentPeriodEndISO: readString(billing.currentPeriodEndISO),
      cancelAtPeriodEnd: readBoolean(billing.cancelAtPeriodEnd, false),
      updatedAtISO: readString(billing.updatedAtISO),
      pendingPlanCode: normalizePlanCode(billing.pendingPlanCode),
      pendingCheckoutSessionId: readString(billing.pendingCheckoutSessionId),
      includedListings: readNullableInteger(billing.includedListings),
      extraListings: readExtraListingsFromBilling(billing),
      planItemId: readString(billing.planItemId),
      extraListingItemId: readString(billing.extraListingItemId),
      complimentary: readBoolean(billing.complimentary, false),
      complimentaryEndsAtISO: readString(billing.complimentaryEndsAtISO),
      complimentaryGrantedByUserId: readString(billing.complimentaryGrantedByUserId),
      complimentaryGrantedAtISO: readString(billing.complimentaryGrantedAtISO),
      giftedTrialSource: readString(billing.giftedTrialSource),
      giftedTrialListingId: readString(billing.giftedTrialListingId),
      giftedTrialGrantedByUserId: readString(billing.giftedTrialGrantedByUserId),
      giftedTrialGrantedAtISO: readString(billing.giftedTrialGrantedAtISO),
      giftedTrialEndsAtISO: readString(billing.giftedTrialEndsAtISO),
      giftedTrialExpiredAtISO: readString(billing.giftedTrialExpiredAtISO),
    };
  }

  private readConnectOnboardingStatus(user: User): string {
    const profile = this.readStripeProfile(user);
    const onboardingStatus = readString(profile.onboardingStatus);
    return onboardingStatus ?? 'not_started';
  }

  private readConnectState(user: User): PublicConnectSummary {
    const profile = this.readStripeProfile(user);
    const profileAccountId = readString(profile.accountId);
    const defaultCurrency = readString(profile.defaultCurrency)?.toLowerCase() ?? 'eur';
    const transferSchedule = readString(profile.transferSchedule) ?? 'manual';

    return {
      accountId: user.stripeConnectAccountId ?? profileAccountId,
      onboardingStatus: this.readConnectOnboardingStatus(user),
      chargesEnabled: readBoolean(profile.chargesEnabled, false),
      payoutsEnabled: readBoolean(profile.payoutsEnabled, false),
      defaultCurrency,
      transferSchedule,
    };
  }

  private toConnectSummary(user: User, createdInFlow = false): ConnectSummary {
    const connect = this.readConnectState(user);
    return {
      ...connect,
      createdInFlow,
    };
  }

  private hasPublicationEligibleSubscription(status: string | null): boolean {
    if (!status) return false;
    return PUBLICATION_ALLOWED_SUBSCRIPTION_STATUSES.has(status);
  }

  private resolveListingLifecycleStatus(listing: {
    id: string;
    status: string | null;
    core: unknown;
  }): string {
    const listingCore = asObject(listing.core);
    const fromCore = readString(listingCore.status)?.toLowerCase();
    if (fromCore) return fromCore;

    const fromColumn = readString(listing.status)?.toLowerCase();
    return fromColumn ?? 'draft';
  }

  private async blockPublishedListingsForOwner(ownerId: string): Promise<void> {
    const listings = await this.prisma.listing.findMany({
      where: {
        ownerId,
        status: 'published',
      },
      select: {
        id: true,
        core: true,
      },
    });

    if (!listings.length) return;

    await this.prisma.$transaction(
      listings.map((listing) => {
        const nextCore = {
          ...asObject(listing.core),
          status: 'blocked',
        };

        return this.prisma.listing.update({
          where: { id: listing.id },
          data: {
            status: 'blocked',
            core: toPrismaJson(nextCore),
            updatedAt: new Date(),
          },
        });
      }),
    );
  }

  private async enforceAdminListingTransferTrialExpiration(user: User): Promise<User> {
    const billing = this.readBillingSnapshot(user);
    if (billing.giftedTrialSource !== ADMIN_LISTING_TRANSFER_TRIAL_SOURCE) return user;
    if (billing.status === 'active') return user;

    const trialEndsAt = this.parseIsoDate(billing.giftedTrialEndsAtISO);
    if (!trialEndsAt) return user;
    if (Date.now() < trialEndsAt.getTime()) return user;

    await this.blockPublishedListingsForOwner(user.id);

    const shouldPersistExpiration = billing.status === 'trialing' || !billing.giftedTrialExpiredAtISO;
    if (!shouldPersistExpiration) return user;

    return this.updateUserStripeState({
      user,
      billingPatch: {
        status: billing.status === 'trialing'
          ? ADMIN_LISTING_TRANSFER_TRIAL_EXPIRED_STATUS
          : billing.status ?? ADMIN_LISTING_TRANSFER_TRIAL_EXPIRED_STATUS,
        currentPeriodEndISO: billing.currentPeriodEndISO ?? billing.giftedTrialEndsAtISO ?? nowIso(),
        updatedAtISO: nowIso(),
        giftedTrialExpiredAtISO: billing.giftedTrialExpiredAtISO ?? nowIso(),
      },
    });
  }

  async ensureListingReservable(listingId: string): Promise<{ listingId: string } | null> {
    const normalizedListingId = listingId.trim();
    if (!normalizedListingId) return null;

    let listing = await this.prisma.listing.findUnique({
      where: { id: normalizedListingId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        core: true,
      },
    });

    if (!listing) return null;

    if (listing.ownerId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: listing.ownerId },
      });
      if (owner) {
        await this.enforceAdminListingTransferTrialExpiration(owner);
      }

      listing = await this.prisma.listing.findUnique({
        where: { id: normalizedListingId },
        select: {
          id: true,
          ownerId: true,
          status: true,
          core: true,
        },
      });

      if (!listing) return null;
    }

    const status = this.resolveListingLifecycleStatus(listing);
    if (status !== 'published') {
      throw createForbiddenRequestError(
        'Cette annonce n accepte pas de nouvelles reservations.',
        'LISTING_NOT_BOOKABLE',
      );
    }

    return { listingId: listing.id };
  }

  private toPublicationReadiness(
    user: User,
    options?: { allowAdmin?: boolean },
  ): PublicationReadiness {
    // Le super admin configure et publie à la place d'un client : aucune condition de facturation.
    if (options?.allowAdmin) {
      return {
        canPublish: true,
        hasActiveSubscription: true,
        hasConnectAccount: true,
        connectOnboardingCompleted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        missingRequirements: [],
      };
    }

    const billing = this.readBillingSnapshot(user);
    const connect = this.readConnectState(user);
    const hasActiveSubscription = this.hasPublicationEligibleSubscription(billing.status);
    const hasConnectAccount = Boolean(connect.accountId);
    const connectOnboardingCompleted = connect.onboardingStatus === 'completed';
    const chargesEnabled = connect.chargesEnabled;
    const payoutsEnabled = connect.payoutsEnabled;

    const missingRequirements: string[] = [];
    if (!hasActiveSubscription) missingRequirements.push('active_subscription');
    if (!hasConnectAccount) missingRequirements.push('stripe_connect_account');
    if (!connectOnboardingCompleted) missingRequirements.push('stripe_connect_onboarding');
    if (!chargesEnabled) missingRequirements.push('stripe_connect_charges_enabled');
    if (!payoutsEnabled) missingRequirements.push('stripe_connect_payouts_enabled');

    return {
      canPublish: missingRequirements.length === 0,
      hasActiveSubscription,
      hasConnectAccount,
      connectOnboardingCompleted,
      chargesEnabled,
      payoutsEnabled,
      missingRequirements,
    };
  }

  private toPublicBillingSnapshot(billing: BillingSnapshot | null): PublicBillingSnapshot | null {
    if (!billing) return null;

    return {
      subscriptionId: billing.subscriptionId,
      planCode: billing.planCode,
      status: billing.status,
      currentPeriodEndISO: billing.currentPeriodEndISO,
      cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
      updatedAtISO: billing.updatedAtISO,
      pendingPlanCode: billing.pendingPlanCode,
      pendingCheckoutSessionId: billing.pendingCheckoutSessionId,
      includedListings: billing.includedListings,
      extraListings: billing.extraListings,
      complimentary: billing.complimentary,
      complimentaryEndsAtISO: billing.complimentaryEndsAtISO,
    };
  }

  /** Un plan offert avec date de fin expire comme un abonnement : annonces gelées, statut résilié. */
  private async enforceComplimentaryPlanExpiration(user: User): Promise<User> {
    const billing = this.readBillingSnapshot(user);
    if (!billing.complimentary) return user;

    const endsAt = this.parseIsoDate(billing.complimentaryEndsAtISO);
    if (!endsAt || Date.now() < endsAt.getTime()) return user;

    await this.blockPublishedListingsForOwner(user.id);

    return this.updateUserStripeState({
      user,
      billingPatch: {
        status: 'canceled',
        complimentary: false,
        currentPeriodEndISO: billing.complimentaryEndsAtISO,
        updatedAtISO: nowIso(),
      },
    });
  }

  private async countActiveListingsForOwner(ownerId: string): Promise<number> {
    return this.prisma.listing.count({
      where: {
        ownerId,
        kind: 'listing',
        status: { in: [...LISTING_LIMIT_COUNTED_STATUSES] },
      },
    });
  }

  private async computeListingAllowance(
    user: User,
    plans: SubscriptionPlan[],
    options?: { allowAdmin?: boolean },
  ): Promise<ListingAllowance> {
    const activeListings = await this.countActiveListingsForOwner(user.id);
    const billing = this.readBillingSnapshot(user);

    if (options?.allowAdmin) {
      return {
        includedListings: 0,
        extraListings: 0,
        maxActiveListings: null,
        activeListings,
        remaining: null,
      };
    }

    const currentPlan = plans.find((plan) => plan.code === billing.planCode) ?? null;
    const hasEligibleSubscription = this.hasPublicationEligibleSubscription(billing.status);
    const includedListings = hasEligibleSubscription
      ? (billing.includedListings ?? currentPlan?.maxActiveListings ?? 0)
      : 0;
    const extraListings = hasEligibleSubscription ? billing.extraListings : 0;
    const maxActiveListings = includedListings + extraListings;

    return {
      includedListings,
      extraListings,
      maxActiveListings,
      activeListings,
      remaining: Math.max(0, maxActiveListings - activeListings),
    };
  }

  private async updateUserStripeState({
    user,
    stripeConnectAccountId,
    connectPatch,
    billingPatch,
  }: {
    user: User;
    stripeConnectAccountId?: string | null;
    connectPatch?: Record<string, unknown>;
    billingPatch?: Partial<BillingSnapshot>;
  }): Promise<User> {
    const currentProfile = this.readStripeProfile(user);
    const currentBilling = asObject(currentProfile.billing);

    const nextBilling = applyDefinedPatch(currentBilling, {
      customerId: billingPatch?.customerId,
      subscriptionId: billingPatch?.subscriptionId,
      planCode: billingPatch?.planCode,
      status: billingPatch?.status,
      currentPeriodEndISO: billingPatch?.currentPeriodEndISO,
      cancelAtPeriodEnd: billingPatch?.cancelAtPeriodEnd,
      updatedAtISO: billingPatch?.updatedAtISO,
      pendingPlanCode: billingPatch?.pendingPlanCode,
      pendingCheckoutSessionId: billingPatch?.pendingCheckoutSessionId,
      includedListings: billingPatch?.includedListings,
      extraListings: billingPatch?.extraListings,
      planItemId: billingPatch?.planItemId,
      extraListingItemId: billingPatch?.extraListingItemId,
      complimentary: billingPatch?.complimentary,
      complimentaryEndsAtISO: billingPatch?.complimentaryEndsAtISO,
      complimentaryGrantedByUserId: billingPatch?.complimentaryGrantedByUserId,
      complimentaryGrantedAtISO: billingPatch?.complimentaryGrantedAtISO,
      giftedTrialSource: billingPatch?.giftedTrialSource,
      giftedTrialListingId: billingPatch?.giftedTrialListingId,
      giftedTrialGrantedByUserId: billingPatch?.giftedTrialGrantedByUserId,
      giftedTrialGrantedAtISO: billingPatch?.giftedTrialGrantedAtISO,
      giftedTrialEndsAtISO: billingPatch?.giftedTrialEndsAtISO,
      giftedTrialExpiredAtISO: billingPatch?.giftedTrialExpiredAtISO,
    });

    const nextProfile = applyDefinedPatch(currentProfile, connectPatch);
    nextProfile.billing = nextBilling;

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        stripeConnectAccountId: stripeConnectAccountId === undefined ? user.stripeConnectAccountId : stripeConnectAccountId,
        stripeConnectProfile: toPrismaJson(nextProfile),
      },
    });

    return updated;
  }

  /**
   * Ce qu'IndieHost sait déjà de l'hôte, transmis à Stripe pour raccourcir l'inscription :
   * Stripe ne repose pas une question pré-remplie, il la fait seulement confirmer.
   */
  private async buildConnectAccountPrefill(
    user: User,
    hostStatus?: 'individual' | 'professional',
  ): Promise<ConnectAccountPrefill> {
    const email = readString(user.email);
    const firstName = readString(user.firstName);
    const lastName = readString(user.lastName);
    const siteUrl = await this.resolveHostPublicSiteUrl(user.id);

    const prefill: ConnectAccountPrefill = {
      business_profile: {
        mcc: STRIPE_CONNECT_LODGING_MCC,
        product_description: STRIPE_CONNECT_PRODUCT_DESCRIPTION,
        ...(siteUrl ? { url: siteUrl } : {}),
      },
      ...(email ? { email } : {}),
    };

    // Particulier (comme sur Airbnb) : parcours de personne physique. Un professionnel garde le
    // choix de Stripe (entreprise individuelle, société…), qu'IndieHost ne connaît pas.
    if (hostStatus !== 'professional') {
      prefill.business_type = 'individual';
      prefill.individual = {
        ...(email ? { email } : {}),
        ...(firstName ? { first_name: firstName } : {}),
        ...(lastName ? { last_name: lastName } : {}),
      };
    }

    return prefill;
  }

  /** Adresse publique d'une annonce de l'hôte (site de l'activité demandé par Stripe), si elle existe. */
  private async resolveHostPublicSiteUrl(userId: string): Promise<string | null> {
    const rootDomain = readString(env.PUBLIC_LISTING_ROOT_DOMAIN);
    if (!rootDomain || rootDomain === 'localhost' || rootDomain.endsWith('.localhost')) return null;

    const listing = await this.prisma.listing.findFirst({
      where: { ownerId: userId, status: { not: 'deleted' } },
      orderBy: { updatedAt: 'desc' },
      select: { subdomainSlug: true, customDomain: true, customDomainVerifiedAt: true },
    });
    if (!listing) return null;
    if (listing.customDomain && listing.customDomainVerifiedAt) return `https://${listing.customDomain}`;
    if (listing.subdomainSlug) return `https://${listing.subdomainSlug}.${rootDomain}`;
    return null;
  }

  private async ensureStripeConnectAccount(
    user: User,
    options?: { country?: string; forcedAccountId?: string | null; prefill?: ConnectAccountPrefill },
  ): Promise<{ user: User; accountId: string; created: boolean }> {
    const forced = readString(options?.forcedAccountId ?? null);
    const currentAccountId = forced ?? user.stripeConnectAccountId ?? null;

    if (currentAccountId) {
      if (currentAccountId !== user.stripeConnectAccountId) {
        const next = await this.updateUserStripeState({
          user,
          stripeConnectAccountId: currentAccountId,
          connectPatch: {
            accountId: currentAccountId,
            onboardingStatus: this.readConnectOnboardingStatus(user),
          },
        });

        return {
          user: next,
          accountId: currentAccountId,
          created: false,
        };
      }

      return {
        user,
        accountId: currentAccountId,
        created: false,
      };
    }

    if (!this.stripe) {
      const accountId = generateMockId('acct_mock_');
      const next = await this.updateUserStripeState({
        user,
        stripeConnectAccountId: accountId,
        connectPatch: {
          accountId,
          onboardingStatus: 'pending',
          chargesEnabled: false,
          payoutsEnabled: false,
          defaultCurrency: 'eur',
          transferSchedule: 'manual',
        },
      });

      return {
        user: next,
        accountId,
        created: true,
      };
    }

    // Modèle « logiciel » validé dans le profil plateforme Stripe (Connect) : l'hôte encaisse
    // lui-même (paiements directs), paie ses frais Stripe, a le Dashboard Stripe complet, et
    // Stripe porte le risque des soldes négatifs. Plus de comptes `express`, qui exigeaient
    // qu'IndieHost se porte responsable des pertes.
    const account = await this.stripe.accounts.create({
      controller: {
        fees: { payer: 'account' },
        losses: { payments: 'stripe' },
        requirement_collection: 'stripe',
        stripe_dashboard: { type: 'full' },
      },
      country: (options?.country ?? 'FR').toUpperCase(),
      default_currency: 'eur',
      ...(options?.prefill ?? {}),
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      metadata: {
        userId: user.id,
        clerkUserId: user.clerkUserId ?? '',
      },
    });

    const next = await this.updateUserStripeState({
      user,
      stripeConnectAccountId: account.id,
      connectPatch: {
        accountId: account.id,
        onboardingStatus: 'pending',
        chargesEnabled: false,
        payoutsEnabled: false,
        defaultCurrency: (account.default_currency ?? 'eur').toLowerCase(),
        transferSchedule: 'manual',
      },
    });

    return {
      user: next,
      accountId: account.id,
      created: true,
    };
  }

  private async ensureStripeCustomer(user: User): Promise<{ user: User; customerId: string }> {
    const billing = this.readBillingSnapshot(user);
    if (billing.customerId) {
      return {
        user,
        customerId: billing.customerId,
      };
    }

    if (!this.stripe) {
      const customerId = generateMockId('cus_mock_');
      const next = await this.updateUserStripeState({
        user,
        billingPatch: {
          customerId,
          updatedAtISO: nowIso(),
        },
      });

      return {
        user: next,
        customerId,
      };
    }

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const customer = await this.stripe.customers.create({
      email: user.email ?? undefined,
      name: fullName || user.displayName || undefined,
      metadata: {
        userId: user.id,
        clerkUserId: user.clerkUserId ?? '',
      },
    });

    const next = await this.updateUserStripeState({
      user,
      billingPatch: {
        customerId: customer.id,
        updatedAtISO: nowIso(),
      },
    });

    return {
      user: next,
      customerId: customer.id,
    };
  }

  private resolvePlanByPriceId(plans: SubscriptionPlan[], priceId: string | null): SubscriptionPlanCode | null {
    if (!priceId) return null;
    const match = plans.find((plan) => plan.stripePriceId === priceId);
    return match?.code ?? null;
  }

  private buildSubscriptionCheckoutMetadata(user: User, planCode: SubscriptionPlanCode): Record<string, string> {
    return {
      userId: user.id,
      clerkUserId: user.clerkUserId ?? '',
      planCode,
    };
  }

  private buildSubscriptionCheckoutData(
    planCode: SubscriptionPlanCode,
    metadata: Record<string, string>,
  ): Stripe.Checkout.SessionCreateParams.SubscriptionData {
    if (!isTrialEligiblePlanCode(planCode)) {
      return { metadata };
    }

    return {
      metadata,
      trial_period_days: SUBSCRIPTION_TRIAL_PERIOD_DAYS,
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel',
        },
      },
    };
  }

  private parseIsoDate(value: string | null | undefined): Date | null {
    const raw = readString(value);
    if (!raw) return null;

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private deriveMockTrialStartDate(billing: BillingSnapshot): Date | null {
    const currentPeriodEnd = this.parseIsoDate(billing.currentPeriodEndISO);
    if (currentPeriodEnd) {
      return new Date(currentPeriodEnd.getTime() - (SUBSCRIPTION_TRIAL_PERIOD_DAYS * DAY_MS));
    }

    return this.parseIsoDate(billing.updatedAtISO);
  }

  private isExtraListingPrice(price: Stripe.Price | null | undefined): boolean {
    if (!price) return false;
    if (normalizeAddonCode(price.metadata?.indiehost_plan_code) === 'extra_listing') return true;
    const product = price.product;
    if (product && typeof product === 'object' && !('deleted' in product && product.deleted)) {
      return normalizeAddonCode((product as Stripe.Product).metadata?.indiehost_plan_code) === 'extra_listing';
    }
    return false;
  }

  // L'abonnement porte deux items au plus : le plan et l'add-on « logement supplémentaire ».
  private findPlanSubscriptionItem(subscription: Stripe.Subscription, plans: SubscriptionPlan[]): Stripe.SubscriptionItem | null {
    const items = subscription.items.data;
    const byPlanPrice = items.find((item) => this.resolvePlanByPriceId(plans, item.price?.id ?? null));
    if (byPlanPrice) return byPlanPrice;
    return items.find((item) => !this.isExtraListingPrice(item.price)) ?? null;
  }

  private findExtraListingSubscriptionItem(
    subscription: Stripe.Subscription,
    plans: SubscriptionPlan[],
    extraListingPriceId: string | null,
  ): Stripe.SubscriptionItem | null {
    const items = subscription.items.data;
    const byKnownPrice = extraListingPriceId ? items.find((item) => item.price?.id === extraListingPriceId) : null;
    if (byKnownPrice) return byKnownPrice;
    return items.find((item) => this.isExtraListingPrice(item.price)
      || (!this.resolvePlanByPriceId(plans, item.price?.id ?? null) && items.length > 1 && item.id !== this.findPlanSubscriptionItem(subscription, plans)?.id)) ?? null;
  }

  private serializeStripeSubscription(
    subscription: Stripe.Subscription,
    plans: SubscriptionPlan[],
    fallbackPlanCode?: SubscriptionPlanCode | null,
    extraListingPriceId: string | null = null,
  ): BillingSnapshot {
    const planItem = this.findPlanSubscriptionItem(subscription, plans);
    const priceId = planItem?.price?.id ?? null;
    const planCode = this.resolvePlanByPriceId(plans, priceId) ?? fallbackPlanCode ?? null;
    const currentPlan = plans.find((plan) => plan.code === planCode) ?? null;
    const extraItem = this.findExtraListingSubscriptionItem(subscription, plans, extraListingPriceId);

    return {
      customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null,
      subscriptionId: subscription.id,
      planCode,
      status: subscription.status,
      currentPeriodEndISO: toIsoFromUnixSeconds(subscription.current_period_end),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      updatedAtISO: nowIso(),
      pendingPlanCode: null,
      pendingCheckoutSessionId: null,
      includedListings: currentPlan?.maxActiveListings ?? null,
      extraListings: extraItem ? Math.max(0, Math.trunc(extraItem.quantity ?? 0)) : 0,
      planItemId: planItem?.id ?? null,
      extraListingItemId: extraItem?.id ?? null,
      // Un abonnement Stripe réel remplace un éventuel plan offert.
      complimentary: false,
      complimentaryEndsAtISO: null,
      complimentaryGrantedByUserId: null,
      complimentaryGrantedAtISO: null,
    };
  }

  private async getCurrentStripeSubscription({
    customerId,
    subscriptionId,
  }: {
    customerId: string;
    subscriptionId: string | null;
  }): Promise<Stripe.Subscription | null> {
    if (!this.stripe) return null;

    if (subscriptionId) {
      try {
        const fromId = await this.stripe.subscriptions.retrieve(subscriptionId);
        if (isSubscriptionOngoing(fromId.status)) {
          return fromId;
        }
      } catch {
        // ignored: fallback to listing by customer
      }
    }

    const listed = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 20,
    });

    const latestOngoing = listed.data.find((item) => isSubscriptionOngoing(item.status));
    return latestOngoing ?? null;
  }

  private buildMockPlanCatalog(): SubscriptionPlan[] {
    return PLAN_CODES.map((code): SubscriptionPlan => {
      const template = PLAN_TEMPLATES[code];
      return {
        code,
        name: template.name,
        description: template.description,
        maxActiveListings: template.maxActiveListings,
        currency: template.defaultCurrency,
        monthlyPriceMinor: template.defaultMonthlyPriceMinor,
        billingInterval: 'month',
        stripePriceId: null,
        available: true,
        unavailableReason: null,
      };
    });
  }

  // Résolution stricte : métadonnée `indiehost_plan_code` (prix puis produit) ou nom exactement égal au plan.
  // Pas de correspondance par préfixe : « SuperHost - Annuel » ne doit jamais passer pour le plan SuperHost.
  private resolvePlanCodeFromStripeCatalogEntry(price: Stripe.Price, product: Stripe.Product): SubscriptionPlanCode | null {
    const priceCode = readString(price.metadata?.indiehost_plan_code ?? price.metadata?.plan_code);
    if (priceCode) return normalizePlanCode(priceCode);

    const productCode = readString(product.metadata?.indiehost_plan_code ?? product.metadata?.plan_code);
    if (productCode) return normalizePlanCode(productCode);

    const normalizedProductName = product.name.trim().toLowerCase();
    for (const code of PLAN_CODES) {
      if (PLAN_TEMPLATES[code].name.trim().toLowerCase() === normalizedProductName) return code;
    }

    return null;
  }

  private resolveAddonCodeFromStripeCatalogEntry(price: Stripe.Price, product: Stripe.Product): 'extra_listing' | null {
    return normalizeAddonCode(price.metadata?.indiehost_plan_code)
      ?? normalizeAddonCode(product.metadata?.indiehost_plan_code)
      ?? (product.name.trim().toLowerCase() === EXTRA_LISTING_TEMPLATE.name.toLowerCase() ? 'extra_listing' : null);
  }

  private buildMockExtraListingOffer(): ExtraListingOffer {
    return {
      code: 'extra_listing',
      name: EXTRA_LISTING_TEMPLATE.name,
      description: EXTRA_LISTING_TEMPLATE.description,
      currency: EXTRA_LISTING_TEMPLATE.defaultCurrency,
      monthlyPriceMinor: EXTRA_LISTING_TEMPLATE.defaultMonthlyPriceMinor,
      billingInterval: 'month',
      stripePriceId: null,
      available: true,
      unavailableReason: null,
    };
  }

  private buildExtraListingOffer(candidates: StripePlanCandidate[]): ExtraListingOffer {
    const candidate = this.selectBestStripePlanCandidate(candidates);
    if (!candidate) {
      return {
        ...this.buildMockExtraListingOffer(),
        available: false,
        unavailableReason: `Aucun produit/prix Stripe mensuel trouvé pour ${EXTRA_LISTING_TEMPLATE.name}.`,
      };
    }

    const unitAmount = typeof candidate.price.unit_amount === 'number' && Number.isFinite(candidate.price.unit_amount)
      ? Math.max(0, Math.trunc(candidate.price.unit_amount))
      : EXTRA_LISTING_TEMPLATE.defaultMonthlyPriceMinor;

    return {
      code: 'extra_listing',
      name: readString(candidate.product.name) ?? EXTRA_LISTING_TEMPLATE.name,
      description: readString(candidate.product.description) ?? EXTRA_LISTING_TEMPLATE.description,
      currency: (candidate.price.currency || EXTRA_LISTING_TEMPLATE.defaultCurrency).toLowerCase(),
      monthlyPriceMinor: unitAmount,
      billingInterval: candidate.price.recurring?.interval ?? 'month',
      stripePriceId: candidate.price.id,
      available: true,
      unavailableReason: null,
    };
  }

  private readMaxActiveListingsFromStripeProduct(product: Stripe.Product, fallback: number): number {
    const metadataValues = [
      product.metadata?.indiehost_max_active_listings,
      product.metadata?.max_active_listings,
    ];

    for (const value of metadataValues) {
      const parsed = Number.parseInt(String(value ?? ''), 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    return fallback;
  }

  private async resolveStripeProductFromPrice(
    price: Stripe.Price,
    cache: Map<string, Stripe.Product>,
  ): Promise<Stripe.Product | null> {
    if (!this.stripe) return null;

    const rawProduct = price.product;
    if (typeof rawProduct !== 'string') {
      if ('deleted' in rawProduct && rawProduct.deleted) return null;
      cache.set(rawProduct.id, rawProduct);
      return rawProduct;
    }

    const cached = cache.get(rawProduct);
    if (cached) return cached;

    try {
      const resolved = await this.stripe.products.retrieve(rawProduct);
      if ('deleted' in resolved && resolved.deleted) return null;
      cache.set(resolved.id, resolved);
      return resolved;
    } catch {
      return null;
    }
  }

  private selectBestStripePlanCandidate(candidates: StripePlanCandidate[]): StripePlanCandidate | null {
    if (!candidates.length) return null;

    const ranked = [...candidates].sort((left, right) => {
      const leftAvailabilityScore = (left.price.active ? 2 : 0) + (left.product.active ? 1 : 0);
      const rightAvailabilityScore = (right.price.active ? 2 : 0) + (right.product.active ? 1 : 0);
      if (leftAvailabilityScore !== rightAvailabilityScore) {
        return rightAvailabilityScore - leftAvailabilityScore;
      }

      return (right.price.created ?? 0) - (left.price.created ?? 0);
    });

    return ranked[0] ?? null;
  }

  private async resolveCatalog(): Promise<SubscriptionCatalog> {
    const mode = this.getSubscriptionExecutionMode();
    if (mode === 'mock' || !this.stripe) {
      return { plans: this.buildMockPlanCatalog(), extraListing: this.buildMockExtraListingOffer() };
    }

    const candidatesByPlanCode: Record<SubscriptionPlanCode, StripePlanCandidate[]> = {
      indiehost: [],
      superhost: [],
    };
    const extraListingCandidates: StripePlanCandidate[] = [];
    const productCache = new Map<string, Stripe.Product>();
    let startingAfter: string | null = null;

    try {
      while (true) {
        const listParams: Stripe.PriceListParams = {
          type: 'recurring',
          limit: 100,
          expand: ['data.product'],
        };
        if (startingAfter) {
          listParams.starting_after = startingAfter;
        }

        const page = await this.stripe.prices.list(listParams);

        for (const price of page.data) {
          if (price.recurring?.interval !== 'month') continue;
          if ((price.recurring?.interval_count ?? 1) !== 1) continue;

          const product = await this.resolveStripeProductFromPrice(price, productCache);
          if (!product) continue;
          // Les produits/prix archivés (anciennes offres, annuels retirés) ne sont jamais candidats.
          if (!product.active || !price.active) continue;

          if (this.resolveAddonCodeFromStripeCatalogEntry(price, product) === 'extra_listing') {
            extraListingCandidates.push({ product, price });
            continue;
          }

          const planCode = this.resolvePlanCodeFromStripeCatalogEntry(price, product);
          if (!planCode) continue;

          candidatesByPlanCode[planCode].push({ product, price });
        }

        if (!page.has_more || page.data.length === 0) break;

        startingAfter = page.data[page.data.length - 1]?.id ?? null;
        if (!startingAfter) break;
      }
    } catch {
      const unavailablePlans = PLAN_CODES.map((code): SubscriptionPlan => {
        const template = PLAN_TEMPLATES[code];
        return {
          code,
          name: template.name,
          description: template.description,
          maxActiveListings: template.maxActiveListings,
          currency: template.defaultCurrency,
          monthlyPriceMinor: template.defaultMonthlyPriceMinor,
          billingInterval: 'month',
          stripePriceId: null,
          available: false,
          unavailableReason: `Impossible de récupérer le catalogue Stripe pour ${template.name}.`,
        };
      });
      return { plans: unavailablePlans, extraListing: null };
    }

    const plans = PLAN_CODES.map((code): SubscriptionPlan => {
      const template = PLAN_TEMPLATES[code];
      const candidate = this.selectBestStripePlanCandidate(candidatesByPlanCode[code]);
      if (!candidate) {
        return {
          code,
          name: template.name,
          description: template.description,
          maxActiveListings: template.maxActiveListings,
          currency: template.defaultCurrency,
          monthlyPriceMinor: template.defaultMonthlyPriceMinor,
          billingInterval: 'month',
          stripePriceId: null,
          available: false,
          unavailableReason: `Aucun produit/prix Stripe mensuel trouvé pour ${template.name}.`,
        };
      }

      const unitAmount = typeof candidate.price.unit_amount === 'number' && Number.isFinite(candidate.price.unit_amount)
        ? Math.max(0, Math.trunc(candidate.price.unit_amount))
        : template.defaultMonthlyPriceMinor;
      const planName = readString(candidate.product.name) ?? template.name;
      const planDescription = readString(candidate.product.description) ?? template.description;
      const planMaxActiveListings = this.readMaxActiveListingsFromStripeProduct(candidate.product, template.maxActiveListings);
      const available = Boolean(candidate.price.active && candidate.product.active);

      return {
        code,
        name: planName,
        description: planDescription,
        maxActiveListings: planMaxActiveListings,
        currency: (candidate.price.currency || template.defaultCurrency).toLowerCase(),
        monthlyPriceMinor: unitAmount,
        billingInterval: candidate.price.recurring?.interval ?? 'month',
        stripePriceId: candidate.price.id,
        available,
        unavailableReason: available ? null : `Le produit/prix Stripe du plan ${planName} est inactif.`,
      };
    });

    return { plans, extraListing: this.buildExtraListingOffer(extraListingCandidates) };
  }

  private async resolvePlanCatalog(): Promise<SubscriptionPlan[]> {
    return (await this.resolveCatalog()).plans;
  }

  async getSubscriptionCatalog(): Promise<SubscriptionCatalog> {
    return this.resolveCatalog();
  }

  /**
   * Plan offert par l'admin (ex. un proche, un partenaire) : le compte est actif sans abonnement
   * Stripe, avec les logements du plan + supplémentaires, sans limite de durée ou jusqu'à une date.
   */
  async grantComplimentaryPlanForUserAsAdmin(
    auth: RequestAuth | null,
    targetUserId: string,
    input: ComplimentaryPlanInput,
  ): Promise<ComplimentaryPlanResult | 'forbidden' | null> {
    if (!hasAdminAccess(auth)) return 'forbidden';

    const admin = await upsertUserFromAuth(this.prisma, auth);
    let user = await resolveUserByIdentifier(this.prisma, targetUserId);
    if (!user) return null;

    const catalog = await this.resolveCatalog();
    const plan = catalog.plans.find((candidate) => candidate.code === input.planCode) ?? null;
    if (!plan) {
      return {
        state: 'plan_unavailable',
        subscriptionState: await this.buildSubscriptionStateForUser(user, { allowAdmin: false, sync: false }),
        message: 'Plan inconnu.',
      };
    }

    const billing = this.readBillingSnapshot(user);
    if (!billing.complimentary && billing.subscriptionId && isSubscriptionOngoing(billing.status)) {
      return {
        state: 'subscription_exists',
        subscriptionState: await this.buildSubscriptionStateForUser(user, { allowAdmin: false, sync: false }),
        message: 'Ce client a déjà un abonnement Stripe en cours : résiliez-le avant d’offrir un plan.',
      };
    }

    const endsAtISO = this.parseIsoDate(input.endsAtISO)?.toISOString() ?? null;
    user = await this.updateUserStripeState({
      user,
      billingPatch: {
        subscriptionId: null,
        planCode: plan.code,
        status: 'active',
        currentPeriodEndISO: endsAtISO,
        cancelAtPeriodEnd: false,
        updatedAtISO: nowIso(),
        pendingPlanCode: null,
        pendingCheckoutSessionId: null,
        includedListings: plan.maxActiveListings,
        extraListings: Math.max(0, Math.min(EXTRA_LISTINGS_MAX, Math.trunc(input.extraListings))),
        planItemId: null,
        extraListingItemId: null,
        complimentary: true,
        complimentaryEndsAtISO: endsAtISO,
        complimentaryGrantedByUserId: admin?.id ?? null,
        complimentaryGrantedAtISO: nowIso(),
      },
    });

    return {
      state: 'granted',
      subscriptionState: await this.buildSubscriptionStateForUser(user, { allowAdmin: false, sync: false }),
      message: null,
    };
  }

  async revokeComplimentaryPlanForUserAsAdmin(
    auth: RequestAuth | null,
    targetUserId: string,
  ): Promise<ComplimentaryPlanResult | 'forbidden' | null> {
    if (!hasAdminAccess(auth)) return 'forbidden';

    let user = await resolveUserByIdentifier(this.prisma, targetUserId);
    if (!user) return null;

    const billing = this.readBillingSnapshot(user);
    if (billing.complimentary) {
      await this.blockPublishedListingsForOwner(user.id);
      user = await this.updateUserStripeState({
        user,
        billingPatch: {
          planCode: null,
          status: 'canceled',
          currentPeriodEndISO: nowIso(),
          updatedAtISO: nowIso(),
          includedListings: null,
          extraListings: 0,
          complimentary: false,
          complimentaryEndsAtISO: null,
        },
      });
    }

    return {
      state: 'revoked',
      subscriptionState: await this.buildSubscriptionStateForUser(user, { allowAdmin: false, sync: false }),
      message: null,
    };
  }

  /**
   * Lien de paiement Stripe (Checkout, mode abonnement) généré par l'admin pour un client :
   * plan + logements supplémentaires éventuels, essai gratuit identique au parcours self-service.
   * Le lien expire après 24 h ; une fois payé, le client voit son plan dès sa prochaine connexion
   * (synchronisation par client Stripe, pas besoin de webhook).
   */
  async createSubscriptionLinkForUserAsAdmin(
    auth: RequestAuth | null,
    input: AdminSubscriptionLinkInput,
  ): Promise<AdminSubscriptionLinkResult | 'forbidden' | null> {
    if (!hasAdminAccess(auth)) return 'forbidden';

    let user = await resolveUserByIdentifier(this.prisma, input.userId);
    if (!user) return null;

    const mode = this.getSubscriptionExecutionMode();
    const catalog = await this.resolveCatalog();
    const plan = catalog.plans.find((candidate) => candidate.code === input.planCode) ?? null;

    if (!plan || !plan.available) {
      return {
        state: 'plan_unavailable',
        mode,
        plan,
        url: null,
        sessionId: null,
        expiresAtISO: null,
        message: plan?.unavailableReason ?? 'Plan indisponible.',
      };
    }

    const extraQuantity = Math.max(0, Math.min(EXTRA_LISTINGS_MAX, Math.trunc(input.extraListings)));

    if (mode === 'mock' || !this.stripe || !plan.stripePriceId) {
      const sessionId = generateMockId('cs_mock_');
      await this.updateUserStripeState({
        user,
        billingPatch: { pendingPlanCode: plan.code, pendingCheckoutSessionId: sessionId, updatedAtISO: nowIso() },
      });
      return {
        state: 'created',
        mode: 'mock',
        plan,
        url: addQueryParam(input.successUrl, 'session_id', sessionId),
        sessionId,
        expiresAtISO: null,
        message: 'Mode simulation : ce lien confirme le plan sans paiement réel.',
      };
    }

    const ensuredCustomer = await this.ensureStripeCustomer(user);
    user = ensuredCustomer.user;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: plan.stripePriceId, quantity: 1 }];
    if (extraQuantity > 0 && catalog.extraListing?.available && catalog.extraListing.stripePriceId) {
      lineItems.push({ price: catalog.extraListing.stripePriceId, quantity: extraQuantity });
    }

    const checkoutMetadata = {
      ...this.buildSubscriptionCheckoutMetadata(user, plan.code),
      createdByAdmin: 'true',
      extraListings: String(extraQuantity),
    };

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: ensuredCustomer.customerId,
      client_reference_id: user.id,
      success_url: addRawQueryParam(input.successUrl, 'session_id', '{CHECKOUT_SESSION_ID}'),
      cancel_url: input.cancelUrl,
      line_items: lineItems,
      allow_promotion_codes: true,
      metadata: checkoutMetadata,
      subscription_data: this.buildSubscriptionCheckoutData(plan.code, checkoutMetadata),
    });

    if (!session.url) {
      throw new Error('Stripe checkout session URL is missing.');
    }

    await this.updateUserStripeState({
      user,
      billingPatch: {
        pendingPlanCode: plan.code,
        pendingCheckoutSessionId: session.id,
        updatedAtISO: nowIso(),
      },
    });

    return {
      state: 'created',
      mode,
      plan,
      url: session.url,
      sessionId: session.id,
      expiresAtISO: toIsoFromUnixSeconds(session.expires_at),
      message: null,
    };
  }

  async listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return this.resolvePlanCatalog();
  }

  /**
   * Ajuste la quantité de « logements supplémentaires » sur l'abonnement courant
   * (item add-on créé, mis à jour ou retiré, prorata immédiat côté Stripe).
   */
  async updateExtraListings(input: UpdateExtraListingsInput, auth: RequestAuth | null): Promise<UpdateExtraListingsResult | null> {
    const user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;
    return this.updateExtraListingsForUser(user, input.quantity, { allowAdmin: hasAdminAccess(auth) });
  }

  async updateExtraListingsForUserAsAdmin(
    auth: RequestAuth | null,
    targetUserId: string,
    quantity: number,
  ): Promise<UpdateExtraListingsResult | 'forbidden' | null> {
    if (!hasAdminAccess(auth)) return 'forbidden';
    const user = await resolveUserByIdentifier(this.prisma, targetUserId);
    if (!user) return null;
    // Le client reste soumis à ses propres limites : l'admin ajuste la quantité, pas les règles.
    return this.updateExtraListingsForUser(user, quantity, { allowAdmin: false });
  }

  private async updateExtraListingsForUser(
    initialUser: User,
    quantityInput: number,
    options: { allowAdmin: boolean },
  ): Promise<UpdateExtraListingsResult> {
    const allowAdmin = options.allowAdmin;
    let user = await this.enforceAdminListingTransferTrialExpiration(initialUser);
    user = await this.enforceComplimentaryPlanExpiration(user);

    const mode = this.getSubscriptionExecutionMode();
    const catalog = await this.resolveCatalog();
    const quantity = Math.max(0, Math.min(EXTRA_LISTINGS_MAX, Math.trunc(quantityInput)));
    const billing = this.readBillingSnapshot(user);

    const respond = async (
      state: UpdateExtraListingsResult['state'],
      current: User,
      message: string | null,
    ): Promise<UpdateExtraListingsResult> => ({
      state,
      mode,
      subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(current)),
      listingAllowance: await this.computeListingAllowance(current, catalog.plans, { allowAdmin }),
      message,
    });

    if (!this.hasPublicationEligibleSubscription(billing.status) || !billing.planCode) {
      return respond('subscription_required', user, 'Activez d’abord un plan IndieHost ou SuperHost pour ajouter des logements supplémentaires.');
    }

    // On ne peut pas retirer un logement supplémentaire encore occupé par une annonce en ligne.
    const activeListings = await this.countActiveListingsForOwner(user.id);
    const includedListings = billing.includedListings ?? catalog.plans.find((plan) => plan.code === billing.planCode)?.maxActiveListings ?? 0;
    if (quantity < billing.extraListings && activeListings > includedListings + quantity) {
      return respond(
        'quantity_in_use',
        user,
        `Vous avez ${activeListings} logements en ligne : mettez-en en brouillon avant de réduire à ${includedListings + quantity} logements.`,
      );
    }

    // Plan offert ou mode simulation : pas d'item Stripe, la quantité est portée par le profil.
    if (billing.complimentary || mode === 'mock' || !this.stripe) {
      const next = await this.updateUserStripeState({
        user,
        billingPatch: { extraListings: quantity, updatedAtISO: nowIso() },
      });
      return respond('updated', next, null);
    }

    const offer = catalog.extraListing;
    if (!offer?.available || !offer.stripePriceId) {
      return respond('offer_unavailable', user, offer?.unavailableReason ?? 'L’option « logement supplémentaire » est indisponible pour le moment.');
    }

    if (!billing.customerId) {
      return respond('subscription_required', user, 'Aucun client Stripe n’est associé à votre compte.');
    }

    const liveSubscription = await this.getCurrentStripeSubscription({
      customerId: billing.customerId,
      subscriptionId: billing.subscriptionId,
    });
    if (!liveSubscription) {
      return respond('subscription_required', user, 'Aucun abonnement actif n’a été trouvé sur votre compte Stripe.');
    }

    const extraItem = this.findExtraListingSubscriptionItem(liveSubscription, catalog.plans, offer.stripePriceId);

    if (quantity === 0) {
      if (extraItem) {
        await this.stripe.subscriptionItems.del(extraItem.id, { proration_behavior: 'create_prorations' });
      }
    } else if (extraItem) {
      if ((extraItem.quantity ?? 0) !== quantity) {
        await this.stripe.subscriptionItems.update(extraItem.id, {
          quantity,
          proration_behavior: 'create_prorations',
        });
      }
    } else {
      await this.stripe.subscriptionItems.create({
        subscription: liveSubscription.id,
        price: offer.stripePriceId,
        quantity,
        proration_behavior: 'create_prorations',
      });
    }

    const refreshed = await this.stripe.subscriptions.retrieve(liveSubscription.id);
    const snapshot = this.serializeStripeSubscription(refreshed, catalog.plans, billing.planCode, offer.stripePriceId);
    const next = await this.updateUserStripeState({ user, billingPatch: snapshot });

    return respond('updated', next, null);
  }

  /**
   * Résiliation en ligne par l'hôte (article L215-1-1 du Code de la consommation) : l'abonnement
   * s'arrête à la fin de la période déjà payée, sans remboursement. `false` annule la résiliation.
   * Les remboursements (rétractation sous 14 jours) se traitent à part, sur demande par e-mail.
   */
  async setMySubscriptionCancellation(
    auth: RequestAuth | null,
    cancelAtPeriodEnd: boolean,
  ): Promise<MySubscriptionStateResult | 'no_subscription' | null> {
    const user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;

    const billing = this.readBillingSnapshot(user);
    if (billing.complimentary || !billing.planCode) return 'no_subscription';

    if (this.getSubscriptionExecutionMode() === 'mock' || !this.stripe) {
      const next = await this.updateUserStripeState({
        user,
        billingPatch: { cancelAtPeriodEnd, updatedAtISO: nowIso() },
      });
      return this.buildSubscriptionStateForUser(next, { allowAdmin: hasAdminAccess(auth), sync: false });
    }

    if (!billing.customerId) return 'no_subscription';
    const liveSubscription = await this.getCurrentStripeSubscription({
      customerId: billing.customerId,
      subscriptionId: billing.subscriptionId,
    });
    if (!liveSubscription) return 'no_subscription';

    if (Boolean(liveSubscription.cancel_at_period_end) !== cancelAtPeriodEnd) {
      await this.stripe.subscriptions.update(liveSubscription.id, { cancel_at_period_end: cancelAtPeriodEnd });
    }

    return this.buildSubscriptionStateForUser(user, { allowAdmin: hasAdminAccess(auth), sync: true });
  }

  async getMySubscriptionState(auth: RequestAuth | null, options?: { sync?: boolean }): Promise<MySubscriptionStateResult | null> {
    const user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;
    return this.buildSubscriptionStateForUser(user, { allowAdmin: hasAdminAccess(auth), sync: Boolean(options?.sync) });
  }

  /** État d'abonnement d'un client, vu comme lui-même (limites réelles), pour la fenêtre admin. */
  async getSubscriptionStateForUserAsAdmin(
    auth: RequestAuth | null,
    targetUserId: string,
    options?: { sync?: boolean },
  ): Promise<MySubscriptionStateResult | 'forbidden' | null> {
    if (!hasAdminAccess(auth)) return 'forbidden';
    const user = await resolveUserByIdentifier(this.prisma, targetUserId);
    if (!user) return null;
    return this.buildSubscriptionStateForUser(user, { allowAdmin: false, sync: Boolean(options?.sync) });
  }

  private async buildSubscriptionStateForUser(
    initialUser: User,
    options: { allowAdmin: boolean; sync: boolean },
  ): Promise<MySubscriptionStateResult> {
    const allowAdmin = options.allowAdmin;
    let user = await this.enforceAdminListingTransferTrialExpiration(initialUser);
    user = await this.enforceComplimentaryPlanExpiration(user);

    const catalog = await this.resolveCatalog();
    const plans = catalog.plans;
    const subscriptionMode = this.getSubscriptionExecutionMode();
    const shouldSync = Boolean(options?.sync);

    if (shouldSync && subscriptionMode === 'live' && this.stripe) {
      const billing = this.readBillingSnapshot(user);
      if (billing.customerId) {
        const liveSubscription = await this.getCurrentStripeSubscription({
          customerId: billing.customerId,
          subscriptionId: billing.subscriptionId,
        });

        if (liveSubscription) {
          const snapshot = this.serializeStripeSubscription(liveSubscription, plans, billing.planCode, catalog.extraListing?.stripePriceId ?? null);
          user = await this.updateUserStripeState({
            user,
            billingPatch: snapshot,
          });
        }
      }
    }

    const currentBilling = this.readBillingSnapshot(user);
    const currentPlan = plans.find((plan) => plan.code === currentBilling.planCode) ?? null;

    return {
      mode: subscriptionMode,
      plans,
      extraListing: catalog.extraListing,
      currentPlanCode: currentBilling.planCode,
      currentPlan,
      subscription: this.toPublicBillingSnapshot(currentBilling),
      listingAllowance: await this.computeListingAllowance(user, plans, { allowAdmin }),
      connect: this.readConnectState(user),
      publicationReadiness: this.toPublicationReadiness(user, { allowAdmin }),
    };
  }

  async activateSubscription(input: ActivateSubscriptionInput, auth: RequestAuth | null): Promise<SubscriptionActivationResult | null> {
    const allowAdmin = hasAdminAccess(auth);
    const mode = this.getSubscriptionExecutionMode();
    const plans = await this.resolvePlanCatalog();
    const selectedPlan = plans.find((plan) => plan.code === input.planCode) ?? null;

    let user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;
    user = await this.enforceAdminListingTransferTrialExpiration(user);

    if (!selectedPlan || !selectedPlan.available) {
      return {
        state: 'plan_unavailable',
        mode,
        plan: selectedPlan,
        subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(user)),
        connect: this.toConnectSummary(user, false),
        publicationReadiness: this.toPublicationReadiness(user, { allowAdmin }),
        checkout: null,
        message: selectedPlan?.unavailableReason ?? 'Plan indisponible.',
      };
    }

    const ensuredCustomer = await this.ensureStripeCustomer(user);
    user = ensuredCustomer.user;

    const currentBilling = this.readBillingSnapshot(user);

    if (mode === 'mock') {
      if (isSubscriptionOngoing(currentBilling.status)) {
        const nextStatus = 'active';
        const isSamePlan = currentBilling.planCode === selectedPlan.code;

        const next = await this.updateUserStripeState({
          user,
          billingPatch: {
            subscriptionId: currentBilling.subscriptionId ?? generateMockId('sub_mock_'),
            planCode: selectedPlan.code,
            status: nextStatus,
            currentPeriodEndISO: oneMonthFromNowIso(),
            cancelAtPeriodEnd: false,
            updatedAtISO: nowIso(),
            pendingPlanCode: null,
            pendingCheckoutSessionId: null,
          },
        });

        return {
          state: isSamePlan ? 'already_active' : 'updated',
          mode,
          plan: selectedPlan,
          subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(next)),
          connect: this.toConnectSummary(next, false),
          publicationReadiness: this.toPublicationReadiness(next, { allowAdmin }),
          checkout: null,
          message: isSamePlan
            ? 'Ce plan est déjà actif sur votre compte.'
            : `Votre plan a été mis à jour vers ${selectedPlan.name}.`,
        };
      }

      const sessionId = generateMockId('cs_mock_');
      const checkoutUrl = addQueryParam(input.successUrl, 'session_id', sessionId);

      const next = await this.updateUserStripeState({
        user,
        billingPatch: {
          pendingPlanCode: selectedPlan.code,
          pendingCheckoutSessionId: sessionId,
          updatedAtISO: nowIso(),
        },
      });

      return {
        state: 'checkout_required',
        mode,
        plan: selectedPlan,
        subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(next)),
        connect: this.toConnectSummary(next, false),
        publicationReadiness: this.toPublicationReadiness(next, { allowAdmin }),
        checkout: {
          sessionId,
          url: checkoutUrl,
        },
        message: null,
      };
    }

    if (!this.stripe) {
      throw new Error('Stripe client unavailable while mode is live.');
    }

    const liveSubscription = await this.getCurrentStripeSubscription({
      customerId: ensuredCustomer.customerId,
      subscriptionId: currentBilling.subscriptionId,
    });

    if (liveSubscription) {
      const planItem = this.findPlanSubscriptionItem(liveSubscription, plans);
      const currentPriceId = planItem?.price?.id ?? null;
      const isAlreadyOnPlan = currentPriceId === selectedPlan.stripePriceId;

      if (isAlreadyOnPlan) {
        const snapshot = this.serializeStripeSubscription(liveSubscription, plans, selectedPlan.code);
        const next = await this.updateUserStripeState({
          user,
          billingPatch: snapshot,
        });

        return {
          state: 'already_active',
          mode,
          plan: selectedPlan,
          subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(next)),
          connect: this.toConnectSummary(next, false),
          publicationReadiness: this.toPublicationReadiness(next, { allowAdmin }),
          checkout: null,
          message: 'Ce plan est déjà actif sur votre compte.',
        };
      }

      // Seul l'item « plan » change ; l'item « logement supplémentaire » éventuel est conservé tel quel.
      const subscriptionItemId = planItem?.id;
      if (!subscriptionItemId || !selectedPlan.stripePriceId) {
        throw new Error('Unable to update subscription: missing subscription item or price id.');
      }

      const updatedSubscription = await this.stripe.subscriptions.update(liveSubscription.id, {
        items: [{
          id: subscriptionItemId,
          price: selectedPlan.stripePriceId,
        }],
        proration_behavior: 'create_prorations',
        metadata: {
          userId: user.id,
          clerkUserId: user.clerkUserId ?? '',
          planCode: selectedPlan.code,
        },
      });

      const snapshot = this.serializeStripeSubscription(updatedSubscription, plans, selectedPlan.code);
      const next = await this.updateUserStripeState({
        user,
        billingPatch: snapshot,
      });

      return {
        state: 'updated',
        mode,
        plan: selectedPlan,
        subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(next)),
        connect: this.toConnectSummary(next, false),
        publicationReadiness: this.toPublicationReadiness(next, { allowAdmin }),
        checkout: null,
        message: `Votre plan a été mis à jour vers ${selectedPlan.name}.`,
      };
    }

    if (!selectedPlan.stripePriceId) {
      return {
        state: 'plan_unavailable',
        mode,
        plan: selectedPlan,
        subscription: this.toPublicBillingSnapshot(currentBilling),
        connect: this.toConnectSummary(user, false),
        publicationReadiness: this.toPublicationReadiness(user, { allowAdmin }),
        checkout: null,
        message: `Aucun prix Stripe valide n'a été trouvé pour ${selectedPlan.name}.`,
      };
    }

    const successUrl = addRawQueryParam(input.successUrl, 'session_id', '{CHECKOUT_SESSION_ID}');
    const checkoutMetadata = this.buildSubscriptionCheckoutMetadata(user, selectedPlan.code);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: ensuredCustomer.customerId,
      client_reference_id: user.id,
      success_url: successUrl,
      cancel_url: input.cancelUrl,
      line_items: [
        {
          price: selectedPlan.stripePriceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      metadata: checkoutMetadata,
      subscription_data: this.buildSubscriptionCheckoutData(selectedPlan.code, checkoutMetadata),
    });

    if (!session.url) {
      throw new Error('Stripe checkout session URL is missing.');
    }

    const next = await this.updateUserStripeState({
      user,
      billingPatch: {
        pendingPlanCode: selectedPlan.code,
        pendingCheckoutSessionId: session.id,
        updatedAtISO: nowIso(),
      },
    });

    return {
      state: 'checkout_required',
      mode,
      plan: selectedPlan,
      subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(next)),
      connect: this.toConnectSummary(next, false),
      publicationReadiness: this.toPublicationReadiness(next, { allowAdmin }),
      checkout: {
        sessionId: session.id,
        url: session.url,
      },
      message: null,
    };
  }

  async confirmSubscriptionCheckout(input: ConfirmCheckoutInput, auth: RequestAuth | null): Promise<ConfirmSubscriptionCheckoutResult | null> {
    const allowAdmin = hasAdminAccess(auth);
    let user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;
    user = await this.enforceAdminListingTransferTrialExpiration(user);

    const plans = await this.resolvePlanCatalog();
    const mode = this.getSubscriptionExecutionMode();

    if (mode === 'mock') {
      const billing = this.readBillingSnapshot(user);
      const planCode = input.planCode ?? billing.pendingPlanCode ?? billing.planCode;
      if (!planCode) {
        return {
          state: 'not_found',
          mode,
          plan: null,
          subscription: this.toPublicBillingSnapshot(billing),
          connect: this.toConnectSummary(user, false),
          publicationReadiness: this.toPublicationReadiness(user, { allowAdmin }),
          message: 'Aucun plan à confirmer pour cette session.',
        };
      }

      const next = await this.updateUserStripeState({
        user,
        billingPatch: {
          subscriptionId: billing.subscriptionId ?? generateMockId('sub_mock_'),
          planCode,
          status: isTrialEligiblePlanCode(planCode) ? 'trialing' : 'active',
          currentPeriodEndISO: isTrialEligiblePlanCode(planCode)
            ? daysFromNowIso(SUBSCRIPTION_TRIAL_PERIOD_DAYS)
            : oneMonthFromNowIso(),
          cancelAtPeriodEnd: false,
          updatedAtISO: nowIso(),
          pendingPlanCode: null,
          pendingCheckoutSessionId: null,
        },
      });

      const nextBilling = this.readBillingSnapshot(next);
      const currentPlan = plans.find((plan) => plan.code === nextBilling.planCode) ?? null;

      return {
        state: 'confirmed',
        mode,
        plan: currentPlan,
        subscription: this.toPublicBillingSnapshot(nextBilling),
        connect: this.toConnectSummary(next, false),
        publicationReadiness: this.toPublicationReadiness(next, { allowAdmin }),
        message: null,
      };
    }

    if (!this.stripe) {
      throw new Error('Stripe client unavailable while mode is live.');
    }

    const session = await this.stripe.checkout.sessions.retrieve(input.sessionId, {
      expand: ['subscription'],
    });

    const billing = this.readBillingSnapshot(user);
    const sessionCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
    // Toutes nos sessions portent client_reference_id = id de l'utilisateur concerné : sans ce
    // lien (ou le même client Stripe), on pourrait activer son compte avec la session d'un autre.
    const sessionBelongsToUser = session.client_reference_id === user.id
      || Boolean(billing.customerId && sessionCustomerId === billing.customerId);

    if (!sessionBelongsToUser || (billing.customerId && sessionCustomerId && billing.customerId !== sessionCustomerId)) {
      return {
        state: 'not_found',
        mode,
        plan: null,
        subscription: this.toPublicBillingSnapshot(billing),
        connect: this.toConnectSummary(user, false),
        publicationReadiness: this.toPublicationReadiness(user, { allowAdmin }),
        message: 'Cette session checkout ne correspond pas à l’utilisateur authentifié.',
      };
    }

    let subscription: Stripe.Subscription | null = null;
    if (typeof session.subscription === 'string') {
      subscription = await this.stripe.subscriptions.retrieve(session.subscription);
    } else if (session.subscription && typeof session.subscription === 'object') {
      subscription = session.subscription as Stripe.Subscription;
    }

    if (!subscription) {
      return {
        state: 'not_found',
        mode,
        plan: null,
        subscription: this.toPublicBillingSnapshot(billing),
        connect: this.toConnectSummary(user, false),
        publicationReadiness: this.toPublicationReadiness(user, { allowAdmin }),
        message: 'La session Stripe ne contient aucun abonnement confirmé.',
      };
    }

    const snapshot = this.serializeStripeSubscription(subscription, plans, input.planCode ?? billing.pendingPlanCode);
    snapshot.customerId = sessionCustomerId ?? snapshot.customerId;

    user = await this.updateUserStripeState({
      user,
      billingPatch: snapshot,
    });

    const nextBilling = this.readBillingSnapshot(user);
    const currentPlan = plans.find((plan) => plan.code === nextBilling.planCode) ?? null;

    return {
      state: 'confirmed',
      mode,
      plan: currentPlan,
      subscription: this.toPublicBillingSnapshot(nextBilling),
      connect: this.toConnectSummary(user, false),
      publicationReadiness: this.toPublicationReadiness(user, { allowAdmin }),
      message: null,
    };
  }

  async enforceTrialReservationLimitForListing(listingId: string): Promise<void> {
    if (!SUBSCRIPTION_TRIAL_RESERVATION_LIMIT_ENABLED) return;

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        ownerId: true,
      },
    });

    const ownerId = readString(listing?.ownerId);
    if (!ownerId) return;

    let user = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });
    if (!user) return;

    const billing = this.readBillingSnapshot(user);
    if (!isTrialEligiblePlanCode(billing.planCode) || billing.status !== 'trialing') return;

    if (!this.stripe) {
      const reservationsDuringTrial = await this.prisma.reservation.count({
        where: {
          listing: { ownerId },
          createdAt: {
            gte: this.deriveMockTrialStartDate(billing) ?? new Date(0),
          },
        },
      });

      if (reservationsDuringTrial < SUBSCRIPTION_TRIAL_RESERVATION_LIMIT) return;

      await this.updateUserStripeState({
        user,
        billingPatch: {
          status: 'active',
          updatedAtISO: nowIso(),
        },
      });
      return;
    }

    let subscription: Stripe.Subscription | null = null;

    if (billing.subscriptionId) {
      try {
        subscription = await this.stripe.subscriptions.retrieve(billing.subscriptionId);
      } catch {
        subscription = null;
      }
    }

    if (!subscription && billing.customerId) {
      subscription = await this.getCurrentStripeSubscription({
        customerId: billing.customerId,
        subscriptionId: billing.subscriptionId,
      });
    }

    if (!subscription) return;

    if (subscription.status !== 'trialing') {
      user = await this.updateUserStripeState({
        user,
        billingPatch: this.serializeStripeSubscription(subscription, [], billing.planCode),
      });
      return;
    }

    const trialStart = toIsoFromUnixSeconds(subscription.trial_start)
      ?? toIsoFromUnixSeconds(subscription.created)
      ?? billing.updatedAtISO;
    const trialStartDate = this.parseIsoDate(trialStart) ?? new Date(0);

    const reservationsDuringTrial = await this.prisma.reservation.count({
      where: {
        listing: { ownerId },
        createdAt: {
          gte: trialStartDate,
        },
      },
    });

    if (reservationsDuringTrial < SUBSCRIPTION_TRIAL_RESERVATION_LIMIT) return;

    const updatedSubscription = await this.stripe.subscriptions.update(subscription.id, {
      trial_end: 'now',
      proration_behavior: 'none',
      metadata: {
        ...subscription.metadata,
        planCode: billing.planCode,
        trialStopReason: 'reservation_limit_reached',
        trialReservationCount: String(reservationsDuringTrial),
        trialReservationLimit: String(SUBSCRIPTION_TRIAL_RESERVATION_LIMIT),
      },
    });

    await this.updateUserStripeState({
      user,
      billingPatch: this.serializeStripeSubscription(updatedSubscription, [], billing.planCode),
    });
  }

  async createPaymentIntent(input: CreatePaymentIntentInput, auth: RequestAuth | null) {
    const reservableListing = await this.ensureListingReservable(input.listingId);
    if (!reservableListing) return null;

    const listing = await this.prisma.listing.findUnique({
      where: { id: input.listingId },
      select: {
        id: true,
        ownerId: true,
        core: true,
        bookings: true,
        owner: {
          select: {
            stripeConnectAccountId: true,
            stripeConnectProfile: true,
          },
        },
      },
    });

    if (!listing) return null;

    const listingConnectedAccountId = this.resolveListingConnectedAccountId(listing.owner);
    const providedConnectedAccountId = readString(input.connectedAccountId);
    const connectedAccountId = listingConnectedAccountId;
    if (listingConnectedAccountId && providedConnectedAccountId && listingConnectedAccountId !== providedConnectedAccountId) {
      console.warn('[payments] ignoring mismatched connected account provided by client', {
        listingId: listing.id,
        providedConnectedAccountId,
        ownerConnectedAccountId: listingConnectedAccountId,
      });
    }

    if (!connectedAccountId) {
      throw createBadRequestError(
        'Le compte Stripe Connect du proprietaire est manquant.',
        'MISSING_CONNECTED_ACCOUNT',
      );
    }

    const validation = this.validatePaymentIntentInput({
      input,
      listingCore: asObject(listing.core),
      listingBookings: asObject(listing.bookings),
    });

    const actor = await upsertUserFromAuth(this.prisma, auth);
    const currency = (input.currency || 'eur').toLowerCase();
    const chargeNowAmountMinor = validation.payment.chargeNowAmountMinor;

    const metadata: Record<string, string> = {
      ...(input.metadata ?? {}),
      listingId: input.listingId,
      connectedAccountId,
      paymentChoice: validation.payment.choice,
      paymentTotalAmountMinor: String(validation.payment.totalAmountMinor),
      paymentChargeNowAmountMinor: String(validation.payment.chargeNowAmountMinor),
      paymentDeferredAmountMinor: String(validation.payment.deferredAmountMinor),
      paymentDeferredMode: validation.payment.deferredMode,
      paymentChargeNowRatio: String(validation.payment.ratio),
      reservationStartISO: validation.reservation.startISO,
      reservationEndISO: validation.reservation.endISO,
      reservationNights: String(validation.reservation.nights),
      reservationTotalAmountMinor: String(validation.reservation.totalAmountMinor),
      reservationAdults: String(validation.reservation.occupants.adults),
      reservationChildren: String(validation.reservation.occupants.children),
      reservationBabies: String(validation.reservation.occupants.babies),
      reservationAnimals: String(validation.reservation.occupants.animals),
      // Pas de nombre de voyageurs PMR chez Stripe : c'est une donnée de santé (RGPD, art. 9).
    };
    if (validation.payment.deferredDueDateISO) {
      metadata.paymentDeferredDueDateISO = validation.payment.deferredDueDateISO;
    }

    let session: {
      id: string;
      clientSecret: string;
      status: string;
      currency: string;
      connectedAccountId: string;
      rawResponse: Record<string, unknown>;
    };

    if (!this.stripe) {
      const idSuffix = Math.random().toString(36).slice(2, 10);
      const fakeId = `pi_mock_${idSuffix}`;
      session = {
        id: fakeId,
        clientSecret: `${fakeId}_secret_mock`,
        status: 'requires_payment_method',
        currency,
        connectedAccountId,
        rawResponse: {
          mode: 'mock',
          message: 'Stripe key not configured.',
        },
      };
    } else {
      const applicationFee = this.computeApplicationFee(chargeNowAmountMinor);

      // Paiement direct : créé sur le compte Stripe de l'hôte, qui est le commerçant et paie ses
      // frais. Le voyageur règle l'hôte ; IndieHost ne touche pas les fonds (commission
      // éventuelle via application_fee_amount, nulle par défaut).
      const createParams: Stripe.PaymentIntentCreateParams = {
        amount: chargeNowAmountMinor,
        currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata,
      };

      if (applicationFee > 0) {
        createParams.application_fee_amount = applicationFee;
      }

      const intent = await this.stripe.paymentIntents.create(createParams, { stripeAccount: connectedAccountId });

      if (!intent.client_secret) {
        throw new Error('Stripe did not return a client_secret.');
      }

      session = {
        id: intent.id,
        clientSecret: intent.client_secret,
        status: intent.status,
        currency: intent.currency,
        connectedAccountId,
        rawResponse: intent as unknown as Record<string, unknown>,
      };
    }

    await this.prisma.payment.create({
      data: {
        listingId: input.listingId,
        userId: actor?.id ?? listing.ownerId ?? null,
        stripePaymentIntentId: session.id,
        stripeConnectedAccountId: connectedAccountId,
        currency,
        amountMinor: chargeNowAmountMinor,
        status: session.status,
        paymentChoice: validation.payment.choice,
        chargeNowAmountMinor,
        deferredAmountMinor: validation.payment.deferredAmountMinor,
        deferredMode: validation.payment.deferredMode,
        deferredDueDate: validation.payment.deferredDueDateISO ? new Date(validation.payment.deferredDueDateISO) : null,
        metadata: toPrismaJson(metadata),
        rawRequest: toPrismaJson({
          reservation: input.reservation,
          payment: input.payment,
          validated: {
            reservation: validation.reservation,
            payment: validation.payment,
            connectedAccountId,
          },
          currency,
        }),
        rawResponse: toPrismaJson(session.rawResponse),
      },
    });

    return {
      id: session.id,
      clientSecret: session.clientSecret,
      status: session.status,
      currency: session.currency,
      connectedAccountId: session.connectedAccountId,
    };
  }

  // Une réservation de voyageur n'est créée que sur un PaymentIntent émis par l'API pour cette
  // annonce et ces dates, réglé côté Stripe et jamais rattaché à une autre réservation.
  async verifyReservationPayment(input: {
    listingId: string;
    paymentIntentId: string;
    startISO: string;
    endISO: string;
  }) {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: input.paymentIntentId },
    });
    const metadata = asObject(payment?.metadata);
    if (
      !payment
      || payment.listingId !== input.listingId
      || readString(metadata.reservationStartISO) !== input.startISO
      || readString(metadata.reservationEndISO) !== input.endISO
    ) {
      throw createBadRequestError('Le paiement ne correspond pas à cette réservation.', 'RESERVATION_PAYMENT_MISMATCH');
    }
    if (payment.reservationId) {
      // 409 comme l'écriture conditionnelle de BookingsService (même code d'erreur).
      const error = createBadRequestError('Ce paiement est déjà associé à une réservation.', 'RESERVATION_PAYMENT_ALREADY_USED');
      (error as { statusCode?: number }).statusCode = 409;
      throw error;
    }

    const chargeNowAmountMinor = payment.chargeNowAmountMinor ?? payment.amountMinor;
    let status = payment.status;
    if (this.stripe) {
      // Le PaymentIntent vit sur le compte de l'hôte (paiement direct).
      const intent = await this.stripe.paymentIntents.retrieve(
        input.paymentIntentId,
        {},
        payment.stripeConnectedAccountId ? { stripeAccount: payment.stripeConnectedAccountId } : undefined,
      );
      if (
        intent.amount !== chargeNowAmountMinor
        || intent.currency !== payment.currency
        || intent.metadata?.listingId !== input.listingId
      ) {
        throw createBadRequestError('Le paiement ne correspond pas à cette réservation.', 'RESERVATION_PAYMENT_MISMATCH');
      }
      status = intent.status;
    } else if (env.NODE_ENV !== 'production') {
      // Mode simulé (aucune clé Stripe) : uniquement hors production.
      status = 'succeeded';
    }

    if (!SETTLED_RESERVATION_PAYMENT_STATUSES.has(status)) {
      throw createBadRequestError('Le paiement n a pas abouti.', 'RESERVATION_PAYMENT_NOT_COMPLETED');
    }

    if (status !== payment.status) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status },
      });
    }

    const deferredAmountMinor = payment.deferredAmountMinor ?? 0;
    return {
      paymentIntentId: input.paymentIntentId,
      status,
      currency: payment.currency,
      connectedAccountId: payment.stripeConnectedAccountId,
      choice: payment.paymentChoice,
      totalAmountMinor: toNumber(metadata.paymentTotalAmountMinor, chargeNowAmountMinor + deferredAmountMinor),
      chargeNowAmountMinor,
      deferredAmountMinor,
      deferredMode: payment.deferredMode,
      deferredDueDateISO: payment.deferredDueDate ? payment.deferredDueDate.toISOString().slice(0, 10) : null,
    };
  }

  async createConnectOnboardingLink(input: CreateConnectOnboardingLinkInput, auth: RequestAuth | null) {
    let user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;
    user = await this.enforceAdminListingTransferTrialExpiration(user);

    try {
      const prefill = this.stripe ? await this.buildConnectAccountPrefill(user, input.hostStatus) : undefined;
      const connect = await this.ensureStripeConnectAccount(user, {
        country: input.country,
        forcedAccountId: input.accountId,
        prefill,
      });
      user = connect.user;

      // Compte déjà créé mais inscription pas encore envoyée : on complète ce qui manque.
      // Stripe peut refuser une partie (informations déjà confirmées) : sans gravité, l'hôte
      // les saisira dans le formulaire.
      if (this.stripe && prefill && !connect.created) {
        try {
          const existing = await this.stripe.accounts.retrieve(connect.accountId);
          if (!existing.details_submitted) {
            await this.stripe.accounts.update(connect.accountId, {
              ...(existing.business_type ? {} : { business_type: prefill.business_type }),
              ...(prefill.individual && !existing.business_type ? { individual: prefill.individual } : {}),
              business_profile: prefill.business_profile,
              ...(existing.email || !prefill.email ? {} : { email: prefill.email }),
            });
          }
        } catch (prefillError) {
          console.warn('[payments] Stripe Connect prefill skipped', {
            accountId: connect.accountId,
            message: isRecord(prefillError) ? readString(prefillError.message) : null,
          });
        }
      }

      if (!this.stripe) {
        const fakeUrl = `${input.returnUrl}?account=${connect.accountId}&mode=mock`;

        user = await this.updateUserStripeState({
          user,
          connectPatch: {
            onboardingStatus: 'pending',
          },
        });

        return {
          accountId: connect.accountId,
          url: fakeUrl,
          mode: 'mock',
        };
      }

      // Inscription « au fil de l'eau » : seul le nécessaire immédiat est demandé ; Stripe
      // réclamera le reste plus tard si l'activité de l'hôte l'exige.
      const accountLink = await this.stripe.accountLinks.create({
        account: connect.accountId,
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        type: 'account_onboarding',
        collection_options: {
          fields: 'currently_due',
          future_requirements: 'omit',
        },
      });

      await this.updateUserStripeState({
        user,
        connectPatch: {
          onboardingStatus: 'pending',
        },
      });

      return {
        accountId: connect.accountId,
        url: accountLink.url,
        expiresAt: accountLink.expires_at,
        mode: 'live',
      };
    } catch (error) {
      if (this.isStripeConnectPlatformProfileError(error)) {
        throw this.buildStripeConnectPlatformProfileError(error);
      }
      throw error;
    }
  }

  async createConnectDashboardLink(
    input: CreateConnectDashboardLinkInput,
    auth: RequestAuth | null,
  ): Promise<ConnectDashboardLinkResult | null> {
    let user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;
    user = await this.enforceAdminListingTransferTrialExpiration(user);

    const connect = this.readConnectState(user);
    const profileAccountId = readString(this.readStripeProfile(user).accountId);
    const requestedAccountId = readString(input.accountId) ?? connect.accountId ?? profileAccountId;

    if (!requestedAccountId) {
      throw new Error('Aucun compte Stripe Connect trouvé pour cet utilisateur.');
    }

    if (connect.onboardingStatus !== 'completed') {
      throw new Error("Le compte Stripe Connect doit terminer l'onboarding avant d'ouvrir le dashboard.");
    }

    if (!this.stripe) {
      return {
        mode: this.getExecutionMode(),
        accountId: requestedAccountId,
        url: `https://dashboard.stripe.com/express/accounts/${requestedAccountId}`,
      };
    }

    // Les liens de connexion n'existent que pour le Dashboard Express. Un hôte au Dashboard
    // Stripe complet se connecte directement sur dashboard.stripe.com avec ses identifiants.
    const account = await this.stripe.accounts.retrieve(requestedAccountId);
    const dashboardType = account.controller?.stripe_dashboard?.type ?? (account.type === 'express' ? 'express' : 'full');
    if (dashboardType === 'express') {
      const loginLink = await this.stripe.accounts.createLoginLink(requestedAccountId);
      return {
        mode: 'live',
        accountId: requestedAccountId,
        url: loginLink.url,
      };
    }

    return {
      mode: 'live',
      accountId: requestedAccountId,
      url: 'https://dashboard.stripe.com/',
    };
  }

  private resolveConnectOnboardingStatusFromStripeAccount(account: Stripe.Account): string {
    const chargesEnabled = Boolean(account.charges_enabled);
    const payoutsEnabled = Boolean(account.payouts_enabled);
    const currentlyDue = account.requirements?.currently_due?.length ?? 0;
    const disabledReason = readString(account.requirements?.disabled_reason);

    if (chargesEnabled && payoutsEnabled && !disabledReason && currentlyDue === 0) {
      return 'completed';
    }

    if (disabledReason || currentlyDue > 0) {
      return 'restricted';
    }

    return 'pending';
  }

  async syncMyStripeConnectState(
    input: SyncConnectStateInput,
    auth: RequestAuth | null,
  ): Promise<SyncConnectStateResult | null> {
    const allowAdmin = hasAdminAccess(auth);
    let user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;
    user = await this.enforceAdminListingTransferTrialExpiration(user);

    const requestedAccountId = readString(input.accountId) ?? user.stripeConnectAccountId ?? null;
    if (!requestedAccountId) {
      const next = await this.updateUserStripeState({
        user,
        stripeConnectAccountId: null,
        connectPatch: {
          accountId: null,
          onboardingStatus: 'not_started',
          chargesEnabled: false,
          payoutsEnabled: false,
          defaultCurrency: 'eur',
          transferSchedule: 'manual',
        },
      });

      return {
        mode: this.getExecutionMode(),
        connect: this.readConnectState(next),
        publicationReadiness: this.toPublicationReadiness(next, { allowAdmin }),
      };
    }

    if (!this.stripe) {
      const ensured = await this.ensureStripeConnectAccount(user, {
        forcedAccountId: requestedAccountId,
      });
      user = ensured.user;

      const next = await this.updateUserStripeState({
        user,
        stripeConnectAccountId: requestedAccountId,
        connectPatch: {
          accountId: requestedAccountId,
          onboardingStatus: 'completed',
          chargesEnabled: true,
          payoutsEnabled: true,
          defaultCurrency: 'eur',
          transferSchedule: 'manual',
        },
      });

      return {
        mode: this.getExecutionMode(),
        connect: this.readConnectState(next),
        publicationReadiness: this.toPublicationReadiness(next, { allowAdmin }),
      };
    }

    const account = await this.stripe.accounts.retrieve(requestedAccountId);
    const onboardingStatus = this.resolveConnectOnboardingStatusFromStripeAccount(account);
    const next = await this.updateUserStripeState({
      user,
      stripeConnectAccountId: requestedAccountId,
      connectPatch: {
        accountId: requestedAccountId,
        onboardingStatus,
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        defaultCurrency: (account.default_currency ?? 'eur').toLowerCase(),
        transferSchedule: readString(account.settings?.payouts?.schedule?.interval) ?? 'manual',
      },
    });

    return {
      mode: this.getExecutionMode(),
      connect: this.readConnectState(next),
      publicationReadiness: this.toPublicationReadiness(next, { allowAdmin }),
    };
  }

  async getMyStripeConnectProfile(auth: RequestAuth | null) {
    let user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;
    user = await this.enforceAdminListingTransferTrialExpiration(user);

    return {
      accountId: user.stripeConnectAccountId,
      profile: user.stripeConnectProfile,
    };
  }
}
