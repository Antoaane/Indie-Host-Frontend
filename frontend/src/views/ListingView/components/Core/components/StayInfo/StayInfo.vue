<!-- File: src/views/ListingView/components/Core/components/StayInfo/StayInfo.vue -->

<script setup lang="ts">
// « À savoir » : ce qu'un voyageur veut connaître avant de réserver et qu'il ne trouvait qu'au
// paiement ou dans le guide d'arrivée : les heures d'arrivée et de départ, et ce qu'il récupère
// s'il annule. Mêmes phrases que le paiement et la confirmation (`cancellationPolicy.ts`).
import { computed, ref } from 'vue'
import { CalendarX2, ChevronDown, Clock, ShieldCheck } from '@lucide/vue'

import { describeCancellationPolicy, type ResolvedCancellationPolicy } from '@/domain/listings/cancellationPolicy'
import type { StayInfoModel } from '@/views/ListingView/types/listing'

const props = defineProps<{
  data: StayInfoModel
  cancellation: ResolvedCancellationPolicy
}>()

const CONDITIONS_ID = 'listing-stay-info-cancellation'

const hours = computed(() => [
  props.data.checkIn ? `Arrivée : ${props.data.checkIn}` : '',
  props.data.checkOut ? `Départ : ${props.data.checkOut}` : '',
].filter(Boolean).join(' · '))

// Première phrase visible, le reste du barème derrière « Voir toutes les conditions ».
const cancellationLines = computed(() => describeCancellationPolicy(props.cancellation))
const cancellationLead = computed(() => cancellationLines.value[0] ?? '')
const cancellationRest = computed(() => cancellationLines.value.slice(1))
const isRefundable = computed(() => props.cancellation.refundsEnabled)

const isExpanded = ref(false)
</script>

<template>
  <section
    class="listing-stay-info"
    aria-labelledby="listing-stay-info-title"
  >
    <h2 id="listing-stay-info-title">À savoir</h2>

    <ul class="rows">
      <li
        v-if="hours"
        class="row"
      >
        <Clock
          class="icon"
          aria-hidden="true"
        />
        <div class="body">
          <h3>Arrivée et départ</h3>
          <p>{{ hours }}</p>
        </div>
      </li>

      <li
        class="row"
        :class="{ 'is-expanded': isExpanded }"
      >
        <component
          :is="isRefundable ? ShieldCheck : CalendarX2"
          class="icon"
          aria-hidden="true"
        />
        <div class="body">
          <h3>Conditions d’annulation</h3>
          <p>{{ cancellationLead }}</p>

          <template v-if="cancellationRest.length">
            <div
              :id="CONDITIONS_ID"
              class="more"
              :aria-hidden="!isExpanded"
            >
              <ul class="more-inner">
                <li
                  v-for="line in cancellationRest"
                  :key="line"
                >
                  {{ line }}
                </li>
              </ul>
            </div>

            <div class="trigger">
              <button
                type="button"
                :aria-expanded="isExpanded"
                :aria-controls="CONDITIONS_ID"
                @click="isExpanded = !isExpanded"
              >
                <span>{{ isExpanded ? 'Masquer les conditions' : 'Voir toutes les conditions' }}</span>
                <ChevronDown
                  :size="18"
                  class="chevron"
                  aria-hidden="true"
                />
              </button>
            </div>
          </template>
        </div>
      </li>
    </ul>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Core/components/StayInfo/stay-info.scss';
</style>
