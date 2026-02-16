<!-- File: src/components/navs/HostReservationOverlay.vue -->

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Minus, Plus, X } from 'lucide-vue-next'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { makeIsDateDisabled } from '@/components/DatePicker/utils/range'
import DatePicker from '@/components/DatePicker/DatePicker.vue'
import RelativeOverlay from '@/components/overlays/RelativeOverlay.vue'
import { getListingsController } from '@/domain/listings/controller'
import { deriveBookedDaysFromReservations, getSynchronizedBookedDays, nightsBetween, normalizeBookedDay, normalizeBookedDays, normalizeReservations } from '@/domain/listings/bookings'
import { computeNightlyPriceBreakdown, resolveWeekendPricing } from '@/domain/listings/pricing'
import type { RawBookingReservation, RawBookings, UserListingCard } from '@/domain/listings/types'

import { type OccupantCounts } from '@/views/ListingView/components/Booking/utils/labels'
import { findNextRange, isSelectedRangeValid } from '@/views/ListingView/components/Booking/utils/range'

const props = withDefaults(
  defineProps<{
    open: boolean
    anchor: HTMLElement | HTMLElement[] | null
    bookedRanges?: RangeISO[]
  }>(),
  {
    bookedRanges: () => [],
  },
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: ReservationDraft): void
}>()

const route = useRoute()
const controller = getListingsController()

type OccupantKey = keyof OccupantCounts

type ReservationDraft = {
  listingId: string | null
  startISO: string | null
  endISO: string | null
  nights: number
  occupants: OccupantCounts
  notes: string
  contact: {
    firstName: string
    lastName: string
    phone: string
    email: string
  }
}

const listings = ref<UserListingCard[]>([])
const selectedListingId = ref<string | null>(null)
const bookingsByListingId = reactive<Record<string, RangeISO[]>>({})
const listingsStatus = reactive({
  isLoading: false,
  error: null as string | null,
})
const submitStatus = reactive({
  isSaving: false,
  error: null as string | null,
})

const form = reactive({
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  notes: '',
})

const passwordManagerIgnoreAttrs = {
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
  'data-np-ignore': 'true',
} as const

const selection = ref<RangeISO | null>(null)

const occupants = reactive<OccupantCounts>({
  adults: 1,
  children: 0,
  babies: 0,
  animals: 0,
  pmr: 0,
})

const activeUserId = computed(() => {
  const value = route.params.userId
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
})

const bookedRanges = computed<RangeISO[]>(() => {
  const listingId = selectedListingId.value
  if (listingId && Object.prototype.hasOwnProperty.call(bookingsByListingId, listingId)) {
    return bookingsByListingId[listingId] ?? []
  }
  return props.bookedRanges ?? []
})
const isDateDisabled = computed(() => makeIsDateDisabled(bookedRanges.value))

const nights = computed(() => {
  if (!selection.value?.start || !selection.value?.end) return 0
  return nightsBetween(selection.value.start, selection.value.end)
})

const MIN_NIGHTS = 2
const MIN_NIGHTS_ERROR = `Le sejour doit etre d'au moins ${MIN_NIGHTS} nuits.`

const canSubmit = computed(() => {
  if (submitStatus.isSaving) return false
  if (!selectedListingId.value) return false
  if (!selection.value?.start || !selection.value?.end) return false
  if (nights.value < MIN_NIGHTS) return false
  return isSelectedRangeValid(selection.value, nights.value, isDateDisabled.value)
})

function normalizeRange(range: RangeISO | null): RangeISO | null {
  if (!range?.start || !range?.end) return null
  const normalized = normalizeBookedDay(range)
  if (!normalized) return null
  return { start: normalized.start, end: normalized.end }
}

function setSelection(range: RangeISO | null) {
  if (range?.start === selection.value?.start && range?.end === selection.value?.end) return
  selection.value = range
}

const initialRange = findNextRange(MIN_NIGHTS, isDateDisabled.value)
if (!selection.value && initialRange) {
  setSelection(initialRange)
}

