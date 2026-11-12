// File: src/views/Admin/adminLayout.ts

// Disposition de l'administration, vue du code. Même seuil que `@include min-width(lg)` des feuilles
// de l'administration (1 025 px) : au-delà, la section ouverte défile seule dans son panneau ; en
// dessous, c'est la page qui défile. `vp.lg` (utils/viewport.ts) bascule dès 1 024 px : un pixel trop
// tôt pour décider où faire défiler.
const WIDE_LAYOUT_QUERY = '(min-width: 1025px)'

export function isAdminWideLayout(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(WIDE_LAYOUT_QUERY).matches
}

// Défilement doux, sauf si l'appareil demande moins d'animations.
export function adminScrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}
