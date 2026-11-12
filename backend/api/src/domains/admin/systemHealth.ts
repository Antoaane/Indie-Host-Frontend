// Santé des services d'IndieHost, pour la page « Services » de l'administration.
//
// Une sonde par service (site, serveur, base, robot d'import, Stripe, Clerk, Brevo…) tourne à son
// rythme dans le processus de l'API : toutes les 30 s pour ce qui est sur le serveur, toutes les
// quelques minutes pour les services extérieurs (leur quota d'appels n'est pas entamé). Les résultats
// sont gardés en mémoire 24 h : la page lit l'état courant, l'historique par demi-heure et les
// changements d'état. Un redémarrage de l'API (déploiement) repart d'un historique vide.
//
// Les sondes ne lisent aucune donnée personnelle et ne renvoient jamais de clé : seulement des
// états, des délais et des chiffres agrégés.

import { monitorEventLoopDelay, performance, type IntervalHistogram } from 'node:perf_hooks';
import tls from 'node:tls';

import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import Stripe from 'stripe';

import { env } from '../../config/env.js';
import { listJobRuns, type JobId } from '../../lib/jobRuns.js';
import { isMailerConfigured, resolvePublicBaseUrl } from '../../lib/mailer.js';

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

type Sample = { t: number; s: ServiceStatus; l: number | null };

type ServiceRuntime = {
  definition: ServiceDefinition;
  last: (ProbeResult & { checkedAt: number }) | null;
  samples: Sample[];
  running: boolean;
  lastRunAt: number;
};

export type HealthIncident = {
  atISO: string;
  serviceId: ServiceId;
  label: string;
  from: ServiceStatus;
  to: ServiceStatus;
  summary: string;
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
  history: HealthBucket[];
};

