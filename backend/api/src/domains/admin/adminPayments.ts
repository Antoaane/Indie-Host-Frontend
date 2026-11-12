// Paiements vus par l'administration, réussis comme refusés, sur 90 jours :
// - abonnements des hôtes à IndieHost : paiements du compte Stripe d'IndieHost (lus chez Stripe) ;
// - réservations : paiements des voyageurs sur le compte Stripe de chaque hôte (table Payment, tenue
//   à jour par les webhooks des comptes connectés).
// Un paiement jamais tenté (voyageur parti avant de payer) n'est pas listé.

import type { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

import { env } from '../../config/env.js';
import { asObject } from '../../lib/json.js';
import { PLAN_TEMPLATES, normalizePlanCode } from '../payments/plans.catalog.js';

const STRIPE_API_VERSION = '2025-02-24.acacia';
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = 90;
const STRIPE_CACHE_MS = 60_000;
const MAX_PLATFORM_INTENTS = 300;
const MAX_RESERVATION_PAYMENTS = 400;
const CLOSED_DISPUTE_STATUSES = new Set(['won', 'warning_closed']);

export type AdminPaymentStatus = 'succeeded' | 'failed' | 'pending' | 'refunded' | 'partially_refunded' | 'disputed';

export type AdminPaymentRow = {
  id: string;
  source: 'subscription' | 'reservation' | 'other';
  status: AdminPaymentStatus;
  amountMinor: number;
  refundedMinor: number;
  currency: string;
  createdAtISO: string;
  title: string;
  detail: string | null;
  payer: string | null;
  account: { userId: string | null; label: string } | null;
  failureReason: string | null;
  stripeUrl: string | null;
};

export type AdminPaymentsResponse = {
  generatedAtISO: string;
  stripeAvailable: boolean;
  periodDays: number;
  totals: {
    succeededCount: number;
    succeededMinor: number;
    failedCount: number;
    refundedMinor: number;
    disputedCount: number;
    currency: string;
  };
  rows: AdminPaymentRow[];
};

// Motifs de refus les plus courants (codes Stripe `decline_code` ou `code`).
const DECLINE_REASONS: Record<string, string> = {
  insufficient_funds: 'Fonds insuffisants',
  card_declined: 'Carte refusée par la banque',
  generic_decline: 'Refus de la banque, sans motif donné',
  do_not_honor: 'Refus de la banque',
  expired_card: 'Carte expirée',
  incorrect_cvc: 'Code de sécurité incorrect',
  invalid_cvc: 'Code de sécurité incorrect',
  incorrect_number: 'Numéro de carte incorrect',
  invalid_number: 'Numéro de carte incorrect',
  invalid_expiry_month: 'Date d’expiration incorrecte',
  invalid_expiry_year: 'Date d’expiration incorrecte',
  lost_card: 'Carte déclarée perdue',
  stolen_card: 'Carte déclarée volée',
  pickup_card: 'Carte retenue par la banque',
  restricted_card: 'Carte restreinte par la banque',
  fraudulent: 'Bloqué : suspicion de fraude',
  merchant_blacklist: 'Bloqué par les règles anti-fraude',
  processing_error: 'Erreur de traitement chez la banque',
  authentication_required: 'Authentification 3-D Secure non effectuée',
  payment_intent_authentication_failure: 'Authentification 3-D Secure échouée',
  card_velocity_exceeded: 'Plafond de la carte atteint',
  withdrawal_count_limit_exceeded: 'Plafond de la carte atteint',
  currency_not_supported: 'Devise refusée par la carte',
  card_not_supported: 'Carte non acceptée pour ce paiement',
  transaction_not_allowed: 'Paiement non autorisé sur cette carte',
  try_again_later: 'Refus temporaire de la banque',
  approve_with_id: 'Paiement non autorisé par la banque',
};

function describeFailure(failure: { declineCode?: string | null; code?: string | null; message?: string | null } | null): string | null {
  if (!failure) return null;
  const key = failure.declineCode ?? failure.code ?? '';
  if (key && DECLINE_REASONS[key]) return DECLINE_REASONS[key];
  if (failure.message) return failure.message;
  return key ? `Refusé (${key})` : 'Refusé';
}

let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  return stripeClient;
}

