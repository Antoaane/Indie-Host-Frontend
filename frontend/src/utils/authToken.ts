// File: src/utils/authToken.ts
// Jeton de session Clerk pour les appels à l'API.
//
// Un jeton Clerk vit 60 secondes. Le store `clerkToken` garde le dernier jeton obtenu : le renvoyer
// sans regarder son expiration fait échouer l'appel (401 « Invalid authentication token ») dès que
// l'utilisateur reste plus d'une minute sur une page avant de cliquer. Tout appel authentifié passe
// donc par `getFreshAuthToken()`, qui redemande un jeton à Clerk quand celui du store est périmé.

import clerkToken from '@/utils/clerkToken'

const MIN_VALIDITY_MS = 10_000
const POLL_EVERY_MS = 60

type ClerkRuntime = {
  session?: {
    getToken?: (options?: { skipCache?: boolean }) => Promise<string | null>
  } | null
}

function readJwtExpiry(token: string): number | null {
  const encodedPayload = token.split('.')[1]
  if (!encodedPayload || typeof atob !== 'function') return null

  try {
    const padded = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=')
    const exp = (JSON.parse(atob(padded)) as { exp?: unknown } | null)?.exp
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null
  } catch {
    return null
  }
}

/** Faux seulement si le jeton porte une expiration lisible et qu'elle est atteinte (ou presque). */
export function isAuthTokenUsable(token: string | null | undefined, minValidityMs = MIN_VALIDITY_MS): boolean {
  const value = (token ?? '').trim()
  if (!value) return false

  const expiresAt = readJwtExpiry(value)
  if (expiresAt === null) return true
  return expiresAt - Date.now() > minValidityMs
}

function readStoredToken(): string | null {
  const token = (clerkToken.value ?? '').trim()
  if (!token) return null
  if (!isAuthTokenUsable(token)) {
    clerkToken.value = null
    return null
  }
  return token
}

async function readTokenFromClerkRuntime(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const session = (window as Window & { Clerk?: ClerkRuntime }).Clerk?.session
  if (!session || typeof session.getToken !== 'function') return null

  try {
    let token = (await session.getToken())?.trim() ?? ''
    if (token && !isAuthTokenUsable(token)) {
      // Le cache de Clerk a rendu un jeton en fin de vie : en demander un neuf.
      token = (await session.getToken({ skipCache: true }))?.trim() ?? ''
    }
    if (!token) return null
    clerkToken.value = token
    return token
  } catch {
    return null
  }
}

/**
 * Jeton valide, ou `null` sans session. `waitMs` laisse à Clerk le temps de démarrer
 * (premier appel juste après le chargement de la page).
 */
export async function getFreshAuthToken({ waitMs = 0 }: { waitMs?: number } = {}): Promise<string | null> {
  const deadline = Date.now() + waitMs

  for (;;) {
    const token = readStoredToken() ?? await readTokenFromClerkRuntime()
    if (token) return token
    if (Date.now() >= deadline) return null
    await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS))
  }
}
