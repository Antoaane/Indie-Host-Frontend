<!-- File: src/views/CreateListing/components/wizard/CreateListingFooterNavigation.vue -->

<script setup lang="ts">
const props = withDefaults(defineProps<{
  isLastStep: boolean
  canGoBack: boolean
  canGoNext: boolean
  canSubmit: boolean
  isSubmitting: boolean
  submitLabel?: string
  submitLoadingLabel?: string
}>(), {
  submitLabel: 'Créer l’annonce',
  submitLoadingLabel: 'Création...',
})

const emit = defineEmits<{
  (e: 'previous'): void
  (e: 'next'): void
  (e: 'submit'): void
}>()
</script>

<template>
  <footer class="footer">
    <div class="btn-primary__white">
      <button
        type="button"
        :disabled="!props.canGoBack"
        @click="emit('previous')"
      >
        Précédent
      </button>
    </div>

    <div
      v-if="!props.isLastStep"
      class="btn-primary__black"
    >
      <button
        type="button"
        :disabled="!props.canGoNext"
        @click="emit('next')"
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
        :disabled="!props.canSubmit"
        :class="{ 'is-loading': props.isSubmitting }"
        @click="emit('submit')"
      >
        <span
          v-if="props.isSubmitting"
          class="loading-dot"
          aria-hidden="true"
        />
        {{ props.isSubmitting ? props.submitLoadingLabel : props.submitLabel }}
      </button>
    </div>
  </footer>
</template>
