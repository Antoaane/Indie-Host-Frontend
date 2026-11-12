// Sites des hôtes vus par les moteurs de recherche : sur un domaine relié ou un sous-domaine géré, nginx
// envoie ici chaque page (chemin sans extension) avant le site Vue. On répond :
// - par une redirection 301 quand l'adresse n'est pas l'adresse préférée de la page (variante `www`,
//   sous-domaine d'une annonce qui a son domaine, `indiehost.fr/<logement>` d'un logement rattaché à
//   une page principale qui a son adresse) ;
// - par le HTML du site, déjà rempli : titre, description, canonique, aperçus de partage, données
//   structurées et contenu de la page (Vue le remplace au montage) ;
// - par `robots.txt`, `sitemap.xml`, le fichier de validation Google et la clé IndexNow du site ;
// - sinon par « délégué » : nginx sert la page du site Vue comme avant (guide d'arrivée, pages légales…).
//
// Règles de titre et de description : `siteContent.ts` (copie côté site : `frontend/src/domain/listings/seo.ts`).

import type { Prisma, PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import { asObject, isObject, toNumber } from '../../lib/json.js';
import { readStoredSiteFooter, type SiteFooter } from '../listings/hubPage.js';
import {
  buildListingSlugFromCore,
  ListingsService,
  normalizePublicListingSlug,
  sanitizeHostname,
  type ListingHubChildCard,
} from '../listings/listings.service.js';
import {
  injectIntoShell,
  renderHead,
  renderPrerender,
  renderRobots,
  renderSitemap,
  type HeadTags,
  type PrerenderImage,
  type PrerenderPage,
  type PrerenderSection,
  type SitemapEntry,
} from './html.js';
import { indexNowKey } from './indexNow.js';
import { loadShell } from './shell.js';
import {
  defaultSiteFooter,
  formatPlace,
  htmlToParagraphs,
  hubPlace,
  hubSeoDescription,
  hubSeoTitle,
  listingPlace,
  listingSeoDescription,
  listingSeoTitle,
  sharedPlace,
  toPlainLine,
  truncateText,
} from './siteContent.js';

export type PublicSiteResponse =
  | { type: 'delegate' }
  | { type: 'redirect'; location: string }
  | { type: 'body'; status: number; contentType: string; body: string };

const DELEGATE: PublicSiteResponse = { type: 'delegate' };

/** Statuts montrés aux moteurs de recherche ; les autres pages sont servies en `noindex`. */
const INDEXABLE_STATUSES = new Set(['published', 'blocked']);

/** Chemins à un segment de `indiehost.fr` qui sont des écrans du site, jamais des annonces. */
const RESERVED_ROOT_SEGMENTS = new Set([
  'api', 'assets', 'booking', 'create-listing', 'dashboard', 'dev', 'domains', 'donation', 'editor',
  'legal', 'listing', 'management', 'messagerie', 'pricing', 'sign-in', 'sign-up',
]);

const LISTING_SELECT = {
  id: true,
  kind: true,
  status: true,
  core: true,
  medias: true,
  bookings: true,
  parentListingId: true,
  subdomainSlug: true,
  customDomain: true,
  customDomainVerifiedAt: true,
  updatedAt: true,
} satisfies Prisma.ListingSelect;

type ListingRow = Prisma.ListingGetPayload<{ select: typeof LISTING_SELECT }>;

export type SiteListing = {
  id: string;
  kind: 'hub' | 'listing';
  status: string;
  core: Record<string, unknown>;
  medias: Record<string, unknown>;
  bookings: Record<string, unknown>;
  parentListingId: string | null;
  /** Sous-domaine géré, normalisé ; `null` sans sous-domaine. */
  subdomainSlug: string | null;
  /** Domaine relié **et vérifié** ; `null` sinon (un domaine en attente ne sert rien). */
  customDomain: string | null;
  updatedAt: Date;
};

type Location = { host: string; path: string };

/** Accès aux annonces voisines, pour calculer l'adresse préférée d'une annonce. */
export type CanonicalContext = {
  parentOf(listing: SiteListing): Promise<SiteListing | null>;
  subdomainMembers(subdomain: string): Promise<SiteListing[]>;
};

// Accents détachés par normalize('NFD') (U+0300 à U+036F), retirés pour comparer sans accents.
const COMBINING_MARKS = /[\u0300-\u036f]/g;

function readText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function readStatus(core: unknown, column: string | null): string {
  const fromCore = readText(asObject(core).status).toLowerCase();
  if (fromCore) return fromCore;
  return readText(column).toLowerCase() || 'draft';
}

export function toSiteListing(row: ListingRow): SiteListing {
  const subdomain = readText(row.subdomainSlug).toLowerCase();
  const customDomain = readText(row.customDomain).toLowerCase();
  return {
    id: row.id,
    kind: row.kind === 'hub' ? 'hub' : 'listing',
    status: readStatus(row.core, row.status),
    core: asObject(row.core),
    medias: asObject(row.medias),
    bookings: asObject(row.bookings),
    parentListingId: row.parentListingId,
    subdomainSlug: subdomain || null,
    customDomain: customDomain && row.customDomainVerifiedAt ? customDomain : null,
    updatedAt: row.updatedAt,
  };
}

export function isIndexable(listing: SiteListing): boolean {
  return INDEXABLE_STATUSES.has(listing.status);
}

export function listingSlug(listing: SiteListing): string {
  return buildListingSlugFromCore(listing.core, listing.id);
}

function rootDomain(): string {
  return env.PUBLIC_LISTING_ROOT_DOMAIN.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^\*\./, '').replace(/\/+$/, '');
}

