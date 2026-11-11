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

/** Identifiant d'utilisateur porté par l'adresse de l'éditeur (`/dashboard/editor/:userId`). */
export function readEditorRouteUserId(value: unknown): string {
  if (Array.isArray(value)) return readEditorRouteUserId(value[0])
  return typeof value === 'string' ? value.trim() : ''
}
