// File: src/utils/authEntry.ts

/**
 * Arrivée sur le site juste après une connexion faite hors de nos pages : lien à jeton
 * (sign-in token), « Impersonate » du Clerk Dashboard, invitation acceptée sur le portail
 * Clerk. Clerk renvoie alors vers l'URL d'accueil de l'instance (`/`), qui affiche la
 * landing : on ouvre plutôt le tableau de bord.
 *
 * Importé en tête de `main.ts` : l'URL d'arrivée est lue avant que Clerk ne retire ses
 * paramètres (`__clerk_*`) de la barre d'adresse.
 */

export const DASHBOARD_ENTRY_PATH = '/dashboard/editor'

// Une session plus ancienne n'est pas une connexion qui vient d'avoir lieu.
export const FRESH_SESSION_MS = 5 * 60 * 1000

const CLERK_ENTRY_PARAMS = [
  '__clerk_ticket',
  '__clerk_status',
  '__clerk_created_session',
  '__clerk_handshake',
  '__clerk_db_jwt',
  '__clerk_synced',
] as const

function readInitialSearch(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  try {
    return new URLSearchParams(window.location.search)
  } catch {
    return new URLSearchParams()
  }
}

const initialSearch = readInitialSearch()

/** La page a été ouverte avec des paramètres posés par Clerk (retour de connexion). */
export const arrivedWithClerkParams = CLERK_ENTRY_PARAMS.some((key) => initialSearch.has(key))

export type EntrySession = {
  id: string
  createdAt: Date | number | null | undefined
  /** Session d'un administrateur qui emprunte le compte (« Impersonate »). */
  hasActor: boolean
}

export type DashboardEntryInput = {
  /** La landing est la première page de l'onglet (pas une navigation interne). */
  isDirectEntry: boolean
  hasClerkParams: boolean
  session: EntrySession | null
  alreadyHandled: boolean
  now: number
}

export function shouldOpenDashboardOnEntry(input: DashboardEntryInput): boolean {
  const { session } = input
  if (!session?.id) return false
  if (input.alreadyHandled || !input.isDirectEntry) return false
  if (session.hasActor || input.hasClerkParams) return true

  const createdAt = session.createdAt instanceof Date ? session.createdAt.getTime() : Number(session.createdAt)
  if (!Number.isFinite(createdAt)) return false
  const age = input.now - createdAt
  return age >= 0 && age <= FRESH_SESSION_MS
}

const HANDLED_STORAGE_PREFIX = 'indiehost:dashboard-entry:'

export function wasDashboardEntryHandled(sessionId: string): boolean {
  try {
    return window.localStorage.getItem(`${HANDLED_STORAGE_PREFIX}${sessionId}`) === '1'
  } catch {
    return false
  }
}

export function markDashboardEntryHandled(sessionId: string) {
  try {
    window.localStorage.setItem(`${HANDLED_STORAGE_PREFIX}${sessionId}`, '1')
  } catch {
    // Stockage indisponible (navigation privée) : la redirection reste limitée à l'arrivée directe.
  }
}

/**
 * Lien à jeton qui pointe sur `/` : la page de connexion (ou d'inscription, pour une
 * invitation) sait consommer `__clerk_ticket`, la landing non.
 */
export function resolveTicketEntryRoute(query: Record<string, unknown>): { name: 'sign-in' | 'sign-up'; query: Record<string, string> } | null {
  const ticket = typeof query.__clerk_ticket === 'string' ? query.__clerk_ticket.trim() : ''
  if (!ticket) return null

  const status = typeof query.__clerk_status === 'string' ? query.__clerk_status : ''
  const forwarded: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') forwarded[key] = value
  }
  forwarded.redirect_url = DASHBOARD_ENTRY_PATH

  return { name: status === 'sign_up' ? 'sign-up' : 'sign-in', query: forwarded }
}
