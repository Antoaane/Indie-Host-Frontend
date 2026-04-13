<!-- File: src/views/BookingConfirmation/BookingConfirmationView.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { fetchBookingConfirmation, buildReservationStayIcalUrl, cancelBookingReservation } from '@/domain/api/bookings'
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
  cancellation: {
    status: 'active' | 'canceled'
    canCancel: boolean
    canceledAtISO: string | null
    reason: string | null
    policy: {
      policy: 'flexible' | 'moderate' | 'strict' | 'custom'
      days: number
      feePercent: number
      lateFeePercent: number
    }
    refund: {
      stage: 'full_refund' | 'partial_refund' | 'late_cancellation' | 'after_arrival'
      currency: string
      chargedAmount: number
      refundableAmount: number
      retainedAmount: number
      retainedPercent: number
      paymentIntentId: string | null
    }
  }
}

const route = useRoute()
const listingsController = getListingsController()
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const confirmation = ref<ConfirmationViewModel | null>(null)
const localIcalBlobUrl = ref<string | null>(null)
const isCanceling = ref(false)
const cancelError = ref<string | null>(null)
const cancelSuccess = ref<string | null>(null)

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

function normalizeIdentityToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[@\s._-]+/g, '')
    .trim()
}

function isDeprecatedHostIdentity(value: string | null | undefined): boolean {
  if (!value) return false
  const normalized = normalizeIdentityToken(value)
  return normalized === 'hote' || normalized === 'host'
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
  const hostEmail = readHostString(host, 'email') ?? ''
  const hostRawName = readHostString(host, 'name')
  const hostName = hostRawName && !isDeprecatedHostIdentity(hostRawName) ? hostRawName : null
  const hostFallbackName = hostEmail.trim()
    ? hostEmail.split('@')[0]?.trim() ?? ''
    : ''
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
      name: hostName ?? (hostFallbackName || 'Proprietaire'),
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
    cancellation: {
      status: 'active',
      canCancel: false,
      canceledAtISO: null,
      reason: null,
      policy: {
        policy: 'flexible',
        days: 3,
        feePercent: 10,
        lateFeePercent: 30,
      },
      refund: {
        stage: 'partial_refund',
        currency,
        chargedAmount: Math.max(0, Math.round(Number(reservation.payment?.deposit ?? reservation.payment?.total ?? 0) || 0)),
        refundableAmount: 0,
        retainedAmount: Math.max(0, Math.round(Number(reservation.payment?.deposit ?? reservation.payment?.total ?? 0) || 0)),
        retainedPercent: 100,
        paymentIntentId: null,
      },
    },
  }
}

async function loadConfirmation() {
  isLoading.value = true
  loadError.value = null
  cancelError.value = null
  cancelSuccess.value = null
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
      cancellation: response.cancellation,
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

const arrivalLabel = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  return formatDateLabel(model.stay.startISO)
})

const departureLabel = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  return formatDateLabel(model.stay.endISO)
})

const nightsLabel = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  return `${model.stay.nights} nuit${model.stay.nights > 1 ? 's' : ''}`
})

function buildCalendarTitle(model: ConfirmationViewModel): string {
  return `Séjour IndieHost - ${model.host.name}`
}

function buildCalendarDescription(model: ConfirmationViewModel): string {
  const guideUrl = resolveAbsoluteUrl(model.guide.url)
  const lines = [
    `Réservation du ${formatDateLabel(model.stay.startISO)} au ${formatDateLabel(model.stay.endISO)} (${model.stay.nights} nuit${model.stay.nights > 1 ? 's' : ''}).`,
    `Montant total: ${formatCurrency(model.stay.totalAmount, model.stay.currency)}.`,
    guideUrl ? `Guide d'accueil: ${guideUrl}` : null,
  ]

  return lines.filter((line): line is string => Boolean(line && line.trim())).join('\n')
}

function buildGoogleCalendarUrl(model: ConfirmationViewModel): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: buildCalendarTitle(model),
    dates: `${toIcsDate(model.stay.startISO)}/${toIcsDate(model.stay.endISO)}`,
    details: buildCalendarDescription(model),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function buildOutlookCalendarUrl(model: ConfirmationViewModel): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    startdt: model.stay.startISO,
    enddt: model.stay.endISO,
    allday: 'true',
    subject: buildCalendarTitle(model),
    body: buildCalendarDescription(model),
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

