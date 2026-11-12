// File: src/utils/authEntry.ts

import { isListingHostname } from '@/domain/listings/publicDomain'

/**
 * Un hôte connecté n'a rien à faire sur la landing : elle sert à présenter IndieHost à qui n'a pas
 * encore de compte. Après une connexion, et à chaque ouverture d'indiehost.fr avec une session,
 * il arrive sur ses annonces.
 *
 * - Destination après la connexion ou l'inscription : `resolvePostAuthRedirect` (pages Clerk).
 * - Ouverture de la landing avec une session : garde du routeur (`home`), qui attend Clerk sous
 *   l'écran de chargement quand le cookie de Clerk annonce une session, puis
 *   `useDashboardEntryRedirect` en secours si Clerk a répondu trop tard.
 * Ces arrivées passent toutes par `SIGNED_IN_ENTRY_PATH` : un compte administrateur
 * (dev@indiehost.fr) y est envoyé sur l'administration, les autres sur leurs annonces.
 */

/** « Mes annonces » : le logo de la navigation y mène, administrateur compris. */
export const DASHBOARD_ENTRY_PATH = '/dashboard/editor'

/**
 * Arrivée d'un compte connecté sans destination précise (route `dashboard-entry` du routeur) :
 * l'administration pour un administrateur, demande du 2026-11-12, « Mes annonces » sinon.
 */
export const SIGNED_IN_ENTRY_PATH = '/dashboard'

// Pages sans intérêt pour qui vient de se connecter : y revenir le laisserait sur une page
// marketing ou légale. La landing (`/`) en tête.
const PAGES_WITHOUT_RETURN = /^\/(?:$|sign-in|sign-up|legal|donation)(?:\/|$)/

/**
 * Page ouverte après la connexion ou l'inscription : la page demandée (`redirect_url`) si c'est
 * un chemin interne utile, sinon l'arrivée sur le tableau de bord (administration pour un
 * administrateur). Jamais une autre origine (redirection ouverte).
 */
export function resolvePostAuthRedirect(requested: string | null | undefined): string {
  const target = typeof requested === 'string' ? requested.trim() : ''
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return SIGNED_IN_ENTRY_PATH

  const pathname = target.split(/[?#]/, 1)[0] ?? ''
  if (PAGES_WITHOUT_RETURN.test(pathname)) return SIGNED_IN_ENTRY_PATH
  return target
}

/**
 * Clerk pose `__client_uat` (et sa variante suffixée) sur le domaine du site : `0` sans session,
 * la date de la dernière mise à jour de la session sinon. Lisible avant le chargement de Clerk ;
 * ce n'est qu'un indice, Clerk confirme ensuite.
 */
export function hasClerkSessionCookie(cookie: string = typeof document === 'undefined' ? '' : document.cookie): boolean {
  return /(?:^|;\s*)__client_uat(?:_[^=;]*)?=[1-9]/.test(cookie)
}

/**
 * Ouverture de la landing (`/` d'indiehost.fr, pas un domaine d'annonce) par un navigateur qui a
 * une session Clerk : la page attend Clerk sous l'écran de chargement au lieu de montrer la landing.
 */
export const landingEntryMayBeSignedIn =
  typeof window !== 'undefined' &&
  window.location.pathname === '/' &&
  !isListingHostname(window.location.hostname) &&
  hasClerkSessionCookie()

type ClerkRuntime = Window & {
  Clerk?: {
    loaded?: boolean
    user?: { id?: string | null } | null
  }
}

/**
 * Identifiant de l'utilisateur connecté dès que Clerk est chargé, `null` sans session.
 * Rend `null` aussi si Clerk n'a pas répondu dans le délai : la landing s'affiche alors, et
 * `useDashboardEntryRedirect` prend le relais.
 */
export async function waitForClerkUserId(maxWaitMs: number, pollIntervalMs = 50): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const deadline = Date.now() + maxWaitMs
  for (;;) {
    const clerk = (window as ClerkRuntime).Clerk
    if (clerk?.loaded) {
      const userId = typeof clerk.user?.id === 'string' ? clerk.user.id.trim() : ''
      return userId || null
    }
    if (Date.now() >= deadline) return null
    await new Promise((resolve) => {
      window.setTimeout(resolve, pollIntervalMs)
    })
  }
}

/**
 * Lien à jeton qui pointe sur `/` (jeton de connexion, « Impersonate » du Clerk Dashboard,
 * invitation) : la page de connexion (ou d'inscription, pour une invitation) sait consommer
 * `__clerk_ticket`, la landing non.
 */
export function resolveTicketEntryRoute(query: Record<string, unknown>): { name: 'sign-in' | 'sign-up'; query: Record<string, string> } | null {
  const ticket = typeof query.__clerk_ticket === 'string' ? query.__clerk_ticket.trim() : ''
  if (!ticket) return null

  const status = typeof query.__clerk_status === 'string' ? query.__clerk_status : ''
  const forwarded: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') forwarded[key] = value
  }
  forwarded.redirect_url = SIGNED_IN_ENTRY_PATH

  return { name: status === 'sign_up' ? 'sign-up' : 'sign-in', query: forwarded }
}
