<!-- File: src/views/CreateListing/components/panels/ListingPanels/GalleryPanel.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useTouchLongPress } from '@/composables/useTouchLongPress'
import { Plus, Trash2 } from 'lucide-vue-next'
import type { RawMedias } from '@/domain/listings/types'
import { normalizeListingStatus } from '@/domain/listings/status'
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
  listingStatus?: string | null
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
const isDraggingFiles = ref(false)
const fileDragDepth = ref(0)
const tileRefs = ref<HTMLElement[]>([])
const galleryFeedback = ref('')
const galleryFeedbackLevel = ref<'error' | 'success'>('error')
const TOUCH_DRAG_THRESHOLD = 14
const PEN_DRAG_THRESHOLD = 8
const dragState = reactive({
  pending: false,
  active: false,
  index: -1,
  overIndex: -1,
  overAfter: false,
  pointerId: -1,
  pointerType: '',
  startX: 0,
  startY: 0,
  pointerX: 0,
  pointerY: 0,
  offsetX: 0,
  offsetY: 0,
  positions: [] as DOMRect[],
  sourceEl: null as HTMLElement | null,
  previousCursor: '',
  previousUserSelect: '',
})
const disableDropAnimation = ref(false)
let dropAnimationResetRaf = 0
let dragListenersBound = false
const isDragging = computed(() => dragState.active)
const touchLongPress = useTouchLongPress({ isActive: () => dragState.active })
const acceptedMimeTypes = acceptedGalleryMimeTypes(galleryLimits.acceptedMimeTypes)
const readableFormats = humanizeGalleryMimeTypes(galleryLimits.acceptedMimeTypes)
const maxFileSizeMb = (galleryLimits.maxFileSizeBytes / (1024 * 1024)).toFixed(1)
const optimizedImageMaxDimension = Math.min(2560, Math.max(galleryLimits.maxWidth, galleryLimits.maxHeight))
const apiImageStorageEnabled = isApiImageStorageEnabled()
const canUploadToImageKit = computed(() => apiImageStorageEnabled && normalizeListingStatus(props.listingStatus) === 'published')
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
  const input = event.target as HTMLInputElement | null
  const files = input?.files ? Array.from(input.files) : []
  if (input) input.value = ''
  await addGalleryFiles(files)
}

// Glisser-déposer de fichiers : le compteur évite le clignotement quand le curseur passe sur les tuiles.
function onFilesDragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  fileDragDepth.value += 1
  isDraggingFiles.value = true
}

function onFilesDragLeave() {
  fileDragDepth.value = Math.max(0, fileDragDepth.value - 1)
  if (fileDragDepth.value === 0) isDraggingFiles.value = false
}

async function onFilesDropped(event: DragEvent) {
  fileDragDepth.value = 0
  isDraggingFiles.value = false
  const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith('image/'))
  await addGalleryFiles(files)
}

