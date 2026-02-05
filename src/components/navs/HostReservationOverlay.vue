<!-- File: src/components/navs/HostReservationOverlay.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Minus, Plus, X } from 'lucide-vue-next'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { makeIsDateDisabled } from '@/components/DatePicker/utils/range'
import DatePicker from '@/components/DatePicker/DatePicker.vue'

import { type OccupantCounts } from '@/views/ListingView/components/Booking/utils/labels'
import { findNextRange, isSelectedRangeValid } from '@/views/ListingView/components/Booking/utils/range'
import { createStaticEditorSource } from '@/views/Editor/utils/editorSourceStatic'
import type { UserListingCard } from '@/views/Editor/utils/listingApi'

const props = withDefaults(
  defineProps<{
    open: boolean
    anchor: HTMLElement | HTMLElement[] | null
    bookedRanges?: RangeISO[]
  }>(),
  {
    bookedRanges: () => [],
  },
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: ReservationDraft): void
}>()

type OccupantKey = keyof OccupantCounts

type ReservationDraft = {
  listingId: string | null
  startISO: string | null
  endISO: string | null
  nights: number
  occupants: OccupantCounts
  notes: string
  contact: {
    firstName: string
    lastName: string
    phone: string
    email: string
  }
}

const overlayRef = ref<HTMLElement | null>(null)
const position = reactive({ top: 0, left: 0 })
const anchorEl = computed<HTMLElement | null>(() => {
  const anchor = props.anchor
  if (Array.isArray(anchor)) return anchor.find(Boolean) ?? null
  return anchor ?? null
})
const listings = ref<UserListingCard[]>([])
const selectedListingId = ref<string | null>(null)

const form = reactive({
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  notes: '',
})

const selection = ref<RangeISO | null>(null)

const occupants = reactive<OccupantCounts>({
  adults: 1,
  children: 0,
  babies: 0,
  animals: 0,
  pmr: 0,
})

const bookedRanges = computed<RangeISO[]>(() => props.bookedRanges ?? [])
const isDateDisabled = computed(() => makeIsDateDisabled(bookedRanges.value))

const nights = computed(() => {
  if (!selection.value?.start || !selection.value?.end) return 0
  const start = new Date(selection.value.start)
  const end = new Date(selection.value.end)
  const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  return diff > 0 ? Math.round(diff) : 0
})

const overlayStyle = computed(() => ({
  top: `${position.top}px`,
  left: `${position.left}px`,
}))

const MIN_NIGHTS = 2

function setSelection(range: RangeISO | null) {
  if (range?.start === selection.value?.start && range?.end === selection.value?.end) return
  selection.value = range
}

const initialRange = findNextRange(MIN_NIGHTS, isDateDisabled.value)
if (!selection.value && initialRange) {
  setSelection(initialRange)
}

watch(bookedRanges, () => {
  if (!selection.value || !isSelectedRangeValid(selection.value, nights.value, isDateDisabled.value)) {
    setSelection(findNextRange(MIN_NIGHTS, isDateDisabled.value))
  }
})

watch(
  () => selection.value,
  (val) => {
    if (val?.start && val?.end) {
      if (!isSelectedRangeValid(selection.value, nights.value, isDateDisabled.value)) {
        setSelection(findNextRange(MIN_NIGHTS, isDateDisabled.value))
        return
      }
    }
  },
  { deep: true },
)

function updateCount(key: OccupantKey, delta: number) {
  const next = occupants[key] + delta
  const min = key === 'adults' ? 1 : 0
  occupants[key] = Math.max(min, next)
}

function submit() {
  if (!selectedListingId.value) return
  if (!selection.value?.start || !selection.value?.end || !nights.value) return

  const payload: ReservationDraft = {
    listingId: selectedListingId.value,
    startISO: selection.value?.start ?? null,
    endISO: selection.value?.end ?? null,
    nights: nights.value,
    occupants: { ...occupants },
    notes: form.notes,
    contact: {
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      email: form.email,
    },
  }

  emit('submit', payload)
  emit('close')
}

async function loadListings() {
  if (listings.value.length) return
  const source = createStaticEditorSource()
  listings.value = await source.fetchListings()
  if (!selectedListingId.value) {
    selectedListingId.value = listings.value[0]?.listingId ?? null
  }
}

function updatePosition() {
  if (!props.open || !anchorEl.value) return
  const rect = anchorEl.value.getBoundingClientRect()
  const overlayWidth = overlayRef.value?.offsetWidth ?? 420
  const viewportWidth = window.innerWidth
  const gap = 12

  let left = rect.left + rect.width / 2 - overlayWidth / 2
  left = Math.max(gap, Math.min(left, viewportWidth - overlayWidth - gap))

  position.top = rect.bottom + gap
  position.left = left
}

