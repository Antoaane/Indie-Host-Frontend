<script setup lang="ts">
import { CalendarCheck, UsersRound } from 'lucide-vue-next'

const props = defineProps<{
  nights: number
}>()

const emit = defineEmits<{
  (e: 'reserve'): void
}>()
</script>

<template>
  <div class="checkout-card__cta">
    <div class="btn-primary__full">
      <button
        type="button"
        :disabled="!props.nights"
        @click="emit('reserve')"
      >
        <CalendarCheck :size="18" />
        Réserver
      </button>
    </div>
    <p class="checkout-card__hint">
      <UsersRound :size="12" />
      Confirmation immédiate et paiement sécurisé
    </p>
  </div>
</template>
