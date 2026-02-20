<!-- File: src/views/CreateListing/components/wizard/CreateListingHeader.vue -->

<script setup lang="ts">
const props = defineProps<{
  activeStepIndex: number
  stepsCount: number
  title: string
  description: string
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
}>()
</script>

<template>
  <div class="header">
    <div class="step-title">
      <p> Étape {{ props.activeStepIndex + 1 }} / {{ props.stepsCount }} </p>
      <h1>{{ props.title }}</h1>
      <small>{{ props.description }}</small>
    </div>

    <div class="btn-primary__white">
      <button
        type="button"
        :disabled="props.isSubmitting"
        @click="emit('cancel')"
      >
        Quitter
      </button>
    </div>
  </div>
</template>
