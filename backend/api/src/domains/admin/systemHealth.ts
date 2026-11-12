// Santé des services d'IndieHost, pour la page « Services » de l'administration.
//
// Une sonde par service (site, serveur, base, robot d'import, Stripe, Clerk, Brevo…) tourne à son
// rythme dans le processus de l'API : toutes les 30 s pour ce qui est sur le serveur, toutes les
// quelques minutes pour les services extérieurs (leur quota d'appels n'est pas entamé). Chaque mesure
// compte dans sa demi-heure, gardée en mémoire (24 h, pour la page) et en base (90 jours,
// `healthStore.ts`) : l'historique et la disponibilité sur 7 et 30 jours survivent aux redémarrages.
// Seules les mesures à l'heure prévue comptent pour la disponibilité : les mesures de confirmation
// d'une panne et les relances à la main la fausseraient (elles se resserrent autour des pannes).
// Une panne confirmée, puis son retour, partent par e-mail à l'administration (`healthAlerts.ts`).
//
// Ordre d'un passage : les sondes, la décision d'alerte, l'envoi de l'e-mail, puis seulement les
// écritures en base. Une base lente ne retarde ainsi jamais l'alerte qui la concerne. Les passages
// ne se chevauchent pas.
//
// Les sondes ne lisent aucune donnée personnelle et ne renvoient jamais de clé : seulement des
// états, des délais et des chiffres agrégés.

import { randomUUID } from 'node:crypto';
import { monitorEventLoopDelay, performance, type IntervalHistogram } from 'node:perf_hooks';
import tls from 'node:tls';

import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import Stripe from 'stripe';

import { env } from '../../config/env.js';
import { listJobRuns, type JobId } from '../../lib/jobRuns.js';
import { isMailerConfigured, resolvePublicBaseUrl } from '../../lib/mailer.js';
import {
  HealthAlertPlanner,
  deliverHealthAlert,
  readHealthAlertSettings,
  readServiceAlertState,
  type AlertEvent,
  type AlertProblem,
  type HealthAlertSettings,
  type OpenAlert,
} from './healthAlerts.js';
import { HealthStore, type BucketAggregate, type StoredBucket, type StoredIncident, type UptimeTotals } from './healthStore.js';

export type ServiceStatus = 'up' | 'degraded' | 'down' | 'disabled' | 'unknown';
export type ServiceGroup = 'entry' | 'core' | 'data' | 'external';
export type ServiceId =
  | 'public'
  | 'proxy'
  | 'certificates'
  | 'site'
  | 'api'
  | 'database'
  | 'scraping'
  | 'jobs'
  | 'calendars'
  | 'stripe'
  | 'clerk'
  | 'email'
  | 'imagekit'
  | 'maps';

export type ServiceFact = { label: string; value: string; tone?: 'good' | 'warn' | 'bad' };

type ProbeResult = {
  status: ServiceStatus;
  latencyMs: number | null;
  /** Une phrase : ce qu'il faut retenir de la dernière mesure. */
  summary: string;
  facts: ServiceFact[];
  /** Problèmes précis (domaine, tâche) : nommés dans l'e-mail, et un nouveau relance l'alerte. */
  problems?: AlertProblem[];
};

type ProbeContext = { prisma: PrismaClient };

type ServiceDefinition = {
  id: ServiceId;
  group: ServiceGroup;
  label: string;
  /** À quoi sert le service, en mots simples. */
  role: string;
  everyMs: number;
  probe: (ctx: ProbeContext) => Promise<ProbeResult>;
};

type ServiceRuntime = {
  definition: ServiceDefinition;
  last: (ProbeResult & { checkedAt: number }) | null;
  /** Demi-heures des dernières 24 h (clé : début de la demi-heure, en millisecondes). */
  buckets: Map<number, BucketAggregate>;
  /** Demi-heures modifiées depuis la dernière écriture en base. */
  dirty: Set<number>;
  /** Dernier état suivi (en service, à surveiller, en panne), retrouvé en base au démarrage. */
  lastTracked: ServiceStatus | null;
  running: boolean;
  /** Dernière mesure à l'heure prévue (les mesures de confirmation ne décalent pas le rythme). */
  lastRunAt: number;
  /** Mesure supplémentaire demandée (confirmer une panne ou un retour avant d'écrire). */
  probeAt: number | null;
};

export type HealthIncident = {
  id: string;
  atISO: string;
  serviceId: ServiceId;
  label: string;
  /** `unknown` : service trouvé en panne au démarrage de la surveillance. */
  from: ServiceStatus;
  to: ServiceStatus;
  summary: string;
  /** Un e-mail (panne ou retour) est parti pour ce changement. */
  alerted: boolean;
};

export type HealthBucket = {
  startISO: string;
  status: ServiceStatus | 'none';
  samples: number;
  avgLatencyMs: number | null;
};

export type ServiceHealth = {
  id: ServiceId;
  group: ServiceGroup;
  label: string;
  role: string;
  status: ServiceStatus;
  latencyMs: number | null;
  summary: string;
  facts: ServiceFact[];
  checkedAtISO: string | null;
  everyMs: number;
  uptime24h: number | null;
  uptime7d: number | null;
  uptime30d: number | null;
  /** Première demi-heure gardée en base sur les 30 derniers jours : les fenêtres de 7 et 30 jours peuvent être incomplètes. */
  historySinceISO: string | null;
  history: HealthBucket[];
};

export type HealthAlertStatus = HealthAlertSettings & {
  /** Règles en vigueur, pour la phrase de la page. */
  rules: { confirmSeconds: number; recoveryMinutes: number; gapMinutes: number; maxPerDay: number };
  /** Dernier e-mail d'alerte tenté. */
  lastDelivery: { ok: boolean; atISO: string; reason: string | null } | null;
};

export type SystemHealthSnapshot = {
  generatedAtISO: string;
  monitoringSinceISO: string;
  environment: 'production' | 'development' | 'test';
  /** Faux quand la base ne répond pas : l'historique n'est alors gardé qu'en mémoire. */
  historyPersisted: boolean;
  alerts: HealthAlertStatus;
  overall: {
    status: ServiceStatus;
    up: number;
    degraded: number;
    down: number;
    disabled: number;
  };
  services: ServiceHealth[];
  incidents: HealthIncident[];
  jobs: JobHealth[];
};

export type JobHealth = {
  id: JobId;
  label: string;
  schedule: string;
  running: boolean;
  lastStartedAtISO: string | null;
  lastDurationMs: number | null;
  lastStatus: 'ok' | 'error' | null;
  lastError: string | null;
  lastWarning: string | null;
  nextRunAtISO: string | null;
  runs: number;
  failures: number;
};

const TICK_MS = 15_000;
const PROBE_TIMEOUT_MS = 12_000;
const HISTORY_MS = 24 * 60 * 60 * 1000;
const BUCKET_MS = 30 * 60 * 1000;
const BUCKET_COUNT = HISTORY_MS / BUCKET_MS;
const MAX_INCIDENTS = 60;
const FORCED_REFRESH_MIN_GAP_MS = 15_000;
const LONG_UPTIME_REFRESH_MS = 10 * 60 * 1000;
const PURGE_EVERY_MS = 24 * 60 * 60 * 1000;
const BUCKET_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const INCIDENT_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
// Alertes : panne confirmée par une seconde mesure 30 s plus tard ; retour annoncé après 5 min sans
// problème d'affilée ; au plus un e-mail de panne par service et par quart d'heure, et 6 par service
// sur 24 h glissantes.
const ALERT_CONFIRM_MS = 30 * 1000;
const ALERT_RECOVERY_MS = 5 * 60 * 1000;
const ALERT_MIN_GAP_MS = 15 * 60 * 1000;
const ALERT_MAX_PER_DAY = 6;
// Une demi-heure dont l'historique n'a pas encore pu être relu n'est pas réécrite : relecture retentée.
const BUCKET_RESTORE_RETRY_MS = 30 * 1000;
const MAX_UNSAVED_INCIDENTS = 200;
const CERTIFICATE_WARNING_DAYS = 14;
// Domaine d'hôte vérifié depuis moins longtemps : son certificat est en cours d'émission, pas en défaut.
const FRESH_DOMAIN_GRACE_MS = 15 * 60 * 1000;
const STRIPE_API_VERSION = '2025-02-24.acacia';
const SECOND = 1000;
const MINUTE = 60 * SECOND;

