<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/GalleryPanel.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Grip, Plus, Pen, Trash2 } from 'lucide-vue-next'
import type { RawMedias } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import {
  acceptedGalleryMimeTypes,
  formatValidationMessage,
  humanizeGalleryMimeTypes,
  normalizeTextInput,
  validateGalleryImageFile,
} from '@/utils/inputValidation'

type DraftImage = NonNullable<RawMedias['images']>[number]

const props = defineProps<{
  medias?: Partial<RawMedias> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const images = computed<DraftImage[]>(() => (props.medias?.images as DraftImage[] | undefined) ?? [])
const panelContent = editorStatic.panels.listing.gallery
const dragLabel = 'Reordonner la photo'
const galleryLimits = editorStatic.validation.listing.gallery
const titleValidation = editorStatic.validation.listing.title
const fileInput = ref<HTMLInputElement | null>(null)
const replaceInput = ref<HTMLInputElement | null>(null)
const tileRefs = ref<HTMLElement[]>([])
const galleryFeedback = ref('')
const galleryFeedbackLevel = ref<'error' | 'success'>('error')
const dragState = reactive({
  active: false,
  index: -1,
  overIndex: -1,
  overAfter: false,
  pointerX: 0,
  pointerY: 0,
  offsetX: 0,
  offsetY: 0,
  positions: [] as DOMRect[],
  previousCursor: '',
  previousUserSelect: '',
})
const selectedIndices = ref<number[]>([])
const selectedCount = computed(() => selectedIndices.value.length)
const isDragging = computed(() => dragState.active)
const acceptedMimeTypes = acceptedGalleryMimeTypes(galleryLimits.acceptedMimeTypes)
const readableFormats = humanizeGalleryMimeTypes(galleryLimits.acceptedMimeTypes)
const maxFileSizeMb = (galleryLimits.maxFileSizeBytes / (1024 * 1024)).toFixed(1)
const galleryHint = computed(() =>
  formatValidationMessage(galleryLimits.messages.hint, {
    formats: readableFormats,
    maxSizeMb: maxFileSizeMb,
    minWidth: galleryLimits.minWidth,
    minHeight: galleryLimits.minHeight,
    count: orderedImages.value.length,
    maxImages: galleryLimits.maxImages,
  }),
)

function maxImagesErrorMessage(): string {
  return formatValidationMessage(galleryLimits.messages.maxImages, {
    maxImages: galleryLimits.maxImages,
  })
}

const orderedImages = computed(() => {
  return [
    ...images.value,
  ].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
})

watch(
  () => orderedImages.value.length,
  () => {
    selectedIndices.value = selectedIndices.value.filter((index) => index < orderedImages.value.length)
    tileRefs.value = []
  },
)

const virtualOrder = computed(() => {
  const base = orderedImages.value.map((_, idx) => idx)
  if (!dragState.active) return base

  const from = dragState.index
  const to = dragState.overIndex
  if (from < 0 || to < 0) return base

  const next = base.filter((idx) => idx !== from)
  let insertAt = to + (dragState.overAfter ? 1 : 0)
  if (insertAt > from) insertAt -= 1
  insertAt = Math.max(0, Math.min(next.length, insertAt))
  next.splice(insertAt, 0, from)
  return next
})

function setTileRef(el: HTMLElement | null, index: number) {
  if (!el) return
  tileRefs.value[index] = el
}

function setImages(next: DraftImage[]) {
  emit('patch', { medias: { images: next } })
}

function normalizePositions(next: DraftImage[]) {
  return next.map((img, idx) => ({ ...img, position: idx }))
}

function setGalleryFeedback(message: string, level: 'error' | 'success' = 'error') {
  galleryFeedback.value = message
  galleryFeedbackLevel.value = level
}

function clearGalleryFeedback() {
  galleryFeedback.value = ''
}

function openFilePicker() {
  if (orderedImages.value.length >= galleryLimits.maxImages) {
    setGalleryFeedback(maxImagesErrorMessage())
    return
  }

  const input = fileInput.value
  if (!input) return
  if (typeof input.showPicker === 'function') {
    input.showPicker()
  } else {
    input.click()
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function openReplacePicker() {
  if (!selectedCount.value) return
  const input = replaceInput.value
  if (!input) return
  if (typeof input.showPicker === 'function') {
    input.showPicker()
  } else {
    input.click()
  }
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (input) input.value = ''
  if (!file) return
  if (orderedImages.value.length >= galleryLimits.maxImages) {
    setGalleryFeedback(maxImagesErrorMessage())
    return
  }

  const validation = await validateGalleryImageFile(file, galleryLimits)
  if (!validation.valid) {
    setGalleryFeedback(validation.message, 'error')
    return
  }

  try {
    const src = await readFileAsDataUrl(file)
    const alt = normalizeTextInput(file.name.replace(/\.[^/.]+$/, ''), titleValidation.max)
    const next = normalizePositions([
      ...orderedImages.value,
      { src, alt, position: images.value.length } as DraftImage,
    ])
    setImages(next)
    clearGalleryFeedback()
  } catch (err) {
    console.log('[Editor][Gallery] failed to read file', err)
    setGalleryFeedback(galleryLimits.messages.processError, 'error')
  }
}

function toggleSelection(index: number) {
  if (dragState.active) return
  const current = selectedIndices.value
  if (current.includes(index)) {
    selectedIndices.value = current.filter((item) => item !== index)
  } else {
    selectedIndices.value = [
      ...current,
      index,
    ]
  }
}

function clearSelection() {
  selectedIndices.value = []
}

function deleteSelected() {
  if (!selectedCount.value) return
  const toRemove = new Set(selectedIndices.value)
  const next = orderedImages.value.filter((_, idx) => !toRemove.has(idx))
  setImages(normalizePositions(next))
  clearSelection()
  clearGalleryFeedback()
}

async function onReplacePicked(event: Event) {
  const input = event.target as HTMLInputElement | null
  const files = input?.files ? Array.from(input.files) : []
  if (input) input.value = ''
  if (!files.length || !selectedCount.value) return

  const targets = [
    ...selectedIndices.value,
  ].sort((a, b) => a - b)
  const maxReplace = Math.min(files.length, targets.length)

  try {
    const replacements = await Promise.all(
      files.slice(0, maxReplace).map(async (file) => {
        const validation = await validateGalleryImageFile(file, galleryLimits)
        if (!validation.valid) {
          throw new Error(validation.message)
        }
        const src = await readFileAsDataUrl(file)
        const alt = normalizeTextInput(file.name.replace(/\.[^/.]+$/, ''), titleValidation.max)
        return { src, alt }
      }),
    )

    const next = [
      ...orderedImages.value,
    ]
    replacements.forEach((replacement, idx) => {
      const targetIndex = targets[idx]
      const current = next[targetIndex]
      if (!current) return
      next[targetIndex] = {
        ...current,
        src: replacement.src,
        alt: replacement.alt,
      }
    })

    setImages(normalizePositions(next))
    clearSelection()
    clearGalleryFeedback()
  } catch (err) {
    console.log('[Editor][Gallery] failed to replace files', err)
    setGalleryFeedback(err instanceof Error ? err.message : 'Impossible de remplacer les images.', 'error')
  }
}

function capturePositions() {
  const tiles = tileRefs.value.slice(0, orderedImages.value.length)
  return tiles.map((tile) => tile.getBoundingClientRect())
}

function updateOverIndex() {
  const { pointerX, pointerY, positions } = dragState
  if (!positions.length) return

  const draggedRect = positions[dragState.index]
  const centerX = draggedRect ? pointerX - dragState.offsetX + draggedRect.width / 2 : pointerX
  const centerY = draggedRect ? pointerY - dragState.offsetY + draggedRect.height / 2 : pointerY

  const directIndex = positions.findIndex((rect) => centerX >= rect.left && centerX <= rect.right && centerY >= rect.top && centerY <= rect.bottom)

  if (directIndex >= 0) {
    dragState.overIndex = directIndex
    const rect = positions[directIndex]
    const cx = (rect.left + rect.right) / 2
    const cy = (rect.top + rect.bottom) / 2
    dragState.overAfter = centerX > cx || centerY > cy
    return
  }

  let nearestIndex = dragState.index
  let nearestDistance = Number.POSITIVE_INFINITY

  positions.forEach((rect, idx) => {
    const cx = (rect.left + rect.right) / 2
    const cy = (rect.top + rect.bottom) / 2
    const dx = centerX - cx
    const dy = centerY - cy
    const distance = dx * dx + dy * dy
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = idx
    }
  })

  dragState.overIndex = nearestIndex
  const nearestRect = positions[nearestIndex]
  if (nearestRect) {
    const cx = (nearestRect.left + nearestRect.right) / 2
    const cy = (nearestRect.top + nearestRect.bottom) / 2
    dragState.overAfter = centerX > cx || centerY > cy
  }
}

function applyReorder(order: number[]) {
  if (!order.length) return
  const nextImages = order.map((idx) => orderedImages.value[idx]).filter(Boolean)
  const selectionSnapshot = selectedIndices.value.map((idx) => orderedImages.value[idx]).filter(Boolean)

  setImages(normalizePositions(nextImages))

  if (selectionSnapshot.length) {
    const nextSelection: number[] = []
    selectionSnapshot.forEach((img) => {
      const idx = nextImages.indexOf(img)
      if (idx >= 0) nextSelection.push(idx)
    })
    selectedIndices.value = nextSelection
  }
}

function stopDrag() {
  dragState.active = false
  dragState.index = -1
  dragState.overIndex = -1
  dragState.overAfter = false
  dragState.pointerX = 0
  dragState.pointerY = 0
  dragState.offsetX = 0
  dragState.offsetY = 0
  dragState.positions = []

  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)

  document.body.style.cursor = dragState.previousCursor
  document.body.style.userSelect = dragState.previousUserSelect
}

function onPointerMove(event: PointerEvent) {
  if (!dragState.active) return
  dragState.pointerX = event.clientX
  dragState.pointerY = event.clientY
  updateOverIndex()
}

function onPointerUp() {
  if (!dragState.active) return
  const order = virtualOrder.value
  const changed = order.some((value, idx) => value !== idx)

  if (changed) {
    applyReorder(order)
  }

  stopDrag()
}

function startDrag(index: number, event: PointerEvent) {
  if (event.button !== 0) return
  const positions = capturePositions()
  if (!positions.length) return

  const rect = positions[index]
  if (!rect) return

  dragState.active = true
  dragState.index = index
  dragState.overIndex = index
  dragState.pointerX = event.clientX
  dragState.pointerY = event.clientY
  dragState.positions = positions

  dragState.offsetX = event.clientX - rect.left
  dragState.offsetY = event.clientY - rect.top

  dragState.previousCursor = document.body.style.cursor
  dragState.previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = 'grabbing'
  document.body.style.userSelect = 'none'

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)

  event.preventDefault()
  updateOverIndex()
}

