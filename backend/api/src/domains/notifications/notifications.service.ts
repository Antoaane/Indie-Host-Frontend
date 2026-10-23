// Notifications e-mail aux voyageurs. Appelées en « fire-and-forget » depuis le domaine bookings :
// chaque fonction attrape tout et journalise ; elle ne lève jamais et ne touche jamais à la base.

import { asObject, toNumber } from '../../lib/json.js';
import { resolvePublicBaseUrl, sendMail } from '../../lib/mailer.js';
import { isDeprecatedHostIdentity } from '../users/users.repository.js';
import { buildBookingCancellationEmail } from './bookingCancellation.js';
import { buildBookingConfirmationEmail, type BalanceMode } from './bookingConfirmation.js';
import { parseIsoDate, readGuestsBreakdown } from './mailLayout.js';

/**
 * Sous-ensemble structurel du `ReservationAccessContext` de `bookings.service.ts` : tout ce qu'il
 * faut pour décrire la réservation sans dépendre du type privé du service.
 */
export type BookingNotificationContext = {
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
  listingHost: Record<string, unknown>;
  listingCore: Record<string, unknown>;
  listingBookings: Record<string, unknown>;
  ownerDisplayName: string | null;
  ownerEmail: string | null;
  confirmation: { guideAccessKey: string; guideUrl: string };
};

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function resolveHostName(access: BookingNotificationContext): string | null {
  const fromListing = readString(access.listingHost.name);
  if (fromListing && !isDeprecatedHostIdentity(fromListing)) return fromListing;
  return access.ownerDisplayName;
}

function resolveListingTitle(access: BookingNotificationContext): string {
  return readString(access.listingCore.title) ?? 'Votre logement';
}

function resolveCurrency(payment: Record<string, unknown>): string {
  return readString(asObject(payment.stripe).currency)?.toUpperCase() ?? 'EUR';
}

function resolveBalanceMode(payment: Record<string, unknown>, balance: number): BalanceMode {
  if (balance <= 0) return 'none';
  const deferred = readString(asObject(payment.stripe).deferredMode);
  if (deferred === 'cash' || deferred === 'online' || deferred === 'none') return deferred;
  const choice = readString(asObject(payment.stripe).paymentChoice);
  if (choice === 'cash') return 'cash';
  if (choice === 'split') return 'online';
  return /esp[eè]ces/i.test(readString(payment.method) ?? '') ? 'cash' : 'online';
}

export type BookingAmounts = {
  currency: string;
  /** Montants en euros. */
  total: number;
  paidNow: number;
  balance: number;
  balanceMode: BalanceMode;
  balanceDueDateISO: string | null;
};

/** Montants d'une réservation lus dans sa copie JSON `payment` (même lecture pour voyageur et hôte). */
export function readBookingAmounts(payment: Record<string, unknown>): BookingAmounts {
  const stripe = asObject(payment.stripe);
  const total = toNumber(payment.total, 0);
  const paidNow = toNumber(stripe.chargeNowAmount, toNumber(payment.deposit, total));
  const balance = toNumber(stripe.deferredAmount, toNumber(payment.balance, Math.max(0, total - paidNow)));
  return {
    currency: resolveCurrency(payment),
    total,
    paidNow,
    balance,
    balanceMode: resolveBalanceMode(payment, balance),
    balanceDueDateISO: readString(stripe.deferredDueDateISO),
  };
}

export function buildAbsoluteUrl(path: string, baseUrl: string): string {
  try {
    return new URL(path, `${baseUrl}/`).toString();
  } catch {
    return path;
  }
}

function buildConfirmationUrl(access: BookingNotificationContext, baseUrl: string): string {
  const params = new URLSearchParams({
    token: access.confirmation.guideAccessKey,
    listingId: access.listingId,
  });
  return buildAbsoluteUrl(`/booking/confirmation/${encodeURIComponent(access.reservationId)}?${params}`, baseUrl);
}

function resolveRecipient(access: BookingNotificationContext, explicit: string | null | undefined): string | null {
  return readString(explicit) ?? readString(access.reservationContact.email);
}

export type SendBookingConfirmationInput = {
  access: BookingNotificationContext;
  /** E-mail du voyageur si connu hors du contact (compte Clerk) ; sinon `contact.email`. */
  guestEmail?: string | null;
  /** `guests` de la requête de création (la ligne Reservation n'est pas relue). */
  guests?: Record<string, unknown>;
  publicBaseUrl?: string | null;
};

