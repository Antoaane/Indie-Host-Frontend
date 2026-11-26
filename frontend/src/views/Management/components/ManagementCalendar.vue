<!-- File: src/views/Management/components/ManagementCalendar.vue -->

<script setup lang="ts">
// Calendrier d'un logement dans Réservations, au même dessin que le choix des dates du voyageur
// (`StayCalendarSheet.vue`, feuille commune `stay-months.scss`) : les mois défilent de haut en bas,
// chaque réservation est un bandeau entre deux cercles. Lecture seule : toucher une réservation
// l'ouvre. Les jours barrés sont fermés par un calendrier importé (Airbnb, Booking…).
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import type { ImportedBlock, Reservation } from '@/views/Management/utils/managementReservations'

type CalendarScope = 'all' | 'stay'

const props = withDefaults(
  defineProps<{
    reservations: Reservation[]
    blocks?: ImportedBlock[]
    activeReservationId?: string | null
    /** Dernier jour ouvert aux voyageurs (AAAA-MM-JJ) : au-delà, les jours sont pâles comme les jours passés. */
    lastBookableDate?: string | null
    /** `all` : tous les mois, qui défilent dans le composant. `stay` : seulement les mois du séjour ouvert. */
    scope?: CalendarScope
  }>(),
  {
    blocks: () => [],
    activeReservationId: null,
    lastBookableDate: null,
    scope: 'all',
  },
)

const emit = defineEmits<{
  (e: 'select', reservationId: string): void
}>()

// Bornes des mois affichés : un an en arrière au plus pour les séjours passés, deux ans en avant
// (la fenêtre de réservation la plus longue), trois si une période connue va plus loin.
const MONTHS_BACK_MAX = 12
const MONTHS_AHEAD = 24
const MONTHS_AHEAD_MAX = 36

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

type DayCell = {
  iso: string
  day: number
  /** Jour d'un mois voisin : garde sa place dans la semaine, mais n'est pas affiché. */
  outside: boolean
  reservation: Reservation | null
  attrs: Record<string, string | undefined>
  classes: Record<string, boolean>
  label: string
}

type MonthModel = {
  key: string
  title: string
  weeks: DayCell[][]
}

const pad = (value: number) => String(value).padStart(2, '0')
const toIso = (year: number, monthIndex: number, day: number) => {
  const date = new Date(Date.UTC(year, monthIndex, day))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}
const monthKey = (iso: string) => iso.slice(0, 7)
const monthIndexOf = (key: string) => {
  const [year, month] = key.split('-').map(Number)
  return year * 12 + (month - 1)
}

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const today = todayIso()

const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const formatDay = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return dayFormatter.format(new Date(Date.UTC(year, month - 1, day)))
}

const activeReservation = computed(() => (
  props.reservations.find((reservation) => reservation.id === props.activeReservationId) ?? null
))

// Mois affichés, du premier au dernier compris (indices « année × 12 + mois »).
const monthRange = computed(() => {
  const current = monthIndexOf(monthKey(today))

  if (props.scope === 'stay') {
    const stay = activeReservation.value
    if (!stay) return { first: current, last: current }
    return { first: monthIndexOf(monthKey(stay.start)), last: monthIndexOf(monthKey(stay.end)) }
  }

  const starts = props.reservations.map((reservation) => monthIndexOf(monthKey(reservation.start)))
  const ends = [
    ...props.reservations.map((reservation) => monthIndexOf(monthKey(reservation.end))),
    ...props.blocks.map((block) => monthIndexOf(monthKey(block.end))),
  ]
  const first = Math.max(current - MONTHS_BACK_MAX, Math.min(current, ...starts))
  const last = Math.min(current + MONTHS_AHEAD_MAX, Math.max(current + MONTHS_AHEAD, ...ends))
  return { first, last }
})

function reservationOn(iso: string): Reservation | null {
  return props.reservations.find((reservation) => iso >= reservation.start && iso <= reservation.end) ?? null
}

function isBlocked(iso: string): boolean {
  return props.blocks.some((block) => iso >= block.start && iso <= block.end)
}

function buildCell(iso: string, day: number, outside: boolean): DayCell {
  if (outside) {
    return { iso, day, outside, reservation: null, attrs: { 'data-outside-view': '' }, classes: {}, label: '' }
  }

  const reservation = reservationOn(iso)
  const blocked = !reservation && isBlocked(iso)
  const outOfWindow = iso < today || (props.lastBookableDate ? iso > props.lastBookableDate : false)
  const isActive = Boolean(reservation && reservation.id === props.activeReservationId)

  const attrs: Record<string, string | undefined> = {
    'data-today': iso === today ? '' : undefined,
    // Mêmes attributs que le calendrier du voyageur : bandeau, puis cercles aux deux bouts.
    'data-selected': reservation ? '' : undefined,
    'data-selection-start': reservation && iso === reservation.start ? '' : undefined,
    'data-selection-end': reservation && iso === reservation.end ? '' : undefined,
    'data-active': isActive ? '' : undefined,
    'data-disabled': !reservation && (blocked || outOfWindow) ? '' : undefined,
  }

  const label = reservation
    ? `${formatDay(iso)} : ${reservation.guestName}, du ${formatDay(reservation.start)} au ${formatDay(reservation.end)}`
    : blocked
      ? `${formatDay(iso)} : fermé par un calendrier importé`
      : formatDay(iso)

  return {
    iso,
    day,
    outside,
    reservation,
    attrs,
    // Passé ou hors fenêtre de réservation, sans être fermé : pâle, pas barré.
    classes: { 'is-out-of-window': outOfWindow && !blocked },
    label,
  }
}

