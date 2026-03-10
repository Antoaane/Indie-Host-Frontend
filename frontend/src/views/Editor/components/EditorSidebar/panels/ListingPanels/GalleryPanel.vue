<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/GalleryPanel.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import type { RawMedias } from '@/domain/listings/types'
import { isApiImageStorageEnabled, uploadGalleryImageToImageKit } from '@/domain/api/imagekit'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import {
  acceptedGalleryMimeTypes,
  formatValidationMessage,
  humanizeGalleryMimeTypes,
  normalizeTextInput,
  resolveTextMaxLength,
  validateGalleryImageFile,
} from '@/utils/inputValidation'
import { readOptimizedImageDataUrl } from '@/utils/imageDataUrl'

type DraftImage = NonNullable<RawMedias['images']>[number]

const props = defineProps<{
  medias?: Partial<RawMedias> | null
  listingId?: string | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const images = computed<DraftImage[]>(() => (props.medias?.images as DraftImage[] | undefined) ?? [])
const panelContent = editorStatic.panels.listing.gallery
const galleryLimits = editorStatic.validation.listing.gallery
const titleValidation = editorStatic.validation.listing.title
const textDefaults = editorStatic.validation.defaults.simpleText
const imageAltMaxLength = resolveTextMaxLength(titleValidation.max, textDefaults)
const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
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
const disableDropAnimation = ref(false)
let dropAnimationResetRaf = 0
const isDragging = computed(() => dragState.active)
const acceptedMimeTypes = acceptedGalleryMimeTypes(galleryLimits.acceptedMimeTypes)
const readableFormats = humanizeGalleryMimeTypes(galleryLimits.acceptedMimeTypes)
const maxFileSizeMb = (galleryLimits.maxFileSizeBytes / (1024 * 1024)).toFixed(1)
const optimizedImageMaxDimension = Math.min(2560, Math.max(galleryLimits.maxWidth, galleryLimits.maxHeight))
const apiImageStorageEnabled = isApiImageStorageEnabled()
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
  if (isUploading.value) return
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

async function onFilePicked(event: Event) {
  if (isUploading.value) return
  const input = event.target as HTMLInputElement | null
  const files = input?.files ? Array.from(input.files) : []
  if (input) input.value = ''
  if (!files.length) return
  if (orderedImages.value.length >= galleryLimits.maxImages) {
    setGalleryFeedback(maxImagesErrorMessage())
    return
  }

  const availableSlots = galleryLimits.maxImages - orderedImages.value.length
  const filesToAdd = files.slice(0, availableSlots)
  const selectionExceedsLimit = files.length > filesToAdd.length

  for (const file of filesToAdd) {
    const validation = await validateGalleryImageFile(file, galleryLimits)
    if (!validation.valid) {
      setGalleryFeedback(validation.message, 'error')
      return
    }
  }

  try {
    isUploading.value = true
    const baseImages = [
      ...orderedImages.value,
    ]
    const nextImages = await Promise.all(
      filesToAdd.map(async (file, index) => {
        const src = apiImageStorageEnabled
          ? (await uploadGalleryImageToImageKit(file, {
              listingId: props.listingId,
            })).url
          : await readOptimizedImageDataUrl(file, {
              maxDimension: optimizedImageMaxDimension,
              preferredMimeType: 'image/webp',
              quality: 0.86,
            })
        const alt = normalizeTextInput(file.name.replace(/\.[^/.]+$/, ''), imageAltMaxLength)
        return { src, alt, position: baseImages.length + index } as DraftImage
      }),
    )
    const next = normalizePositions([
      ...baseImages,
      ...nextImages,
    ])
    setImages(next)
    if (selectionExceedsLimit) {
      setGalleryFeedback(maxImagesErrorMessage(), 'error')
    } else {
      clearGalleryFeedback()
    }
  } catch (err) {
    console.log('[Editor][Gallery] failed to read file', err)
    if (apiImageStorageEnabled) {
      const message = err instanceof Error
        ? err.message
        : "Impossible d'envoyer l'image vers ImageKit."
      setGalleryFeedback(message || "Impossible d'envoyer l'image vers ImageKit.", 'error')
    } else {
      setGalleryFeedback(galleryLimits.messages.processError, 'error')
    }
  } finally {
    isUploading.value = false
  }
}

function removeImage(index: number) {
  const next = orderedImages.value.filter((_, idx) => idx !== index)
  setImages(normalizePositions(next))
  clearGalleryFeedback()
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
  setImages(normalizePositions(nextImages))
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
  disableDropAnimation.value = true

  if (changed) {
    applyReorder(order)
  }
  stopDrag()
  scheduleDropAnimationReset()
}

function startDrag(index: number, event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
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

  updateOverIndex()
}

function scheduleDropAnimationReset() {
  if (typeof window === 'undefined') {
    disableDropAnimation.value = false
    return
  }

  if (dropAnimationResetRaf) {
    window.cancelAnimationFrame(dropAnimationResetRaf)
  }

  dropAnimationResetRaf = window.requestAnimationFrame(() => {
    dropAnimationResetRaf = window.requestAnimationFrame(() => {
      disableDropAnimation.value = false
      dropAnimationResetRaf = 0
    })
  })
}

function onTilePointerDown(index: number, event: PointerEvent) {
  startDrag(index, event)
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
  if (typeof window !== 'undefined' && dropAnimationResetRaf) {
    window.cancelAnimationFrame(dropAnimationResetRaf)
  }
  stopDrag()
})
</script>

<template>
  <section
    class="editor-gallery-panel"
    :class="{
      'is-dragging': isDragging,
      'is-drop-instant': disableDropAnimation,
    }"
  >
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
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
          }"
          @pointerdown="onTilePointerDown(index, $event)"
          @dragstart.prevent
        >
          <img
            v-if="img.src"
            :src="img.src"
            :alt="img.alt || ''"
            loading="lazy"
            draggable="false"
            @dragstart.prevent
          />
          <div
            v-else
            class="placeholder"
          />
          <div class="tile-order">
            <span class="order-index">{{ index + 1 }}</span>
            <span
              v-if="index === 0"
              class="cover-label"
            >
              Couverture
            </span>
          </div>
          <div class="tile-remove">
            <button
              type="button"
              aria-label="Supprimer l’image"
              @pointerdown.stop
              @click.stop="removeImage(index)" title="Supprimer l’image"
            >
              <Trash2 :size="18" />
            </button>
          </div>
        </div>

        <div class="add">
          <div class="button">
            <button
              type="button"
              :aria-label="panelContent.addLabel"
              :title="panelContent.addLabel"
              :disabled="orderedImages.length >= galleryLimits.maxImages || isUploading"
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
            :disabled="isUploading"
            multiple
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
