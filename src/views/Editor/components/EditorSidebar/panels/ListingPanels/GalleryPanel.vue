<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/GalleryPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawMedias } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

type DraftImage = NonNullable<RawMedias['images']>[number]

const props = defineProps<{
  medias?: Partial<RawMedias> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const images = computed<DraftImage[]>(() => (props.medias?.images as DraftImage[] | undefined) ?? [])
const panelContent = editorStatic.panels.listing.gallery

function setImages(next: DraftImage[]) {
  emit('patch', { medias: { images: next } })
}

function addImage() {
  const next = [
    ...images.value,
  ]
  next.push({
    src: '',
    alt: '',
    position: next.length,
  } as DraftImage)
  setImages(next)
}

function removeImage(position: number) {
  const next = images.value.filter((img) => img.position !== position)
  setImages(next.map((img, idx) => ({ ...img, position: idx })))
}
</script>

<template>
  <section class="editor-gallery-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="gallery">
        <div
          v-for="img in images"
          :key="img.position"
          class="tile"
          @click="removeImage(img.position)"
        >
          <img
            v-if="img.src"
            :src="img.src"
            :alt="img.alt || ''"
            loading="lazy"
          />
          <div
            v-else
            class="placeholder"
          />
        </div>

        <div class="add">
          <div class="button">
            <button
              type="button"
              :aria-label="panelContent.addLabel"
              @click="addImage"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/gallery-panel.scss';
</style>