function tileStyle(index: number) {
  if (!dragState.active || !dragState.positions.length) return {}
  const original = dragState.positions[index]
  if (!original) return {}

  if (dragState.index === index) {
    const translateX = dragState.pointerX - dragState.offsetX - original.left
    const translateY = dragState.pointerY - dragState.offsetY - original.top
    return {
      transform: `translate(${translateX}px, ${translateY}px)`,
      transition: 'none',
      zIndex: '5',
    }
  }

  const orderIndex = virtualOrder.value.indexOf(index)
  const target = dragState.positions[orderIndex]
  if (!target) return {}

  const translateX = target.left - original.left
  const translateY = target.top - original.top
  return {
    transform: `translate(${translateX}px, ${translateY}px)`,
  }
}

onBeforeUnmount(() => {
  stopDrag()
})
</script>

<template>
  <section
    class="editor-gallery-panel"
    :class="{ 'is-dragging': isDragging }"
  >
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="actions">
        <div class="meta">
          <span v-if="selectedCount">{{ selectedCount }} sélectionnée(s)</span>
          <span v-else>Sélectionnez des images pour gérer la galerie.</span>
        </div>
        <div class="buttons">
          <div>
            <button
              type="button"
              class="icon"
              :disabled="!selectedCount"
              aria-label="Remplacer les images sélectionnées"
              @click="openReplacePicker"
            >
              <Pen :size="20" />
            </button>
          </div>
          <div>
            <button
              type="button"
              class="icon danger"
              :disabled="!selectedCount"
              aria-label="Supprimer les images sélectionnées"
              @click="deleteSelected"
            >
              <Trash2 :size="20" />
            </button>
          </div>
        </div>
        <input
          ref="replaceInput"
          class="file-input"
          type="file"
          :accept="acceptedMimeTypes"
          multiple
          @change="onReplacePicked"
        />
      </div>
      <p class="hint">{{ galleryHint }}</p>
      <p
        v-if="galleryFeedback"
        class="feedback"
        :class="{ 'is-error': galleryFeedbackLevel === 'error' }"
      >
        {{ galleryFeedback }}
      </p>

      <div class="gallery">
        <div
          v-for="(img, index) in orderedImages"
          :key="img.position ?? index"
          class="tile"
          :ref="(el) => setTileRef(el as HTMLElement | null, index)"
          :style="tileStyle(index)"
          :class="{
            'is-dragging': dragState.active && dragState.index === index,
            'is-over': dragState.active && dragState.overIndex === index && dragState.index !== index,
            'is-selected': selectedIndices.includes(index),
          }"
          @click="toggleSelection(index)"
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
          <div class="selection">
            <span />
          </div>
          <div class="drag-handle">
            <button
              type="button"
              :aria-label="dragLabel"
              @pointerdown.stop.prevent="startDrag(index, $event)"
              @click.stop.prevent
            >
              <Grip :size="20" />
            </button>
          </div>
        </div>

        <div class="add">
          <div class="button">
            <button
              type="button"
              :aria-label="panelContent.addLabel"
              :disabled="orderedImages.length >= galleryLimits.maxImages"
              @click="openFilePicker"
            >
              <Plus :size="20" />
            </button>
          </div>
          <input
            ref="fileInput"
            class="file-input"
            type="file"
            :accept="acceptedMimeTypes"
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
