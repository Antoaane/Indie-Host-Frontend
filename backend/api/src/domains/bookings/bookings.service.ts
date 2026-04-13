import { createHmac } from 'node:crypto';
import type { MessageState, PrismaClient } from '@prisma/client';
import ical, { ICalCalendarMethod, ICalEventStatus } from 'ical-generator';
import Stripe from 'stripe';

import { env } from '../../config/env.js';
import { deepMerge, asObject, toNumber } from '../../lib/json.js';
import { buildMessageId, buildReservationId } from '../../lib/id.js';
import { toPrismaJson } from '../../lib/prisma.js';
import { PaymentsService } from '../payments/payments.service.js';
import { isDeprecatedHostIdentity } from '../users/users.repository.js';

type RawReservation = Record<string, unknown>;

type ReservationConfirmation = {
  guideAccessKey: string;
  guideUrl: string;
  generatedAt: string;
};

type PersistedReservation = {
  id: string;
  guestName: string;
  message: string | null;
  startDate: Date;
  endDate: Date;
  guideUrl: string | null;
};

type ReservationAccessContext = {
  reservationId: string;
  listingId: string;
  guestName: string;
  message: string | null;
  createdAt: Date;
  startDate: Date;
  endDate: Date;
  nights: number;
  payment: Record<string, unknown>;
  reservationContact: Record<string, unknown>;
  reservationMessaging: Record<string, unknown>;
  listingHost: Record<string, unknown>;
  listingArrival: Record<string, unknown>;
  listingCore: Record<string, unknown>;
  listingBookings: Record<string, unknown>;
  ownerId: string | null;
  ownerEmail: string | null;
  ownerDisplayName: string | null;
  confirmation: ReservationConfirmation;
};

type ReservationThreadMessage = {
  id: string;
  author: 'host' | 'guest';
  body: string;
  sentAt: string;
  state: 'sent' | 'delivered' | 'read';
};

type ReservationConversation = {
  id: string;
  messages: ReservationThreadMessage[];
};

type CancellationPolicyKey = 'flexible' | 'moderate' | 'strict' | 'custom';
type CancellationStage = 'full_refund' | 'partial_refund' | 'late_cancellation' | 'after_arrival';

type ResolvedCancellationPolicy = {
  policy: CancellationPolicyKey;
  days: number;
  feePercent: number;
  lateFeePercent: number;
};

type CancellationQuote = {
  stage: CancellationStage;
  canCancel: boolean;
  chargedAmountMinor: number;
  refundableAmountMinor: number;
  retainedAmountMinor: number;
  retainedPercent: number;
  canceledAtISO: string;
};

type ReservationCancellationState = {
  status: 'active' | 'canceled';
  canceledAtISO: string | null;
  reason: string | null;
  stage: CancellationStage;
  chargedAmountMinor: number;
  refundableAmountMinor: number;
  retainedAmountMinor: number;
  retainedPercent: number;
  paymentIntentId: string | null;
  stripeAction: string | null;
  stripeStatus: string | null;
  stripeRefundId: string | null;
};

type StripeCancellationResult = {
  action: 'none' | 'mock_refund' | 'canceled' | 'partially_refunded' | 'refunded';
  stripeStatus: string | null;
  stripeRefundId: string | null;
  refundedAmountMinor: number;
};

const INTERNAL_RESERVATION_SOURCE = 'indiehost_reservation';
const GUIDE_ACTIVATION_WINDOW_MS = 48 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const CANCELLATION_DAYS_MAX = 365;
const CANCELLATION_FEE_MAX = 100;
const CANCELLATION_LATE_FEE_STEP = 20;
const CANCELLATION_PRESETS: Record<'flexible' | 'moderate' | 'strict', {
  days: number;
  feePercent: number;
}> = {
  flexible: {
    days: 3,
    feePercent: 10,
  },
  moderate: {
    days: 7,
    feePercent: 20,
  },
  strict: {
    days: 14,
    feePercent: 35,
  },
};

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractReservations(bookings: Record<string, unknown>) {
  if (!Array.isArray(bookings.reservations)) return [] as RawReservation[];
  return bookings.reservations.filter((item): item is RawReservation => Boolean(item) && typeof item === 'object');
}

function extractBookedDays(bookings: Record<string, unknown>) {
  if (!Array.isArray(bookings['booked-days'])) return [] as Array<Record<string, unknown>>;
  return bookings['booked-days'].filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
}

function normalizeReservationId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function reservationIdFromRow(row: RawReservation): string | null {
  return normalizeReservationId(row.id);
}

function normalizeDayValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function appendBookedDayIfMissing(bookedDays: Array<Record<string, unknown>>, start: string, end: string) {
  if (start >= end) return;

  const hasMatch = bookedDays.some((item) => item.start === start && item.end === end);
  if (hasMatch) return;
  bookedDays.push({ start, end });
}

function extractStripePaymentIntentId(row: RawReservation): string | null {
  const payment = asObject(row.payment);
  const stripe = asObject(payment.stripe);
  const paymentIntentId = typeof stripe.paymentIntentId === 'string' ? stripe.paymentIntentId.trim() : '';
  return paymentIntentId || null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readEmailLocalPart(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const localPart = trimmed.split('@')[0]?.trim() ?? '';
  return localPart || null;
}

function readOwnerUsernameFromProfile(hostProfile: unknown): string | null {
  const record = asObject(hostProfile);
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

function resolveOwnerDisplayName(owner: Record<string, unknown>): string | null {
  const directDisplay = readString(owner.displayName);
  if (directDisplay && !isDeprecatedHostIdentity(directDisplay)) return directDisplay;

  const firstName = readString(owner.firstName);
  const lastName = readString(owner.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName && !isDeprecatedHostIdentity(fullName)) return fullName;

  const username = readOwnerUsernameFromProfile(owner.hostProfile);
  if (username) return username;

  return readEmailLocalPart(readString(owner.email));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(next)));
}

function toMinorUnit(amount: number): number {
  const normalized = Number.isFinite(amount) ? amount : 0;
  return Math.max(0, Math.round(normalized * 100));
}

function toMajorUnit(minorAmount: number): number {
  return Math.max(0, Math.round(minorAmount / 100));
}