async function addGalleryFiles(files: File[]) {
  if (isUploading.value) return
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
        const src = canUploadToImageKit.value
          ? (await uploadGalleryImageToImageKit(file, {
              listingId: props.listingId,
              listingStatus: props.listingStatus,
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
    if (canUploadToImageKit.value) {
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

function resolveInsertAfter(rect: DOMRect, centerX: number, centerY: number) {
  const cx = (rect.left + rect.right) / 2
  const cy = (rect.top + rect.bottom) / 2
  const verticalEdgeThreshold = Math.min(rect.height * 0.22, 24)
  const horizontalEdgeThreshold = Math.min(rect.width * 0.22, 28)
  const isWideTile = rect.width > rect.height * 1.35

  if (isWideTile) {
    return centerY > cy
  }

  if (centerY <= rect.top + verticalEdgeThreshold) return false
  if (centerY >= rect.bottom - verticalEdgeThreshold) return true
  if (centerX <= cx - horizontalEdgeThreshold) return false
  if (centerX >= cx + horizontalEdgeThreshold) return true

  return centerX > cx
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
    dragState.overAfter = resolveInsertAfter(rect, centerX, centerY)
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
    dragState.overAfter = resolveInsertAfter(nearestRect, centerX, centerY)
  }
}

function applyReorder(order: number[]) {
  if (!order.length) return
  const nextImages = order.map((idx) => orderedImages.value[idx]).filter(Boolean)
  setImages(normalizePositions(nextImages))
}

function bindDragListeners() {
  if (typeof window === 'undefined' || dragListenersBound) return
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  dragListenersBound = true
}

function unbindDragListeners() {
  if (typeof window === 'undefined' || !dragListenersBound) return
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  dragListenersBound = false
}

function releasePointerCapture() {
  const { sourceEl, pointerId } = dragState
  if (!sourceEl || pointerId < 0 || typeof sourceEl.releasePointerCapture !== 'function') return

  try {
    if (typeof sourceEl.hasPointerCapture !== 'function' || sourceEl.hasPointerCapture(pointerId)) {
      sourceEl.releasePointerCapture(pointerId)
    }
  } catch {
    // Ignore browsers that throw when capture is already gone.
  }
}

function stopDrag() {
  releasePointerCapture()

  const previousCursor = dragState.previousCursor
  const previousUserSelect = dragState.previousUserSelect

  dragState.pending = false
  dragState.active = false
  dragState.index = -1
  dragState.overIndex = -1
  dragState.overAfter = false
  dragState.pointerId = -1
  dragState.pointerType = ''
  dragState.startX = 0
  dragState.startY = 0
  dragState.pointerX = 0
  dragState.pointerY = 0
  dragState.offsetX = 0
  dragState.offsetY = 0
  dragState.positions = []
  dragState.sourceEl = null
  dragState.previousCursor = ''
  dragState.previousUserSelect = ''

  unbindDragListeners()

  document.body.style.cursor = previousCursor
  document.body.style.userSelect = previousUserSelect
}

function dragThreshold(pointerType: string) {
  if (pointerType === 'touch') return TOUCH_DRAG_THRESHOLD
  if (pointerType === 'pen') return PEN_DRAG_THRESHOLD
  return 0
}

function canStartDrag(event: PointerEvent) {
  if (event.isPrimary === false) return false
  if (event.pointerType === 'mouse') return event.button === 0
  return true
}

function shouldActivateDrag(event: PointerEvent) {
  const threshold = dragThreshold(dragState.pointerType)
  if (threshold <= 0) return true

  const deltaX = event.clientX - dragState.startX
  const deltaY = event.clientY - dragState.startY
  return (deltaX * deltaX) + (deltaY * deltaY) >= threshold * threshold
}

function onPointerMove(event: PointerEvent) {
  if (dragState.pointerId >= 0 && event.pointerId !== dragState.pointerId) return

  if (dragState.pending && !dragState.active) {
    if (!shouldActivateDrag(event)) return
    startDrag(dragState.index, event)
    return
  }

  if (!dragState.active) return
  if (event.cancelable) {
    event.preventDefault()
  }
  dragState.pointerX = event.clientX
  dragState.pointerY = event.clientY
  updateOverIndex()
}

function onPointerUp(event: PointerEvent) {
  if (dragState.pointerId >= 0 && event.pointerId !== dragState.pointerId) return
  if (!dragState.active) {
    stopDrag()
    return
  }
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
  if (!canStartDrag(event)) return
  const positions = capturePositions()
  if (!positions.length) return

  const rect = positions[index]
  if (!rect) return

  if (event.cancelable) {
    event.preventDefault()
  }

  dragState.pending = false
  dragState.active = true
  dragState.index = index
  dragState.overIndex = index
  dragState.overAfter = false
  dragState.pointerId = event.pointerId
  dragState.pointerType = event.pointerType
  dragState.pointerX = event.clientX
  dragState.pointerY = event.clientY
  dragState.positions = positions

  dragState.offsetX = event.clientX - rect.left
  dragState.offsetY = event.clientY - rect.top

  dragState.previousCursor = document.body.style.cursor
  dragState.previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = 'grabbing'
  document.body.style.userSelect = 'none'

  if (dragState.sourceEl && typeof dragState.sourceEl.setPointerCapture === 'function') {
    try {
      dragState.sourceEl.setPointerCapture(event.pointerId)
    } catch {
      // Some browsers can reject capture if the pointer was already released.
    }
  }

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
  if (!canStartDrag(event)) return

  // Au doigt, le tri démarre après un appui long : un glissé rapide fait défiler la page.
  if (event.pointerType === 'touch') {
    touchLongPress.arm(event, (downEvent) => {
      dragState.sourceEl = tileRefs.value[index] ?? null
      bindDragListeners()
      startDrag(index, downEvent)
    })
    return
  }

  dragState.pending = true
  dragState.active = false
  dragState.index = index
  dragState.overIndex = index
  dragState.overAfter = false
  dragState.pointerId = event.pointerId
  dragState.pointerType = event.pointerType
  dragState.startX = event.clientX
  dragState.startY = event.clientY
  dragState.pointerX = event.clientX
  dragState.pointerY = event.clientY
  dragState.sourceEl = event.currentTarget instanceof HTMLElement
    ? event.currentTarget
    : tileRefs.value[index] ?? null

  bindDragListeners()

  if (dragThreshold(event.pointerType) === 0) {
    startDrag(index, event)
  }
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
    class="create-gallery-panel"
    :class="{
      'is-dragging': isDragging,
      'is-drop-instant': disableDropAnimation,
      'is-dragging-files': isDraggingFiles,
    }"
    :data-drop-label="panelContent.dropHint"
    @dragenter.prevent="onFilesDragEnter"
    @dragover.prevent
    @dragleave="onFilesDragLeave"
    @drop.prevent="onFilesDropped"
  >
    <div class="body">
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
              Ajouter des images <Plus :size="20" />
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

      <div class="footnotes">
        <p
          v-if="galleryFeedback"
          class="feedback"
          :class="{ 'is-error': galleryFeedbackLevel === 'error' }"
        >
          {{ galleryFeedback }}
        </p>
        <p class="hint">{{ galleryHint }}</p>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/views/CreateListing/components/panels/ListingPanels/gallery-panel.scss';

// Zone de dépôt : tout le panneau accepte les fichiers, un voile indique où lâcher.
.create-gallery-panel {
  position: relative;

  &::after {
    content: attr(data-drop-label);
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--layout-gap);
    text-align: center;
    border-radius: borders.$rounded-md;
    border: 2px dashed rgba($secondary, 0.5);
    background: rgba($accent, 0.92);
    @include base-text($bold: true);
    opacity: 0;
    pointer-events: none;
    @include animations.transition();
  }

  &.is-dragging-files::after {
    opacity: 1;
  }
}
</style>
