<!-- File: src/views/CreateListing/_CreateListing.vue -->

<script setup lang="ts">
import { computed } from 'vue'

import type { EditorMode, EditorSource } from '@/views/Editor/types/editor'
import CreateListingFooterNavigation from '@/views/CreateListing/components/wizard/CreateListingFooterNavigation.vue'
import CreateListingLayout from '@/views/CreateListing/components/wizard/CreateListingLayout.vue'
import CreateListingProgressBar from '@/views/CreateListing/components/wizard/CreateListingProgressBar.vue'
import CreateListingStage from '@/views/CreateListing/components/wizard/CreateListingStage.vue'
import CreateListingStepsTabs from '@/views/CreateListing/components/wizard/CreateListingStepsTabs.vue'
import CreateListingPreviewStepPanel from '@/views/CreateListing/components/panels/CreateListingPreviewStepPanel.vue'
import { createListingSteps } from '@/views/CreateListing/wizard/createListingSteps'
import { useCreateListingWizard } from '@/views/CreateListing/wizard/useCreateListingWizard'

const props = defineProps<{
  mode: EditorMode
  source: EditorSource
  userId?: string | null
}>()

const {
  stepItems,
  draft,
  currentStep,
  isPreviewStage,
  stepError,
  submitState,
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
} = useCreateListingWizard({
  mode: () => props.mode,
  source: () => props.source,
  userId: () => props.userId,
  steps: createListingSteps(),
})

const submitError = computed(() => submitState.error)
</script>

<template>
  <CreateListingLayout>
    <!-- <div
      v-if="!isPreviewStage"
      class="btn-primary__white quit-floating"
    >
      <button
        type="button"
        :disabled="submitState.isSubmitting"
        @click="cancelCreation"
      >
        Quitter
      </button>
    </div> -->

    <CreateListingProgressBar
      v-if="!isPreviewStage"
      :progress-percent="progressPercent"
    />

    <CreateListingStepsTabs
      v-if="!isPreviewStage"
      :items="stepItems"
      @select="goToStep"
    />

    <CreateListingStage
      v-if="!isPreviewStage"
      :step="currentStep"
      :draft="draft"
      :step-error="stepError"
      @patch="applyDraftPatch"
    />

    <section
      v-else
      class="stage is-preview"
    >
      <div class="slide">
        <CreateListingPreviewStepPanel :raw-listing="draft" />
      </div>
    </section>

    <p
      v-if="submitError"
      class="error"
    >
      {{ submitError }}
    </p>

    <CreateListingFooterNavigation
      :is-last-step="isPreviewStage"
      :can-go-back="canGoBack"
      :can-go-next="canGoNext"
      :can-submit="canSubmit"
      :is-submitting="submitState.isSubmitting"
      submit-label="Consulter mon annonce"
      submit-loading-label="Création de l’annonce..."
      @previous="goToPreviousStep"
      @next="goToNextStep"
      @submit="submitCreateListing"
    />
  </CreateListingLayout>
</template>

<style lang="scss">
@use '@/views/CreateListing/create-listing.scss';
</style>
