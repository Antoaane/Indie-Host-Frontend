<!-- File: src/views/CreateListing/components/panels/CreateListingPreviewStepPanel.vue -->

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import confetti from 'canvas-confetti'

import type { RawListingBundle } from '@/domain/listings/types'
import ListingView from '@/views/ListingView/_ListingView.vue'

const props = defineProps<{
  rawListing: RawListingBundle | null
}>()

const wrapper = ref<HTMLElement | null>(null)
const aspectRatio = ref<{ width: number; height: number } | null>(null)
let confettiTimer: number | null = null

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

function launchConfetti() {
  if (typeof window === 'undefined') return

  const baseConfig = {
    spread: 68,
    startVelocity: 42,
    decay: 0.92,
    scalar: 0.9,
    ticks: 160,
    zIndex: 1200,
    disableForReducedMotion: true,
    colors: [
      '#0b132b',
      '#f97316',
      '#16a34a',
      '#0ea5e9',
      '#facc15',
    ],
  }

  confetti({
    ...baseConfig,
    particleCount: 75,
    origin: { x: 0.18, y: 0.76 },
  })

  confetti({
    ...baseConfig,
    particleCount: 75,
    origin: { x: 0.82, y: 0.76 },
  })

  confettiTimer = window.setTimeout(() => {
    confetti({
      ...baseConfig,
      particleCount: 55,
      origin: { x: 0.5, y: 0.66 },
    })
  }, 240)
}

onMounted(() => {
  updateScale()
  window.addEventListener('resize', updateScale)
  launchConfetti()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateScale)
  if (typeof window !== 'undefined' && confettiTimer !== null) {
    window.clearTimeout(confettiTimer)
  }
})
</script>

<template>
  <section class="create-listing-preview-step-panel">
    <div class="intro">
      <h2>Votre annonce est prête à être créée.</h2>
      <h3>Vérifiez une dernière fois l’aperçu avant de finaliser la création.</h3>
    </div>

    <div
      v-if="props.rawListing"
      class="preview-frame"
    >
      <div
        ref="wrapper"
        class="content"
      >
        <ListingView
          v-if="aspectRatio"
          :aspect="aspectRatio"
          :raw-listing="props.rawListing"
          preview-only
        />
      </div>
    </div>

    <div
      v-else
      class="empty"
    >
      <div class="skeleton">
        Chargement de l’aperçu...
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/CreateListing/components/panels/create-listing-preview-step-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.create-listing-preview-step-panel {
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap);
  width: min(100%, 64rem);
  height: 100%;
  min-height: 0;
  margin: 0 auto;

  > .intro {
    display: flex;
    flex-direction: column;
    gap: calc(var(--layout-gap-xs) / 2);

    > h2 {
      margin: 0;
      @include h2-title();
    }

    > h3 {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary-text, 0.75);
    }
  }

  > .preview-frame {
    flex: 1 1 auto;
    min-height: 18rem;
    border-radius: borders.$rounded-xl;
    overflow: hidden;
    background-color: $secondary;
    box-shadow: 0 10px 28px rgba($background, 0.16);

    > .content {
      height: 100%;
      min-height: 0;
      overflow: hidden;
      position: relative;
      background: $background;
    }
  }

  > .empty {
    height: clamp(18rem, 52svh, 30rem);
    display: grid;
    place-items: center;
    padding: var(--layout-gap-md);
    border-radius: borders.$rounded-xl;
    background: rgba($secondary, 0.05);
    color: rgba($secondary-text, 0.65);
  }

  @media screen and (max-width: 768px) {
    width: 100%;
    gap: var(--layout-gap-sm);

    > .preview-frame {
      min-height: clamp(24rem, 62svh, 34rem);
    }
  }
}
</style>
