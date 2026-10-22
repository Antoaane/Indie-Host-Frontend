// File: src/composables/useTouchLongPress.ts

import { onBeforeUnmount } from 'vue'

const LONG_PRESS_MS = 350
const MOVE_TOLERANCE_PX = 10

type TouchLongPressOptions = {
  /** Le glisser est-il en cours (le défilement doit alors rester bloqué) ? */
  isActive: () => boolean
}

/**
 * Glisser-déposer au doigt sans confisquer le défilement : un geste qui bouge
 * avant l'appui long reste un scroll natif ; un doigt immobile 350 ms arme le
 * glisser, puis le défilement est bloqué jusqu'au relâchement.
 */
export function useTouchLongPress({ isActive }: TouchLongPressOptions) {
  let timer = 0
  let pointerId = -1
  let startX = 0
  let startY = 0
  let listening = false

  // Non passif : c'est le seul moyen d'empêcher le scroll une fois le glisser lancé.
  function onTouchMove(event: TouchEvent) {
    if (isActive() && event.cancelable) event.preventDefault()
  }

  // Android ouvre le menu « Enregistrer l'image » sur un appui long.
  function onContextMenu(event: Event) {
    event.preventDefault()
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== pointerId || !timer) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) cancelPending()
  }

  function onPointerEnd(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    release()
  }

  function bind() {
    if (listening) return
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onPointerEnd)
    listening = true
  }

  function unbind() {
    if (!listening) return
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerEnd)
    window.removeEventListener('pointercancel', onPointerEnd)
    listening = false
  }

  function cancelPending() {
    if (timer) window.clearTimeout(timer)
    timer = 0
    if (!isActive()) release()
  }

  function release() {
    if (timer) window.clearTimeout(timer)
    timer = 0
    pointerId = -1
    unbind()
  }

  /** Arme l'appui long ; `onLongPress` reçoit l'événement `pointerdown` d'origine. */
  function arm(event: PointerEvent, onLongPress: (event: PointerEvent) => void) {
    release()
    pointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    bind()
    timer = window.setTimeout(() => {
      timer = 0
      navigator.vibrate?.(8)
      onLongPress(event)
    }, LONG_PRESS_MS)
  }

  onBeforeUnmount(release)

  return { arm, release }
}