function stripeDashboardBase(): string {
  return env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'https://dashboard.stripe.com' : 'https://dashboard.stripe.com/test';
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

type UserLite = { id: string; email: string | null; displayName: string | null; firstName: string | null; lastName: string | null };

function userLabel(user: UserLite | null | undefined): string {
  if (!user) return 'Compte inconnu';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return user.displayName?.trim() || fullName || user.email || 'Compte sans nom';
}

const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const BILLING_REASONS: Record<string, string> = {
  subscription_create: 'Premier paiement',
  subscription_cycle: 'Renouvellement',
  subscription_update: 'Changement d’offre ou de logements',
  subscription_threshold: 'Paiement intermédiaire',
  manual: 'Facture manuelle',
};

let platformCache: { at: number; rows: AdminPaymentRow[] } | null = null;

async function loadPlatformPayments(prisma: PrismaClient, since: number, force: boolean): Promise<AdminPaymentRow[] | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  if (!force && platformCache && Date.now() - platformCache.at < STRIPE_CACHE_MS) return platformCache.rows;

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, email: true, displayName: true, firstName: true, lastName: true, stripeConnectProfile: true },
  });
  const usersById = new Map<string, UserLite>(users.map((user) => [user.id, user]));
  const userByCustomer = new Map<string, UserLite>();
  for (const user of users) {
    const customerId = readString(asObject(asObject(user.stripeConnectProfile).billing).customerId);
    if (customerId) userByCustomer.set(customerId, user);
  }

  const rows: AdminPaymentRow[] = [];
  const base = stripeDashboardBase();
  let seen = 0;

  for await (const intent of stripe.paymentIntents.list({
    limit: 100,
    created: { gte: Math.floor(since / 1000) },
    expand: ['data.customer', 'data.invoice', 'data.latest_charge'],
  })) {
    seen += 1;
    if (seen > MAX_PLATFORM_INTENTS) break;

    const failure = intent.last_payment_error
      ? { declineCode: intent.last_payment_error.decline_code ?? null, code: intent.last_payment_error.code ?? null, message: intent.last_payment_error.message ?? null }
      : null;
    const charge = intent.latest_charge && typeof intent.latest_charge === 'object' ? intent.latest_charge : null;

    let status: AdminPaymentStatus | null = null;
    if (intent.status === 'succeeded') {
      const refunded = charge?.amount_refunded ?? 0;
      status = charge?.disputed ? 'disputed' : refunded >= intent.amount && refunded > 0 ? 'refunded' : refunded > 0 ? 'partially_refunded' : 'succeeded';
    } else if (failure) {
      status = 'failed';
    } else if (intent.status === 'processing' || intent.status === 'requires_capture') {
      status = 'pending';
    }
    // Paiement jamais tenté (page de paiement abandonnée) : rien à montrer.
    if (!status) continue;

    const invoice = intent.invoice && typeof intent.invoice === 'object' ? intent.invoice : null;
    const customer = intent.customer && typeof intent.customer === 'object' && !('deleted' in intent.customer && intent.customer.deleted)
      ? intent.customer as Stripe.Customer
      : null;
    const customerId = typeof intent.customer === 'string' ? intent.customer : customer?.id ?? null;

    const metadataUserId = readString(invoice?.subscription_details?.metadata?.userId) ?? readString(customer?.metadata?.userId) ?? readString(intent.metadata?.userId);
    const account = (metadataUserId ? usersById.get(metadataUserId) : null) ?? (customerId ? userByCustomer.get(customerId) : null) ?? null;
    const planCode = normalizePlanCode(invoice?.subscription_details?.metadata?.planCode);

    rows.push({
      id: intent.id,
      source: invoice ? 'subscription' : 'other',
      status,
      amountMinor: intent.amount,
      refundedMinor: charge?.amount_refunded ?? 0,
      currency: intent.currency,
      createdAtISO: new Date(intent.created * 1000).toISOString(),
      title: invoice
        ? `Abonnement${planCode ? ` ${PLAN_TEMPLATES[planCode].name}` : ''}`
        : readString(intent.description) ?? 'Paiement sur le compte IndieHost',
      detail: invoice ? BILLING_REASONS[invoice.billing_reason ?? ''] ?? null : null,
      payer: customer?.name ?? customer?.email ?? intent.receipt_email ?? null,
      account: account ? { userId: account.id, label: userLabel(account) } : null,
      failureReason: status === 'failed' ? describeFailure(failure) : null,
      stripeUrl: `${base}/payments/${intent.id}`,
    });
  }

  platformCache = { at: Date.now(), rows };
  return rows;
}

