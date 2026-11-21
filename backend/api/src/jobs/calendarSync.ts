// Synchronisation planifiée des calendriers importés (Airbnb, Booking…), toutes les 5 minutes par
// défaut (`ICAL_SYNC_JOB_INTERVAL_SECONDS`). Avant le 2026-11-21, un calendrier n'était relu qu'à la
// consultation de l'annonce publique ou quand l'hôte cliquait sur « Forcer une synchro » : une
// réservation prise sur Booking pouvait rester inconnue d'IndieHost pendant des heures.
//
// Cinq minutes : assez court pour qu'une réservation prise ailleurs ferme vite les dates ici, assez
// long pour ne pas harceler les plateformes, qui peuvent refuser un serveur trop insistant (ce serveur
// leur sert aussi à importer les annonces).
//
// À la main : `npm run calendar-sync -- --dry-run` (liste des calendriers, sans rien relire).

import type { PrismaClient } from '@prisma/client';

import { CalendarService, type ScheduledSyncReport } from '../domains/calendar/calendar.service.js';
import { registerScheduledJob, trackJobRun, type JobRunVerdict } from '../lib/jobRuns.js';

export type CalendarSyncLogger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

const DEFAULT_INITIAL_DELAY_MS = 45_000;
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
// Un calendrier relu depuis moins d'une minute (visite de l'annonce, clic de l'hôte) attend la passe suivante.
const MIN_AGE_MS = 60_000;
// En dessous, un calendrier en erreur vient presque toujours du lien d'un hôte, pas du serveur.
const SYSTEMIC_FAILURE_MIN_SOURCES = 3;

export type CalendarSyncSourceSummary = {
  syncId: string;
  listingId: string;
  name: string | null;
  /** Hôte de l'adresse seulement : l'adresse complète porte un jeton secret de la plateforme. */
  host: string | null;
  lastSyncedAt: string | null;
  lastStatus: string | null;
};

function sourceHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Calendriers que la tâche relirait, sans rien relire (aperçu `--dry-run`). */
export async function listCalendarSyncSources(prisma: PrismaClient): Promise<CalendarSyncSourceSummary[]> {
  const sources = await prisma.calendarSync.findMany({
    where: { sourceUrl: { not: null }, listing: { status: { not: 'deleted' } } },
    select: { id: true, listingId: true, name: true, sourceUrl: true, lastSyncedAt: true, lastStatus: true },
    orderBy: { createdAt: 'asc' },
  });

  return sources.map((source) => ({
    syncId: source.id,
    listingId: source.listingId,
    name: source.name,
    host: sourceHost(source.sourceUrl),
    lastSyncedAt: source.lastSyncedAt ? source.lastSyncedAt.toISOString() : null,
    lastStatus: source.lastStatus,
  }));
}

export async function runCalendarSync(
  prisma: PrismaClient,
  options: { minAgeMs?: number } = {},
): Promise<ScheduledSyncReport> {
  return new CalendarService(prisma).syncAllSources({ minAgeMs: options.minAgeMs ?? MIN_AGE_MS });
}

/**
 * Bilan d'un passage pour la page Services. Un calendrier en erreur vient le plus souvent du lien d'un
 * hôte (adresse retirée, flux vide) : avertissement affiché, sans alerte, et le détail est dans la
 * sonde « Calendriers importés ». Tous en erreur dès qu'il y en a plusieurs : le serveur lui-même ne
 * joint plus les plateformes, échec signalé.
 */
export function assessCalendarSyncReport(report: ScheduledSyncReport): JobRunVerdict {
  if (!report.failed.length) return null;

  const attempted = report.synced + report.failed.length;
  const first = report.failed[0]!;
  const example = `${first.name?.trim() || 'calendrier'} : ${first.error}`;

  if (report.failed.length >= attempted && attempted >= SYSTEMIC_FAILURE_MIN_SOURCES) {
    return { error: `Aucun des ${attempted} calendriers relus n’a répondu correctement (${example}).` };
  }

  return {
    warning: `${report.failed.length} calendrier${report.failed.length > 1 ? 's' : ''} sur ${attempted} en erreur (${example}).`,
  };
}

export function startCalendarSyncScheduler(
  prisma: PrismaClient,
  logger: CalendarSyncLogger,
  options?: { initialDelayMs?: number; intervalMs?: number },
): () => void {
  const initialDelayMs = options?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const minAgeMs = Math.min(MIN_AGE_MS, Math.floor(intervalMs / 2));

  let running = false;
  let interval: NodeJS.Timeout | null = null;

  const run = async () => {
    // Une passe plus longue que l'intervalle (plateforme lente) : la suivante est sautée, pas empilée.
    if (running) return;
    running = true;
    try {
      const report = await trackJobRun('calendar-sync', () => runCalendarSync(prisma, { minAgeMs }), assessCalendarSyncReport);
      // Une ligne de journal seulement quand quelque chose a bougé : la tâche passe 288 fois par jour.
      const newlyFailed = report.failed.filter((item) => item.newlyFailed);
      if (newlyFailed.length) {
        logger.warn({ failed: newlyFailed, sources: report.sources }, '[calendar-sync] calendars in error');
      }
      if (report.changed || report.listingsUpdated) {
        logger.info({
          sources: report.sources,
          synced: report.synced,
          changed: report.changed,
          listingsUpdated: report.listingsUpdated,
        }, '[calendar-sync] availability updated');
      }
    } catch (error) {
      logger.error({ err: error }, '[calendar-sync] pass failed');
    } finally {
      running = false;
    }
  };

  registerScheduledJob('calendar-sync', { intervalMs, firstRunAt: Date.now() + initialDelayMs });

  const initial = setTimeout(() => {
    void run();
    interval = setInterval(() => void run(), intervalMs);
    interval.unref();
  }, initialDelayMs);
  initial.unref();

  logger.info({ initialDelayMs, intervalMs }, 'Calendar sync scheduled');

  return () => {
    clearTimeout(initial);
    if (interval) clearInterval(interval);
  };
}
