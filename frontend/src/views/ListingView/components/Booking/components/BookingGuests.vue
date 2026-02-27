<!-- File: src/views/ListingView/components/Booking/components/BookingGuests.vue -->

<script setup lang="ts">
import { ref } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'
import RelativeOverlay from '@/components/overlays/RelativeOverlay.vue'

type OccupantKey = 'adults' | 'children' | 'babies' | 'animals' | 'pmr'
type GuestRow = {
  key: OccupantKey
  label: string
  description: string
  value: number
  min: number
  max: number
  hint?: string
}

const props = defineProps<{
  open: boolean
  occupantLabel: string
  rows: GuestRow[]
  updateCount: (key: OccupantKey, delta: number) => void
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'close'): void
}>()

const guestsLayer = ref<HTMLElement | null>(null)

function canDecrease(row: GuestRow): boolean {
  return row.value > row.min
}

function canIncrease(row: GuestRow): boolean {
  return row.value < row.max
}

function minusLabel(row: GuestRow): string {
  return `Retirer ${row.label.toLowerCase()}`
}

function plusLabel(row: GuestRow): string {
  return `Ajouter ${row.label.toLowerCase()}`
}
</script>

<template>
  <div
    ref="guestsLayer"
    class="listing-booking-guests"
  >
    <div class="btn-primary__white__full">
      <button
        type="button"
        class="field is-full"
        @click="emit('toggle')"
      >
        <span>pour</span>
        <strong>{{ occupantLabel }}</strong>
      </button>
    </div>

    <RelativeOverlay
      class="listing-booking-guests-overlay"
      :open="open"
      :anchor="guestsLayer"
      placement="bottom-start"
      :offset="6"
      :match-anchor-width="true"
      :z-index="10002"
      @close="emit('close')"
    >
      <div class="dropdown">
        <div
          v-for="row in props.rows"
          :key="row.key"
          class="item"
          :class="{ 'is-locked': row.max <= row.min }"
        >
          <div>
            <p>{{ row.label }}</p>
            <small>{{ row.description }}</small>
            <small v-if="row.hint">{{ row.hint }}</small>
          </div>
          <div class="counter">
            <button
              type="button"
              :aria-label="minusLabel(row)"
              :title="minusLabel(row)"
              :disabled="!canDecrease(row)"
              @click="props.updateCount(row.key, -1)"
            >
              <Minus :size="20" />
            </button>
            <span>{{ row.value }}</span>
            <button
              type="button"
              :aria-label="plusLabel(row)"
              :title="plusLabel(row)"
              :disabled="!canIncrease(row)"
              @click="props.updateCount(row.key, 1)"
            >
              <Plus :size="20" />
            </button>
          </div>
        </div>
      </div>
    </RelativeOverlay>
  </div>
</template>
