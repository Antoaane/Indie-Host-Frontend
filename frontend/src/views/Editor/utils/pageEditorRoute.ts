// File: src/views/Editor/utils/pageEditorRoute.ts

import type { RouteLocationRaw } from 'vue-router'

/**
 * Mode édition de la page de présentation d'une page principale (`views/ListingHub/edit/`).
 * `ownerId` : le client dont un admin modifie la page, pour revenir ensuite à son éditeur.
 */
export function buildPageEditorRoute(listingId: string, ownerId?: string | null): RouteLocationRaw {
  const owner = (ownerId ?? '').trim()
  return {
    name: 'page-editor',
    params: { listingId },
    query: owner ? { owner } : undefined,
  }
}

// Repère posé sur l'adresse publique quand l'hôte l'ouvre depuis son éditeur. Sur un domaine relié
// (ou un sous-domaine), la session IndieHost n'existe pas : la page publique ne peut pas savoir
// qu'elle est regardée par son propriétaire. Ce repère lui fait afficher « Modifier ma page ».
// Il ne donne aucun droit : le bouton mène au tableau de bord, qui demande la connexion.
export const OWNER_VIEW_PARAM = 'proprietaire'

export function withOwnerViewMarker(url: string): string {
  const [base, hash = ''] = url.split('#')
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}${OWNER_VIEW_PARAM}=1${hash ? `#${hash}` : ''}`
}

/** Identifiant d'utilisateur porté par l'adresse de l'éditeur (`/dashboard/editor/:userId`). */
export function readEditorRouteUserId(value: unknown): string {
  if (Array.isArray(value)) return readEditorRouteUserId(value[0])
  return typeof value === 'string' ? value.trim() : ''
}
