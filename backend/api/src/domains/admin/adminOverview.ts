// Chiffres de l'administration : abonnés, comptes, annonces, réservations, et ce qui demande une
// action (impayé, litige, service en panne…). Les abonnements sont lus chez Stripe, seule source à
// jour : aucun webhook d'abonnement n'est traité, la base ne connaît leur état qu'à la visite de
// l'hôte. Sans Stripe, les chiffres viennent de la base et le signalent (`source: 'database'`).

import type { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

import { env } from '../../config/env.js';
import { countClerkUsers } from '../../lib/clerkUsers.js';
import { asObject } from '../../lib/json.js';
import { PaymentsService, type SubscriptionCatalog } from '../payments/payments.service.js';
import { normalizePlanCode, type SubscriptionPlanCode } from '../payments/plans.catalog.js';
import type { SystemHealthSnapshot } from './systemHealth.js';

const STRIPE_API_VERSION = '2025-02-24.acacia';
const DAY_MS = 24 * 60 * 60 * 1000;
const STRIPE_CACHE_MS = 60_000;
const MAX_SUBSCRIPTIONS = 2000;
const OPEN_DISPUTE_STATUSES = ['needs_response', 'warning_needs_response', 'under_review', 'warning_under_review'];

export type AdminAttentionItem = {
  id: string;
  tone: 'bad' | 'warn';
  title: string;
  detail: string;
  target: { tab: 'users' | 'payments' | 'services'; userId?: string | null };
};

export type AdminOverview = {
  generatedAtISO: string;
  subscribers: {
    source: 'stripe' | 'database';
    paying: number;
    trialing: number;
    complimentary: number;
    pastDue: number;
    canceledLast30Days: number;
    byPlan: Record<SubscriptionPlanCode, number>;
    extraListings: number;
    /** Somme mensuelle des abonnements payants actifs, hors remises ; null sans Stripe. */
    monthlyRevenueMinor: number | null;
    currency: string;
  };
  accounts: {
    total: number;
    newLast30Days: number;
    withPublishedListing: number;
    clerkTotal: number | null;
  };
  listings: {
    published: number;
    paused: number;
    drafts: number;
    hubs: number;
    customDomains: number;
  };
  reservations: {
    last30Days: number;
    upcoming: number;
    collectedLast30DaysMinor: number;
    currency: string;
  };
  attention: AdminAttentionItem[];
};

type SubscriptionSummary = {
  id: string;
  status: Stripe.Subscription.Status;
  userId: string | null;
  customerId: string | null;
  planCode: SubscriptionPlanCode | null;
  extraListings: number;
  monthlyMinor: number;
  currency: string;
  canceledAt: number | null;
};

let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  return stripeClient;
}

let subscriptionsCache: { at: number; value: SubscriptionSummary[] } | null = null;

function monthlyAmount(price: Stripe.Price, quantity: number): number {
  const unit = price.unit_amount ?? 0;
  const interval = price.recurring?.interval ?? 'month';
  const count = price.recurring?.interval_count ?? 1;
  const perInterval = unit * quantity;
  switch (interval) {
    case 'year':
      return perInterval / (12 * count);
    case 'week':
      return (perInterval * 52) / (12 * count);
    case 'day':
      return (perInterval * 365) / (12 * count);
    default:
      return perInterval / count;
  }
}

