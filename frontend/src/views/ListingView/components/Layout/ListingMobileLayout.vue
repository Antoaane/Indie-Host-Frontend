<!-- File: src/views/ListingView/components/Layout/ListingMobileLayout.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { Check, ChevronLeft, Share } from 'lucide-vue-next'

import { getListingsController } from '@/domain/listings/controller'
import { isListingHostname } from '@/domain/listings/publicDomain'
import { clampOccupantsToRules, computeReservationPricing } from '@/domain/listings/reservationRules'
import { makeIsDateDisabled } from '@/components/DatePicker/utils/range'
import { findNextRange, isSelectedRangeValid } from '@/views/ListingView/components/Booking/utils/range'
import { nightsBetween } from '@/domain/listings/bookings'
import { useListingStatusBarTint } from '@/views/ListingView/composables/useListingStatusBarTint'
import { orderByIndex } from '@/views/ListingView/components/Gallery/utils/order'
import type { OccupantCounts } from '@/views/ListingView/types/reservation'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import type { ListingParsed } from '@/views/ListingView/types/listing'
import type { ReservationPayload } from '@/views/ListingView/types/reservation'
import type { CheckoutConfirmationPayload } from '@/views/ListingView/types/checkout'

import Gallery from '@/views/ListingView/components/Gallery/Gallery.vue'
import Core from '@/views/ListingView/components/Core/Core.vue'
import Comments from '@/views/ListingView/components/Comments/Comments.vue'
import Booking from '@/views/ListingView/components/Booking/Booking.vue'
import BookingMin from '@/views/ListingView/components/BookingMin/BookingMin.vue'
import Checkout from '@/views/ListingView/components/Checkout/Checkout.vue'
import LegalLinksCompact from '@/components/layouts/LegalLinksCompact.vue'

const props = withDefaults(
  defineProps<{
    listingData: ListingParsed | null
    bookingRange?: RangeISO | null
    isCheckout: boolean
    checkoutPayload: ReservationPayload | null
    listingId: string | null
    ownerStripeConnectAccountId: string | null
    checkoutSubmitting?: boolean
    checkoutError?: string | null
    isBookingDisabled: boolean
    bookingDisabledLabel: string
    bookingDisabledHint: string
    canEditListing: boolean
    ownershipLoading: boolean
    editListingRoute: RouteLocationRaw
    previewOnly?: boolean
  }>(),
  {
    bookingRange: null,
    checkoutSubmitting: false,
    checkoutError: null,
    previewOnly: false,
  },
)

const emit = defineEmits<{
  (e: 'update:bookingRange', value: RangeISO | null): void
  (e: 'reserve', payload: ReservationPayload): void
  (e: 'cancel-checkout'): void
  (e: 'confirm-checkout', payload: CheckoutConfirmationPayload): void
}>()

const selection = computed<RangeISO | null>({
  get: () => props.bookingRange,
  set: (value) => emit('update:bookingRange', value),
})

// Voyageurs du séjour, gardés par la page : la fenêtre de réservation est démontée à sa fermeture
// (ils revenaient à 2 adultes), et la barre du bas en a besoin pour le total.
const occupants = reactive<OccupantCounts>({ adults: 2, children: 0, babies: 0, animals: 0, pmr: 0 })

watch(
  () => props.listingData?.bookings.rules.occupancy,
  (occupancy) => {
    if (!occupancy) return
    Object.assign(occupants, clampOccupantsToRules(occupants, occupancy))
  },
  { immediate: true, deep: true },
)

// Premières dates libres proposées d'office (comme le module de réservation) : la barre affiche
// alors un vrai total, frais compris, au lieu d'un prix par nuit « indicatif ».
const isDateDisabled = computed(() => makeIsDateDisabled(props.listingData?.bookings.bookedDays ?? []))
const minNights = computed(() => Math.max(1, Number(props.listingData?.bookings.rules.stay.minNights) || 1))

watch(
  [() => props.listingData?.bookings.bookedDays, minNights],
  () => {
    if (!props.listingData || props.isBookingDisabled) return
    const current = selection.value
    const nights = current ? nightsBetween(current.start, current.end) : 0
    if (current && isSelectedRangeValid(current, nights, isDateDisabled.value)) return
    selection.value = findNextRange(minNights.value, isDateDisabled.value)
  },
  { immediate: true, deep: true },
)

