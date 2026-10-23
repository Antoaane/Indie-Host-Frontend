// File: src/views/Editor/components/EditorSidebar/editorSections.ts

import type { RawListingBundle } from '@/domain/listings/types'
import { editorStatic } from '@/views/Editor/utils/editorContent'

/**
 * Sommaire de la barre latérale de l'éditeur : cinq groupes, chacun découpé en sections
 * ancrées sur un panneau. L'ordre ici est l'ordre d'affichage.
 */
export type EditorGroupId = 'essentials' | 'pricing' | 'arrival' | 'addresses' | 'settings'

export type EditorSectionId =
  | 'title'
  | 'gallery'
  | 'description'
  | 'capacity'
  | 'rooms'
  | 'amenities'
  | 'location'
  | 'pricingBase'
  | 'stay'
  | 'fees'
  | 'taxes'
  | 'payment'
  | 'deposit'
  | 'cancellation'
  | 'summary'
  | 'arrivalIntro'
  | 'savings'
  | 'access'
  | 'services'
  | 'rules'
  | 'shops'
  | 'guide'
  | 'subdomain'
  | 'customDomain'
  | 'parent'
  | 'hubChildren'
  | 'visibility'
  | 'legal'
  | 'reviews'
  | 'calendar'
  | 'import'

export type EditorSectionDefinition = {
  id: EditorSectionId
  label: string
  /** Section réservée aux pages principales (annonces mères). */
  hubOnly?: boolean
  /** Section absente des pages principales. */
  listingOnly?: boolean
}

export type EditorGroupDefinition = {
  id: EditorGroupId
  label: string
  listingOnly?: boolean
  sections: EditorSectionDefinition[]
}

const sectionLabels = editorStatic.sidebar.sections
const groupLabels = editorStatic.sidebar.groups

export const EDITOR_GROUPS: EditorGroupDefinition[] = [
  {
    id: 'essentials',
    label: groupLabels.essentials,
    sections: [
      { id: 'title', label: sectionLabels.title },
      { id: 'gallery', label: sectionLabels.gallery },
      { id: 'description', label: sectionLabels.description },
      { id: 'capacity', label: sectionLabels.capacity, listingOnly: true },
      { id: 'rooms', label: sectionLabels.rooms, listingOnly: true },
      { id: 'amenities', label: sectionLabels.amenities, listingOnly: true },
      { id: 'location', label: sectionLabels.location, listingOnly: true },
    ],
  },
  {
    id: 'pricing',
    label: groupLabels.pricing,
    listingOnly: true,
    sections: [
      { id: 'pricingBase', label: sectionLabels.pricingBase },
      { id: 'stay', label: sectionLabels.stay },
      { id: 'fees', label: sectionLabels.fees },
      { id: 'taxes', label: sectionLabels.taxes },
      { id: 'payment', label: sectionLabels.payment },
      { id: 'deposit', label: sectionLabels.deposit },
      { id: 'cancellation', label: sectionLabels.cancellation },
      { id: 'summary', label: sectionLabels.summary },
    ],
  },
  {
    id: 'arrival',
    label: groupLabels.arrival,
    listingOnly: true,
    sections: [
      { id: 'arrivalIntro', label: sectionLabels.arrivalIntro },
      { id: 'savings', label: sectionLabels.savings },
      { id: 'access', label: sectionLabels.access },
      { id: 'services', label: sectionLabels.services },
      { id: 'rules', label: sectionLabels.rules },
      { id: 'shops', label: sectionLabels.shops },
      { id: 'guide', label: sectionLabels.guide },
    ],
  },
  {
    id: 'addresses',
    label: groupLabels.addresses,
    sections: [
      { id: 'subdomain', label: sectionLabels.subdomain },
      { id: 'customDomain', label: sectionLabels.customDomain },
      { id: 'parent', label: sectionLabels.parent, listingOnly: true },
      { id: 'hubChildren', label: sectionLabels.hubChildren, hubOnly: true },
    ],
  },
  {
    id: 'settings',
    label: groupLabels.settings,
    sections: [
      { id: 'visibility', label: sectionLabels.visibility },
      { id: 'legal', label: sectionLabels.legal, listingOnly: true },
      { id: 'reviews', label: sectionLabels.reviews, listingOnly: true },
      { id: 'calendar', label: sectionLabels.calendar, listingOnly: true },
      { id: 'import', label: sectionLabels.import, listingOnly: true },
    ],
  },
]

export function resolveEditorGroups(isHub: boolean): EditorGroupDefinition[] {
  return EDITOR_GROUPS
    .filter((group) => !(isHub && group.listingOnly))
    .map((group) => ({
      ...group,
      sections: group.sections.filter((section) => (isHub ? !section.listingOnly : !section.hubOnly)),
    }))
}

export function findEditorGroupOfSection(sectionId: EditorSectionId): EditorGroupId {
  const group = EDITOR_GROUPS.find((candidate) => candidate.sections.some((section) => section.id === sectionId))
  return group?.id ?? 'essentials'
}

export function editorSectionDomId(sectionId: EditorSectionId): string {
  return `editor-section-${sectionId}`
}

function stripHtml(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function hasText(value: unknown, min = 1): boolean {
  return stripHtml(value).length >= min
}

function hasItems(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
  return false
}

/**
 * Sections considérées comme « à compléter » d'après le brouillon seul (pas d'appel API).
 * Une section absente de la carte n'a pas d'indicateur.
 */
export function computeEditorSectionCompletion(
  draft: RawListingBundle | null | undefined,
): Partial<Record<EditorSectionId, boolean>> {
  if (!draft) return {}

  const core = (draft.core ?? {}) as Record<string, unknown>
  const medias = (draft.medias ?? {}) as Record<string, unknown>
  const bookings = (draft.bookings ?? {}) as Record<string, unknown>
  const arrival = (draft.arrival ?? {}) as Record<string, unknown>
  const practical = (arrival.practical ?? {}) as Record<string, unknown>
  const access = (practical.access ?? {}) as Record<string, unknown>
  const intro = (arrival.intro ?? {}) as Record<string, unknown>
  const host = (draft.host ?? {}) as Record<string, unknown>
  const isHub = core.kind === 'hub'

  const completion: Partial<Record<EditorSectionId, boolean>> = {
    title: hasText(core.title, 3),
    gallery: hasItems(medias.images),
    description: hasText(core.description, 20),
  }

  if (isHub) return completion

  completion.capacity = Number(core.guest_capacity ?? 0) > 0
  completion.rooms = hasItems(core.rooms)
  completion.amenities = hasItems(core.amenities)
  completion.location = hasText(core.city) && (hasText(core.precise_address) || typeof core.latitude === 'number')
  completion.pricingBase = Number(bookings.price ?? 0) > 0
  completion.arrivalIntro = hasText(intro.title)
  completion.access = hasText(access.checkIn) && hasText(access.checkOut)
  completion.rules = hasText(practical.rules)
  completion.legal = host.legalStatus === 'individual' || host.legalStatus === 'professional'

  return completion
}