function handlePointer(event: PointerEvent) {
  if (!props.open) return
  const target = event.target as Node | null
  if (!target) return
  if (overlayRef.value?.contains(target)) return
  if (anchorEl.value?.contains(target)) return
  emit('close')
}

function handleKey(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    updatePosition()
  },
)

watch(
  () => anchorEl.value,
  async () => {
    if (!props.open || !anchorEl.value) return
    await nextTick()
    updatePosition()
  },
)

onMounted(() => {
  loadListings()
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, { passive: true })
  window.addEventListener('pointerdown', handlePointer)
  window.addEventListener('keydown', handleKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition)
  window.removeEventListener('pointerdown', handlePointer)
  window.removeEventListener('keydown', handleKey)
})
</script>

<template>
  <Teleport to="body">
    <transition name="fade">
      <div
        v-if="props.open"
        id="host-reservation-overlay"
        ref="overlayRef"
        class="host-reservation-overlay"
        :style="overlayStyle"
        role="dialog"
        aria-label="Nouvelle r&eacute;servation"
      >
        <div class="panel">
          <div class="header">
            <h3>Nouvelle r&eacute;servation</h3>
            <button
              type="button"
              class="close"
              aria-label="Fermer"
              @click="emit('close')"
            >
              <X :size="16" />
            </button>
          </div>

          <div class="fields">
            <label class="field">
              <select
                v-model="selectedListingId"
                :disabled="!listings.length"
                aria-label="Annonce"
              >
                <option
                  value=""
                  disabled
                >
                  Choisir une annonce
                </option>
                <option
                  v-for="listing in listings"
                  :key="listing.listingId"
                  :value="listing.listingId"
                >
                  {{ listing.title }}
                </option>
              </select>
            </label>
            <label class="field">
              <input
                v-model="form.firstName"
                type="text"
                placeholder="Pr&eacute;nom"
                autocomplete="given-name"
              />
            </label>
            <label class="field">
              <input
                v-model="form.lastName"
                type="text"
                placeholder="Nom"
                autocomplete="family-name"
              />
            </label>
            <label class="field">
              <input
                v-model="form.phone"
                type="tel"
                placeholder="Num&eacute;ro de t&eacute;l"
                autocomplete="tel"
              />
            </label>
            <label class="field">
              <input
                v-model="form.email"
                type="email"
                placeholder="Adresse e-mail"
                autocomplete="email"
              />
            </label>
            <label class="field">
              <textarea
                v-model="form.notes"
                rows="3"
                placeholder="Informations additionnelles"
              />
            </label>
          </div>

          <section class="section">
            <h4>Dur&eacute;e du s&eacute;jour</h4>
            <div class="listing-checkout-dates is-inline">
              <div class="calendar">
                <DatePicker
                  v-model:model-value="selection"
                  :disabled-dates="bookedRanges"
                  :numberOfMonths="2"
                />
              </div>
            </div>
          </section>

          <section class="section">
            <h4>Nombre de voyageurs</h4>
            <div class="listing-checkout-guests is-inline">
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

                <div class="item">
                  <div>
                    <p>Enfants</p>
                    <small>2 &agrave; 12 ans</small>
                  </div>
                  <div class="counter">
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

                <div class="item">
                  <div>
                    <p>B&eacute;b&eacute;s</p>
                    <small>Moins de 2 ans</small>
                  </div>
                  <div class="counter">
                    <button
                      type="button"
                      aria-label="Retirer un b&eacute;b&eacute;"
                      :disabled="occupants.babies <= 0"
                      @click="updateCount('babies', -1)"
                    >
                      <Minus :size="16" />
                    </button>
                    <span>{{ occupants.babies }}</span>
                    <button
                      type="button"
                      aria-label="Ajouter un b&eacute;b&eacute;"
                      @click="updateCount('babies', 1)"
                    >
                      <Plus :size="16" />
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

                <div class="item">
                  <div>
                    <p>Personnes PMR</p>
                    <small>Besoin d'am&eacute;nagement</small>
                  </div>
                  <div class="counter">
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
            </div>
          </section>

          <div class="actions">
            <div class="btn-primary__black__full">
              <button
                type="button"
                :disabled="!nights"
                @click="submit"
              >
                Ajouter une r&eacute;servation
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style lang="scss">
@use '@/components/navs/host-reservation-overlay.scss';
</style>
