<!-- File: src/views/ListingView/components/Booking/components/BookingGuests.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, Minus, Plus } from 'lucide-vue-next'
import RelativeOverlay from '@/components/overlays/RelativeOverlay.vue'
import { vp } from '@/utils/viewport'

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
const overlayId = `booking-guests-overlay-${Math.random().toString(36).slice(2, 10)}`

// Téléphone : les compteurs s'ouvrent dans la fenêtre de réservation, sous le champ (une liste
// déroulante par-dessus une fenêtre se lisait mal). À partir de md : liste déroulante.
const isWide = computed(() => vp.md.value)

// Les catégories que l'annonce n'accepte pas ne sont pas proposées (elles restaient affichées,
// bloquées à 0, avec « Non autorisé pour cette annonce »).
const visibleRows = computed(() => props.rows.filter((row) => row.max > 0 || row.value > 0))

function canDecrease(row: GuestRow): boolean {
  return row.value > row.min
}

function canIncrease(row: GuestRow): boolean {
  return row.value < row.max
}

function minusLabel(row: GuestRow): string {
  return `Retirer : ${row.label.toLowerCase()}`
}

function plusLabel(row: GuestRow): string {
  return `Ajouter : ${row.label.toLowerCase()}`
}
</script>

<template>
  <div
    ref="guestsLayer"
    class="listing-booking-guests"
    :class="{ 'is-open': open }"
  >
    <button
      type="button"
      class="stay-field is-guests"
      :aria-haspopup="isWide ? 'dialog' : undefined"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="overlayId"
      @click="emit('toggle')"
    >
      <span class="label">Voyageurs</span>
      <span class="value">{{ occupantLabel }}</span>
      <ChevronDown
        class="chevron"
        :size="18"
        aria-hidden="true"
      />
    </button>

    <!-- La hauteur glisse à l'ouverture comme à la fermeture (grille 0fr ↔ 1fr) : sans cela, le
         reste de la fenêtre sautait d'un coup. -->
    <Transition name="guests-inline">
      <div
        v-if="!isWide && open"
        :id="overlayId"
        class="guests-inline"
      >
        <div class="inner">
          <div class="list">
            <div
              v-for="row in visibleRows"
              :key="row.key"
              class="item"
              :class="{ 'is-locked': row.max <= row.min }"
            >
              <div class="text">
                <p>{{ row.label }}</p>
                <small>{{ row.description }}</small>
              </div>
              <div class="counter">
                <button
                  type="button"
                  :aria-label="minusLabel(row)"
                  :title="minusLabel(row)"
                  :disabled="!canDecrease(row)"
                  @click="props.updateCount(row.key, -1)"
                >
                  <Minus
                    :size="18"
                    aria-hidden="true"
                  />
                </button>
                <span aria-live="polite">{{ row.value }}</span>
                <button
                  type="button"
                  :aria-label="plusLabel(row)"
                  :title="plusLabel(row)"
                  :disabled="!canIncrease(row)"
                  @click="props.updateCount(row.key, 1)"
                >
                  <Plus
                    :size="18"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <RelativeOverlay
      v-if="isWide"
      class="listing-booking-guests-overlay"
      :open="open"
      :anchor="guestsLayer"
      :id="overlayId"
      placement="bottom-start"
      :offset="6"
      :match-anchor-width="true"
      :z-index="10002"
      @close="emit('close')"
    >
      <div class="dropdown">
        <div
          v-for="row in visibleRows"
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
