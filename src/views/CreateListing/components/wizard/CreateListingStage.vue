<!-- File: src/views/CreateListing/components/wizard/CreateListingStage.vue -->

<script setup lang="ts">
import { computed } from 'vue'

import type { RawListingBundle } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import type { CreateListingStep } from '@/views/CreateListing/wizard/createListing.types'

const props = defineProps<{
  step: CreateListingStep
  draft: RawListingBundle
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

function forwardPatch(patch: DraftPatch) {
  emit('patch', patch)
}

const listeners = computed(() => (props.step.acceptsPatch ? { patch: forwardPatch } : {}))
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
          v-bind="props.step.props(props.draft)"
          v-on="listeners"
        />
      </div>
    </Transition>
  </section>
</template>