const JOB_LABELS: Record<JobId, { label: string; schedule: string }> = {
  retention: { label: 'Purge des données anciennes', schedule: 'une fois par jour' },
  'host-reminders': { label: 'Rappels par e-mail aux hôtes', schedule: 'chaque heure, envois de 9 h à 20 h' },
  'public-sites': { label: 'Référencement des sites d’hôtes', schedule: 'chaque heure' },
};

// --- Outils ---------------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' });
const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const numberFormatter = new Intl.NumberFormat('fr-FR');

function formatDuration(ms: number): string {
  if (ms < SECOND) return `${Math.round(ms)} ms`;
  if (ms < MINUTE) return `${(ms / SECOND).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`;
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, '0')}` : ''}`;
  return `${Math.round(hours / 24)} jours`;
}

function formatAgo(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  if (diff < MINUTE) return 'il y a moins d’une minute';
  return `il y a ${formatDuration(diff)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
  return `${(bytes / 1024 / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Go`;
}

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency.toUpperCase() }).format(amountMinor / 100);
}

function result(
  status: ServiceStatus,
  summary: string,
  facts: ServiceFact[] = [],
  latencyMs: number | null = null,
  problems: AlertProblem[] = [],
): ProbeResult {
  return { status, summary, facts, latencyMs, problems };
}

/**
 * Une sonde qui a besoin de la base ne peut rien dire quand la base ne répond pas : état inconnu, sans
 * alerte ni retour annoncé à tort. Seule la sonde de la base signale sa panne. Les sondes des services
 * extérieurs (Stripe, Brevo) continuent de mesurer le service lui-même et taisent les chiffres tirés de
 * la base.
 */
const DATABASE_UNAVAILABLE = 'État inconnu : la base de données ne répond pas.';

async function readDatabase<T>(read: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await read() };
  } catch {
    return { ok: false };
  }
}

function lowerFirst(text: string): string {
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

/** Cause lisible d'une erreur réseau, en minuscules et sans point (« connexion refusée… »). */
function describeNetworkError(error: unknown): string {
  const err = error as { name?: string; code?: string; cause?: { code?: string } } | null;
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') return 'pas de réponse dans le délai';
  const code = err?.cause?.code ?? err?.code ?? '';
  switch (code) {
    case 'ECONNREFUSED':
      return 'connexion refusée, le service ne tourne pas';
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'adresse introuvable sur le réseau';
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
    case 'TIMEOUT':
      return 'pas de réponse dans le délai';
    case 'ECONNRESET':
    case 'UND_ERR_SOCKET':
      return 'connexion coupée par le service';
    default:
      return code ? `injoignable, ${code}` : 'injoignable';
  }
}

/** La cause seule, en phrase : « Connexion refusée, le service ne tourne pas. » */
function networkErrorSentence(error: unknown): string {
  const reason = describeNetworkError(error);
  return `${reason.charAt(0).toUpperCase()}${reason.slice(1)}.`;
}

async function timedFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 6000, ...rest } = init;
  const started = performance.now();
  const response = await fetch(url, {
    redirect: 'manual',
    ...rest,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { response, latencyMs: Math.round(performance.now() - started) };
}

async function discardBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // Corps déjà lu ou fermé.
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Réponse HTTP d'un service interne : n'importe quelle réponse sous 500 prouve qu'il tourne. */
async function probeHttpService(url: string, okSummary: (latencyMs: number) => string, options?: { slowMs?: number; acceptRedirect?: boolean }): Promise<ProbeResult> {
  try {
    const { response, latencyMs } = await timedFetch(url, { timeoutMs: 5000 });
    await discardBody(response);
    if (response.status >= 500) {
      return result('down', `Répond par une erreur (${response.status}).`, [], latencyMs);
    }
    if (!options?.acceptRedirect && response.status >= 300 && response.status < 400) {
      return result('degraded', `Répond par une redirection (${response.status}).`, [], latencyMs);
    }
    if (!options?.acceptRedirect && response.status >= 400) {
      return result('degraded', `Répond ${response.status}.`, [], latencyMs);
    }
    const slow = latencyMs > (options?.slowMs ?? 1500);
    return result(slow ? 'degraded' : 'up', slow ? `Répond lentement (${latencyMs} ms).` : okSummary(latencyMs), [], latencyMs);
  } catch (error) {
    return result('down', networkErrorSentence(error));
  }
}

// --- Sondes ---------------------------------------------------------------------------------

const isProduction = env.NODE_ENV === 'production';
const rootDomain = env.PUBLIC_LISTING_ROOT_DOMAIN;
// Conteneur du site : nginx (port 80) en production, serveur Vite en développement.
const SITE_INTERNAL_URL = isProduction ? 'http://frontend/' : 'http://frontend:5179/';
const PROXY_INTERNAL_URL = 'http://nginx/';

let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  return stripeClient;
}

let loopDelay: IntervalHistogram | null = null;

async function probePublic(): Promise<ProbeResult> {
  if (!isProduction) return result('disabled', 'Contrôlé seulement en production (passage par Cloudflare).');
  const origin = resolvePublicBaseUrl();
  try {
    const { response, latencyMs } = await timedFetch(`${origin}/api/health`, { timeoutMs: 8000, redirect: 'follow' });
    const body = (await response.json().catch(() => null)) as { status?: unknown } | null;
    const facts: ServiceFact[] = [{ label: 'Adresse contrôlée', value: `${origin}/api/health` }];
    if (!response.ok || body?.status !== 'ok') {
      return result('down', `Le site public répond ${response.status} : les visiteurs n’atteignent pas le serveur.`, facts, latencyMs);
    }
    const slow = latencyMs > 2500;
    return result(slow ? 'degraded' : 'up', slow ? `Accessible, mais lent (${latencyMs} ms).` : `Accessible depuis Internet en ${latencyMs} ms.`, facts, latencyMs);
  } catch (error) {
    return result('down', networkErrorSentence(error), [{ label: 'Adresse contrôlée', value: `${origin}/api/health` }]);
  }
}

async function probeProxy(): Promise<ProbeResult> {
  return probeHttpService(PROXY_INTERNAL_URL, (ms) => `Aiguille les visites en ${ms} ms.`, { acceptRedirect: true });
}

function readCertificate(servername: string): Promise<{ validTo: Date; altNames: string }> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: 'nginx',
      port: 443,
      servername,
      // On lit aussi un certificat expiré ou étranger, pour le signaler.
      rejectUnauthorized: false,
      timeout: 5000,
    }, () => {
      const certificate = socket.getPeerCertificate();
      socket.end();
      if (!certificate?.valid_to) {
        reject(new Error('NO_CERTIFICATE'));
        return;
      }
      resolve({ validTo: new Date(certificate.valid_to), altNames: certificate.subjectaltname ?? '' });
    });
    socket.once('timeout', () => socket.destroy(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })));
    socket.once('error', reject);
  });
}

function certificateCovers(altNames: string, domain: string): boolean {
  const names = altNames.split(',').map((entry) => entry.trim().replace(/^DNS:/i, '').toLowerCase());
  return names.some((name) => name === domain || (name.startsWith('*.') && domain.endsWith(name.slice(1)) && domain.split('.').length === name.split('.').length));
}

async function probeCertificates(ctx: ProbeContext): Promise<ProbeResult> {
  if (!isProduction) return result('disabled', 'Pas de certificat en développement.');

  // Les domaines des hôtes viennent de la base : sans elle, seul celui d'IndieHost est contrôlé.
  const customDomains = await readDatabase(() => ctx.prisma.listing.findMany({
    where: { customDomain: { not: null }, customDomainVerifiedAt: { not: null }, status: { not: 'deleted' } },
    select: { customDomain: true, customDomainVerifiedAt: true },
  }));
  const verifiedAt = new Map(
    (customDomains.ok ? customDomains.value : []).map((row) => [row.customDomain as string, row.customDomainVerifiedAt?.getTime() ?? 0]),
  );
  const domains = [rootDomain, ...verifiedAt.keys()];
  const now = Date.now();
  const facts: ServiceFact[] = [];
  const problems: AlertProblem[] = [];
  let rootBad = false;
  let rootWarning = false;
  let hostWarning = false;

  // Lus en parallèle : un domaine d'hôte injoignable ne doit pas retarder les autres.
  const certificates = await Promise.allSettled(domains.map((domain) => readCertificate(domain)));

  for (const [index, domain] of domains.entries()) {
    const isRoot = domain === rootDomain;
    const label = isRoot ? `${domain} et ses sous-domaines` : domain;
    const report = (value: string, tone: 'warn' | 'bad') => {
      facts.push({ label, value, tone });
      problems.push({ key: domain, text: `${label} : ${lowerFirst(value)}` });
      if (isRoot && tone === 'bad') rootBad = true;
      else if (isRoot) rootWarning = true;
      else hostWarning = true;
    };
    const settled = certificates[index];
    if (!settled || settled.status === 'rejected') {
      if (isRoot) report('Aucun certificat lisible.', 'bad');
      else if (now - (verifiedAt.get(domain) ?? 0) < FRESH_DOMAIN_GRACE_MS) facts.push({ label, value: 'Certificat en cours d’émission (domaine vérifié il y a moins de 15 min).' });
      else report('Pas de certificat alors que le domaine est vérifié : son adresse pointe-t-elle encore vers le serveur ?', 'warn');
      continue;
    }
    const certificate = settled.value;
    if (!certificateCovers(certificate.altNames, domain)) {
      report('Le certificat présenté est celui d’un autre domaine.', 'bad');
      continue;
    }
    const daysLeft = Math.floor((certificate.validTo.getTime() - now) / (24 * 60 * MINUTE));
    if (daysLeft < 0) report(`Expiré depuis le ${dateFormatter.format(certificate.validTo)}`, 'bad');
    else if (daysLeft < CERTIFICATE_WARNING_DAYS) report(`Expire le ${dateFormatter.format(certificate.validTo)} (${daysLeft} j)`, 'warn');
    else facts.push({ label, value: `Valide jusqu’au ${dateFormatter.format(certificate.validTo)} (${daysLeft} j)`, tone: 'good' });
  }

  if (!customDomains.ok) facts.push({ label: 'Domaines des hôtes', value: 'Non contrôlés : la base de données ne répond pas.', tone: 'warn' });
  if (rootBad) return result('down', `Le certificat de ${rootDomain} pose problème : les navigateurs affichent une alerte.`, facts, null, problems);
  if (rootWarning || hostWarning) {
    const summary = problems.length > 1 ? `${problems.length} certificats expirent bientôt ou manquent.` : 'Un certificat expire bientôt ou manque.';
    return result('degraded', summary, facts, null, problems);
  }
  // Sans la liste des domaines des hôtes, l'état d'ensemble n'est pas connu.
  if (!customDomains.ok) return result('unknown', DATABASE_UNAVAILABLE, facts);
  const count = domains.length;
  return result('up', count > 1 ? `${count} certificats valides.` : 'Certificat valide.', facts);
}

async function probeSite(): Promise<ProbeResult> {
  return probeHttpService(SITE_INTERNAL_URL, (ms) => `Pages servies en ${ms} ms.`);
}

async function probeApi(): Promise<ProbeResult> {
  const memory = process.memoryUsage();
  const p99Ms = loopDelay ? loopDelay.percentile(99) / 1e6 : null;
  loopDelay?.reset();
  const facts: ServiceFact[] = [
    { label: 'En service depuis', value: formatDuration(process.uptime() * SECOND) },
    { label: 'Mémoire utilisée', value: formatBytes(memory.rss) },
    { label: 'Version de Node', value: process.version },
  ];
  if (p99Ms !== null && Number.isFinite(p99Ms)) {
    facts.push({ label: 'Plus long temps d’attente', value: `${Math.round(p99Ms)} ms`, tone: p99Ms > 1000 ? 'bad' : p99Ms > 200 ? 'warn' : 'good' });
  }
  if (p99Ms !== null && p99Ms > 1000) {
    return result('degraded', 'Le serveur est surchargé : il met plus d’une seconde à traiter certaines demandes.', facts);
  }
  return result('up', 'Répond normalement.', facts);
}

async function probeDatabase(ctx: ProbeContext): Promise<ProbeResult> {
  try {
    const started = performance.now();
    await ctx.prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - started);
    const rows = await ctx.prisma.$queryRaw<Array<{ size: bigint; connections: bigint }>>`
      SELECT pg_database_size(current_database()) AS size,
             (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS connections`;
    const stats = rows[0];
    const facts: ServiceFact[] = stats
      ? [
          { label: 'Taille', value: formatBytes(Number(stats.size)) },
          { label: 'Connexions ouvertes', value: numberFormatter.format(Number(stats.connections)) },
        ]
      : [];
    const slow = latencyMs > 300;
    return result(slow ? 'degraded' : 'up', slow ? `Répond lentement (${latencyMs} ms).` : `Répond en ${latencyMs} ms.`, facts, latencyMs);
  } catch (error) {
    return result('down', `La base ne répond pas (${describeNetworkError(error)}).`);
  }
}

async function probeScraping(): Promise<ProbeResult> {
  return probeHttpService(`${env.SCRAPING_SERVICE_URL.replace(/\/+$/, '')}/health`, (ms) => `Prêt à importer (${ms} ms).`, { slowMs: 2000 });
}

async function probeJobs(): Promise<ProbeResult> {
  const jobs = listJobRuns();
  if (!jobs.length) return result('disabled', 'Aucune tâche planifiée sur ce serveur (désactivées par la configuration).');

  const now = Date.now();
  const facts: ServiceFact[] = [];
  const problems: AlertProblem[] = [];
  let failed = 0;
  let late = 0;
  let warnings = 0;

  for (const job of jobs) {
    const meta = JOB_LABELS[job.id];
    const errored = job.lastStatus === 'error';
    const overdue = !job.running && job.nextRunAt !== null && now > job.nextRunAt + 15 * MINUTE;
    const warned = job.lastStatus === 'ok' && Boolean(job.lastWarning);
    if (errored) failed += 1;
    if (overdue) late += 1;
    if (warned) warnings += 1;
    const parts: string[] = [];
    if (job.running) parts.push('en cours');
    if (job.lastStartedAt) {
      parts.push(`dernier passage à ${timeFormatter.format(job.lastStartedAt)}${job.lastDurationMs !== null ? ` (${formatDuration(job.lastDurationMs)})` : ''}`);
    } else {
      parts.push('pas encore passée');
    }
    if (job.nextRunAt) parts.push(`prochain à ${timeFormatter.format(job.nextRunAt)}`);
    if (errored && job.lastError) parts.push(`échec : ${job.lastError}`);
    if (warned) parts.push(`en partie en échec : ${job.lastWarning}`);
    facts.push({
      label: meta.label,
      value: parts.join(' · '),
      tone: errored || overdue ? 'bad' : warned ? 'warn' : job.lastStatus === 'ok' ? 'good' : undefined,
    });
    if (errored) problems.push({ key: job.id, text: `${meta.label} : échec (${job.lastError ?? 'erreur inconnue'})` });
    else if (overdue) problems.push({ key: job.id, text: `${meta.label} : pas passée à l’heure prévue` });
  }

  if (failed) return result('degraded', failed > 1 ? `${failed} tâches ont échoué à leur dernier passage.` : 'Une tâche a échoué à son dernier passage.', facts, null, problems);
  if (late) return result('degraded', 'Une tâche n’est pas passée à l’heure prévue.', facts, null, problems);
  // Une partie seulement en échec (ex. le domaine d'un hôte) : visible ici, sans alerte.
  if (warnings) return result('up', 'Les tâches passent à l’heure ; une partie du travail a échoué, voir ci-dessous.', facts);
  return result('up', 'Les tâches passent à l’heure.', facts);
}

async function probeCalendars(ctx: ProbeContext): Promise<ProbeResult> {
  const read = await readDatabase(() => ctx.prisma.calendarSync.findMany({
    where: { listing: { status: { not: 'deleted' } } },
    select: {
      name: true,
      lastStatus: true,
      lastError: true,
      lastSyncedAt: true,
      listing: { select: { core: true } },
    },
  }));
  if (!read.ok) return result('unknown', DATABASE_UNAVAILABLE);
  const syncs = read.value;
  if (!syncs.length) return result('disabled', 'Aucun calendrier Airbnb ou Booking importé pour le moment.');

  const failing = syncs.filter((sync) => sync.lastStatus === 'error');
  const facts: ServiceFact[] = [{ label: 'Calendriers importés', value: numberFormatter.format(syncs.length) }];
  for (const sync of failing.slice(0, 4)) {
    const core = (sync.listing?.core ?? {}) as Record<string, unknown>;
    const title = typeof core.title === 'string' && core.title.trim() ? core.title.trim() : 'Annonce sans titre';
    const error = (sync.lastError ?? 'Erreur inconnue').replace(/\s+/g, ' ').slice(0, 160);
    facts.push({ label: `${sync.name?.trim() || 'Calendrier'} · ${title}`, value: error, tone: 'bad' });
  }
  const lastSynced = syncs.reduce<number>((latest, sync) => Math.max(latest, sync.lastSyncedAt?.getTime() ?? 0), 0);
  if (lastSynced) facts.push({ label: 'Dernière synchronisation', value: formatAgo(lastSynced) });

  if (failing.length) {
    return result('degraded', failing.length > 1 ? `${failing.length} calendriers en erreur.` : 'Un calendrier est en erreur.', facts);
  }
  return result('up', 'Tous les calendriers se synchronisent.', facts);
}

async function probeStripe(ctx: ProbeContext): Promise<ProbeResult> {
  const stripe = getStripe();
  if (!stripe) return result('disabled', 'Aucune clé Stripe sur ce serveur : ni abonnement ni paiement possible.');

  const facts: ServiceFact[] = [
    { label: 'Mode', value: env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'Réel (live)' : 'Test' },
  ];
  const webhooksReady = Boolean(env.STRIPE_WEBHOOK_SECRET && env.STRIPE_CONNECT_WEBHOOK_SECRET);
  facts.push({
    label: 'Nouvelles de Stripe (webhooks)',
    value: webhooksReady ? 'Configurées pour le compte IndieHost et les comptes des hôtes' : 'Secret manquant : Stripe ne peut pas prévenir le serveur',
    tone: webhooksReady ? 'good' : 'bad',
  });

  const lastEvent = await readDatabase(() => ctx.prisma.stripeWebhookEvent.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, type: true } }));
  facts.push({
    label: 'Dernière nouvelle reçue',
    value: !lastEvent.ok
      ? 'Inconnue : la base de données ne répond pas'
      : lastEvent.value ? `${formatAgo(lastEvent.value.createdAt.getTime())} (${lastEvent.value.type})` : 'Aucune pour le moment',
  });

  try {
    const started = performance.now();
    const balance = await stripe.balance.retrieve();
    const latencyMs = Math.round(performance.now() - started);
    const available = balance.available.find((entry) => entry.currency === 'eur') ?? balance.available[0];
    const pending = balance.pending.find((entry) => entry.currency === 'eur') ?? balance.pending[0];
    if (available) facts.push({ label: 'Solde IndieHost disponible', value: formatMoney(available.amount, available.currency) });
    if (pending) facts.push({ label: 'Solde IndieHost en attente', value: formatMoney(pending.amount, pending.currency) });
    if (!webhooksReady) return result('degraded', 'Stripe répond, mais ne peut pas prévenir le serveur des paiements.', facts, latencyMs);
    return result('up', `Répond en ${latencyMs} ms.`, facts, latencyMs);
  } catch (error) {
    const stripeError = error as { type?: string; statusCode?: number };
    if (stripeError?.type === 'StripeAuthenticationError' || stripeError?.statusCode === 401) {
      return result('down', 'Stripe refuse la clé du serveur.', facts);
    }
    return result('down', `Stripe ne répond pas (${describeNetworkError(error)}).`, facts);
  }
}

async function probeClerk(): Promise<ProbeResult> {
  if (!env.CLERK_JWKS_URL && !env.CLERK_SECRET_KEY) return result('disabled', 'Clerk n’est pas configuré sur ce serveur.');

  const facts: ServiceFact[] = [];
  let latencyMs: number | null = null;

  if (env.CLERK_JWKS_URL) {
    try {
      const fetched = await timedFetch(env.CLERK_JWKS_URL, { timeoutMs: 5000, redirect: 'follow' });
      latencyMs = fetched.latencyMs;
      await discardBody(fetched.response);
      if (!fetched.response.ok) {
        return result('down', `Clerk ne fournit plus ses clés (${fetched.response.status}) : plus personne ne peut se connecter au tableau de bord.`, facts, latencyMs);
      }
      facts.push({ label: 'Vérification des connexions', value: 'Fonctionne', tone: 'good' });
    } catch (error) {
      return result('down', `Clerk est injoignable (${describeNetworkError(error)}) : les connexions au tableau de bord échouent.`, facts);
    }
  }

  if (env.CLERK_SECRET_KEY) {
    try {
      const fetched = await timedFetch('https://api.clerk.com/v1/users/count', {
        timeoutMs: 5000,
        headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
      });
      latencyMs ??= fetched.latencyMs;
      const body = (await fetched.response.json().catch(() => null)) as { total_count?: unknown } | null;
      if (!fetched.response.ok) {
        facts.push({ label: 'Gestion des comptes', value: `Refusée par Clerk (${fetched.response.status})`, tone: 'bad' });
        return result('degraded', 'Les connexions marchent, mais le serveur ne peut plus lire ni modifier les comptes.', facts, latencyMs);
      }
      if (typeof body?.total_count === 'number') facts.push({ label: 'Comptes', value: numberFormatter.format(body.total_count) });
    } catch (error) {
      facts.push({ label: 'Gestion des comptes', value: networkErrorSentence(error), tone: 'bad' });
      return result('degraded', 'Les connexions marchent, mais la gestion des comptes ne répond pas.', facts, latencyMs);
    }
  }

  return result('up', latencyMs !== null ? `Répond en ${latencyMs} ms.` : 'Configuré.', facts, latencyMs);
}

type BrevoAccount = { plan?: Array<{ type?: string; credits?: number; creditsType?: string }> };
type BrevoReport = { requests?: number; delivered?: number; hardBounces?: number; softBounces?: number; blocked?: number; invalid?: number; spamReports?: number };

async function probeEmail(ctx: ProbeContext): Promise<ProbeResult> {
  if (!isMailerConfigured()) return result('disabled', 'Aucun service d’envoi configuré : aucun e-mail ne part.');

  const since = new Date(Date.now() - 24 * 60 * MINUTE);
  const hostEmails = await readDatabase(() => ctx.prisma.hostNotification.count({ where: { createdAt: { gte: since } } }));
  const facts: ServiceFact[] = [
    { label: 'Expéditeur', value: env.MAIL_FROM },
    { label: 'E-mails aux hôtes sur 24 h', value: hostEmails.ok ? numberFormatter.format(hostEmails.value) : 'Inconnu : la base de données ne répond pas' },
  ];

  if (!env.BREVO_API_KEY) {
    return result('unknown', 'Envoi par SMTP : l’état du serveur d’envoi n’est pas contrôlé.', facts);
  }

  const headers = { 'api-key': env.BREVO_API_KEY, accept: 'application/json' };
  try {
    const fetched = await timedFetch('https://api.brevo.com/v3/account', { timeoutMs: 6000, headers });
    const account = (await fetched.response.json().catch(() => null)) as BrevoAccount | null;
    if (fetched.response.status === 401) return result('down', 'Brevo refuse la clé du serveur : aucun e-mail ne part.', facts, fetched.latencyMs);
    if (!fetched.response.ok) return result('down', `Brevo répond ${fetched.response.status}.`, facts, fetched.latencyMs);

    const sendLimit = account?.plan?.find((plan) => plan.creditsType === 'sendLimit' && typeof plan.credits === 'number');
    if (sendLimit) facts.push({ label: 'Envois restants (offre gratuite)', value: numberFormatter.format(sendLimit.credits as number), tone: (sendLimit.credits as number) < 30 ? 'warn' : undefined });

    let problems = 0;
    try {
      const report = await timedFetch('https://api.brevo.com/v3/smtp/statistics/aggregatedReport?days=1', { timeoutMs: 6000, headers });
      const stats = (await report.response.json().catch(() => null)) as BrevoReport | null;
      if (report.response.ok && stats) {
        problems = (stats.hardBounces ?? 0) + (stats.blocked ?? 0) + (stats.invalid ?? 0) + (stats.spamReports ?? 0);
        facts.push({ label: 'Envoyés sur 24 h', value: numberFormatter.format(stats.requests ?? 0) });
        facts.push({ label: 'Délivrés sur 24 h', value: numberFormatter.format(stats.delivered ?? 0) });
        if (problems) facts.push({ label: 'Rejetés ou signalés', value: numberFormatter.format(problems), tone: 'bad' });
      }
    } catch {
      // Le rapport est un plus : l'état du compte suffit pour juger du service.
    }

    if (sendLimit && (sendLimit.credits as number) <= 0) return result('down', 'Plus aucun envoi possible aujourd’hui : limite de l’offre Brevo atteinte.', facts, fetched.latencyMs);
    if (problems) return result('degraded', 'Des e-mails ont été rejetés ou signalés comme spam ces dernières 24 h.', facts, fetched.latencyMs);
    return result('up', `Répond en ${fetched.latencyMs} ms.`, facts, fetched.latencyMs);
  } catch (error) {
    return result('down', `Brevo ne répond pas (${describeNetworkError(error)}).`, facts);
  }
}

async function probeImageKit(): Promise<ProbeResult> {
  if (!env.IMAGEKIT_API_KEY) return result('disabled', 'Aucune clé ImageKit : l’envoi de photos est impossible.');
  try {
    const authorization = `Basic ${Buffer.from(`${env.IMAGEKIT_API_KEY}:`).toString('base64')}`;
    const { response, latencyMs } = await timedFetch('https://api.imagekit.io/v1/files?limit=1', { timeoutMs: 6000, headers: { Authorization: authorization } });
    await discardBody(response);
    if (response.status === 401 || response.status === 403) return result('down', 'ImageKit refuse la clé du serveur : les photos ne s’envoient plus.', [], latencyMs);
    if (!response.ok) return result('down', `ImageKit répond ${response.status}.`, [], latencyMs);
    return result('up', `Répond en ${latencyMs} ms.`, [{ label: 'Photos et vidéos', value: 'Envoi et affichage possibles' }], latencyMs);
  } catch (error) {
    return result('down', `ImageKit ne répond pas (${describeNetworkError(error)}).`);
  }
}

async function probeMaps(): Promise<ProbeResult> {
  try {
    const { response, latencyMs } = await timedFetch('https://tiles.openfreemap.org/styles/liberty', { timeoutMs: 6000, redirect: 'follow' });
    await discardBody(response);
    if (!response.ok) return result('down', `Le service de cartes répond ${response.status} : la carte des logements reste vide.`, [], latencyMs);
    return result('up', `Répond en ${latencyMs} ms.`, [], latencyMs);
  } catch (error) {
    return result('down', `Le service de cartes ne répond pas (${describeNetworkError(error)}).`);
  }
}

const SERVICES: ServiceDefinition[] = [
  { id: 'public', group: 'entry', label: 'Accès public', role: 'L’adresse indiehost.fr vue depuis Internet, à travers Cloudflare.', everyMs: 2 * MINUTE, probe: probePublic },
  { id: 'proxy', group: 'entry', label: 'Aiguillage (nginx)', role: 'Reçoit chaque visite et l’envoie vers le site ou le serveur.', everyMs: 30 * SECOND, probe: probeProxy },
  { id: 'certificates', group: 'entry', label: 'Certificats HTTPS', role: 'Le cadenas du navigateur, pour indiehost.fr et les domaines des hôtes.', everyMs: 30 * MINUTE, probe: probeCertificates },
  { id: 'site', group: 'core', label: 'Site', role: 'Les pages : accueil, logements, réservation, tableau de bord.', everyMs: 30 * SECOND, probe: probeSite },
  { id: 'api', group: 'core', label: 'Serveur', role: 'Le cœur d’IndieHost : annonces, réservations, paiements, e-mails.', everyMs: 30 * SECOND, probe: probeApi },
  { id: 'database', group: 'data', label: 'Base de données', role: 'Garde comptes, annonces, réservations, paiements et messages.', everyMs: 30 * SECOND, probe: probeDatabase },
  { id: 'scraping', group: 'data', label: 'Robot d’import', role: 'Lit une annonce Airbnb ou Booking pour la reprendre.', everyMs: 60 * SECOND, probe: probeScraping },
  { id: 'jobs', group: 'data', label: 'Tâches planifiées', role: 'Rappels aux hôtes, purge des données anciennes et référencement des sites d’hôtes, à heure fixe.', everyMs: 60 * SECOND, probe: probeJobs },
  { id: 'calendars', group: 'data', label: 'Calendriers iCal', role: 'Les dates prises sur Airbnb et Booking, bloquées sur IndieHost.', everyMs: 2 * MINUTE, probe: probeCalendars },
  { id: 'stripe', group: 'external', label: 'Stripe', role: 'Paiement des réservations et abonnements des hôtes.', everyMs: 5 * MINUTE, probe: probeStripe },
  { id: 'clerk', group: 'external', label: 'Clerk', role: 'Comptes et connexion au tableau de bord.', everyMs: 5 * MINUTE, probe: probeClerk },
  { id: 'email', group: 'external', label: 'E-mails (Brevo)', role: 'Confirmations, annulations et rappels envoyés automatiquement.', everyMs: 5 * MINUTE, probe: probeEmail },
  { id: 'imagekit', group: 'external', label: 'ImageKit', role: 'Stocke et affiche les photos et vidéos des annonces.', everyMs: 5 * MINUTE, probe: probeImageKit },
  { id: 'maps', group: 'external', label: 'Cartes', role: 'Le fond de carte des pages de logement (OpenFreeMap).', everyMs: 10 * MINUTE, probe: probeMaps },
];

// --- Surveillance ---------------------------------------------------------------------------

const STATUS_WEIGHT: Record<ServiceStatus, number> = { down: 4, degraded: 3, unknown: 2, up: 1, disabled: 0 };
const TRACKED_STATUSES = new Set<ServiceStatus>(['up', 'degraded', 'down']);
// « À surveiller » mérite un e-mail pour ces services : un certificat qui expire bientôt ou qui
// manque, une tâche planifiée en échec. Ailleurs, seule une panne en déclenche un.
const DEGRADED_ALERT_SERVICES = new Set<ServiceId>(['certificates', 'jobs']);
const DAY = 24 * 60 * MINUTE;
const LONG_UPTIME_RETRY_MS = MINUTE;
const CAPPED_LOG_EVERY_MS = 60 * MINUTE;

function worstStatus(statuses: ServiceStatus[]): ServiceStatus {
  return statuses.reduce<ServiceStatus>((worst, status) => (STATUS_WEIGHT[status] > STATUS_WEIGHT[worst] ? status : worst), 'disabled');
}

function bucketStartOf(timestamp: number): number {
  return Math.floor(timestamp / BUCKET_MS) * BUCKET_MS;
}

function availability(tracked: number, down: number): number | null {
  return tracked > 0 ? (tracked - down) / tracked : null;
}

function isServiceId(value: string): value is ServiceId {
  return SERVICES.some((service) => service.id === value);
}

function readStatus(value: string): ServiceStatus {
  return value === 'up' || value === 'degraded' || value === 'down' || value === 'disabled' ? value : 'unknown';
}

type UnsavedIncident = { incident: HealthIncident; occurredAt: Date; alertedAt: Date | null };

export class SystemHealthMonitor {
  private readonly runtimes: ServiceRuntime[];
  private readonly incidents: HealthIncident[] = [];
  private readonly store: HealthStore;
  private readonly planner = new HealthAlertPlanner({
    confirmMs: ALERT_CONFIRM_MS,
    recoveryConfirmMs: ALERT_RECOVERY_MS,
    minGapMs: ALERT_MIN_GAP_MS,
    maxAlertsPerDay: ALERT_MAX_PER_DAY,
    degradedAlerts: DEGRADED_ALERT_SERVICES,
  });
  private readonly alertSettings: HealthAlertSettings = readHealthAlertSettings();
  private pendingAlerts: AlertEvent[] = [];
  private lastDelivery: HealthAlertStatus['lastDelivery'] = null;
  private readonly cappedLoggedAt = new Map<ServiceId, number>();
  /** Changements d'état pas encore écrits en base, et e-mails pas encore notés sur leur changement. */
  private readonly unsavedIncidents = new Map<string, UnsavedIncident>();
  private readonly unsavedAlertMarks = new Map<string, Date>();
  /** Demi-heures des dernières 24 h relues en base : avant, rien n'est réécrit (on écraserait l'historique). */
  private bucketsLoaded = false;
  private lastBucketRestoreAt = 0;
  private timer: NodeJS.Timeout | null = null;
  private initialized: Promise<void> = Promise.resolve();
  private currentTick: Promise<void> | null = null;
  private stopped = false;
  private lastForcedAt = 0;
  private lastPurgeAt = 0;
  private longUptime: { at: number; week: UptimeTotals; month: UptimeTotals } | null = null;
  private longUptimeTriedAt = 0;
  private longUptimeLoading = false;
  private readonly startedAt = Date.now();

  constructor(
    private readonly ctx: ProbeContext,
    private readonly log: FastifyBaseLogger,
  ) {
    this.store = new HealthStore(ctx.prisma, log);
    this.runtimes = SERVICES.map((definition) => ({
      definition,
      last: null,
      buckets: new Map(),
      dirty: new Set(),
      lastTracked: null,
      running: false,
      lastRunAt: 0,
      probeAt: null,
    }));
  }

  start(): void {
    if (this.timer) return;
    this.stopped = false;
    if (!loopDelay) {
      loopDelay = monitorEventLoopDelay({ resolution: 20 });
      loopDelay.enable();
    }
    this.initialized = this.restore();
    void this.tick(false);
    this.timer = setInterval(() => void this.tick(false), TICK_MS);
    this.timer.unref();
  }

  /** Arrêt de l'API : le passage en cours se termine, puis ce qui n'est pas encore en base y est écrit. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.currentTick?.catch(() => {});
    loopDelay?.disable();
    loopDelay = null;
    await this.persist();
  }

  /** Relance toutes les sondes tout de suite ; faux si une relance vient d'avoir lieu. */
  async refreshNow(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastForcedAt < FORCED_REFRESH_MIN_GAP_MS) return false;
    this.lastForcedAt = now;
    await this.tick(true);
    return true;
  }

  /**
   * Au démarrage : les demi-heures des dernières 24 h, le journal, le dernier état connu de chaque
   * service et la mémoire des alertes (pour qu'une panne en cours ne soit pas signalée deux fois, et
   * que son retour le soit). Chaque lecture a un délai maximal : une base injoignable ne bloque pas la
   * surveillance, qui part alors de zéro (et relit les demi-heures dès que la base répond).
   */
  private async restore(): Promise<void> {
    const [incidents, latest, alertStates] = await Promise.all([
      this.store.loadRecentIncidents(MAX_INCIDENTS),
      this.store.loadLatestStatuses(),
      this.alertSettings.enabled ? this.store.loadAlertStates() : Promise.resolve(null),
      this.restoreBuckets(),
    ]);
    const byId = new Map(this.runtimes.map((runtime) => [runtime.definition.id, runtime]));

    for (const incident of incidents ?? []) {
      if (!isServiceId(incident.serviceId)) continue;
      this.incidents.push({
        id: incident.id,
        atISO: incident.occurredAt.toISOString(),
        serviceId: incident.serviceId,
        label: byId.get(incident.serviceId)?.definition.label ?? incident.serviceId,
        from: readStatus(incident.fromStatus),
        to: readStatus(incident.toStatus),
        summary: incident.summary,
        alerted: Boolean(incident.alertedAt),
      });
    }

    for (const [serviceId, toStatus] of latest ?? []) {
      if (!isServiceId(serviceId)) continue;
      const runtime = byId.get(serviceId);
      const status = readStatus(toStatus);
      if (runtime && TRACKED_STATUSES.has(status)) runtime.lastTracked ??= status;
    }

    for (const [serviceId, raw] of alertStates ?? []) {
      if (!isServiceId(serviceId)) continue;
      const state = readServiceAlertState(raw);
      if (state) this.planner.restore(serviceId, state);
    }
  }

  /** Demi-heures des dernières 24 h, ajoutées à ce qui a été mesuré depuis le démarrage. */
  private async restoreBuckets(): Promise<void> {
    this.lastBucketRestoreAt = Date.now();
    const rows = await this.store.loadBuckets(new Date(bucketStartOf(Date.now()) - HISTORY_MS));
    if (!rows) return;
    const byId = new Map(this.runtimes.map((runtime) => [runtime.definition.id, runtime]));
    for (const row of rows) {
      if (!isServiceId(row.serviceId)) continue;
      const runtime = byId.get(row.serviceId);
      if (!runtime) continue;
      const start = row.bucketStart.getTime();
      // Une mesure prise avant la relecture compte déjà dans cette demi-heure : on additionne.
      const current = runtime.buckets.get(start);
      runtime.buckets.set(start, {
        worstStatus: worstStatus([readStatus(row.worstStatus), current?.worstStatus ?? 'disabled']),
        samples: row.samples + (current?.samples ?? 0),
        trackedSamples: row.trackedSamples + (current?.trackedSamples ?? 0),
        downSamples: row.downSamples + (current?.downSamples ?? 0),
        latencySumMs: row.latencySumMs + (current?.latencySumMs ?? 0),
        latencyCount: row.latencyCount + (current?.latencyCount ?? 0),
      });
      if (current) runtime.dirty.add(start);
    }
    this.bucketsLoaded = true;
  }

  /** Un passage à la fois : un passage encore en cours fait sauter le suivant (une relance à la main l'attend). */
  private async tick(force: boolean): Promise<void> {
    if (this.stopped) return;
    if (this.currentTick && !force) return;
    while (this.currentTick) await this.currentTick.catch(() => {});
    if (this.stopped) return;
    const run = this.runTick(force);
    this.currentTick = run;
    try {
      await run;
    } finally {
      if (this.currentTick === run) this.currentTick = null;
    }
  }

  private async runTick(force: boolean): Promise<void> {
    await this.initialized;
    const now = Date.now();
    if (!this.bucketsLoaded && now - this.lastBucketRestoreAt >= BUCKET_RESTORE_RETRY_MS) await this.restoreBuckets();

    // À l'heure prévue (compte pour la disponibilité), ou mesure demandée pour confirmer une panne ou un retour.
    const due: Array<{ runtime: ServiceRuntime; scheduled: boolean }> = [];
    for (const runtime of this.runtimes) {
      if (runtime.running) continue;
      const scheduled = now - runtime.lastRunAt >= runtime.definition.everyMs;
      const requested = runtime.probeAt !== null && now >= runtime.probeAt;
      if (force || scheduled || requested) due.push({ runtime, scheduled });
    }
    await Promise.allSettled(due.map(({ runtime, scheduled }) => this.runProbe(runtime, scheduled)));
    await this.afterProbes();
  }

  private async runProbe(runtime: ServiceRuntime, scheduled: boolean): Promise<void> {
    runtime.running = true;
    // Une mesure de confirmation ou une relance ne décale pas le rythme : les mesures à l'heure
    // prévue restent régulières, et elles seules comptent pour la disponibilité.
    if (scheduled) runtime.lastRunAt = Date.now();
    runtime.probeAt = null;
    let outcome: ProbeResult;
    try {
      outcome = await withTimeout(runtime.definition.probe(this.ctx), PROBE_TIMEOUT_MS);
    } catch (error) {
      this.log.warn({ err: error, service: runtime.definition.id }, '[health] probe failed');
      outcome = result('down', networkErrorSentence(error));
    } finally {
      runtime.running = false;
    }
    this.record(runtime, outcome, scheduled);
  }

  private record(runtime: ServiceRuntime, outcome: ProbeResult, scheduled: boolean): void {
    const now = Date.now();
    const { id, label } = runtime.definition;
    runtime.last = { ...outcome, checkedAt: now };

    // La mesure compte dans sa demi-heure : en mémoire tout de suite, en base en fin de passage.
    const start = bucketStartOf(now);
    const aggregate = runtime.buckets.get(start) ?? {
      worstStatus: outcome.status,
      samples: 0,
      trackedSamples: 0,
      downSamples: 0,
      latencySumMs: 0,
      latencyCount: 0,
    };
    aggregate.worstStatus = worstStatus([aggregate.worstStatus, outcome.status]);
    aggregate.samples += 1;
    if (scheduled && TRACKED_STATUSES.has(outcome.status)) {
      aggregate.trackedSamples += 1;
      if (outcome.status === 'down') aggregate.downSamples += 1;
    }
    if (outcome.latencyMs !== null) {
      aggregate.latencySumMs += Math.round(outcome.latencyMs);
      aggregate.latencyCount += 1;
    }
    runtime.buckets.set(start, aggregate);
    runtime.dirty.add(start);
    const oldest = start - HISTORY_MS;
    for (const key of runtime.buckets.keys()) {
      if (key < oldest) runtime.buckets.delete(key);
    }

    // Changement d'état suivi : journal en mémoire tout de suite, en base en fin de passage. Premier
    // état connu d'un service : seul un service trouvé en panne (ou à surveiller) entre au journal.
    if (TRACKED_STATUSES.has(outcome.status)) {
      const previous = runtime.lastTracked;
      runtime.lastTracked = outcome.status;
      if (previous !== outcome.status && (previous !== null || outcome.status !== 'up')) {
        const incident: HealthIncident = {
          id: randomUUID(),
          atISO: new Date(now).toISOString(),
          serviceId: id,
          label,
          from: previous ?? 'unknown',
          to: outcome.status,
          summary: outcome.summary,
          alerted: false,
        };
        this.incidents.unshift(incident);
        if (this.incidents.length > MAX_INCIDENTS) this.incidents.length = MAX_INCIDENTS;
        const level = outcome.status === 'down' ? 'error' : outcome.status === 'degraded' ? 'warn' : 'info';
        this.log[level]({ service: id, from: previous ?? 'unknown', to: outcome.status, summary: outcome.summary }, '[health] service status changed');
        this.queueIncident(incident, now);
      }
    }

    // Alerte par e-mail : décidée tout de suite, envoyée en fin de passage, avant toute écriture en base.
    if (this.alertSettings.enabled) {
      const decision = this.planner.observe(id, label, outcome.status, outcome.summary, now, outcome.problems ?? []);
      this.pendingAlerts.push(...decision.events);
      if (decision.probeAt !== null) {
        runtime.probeAt = runtime.probeAt === null ? decision.probeAt : Math.min(runtime.probeAt, decision.probeAt);
      }
      if (decision.capped && now - (this.cappedLoggedAt.get(id) ?? 0) >= CAPPED_LOG_EVERY_MS) {
        this.cappedLoggedAt.set(id, now);
        this.log.warn({ service: id, maxPerDay: ALERT_MAX_PER_DAY }, '[health] alert not sent: daily limit reached for this service');
      }
    }
  }

  private queueIncident(incident: HealthIncident, occurredAt: number): void {
    this.unsavedIncidents.set(incident.id, { incident, occurredAt: new Date(occurredAt), alertedAt: null });
    // Base injoignable longtemps : les plus anciens ne seront pas écrits (ils restent affichés jusqu'au redémarrage).
    while (this.unsavedIncidents.size > MAX_UNSAVED_INCIDENTS) {
      const oldest = this.unsavedIncidents.keys().next().value;
      if (oldest === undefined) break;
      this.unsavedIncidents.delete(oldest);
    }
  }

  private markIncidentAlerted(incident: HealthIncident, at: Date): void {
    incident.alerted = true;
    const unsaved = this.unsavedIncidents.get(incident.id);
    if (unsaved) unsaved.alertedAt = at;
    else this.unsavedAlertMarks.set(incident.id, at);
  }

  private async afterProbes(): Promise<void> {
    // L'e-mail d'abord : une base lente ne retarde jamais l'alerte qui la concerne.
    await this.sendPendingAlerts();
    await this.persist();

    const now = Date.now();
    if (now - this.lastPurgeAt >= PURGE_EVERY_MS) {
      this.lastPurgeAt = now;
      void this.store.purge(new Date(now - BUCKET_RETENTION_MS), new Date(now - INCIDENT_RETENTION_MS));
    }
    const stale = !this.longUptime || now - this.longUptime.at >= LONG_UPTIME_REFRESH_MS;
    if (stale && now - this.longUptimeTriedAt >= LONG_UPTIME_RETRY_MS) void this.refreshLongUptime();
  }

  /**
   * Écrit en base ce qui a changé. Au premier échec, le reste attend le passage suivant : la base ne
   * répond pas, inutile d'attendre encore le délai de chaque écriture. L'historique passe en premier,
   * le journal en dernier : une ligne du journal refusée ne bloque jamais le reste.
   */
  private async persist(): Promise<void> {
    if (!(await this.flushBuckets())) return;
    if (!(await this.flushAlertStates())) return;
    await this.flushIncidents();
  }

  private async flushIncidents(): Promise<boolean> {
    if (this.unsavedIncidents.size) {
      const entries = [...this.unsavedIncidents.values()];
      const rows: StoredIncident[] = entries.map(({ incident, occurredAt, alertedAt }) => ({
        id: incident.id,
        serviceId: incident.serviceId,
        fromStatus: incident.from,
        toStatus: incident.to,
        summary: incident.summary,
        occurredAt,
        alertedAt,
      }));
      if (!(await this.store.insertIncidents(rows))) return false;
      for (const entry of entries) this.unsavedIncidents.delete(entry.incident.id);
    }
    if (this.unsavedAlertMarks.size) {
      // Regroupés par heure d'envoi : un même e-mail couvre souvent plusieurs changements.
      const byTime = new Map<number, string[]>();
      for (const [incidentId, at] of this.unsavedAlertMarks) byTime.set(at.getTime(), [...(byTime.get(at.getTime()) ?? []), incidentId]);
      for (const [time, ids] of byTime) {
        if (!(await this.store.markAlerted(ids, new Date(time)))) return false;
        for (const incidentId of ids) this.unsavedAlertMarks.delete(incidentId);
      }
    }
    return true;
  }

  /** Écrit les demi-heures modifiées ; en cas d'échec, elles seront réécrites au passage suivant. */
  private async flushBuckets(): Promise<boolean> {
    // Historique pas encore relu : la demi-heure en base serait écrasée par les seules mesures récentes.
    if (!this.bucketsLoaded) return true;
    const rows: StoredBucket[] = [];
    const taken: Array<[ServiceRuntime, number]> = [];
    for (const runtime of this.runtimes) {
      for (const start of runtime.dirty) {
        const aggregate = runtime.buckets.get(start);
        if (!aggregate) continue;
        rows.push({ serviceId: runtime.definition.id, bucketStart: new Date(start), ...aggregate });
        taken.push([runtime, start]);
      }
      runtime.dirty.clear();
    }
    if (!rows.length) return true;
    const saved = await this.store.saveBuckets(rows);
    if (!saved) {
      for (const [runtime, start] of taken) runtime.dirty.add(start);
    }
    return saved;
  }

  private async flushAlertStates(): Promise<boolean> {
    const entries = this.planner.takeDirty();
    if (!entries.length) return true;
    const saved = await this.store.saveAlertStates(entries);
    if (!saved) this.planner.markDirty(entries.map(([serviceId]) => serviceId));
    return saved;
  }

  private async sendPendingAlerts(): Promise<void> {
    if (!this.pendingAlerts.length) return;
    const events = this.pendingAlerts;
    this.pendingAlerts = [];
    const now = Date.now();

    // Pannes signalées qui continuent, rappelées dans un e-mail de retour (« toujours signalé »).
    const announced = new Set(events.map((event) => event.serviceId));
    const labels = new Map(this.runtimes.map((runtime) => [runtime.definition.id, runtime.definition.label]));
    const stillOpen: OpenAlert[] = this.planner.openAlerts()
      .filter((open) => !announced.has(open.serviceId))
      .map((open) => ({ label: labels.get(open.serviceId) ?? open.serviceId, kind: open.kind, since: open.since }));

    let delivery: { ok: boolean; reason: string | null } = { ok: false, reason: 'send_failed' };
    try {
      delivery = await deliverHealthAlert(events, this.alertSettings, now, stillOpen);
    } catch (error) {
      this.log.error({ err: error }, '[health] alert e-mail failed');
    }
    this.lastDelivery = { ok: delivery.ok, atISO: new Date(now).toISOString(), reason: delivery.reason };
    const services = events.map((event) => `${event.serviceId}:${event.kind}`);
    if (!delivery.ok) {
      this.planner.markUndelivered(events);
      this.log.warn({ services, reason: delivery.reason }, '[health] alert e-mail not delivered, retried later');
      return;
    }
    this.log.info({ services, recipients: this.alertSettings.recipients.length }, '[health] alert e-mail sent');

    // Chaque e-mail est noté sur le changement d'état auquel il se rapporte.
    const sentAt = new Date(now);
    for (const event of events) {
      const atISO = new Date(event.statusSince).toISOString();
      const incident = this.incidents.find((entry) => entry.serviceId === event.serviceId && entry.atISO === atISO);
      if (incident) this.markIncidentAlerted(incident, sentAt);
    }
  }

  private async refreshLongUptime(): Promise<void> {
    if (this.longUptimeLoading) return;
    this.longUptimeLoading = true;
    const now = Date.now();
    this.longUptimeTriedAt = now;
    try {
      const [week, month] = await Promise.all([
        this.store.availabilitySince(new Date(now - 7 * DAY)),
        this.store.availabilitySince(new Date(now - 30 * DAY)),
      ]);
      if (week && month) this.longUptime = { at: now, week, month };
    } finally {
      this.longUptimeLoading = false;
    }
  }

  private buildHistory(runtime: ServiceRuntime, now: number): HealthBucket[] {
    // Demi-heures alignées sur l'horloge : la dernière case est la demi-heure en cours.
    const end = Math.ceil(now / BUCKET_MS) * BUCKET_MS;
    const start = end - HISTORY_MS;
    return Array.from({ length: BUCKET_COUNT }, (_, index) => {
      const key = start + index * BUCKET_MS;
      const aggregate = runtime.buckets.get(key);
      const hasSamples = Boolean(aggregate && aggregate.samples > 0);
      return {
        startISO: new Date(key).toISOString(),
        status: hasSamples && aggregate ? aggregate.worstStatus : 'none',
        samples: aggregate?.samples ?? 0,
        avgLatencyMs: aggregate && aggregate.latencyCount ? Math.round(aggregate.latencySumMs / aggregate.latencyCount) : null,
      };
    });
  }

  snapshot(): SystemHealthSnapshot {
    const now = Date.now();
    const windowStart = Math.ceil(now / BUCKET_MS) * BUCKET_MS - HISTORY_MS;
    const services: ServiceHealth[] = this.runtimes.map((runtime) => {
      let tracked = 0;
      let down = 0;
      for (const [key, aggregate] of runtime.buckets) {
        if (key < windowStart) continue;
        tracked += aggregate.trackedSamples;
        down += aggregate.downSamples;
      }
      const week = this.longUptime?.week.get(runtime.definition.id);
      const month = this.longUptime?.month.get(runtime.definition.id);
      return {
        id: runtime.definition.id,
        group: runtime.definition.group,
        label: runtime.definition.label,
        role: runtime.definition.role,
        status: runtime.last?.status ?? 'unknown',
        latencyMs: runtime.last?.latencyMs ?? null,
        summary: runtime.last?.summary ?? 'Première mesure en cours…',
        facts: runtime.last?.facts ?? [],
        checkedAtISO: runtime.last ? new Date(runtime.last.checkedAt).toISOString() : null,
        everyMs: runtime.definition.everyMs,
        uptime24h: availability(tracked, down),
        uptime7d: week ? availability(week.tracked, week.down) : null,
        uptime30d: month ? availability(month.tracked, month.down) : null,
        historySinceISO: month?.firstBucketAt ? month.firstBucketAt.toISOString() : null,
        history: this.buildHistory(runtime, now),
      };
    });

    const counted = services.map((service) => service.status);
    return {
      generatedAtISO: new Date(now).toISOString(),
      monitoringSinceISO: new Date(this.startedAt).toISOString(),
      environment: env.NODE_ENV,
      historyPersisted: this.store.isAvailable(),
      alerts: {
        ...this.alertSettings,
        rules: {
          confirmSeconds: ALERT_CONFIRM_MS / SECOND,
          recoveryMinutes: ALERT_RECOVERY_MS / MINUTE,
          gapMinutes: ALERT_MIN_GAP_MS / MINUTE,
          maxPerDay: ALERT_MAX_PER_DAY,
        },
        lastDelivery: this.lastDelivery,
      },
      overall: {
        status: worstStatus(counted.filter((status) => status !== 'unknown')),
        up: counted.filter((status) => status === 'up').length,
        degraded: counted.filter((status) => status === 'degraded').length,
        down: counted.filter((status) => status === 'down').length,
        disabled: counted.filter((status) => status === 'disabled').length,
      },
      services,
      incidents: this.incidents.map((incident) => ({ ...incident })),
      jobs: listJobRuns().map((job) => ({
        id: job.id,
        label: JOB_LABELS[job.id].label,
        schedule: JOB_LABELS[job.id].schedule,
        running: job.running,
        lastStartedAtISO: job.lastStartedAt ? new Date(job.lastStartedAt).toISOString() : null,
        lastDurationMs: job.lastDurationMs,
        lastStatus: job.lastStatus,
        lastError: job.lastError,
        lastWarning: job.lastWarning,
        nextRunAtISO: job.nextRunAt ? new Date(job.nextRunAt).toISOString() : null,
        runs: job.runs,
        failures: job.failures,
      })),
    };
  }
}
