<!-- File: src/views/ListingView/components/Booking/components/StayCalendarSheet.vue -->

<script setup lang="ts">
// Choix des dates sur téléphone, en plein écran : les mois défilent de haut en bas, chacun avec son
// nom (comme sur Airbnb, Booking ou Abritel), sans flèches à viser. Arrivée puis départ ; la sélection
// n'est appliquée qu'à « Valider », et « Effacer » repart de zéro. Mêmes jours indisponibles que le
// calendrier de bureau (`DatePicker.vue`) et que la réservation (`Booking.vue`).
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import {
  RangeCalendarCell,
  RangeCalendarCellTrigger,
  RangeCalendarGrid,
  RangeCalendarGridBody,
  RangeCalendarGridRow,
  RangeCalendarRoot,
} from 'reka-ui'
import type { DateRange, DateValue } from 'reka-ui'
import { X } from 'lucide-vue-next'

import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { parseISO, toISO, toNum, todayCalendarDate } from '@/components/DatePicker/helpers/date'
import { makeIsDateDisabled } from '@/components/DatePicker/utils/range'
import { isRangeAvailable } from '@/views/ListingView/components/Booking/utils/range'

const props = withDefaults(
  defineProps<{
    open: boolean
    modelValue: RangeISO | null
    bookedRanges?: RangeISO[]
    minNights?: number
    /** Nombre de mois proposés, à partir du mois en cours. */
    months?: number
  }>(),
  {
    bookedRanges: () => [],
    minNights: 1,
    months: 12,
  },
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:modelValue', value: RangeISO): void
}>()

const today = todayCalendarDate()
const isDateDisabled = computed(() => makeIsDateDisabled(props.bookedRanges))
const isPastDay = (date: DateValue) => toNum(date) < toNum(today)

// Sélection en cours, appliquée seulement à « Valider ».
const draft = shallowRef<DateRange>({ start: undefined, end: undefined })
const scroller = ref<HTMLElement | null>(null)

function draftFromModel(value: RangeISO | null): DateRange {
  if (!value?.start || !value?.end) return { start: undefined, end: undefined }
  try {
    return { start: parseISO(value.start), end: parseISO(value.end) }
  } catch {
    return { start: undefined, end: undefined }
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    draft.value = draftFromModel(props.modelValue)
    // Le mois de l'arrivée choisie est amené à l'écran (sinon le mois en cours, déjà en haut).
    await nextTick()
    const start = scroller.value?.querySelector<HTMLElement>('[data-selection-start]')
    start?.closest<HTMLElement>('.month')?.scrollIntoView({ block: 'start' })
  },
  { immediate: true },
)

const nights = computed(() => {
  const { start, end } = draft.value
  if (!start || !end) return 0
  return Math.round((end.toDate('UTC').getTime() - start.toDate('UTC').getTime()) / 86_400_000)
})

const isDraftValid = computed(() => {
  const { start } = draft.value
  if (!start || nights.value < props.minNights) return false
  return isRangeAvailable(parseISO(toISO(start)), nights.value, isDateDisabled.value)
})

const dayFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

const formatDay = (date: DateValue) => dayFormatter.format(date.toDate('UTC'))
const formatMonth = (date: DateValue) => monthFormatter.format(date.toDate('UTC'))

const nightsLabel = (count: number) => `${count} ${count > 1 ? 'nuits' : 'nuit'}`

// Ce qui est choisi, redit en clair, et ce qu'il reste à faire.
const summary = computed(() => {
  const { start, end } = draft.value
  if (!start) return { title: 'Date d’arrivée', hint: 'Touchez le jour de votre arrivée.' }
  if (!end || nights.value <= 0) return { title: `${formatDay(start)} → …`, hint: 'Touchez maintenant le jour de votre départ.' }
  const title = `${formatDay(start)} → ${formatDay(end)} · ${nightsLabel(nights.value)}`
  if (nights.value < props.minNights) return { title, hint: `Séjour minimum : ${nightsLabel(props.minNights)}.`, isError: true }
  if (!isDraftValid.value) return { title, hint: 'Ce séjour comprend des jours indisponibles.', isError: true }
  return { title, hint: 'Les jours barrés ne sont pas disponibles.' }
})

