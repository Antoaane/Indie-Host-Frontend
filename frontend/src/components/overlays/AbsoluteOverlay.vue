<!-- File: src/components/overlays/AbsoluteOverlay.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useAttrs, watch } from 'vue'
import { acquireScrollLock, type ReleaseScrollLock } from '@/components/overlays/scrollLock'

defineOptions({
  inheritAttrs: false,
})

type AbsoluteOverlayMode = 'centered' | 'side-panel'

const props = withDefaults(
  defineProps<{
    open: boolean
    mode?: AbsoluteOverlayMode
    teleportTo?: string
    transitionName?: string
    role?: string
    ariaLabel?: string
    ariaLabelledby?: string
    closeOnBackdrop?: boolean
    closeOnEscape?: boolean
    lockScroll?: boolean
    trapFocus?: boolean
    zIndex?: number
  }>(),
  {
    mode: 'centered',
    teleportTo: 'body',
    transitionName: 'absolute-overlay',
    role: 'dialog',
    ariaLabel: undefined,
    ariaLabelledby: undefined,
    closeOnBackdrop: true,
    closeOnEscape: true,
    lockScroll: true,
    trapFocus: true,
    zIndex: 9999,
  },
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const attrs = useAttrs()
const overlayRef = ref<HTMLElement | null>(null)
const ariaModal = computed(() => (props.role === 'dialog' ? 'true' : undefined))
const overlayClasses = computed(() => [
  'absolute-overlay',
  `absolute-overlay--${props.mode}`,
])
const overlayStyle = computed(() => ({
  '--absolute-overlay-z-index': String(props.zIndex),
}))

let releaseScrollLock: ReleaseScrollLock | null = null
let restoreFocusTo: HTMLElement | null = null

function requestClose() {
  emit('close')
}

function handleBackdropClick() {
  if (!props.closeOnBackdrop) return
  requestClose()
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
  window.addEventListener('keydown', handleKeydown)
}

function detachListeners() {
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
      focusFirstElement()
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
        :class="overlayClasses"
        :style="overlayStyle"
        :role="role"
        :aria-modal="ariaModal"
        :aria-label="ariaLabel"
        :aria-labelledby="ariaLabelledby"
        tabindex="-1"
        @click.self="handleBackdropClick"
      >
        <slot :close="requestClose" />
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;

.absolute-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--absolute-overlay-z-index, 9999);

  width: 100%;
  height: 100%;

  display: flex;
  background-color: rgba($secondary, 0.2);

  @include min-width(lg) {
    backdrop-filter: blur(1px);
  }
}

.absolute-overlay--centered {
  padding-top: var(--layout-gap);
  @include layout-gap(padding, inline, 0.5);

  align-items: center;
  justify-content: center;

  @include min-width(lg) {
    padding-top: var(--layout-gap-4xl);
    padding-bottom: var(--layout-gap-4xl);
    @include layout-gap;
  }
}

.absolute-overlay--centered > * {
  max-width: 100%;
  max-height: 100%;
}

.absolute-overlay--side-panel {
  align-items: stretch;
  justify-content: flex-end;
  overflow: hidden;
}

.absolute-overlay--side-panel > * {
  height: 100%;
  max-width: 100%;
}

.absolute-overlay-enter-active,
.absolute-overlay-leave-active {
  transition: opacity 0.25s ease;
  will-change: opacity;
}

.absolute-overlay-enter-active > *,
.absolute-overlay-leave-active > * {
  transition: transform 0.25s ease;
  will-change: transform;
}

.absolute-overlay-enter-from,
.absolute-overlay-leave-to {
  opacity: 0;
}

.absolute-overlay-enter-to,
.absolute-overlay-leave-from {
  opacity: 1;
}

.absolute-overlay.absolute-overlay--centered.absolute-overlay-enter-from > *,
.absolute-overlay.absolute-overlay--centered.absolute-overlay-leave-to > * {
  transform: translateY(24px);
}

.absolute-overlay.absolute-overlay--centered.absolute-overlay-enter-to > *,
.absolute-overlay.absolute-overlay--centered.absolute-overlay-leave-from > * {
  transform: translateY(0);
}

.absolute-overlay.absolute-overlay--side-panel.absolute-overlay-enter-from > *,
.absolute-overlay.absolute-overlay--side-panel.absolute-overlay-leave-to > * {
  transform: translateX(100%);
}

.absolute-overlay.absolute-overlay--side-panel.absolute-overlay-enter-to > *,
.absolute-overlay.absolute-overlay--side-panel.absolute-overlay-leave-from > * {
  transform: translateX(0);
}
</style>
