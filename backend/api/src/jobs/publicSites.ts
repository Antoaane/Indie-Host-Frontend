// Référencement automatique des sites d'hôtes (domaines reliés et sous-domaines gérés), chaque heure :
// 1. pré-remplit les pages principales qui ont un logement en ligne (`publicSite/prefill.ts`) ;
// 2. remet à jour la liste des certificats (variante `www` d'un domaine dès qu'elle pointe vers le serveur) ;
// 3. inscrit chaque site dans la Google Search Console d'IndieHost : validation par fichier, ajout du
//    site, comptes d'IndieHost en propriétaires, envoi du sitemap (de nouveau quand une page change,
//    au plus une fois par jour) ;
// 4. signale à IndexNow (Bing) les pages d'un site qui ont changé.
// L'état de chaque site est gardé dans la table `PublicSite`. Rien n'est demandé à l'hôte.
//
// À la main : `npm run public-sites -- --dry-run` (ce qui serait fait, sans rien écrire ni envoyer).

import type { PrismaClient } from '@prisma/client';

import { env } from '../config/env.js';
import { registerScheduledJob, trackJobRun, type JobRunVerdict } from '../lib/jobRuns.js';
import { ListingsService } from '../domains/listings/listings.service.js';
import { isIndexNowEnabled, submitIndexNow } from '../domains/publicSite/indexNow.js';
import { prefillHubPages } from '../domains/publicSite/prefill.js';
import { PublicSiteService } from '../domains/publicSite/publicSite.service.js';
import {
  addOwners,
  addSiteToSearchConsole,
  isSearchConsoleEnabled,
  requestVerificationFile,
  searchConsoleOwnerEmails,
  submitSitemap,
  verifySite,
} from '../domains/publicSite/searchConsole.js';

export type PublicSitesLogger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

const DEFAULT_INITIAL_DELAY_MS = 90_000;
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const SITEMAP_RESUBMIT_MIN_MS = 24 * 60 * 60 * 1000;

export type PublicSitesReport = {
  prefilled: Array<{ listingId: string; title: string }>;
  sites: Array<{ hostname: string; urls: number; actions: string[]; error?: string }>;
  searchConsole: boolean;
  indexNow: boolean;
};

function rootDomain(): string {
  return env.PUBLIC_LISTING_ROOT_DOMAIN.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^\*\./, '').replace(/\/+$/, '');
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

