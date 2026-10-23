<!-- File: src/views/ListingGuide/_ListingGuide.vue -->

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ShapesBgCroped from '@/components/svgs/images/ShapesBgCroped.vue'
import {
  fetchGuideConversation,
  fetchReservationGuideAccess,
  sendGuideConversationMessage,
  type GuideConversationMessagePayload,
  type ReservationGuideAccessPayload,
} from '@/domain/api/bookings'
import {
  fetchGuideReviewStatus,
  GuideReviewError,
  submitGuideReview,
  type GuideReviewStatus,
} from '@/domain/api/listingReviews'
import { toUtcDay } from '@/domain/listings/bookings'
import { getListingsController } from '@/domain/listings/controller'
import { isListingIdLike, normalizeListingSlug } from '@/domain/listings/slug'
import type { RawArrival, RawBookingReservation, RawBookings, RawComments, RawCore, RawHost } from '@/domain/listings/types'
import { vp } from '@/utils/viewport'
import { sanitizeHtml } from '@/utils/sanitizeHtml'
import { loadArrival, loadBookings, loadComments, loadCore, loadHost } from '@/views/Listing/utils/fetchListingRaw'
import LegalLinksCompact from '@/components/layouts/LegalLinksCompact.vue'

type PracticalKey = keyof RawArrival['practical']
type PracticalTextKey = 'savings' | 'access' | 'services'
type PracticalFieldsEntry = {
  key: PracticalKey
  title: string
  subtitle: string
  emoji: string
  type: 'fields'
  fields: Array<{ label: string; value: string }>
}
type PracticalHtmlEntry = {
  key: PracticalKey
  title: string
  subtitle: string
  emoji: string
  type: 'html'
  html: string
}
type PracticalSectionEntry = PracticalFieldsEntry | PracticalHtmlEntry

const DAY_MS = 24 * 60 * 60 * 1000

const PRACTICAL_TITLE = 'Informations pratiques'
const PRACTICAL_DESCRIPTION = 'Des informations claires et rapides pour un séjour sans stress.'
const PRACTICAL_ORDER: PracticalKey[] = [
  'savings',
  'access',
  'services',
  'rules',
  'shops',
]

const PRACTICAL_FIELDS: Record<PracticalTextKey, Array<{ key: string; label: string }>> = {
  savings: [
    { key: 'message', label: 'Avantage principal' },
  ],
  access: [
    { key: 'address', label: 'Adresse' },
    { key: 'checkIn', label: 'Check-in' },
    { key: 'checkOut', label: 'Check-out' },
    { key: 'parking', label: 'Parking' },
  ],
  services: [
    { key: 'wifi', label: 'Wi-Fi' },
    { key: 'contacts', label: 'Numéros utiles' },
    { key: 'assistance', label: 'Assistance hôte' },
  ],
}

const PRACTICAL_META: Record<PracticalKey, { title: string; subtitle: string; emoji: string; type: 'fields' | 'html' }> = {
  savings: {
    title: 'Économisez sur vos voyages',
    subtitle: 'Bonnes pratiques pour réserver en direct.',
    emoji: '💡',
    type: 'fields',
  },
  access: {
    title: 'Adresse & accès',
    subtitle: 'Tout ce qu’il faut pour arriver sereinement.',
    emoji: '📍',
    type: 'fields',
  },
  services: {
    title: 'Connexion & services',
    subtitle: 'Infos Wi-Fi, contacts utiles et assistance.',
    emoji: '📶',
    type: 'fields',
  },
  rules: {
    title: 'Règles du séjour',
    subtitle: 'Rappels essentiels pour un séjour harmonieux.',
    emoji: '📝',
    type: 'html',
  },
  shops: {
    title: 'Commerces & marchés',
    subtitle: 'Où se ravitailler et découvrir les producteurs.',
    emoji: '🛍️',
    type: 'html',
  },
}

const route = useRoute()
const listingsController = getListingsController()
const listingKey = computed(() => {
  const id = route.params.id
  if (typeof id === 'string' && id.trim()) return id.trim()
  if (Array.isArray(id) && id[0]?.trim()) return id[0].trim()
  return 'default-listing'
})

function isReservationGuideKey(value: string): boolean {
  return /^rg\.[a-zA-Z0-9_-]+\.[a-f0-9]{20}$/.test(value.trim())
}

