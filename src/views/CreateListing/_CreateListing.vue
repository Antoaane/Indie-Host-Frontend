<!-- File: src/views/CreateListing/_CreateListing.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRouter } from 'vue-router'

import type { RawBookings, RawCore, RawListingBundle, RawMedias } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import type { EditorMode, EditorSource } from '@/views/Editor/types/editor'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { normalizeListingStatus } from '@/domain/listings/status'

import TitlePanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/TitlePanel.vue'
import LocationPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/LocationPanel.vue'
import CapacityPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/CapacityPanel.vue'
import RoomsPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/RoomsPanel.vue'
import AmenitiesPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/AmenitiesPanel.vue'
import GalleryPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/GalleryPanel.vue'
import DescriptionPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/DescriptionPanel.vue'
import BasePricingPanel from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/BasePricingPanel.vue'
import CreateListingSummarySlide from '@/views/CreateListing/components/CreateListingSummarySlide.vue'

const props = defineProps<{
  mode: EditorMode
  source: EditorSource
  userId?: string | null
}>()

const router = useRouter()

const STORAGE_PREFIX = 'indiehost:create-listing:draft:v1'

type PersistedCreateDraft = {
  stepIndex: number
  draft: RawListingBundle
  updatedAt: string
}

type CreateListingStep = {
  id: string
  label: string
  description: string
  component: Component
  props: (draft: RawListingBundle) => Record<string, unknown>
  acceptsPatch?: boolean
  validate?: (draft: RawListingBundle) => string | null
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function asNumber(value: unknown, fallback: number): number {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function deepMerge(target: any, source: any): any {
  if (source === null || source === undefined) return source
  if (Array.isArray(source)) return source
  if (typeof source !== 'object') return source

  const baseValue = target && typeof target === 'object' && !Array.isArray(target) ? target : {}
  const merged: Record<string, any> = { ...baseValue }

  Object.entries(source as Record<string, any>).forEach(
    ([
      key,
      value,
    ]) => {
      if (Array.isArray(value) || value === null || typeof value !== 'object') {
        merged[key] = value
      } else {
        merged[key] = deepMerge(baseValue[key], value)
      }
    },
  )

  return merged
}

function buildInitialDraft(): RawListingBundle {
  return {
    core: {
      status: 'draft',
      title: '',
      type: '',
      city: '',
      country: '',
      region: '',
      guest_capacity: 1,
      rooms: [],
      amenities: [],
    },
    bookings: {
      price: 0,
      fees: [],
      'booked-days': [],
      reservations: [],
      pricing: {
        deposit: {
          type: 'info',
          amount: 0,
        },
      },
    } as Partial<RawBookings>,
    medias: {
      images: [],
      videos: [],
    },
    arrival: null,
  }
}

function normalizeDraft(input?: RawListingBundle | null): RawListingBundle {
  const base = buildInitialDraft()
  if (!input) return base

  return {
    ...base,
    ...input,
    core: deepMerge(base.core ?? {}, input.core ?? {}),
    bookings: deepMerge(base.bookings ?? {}, input.bookings ?? {}),
    medias: deepMerge(base.medias ?? {}, input.medias ?? {}),
    arrival: input.arrival ?? base.arrival,
  }
}

function validateTitle(bundle: RawListingBundle): string | null {
  const title = cleanText(bundle.core?.title)
  if (!title) return 'Ajoute un titre pour continuer.'
  if (title.length < 6) return 'Le titre doit contenir au moins 6 caractères.'
  return null
}

function validateLocation(bundle: RawListingBundle): string | null {
  const type = cleanText(bundle.core?.type)
  const city = cleanText(bundle.core?.city)
  const country = cleanText(bundle.core?.country)
  if (!type || !city || !country) {
    return 'Renseigne le type de logement, la ville et le pays.'
  }
  return null
}

function validateCapacity(bundle: RawListingBundle): string | null {
  const capacity = asNumber(bundle.core?.guest_capacity, 0)
  if (capacity < 1) return 'Indique une capacité d’accueil d’au moins 1 voyageur.'
  return null
}

function validateMedia(bundle: RawListingBundle): string | null {
  const images = bundle.medias?.images
  if (!Array.isArray(images) || !images.some((image) => typeof image?.src === 'string' && image.src.trim())) {
    return 'Ajoute au moins une photo du logement.'
  }
  return null
}

function validateDescription(bundle: RawListingBundle): string | null {
  const description = stripHtml(bundle.core?.description ?? '')
  if (description.length < 30) {
    return 'Ajoute une description plus détaillée (minimum 30 caractères).'
  }
  return null
}

function validatePricing(bundle: RawListingBundle): string | null {
  const price = asNumber(bundle.bookings?.price, 0)
  if (price <= 0) return 'Indique un prix de base supérieur à 0 €.'
  return null
}

const listingContent = editorStatic.panels.listing
const pricingContent = editorStatic.panels.pricing

const steps: CreateListingStep[] = [
  {
    id: 'title',
    label: listingContent.title.title,
    description: listingContent.title.subtitle,
    component: TitlePanel,
    props: (draft) => ({ core: draft.core }),
    acceptsPatch: true,
    validate: validateTitle,
  },
  {
    id: 'location',
    label: listingContent.location.title,
    description: listingContent.location.subtitle,
    component: LocationPanel,
    props: (draft) => ({ core: draft.core }),
    acceptsPatch: true,
    validate: validateLocation,
  },
  {
    id: 'capacity',
    label: listingContent.capacity.title,
    description: listingContent.capacity.subtitle,
    component: CapacityPanel,
    props: (draft) => ({ core: draft.core }),
    acceptsPatch: true,
    validate: validateCapacity,
  },
  {
    id: 'rooms',
    label: listingContent.rooms.title,
    description: listingContent.rooms.subtitle,
    component: RoomsPanel,
    props: (draft) => ({ core: draft.core }),
    acceptsPatch: true,
  },
  {
    id: 'amenities',
    label: listingContent.amenities.title,
    description: listingContent.amenities.subtitle,
    component: AmenitiesPanel,
    props: (draft) => ({ core: draft.core }),
    acceptsPatch: true,
  },
  {
    id: 'gallery',
    label: listingContent.gallery.title,
    description: listingContent.gallery.subtitle,
    component: GalleryPanel,
    props: (draft) => ({ medias: draft.medias }),
    acceptsPatch: true,
    validate: validateMedia,
  },
  {
    id: 'description',
    label: listingContent.description.title,
    description: listingContent.description.subtitle,
    component: DescriptionPanel,
    props: (draft) => ({ core: draft.core }),
    acceptsPatch: true,
    validate: validateDescription,
  },
  {
    id: 'pricing',
    label: pricingContent.base.title,
    description: pricingContent.base.subtitle,
    component: BasePricingPanel,
    props: (draft) => ({ bookings: draft.bookings }),
    acceptsPatch: true,
    validate: validatePricing,
  },
  {
    id: 'summary',
    label: 'Validation finale',
    description: 'Vérifie les données, puis crée ton annonce.',
    component: CreateListingSummarySlide,
    props: (draft) => ({ draft }),
  },
]

const draft = ref<RawListingBundle>(buildInitialDraft())
const activeStepIndex = ref(0)
const stepError = ref<string | null>(null)
const persistTimer = ref<number | null>(null)
const hasHydratedStorage = ref(false)

const submitState = reactive({
  isSubmitting: false,
  error: null as string | null,
})

const modeStorageKey = computed(() => {
  if (props.mode !== 'user') return 'static'
  return `user:${cleanText(props.userId) || 'anonymous'}`
})

const storageKey = computed(() => `${STORAGE_PREFIX}:${modeStorageKey.value}`)
const currentStep = computed(() => steps[activeStepIndex.value] ?? steps[0])
const isFirstStep = computed(() => activeStepIndex.value <= 0)
const isLastStep = computed(() => activeStepIndex.value >= steps.length - 1)
const progressPercent = computed(() => Math.round(((activeStepIndex.value + 1) / steps.length) * 100))
const canGoNext = computed(() => !submitState.isSubmitting && !isLastStep.value)
const canGoBack = computed(() => !submitState.isSubmitting && !isFirstStep.value)
const canSubmit = computed(() => !submitState.isSubmitting && isLastStep.value)

const editorRouteName = computed(() => (props.mode === 'user' ? 'editor-user' : 'editor'))

function buildEditorRoute(listingId?: string) {
  const query = listingId ? { listingId } : undefined
  const userId = cleanText(props.userId)
  if (props.mode === 'user' && userId) {
    return {
      name: editorRouteName.value,
      params: { userId },
      query,
    }
  }

  return {
    name: editorRouteName.value,
    query,
  }
}

function clearStepError() {
  stepError.value = null
}

function applyDraftPatch(patch: DraftPatch) {
  draft.value = {
    ...draft.value,
    core: patch.core
      ? {
          ...(draft.value.core ?? {}),
          ...patch.core,
        }
      : draft.value.core,
    bookings: patch.bookings
      ? {
          ...(draft.value.bookings ?? {}),
          ...patch.bookings,
        }
      : draft.value.bookings,
    medias: patch.medias
      ? {
          ...(draft.value.medias ?? {}),
          ...patch.medias,
        }
      : draft.value.medias,
    arrival: patch.arrival ? deepMerge(draft.value.arrival, patch.arrival) : draft.value.arrival,
  }

  clearStepError()
  submitState.error = null
}

function validateStep(index: number): boolean {
  const validator = steps[index]?.validate
  if (!validator) {
    clearStepError()
    return true
  }

  const nextError = validator(draft.value)
  stepError.value = nextError
  return !nextError
}

function validateRequiredSteps(): boolean {
  for (let index = 0; index < steps.length; index += 1) {
    const validator = steps[index]?.validate
    if (!validator) continue

    const nextError = validator(draft.value)
    if (nextError) {
      activeStepIndex.value = index
      stepError.value = nextError
      return false
    }
  }

  clearStepError()
  return true
}

function goToPreviousStep() {
  if (!canGoBack.value) return
  clearStepError()
  activeStepIndex.value = Math.max(0, activeStepIndex.value - 1)
}

function goToNextStep() {
  if (!canGoNext.value) return
  if (!validateStep(activeStepIndex.value)) return
  activeStepIndex.value = Math.min(steps.length - 1, activeStepIndex.value + 1)
}

function normalizeBundleForCreate(bundle: RawListingBundle): RawListingBundle {
  const sourceCore = (bundle.core ?? {}) as Partial<RawCore>
  const sourceBookings = (bundle.bookings ?? {}) as Partial<RawBookings>
  const sourceMedias = (bundle.medias ?? {}) as Partial<RawMedias>

  const normalizedCore: Partial<RawCore> = {
    ...sourceCore,
    status: normalizeListingStatus(String(sourceCore.status ?? '')) || 'draft',
    title: cleanText(sourceCore.title) || 'Nouvelle annonce',
    type: cleanText(sourceCore.type),
    city: cleanText(sourceCore.city),
    country: cleanText(sourceCore.country),
    region: cleanText(sourceCore.region),
    guest_capacity: Math.max(1, Math.round(asNumber(sourceCore.guest_capacity, 1))),
    amenities: Array.isArray(sourceCore.amenities) ? sourceCore.amenities : [],
    rooms: Array.isArray(sourceCore.rooms) ? sourceCore.rooms : [],
  }

  const normalizedBookings: Partial<RawBookings> = {
    ...sourceBookings,
    price: Math.max(0, Math.round(asNumber(sourceBookings.price, 0))),
    fees: Array.isArray(sourceBookings.fees) ? sourceBookings.fees : [],
    'booked-days': Array.isArray(sourceBookings['booked-days']) ? sourceBookings['booked-days'] : [],
    reservations: Array.isArray(sourceBookings.reservations) ? sourceBookings.reservations : [],
  }

  const normalizedImages = Array.isArray(sourceMedias.images)
    ? sourceMedias.images
        .filter((image) => typeof image?.src === 'string' && image.src.trim())
        .map((image, index) => ({
          ...image,
          src: image.src.trim(),
          position: typeof image.position === 'number' ? image.position : index,
        }))
    : []

  const normalizedMedias: Partial<RawMedias> = {
    ...sourceMedias,
    images: normalizedImages,
    videos: Array.isArray(sourceMedias.videos) ? sourceMedias.videos : [],
  }

  return {
    ...bundle,
    core: normalizedCore,
    bookings: normalizedBookings,
    medias: normalizedMedias,
  }
}

function flushStorageDraft() {
  if (typeof window === 'undefined' || !hasHydratedStorage.value) return
  if (persistTimer.value) {
    window.clearTimeout(persistTimer.value)
    persistTimer.value = null
  }

  const payload: PersistedCreateDraft = {
    stepIndex: activeStepIndex.value,
    draft: draft.value,
    updatedAt: new Date().toISOString(),
  }

  try {
    window.localStorage.setItem(storageKey.value, JSON.stringify(payload))
  } catch (err) {
    console.log('[CreateListing] failed to persist draft', err)
  }
}

function queueStorageDraft() {
  if (typeof window === 'undefined' || !hasHydratedStorage.value) return
  if (persistTimer.value) {
    window.clearTimeout(persistTimer.value)
  }

  persistTimer.value = window.setTimeout(() => {
    flushStorageDraft()
  }, 250)
}

function clearStorageDraft() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey.value)
  } catch (err) {
    console.log('[CreateListing] failed to clear draft', err)
  }
}