function buildYahooCalendarUrl(model: ConfirmationViewModel): string {
  const params = new URLSearchParams({
    v: '60',
    view: 'd',
    type: '20',
    title: buildCalendarTitle(model),
    st: toIcsDate(model.stay.startISO),
    et: toIcsDate(model.stay.endISO),
    desc: buildCalendarDescription(model),
  })
  return `https://calendar.yahoo.com/?${params.toString()}`
}

const googleCalendarUrl = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  return buildGoogleCalendarUrl(model)
})

const outlookCalendarUrl = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  return buildOutlookCalendarUrl(model)
})

const yahooCalendarUrl = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  return buildYahooCalendarUrl(model)
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

const cancellationPolicyLabel = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  const { policy } = model.cancellation.policy
  if (policy === 'moderate') return 'Modérée'
  if (policy === 'strict') return 'Stricte'
  if (policy === 'custom') return 'Personnalisée'
  return 'Flexible'
})

const cancellationStageLabel = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  const stage = model.cancellation.refund.stage
  if (stage === 'full_refund') return 'Remboursement intégral'
  if (stage === 'late_cancellation') return 'Annulation tardive'
  if (stage === 'after_arrival') return 'Arrivée dépassée'
  return 'Remboursement partiel'
})

const cancellationChargedLabel = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  return formatCurrency(model.cancellation.refund.chargedAmount, model.cancellation.refund.currency)
})

const cancellationRefundableLabel = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  return formatCurrency(model.cancellation.refund.refundableAmount, model.cancellation.refund.currency)
})

const cancellationRetainedLabel = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  return formatCurrency(model.cancellation.refund.retainedAmount, model.cancellation.refund.currency)
})

const cancellationSummaryLine = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  return `Annulation jusqu'à ${model.cancellation.policy.days} jour${model.cancellation.policy.days > 1 ? 's' : ''} avant arrivée: sans frais.`
})

const cancellationPenaltyLine = computed(() => {
  const model = confirmation.value
  if (!model) return ''
  return `Ensuite: retenue de ${model.cancellation.policy.feePercent}% (retenue de ${model.cancellation.policy.lateFeePercent}% sous 24h).`
})

const canTriggerCancellation = computed(() => {
  const model = confirmation.value
  if (!model) return false
  return listingsController.mode === 'api' && model.cancellation.canCancel && !isLoading.value && !isCanceling.value
})

async function cancelCurrentReservation() {
  const model = confirmation.value
  if (!model) return

  cancelError.value = null
  cancelSuccess.value = null

  if (listingsController.mode !== 'api') {
    cancelError.value = 'Annulation indisponible hors mode API.'
    return
  }

  if (!model.cancellation.canCancel) {
    cancelError.value = 'Cette réservation ne peut plus être annulée en ligne.'
    return
  }

  isCanceling.value = true
  try {
    const updated = await cancelBookingReservation({
      reservationId: model.reservationId,
      token: model.guide.guideAccessKey,
    })
    confirmation.value = {
      reservationId: updated.reservationId,
      listingId: updated.listingId,
      stay: updated.stay,
      host: updated.host,
      guide: updated.guide,
      cancellation: updated.cancellation,
    }
    cancelSuccess.value = 'Réservation annulée avec succès.'
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible d annuler la réservation.'
    cancelError.value = message
  } finally {
    isCanceling.value = false
  }
}
</script>

