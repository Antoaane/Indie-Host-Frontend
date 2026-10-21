const ROOT_DOMAIN = normalizeRootDomain((import.meta.env.VITE_PUBLIC_LISTING_ROOT_DOMAIN ?? 'indiehost.fr').toString())

function normalizeRootDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^\*\./, '').replace(/\/+$/, '')
}

function sanitizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().split(':')[0]?.trim() ?? ''
}

export function getPublicListingRootDomain(): string {
  return ROOT_DOMAIN
}

export function extractListingSlugFromHostname(hostname: string): string | null {
  const normalizedHostname = sanitizeHostname(hostname)
  if (!normalizedHostname || !ROOT_DOMAIN) return null
  if (normalizedHostname === ROOT_DOMAIN || normalizedHostname === `www.${ROOT_DOMAIN}`) return null
  if (!normalizedHostname.endsWith(`.${ROOT_DOMAIN}`)) return null

  const slug = normalizedHostname.slice(0, -(ROOT_DOMAIN.length + 1))
  if (!slug || slug.includes('.')) return null
  return slug
}

export function isManagedListingHostname(hostname: string): boolean {
  return Boolean(extractListingSlugFromHostname(hostname))
}

// localhost, IP brutes et TLD de dev (indiehost.local…) ne sont jamais des domaines personnalisés.
function isLocalHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
  if (/\.(local|test|internal|example)$/.test(hostname)) return true
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return true
  return hostname.includes(':') || hostname.startsWith('[')
}

/**
 * Domaine personnalisé rattaché par un hôte (ex. www.gite-belair.fr) :
 * tout hôte « réel » qui n'est ni le domaine racine ni un sous-domaine géré.
 * L'association hostname → annonce est faite par l'API (`/listings/domains/resolve`).
 */
export function isCustomListingHostname(hostname: string): boolean {
  const normalizedHostname = sanitizeHostname(hostname)
  if (!normalizedHostname || !ROOT_DOMAIN) return false
  if (normalizedHostname === ROOT_DOMAIN || normalizedHostname === `www.${ROOT_DOMAIN}`) return false
  if (normalizedHostname.endsWith(`.${ROOT_DOMAIN}`)) return false
  if (isLocalHostname(normalizedHostname)) return false
  return normalizedHostname.includes('.')
}

/** Hôte dédié à une annonce (sous-domaine géré ou domaine personnalisé). */
export function isListingHostname(hostname: string): boolean {
  return isManagedListingHostname(hostname) || isCustomListingHostname(hostname)
}
