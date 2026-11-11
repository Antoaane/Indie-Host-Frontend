// File: src/domain/listings/pageThemes.ts

// Thèmes de la page de présentation d'un hôte (page principale). Trois thèmes au maximum : chacun
// est un gabarit complet (couleurs, polices, formes), pas une boîte à réglages.
//
// Ce fichier est la seule source des palettes : la page les reçoit en variables CSS (`--page-*`),
// le sélecteur de thème de l'éditeur lit les mêmes valeurs pour ses aperçus. Les différences de
// mise en page entre thèmes sont dans `views/ListingHub/themed/themed-hub-page.scss`.
// Détail et justification des choix : `docs/editeur-de-page.md`.

export type PageThemeId = 'maison' | 'rivage' | 'nocturne'

export type PageThemeColors = {
  /** Fond de la page. */
  bg: string
  /** Fond des blocs posés sur la page (cartes, encadrés). */
  surface: string
  /** Texte principal et titres. */
  ink: string
  /** Texte secondaire (lieu, capacité, légendes). */
  muted: string
  /** Couleur d'action : boutons, liens, prix. */
  accent: string
  /** Texte posé sur la couleur d'action. */
  onAccent: string
  /** Couleur de relief : étiquettes de prix, bouton posé sur un aplat de couleur d'action. */
  highlight: string
  /** Texte posé sur la couleur de relief. */
  onHighlight: string
}

export type PageTheme = {
  id: PageThemeId
  /** Nom montré à l'hôte dans le sélecteur. */
  name: string
  /** Une ligne pour aider à choisir, sans jargon. */
  description: string
  fonts: {
    /** Titres. */
    display: string
    /** Texte courant. */
    body: string
  }
  colors: PageThemeColors
  /** Thème clair ou sombre : règle les barres de défilement et les champs natifs du navigateur. */
  colorScheme: 'light' | 'dark'
}

export const PAGE_THEMES: readonly PageTheme[] = [
  {
    id: 'maison',
    name: 'Maison',
    description: 'Classique et posé, pour une maison de caractère ou un gîte.',
    fonts: {
      display: "'Cormorant Garamond', 'Iowan Old Style', Georgia, serif",
      body: "'Proza Libre', 'Segoe UI', system-ui, sans-serif",
    },
    colors: {
      bg: '#f3f4ef',
      surface: '#ffffff',
      ink: '#1e2a24',
      muted: '#56645c',
      accent: '#2e5a47',
      onAccent: '#ffffff',
      highlight: '#2e5a47',
      onHighlight: '#ffffff',
    },
    colorScheme: 'light',
  },
  {
    id: 'rivage',
    name: 'Rivage',
    description: 'Solaire et franc, pour un appartement ou une location de bord de mer.',
    fonts: {
      display: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      body: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    },
    colors: {
      bg: '#f7f0e3',
      surface: '#ffffff',
      ink: '#0b2545',
      muted: '#4d5f78',
      accent: '#1650c5',
      onAccent: '#ffffff',
      highlight: '#ffc94a',
      onHighlight: '#0b2545',
    },
    colorScheme: 'light',
  },
  {
    id: 'nocturne',
    name: 'Nocturne',
    description: 'Sombre et feutré : les photos passent au premier plan.',
    fonts: {
      display: "'Fraunces', 'Iowan Old Style', Georgia, serif",
      body: "'Libre Franklin', 'Segoe UI', system-ui, sans-serif",
    },
    colors: {
      bg: '#15191e',
      surface: '#1e242b',
      ink: '#f2efe9',
      muted: '#a9b0b8',
      accent: '#e3a857',
      onAccent: '#15191e',
      highlight: '#e3a857',
      onHighlight: '#15191e',
    },
    colorScheme: 'dark',
  },
] as const

// Thème d'une page qui n'en a pas choisi. Recommandation en attente de décision (D2 du document).
export const DEFAULT_PAGE_THEME_ID: PageThemeId = 'maison'

