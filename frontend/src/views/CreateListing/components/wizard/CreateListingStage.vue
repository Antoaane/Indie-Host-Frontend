<!-- File: src/views/CreateListing/components/wizard/CreateListingStage.vue -->

<script setup lang="ts">
import { computed } from 'vue'

import type { RawListingBundle } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import type { CreateListingStep } from '@/views/CreateListing/wizard/createListing.types'

const props = defineProps<{
  step: CreateListingStep
  draft: RawListingBundle
  stepError?: string | null
  extraProps?: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
  (e: 'next'): void
}>()

function forwardPatch(patch: DraftPatch) {
  emit('patch', patch)
}

function forwardNext() {
  emit('next')
}

const listeners = computed(() => {
  const base: Record<string, any> = {}
  if (props.step.acceptsPatch) {
    base.patch = forwardPatch
  }
  // Permet à un panneau (ex. import) de déclencher le passage automatique à l'étape suivante
  base.next = forwardNext
  return base
})
const stepProps = computed(() =>
  ({
    ...props.step.props(props.draft, {
      validationError: props.stepError ?? null,
    }),
    ...(props.extraProps ?? {}),
  }),
)
</script>

<template>
  <section class="stage">
    <Transition
      name="create-slide"
      mode="out-in"
    >
      <div
        :key="props.step.id"
        class="slide"
      >
        <component
          :is="props.step.component"
          v-bind="stepProps"
          v-on="listeners"
        />
      </div>
    </Transition>
  </section>
</template>
