<!-- File: src/views/Management/components/ManagementReservationSlider.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { SwiperOptions, SwiperModule } from 'swiper/types'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { FreeMode } from 'swiper/modules'

import type { Reservation } from '@/views/Management/utils/managementReservations'

const props = defineProps<{
  reservations: Reservation[]
  activeReservationId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', reservationId: string): void
}>()

const sliderParams = computed(
  () =>
    ({
      modules: [
        FreeMode as SwiperModule,
      ],
      slidesPerView: 'auto',
      spaceBetween: 4,
      freeMode: {
        enabled: true,
        momentumRatio: 0.8,
      },
      centeredSlides: false,
      watchOverflow: true,
      resistanceRatio: 0.85,
      threshold: 6,
    }) satisfies SwiperOptions,
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
    <Swiper
      class="swiper"
      v-bind="sliderParams"
    >
      <SwiperSlide
        v-for="reservation in reservations"
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
  </div>
</template>

<style lang="scss">
@use '@/views/Management/components/management-reservation-slider.scss';
</style>