function summarizeSubscription(subscription: Stripe.Subscription, catalog: SubscriptionCatalog | null): SubscriptionSummary {
  const planPriceIds = new Map<string, SubscriptionPlanCode>();
  for (const plan of catalog?.plans ?? []) {
    if (plan.stripePriceId) planPriceIds.set(plan.stripePriceId, plan.code);
  }
  const extraPriceId = catalog?.extraListing?.stripePriceId ?? null;

  let planCode = normalizePlanCode(subscription.metadata?.planCode);
  let extraListings = 0;
  let monthlyMinor = 0;
  let currency = subscription.currency ?? 'eur';

  for (const item of subscription.items.data) {
    const quantity = item.quantity ?? 1;
    monthlyMinor += monthlyAmount(item.price, quantity);
    currency = item.price.currency ?? currency;
    if (extraPriceId && item.price.id === extraPriceId) {
      extraListings += quantity;
      continue;
    }
    planCode ??= planPriceIds.get(item.price.id) ?? null;
  }

  const customer = subscription.customer;
  return {
    id: subscription.id,
    status: subscription.status,
    userId: typeof subscription.metadata?.userId === 'string' && subscription.metadata.userId ? subscription.metadata.userId : null,
    customerId: typeof customer === 'string' ? customer : customer?.id ?? null,
    planCode,
    extraListings,
    monthlyMinor: Math.round(monthlyMinor),
    currency,
    canceledAt: subscription.canceled_at ? subscription.canceled_at * 1000 : null,
  };
}

async function loadSubscriptions(prisma: PrismaClient, force = false): Promise<SubscriptionSummary[] | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  if (!force && subscriptionsCache && Date.now() - subscriptionsCache.at < STRIPE_CACHE_MS) return subscriptionsCache.value;

  let catalog: SubscriptionCatalog | null = null;
  try {
    catalog = await new PaymentsService(prisma).getSubscriptionCatalog();
  } catch {
    catalog = null;
  }

  const summaries: SubscriptionSummary[] = [];
  for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
    summaries.push(summarizeSubscription(subscription, catalog));
    if (summaries.length >= MAX_SUBSCRIPTIONS) break;
  }
  subscriptionsCache = { at: Date.now(), value: summaries };
  return summaries;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function userLabel(user: { displayName: string | null; firstName: string | null; lastName: string | null; email: string | null } | null | undefined): string {
  if (!user) return 'Compte inconnu';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return user.displayName?.trim() || fullName || user.email || 'Compte sans nom';
}

function listingTitle(core: unknown): string {
  return readString(asObject(core).title) ?? 'Annonce sans titre';
}

function isCanceledReservation(payment: unknown): boolean {
  return readString(asObject(asObject(payment).cancellation).status) === 'canceled';
}

const euroFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });

