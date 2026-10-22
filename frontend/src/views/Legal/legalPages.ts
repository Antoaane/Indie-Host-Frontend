// File: src/views/Legal/legalPages.ts

import registry from '@/views/Legal/legalPages.json'

export type LegalPageEntry = (typeof registry.pages)[number]

// Un fragment HTML par document : la même source sert la page Vue et la version statique générée au build.
const contentLoaders = import.meta.glob<string>('./content/*.html', { query: '?raw', import: 'default' })

export const legalPages: LegalPageEntry[] = registry.pages
export const legalUpdatedAtLabel = registry.updatedAtLabel
export const legalCanonicalOrigin = registry.canonicalOrigin
export const legalSlugPattern = legalPages.map((page) => page.slug).join('|')

export function findLegalPage(slug: unknown): LegalPageEntry | null {
  if (typeof slug !== 'string') return null
  return legalPages.find((page) => page.slug === slug) ?? null
}

export async function loadLegalContent(slug: string): Promise<string> {
  const loader = contentLoaders[`./content/${slug}.html`]
  if (!loader) return ''
  // Le commentaire d'en-tête ajouté en dev (« File: … ») n'a rien à faire dans la page.
  return (await loader()).replace(/^\s*<!--[\s\S]*?-->\s*/, '')
}
