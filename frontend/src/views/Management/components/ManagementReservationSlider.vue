<!-- File: src/views/Management/components/ManagementReservationSlider.vue -->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { SwiperOptions, SwiperModule } from 'swiper/types'
import type { Swiper as SwiperInstance } from 'swiper/types'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { FreeMode, Mousewheel } from 'swiper/modules'
import SliderCorner from '@/components/svgs/images/SliderCorner.vue'

import type { Reservation } from '@/views/Management/utils/managementReservations'

const props = defineProps<{
  reservations: Reservation[]
  activeReservationId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', reservationId: string): void
}>()

const displayedReservations = computed(() =>
  [
    ...props.reservations,
  ].reverse(),
)
const swiperRef = ref<SwiperInstance | null>(null)
const activeDisplayedIndex = computed(() => {
  if (!props.activeReservationId) return -1
  return displayedReservations.value.findIndex((reservation) => reservation.id === props.activeReservationId)
})

const sliderParams = computed(
  () =>
    ({
      modules: [
        FreeMode as SwiperModule,
        Mousewheel as SwiperModule,
      ],
      slidesPerView: 'auto',
      spaceBetween: 4,
      freeMode: {
        enabled: true,
        momentumRatio: 0.8,
      },
      mousewheel: {
        enabled: true,
        releaseOnEdges: true,
      },
      centeredSlides: false,
      watchOverflow: true,
      resistanceRatio: 0.85,
      threshold: 6,
    }) satisfies SwiperOptions,
)

function scrollToContextualPosition() {
  const swiper = swiperRef.value
  const total = displayedReservations.value.length
  if (!swiper || !total) return

  const fallbackIndex = total - 1
  const targetIndex = activeDisplayedIndex.value >= 0 ? activeDisplayedIndex.value : fallbackIndex

  if (targetIndex >= fallbackIndex) {
    swiper.slideTo(fallbackIndex, 0)
    return
  }

  swiper.update()

  const slideStart = swiper.slidesGrid[targetIndex]
  const slideSize = swiper.slidesSizesGrid[targetIndex]

  if (!Number.isFinite(slideStart) || !Number.isFinite(slideSize)) {
    swiper.slideTo(targetIndex, 0)
    return
  }

  // Center selected reservation when newer ones still exist on the right.
  const centeredTranslate = -(slideStart + slideSize / 2 - swiper.width / 2)
  const clampedTranslate = Math.max(swiper.maxTranslate(), Math.min(swiper.minTranslate(), centeredTranslate))
  swiper.translateTo(clampedTranslate, 0, false, true)
}

function handleSwiper(instance: SwiperInstance) {
  swiperRef.value = instance
  nextTick(scrollToContextualPosition)
}

watch(
  () => displayedReservations.value.map((reservation) => reservation.id).join('|'),
  () => {
    nextTick(scrollToContextualPosition)
  },
)

watch(
  () => props.activeReservationId,
  () => {
    nextTick(scrollToContextualPosition)
  },
)

function initials(name: string) {
  const clean = (name ?? '').trim()
  if (!clean) return 'IH'
  const parts = clean.split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatDateShort(iso?: string) {
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
    year: '2-digit',
    timeZone: 'UTC',
  }).format(date)
}

function handleSelect(reservationId: string) {
  emit('select', reservationId)
}
</script>

<template>
  <div class="management-reservation-slider">
    <SliderCorner class="slider-corner-1" />
    <Swiper
      class="swiper"
      v-bind="sliderParams"
      @swiper="handleSwiper"
    >
      <SwiperSlide
        v-for="reservation in displayedReservations"
        :key="reservation.id"
        class="reservation-slide"
      >
        <button
          type="button"
          class="reservation-pill"
          :class="{ 'is-active': reservation.id === props.activeReservationId }"
          @click="handleSelect(reservation.id)"
        >
          <div>
            <span class="avatar">
              <img
                v-if="reservation.guestAvatar"
                :src="reservation.guestAvatar"
                :alt="reservation.guestName"
                loading="lazy"
              />
              <span
                v-else
                class="initials"
                >{{ initials(reservation.guestName) }}</span
              >
            </span>
            <span class="meta">
              <span class="name">{{ reservation.guestName }}</span>
              <span class="dates">{{ formatDateShort(reservation.start) }} &mdash; {{ formatDateShort(reservation.end) }}</span>
            </span>
          </div>
        </button>
      </SwiperSlide>
    </Swiper>
    <SliderCorner class="slider-corner-2" />
  </div>
</template>

<style lang="scss">
@use '@/views/Management/components/management-reservation-slider.scss';
</style>
