// File: src/views/Landing/components/HabitsSection/utils/useHabitsAnim.ts

// DEPS
import type { Ref } from 'vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { activeSlideIndex } from '@/views/Landing/components/HabitsSection/stores/slider'
import gsap from 'gsap'
import { Swiper } from 'swiper/vue'

// UTILS
import { vp } from '@/utils/viewport'

interface UseHabitsAnimParams {
  swiperInstance: Ref<any | null>
  carouselRef: Ref<HTMLElement | null>
  lightRef?: Ref<HTMLElement | null>
  shadowRef?: Ref<HTMLElement | null>
}

export function useHabitsAnim({
  swiperInstance,
  carouselRef,
  lightRef,
  shadowRef,
}: UseHabitsAnimParams) {
  let tl: gsap.core.Timeline | null = null
  const isOpen = { value: false } // état interne (peut être exposé via paramètre si besoin)
  const slideDisplayRef = ref<HTMLElement | null>(null)

  const animateSlides = () => {
    const s = swiperInstance.value

    if (!s) {
      console.log('❌ [animateSlides] swiperInstance.value NOT found')
      return
    } else {
      console.log('✅ [animateSlides] swiperInstance.value found', s)
    }

    if (!carouselRef.value?.matches(':hover')) {
      console.log('❌ [animateSlides] carouselRef NOT hovered or undefined', carouselRef.value)
      if (vp.lg.value) return
    } else {
      console.log('✅ [animateSlides] carouselRef hovered')
    }

    s.slides.forEach((slide: HTMLElement) => {
      gsap.to(slide, {
        scale: 1,
        opacity: 1,
        borderColor: 'transparent',
        zIndex: 1,
        duration: 0.3,
      })
    })

    const activeSlide: HTMLElement = s.slides[s.activeIndex]

    gsap.to(activeSlide, {
      scale: vp.lg.value ? 1.25 : 1,
      borderColor: '#FCFAFA',
      zIndex: 10,
      duration: 0.3,
    })

    if (vp.lg.value) {
      s.slides.forEach((slide: HTMLElement, i: number) => {
        if (i !== s.activeIndex) gsap.to(slide, { opacity: 0.5, duration: 0.3 })
      })
    }

    activeSlideIndex.value = s.realIndex ?? s.activeIndex
    console.log('➡️✅ [animateSlides] activeSlideIndex updated:', activeSlideIndex.value)
  }

  const hugerSlide = () => {
    const swiper = swiperInstance.value

    if (!swiper) {
      console.log('❌ [hugerSlide] swiperInstance.value NOT found')
      return
    } else {
      console.log('✅ [hugerSlide] swiperInstance.value found')
    }

    if (!slideDisplayRef?.value) {
      console.log('❌ [hugerSlide] slideDisplayRef NOT found')
      return
    } else {
      console.log('✅ [hugerSlide] slideDisplayRef found')
    }

    if (!swiper || !slideDisplayRef?.value) return
    slideDisplayRef.value.innerHTML = swiper.slides[swiper.activeIndex].innerHTML
    gsap.to(slideDisplayRef.value, { opacity: 1, duration: 0.3 })
  }

  const resetSlideSize = () => {
    const swiper = swiperInstance.value
    slideDisplayRef.value = document.getElementById('slideDisplayRef')

    if (!swiper) {
      console.log('❌ [resetSlideSize] swiperInstance.value NOT found')
      return
    } else {
      console.log('✅ [resetSlideSize] swiperInstance.value found')
    }

    if (!slideDisplayRef?.value) {
      console.log('❌ [resetSlideSize] slideDisplayRef NOT found')
      return
    } else {
      console.log('✅ [resetSlideSize] slideDisplayRef found')
    }

    if (!swiper || !slideDisplayRef?.value) return
    gsap.to(slideDisplayRef.value, { opacity: 0, duration: 0.3 })

    setTimeout(() => {
      if (slideDisplayRef.value) slideDisplayRef.value.innerHTML = ''
      console.log('✅ [resetSlideSize] slideDisplayRef.innerHTML cleared')
    }, 300)

    swiper.slides.forEach((slide: HTMLElement) =>
      gsap.to(slide, {
        scale: 1,
        opacity: 1,
        borderColor: 'transparent',
        zIndex: 1,
        duration: 0.3,
      }),
    )
  }

  const onEnter = () => {

    if (!shadowRef?.value) {
      console.log('❌ [onEnter] shadowRef NOT found')
      return
    } else {
      console.log('✅ [onEnter] shadowRef found')
    }

    if (!lightRef?.value) {
      console.log('❌ [onEnter] lightRef NOT found')
      return
    } else {
      console.log('✅ [onEnter] lightRef found')
    }

    const slideTitles = document.querySelector('.slides-titles')

    if (!slideTitles) {
      console.log('❌ [onEnter] slideTitles NOT found')
    } else {
      console.log('✅ [onEnter] slideTitles found')
    }

    if (!shadowRef?.value || !lightRef?.value) return

    const swiperWidth = document.querySelector('.swiper-wrapper')?.clientWidth
    const modSize = swiperWidth ? swiperWidth * 0.12 : 40 * 0.15
    // const mod = vp.xxxl.value ? '90%' : vp.xxl.value ? '100%' : vp.xl.value ? '90%' : vp.lg.value ? '80%' : '100%'
    const mod = vp.lg.value ? `${modSize}${swiperWidth ? 'px' : 'vw'}` : '0'
    console.log('mod', mod.toString())

    if (slideTitles) {
      gsap.to(slideTitles, {
        translateX: mod,
        // width: '60%',
        duration: 0.3,
        ease: 'power2.out',
      })
    }
    gsap.to(shadowRef.value, {
      '--shadow-end': '50%',
      '--shadow-start': '30%',
      '--shadow-size': '300% 60%',
      '--shadow-pos-x': '50%',
      duration: 0.3,
      ease: 'power2.out',
    })
    gsap.to(lightRef.value, {
      opacity: 0,
      duration: 0.3
    })

    tl?.pause()
    animateSlides()
  }

  const onLeave = () => {

    if (isOpen.value) {
      console.log('✅ [onLeave] isOpen, skipping')
      return
    }
    if (!shadowRef?.value) {
      console.log('❌ [onLeave] shadowRef NOT found')
      return
    } else {
      console.log('✅ [onLeave] shadowRef found')
    }
    if (!lightRef?.value) {
      console.log('❌ [onLeave] lightRef NOT found')
      return
    } else {
      console.log('✅ [onLeave] lightRef found')
    }

    const slideTitles = document.querySelector('.slides-titles')

    if (!slideTitles) {
      console.log('❌ [onEnter] slideTitles NOT found')
    } else {
      console.log('✅ [onEnter] slideTitles found')
    }

    if (isOpen.value) return
    if (!shadowRef?.value || !lightRef?.value) return

    resetSlideSize()

    if (slideTitles) {
      gsap.to(slideTitles, {
        translateX: '0px',
        duration: 0.3,
        ease: 'power2.out',
      })
    }
    gsap.to(shadowRef.value, {
      '--shadow-pos-x': '100%',
      '--shadow-size': '190% 50%',
      '--shadow-start': '20%',
      '--shadow-end': '50%',
      duration: 0.3,
      ease: 'power2.inOut',
    })
    gsap.to(lightRef.value, {
      opacity: 1,
      duration: 0.3
    })

    tl?.resume()
  }

  function onSwiperInit(swiper: any) {

    console.log('➡️✅ [onSwiperInit] called with swiper:', swiper)

    swiperInstance.value = swiper

    swiper.slideToLoop(1, 0)
    animateSlides()

    if (!tl && lightRef?.value) {

      console.log('➡️ [onSwiperInit] creating GSAP timeline')

      tl = gsap
        .timeline({ repeat: -1 })
        .to(lightRef?.value, {
          opacity: 0,
          duration: 0.3,
        })
        .add(() => {

          console.log('➡️ [GSAP timeline] slideNext called')

          swiperInstance.value?.slideNext()
        })
        .to(lightRef?.value, {
          delay: 0.5,
          opacity: 1,
          duration: 5 / 3,
        })
        .to(lightRef?.value, {
          opacity: 1,
          duration: (5 * 2) / 3,
        })
    } else {
      console.log('❌ [onSwiperInit] timeline already exists or lightRef missing')
    }
  }

  function onSlideChange(s: any) {

    console.log('➡️✅ [onSlideChange] new realIndex:', s.realIndex)

    activeSlideIndex.value = s.realIndex // realIndex = vrai index (0..n-1)
  }

  const onResize = () => {
    const s = swiperInstance.value
    if (!s) {
      console.log('❌ [onResize] swiperInstance.value NOT found')
      return
    }
    console.log('✅ [onResize] swiperInstance.value found, updating')
    // ici tu peux recalculer ou réaffecter tes params Swiper si besoin
    s.update()
  }

  onMounted(() => {
    slideDisplayRef.value = document.getElementById('slideDisplayRef')
    console.log('➡️ [useHabitsAnim] onMounted called')

    carouselRef.value = document.querySelector('.swiper-wrapper');
    console.log('➡️ [useHabitsAnim] onMounted :', carouselRef.value)

    const c = carouselRef.value
    if (!c) {
      console.log('❌ [onMounted] carouselRef NOT found')
      return
    } else {
      console.log('✅ [onMounted] carouselRef found')
    }

    if (vp.lg.value) {
      c?.addEventListener('mouseenter', onEnter)
      c?.addEventListener('touchstart', onEnter)
      c?.addEventListener('mouseleave', onLeave)
      c?.addEventListener('touchend', onLeave)
      c?.addEventListener('touchcancel', onLeave)
    }

    c?.addEventListener('click', () => {

      console.log('➡️ [carousel] click event')

      if (isOpen.value) resetSlideSize()
      else hugerSlide()
      isOpen.value = !isOpen.value
    })

    slideDisplayRef?.value?.addEventListener('click', () => {
      isOpen.value = false
      resetSlideSize()
    })

    window.addEventListener('resize', onResize)
  })

  onUnmounted(() => {

    console.log('➡️ [useHabitsAnim] onUnmounted called')

    window.removeEventListener('resize', onResize)
    tl?.kill()

    const c = carouselRef.value

    if (!c) {
      console.log('❌ [onUnmounted] carouselRef NOT found')
      return
    }

    c?.removeEventListener('mouseenter', onEnter)
    c?.removeEventListener('touchstart', onEnter)
    c?.removeEventListener('mouseleave', onLeave)
    c?.removeEventListener('touchend', onLeave)
    c?.removeEventListener('touchcancel', onLeave)

    c?.removeEventListener('click', () => {
      if (isOpen.value) resetSlideSize()
      else hugerSlide()
      isOpen.value = !isOpen.value
    })

    slideDisplayRef?.value?.removeEventListener('click', () => {
      isOpen.value = false
      resetSlideSize()
    })
  })

  watch(() => swiperInstance.value?.realIndex, () => {
    console.log('➡️✅ [watch] realIndex changed:', swiperInstance.value?.realIndex)
    animateSlides()
  })

  return {
    onSwiperInit,
    onSlideChange,
  }
}