function clearDraft() {
  draft.value = { start: undefined, end: undefined }
}

function confirm() {
  const { start, end } = draft.value
  if (!start || !end || !isDraftValid.value) return
  emit('update:modelValue', { start: toISO(start), end: toISO(end) })
  emit('close')
}
</script>

<template>
  <AbsoluteOverlay
    class="stay-calendar-sheet"
    :open="props.open"
    :z-index="10003"
    aria-label="Choisir les dates du séjour"
    @close="emit('close')"
  >
    <div class="panel">
      <header class="head">
        <div class="text">
          <p
            class="title"
            aria-live="polite"
          >
            {{ summary.title }}
          </p>
          <p
            class="hint"
            :class="{ 'is-error': summary.isError }"
          >
            {{ summary.hint }}
          </p>
        </div>
        <button
          type="button"
          class="close"
          aria-label="Fermer le calendrier"
          title="Fermer"
          @click="emit('close')"
        >
          <X
            :size="20"
            aria-hidden="true"
          />
        </button>
      </header>

      <RangeCalendarRoot
        v-slot="{ grid, weekDays }"
        v-model="draft"
        class="calendar"
        :placeholder="today"
        :min-value="today"
        :number-of-months="props.months"
        :fixed-weeks="false"
        :is-date-disabled="isDateDisabled"
        locale="fr"
        calendar-label="Dates du séjour"
      >
        <div
          class="weekdays"
          aria-hidden="true"
        >
          <span
            v-for="(day, index) in weekDays"
            :key="`${day}-${index}`"
          >{{ day }}</span>
        </div>

        <div
          ref="scroller"
          class="months"
        >
          <section
            v-for="month in grid"
            :key="month.value.toString()"
            class="month"
          >
            <h3 class="month-title">{{ formatMonth(month.value) }}</h3>
            <!-- Pas de classe « grid » : c'est aussi un utilitaire Tailwind (display: grid). -->
            <RangeCalendarGrid class="month-grid">
              <RangeCalendarGridBody>
                <RangeCalendarGridRow
                  v-for="(weekDates, weekIndex) in month.rows"
                  :key="`${month.value.toString()}-${weekIndex}`"
                  class="row"
                >
                  <RangeCalendarCell
                    v-for="weekDate in weekDates"
                    :key="weekDate.toString()"
                    :date="weekDate"
                    class="cell"
                  >
                    <RangeCalendarCellTrigger
                      :day="weekDate"
                      :month="month.value"
                      class="day"
                      :class="{ 'is-past': isPastDay(weekDate) }"
                    />
                  </RangeCalendarCell>
                </RangeCalendarGridRow>
              </RangeCalendarGridBody>
            </RangeCalendarGrid>
          </section>
        </div>
      </RangeCalendarRoot>

      <footer class="foot">
        <button
          type="button"
          class="clear"
          :disabled="!draft.start"
          @click="clearDraft"
        >
          Effacer
        </button>
        <div class="confirm">
          <button
            type="button"
            :disabled="!isDraftValid"
            @click="confirm"
          >
            Valider
          </button>
        </div>
      </footer>
    </div>
  </AbsoluteOverlay>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Booking/components/StayCalendarSheet.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/buttons' as buttons;

