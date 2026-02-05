<!-- File: src/views/Management/_Management.vue -->

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ArrowUpRight, Calendar, Plus } from 'lucide-vue-next'

import DatePicker from '@/components/DatePicker/DatePicker.vue'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import type { EditorMode, EditorSource } from '@/views/Editor/types/editor'
import type { UserListingCard } from '@/views/Editor/utils/listingApi'
import type { RawComments } from '@/views/Listing/utils/fetchListingRaw'
import type { Reservation } from '@/views/Management/utils/managementReservations'
import ManagementListings from '@/views/Management/components/ManagementListings.vue'
import ManagementReservationSlider from '@/views/Management/components/ManagementReservationSlider.vue'
import { buildReservationsForListing, findLatestReservation, findLatestReservationForListing } from '@/views/Management/utils/managementReservations'

const props = defineProps<{
  mode: EditorMode
  source: EditorSource
}>()

type ManagementStage = 'reservations' | 'calendar'

const stage = ref<ManagementStage>('reservations')
const selectedListingId = ref<string | null>(null)
const selectedReservationId = ref<string | null>(null)

const listings = ref<UserListingCard[]>([])
const listingsStatus = reactive({
  isLoading: false,
  error: null as unknown,
})

const reservationsStatus = reactive({
  isLoading: false,
  error: null as unknown,
})

const reservationsByListingId = reactive<Record<string, Reservation[]>>({})

const selectedListing = computed(() => listings.value.find((listing) => listing.listingId === selectedListingId.value) ?? null)

const reservationsForListing = computed(() => {
  if (!selectedListingId.value) return []
  return reservationsByListingId[selectedListingId.value] ?? []
})

const stayRange = computed<RangeISO | null>(() => {
  const reservation = selectedReservation.value
  if (!reservation) return null
  return { start: reservation.start, end: reservation.end }
})

const stayMonthsCount = computed(() => {
  const range = stayRange.value
  if (!range) return 1

  const [
    startYear,
    startMonth,
  ] = range.start.split('-').map(Number)
  const [
    endYear,
    endMonth,
  ] = range.end.split('-').map(Number)
  if (!startYear || !startMonth || !endYear || !endMonth) return 1

  const diff = (endYear - startYear) * 12 + (endMonth - startMonth)
  return Math.max(1, diff + 1)
})

const selectedReservation = computed(() => {
  const items = reservationsForListing.value
  if (!items.length) return null
  if (selectedReservationId.value) {
    const match = items.find((reservation) => reservation.id === selectedReservationId.value)
    if (match) return match
  }
  return items[0] ?? null
})

const latestReservationByListingId = computed(() => {
  const map: Record<string, Reservation | null> = {}
  for (const listing of listings.value) {
    map[listing.listingId] = findLatestReservationForListing(reservationsByListingId[listing.listingId] ?? [])
  }
  return map
})

function resetReservationsMap() {
  for (const key of Object.keys(reservationsByListingId)) {
    delete reservationsByListingId[key]
  }
}

async function loadListings() {
  listingsStatus.isLoading = true
  listingsStatus.error = null

  try {
    listings.value = await props.source.fetchListings()
  } catch (err) {
    listingsStatus.error = err
    listings.value = []
  } finally {
    listingsStatus.isLoading = false
  }
}

async function loadReservations(sourceListings: UserListingCard[]) {
  reservationsStatus.isLoading = true
  reservationsStatus.error = null

  const results = await Promise.allSettled(
    sourceListings.map(async (listing) => {
      const volatile = await props.source.fetchVolatileListingBundle(listing.listingId)
      const reservations = buildReservationsForListing({
        listing,
        bookings: volatile.bookings ?? null,
        comments: (volatile.comments ?? null) as RawComments | null,
      })
      reservationsByListingId[listing.listingId] = reservations
    }),
  )

  const failed = results.find((result) => result.status === 'rejected')
  if (failed && failed.status === 'rejected') {
    reservationsStatus.error = failed.reason
  }

  reservationsStatus.isLoading = false
}