const rawArrival = ref<RawArrival | null>(null)
const rawCore = ref<RawCore | null>(null)
const rawHost = ref<RawHost | null>(null)
const rawBookings = ref<RawBookings | null>(null)
const rawComments = ref<RawComments | null>(null)
const guideAccess = ref<ReservationGuideAccessPayload | null>(null)
const writableListingId = ref('')
const isLoading = ref(false)
const isSubmittingComment = ref(false)
const commentErrorMessage = ref('')
const commentSuccessMessage = ref('')
// Statut de l'avis côté API (clé de guide) : avis déjà déposé pour cette réservation, date d'ouverture.
const guideReviewStatus = ref<GuideReviewStatus | null>(null)
const isConversationLoading = ref(false)
const isConversationSending = ref(false)
const conversationErrorMessage = ref('')
const conversationDraft = ref('')
const guideConversationMessages = ref<GuideConversationMessagePayload[]>([])
const commentForm = reactive({
  name: '',
  note: 5,
  comment: '',
  arrivalDate: '',
})

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function readRouteString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value) && value.length) {
    const first = value[0]
    return typeof first === 'string' ? first.trim() : ''
  }
  return ''
}

function hasRichTextContent(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return (
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim().length > 0
  )
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null

  const utc = toUtcDay(trimmed)
  if (utc === null) return null

  const normalized = new Date(utc).toISOString().slice(0, 10)
  return normalized === trimmed ? normalized : null
}

function addUtcDays(isoDate: string, days: number): string | null {
  const utc = toUtcDay(isoDate)
  if (utc === null) return null
  return new Date(utc + Math.round(days) * DAY_MS).toISOString().slice(0, 10)
}

function toUtcTodayMs(referenceDate = new Date()): number {
  return Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
}

function clampNote(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 5
  return Math.min(5, Math.max(1, Math.round(parsed)))
}

function formatDateFr(isoDate: string | null): string {
  if (!isoDate) return ''
  const utc = toUtcDay(isoDate)
  if (utc === null) return ''

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(utc))
}

function formatDateTimeFr(isoDateTime: string): string {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return ''

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(parsed)
}