.stay-calendar-sheet {
  // Plein écran : la sheet occupe toute la hauteur, au-dessus de la fenêtre de réservation.
  align-items: stretch;
  padding: 0 !important;

  >.panel {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;

    background: $accent;
    padding-top: var(--safe-area-top);

    >.head {
      flex: 0 0 auto;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--layout-gap-sm);
      padding: var(--layout-gap) var(--layout-gap-xl) var(--layout-gap-sm);

      >.text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--layout-gap-2xs);

        >.title {
          @include h4-title($colorful: false, $bigger: false);
          margin: 0;
        }

        >.hint {
          @include little-text(rgba($secondary-text, 0.72), $thin: false);

          &.is-error {
            @include little-text($bad-ink, $thin: false);
          }
        }
      }

      >.close {
        flex: 0 0 auto;
        width: var(--tap-target);
        height: var(--tap-target);
        margin-top: calc(var(--layout-gap-xs) * -1);
        margin-right: calc(var(--layout-gap-xs) * -2);

        display: grid;
        place-items: center;

        border: none;
        border-radius: borders.$rounded;
        background: transparent;
        color: $secondary-text;
        cursor: pointer;
        @include animations.transition(animations.$duration-fast, animations.$ease-out, background-color);
        @include animations.press();

        @include on-hover {
          background: rgba($secondary, 0.06);
        }

        &:focus-visible {
          outline: 2px solid $secondary;
          outline-offset: 2px;
        }
      }
    }

    >.calendar {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;

      >.weekdays {
        flex: 0 0 auto;
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        padding: var(--layout-gap-xs) var(--layout-gap) var(--layout-gap-sm);
        border-bottom: 1px solid rgba($secondary, 0.1);

        >span {
          text-align: center;
          @include little-text(rgba($secondary-text, 0.6), $bold: true);
        }
      }

      >.months {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 0 var(--layout-gap) var(--layout-gap-xl);

        >.month {
          padding-top: var(--layout-gap-xl);

          >.month-title {
            margin: 0 0 var(--layout-gap-sm) var(--layout-gap-xs);
            text-transform: capitalize;
            @include base-text($bold: true, $bigger: true);
          }

          >.month-grid {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;

            .row>.cell {
              padding: 1px 0;
              text-align: center;

              // Bandeau du séjour : porté par la cellule, d'un jour à l'autre sans coupure.
              &:has(.day[data-selected]) {
                background: rgba($secondary, 0.07);
              }

              &:has(.day[data-selection-start]) {
                border-top-left-radius: borders.$rounded;
                border-bottom-left-radius: borders.$rounded;
              }

              &:has(.day[data-selection-end]) {
                border-top-right-radius: borders.$rounded;
                border-bottom-right-radius: borders.$rounded;
              }

              // Jours des mois voisins : chaque mois n'affiche que les siens.
              &:has(.day[data-outside-view]) {
                visibility: hidden;
                background: none;
              }

              >.day {
                width: 100%;
                height: var(--tap-target);
                max-width: var(--tap-target);
                margin: 0 auto;

                display: grid;
                place-items: center;

                border: none;
                border-radius: borders.$rounded;
                background: transparent;
                @include base-text($bold: true);
                font-variant-numeric: tabular-nums;
                cursor: pointer;
                @include animations.transition(animations.$duration-press, animations.$ease-out, transform);
                @include animations.press();

                &:focus-visible {
                  outline: 2px solid $secondary;
                  outline-offset: 1px;
                }

                &[data-today] {
                  box-shadow: inset 0 0 0 1px rgba($secondary, 0.35);
                }

                // Indisponible (déjà réservé ou fermé) : barré. Passé : seulement pâle.
                &[data-disabled] {
                  color: rgba($secondary-text, 0.38);
                  text-decoration: line-through;
                  text-decoration-thickness: 1.5px;
                  cursor: not-allowed;
                }

                &.is-past[data-disabled] {
                  text-decoration: none;
                }

                &:is([data-selection-start], [data-selection-end]) {
                  background: $secondary;
                  color: $accent;
                  text-decoration: none;
                }
              }
            }
          }
        }
      }
    }

    >.foot {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--layout-gap);
      padding: var(--layout-gap-sm) var(--layout-gap-xl) calc(var(--layout-gap-sm) + var(--safe-area-bottom));
      border-top: 1px solid rgba($secondary, 0.1);

      >.clear {
        min-height: var(--tap-target);
        padding: 0 var(--layout-gap-xs);
        border: none;
        background: transparent;
        cursor: pointer;
        @include base-text($bold: true, $underline: true);

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        &:focus-visible {
          outline: 2px solid $secondary;
          outline-offset: 2px;
          border-radius: borders.$rounded-xs;
        }
      }

      >.confirm {
        @include buttons.primary($theme: black);

        >button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      }
    }
  }
}
</style>
