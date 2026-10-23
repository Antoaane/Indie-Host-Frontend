import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import Stripe from 'stripe';

import { env } from '../config/env.js';
import { CalendarService } from '../domains/calendar/calendar.service.js';
import {
  buildHostConnectIncompleteEmail,
  buildHostDraftReminderEmail,
  buildHostPlanEndingEmail,
  buildHostWelcomeEmail,
  buildHostCalendarSyncErrorEmail,
  type DraftListingSummary,
  type HostPlanEndingVariant,
} from '../domains/notifications/hostAccountEmails.js';
import { buildHostArrivalTomorrowEmail } from '../domains/notifications/hostBookingEmails.js';
import {
  buildHostLinks,
  buildUnsubscribeUrl,
  canEmailHost,
  deliverHostEmail,
  hostFirstName,
  type DeliverHostEmailInput,
  type HostEmailKind,
  type HostRecipient,
} from '../domains/notifications/hostNotifications.js';
import { formatCurrency, readGuestsBreakdown } from '../domains/notifications/mailLayout.js';
import { readBookingAmounts } from '../domains/notifications/notifications.service.js';
import { LISTING_LIMIT_COUNTED_STATUSES, PLAN_TEMPLATES, normalizePlanCode } from '../domains/payments/plans.catalog.js';
import { asObject, toNumber } from '../lib/json.js';
import { isMailerConfigured } from '../lib/mailer.js';

/**
 * Rappels planifiés aux hôtes, une passe par heure entre 9 h et 20 h (heure de Paris) :
 * - arrivée d'un voyageur le lendemain ;
 * - bienvenue après la souscription (comptes créés depuis moins de 14 jours) ;
 * - annonce restée en brouillon (2 jours sans modification, puis un dernier rappel 7 jours plus tard) ;
 * - compte de paiement Stripe pas encore actif (2 jours après l'inscription, puis 7 jours plus tard) ;
 * - fin d'essai, d'abonnement résilié ou d'accès offert (3 jours avant) ;
 * - calendrier iCal en erreur (après une nouvelle tentative de synchronisation, au plus une fois par semaine).
 * Chaque e-mail a sa clé dans `HostNotification` : une passe répétée n'envoie rien de plus.
 */

const STRIPE_API_VERSION = '2025-02-24.acacia';
const PARIS_TIME_ZONE = 'Europe/Paris';
const SEND_WINDOW = { fromHour: 9, toHour: 20 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const HOST_REMINDER_RULES = {
  welcomeAccountMaxAgeDays: 14,
  draftFirstReminderDays: 2,
  draftLastReminderDays: 10,
  draftMaxAgeDays: 60,
  reminderGapDays: 7,
  connectFirstReminderDays: 2,
  planEndingNoticeDays: 3,
  calendarErrorRecentDays: 3,
} as const;

const PUBLICATION_STATUSES = ['active', 'trialing'];
const DEFAULT_INITIAL_DELAY_MS = 5 * 60 * 1000;
const DEFAULT_INTERVAL_MS = HOUR_MS;

export type HostRemindersLogger = Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;

export type HostRemindersReport = {
  startedAt: string;
  finishedAt: string;
  skipped: 'mailer_not_configured' | 'outside_send_window' | null;
  dryRun: boolean;
  sent: Partial<Record<HostEmailKind, number>>;
  failed: number;
};

type Context = {
  prisma: PrismaClient;
  logger: HostRemindersLogger;
  stripe: Stripe | null;
  now: Date;
  dryRun: boolean;
  report: HostRemindersReport;
};

const HOST_SELECT = {
  id: true,
  email: true,
  firstName: true,
  deletedAt: true,
  emailRemindersOptOutAt: true,
  createdAt: true,
  stripeConnectAccountId: true,
  stripeConnectProfile: true,
} as const;

type HostRow = HostRecipient & {
  createdAt: Date;
  stripeConnectAccountId: string | null;
  stripeConnectProfile: unknown;
};

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ago(now: Date, ms: number): Date {
  return new Date(now.getTime() - ms);
}

function parisHour(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: PARIS_TIME_ZONE }).format(now));
}

/** Minuit UTC du jour civil parisien de `now` (les jours de séjour sont stockés à minuit UTC). */
function parisDayStart(now: Date): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS_TIME_ZONE }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
}

