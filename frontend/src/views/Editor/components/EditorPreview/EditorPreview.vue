<!-- File: src/views/Editor/components/EditorPreview/EditorPreview.vue -->

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { ArrowLeft, ExternalLink } from 'lucide-vue-next'
import ListingView from '@/views/ListingView/_ListingView.vue'
import type { RawListingBundle } from '@/domain/listings/types'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import type { ListingViewportMode } from '@/views/ListingView/composables/useListingViewport'

const props = defineProps<{
  rawListing: RawListingBundle | null
  isShowed: boolean
  isLoading?: boolean
  displayMode?: ListingViewportMode | null
}>()
const emit = defineEmits<{
  (e: 'back'): void
}>()

const wrapper = ref<HTMLElement | null>(null)
const aspectRatio = ref<{ width: number; height: number } | null>(null)
const previewContent = editorStatic.preview
const previewActions = editorStatic.actions

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
  [() => props.isShowed, () => props.rawListing],
  async ([isShowed, rawListing]) => {
    // Important: wrapper n'existe que si rawListing est non-null.
    if (!isShowed || !rawListing) return
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
    <div class="toolbar">
      <div class="back-to-listings">
        <button
          type="button"
          :aria-label="previewActions.backToListings"
          :title="previewActions.backToListings"
          @click="emit('back')"
        >
          <ArrowLeft :size="18" />
        </button>
      </div>

      <div class="show-online">
        <RouterLink
          v-if="props.rawListing"
          :to="{ name: 'listing', params: { id: props.rawListing.core?.id } }"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="editorStatic.listings.externalLink"
          :title="editorStatic.listings.externalLink"
          @click.stop
          @pointerdown.stop
        >
          <ExternalLink :size="18" />
        </RouterLink>
      </div>
    </div>

    <div
      v-if="props.rawListing"
      class="content"
      ref="wrapper"
    >
      <ListingView
        v-if="aspectRatio"
        :aspect="aspectRatio"
        :rawListing="props.rawListing"
        :forcedViewportMode="props.displayMode ?? undefined"
      />
    </div>

    <div
      v-else
      class="empty"
    >
      <div class="skeleton">
        {{ props.isLoading ? previewContent.loading : previewContent.empty }}
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/effects' as effects;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/buttons' as buttons;

.editor-preview {
  position: relative;
  height: 100%;
  min-height: 0;

  // background-color: $secondary;
  border-radius: borders.$rounded-xxl;
  overflow: hidden;

  box-shadow: 0px 0px 20px 0px rgba($secondary, 0.3);

  .toolbar {
    position: absolute;
    top: 1.75rem;
    left: 1.75rem;
    z-index: 9;

    display: flex;
    gap: var(--layout-gap-sm);

    > .back-to-listings {
      button {
        @include buttons.low-btn($icon-only: true);
      }
    }

    > .show-online {
      a {
        @include buttons.low-btn($icon-only: true);
      }
    }
  }

  > .content {
    height: 100%;
    min-height: 0;
    // overflow: hidden;
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
