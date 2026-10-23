import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';

import {
  DELETED_MESSAGE_BODY,
  anonymizeReservations,
  rewriteListingReservationCopies,
  stripReservationRecordMessages,
} from '../domains/privacy/anonymization.js';
import { PrivacyService, deleteClerkUser } from '../domains/privacy/privacy.service.js';
import { asObject } from '../lib/json.js';
import { toPrismaJson } from '../lib/prisma.js';

/**
 * Purge automatique selon la politique de confidentialité (`frontend/src/views/Legal/content/confidentialite.html`) :
 * - réservations : 5 ans après la fin du séjour → voyageur anonymisé (montants et statut conservés) ;
 * - messagerie : 1 an après la fin du séjour → corps des messages supprimés ;
 * - compte : 3 ans d'inactivité → anonymisé (sauf abonnement en cours ou séjour à venir) ;
 * - échanges bruts Stripe (`Payment.rawRequest` / `rawResponse`, qui contiennent le client_secret) :
 *   90 jours, durée technique non listée par la politique ;
 * - copie brute des flux iCal (`CalendarSync.rawIcs`) : 7 jours, re-téléchargée à chaque synchronisation ;
 * - journal des e-mails aux hôtes (`HostNotification`, identifiants seulement) : 400 jours.
 * Idempotent : chaque passe ne touche que les lignes pas encore purgées.
 */

export const RETENTION_RULES = {
  reservationYears: 5,
  messagesYears: 1,
  inactiveAccountYears: 3,
  paymentRawDays: 90,
  calendarIcsDays: 7,
  // Journal des e-mails aux hôtes (`HostNotification`) : sert à ne pas renvoyer un même e-mail.
  hostNotificationDays: 400,
} as const;

const BATCH_SIZE = 200;
const MAX_BATCHES_PER_RUN = 50;
const INACTIVE_ACCOUNTS_PER_RUN = 50;

export type RetentionLogger = Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;

export type RetentionPurgeReport = {
  startedAt: string;
  finishedAt: string;
  reservationsAnonymized: number;
  reservationThreadsStripped: number;
  messagesDeleted: number;
  paymentsRawCleared: number;
  calendarIcsCleared: number;
  hostNotificationsDeleted: number;
  accountsAnonymized: number;
  accountsSkipped: number;
};

type ReservationRef = { id: string; listingId: string };

function subtractYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() - years);
  return next;
}

function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

async function purgeOldReservations(prisma: PrismaClient, cutoff: Date): Promise<number> {
  let total = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
    const rows = await prisma.$queryRaw<ReservationRef[]>`
      SELECT "id", "listingId"
      FROM "Reservation"
      WHERE "endDate" < ${cutoff}
        AND NOT ("contact" ? 'anonymizedAt')
      ORDER BY "endDate" ASC
      LIMIT ${BATCH_SIZE}
    `;
    if (!rows.length) break;

    total += await prisma.$transaction((tx) => anonymizeReservations(tx, rows), { timeout: 60_000 });
    if (rows.length < BATCH_SIZE) break;
  }

  return total;
}

/** Fil de messages copié dans `Reservation.messaging` (et dans le JSON de l'annonce) : retiré à 1 an. */
async function purgeReservationThreadCopies(prisma: PrismaClient, cutoff: Date): Promise<number> {
  let total = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
    const rows = await prisma.$queryRaw<ReservationRef[]>`
      SELECT "id", "listingId"
      FROM "Reservation"
      WHERE "endDate" < ${cutoff}
        AND ("messaging" ? 'messages')
      ORDER BY "endDate" ASC
      LIMIT ${BATCH_SIZE}
    `;
    if (!rows.length) break;

    total += await prisma.$transaction(async (tx) => {
      const reservations = await tx.reservation.findMany({
        where: { id: { in: rows.map((row) => row.id) } },
        select: { id: true, listingId: true, messaging: true },
      });

      const byListing = new Map<string, Set<string>>();
      for (const reservation of reservations) {
        const { messages: _messages, ...messaging } = asObject(reservation.messaging);
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { messaging: toPrismaJson(messaging) },
        });
        const set = byListing.get(reservation.listingId) ?? new Set<string>();
        set.add(reservation.id);
        byListing.set(reservation.listingId, set);
      }

      for (const [listingId, ids] of byListing) {
        await rewriteListingReservationCopies(tx, listingId, ids, stripReservationRecordMessages);
      }

      return reservations.length;
    }, { timeout: 60_000 });

    if (rows.length < BATCH_SIZE) break;
  }

  return total;
}

async function purgeOldMessages(prisma: PrismaClient, cutoff: Date): Promise<number> {
  const result = await prisma.message.updateMany({
    where: {
      body: { not: DELETED_MESSAGE_BODY },
      OR: [
        // Message rattaché à un séjour terminé depuis plus d'un an (directement ou via sa conversation).
        { reservation: { endDate: { lt: cutoff } } },
        { conversation: { reservation: { endDate: { lt: cutoff } } } },
        // Conversation sans réservation (demande avant réservation) : un an après l'envoi.
        { reservationId: null, conversation: { reservationId: null }, sentAt: { lt: cutoff } },
      ],
    },
    data: { body: DELETED_MESSAGE_BODY, metadata: Prisma.DbNull },
  });
  return result.count;
}