export function resolvePageTheme(id: unknown): PageTheme {
  return PAGE_THEMES.find((theme) => theme.id === id)
    ?? PAGE_THEMES.find((theme) => theme.id === DEFAULT_PAGE_THEME_ID)
    ?? PAGE_THEMES[0]
}

/** Thème choisi par l'hôte, s'il fait partie des thèmes connus. */
export function readPageThemeId(id: unknown): PageThemeId | null {
  return PAGE_THEMES.find((theme) => theme.id === id)?.id ?? null
}

/**
 * Cadre d'un logement : près de la mer, ou dans les terres (montagne comprise). L'API le déduit des
 * coordonnées de l'adresse (`backend/api/src/domains/listings/placeSetting.ts`) ; il est absent
 * quand l'annonce n'a pas d'adresse.
 */
export type PlaceSetting = 'sea' | 'inland'

const THEME_BY_PLACE_SETTING: Record<PlaceSetting, PageThemeId> = {
  sea: 'rivage',
  inland: 'maison',
}

/**
 * Thème appliqué d'office d'après le lieu des logements de la page : près de la mer, Rivage ;
 * en montagne ou dans les terres, Maison ; sans adresse, le thème par défaut. Avec plusieurs
 * logements, le thème qui revient le plus l'emporte ; à égalité, la mer passe avant les terres.
 * Ne vaut que tant que l'hôte n'a pas choisi lui-même : son choix prime toujours.
 */
export function suggestPageThemeId(settings: ReadonlyArray<PlaceSetting | null | undefined>): PageThemeId {
  const votes = new Map<PageThemeId, number>()
  for (const setting of settings) {
    const themeId = setting ? THEME_BY_PLACE_SETTING[setting] : DEFAULT_PAGE_THEME_ID
    votes.set(themeId, (votes.get(themeId) ?? 0) + 1)
  }

  let best: PageThemeId = DEFAULT_PAGE_THEME_ID
  let bestVotes = 0
  for (const themeId of ['rivage', 'maison', DEFAULT_PAGE_THEME_ID] as const) {
    const count = votes.get(themeId) ?? 0
    if (count > bestVotes) {
      best = themeId
      bestVotes = count
    }
  }
  return best
}

/** Variables CSS posées sur la racine de la page (`style`), lues par `themed-hub-page.scss`. */
export function buildPageThemeStyle(theme: PageTheme): Record<string, string> {
  return {
    '--page-bg': theme.colors.bg,
    '--page-surface': theme.colors.surface,
    '--page-ink': theme.colors.ink,
    '--page-muted': theme.colors.muted,
    '--page-accent': theme.colors.accent,
    '--page-on-accent': theme.colors.onAccent,
    '--page-highlight': theme.colors.highlight,
    '--page-on-highlight': theme.colors.onHighlight,
    '--page-font-display': theme.fonts.display,
    '--page-font-body': theme.fonts.body,
    'color-scheme': theme.colorScheme,
  }
}

/**
 * Sections de la page, entre l'en-tête et le pied de page. L'hôte en ajoute avec les « + » du mode
 * édition et les supprime une à une. La section des logements existe toujours, une seule fois.
 */
export type PageSection =
  | { id: string; type: 'text-image'; title: string; text: string; imageSrc: string | null }
  | { id: string; type: 'text'; title: string; text: string }
  | { id: string; type: 'gallery'; title: string; images: Array<string | null> }
  | PageRatingSection
  | { id: string; type: 'listings'; title: string }

/**
 * Note des voyageurs sur Booking ou Airbnb, recopiée par l'hôte : la plateforme, sa note dans son
 * propre format (sur 10 pour Booking, sur 5 pour Airbnb), le nombre de commentaires et l'appréciation
 * que la plateforme affiche (« Exceptionnel »). Booking ne publie pas le barème de ses appréciations :
 * elle n'est pas déduite de la note, l'hôte écrit le mot qu'il voit.
 */