const stayQuote = computed(() => {
  const data = props.listingData
  const range = selection.value
  if (!data || !range?.start || !range.end) return null

  const pricing = computeReservationPricing({
    startISO: range.start,
    endISO: range.end,
    basePrice: data.bookings.price,
    weekendPricing: data.bookings.weekend ?? null,
    fees: data.bookings.fees ?? [],
    occupants,
    rules: data.bookings.rules,
  })
  if (pricing.nightly.nights <= 0) return null
  return { total: pricing.total, nights: pricing.nightly.nights }
})

// Barre du haut (retour, partager) fixée à l'écran : transparente sur la photo, elle prend le fond
// de la page dès que la photo est passée sous elle.
const topBar = ref<HTMLElement | null>(null)
const galleryEl = ref<HTMLElement | null>(null)
const topBarSolid = ref(false)
const showTopBar = computed(() => !props.previewOnly && !props.isCheckout)
let galleryObserver: IntersectionObserver | null = null

function observeGallery() {
  galleryObserver?.disconnect()
  galleryObserver = null
  const bar = topBar.value
  const gallery = galleryEl.value
  if (!bar || !gallery || typeof IntersectionObserver === 'undefined') {
    topBarSolid.value = Boolean(bar && !gallery)
    return
  }
  galleryObserver = new IntersectionObserver(
    (entries) => {
      const latest = entries[entries.length - 1]
      if (latest) topBarSolid.value = !latest.isIntersecting
    },
    // La photo compte comme passée quand son bas remonte sous la barre.
    { rootMargin: `-${Math.round(bar.offsetHeight)}px 0px 0px 0px` },
  )
  galleryObserver.observe(gallery)
}

watch([topBar, galleryEl], observeGallery, { flush: 'post' })
onBeforeUnmount(() => galleryObserver?.disconnect())

// Bande de la barre d'état (iPhone) : couleur du haut de la première photo, qui semble ainsi
// se prolonger jusqu'en haut de l'écran. Barre du haut pleine : fond de la page, comme elle.
const firstImageSrc = computed(() => orderByIndex(props.listingData?.medias.images ?? [])[0]?.src ?? null)
useListingStatusBarTint(firstImageSrc, computed(() => showTopBar.value && !topBarSolid.value))

function onReserve(payload: ReservationPayload) {
  emit('reserve', payload)
}

function onCancelCheckout() {
  emit('cancel-checkout')
}

function onConfirmCheckout(payload: CheckoutConfirmationPayload) {
  emit('confirm-checkout', payload)
}

// Retour vers la page principale : sur le domaine d'un hôte, un logement s'ouvre sous
// `/<nom-du-logement>` et la racine présente tous ses logements. Le bouton n'apparaît que si la
// racine affiche bien une autre annonce (la page principale), pas ce logement lui-même.
const hubHref = ref<string | null>(null)

onMounted(async () => {
  if (props.previewOnly || typeof window === 'undefined') return
  const { hostname, pathname } = window.location
  if (!isListingHostname(hostname) || pathname === '/' || !props.listingId) return

  try {
    const rootListingId = await getListingsController().resolveListingIdByHostname(hostname)
    if (rootListingId && rootListingId !== props.listingId) hubHref.value = '/'
  } catch {
    // Sans réponse, pas de bouton : le retour du navigateur reste possible.
  }
})

// Partager : feuille de partage du téléphone, sinon lien copié.
const shareCopied = ref(false)

async function shareListing() {
  if (typeof window === 'undefined') return
  const url = window.location.href
  const title = props.listingData?.title.title?.replace(/<[^>]+>/g, '').trim() || document.title

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
    } catch {
      // Partage annulé : rien à faire.
    }
    return
  }

  try {
    await navigator.clipboard.writeText(url)
    shareCopied.value = true
    window.setTimeout(() => {
      shareCopied.value = false
    }, 2000)
  } catch {
    // Presse-papiers refusé : rien de plus à proposer.
  }
}
</script>