export type SystemHealthSnapshot = {
  generatedAtISO: string;
  monitoringSinceISO: string;
  environment: 'production' | 'development' | 'test';
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
const CERTIFICATE_WARNING_DAYS = 14;
const STRIPE_API_VERSION = '2025-02-24.acacia';
const SECOND = 1000;
const MINUTE = 60 * SECOND;

const JOB_LABELS: Record<JobId, { label: string; schedule: string }> = {
  retention: { label: 'Purge des données anciennes', schedule: 'une fois par jour' },
  'host-reminders': { label: 'Rappels par e-mail aux hôtes', schedule: 'chaque heure, envois de 9 h à 20 h' },
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

function result(status: ServiceStatus, summary: string, facts: ServiceFact[] = [], latencyMs: number | null = null): ProbeResult {
  return { status, summary, facts, latencyMs };
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

  const customDomains = await ctx.prisma.listing.findMany({
    where: { customDomain: { not: null }, customDomainVerifiedAt: { not: null }, status: { not: 'deleted' } },
    select: { customDomain: true },
  });
  const domains = [rootDomain, ...customDomains.map((row) => row.customDomain as string)];
  const now = Date.now();
  const facts: ServiceFact[] = [];
  let rootBad = false;
  let anyWarning = false;

  // Lus en parallèle : un domaine d'hôte injoignable ne doit pas retarder les autres.
  const certificates = await Promise.allSettled(domains.map((domain) => readCertificate(domain)));

  for (const [index, domain] of domains.entries()) {
    const isRoot = domain === rootDomain;
    try {
      const settled = certificates[index];
      if (!settled || settled.status === 'rejected') throw settled?.reason ?? new Error('NO_CERTIFICATE');
      const certificate = settled.value;
      const daysLeft = Math.floor((certificate.validTo.getTime() - now) / (24 * 60 * MINUTE));
      if (!certificateCovers(certificate.altNames, domain)) {
        facts.push({ label: domain, value: 'Le certificat présenté est celui d’un autre domaine.', tone: 'bad' });
        if (isRoot) rootBad = true; else anyWarning = true;
        continue;
      }
      const tone = daysLeft < 0 ? 'bad' : daysLeft < CERTIFICATE_WARNING_DAYS ? 'warn' : 'good';
      const value = daysLeft < 0
        ? `Expiré depuis le ${dateFormatter.format(certificate.validTo)}`
        : `Valide jusqu’au ${dateFormatter.format(certificate.validTo)} (${daysLeft} j)`;
      facts.push({ label: isRoot ? `${domain} et ses sous-domaines` : domain, value, tone });
      if (tone === 'bad' && isRoot) rootBad = true;
      if (tone !== 'good') anyWarning = true;
    } catch {
      facts.push({ label: domain, value: isRoot ? 'Aucun certificat lisible.' : 'Pas encore de certificat (émis sous quelques minutes après la vérification).', tone: isRoot ? 'bad' : 'warn' });
      if (isRoot) rootBad = true; else anyWarning = true;
    }
  }

  if (rootBad) return result('down', `Le certificat de ${rootDomain} pose problème : les navigateurs affichent une alerte.`, facts);
  if (anyWarning) return result('degraded', 'Un certificat expire bientôt ou manque encore.', facts);
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
  let failed = 0;
  let late = 0;

  for (const job of jobs) {
    const meta = JOB_LABELS[job.id];
    if (job.lastStatus === 'error') failed += 1;
    const overdue = !job.running && job.nextRunAt !== null && now > job.nextRunAt + 15 * MINUTE;
    if (overdue) late += 1;
    const parts: string[] = [];
    if (job.running) parts.push('en cours');
    if (job.lastStartedAt) {
      parts.push(`dernier passage à ${timeFormatter.format(job.lastStartedAt)}${job.lastDurationMs !== null ? ` (${formatDuration(job.lastDurationMs)})` : ''}`);
    } else {
      parts.push('pas encore passée');
    }
    if (job.nextRunAt) parts.push(`prochain à ${timeFormatter.format(job.nextRunAt)}`);
    if (job.lastStatus === 'error' && job.lastError) parts.push(`échec : ${job.lastError}`);
    facts.push({
      label: meta.label,
      value: parts.join(' · '),
      tone: job.lastStatus === 'error' || overdue ? 'bad' : job.lastStatus === 'ok' ? 'good' : undefined,
    });
  }

  if (failed) return result('degraded', failed > 1 ? `${failed} tâches ont échoué à leur dernier passage.` : 'Une tâche a échoué à son dernier passage.', facts);
  if (late) return result('degraded', 'Une tâche n’est pas passée à l’heure prévue.', facts);
  return result('up', 'Les tâches passent à l’heure.', facts);
}

async function probeCalendars(ctx: ProbeContext): Promise<ProbeResult> {
  const syncs = await ctx.prisma.calendarSync.findMany({
    where: { listing: { status: { not: 'deleted' } } },
    select: {
      name: true,
      lastStatus: true,
      lastError: true,
      lastSyncedAt: true,
      listing: { select: { core: true } },
    },
  });
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

  const lastEvent = await ctx.prisma.stripeWebhookEvent.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, type: true } });
  facts.push({ label: 'Dernière nouvelle reçue', value: lastEvent ? `${formatAgo(lastEvent.createdAt.getTime())} (${lastEvent.type})` : 'Aucune pour le moment' });

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
  const hostEmails = await ctx.prisma.hostNotification.count({ where: { createdAt: { gte: since } } });
  const facts: ServiceFact[] = [
    { label: 'Expéditeur', value: env.MAIL_FROM },
    { label: 'E-mails aux hôtes sur 24 h', value: numberFormatter.format(hostEmails) },
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
  { id: 'jobs', group: 'data', label: 'Tâches planifiées', role: 'Rappels aux hôtes et purge des données anciennes, à heure fixe.', everyMs: 60 * SECOND, probe: probeJobs },
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

function worstStatus(statuses: ServiceStatus[]): ServiceStatus {
  return statuses.reduce<ServiceStatus>((worst, status) => (STATUS_WEIGHT[status] > STATUS_WEIGHT[worst] ? status : worst), 'disabled');
}

export class SystemHealthMonitor {
  private readonly runtimes: ServiceRuntime[];
  private readonly incidents: HealthIncident[] = [];
  private timer: NodeJS.Timeout | null = null;
  private lastForcedAt = 0;
  private readonly startedAt = Date.now();

  constructor(
    private readonly ctx: ProbeContext,
    private readonly log: FastifyBaseLogger,
  ) {
    this.runtimes = SERVICES.map((definition) => ({ definition, last: null, samples: [], running: false, lastRunAt: 0 }));
  }

  start(): void {
    if (this.timer) return;
    if (!loopDelay) {
      loopDelay = monitorEventLoopDelay({ resolution: 20 });
      loopDelay.enable();
    }
    void this.tick(false);
    this.timer = setInterval(() => void this.tick(false), TICK_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    loopDelay?.disable();
    loopDelay = null;
  }

  /** Relance toutes les sondes tout de suite ; faux si une relance vient d'avoir lieu. */
  async refreshNow(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastForcedAt < FORCED_REFRESH_MIN_GAP_MS) return false;
    this.lastForcedAt = now;
    await this.tick(true);
    return true;
  }

  private async tick(force: boolean): Promise<void> {
    const now = Date.now();
    const due = this.runtimes.filter((runtime) => !runtime.running && (force || now - runtime.lastRunAt >= runtime.definition.everyMs));
    await Promise.allSettled(due.map((runtime) => this.runProbe(runtime)));
  }

  private async runProbe(runtime: ServiceRuntime): Promise<void> {
    runtime.running = true;
    runtime.lastRunAt = Date.now();
    let outcome: ProbeResult;
    try {
      outcome = await withTimeout(runtime.definition.probe(this.ctx), PROBE_TIMEOUT_MS);
    } catch (error) {
      this.log.warn({ err: error, service: runtime.definition.id }, '[health] probe failed');
      outcome = result('down', networkErrorSentence(error));
    } finally {
      runtime.running = false;
    }
    this.record(runtime, outcome);
  }

  private record(runtime: ServiceRuntime, outcome: ProbeResult): void {
    const now = Date.now();
    const previous = runtime.last?.status ?? null;
    runtime.last = { ...outcome, checkedAt: now };
    runtime.samples.push({ t: now, s: outcome.status, l: outcome.latencyMs });
    const cutoff = now - HISTORY_MS;
    while ((runtime.samples[0]?.t ?? Infinity) < cutoff) runtime.samples.shift();

    if (previous && previous !== outcome.status && TRACKED_STATUSES.has(previous) && TRACKED_STATUSES.has(outcome.status)) {
      this.incidents.unshift({
        atISO: new Date(now).toISOString(),
        serviceId: runtime.definition.id,
        label: runtime.definition.label,
        from: previous,
        to: outcome.status,
        summary: outcome.summary,
      });
      if (this.incidents.length > MAX_INCIDENTS) this.incidents.length = MAX_INCIDENTS;
      const level = outcome.status === 'down' ? 'error' : outcome.status === 'degraded' ? 'warn' : 'info';
      this.log[level]({ service: runtime.definition.id, from: previous, to: outcome.status, summary: outcome.summary }, '[health] service status changed');
    }
  }

  private buildHistory(samples: Sample[], now: number): HealthBucket[] {
    // Demi-heures alignées sur l'horloge : la dernière case est la demi-heure en cours.
    const end = Math.ceil(now / BUCKET_MS) * BUCKET_MS;
    const start = end - HISTORY_MS;
    const buckets = Array.from({ length: BUCKET_COUNT }, (_, index) => ({
      start: start + index * BUCKET_MS,
      statuses: [] as ServiceStatus[],
      latencies: [] as number[],
    }));
    for (const sample of samples) {
      const index = Math.floor((sample.t - start) / BUCKET_MS);
      const bucket = buckets[index];
      if (!bucket) continue;
      bucket.statuses.push(sample.s);
      if (sample.l !== null) bucket.latencies.push(sample.l);
    }
    return buckets.map((bucket) => ({
      startISO: new Date(bucket.start).toISOString(),
      status: bucket.statuses.length ? worstStatus(bucket.statuses) : 'none',
      samples: bucket.statuses.length,
      avgLatencyMs: bucket.latencies.length ? Math.round(bucket.latencies.reduce((sum, value) => sum + value, 0) / bucket.latencies.length) : null,
    }));
  }

  snapshot(): SystemHealthSnapshot {
    const now = Date.now();
    const services: ServiceHealth[] = this.runtimes.map((runtime) => {
      const tracked = runtime.samples.filter((sample) => TRACKED_STATUSES.has(sample.s));
      const available = tracked.filter((sample) => sample.s !== 'down').length;
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
        uptime24h: tracked.length ? available / tracked.length : null,
        history: this.buildHistory(runtime.samples, now),
      };
    });

    const counted = services.map((service) => service.status);
    return {
      generatedAtISO: new Date(now).toISOString(),
      monitoringSinceISO: new Date(this.startedAt).toISOString(),
      environment: env.NODE_ENV,
      overall: {
        status: worstStatus(counted.filter((status) => status !== 'unknown')),
        up: counted.filter((status) => status === 'up').length,
        degraded: counted.filter((status) => status === 'degraded').length,
        down: counted.filter((status) => status === 'down').length,
        disabled: counted.filter((status) => status === 'disabled').length,
      },
      services,
      incidents: [...this.incidents],
      jobs: listJobRuns().map((job) => ({
        id: job.id,
        label: JOB_LABELS[job.id].label,
        schedule: JOB_LABELS[job.id].schedule,
        running: job.running,
        lastStartedAtISO: job.lastStartedAt ? new Date(job.lastStartedAt).toISOString() : null,
        lastDurationMs: job.lastDurationMs,
        lastStatus: job.lastStatus,
        lastError: job.lastError,
        nextRunAtISO: job.nextRunAt ? new Date(job.nextRunAt).toISOString() : null,
        runs: job.runs,
        failures: job.failures,
      })),
    };
  }
}