export type PageRatingSection = {
  id: string
  type: 'rating'
  title: string
  platform: RatingPlatform
  /** `null` tant que l'hôte n'a pas saisi de note : la section n'est alors pas montrée au voyageur. */
  score: number | null
  reviewCount: number | null
  label: string
}

export type PageSectionType = PageSection['type']

/** Modification d'une section en mode édition : seuls les champs qui changent. */
export type PageSectionPatch = Partial<{
  title: string
  text: string
  platform: RatingPlatform
  score: number | null
  reviewCount: number | null
  label: string
}>

/** Types qu'un « + » propose : peu de choix, pas une bibliothèque de blocs. */
export type AddablePageSectionType = Exclude<PageSectionType, 'listings'>

export const ADDABLE_PAGE_SECTIONS: ReadonlyArray<{ type: AddablePageSectionType; label: string }> = [
  { type: 'text-image', label: 'Texte et photo' },
  { type: 'text', label: 'Texte' },
  { type: 'gallery', label: 'Photos' },
  { type: 'rating', label: 'Note Booking ou Airbnb' },
]

export const PAGE_GALLERY_SIZE = 3

export type RatingPlatform = 'booking' | 'airbnb'

/** Plateformes de la note, avec leur échelle et le nombre de décimales qu'elles affichent. */
export const RATING_PLATFORMS: ReadonlyArray<{ id: RatingPlatform; name: string; scale: number; decimals: number }> = [
  { id: 'booking', name: 'Booking.com', scale: 10, decimals: 1 },
  { id: 'airbnb', name: 'Airbnb', scale: 5, decimals: 2 },
]

export function resolveRatingPlatform(id: unknown) {
  return RATING_PLATFORMS.find((platform) => platform.id === id) ?? RATING_PLATFORMS[0]
}

/** Note valable pour la plateforme (de 1 à son échelle), arrondie comme elle l'affiche ; sinon `null`. */
export function normalizeRatingScore(value: unknown, platformId: RatingPlatform): number | null {
  const score = typeof value === 'number' ? value : Number.NaN
  const platform = resolveRatingPlatform(platformId)
  if (!Number.isFinite(score) || score < 1 || score > platform.scale) return null
  const factor = 10 ** platform.decimals
  return Math.round(score * factor) / factor
}

export const MAX_REVIEW_COUNT = 1_000_000

/** Nombre de commentaires entier, de 0 à un million ; sinon `null`. */
export function normalizeReviewCount(value: unknown): number | null {
  const count = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(count) || count < 0 || count > MAX_REVIEW_COUNT) return null
  return Math.round(count)
}

export function createPageSection(type: AddablePageSectionType, id: string): PageSection {
  if (type === 'text-image') return { id, type, title: '', text: '', imageSrc: null }
  if (type === 'gallery') return { id, type, title: '', images: Array.from({ length: PAGE_GALLERY_SIZE }, () => null) }
  if (type === 'rating') {
    return { id, type, title: 'Ce qu’en disent nos voyageurs', platform: 'booking', score: null, reviewCount: null, label: '' }
  }
  return { id, type, title: '', text: '' }
}

/** Contenu modifiable de la page (ce que l'hôte édite à la volée). */
export type HubPageContent = {
  title: string
  tagline: string
  location: string
  coverSrc: string | null
  hostName: string
  sections: PageSection[]
}

export type HubPageListing = {
  id: string
  title: string
  city: string
  guestCapacity: number | null
  pricePerNight: number | null
  coverSrc: string | null
  href: string
  /** Cadre du logement, pour le thème appliqué d'office. Absent si l'adresse ne permet pas de le dire. */
  setting?: PlaceSetting | null
  /** Mention sous le prix (par exemple « Réservations momentanément fermées »). */
  note?: string | null
}