<template>
  <main class="booking-confirmation-page">
    <section class="confirmation-card">
      <div class="confirmation-heading">
        <p class="eyebrow">Paiement confirmé</p>
        <h1>Votre réservation est validée</h1>
        <p class="subtitle">
          Votre séjour est enregistré. Retrouvez le détail et ajoutez-le à votre calendrier.
        </p>
      </div>

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
        <section class="panel stay-panel">
          <div class="panel-head">
            <h2>Séjour</h2>
            <p class="stay-range">{{ stayLabel }}</p>
          </div>

          <dl class="stat-grid">
            <div class="stat-item">
              <dt>Arrivée</dt>
              <dd>{{ arrivalLabel }}</dd>
            </div>
            <div class="stat-item">
              <dt>Départ</dt>
              <dd>{{ departureLabel }}</dd>
            </div>
            <div class="stat-item">
              <dt>Durée</dt>
              <dd>{{ nightsLabel }}</dd>
            </div>
            <div class="stat-item is-highlight">
              <dt>Montant total</dt>
              <dd>{{ totalLabel }}</dd>
            </div>
          </dl>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Contact hôte</h2>
          </div>
          <p class="host-name">{{ confirmation.host.name }}</p>
          <p
            v-if="confirmation.host.status"
            class="muted"
          >
            {{ confirmation.host.status }}
          </p>
          <ul
            v-if="hostContactLines.length"
            class="contact-list"
          >
            <li
              v-for="line in hostContactLines"
              :key="line"
            >
              {{ line }}
            </li>
          </ul>
          <p
            v-else
            class="muted"
          >
            Les coordonnées de contact seront partagées prochainement.
          </p>
        </section>

        <section class="panel cancellation-panel">
          <div class="panel-head">
            <h2>Annulation</h2>
            <p class="stay-range">{{ cancellationPolicyLabel }}</p>
          </div>
          <p class="muted">
            {{ cancellationSummaryLine }}
          </p>
          <p class="muted">
            {{ cancellationPenaltyLine }}
          </p>

          <dl class="stat-grid cancellation-stats">
            <div class="stat-item">
              <dt>Statut</dt>
              <dd>{{ cancellationStageLabel }}</dd>
            </div>
            <div class="stat-item">
              <dt>Payé maintenant</dt>
              <dd>{{ cancellationChargedLabel }}</dd>
            </div>
            <div class="stat-item is-highlight">
              <dt>Remboursable</dt>
              <dd>{{ cancellationRefundableLabel }}</dd>
            </div>
            <div class="stat-item">
              <dt>Retenu</dt>
              <dd>{{ cancellationRetainedLabel }}</dd>
            </div>
          </dl>

          <p
            v-if="confirmation.cancellation.status === 'canceled' && confirmation.cancellation.canceledAtISO"
            class="muted"
          >
            Réservation annulée le {{ formatDateLabel(confirmation.cancellation.canceledAtISO.slice(0, 10)) }}.
          </p>

          <button
            type="button"
            class="btn danger"
            :disabled="!canTriggerCancellation"
            @click="cancelCurrentReservation"
          >
            {{ isCanceling ? 'Annulation en cours...' : 'Annuler la réservation' }}
          </button>
          <p
            v-if="cancelSuccess"
            class="state is-success"
          >
            {{ cancelSuccess }}
          </p>
          <p
            v-if="cancelError"
            class="state is-error"
          >
            {{ cancelError }}
          </p>
        </section>

        <section class="panel actions-panel">
          <div class="panel-head">
            <h2>Actions rapides</h2>
          </div>

          <a
            class="btn primary"
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

          <div class="calendar-actions">
            <p class="calendar-title">Ajouter la réservation au calendrier</p>
            <div class="calendar-links">
              <a
                v-if="googleCalendarUrl"
                class="btn calendar secondary"
                :href="googleCalendarUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Agenda
              </a>
              <a
                v-if="outlookCalendarUrl"
                class="btn calendar secondary"
                :href="outlookCalendarUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Outlook
              </a>
              <a
                v-if="yahooCalendarUrl"
                class="btn calendar secondary"
                :href="yahooCalendarUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Yahoo Calendar
              </a>
              <a
                v-if="stayIcalUrl"
                class="btn calendar secondary"
                :href="stayIcalUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Apple Calendar
              </a>
            </div>

            <a
              v-if="stayIcalUrl"
              class="btn tertiary"
              :href="stayIcalUrl"
              download="reservation.ics"
            >
              Télécharger le fichier iCal (.ics)
            </a>
          </div>
        </section>
      </template>
    </section>
  </main>
</template>

<style scoped lang="scss">
@use '@/styles/variables/globals' as *;

.booking-confirmation-page {
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 36px 16px;
  background:
    radial-gradient(120% 100% at 50% -10%, rgba($accent, 1) 0%, rgba($secondary-surface-1, 1) 72%);
}

