import { env } from '../../config/env.js';
import { sanitizePlainText, sanitizeRichText } from '../../lib/sanitizeHtml.js';
import type { ScrapeListingInput } from './imports.schemas.js';

// Au-delà, nginx (300 s) et Cloudflare (100 s) coupent de toute façon la requête.
const SCRAPE_TIMEOUT_MS = 170_000;
// Chaque import lance un navigateur Playwright : on en limite le nombre simultané.
const MAX_CONCURRENT_SCRAPES = 3;

// Domaines Airbnb conservés tels quels dans l'URL canonique (mêmes que le normaliseur Python) ;
// les autres domaines Airbnb sont ramenés sur airbnb.fr.
const AIRBNB_CANONICAL_TLDS = new Set(['fr', 'com', 'co.uk', 'es', 'de', 'it']);
const AIRBNB_HOST_PATTERN = /^(?:(?:www|[a-z]{2})\.)?airbnb\.((?:com?\.)?[a-z]{2,3})$/;
const AIRBNB_ROOM_PATH_PATTERN = /^\/rooms\/(\d{1,20})(?:\/|$)/;
const BOOKING_HOST_PATTERN = /^(?:www\.|m\.)?booking\.com$/;
const BOOKING_HOTEL_PATH_PATTERN = /^\/hotel\/[a-z]{2}\/[A-Za-z0-9._-]{1,200}$/;

const UNSUPPORTED_URL_MESSAGE = 'URL non supportée. Utilisez un lien Airbnb (https://www.airbnb.fr/rooms/…) ou Booking (https://www.booking.com/hotel/…).';
const SCRAPE_FAILED_MESSAGE = "Impossible de récupérer l'annonce. Vérifiez le lien ou réessayez dans quelques minutes.";

type ImportError = Error & { statusCode: number };

function createImportError(message: string, statusCode: number): ImportError {
  const error = new Error(message) as ImportError;
  error.statusCode = statusCode;
  return error;
}

// Le serveur ne télécharge jamais l'URL fournie : il en extrait l'identifiant de l'annonce et
// reconstruit lui-même une URL Airbnb ou Booking.
export function toCanonicalListingUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.username || url.password || url.port) return null;
  const hostname = url.hostname.toLowerCase();

  const airbnbHost = hostname.match(AIRBNB_HOST_PATTERN);
  if (airbnbHost) {
    const roomId = url.pathname.match(AIRBNB_ROOM_PATH_PATTERN)?.[1];
    if (!roomId) return null;
    const tld = airbnbHost[1] && AIRBNB_CANONICAL_TLDS.has(airbnbHost[1]) ? airbnbHost[1] : 'fr';
    return `https://www.airbnb.${tld}/rooms/${roomId}`;
  }

  if (BOOKING_HOST_PATTERN.test(hostname)) {
    const path = url.pathname.replace(/\/+$/, '');
    if (!BOOKING_HOTEL_PATH_PATTERN.test(path)) return null;
    return `https://www.booking.com${path}`;
  }

  return null;
}

// Clés dont la valeur est une URL (gardée si http(s), vidée sinon) ; `description` est le seul HTML
// riche de la réponse, toute autre chaîne est du texte brut (titre, équipements, règles, adresse…).
const SCRAPED_URL_KEYS = new Set(['url', 'listing_url', 'src', 'href']);
const SCRAPED_URL_PATTERN = /^https?:\/\//i;
const SCRAPED_MAX_DEPTH = 12;

function sanitizeScrapedValue(value: unknown, key: string, depth: number): unknown {
  if (depth > SCRAPED_MAX_DEPTH) return undefined;
  if (typeof value === 'string') {
    if (SCRAPED_URL_KEYS.has(key)) return SCRAPED_URL_PATTERN.test(value.trim()) ? value.trim() : '';
    if (key === 'description') return sanitizeRichText(value);
    return sanitizePlainText(value, { multiline: true });
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeScrapedValue(item, key, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      out[childKey] = sanitizeScrapedValue(childValue, childKey, depth + 1);
    }
    return out;
  }
  return value;
}

// Le scraper lit du HTML tiers : rien de ce qu'il renvoie n'est considéré sûr avant d'être renvoyé
// au client (qui l'enregistre ensuite dans l'annonce via l'API, nettoyé une seconde fois).
export function sanitizeScrapedListing(payload: Record<string, unknown>): Record<string, unknown> {
  return sanitizeScrapedValue(payload, '', 0) as Record<string, unknown>;
}

export class ImportsService {
  private activeScrapes = 0;

  async scrapeListing(input: ScrapeListingInput): Promise<unknown> {
    const canonicalUrl = toCanonicalListingUrl(input.url);
    if (!canonicalUrl) throw createImportError(UNSUPPORTED_URL_MESSAGE, 400);

    if (this.activeScrapes >= MAX_CONCURRENT_SCRAPES) {
      throw createImportError("Le service d'import est très sollicité. Réessayez dans une minute.", 503);
    }

    this.activeScrapes += 1;
    try {
      let response: Response;
      try {
        response = await fetch(`${env.SCRAPING_SERVICE_URL.replace(/\/+$/, '')}/scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: canonicalUrl,
            currency: input.currency.toUpperCase(),
            check_in: input.check_in,
            check_out: input.check_out,
          }),
          signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
        });
      } catch (error) {
        console.error('[imports] scraping service unreachable', { error });
        throw createImportError(SCRAPE_FAILED_MESSAGE, 502);
      }

      const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (response.ok && payload) return sanitizeScrapedListing(payload);

      // Seuls les messages de validation du scraper (400) sont rédigés pour l'utilisateur ; les
      // autres contiennent l'erreur technique brute et restent dans les logs.
      const detail = typeof payload?.detail === 'string' ? payload.detail : null;
      console.warn('[imports] scraping failed', { status: response.status, detail });
      if (response.status === 400 && detail) throw createImportError(detail, 400);
      throw createImportError(SCRAPE_FAILED_MESSAGE, response.status === 422 ? 422 : 502);
    } finally {
      this.activeScrapes -= 1;
    }
  }
}
