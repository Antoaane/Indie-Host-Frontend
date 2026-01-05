<!-- File: src/views/Editor/components/EditorPreview/EditorPreview.vue -->

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import ListingView from '@/views/ListingView/ListingView.vue'
import type { RawListingBundle } from '@/views/ListingView/utils/useParseContent'

const props = defineProps<{
  rawListing: RawListingBundle | null
  isShowed: boolean
  isLoading?: boolean
}>()

const wrapper = ref<HTMLElement | null>(null)
const aspectRatio = ref<{ width: number; height: number } | null>(null)

function updateScale() {
  const container = wrapper.value

  console.log('EditorPreview mounted :', wrapper.value)

  if (container) {
    aspectRatio.value = {
      width: container?.clientWidth,
      height: container?.clientHeight,
    }

    console.log('EditorPreview mounted with size:', aspectRatio.value)
  }
}

watch(
  () => props.isShowed,
  async (value) => {
    if (!value) return
    await nextTick()
    updateScale()
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('resize', updateScale)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateScale)
})
</script>

<template>
  <section class="editor-preview">
    <div
      v-if="props.rawListing"
      class="content"
      ref="wrapper"
    >
      <ListingView
        v-if="aspectRatio"
        :aspect="aspectRatio"
        :rawListing="props.rawListing"
      />
    </div>

    <div
      v-else
      class="empty"
    >
      <div class="skeleton">
        {{ props.isLoading ? 'Chargement…' : 'Sélectionne une annonce pour afficher la preview.' }}
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorPreview/editor-preview.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/effects' as effects;
@use '@/styles/variables/borders' as borders;

.editor-preview {
  height: 100%;
  min-height: 0;

  background-color: $secondary;
  border-radius: borders.$rounded-xl;

  box-shadow: 0px 0px 20px 0px rgba($accent, 0.3);

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
