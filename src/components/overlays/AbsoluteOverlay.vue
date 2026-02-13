<!-- File: src/components/overlays/AbsoluteOverlay.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useAttrs, watch } from 'vue'
import { acquireScrollLock, type ReleaseScrollLock } from '@/components/overlays/scrollLock'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    open: boolean
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
        class="absolute-overlay"
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
  width: 100%;
  height: 100%;

  padding-top: var(--layout-gap);
  @include layout-gap(padding, inline, 0.5);

  display: flex;
  align-items: center;
  justify-content: center;

  position: fixed;
  inset: 50%;
  z-index: var(--absolute-overlay-z-index, 9999);

  transform: translate(-50%, -50%);
  background-color: rgba($secondary, 0.2);

  @include min-width(lg) {
    padding-top: var(--layout-gap-4xl);
    padding-bottom: var(--layout-gap-4xl);
    backdrop-filter: blur(1px);
    @include layout-gap;
  }
}

.absolute-overlay-enter-active,
.absolute-overlay-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
  will-change: opacity, transform;
}

.absolute-overlay-enter-from,
.absolute-overlay-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% + 24px));
}

.absolute-overlay-enter-to,
.absolute-overlay-leave-from {
  opacity: 1;
  transform: translate(-50%, -50%);
}
</style>
