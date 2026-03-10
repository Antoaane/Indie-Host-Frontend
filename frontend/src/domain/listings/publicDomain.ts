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
