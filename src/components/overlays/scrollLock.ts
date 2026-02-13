/* File: src/components/overlays/scrollLock.ts */

let lockCount = 0
let previousHtmlOverflow = ''
let previousBodyOverflow = ''

export type ReleaseScrollLock = () => void

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
