// Historique de la santé des services, gardé en base pour survivre aux redémarrages de l'API :
// une ligne par service et par demi-heure (`ServiceHealthBucket`), chaque changement d'état
// (`ServiceHealthIncident`) et la mémoire des alertes par e-mail (`ServiceHealthAlertState`).
//
// Une base lente ou injoignable ne bloque jamais la surveillance : chaque appel est abandonné au bout
// de `STORE_TIMEOUT_MS` (la requête peut finir plus tard, d'où des écritures rejouables : valeurs
// absolues pour les demi-heures, identifiant choisi d'avance pour les changements d'état), et ce qui
// n'a pas pu être écrit est réécrit au passage suivant.

import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';

import type { ServiceStatus } from './systemHealth.js';

export type BucketAggregate = {
  worstStatus: ServiceStatus;
  samples: number;
  trackedSamples: number;
  downSamples: number;
  latencySumMs: number;
  latencyCount: number;
};

export type StoredBucket = BucketAggregate & { serviceId: string; bucketStart: Date };

export type StoredIncident = {
  id: string;
  serviceId: string;
  fromStatus: string;
  toStatus: string;
  summary: string;
  occurredAt: Date;
  alertedAt: Date | null;
};

export type UptimeTotals = Map<string, { tracked: number; down: number; firstBucketAt: Date | null }>;

const WARN_EVERY_MS = 5 * 60 * 1000;
const STORE_TIMEOUT_MS = 5000;
const MAX_SUMMARY_LENGTH = 500;

class StoreTimeoutError extends Error {
  constructor(operation: string) {
    super(`${operation}: no answer from the database within ${STORE_TIMEOUT_MS} ms`);
    this.name = 'StoreTimeoutError';
  }
}

