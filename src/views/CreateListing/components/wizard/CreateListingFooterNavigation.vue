<!-- File: src/views/CreateListing/components/wizard/CreateListingFooterNavigation.vue -->

<script setup lang="ts">
const props = defineProps<{
  isLastStep: boolean
  canGoBack: boolean
  canGoNext: boolean
  canSubmit: boolean
  isSubmitting: boolean
}>()

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
        @click="emit('submit')"
      >
        {{ props.isSubmitting ? 'Création...' : 'Créer l’annonce' }}
      </button>
    </div>
  </footer>
</template>