export async function sendBookingConfirmationEmail(input: SendBookingConfirmationInput): Promise<void> {
  const { access } = input;
  const logContext = { reservationId: access.reservationId, listingId: access.listingId, email: 'booking_confirmation' };

  try {
    const to = resolveRecipient(access, input.guestEmail);
    if (!to) {
      console.warn('[notifications] confirmation de réservation non envoyée : aucun e-mail voyageur', logContext);
      return;
    }

    const baseUrl = resolvePublicBaseUrl(input.publicBaseUrl);
    const payment = access.payment;
    const stripe = asObject(payment.stripe);
    const amounts = readBookingAmounts(payment);

    const email = buildBookingConfirmationEmail({
      reservationId: access.reservationId,
      listingTitle: resolveListingTitle(access),
      listingCity: readString(access.listingCore.city),
      hostName: resolveHostName(access),
      guestName: access.guestName,
      startDate: access.startDate,
      endDate: access.endDate,
      nights: Math.max(1, Math.round(access.nights)),
      guests: readGuestsBreakdown(input.guests ?? {}),
      currency: amounts.currency,
      amounts: {
        total: amounts.total,
        paidNow: amounts.paidNow,
        balance: amounts.balance,
        balanceMode: amounts.balanceMode,
        balanceDueDateISO: amounts.balanceDueDateISO,
      },
      paymentChoice: readString(stripe.paymentChoice),
      paymentMethodLabel: readString(payment.method),
      cancellationSettings: asObject(asObject(access.listingBookings.pricing).cancellation),
      guideUrl: buildAbsoluteUrl(access.confirmation.guideUrl, baseUrl),
      confirmationUrl: buildConfirmationUrl(access, baseUrl),
      travellerMessage: readString(access.message),
      bookedAt: parseIsoDate(access.createdAt) ?? new Date(),
    });

    await sendMail({ to, ...email, context: logContext });
  } catch (error) {
    console.error('[notifications] échec de préparation de la confirmation de réservation', { ...logContext, error });
  }
}

export type SendBookingCancellationInput = {
  access: BookingNotificationContext;
  guestEmail?: string | null;
  canceledBy: 'guest' | 'host';
  /** Montants en centimes, tels que calculés par `cancelBooking`. */
  chargedAmountMinor: number;
  refundedAmountMinor: number;
  retainedAmountMinor: number;
  reason: string | null;
  publicBaseUrl?: string | null;
};

export async function sendBookingCancellationEmail(input: SendBookingCancellationInput): Promise<void> {
  const { access } = input;
  const logContext = { reservationId: access.reservationId, listingId: access.listingId, email: 'booking_cancellation' };

  try {
    const to = resolveRecipient(access, input.guestEmail);
    if (!to) {
      console.warn('[notifications] e-mail d’annulation non envoyé : aucun e-mail voyageur', logContext);
      return;
    }

    const baseUrl = resolvePublicBaseUrl(input.publicBaseUrl);
    const email = buildBookingCancellationEmail({
      reservationId: access.reservationId,
      listingTitle: resolveListingTitle(access),
      listingCity: readString(access.listingCore.city),
      hostName: resolveHostName(access),
      guestName: access.guestName,
      startDate: access.startDate,
      endDate: access.endDate,
      nights: Math.max(1, Math.round(access.nights)),
      currency: resolveCurrency(access.payment),
      canceledBy: input.canceledBy,
      canceledAt: new Date(),
      chargedAmount: Math.max(0, input.chargedAmountMinor) / 100,
      refundedAmount: Math.max(0, input.refundedAmountMinor) / 100,
      retainedAmount: Math.max(0, input.retainedAmountMinor) / 100,
      reason: readString(input.reason),
      cancellationSettings: asObject(asObject(access.listingBookings.pricing).cancellation),
      confirmationUrl: buildConfirmationUrl(access, baseUrl),
    });

    await sendMail({ to, ...email, context: logContext });
  } catch (error) {
    console.error('[notifications] échec de préparation de l’e-mail d’annulation', { ...logContext, error });
  }
}

export const notifications = {
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
} as const;