function isoWeekKey(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function readBilling(host: Pick<HostRow, 'stripeConnectProfile'>): Record<string, unknown> {
  return asObject(asObject(host.stripeConnectProfile).billing);
}

function stripHtml(value: unknown): string {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

/** Lignes déjà posées pour ces clés (une seule requête par contrôle). */
async function existingKeys(prisma: PrismaClient, keys: string[]): Promise<Map<string, Date>> {
  if (keys.length === 0) return new Map();
  const rows = await prisma.hostNotification.findMany({
    where: { dedupeKey: { in: keys } },
    select: { dedupeKey: true, createdAt: true },
  });
  return new Map(rows.map((row) => [row.dedupeKey, row.createdAt]));
}

async function deliver(ctx: Context, input: DeliverHostEmailInput): Promise<void> {
  if (!canEmailHost(input.host, input.kind)) return;

  if (ctx.dryRun) {
    const known = await existingKeys(ctx.prisma, input.claims.map((claim) => claim.dedupeKey));
    if (known.size === input.claims.length) return;
    ctx.logger.info({ kind: input.kind, userId: input.host.id, subject: input.email.subject }, '[host-reminders] dry run: would send');
    ctx.report.sent[input.kind] = (ctx.report.sent[input.kind] ?? 0) + 1;
    return;
  }

  try {
    const sent = await deliverHostEmail(ctx.prisma, input);
    if (sent) ctx.report.sent[input.kind] = (ctx.report.sent[input.kind] ?? 0) + 1;
  } catch (error) {
    ctx.report.failed += 1;
    ctx.logger.error({ err: error, kind: input.kind, userId: input.host.id }, '[host-reminders] delivery failed');
  }
}

// --- Compte de paiement Stripe ---------------------------------------------------------------

type ConnectState = { ready: boolean; started: boolean };

async function readConnectState(ctx: Context, host: HostRow): Promise<ConnectState> {
  const profile = asObject(host.stripeConnectProfile);
  const accountId = host.stripeConnectAccountId ?? readString(profile.accountId);
  if (profile.chargesEnabled === true) return { ready: true, started: true };
  if (!accountId) return { ready: false, started: false };
  // Le profil n'est rafraîchi que lorsque l'hôte passe sur la page d'activation : Stripe fait foi.
  if (!ctx.stripe || accountId.startsWith('acct_mock_')) return { ready: false, started: true };
  try {
    const account = await ctx.stripe.accounts.retrieve(accountId);
    return { ready: account.charges_enabled === true, started: true };
  } catch (error) {
    ctx.logger.warn({ err: error, userId: host.id }, '[host-reminders] Stripe account lookup failed');
    return { ready: true, started: true };
  }
}

async function loadSubscribedHosts(ctx: Context): Promise<HostRow[]> {
  return ctx.prisma.user.findMany({
    where: {
      deletedAt: null,
      email: { not: null },
      OR: PUBLICATION_STATUSES.map((status) => ({ stripeConnectProfile: { path: ['billing', 'status'], equals: status } })),
    },
    select: HOST_SELECT,
  });
}

// --- Arrivée demain --------------------------------------------------------------------------

async function remindArrivals(ctx: Context): Promise<void> {
  const tomorrow = new Date(parisDayStart(ctx.now).getTime() + DAY_MS);
  const reservations = await ctx.prisma.reservation.findMany({
    where: {
      startDate: { gte: tomorrow, lt: new Date(tomorrow.getTime() + DAY_MS) },
      // Réservée dans les dernières heures : l'e-mail « nouvelle réservation » vient de partir.
      createdAt: { lt: ago(ctx.now, 12 * HOUR_MS) },
      listing: { ownerId: { not: null }, status: { not: 'deleted' } },
    },
    select: {
      id: true,
      guestName: true,
      startDate: true,
      endDate: true,
      nights: true,
      guests: true,
      payment: true,
      contact: true,
      message: true,
      listing: { select: { core: true, owner: { select: HOST_SELECT } } },
    },
  });

  const links = buildHostLinks();
  for (const reservation of reservations) {
    const owner = reservation.listing.owner;
    const payment = asObject(reservation.payment);
    if (!owner || asObject(payment.cancellation).status === 'canceled') continue;

    const amounts = readBookingAmounts(payment);
    const contact = asObject(reservation.contact);
    await deliver(ctx, {
      host: owner,
      kind: 'arrival_tomorrow',
      claims: [{ dedupeKey: `arrival_tomorrow:${reservation.id}`, refId: reservation.id }],
      email: buildHostArrivalTomorrowEmail({
        hostFirstName: hostFirstName(owner),
        listingTitle: readString(asObject(reservation.listing.core).title) ?? 'Votre annonce',
        guestName: reservation.guestName,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        nights: Math.max(1, reservation.nights),
        guests: readGuestsBreakdown(asObject(reservation.guests)),
        contact: { email: readString(contact.email), phone: readString(contact.phone) },
        currency: amounts.currency,
        balance: amounts.balance,
        balanceMode: amounts.balanceMode,
        travellerMessage: readString(reservation.message),
        messagesUrl: links.messages,
      }),
      context: { reservationId: reservation.id },
    });
  }
}

// --- Bienvenue et compte de paiement ---------------------------------------------------------

async function remindAccountSetup(ctx: Context, hosts: HostRow[]): Promise<void> {
  const links = buildHostLinks();
  const welcomeSince = ago(ctx.now, HOST_REMINDER_RULES.welcomeAccountMaxAgeDays * DAY_MS);
  const connectAfter = ago(ctx.now, HOST_REMINDER_RULES.connectFirstReminderDays * DAY_MS);
  const gap = HOST_REMINDER_RULES.reminderGapDays * DAY_MS;

  const keys = hosts.flatMap((host) => [`welcome:${host.id}`, `connect_incomplete:${host.id}:1`, `connect_incomplete:${host.id}:2`]);
  const known = await existingKeys(ctx.prisma, keys);

  for (const host of hosts) {
    const welcomedAt = known.get(`welcome:${host.id}`);
    const wantsWelcome = host.createdAt > welcomeSince && !welcomedAt;
    // Premier rappel de paiement 2 jours après la bienvenue (ou l'inscription, pour un compte plus ancien).
    const quietSinceStart = welcomedAt ? welcomedAt < connectAfter : host.createdAt < connectAfter;
    const firstConnect = known.get(`connect_incomplete:${host.id}:1`);
    const connectStep = !firstConnect
      ? (quietSinceStart ? 1 : null)
      : (!known.has(`connect_incomplete:${host.id}:2`) && firstConnect < ago(ctx.now, gap) ? 2 : null);
    if (!wantsWelcome && !connectStep) continue;

    const connect = await readConnectState(ctx, host);

    if (wantsWelcome) {
      const billing = readBilling(host);
      const published = await ctx.prisma.listing.count({ where: { ownerId: host.id, status: 'published' } });
      await deliver(ctx, {
        host,
        kind: 'welcome',
        claims: [{ dedupeKey: `welcome:${host.id}`, refId: host.id }],
        email: buildHostWelcomeEmail({
          hostFirstName: hostFirstName(host),
          trialEndDate: billing.status === 'trialing' ? parseDate(billing.currentPeriodEndISO) : null,
          paymentsReady: connect.ready,
          hasPublishedListing: published > 0,
          activationUrl: links.activation,
          editorUrl: links.editor,
        }),
      });
      // La bienvenue présente déjà l'activation des paiements : pas de rappel le même jour.
      continue;
    }

    if (connectStep && !connect.ready) {
      await deliver(ctx, {
        host,
        kind: 'connect_incomplete',
        claims: [{ dedupeKey: `connect_incomplete:${host.id}:${connectStep}`, refId: host.id }],
        email: buildHostConnectIncompleteEmail({
          hostFirstName: hostFirstName(host),
          started: connect.started,
          activationUrl: links.activation,
          unsubscribeUrl: buildUnsubscribeUrl(host.id),
        }),
      });
    }
  }
}

// --- Brouillons ------------------------------------------------------------------------------

function describeDraft(listing: { core: unknown; medias: unknown; bookings: unknown }): DraftListingSummary {
  const core = asObject(listing.core);
  const title = readString(core.title);
  const photos = Array.isArray(asObject(listing.medias).images) ? (asObject(listing.medias).images as unknown[]).length : 0;
  const missing: string[] = [];
  if (!title || title === 'Nouvelle annonce') missing.push('un titre');
  if (stripHtml(core.description).length < 80) missing.push('une description de quelques lignes');
  if (photos === 0) missing.push('des photos (5 au moins sont conseillées)');
  else if (photos < 5) missing.push(`quelques photos : vous en avez ${photos}, 5 au moins sont conseillées`);
  if (toNumber(asObject(listing.bookings).price, 0) <= 0) missing.push('un prix par nuit');
  if (!readString(core.city)) missing.push('la ville du logement');
  return { title: title && title !== 'Nouvelle annonce' ? title : 'Annonce sans titre', missing };
}

async function remindDrafts(ctx: Context): Promise<void> {
  const rules = HOST_REMINDER_RULES;
  const drafts = await ctx.prisma.listing.findMany({
    where: {
      status: 'draft',
      kind: 'listing',
      ownerId: { not: null },
      updatedAt: {
        lt: ago(ctx.now, rules.draftFirstReminderDays * DAY_MS),
        gt: ago(ctx.now, rules.draftMaxAgeDays * DAY_MS),
      },
    },
    select: { id: true, core: true, medias: true, bookings: true, updatedAt: true, owner: { select: HOST_SELECT } },
    orderBy: { updatedAt: 'desc' },
  });

  const known = await existingKeys(
    ctx.prisma,
    drafts.flatMap((draft) => [`draft_reminder:${draft.id}:1`, `draft_reminder:${draft.id}:2`]),
  );
  const byOwner = new Map<string, { host: HostRow; items: Array<{ id: string; step: 1 | 2; summary: DraftListingSummary }> }>();

  for (const draft of drafts) {
    if (!draft.owner) continue;
    const first = known.get(`draft_reminder:${draft.id}:1`);
    let step: 1 | 2 | null = null;
    if (!first) step = 1;
    else if (
      !known.has(`draft_reminder:${draft.id}:2`)
      && first < ago(ctx.now, rules.reminderGapDays * DAY_MS)
      && draft.updatedAt < ago(ctx.now, rules.draftLastReminderDays * DAY_MS)
    ) step = 2;
    if (!step) continue;

    const entry = byOwner.get(draft.owner.id) ?? { host: draft.owner, items: [] };
    entry.items.push({ id: draft.id, step, summary: describeDraft(draft) });
    byOwner.set(draft.owner.id, entry);
  }

  const links = buildHostLinks();
  for (const { host, items } of byOwner.values()) {
    const billing = readBilling(host);
    const accountSteps: string[] = [];
    if (!PUBLICATION_STATUSES.includes(readString(billing.status) ?? '')) {
      accountSteps.push('Choisir votre offre : les 30 premiers jours sont gratuits.');
    }
    const connect = await readConnectState(ctx, host);
    if (!connect.ready) accountSteps.push('Activer les paiements : un compte Stripe à votre nom, environ 5 minutes.');

    await deliver(ctx, {
      host,
      kind: 'draft_reminder',
      claims: items.map((item) => ({ dedupeKey: `draft_reminder:${item.id}:${item.step}`, refId: item.id })),
      email: buildHostDraftReminderEmail({
        hostFirstName: hostFirstName(host),
        drafts: items.map((item) => item.summary),
        accountSteps,
        step: items.every((item) => item.step === 2) ? 2 : 1,
        editorUrl: links.editor,
        unsubscribeUrl: buildUnsubscribeUrl(host.id),
      }),
    });
  }
}

// --- Fin d'essai, d'abonnement ou d'accès offert --------------------------------------------

type PlanEnding = { variant: HostPlanEndingVariant; endDate: Date; monthlyAmount: string | null };

function withinNotice(ctx: Context, date: Date | null): date is Date {
  if (!date) return false;
  const delta = date.getTime() - ctx.now.getTime();
  return delta > 0 && delta <= HOST_REMINDER_RULES.planEndingNoticeDays * DAY_MS;
}

function fromUnix(value: number | null | undefined): Date | null {
  return typeof value === 'number' && value > 0 ? new Date(value * 1000) : null;
}

async function resolvePlanEnding(ctx: Context, host: HostRow): Promise<PlanEnding | null> {
  const billing = readBilling(host);
  const subscriptionId = readString(billing.subscriptionId);

  if (billing.complimentary === true) {
    const end = parseDate(billing.complimentaryEndsAtISO);
    return withinNotice(ctx, end) ? { variant: 'complimentary_ends', endDate: end, monthlyAmount: null } : null;
  }

  if (!subscriptionId) {
    const end = parseDate(billing.giftedTrialEndsAtISO);
    return withinNotice(ctx, end) ? { variant: 'complimentary_ends', endDate: end, monthlyAmount: null } : null;
  }

  // Seuls un essai ou un abonnement résilié peuvent prendre fin ; un abonnement actif se renouvelle.
  // Le résumé local écarte d'abord ceux dont la fin est encore lointaine (pas d'appel Stripe inutile).
  if (billing.status !== 'trialing' && billing.cancelAtPeriodEnd !== true) return null;
  const snapshotEnd = parseDate(billing.currentPeriodEndISO);
  if (snapshotEnd && snapshotEnd.getTime() - ctx.now.getTime() > (HOST_REMINDER_RULES.planEndingNoticeDays + 2) * DAY_MS) {
    return null;
  }

  // Le résumé local peut dater : Stripe fait foi quand il est configuré.
  if (ctx.stripe && !subscriptionId.startsWith('sub_mock_')) {
    try {
      const subscription = await ctx.stripe.subscriptions.retrieve(subscriptionId);
      const monthlyMinor = subscription.items.data.reduce(
        (sum, item) => sum + (item.price.unit_amount ?? 0) * (item.quantity ?? 1),
        0,
      );
      const monthlyAmount = monthlyMinor > 0 ? formatCurrency(monthlyMinor / 100, subscription.currency.toUpperCase()) : null;
      if (subscription.status === 'trialing') {
        const end = fromUnix(subscription.trial_end);
        if (!withinNotice(ctx, end)) return null;
        return { variant: subscription.cancel_at_period_end ? 'trial_ends' : 'trial_converts', endDate: end, monthlyAmount };
      }
      if (subscription.status === 'active' && subscription.cancel_at_period_end) {
        const end = fromUnix(subscription.current_period_end);
        return withinNotice(ctx, end) ? { variant: 'subscription_ends', endDate: end, monthlyAmount: null } : null;
      }
      return null;
    } catch (error) {
      ctx.logger.warn({ err: error, userId: host.id }, '[host-reminders] Stripe subscription lookup failed');
      return null;
    }
  }

  const end = parseDate(billing.currentPeriodEndISO);
  if (!withinNotice(ctx, end)) return null;
  const cancels = billing.cancelAtPeriodEnd === true;
  if (billing.status === 'trialing') {
    const plan = PLAN_TEMPLATES[normalizePlanCode(billing.planCode) ?? 'indiehost'];
    return {
      variant: cancels ? 'trial_ends' : 'trial_converts',
      endDate: end,
      monthlyAmount: formatCurrency(plan.defaultMonthlyPriceMinor / 100, 'EUR'),
    };
  }
  return cancels ? { variant: 'subscription_ends', endDate: end, monthlyAmount: null } : null;
}

async function remindPlanEndings(ctx: Context): Promise<void> {
  const hosts = await ctx.prisma.user.findMany({
    where: {
      deletedAt: null,
      email: { not: null },
      OR: [
        ...PUBLICATION_STATUSES.map((status) => ({ stripeConnectProfile: { path: ['billing', 'status'], equals: status } })),
        { stripeConnectProfile: { path: ['billing', 'complimentary'], equals: true } },
      ],
    },
    select: HOST_SELECT,
  });

  const links = buildHostLinks();
  for (const host of hosts) {
    const ending = await resolvePlanEnding(ctx, host);
    if (!ending) continue;

    const billing = readBilling(host);
    const plan = normalizePlanCode(billing.planCode);
    const activeListings = await ctx.prisma.listing.count({
      where: { ownerId: host.id, kind: 'listing', status: { in: [...LISTING_LIMIT_COUNTED_STATUSES] } },
    });
    await deliver(ctx, {
      host,
      kind: 'plan_ending',
      claims: [{
        dedupeKey: `plan_ending:${host.id}:${ending.variant}:${ending.endDate.toISOString().slice(0, 10)}`,
        refId: host.id,
      }],
      email: buildHostPlanEndingEmail({
        hostFirstName: hostFirstName(host),
        variant: ending.variant,
        endDate: ending.endDate,
        planName: plan ? PLAN_TEMPLATES[plan].name : null,
        monthlyAmount: ending.monthlyAmount,
        activeListings,
        dashboardUrl: links.editor,
        plansUrl: links.plans,
      }),
    });
  }
}

// --- Calendriers iCal en erreur --------------------------------------------------------------

async function remindCalendarErrors(ctx: Context): Promise<void> {
  const syncs = await ctx.prisma.calendarSync.findMany({
    where: {
      lastStatus: 'error',
      sourceUrl: { not: null },
      lastSyncedAt: { gt: ago(ctx.now, HOST_REMINDER_RULES.calendarErrorRecentDays * DAY_MS) },
      listing: { status: 'published', ownerId: { not: null } },
    },
    select: { id: true, name: true, listingId: true, listing: { select: { core: true, owner: { select: HOST_SELECT } } } },
  });
  if (syncs.length === 0) return;

  const week = isoWeekKey(ctx.now);
  const known = await existingKeys(ctx.prisma, syncs.map((sync) => `calendar_sync_error:${sync.id}:${week}`));
  const calendar = new CalendarService(ctx.prisma);
  const links = buildHostLinks();

  for (const sync of syncs) {
    const owner = sync.listing.owner;
    if (!owner || known.has(`calendar_sync_error:${sync.id}:${week}`)) continue;

    // Une erreur passagère (Airbnb indisponible un instant) ne mérite pas d'e-mail : on réessaie d'abord.
    if (!ctx.dryRun) {
      try {
        const outcome = await calendar.syncCalendarSource(sync.listingId, sync.id, { force: true });
        if (outcome?.status === 'synced') continue;
      } catch (error) {
        ctx.logger.warn({ err: error, syncId: sync.id }, '[host-reminders] calendar retry failed');
      }
    }

    await deliver(ctx, {
      host: owner,
      kind: 'calendar_sync_error',
      claims: [{ dedupeKey: `calendar_sync_error:${sync.id}:${week}`, refId: sync.listingId }],
      email: buildHostCalendarSyncErrorEmail({
        hostFirstName: hostFirstName(owner),
        listingTitle: readString(asObject(sync.listing.core).title) ?? 'Votre annonce',
        calendarName: readString(sync.name),
        editorUrl: links.editor,
      }),
      context: { syncId: sync.id, listingId: sync.listingId },
    });
  }
}

// --- Passe complète --------------------------------------------------------------------------

export async function runHostReminders(
  prisma: PrismaClient,
  logger: HostRemindersLogger,
  options?: { now?: Date; dryRun?: boolean; ignoreSendWindow?: boolean },
): Promise<HostRemindersReport> {
  const now = options?.now ?? new Date();
  const report: HostRemindersReport = {
    startedAt: now.toISOString(),
    finishedAt: now.toISOString(),
    skipped: null,
    dryRun: Boolean(options?.dryRun),
    sent: {},
    failed: 0,
  };

  if (!options?.dryRun && !isMailerConfigured()) {
    report.skipped = 'mailer_not_configured';
    return report;
  }
  const hour = parisHour(now);
  if (!options?.ignoreSendWindow && (hour < SEND_WINDOW.fromHour || hour >= SEND_WINDOW.toHour)) {
    report.skipped = 'outside_send_window';
    return report;
  }

  const ctx: Context = {
    prisma,
    logger,
    stripe: env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION }) : null,
    now,
    dryRun: Boolean(options?.dryRun),
    report,
  };

  const steps: Array<[string, () => Promise<void>]> = [
    ['arrivals', () => remindArrivals(ctx)],
    ['account', async () => remindAccountSetup(ctx, await loadSubscribedHosts(ctx))],
    ['drafts', () => remindDrafts(ctx)],
    ['plan_endings', () => remindPlanEndings(ctx)],
    ['calendars', () => remindCalendarErrors(ctx)],
  ];

  // Une étape en échec n'empêche pas les suivantes.
  for (const [name, run] of steps) {
    try {
      await run();
    } catch (error) {
      report.failed += 1;
      logger.error({ err: error, step: name }, '[host-reminders] step failed');
    }
  }

  report.finishedAt = new Date().toISOString();
  if (Object.keys(report.sent).length > 0 || report.failed > 0) {
    logger.info({ report }, '[host-reminders] pass finished');
  }
  return report;
}

export function startHostRemindersScheduler(
  prisma: PrismaClient,
  logger: HostRemindersLogger,
  options?: { initialDelayMs?: number; intervalMs?: number },
): () => void {
  const initialDelayMs = options?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  let running = false;
  let interval: NodeJS.Timeout | null = null;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runHostReminders(prisma, logger);
    } catch (error) {
      logger.error({ err: error }, '[host-reminders] pass failed');
    } finally {
      running = false;
    }
  };

  const initial = setTimeout(() => {
    void run();
    interval = setInterval(() => void run(), intervalMs);
    interval.unref();
  }, initialDelayMs);
  initial.unref();

  logger.info({ initialDelayMs, intervalMs }, 'Host reminders scheduled');

  return () => {
    clearTimeout(initial);
    if (interval) clearInterval(interval);
  };
}
