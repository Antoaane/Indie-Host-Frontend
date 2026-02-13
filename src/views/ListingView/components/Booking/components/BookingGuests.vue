<!-- File: src/views/ListingView/components/Booking/components/BookingGuests.vue -->

<script setup lang="ts">
import { ref } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'
import RelativeOverlay from '@/components/overlays/RelativeOverlay.vue'

type OccupantKey = 'adults' | 'children' | 'babies' | 'animals' | 'pmr'

const props = defineProps<{
  open: boolean
  occupantLabel: string
  occupants: Record<OccupantKey, number>
  updateCount: (key: OccupantKey, delta: number) => void
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'close'): void
}>()

const guestsLayer = ref<HTMLElement | null>(null)
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
        <div class="item">
          <div>
            <p>Adultes</p>
            <small>13 ans et plus</small>
          </div>
          <div class="counter">
            <button
              type="button"
              aria-label="Retirer un adulte"
              :disabled="occupants.adults <= 1"
              @click="props.updateCount('adults', -1)"
            >
              <Minus :size="20" />
            </button>
            <span>{{ occupants.adults }}</span>
            <button
              type="button"
              aria-label="Ajouter un adulte"
              @click="props.updateCount('adults', 1)"
            >
              <Plus :size="20" />
            </button>
          </div>
        </div>

        <div class="item">
          <div>
            <p>Enfants</p>
            <small>2 à 12 ans</small>
          </div>
          <div class="counter">
            <button
              type="button"
              aria-label="Retirer un enfant"
              :disabled="occupants.children <= 0"
              @click="props.updateCount('children', -1)"
            >
              <Minus :size="20" />
            </button>
            <span>{{ occupants.children }}</span>
            <button
              type="button"
              aria-label="Ajouter un enfant"
              @click="props.updateCount('children', 1)"
            >
              <Plus :size="20" />
            </button>
          </div>
        </div>

        <div class="item">
          <div>
            <p>Bébés</p>
            <small>Moins de 2 ans</small>
          </div>
          <div class="counter">
            <button
              type="button"
              aria-label="Retirer un bébé"
              :disabled="occupants.babies <= 0"
              @click="props.updateCount('babies', -1)"
            >
              <Minus :size="20" />
            </button>
            <span>{{ occupants.babies }}</span>
            <button
              type="button"
              aria-label="Ajouter un bébé"
              @click="props.updateCount('babies', 1)"
            >
              <Plus :size="20" />
            </button>
          </div>
        </div>

        <div class="item">
          <div>
            <p>Animaux</p>
            <small>Chien, chat...</small>
          </div>
          <div class="counter">
            <button
              type="button"
              aria-label="Retirer un animal"
              :disabled="occupants.animals <= 0"
              @click="props.updateCount('animals', -1)"
            >
              <Minus :size="20" />
            </button>
            <span>{{ occupants.animals }}</span>
            <button
              type="button"
              aria-label="Ajouter un animal"
              @click="props.updateCount('animals', 1)"
            >
              <Plus :size="20" />
            </button>
          </div>
        </div>

        <div class="item">
          <div>
            <p>Personnes PMR</p>
            <small>Besoin d'aménagement</small>
          </div>
          <div class="counter">
            <button
              type="button"
              aria-label="Retirer une personne PMR"
              :disabled="occupants.pmr <= 0"
              @click="props.updateCount('pmr', -1)"
            >
              <Minus :size="20" />
            </button>
            <span>{{ occupants.pmr }}</span>
            <button
              type="button"
              aria-label="Ajouter une personne PMR"
              @click="props.updateCount('pmr', 1)"
            >
              <Plus :size="20" />
            </button>
          </div>
        </div>
      </div>
    </RelativeOverlay>
  </div>
</template>
