// File: src/views/CreateListing/wizard/useCreateListingWizard.ts

import { computed, onBeforeUnmount, onMounted, reactive, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useRouter } from 'vue-router'

import type { RawListingBundle } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import type { EditorMode, EditorSource } from '@/views/Editor/types/editor'
import {
  asNumber,
  buildInitialDraft,
  cleanText,
  deepMerge,
  normalizeBundleForCreate,
  normalizeDraft,
  CREATE_LISTING_STORAGE_PREFIX,
} from '@/views/CreateListing/wizard/createListingDraft'
import { buildEditorRoute } from '@/views/CreateListing/wizard/createListingRouting'
import type { CreateListingStep, CreateListingStepItem, PersistedCreateDraft } from '@/views/CreateListing/wizard/createListing.types'

type UseCreateListingWizardOptions = {
  mode: MaybeRefOrGetter<EditorMode>
  source: MaybeRefOrGetter<EditorSource>
  userId?: MaybeRefOrGetter<string | null | undefined>
  steps: CreateListingStep[]
}

export function useCreateListingWizard(options: UseCreateListingWizardOptions) {
  if (!options.steps.length) {
    throw new Error('[CreateListing] at least one step is required')
  }

  const router = useRouter()
  const steps = options.steps

  const draft = ref<RawListingBundle>(buildInitialDraft())
  const activeStepIndex = ref(0)
  const furthestVisitedStepIndex = ref(0)
  const isPreviewStage = ref(false)
  const stepError = ref<string | null>(null)
  const persistTimer = ref<number | null>(null)
  const hasHydratedStorage = ref(false)

  const submitState = reactive({
    isSubmitting: false,
    error: null as string | null,
  })

  const modeStorageKey = computed(() => {
    if (toValue(options.mode) !== 'user') return 'static'
    return `user:${cleanText(toValue(options.userId)) || 'anonymous'}`
  })

  const storageKey = computed(() => `${CREATE_LISTING_STORAGE_PREFIX}:${modeStorageKey.value}`)
  const currentStep = computed(() => steps[activeStepIndex.value] ?? steps[0])
  const isFirstStep = computed(() => activeStepIndex.value <= 0)
  const isLastStep = computed(() => activeStepIndex.value >= steps.length - 1)
  const progressPercent = computed(() => {
    const completedSteps = isPreviewStage.value ? steps.length : activeStepIndex.value + 1
    return Math.round((completedSteps / steps.length) * 100)
  })
  const canGoNext = computed(() => !submitState.isSubmitting && !isPreviewStage.value)
  const canGoBack = computed(() => !submitState.isSubmitting && (isPreviewStage.value || !isFirstStep.value))
  const canSubmit = computed(() => !submitState.isSubmitting && isPreviewStage.value)
  const stepItems = computed<CreateListingStepItem[]>(() =>
    steps.map((step, index) => ({
      id: step.id,
      label: step.label,
      index,
      isActive: !isPreviewStage.value && index === activeStepIndex.value,
      isDone: index < activeStepIndex.value || (isPreviewStage.value && index === activeStepIndex.value),
      isDisabled: submitState.isSubmitting || index > furthestVisitedStepIndex.value,
    })),
  )

  function clampStepIndex(index: number): number {
    return Math.max(0, Math.min(steps.length - 1, Math.trunc(asNumber(index, 0))))
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
        isPreviewStage.value = false
        stepError.value = nextError
        return false
      }
    }

    clearStepError()
    return true
  }

  function goToStep(index: number) {
    if (submitState.isSubmitting) return
    const safeIndex = clampStepIndex(index)
    if (safeIndex > furthestVisitedStepIndex.value) return
    isPreviewStage.value = false
    activeStepIndex.value = safeIndex
  }

  function goToPreviousStep() {
    if (!canGoBack.value) return
    clearStepError()
    if (isPreviewStage.value) {
      isPreviewStage.value = false
      return
    }
    activeStepIndex.value = Math.max(0, activeStepIndex.value - 1)
  }

  function goToNextStep() {
    if (!canGoNext.value) return
    if (!validateStep(activeStepIndex.value)) return

    if (isLastStep.value) {
      clearStepError()
      isPreviewStage.value = true
      return
    }

    const nextIndex = Math.min(steps.length - 1, activeStepIndex.value + 1)
    activeStepIndex.value = nextIndex
    furthestVisitedStepIndex.value = Math.max(furthestVisitedStepIndex.value, nextIndex)
  }

  function flushStorageDraft() {
    if (typeof window === 'undefined' || !hasHydratedStorage.value) return
    if (persistTimer.value) {
      window.clearTimeout(persistTimer.value)
      persistTimer.value = null
    }

    const payload: PersistedCreateDraft = {
      stepIndex: activeStepIndex.value,
      furthestStepIndex: furthestVisitedStepIndex.value,
      isPreviewStage: isPreviewStage.value,
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
    if (persistTimer.value) {
      window.clearTimeout(persistTimer.value)
      persistTimer.value = null
    }
    try {
      window.localStorage.removeItem(storageKey.value)
    } catch (err) {
      console.log('[CreateListing] failed to clear draft', err)
    }
  }

  function disableStoragePersistence() {
    if (typeof window !== 'undefined' && persistTimer.value) {
      window.clearTimeout(persistTimer.value)
      persistTimer.value = null
    }
    hasHydratedStorage.value = false
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
        const restoredStepIndex = clampStepIndex(asNumber(parsed.stepIndex, 0))
        const restoredFurthestStepIndex = clampStepIndex(asNumber(parsed.furthestStepIndex, restoredStepIndex))
        activeStepIndex.value = restoredStepIndex
        furthestVisitedStepIndex.value = Math.max(restoredStepIndex, restoredFurthestStepIndex)
        isPreviewStage.value = Boolean(parsed.isPreviewStage) && restoredStepIndex >= steps.length - 1
      }
    } catch (err) {
      console.log('[CreateListing] failed to restore draft', err)
    } finally {
      hasHydratedStorage.value = true
    }
  }

  async function cancelCreation() {
    if (submitState.isSubmitting) return
    await router.push(
      buildEditorRoute({
        mode: toValue(options.mode),
        userId: toValue(options.userId),
      }),
    )
  }

  async function submitCreateListing() {
    if (!canSubmit.value) return
    submitState.error = null

    if (!validateRequiredSteps()) return

    submitState.isSubmitting = true
    try {
      const payload = normalizeBundleForCreate(draft.value)
      const { listingId } = await toValue(options.source).createListing(payload)
      disableStoragePersistence()
      clearStorageDraft()
      await router.push(
        buildEditorRoute({
          mode: toValue(options.mode),
          userId: toValue(options.userId),
          listingId,
        }),
      )
    } catch (err: any) {
      submitState.error = err?.message ?? 'Impossible de créer votre annonce pour le moment.'
    } finally {
      submitState.isSubmitting = false
    }
  }

  watch(
    [
      draft,
      activeStepIndex,
      isPreviewStage,
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

  return {
    steps,
    stepItems,
    draft,
    activeStepIndex,
    isPreviewStage,
    currentStep,
    stepError,
    submitState,
    isFirstStep,
    isLastStep,
    progressPercent,
    canGoNext,
    canGoBack,
    canSubmit,
    applyDraftPatch,
    goToStep,
    goToPreviousStep,
    goToNextStep,
    cancelCreation,
    submitCreateListing,
    clearStorageDraft,
    flushStorageDraft,
    restoreStorageDraft,
  }
}
