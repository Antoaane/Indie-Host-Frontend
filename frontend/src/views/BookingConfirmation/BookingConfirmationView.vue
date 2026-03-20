<!-- File: src/views/BookingConfirmation/BookingConfirmationView.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { fetchBookingConfirmation, buildReservationStayIcalUrl } from '@/domain/api/bookings'
import { normalizeReservations } from '@/domain/listings/bookings'
import { getListingsController } from '@/domain/listings/controller'
import type { RawHost } from '@/domain/listings/types'

type ConfirmationViewModel = {
  reservationId: string
  listingId: string
  stay: {
    startISO: string
    endISO: string
    nights: number
    totalAmount: number
    currency: string
  }
  host: {
    name: string
    status: string | null
    avatar: string | null
    catalogLink: string | null
    phone: string | null
    email: string | null
    assistance: string | null
    contacts: string | null
  }
  guide: {
    url: string
    guideAccessKey: string
    isActive: boolean
    activeAfterISO: string
  }
}

const route = useRoute()
const listingsController = getListingsController()
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const confirmation = ref<ConfirmationViewModel | null>(null)
const localIcalBlobUrl = ref<string | null>(null)

function readRouteString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0].trim()
  }
  return ''
}

function readHostString(host: Partial<RawHost> | null | undefined, key: string): string | null {
  if (!host || typeof host !== 'object') return null
  const record = host as Record<string, unknown>
  const value = record[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function resolveAbsoluteUrl(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (typeof window === 'undefined') return trimmed
  return new URL(trimmed, window.location.origin).toString()
}

function buildGuideUrl(listingId: string, reservationId: string, guideToken: string): string {
  const params = new URLSearchParams({
    reservationId,
    listingId,
  })
  return `/listing/guide/${encodeURIComponent(guideToken)}?${params.toString()}`
}

function resolveGuideActivationFromStartISO(startISO: string): { isActive: boolean; activeAfterISO: string } {
  const startDate = new Date(`${startISO}T00:00:00.000Z`)
  if (Number.isNaN(startDate.getTime())) {
    return {
      isActive: true,
      activeAfterISO: '',
    }
  }

  const activeAfterMs = startDate.getTime() - (48 * 60 * 60 * 1000)
  const activeAfterDate = new Date(activeAfterMs)

  return {
    isActive: Date.now() >= activeAfterMs,
    activeAfterISO: activeAfterDate.toISOString(),
  }
}

function toIcsDate(value: string): string {
  return value.replace(/-/g, '')
}

function toIcsTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function buildLocalIcalContent(model: ConfirmationViewModel): string {
  const guideUrl = resolveAbsoluteUrl(model.guide.url)
  const summary = `Reservation ${model.host.name || 'IndieHost'}`
  const description = `Guide d'accueil: ${guideUrl}`

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IndieHost//Booking Stay//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(model.reservationId)}@indiehost`,
    `DTSTAMP:${toIcsTimestamp()}`,
    `DTSTART;VALUE=DATE:${toIcsDate(model.stay.startISO)}`,
    `DTEND;VALUE=DATE:${toIcsDate(model.stay.endISO)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `URL:${escapeIcs(guideUrl)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

function updateLocalIcalBlob(model: ConfirmationViewModel | null) {
  if (localIcalBlobUrl.value) {
    URL.revokeObjectURL(localIcalBlobUrl.value)
    localIcalBlobUrl.value = null
  }

  if (!model) return

  const blob = new Blob([
    buildLocalIcalContent(model),
  ], { type: 'text/calendar;charset=utf-8' })
  localIcalBlobUrl.value = URL.createObjectURL(blob)
}

function formatDateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return isoDate

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

function formatCurrency(value: number, currencyCode: string): string {
  const normalizedCurrency = (currencyCode || 'eur').toUpperCase()
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value)
  }
}

async function loadFromLocalFallback(params: {
  reservationId: string
  token: string
  listingId: string
}): Promise<ConfirmationViewModel> {
  const bundle = await listingsController.fetchVolatileListingBundle(params.listingId)
  const reservations = normalizeReservations(bundle.bookings?.reservations)
  const reservation = reservations.find((item) => item.id === params.reservationId)

  if (!reservation) {
    throw new Error('Réservation introuvable dans les données locales.')
  }

  const reservationToken =
    reservation.confirmation?.guideAccessKey
    ?? reservation.confirmation?.guideAccessToken
    ?? reservation.contact?.confirmation?.guideAccessKey
    ?? reservation.contact?.confirmation?.guideAccessToken
    ?? ''

  if (!reservationToken || reservationToken !== params.token) {
    throw new Error('Lien de confirmation invalide pour cette réservation.')
  }

  const host = (bundle.host ?? null) as Partial<RawHost> | null
  const guideUrl =
    reservation.confirmation?.guideUrl
    ?? reservation.contact?.confirmation?.guideUrl
    ?? buildGuideUrl(params.listingId, params.reservationId, params.token)

  const paymentRecord = reservation.payment?.stripe
  const currency = typeof paymentRecord?.currency === 'string' && paymentRecord.currency.trim()
    ? paymentRecord.currency.trim().toLowerCase()
    : 'eur'
  const activation = resolveGuideActivationFromStartISO(reservation.start)

  return {
    reservationId: reservation.id,
    listingId: params.listingId,
    stay: {
      startISO: reservation.start,
      endISO: reservation.end,
      nights: Math.max(1, Number(reservation.nights) || 1),
      totalAmount: Math.max(0, Math.round(Number(reservation.payment?.total ?? 0) || 0)),
      currency,
    },
    host: {
      name: readHostString(host, 'name') ?? 'Hote',
      status: readHostString(host, 'status'),
      avatar: readHostString(host, 'avatar'),
      catalogLink: readHostString(host, 'catalog-link') ?? readHostString(host, 'catalogLink'),
      phone: readHostString(host, 'phone'),
      email: readHostString(host, 'email'),
      assistance: null,
      contacts: null,
    },
    guide: {
      url: guideUrl,
      guideAccessKey: params.token,
      isActive: activation.isActive,
      activeAfterISO: activation.activeAfterISO,
    },
  }
}

async function loadConfirmation() {
  isLoading.value = true
  loadError.value = null
  confirmation.value = null

  const reservationId = readRouteString(route.params.reservationId)
  const token = readRouteString(route.query.token) || readRouteString(route.query.guideToken)
  const listingId = readRouteString(route.query.listingId)

  if (!reservationId || !token) {
    loadError.value = 'Lien de confirmation incomplet.'
    isLoading.value = false
    return
  }

  try {
    const response = await fetchBookingConfirmation({
      reservationId,
      token,
    })

    confirmation.value = {
      reservationId: response.reservationId,
      listingId: response.listingId,
      stay: response.stay,
      host: response.host,
      guide: {
        url: response.guide.url,
        guideAccessKey: response.guide.guideAccessKey,
        isActive: response.guide.isActive,
        activeAfterISO: response.guide.activeAfterISO,
      },
    }
  } catch (error) {
    if (!listingId) {
      const message = error instanceof Error ? error.message : 'Impossible de charger la confirmation.'
      loadError.value = message
      isLoading.value = false
      return
    }

    try {
      confirmation.value = await loadFromLocalFallback({
        reservationId,
        token,
        listingId,
      })
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : 'Impossible de charger la confirmation.'
      loadError.value = message
    }
  } finally {
    isLoading.value = false
  }
}

watch(
  () => [
    route.params.reservationId,
    route.query.token,
    route.query.guideToken,
    route.query.listingId,
  ],
  () => {
    void loadConfirmation()
  },
  { immediate: true },
)

watch(
  confirmation,
  (value) => {
    updateLocalIcalBlob(value)
  },
)

onBeforeUnmount(() => {
  if (localIcalBlobUrl.value) {
    URL.revokeObjectURL(localIcalBlobUrl.value)
    localIcalBlobUrl.value = null
  }
})

const guideAbsoluteUrl = computed(() => {
  if (!confirmation.value) return ''
  return resolveAbsoluteUrl(confirmation.value.guide.url)
})

const stayIcalUrl = computed(() => {
  const model = confirmation.value
  if (!model) return ''

  if (listingsController.mode === 'api') {
    return buildReservationStayIcalUrl({
      reservationId: model.reservationId,
      guideAccessKey: model.guide.guideAccessKey,
    })
  }

  return localIcalBlobUrl.value ?? ''
})

const stayLabel = computed(() => {
  const model = confirmation.value
  if (!model) return ''

  return `${formatDateLabel(model.stay.startISO)} → ${formatDateLabel(model.stay.endISO)} (${model.stay.nights} nuit${model.stay.nights > 1 ? 's' : ''})`
})

const totalLabel = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  return formatCurrency(model.stay.totalAmount, model.stay.currency)
})

