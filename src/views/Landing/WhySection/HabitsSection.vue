<!-- File: src/views/Landing/WhySection/HabitsSection.vue -->

<script setup lang="ts">
/* ────────────────────────────
   Imports
──────────────────────────────*/
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Navigation, Pagination, Autoplay } from 'swiper/modules'
import gsap from 'gsap'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

/* ────────────────────────────
   Refs & état
──────────────────────────────*/
const swiperElRef = ref<any>(null) // composant <Swiper>
const swiperInstance = ref<any | null>(null) // vraie instance Swiper

const carouselRef = ref<HTMLElement | null>(null)
const titleSlideRef = ref<HTMLElement | null>(null)
const slideDisplayRef = ref<HTMLElement | null>(null)
const lightRef = ref<HTMLSpanElement | null>(null)
const shadowRef = ref<HTMLSpanElement | null>(null)

const isOpen = ref(false)
const activeIndexInTitles = ref(0)

/* ────────────────────────────
   Contenu & options
──────────────────────────────*/

const slideTitle1 = `Gérez vos réservations dans un <strong>espace intuitif</strong>`
const slideTitle2 = `Vos voyageurs réservent <strong>simplement</strong> et en <strong>toute sécurité</strong>`
const slideTitle3 = `Centralisez vos messages <strong>sans effort</strong>`

const slideTitles = [
  slideTitle1,
  slideTitle2,
  slideTitle3,
  slideTitle1,
  slideTitle2,
  slideTitle3,
]

const baseSwiperParams = () => ({
  modules: [
    Autoplay,
  ],
  direction: window.innerWidth > 1024 ? 'vertical' : 'horizontal',
  slidesPerView: 3,
  // slidesPerView: window.innerWidth > 1024 ? 3 : 1,
  spaceBetween: window.innerWidth > 1024 ? 32 : 16,
  autoplay: {
    delay: 2000,
    disableOnInteraction: true,
    // reverseDirection: true,
  },
  loop: true,
  centeredSlides: true,
  pagination: false,
  navigation: false,
})

const swiperParams = ref(baseSwiperParams())

/* ────────────────────────────
   Helpers GSAP
──────────────────────────────*/
let tl: gsap.core.Timeline | null = null

const animateSlides = () => {
  const s = swiperInstance.value
  if (carouselRef.value) {
    const onHover = carouselRef.value.matches(':hover')
    if (!s || !onHover) return
  }

  const { slides, activeIndex, realIndex } = s
  const activeSlideEl = slides[activeIndex] // ← clone ou original, peu importe pour l’anim

  // reset
  slides.forEach((sl: HTMLElement) => gsap.to(sl, { scale: 1, opacity: 1, borderColor: 'transparent', zIndex: 1, duration: 0.3 }))

  // zoom slide active
  gsap.to(activeSlideEl, {
    scale: window.innerWidth > 1024 ? 1.25 : 1.15,
    borderColor: '#FCFAFA',
    zIndex: 10,
    duration: 0.3,
  })

  // atténuer les autres (desktop)
  if (window.innerWidth > 1024) {
    slides.forEach((sl: HTMLElement, i: number) => i !== activeIndex && gsap.to(sl, { opacity: 0.5, duration: 0.3 }))
  }

  // mettre à jour le titre si besoin
  activeIndexInTitles.value = realIndex // voir §5
}

const hugerSlide = () => {
  const swiper = swiperInstance.value
  if (!swiper || !slideDisplayRef.value) return
  slideDisplayRef.value.innerHTML = swiper.slides[swiper.activeIndex].innerHTML
  gsap.to(slideDisplayRef.value, { opacity: 1, duration: 0.3 })
}

const resetSlideSize = () => {
  const swiper = swiperInstance.value
  if (!swiper || !slideDisplayRef.value) return
  gsap.to(slideDisplayRef.value, { opacity: 0, duration: 0.3 })
  setTimeout(() => (slideDisplayRef.value!.innerHTML = ''), 300)
  swiper.slides.forEach((slide: HTMLElement) => gsap.to(slide, { scale: 1, opacity: 1, borderColor: 'transparent', zIndex: 1, duration: 0.3 }))
}

/* ────────────────────────────
   Events DOM (hover / click)
──────────────────────────────*/
const onEnter = () => {
  if (!shadowRef.value || !lightRef.value) return
  gsap.to(shadowRef.value, {
    '--shadow-pos-x': '50%',
    '--shadow-size': '365% 75%',
    '--shadow-start': '35%',
    '--shadow-end': '50%',
    duration: 0.3,
    ease: 'power2.out',
  })
  gsap.to(lightRef.value, { opacity: 0, duration: 0.3 })
  tl?.pause()
  animateSlides()
}

const onLeave = () => {
  if (isOpen.value) return
  if (!shadowRef.value || !lightRef.value) return
  resetSlideSize()
  gsap.to(shadowRef.value, {
    '--shadow-pos-x': '0%',
    '--shadow-size': '175% 70%',
    '--shadow-start': '20%',
    '--shadow-end': '50%',
    delay: 0.3,
    duration: 0.3,
    ease: 'power2.inOut',
  })
  gsap.to(lightRef.value, { opacity: 1, duration: 0.3 })
  tl?.resume()
}

