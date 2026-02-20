<!-- File: src/views/CreateListing/components/panels/CreateListingPreviewStepPanel.vue -->

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { RawListingBundle } from '@/domain/listings/types'
import ListingView from '@/views/ListingView/_ListingView.vue'
import CreateWizardStepShell from '@/views/CreateListing/components/panels/CreateWizardStepShell.vue'

const props = defineProps<{
  rawListing: RawListingBundle | null
}>()

const wrapper = ref<HTMLElement | null>(null)
const aspectRatio = ref<{ width: number; height: number } | null>(null)

function updateScale() {
  const container = wrapper.value
  if (!container) return

  aspectRatio.value = {
    width: container.clientWidth,
    height: container.clientHeight,
  }
}

watch(
  () => props.rawListing,
  async (value) => {
    if (!value) return
    await nextTick()
    updateScale()
  },
  { immediate: true },
)

onMounted(() => {
  updateScale()
  window.addEventListener('resize', updateScale)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateScale)
})
</script>

<template>
  <CreateWizardStepShell
    title="Prévisualise ton annonce telle que les voyageurs la verront"
  >
    <section class="create-listing-preview-step-panel">
      <div
        v-if="props.rawListing"
        ref="wrapper"
        class="content"
      >
        <ListingView
          v-if="aspectRatio"
          :aspect="aspectRatio"
          :raw-listing="props.rawListing"
        />
      </div>

      <div
        v-else
        class="empty"
      >
        <div class="skeleton">
          Chargement…
        </div>
      </div>
    </section>
  </CreateWizardStepShell>
</template>

<style lang="scss">
/* File: src/views/CreateListing/components/panels/create-listing-preview-step-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/effects' as effects;
@use '@/styles/variables/borders' as borders;

.create-listing-preview-step-panel {
  height: clamp(28rem, 72vh, 48rem);
  min-height: 28rem;

  background-color: $secondary;
  border-radius: borders.$rounded-xl;

  box-shadow: 0 0 20px 0 rgba($accent, 0.3);

  > .content {
    height: 100%;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  > .empty {
    height: 100%;
    display: grid;
    place-items: center;
    padding: var(--layout-gap-md);
    color: rgba($secondary, 0.7);
  }
}
</style>
