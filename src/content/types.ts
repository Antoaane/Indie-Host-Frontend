// File: src/content/types.ts

/** Bloc générique s’appliquant à TOUS les cas */
export interface GenericBlock {
  /** n’importe quelle balise ou composant */
  tag: string
  /** contenu libre : texte, HTML, src d’image, vide… */
  content?: string
  /** contenu de secours */
  fallback?: string
  /** méta-données libres : props, aria, SEO, data… */
  meta?: Record<string, any>
}

/** Union principale de tous les blocs (avec fallback) */
export type ContentBlock = GenericBlock

/**
 * Section “block-based” assouplie :
 * - `id` (ou `section`) pour le html/id
 * - `blocks` : une map de noms arbitraires vers des ContentBlock
 */
export interface ItemSection {
  /** identifiant HTML de ta section, ex. "faq-section" */
  id: string
  /**
   * key = nom de ton bloc dans le JSON (input_1, title_1…)
   * value = n’importe quel ContentBlock
   */
  items: Record<string, ContentBlock>
}
