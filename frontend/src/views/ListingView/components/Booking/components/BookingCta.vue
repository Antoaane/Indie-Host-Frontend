<!-- File: src/views/ListingView/components/Booking/components/BookingCta.vue -->

<script setup lang="ts">
import { CalendarCheck, UsersRound } from 'lucide-vue-next'

const props = defineProps<{
  nights: number
  disabled?: boolean
  disabledLabel?: string
  disabledHint?: string
}>()

const emit = defineEmits<{
  (e: 'reserve'): void
}>()
</script>

<template>
  <div class="listing-booking-cta">
    <div class="btn-primary__full">
      <button
        type="button"
        :disabled="props.disabled || !props.nights"
        @click="emit('reserve')"
      >
        <CalendarCheck :size="18" />
        {{ props.disabled && props.disabledLabel ? props.disabledLabel : 'Réserver' }}
      </button>
    </div>
    <p class="hint">
      <UsersRound :size="12" />
      {{ props.disabled && props.disabledHint ? props.disabledHint : 'Confirmation immédiate et paiement sécurisé' }}
    </p>
  </div>
</template>