function createRequestError(
  message: string,
  statusCode: number,
  code: string,
  details?: Record<string, unknown>,
): Error {
  const error = new Error(message) as Error & {
    statusCode: number;
    code: string;
    details?: Record<string, unknown>;
  };
  error.statusCode = statusCode;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function isCancellationPolicyKey(value: unknown): value is CancellationPolicyKey {
  return value === 'flexible' || value === 'moderate' || value === 'strict' || value === 'custom';
}

function resolveCancellationPolicyFromBookings(bookings: Record<string, unknown>): ResolvedCancellationPolicy {
  const pricing = asObject(bookings.pricing);
  const cancellation = asObject(pricing.cancellation);
  const policy = isCancellationPolicyKey(cancellation.policy) ? cancellation.policy : 'flexible';
  const basePreset = CANCELLATION_PRESETS[policy === 'custom' ? 'moderate' : policy];

  const custom = asObject(cancellation.custom);
  const days = policy === 'custom'
    ? clampInteger(custom.days, 0, CANCELLATION_DAYS_MAX, basePreset.days)
    : basePreset.days;
  const feePercent = policy === 'custom'
    ? clampInteger(custom.feePercent, 0, CANCELLATION_FEE_MAX, basePreset.feePercent)
    : basePreset.feePercent;
  const lateFeePercent = clampInteger(
    feePercent + CANCELLATION_LATE_FEE_STEP,
    0,
    CANCELLATION_FEE_MAX,
    Math.min(CANCELLATION_FEE_MAX, feePercent + CANCELLATION_LATE_FEE_STEP),
  );

  return {
    policy,
    days,
    feePercent,
    lateFeePercent,
  };
}

function resolveCancellationQuote(input: {
  policy: ResolvedCancellationPolicy;
  startDate: Date;
  chargedAmountMinor: number;
  now?: Date;
}): CancellationQuote {
  const now = input.now ?? new Date();
  const canceledAtISO = now.toISOString();
  const chargedAmountMinor = Math.max(0, Math.round(input.chargedAmountMinor));
  const msUntilArrival = input.startDate.getTime() - now.getTime();
  const fullRefundThresholdMs = input.policy.days * DAY_MS;

  let stage: CancellationStage = 'partial_refund';
  let retainedPercent = input.policy.feePercent;
  let canCancel = true;

  if (msUntilArrival <= 0) {
    stage = 'after_arrival';
    retainedPercent = CANCELLATION_FEE_MAX;
    canCancel = false;
  } else if (msUntilArrival < 24 * HOUR_MS) {
    stage = 'late_cancellation';
    retainedPercent = input.policy.lateFeePercent;
  } else if (msUntilArrival >= fullRefundThresholdMs) {
    stage = 'full_refund';
    retainedPercent = 0;
  }

  const refundableAmountMinor = canCancel
    ? Math.max(0, Math.round(chargedAmountMinor * (1 - retainedPercent / 100)))
    : 0;
  const retainedAmountMinor = Math.max(0, chargedAmountMinor - refundableAmountMinor);

  return {
    stage,
    canCancel,
    chargedAmountMinor,
    refundableAmountMinor,
    retainedAmountMinor,
    retainedPercent,
    canceledAtISO,
  };
}

function readChargedAmountMinor(paymentRaw: Record<string, unknown>): number {
  const stripe = asObject(paymentRaw.stripe);
  const chargeNowAmountMajor = toNumber(
    stripe.chargeNowAmount,
    toNumber(paymentRaw.deposit, toNumber(paymentRaw.total, 0)),
  );
  return toMinorUnit(chargeNowAmountMajor);
}

function readReservationCancellationState(paymentRaw: Record<string, unknown>): ReservationCancellationState {
  const cancellation = asObject(paymentRaw.cancellation);
  const status = readString(cancellation.status) === 'canceled' ? 'canceled' : 'active';
  const chargedAmountMinor = clampInteger(
    cancellation.chargedAmountMinor,
    0,
    Number.MAX_SAFE_INTEGER,
    readChargedAmountMinor(paymentRaw),
  );
  const refundableAmountMinor = clampInteger(
    cancellation.refundableAmountMinor,
    0,
    Number.MAX_SAFE_INTEGER,
    chargedAmountMinor,
  );
  const retainedAmountMinor = clampInteger(
    cancellation.retainedAmountMinor,
    0,
    Number.MAX_SAFE_INTEGER,
    Math.max(0, chargedAmountMinor - refundableAmountMinor),
  );
  const retainedPercent = clampInteger(
    cancellation.retainedPercent,
    0,
    CANCELLATION_FEE_MAX,
    chargedAmountMinor <= 0 ? 0 : Math.round((retainedAmountMinor / chargedAmountMinor) * 100),
  );
  const stageRaw = readString(cancellation.stage);
  const stage: CancellationStage =
    stageRaw === 'late_cancellation'
      ? 'late_cancellation'
      : stageRaw === 'full_refund'
        ? 'full_refund'
        : stageRaw === 'after_arrival'
          ? 'after_arrival'
          : 'partial_refund';

  return {
    status,
    canceledAtISO: readString(cancellation.canceledAtISO),
    reason: readString(cancellation.reason),
    stage,
    chargedAmountMinor,
    refundableAmountMinor,
    retainedAmountMinor,
    retainedPercent,
    paymentIntentId: readString(cancellation.paymentIntentId),
    stripeAction: readString(cancellation.stripeAction),
    stripeStatus: readString(cancellation.stripeStatus),
    stripeRefundId: readString(cancellation.stripeRefundId),
  };
}

function toIsoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const raw = readString(value);
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

function buildAbsoluteUrl(path: string, baseUrl?: string | null): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return path;

  try {
    return new URL(path, normalizedBaseUrl).toString();
  } catch {
    return path;
  }
}

