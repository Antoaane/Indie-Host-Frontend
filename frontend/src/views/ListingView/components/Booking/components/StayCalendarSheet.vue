<!-- File: src/views/ListingView/components/Booking/components/StayCalendarSheet.vue -->

<script setup lang="ts">
// Choix des dates sur téléphone, en plein écran : les mois défilent de haut en bas, chacun avec son
// nom (comme sur Airbnb, Booking ou Abritel), sans flèches à viser. Arrivée puis départ ; la sélection
// n'est appliquée qu'à « Valider », et « Effacer » repart de zéro. Mêmes jours indisponibles que le
// calendrier de bureau (`DatePicker.vue`) et que la réservation (`Booking.vue`).
import { computed, nextTick, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import {
  RangeCalendarCell,
  RangeCalendarCellTrigger,
  RangeCalendarGrid,
  RangeCalendarGridBody,
  RangeCalendarGridRow,
  RangeCalendarRoot,
} from 'reka-ui'
import type { DateRange, DateValue } from 'reka-ui'
import { X } from '@lucide/vue'

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
    /** Dernier jour réservable (AAAA-MM-JJ) : les mois s'arrêtent à celui de ce jour. */
    maxDate?: string | null
    /** Nombre de mois proposés à partir du mois en cours, quand `maxDate` n'est pas donné. */
    months?: number
  }>(),
  {
    bookedRanges: () => [],
    minNights: 1,
    maxDate: null,
    months: 24,
  },
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:modelValue', value: RangeISO): void
}>()

const today = todayCalendarDate()
const maxValue = computed(() => {
  if (!props.maxDate) return undefined
  try {
    return parseISO(props.maxDate)
  } catch {
    return undefined
  }
})
// Du mois en cours à celui du dernier jour réservable, les deux compris.
const monthCount = computed(() => {
  const last = maxValue.value
  if (!last) return props.months
  return Math.max(1, (last.year - today.year) * 12 + (last.month - today.month) + 1)
})
const isDateDisabled = computed(() => makeIsDateDisabled(props.bookedRanges, { lastDate: props.maxDate }))
// Jour passé, ou au-delà de la fenêtre de réservation : pâle, sans être barré comme un jour pris.
const isOutOfWindow = (date: DateValue) => {
  const day = toNum(date)
  return day < toNum(today) || (maxValue.value ? day > toNum(maxValue.value) : false)
}

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

// Deux ans de calendrier, c'est 900 jours : tous montés à l'ouverture, la fenêtre mettait près
// d'une demi-seconde à apparaître. Un mois n'est donc construit qu'à l'approche de l'écran ; d'ici
// là il garde sa place (titre et hauteur exacte), pour que le défilement ne saute pas.
const monthKeyOf = (month: DateValue) => toISO(month).slice(0, 7)
const builtMonths = reactive(new Set<string>())
const buildEveryMonth = ref(false)
let monthObserver: IntersectionObserver | null = null

function watchMonths() {
  monthObserver?.disconnect()
  monthObserver = null

  const root = scroller.value
  if (!root || typeof IntersectionObserver === 'undefined') {
    buildEveryMonth.value = true
    return
  }

  monthObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const key = (entry.target as HTMLElement).dataset.month
        if (key) builtMonths.add(key)
        monthObserver?.unobserve(entry.target)
      }
    },
    // Un écran d'avance au-dessus et en dessous : le mois est prêt avant d'arriver sous le doigt.
    { root, rootMargin: '100% 0px' },
  )
  root.querySelectorAll<HTMLElement>('.month').forEach((month) => monthObserver?.observe(month))
}

onBeforeUnmount(() => monthObserver?.disconnect())

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      monthObserver?.disconnect()
      monthObserver = null
      return
    }
    draft.value = draftFromModel(props.modelValue)
    builtMonths.clear()
    buildEveryMonth.value = false
    // Le mois de l'arrivée choisie est amené à l'écran (sinon le mois en cours, déjà en haut).
    await nextTick()
    const startKey = draft.value.start ? monthKeyOf(draft.value.start) : null
    if (startKey) {
      scroller.value?.querySelector<HTMLElement>(`[data-month="${startKey}"]`)?.scrollIntoView({ block: 'start' })
    }
    watchMonths()
  },
  { immediate: true },
)

const nights = computed(() => {
  const { start, end } = draft.value
  if (!start || !end) return 0
  return Math.round((end.toDate('UTC').getTime() - start.toDate('UTC').getTime()) / 86_400_000)
})

// Bandeau du séjour seulement quand l'arrivée et le départ sont choisis.
const hasRange = computed(() => Boolean(draft.value.start && draft.value.end))

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
        :max-value="maxValue"
        :number-of-months="monthCount"
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
          :class="{ 'has-range': hasRange }"
        >
          <section
            v-for="month in grid"
            :key="month.value.toString()"
            class="month"
            :data-month="monthKeyOf(month.value)"
          >
            <h3 class="month-title">{{ formatMonth(month.value) }}</h3>
            <!-- Pas de classe « grid » : c'est aussi un utilitaire Tailwind (display: grid). -->
            <RangeCalendarGrid
              v-if="buildEveryMonth || builtMonths.has(monthKeyOf(month.value))"
              class="month-grid"
            >
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
                      :class="{ 'is-out-of-window': isOutOfWindow(weekDate) }"
                    />
                  </RangeCalendarCell>
                </RangeCalendarGridRow>
              </RangeCalendarGridBody>
            </RangeCalendarGrid>
            <div
              v-else
              class="month-placeholder"
              :style="{ '--month-rows': month.rows.length }"
              aria-hidden="true"
            />
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
@use '@/components/DatePicker/stay-months.scss' as stay-months;

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
        @include stay-months.weekdays;
      }

      >.months {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 0 var(--layout-gap) var(--layout-gap-xl);
        @include stay-months.months;

        // Place réservée à un mois pas encore construit : ses rangées, chacune haute comme un jour.
        >.month>.month-placeholder {
          height: calc(var(--month-rows) * (var(--tap-target) + 2px));
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