watch(bookedRanges, () => {
  if (!selection.value || !isSelectedRangeValid(selection.value, nights.value, isDateDisabled.value)) {
    setSelection(findNextRange(MIN_NIGHTS, isDateDisabled.value))
  }
})

watch(
  () => selection.value,
  (val) => {
    if (val?.start && val?.end) {
      if (!isSelectedRangeValid(selection.value, nights.value, isDateDisabled.value)) {
        setSelection(findNextRange(MIN_NIGHTS, isDateDisabled.value))
        return
      }
    }
  },
  { deep: true },
)

function updateCount(key: OccupantKey, delta: number) {
  const next = occupants[key] + delta
  const min = key === 'adults' ? 1 : 0
  occupants[key] = Math.max(min, next)
}

function sumFees(bookings?: Partial<RawBookings> | null) {
  const fees = bookings?.fees ?? []
  return fees.reduce((acc, fee) => acc + (Number(fee.amount ?? 0) || 0), 0)
}

function computeStayTotals(range: RangeISO, bookings?: Partial<RawBookings> | null) {
  const basePrice = Number(bookings?.price ?? 0) || 0
  const weekendPricing = resolveWeekendPricing(bookings?.pricing ?? null, basePrice)
  const nightly = computeNightlyPriceBreakdown({
    startISO: range.start,
    endISO: range.end,
    basePrice,
    weekendPricing,
  })

  return {
    nights: Math.max(1, nightly.nights),
    total: Math.max(0, Math.round(nightly.nightlyTotal + sumFees(bookings))),
  }
}

function sanitizeIdPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

function createReservationId(listingId: string, start: string, end: string) {
  const base = sanitizeIdPart(listingId.trim() || 'listing')
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)
  return `reservation-${base}-${start}-${end}-${suffix}`
}

function normalizeText(value: string) {
  return value.trim()
}

function buildGuestName() {
  const firstName = normalizeText(form.firstName)
  const lastName = normalizeText(form.lastName)
  const fullName = `${firstName} ${lastName}`.trim()
  if (fullName) return fullName

  const email = normalizeText(form.email)
  if (email.includes('@')) return email.split('@')[0] || 'Voyageur'
  if (email) return email

  return 'Voyageur'
}

function resolveDepositAmount(total: number, bookings?: Partial<RawBookings> | null) {
  const rawType = bookings?.pricing?.deposit?.type
  const type = typeof rawType === 'string' ? rawType.toLowerCase() : ''
  const rawAmount = Number(bookings?.pricing?.deposit?.amount)

  if (Number.isFinite(rawAmount) && rawAmount >= 0) {
    if (type.includes('percent') || type.includes('pourcent') || type.includes('%')) {
      const percent = Math.max(0, Math.min(100, rawAmount))
      return Math.round((total * percent) / 100)
    }

    return Math.round(Math.max(0, Math.min(total, rawAmount)))
  }

  return Math.round(total * 0.3)
}

function buildLegacyReservationFromRange(listingId: string, range: RangeISO, bookings?: Partial<RawBookings> | null) {
  const stay = computeStayTotals(range, bookings)
  const deposit = resolveDepositAmount(stay.total, bookings)
  const balance = Math.max(0, stay.total - deposit)

  return normalizeReservations([
    {
      id: `legacy-${sanitizeIdPart(listingId)}-${range.start}-${range.end}`,
      start: range.start,
      end: range.end,
      nights: stay.nights,
      guestName: 'Voyageur',
      message: '',
      guests: {
        adults: 1,
        children: 0,
        infants: 0,
        pets: 0,
        pmr: 0,
      },
      payment: {
        total: stay.total,
        deposit,
        balance,
        status: 'pending',
        method: 'Carte',
      },
    },
  ])[0]
}

function mergeReservationsWithBookedDays(listingId: string, bookings?: Partial<RawBookings> | null) {
  const reservations = normalizeReservations(bookings?.reservations)
  const ranges = normalizeBookedDays(bookings?.['booked-days'])
  const knownRanges = new Set(reservations.map((reservation) => `${reservation.start}__${reservation.end}`))
  const merged = [
    ...reservations,
  ]

  for (const range of ranges) {
    const key = `${range.start}__${range.end}`
    if (knownRanges.has(key)) continue
    const legacyReservation = buildLegacyReservationFromRange(listingId, range, bookings)
    if (!legacyReservation) continue
    merged.push(legacyReservation)
    knownRanges.add(key)
  }

  return normalizeReservations(merged)
}