/* ────────────────────────────
   Swiper init callback
──────────────────────────────*/
const onSwiperInit = (swiper: any) => {
  swiperInstance.value = swiper

  swiper.slideToLoop(1, 0)

  animateSlides() // premier rendu

  // timeline GSAP (une seule fois)
  if (!tl) {
    tl = gsap
      .timeline({ repeat: -1 })
      .to(lightRef.value, {
        opacity: 0,
        duration: 0.3,
      })
      .add(() => swiperInstance.value?.slideNext()) // ↦ toujours en avant
      .to(lightRef.value, {
        delay: 0.5,
        opacity: 1,
        duration: 5 / 3,
      })
      .to(lightRef.value, {
        opacity: 1,
        duration: (5 * 2) / 3,
      })
  }
}

/* ────────────────────────────
   Resize listener
──────────────────────────────*/
const onResize = () => {
  const s = swiperInstance.value
  if (!s) return
  Object.assign(s.params, baseSwiperParams())
  swiperParams.value = baseSwiperParams() // reactive pour les props
  s.update()
}

/* ────────────────────────────
   Lifecycle
──────────────────────────────*/
onMounted(() => {
  // Hover & touch
  const c = carouselRef.value
  c?.addEventListener('mouseenter', onEnter)
  c?.addEventListener('touchstart', onEnter)
  c?.addEventListener('mouseleave', onLeave)
  c?.addEventListener('touchend', onLeave)
  c?.addEventListener('touchcancel', onLeave)

  // Click
  c?.addEventListener('click', () => {
    isOpen.value ? resetSlideSize() : hugerSlide()
    isOpen.value = !isOpen.value
  })
  slideDisplayRef.value?.addEventListener('click', () => {
    isOpen.value = false
    resetSlideSize()
  })

  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  tl?.kill()
})

/* ────────────────────────────
   Watchers
──────────────────────────────*/
watch(activeIndexInTitles, () => {
  animateSlides() // seul besoin visuel
})

const onSlideChange = (s: any) => {
  activeIndexInTitles.value = s.realIndex // realIndex = vrai index (0..n-1)
}
</script>

<template>
  <section id="habits-section">
    <div class="container">
      <!-- TITRE -->
      <div class="content">
        <h2>
          Gardez les mêmes <span class="gradient-text">habitudes</span> dans un espace de gestion
          <span class="gradient-text">simple</span>
        </h2>

        <!-- <Transition
          name="fade"
          mode="out-in"
        > -->
        <div class="slides-titles">
          <h3
            v-for="(txt, idx) in [slideTitle1, slideTitle2, slideTitle3]"
            :key="idx"
            ref="titleSlideRef"
            v-html="txt"
            :class="['title', { active: idx === activeIndexInTitles % 3 }]"
            aria-live="polite"
          />
        </div>
        <!-- </Transition> -->
      </div>

      <!-- CAROUSEL -->
      <div class="illustration">
        <div
          class="carousel"
          ref="carouselRef"
        >
          <Swiper
            ref="swiperElRef"
            v-bind="swiperParams"
            @swiper="onSwiperInit"
            @slideChange="onSlideChange"
            class="my-swiper"
          >
            <SwiperSlide>
              <img
                class="slide-page-svg"
                src="@/assets/media/images/dashboard-detail-logement.png"
                alt="Page réservations"
              />
            </SwiperSlide>
            <SwiperSlide>
              <img
                class="slide-page-svg"
                src="@/assets/media/images/annonce-reservation.png"
                alt="Page paiement"
              />
            </SwiperSlide>
            <SwiperSlide>
              <img
                class="slide-page-svg"
                src="@/assets/media/images/messagerie.png"
                alt="Page messagerie"
              />
            </SwiperSlide>
            <SwiperSlide>
              <img
                class="slide-page-svg"
                src="@/assets/media/images/dashboard-detail-logement.png"
                alt="Page réservations"
              />
            </SwiperSlide>
            <SwiperSlide>
              <img
                class="slide-page-svg"
                src="@/assets/media/images/annonce-reservation.png"
                alt="Page paiement"
              />
            </SwiperSlide>
            <SwiperSlide>
              <img
                class="slide-page-svg"
                src="@/assets/media/images/messagerie.png"
                alt="Page messagerie"
              />
            </SwiperSlide>
          </Swiper>

          <!-- EFFETS DE LUMIÈRE -->
          <span
            id="shadow"
            ref="shadowRef"
          >
            <div
              id="light"
              ref="lightRef"
            >
              <span id="halo"></span>
              <span id="line_1"></span>
              <span id="line_2"></span>
              <span id="line_3"></span>
            </div>
          </span>
        </div>
      </div>
    </div>

    <!-- Slide en grand -->
    <div
      ref="slideDisplayRef"
      class="slide-display"
    ></div>
  </section>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.15s ease,
    top 0.15s ease !important;
}
.fade-enter-from {
  opacity: 0;
  top: calc(var(--title-offset) * 30px);
}
.fade-leave-to {
  opacity: 0;
  top: calc((var(--title-offset) * 30px) * -1);
}
.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  top: 0;
}
</style>
