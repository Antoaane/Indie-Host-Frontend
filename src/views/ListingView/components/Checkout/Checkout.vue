<!-- File: src/views/ListingView/components/Checkout/Checkout.vue -->

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { CalendarCheck, Minus, Plus, UsersRound } from 'lucide-vue-next'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { parseISO, todayCalendarDate, toISO } from '@/components/DatePicker/helpers/date'
import { makeIsDateDisabled } from '@/components/DatePicker/utils/range'
import DatePicker from '@/components/DatePicker/DatePicker.vue'

import type { BookedRange, FeeItem } from '@/views/ListingView/types/listing'

type OccupantKey = 'adults' | 'children' | 'babies' | 'animals' | 'pmr'

type ReservationPayload = {
  startISO: string | null
  endISO: string | null
  nights: number
  occupants: Record<OccupantKey, number>
  fees: FeeItem[]
  total: number
}

const MIN_NIGHTS = 2

const props = withDefaults(
  defineProps<{
    pricePerNight: number
    fees?: FeeItem[]
    bookedDays?: BookedRange[]
    modelValue?: RangeISO | null
  }>(),
  {
    pricePerNight: 0,
    fees: () => [],
    bookedDays: () => [],
    modelValue: null,
  },
)

const emit = defineEmits<{
  (e: 'reserve', payload: ReservationPayload): void
  (e: 'update:modelValue', value: RangeISO | null): void
}>()

const pricePerNight = computed(() => props.pricePerNight)
const fees = computed<FeeItem[]>(() => props.fees ?? [])
const bookedRanges = computed<RangeISO[]>(() =>
  props.bookedDays.map((range) => ({
    start: range.start,
    end: range.end,
  })),
)

const calendarOpen = ref(false)
const guestsOpen = ref(false)
const expanded = ref(false)

const selection = computed<RangeISO | null>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

function setSelection(range: RangeISO | null) {
  if (range && selection.value?.start === range.start && selection.value?.end === range.end) return
  if (!range && !selection.value) return
  selection.value = range
}

const occupants = reactive<Record<OccupantKey, number>>({
  adults: 2,
  children: 0,
  babies: 0,
  animals: 0,
  pmr: 0,
})

const isDateDisabled = computed(() => makeIsDateDisabled(bookedRanges.value))

function addDays(date: ReturnType<typeof todayCalendarDate>, days: number) {
  return date.add({ days })
}

function isRangeAvailable(start: ReturnType<typeof todayCalendarDate>, nights: number) {
  for (let offset = 0; offset <= nights; offset += 1) {
    const candidate = addDays(start, offset)
    if (isDateDisabled.value(candidate)) return false
  }
  return true
}

function findNextRange(minNights: number): RangeISO | null {
  const base = todayCalendarDate()
  for (let offset = 0; offset < 365 * 2; offset += 1) {
    const start = addDays(base, offset)
    if (isRangeAvailable(start, minNights)) {
      const end = addDays(start, minNights)
      return { start: toISO(start), end: toISO(end) }
    }
  }
  return null
}

const initialRange = findNextRange(MIN_NIGHTS)
if (!selection.value && initialRange) {
  setSelection(initialRange)
}

function isSelectedRangeValid() {
  if (!selection.value?.start || !selection.value?.end) return false
  const start = parseISO(selection.value.start)
  const stayNights = nights.value
  if (!stayNights) return false
  return isRangeAvailable(start, stayNights)
}

watch(bookedRanges, () => {
  if (!selection.value || !isSelectedRangeValid()) {
    setSelection(findNextRange(MIN_NIGHTS))
  }
})

watch(
  selection,
  (val) => {
    if (val?.start && val?.end) {
      if (!isSelectedRangeValid()) {
        setSelection(findNextRange(MIN_NIGHTS))
        return
      }
      calendarOpen.value = false
    }
  },
  { deep: true },
)

const nights = computed(() => {
  if (!selection.value?.start || !selection.value?.end) return 0
  const start = new Date(selection.value.start)
  const end = new Date(selection.value.end)
  const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  return diff > 0 ? Math.round(diff) : 0
})