async function purgePaymentRawExchanges(prisma: PrismaClient, cutoff: Date): Promise<number> {
  const result = await prisma.payment.updateMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [
        { rawRequest: { not: Prisma.AnyNull } },
        { rawResponse: { not: Prisma.AnyNull } },
      ],
    },
    data: { rawRequest: Prisma.DbNull, rawResponse: Prisma.DbNull },
  });
  return result.count;
}

async function purgeCalendarRawIcs(prisma: PrismaClient, cutoff: Date): Promise<number> {
  const result = await prisma.calendarSync.updateMany({
    where: { rawIcs: { not: null }, updatedAt: { lt: cutoff } },
    data: { rawIcs: null },
  });
  return result.count;
}

/**
 * Comptes inactifs : `User.updatedAt` est rafraîchi à chaque ouverture du tableau de bord
 * (`upsertUserFromAuth`), c'est la meilleure trace de dernière connexion disponible.
 */
async function purgeInactiveAccounts(
  prisma: PrismaClient,
  service: PrivacyService,
  logger: RetentionLogger,
  cutoff: Date,
  now: Date,
): Promise<{ anonymized: number; skipped: number }> {
  const candidates = await prisma.user.findMany({
    where: { deletedAt: null, updatedAt: { lt: cutoff } },
    orderBy: { updatedAt: 'asc' },
    take: INACTIVE_ACCOUNTS_PER_RUN,
  });

  let anonymized = 0;
  let skipped = 0;

  for (const user of candidates) {
    const blockers = await service.assessDeletionBlockers(user, { now });
    if (blockers.length) {
      skipped += 1;
      logger.info({ userId: user.id, blockers }, 'Retention: inactive account kept');
      continue;
    }

    const result = await service.anonymizeUser(user.id);
    if (result.status !== 'anonymized') continue;
    anonymized += 1;

    const clerkUserId = result.clerkUserId;
    if (clerkUserId && !clerkUserId.startsWith('deleted_')) {
      const outcome = await deleteClerkUser(clerkUserId);
      if (outcome === 'failed') {
        logger.warn({ userId: user.id, clerkUserId }, 'Retention: inactive account anonymized but Clerk user deletion failed');
      }
    }
    logger.info({ userId: user.id, counts: result.counts }, 'Retention: inactive account anonymized');
  }

  return { anonymized, skipped };
}

export async function runRetentionPurge(
  prisma: PrismaClient,
  logger: RetentionLogger,
  options?: { now?: Date },
): Promise<RetentionPurgeReport> {
  const now = options?.now ?? new Date();
  const startedAt = now.toISOString();
  const service = new PrivacyService(prisma);

  const reservationsAnonymized = await purgeOldReservations(prisma, subtractYears(now, RETENTION_RULES.reservationYears));
  const messagesCutoff = subtractYears(now, RETENTION_RULES.messagesYears);
  const messagesDeleted = await purgeOldMessages(prisma, messagesCutoff);
  const reservationThreadsStripped = await purgeReservationThreadCopies(prisma, messagesCutoff);
  const paymentsRawCleared = await purgePaymentRawExchanges(prisma, subtractDays(now, RETENTION_RULES.paymentRawDays));
  const calendarIcsCleared = await purgeCalendarRawIcs(prisma, subtractDays(now, RETENTION_RULES.calendarIcsDays));
  const hostNotificationsDeleted = (await prisma.hostNotification.deleteMany({
    where: { createdAt: { lt: subtractDays(now, RETENTION_RULES.hostNotificationDays) } },
  })).count;
  const accounts = await purgeInactiveAccounts(prisma, service, logger, subtractYears(now, RETENTION_RULES.inactiveAccountYears), now);

  const report: RetentionPurgeReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    reservationsAnonymized,
    reservationThreadsStripped,
    messagesDeleted,
    paymentsRawCleared,
    calendarIcsCleared,
    hostNotificationsDeleted,
    accountsAnonymized: accounts.anonymized,
    accountsSkipped: accounts.skipped,
  };

  logger.info(report, 'Retention purge completed');
  return report;
}

const DEFAULT_INITIAL_DELAY_MS = 5 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Planification : première passe 5 min après le démarrage, puis une fois par jour. Les minuteurs
 * sont `unref()` pour ne jamais retenir le processus ; la fonction renvoyée les arrête.
 */
export function startRetentionScheduler(
  prisma: PrismaClient,
  logger: RetentionLogger,
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
      await runRetentionPurge(prisma, logger);
    } catch (error) {
      logger.error({ err: error }, 'Retention purge failed');
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

  logger.info({ initialDelayMs, intervalMs }, 'Retention purge scheduled');

  return () => {
    clearTimeout(initial);
    if (interval) clearInterval(interval);
  };
}
