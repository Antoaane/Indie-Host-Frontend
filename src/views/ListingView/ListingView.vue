<!-- File: src/views/ListingView/ListingView.vue -->

<script setup lang="ts">
// DEPS
import { computed, ref, watch, nextTick } from 'vue'

// UTILS
import { vp } from '@/utils/viewport'
import { core, type RawListingBundle } from '@/views/ListingView/utils/useParseContent'
import type { RangeISO } from '@/components/DatePicker/helpers/date'

// COMPONENTS
import Gallery from '@/views/ListingView/components/Gallery/Gallery.vue'
import Core from '@/views/ListingView/components/Core/Core.vue'
import Comments from '@/views/ListingView/components/Comments/Comments.vue'
import Booking from '@/views/ListingView/components/Booking/Booking.vue'
import BookingMin from '@/views/ListingView/components/BookingMin/BookingMin.vue'
import Checkout from '@/views/ListingView/components/Checkout/Checkout.vue'

// TYPES
import type { ListingParsed } from '@/views/ListingView/types/listing'
import type { StyleValue } from 'vue'
import type { ReservationPayload } from '@/views/ListingView/types/reservation'

const props = defineProps<{
  rawListing?: RawListingBundle | null
  aspect?: {
    width: number
    height: number
  }
}>()

const listingData = computed<ListingParsed | null>(() => {
  if (!props.rawListing) return null
  return core(props.rawListing)
})

const bookingRange = ref<RangeISO | null>(null)
const checkoutPayload = ref<ReservationPayload | null>(null)
const isCheckout = computed(() => Boolean(checkoutPayload.value))

const pvWidth = ref<number | undefined>(0)
const pvHeight = ref<number | undefined>(0)

const listingView = ref<HTMLElement | null>(null)
const lvWidth = ref<number | null>(0)
const lvHeight = ref<number | null>(0)

const scaleDiff = ref<number | null>(0)

const aspectStyles = computed<StyleValue>(() => {
  if (!props.aspect) {
    return {}
  }

  return {
    aspectRatio: `${pvWidth.value} / ${pvHeight.value}`,
    transform: `scale(${scaleDiff.value})`,
    transformOrigin: 'top left',
    position: 'relative',
  }
})

function setAspect() {
  pvWidth.value = props.aspect?.width
  pvHeight.value = props.aspect?.height

  const container = listingView.value
  if (container) {
    lvWidth.value = container.clientWidth
    lvHeight.value = container.clientHeight
  }

  if (lvWidth.value && pvWidth.value && lvHeight.value && pvHeight.value) {
    scaleDiff.value = pvWidth.value / lvWidth.value
  }

  console.log('ListingView setAspect :', {
    pvWidth: pvWidth.value,
    pvHeight: pvHeight.value,
    lvWidth: lvWidth.value,
    lvHeight: lvHeight.value,
    diff: scaleDiff.value,
  })
}

watch(
  () => props.aspect,
  async (value) => {
    if (!value) return
    await nextTick()
    setAspect()
  },
  { immediate: true },
)

function onReserve(payload: ReservationPayload) {
  checkoutPayload.value = payload
}

function cancelCheckout() {
  checkoutPayload.value = null
}
</script>

<template>
  <template v-if="vp.lg.value">
    <div
      :class="{ 'listing-view': true, editor: props.aspect, 'is-checkout': isCheckout }"
      ref="listingView"
      :style="aspectStyles"
    >
      <Transition name="listing-fade">
        <div
          v-if="!isCheckout"
          class="gallery"
        >
          <Gallery
            v-if="listingData"
            :medias="listingData.medias"
          />
          <template v-else><div class="skeleton">Chargement…</div></template>
        </div>
      </Transition>
      <div
        v-if="isCheckout"
        class="gallery is-placeholder"
        aria-hidden="true"
      />

      <div class="core">
        <Transition
          name="listing-swap"
          mode="out-in"
        >
          <Core
            v-if="listingData && !isCheckout"
            key="core"
            v-model:model-value="bookingRange"
            :data="listingData"
          />
          <Checkout
            v-else-if="listingData && checkoutPayload"
            key="checkout"
            :listing="listingData"
            :reservation="checkoutPayload!"
            @cancel="cancelCheckout"
          />
          <div
            v-else
            key="core-skeleton"
            class="skeleton"
          >
            Chargement…
          </div>
        </Transition>
      </div>

      <div class="stay">
        <Booking
          v-if="listingData"
          v-model:model-value="bookingRange"
          :price-per-night="listingData.bookings.price"
          :fees="listingData.bookings.fees"
          :booked-days="listingData.bookings.bookedDays"
          @reserve="onReserve"
        />
        <template v-else>
          <div class="skeleton">Chargement…</div>
        </template>

        <Transition name="listing-fade">
          <div v-if="!isCheckout">
            <Comments
              v-if="listingData"
              :notes="listingData.notes"
              :comments="listingData.comments"
            />
            <template v-else><div class="skeleton">Chargement…</div></template>
          </div>
        </Transition>
      </div>
    </div>
  </template>

  <template v-else>
    <div :class="{ 'listing-view': true, 'is-checkout': isCheckout }">
      <div class="main">
        <Transition name="listing-fade">
          <div
            v-if="!isCheckout"
            class="gallery"
          >
            <Gallery
              v-if="listingData"
              :medias="listingData.medias"
            />
            <template v-else><div class="skeleton">Chargement…</div></template>
          </div>
        </Transition>

        <div class="core">
          <div :class="{ panel: true, 'is-checkout': isCheckout }">
            <Transition
              name="listing-swap"
              mode="out-in"
            >
              <div
                v-if="listingData && !isCheckout"
                key="core"
              >
                <Core
                  v-model:model-value="bookingRange"
                  :data="listingData"
                />
                <Comments
                  :notes="listingData.notes"
                  :comments="listingData.comments"
                />
              </div>
              <div
                v-else-if="listingData && checkoutPayload"
                key="checkout"
                class="checkout-stack"
              >
                <Checkout
                  :listing="listingData"
                  :reservation="checkoutPayload!"
                  @cancel="cancelCheckout"
                />
                <Booking
                  v-model:model-value="bookingRange"
                  :price-per-night="listingData.bookings.price"
                  :fees="listingData.bookings.fees"
                  :booked-days="listingData.bookings.bookedDays"
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
      </div>

      <div
        v-if="!isCheckout"
        class="footer"
      >
        <span class="shape-container is-right">
          <svg
            class="shape"
            width="300"
            height="300"
            viewBox="0 0 300 300"
          >
            <path d="M 300 0 A 300 300 0 0 1 0 300 L 300 300 Z" />
          </svg>
        </span>
        <span class="shape-container is-left">
          <svg
            class="shape"
            width="300"
            height="300"
            viewBox="0 0 300 300"
          >
            <path d="M 300 0 A 300 300 0 0 1 0 300 L 300 300 Z" />
          </svg>
        </span>

        <BookingMin
          v-if="listingData"
          v-model:model-value="bookingRange"
          :price-per-night="listingData.bookings.price"
          :fees="listingData.bookings.fees"
          :booked-days="listingData.bookings.bookedDays"
        />
        <template v-else>
          <div class="skeleton">Chargement…</div>
        </template>
      </div>
    </div>
  </template>
</template>

<style lang="scss">
@use '@/views/ListingView/listing-view.scss';
</style>