function formatConversationDateTimeFr(isoDateTime: string): string {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return ''

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function resolveGuideActiveAfterFromArrivalISO(arrivalISO: string | null): string {
  if (!arrivalISO) return ''
  const arrivalMs = toUtcDay(arrivalISO)
  if (arrivalMs === null) return ''
  return new Date(arrivalMs - (48 * 60 * 60 * 1000)).toISOString()
}

function pickQueryValue(keys: string[]): string {
  for (const key of keys) {
    const value = readRouteString(route.query[key])
    if (value) return value
  }

  return ''
}

function buildDefaultArrival(core?: Partial<RawCore> | null, host?: Partial<RawHost> | null): RawArrival {
  const preciseAddress = cleanText(core?.precise_address)
  const city = cleanText(core?.city)
  const region = cleanText(core?.region)
  const country = cleanText(core?.country)
  const hostName = cleanText(host?.name)
  const locationLabel = [
    city,
    region,
    country,
  ]
    .filter(Boolean)
    .join(', ')
  const marketLabel = city ? `Marché de ${city}` : 'Marché local'

  return {
    intro: {
      title: hostName ? `Bienvenue chez ${hostName}` : 'Bienvenue',
      subtitle: city ? `Pour profiter des lieux au maximum, voici votre guide d’arrivée à ${city}.` : 'Pour profiter des lieux au maximum, voici votre guide d’arrivée.',
      tagline: 'Propulsé par IndieHost',
    },
    practical: {
      savings: {
        message: city ? `Réservez en direct pour profiter pleinement de votre séjour à ${city}.` : 'Réservez en direct pour éviter les commissions.',
      },
      access: {
        address: preciseAddress || (locationLabel ? `${locationLabel} (adresse complète envoyée 24h avant l’arrivée).` : 'Adresse complète envoyée 24h avant l’arrivée.'),
        checkIn: 'À partir de 16h — arrivée autonome possible.',
        checkOut: 'Avant 11h — merci de laisser les clés au point indiqué.',
        parking: 'Gratuit sur place (1 à 2 véhicules).',
      },
      services: {
        wifi: 'Nom du réseau et mot de passe disponibles sur place.',
        contacts: 'Urgences 112 · Médecin 15 · Police 17.',
        assistance: hostName ? `${hostName} reste disponible de 9h à 21h par message.` : 'Assistance hôte disponible de 9h à 21h par message.',
      },
      rules: `
        <ul>
          <li><strong>Respect de la nature</strong> — merci de ne rien laisser sur place et de trier vos déchets.</li>
          <li><strong>Silence</strong> — après 22h, merci de préserver la quiétude des lieux.</li>
          <li><strong>Départ</strong> — laissez le logement dans l’état trouvé et fermez bien.</li>
        </ul>
      `,
      shops: `
        <ul>
          <li><strong>Épicerie</strong> — à 10 minutes en voiture (produits frais et locaux).</li>
          <li><strong>${marketLabel}</strong> — horaires à vérifier selon la saison.</li>
        </ul>
      `,
    },
    guide: {
      title: '',
      content: '',
    },
  }
}

function mergeArrival(base: RawArrival, override?: Partial<RawArrival> | null): RawArrival {
  if (!override) return base

  const mergeDeep = (target: any, source: any): any => {
    if (source === null || source === undefined) return source
    if (Array.isArray(source)) return source
    if (typeof source !== 'object') return source

    const baseValue = target && typeof target === 'object' && !Array.isArray(target) ? target : {}
    const merged: Record<string, any> = { ...baseValue }

    Object.entries(source as Record<string, any>).forEach(
      ([
        key,
        value,
      ]) => {
        if (Array.isArray(value) || value === null || typeof value !== 'object') {
          merged[key] = value
        } else {
          merged[key] = mergeDeep(baseValue[key], value)
        }
      },
    )

    return merged
  }

  return mergeDeep(base, override) as RawArrival
}

async function resolveWritableListingId(key: string): Promise<string> {
  const normalizedKey = key.trim()
  if (!normalizedKey) return 'default-listing'

  const normalizedSlug = normalizeListingSlug(normalizedKey)
  if (normalizedSlug) {
    const resolvedFromSlug = await listingsController.resolveListingIdBySlug(normalizedSlug)
    if (resolvedFromSlug) return resolvedFromSlug
  }

  if (isListingIdLike(normalizedKey)) return normalizedKey

  return normalizedKey
}

const arrivalContent = computed(() => {
  const merged = mergeArrival(buildDefaultArrival(rawCore.value, rawHost.value), rawArrival.value)
  const forcedAddress = cleanText(rawCore.value?.precise_address)
  if (!forcedAddress) return merged

  return {
    ...merged,
    practical: {
      ...(merged.practical ?? {}),
      access: {
        ...(merged.practical?.access ?? {}),
        address: forcedAddress,
      },
    },
  }
})

const reservations = computed<RawBookingReservation[]>(() => {
  const value = rawBookings.value?.reservations
  return Array.isArray(value) ? value : []
})

const queryReservationId = computed(() =>
  guideAccess.value?.reservation.id
  || pickQueryValue([
    'reservationId',
    'reservation',
    'bookingId',
    'booking',
  ]),
)

const queryArrivalISO = computed(() =>
  normalizeIsoDate(guideAccess.value?.reservation.startISO)
  ?? normalizeIsoDate(
    pickQueryValue([
      'arrival',
      'arrivalDate',
      'start',
      'checkIn',
      'checkin',
    ]),
  ),
)

const queryDepartureISO = computed(() =>
  normalizeIsoDate(guideAccess.value?.reservation.endISO)
  ?? normalizeIsoDate(
    pickQueryValue([
      'departure',
      'departureDate',
      'end',
      'checkOut',
      'checkout',
    ]),
  ),
)

const queryGuestName = computed(() =>
  cleanText(guideAccess.value?.reservation.guestName)
  || pickQueryValue([
    'guestName',
    'travelerName',
    'voyageur',
    'name',
  ]),
)

const matchedReservation = computed<RawBookingReservation | null>(() => {
  const list = reservations.value
  if (!list.length) return null

  const byId = queryReservationId.value
  if (byId) {
    const reservationById = list.find((reservation) => cleanText(reservation.id) === byId)
    if (reservationById) return reservationById
  }

  const byArrival = queryArrivalISO.value
  const byDeparture = queryDepartureISO.value

  if (byArrival && byDeparture) {
    const exactMatch = list.find((reservation) => {
      return normalizeIsoDate(reservation.start) === byArrival && normalizeIsoDate(reservation.end) === byDeparture
    })
    if (exactMatch) return exactMatch
  }

  if (byArrival) {
    const startMatch = list.find((reservation) => normalizeIsoDate(reservation.start) === byArrival)
    if (startMatch) return startMatch
  }

  const todayMs = toUtcTodayMs()
  const activeReservation = list.find((reservation) => {
    const startMs = toUtcDay(reservation.start)
    const endMs = toUtcDay(reservation.end)
    if (startMs === null || endMs === null) return false
    return startMs <= todayMs && todayMs <= endMs
  })

  if (activeReservation) return activeReservation

  if (list.length === 1) return list[0]

  return null
})

const reservationArrivalISO = computed(() => normalizeIsoDate(matchedReservation.value?.start))
const autoArrivalISO = computed(() => reservationArrivalISO.value ?? queryArrivalISO.value)
const stayArrivalISO = computed(() => autoArrivalISO.value ?? normalizeIsoDate(commentForm.arrivalDate))
const localGuideActiveAfterISO = computed(() => {
  if (!isReservationGuideKey(listingKey.value)) return ''
  return resolveGuideActiveAfterFromArrivalISO(reservationArrivalISO.value ?? queryArrivalISO.value)
})
const isGuideLocked = computed(() => {
  const status = guideAccess.value?.status
  if (status === 'locked') return true
  if (status === 'active') return false

  const activeAfterISO = localGuideActiveAfterISO.value
  if (!activeAfterISO) return false

  const activeAfterMs = Date.parse(activeAfterISO)
  if (Number.isNaN(activeAfterMs)) return false
  return Date.now() < activeAfterMs
})
const lockedActivationLabel = computed(() => {
  const activationISO = guideAccess.value?.activeAfterISO || localGuideActiveAfterISO.value
  if (!activationISO) return ''
  return formatDateTimeFr(activationISO)
})
const guideConversationId = computed(() => cleanText(guideAccess.value?.messaging?.conversationId))
const canUseGuideConversation = computed(() =>
  isReservationGuideKey(listingKey.value)
  && !isGuideLocked.value
  && Boolean(guideConversationId.value),
)
const hasGuideConversationMessages = computed(() => guideConversationMessages.value.length > 0)
const firstNightUnlockISO = computed(() => {
  const arrivalISO = stayArrivalISO.value
  if (!arrivalISO) return null
  return addUtcDays(arrivalISO, 1)
})

// Seul le voyageur muni de sa clé de guide peut déposer un avis (route API protégée par cette clé).
const hasReviewAccess = computed(() => isReservationGuideKey(listingKey.value))
const existingReview = computed(() => guideReviewStatus.value?.review ?? null)
const hasExistingReview = computed(() => Boolean(existingReview.value))

const canSubmitComment = computed(() => {
  if (!hasReviewAccess.value || hasExistingReview.value) return false
  if (guideReviewStatus.value) return guideReviewStatus.value.canReview

  const unlockISO = firstNightUnlockISO.value
  if (!unlockISO) return false

  const unlockMs = toUtcDay(unlockISO)
  if (unlockMs === null) return false

  return toUtcTodayMs() >= unlockMs
})

const commentAvailabilityMessage = computed(() => {
  if (!hasReviewAccess.value) {
    return 'Pour laisser un avis, ouvrez le guide depuis le lien reçu avec votre confirmation de réservation.'
  }

  if (hasExistingReview.value) {
    return 'Vous avez déjà laissé un avis pour ce séjour. Merci !'
  }

  if (!stayArrivalISO.value) {
    return 'Indiquez votre date d’arrivée pour déverrouiller l’ajout d’un avis après la première nuit.'
  }

  if (canSubmitComment.value) {
    return 'Vous pouvez laisser votre avis dès maintenant.'
  }

  const unlockLabel = formatDateFr(firstNightUnlockISO.value)
  return unlockLabel ? `Vous pourrez laisser votre avis à partir du ${unlockLabel}, après votre première nuit sur place.` : 'Vous pourrez laisser votre avis après votre première nuit sur place.'
})

const existingReviewDateLabel = computed(() => {
  const createdAt = existingReview.value?.createdAt
  if (!createdAt) return ''
  const createdMs = Date.parse(createdAt)
  if (Number.isNaN(createdMs)) return ''
  return formatDateFr(new Date(createdMs).toISOString().slice(0, 10))
})

const practicalSections = computed<PracticalSectionEntry[]>(() => {
  return PRACTICAL_ORDER.map((key) => {
    const meta = PRACTICAL_META[key]
    if (meta.type === 'fields') {
      const fields = PRACTICAL_FIELDS[key as PracticalTextKey] ?? []
      const values = (arrivalContent.value.practical?.[key] ?? {}) as Record<string, string>

      return {
        key,
        title: meta.title,
        subtitle: meta.subtitle,
        emoji: meta.emoji,
        type: 'fields',
        fields: fields.map((field) => ({
          label: field.label,
          value: values[field.key] ?? '',
        })),
      }
    }

    return {
      key,
      title: meta.title,
      subtitle: meta.subtitle,
      emoji: meta.emoji,
      type: 'html',
      html: (arrivalContent.value.practical?.[key] ?? '') as string,
    }
  })
})

const hasGuideContent = computed(() => hasRichTextContent(arrivalContent.value.guide?.content ?? ''))
const hasGuideSection = computed(() => Boolean(cleanText(arrivalContent.value.guide?.title ?? '') || hasGuideContent.value))
const guideSectionTitle = computed(() => cleanText(arrivalContent.value.guide?.title ?? '') || 'Guide touristique')
const isDesktop = computed(() => vp.xl.value)

watch(
  autoArrivalISO,
  (value) => {
    if (value) {
      commentForm.arrivalDate = value
    }
  },
  { immediate: true },
)

watch(
  () => [
    queryGuestName.value,
    matchedReservation.value?.guestName ?? '',
  ],
  ([
    preferredName,
    fallbackName,
  ]) => {
    const candidate = cleanText(preferredName) || cleanText(fallbackName)
    if (!candidate) return
    if (commentForm.name.trim()) return
    commentForm.name = candidate
  },
  { immediate: true },
)

async function loadGuideConversationThread() {
  conversationErrorMessage.value = ''

  if (!canUseGuideConversation.value) {
    guideConversationMessages.value = []
    return
  }

  isConversationLoading.value = true
  try {
    const response = await fetchGuideConversation({
      guideKey: listingKey.value,
    })
    guideConversationMessages.value = response.messages
  } catch (error) {
    console.error('[ListingGuide] load guide conversation failed', error)
    conversationErrorMessage.value = 'Impossible de charger la messagerie pour le moment.'
    guideConversationMessages.value = []
  } finally {
    isConversationLoading.value = false
  }
}

async function submitGuideConversationMessage() {
  conversationErrorMessage.value = ''

  if (!canUseGuideConversation.value) return

  const body = cleanText(conversationDraft.value)
  if (!body) return

  isConversationSending.value = true
  try {
    const response = await sendGuideConversationMessage({
      guideKey: listingKey.value,
      body,
    })
    guideConversationMessages.value = response.messages
    conversationDraft.value = ''
  } catch (error) {
    console.error('[ListingGuide] send guide conversation message failed', error)
    conversationErrorMessage.value = 'Impossible d envoyer votre message pour le moment.'
  } finally {
    isConversationSending.value = false
  }
}

async function loadGuideReviewStatus() {
  if (!hasReviewAccess.value) {
    guideReviewStatus.value = null
    return
  }

  try {
    guideReviewStatus.value = await fetchGuideReviewStatus({ guideKey: listingKey.value })
  } catch (error) {
    // Sans statut, le formulaire se rabat sur la règle locale (première nuit) ; l'API tranche à l'envoi.
    console.warn('[ListingGuide] load guide review status failed', error)
    guideReviewStatus.value = null
  }
}

async function submitTravelerComment() {
  commentErrorMessage.value = ''
  commentSuccessMessage.value = ''

  if (!hasReviewAccess.value || hasExistingReview.value) {
    commentErrorMessage.value = commentAvailabilityMessage.value
    return
  }

  if (!stayArrivalISO.value) {
    commentErrorMessage.value = 'La date d’arrivée est nécessaire pour vérifier la première nuit.'
    return
  }

  if (!canSubmitComment.value) {
    commentErrorMessage.value = commentAvailabilityMessage.value
    return
  }

  const author = cleanText(commentForm.name)
  if (author.length < 2) {
    commentErrorMessage.value = 'Ajoutez votre prénom ou un nom (2 caractères minimum).'
    return
  }

  const body = cleanText(commentForm.comment)
  if (body.length < 10) {
    commentErrorMessage.value = 'Ajoutez un avis un peu plus détaillé (10 caractères minimum).'
    return
  }

  isSubmittingComment.value = true
  try {
    const review = await submitGuideReview({
      guideKey: listingKey.value,
      rating: clampNote(commentForm.note),
      text: body,
      author,
    })

    guideReviewStatus.value = {
      reservationId: review.reservationId,
      listingId: guideReviewStatus.value?.listingId ?? writableListingId.value,
      availableFromISO: guideReviewStatus.value?.availableFromISO ?? '',
      canReview: false,
      review,
    }
    commentForm.comment = ''
    commentForm.note = 5
    commentSuccessMessage.value = 'Merci, votre avis a bien été ajouté.'
  } catch (error) {
    console.error('[ListingGuide] submit traveler review failed', error)

    if (error instanceof GuideReviewError && error.code === 'REVIEW_ALREADY_EXISTS') {
      // Un avis existe déjà pour cette réservation : on recharge le statut pour l'afficher et masquer le formulaire.
      await loadGuideReviewStatus()
      commentErrorMessage.value = 'Vous avez déjà laissé un avis pour ce séjour.'
      return
    }

    if (error instanceof GuideReviewError && error.code === 'REVIEW_LOCKED') {
      commentErrorMessage.value = 'Vous pourrez laisser votre avis après votre première nuit sur place.'
      return
    }

    if (error instanceof GuideReviewError && error.code === 'RATE_LIMITED') {
      commentErrorMessage.value = 'Trop de tentatives. Réessayez dans quelques minutes.'
      return
    }

    if (error instanceof GuideReviewError && error.code === 'INVALID_GUIDE_KEY') {
      commentErrorMessage.value = 'Ce lien de guide n’est plus valide. Ouvrez le guide depuis votre confirmation de réservation.'
      return
    }

    commentErrorMessage.value = 'Impossible d’enregistrer votre avis pour le moment. Réessayez dans quelques instants.'
  } finally {
    isSubmittingComment.value = false
  }
}

function buildGuideReservation(access: ReservationGuideAccessPayload): RawBookingReservation {
  return {
    id: access.reservation.id,
    guestName: access.reservation.guestName,
    start: access.reservation.startISO,
    end: access.reservation.endISO,
    nights: access.reservation.nights,
    message: '',
    guests: {
      adults: 1,
      children: 0,
      infants: 0,
      pets: 0,
      pmr: 0,
    },
    payment: {
      total: 0,
      deposit: 0,
      balance: 0,
      status: 'pending',
      method: 'Carte',
    },
  } as RawBookingReservation
}

watch(
  listingKey,
  async () => {
    isLoading.value = true
    commentErrorMessage.value = ''
    commentSuccessMessage.value = ''
    conversationErrorMessage.value = ''
    conversationDraft.value = ''
    guideConversationMessages.value = []
    guideAccess.value = null
    guideReviewStatus.value = null

    try {
      const currentKey = listingKey.value.trim()
      let listingLookupKey = currentKey

      if (isReservationGuideKey(currentKey)) {
        try {
          const access = await fetchReservationGuideAccess({
            guideKey: currentKey,
          })
          guideAccess.value = access
          listingLookupKey = access.listing.id || currentKey
          writableListingId.value = access.listing.id

          if (access.status === 'locked') {
            rawArrival.value = null
            rawCore.value = {
              id: access.listing.id,
            } as RawCore
            rawHost.value = {
              name: access.host.name,
              status: access.host.status ?? '',
              seniority: 0,
              'global-note': 0,
              avatar: access.host.avatar ?? '',
              'catalog-link': '',
            } as RawHost
            rawBookings.value = {
              price: 0,
              fees: [],
              reservations: [buildGuideReservation(access)],
              'booked-days': [],
              'external-booked-days': [],
            } as RawBookings
            rawComments.value = {
              comments: [],
            } as RawComments
            guideConversationMessages.value = []
            return
          }
        } catch (guideAccessError) {
          const listingIdFromQuery = readRouteString(route.query.listingId)
          if (!listingIdFromQuery) {
            throw guideAccessError
          }

          listingLookupKey = listingIdFromQuery
          writableListingId.value = listingIdFromQuery
        }
      }

      const [
        arrival,
        core,
        host,
        bookings,
        comments,
        resolvedListingId,
      ] = await Promise.all([
        loadArrival(listingLookupKey),
        loadCore(listingLookupKey),
        loadHost(listingLookupKey),
        loadBookings(listingLookupKey),
        loadComments(listingLookupKey),
        resolveWritableListingId(listingLookupKey),
      ])

      // L'annonce publique ne contient ni le guide complet ni les réservations : le voyageur les reçoit avec sa clé.
      const activeAccess = guideAccess.value?.status === 'active' ? guideAccess.value : null
      rawArrival.value = (activeAccess?.arrival as RawArrival | null | undefined) ?? arrival
      rawCore.value = core
      rawHost.value = host
      rawBookings.value = activeAccess
        ? { ...bookings, reservations: [buildGuideReservation(activeAccess)] } as RawBookings
        : bookings
      rawComments.value = comments
      writableListingId.value = resolvedListingId
      await Promise.all([
        loadGuideConversationThread(),
        loadGuideReviewStatus(),
      ])
    } catch (error) {
      console.warn('[ListingGuide] failed to resolve guide', error)
      commentErrorMessage.value = 'Impossible de charger le guide pour cette réservation.'
      conversationErrorMessage.value = ''
      rawArrival.value = null
      rawCore.value = null
      rawHost.value = null
      rawBookings.value = null
      rawComments.value = null
      guideConversationMessages.value = []
      writableListingId.value = ''
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true },
)

watch(
  () => [
    guideConversationId.value,
    isGuideLocked.value,
  ],
  async () => {
    if (!canUseGuideConversation.value) {
      guideConversationMessages.value = []
      return
    }

    await loadGuideConversationThread()
  },
)
</script>

<template>
  <main
    id="listing-guide"
    class="listing-guide"
  >
    <template v-if="isDesktop">
      <div class="guide-desktop">
        <h1>Guide d’arrivée mobile</h1>
        <p>Cette page est optimisée pour une consultation mobile.</p>
      </div>
    </template>

    <template v-else>
      <section
        v-if="isGuideLocked"
        class="guide-locked"
      >
        <h1>Guide bientôt disponible</h1>
        <p>Ce guide d’accueil devient accessible 48h avant votre arrivée.</p>
        <p v-if="lockedActivationLabel">Activation prévue: {{ lockedActivationLabel }}</p>
      </section>

      <section
        v-if="!isGuideLocked"
        class="guide-hero"
      >
        <ShapesBgCroped
          class="shapes-bg"
          title="Décoration du fond"
          desc="Formes géométriques décoratives"
        />
        <div class="hero-content">
          <p class="hero-eyebrow">{{ arrivalContent.intro.title }}</p>
          <h1 class="hero-title">{{ arrivalContent.intro.subtitle }}</h1>
          <p class="hero-tagline">{{ arrivalContent.intro.tagline }}</p>
        </div>
      </section>

      <section
        v-if="!isGuideLocked"
        class="guide-body"
      >
        <div class="section-header">
          <h2>{{ PRACTICAL_TITLE }}</h2>
          <p>{{ PRACTICAL_DESCRIPTION }}</p>
        </div>

        <div class="section-grid">
          <article
            v-for="entry in practicalSections"
            :key="entry.key"
            class="guide-panel"
          >
            <div class="panel-header">
              <span
                v-if="entry.emoji"
                class="panel-emoji"
                >{{ entry.emoji }}</span
              >
              <div>
                <h3>{{ entry.title }}</h3>
                <p v-if="entry.subtitle">{{ entry.subtitle }}</p>
              </div>
            </div>
            <template v-if="entry.type === 'fields'">
              <ul class="panel-items">
                <li
                  v-for="field in entry.fields"
                  :key="field.label"
                >
                  <span class="item-label">{{ field.label }}</span>
                  <span
                    v-if="field.value"
                    class="item-value"
                    >{{ field.value }}</span
                  >
                  <span
                    v-else
                    class="item-value is-empty"
                    >Informations à venir.</span
                  >
                </li>
              </ul>
            </template>
            <template v-else>
              <div
                v-if="entry.html"
                class="panel-html"
                v-html="sanitizeHtml(entry.html)"
              />
              <p
                v-else
                class="panel-text is-empty"
                >Informations à venir.</p
              >
            </template>
          </article>
        </div>

        <template v-if="hasGuideSection">
          <div class="section-header is-local">
            <h2>{{ guideSectionTitle }}</h2>
            <p>L’inspiration de votre hôte pour découvrir les environs.</p>
          </div>

          <article class="guide-panel guide-panel--editorial">
            <div
              v-if="hasGuideContent"
              class="panel-editorial"
              v-html="sanitizeHtml(arrivalContent.guide.content)"
            />
            <p
              v-else
              class="panel-text is-empty"
              >Informations à venir.</p
            >
          </article>
        </template>

        <template v-if="isReservationGuideKey(listingKey)">
          <div class="section-header is-local">
            <h2>Messagerie hôte</h2>
            <p>Échangez directement avec votre hôte depuis ce guide.</p>
          </div>

          <article class="guide-panel guide-panel--messaging">
            <p
              v-if="isConversationLoading"
              class="panel-text"
            >
              Chargement de la conversation...
            </p>
            <p
              v-else-if="conversationErrorMessage"
              class="comment-feedback is-error"
            >
              {{ conversationErrorMessage }}
            </p>
            <p
              v-else-if="!canUseGuideConversation"
              class="panel-text is-empty"
            >
              Messagerie indisponible pour ce guide.
            </p>
            <p
              v-else-if="!hasGuideConversationMessages"
              class="panel-text is-empty"
            >
              Aucun message pour le moment. Envoyez le premier message à votre hôte.
            </p>

            <ul
              v-if="canUseGuideConversation && hasGuideConversationMessages"
              class="guide-messaging-list"
            >
              <li
                v-for="message in guideConversationMessages"
                :key="message.id"
                :class="[
                  'guide-messaging-item',
                  message.author === 'host' ? 'is-host' : 'is-guest',
                ]"
              >
                <p class="body">{{ message.body }}</p>
                <p class="meta">
                  {{ message.author === 'host' ? 'Hôte' : 'Vous' }} · {{ formatConversationDateTimeFr(message.sentAt) }}
                </p>
              </li>
            </ul>

            <form
              v-if="canUseGuideConversation"
              class="comment-form"
              @submit.prevent="submitGuideConversationMessage"
            >
              <label class="comment-field">
                <span>Nouveau message</span>
                <textarea
                  v-model="conversationDraft"
                  rows="3"
                  maxlength="1200"
                  placeholder="Écrivez votre message à l’hôte…"
                  required
                />
              </label>

              <button
                type="submit"
                class="comment-submit"
                :disabled="isConversationSending || !conversationDraft.trim()"
              >
                {{ isConversationSending ? 'Envoi...' : 'Envoyer' }}
              </button>
            </form>
          </article>
        </template>

        <div class="section-header is-local">
          <h2>Votre avis</h2>
          <p>Partagez votre expérience directement depuis ce guide d’accueil.</p>
        </div>

        <article class="guide-panel guide-panel--comment">
          <p
            class="comment-availability"
            :class="{ 'is-unlocked': canSubmitComment || hasExistingReview, 'is-locked': !canSubmitComment && !hasExistingReview }"
            aria-live="polite"
          >
            {{ commentAvailabilityMessage }}
          </p>

          <div
            v-if="existingReview"
            class="guide-review-existing"
          >
            <p class="guide-review-existing__meta">
              <strong>{{ existingReview.author || 'Vous' }}</strong>
              · {{ existingReview.rating }} / 5<template v-if="existingReviewDateLabel"> · {{ existingReviewDateLabel }}</template>
            </p>
            <p class="guide-review-existing__text">{{ existingReview.text }}</p>
          </div>

          <form
            v-else-if="hasReviewAccess"
            class="comment-form"
            @submit.prevent="submitTravelerComment"
          >
            <label
              v-if="!autoArrivalISO"
              class="comment-field"
            >
              <span>Date d’arrivée</span>
              <input
                v-model="commentForm.arrivalDate"
                type="date"
                required
              />
            </label>

            <label class="comment-field">
              <span>Votre nom</span>
              <input
                v-model="commentForm.name"
                type="text"
                autocomplete="name"
                placeholder="Ex. Camille"
                minlength="2"
                maxlength="60"
                required
              />
            </label>

            <label class="comment-field">
              <span>Note</span>
              <select v-model.number="commentForm.note">
                <option :value="5">5 / 5</option>
                <option :value="4">4 / 5</option>
                <option :value="3">3 / 5</option>
                <option :value="2">2 / 5</option>
                <option :value="1">1 / 5</option>
              </select>
            </label>

            <label class="comment-field">
              <span>Votre avis</span>
              <textarea
                v-model="commentForm.comment"
                rows="4"
                minlength="10"
                maxlength="2000"
                placeholder="Décrivez votre expérience sur place…"
                required
              />
            </label>

            <button
              type="submit"
              class="comment-submit"
              :disabled="isSubmittingComment || !canSubmitComment"
              :aria-busy="isSubmittingComment"
            >
              {{ isSubmittingComment ? 'Envoi…' : 'Publier mon avis' }}
            </button>

            <p
              v-if="commentErrorMessage"
              class="comment-feedback is-error"
              role="alert"
            >
              {{ commentErrorMessage }}
            </p>
          </form>

          <p
            v-if="commentSuccessMessage"
            class="comment-feedback is-success"
            aria-live="polite"
          >
            {{ commentSuccessMessage }}
          </p>

          <p
            v-if="!hasReviewAccess && commentErrorMessage"
            class="comment-feedback is-error"
            role="alert"
          >
            {{ commentErrorMessage }}
          </p>
        </article>
      </section>

      <div
        v-if="isLoading"
        class="guide-loading"
      >
        Chargement…
      </div>
    </template>

    <LegalLinksCompact />
  </main>
</template>

<style lang="scss">
@use '@/views/ListingGuide/listing-guide.scss';
</style>