<template>
  <!-- Fixée en haut de l'écran : retour vers tous les logements, « Éditer », partager. -->
  <div
    v-if="showTopBar"
    ref="topBar"
    class="top-bar"
    :class="{ 'is-solid': topBarSolid }"
  >
    <a
      v-if="hubHref"
      :href="hubHref"
      class="round-action"
      aria-label="Voir tous les logements"
      title="Tous les logements"
    >
      <ChevronLeft
        :size="20"
        aria-hidden="true"
      />
    </a>
    <div class="end">
      <RouterLink
        v-if="props.canEditListing && !props.ownershipLoading"
        class="owner-edit"
        :to="props.editListingRoute"
        aria-label="Éditer cette annonce"
        title="Éditer cette annonce"
      >
        Éditer
      </RouterLink>
      <button
        type="button"
        class="round-action"
        :aria-label="shareCopied ? 'Lien copié' : 'Partager ce logement'"
        :title="shareCopied ? 'Lien copié' : 'Partager'"
        @click="shareListing"
      >
        <Check
          v-if="shareCopied"
          :size="18"
          aria-hidden="true"
        />
        <Share
          v-else
          :size="18"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>

  <div class="main">
    <Transition name="listing-fade">
      <div
        v-if="!props.isCheckout"
        ref="galleryEl"
        class="gallery"
      >
        <Gallery
          v-if="props.listingData"
          :medias="props.listingData.medias"
          :listing-title="props.listingData.title.title"
          :preview-only="props.previewOnly"
        />
        <template v-else><div class="skeleton">Chargement…</div></template>
      </div>
    </Transition>

    <div class="core">
      <div :class="{ panel: true, 'is-checkout': props.isCheckout }">
        <Transition
          name="listing-swap"
          mode="out-in"
        >
          <div
            v-if="props.listingData && !props.isCheckout"
            key="core"
          >
            <Core
              v-model:model-value="selection"
              :data="props.listingData"
              :preview-only="props.previewOnly"
            />
            <Comments
              :notes="props.listingData.notes"
              :comments="props.listingData.comments"
              :visibility="props.listingData.reviewsVisibility"
            />
          </div>
          <div
            v-else-if="props.listingData && props.checkoutPayload"
            key="checkout"
            class="checkout-stack"
          >
            <Checkout
              :listing="props.listingData"
              :reservation="props.checkoutPayload"
              :listing-id="props.listingId ?? ''"
              :connected-account-id="props.ownerStripeConnectAccountId"
              :is-submitting="props.checkoutSubmitting"
              :submit-error="props.checkoutError"
              @cancel="onCancelCheckout"
              @confirm="onConfirmCheckout"
            />
            <Booking
              v-model:model-value="selection"
              :price-per-night="props.listingData.bookings.price"
              :weekend-pricing="props.listingData.bookings.weekend"
              :fees="props.listingData.bookings.fees"
              :booked-days="props.listingData.bookings.bookedDays"
              :rules="props.listingData.bookings.rules"
              :disabled="props.isBookingDisabled"
              :disabled-label="props.bookingDisabledLabel"
              :disabled-hint="props.bookingDisabledHint"
              :occupants="occupants"
              @reserve="onReserve"
            />
          </div>
          <div
            v-else
            key="core-skeleton"
            class="skeleton"
          >
            Chargement…
          </div>
        </Transition>
      </div>
    </div>

    <LegalLinksCompact v-if="!props.previewOnly" />
  </div>

  <div
    v-if="!props.isCheckout && !props.previewOnly"
    class="footer"
  >
    <BookingMin
      v-if="props.listingData"
      v-model:model-value="selection"
      :price-per-night="props.listingData.bookings.price"
      :quote="stayQuote"
      :disabled="props.isBookingDisabled"
      :disabled-label="props.bookingDisabledLabel"
    >
      <!-- La sheet reprend le module de réservation desktop ; « Réserver » bascule
           vers le checkout, qui démonte la barre et donc la sheet. Le détail du prix y est
           affiché d'emblée : le total se lit avant de toucher « Réserver ». -->
      <Booking
        v-model:model-value="selection"
        :price-per-night="props.listingData.bookings.price"
        :weekend-pricing="props.listingData.bookings.weekend"
        :fees="props.listingData.bookings.fees"
        :booked-days="props.listingData.bookings.bookedDays"
        :rules="props.listingData.bookings.rules"
        :disabled="props.isBookingDisabled"
        :disabled-label="props.bookingDisabledLabel"
        :disabled-hint="props.bookingDisabledHint"
        :occupants="occupants"
        always-show-summary
        @reserve="onReserve"
      />
    </BookingMin>
    <template v-else>
      <div class="skeleton">Chargement…</div>
    </template>
  </div>
</template>