const hostContactLines = computed(() => {
  const model = confirmation.value
  if (!model) return [] as string[]

  return [
    model.host.email ? `Email: ${model.host.email}` : null,
    model.host.phone ? `Téléphone: ${model.host.phone}` : null,
    model.host.assistance,
    model.host.contacts,
  ].filter((value): value is string => Boolean(value && value.trim()))
})

const isGuideActive = computed(() => {
  if (!confirmation.value) return false
  return confirmation.value.guide.isActive
})

const guideActivationLabel = computed(() => {
  const model = confirmation.value
  if (!model || !model.guide.activeAfterISO) return ''
  const parsed = new Date(model.guide.activeAfterISO)
  if (Number.isNaN(parsed.getTime())) return ''

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(parsed)
})
</script>

<template>
  <main class="booking-confirmation-page">
    <section class="confirmation-card">
      <header class="confirmation-header">
        <p class="eyebrow">Paiement confirmé</p>
        <h1>Votre réservation est validée</h1>
      </header>

      <p
        v-if="isLoading"
        class="state"
      >
        Chargement de votre confirmation...
      </p>
      <p
        v-else-if="loadError"
        class="state is-error"
      >
        {{ loadError }}
      </p>

      <template v-else-if="confirmation">
        <section class="section-block">
          <h2>Séjour</h2>
          <p>{{ stayLabel }}</p>
          <p class="amount">Montant total: {{ totalLabel }}</p>
        </section>

        <section class="section-block">
          <h2>Contact hôte</h2>
          <p>{{ confirmation.host.name }}</p>
          <p
            v-if="confirmation.host.status"
            class="muted"
          >
            {{ confirmation.host.status }}
          </p>
          <p
            v-for="line in hostContactLines"
            :key="line"
            class="muted"
          >
            {{ line }}
          </p>
        </section>

        <section class="actions">
          <a
            class="btn"
            :class="{ disabled: !isGuideActive }"
            :href="guideAbsoluteUrl"
            target="_blank"
            rel="noopener noreferrer"
            :aria-disabled="!isGuideActive"
            @click.prevent="!isGuideActive"
          >
            Ouvrir le guide d'accueil
          </a>
          <p
            v-if="!isGuideActive && guideActivationLabel"
            class="muted"
          >
            Le guide sera activé 48h avant l'arrivée: {{ guideActivationLabel }}.
          </p>

          <a
            v-if="stayIcalUrl"
            class="btn secondary"
            :href="stayIcalUrl"
            download="reservation.ics"
          >
            Exporter dans mon calendrier (iCal)
          </a>
        </section>
      </template>
    </section>
  </main>
