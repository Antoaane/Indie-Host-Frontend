<!-- File: src/views/CreateListing/_CreateListing.vue -->

<script setup lang="ts">
import { computed } from 'vue'

import type { EditorMode, EditorSource } from '@/views/Editor/types/editor'
import CreateListingFooterNavigation from '@/views/CreateListing/components/wizard/CreateListingFooterNavigation.vue'
import CreateListingHeader from '@/views/CreateListing/components/wizard/CreateListingHeader.vue'
import CreateListingLayout from '@/views/CreateListing/components/wizard/CreateListingLayout.vue'
import CreateListingProgressBar from '@/views/CreateListing/components/wizard/CreateListingProgressBar.vue'
import CreateListingStage from '@/views/CreateListing/components/wizard/CreateListingStage.vue'
import CreateListingStepsTabs from '@/views/CreateListing/components/wizard/CreateListingStepsTabs.vue'
import CreateGuestOnboardingStepPanel from '@/views/CreateListing/components/panels/CreateGuestOnboardingStepPanel.vue'
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
  activeStepIndex,
  isPreviewStage,
  isGuestTransitionStage,
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
  goBackFromGuestTransitionStage,
  guestEmail,
  guestEmailError,
  guestInfoMessage,
  isGuestOnboardingLoading,
  setGuestEmail,
  startGuestPublishOnboarding,
  startGuestSetupOnboarding,
  continueGuestWithoutAccount,
  cancelCreation,
  submitCreateListing,
} = useCreateListingWizard({
  mode: () => props.mode,
  source: () => props.source,
  userId: () => props.userId,
  isGuestFlow: () => props.mode === 'static',
  steps: createListingSteps(),
})

const submitError = computed(() => submitState.error)
</script>

<template>
  <CreateListingLayout>
    <!-- <CreateListingHeader
      v-if="!isPreviewStage"
      :active-step-index="activeStepIndex"
      :steps-count="stepItems.length"
      :title="currentStep.label"
      :description="currentStep.description"
      :is-submitting="submitState.isSubmitting"
      @cancel="cancelCreation"
    /> -->

    <CreateListingProgressBar
      v-if="!isPreviewStage && !isGuestTransitionStage"
      :progress-percent="progressPercent"
    />

    <CreateListingStepsTabs
      v-if="!isPreviewStage && !isGuestTransitionStage"
      :items="stepItems"
      @select="goToStep"
    />

    <CreateListingStage
      v-if="!isPreviewStage && !isGuestTransitionStage"
      :step="currentStep"
      :draft="draft"
      :step-error="stepError"
      @patch="applyDraftPatch"
      @next="goToNextStep"
    />

    <section
      v-else-if="isGuestTransitionStage"
      class="stage is-guest-onboarding"
    >
      <div class="slide">
        <CreateGuestOnboardingStepPanel
          :email="guestEmail"
          :email-error="guestEmailError"
          :info-message="guestInfoMessage"
          :is-loading="isGuestOnboardingLoading"
          @update:email="setGuestEmail"
          @back="goBackFromGuestTransitionStage"
          @start-publish="startGuestPublishOnboarding"
          @start-setup="startGuestSetupOnboarding"
          @continue-without-account="continueGuestWithoutAccount"
        />
      </div>
    </section>

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
      v-if="!isGuestTransitionStage"
      :is-last-step="isPreviewStage"
      :can-go-back="canGoBack"
      :can-go-next="canGoNext"
      :can-submit="canSubmit"
      :is-submitting="submitState.isSubmitting"
      submit-label="Créer mon annonce"
      submit-loading-label="Création de votre annonce..."
      @previous="goToPreviousStep"
      @next="goToNextStep"
      @submit="submitCreateListing"
    />
  </CreateListingLayout>
</template>

<style lang="scss">
@use '@/views/CreateListing/create-listing.scss';
</style>
