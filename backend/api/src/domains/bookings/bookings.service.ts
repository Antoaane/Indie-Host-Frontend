import { createHmac } from 'node:crypto';
import type { MessageState, Prisma, PrismaClient } from '@prisma/client';
import ical, { ICalCalendarMethod, ICalEventStatus } from 'ical-generator';
import Stripe from 'stripe';

import { env } from '../../config/env.js';
import { acquireListingBookingLock } from '../../lib/advisoryLock.js';
import { buildGuideAccessKey, parseGuideAccessKey, toIsoDay } from '../../lib/guideKey.js';
import { deepMerge, asObject, toNumber } from '../../lib/json.js';
import { buildMessageId, buildReservationId } from '../../lib/id.js';
import { toPrismaJson } from '../../lib/prisma.js';
import { hasAdminAccess } from '../../lib/authRole.js';
import type { RequestAuth } from '../../types/auth.js';
import { PaymentsService } from '../payments/payments.service.js';
import { isReservationRangeAvailable } from '../payments/reservationPricing.js';
import { notifications } from '../notifications/notifications.service.js';
import {
  CANCELLATION_FEE_MAX,
  resolveCancellationOutcome,
  resolveCancellationPolicy,
  type CancellationStage,
  type ResolvedCancellationPolicy,
} from './cancellationPolicy.js';
import { isDeprecatedHostIdentity, upsertUserFromAuth } from '../users/users.repository.js';

type RawReservation = Record<string, unknown>;

// Client Prisma hors ou dans une transaction interactive (PrismaClient satisfait TransactionClient).
type DbClient = Prisma.TransactionClient;

// Rattachement d'une ligne Payment à la réservation écrite :
// - `required` (voyageur) : le paiement doit exister et n'être rattaché à aucune réservation, sinon
//   la transaction est annulée ;
// - `optional` (hôte / admin) : rattachement si possible, jamais bloquant.
type PaymentAttachmentMode = 'required' | 'optional';

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

// Barème d'annulation (politiques, paliers, stades) : voir ./cancellationPolicy.ts, miroir du front.

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
// Transaction de création : l'attente du verrou d'annonce compte dans ce délai.
const BOOKING_TRANSACTION_MAX_WAIT_MS = 5_000;
const BOOKING_TRANSACTION_TIMEOUT_MS = 20_000;
// Nouvel objet à chaque appel : asObject() renvoie le repli par référence.
const emptyBookings = (): Record<string, unknown> => ({
  price: 0,
  fees: [],
  'booked-days': [],
  'external-booked-days': [],
  reservations: [],
});
const GUIDE_ACTIVATION_WINDOW_MS = 48 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

type VerifiedReservationPayment = Awaited<ReturnType<PaymentsService['verifyReservationPayment']>>;

