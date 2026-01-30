<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/GalleryPanel.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
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
const removeLabel = 'Supprimer la photo'
const dragLabel = 'Reordonner la photo'
const fileInput = ref<HTMLInputElement | null>(null)
const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const orderedImages = computed(() => {
  return [...images.value].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
})

function setImages(next: DraftImage[]) {
  emit('patch', { medias: { images: next } })
}

function normalizePositions(next: DraftImage[]) {
  return next.map((img, idx) => ({ ...img, position: idx }))
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (input) input.value = ''
  if (!file) return

  const src = URL.createObjectURL(file)
  const alt = file.name.replace(/\.[^/.]+$/, '')
  const next = normalizePositions([
    ...orderedImages.value,
    { src, alt, position: images.value.length } as DraftImage,
  ])
  setImages(next)
}

function removeImageAt(index: number) {
  const next = orderedImages.value.filter((_, idx) => idx !== index)
  setImages(normalizePositions(next))
}

function startDrag(index: number, event: DragEvent) {
  if (!event.dataTransfer) return
  dragFromIndex.value = index
  dragOverIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(index))
}

function onDragOver(index: number, event: DragEvent) {
  if (!event.dataTransfer) return
  event.preventDefault()
  if (dragFromIndex.value === null) return
  dragOverIndex.value = index
  event.dataTransfer.dropEffect = 'move'
}

function onDrop(index: number, event: DragEvent) {
  event.preventDefault()
  const fallbackIndex = event.dataTransfer?.getData('text/plain')
  const fromIndex = dragFromIndex.value ?? (fallbackIndex ? Number(fallbackIndex) : null)
  if (fromIndex === null || Number.isNaN(fromIndex)) {
    resetDrag()
    return
  }
  if (fromIndex === index) {
    resetDrag()
    return
  }
  const next = [...orderedImages.value]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) {
    resetDrag()
    return
  }
  next.splice(index, 0, moved)
  setImages(normalizePositions(next))
  resetDrag()
}

function onDragEnd() {
  resetDrag()
}

function resetDrag() {
  dragFromIndex.value = null
  dragOverIndex.value = null
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
          v-for="(img, index) in orderedImages"
          :key="img.position ?? index"
          class="tile"
          :class="{
            'is-dragging': dragFromIndex === index,
            'is-over': dragOverIndex === index && dragFromIndex !== index,
          }"
          @dragover="onDragOver(index, $event)"
          @drop="onDrop(index, $event)"
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
          <div class="remove">
            <button
              type="button"
              :aria-label="removeLabel"
              @click.stop="removeImageAt(index)"
            >
              x
            </button>
          </div>
          <div class="drag-handle">
            <button
              type="button"
              draggable="true"
              :aria-label="dragLabel"
              @dragstart="startDrag(index, $event)"
              @dragend="onDragEnd"
              @click.stop.prevent
            >
              ::
            </button>
          </div>
        </div>

        <div class="add">
          <div class="button">
            <button
              type="button"
              :aria-label="panelContent.addLabel"
              @click="openFilePicker"
            >
              +
            </button>
          </div>
          <input
            ref="fileInput"
            class="file-input"
            type="file"
            accept="image/*"
            @change="onFilePicked"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/gallery-panel.scss';
</style>
