<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/GuestTiersPanel.vue -->

<script setup lang="ts">
// Prix selon le nombre de voyageurs : une ligne par nombre de voyageurs, jusqu'à la capacité du
// logement. Un voyageur paie le prix de base ; chaque autre ligne porte une majoration en pourcentage
// et montre le prix par nuit qui en résulte, celui que le voyageur verra.
import { computed } from 'vue'
import NumberStepper from '@/components/inputs/NumberStepper.vue'
import type { RawBookings, RawCore } from '@/domain/listings/types'
import { GUEST_SURCHARGE_PERCENT_MAX, applyGuestSurcharge } from '@/domain/listings/pricing'
import { resolveGuestTierPercent, resolveListingReservationRules } from '@/domain/listings/reservationRules'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger } from '@/utils/inputValidation'
import { formatICUMessage } from '@/utils/i18n'

const props = defineProps<{
  core?: Partial<RawCore> | null
  bookings?: Partial<RawBookings> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const panelContent = editorStatic.panels.pricing.guestTiers
const guestsLabel = editorStatic.panels.pricing.summary.guestsLabel

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

// Mêmes règles que la réservation : capacité et paliers lus comme le fera le calcul du prix.
const rules = computed(() => resolveListingReservationRules({ core: props.core, bookings: props.bookings }))
const capacity = computed(() => rules.value.occupancy.capacity)
const basePrice = computed(() => Math.max(0, Math.round(Number(props.bookings?.price ?? 0) || 0)))

type GuestRow = {
  guests: number
  label: string
  percent: number
  price: string
}

// Une ligne sans réglage reprend le palier d'en dessous, comme le calcul : ajouter une place au
// logement ne fait pas retomber le prix au tarif de base.
const rows = computed<GuestRow[]>(() => {
  const list: GuestRow[] = []
  for (let guests = 1; guests <= capacity.value; guests += 1) {
    const percent = resolveGuestTierPercent(rules.value.guestTiers, guests)
    list.push({
      guests,
      label: `${guests} ${formatICUMessage(guestsLabel, { count: guests })}`,
      percent,
      price: panelContent.perNight.replace('{price}', euros.format(applyGuestSurcharge(basePrice.value, percent))),
    })
  }
  return list
})

function setPercent(guests: number, value: unknown) {
  const percent = clampInteger(value, 0, GUEST_SURCHARGE_PERCENT_MAX, 0)
  const current = rows.value.find((row) => row.guests === guests)
  if (!current || current.percent === percent) return

  // Tout le barème est écrit, ligne par ligne : chaque nombre de voyageurs garde ce qui est affiché.
  const guestTiers = rows.value
    .filter((row) => row.guests >= 2)
    .map((row) => ({ guests: row.guests, percent: row.guests === guests ? percent : row.percent }))

  emit('patch', {
    bookings: {
      pricing: {
        ...(props.bookings?.pricing ?? {}),
        guestTiers,
      },
    },
  })
}

function increaseAria(guests: number) {
  return panelContent.increaseAria.replace('{count}', String(guests))
}
</script>

<template>
  <section class="editor-guest-tiers-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <p
        v-if="capacity < 2"
        class="notice"
      >
        {{ panelContent.singleGuest }}
      </p>

      <template v-else>
        <p
          v-if="basePrice <= 0"
          class="notice"
        >
          {{ panelContent.noPrice }}
        </p>

        <ul class="tiers">
          <li
            v-for="row in rows"
            :key="row.guests"
            class="tier"
          >
            <p class="guests">{{ row.label }}</p>
            <p
              v-if="row.guests === 1"
              class="base"
            >
              {{ panelContent.baseLabel }}
            </p>
            <NumberStepper
              v-else
              class="percent"
              :value="row.percent"
              min="0"
              :max="GUEST_SURCHARGE_PERCENT_MAX"
              :suffix="panelContent.percentSuffix"
              :decrement-disabled="row.percent <= 0"
              :increment-disabled="row.percent >= GUEST_SURCHARGE_PERCENT_MAX"
              :decrement-aria-label="`${increaseAria(row.guests)} : diminuer`"
              :increment-aria-label="`${increaseAria(row.guests)} : augmenter`"
              @decrement="setPercent(row.guests, row.percent - 1)"
              @input="setPercent(row.guests, $event.number)"
              @increment="setPercent(row.guests, row.percent + 1)"
            />
            <p
              v-if="basePrice > 0"
              class="price"
            >
              {{ row.price }}
            </p>
          </li>
        </ul>

        <p class="note">{{ panelContent.note }}</p>
      </template>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/GuestTiersPanel.vue */

@use '@/styles/variables/globals' as *;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-guest-tiers-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .notice,
    > .note {
      @include little-text(rgba($secondary-text, 0.72), $thin: false);
    }

    > .tiers {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;

      > .tier {
        padding: var(--layout-gap-sm) 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas:
          'guests control'
          'price control';
        align-items: center;
        gap: var(--layout-gap-2xs) var(--layout-gap-sm);

        & + .tier {
          border-top: 1px solid rgba($secondary, 0.08);
        }

        > .guests {
          grid-area: guests;
          @include base-text($secondary-text, $bold: true);
        }

        > .price {
          grid-area: price;
          @include little-text(rgba($secondary-text, 0.72), $thin: false);
          font-variant-numeric: tabular-nums;
        }

        > .base {
          grid-area: control;
          @include little-text(rgba($secondary-text, 0.72), $thin: false);
        }

        > .percent {
          grid-area: control;
        }
      }
    }
  }
}
</style>
