// Paiements à plusieurs : passage toutes les 5 minutes. Un groupe a 72 h pour régler toutes ses
// parts ; cette tâche envoie les rappels (48 h, 24 h et 6 h avant l'échéance), débite un groupe
// devenu complet sans que le site l'ait signalé, et clôt un groupe dont le délai est dépassé
// (empreintes levées, réservation annulée, dates libérées).
//
// Les routes font le même travail au fil de l'eau (`GroupBookingsService.confirmShare`) : la tâche
// est le filet qui garantit l'échéance. `GROUP_PAYMENTS_JOB_ENABLED=false` pour la couper.
//
// À la main : `npm run group-payments -- --dry-run` (liste des groupes en cours, sans rien toucher).

import type { PrismaClient } from '@prisma/client';

import { createBookingServices } from '../domains/bookings/groupBookings.factory.js';
import type { GroupPaymentsPassReport } from '../domains/bookings/groupBookings.service.js';
import { registerScheduledJob, trackJobRun, type JobRunVerdict } from '../lib/jobRuns.js';

export type GroupPaymentsLogger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

const DEFAULT_INITIAL_DELAY_MS = 60_000;
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export async function listOpenGroupPayments(prisma: PrismaClient, now = new Date()) {
  return createBookingServices(prisma).groupBookings.listOpenGroups(now);
}

export async function runGroupPaymentsPass(prisma: PrismaClient, now = new Date()): Promise<GroupPaymentsPassReport> {
  return createBookingServices(prisma).groupBookings.runScheduledPass(now);
}

/**
 * Bilan d'un passage pour la page Services : un groupe en erreur (Stripe injoignable, empreinte pas
 * levée) est retenté au passage suivant, d'où un avertissement ; tous en erreur, un échec signalé.
 */
export function assessGroupPaymentsReport(report: GroupPaymentsPassReport): JobRunVerdict {
  if (!report.errors.length) return null;

  const first = report.errors[0]!;
  const summary = `${report.errors.length} paiement${report.errors.length > 1 ? 's' : ''} à plusieurs sur ${report.groups} en erreur (${first.message}).`;
  return report.errors.length >= report.groups ? { error: summary } : { warning: summary };
}

export function startGroupPaymentsScheduler(
  prisma: PrismaClient,
  logger: GroupPaymentsLogger,
  options?: { initialDelayMs?: number; intervalMs?: number },
): () => void {
  const initialDelayMs = options?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const services = createBookingServices(prisma);

  let running = false;
  let interval: NodeJS.Timeout | null = null;

  const run = async () => {
    // Un passage plus long que l'intervalle (Stripe lent) : le suivant est sauté, pas empilé.
    if (running) return;
    running = true;
    try {
      const report = await trackJobRun('group-payments', () => services.groupBookings.runScheduledPass(), assessGroupPaymentsReport);
      // Une ligne de journal seulement quand quelque chose a bougé : la tâche passe 288 fois par jour.
      if (report.errors.length) {
        logger.warn({ errors: report.errors, groups: report.groups }, '[group-payments] groups in error');
      }
      if (report.completed || report.expired || report.remindersSent || report.sharesAuthorized) {
        logger.info({
          groups: report.groups,
          sharesAuthorized: report.sharesAuthorized,
          completed: report.completed,
          expired: report.expired,
          remindersSent: report.remindersSent,
        }, '[group-payments] pass done');
      }
    } catch (error) {
      logger.error({ err: error }, '[group-payments] pass failed');
    } finally {
      running = false;
    }
  };

  registerScheduledJob('group-payments', { intervalMs, firstRunAt: Date.now() + initialDelayMs });

  const initial = setTimeout(() => {
    void run();
    interval = setInterval(() => void run(), intervalMs);
    interval.unref();
  }, initialDelayMs);
  initial.unref();

  logger.info({ initialDelayMs, intervalMs }, 'Group payments scheduled');

  return () => {
    clearTimeout(initial);
    if (interval) clearInterval(interval);
  };
}