</template>

<style scoped lang="scss">
.booking-confirmation-page {
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  padding: 56px 20px;
  background: #f6f7f9;
}

.confirmation-card {
  width: min(640px, 100%);
  background: #fff;
  border: 1px solid #e2e5ea;
  border-radius: 18px;
  padding: 28px;
  display: grid;
  gap: 20px;
}

.confirmation-header {
  display: grid;
  gap: 8px;

  > .eyebrow {
    margin: 0;
    color: #4f6b4f;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 12px;
  }

  > h1 {
    margin: 0;
    color: #101316;
    font-size: 30px;
    line-height: 1.15;
  }
}

.state {
  margin: 0;
  color: #3f4852;

  &.is-error {
    color: #a11e2f;
  }
}

.section-block {
  display: grid;
  gap: 8px;

  > h2,
  > p {
    margin: 0;
  }

  > h2 {
    font-size: 16px;
    color: #2a3138;
  }

  > .amount {
    font-weight: 700;
    color: #11161b;
  }

  > .muted {
    color: #5c6670;
  }
}

.actions {
  display: grid;
  gap: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid #1f2933;
  color: #1f2933;
  text-decoration: none;
  font-weight: 600;

  &.secondary {
    border-color: #d3d7dc;
    color: #1f2933;
    background: #f8fafc;
  }

  &.disabled {
    opacity: 0.52;
    pointer-events: none;
  }
}

@media (max-width: 640px) {
  .booking-confirmation-page {
    padding: 24px 12px;
  }

  .confirmation-card {
    padding: 20px;
    border-radius: 14px;
  }

  .confirmation-header > h1 {
    font-size: 24px;
  }
}
</style>
