// Textes des sites d'hôtes pour les moteurs de recherche : titre et description de chaque page, pied
// de page par défaut, et textes proposés d'office sur une page principale (accroche, présentation).
//
// Le site applique les mêmes règles de titre et de description après son chargement
// (`frontend/src/domain/listings/seo.ts`) : toute évolution se fait des deux côtés, sinon le titre
// change entre le HTML servi et la page affichée.

import { asObject } from '../../lib/json.js';
import type { SiteFooter } from '../listings/hubPage.js';

export const SEO_DESCRIPTION_MAX = 160;

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': '’',
  '&apos;': '’',
};

/** Texte d'une description écrite dans l'éditeur riche : paragraphes gardés, mise en forme retirée. */
// Accents détachés par normalize('NFD') (U+0300 à U+036F), retirés pour comparer sans accents.
const COMBINING_MARKS = /[\u0300-\u036f]/g;

export function htmlToParagraphs(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  const text = value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39|apos);/g, (entity) => ENTITIES[entity] ?? entity);
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim())
    .filter(Boolean);
}

/** Texte sur une seule ligne (espaces et retours à la ligne fondus). */
export function toPlainLine(value: unknown): string {
  return htmlToParagraphs(value).join(' ').replace(/\s+/g, ' ').trim();
}

/** Coupe au dernier mot entier avant `max` caractères, avec des points de suspension. */
export function truncateText(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, Math.max(0, max - 1));
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.–—&-]+$/, '')}…`;
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function comparable(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/** « Saint-François, Guadeloupe » ; la région est omise quand elle répète la ville. */
export function formatPlace(city: unknown, region: unknown): string {
  const cityText = readText(city);
  const regionText = readText(region);
  if (!cityText) return regionText;
  if (!regionText || comparable(regionText) === comparable(cityText)) return cityText;
  return `${cityText}, ${regionText}`;
}

/** Lieu d'une annonce, d'après sa ville et sa région. */
export function listingPlace(core: unknown): string {
  const record = asObject(core);
  return formatPlace(record.city, record.region);
}

/** Lieu commun à des logements : le même pour tous, sinon aucun. */
export function sharedPlace(places: string[]): string {
  const distinct = new Set(places.map((place) => place.trim()).filter(Boolean));
  return distinct.size === 1 ? [...distinct][0] ?? '' : '';
}

/** Pour comparer : sans accents, sans ponctuation (« Saint-François » vaut « Saint François »). */
function looseWords(value: string): string {
  return comparable(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Titre de page : le nom, suivi des parties du lieu qu’il ne dit pas déjà (« Coeur de Saint François »
 * à Saint-François, Guadeloupe → « Coeur de Saint François · Guadeloupe »).
 */
export function buildSeoTitle(name: string, place: string): string {
  const title = name.trim();
  const nameWords = looseWords(title);
  const missing = place.split(',').map((part) => part.trim()).filter((part) => part && !nameWords.includes(looseWords(part)));
  return missing.length ? `${title} · ${missing.join(', ')}` : title;
}

/** Titre d'un logement : « Appartement les Raisins Clairs · Saint-François, Guadeloupe ». */
export function listingSeoTitle(core: unknown): string {
  const record = asObject(core);
  return buildSeoTitle(readText(record.title) || 'Location de vacances', listingPlace(record));
}

/** Lieu affiché par une page principale : celui que l'hôte a saisi, sinon celui de ses logements. */
export function hubPlace(core: unknown, childrenPlace: string): string {
  const page = asObject(asObject(core).page);
  return readText(page.location) || childrenPlace;
}

export function hubSeoTitle(core: unknown, childrenPlace: string): string {
  const record = asObject(core);
  return buildSeoTitle(readText(record.title) || 'Nos logements', hubPlace(record, childrenPlace));
}

/** Description d'un logement : son texte, sinon une phrase tirée de ses caractéristiques. */
export function listingSeoDescription(core: unknown): string {
  const record = asObject(core);
  const description = toPlainLine(record.description);
  if (description) return truncateText(description, SEO_DESCRIPTION_MAX);

  const title = readText(record.title) || 'Location de vacances';
  const place = listingPlace(record);
  const capacity = Number(record.guest_capacity);
  const parts = [
    `${title}${place ? ` à ${place}` : ''}`,
    Number.isFinite(capacity) && capacity > 0 ? `, jusqu’à ${Math.round(capacity)} voyageur${capacity > 1 ? 's' : ''}` : '',
    '. Réservez en direct auprès de votre hôte.',
  ];
  return truncateText(parts.join(''), SEO_DESCRIPTION_MAX);
}

/** Description d'une page principale : sa présentation, sinon son accroche, sinon une phrase par défaut. */
export function hubSeoDescription(core: unknown, childrenPlace: string): string {
  const record = asObject(core);
  const description = toPlainLine(record.description);
  if (description) return truncateText(description, SEO_DESCRIPTION_MAX);

  const tagline = readText(asObject(record.page).tagline);
  if (tagline) return truncateText(tagline, SEO_DESCRIPTION_MAX);

  const title = readText(record.title) || 'Nos logements';
  const place = hubPlace(record, childrenPlace);
  return truncateText(`${title}${place ? ` à ${place}` : ''} : locations de vacances à réserver en direct auprès de votre hôte.`, SEO_DESCRIPTION_MAX);
}

// --- Pied de page -----------------------------------------------------------------------------

/** Pied de page proposé tant que l'hôte n'a rien saisi : le nom du site et son lieu. */
export function defaultSiteFooter(siteName: string, place: string): SiteFooter {
  return { name: siteName.trim(), text: place.trim(), email: '', phone: '' };
}

// --- Textes proposés d'office sur une page principale ------------------------------------------

/** Accroche proposée : « Locations de vacances à Saint-François, Guadeloupe ». */
export function proposedTagline(place: string, listingsCount: number): string {
  const where = place.trim();
  if (!where) return 'Locations de vacances, à réserver en direct';
  return `${listingsCount > 1 ? 'Locations' : 'Location'} de vacances à ${where}`;
}

/**
 * Présentation proposée : deux paragraphes factuels (lieu, logements, réservation en direct). Ni prix
 * ni nombre de logements : ils changent, le texte resterait faux. L'hôte le remplace par le sien.
 */
export function proposedPresentation(args: {
  siteName: string;
  place: string;
  listingTitles: string[];
}): { title: string; text: string } {
  const siteName = args.siteName.trim() || 'Notre maison';
  const place = args.place.trim();
  const city = place.split(',')[0]?.trim() ?? '';
  const titles = args.listingTitles.map((title) => title.trim()).filter(Boolean);

  const welcome = place ? `${siteName} vous accueille à ${place}.` : `Bienvenue chez ${siteName}.`;
  const discover = titles.length === 1
    ? `Découvrez ${titles[0]}, à réserver directement auprès de votre hôte.`
    : 'Découvrez nos logements, à réserver directement auprès de votre hôte.';
  const booking = 'La réservation se fait sur ce site, avec un paiement sécurisé, et vous échangez avec votre hôte avant votre arrivée pour préparer votre séjour.';

  return {
    title: city ? `Votre séjour à ${city}` : 'Bienvenue',
    text: `${welcome} ${discover}\n\n${booking}`,
  };
}