const travelerCount = computed(() => occupants.adults + occupants.children)
const occupantLabel = computed(() => {
  const parts: string[] = []
  if (travelerCount.value) parts.push(`${travelerCount.value} voyageur${travelerCount.value > 1 ? 's' : ''}`)
  if (occupants.children) parts.push(`${occupants.children} enfant${occupants.children > 1 ? 's' : ''}`)
  if (occupants.babies) parts.push(`${occupants.babies} bébé${occupants.babies > 1 ? 's' : ''}`)
  if (occupants.animals) parts.push(`${occupants.animals} animal${occupants.animals > 1 ? 's' : ''} de compagnie`)
  if (occupants.pmr) parts.push(`${occupants.pmr} personne${occupants.pmr > 1 ? 's' : ''} PMR`)
  return parts.length ? parts.join(', ') : 'Ajouter des voyageurs'
})

function formatDateLabel(iso?: string | null) {
  if (!iso) return 'Ajouter une date'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Ajouter une date'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const rangeLabel = computed(() => {
  if (!selection.value?.start || !selection.value?.end || nights.value <= 0) return 'Sélectionnez vos dates'
  return `Du ${formatDateLabel(selection.value.start)} au ${formatDateLabel(selection.value.end)}`
})

const nightlyTotal = computed(() => nights.value * pricePerNight.value)
const feesTotal = computed(() => fees.value.reduce((acc, fee) => acc + (Number.isFinite(fee.amount) ? fee.amount : 0), 0))
const total = computed(() => nightlyTotal.value + feesTotal.value)

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const priceBreakdown = computed(() => {
  const list: Array<{ label: string; amount: string }> = []
  if (nights.value > 0) {
    list.push({
      label: `${nights.value} nuit${nights.value > 1 ? 's' : ''} (${currency.format(pricePerNight.value)} par nuit)`,
      amount: currency.format(nightlyTotal.value),
    })
  }
  fees.value.forEach((fee) => {
    list.push({
      label: fee.name,
      amount: currency.format(fee.amount),
    })
  })
  return list
})

const pricePerNightLabel = computed(() => `${currency.format(pricePerNight.value)} / nuit`)

const calendarLayer = ref<HTMLElement | null>(null)
const guestsLayer = ref<HTMLElement | null>(null)

onClickOutside(calendarLayer, () => {
  calendarOpen.value = false
})
onClickOutside(guestsLayer, () => {
  guestsOpen.value = false
})

function openCalendar() {
  if (!expanded.value) expanded.value = true
  guestsOpen.value = false
  calendarOpen.value = true
}

function toggleGuests() {
  calendarOpen.value = false
  guestsOpen.value = !guestsOpen.value
}

function updateCount(key: OccupantKey, delta: number) {
  const next = occupants[key] + delta
  const min = key === 'adults' ? 1 : 0
  occupants[key] = Math.max(min, next)
}

function reserve() {
  if (!selection.value?.start || !selection.value?.end || !nights.value) {
    calendarOpen.value = true
    return
  }

  const payload: ReservationPayload = {
    startISO: selection.value?.start ?? null,
    endISO: selection.value?.end ?? null,
    nights: nights.value,
    occupants: { ...occupants },
    fees: fees.value,
    total: total.value,
  }
  emit('reserve', payload)
}
</script>

