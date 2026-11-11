// File: src/views/Editor/components/EditorSidebar/editorSections.ts

import type { InjectionKey } from 'vue'

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
      { id: 'description', label: sectionLabels.description, listingOnly: true },
      // Les logements d'une page principale sont son contenu : ils se voient dès « Essentiel ».
      { id: 'hubChildren', label: sectionLabels.hubChildren, hubOnly: true },
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
  }

  if (isHub) return completion

  completion.description = hasText(core.description, 20)

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

// ---------------------------------------------------------------------------------------------
// Sections repliables : chaque section est une ligne (nom + résumé) qui s'ouvre sur son panneau.

/** Ce que la barre latérale met à disposition de chaque `EditorSection`. */
export type EditorSectionsContext = {
  isOpen: (sectionId: EditorSectionId) => boolean
  toggle: (sectionId: EditorSectionId) => void
  labelOf: (sectionId: EditorSectionId) => string
  summaryOf: (sectionId: EditorSectionId) => string
  isTodo: (sectionId: EditorSectionId) => boolean
}

export const EDITOR_SECTIONS_KEY: InjectionKey<EditorSectionsContext> = Symbol('editor-sections')

/** Place de l'annonce parmi les autres : sa page principale, ou les logements qu'elle présente. */
export type EditorListingContext = {
  /** Page principale à laquelle ce logement est rattaché. */
  parentId?: string | null
  parentTitle?: string | null
  /** Logements rattachés à cette page principale. */
  childrenCount?: number
}

