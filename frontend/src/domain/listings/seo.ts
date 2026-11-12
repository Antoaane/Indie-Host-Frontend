// File: src/domain/listings/seo.ts

// Titre et description des pages d'un site d'hôte (page principale, logement), posés par le site une
// fois chargé. L'API sert déjà ces balises dans le HTML de la page avec les mêmes règles
// (`backend/api/src/domains/publicSite/siteContent.ts`) : toute évolution se fait des deux côtés,
// sinon le titre change entre la page servie et la page affichée.

export const SEO_DESCRIPTION_MAX = 160

// Accents détachés par normalize('NFD') (U+0300 à U+036F), retirés pour comparer sans accents.
const COMBINING_MARKS = /[\u0300-\u036f]/g

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': '’',
  '&apos;': '’',
}

type Record_ = Record<string, unknown>

function asRecord(value: unknown): Record_ {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record_ : {}
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function comparable(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()
}

/** Texte d'une description écrite dans l'éditeur riche : paragraphes gardés, mise en forme retirée. */
export function htmlToParagraphs(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return []
  const text = value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39|apos);/g, (entity) => ENTITIES[entity] ?? entity)
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim())
    .filter(Boolean)
}

export function toPlainLine(value: unknown): string {
  return htmlToParagraphs(value).join(' ').replace(/\s+/g, ' ').trim()
}

/** Coupe au dernier mot entier avant `max` caractères, avec des points de suspension. */
export function truncateText(value: string, max: number): string {
  if (value.length <= max) return value
  const cut = value.slice(0, Math.max(0, max - 1))
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${base.replace(/[\s,;:.–—&-]+$/, '')}…`
}

/** « Saint-François, Guadeloupe » ; la région est omise quand elle répète la ville. */
export function formatPlace(city: unknown, region: unknown): string {
  const cityText = readText(city)
  const regionText = readText(region)
  if (!cityText) return regionText
  if (!regionText || comparable(regionText) === comparable(cityText)) return cityText
  return `${cityText}, ${regionText}`
}

export function listingPlace(core: unknown): string {
  const record = asRecord(core)
  return formatPlace(record.city, record.region)
}

/** Lieu commun à des logements : le même pour tous, sinon aucun. */
export function sharedPlace(places: string[]): string {
  const distinct = new Set(places.map((place) => place.trim()).filter(Boolean))
  return distinct.size === 1 ? [...distinct][0] ?? '' : ''
}

/** Pour comparer : sans accents, sans ponctuation (« Saint-François » vaut « Saint François »). */
function looseWords(value: string): string {
  return comparable(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Titre de page : le nom, suivi des parties du lieu qu’il ne dit pas déjà (« Coeur de Saint François »
 * à Saint-François, Guadeloupe → « Coeur de Saint François · Guadeloupe »).
 */
export function buildSeoTitle(name: string, place: string): string {
  const title = name.trim()
  const nameWords = looseWords(title)
  const missing = place.split(',').map((part) => part.trim()).filter((part) => part && !nameWords.includes(looseWords(part)))
  return missing.length ? `${title} · ${missing.join(', ')}` : title
}

export function listingSeoTitle(core: unknown): string {
  const record = asRecord(core)
  return buildSeoTitle(readText(record.title) || 'Location de vacances', listingPlace(record))
}

/** Lieu affiché par une page principale : celui que l'hôte a saisi, sinon celui de ses logements. */
export function hubPlace(core: unknown, childrenPlace: string): string {
  const page = asRecord(asRecord(core).page)
  return readText(page.location) || childrenPlace
}

export function hubSeoTitle(core: unknown, childrenPlace: string): string {
  const record = asRecord(core)
  return buildSeoTitle(readText(record.title) || 'Nos logements', hubPlace(record, childrenPlace))
}

export function listingSeoDescription(core: unknown): string {
  const record = asRecord(core)
  const description = toPlainLine(record.description)
  if (description) return truncateText(description, SEO_DESCRIPTION_MAX)

  const title = readText(record.title) || 'Location de vacances'
  const place = listingPlace(record)
  const capacity = Number(record.guest_capacity)
  const parts = [
    `${title}${place ? ` à ${place}` : ''}`,
    Number.isFinite(capacity) && capacity > 0 ? `, jusqu’à ${Math.round(capacity)} voyageur${capacity > 1 ? 's' : ''}` : '',
    '. Réservez en direct auprès de votre hôte.',
  ]
  return truncateText(parts.join(''), SEO_DESCRIPTION_MAX)
}

export function hubSeoDescription(core: unknown, childrenPlace: string): string {
  const record = asRecord(core)
  const description = toPlainLine(record.description)
  if (description) return truncateText(description, SEO_DESCRIPTION_MAX)

  const tagline = readText(asRecord(record.page).tagline)
  if (tagline) return truncateText(tagline, SEO_DESCRIPTION_MAX)

  const title = readText(record.title) || 'Nos logements'
  const place = hubPlace(record, childrenPlace)
  return truncateText(`${title}${place ? ` à ${place}` : ''} : locations de vacances à réserver en direct auprès de votre hôte.`, SEO_DESCRIPTION_MAX)
}

/** Adresse canonique de la page affichée : l'origine et le chemin, sans paramètres ni barre finale. */
export function currentCanonicalUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  return `${window.location.origin}${path}`
}