function buildReservationFromForm(listingId: string, range: RangeISO, bookings?: Partial<RawBookings> | null): RawBookingReservation {
  const stay = computeStayTotals(range, bookings)
  const total = stay.total
  const deposit = resolveDepositAmount(total, bookings)
  const balance = Math.max(0, total - deposit)

  const firstName = normalizeText(form.firstName)
  const lastName = normalizeText(form.lastName)
  const phone = normalizeText(form.phone)
  const email = normalizeText(form.email)
  const contact = {
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
  }

  const [
    reservation,
  ] = normalizeReservations([
    {
      id: createReservationId(listingId, range.start, range.end),
      start: range.start,
      end: range.end,
      nights: stay.nights,
      guestName: buildGuestName(),
      message: normalizeText(form.notes),
      guests: {
        adults: occupants.adults,
        children: occupants.children,
        infants: occupants.babies,
        pets: occupants.animals,
        pmr: occupants.pmr,
      },
      payment: {
        total,
        deposit,
        balance,
        status: 'pending',
        method: 'Carte',
      },
      ...(Object.keys(contact).length ? { contact } : {}),
      createdAt: new Date().toISOString(),
    },
  ])

  if (!reservation) {
    throw new Error('Reservation payload normalization failed')
  }

  return reservation
}

async function submit() {
  const listingId = selectedListingId.value
  const normalizedSelection = normalizeRange(selection.value)
  submitStatus.error = null

  if (!listingId) {
    submitStatus.error = 'Selectionnez une annonce.'
    return
  }

  if (!normalizedSelection || nights.value <= 0) {
    submitStatus.error = 'Selection de dates invalide.'
    return
  }

  if (nights.value < MIN_NIGHTS) {
    submitStatus.error = MIN_NIGHTS_ERROR
    return
  }

  if (!isSelectedRangeValid(normalizedSelection, nights.value, isDateDisabled.value)) {
    submitStatus.error = 'Cette periode est deja indisponible.'
    return
  }

  submitStatus.isSaving = true

  try {
    const editable = await controller.fetchEditableListingBundle(listingId)
    const currentBookings = (editable.bookings ?? null) as Partial<RawBookings> | null
    const currentReservations = mergeReservationsWithBookedDays(listingId, currentBookings)
    const currentBookedDays = deriveBookedDaysFromReservations(currentReservations)
    const isDateDisabledFresh = makeIsDateDisabled(currentBookedDays)

    if (!isSelectedRangeValid(normalizedSelection, nights.value, isDateDisabledFresh)) {
      bookingsByListingId[listingId] = currentBookedDays
      setSelection(findNextRange(MIN_NIGHTS, isDateDisabledFresh))
      submitStatus.error = 'Cette periode vient d etre reservee.'
      return
    }

    const createdReservation = buildReservationFromForm(listingId, normalizedSelection, currentBookings)
    const nextReservations = normalizeReservations([
      ...currentReservations,
      createdReservation,
    ])
    const nextBookedDays = deriveBookedDaysFromReservations(nextReservations)

    const bookingsPatch: Partial<RawBookings> = {
      ...(currentBookings ?? {}),
      reservations: nextReservations,
      'booked-days': nextBookedDays,
    }

    await controller.patchListingDraft(listingId, { bookings: bookingsPatch })
    bookingsByListingId[listingId] = nextBookedDays

    const payload: ReservationDraft = {
      listingId,
      startISO: normalizedSelection.start,
      endISO: normalizedSelection.end,
      nights: nights.value,
      occupants: { ...occupants },
      notes: form.notes,
      contact: {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
      },
    }

    emit('submit', payload)
    emit('close')
  } catch (error) {
    console.error('[HostReservationOverlay] create reservation failed', error)
    submitStatus.error = 'Impossible de creer la reservation.'
  } finally {
    submitStatus.isSaving = false
  }
}

