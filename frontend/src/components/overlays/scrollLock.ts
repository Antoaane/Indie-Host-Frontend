// File: src/components/overlays/scrollLock.ts

let lockCount = 0
let previousHtmlOverflow = ''
let previousBodyOverflow = ''

export type ReleaseScrollLock = () => void

/**
 * Force la libération du scroll (failsafe).
 * Utile si un overlay a été démonté sans exécuter son cleanup.
 */
export function forceReleaseScrollLock() {
  if (typeof document === 'undefined') return
  lockCount = 0
  // Restaure ce que ce module a modifié, et "nettoie" aussi les patterns
  // classiques d'autres scroll-locks (position fixed sur body).
  document.documentElement.style.overflow = previousHtmlOverflow || ''
  document.body.style.overflow = previousBodyOverflow || ''
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.left = ''
  document.body.style.right = ''
  document.body.style.width = ''
  previousHtmlOverflow = ''
  previousBodyOverflow = ''
}

export function acquireScrollLock(): ReleaseScrollLock {
  if (typeof document === 'undefined') {
    return () => {}
  }

  if (lockCount === 0) {
    previousHtmlOverflow = document.documentElement.style.overflow
    previousBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
  }

  lockCount += 1
  let released = false

  return () => {
    if (released) return
    released = true

    lockCount = Math.max(0, lockCount - 1)
    if (lockCount > 0) return

    document.documentElement.style.overflow = previousHtmlOverflow
    document.body.style.overflow = previousBodyOverflow
  }
}