export async function buildAdminOverview(
  prisma: PrismaClient,
  health: SystemHealthSnapshot | null,
  options?: { refresh?: boolean },
): Promise<AdminOverview> {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY_MS);
  const since7 = new Date(now - 7 * DAY_MS);
  const today = new Date(new Date().toISOString().slice(0, 10));

  const [
    users,
    newUsers,
    publishedOwners,
    listingGroups,
    customDomains,
    reservationsLast30,
    upcomingReservations,
    collected,
    disputes,
    failedRefunds,
    failedPayments,
    clerkTotal,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, email: true, displayName: true, firstName: true, lastName: true, stripeConnectProfile: true },
    }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: since30 } } }),
    prisma.listing.groupBy({ by: ['ownerId'], where: { status: 'published', kind: 'listing', ownerId: { not: null } } }),
    prisma.listing.groupBy({ by: ['status', 'kind'], _count: { _all: true } }),
    prisma.listing.count({ where: { customDomain: { not: null }, customDomainVerifiedAt: { not: null }, status: { not: 'deleted' } } }),
    prisma.reservation.findMany({ where: { createdAt: { gte: since30 } }, select: { payment: true } }),
    prisma.reservation.findMany({ where: { startDate: { gte: today } }, select: { payment: true } }),
    prisma.payment.aggregate({
      where: { status: 'succeeded', createdAt: { gte: since30 } },
      _sum: { amountMinor: true, refundedAmountMinor: true },
    }),
    prisma.payment.findMany({
      where: { disputeStatus: { in: OPEN_DISPUTE_STATUSES } },
      select: { id: true, amountMinor: true, currency: true, disputeReason: true, listing: { select: { core: true } } },
      take: 5,
    }),
    prisma.payment.findMany({
      where: { refundStatus: 'failed' },
      select: { id: true, refundFailureReason: true, listing: { select: { core: true } } },
      take: 5,
    }),
    prisma.payment.findMany({
      where: { status: 'requires_payment_method', updatedAt: { gte: since7 } },
      select: { rawResponse: true },
    }),
    countClerkUsers().catch(() => null),
  ]);

  const usersById = new Map(users.map((user) => [user.id, user]));
  const userIdByCustomer = new Map<string, string>();
  let complimentary = 0;
  const complimentaryEnding: Array<{ userId: string; endsAt: number }> = [];
  for (const user of users) {
    const billing = asObject(asObject(user.stripeConnectProfile).billing);
    const customerId = readString(billing.customerId);
    if (customerId) userIdByCustomer.set(customerId, user.id);
    if (billing.complimentary === true) {
      const endsAtISO = readString(billing.complimentaryEndsAtISO);
      const endsAt = endsAtISO ? Date.parse(endsAtISO) : null;
      if (endsAt === null || endsAt > now) {
        complimentary += 1;
        if (endsAt !== null && endsAt - now < 7 * DAY_MS) complimentaryEnding.push({ userId: user.id, endsAt });
      }
    }
  }

  // --- Abonnements ---------------------------------------------------------------------------
  let subscriptions: SubscriptionSummary[] | null = null;
  try {
    subscriptions = await loadSubscriptions(prisma, options?.refresh === true);
  } catch {
    subscriptions = null;
  }

  const byPlan: Record<SubscriptionPlanCode, number> = { indiehost: 0, superhost: 0 };
  let paying = 0;
  let trialing = 0;
  let pastDue = 0;
  let canceledLast30Days = 0;
  let extraListings = 0;
  let monthlyRevenueMinor: number | null = null;
  let currency = 'eur';
  const pastDueSubscriptions: SubscriptionSummary[] = [];

  if (subscriptions) {
    monthlyRevenueMinor = 0;
    for (const subscription of subscriptions) {
      const live = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(subscription.status);
      if (subscription.status === 'active') {
        paying += 1;
        monthlyRevenueMinor += subscription.monthlyMinor;
        currency = subscription.currency;
      } else if (subscription.status === 'trialing') {
        trialing += 1;
      } else if (['past_due', 'unpaid', 'incomplete'].includes(subscription.status)) {
        pastDue += 1;
        pastDueSubscriptions.push(subscription);
      } else if (subscription.status === 'canceled' && subscription.canceledAt && subscription.canceledAt >= since30.getTime()) {
        canceledLast30Days += 1;
      }
      if (live && subscription.planCode) byPlan[subscription.planCode] += 1;
      if (subscription.status === 'active' || subscription.status === 'trialing') extraListings += subscription.extraListings;
    }
  } else {
    for (const user of users) {
      const billing = asObject(asObject(user.stripeConnectProfile).billing);
      if (billing.complimentary === true) continue;
      const status = readString(billing.status)?.toLowerCase() ?? '';
      const planCode = normalizePlanCode(billing.planCode);
      if (status === 'active') paying += 1;
      else if (status === 'trialing') trialing += 1;
      else if (['past_due', 'unpaid', 'incomplete'].includes(status)) pastDue += 1;
      if (planCode && ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(status)) byPlan[planCode] += 1;
    }
  }

  // --- Annonces --------------------------------------------------------------------------------
  const countListings = (predicate: (row: { status: string; kind: string }) => boolean) =>
    listingGroups.filter(predicate).reduce((sum, row) => sum + row._count._all, 0);

  // --- Points d'attention ----------------------------------------------------------------------
  const attention: AdminAttentionItem[] = [];

  for (const service of health?.services ?? []) {
    if (service.status !== 'down') continue;
    attention.push({ id: `service-${service.id}`, tone: 'bad', title: `${service.label} en panne`, detail: service.summary, target: { tab: 'services' } });
  }

  for (const dispute of disputes) {
    attention.push({
      id: `dispute-${dispute.id}`,
      tone: 'bad',
      title: 'Litige ouvert sur une réservation',
      detail: `${listingTitle(dispute.listing?.core)} · ${euroFormatter.format(dispute.amountMinor / 100)}${dispute.disputeReason ? ` · motif : ${dispute.disputeReason}` : ''}. L’hôte répond dans son tableau de bord Stripe.`,
      target: { tab: 'payments' },
    });
  }

  for (const refund of failedRefunds) {
    attention.push({
      id: `refund-${refund.id}`,
      tone: 'bad',
      title: 'Remboursement échoué',
      detail: `${listingTitle(refund.listing?.core)}${refund.refundFailureReason ? ` · ${refund.refundFailureReason}` : ''}`,
      target: { tab: 'payments' },
    });
  }

  for (const subscription of pastDueSubscriptions.slice(0, 5)) {
    const userId = subscription.userId ?? (subscription.customerId ? userIdByCustomer.get(subscription.customerId) ?? null : null);
    attention.push({
      id: `past-due-${subscription.id}`,
      tone: 'warn',
      title: subscription.status === 'incomplete' ? 'Premier paiement d’abonnement non abouti' : 'Abonnement impayé',
      detail: `${userLabel(userId ? usersById.get(userId) : null)} : Stripe retente le prélèvement ; sans paiement, l’abonnement s’arrête.`,
      target: { tab: 'users', userId },
    });
  }

  const recentFailures = failedPayments.filter((payment) => Boolean(asObject(asObject(payment.rawResponse).stripeWebhook).lastPaymentFailure)).length;
  if (recentFailures) {
    attention.push({
      id: 'reservation-failures',
      tone: 'warn',
      title: recentFailures > 1 ? `${recentFailures} paiements de voyageurs refusés cette semaine` : 'Un paiement de voyageur refusé cette semaine',
      detail: 'Carte refusée ou 3-D Secure non validé : le voyageur n’a pas réservé.',
      target: { tab: 'payments' },
    });
  }

  for (const ending of complimentaryEnding) {
    attention.push({
      id: `gift-${ending.userId}`,
      tone: 'warn',
      title: 'Accès offert bientôt terminé',
      detail: `${userLabel(usersById.get(ending.userId))} : jusqu’au ${dateFormatter.format(ending.endsAt)}.`,
      target: { tab: 'users', userId: ending.userId },
    });
  }

  for (const service of health?.services ?? []) {
    if (service.status !== 'degraded') continue;
    attention.push({ id: `service-${service.id}`, tone: 'warn', title: `${service.label} : à surveiller`, detail: service.summary, target: { tab: 'services' } });
  }

  const collectedMinor = Math.max(0, (collected._sum.amountMinor ?? 0) - (collected._sum.refundedAmountMinor ?? 0));

  return {
    generatedAtISO: new Date(now).toISOString(),
    subscribers: {
      source: subscriptions ? 'stripe' : 'database',
      paying,
      trialing,
      complimentary,
      pastDue,
      canceledLast30Days,
      byPlan,
      extraListings,
      monthlyRevenueMinor,
      currency,
    },
    accounts: {
      total: users.length,
      newLast30Days: newUsers,
      withPublishedListing: publishedOwners.length,
      clerkTotal,
    },
    listings: {
      published: countListings((row) => row.kind === 'listing' && row.status === 'published'),
      paused: countListings((row) => row.kind === 'listing' && (row.status === 'paused' || row.status === 'blocked')),
      drafts: countListings((row) => row.kind === 'listing' && row.status === 'draft'),
      hubs: countListings((row) => row.kind === 'hub' && row.status !== 'deleted'),
      customDomains,
    },
    reservations: {
      last30Days: reservationsLast30.filter((reservation) => !isCanceledReservation(reservation.payment)).length,
      upcoming: upcomingReservations.filter((reservation) => !isCanceledReservation(reservation.payment)).length,
      collectedLast30DaysMinor: collectedMinor,
      currency: 'eur',
    },
    attention: attention.slice(0, 10),
  };
}