export class BookingsService {
  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly paymentsService?: PaymentsService,
  ) {
    this.stripe = env.STRIPE_SECRET_KEY
      ? new Stripe(env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-02-24.acacia',
        })
      : null;
  }

  private buildGuideAccessKey(reservationId: string, listingId: string, startDate: Date | null | undefined): string {
    const safeReservationId = reservationId.trim();
    const startISO = startDate ? toIsoDay(startDate) : '';
    const payload = `${safeReservationId}|${listingId.trim()}|${startISO}`;
    const signature = createHmac('sha256', env.BOOKING_GUIDE_ACCESS_SECRET)
      .update(payload)
      .digest('hex')
      .slice(0, 20);
    return `rg.${safeReservationId}.${signature}`;
  }

  private parseGuideAccessKey(guideKey: string): { reservationId: string; signature: string } | null {
    const trimmed = guideKey.trim();
    const match = trimmed.match(/^rg\.([a-zA-Z0-9_-]+)\.([a-f0-9]{20})$/);
    if (!match) return null;

    const reservationId = match[1]?.trim() ?? '';
    const signature = match[2]?.trim() ?? '';
    if (!reservationId || !signature) return null;

    return {
      reservationId,
      signature,
    };
  }

  private buildGuideUrl(guideAccessKey: string, listingId?: string | null, reservationId?: string | null): string {
    const basePath = `/listing/guide/${encodeURIComponent(guideAccessKey)}`;
    const params = new URLSearchParams();
    const safeListingId = readString(listingId);
    const safeReservationId = readString(reservationId);
    if (safeListingId) params.set('listingId', safeListingId);
    if (safeReservationId) params.set('reservationId', safeReservationId);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  private buildContactWithConfirmation(
    contact: Record<string, unknown>,
    confirmation: ReservationConfirmation,
  ): Record<string, unknown> {
    return {
      ...contact,
      confirmation: {
        ...asObject(contact.confirmation),
        guideAccessKey: confirmation.guideAccessKey,
        guideUrl: confirmation.guideUrl,
        generatedAt: confirmation.generatedAt,
      },
    };
  }

  private buildReservationConfirmation(
    listingId: string,
    reservationId: string,
    startDate: Date | null | undefined,
    contact: Record<string, unknown>,
  ): ReservationConfirmation {
    const rawConfirmation = asObject(contact.confirmation);
    const expectedGuideAccessKey = this.buildGuideAccessKey(reservationId, listingId, startDate);
    const sourceGuideAccessKey = readString(rawConfirmation.guideAccessKey)
      ?? readString(rawConfirmation.guideAccessToken)
      ?? readString(rawConfirmation.token);
    const guideAccessKey = sourceGuideAccessKey === expectedGuideAccessKey
      ? sourceGuideAccessKey
      : expectedGuideAccessKey;

    return {
      guideAccessKey,
      guideUrl: this.buildGuideUrl(guideAccessKey, listingId, reservationId),
      generatedAt: readString(rawConfirmation.generatedAt) ?? new Date().toISOString(),
    };
  }

  private readReservationConfirmation(
    listingId: string,
    reservationId: string,
    contactRaw: unknown,
  ): ReservationConfirmation | null {
    const contact = asObject(contactRaw);
    const rawConfirmation = asObject(contact.confirmation);
    const guideAccessKey =
      readString(rawConfirmation.guideAccessKey)
      ?? readString(rawConfirmation.guideAccessToken)
      ?? readString(rawConfirmation.token);

    if (!guideAccessKey) return null;

    return {
      guideAccessKey,
      guideUrl: readString(rawConfirmation.guideUrl) ?? this.buildGuideUrl(guideAccessKey, listingId, reservationId),
      generatedAt: readString(rawConfirmation.generatedAt) ?? new Date().toISOString(),
    };
  }

  private resolveGuideActivation(startDate: Date, now = new Date()) {
    const activeAfter = new Date(startDate.getTime() - GUIDE_ACTIVATION_WINDOW_MS);
    return {
      activeAfter,
      isActive: now.getTime() >= activeAfter.getTime(),
    };
  }

  private resolvePaymentIntentId(
    payment: Record<string, unknown>,
    cancellationState: ReservationCancellationState,
  ): string | null {
    return cancellationState.paymentIntentId ?? readString(asObject(payment.stripe).paymentIntentId);
  }

  private resolvePaymentCurrency(payment: Record<string, unknown>): string {
    const stripePayment = asObject(payment.stripe);
    return (readString(stripePayment.currency) ?? 'eur').toLowerCase();
  }

  private buildReservationCancellationDetails(
    access: ReservationAccessContext,
    options?: { now?: Date },
  ) {
    const now = options?.now ?? new Date();
    const policy = resolveCancellationPolicyFromBookings(access.listingBookings);
    const currentState = readReservationCancellationState(access.payment);
    const paymentIntentId = this.resolvePaymentIntentId(access.payment, currentState);
    const quote = resolveCancellationQuote({
      policy,
      startDate: access.startDate,
      chargedAmountMinor: currentState.chargedAmountMinor,
      now,
    });
    const effectiveState = currentState.status === 'canceled'
      ? currentState
      : {
          ...currentState,
          stage: quote.stage,
          chargedAmountMinor: quote.chargedAmountMinor,
          refundableAmountMinor: quote.refundableAmountMinor,
          retainedAmountMinor: quote.retainedAmountMinor,
          retainedPercent: quote.retainedPercent,
        };

    return {
      policy,
      quote,
      paymentIntentId,
      state: effectiveState,
      canCancel: currentState.status !== 'canceled' && quote.canCancel,
      currency: this.resolvePaymentCurrency(access.payment),
    };
  }

  private async applyStripeCancellation(input: {
    paymentIntentId: string | null;
    chargedAmountMinor: number;
    refundableAmountMinor: number;
    reservationId: string;
    listingId: string;
  }): Promise<StripeCancellationResult> {
    const chargedAmountMinor = Math.max(0, Math.round(input.chargedAmountMinor));
    const refundableAmountMinor = Math.max(0, Math.round(input.refundableAmountMinor));

    if (!input.paymentIntentId || chargedAmountMinor <= 0) {
      return {
        action: 'none',
        stripeStatus: null,
        stripeRefundId: null,
        refundedAmountMinor: 0,
      };
    }

    if (!this.stripe) {
      return {
        action: refundableAmountMinor > 0 ? 'mock_refund' : 'none',
        stripeStatus: 'mock',
        stripeRefundId: null,
        refundedAmountMinor: refundableAmountMinor,
      };
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(input.paymentIntentId);
      const currentStatus = paymentIntent.status ?? null;
      const cancellableStatuses = new Set([
        'requires_payment_method',
        'requires_confirmation',
        'requires_action',
        'requires_capture',
      ]);

      if (cancellableStatuses.has(paymentIntent.status)) {
        const canceledIntent = await this.stripe.paymentIntents.cancel(input.paymentIntentId);
        return {
          action: 'canceled',
          stripeStatus: canceledIntent.status ?? currentStatus,
          stripeRefundId: null,
          refundedAmountMinor: chargedAmountMinor,
        };
      }

      if (refundableAmountMinor <= 0) {
        return {
          action: 'none',
          stripeStatus: currentStatus,
          stripeRefundId: null,
          refundedAmountMinor: 0,
        };
      }

      const amountReceived = Math.max(
        0,
        paymentIntent.amount_received || paymentIntent.amount || chargedAmountMinor,
      );
      const amountToRefund = Math.max(0, Math.min(amountReceived, refundableAmountMinor));
      if (amountToRefund <= 0) {
        return {
          action: 'none',
          stripeStatus: currentStatus,
          stripeRefundId: null,
          refundedAmountMinor: 0,
        };
      }

      const refund = await this.stripe.refunds.create({
        payment_intent: input.paymentIntentId,
        amount: amountToRefund,
        reason: 'requested_by_customer',
        metadata: {
          reservationId: input.reservationId,
          listingId: input.listingId,
        },
      });

      return {
        action: amountToRefund < amountReceived ? 'partially_refunded' : 'refunded',
        stripeStatus: currentStatus,
        stripeRefundId: refund.id,
        refundedAmountMinor: refund.amount,
      };
    } catch (error) {
      const message = readString(asObject(error).message) ?? 'Le remboursement Stripe a échoué.';
      throw createRequestError(message, 400, 'STRIPE_CANCELLATION_FAILED', {
        reservationId: input.reservationId,
        listingId: input.listingId,
      });
    }
  }

  private composeCalendarDescription(message: string | null, guideUrl: string | null): string | null {
    const normalizedMessage = readString(message);
    const normalizedGuideUrl = readString(guideUrl);

    const lines = [
      normalizedMessage,
      normalizedGuideUrl ? `Guide d'accueil: ${normalizedGuideUrl}` : null,
    ].filter((value): value is string => Boolean(value));

    if (!lines.length) return null;
    return lines.join('\n');
  }

  private buildConversationId(reservationId: string): string {
    const safeReservationId = reservationId.trim();
    return `conversation-${safeReservationId}`;
  }

  private buildConversationSubject(guestName: string, contact: Record<string, unknown>): string {
    const safeGuestName = readString(guestName) ?? 'Voyageur';
    const phone = readString(contact.phone);
    if (!phone) return `Reservation ${safeGuestName}`;
    return `Reservation ${safeGuestName} - ${phone}`;
  }

  private mapMessageState(state: MessageState): 'sent' | 'delivered' | 'read' {
    if (state === 'read') return 'read';
    if (state === 'delivered') return 'delivered';
    return 'sent';
  }

  private mapMessageAuthor(authorRole: string): 'host' | 'guest' {
    return authorRole === 'host' ? 'host' : 'guest';
  }

  private async syncReservationMessagingInListingBookings(
    listingId: string,
    reservationId: string,
    messaging: Record<string, unknown>,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { bookings: true },
    });

    if (!listing) return;

    const bookings = asObject(listing.bookings, {
      price: 0,
      fees: [],
      'booked-days': [],
      'external-booked-days': [],
      reservations: [],
    });
    const reservations = extractReservations(bookings);

    let hasChanged = false;
    const nextReservations = reservations.map((row) => {
      if (reservationIdFromRow(row) !== reservationId) return row;
      hasChanged = true;
      return {
        ...row,
        messaging,
      };
    });

    if (!hasChanged) return;

    const nextBookings = {
      ...bookings,
      reservations: nextReservations,
    };

    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        bookings: toPrismaJson(nextBookings),
      },
    });
  }

  private async ensureReservationConversation(
    access: ReservationAccessContext,
    options?: { syncListing?: boolean },
  ): Promise<ReservationConversation> {
    const conversationSubject = this.buildConversationSubject(access.guestName, access.reservationContact);
    const desiredConversationId = this.buildConversationId(access.reservationId);

    const conversation = await this.prisma.conversation.upsert({
      where: {
        reservationId: access.reservationId,
      },
      update: {
        listingId: access.listingId,
        hostUserId: access.ownerId ?? null,
        guestTempId: access.confirmation.guideAccessKey,
        subject: conversationSubject,
      },
      create: {
        id: desiredConversationId,
        listingId: access.listingId,
        reservationId: access.reservationId,
        hostUserId: access.ownerId ?? null,
        guestTempId: access.confirmation.guideAccessKey,
        subject: conversationSubject,
      },
    });

    const seedMessageBody = readString(access.message);
    if (seedMessageBody) {
      const hasMessages = await this.prisma.message.findFirst({
        where: {
          conversationId: conversation.id,
        },
        select: {
          id: true,
        },
      });

      if (!hasMessages) {
        await this.prisma.message.create({
          data: {
            id: buildMessageId(conversation.id),
            conversationId: conversation.id,
            listingId: access.listingId,
            reservationId: access.reservationId,
            authorRole: 'guest',
            guestTempId: access.confirmation.guideAccessKey,
            body: seedMessageBody,
            state: 'read',
            sentAt: access.createdAt,
          },
        });
      }
    }

    const dbMessages = await this.prisma.message.findMany({
      where: {
        conversationId: conversation.id,
      },
      select: {
        id: true,
        authorRole: true,
        body: true,
        state: true,
        sentAt: true,
      },
      orderBy: {
        sentAt: 'asc',
      },
    });

    const messages: ReservationThreadMessage[] = dbMessages.map((message) => ({
      id: message.id,
      author: this.mapMessageAuthor(message.authorRole),
      body: message.body,
      state: this.mapMessageState(message.state),
      sentAt: message.sentAt.toISOString(),
    }));

    const nextMessaging = {
      ...asObject(access.reservationMessaging),
      conversationId: conversation.id,
      messages,
    };

    await this.prisma.reservation.update({
      where: {
        id: access.reservationId,
      },
      data: {
        messaging: toPrismaJson(nextMessaging),
      },
    });

    if (options?.syncListing) {
      await this.syncReservationMessagingInListingBookings(access.listingId, access.reservationId, nextMessaging);
    }

    return {
      id: conversation.id,
      messages,
    };
  }

  private async reservationIdUsedByAnotherListing(reservationId: string, listingId: string): Promise<boolean> {
    const existing = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { listingId: true },
    });

    if (!existing) return false;
    return existing.listingId !== listingId;
  }

  private async ensureReservationId(preferredId: string | null, listingId: string, usedReservationIds: Set<string> = new Set()): Promise<string> {
    const requestedId = preferredId ?? buildReservationId(listingId);

    let candidate = requestedId;
    let attempts = 0;

    while (attempts < 20) {
      const alreadyUsedInListing = usedReservationIds.has(candidate);
      const belongsToOtherListing = await this.reservationIdUsedByAnotherListing(candidate, listingId);

      if (!alreadyUsedInListing && !belongsToOtherListing) {
        return candidate;
      }

      candidate = buildReservationId(listingId);
      attempts += 1;
    }

    return `${buildReservationId(listingId)}-${Date.now().toString(36)}`;
  }

  async getListingBookings(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, bookings: true },
    });

    if (!listing) return null;

    return asObject(listing.bookings, {
      price: 0,
      fees: [],
      'booked-days': [],
      'external-booked-days': [],
      reservations: [],
    });
  }

  private async upsertInternalReservationEvent(listingId: string, reservation: PersistedReservation) {
    const description = this.composeCalendarDescription(reservation.message, reservation.guideUrl);

    await this.prisma.calendarEvent.upsert({
      where: {
        listingId_reservationId_source: {
          listingId,
          reservationId: reservation.id,
          source: INTERNAL_RESERVATION_SOURCE,
        },
      },
      update: {
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        summary: `Reservation ${reservation.guestName}`,
        description,
        status: 'confirmed',
        externalUid: reservation.id,
      },
      create: {
        listingId,
        reservationId: reservation.id,
        source: INTERNAL_RESERVATION_SOURCE,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        summary: `Reservation ${reservation.guestName}`,
        description,
        status: 'confirmed',
        externalUid: reservation.id,
      },
    });
  }

  private async removeInternalReservationEvent(listingId: string, reservationId: string) {
    await this.prisma.calendarEvent.deleteMany({
      where: {
        listingId,
        reservationId,
        source: INTERNAL_RESERVATION_SOURCE,
      },
    });
  }

  private async persistReservation(row: RawReservation, listingId: string): Promise<PersistedReservation> {
    const reservationId = normalizeReservationId(row.id) ?? buildReservationId(listingId);
    const guestName = typeof row.guestName === 'string' ? row.guestName : 'Voyageur';
    const startDate = parseDate(row.start) ?? new Date();
    const endDate = parseDate(row.end) ?? startDate;
    const message = typeof row.message === 'string' ? row.message : null;
    const confirmation = this.readReservationConfirmation(listingId, reservationId, row.contact);
    const payload = {
      guestName,
      guestAvatar: typeof row.guestAvatar === 'string' ? row.guestAvatar : null,
      startDate,
      endDate,
      nights: toNumber(row.nights, 1),
      message,
      internalNote: typeof row.internalNote === 'string' ? row.internalNote : null,
      guests: toPrismaJson(asObject(row.guests, {})),
      payment: toPrismaJson(asObject(row.payment, {})),
      contact: toPrismaJson(asObject(row.contact, {})),
      messaging: toPrismaJson(asObject(row.messaging, {})),
    };

    const existing = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        listingId: true,
      },
    });

    let persistedReservationId = reservationId;

    if (existing && existing.listingId === listingId) {
      await this.prisma.reservation.update({
        where: { id: reservationId },
        data: payload,
      });
    } else {
      if (existing && existing.listingId !== listingId) {
        persistedReservationId = await this.ensureReservationId(null, listingId, new Set([
          reservationId,
        ]));
      }

      await this.prisma.reservation.create({
        data: {
          id: persistedReservationId,
          listingId,
          ...payload,
        },
      });
    }

    const stripePaymentIntentId = extractStripePaymentIntentId(row);
    if (stripePaymentIntentId) {
      await this.prisma.payment.updateMany({
        where: {
          stripePaymentIntentId,
          listingId,
        },
        data: {
          reservationId: persistedReservationId,
        },
      });
    }

    return {
      id: persistedReservationId,
      guestName,
      message,
      startDate,
      endDate,
      guideUrl: confirmation?.guideUrl ?? null,
    };
  }

  private async resolveReservationAccessContext(
    reservationId: string,
    token: string,
  ): Promise<ReservationAccessContext | 'forbidden' | null> {
    const safeReservationId = reservationId.trim();
    if (!safeReservationId) return null;

    const safeToken = token.trim();
    if (!safeToken) return 'forbidden';

    const reservation = await this.prisma.reservation.findUnique({
      where: {
        id: safeReservationId,
      },
      select: {
        id: true,
        listingId: true,
        guestName: true,
        message: true,
        createdAt: true,
        startDate: true,
        endDate: true,
        nights: true,
        payment: true,
        contact: true,
        messaging: true,
        listing: {
          select: {
            core: true,
            bookings: true,
            host: true,
            arrival: true,
            owner: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                displayName: true,
                hostProfile: true,
              },
            },
          },
        },
      },
    });

    if (!reservation) return null;

    const confirmation = this.readReservationConfirmation(reservation.listingId, reservation.id, reservation.contact);
    if (!confirmation) return 'forbidden';

    const expectedGuideAccessKey = this.buildGuideAccessKey(
      reservation.id,
      reservation.listingId,
      reservation.startDate,
    );
    if (safeToken !== expectedGuideAccessKey) return 'forbidden';
    if (confirmation.guideAccessKey !== expectedGuideAccessKey) return 'forbidden';

    return {
      reservationId: reservation.id,
      listingId: reservation.listingId,
      guestName: reservation.guestName,
      message: reservation.message,
      createdAt: reservation.createdAt,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      nights: reservation.nights,
      payment: asObject(reservation.payment),
      reservationContact: asObject(reservation.contact),
      reservationMessaging: asObject(reservation.messaging),
      listingHost: asObject(reservation.listing.host),
      listingArrival: asObject(reservation.listing.arrival),
      listingCore: asObject(reservation.listing.core),
      listingBookings: asObject(reservation.listing.bookings),
      ownerId: readString(reservation.listing.owner?.id),
      ownerEmail: readString(reservation.listing.owner?.email),
      ownerDisplayName: resolveOwnerDisplayName(asObject(reservation.listing.owner)),
      confirmation,
    };
  }

  async getBookingConfirmation(
    reservationId: string,
    token: string,
    options?: { publicBaseUrl?: string | null },
  ) {
    const access = await this.resolveReservationAccessContext(reservationId, token);
    if (!access || access === 'forbidden') return access;
    const conversation = await this.ensureReservationConversation(access);

    const payment = access.payment;
    const host = access.listingHost;
    const hostContact = asObject(host.contact);
    const practical = asObject(access.listingArrival.practical);
    const services = asObject(practical.services);
    const activation = this.resolveGuideActivation(access.startDate);
    const cancellationDetails = this.buildReservationCancellationDetails(access);

    const totalAmount = Math.max(0, Math.round(toNumber(payment.total, 0)));
    const currency = cancellationDetails.currency;

    const hostNameFromListing = readString(host.name);
    const resolvedHostName = (
      hostNameFromListing && !isDeprecatedHostIdentity(hostNameFromListing) ? hostNameFromListing : null
    ) ?? access.ownerDisplayName ?? readEmailLocalPart(access.ownerEmail) ?? 'Proprietaire';

    return {
      reservationId: access.reservationId,
      listingId: access.listingId,
      stay: {
        startISO: toIsoDay(access.startDate),
        endISO: toIsoDay(access.endDate),
        nights: Math.max(1, Math.trunc(toNumber(access.nights, 1))),
        totalAmount,
        currency,
      },
      host: {
        name: resolvedHostName,
        status: readString(host.status),
        avatar: readString(host.avatar),
        catalogLink: readString(host['catalog-link']) ?? readString(host.catalogLink),
        phone: readString(host.phone) ?? readString(hostContact.phone),
        email: readString(host.email) ?? readString(hostContact.email) ?? access.ownerEmail,
        assistance: readString(services.assistance),
        contacts: readString(services.contacts),
      },
      guide: {
        url: buildAbsoluteUrl(access.confirmation.guideUrl, options?.publicBaseUrl),
        guideAccessKey: access.confirmation.guideAccessKey,
        isActive: activation.isActive,
        activeAfterISO: activation.activeAfter.toISOString(),
      },
      cancellation: {
        status: cancellationDetails.state.status,
        canCancel: cancellationDetails.canCancel,
        canceledAtISO: cancellationDetails.state.canceledAtISO,
        reason: cancellationDetails.state.reason,
        policy: {
          policy: cancellationDetails.policy.policy,
          days: cancellationDetails.policy.days,
          feePercent: cancellationDetails.policy.feePercent,
          lateFeePercent: cancellationDetails.policy.lateFeePercent,
        },
        refund: {
          stage: cancellationDetails.state.stage,
          currency,
          chargedAmount: toMajorUnit(cancellationDetails.state.chargedAmountMinor),
          refundableAmount: toMajorUnit(cancellationDetails.state.refundableAmountMinor),
          retainedAmount: toMajorUnit(cancellationDetails.state.retainedAmountMinor),
          retainedPercent: cancellationDetails.state.retainedPercent,
          paymentIntentId: cancellationDetails.paymentIntentId,
        },
      },
      messaging: {
        conversationId: conversation.id,
      },
    };
  }

  async getReservationGuideAccess(
    guideKey: string,
    options?: { publicBaseUrl?: string | null },
  ) {
    const parsedGuideKey = this.parseGuideAccessKey(guideKey);
    if (!parsedGuideKey) return 'forbidden' as const;

    const access = await this.resolveReservationAccessContext(parsedGuideKey.reservationId, guideKey);
    if (!access || access === 'forbidden') return access;

    const activation = this.resolveGuideActivation(access.startDate);
    const conversation = await this.ensureReservationConversation(access);
    const absoluteGuideUrl = buildAbsoluteUrl(access.confirmation.guideUrl, options?.publicBaseUrl);
    const host = access.listingHost;
    const hostContact = asObject(host.contact);
    const hostNameFromListing = readString(host.name);
    const resolvedHostName = (
      hostNameFromListing && !isDeprecatedHostIdentity(hostNameFromListing) ? hostNameFromListing : null
    ) ?? access.ownerDisplayName ?? readEmailLocalPart(access.ownerEmail) ?? 'Proprietaire';

    return {
      guideKey: access.confirmation.guideAccessKey,
      status: activation.isActive ? 'active' as const : 'locked' as const,
      activeAfterISO: activation.activeAfter.toISOString(),
      reservation: {
        id: access.reservationId,
        guestName: access.guestName,
        startISO: toIsoDay(access.startDate),
        endISO: toIsoDay(access.endDate),
        nights: Math.max(1, Math.trunc(toNumber(access.nights, 1))),
      },
      listing: {
        id: access.listingId,
      },
      host: {
        name: resolvedHostName,
        status: readString(host.status),
        avatar: readString(host.avatar),
        email: readString(host.email) ?? readString(hostContact.email) ?? access.ownerEmail,
        phone: readString(host.phone) ?? readString(hostContact.phone),
      },
      guide: {
        url: absoluteGuideUrl,
        relativeUrl: access.confirmation.guideUrl,
      },
      messaging: {
        conversationId: conversation.id,
      },
    };
  }

  async getGuideConversation(guideKey: string) {
    const parsedGuideKey = this.parseGuideAccessKey(guideKey);
    if (!parsedGuideKey) return 'forbidden' as const;

    const access = await this.resolveReservationAccessContext(parsedGuideKey.reservationId, guideKey);
    if (!access || access === 'forbidden') return access;

    const activation = this.resolveGuideActivation(access.startDate);
    if (!activation.isActive) return 'locked' as const;

    const conversation = await this.ensureReservationConversation(access);

    return {
      conversationId: conversation.id,
      reservationId: access.reservationId,
      messages: conversation.messages,
    };
  }

  async sendGuideConversationMessage(guideKey: string, body: string) {
    const parsedGuideKey = this.parseGuideAccessKey(guideKey);
    if (!parsedGuideKey) return 'forbidden' as const;

    const access = await this.resolveReservationAccessContext(parsedGuideKey.reservationId, guideKey);
    if (!access || access === 'forbidden') return access;

    const activation = this.resolveGuideActivation(access.startDate);
    if (!activation.isActive) return 'locked' as const;

    const messageBody = readString(body);
    if (!messageBody) return 'forbidden' as const;

    const conversation = await this.ensureReservationConversation(access);
    const created = await this.prisma.message.create({
      data: {
        id: buildMessageId(conversation.id),
        conversationId: conversation.id,
        listingId: access.listingId,
        reservationId: access.reservationId,
        authorRole: 'guest',
        guestTempId: access.confirmation.guideAccessKey,
        body: messageBody,
        state: 'sent',
        sentAt: new Date(),
      },
      select: {
        id: true,
        authorRole: true,
        body: true,
        state: true,
        sentAt: true,
      },
    });

    await this.prisma.conversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    const refreshedConversation = await this.ensureReservationConversation(access, {
      syncListing: true,
    });

    return {
      conversationId: refreshedConversation.id,
      message: {
        id: created.id,
        author: this.mapMessageAuthor(created.authorRole),
        body: created.body,
        state: this.mapMessageState(created.state),
        sentAt: created.sentAt.toISOString(),
      },
      messages: refreshedConversation.messages,
    };
  }

  async exportReservationStayCalendar(
    reservationId: string,
    token: string,
    options?: { publicBaseUrl?: string | null },
  ): Promise<string | 'forbidden' | null> {
    const access = await this.resolveReservationAccessContext(reservationId, token);
    if (!access || access === 'forbidden') return access;

    const guideUrl = buildAbsoluteUrl(access.confirmation.guideUrl, options?.publicBaseUrl);
    const listingTitle = readString(access.listingCore.title) ?? access.listingId;
    const normalizedGuestName = readString(access.guestName) ?? 'Voyageur';
    const description = this.composeCalendarDescription(access.message, guideUrl);

    const calendar = ical({
      name: `IndieHost reservation ${access.reservationId}`,
      prodId: {
        company: 'IndieHost',
        product: env.ICAL_EXPORT_DEFAULT_PRODID,
      },
      timezone: 'UTC',
    });

    calendar.method(ICalCalendarMethod.PUBLISH);
    calendar.createEvent({
      id: access.reservationId,
      start: access.startDate,
      end: access.endDate,
      allDay: true,
      summary: `Sejour ${normalizedGuestName} - ${listingTitle}`,
      description: description ?? undefined,
      url: guideUrl,
      status: ICalEventStatus.CONFIRMED,
    });

    return calendar.toString();
  }

  async cancelBooking(
    reservationId: string,
    token: string,
    options?: { reason?: string | null; publicBaseUrl?: string | null },
  ) {
    const access = await this.resolveReservationAccessContext(reservationId, token);
    if (!access || access === 'forbidden') return access;

    const cancellationDetails = this.buildReservationCancellationDetails(access);
    if (cancellationDetails.state.status === 'canceled') {
      return this.getBookingConfirmation(reservationId, token, {
        publicBaseUrl: options?.publicBaseUrl,
      });
    }

    if (!cancellationDetails.canCancel) {
      throw createRequestError(
        'Cette réservation ne peut plus être annulée en ligne.',
        409,
        'BOOKING_NOT_CANCELLABLE',
        {
          reservationId: access.reservationId,
          stage: cancellationDetails.quote.stage,
        },
      );
    }

    const reason = readString(options?.reason) ?? null;
    const canceledAtISO = new Date().toISOString();
    const stripeResult = await this.applyStripeCancellation({
      paymentIntentId: cancellationDetails.paymentIntentId,
      chargedAmountMinor: cancellationDetails.quote.chargedAmountMinor,
      refundableAmountMinor: cancellationDetails.quote.refundableAmountMinor,
      reservationId: access.reservationId,
      listingId: access.listingId,
    });

    const effectiveRefundMinor = (cancellationDetails.paymentIntentId && this.stripe)
      ? Math.max(0, Math.min(cancellationDetails.quote.chargedAmountMinor, stripeResult.refundedAmountMinor))
      : cancellationDetails.quote.refundableAmountMinor;
    const effectiveRetainedMinor = Math.max(0, cancellationDetails.quote.chargedAmountMinor - effectiveRefundMinor);
    const effectiveRetainedPercent = cancellationDetails.quote.chargedAmountMinor > 0
      ? Math.round((effectiveRetainedMinor / cancellationDetails.quote.chargedAmountMinor) * 100)
      : 0;

    const nextPayment = {
      ...access.payment,
      cancellation: {
        status: 'canceled',
        canceledAtISO,
        reason,
        stage: cancellationDetails.quote.stage,
        chargedAmountMinor: cancellationDetails.quote.chargedAmountMinor,
        refundableAmountMinor: effectiveRefundMinor,
        retainedAmountMinor: effectiveRetainedMinor,
        retainedPercent: effectiveRetainedPercent,
        paymentIntentId: cancellationDetails.paymentIntentId,
        stripeAction: stripeResult.action,
        stripeStatus: stripeResult.stripeStatus,
        stripeRefundId: stripeResult.stripeRefundId,
      },
    };

    await this.prisma.reservation.update({
      where: {
        id: access.reservationId,
      },
      data: {
        payment: toPrismaJson(nextPayment),
      },
    });

    const listing = await this.prisma.listing.findUnique({
      where: { id: access.listingId },
      select: { bookings: true },
    });

    if (listing) {
      const bookings = asObject(listing.bookings, {
        price: 0,
        fees: [],
        'booked-days': [],
        'external-booked-days': [],
        reservations: [],
      });
      const reservations = extractReservations(bookings);
      const bookedDays = extractBookedDays(bookings);
      const reservationIndex = reservations.findIndex((row) => reservationIdFromRow(row) === access.reservationId);

      if (reservationIndex >= 0) {
        const removedReservation = reservations[reservationIndex];
        const nextReservations = reservations.filter((_, index) => index !== reservationIndex);
        const removedStart = normalizeDayValue(removedReservation?.start);
        const removedEnd = normalizeDayValue(removedReservation?.end);
        const hasSameRangeRemaining = Boolean(
          removedStart
          && removedEnd
          && nextReservations.some((row) => normalizeDayValue(row.start) === removedStart && normalizeDayValue(row.end) === removedEnd),
        );

        let removedBookedDay = false;
        const nextBookedDays = bookedDays.filter((row) => {
          if (hasSameRangeRemaining || !removedStart || !removedEnd) return true;
          if (removedBookedDay) return true;
          const start = normalizeDayValue(row.start);
          const end = normalizeDayValue(row.end);
          const isTarget = start === removedStart && end === removedEnd;
          if (isTarget) {
            removedBookedDay = true;
            return false;
          }
          return true;
        });

        await this.prisma.listing.update({
          where: { id: access.listingId },
          data: {
            bookings: toPrismaJson({
              ...bookings,
              reservations: nextReservations,
              'booked-days': nextBookedDays,
            }),
          },
        });
      }
    }

    await this.removeInternalReservationEvent(access.listingId, access.reservationId);

    const paymentLookup = [
      {
        reservationId: access.reservationId,
        listingId: access.listingId,
      },
      ...(cancellationDetails.paymentIntentId
        ? [{
            stripePaymentIntentId: cancellationDetails.paymentIntentId,
            listingId: access.listingId,
          }]
        : []),
    ];
    const linkedPayment = await this.prisma.payment.findFirst({
      where: {
        OR: paymentLookup,
      },
      select: {
        id: true,
        metadata: true,
        rawResponse: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (linkedPayment) {
      const nextStatus = effectiveRefundMinor <= 0
        ? 'canceled'
        : effectiveRefundMinor < cancellationDetails.quote.chargedAmountMinor
          ? 'partially_refunded'
          : 'refunded';
      const cancellationPayload = {
        canceledAtISO,
        reason,
        stage: cancellationDetails.quote.stage,
        chargedAmountMinor: cancellationDetails.quote.chargedAmountMinor,
        refundableAmountMinor: effectiveRefundMinor,
        retainedAmountMinor: effectiveRetainedMinor,
        retainedPercent: effectiveRetainedPercent,
        paymentIntentId: cancellationDetails.paymentIntentId,
        stripeAction: stripeResult.action,
        stripeStatus: stripeResult.stripeStatus,
        stripeRefundId: stripeResult.stripeRefundId,
      };

      await this.prisma.payment.update({
        where: {
          id: linkedPayment.id,
        },
        data: {
          status: nextStatus,
          metadata: toPrismaJson({
            ...asObject(linkedPayment.metadata),
            bookingCancellation: cancellationPayload,
          }),
          rawResponse: toPrismaJson({
            ...asObject(linkedPayment.rawResponse),
            bookingCancellation: cancellationPayload,
          }),
        },
      });
    }

    return this.getBookingConfirmation(access.reservationId, token, {
      publicBaseUrl: options?.publicBaseUrl,
    });
  }

  async createBooking(input: Record<string, unknown>) {
    const listingId = String(input.listingId ?? '').trim();
    if (this.paymentsService) {
      const reservable = await this.paymentsService.ensureListingReservable(listingId);
      if (!reservable) return null;
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        bookings: true,
      },
    });

    if (!listing) return null;

    const bookings = asObject(listing.bookings, {
      price: 0,
      fees: [],
      'booked-days': [],
      'external-booked-days': [],
      reservations: [],
    });

    const existingReservations = extractReservations(bookings);
    const bookedDays = extractBookedDays(bookings);
    const usedReservationIds = new Set(
      existingReservations
        .map((reservation) => reservationIdFromRow(reservation))
        .filter((value): value is string => Boolean(value)),
    );
    const requestedReservationId = normalizeReservationId(input.id);
    const safeReservationId = await this.ensureReservationId(requestedReservationId, listingId, usedReservationIds);
    const reservations = existingReservations.filter((reservation) => reservationIdFromRow(reservation) !== safeReservationId);
    const rawContact = asObject(input.contact, {});
    const confirmation = this.buildReservationConfirmation(
      listingId,
      safeReservationId,
      parseDate(input.start),
      rawContact,
    );
    const contact = this.buildContactWithConfirmation(rawContact, confirmation);

    const reservation: RawReservation = {
      id: safeReservationId,
      start: input.start,
      end: input.end,
      nights: input.nights,
      guestName: input.guestName,
      guestAvatar: input.guestAvatar,
      message: input.message,
      internalNote: input.internalNote,
      guests: asObject(input.guests, {}),
      payment: asObject(input.payment, {}),
      contact,
      confirmation: {
        guideAccessKey: confirmation.guideAccessKey,
        guideUrl: confirmation.guideUrl,
        generatedAt: confirmation.generatedAt,
      },
      createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
      messaging: asObject(input.messaging, {}),
    };

    reservations.unshift(reservation);

    const start = normalizeDayValue(input.start);
    const end = normalizeDayValue(input.end);

    if (start && end) {
      appendBookedDayIfMissing(bookedDays, start, end);
    }

    const nextBookings = {
      ...bookings,
      reservations,
      'booked-days': bookedDays,
    };

    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        bookings: toPrismaJson(nextBookings),
      },
    });

    const persistedReservation = await this.persistReservation(reservation, listingId);
    let responseReservationId = persistedReservation.id;
    let responseConfirmation = confirmation;
    let responseBookings = nextBookings;

    if (persistedReservation.id !== safeReservationId) {
      const remappedConfirmation = this.buildReservationConfirmation(
        listingId,
        persistedReservation.id,
        parseDate(reservations[0]?.start),
        asObject(reservations[0]?.contact),
      );
      const remappedContact = this.buildContactWithConfirmation(asObject(reservations[0]?.contact), remappedConfirmation);

      reservations[0] = {
        ...reservations[0],
        id: persistedReservation.id,
        contact: remappedContact,
        confirmation: {
          guideAccessKey: remappedConfirmation.guideAccessKey,
          guideUrl: remappedConfirmation.guideUrl,
          generatedAt: remappedConfirmation.generatedAt,
        },
      };

      const syncedBookings = {
        ...nextBookings,
        reservations,
      };

      await this.prisma.reservation.update({
        where: {
          id: persistedReservation.id,
        },
        data: {
          contact: toPrismaJson(remappedContact),
        },
      });

      await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          bookings: toPrismaJson(syncedBookings),
        },
      });
      responseReservationId = persistedReservation.id;
      responseConfirmation = remappedConfirmation;
      responseBookings = syncedBookings;
    }

    let responseConversationId: string | null = null;
    const createAccess = await this.resolveReservationAccessContext(
      responseReservationId,
      responseConfirmation.guideAccessKey,
    );
    if (createAccess && createAccess !== 'forbidden') {
      const conversation = await this.ensureReservationConversation(createAccess, {
        syncListing: true,
      });
      responseConversationId = conversation.id;

      const responseReservations = extractReservations(responseBookings).map((row) => {
        if (reservationIdFromRow(row) !== responseReservationId) return row;
        return {
          ...row,
          messaging: {
            conversationId: conversation.id,
            messages: conversation.messages,
          },
        };
      });
      responseBookings = {
        ...responseBookings,
        reservations: responseReservations,
      };
    }

    await this.upsertInternalReservationEvent(listingId, {
      ...persistedReservation,
      id: responseReservationId,
      guideUrl: responseConfirmation.guideUrl,
    });

    if (this.paymentsService) {
      try {
        await this.paymentsService.enforceTrialReservationLimitForListing(listingId);
      } catch (error) {
        console.error('[bookings] failed to enforce trial reservation limit', {
          listingId,
          reservationId: responseReservationId,
          error,
        });
      }
    }

    return {
      reservationId: responseReservationId,
      listingId,
      confirmation: {
        guideAccessKey: responseConfirmation.guideAccessKey,
        guideUrl: responseConfirmation.guideUrl,
      },
      messaging: responseConversationId
        ? {
            conversationId: responseConversationId,
          }
        : undefined,
      bookings: responseBookings,
    };
  }

  async updateBooking(reservationId: string, listingId: string, patch: Record<string, unknown>) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        bookings: true,
      },
    });

    if (!listing) return null;

    const bookings = asObject(listing.bookings, {
      price: 0,
      fees: [],
      'booked-days': [],
      'external-booked-days': [],
      reservations: [],
    });

    const reservations = extractReservations(bookings);
    const bookedDays = extractBookedDays(bookings);
    const index = reservations.findIndex((item) => reservationIdFromRow(item) === reservationId);

    if (index < 0) return 'not_found' as const;

    const usedReservationIds = new Set(
      reservations
        .filter((_, itemIndex) => itemIndex !== index)
        .map((reservation) => reservationIdFromRow(reservation))
        .filter((value): value is string => Boolean(value)),
    );
    const safeReservationId = await this.ensureReservationId(reservationId, listingId, usedReservationIds);

    const updatedReservation = deepMerge(reservations[index] ?? {}, patch) as RawReservation;
    updatedReservation.id = safeReservationId;
    const updatedContact = asObject(updatedReservation.contact);
    const updatedConfirmation = this.buildReservationConfirmation(
      listingId,
      safeReservationId,
      parseDate(updatedReservation.start),
      updatedContact,
    );
    updatedReservation.contact = this.buildContactWithConfirmation(updatedContact, updatedConfirmation);
    updatedReservation.confirmation = {
      guideAccessKey: updatedConfirmation.guideAccessKey,
      guideUrl: updatedConfirmation.guideUrl,
      generatedAt: updatedConfirmation.generatedAt,
    };
    reservations[index] = updatedReservation;

    const updatedStart = normalizeDayValue(updatedReservation.start);
    const updatedEnd = normalizeDayValue(updatedReservation.end);
    if (updatedStart && updatedEnd) {
      appendBookedDayIfMissing(bookedDays, updatedStart, updatedEnd);
    }

    const nextBookings = {
      ...bookings,
      reservations,
      'booked-days': bookedDays,
    };

    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        bookings: toPrismaJson(nextBookings),
      },
    });

    const persistedReservation = await this.persistReservation(updatedReservation, listingId);
    let finalReservationId = persistedReservation.id;
    let finalConfirmation = updatedConfirmation;

    if (persistedReservation.id !== reservationId) {
      await this.removeInternalReservationEvent(listingId, reservationId);
    }

    if (persistedReservation.id !== safeReservationId) {
      finalConfirmation = this.buildReservationConfirmation(
        listingId,
        persistedReservation.id,
        parseDate(updatedReservation.start),
        asObject(updatedReservation.contact),
      );
      updatedReservation.contact = this.buildContactWithConfirmation(asObject(updatedReservation.contact), finalConfirmation);
      updatedReservation.confirmation = {
        guideAccessKey: finalConfirmation.guideAccessKey,
        guideUrl: finalConfirmation.guideUrl,
        generatedAt: finalConfirmation.generatedAt,
      };
      updatedReservation.id = persistedReservation.id;
      reservations[index] = updatedReservation;

      const syncedBookings = {
        ...nextBookings,
        reservations,
      };

      await this.prisma.reservation.update({
        where: {
          id: persistedReservation.id,
        },
        data: {
          contact: toPrismaJson(asObject(updatedReservation.contact)),
        },
      });

      await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          bookings: toPrismaJson(syncedBookings),
        },
      });
    }

    if (updatedReservation.id !== persistedReservation.id) {
      updatedReservation.id = persistedReservation.id;
    }

    finalReservationId = updatedReservation.id as string;
    const updateAccess = await this.resolveReservationAccessContext(
      finalReservationId,
      finalConfirmation.guideAccessKey,
    );
    if (updateAccess && updateAccess !== 'forbidden') {
      const conversation = await this.ensureReservationConversation(updateAccess, {
        syncListing: true,
      });
      updatedReservation.messaging = {
        ...asObject(updatedReservation.messaging),
        conversationId: conversation.id,
        messages: conversation.messages,
      };
    }

    await this.upsertInternalReservationEvent(listingId, {
      ...persistedReservation,
      id: finalReservationId,
      guideUrl: finalConfirmation.guideUrl,
    });

    if (this.paymentsService) {
      try {
        await this.paymentsService.enforceTrialReservationLimitForListing(listingId);
      } catch (error) {
        console.error('[bookings] failed to enforce trial reservation limit', {
          listingId,
          reservationId: finalReservationId,
          error,
        });
      }
    }

    return updatedReservation;
  }
}
