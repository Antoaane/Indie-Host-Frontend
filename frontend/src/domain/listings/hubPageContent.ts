// File: src/domain/listings/hubPageContent.ts

// Contenu de la page de présentation d'une page principale : lecture des réglages enregistrés dans
// l'annonce (`core.page`) et contenu par défaut tant que l'hôte n'a rien modifié sur sa page.
// Utilisé par la page publique (`views/ListingHub/_ListingHub.vue`) et par le mode édition
// (`views/ListingHub/edit/`). Conception : docs/editeur-de-page.md.
//
// L'API valide et nettoie ces données à l'écriture (`backend/api/src/domains/listings/hubPage.ts`) :
// les limites ci-dessous sont les mêmes des deux côtés.

import type { ListingHubChildCard } from '@/domain/api/listingHubs'
import {
  PAGE_GALLERY_SIZE,
  readPageThemeId,
  type HubPageContent,
  type HubPageListing,
  type PageSection,
  type PageThemeId,
} from '@/domain/listings/pageThemes'
import type { RawListingBundle } from '@/domain/listings/types'
import { orderByIndex } from '@/utils/medias/order'

export const PAGE_LIMITS = {
  title: 80,
  tagline: 180,
  location: 80,
  sectionTitle: 80,
  sectionText: 1200,
  /** Sections ajoutées par l'hôte, sans compter celle des logements. */
  maxSections: 12,
} as const

export type StoredPageSettings = {
  /** Thème choisi par l'hôte ; `null` : thème d'office selon le lieu des logements. */
  themeId: PageThemeId | null
  tagline: string
  location: string
  /** `null` tant que l'hôte n'a jamais modifié sa page : le contenu par défaut s'applique. */
  sections: PageSection[] | null
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readImage(value: unknown): string | null {
  return readText(value) || null
}

function readSection(value: unknown, index: number): PageSection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const id = readText(raw.id) || `section-${index + 1}`
  const title = readText(raw.title)

  if (raw.type === 'listings') return { id, type: 'listings', title }
  if (raw.type === 'text') return { id, type: 'text', title, text: readText(raw.text) }
  if (raw.type === 'text-image') {
    return { id, type: 'text-image', title, text: readText(raw.text), imageSrc: readImage(raw.imageSrc) }
  }
  if (raw.type === 'gallery') {
    const images = Array.isArray(raw.images) ? raw.images : []
    return { id, type: 'gallery', title, images: Array.from({ length: PAGE_GALLERY_SIZE }, (_, slot) => readImage(images[slot])) }
  }
  return null
}

/** Réglages de page enregistrés dans l'annonce. Tout y est facultatif ; une valeur inconnue est ignorée. */
export function readStoredPageSettings(core: unknown): StoredPageSettings {
  const page = (core as Record<string, unknown> | null | undefined)?.page
  const raw = page && typeof page === 'object' && !Array.isArray(page) ? page as Record<string, unknown> : {}

  let sections: PageSection[] | null = null
  if (Array.isArray(raw.sections)) {
    const usedIds = new Set<string>()
    sections = []
    raw.sections.forEach((item, index) => {
      const section = readSection(item, index)
      if (!section || usedIds.has(section.id)) return
      usedIds.add(section.id)
      sections?.push(section)
    })
  }

  return {
    themeId: readPageThemeId(raw.theme),
    tagline: readText(raw.tagline),
    location: readText(raw.location),
    sections,
  }
}

/** Texte simple à partir d'une description écrite dans l'éditeur riche : paragraphes gardés, mise en forme retirée. */
export function htmlToPlainText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Photos de l'annonce, dans l'ordre d'affichage. */
export function readOrderedImageSources(listing: RawListingBundle): string[] {
  const images = Array.isArray(listing.medias?.images) ? listing.medias.images : []
  return orderByIndex(images)
    .map((image) => readText(image?.src))
    .filter(Boolean)
}

export function readHubHostName(listing: RawListingBundle): string {
  const host = listing.host as Record<string, unknown> | null | undefined
  for (const value of [host?.displayName, host?.name, host?.pseudo, host?.firstName]) {
    const name = readText(value)
    if (name) return name
  }
  return ''
}