function managedHost(subdomain: string): string {
  return `${subdomain}.${rootDomain()}`;
}

/**
 * Adresse préférée d'une annonce, dans cet ordre : son domaine relié ; son sous-domaine (à la racine,
 * ou suivi de son nom quand plusieurs annonces partagent le sous-domaine) ; l'adresse de sa page
 * principale suivie de son nom ; sinon `indiehost.fr/<nom>`. Même règle que la résolution d'un hôte
 * (`ListingsService.resolveListingByHostname`), lue dans l'autre sens.
 */
export async function canonicalLocation(listing: SiteListing, context: CanonicalContext): Promise<Location> {
  if (listing.customDomain) return { host: listing.customDomain, path: '/' };

  const slug = listingSlug(listing);
  if (listing.subdomainSlug) {
    const host = managedHost(listing.subdomainSlug);
    if (listing.kind === 'hub') return { host, path: '/' };
    const members = (await context.subdomainMembers(listing.subdomainSlug)).filter((member) => member.status !== 'deleted');
    if (members.length <= 1) return { host, path: '/' };
    return { host, path: `/${slug}` };
  }

  const parent = await context.parentOf(listing);
  if (parent && parent.status !== 'deleted') {
    const parentHost = parent.customDomain ?? (parent.subdomainSlug ? managedHost(parent.subdomainSlug) : null);
    if (parentHost) return { host: parentHost, path: `/${slug}` };
  }

  return { host: rootDomain(), path: `/${slug}` };
}

/** Photos dans l'ordre d'affichage du site (`position`, sinon ordre du tableau), avec un texte de repli. */
function orderedImages(medias: Record<string, unknown>, title: string): PrerenderImage[] {
  const images = (Array.isArray(medias.images) ? medias.images : []).filter(isObject);
  const hasPosition = images.some((image) => typeof image.position === 'number');
  const sorted = hasPosition
    ? [...images].sort((left, right) => (
      (typeof left.position === 'number' ? left.position : Number.POSITIVE_INFINITY)
      - (typeof right.position === 'number' ? right.position : Number.POSITIVE_INFINITY)
    ))
    : images;
  return sorted
    .map((image, index) => ({ src: readText(image.src), alt: readText(image.alt) || `${title} — photo ${index + 1}` }))
    .filter((image) => /^https:\/\//.test(image.src));
}

function formatEuros(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function guestsLabel(count: number): string {
  return `${count} voyageur${count > 1 ? 's' : ''}`;
}

function priceLabel(value: number): string {
  return `À partir de ${formatEuros(value)} la nuit`;
}

/** Type schema.org d'un logement, d'après son type saisi (« Appartement », « Villa »…). */
function lodgingSchemaType(type: string): string {
  const value = type.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
  if (/appart|studio|loft|duplex|flat/.test(value)) return 'Apartment';
  if (/maison|villa|gite|chalet|house|bungalow|cabane|mas|longere|ferme/.test(value)) return 'House';
  return 'Accommodation';
}

function formatRatingScore(score: number, platform: string): string {
  const decimals = platform === 'airbnb' ? 2 : 1;
  const scale = platform === 'airbnb' ? 5 : 10;
  const minimumFractionDigits = platform === 'booking' && score === scale ? 0 : 1;
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits, maximumFractionDigits: decimals }).format(score);
}