.confirmation-card {
  width: min(560px, 100%);
  background: rgba($accent, 1);
  border: 1px solid rgba($secondary, 0.14);
  border-radius: 16px;
  padding: 20px;
  display: grid;
  gap: 14px;
  box-shadow: 0 10px 24px rgba($secondary, 0.08);
}

.confirmation-heading {
  display: grid;
  gap: 4px;

  > .eyebrow {
    margin: 0;
    color: rgba($secondary-text, 0.8);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 11px;
  }

  > h1 {
    margin: 0;
    color: rgba($secondary-text, 0.96);
    font-size: 32px;
    line-height: 1.15;
  }

  > .subtitle {
    margin: 2px 0 0;
    color: rgba($secondary-text, 0.72);
    font-size: 14px;
    line-height: 1.35;
  }
}

.state {
  margin: 0;
  color: rgba($secondary-text, 0.78);
  font-size: 14px;

  &.is-success {
    color: rgba($good, 0.92);
  }

  &.is-error {
    color: rgba($bad, 0.92);
  }
}

.panel {
  border: 1px solid rgba($secondary, 0.12);
  border-radius: 12px;
  background: rgba($accent, 0.96);
  padding: 12px;
  display: grid;
  gap: 10px;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;

  > h2 {
    margin: 0;
    font-size: 16px;
    color: rgba($secondary-text, 0.9);
    line-height: 1.2;
  }
}

.stay-range {
  margin: 0;
  color: rgba($secondary-text, 0.68);
  font-size: 13px;
  text-align: right;
}

.stat-grid {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.stat-item {
  margin: 0;
  border: 1px solid rgba($secondary, 0.14);
  border-radius: 10px;
  padding: 10px;
  background: rgba($accent, 1);
  display: grid;
  gap: 4px;

  > dt {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: rgba($secondary-text, 0.58);
  }

  > dd {
    margin: 0;
    font-size: 15px;
    color: rgba($secondary-text, 0.96);
    font-weight: 600;
  }

  &.is-highlight {
    border-color: rgba($good, 0.34);
    background: rgba($good, 0.1);
  }
}

.host-name {
  margin: 0;
  color: rgba($secondary-text, 0.96);
  font-size: 16px;
  font-weight: 600;
}

.muted {
  margin: 0;
  color: rgba($secondary-text, 0.7);
  font-size: 14px;
}

.contact-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;

  > li {
    margin: 0;
    color: rgba($secondary-text, 0.88);
    font-size: 14px;
  }
}

.actions-panel {
  gap: 8px;
}

.cancellation-panel {
  gap: 8px;
}

.calendar-actions {
  display: grid;
  gap: 8px;
}

.calendar-title {
  margin: 2px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: rgba($secondary-text, 0.78);
}

.calendar-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border-radius: 9px;
  border: 1px solid transparent;
  color: rgba($secondary-text, 0.9);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.2;

  box-sizing: border-box;

  &.primary {
    color: rgba($accent, 1);
    background: rgba($secondary, 0.92);
    border-color: rgba($secondary, 0.92);
  }

  &.secondary {
    border-color: rgba($secondary, 0.22);
    color: rgba($secondary-text, 0.9);
    background: rgba($accent, 1);
  }

  &.tertiary {
    border-color: rgba($secondary, 0.14);
    color: rgba($secondary-text, 0.82);
    background: rgba($secondary-surface-0, 0.5);
  }

  &.danger {
    border-color: rgba($bad, 0.36);
    color: rgba($bad, 0.96);
    background: rgba($bad, 0.1);
  }

  &.calendar {
    width: auto;
    min-height: 34px;
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
  }

  &.disabled {
    opacity: 0.52;
    pointer-events: none;
  }

  &:disabled {
    opacity: 0.52;
    cursor: not-allowed;
  }
}

@media (max-width: 640px) {
  .booking-confirmation-page {
    padding: 18px 10px;
  }

  .confirmation-card {
    padding: 14px;
    border-radius: 14px;
  }

  .confirmation-heading > h1 {
    font-size: 26px;
  }

  .stat-grid {
    grid-template-columns: 1fr;
  }

  .stay-range {
    text-align: left;
  }

  .panel-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