/**
 * Sections de la page. Celles que l'hôte a enregistrées, sinon le contenu par défaut : la
 * présentation de l'annonce (sa description et sa deuxième photo), puis les logements.
 * La section des logements existe toujours, une seule fois.
 */
export function resolvePageSections(listing: RawListingBundle, stored: PageSection[] | null): PageSection[] {
  if (stored) {
    const sections: PageSection[] = []
    let hasListings = false
    for (const section of stored) {
      if (section.type === 'listings') {
        if (hasListings) continue
        hasListings = true
      }
      sections.push(section)
    }
    if (!hasListings) sections.push({ id: 'logements', type: 'listings', title: '' })
    return sections
  }

  const sections: PageSection[] = []
  const description = htmlToPlainText(listing.core?.description)
  const secondImage = readOrderedImageSources(listing)[1] ?? null
  if (description || secondImage) {
    sections.push({ id: 'presentation', type: 'text-image', title: '', text: description, imageSrc: secondImage })
  }
  sections.push({ id: 'logements', type: 'listings', title: '' })
  return sections
}

const LISTINGS_TITLES = { one: 'Notre logement', many: 'Nos logements' } as const

export function defaultListingsTitle(listingsCount: number): string {
  return listingsCount === 1 ? LISTINGS_TITLES.one : LISTINGS_TITLES.many
}

/** Affichage : la section des logements sans titre propre prend le titre par défaut, accordé au nombre de logements. */
export function withDefaultListingsTitle(sections: PageSection[], listingsCount: number): PageSection[] {
  return sections.map((section) => (
    section.type === 'listings' && !section.title.trim()
      ? { ...section, title: defaultListingsTitle(listingsCount) }
      : section
  ))
}

/**
 * Enregistrement : un titre de logements laissé à sa valeur par défaut n'est pas figé, pour qu'il
 * continue de s'accorder (« Notre logement » puis « Nos logements » au deuxième logement rattaché).
 */
export function withoutDefaultListingsTitle(sections: PageSection[]): PageSection[] {
  return sections.map((section) => (
    section.type === 'listings' && (section.title === LISTINGS_TITLES.one || section.title === LISTINGS_TITLES.many)
      ? { ...section, title: '' }
      : section
  ))
}

/** Contenu de la page à partir de l'annonce, hors lieu par défaut (il dépend des logements rattachés). */
export function buildHubPageContent(
  listing: RawListingBundle,
  options: { listingsCount: number; fallbackLocation?: string },
): { content: HubPageContent; settings: StoredPageSettings } {
  const settings = readStoredPageSettings(listing.core)
  const images = readOrderedImageSources(listing)

  return {
    settings,
    content: {
      title: readText(listing.core?.title) || 'Nos logements',
      tagline: settings.tagline,
      location: settings.location || options.fallbackLocation || '',
      coverSrc: images[0] ?? null,
      hostName: readHubHostName(listing),
      sections: withDefaultListingsTitle(resolvePageSections(listing, settings.sections), options.listingsCount),
    },
  }
}

// --- Logements rattachés ---------------------------------------------------------------------

function formatChildPlace(child: Pick<ListingHubChildCard, 'city' | 'region'>): string {
  if (!child.city) return ''
  return child.region ? `${child.city}, ${child.region}` : child.city
}

/** Lieu proposé tant que l'hôte n'en a pas saisi : celui des logements, s'ils sont tous au même endroit. */
export function resolveSharedLocation(children: ListingHubChildCard[]): string {
  const places = new Set(children.map((child) => formatChildPlace(child)).filter(Boolean))
  return places.size === 1 ? [...places][0] ?? '' : ''
}

/** Cartes des logements de la page, à partir des annonces rattachées et en ligne. */
export function toHubPageListings(children: ListingHubChildCard[]): HubPageListing[] {
  return children.map((child) => ({
    id: child.listingId,
    title: child.title,
    city: formatChildPlace(child),
    guestCapacity: child.guestCapacity,
    pricePerNight: child.pricePerNight,
    coverSrc: child.coverSrc,
    href: child.publicPath,
    setting: child.setting,
    note: child.status === 'blocked' ? 'Réservations momentanément fermées' : null,
  }))
}