function restoreStorageDraft() {
  if (typeof window === 'undefined') {
    hasHydratedStorage.value = true
    return
  }

  try {
    const raw = window.localStorage.getItem(storageKey.value)
    if (!raw) {
      hasHydratedStorage.value = true
      return
    }

    const parsed = JSON.parse(raw) as PersistedCreateDraft
    if (parsed && typeof parsed === 'object') {
      draft.value = normalizeDraft(parsed.draft)
      const index = asNumber(parsed.stepIndex, 0)
      activeStepIndex.value = Math.max(0, Math.min(steps.length - 1, Math.trunc(index)))
    }
  } catch (err) {
    console.log('[CreateListing] failed to restore draft', err)
  } finally {
    hasHydratedStorage.value = true
  }
}

async function cancelCreation() {
  if (submitState.isSubmitting) return
  await router.push(buildEditorRoute())
}

async function submitCreateListing() {
  if (!canSubmit.value) return
  submitState.error = null

  if (!validateRequiredSteps()) return

  submitState.isSubmitting = true
  try {
    const payload = normalizeBundleForCreate(draft.value)
    const { listingId } = await props.source.createListing(payload)
    clearStorageDraft()
    await router.push(buildEditorRoute(listingId))
  } catch (err: any) {
    submitState.error = err?.message ?? 'Impossible de créer l’annonce.'
  } finally {
    submitState.isSubmitting = false
  }
}

