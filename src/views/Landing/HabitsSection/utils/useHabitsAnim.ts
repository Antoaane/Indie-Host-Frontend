// File: src/views/Landing/HabitsSection/utils/useHabitsAnim.ts

import { onMounted, onUnmounted, watch } from 'vue'
import gsap from 'gsap'

export function useHabitsAnim({ swiperInstance, carouselRef }) {
  let tl = null

  const animateSlides = () => {
    const s = swiperInstance.value
    if (!s || !carouselRef.value?.matches(':hover')) return

    s.slides.forEach(sl => gsap.to(sl, { scale: 1, opacity: 1, borderColor: 'transparent', zIndex: 1, duration: 0.3 }))
    const activeSlide = s.slides[s.activeIndex]
    gsap.to(activeSlide, { scale: 1.25, borderColor: '#FCFAFA', zIndex: 10, duration: 0.3 })

    s.slides.forEach((sl, i) => i !== s.activeIndex && gsap.to(sl, { opacity: 0.5, duration: 0.3 }))
  }

  onMounted(() => {
    // Ajoute listeners hover, click, resize comme dans ton code original
  })

  onUnmounted(() => {
    tl?.kill()
    // Nettoyage listeners
  })

  watch(() => swiperInstance.value?.activeIndex, () => {
    animateSlides()
  })
}
