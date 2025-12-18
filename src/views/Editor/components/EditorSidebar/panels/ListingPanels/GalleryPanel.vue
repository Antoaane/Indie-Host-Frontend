<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/GalleryPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawMedias } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

type DraftImage = NonNullable<RawMedias['images']>[number]

const props = defineProps<{
  medias?: Partial<RawMedias> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const images = computed<DraftImage[]>(() => (props.medias?.images as DraftImage[] | undefined) ?? [])

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
  <section class="editor-panel">
    <div class="editor-panel__header">
      <h3>Galerie de photo</h3>
      <p>Montrez votre logement sous son plus beau jour</p>
    </div>

    <div class="editor-panel__body">
      <div class="editor-gallery">
        <div
          v-for="img in images"
          :key="img.position"
          class="editor-gallery__tile"
        >
          <button
            type="button"
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
              class="editor-gallery__placeholder"
            />
          </button>
        </div>

        <div
          class="editor-gallery__tile editor-gallery__add"
        >
          <button
            type="button"
            @click="addImage"
          >
            +
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/gallery-panel.scss';
</style>