export function findEditorSectionLabel(sectionId: EditorSectionId): string {
  for (const group of EDITOR_GROUPS) {
    const section = group.sections.find((candidate) => candidate.id === sectionId)
    if (section) return section.label
  }
  return ''
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function amount(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function count(total: number, one: string, many: string): string {
  return `${total} ${total > 1 ? many : one}`
}

function clip(text: string, max = 64): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

function filled(value: unknown): boolean {
  if (typeof value === 'string') return hasText(value)
  return Object.values(record(value)).some((item) => hasText(item))
}

const STATUS_SUMMARY: Record<string, string> = {
  published: 'En ligne',
  blocked: 'En ligne, réservations bloquées',
  paused: 'En pause',
  draft: 'Brouillon, pas encore en ligne',
}

/**
 * Résumé d'une ligne de chaque section, d'après le brouillon seul (pas d'appel API). Il s'affiche
 * sous le nom de la section repliée : l'hôte voit l'état de son annonce sans rien ouvrir.
 */
export function computeEditorSectionSummaries(
  draft: RawListingBundle | null | undefined,
  context: EditorListingContext = {},
): Partial<Record<EditorSectionId, string>> {
  if (!draft) return {}

  const core = record(draft.core)
  const medias = record(draft.medias)
  const bookings = record(draft.bookings)
  const pricing = record(bookings.pricing)
  const arrival = record(draft.arrival)
  const practical = record(arrival.practical)
  const access = record(practical.access)
  const host = record(draft.host)

  const images = list(medias.images).length
  const videos = list(medias.videos).length
  const description = stripHtml(core.description)
  const capacity = amount(core.guest_capacity)
  const rooms = list(core.rooms)
  const beds = rooms.reduce<number>((total, room) => (
    total + list(record(room).beds).reduce<number>((sum, bed) => sum + (amount(record(bed).quantity) || 1), 0)
  ), 0)
  const amenities = list(core.amenities).length
  const place = [core.city, core.region].filter((part) => hasText(part)).map((part) => String(part).trim()).join(', ')

  const price = amount(bookings.price)
  const stay = record(pricing.stay)
  const minNights = amount(stay.minNights) || 1
  const tiers = list(stay.durationDiscounts).length
  const fees = list(bookings.fees)
    .map((fee) => record(fee))
    .filter((fee) => amount(fee.amount) > 0)
    .map((fee) => `${String(fee.name ?? fee.label ?? 'Frais').trim()} ${euros.format(amount(fee.amount))}`)
  const payment = record(pricing.payment)
  const methods = record(payment.methods)
  const methodLabels = [
    methods.card !== false ? 'Carte' : '',
    methods.sepa ? 'Virement' : '',
    methods.cash ? 'Espèces' : '',
  ].filter(Boolean)
  const depositPercent = amount(payment.depositPercent)
  const deposit = amount(record(pricing.deposit).amount)

  const reviews = record(core['reviews-display'])
  const reviewSources = [
    reviews.indiehost !== false ? 'IndieHost' : '',
    reviews.airbnb !== false ? 'Airbnb' : '',
    reviews.booking !== false ? 'Booking' : '',
  ].filter(Boolean)

  const checkIn = hasText(access.checkIn) ? String(access.checkIn).trim() : ''
  const checkOut = hasText(access.checkOut) ? String(access.checkOut).trim() : ''
  const status = typeof core.status === 'string' ? core.status.trim().toLowerCase() : 'draft'
  const optional = (isFilled: boolean) => (isFilled ? 'Renseigné' : 'Facultatif')

  return {
    title: hasText(core.title) ? clip(String(core.title).trim()) : 'Sans titre pour le moment',
    gallery: images
      ? [count(images, 'photo', 'photos'), videos ? count(videos, 'vidéo', 'vidéos') : ''].filter(Boolean).join(' · ')
      : 'Aucune photo',
    description: description ? clip(description, 72) : 'Pas encore de description',
    hubChildren: context.childrenCount
      ? count(context.childrenCount, 'logement présenté', 'logements présentés')
      : 'Aucun logement rattaché pour le moment',
    capacity: capacity ? count(capacity, 'voyageur', 'voyageurs') : 'Nombre de voyageurs à indiquer',
    rooms: rooms.length
      ? [count(rooms.length, 'pièce', 'pièces'), beds ? count(beds, 'lit', 'lits') : ''].filter(Boolean).join(' · ')
      : 'Aucune pièce',
    amenities: amenities ? count(amenities, 'équipement', 'équipements') : 'Aucun équipement',
    location: place || (hasText(core.precise_address) ? clip(String(core.precise_address).trim()) : 'Adresse à indiquer'),

    pricingBase: price
      ? [`${euros.format(price)} par nuit`, record(pricing.weekend).enabled ? 'tarif week-end' : ''].filter(Boolean).join(' · ')
      : 'Prix par nuit à indiquer',
    stay: [
      `${count(minNights, 'nuit', 'nuits')} minimum`,
      tiers ? count(tiers, 'palier de réduction', 'paliers de réduction') : '',
    ].filter(Boolean).join(' · '),
    fees: fees.length ? clip(fees.join(' · '), 72) : 'Aucun frais',
    taxes: record(pricing.taxes).enabled ? 'Taxe de séjour activée' : 'Taxe de séjour non appliquée',
    payment: [
      methodLabels.join(', '),
      payment.mode === 'deposit' ? `acompte${depositPercent ? ` de ${depositPercent} %` : ''}` : 'paiement intégral',
    ].filter(Boolean).join(' · '),
    deposit: deposit ? `Caution de ${euros.format(deposit)}` : 'Aucune caution',
    cancellation: record(pricing.cancellation).refundsEnabled ? 'Remboursement selon vos conditions' : 'Non remboursable',
    summary: 'Le prix d’un séjour type',

    arrivalIntro: hasText(record(arrival.intro).title) ? clip(String(record(arrival.intro).title).trim()) : 'Message de bienvenue à écrire',
    savings: optional(filled(practical.savings)),
    access: checkIn && checkOut ? `Arrivée ${checkIn} · départ ${checkOut}` : 'Heures d’arrivée et de départ à indiquer',
    services: optional(filled(practical.services)),
    rules: hasText(practical.rules) ? 'Renseigné' : 'Règlement intérieur à écrire',
    shops: optional(hasText(practical.shops)),
    guide: optional(filled(arrival.guide)),

    subdomain: 'Adresse gratuite en .indiehost.fr',
    customDomain: 'Votre propre nom de domaine',
    parent: context.parentTitle ? `Présenté sur « ${clip(context.parentTitle, 40)} »` : 'Logement indépendant',

    visibility: STATUS_SUMMARY[status] ?? STATUS_SUMMARY.draft,
    legal: host.legalStatus === 'professional'
      ? 'Professionnel'
      : host.legalStatus === 'individual' ? 'Particulier' : 'Particulier ou professionnel ?',
    reviews: reviewSources.length ? reviewSources.join(', ') : 'Aucun avis affiché',
    calendar: 'Calendriers Airbnb, Booking et autres',
    import: 'Reprendre une annonce Airbnb ou Booking',
  }
}