function ratingSummary(section: Record<string, unknown>): string | null {
  const score = typeof section.score === 'number' && Number.isFinite(section.score) ? section.score : null;
  if (score === null) return null;
  const platform = section.platform === 'airbnb' ? 'airbnb' : 'booking';
  const name = platform === 'airbnb' ? 'Airbnb' : 'Booking.com';
  const scale = platform === 'airbnb' ? 5 : 10;
  const parts = [`${name} : ${formatRatingScore(score, platform)} sur ${scale}`];
  const label = readText(section.label);
  if (label) parts.push(label);
  const count = typeof section.reviewCount === 'number' && Number.isFinite(section.reviewCount) ? Math.round(section.reviewCount) : null;
  if (count !== null) parts.push(`${new Intl.NumberFormat('fr-FR').format(count)} commentaire${count > 1 ? 's' : ''}`);
  return `${parts.join(', ')}.`;
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function postalAddress(core: Record<string, unknown>): Record<string, unknown> | null {
  const city = readText(core.city);
  const region = readText(core.region);
  const country = readText(core.country);
  if (!city && !region && !country) return null;
  return {
    '@type': 'PostalAddress',
    ...(city ? { addressLocality: city } : {}),
    ...(region ? { addressRegion: region } : {}),
    ...(country ? { addressCountry: country } : {}),
  };
}

type PageContext = {
  proto: string;
  hostname: string;
  /** Chemin canonique de la page (`/` ou `/<logement>`). */
  path: string;
};

export class PublicSiteService {
  private readonly listings: ListingsService;

  constructor(private readonly prisma: PrismaClient) {
    this.listings = new ListingsService(prisma);
  }

  // --- Chargement --------------------------------------------------------------------------------

  async loadListing(listingId: string): Promise<SiteListing | null> {
    const row = await this.prisma.listing.findUnique({ where: { id: listingId }, select: LISTING_SELECT });
    return row ? toSiteListing(row) : null;
  }

  /** Accès aux annonces voisines par requêtes ciblées (une page servie). */
  private queryContext(): CanonicalContext {
    return {
      parentOf: async (listing) => (listing.parentListingId ? this.loadListing(listing.parentListingId) : null),
      subdomainMembers: async (subdomain) => {
        const rows = await this.prisma.listing.findMany({ where: { subdomainSlug: subdomain }, select: LISTING_SELECT });
        return rows.map(toSiteListing);
      },
    };
  }

  /** Toutes les annonces non supprimées, et un accès en mémoire aux voisines (sitemaps, tâche planifiée). */
  async loadAllListings(): Promise<{ listings: SiteListing[]; context: CanonicalContext }> {
    const rows = await this.prisma.listing.findMany({ where: { status: { not: 'deleted' } }, select: LISTING_SELECT });
    const listings = rows.map(toSiteListing).filter((listing) => listing.status !== 'deleted');
    const byId = new Map(listings.map((listing) => [listing.id, listing]));
    const bySubdomain = new Map<string, SiteListing[]>();
    for (const listing of listings) {
      if (!listing.subdomainSlug) continue;
      bySubdomain.set(listing.subdomainSlug, [...(bySubdomain.get(listing.subdomainSlug) ?? []), listing]);
    }
    return {
      listings,
      context: {
        parentOf: async (listing) => (listing.parentListingId ? byId.get(listing.parentListingId) ?? null : null),
        subdomainMembers: async (subdomain) => bySubdomain.get(subdomain) ?? [],
      },
    };
  }

  private async publicChildren(hubId: string): Promise<ListingHubChildCard[]> {
    const children = await this.listings.listHubChildren({ hubId, auth: null, publicOnly: true });
    return Array.isArray(children) ? children : [];
  }

  private async childrenPlace(hubId: string): Promise<string> {
    const children = await this.publicChildren(hubId);
    return sharedPlace(children.map((child) => formatPlace(child.city, child.region)));
  }

  /** Nom du site et pied de page d'une annonce : ceux de sa page principale quand elle en a une. */
  async resolveSite(listing: SiteListing): Promise<{ siteName: string; footer: SiteFooter; hub: SiteListing | null }> {
    const hub = listing.kind === 'hub'
      ? listing
      : listing.parentListingId ? await this.loadListing(listing.parentListingId) : null;
    const usableHub = hub && hub.status !== 'deleted' ? hub : null;

    if (usableHub) {
      const siteName = readText(usableHub.core.title) || 'Nos logements';
      const stored = readStoredSiteFooter(usableHub.core.page);
      if (stored) return { siteName, footer: stored, hub: usableHub };
      const place = hubPlace(usableHub.core, await this.childrenPlace(usableHub.id)) || listingPlace(listing.core);
      return { siteName, footer: defaultSiteFooter(siteName, place), hub: usableHub };
    }

    const siteName = readText(listing.core.title) || 'Location de vacances';
    return { siteName, footer: defaultSiteFooter(siteName, listingPlace(listing.core)), hub: null };
  }

  // --- Requête ---------------------------------------------------------------------------------

  async handle(input: { host: string; uri: string; proto: string }): Promise<PublicSiteResponse> {
    const hostname = sanitizeHostname(input.host);
    if (!hostname) return DELEGATE;

    let pathname: string;
    let search: string;
    try {
      const url = new URL(input.uri || '/', 'http://placeholder');
      pathname = decodeURIComponent(url.pathname);
      search = url.search;
    } catch {
      return DELEGATE;
    }

    const proto = input.proto === 'http' ? 'http' : 'https';
    const root = rootDomain();
    if (hostname === root || hostname === `www.${root}`) {
      return this.handleMainHost({ hostname, pathname, search, proto });
    }
    return this.handleListingHost({ hostname, pathname, search, proto });
  }

  private redirect(proto: string, location: Location, search: string): PublicSiteResponse {
    return { type: 'redirect', location: `${proto}://${location.host}${location.path}${search}` };
  }

  /** `indiehost.fr/<logement>` : redirigé vers l'adresse du logement quand il en a une autre. */
  private async handleMainHost(args: { hostname: string; pathname: string; search: string; proto: string }): Promise<PublicSiteResponse> {
    const match = args.pathname.match(/^\/([a-z0-9-]+)\/?$/);
    const segment = match?.[1];
    if (!segment || RESERVED_ROOT_SEGMENTS.has(segment)) return DELEGATE;

    const resolved = await this.listings.resolveListingBySlug(segment, null);
    if (!resolved) return DELEGATE;
    const listing = await this.loadListing(resolved.listingId);
    if (!listing) return DELEGATE;

    const canonical = await canonicalLocation(listing, this.queryContext());
    if (canonical.host !== args.hostname || canonical.path !== args.pathname) {
      return this.redirect(args.proto, canonical, args.search);
    }
    return this.renderPage(listing, { proto: args.proto, hostname: args.hostname, path: canonical.path });
  }

  private async handleListingHost(args: { hostname: string; pathname: string; search: string; proto: string }): Promise<PublicSiteResponse> {
    const rootResolution = await this.listings.resolveListingByHostname({ hostname: args.hostname, auth: null });
    if (!rootResolution) return DELEGATE;
    const root = await this.loadListing(rootResolution.listingId);
    if (!root) return DELEGATE;

    // Variante `www`, ou sous-domaine d'une annonce qui a son propre domaine : tout le site redirige.
    const rootCanonical = await canonicalLocation(root, this.queryContext());
    if (rootCanonical.path === '/' && rootCanonical.host !== args.hostname) {
      return this.redirect(args.proto, { host: rootCanonical.host, path: args.pathname }, args.search);
    }

    const origin = `${args.proto}://${args.hostname}`;
    if (args.pathname === '/robots.txt') {
      const { siteName } = await this.resolveSite(root);
      return { type: 'body', status: 200, contentType: 'text/plain; charset=utf-8', body: renderRobots(origin, siteName) };
    }
    if (args.pathname === '/sitemap.xml') {
      const entries = await this.sitemapEntriesForHost(args.hostname, args.proto);
      return { type: 'body', status: 200, contentType: 'application/xml; charset=utf-8', body: renderSitemap(entries) };
    }
    if (/^\/google[0-9a-f]{8,64}\.html$/.test(args.pathname)) {
      return this.googleVerificationFile(args.hostname, args.pathname.slice(1));
    }
    if (args.pathname === `/${indexNowKey()}.txt`) {
      return { type: 'body', status: 200, contentType: 'text/plain; charset=utf-8', body: indexNowKey() };
    }

    const match = args.pathname.match(/^\/([^/]*)\/?$/);
    if (!match) return DELEGATE;
    const segment = match[1] ?? '';

    if (!segment) {
      if (rootCanonical.path !== '/') return this.redirect(args.proto, rootCanonical, args.search);
      return this.renderPage(root, { proto: args.proto, hostname: args.hostname, path: '/' });
    }
    if (segment.includes('.')) return DELEGATE;

    const slug = normalizePublicListingSlug(segment);
    const resolved = slug
      ? await this.listings.resolveListingByHostname({ hostname: args.hostname, listingSlug: slug, auth: null })
      : null;
    if (!resolved) return this.renderNotFound(root, { proto: args.proto, hostname: args.hostname, path: args.pathname });

    const listing = resolved.listingId === root.id ? root : await this.loadListing(resolved.listingId);
    if (!listing) return this.renderNotFound(root, { proto: args.proto, hostname: args.hostname, path: args.pathname });

    const canonical = listing.id === root.id ? rootCanonical : await canonicalLocation(listing, this.queryContext());
    if (canonical.host !== args.hostname || canonical.path !== args.pathname) {
      return this.redirect(args.proto, canonical, args.search);
    }
    return this.renderPage(listing, { proto: args.proto, hostname: args.hostname, path: canonical.path });
  }

  private async googleVerificationFile(hostname: string, fileName: string): Promise<PublicSiteResponse> {
    const site = await this.prisma.publicSite.findUnique({ where: { hostname }, select: { googleToken: true } });
    if (site?.googleToken !== fileName) {
      return { type: 'body', status: 404, contentType: 'text/plain; charset=utf-8', body: 'Not found\n' };
    }
    return { type: 'body', status: 200, contentType: 'text/html; charset=utf-8', body: `google-site-verification: ${fileName}` };
  }

  // --- Pages -------------------------------------------------------------------------------------

  private async html(head: HeadTags, page: PrerenderPage, status: number): Promise<PublicSiteResponse> {
    let shell: string;
    try {
      shell = await loadShell();
    } catch {
      // Sans shell, impossible de servir le site : nginx sert la page du site Vue comme avant.
      return DELEGATE;
    }
    return {
      type: 'body',
      status,
      contentType: 'text/html; charset=utf-8',
      body: injectIntoShell(shell, renderHead(head), renderPrerender(page)),
    };
  }

  async renderPage(listing: SiteListing, context: PageContext): Promise<PublicSiteResponse> {
    if (listing.kind === 'hub') return this.renderHub(listing, context);
    return this.renderLodging(listing, context);
  }

  private async renderHub(hub: SiteListing, context: PageContext): Promise<PublicSiteResponse> {
    const origin = `${context.proto}://${context.hostname}`;
    const canonical = `${origin}${context.path}`;
    const children = await this.publicChildren(hub.id);
    const childrenPlace = sharedPlace(children.map((child) => formatPlace(child.city, child.region)));
    const siteName = readText(hub.core.title) || 'Nos logements';
    const place = hubPlace(hub.core, childrenPlace);
    const page = asObject(hub.core.page);
    const footer = readStoredSiteFooter(page) ?? defaultSiteFooter(siteName, place);
    const images = orderedImages(hub.medias, siteName);
    const description = hubSeoDescription(hub.core, childrenPlace);

    const cards = children.map((child) => {
      const facts = [
        child.guestCapacity ? guestsLabel(child.guestCapacity) : '',
        child.pricePerNight ? priceLabel(child.pricePerNight) : '',
      ].filter(Boolean);
      return {
        title: child.title,
        href: child.publicPath,
        place: formatPlace(child.city, child.region),
        facts,
        image: child.coverSrc ? { src: child.coverSrc, alt: child.title } : null,
      };
    });
    const listingsTitle = children.length === 1 ? 'Notre logement' : 'Nos logements';

    const sections: PrerenderSection[] = [];
    if (Array.isArray(page.sections)) {
      for (const raw of page.sections.filter(isObject)) {
        const title = readText(raw.title);
        if (raw.type === 'listings') {
          sections.push({ type: 'listings', title: title || listingsTitle, cards });
        } else if (raw.type === 'text' || raw.type === 'text-image') {
          const text = typeof raw.text === 'string' ? raw.text : '';
          const imageSrc = raw.type === 'text-image' ? readText(raw.imageSrc) : '';
          if (!title && !text.trim() && !imageSrc) continue;
          sections.push({ type: 'text', title, paragraphs: splitParagraphs(text), image: imageSrc ? { src: imageSrc, alt: title || siteName } : null });
        } else if (raw.type === 'gallery') {
          const gallery = (Array.isArray(raw.images) ? raw.images : []).map(readText).filter(Boolean);
          if (gallery.length) sections.push({ type: 'gallery', title, images: gallery.map((src, index) => ({ src, alt: `${title || siteName} — photo ${index + 1}` })) });
        } else if (raw.type === 'rating') {
          const summary = ratingSummary(raw);
          if (summary) sections.push({ type: 'rating', title, summary });
        }
      }
      if (!sections.some((section) => section.type === 'listings')) sections.push({ type: 'listings', title: listingsTitle, cards });
    } else {
      // Page jamais modifiée : la présentation de l'annonce (description et deuxième photo), puis les logements.
      const presentation = htmlToParagraphs(hub.core.description);
      const second = images[1] ?? null;
      if (presentation.length || second) sections.push({ type: 'text', title: '', paragraphs: presentation, image: second });
      sections.push({ type: 'listings', title: listingsTitle, cards });
    }

    const address = children.length ? postalAddress({ city: children[0]?.city, region: children[0]?.region }) : null;
    const jsonLd: unknown[] = [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: `${origin}/` },
      {
        '@context': 'https://schema.org',
        '@type': 'LodgingBusiness',
        name: siteName,
        description,
        url: canonical,
        ...(images.length ? { image: images.slice(0, 6).map((entry) => entry.src) } : {}),
        ...(address && childrenPlace ? { address } : {}),
        ...(children.length ? {
          containsPlace: children.map((child) => ({ '@type': 'Accommodation', name: child.title, url: `${origin}${child.publicPath}` })),
        } : {}),
      },
    ];

    return this.html({
      title: hubSeoTitle(hub.core, childrenPlace),
      description,
      canonical,
      noindex: !isIndexable(hub),
      siteName,
      image: images[0]?.src ?? null,
      imageAlt: images[0]?.alt ?? siteName,
      jsonLd,
    }, {
      eyebrow: place,
      title: siteName,
      lead: readText(page.tagline),
      facts: [],
      images: images.slice(0, 1),
      sections,
      backLink: null,
      footer,
    }, 200);
  }

  private async renderLodging(listing: SiteListing, context: PageContext): Promise<PublicSiteResponse> {
    const origin = `${context.proto}://${context.hostname}`;
    const canonical = `${origin}${context.path}`;
    const core = listing.core;
    const title = readText(core.title) || 'Location de vacances';
    const place = listingPlace(core);
    const site = await this.resolveSite(listing);
    const images = orderedImages(listing.medias, title);
    const description = listingSeoDescription(core);

    const capacity = toNumber(core.guest_capacity, 0);
    const rooms = (Array.isArray(core.rooms) ? core.rooms : []).filter(isObject);
    const bedrooms = rooms.filter((room) => room.type === 'bedroom').length;
    const price = toNumber(listing.bookings.price, 0);
    const type = readText(core.type);
    const facts = [
      type,
      capacity > 0 ? guestsLabel(capacity) : '',
      bedrooms > 0 ? `${bedrooms} chambre${bedrooms > 1 ? 's' : ''}` : '',
      price > 0 ? priceLabel(price) : '',
    ].filter(Boolean);

    // Retour vers la page principale quand elle répond à la racine de ce même site.
    const hubServesRoot = Boolean(site.hub && site.hub.id !== listing.id && context.path !== '/');
    const paragraphs = htmlToParagraphs(core.description);
    const address = postalAddress(core);

    const lodging: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': lodgingSchemaType(type),
      name: title,
      description: truncateText(toPlainLine(core.description) || description, 500),
      url: canonical,
      ...(images.length ? { image: images.slice(0, 8).map((entry) => entry.src) } : {}),
      ...(address ? { address } : {}),
      ...(capacity > 0 ? { occupancy: { '@type': 'QuantitativeValue', maxValue: capacity } } : {}),
      ...(rooms.length ? { numberOfRooms: rooms.length } : {}),
      ...(bedrooms > 0 ? { numberOfBedrooms: bedrooms } : {}),
      ...(hubServesRoot && site.hub ? {
        containedInPlace: { '@type': 'LodgingBusiness', name: site.siteName, url: `${origin}/` },
      } : {}),
    };
    const jsonLd: unknown[] = context.path === '/'
      ? [{ '@context': 'https://schema.org', '@type': 'WebSite', name: site.siteName, url: `${origin}/` }, lodging]
      : [lodging];

    return this.html({
      title: listingSeoTitle(core),
      description,
      canonical,
      noindex: !isIndexable(listing),
      siteName: site.siteName,
      image: images[0]?.src ?? null,
      imageAlt: images[0]?.alt ?? title,
      jsonLd,
    }, {
      eyebrow: place,
      title,
      lead: '',
      facts,
      images: images.slice(0, 8),
      sections: paragraphs.length ? [{ type: 'text', title: 'À propos du logement', paragraphs, image: null }] : [],
      backLink: hubServesRoot ? { href: '/', label: `Retour à ${site.siteName}` } : null,
      footer: site.footer,
    }, 200);
  }

  /** Nom de logement inconnu sur ce site : vraie réponse 404, jamais indexée. */
  private async renderNotFound(root: SiteListing, context: PageContext): Promise<PublicSiteResponse> {
    const site = await this.resolveSite(root);
    return this.html({
      title: `Page introuvable · ${site.siteName}`,
      description: '',
      canonical: '',
      noindex: true,
      siteName: site.siteName,
      image: null,
      imageAlt: '',
      jsonLd: [],
    }, {
      eyebrow: '',
      title: 'Page introuvable',
      lead: `Cette page n’existe pas ou plus sur le site de ${site.siteName}.`,
      facts: [],
      images: [],
      sections: [],
      backLink: { href: '/', label: `Retour à ${site.siteName}` },
      footer: site.footer,
    }, 404);
  }

  // --- Sitemaps ------------------------------------------------------------------------------------

  /**
   * Pages indexables de tous les sites, regroupées par adresse préférée : un sitemap par site
   * (`/sitemap.xml` de chaque domaine) et le sitemap des annonces d'indiehost.fr.
   */
  async collectSites(proto = 'https'): Promise<Map<string, { rootListingId: string | null; entries: SitemapEntry[]; lastmod: Date }>> {
    const { listings, context } = await this.loadAllListings();
    const sites = new Map<string, { rootListingId: string | null; entries: SitemapEntry[]; lastmod: Date }>();
    const childrenOf = new Map<string, SiteListing[]>();
    for (const listing of listings) {
      if (!listing.parentListingId || !isIndexable(listing)) continue;
      childrenOf.set(listing.parentListingId, [...(childrenOf.get(listing.parentListingId) ?? []), listing]);
    }

    for (const listing of listings) {
      if (!isIndexable(listing)) continue;
      const location = await canonicalLocation(listing, context);
      const title = readText(listing.core.title) || 'Location de vacances';
      // La page principale montre ses logements (photos, prix) : elle change quand eux changent.
      const related = listing.kind === 'hub' ? childrenOf.get(listing.id) ?? [] : [];
      const lastmod = new Date(Math.max(listing.updatedAt.getTime(), ...related.map((child) => child.updatedAt.getTime())));
      const site = sites.get(location.host) ?? { rootListingId: null, entries: [], lastmod };
      if (location.path === '/') site.rootListingId = listing.id;
      site.entries.push({
        loc: `${proto}://${location.host}${location.path}`,
        lastmod,
        images: orderedImages(listing.medias, title).map((entry) => entry.src),
      });
      if (lastmod > site.lastmod) site.lastmod = lastmod;
      sites.set(location.host, site);
    }

    for (const site of sites.values()) {
      site.entries.sort((left, right) => left.loc.localeCompare(right.loc));
    }
    return sites;
  }

  async sitemapEntriesForHost(hostname: string, proto = 'https'): Promise<SitemapEntry[]> {
    const sites = await this.collectSites(proto);
    return sites.get(hostname)?.entries ?? [];
  }
}
