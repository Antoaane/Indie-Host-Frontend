<!-- File: src/views/Editor/components/EditorPanels/panels/GalleryPanel.vue -->

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
  const next = [...images.value]
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
    <header class="editor-panel__header">
      <h3>Galerie de photo</h3>
      <p>Montrez votre logement sous son plus beau jour</p>
    </header>

    <div class="editor-panel__body">
      <div class="editor-gallery">
        <button
          v-for="img in images"
          :key="img.position"
          class="editor-gallery__tile"
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

        <button
          class="editor-gallery__tile editor-gallery__add"
          type="button"
          @click="addImage"
        >
          +
        </button>
      </div>
    </div>
  </section>
</template>