// Même forme que le paiement construit par le parcours de réservation du front, mais avec les
// montants et statuts lus dans la ligne Payment et chez Stripe.
function buildVerifiedReservationPayment(
  clientPayment: Record<string, unknown>,
  verified: VerifiedReservationPayment,
): Record<string, unknown> {
  return {
    ...clientPayment,
    total: toMajorUnit(verified.totalAmountMinor),
    deposit: toMajorUnit(verified.chargeNowAmountMinor),
    balance: toMajorUnit(verified.deferredAmountMinor),
    status: verified.deferredAmountMinor === 0 ? 'paid' : 'pending',
    method: verified.choice === 'cash' ? 'En ligne + Espèces' : 'En ligne',
    stripe: {
      ...asObject(clientPayment.stripe),
      paymentIntentId: verified.paymentIntentId,
      status: verified.status,
      currency: verified.currency,
      connectedAccountId: verified.connectedAccountId,
      paymentChoice: verified.choice,
      chargeNowAmount: toMajorUnit(verified.chargeNowAmountMinor),
      deferredAmount: toMajorUnit(verified.deferredAmountMinor),
      deferredMode: verified.deferredMode,
      deferredDueDateISO: verified.deferredDueDateISO,
    },
  };
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

function resolveCancellationPolicyFromBookings(bookings: Record<string, unknown>): ResolvedCancellationPolicy {
  // Même résolution que le front (préférences `bookings.pricing.cancellation`, valeurs bornées, secours).
  return resolveCancellationPolicy(asObject(asObject(bookings.pricing).cancellation));
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
  // Palier du barème partagé (arrivée dépassée → non remboursable → moins de 24 h → délai de la politique).
  const { stage, retainedPercent, canCancel } = resolveCancellationOutcome(input.policy, msUntilArrival / DAY_MS);

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
          : stageRaw === 'non_refundable'
            ? 'non_refundable'
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
    const expectedGuideAccessKey = buildGuideAccessKey(reservationId, listingId, startDate);
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

    // L'identifiant du PaymentIntent vient du JSON de la réservation : on ne rembourse que s'il a
    // été créé par l'API pour cette annonce et n'est rattaché à aucune autre réservation.
    const paymentRecord = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: input.paymentIntentId },
      select: { listingId: true, reservationId: true, stripeConnectedAccountId: true },
    });
    // Paiement direct : le PaymentIntent vit sur le compte Stripe de l'hôte. Un ancien paiement
    // créé sur la plateforme (destination charge) n'a pas de compte à cibler.
    const stripeAccountOptions = paymentRecord?.stripeConnectedAccountId
      ? { stripeAccount: paymentRecord.stripeConnectedAccountId }
      : undefined;
    const ownsPaymentIntent = Boolean(
      paymentRecord
      && paymentRecord.listingId === input.listingId
      && (!paymentRecord.reservationId || paymentRecord.reservationId === input.reservationId),
    );
    if (!ownsPaymentIntent) {
      console.warn('[bookings] refund skipped: payment intent not linked to this reservation', {
        reservationId: input.reservationId,
        listingId: input.listingId,
      });
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
      const paymentIntent = await this.stripe.paymentIntents.retrieve(input.paymentIntentId, {}, stripeAccountOptions);
      const currentStatus = paymentIntent.status ?? null;
      if (paymentIntent.metadata?.listingId !== input.listingId) {
        console.warn('[bookings] refund skipped: payment intent metadata does not match the listing', {
          reservationId: input.reservationId,
          listingId: input.listingId,
        });
        return {
          action: 'none',
          stripeStatus: currentStatus,
          stripeRefundId: null,
          refundedAmountMinor: 0,
        };
      }
      const cancellableStatuses = new Set([
        'requires_payment_method',
        'requires_confirmation',
        'requires_action',
        'requires_capture',
      ]);

      if (cancellableStatuses.has(paymentIntent.status)) {
        const canceledIntent = await this.stripe.paymentIntents.cancel(input.paymentIntentId, {}, stripeAccountOptions);
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

      // Paiement direct : le remboursement est débité du solde Stripe de l'hôte. Pour un ancien
      // paiement reversé (destination charge), reverse_transfer reprend la somme sur son compte.
      const isDestinationCharge = Boolean(paymentIntent.transfer_data?.destination);
      const refund = await this.stripe.refunds.create({
        payment_intent: input.paymentIntentId,
        amount: amountToRefund,
        reason: 'requested_by_customer',
        ...(isDestinationCharge ? { reverse_transfer: true } : {}),
        ...(paymentIntent.application_fee_amount ? { refund_application_fee: true } : {}),
        metadata: {
          reservationId: input.reservationId,
          listingId: input.listingId,
        },
      }, stripeAccountOptions);

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

  // Rembourse un paiement vérifié dont la réservation n'a pas pu être créée (dates prises entre la
  // vérification et l'écriture sous verrou). Ne lève jamais : un échec est journalisé pour
  // traitement manuel, et le 409 d'origine est renvoyé au voyageur.
  private async refundUnplaceableReservationPayment(input: {
    listingId: string;
    paymentIntentId: string;
    chargedAmountMinor: number;
  }): Promise<boolean> {
    try {
      const result = await this.applyStripeCancellation({
        paymentIntentId: input.paymentIntentId,
        chargedAmountMinor: input.chargedAmountMinor,
        refundableAmountMinor: input.chargedAmountMinor,
        reservationId: '',
        listingId: input.listingId,
      });
      if (result.action === 'none') {
        console.error('[bookings] orphan payment left unrefunded after a lost booking race', {
          listingId: input.listingId,
          paymentIntentId: input.paymentIntentId,
        });
        return false;
      }

      await this.prisma.payment.updateMany({
        where: { stripePaymentIntentId: input.paymentIntentId, listingId: input.listingId, reservationId: null },
        data: {
          status: result.action === 'canceled' ? 'canceled' : 'refunded',
        },
      });
      return true;
    } catch (error) {
      console.error('[bookings] orphan payment refund failed after a lost booking race', {
        listingId: input.listingId,
        paymentIntentId: input.paymentIntentId,
        error,
      });
      return false;
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

  private async reservationIdUsedByAnotherListing(db: DbClient, reservationId: string, listingId: string): Promise<boolean> {
    const existing = await db.reservation.findUnique({
      where: { id: reservationId },
      select: { listingId: true },
    });

    if (!existing) return false;
    return existing.listingId !== listingId;
  }

  private async ensureReservationId(
    db: DbClient,
    preferredId: string | null,
    listingId: string,
    usedReservationIds: Set<string> = new Set(),
  ): Promise<string> {
    const requestedId = preferredId ?? buildReservationId(listingId);

    let candidate = requestedId;
    let attempts = 0;

    while (attempts < 20) {
      const alreadyUsedInListing = usedReservationIds.has(candidate);
      const belongsToOtherListing = await this.reservationIdUsedByAnotherListing(db, candidate, listingId);

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

  private async upsertInternalReservationEvent(db: DbClient, listingId: string, reservation: PersistedReservation) {
    const description = this.composeCalendarDescription(reservation.message, reservation.guideUrl);

    await db.calendarEvent.upsert({
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

  private async removeInternalReservationEvent(db: DbClient, listingId: string, reservationId: string) {
    await db.calendarEvent.deleteMany({
      where: {
        listingId,
        reservationId,
        source: INTERNAL_RESERVATION_SOURCE,
      },
    });
  }

  /**
   * Rattache la ligne Payment du PaymentIntent à la réservation par une écriture conditionnelle
   * (`reservationId IS NULL`) : elle ne peut réussir qu'une seule fois, même pour deux requêtes
   * simultanées. En mode `required`, un échec annule la transaction appelante (409).
   */
  private async attachPaymentToReservation(db: DbClient, input: {
    stripePaymentIntentId: string;
    listingId: string;
    reservationId: string;
    mode: PaymentAttachmentMode;
  }): Promise<void> {
    const alreadyLinked = await db.payment.findFirst({
      where: {
        stripePaymentIntentId: input.stripePaymentIntentId,
        listingId: input.listingId,
        reservationId: input.reservationId,
      },
      select: { id: true },
    });
    // Ré-enregistrement de la même réservation : rien à faire.
    if (alreadyLinked) return;

    if (input.mode === 'optional') {
      // Une autre ligne Payment pointe déjà sur cette réservation : l'index unique interdirait le
      // rattachement, on garde le lien existant (le remboursement retrouve aussi le paiement par
      // son PaymentIntent).
      const otherPaymentLinked = await db.payment.findFirst({
        where: {
          reservationId: input.reservationId,
          NOT: { stripePaymentIntentId: input.stripePaymentIntentId },
        },
        select: { id: true },
      });
      if (otherPaymentLinked) {
        console.warn('[bookings] payment attachment skipped: another payment is already linked to this reservation', {
          reservationId: input.reservationId,
          listingId: input.listingId,
        });
        return;
      }
    }

    const attached = await db.payment.updateMany({
      where: {
        stripePaymentIntentId: input.stripePaymentIntentId,
        listingId: input.listingId,
        reservationId: null,
      },
      data: {
        reservationId: input.reservationId,
      },
    });
    if (attached.count === 1) return;

    if (input.mode === 'required') {
      throw createRequestError(
        'Ce paiement est déjà associé à une autre réservation.',
        409,
        'RESERVATION_PAYMENT_ALREADY_USED',
        {
          listingId: input.listingId,
          paymentIntentId: input.stripePaymentIntentId,
        },
      );
    }

    console.warn('[bookings] payment attachment skipped: payment intent missing or already used', {
      reservationId: input.reservationId,
      listingId: input.listingId,
    });
  }

  private async persistReservation(
    db: DbClient,
    row: RawReservation,
    listingId: string,
    options: { paymentAttachment: PaymentAttachmentMode },
  ): Promise<PersistedReservation> {
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

    const existing = await db.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        listingId: true,
      },
    });

    let persistedReservationId = reservationId;

    if (existing && existing.listingId === listingId) {
      await db.reservation.update({
        where: { id: reservationId },
        data: payload,
      });
    } else {
      if (existing && existing.listingId !== listingId) {
        persistedReservationId = await this.ensureReservationId(db, null, listingId, new Set([
          reservationId,
        ]));
      }

      await db.reservation.create({
        data: {
          id: persistedReservationId,
          listingId,
          ...payload,
        },
      });
    }

    const stripePaymentIntentId = extractStripePaymentIntentId(row);
    if (stripePaymentIntentId) {
      await this.attachPaymentToReservation(db, {
        stripePaymentIntentId,
        listingId,
        reservationId: persistedReservationId,
        mode: options.paymentAttachment,
      });
    } else if (options.paymentAttachment === 'required') {
      throw createRequestError('Paiement introuvable pour cette réservation.', 400, 'RESERVATION_PAYMENT_REQUIRED');
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

    const expectedGuideAccessKey = buildGuideAccessKey(
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
          refundsEnabled: cancellationDetails.policy.refundsEnabled,
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
    const parsedGuideKey = parseGuideAccessKey(guideKey);
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
      // Guide complet (adresse, accès, Wi-Fi) : seul le voyageur muni de sa clé le reçoit, une fois débloqué.
      arrival: activation.isActive ? access.listingArrival : null,
      messaging: {
        conversationId: conversation.id,
      },
    };
  }

  async getGuideConversation(guideKey: string) {
    const parsedGuideKey = parseGuideAccessKey(guideKey);
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
    const parsedGuideKey = parseGuideAccessKey(guideKey);
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

  /**
   * Annulation décidée par l'hôte : le voyageur est remboursé intégralement, quelle que soit la
   * politique d'annulation, et les dates sont libérées. L'appelant vérifie que l'acteur gère l'annonce.
   */
  async cancelBookingAsHost(
    reservationId: string,
    options?: { reason?: string | null; publicBaseUrl?: string | null },
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId.trim() },
      select: { id: true, listingId: true, startDate: true },
    });
    if (!reservation) return null;

    const token = buildGuideAccessKey(reservation.id, reservation.listingId, reservation.startDate);
    return this.cancelBooking(reservation.id, token, { ...options, canceledBy: 'host' });
  }

  async cancelBooking(
    reservationId: string,
    token: string,
    options?: { reason?: string | null; publicBaseUrl?: string | null; canceledBy?: 'guest' | 'host' },
  ) {
    const access = await this.resolveReservationAccessContext(reservationId, token);
    if (!access || access === 'forbidden') return access;

    const cancellationDetails = this.buildReservationCancellationDetails(access);
    if (cancellationDetails.state.status === 'canceled') {
      return this.getBookingConfirmation(reservationId, token, {
        publicBaseUrl: options?.publicBaseUrl,
      });
    }

    const canceledBy = options?.canceledBy ?? 'guest';
    const isHostCancellation = canceledBy === 'host';
    // L'hôte qui annule rembourse tout (CGU voyageurs) ; le voyageur suit la politique de l'annonce.
    const refundableAmountMinor = isHostCancellation
      ? cancellationDetails.quote.chargedAmountMinor
      : cancellationDetails.quote.refundableAmountMinor;
    const stage = isHostCancellation ? 'full_refund' as const : cancellationDetails.quote.stage;

    if (!isHostCancellation && !cancellationDetails.canCancel) {
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
      refundableAmountMinor,
      reservationId: access.reservationId,
      listingId: access.listingId,
    });

    const effectiveRefundMinor = (cancellationDetails.paymentIntentId && this.stripe)
      ? Math.max(0, Math.min(cancellationDetails.quote.chargedAmountMinor, stripeResult.refundedAmountMinor))
      : refundableAmountMinor;
    const effectiveRetainedMinor = Math.max(0, cancellationDetails.quote.chargedAmountMinor - effectiveRefundMinor);
    const effectiveRetainedPercent = cancellationDetails.quote.chargedAmountMinor > 0
      ? Math.round((effectiveRetainedMinor / cancellationDetails.quote.chargedAmountMinor) * 100)
      : 0;

    const nextPayment = {
      ...access.payment,
      cancellation: {
        status: 'canceled',
        canceledAtISO,
        canceledBy,
        reason,
        stage,
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

    await this.removeInternalReservationEvent(this.prisma, access.listingId, access.reservationId);

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
        canceledBy,
        reason,
        stage,
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

    void notifications.sendBookingCancellationEmail({
      access,
      canceledBy,
      chargedAmountMinor: cancellationDetails.quote.chargedAmountMinor,
      refundedAmountMinor: effectiveRefundMinor,
      retainedAmountMinor: effectiveRetainedMinor,
      reason,
      publicBaseUrl: options?.publicBaseUrl,
    });

    return this.getBookingConfirmation(access.reservationId, token, {
      publicBaseUrl: options?.publicBaseUrl,
    });
  }

  async createBooking(input: Record<string, unknown>, auth: RequestAuth | null = null) {
    const listingId = String(input.listingId ?? '').trim();
    if (this.paymentsService) {
      const reservable = await this.paymentsService.ensureListingReservable(listingId);
      if (!reservable) return null;
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        ownerId: true,
        bookings: true,
      },
    });

    if (!listing) return null;

    const bookings = asObject(listing.bookings, emptyBookings());

    const actor = await upsertUserFromAuth(this.prisma, auth);
    const isHostActor = hasAdminAccess(auth) || Boolean(actor && listing.ownerId && listing.ownerId === actor.id);
    let payment = asObject(input.payment, {});

    const startISO = normalizeDayValue(input.start);
    const endISO = normalizeDayValue(input.end);
    if (!startISO || !endISO || startISO >= endISO) {
      throw createRequestError('Sélection de dates invalide.', 400, 'INVALID_RESERVATION_RANGE');
    }

    // Réservation d'un voyageur : dates libres et PaymentIntent émis par l'API, réglé et propre à
    // ces dates. Les montants et le statut du paiement viennent du serveur, pas du navigateur.
    let verifiedGuestPayment: { paymentIntentId: string; chargedAmountMinor: number } | null = null;
    if (!isHostActor) {
      // Premier filtre, hors transaction : évite l'aller-retour Stripe pour des dates déjà prises.
      // La décision finale est reprise sous verrou dans la transaction ci-dessous.
      if (!isReservationRangeAvailable(bookings, startISO, endISO)) {
        throw createRequestError('Ces dates ne sont plus disponibles.', 409, 'RESERVATION_RANGE_UNAVAILABLE');
      }

      const paymentIntentId = readString(asObject(payment.stripe).paymentIntentId);
      if (!paymentIntentId || !this.paymentsService) {
        throw createRequestError('Paiement introuvable pour cette réservation.', 400, 'RESERVATION_PAYMENT_REQUIRED');
      }

      const verified = await this.paymentsService.verifyReservationPayment({
        listingId,
        paymentIntentId,
        startISO,
        endISO,
      });
      payment = buildVerifiedReservationPayment(payment, verified);
      verifiedGuestPayment = { paymentIntentId, chargedAmountMinor: verified.chargeNowAmountMinor };
    }

    // Un voyageur ne choisit pas l'identifiant : il pourrait viser une réservation existante.
    const requestedReservationId = isHostActor ? normalizeReservationId(input.id) : null;
    const rawContact = asObject(input.contact, {});

    // Section critique : verrou consultatif sur l'annonce, puis relecture des disponibilités, écriture
    // du JSON de l'annonce, de la ligne Reservation, du rattachement du paiement (écriture
    // conditionnelle, une seule fois) et de l'événement de calendrier. Tout est annulé ensemble.
    const created = await this.prisma.$transaction(async (tx) => {
      await acquireListingBookingLock(tx, listingId);

      const lockedListing = await tx.listing.findUnique({
        where: { id: listingId },
        select: { bookings: true },
      });
      if (!lockedListing) return null;

      const lockedBookings = asObject(lockedListing.bookings, emptyBookings());
      const existingReservations = extractReservations(lockedBookings);
      const bookedDays = extractBookedDays(lockedBookings);
      const usedReservationIds = new Set(
        existingReservations
          .map((reservation) => reservationIdFromRow(reservation))
          .filter((value): value is string => Boolean(value)),
      );
      const replacesExistingReservation = Boolean(requestedReservationId && usedReservationIds.has(requestedReservationId));
      const safeReservationId = await this.ensureReservationId(tx, requestedReservationId, listingId, usedReservationIds);

      // Disponibilité relue après le verrou : seule décision qui compte. Un hôte qui ré-enregistre
      // une réservation existante sous le même identifiant (mise à jour) n'est pas concerné.
      if (!replacesExistingReservation && !isReservationRangeAvailable(lockedBookings, startISO, endISO)) {
        throw createRequestError('Ces dates ne sont plus disponibles.', 409, 'RESERVATION_RANGE_UNAVAILABLE', {
          listingId,
          startISO,
          endISO,
        });
      }

      const reservations = existingReservations.filter((reservation) => reservationIdFromRow(reservation) !== safeReservationId);
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
        // Note interne et fil de messages : réservés à l'hôte, jamais fournis par un voyageur.
        internalNote: isHostActor ? input.internalNote : undefined,
        guests: asObject(input.guests, {}),
        payment,
        contact,
        confirmation: {
          guideAccessKey: confirmation.guideAccessKey,
          guideUrl: confirmation.guideUrl,
          generatedAt: confirmation.generatedAt,
        },
        createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
        messaging: isHostActor ? asObject(input.messaging, {}) : {},
      };

      reservations.unshift(reservation);
      appendBookedDayIfMissing(bookedDays, startISO, endISO);

      const nextBookings = {
        ...lockedBookings,
        reservations,
        'booked-days': bookedDays,
      };

      await tx.listing.update({
        where: { id: listingId },
        data: {
          bookings: toPrismaJson(nextBookings),
        },
      });

      const persistedReservation = await this.persistReservation(tx, reservation, listingId, {
        paymentAttachment: isHostActor ? 'optional' : 'required',
      });
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

        await tx.reservation.update({
          where: {
            id: persistedReservation.id,
          },
          data: {
            contact: toPrismaJson(remappedContact),
          },
        });

        await tx.listing.update({
          where: { id: listingId },
          data: {
            bookings: toPrismaJson(syncedBookings),
          },
        });
        responseReservationId = persistedReservation.id;
        responseConfirmation = remappedConfirmation;
        responseBookings = syncedBookings;
      }

      await this.upsertInternalReservationEvent(tx, listingId, {
        ...persistedReservation,
        id: responseReservationId,
        guideUrl: responseConfirmation.guideUrl,
      });

      return {
        reservationId: responseReservationId,
        confirmation: responseConfirmation,
        bookings: responseBookings,
      };
    }, {
      maxWait: BOOKING_TRANSACTION_MAX_WAIT_MS,
      timeout: BOOKING_TRANSACTION_TIMEOUT_MS,
    }).catch(async (error: unknown) => {
      // Le voyageur a payé mais perd la course sur les dates : son paiement est remboursé tout de
      // suite plutôt que de rester orphelin chez Stripe.
      if (verifiedGuestPayment && readString(asObject(error).code) === 'RESERVATION_RANGE_UNAVAILABLE') {
        const refunded = await this.refundUnplaceableReservationPayment({
          listingId,
          ...verifiedGuestPayment,
        });
        if (refunded) {
          throw createRequestError(
            'Ces dates viennent d être réservées par un autre voyageur. Votre paiement a été remboursé.',
            409,
            'RESERVATION_RANGE_UNAVAILABLE',
            { listingId, startISO, endISO, refunded: true },
          );
        }
      }
      throw error;
    });

    if (!created) return null;

    const responseReservationId = created.reservationId;
    const responseConfirmation = created.confirmation;
    let responseBookings = created.bookings;

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

    // Support durable du contrat (art. L221-13 C. conso) : confirmation e-mail au voyageur, hors
    // transaction et sans attendre (toute erreur est journalisée, jamais remontée).
    if (!isHostActor && createAccess && createAccess !== 'forbidden') {
      void notifications.sendBookingConfirmationEmail({
        access: createAccess,
        guestEmail: readString(createAccess.reservationContact.email) ?? readString(actor?.email),
        guests: asObject(input.guests, {}),
      });
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
    const listingExists = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });

    if (!listingExists) return null;

    // Même verrou d'annonce que la création : une modification par l'hôte ne s'entrelace jamais avec
    // une réservation de voyageur. Pas de contrôle de disponibilité ici (l'hôte gère ses dates).
    const updated = await this.prisma.$transaction(async (tx) => {
      await acquireListingBookingLock(tx, listingId);

      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        select: {
          id: true,
          bookings: true,
        },
      });

      if (!listing) return null;

      const bookings = asObject(listing.bookings, emptyBookings());

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
      const safeReservationId = await this.ensureReservationId(tx, reservationId, listingId, usedReservationIds);

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

      await tx.listing.update({
        where: { id: listingId },
        data: {
          bookings: toPrismaJson(nextBookings),
        },
      });

      const persistedReservation = await this.persistReservation(tx, updatedReservation, listingId, {
        paymentAttachment: 'optional',
      });
      let finalConfirmation = updatedConfirmation;

      if (persistedReservation.id !== reservationId) {
        await this.removeInternalReservationEvent(tx, listingId, reservationId);
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

        await tx.reservation.update({
          where: {
            id: persistedReservation.id,
          },
          data: {
            contact: toPrismaJson(asObject(updatedReservation.contact)),
          },
        });

        await tx.listing.update({
          where: { id: listingId },
          data: {
            bookings: toPrismaJson(syncedBookings),
          },
        });
      }

      if (updatedReservation.id !== persistedReservation.id) {
        updatedReservation.id = persistedReservation.id;
      }

      await this.upsertInternalReservationEvent(tx, listingId, {
        ...persistedReservation,
        id: persistedReservation.id,
        guideUrl: finalConfirmation.guideUrl,
      });

      return {
        reservation: updatedReservation,
        confirmation: finalConfirmation,
      };
    }, {
      maxWait: BOOKING_TRANSACTION_MAX_WAIT_MS,
      timeout: BOOKING_TRANSACTION_TIMEOUT_MS,
    });

    if (!updated || updated === 'not_found') return updated;

    const updatedReservation = updated.reservation;
    const finalConfirmation = updated.confirmation;
    const finalReservationId = updatedReservation.id as string;
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