const months = computed<MonthModel[]>(() => {
  const list: MonthModel[] = []

  for (let index = monthRange.value.first; index <= monthRange.value.last; index += 1) {
    const year = Math.floor(index / 12)
    const month = index % 12
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    // Lundi en premier : 0 = lundi … 6 = dimanche.
    const leading = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7
    const cellCount = Math.ceil((leading + daysInMonth) / 7) * 7

    const cells: DayCell[] = []
    for (let position = 0; position < cellCount; position += 1) {
      const day = position - leading + 1
      const outside = day < 1 || day > daysInMonth
      const date = new Date(Date.UTC(year, month, day))
      cells.push(buildCell(toIso(year, month, day), date.getUTCDate(), outside))
    }

    const weeks: DayCell[][] = []
    for (let start = 0; start < cells.length; start += 7) weeks.push(cells.slice(start, start + 7))

    list.push({
      key: `${year}-${pad(month + 1)}`,
      title: monthFormatter.format(new Date(Date.UTC(year, month, 1))),
      weeks,
    })
  }

  return list
})

// Défilement : le mois du séjour ouvert est amené en haut, sinon le mois en cours. Seul le
// conteneur des mois défile (jamais la page autour).
const scroller = ref<HTMLElement | null>(null)

function scrollToFocusedMonth(smooth: boolean) {
  const container = scroller.value
  if (!container || props.scope !== 'all') return

  const key = activeReservation.value ? monthKey(activeReservation.value.start) : monthKey(today)
  const target = container.querySelector<HTMLElement>(`[data-month="${key}"]`)
  if (!target) return

  const targetRect = target.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  // Mois déjà entièrement à l'écran (réservation choisie sur le calendrier lui-même) : rien ne bouge.
  if (smooth && targetRect.top >= containerRect.top && targetRect.bottom <= containerRect.bottom) return

  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  container.scrollTo({
    top: container.scrollTop + targetRect.top - containerRect.top,
    behavior: smooth && !reduceMotion ? 'smooth' : 'auto',
  })
}

onMounted(() => scrollToFocusedMonth(false))

watch(
  () => [props.activeReservationId, monthRange.value.first, monthRange.value.last],
  async (next, previous) => {
    await nextTick()
    // Changement de logement (les mois changent) : sans animation. Autre réservation : en douceur.
    const sameMonths = previous && next[1] === previous[1] && next[2] === previous[2]
    scrollToFocusedMonth(Boolean(sameMonths))
  },
)
</script>

<template>
  <div
    class="management-calendar"
    :class="`is-${props.scope}`"
  >
    <div
      class="weekdays"
      aria-hidden="true"
    >
      <span
        v-for="(day, index) in WEEKDAYS"
        :key="`${day}-${index}`"
      >{{ day }}</span>
    </div>

    <div
      ref="scroller"
      class="months has-range"
    >
      <section
        v-for="month in months"
        :key="month.key"
        class="month"
        :data-month="month.key"
      >
        <h4 class="month-title">{{ month.title }}</h4>
        <!-- Pas de classe « grid » : c'est aussi un utilitaire Tailwind (display: grid). -->
        <table
          class="month-grid"
          :aria-label="month.title"
        >
          <tbody>
            <tr
              v-for="(week, weekIndex) in month.weeks"
              :key="`${month.key}-${weekIndex}`"
              class="row"
            >
              <td
                v-for="cell in week"
                :key="cell.iso"
                class="cell"
              >
                <button
                  v-if="cell.reservation"
                  type="button"
                  class="day"
                  :class="cell.classes"
                  v-bind="cell.attrs"
                  :aria-label="cell.label"
                  :aria-pressed="cell.reservation.id === props.activeReservationId"
                  @click="emit('select', cell.reservation.id)"
                >
                  {{ cell.day }}
                </button>
                <span
                  v-else
                  class="day"
                  :class="cell.classes"
                  v-bind="cell.attrs"
                  :aria-label="cell.label || undefined"
                  :aria-hidden="cell.outside ? 'true' : undefined"
                >{{ cell.day }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/views/Management/components/management-calendar.scss';
</style>