async function loadReservationPayments(prisma: PrismaClient, since: number): Promise<AdminPaymentRow[]> {
  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: new Date(since) } },
    orderBy: { createdAt: 'desc' },
    take: MAX_RESERVATION_PAYMENTS,
    select: {
      id: true,
      status: true,
      amountMinor: true,
      currency: true,
      createdAt: true,
      refundedAmountMinor: true,
      disputeStatus: true,
      rawResponse: true,
      reservation: { select: { guestName: true, startDate: true, endDate: true } },
      listing: {
        select: {
          core: true,
          owner: { select: { id: true, email: true, displayName: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  const rows: AdminPaymentRow[] = [];
  for (const payment of payments) {
    const failureRaw = asObject(asObject(asObject(payment.rawResponse).stripeWebhook).lastPaymentFailure);
    const failure = Object.keys(failureRaw).length
      ? { declineCode: readString(failureRaw.declineCode), code: readString(failureRaw.code), message: readString(failureRaw.message) }
      : null;
    const refunded = payment.refundedAmountMinor ?? 0;

    let status: AdminPaymentStatus | null = null;
    if (payment.disputeStatus && !CLOSED_DISPUTE_STATUSES.has(payment.disputeStatus)) {
      status = 'disputed';
    } else if (payment.status === 'succeeded') {
      status = refunded >= payment.amountMinor && refunded > 0 ? 'refunded' : refunded > 0 ? 'partially_refunded' : 'succeeded';
    } else if (failure) {
      status = 'failed';
    } else if (payment.status === 'processing' || payment.status === 'requires_capture') {
      status = 'pending';
    }
    if (!status) continue;

    const title = readString(asObject(payment.listing?.core).title) ?? 'Annonce sans titre';
    const reservation = payment.reservation;
    const stay = reservation ? `du ${shortDate.format(reservation.startDate)} au ${shortDate.format(reservation.endDate)}` : null;
    const owner = payment.listing?.owner ?? null;

    rows.push({
      id: payment.id,
      source: 'reservation',
      status,
      amountMinor: payment.amountMinor,
      refundedMinor: refunded,
      currency: payment.currency,
      createdAtISO: payment.createdAt.toISOString(),
      title: `Réservation · ${title}`,
      detail: [reservation?.guestName, stay].filter(Boolean).join(' · ') || null,
      payer: reservation?.guestName ?? null,
      account: owner ? { userId: owner.id, label: userLabel(owner) } : null,
      failureReason: status === 'failed' ? describeFailure(failure) : null,
      // Paiement direct sur le compte de l'hôte : visible dans son tableau de bord Stripe, pas dans celui d'IndieHost.
      stripeUrl: null,
    });
  }
  return rows;
}

export async function buildAdminPayments(prisma: PrismaClient, options?: { refresh?: boolean }): Promise<AdminPaymentsResponse> {
  const now = Date.now();
  const since = now - PERIOD_DAYS * DAY_MS;

  let platform: AdminPaymentRow[] | null = null;
  try {
    platform = await loadPlatformPayments(prisma, since, options?.refresh === true);
  } catch {
    platform = null;
  }
  const reservations = await loadReservationPayments(prisma, since);

  const rows = [...(platform ?? []), ...reservations].sort((a, b) => Date.parse(b.createdAtISO) - Date.parse(a.createdAtISO));

  const since30 = now - 30 * DAY_MS;
  const recent = rows.filter((row) => Date.parse(row.createdAtISO) >= since30);
  const settled = recent.filter((row) => row.status === 'succeeded' || row.status === 'partially_refunded' || row.status === 'refunded' || row.status === 'disputed');

  return {
    generatedAtISO: new Date(now).toISOString(),
    stripeAvailable: platform !== null,
    periodDays: PERIOD_DAYS,
    totals: {
      succeededCount: recent.filter((row) => row.status === 'succeeded' || row.status === 'partially_refunded').length,
      succeededMinor: settled.reduce((sum, row) => sum + Math.max(0, row.amountMinor - row.refundedMinor), 0),
      failedCount: recent.filter((row) => row.status === 'failed').length,
      refundedMinor: recent.reduce((sum, row) => sum + row.refundedMinor, 0),
      disputedCount: rows.filter((row) => row.status === 'disputed').length,
      currency: 'eur',
    },
    rows: rows.slice(0, 300),
  };
}
