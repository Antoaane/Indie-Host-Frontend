<!-- File: src/components/overlays/RelativeOverlay.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, useAttrs, watch } from 'vue'
import { acquireScrollLock, type ReleaseScrollLock } from '@/components/overlays/scrollLock'

type Placement =
  | 'bottom-start'
  | 'bottom-center'
  | 'bottom-end'
  | 'top-start'
  | 'top-center'
  | 'top-end'

const props = withDefaults(
  defineProps<{
    open: boolean
    anchor: HTMLElement | HTMLElement[] | null
    teleportTo?: string
    transitionName?: string
    placement?: Placement
    offset?: number
    viewportPadding?: number
    matchAnchorWidth?: boolean
    minWidth?: number
    maxWidth?: number
    closeOnOutside?: boolean
    closeOnEscape?: boolean
    lockScroll?: boolean
    trapFocus?: boolean
    role?: string
    ariaLabel?: string
    ariaLabelledby?: string
    zIndex?: number
  }>(),
  {
    teleportTo: 'body',
    transitionName: 'relative-overlay',
    placement: 'bottom-start',
    offset: 8,
    viewportPadding: 12,
    matchAnchorWidth: false,
    minWidth: undefined,
    maxWidth: undefined,
    closeOnOutside: true,
    closeOnEscape: true,
    lockScroll: false,
    trapFocus: false,
    role: 'dialog',
    ariaLabel: undefined,
    ariaLabelledby: undefined,
    zIndex: 10001,
  },
)

defineOptions({
  inheritAttrs: false,
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const attrs = useAttrs()
const overlayRef = ref<HTMLElement | null>(null)
const position = reactive({ top: 0, left: 0, width: null as number | null })

const anchorEl = computed<HTMLElement | null>(() => {
  const anchor = props.anchor
  if (Array.isArray(anchor)) {
    return anchor.find((item): item is HTMLElement => item instanceof HTMLElement) ?? null
  }
  return anchor instanceof HTMLElement ? anchor : null
})

const ariaModal = computed(() => (props.role === 'dialog' ? 'true' : undefined))
const overlayStyle = computed(() => ({
  top: `${position.top}px`,
  left: `${position.left}px`,
  ...(position.width ? { width: `${position.width}px` } : {}),
  ...(props.minWidth ? { minWidth: `${props.minWidth}px` } : {}),
  ...(props.maxWidth ? { maxWidth: `${props.maxWidth}px` } : {}),
  '--relative-overlay-z-index': String(props.zIndex),
}))

let releaseScrollLock: ReleaseScrollLock | null = null
let restoreFocusTo: HTMLElement | null = null

function requestClose() {
  emit('close')
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min
  return Math.max(min, Math.min(value, max))
}

function getPlacementParts() {
  const [vertical, horizontal] = props.placement.split('-') as [
    'top' | 'bottom',
    'start' | 'center' | 'end',
  ]
  return { vertical, horizontal }
}

function updatePosition() {
  if (!props.open || !anchorEl.value || !overlayRef.value) return

  const rect = anchorEl.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const gap = props.viewportPadding

  const overlayWidth = props.matchAnchorWidth ? rect.width : overlayRef.value.offsetWidth
  const overlayHeight = overlayRef.value.offsetHeight

  const { vertical: initialVertical, horizontal } = getPlacementParts()
  let vertical = initialVertical

  if (vertical === 'bottom' && rect.bottom + props.offset + overlayHeight > viewportHeight - gap) {
    if (rect.top - props.offset - overlayHeight >= gap) {
      vertical = 'top'
    }
  }

  if (vertical === 'top' && rect.top - props.offset - overlayHeight < gap) {
    if (rect.bottom + props.offset + overlayHeight <= viewportHeight - gap) {
      vertical = 'bottom'
    }
  }

  let top = vertical === 'top'
    ? rect.top - overlayHeight - props.offset
    : rect.bottom + props.offset

  let left = rect.left
  if (horizontal === 'center') {
    left = rect.left + rect.width / 2 - overlayWidth / 2
  }
  if (horizontal === 'end') {
    left = rect.right - overlayWidth
  }

  left = clamp(left, gap, viewportWidth - overlayWidth - gap)
  top = clamp(top, gap, viewportHeight - overlayHeight - gap)

  position.left = left
  position.top = top
  position.width = props.matchAnchorWidth ? rect.width : null
}

function getFocusableElements(): HTMLElement[] {
  const root = overlayRef.value
  if (!root) return []

  const selector = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')

  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    if (element.hasAttribute('disabled')) return false
    if (element.getAttribute('aria-hidden') === 'true') return false
    if (element.hasAttribute('inert')) return false
    return true
  })
}

function focusFirstElement() {
  const focusables = getFocusableElements()
  if (focusables.length) {
    focusables[0].focus()
    return
  }
  overlayRef.value?.focus()
}

function handleTab(event: KeyboardEvent) {
  const focusables = getFocusableElements()
  if (!focusables.length) {
    event.preventDefault()
    overlayRef.value?.focus()
    return
  }

  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement as HTMLElement | null

  if (event.shiftKey) {
    if (!active || active === first || !overlayRef.value?.contains(active)) {
      event.preventDefault()
      last.focus()
    }
    return
  }

  if (!active || active === last || !overlayRef.value?.contains(active)) {
    event.preventDefault()
    first.focus()
  }
}

function handlePointer(event: PointerEvent) {
  if (!props.open || !props.closeOnOutside) return

  const target = event.target as Node | null
  if (!target) return
  if (overlayRef.value?.contains(target)) return
  if (anchorEl.value?.contains(target)) return

  requestClose()
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return

  if (event.key === 'Escape' && props.closeOnEscape) {
    event.preventDefault()
    requestClose()
    return
  }

  if (event.key === 'Tab' && props.trapFocus) {
    handleTab(event)
  }
}

function attachListeners() {
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('pointerdown', handlePointer)
  window.addEventListener('keydown', handleKeydown)
}

function detachListeners() {
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('pointerdown', handlePointer)
  window.removeEventListener('keydown', handleKeydown)
}

function releaseLock() {
  if (!releaseScrollLock) return
  releaseScrollLock()
  releaseScrollLock = null
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null

      if (props.lockScroll) {
        releaseScrollLock = acquireScrollLock()
      }

      attachListeners()
      await nextTick()
      updatePosition()

      if (props.trapFocus) {
        focusFirstElement()
      }
      return
    }

    detachListeners()
    releaseLock()

    if (restoreFocusTo?.isConnected) {
      restoreFocusTo.focus()
    }
    restoreFocusTo = null
  },
  { immediate: true },
)

watch(
  () => anchorEl.value,
  async () => {
    if (!props.open) return
    await nextTick()
    updatePosition()
  },
)

onBeforeUnmount(() => {
  detachListeners()
  releaseLock()
})
</script>

<template>
  <Teleport :to="teleportTo">
    <Transition :name="transitionName">
      <div
        v-if="open"
        ref="overlayRef"
        v-bind="attrs"
        class="relative-overlay"
        :style="overlayStyle"
        :role="role"
        :aria-modal="ariaModal"
        :aria-label="ariaLabel"
        :aria-labelledby="ariaLabelledby"
        tabindex="-1" title="ariaLabel"
      >
        <slot :close="requestClose" />
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss">
.relative-overlay {
  position: fixed;
  z-index: var(--relative-overlay-z-index, 10001);
}

.relative-overlay-enter-active,
.relative-overlay-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
  will-change: opacity, transform;
}

.relative-overlay-enter-from,
.relative-overlay-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.relative-overlay-enter-to,
.relative-overlay-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