function selectDefaultReservation() {
  const latest = findLatestReservation(reservationsByListingId)
  if (latest) {
    selectedListingId.value = latest.listingId
    selectedReservationId.value = latest.reservation.id
    stage.value = 'reservations'
    return
  }

  if (listings.value.length) {
    selectedListingId.value = listings.value[0].listingId
    selectedReservationId.value = reservationsByListingId[selectedListingId.value]?.[0]?.id ?? null
    stage.value = 'reservations'
  }
}

async function bootstrap() {
  await loadListings()
  resetReservationsMap()
  await loadReservations(listings.value)
  selectDefaultReservation()
}

function handleSelectListing(listingId: string) {
  if (!listingId.trim()) return
  selectedListingId.value = listingId
  const fallback = reservationsByListingId[listingId]?.[0] ?? null
  selectedReservationId.value = fallback?.id ?? null
  stage.value = 'reservations'
}

function handleSelectReservation(reservationId: string) {
  selectedReservationId.value = reservationId
  stage.value = 'reservations'
}

function toggleCalendarMode() {
  stage.value = stage.value === 'calendar' ? 'reservations' : 'calendar'
}

watch(
  () => props.source,
  () => {
    selectedListingId.value = null
    selectedReservationId.value = null
    stage.value = 'reservations'
    listings.value = []
    resetReservationsMap()
    void bootstrap()
  },
  { immediate: true },
)

watch(reservationsForListing, (items) => {
  if (!items.length) {
    selectedReservationId.value = null
    return
  }

  if (!selectedReservationId.value || !items.some((reservation) => reservation.id === selectedReservationId.value)) {
    selectedReservationId.value = items[0].id
  }
})