async function refreshBookedRangesForListing(listingId: string) {
  if (!listingId.trim()) return

  const editable = await controller.fetchEditableListingBundle(listingId)
  const nextBookedDays = getSynchronizedBookedDays((editable.bookings ?? null) as Partial<RawBookings> | null)
  bookingsByListingId[listingId] = nextBookedDays
}

async function loadListings() {
  listingsStatus.isLoading = true
  listingsStatus.error = null

  try {
    const options = activeUserId.value ? { userId: activeUserId.value } : undefined
    let fetched = await controller.fetchListings(options)

    if (!fetched.length && options?.userId) {
      fetched = await controller.fetchListings()
    }

    listings.value = fetched

    if (!selectedListingId.value || !fetched.some((listing) => listing.listingId === selectedListingId.value)) {
      selectedListingId.value = fetched[0]?.listingId ?? null
    }

    if (selectedListingId.value) {
      await refreshBookedRangesForListing(selectedListingId.value)
    }
  } catch (error) {
    console.error('[HostReservationOverlay] load listings failed', error)
    listingsStatus.error = 'Impossible de charger les annonces.'
    listings.value = []
    selectedListingId.value = null
  } finally {
    listingsStatus.isLoading = false
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      submitStatus.error = null
      return
    }

    await loadListings()
  },
)

watch(activeUserId, () => {
  void loadListings()
})

watch(selectedListingId, (listingId) => {
  submitStatus.error = null
  if (!listingId?.trim()) return
  if (Object.prototype.hasOwnProperty.call(bookingsByListingId, listingId)) return
  void refreshBookedRangesForListing(listingId)
})

onMounted(() => {
  void loadListings()
})
</script>