export class HealthStore {
  private lastWarnAt = 0;
  private healthy = true;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly log: FastifyBaseLogger,
  ) {}

  /** Faux tant que la dernière écriture ou lecture a échoué. */
  isAvailable(): boolean {
    return this.healthy;
  }

  /** Exécute un appel à la base avec un délai maximal ; null en cas d'échec ou de délai dépassé. */
  private async run<T>(operation: string, call: () => Promise<T>): Promise<T | null> {
    let timer: NodeJS.Timeout | undefined;
    const pending = call();
    // La requête abandonnée peut encore échouer plus tard : son erreur ne doit pas remonter seule.
    pending.catch(() => {});
    try {
      const value = await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new StoreTimeoutError(operation)), STORE_TIMEOUT_MS);
        }),
      ]);
      this.healthy = true;
      return value;
    } catch (error) {
      this.healthy = false;
      const now = Date.now();
      if (now - this.lastWarnAt >= WARN_EVERY_MS) {
        this.lastWarnAt = now;
        this.log.warn({ err: error, operation }, '[health] history store unavailable, kept in memory');
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async loadBuckets(since: Date): Promise<StoredBucket[] | null> {
    const rows = await this.run('loadBuckets', () => this.prisma.serviceHealthBucket.findMany({
      where: { bucketStart: { gte: since } },
      orderBy: { bucketStart: 'asc' },
    }));
    return rows?.map((row) => ({
      serviceId: row.serviceId,
      bucketStart: row.bucketStart,
      worstStatus: row.worstStatus as ServiceStatus,
      samples: row.samples,
      trackedSamples: row.trackedSamples,
      downSamples: row.downSamples,
      latencySumMs: row.latencySumMs,
      latencyCount: row.latencyCount,
    })) ?? null;
  }

  /** Écrit les demi-heures modifiées (valeurs complètes, pas des incréments : une reprise est sans effet). */
  async saveBuckets(rows: StoredBucket[]): Promise<boolean> {
    if (!rows.length) return true;
    const saved = await this.run('saveBuckets', () => this.prisma.$transaction(rows.map((row) => {
      const values = {
        worstStatus: row.worstStatus,
        samples: row.samples,
        trackedSamples: row.trackedSamples,
        downSamples: row.downSamples,
        latencySumMs: Math.min(row.latencySumMs, 2_000_000_000),
        latencyCount: row.latencyCount,
      };
      return this.prisma.serviceHealthBucket.upsert({
        where: { serviceId_bucketStart: { serviceId: row.serviceId, bucketStart: row.bucketStart } },
        create: { serviceId: row.serviceId, bucketStart: row.bucketStart, ...values },
        update: values,
      });
    })));
    return saved !== null;
  }

  async loadRecentIncidents(limit: number): Promise<StoredIncident[] | null> {
    return this.run('loadRecentIncidents', () => this.prisma.serviceHealthIncident.findMany({ orderBy: { occurredAt: 'desc' }, take: limit }));
  }

  /** Dernier état enregistré de chaque service (le changement d'état le plus récent). */
  async loadLatestStatuses(): Promise<Map<string, string> | null> {
    const rows = await this.run('loadLatestStatuses', () => this.prisma.$queryRaw<Array<{ serviceId: string; toStatus: string }>>`
      SELECT DISTINCT ON ("serviceId") "serviceId", "toStatus"
      FROM "ServiceHealthIncident"
      ORDER BY "serviceId", "occurredAt" DESC`);
    return rows ? new Map(rows.map((row) => [row.serviceId, row.toStatus])) : null;
  }

  /**
   * Changements d'état, identifiant choisi par la surveillance : réécrire une ligne déjà arrivée
   * (requête abandonnée qui a fini par passer) ne crée pas de doublon.
   */
  async insertIncidents(rows: StoredIncident[]): Promise<boolean> {
    if (!rows.length) return true;
    const inserted = await this.run('insertIncidents', () => this.prisma.serviceHealthIncident.createMany({
      data: rows.map((row) => ({ ...row, summary: row.summary.slice(0, MAX_SUMMARY_LENGTH) })),
      skipDuplicates: true,
    }));
    return inserted !== null;
  }

  async markAlerted(ids: string[], at: Date): Promise<boolean> {
    if (!ids.length) return true;
    const updated = await this.run('markAlerted', () => this.prisma.serviceHealthIncident.updateMany({ where: { id: { in: ids } }, data: { alertedAt: at } }));
    return updated !== null;
  }

  async loadAlertStates(): Promise<Map<string, unknown> | null> {
    const rows = await this.run('loadAlertStates', () => this.prisma.serviceHealthAlertState.findMany());
    return rows ? new Map(rows.map((row) => [row.serviceId, row.state as unknown])) : null;
  }

  async saveAlertStates(entries: Array<[string, unknown]>): Promise<boolean> {
    if (!entries.length) return true;
    const saved = await this.run('saveAlertStates', () => this.prisma.$transaction(entries.map(([serviceId, state]) => {
      const value = state as Prisma.InputJsonValue;
      return this.prisma.serviceHealthAlertState.upsert({
        where: { serviceId },
        create: { serviceId, state: value },
        update: { state: value },
      });
    })));
    return saved !== null;
  }

  /**
   * Mesures comptées depuis une date, par service : base de la disponibilité sur 7 et 30 jours, avec
   * la première demi-heure connue (la fenêtre n'est pas encore pleine dans les semaines qui suivent
   * la mise en service, ou pour un service ajouté depuis).
   */
  async availabilitySince(since: Date): Promise<UptimeTotals | null> {
    const rows = await this.run('availabilitySince', () => this.prisma.serviceHealthBucket.groupBy({
      by: ['serviceId'],
      where: { bucketStart: { gte: since } },
      _sum: { trackedSamples: true, downSamples: true },
      _min: { bucketStart: true },
    }));
    return rows
      ? new Map(rows.map((row) => [row.serviceId, {
          tracked: row._sum.trackedSamples ?? 0,
          down: row._sum.downSamples ?? 0,
          firstBucketAt: row._min.bucketStart ?? null,
        }]))
      : null;
  }

  async purge(bucketsBefore: Date, incidentsBefore: Date): Promise<void> {
    await this.run('purgeBuckets', () => this.prisma.serviceHealthBucket.deleteMany({ where: { bucketStart: { lt: bucketsBefore } } }));
    await this.run('purgeIncidents', () => this.prisma.serviceHealthIncident.deleteMany({ where: { occurredAt: { lt: incidentsBefore } } }));
  }
}