function formatCurrency(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso?: string) {
  if (!iso) return ''
  const [
    year,
    month,
    day,
  ] = iso.split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatDateRange(start?: string, end?: string) {
  if (!start || !end) return ''
  return `du ${formatDate(start)} au ${formatDate(end)}`
}

const guestLines = computed(() => {
  const guests = selectedReservation.value?.guests
  if (!guests) return []
  const lines: string[] = []

  if (guests.adults) lines.push(`${guests.adults} adulte${guests.adults > 1 ? 's' : ''}`)
  if (guests.children) lines.push(`${guests.children} enfant${guests.children > 1 ? 's' : ''}`)
  if (guests.infants) lines.push(`${guests.infants} b\u00e9b\u00e9${guests.infants > 1 ? 's' : ''}`)
  if (guests.pets) lines.push(`${guests.pets} animal${guests.pets > 1 ? 's' : ''}`)

  return lines
})

const totalGuests = computed(() => {
  const guests = selectedReservation.value?.guests
  if (!guests) return 0
  return guests.adults + guests.children + guests.infants + guests.pets
})

const guestLabel = computed(() => (totalGuests.value > 1 ? 'voyageurs' : 'voyageur'))

const paymentStatusLabel = computed(() => {
  const status = selectedReservation.value?.payment.status
  if (status === 'paid') return 'Pay\u00e9'
  if (status === 'pending') return 'En attente'
  return ''
})

const paymentStatusClass = computed(() => {
  const status = selectedReservation.value?.payment.status
  if (status === 'paid') return 'is-paid'
  if (status === 'pending') return 'is-pending'
  return ''
})
</script>

<template>
  <main
    id="management-page"
    class="management"
  >
    <div class="layout">
      <aside class="panel-left">
        <ManagementListings
          :listings="listings"
          :isLoading="listingsStatus.isLoading"
          :error="listingsStatus.error"
          :selectedListingId="selectedListingId"
          :latestReservationByListingId="latestReservationByListingId"
          @select="handleSelectListing"
        />
      </aside>

      <section class="stage">
        <div class="content">
          <div class="reservation-toolbar">
            <div
              class="icon-btn calendar"
              :class="{ 'is-active': stage === 'calendar' }"
            >
              <button
                type="button"
                aria-label="Basculer vers le calendrier"
                @click="toggleCalendarMode"
              >
                <Calendar :size="18" />
              </button>
            </div>

            <ManagementReservationSlider
              :reservations="reservationsForListing"
              :activeReservationId="selectedReservationId"
              @select="handleSelectReservation"
            />

            <div class="icon-btn add">
              <button
                type="button"
                aria-label="Ajouter une r&eacute;servation"
              >
                <Plus :size="18" />
              </button>
            </div>
          </div>

          <div class="reservation-body">
            <Transition name="editor-stage">
              <div
                v-show="stage === 'reservations'"
                class="reservation-panel"
              >
                <template v-if="selectedReservation">
                  <div class="reservation-heading">
                    <div class="avatar">
                      <img
                        v-if="selectedReservation.guestAvatar"
                        :src="selectedReservation.guestAvatar"
                        :alt="selectedReservation.guestName"
                        loading="lazy"
                      />
                      <span v-else>{{ selectedReservation.guestName.slice(0, 2).toUpperCase() }}</span>
                    </div>
                    <div class="title">
                      <h2>{{ selectedReservation.guestName }}</h2>
                      <p>{{ selectedListing?.title }}</p>
                    </div>
                  </div>

                  <section class="message-card">
                    <div class="section-title">
                      <h3>Message du voyageur</h3>
                      <button
                        type="button"
                        class="reply"
                      >
                        R&eacute;pondre
                        <ArrowUpRight :size="16" />
                      </button>
                    </div>
                    <p class="message">{{ selectedReservation.message }}</p>
                  </section>

                  <section class="stay-section">
                    <h3>S&eacute;jour</h3>
                    <div class="stay-container">
                      <div class="stay-calendar">
                        <DatePicker
                          :model-value="stayRange"
                          :number-of-months="stayMonthsCount"
                          :read-only="true"
                          :restrict-to-future="false"
                        />
                      </div>
                      <div class="stay-cards">
                        <div>
                          <div class="value">{{ selectedReservation.nights }}</div>
                          <div class="label">nuits</div>
                          <div class="meta">{{ formatDateRange(selectedReservation.start, selectedReservation.end) }}</div>
                        </div>
                        <div>
                          <div class="value">{{ totalGuests }}</div>
                          <div class="label">{{ guestLabel }}</div>
                          <ul class="guest-list">
                            <li
                              v-for="line in guestLines"
                              :key="line"
                            >
                              {{ line }}
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section class="schedule-section">
                    <h3>&Eacute;ch&eacute;ancier</h3>
                    <p class="subtitle">Paiement en {{ selectedReservation.payment.method.toLowerCase() }}</p>
                    <div class="schedule-card">
                      <div class="summary">
                        <div>
                          <p class="label">Paiement</p>
                          <p class="value">{{ formatCurrency(selectedReservation.payment.total) }}</p>
                        </div>
                        <span
                          class="status"
                          :class="paymentStatusClass"
                        >
                          {{ paymentStatusLabel }}
                        </span>
                      </div>
                      <div class="rows">
                        <div class="row">
                          <span>Mode de paiement</span>
                          <strong>{{ selectedReservation.payment.method }}</strong>
                        </div>
                        <div class="row">
                          <span>Acompte</span>
                          <strong>{{ formatCurrency(selectedReservation.payment.deposit) }}</strong>
                        </div>
                        <div class="row">
                          <span>Solde</span>
                          <strong>{{ formatCurrency(selectedReservation.payment.balance) }}</strong>
                        </div>
                        <div class="row">
                          <span>Date d'&eacute;mission</span>
                          <strong>{{ formatDate(selectedReservation.start) }}</strong>
                        </div>
                        <div class="row">
                          <span>Date de paiement</span>
                          <strong>{{ formatDate(selectedReservation.end) }}</strong>
                        </div>
                      </div>
                    </div>
                  </section>
                </template>

                <div
                  v-else
                  class="reservation-empty"
                >
                  S&eacute;lectionnez une r&eacute;servation pour afficher le d&eacute;tail.
                </div>
              </div>
            </Transition>

            <Transition name="editor-stage">
              <div
                v-show="stage === 'calendar'"
                class="calendar-panel"
                aria-hidden="true"
              />
            </Transition>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style lang="scss">
@use '@/views/Management/management.scss';
</style>
