// File: src/components/navs/navUtils.ts

// DEPS
import { ref } from 'vue'

// UTILS
import { vp } from '@/utils/viewport'

export const isMobileMenuOpen = ref(false)

export const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

export const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

export function scrollToTarget(e: MouseEvent, isDropdown: boolean = true) {
  e.preventDefault()

  if (!vp.lg.value && isDropdown) {
    toggleMobileMenu()
  }

  const link = e.currentTarget as HTMLAnchorElement
  const selector = link.dataset.target
  if (!selector) return

  const target = document.querySelector<HTMLElement>(selector)
  if (!target) return

  // const smoother = ScrollSmoother.get()
  // if (smoother) smoother.scrollTo(target, true)
  // else
  target.scrollIntoView({ behavior: 'smooth' })
}