watch(
  [
    draft,
    activeStepIndex,
  ],
  () => {
    queueStorageDraft()
  },
  { deep: true },
)

onMounted(() => {
  restoreStorageDraft()
})

onBeforeUnmount(() => {
  flushStorageDraft()
})
</script>

<template>
  <main
    id="create-listing-page"
    class="create-listing"
  >
    <div class="layout">
      <div class="header">
        <div class="step-title">
          <p> Étape {{ activeStepIndex + 1 }} / {{ steps.length }} </p>
          <h1>{{ currentStep.label }}</h1>
          <small>{{ currentStep.description }}</small>
        </div>

        <div class="btn-primary__white">
          <button
            type="button"
            :disabled="submitState.isSubmitting"
            @click="cancelCreation"
          >
            Quitter
          </button>
        </div>
      </div>

      <div class="progress">
        <div
          class="bar"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <div class="steps">
        <button
          v-for="(step, index) in steps"
          :key="step.id"
          class="step"
          :class="{
            'is-active': index === activeStepIndex,
            'is-done': index < activeStepIndex,
          }"
          type="button"
          :disabled="index > activeStepIndex || submitState.isSubmitting"
          @click="activeStepIndex = index"
        >
          <span>{{ index + 1 }}</span>
          <small>{{ step.label }}</small>
        </button>
      </div>

      <section class="stage">
        <Transition
          name="create-slide"
          mode="out-in"
        >
          <div
            :key="currentStep.id"
            class="slide"
          >
            <component
              :is="currentStep.component"
              v-bind="currentStep.props(draft)"
              v-on="currentStep.acceptsPatch ? { patch: applyDraftPatch } : {}"
            />
          </div>
        </Transition>
      </section>

      <p
        v-if="stepError || submitState.error"
        class="error"
      >
        {{ stepError || submitState.error }}
      </p>

      <footer class="footer">
        <div class="btn-primary__white">
          <button
            type="button"
            :disabled="!canGoBack"
            @click="goToPreviousStep"
          >
            Précédent
          </button>
        </div>

        <div
          v-if="!isLastStep"
          class="btn-primary__black"
        >
          <button
            type="button"
            :disabled="!canGoNext"
            @click="goToNextStep"
          >
            Continuer
          </button>
        </div>

        <div
          v-else
          class="btn-primary__black"
        >
          <button
            type="button"
            :disabled="!canSubmit"
            @click="submitCreateListing"
          >
            {{ submitState.isSubmitting ? 'Création...' : 'Créer l’annonce' }}
          </button>
        </div>
      </footer>
    </div>
  </main>
</template>

<style lang="scss">
@use '@/views/CreateListing/create-listing.scss';
</style>