<template>
  <section id="checkout">
    <div class="checkout-card">
      <div class="checkout-card__header">
        <h2>Vous réservez</h2>
        <transition name="price-toggle">
          <span
            v-if="!expanded"
            class="checkout-card__price"
          >
            {{ pricePerNightLabel }}
          </span>
        </transition>
        <!-- <button
          type="button"
          class="checkout-card__range"
          @click="openCalendar"
        >
          {{ rangeLabel }}
        </button> -->
      </div>

      <div class="checkout-card__fields">
        <div
          ref="calendarLayer"
          class="checkout-card__dates"
        >
          <div class="checkout-card__field-group checkout-card__field-group--single">
            <div class="btn-primary__white__full">
              <button
                type="button"
                class="checkout-card__field checkout-card__field--full"
                @click="openCalendar"
              >
                <span>Dates</span>
                <strong>{{ rangeLabel }}</strong>
              </button>
            </div>
          </div>

          <transition name="fade">
            <div
              v-if="calendarOpen"
              class="checkout-card__calendar"
            >
              <DatePicker
                v-model:model-value="selection"
                :disabled-dates="bookedRanges"
                :number-of-months="2"
              />
            </div>
          </transition>
        </div>

        <div
          ref="guestsLayer"
          class="checkout-card__guests"
        >
          <div class="btn-primary__white__full">
            <button
              type="button"
              class="checkout-card__field checkout-card__field--full"
              @click="toggleGuests"
            >
              <span>pour</span>
              <strong>{{ occupantLabel }}</strong>
            </button>
          </div>

          <transition name="fade">
            <div
              v-if="guestsOpen"
              class="checkout-card__dropdown"
            >
              <div class="checkout-card__dropdown-item">
                <div>
                  <p>Adultes</p>
                  <small>13 ans et plus</small>
                </div>
                <div class="checkout-card__counter">
                  <button
                    type="button"
                    aria-label="Retirer un adulte"
                    :disabled="occupants.adults <= 1"
                    @click="updateCount('adults', -1)"
                  >
                    <Minus :size="16" />
                  </button>
                  <span>{{ occupants.adults }}</span>
                  <button
                    type="button"
                    aria-label="Ajouter un adulte"
                    @click="updateCount('adults', 1)"
                  >
                    <Plus :size="16" />
                  </button>
                </div>
              </div>

              <div class="checkout-card__dropdown-item">
                <div>
                  <p>Enfants</p>
                  <small>2 à 12 ans</small>
                </div>
                <div class="checkout-card__counter">
                  <button
                    type="button"
                    aria-label="Retirer un enfant"
                    :disabled="occupants.children <= 0"
                    @click="updateCount('children', -1)"
                  >
                    <Minus :size="16" />
                  </button>
                  <span>{{ occupants.children }}</span>
                  <button
                    type="button"
                    aria-label="Ajouter un enfant"
                    @click="updateCount('children', 1)"
                  >
                    <Plus :size="16" />
                  </button>
                </div>
              </div>

              <div class="checkout-card__dropdown-item">
                <div>
                  <p>Bébés</p>
                  <small>Moins de 2 ans</small>
                </div>
                <div class="checkout-card__counter">
                  <button
                    type="button"
                    aria-label="Retirer un bébé"
                    :disabled="occupants.babies <= 0"
                    @click="updateCount('babies', -1)"
                  >
                    <Minus :size="16" />
                  </button>
                  <span>{{ occupants.babies }}</span>
                  <button
                    type="button"
                    aria-label="Ajouter un bébé"
                    @click="updateCount('babies', 1)"
                  >
                    <Plus :size="16" />
                  </button>
                </div>
              </div>

              <div class="checkout-card__dropdown-item">
                <div>
                  <p>Animaux</p>
                  <small>Chien, chat...</small>
                </div>
                <div class="checkout-card__counter">
                  <button
                    type="button"
                    aria-label="Retirer un animal"
                    :disabled="occupants.animals <= 0"
                    @click="updateCount('animals', -1)"
                  >
                    <Minus :size="16" />
                  </button>
                  <span>{{ occupants.animals }}</span>
                  <button
                    type="button"
                    aria-label="Ajouter un animal"
                    @click="updateCount('animals', 1)"
                  >
                    <Plus :size="16" />
                  </button>
                </div>
              </div>

              <div class="checkout-card__dropdown-item">
                <div>
                  <p>Personnes PMR</p>
                  <small>Besoin d’aménagement</small>
                </div>
                <div class="checkout-card__counter">
                  <button
                    type="button"
                    aria-label="Retirer une personne PMR"
                    :disabled="occupants.pmr <= 0"
                    @click="updateCount('pmr', -1)"
                  >
                    <Minus :size="16" />
                  </button>
                  <span>{{ occupants.pmr }}</span>
                  <button
                    type="button"
                    aria-label="Ajouter une personne PMR"
                    @click="updateCount('pmr', 1)"
                  >
                    <Plus :size="16" />
                  </button>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <transition name="summary-toggle">
        <div
          v-show="expanded"
          class="checkout-card__summary"
        >
          <div
            v-for="line in priceBreakdown"
            :key="line.label"
            class="checkout-card__line"
          >
            <p>{{ line.label }}</p>
            <span>{{ line.amount }}</span>
          </div>
          <div class="checkout-card__line checkout-card__line--total">
            <p>Total</p>
            <span>{{ currency.format(total) }}</span>
          </div>
        </div>
      </transition>

      <div class="checkout-card__cta">
        <div class="btn-primary__full">
          <button
            type="button"
            :disabled="!nights"
            @click="reserve"
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
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Checkout/checkout.scss';
</style>
