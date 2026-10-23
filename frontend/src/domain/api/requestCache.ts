// File: src/domain/api/requestCache.ts

import clerkToken from '@/utils/clerkToken'

// Cache partagé des lectures de l'API, à deux étages :
// 1. une requête en cours est rendue à tous ceux qui demandent la même clé (déduplication) ;
// 2. son résultat reste servi quelques secondes (`ttlMs`), jusqu'à ce qu'une mutation
//    appelle `invalidateSharedRequests` sur la clé.
// Les réponses sont clonées à chaque lecture : un appelant qui modifie l'objet rendu ne
// touche ni le cache ni les autres appelants. Le cache est vidé quand l'utilisateur connecté
// change (déconnexion / autre compte) pour ne jamais mêler les données de deux sessions.

type CacheEntry<T> = {
  promise: Promise<T>
  // null tant que la requête est en cours
  expiresAt: number | null
  // `true` quand la requête a été lancée avec `force` (ex. resynchronisation Stripe)
  forced: boolean
}

export type SharedRequestOptions = {
  // Durée pendant laquelle un résultat résolu reste servi (0 : déduplication en vol seulement)
  ttlMs?: number
  // Ignore un résultat déjà résolu et relance la requête ; une requête `force` en cours est partagée
  force?: boolean
}

const entries = new Map<string, CacheEntry<unknown>>()
let lastAuthSubject: string | null = null

function readJwtSubject(token: string | null): string | null {
  if (!token) return null
  const encodedPayload = token.split('.')[1]
  if (!encodedPayload) return null

  const atobImpl = typeof window !== 'undefined' && typeof window.atob === 'function'
    ? window.atob.bind(window)
    : (typeof atob === 'function' ? atob : null)
  if (!atobImpl) return null

  try {
    const padded = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=')
    const payload = JSON.parse(atobImpl(padded)) as { sub?: unknown }
    return typeof payload?.sub === 'string' && payload.sub.trim() ? payload.sub.trim() : null
  } catch {
    return null
  }
}

function readAuthSubject(): string | null {
  if (typeof window !== 'undefined') {
    const clerkUserId = (window as Window & { Clerk?: { user?: { id?: string | null } } }).Clerk?.user?.id
    if (typeof clerkUserId === 'string' && clerkUserId.trim()) return clerkUserId.trim()
  }
  return readJwtSubject(clerkToken.value)
}

// Un autre compte s'est connecté dans le même onglet : rien de ce qui a été lu ne doit lui être servi.
function guardAuthSubject() {
  const subject = readAuthSubject()
  if (!subject) return
  if (lastAuthSubject && lastAuthSubject !== subject) {
    entries.clear()
  }
  lastAuthSubject = subject
}

function cloneResult<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // objet non clonable : on retombe sur le JSON
    }
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function isReusable(entry: CacheEntry<unknown>, force: boolean): boolean {
  if (entry.expiresAt === null) {
    // Requête en cours : une demande `force` ne réutilise qu'une requête elle-même forcée.
    return !force || entry.forced
  }
  if (force) return false
  return entry.expiresAt > Date.now()
}

export function sharedRequest<T>(key: string, fetcher: () => Promise<T>, options: SharedRequestOptions = {}): Promise<T> {
  guardAuthSubject()

  const ttlMs = Math.max(0, options.ttlMs ?? 0)
  const force = Boolean(options.force)

  const existing = entries.get(key) as CacheEntry<T> | undefined
  if (existing && isReusable(existing, force)) {
    return existing.promise.then(cloneResult)
  }

  const entry: CacheEntry<T> = {
    promise: null as unknown as Promise<T>,
    expiresAt: null,
    forced: force,
  }

  entry.promise = fetcher().then(
    (result) => {
      // Une invalidation ou une requête plus récente a pu remplacer l'entrée entre-temps.
      if (entries.get(key) === entry) {
        if (ttlMs > 0) {
          entry.expiresAt = Date.now() + ttlMs
        } else {
          entries.delete(key)
        }
      }
      return result
    },
    (error: unknown) => {
      if (entries.get(key) === entry) entries.delete(key)
      throw error
    },
  )

  entries.set(key, entry)
  return entry.promise.then(cloneResult)
}

export type SharedRequestMatcher = string | RegExp | ((key: string) => boolean)

function matches(key: string, matcher: SharedRequestMatcher): boolean {
  if (typeof matcher === 'string') return key === matcher
  if (matcher instanceof RegExp) return matcher.test(key)
  return matcher(key)
}

// Retire les entrées (résolues ou en cours) correspondant au critère. Les requêtes en cours
// retirées terminent normalement pour leurs appelants mais ne seront plus partagées.
export function invalidateSharedRequests(matcher: SharedRequestMatcher) {
  for (const key of Array.from(entries.keys())) {
    if (matches(key, matcher)) entries.delete(key)
  }
}

export function clearSharedRequests() {
  entries.clear()
}

// Préfixe pratique pour invalider une famille de clés (`invalidateSharedRequestsByPrefix('listing-domain:')`).
export function invalidateSharedRequestsByPrefix(prefix: string) {
  invalidateSharedRequests((key) => key.startsWith(prefix))
}
