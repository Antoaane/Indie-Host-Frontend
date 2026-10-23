// File: src/domain/api/listingsCache.ts

import { invalidateSharedRequests, invalidateSharedRequestsByPrefix } from '@/domain/api/requestCache'

// Clés du cache partagé (`requestCache.ts`) pour les lectures d'annonces, afin que toutes les
// mutations (brouillon, publication, domaine, calendrier, réservation, transfert…) invalident
// les mêmes entrées, quel que soit le module qui les effectue.

// Listes d'annonces (`/users/me/listings`, `/users/admin/listings`, `/user/:id/listings`)
export const LISTING_LIST_KEY_PREFIX = 'listing-list:'
// Sections d'une annonce (`/listings/:section/:id`)
export const LISTING_SECTION_KEY_PREFIX = 'listing-section:'
// Sous-domaine / domaine personnalisé d'une annonce (`/listings/:id/domain`)
export const LISTING_DOMAIN_KEY_PREFIX = 'listing-domain:'

// Durées de rétention : assez longues pour couvrir les lectures groupées d'une page
// du tableau de bord (annonces puis annonce sélectionnée, panneaux montés les uns après les autres),
// assez courtes pour qu'une donnée changée hors de cet onglet n'apparaisse pas longtemps.
export const LISTING_LIST_TTL_MS = 5_000
export const LISTING_SECTION_TTL_MS = 3_000
export const LISTING_DOMAIN_TTL_MS = 10_000

export function buildListingListKey(url: string, hasAuth: boolean): string {
  return `${LISTING_LIST_KEY_PREFIX}${hasAuth ? 'auth' : 'anon'}:${url}`
}

export function buildListingSectionKey(listingId: string, section: string, hasAuth: boolean): string {
  return `${LISTING_SECTION_KEY_PREFIX}${listingId.trim()}:${section}:${hasAuth ? 'auth' : 'anon'}`
}

export function buildListingDomainKey(listingId: string): string {
  return `${LISTING_DOMAIN_KEY_PREFIX}${listingId.trim()}`
}

export function invalidateListingLists() {
  invalidateSharedRequestsByPrefix(LISTING_LIST_KEY_PREFIX)
}

// Toutes les sections d'une annonce (ou de toutes les annonces sans identifiant).
export function invalidateListingSections(listingId?: string | null) {
  const normalized = listingId?.trim()
  if (!normalized) {
    invalidateSharedRequestsByPrefix(LISTING_SECTION_KEY_PREFIX)
    return
  }
  invalidateSharedRequestsByPrefix(`${LISTING_SECTION_KEY_PREFIX}${normalized}:`)
}

export function invalidateListingDomain(listingId?: string | null) {
  const normalized = listingId?.trim()
  if (!normalized) {
    invalidateSharedRequestsByPrefix(LISTING_DOMAIN_KEY_PREFIX)
    return
  }
  invalidateSharedRequests(buildListingDomainKey(normalized))
}

// Après une écriture sur une annonce : ses sections et les cartes de liste (titre, statut, prix, adresse publique).
export function invalidateListing(listingId?: string | null) {
  invalidateListingSections(listingId)
  invalidateListingLists()
}
