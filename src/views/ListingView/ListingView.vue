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

// TYPES
import type { ListingParsed } from '@/views/ListingView/types/listing'
import type { StyleValue } from 'vue'

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

const pvWidth = ref<number | undefined>(0)
const pvHeight = ref<number | undefined>(0)

const listingView = ref<HTMLElement | null>(null)
const lvWidth = ref<number | null>(0)
const lvHeight = ref<number | null>(0)

const scaleDiff = ref<number | null>(0)
// const wDiff = ref<number | null>(0)
// const hDiff = ref<number | null>(0)

// const aspectStyles = {
//   aspectRatio: `${pvWidth}/${pvHeight}`,
//   transform: scaleDiff ? `scale(${scaleDiff})` : 'none',
//   top: hDiff ? `-${hDiff / 4.75}px` : '0px',
//   left: wDiff ? `-${wDiff / 2}px` : '0px',
// }

const aspectStyles = computed<StyleValue>(() => {
  if (!props.aspect) {
    return {}
  }

  return {
    aspectRatio: `${pvWidth.value} / ${pvHeight.value}`,
    transform: `scale(${scaleDiff.value})`,
    transformOrigin: 'top left',
    position: 'relative',
    // top: hDiff.value ? `-${hDiff.value / 4.75}px` : '0px',
    // left: wDiff.value ? `-${wDiff.value / 2}px` : '0px',
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
    // wDiff.value = lvWidth.value - pvWidth.value
    // hDiff.value = lvHeight.value - pvHeight.value
  }

  console.log('ListingView setAspect :', {
    pvWidth: pvWidth.value,
    pvHeight: pvHeight.value,
    lvWidth: lvWidth.value,
    lvHeight: lvHeight.value,
    diff: scaleDiff.value,
    // wDiff: wDiff.value,
    // hDiff: hDiff.value,
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
</script>

<template>
  <template v-if="vp.lg.value">
    <div
      :class="{ 'listing-view': true, editor: props.aspect }"
      ref="listingView"
      :style="aspectStyles"
    >
      <div class="gallery">
        <Gallery
          v-if="listingData"
          :medias="listingData.medias"
        />
        <template v-else><div class="skeleton">Chargement…</div></template>
      </div>

      <div class="core">
        <Core
          v-if="listingData"
          v-model:model-value="bookingRange"
          :data="listingData"
        />
        <template v-else><div class="skeleton">Chargement…</div></template>
      </div>

      <div class="stay">
        <Booking
          v-if="listingData"
          v-model:model-value="bookingRange"
          :price-per-night="listingData.bookings.price"
          :fees="listingData.bookings.fees"
          :booked-days="listingData.bookings.bookedDays"
        />
        <template v-else>
          <div class="skeleton">Chargement…</div>
        </template>

        <Comments
          v-if="listingData"
          :notes="listingData.notes"
          :comments="listingData.comments"
        />
        <template v-else><div class="skeleton">Chargement…</div></template>
      </div>
    </div>
  </template>

  <template v-else>
    <div class="listing-view">
      <div class="main">
        <div class="gallery">
          <Gallery
            v-if="listingData"
            :medias="listingData.medias"
          />
          <template v-else><div class="skeleton">Chargement…</div></template>
        </div>

        <div class="core">
          <div class="panel">
            <Core
              v-if="listingData"
              v-model:model-value="bookingRange"
              :data="listingData"
            />
            <template v-else><div class="skeleton">Chargement…</div></template>

            <Comments
              v-if="listingData"
              :notes="listingData.notes"
              :comments="listingData.comments"
            />
            <template v-else><div class="skeleton">Chargement…</div></template>
          </div>
        </div>
      </div>

      <footer class="footer">
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
      </footer>
    </div>
  </template>
</template>

<style lang="scss">
@use '@/views/ListingView/listing-view.scss';
</style>