export async function runPublicSites(
  prisma: PrismaClient,
  logger: PublicSitesLogger,
  options: { dryRun?: boolean } = {},
): Promise<PublicSitesReport> {
  const dryRun = Boolean(options.dryRun);
  const searchConsole = isSearchConsoleEnabled();
  const indexNow = isIndexNowEnabled();
  const report: PublicSitesReport = { prefilled: [], sites: [], searchConsole, indexNow };

  report.prefilled = (await prefillHubPages(prisma, { dryRun })).prefilled;
  if (!dryRun) await new ListingsService(prisma).syncCustomDomainsFile();

  const sites = await new PublicSiteService(prisma).collectSites('https');
  const root = rootDomain();
  const owners = searchConsoleOwnerEmails();

  for (const [hostname, site] of sites) {
    // indiehost.fr appartient à IndieHost : sa Search Console se gère à la main.
    if (hostname === root || hostname === `www.${root}`) continue;

    const entry: PublicSitesReport['sites'][number] = { hostname, urls: site.entries.length, actions: [] };
    report.sites.push(entry);
    const siteUrl = `https://${hostname}/`;

    let state = await prisma.publicSite.findUnique({ where: { hostname } });
    if (!state) {
      entry.actions.push('nouveau site');
      if (dryRun) continue;
      state = await prisma.publicSite.create({
        data: { hostname, rootListingId: site.rootListingId, contentUpdatedAt: site.lastmod },
      });
    } else if (!dryRun && (state.rootListingId !== site.rootListingId || state.contentUpdatedAt?.getTime() !== site.lastmod.getTime())) {
      state = await prisma.publicSite.update({
        where: { hostname },
        data: { rootListingId: site.rootListingId, contentUpdatedAt: site.lastmod },
      });
    }

    try {
      if (searchConsole) {
        if (!state.googleVerifiedAt) {
          entry.actions.push('validation Google');
          if (!dryRun) {
            const token = state.googleToken ?? await requestVerificationFile(siteUrl);
            if (token !== state.googleToken) {
              state = await prisma.publicSite.update({ where: { hostname }, data: { googleToken: token } });
            }
            // Le fichier est servi dès que le jeton est en base : Google peut le lire tout de suite.
            const resource = await verifySite(siteUrl);
            state = await prisma.publicSite.update({ where: { hostname }, data: { googleVerifiedAt: new Date() } });
            if (owners.length) {
              await addOwners(resource, siteUrl, owners);
              state = await prisma.publicSite.update({ where: { hostname }, data: { googleOwnersSyncedAt: new Date() } });
            }
          }
        }
        if (state.googleVerifiedAt && !state.googleOwnersSyncedAt && owners.length) {
          entry.actions.push('propriétaires');
          if (!dryRun) {
            await addOwners({}, siteUrl, owners);
            state = await prisma.publicSite.update({ where: { hostname }, data: { googleOwnersSyncedAt: new Date() } });
          }
        }
        if (state.googleVerifiedAt && !state.googleAddedAt) {
          entry.actions.push('ajout à la Search Console');
          if (!dryRun) {
            await addSiteToSearchConsole(siteUrl);
            state = await prisma.publicSite.update({ where: { hostname }, data: { googleAddedAt: new Date() } });
          }
        }
        const submittedAt = state.sitemapSubmittedAt?.getTime() ?? 0;
        const changedSinceSubmit = site.lastmod.getTime() > submittedAt;
        if (state.googleAddedAt && (!submittedAt || (changedSinceSubmit && Date.now() - submittedAt >= SITEMAP_RESUBMIT_MIN_MS))) {
          entry.actions.push('envoi du sitemap');
          if (!dryRun) {
            await submitSitemap(siteUrl, `${siteUrl}sitemap.xml`);
            state = await prisma.publicSite.update({ where: { hostname }, data: { sitemapSubmittedAt: new Date() } });
          }
        }
      }

      if (indexNow && site.entries.length) {
        const pingedAt = state.indexNowPingedAt?.getTime() ?? 0;
        const changed = site.entries.filter((url) => url.lastmod.getTime() > pingedAt);
        if (changed.length) {
          entry.actions.push(`IndexNow (${changed.length})`);
          if (!dryRun) {
            await submitIndexNow(hostname, changed.map((url) => url.loc));
            state = await prisma.publicSite.update({ where: { hostname }, data: { indexNowPingedAt: new Date() } });
          }
        }
      }

      if (!dryRun) {
        await prisma.publicSite.update({ where: { hostname }, data: { lastError: null, lastCheckedAt: new Date() } });
      }
    } catch (error) {
      entry.error = errorMessage(error);
      logger.warn({ hostname, err: entry.error }, '[public-sites] site step failed');
      if (!dryRun) {
        await prisma.publicSite.update({ where: { hostname }, data: { lastError: entry.error, lastCheckedAt: new Date() } });
      }
    }
  }

  return report;
}

/**
 * Bilan d'un passage pour la page Services. Chaque site attrape ses propres erreurs : sans ce bilan,
 * un passage où tous les appels à Google échouent paraîtrait réussi. Tous les sites traités en échec
 * (clé Google refusée, API coupée, quota) : échec de la tâche, signalé. Une partie seulement (souvent
 * le domaine d'un seul hôte) : avertissement affiché, sans alerte.
 */
export function assessPublicSitesReport(report: PublicSitesReport): JobRunVerdict {
  const failed = report.sites.filter((site) => site.error);
  if (!failed.length) return null;
  const attempted = report.sites.filter((site) => site.error || site.actions.length).length;
  const first = failed[0]!;
  const example = `${first.hostname} : ${first.error}`;
  if (failed.length >= attempted) {
    return {
      error: attempted > 1 ? `Aucun des ${attempted} sites à traiter n’a abouti (${example}).` : `Le site à traiter n’a pas abouti (${example}).`,
    };
  }
  return { warning: `${failed.length} site${failed.length > 1 ? 's' : ''} sur ${attempted} en échec (${example}).` };
}

export function startPublicSitesScheduler(
  prisma: PrismaClient,
  logger: PublicSitesLogger,
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
      const report = await trackJobRun('public-sites', () => runPublicSites(prisma, logger), assessPublicSitesReport);
      const acted = report.sites.filter((site) => site.actions.length || site.error);
      if (report.prefilled.length || acted.length) {
        logger.info({ prefilled: report.prefilled, sites: acted }, '[public-sites] pass done');
      }
    } catch (error) {
      logger.error({ err: error }, '[public-sites] pass failed');
    } finally {
      running = false;
    }
  };

  registerScheduledJob('public-sites', { intervalMs, firstRunAt: Date.now() + initialDelayMs });

  const initial = setTimeout(() => {
    void run();
    interval = setInterval(() => void run(), intervalMs);
    interval.unref();
  }, initialDelayMs);
  initial.unref();

  logger.info({
    initialDelayMs,
    intervalMs,
    searchConsole: isSearchConsoleEnabled(),
    indexNow: isIndexNowEnabled(),
  }, 'Public sites maintenance scheduled');

  return () => {
    clearTimeout(initial);
    if (interval) clearInterval(interval);
  };
}