<template>
  <RelativeOverlay
    id="host-reservation-overlay"
    class="host-reservation-overlay"
    :open="props.open"
    :anchor="props.anchor"
    placement="bottom-center"
    :offset="12"
    :viewport-padding="12"
    :z-index="10001"
    :trap-focus="true"
    role="dialog"
    aria-label="Nouvelle r&eacute;servation"
    @close="emit('close')"
  >
    <div class="panel">
      <div class="header">
        <h3>Nouvelle r&eacute;servation</h3>
        <button
          type="button"
          class="close"
          aria-label="Fermer"
          @click="emit('close')"
        >
          <X :size="20" />
        </button>
      </div>

      <div class="fields">
        <label class="field">
          <select
            v-model="selectedListingId"
            :disabled="listingsStatus.isLoading || !listings.length"
            aria-label="Annonce"
          >
            <option
              value=""
              disabled
            >
              Choisir une annonce
            </option>
            <option
              v-for="listing in listings"
              :key="listing.listingId"
              :value="listing.listingId"
            >
              {{ listing.title }}
            </option>
          </select>
        </label>
        <label class="field">
          <input
            v-model="form.firstName"
            type="text"
            placeholder="Pr&eacute;nom"
            autocomplete="given-name"
            v-bind="passwordManagerIgnoreAttrs"
          />
        </label>
        <label class="field">
          <input
            v-model="form.lastName"
            type="text"
            placeholder="Nom"
            autocomplete="family-name"
            v-bind="passwordManagerIgnoreAttrs"
          />
        </label>
        <label class="field">
          <input
            v-model="form.phone"
            type="tel"
            placeholder="Num&eacute;ro de t&eacute;l"
            autocomplete="tel"
            v-bind="passwordManagerIgnoreAttrs"
          />
        </label>
        <label class="field">
          <input
            v-model="form.email"
            type="email"
            placeholder="Adresse e-mail"
            autocomplete="email"
            v-bind="passwordManagerIgnoreAttrs"
          />
        </label>
        <label class="field">
          <textarea
            v-model="form.notes"
            rows="3"
            placeholder="Informations additionnelles"
            v-bind="passwordManagerIgnoreAttrs"
          />
        </label>
      </div>

      <section class="section">
        <h4>Dur&eacute;e du s&eacute;jour</h4>
        <div class="listing-checkout-dates is-inline">
          <div class="calendar">
            <DatePicker
              v-model:model-value="selection"
              :disabled-dates="bookedRanges"
              :numberOfMonths="2"
            />
          </div>
        </div>
      </section>

      <section class="section">
        <h4>Nombre de voyageurs</h4>
        <div class="listing-checkout-guests is-inline">
          <div class="dropdown">
            <div class="item">
              <div>
                <p>Adultes</p>
                <small>13 ans et plus</small>
              </div>
              <div class="counter">
                <button
                  type="button"
                  aria-label="Retirer un adulte"
                  :disabled="occupants.adults <= 1"
                  @click="updateCount('adults', -1)"
                >
                  <Minus :size="20" />
                </button>
                <span>{{ occupants.adults }}</span>
                <button
                  type="button"
                  aria-label="Ajouter un adulte"
                  @click="updateCount('adults', 1)"
                >
                  <Plus :size="20" />
                </button>
              </div>
            </div>

            <div class="item">
              <div>
                <p>Enfants</p>
                <small>2 &agrave; 12 ans</small>
              </div>
              <div class="counter">
                <button
                  type="button"
                  aria-label="Retirer un enfant"
                  :disabled="occupants.children <= 0"
                  @click="updateCount('children', -1)"
                >
                  <Minus :size="20" />
                </button>
                <span>{{ occupants.children }}</span>
                <button
                  type="button"
                  aria-label="Ajouter un enfant"
                  @click="updateCount('children', 1)"
                >
                  <Plus :size="20" />
                </button>
              </div>
            </div>

            <div class="item">
              <div>
                <p>B&eacute;b&eacute;s</p>
                <small>Moins de 2 ans</small>
              </div>
              <div class="counter">
                <button
                  type="button"
                  aria-label="Retirer un b&eacute;b&eacute;"
                  :disabled="occupants.babies <= 0"
                  @click="updateCount('babies', -1)"
                >
                  <Minus :size="20" />
                </button>
                <span>{{ occupants.babies }}</span>
                <button
                  type="button"
                  aria-label="Ajouter un b&eacute;b&eacute;"
                  @click="updateCount('babies', 1)"
                >
                  <Plus :size="20" />
                </button>
              </div>
            </div>

            <div class="item">
              <div>
                <p>Animaux</p>
                <small>Chien, chat...</small>
              </div>
              <div class="counter">
                <button
                  type="button"
                  aria-label="Retirer un animal"
                  :disabled="occupants.animals <= 0"
                  @click="updateCount('animals', -1)"
                >
                  <Minus :size="20" />
                </button>
                <span>{{ occupants.animals }}</span>
                <button
                  type="button"
                  aria-label="Ajouter un animal"
                  @click="updateCount('animals', 1)"
                >
                  <Plus :size="20" />
                </button>
              </div>
            </div>

            <div class="item">
              <div>
                <p>Personnes PMR</p>
                <small>Besoin d'am&eacute;nagement</small>
              </div>
              <div class="counter">
                <button
                  type="button"
                  aria-label="Retirer une personne PMR"
                  :disabled="occupants.pmr <= 0"
                  @click="updateCount('pmr', -1)"
                >
                  <Minus :size="20" />
                </button>
                <span>{{ occupants.pmr }}</span>
                <button
                  type="button"
                  aria-label="Ajouter une personne PMR"
                  @click="updateCount('pmr', 1)"
                >
                  <Plus :size="20" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="actions">
        <p
          v-if="submitStatus.error"
          class="status error"
        >
          {{ submitStatus.error }}
        </p>
        <div class="btn-primary__black__full">
          <button
            type="button"
            :disabled="!canSubmit"
            @click="submit"
          >
            {{ submitStatus.isSaving ? 'Ajout en cours...' : 'Ajouter une r&eacute;servation' }}
          </button>
        </div>
      </div>
    </div>
  </RelativeOverlay>
</template>

<style lang="scss">
@use '@/components/navs/host-reservation-overlay.scss';
</style>
