<!-- File: src/views/Landing/WhySection/HabitsSection.vue -->

<script setup lang="ts">
// DEPS
import { onMounted, ref, nextTick } from 'vue'
import { Splide, SplideSlide } from '@splidejs/vue-splide'
import gsap from 'gsap'

// ASSETS
import DashboardDetailLogement from '@/components/svgs/images/DashboardDetailLogement.vue'
import AnnonceReservation from '@/components/svgs/images/AnnonceReservation.vue'
import Messagerie from '@/components/svgs/images/Messagerie.vue'

/* ---------------- REFS ---------------- */
const carouselRef = ref<HTMLElement | null>(null)
const splideRef = ref<any>(null)
const slideDisplayRef = ref<HTMLElement | null>(null)
const lightRef = ref<HTMLSpanElement | null>(null)
const shadowRef = ref<HTMLSpanElement | null>(null)

const activeSlide = ref<HTMLElement | null>(null)
const otherSlides = ref<HTMLElement[]>(null)
const titleSlide = ref<HTMLElement | null>(null)
const isOpen = ref<boolean>(false)

/* ---------------- TITRES PAR SLIDE ---------------- */
const slideTitles = [
  `Gérez vos réservations dans un <strong>espace intuitif</strong>`, // index 0 – Messagerie
  `Vos voyageurs réservent <strong>simplement</strong> et en <strong>toute sécurité</strong>`, // index 1 – Dashboard
  `Centralisez vos messages <strong>sans effort</strong>`, // index 2 – Annonce
  `Gérez vos réservations dans un <strong>espace intuitif</strong>`, // index 3 – Messagerie (copie)
  `Vos voyageurs réservent <strong>simplement</strong> et en <strong>toute sécurité</strong>`, // index 4 – Dashboard (copie)
]
const activeIndex = ref(0)

/* ---------------- OPTIONS SPLIDE ---------------- */
const opts = {
  type: 'slide',
  direction: 'ttb',
  height: '110vh',
  perPage: 3,
  perMove: 1,
  gap: '2rem',
  arrows: false,
  pagination: false,
  drag: true,
  breakpoints: {
    1280: {
      height: '90vh',
    },
    1024: {
      direction: 'ltr',
      height: 'auto',
      gap: '4rem',
    },
    640: {
      height: 'auto',
      gap: '2rem',
    },
  },
}

onMounted(() => {
  activeSlide.value = document.querySelector('.splide__slide.is-next')
  otherSlides.value = document.querySelectorAll('.splide__slide:not(.is-next)')
  titleSlide.value = document.getElementById('slide_title')

  document.documentElement.style.setProperty('--title-offset', '1')

  nextTick(() => {
    console.log(carouselRef.value)
    console.log(activeSlide.value)
    const carousel = carouselRef.value
    const splide = splideRef.value?.splide as any
    const light = lightRef.value
    const shadow = shadowRef.value
    if (!splide || !light || !shadow || !carousel) return

    /* --- Gestion de la taille des slides --- */
    const biggerSlide = () => {
      if (!carousel.matches(':hover') && window.innerWidth > 1024) {
        return
      }

      if (window.innerWidth > 1024) {
        gsap.to(titleSlide.value, {
          translateX: '-2rem',
          duration: 0.3,
          ease: 'power2.out',
        })
      }
      gsap.to(activeSlide.value, {
        scale: window.innerWidth > 1024 ? 1.25 : 1.15,
        borderColor: '#FCFAFA',
        zIndex: 10,
        duration: 0.3,
      })
      if (window.innerWidth > 1024) {
        gsap.to(otherSlides.value, {
          opacity: 0.5,
          duration: 0.3,
        })
      }
    }

    const hugerSlide = () => {
      slideDisplayRef.value.innerHTML = activeSlide.value.innerHTML
      gsap.to(slideDisplayRef.value, {
        opacity: 1,
        duration: 0.3,
      })

      // gsap.to(shadow, {
      //   '--shadow-pos-x': '50%',
      //   '--shadow-size': '365% 90%',
      //   '--shadow-start': '35%',
      //   '--shadow-end': '50%',
      //   duration: 0.3,
      //   ease: 'power2.out',
      // })
      // gsap.to(titleSlide.value, {
      //   opacity: 0,
      //   duration: 0.3,
      //   ease: 'power2.out',
      // })
      // gsap.to(activeSlide.value, {
      //   transformOrigin: '100% 50%',
      //   scale: 2.25,
      //   borderColor: '#FCFAFA',
      //   zIndex: 10,
      //   duration: 0.3,
      // })
      gsap.to(otherSlides.value, {
        opacity: 0.5,
        duration: 0.3,
      })
    }

    const resetSlideSize = () => {
      gsap.to(slideDisplayRef.value, {
        opacity: 0,
        duration: 0.3,
      })
      setTimeout(() => {
        slideDisplayRef.value.innerHTML = ''
      }, 300)
      if (window.innerWidth > 1024) {
        gsap.to(titleSlide.value, {
          opacity: 1,
          translateX: '0rem',
          duration: 0.3,
          ease: 'power2.out',
        })
      }
      if (window.innerWidth > 1024) {
        gsap.to(activeSlide.value, {
          scale: 1,
          opacity: 1,
          zIndex: 1,
          borderColor: 'transparent',
          duration: 0.3,
        })
      }
      gsap.to(otherSlides.value, {
        scale: 1,
        opacity: 1,
        zIndex: 1,
        borderColor: 'transparent',
        duration: 0.3,
      })
    }

    /* --- Animation GSAP cyclique --- */
    const interval = 5
    let forward = true

    const tl = gsap.timeline({ repeat: -1, paused: false })
    tl.to(light, { opacity: 0, duration: 0.3 })
      .add(() => {
        const idx = splide.index
        const last = splide.length - opts.perPage

        if (forward) {
          idx >= last ? ((forward = false), splide.go('<')) : splide.go('>')
        } else {
          idx <= 0 ? ((forward = true), splide.go('>')) : splide.go('<')
        }
        document.documentElement.style.setProperty('--title-offset', forward ? '1' : '-1')

        splide.on('moved', (newIdx: number) => {
          activeSlide.value = document.querySelector('.splide__slide.is-next')
          otherSlides.value = document.querySelectorAll('.splide__slide:not(.is-next)')
          titleSlide.value = document.getElementById('slide_title')

          resetSlideSize()

          activeIndex.value = newIdx

          biggerSlide()
        })
      })
      .to(light, {
        delay: 0.5,
        opacity: 1,
        duration: interval / 3,
      })
      .to(light, {
        opacity: 1,
        duration: (interval * 2) / 3,
      })

    /* --- Hover interactions --- */
    const onEnter = () => {
      gsap.to(shadow, {
        '--shadow-pos-x': '50%',
        '--shadow-size': '365% 75%',
        '--shadow-start': '35%',
        '--shadow-end': '50%',
        duration: 0.3,
        ease: 'power2.out',
      })
      gsap.to(light, { opacity: 0, duration: 0.3 })
      tl.pause()

      biggerSlide()
    }

    const onLeave = () => {
      if (isOpen.value) {
        return
      }
      resetSlideSize()

      gsap.to(shadow, {
        '--shadow-pos-x': '0%',
        '--shadow-size': '175% 70%',
        '--shadow-start': '20%',
        '--shadow-end': '50%',
        delay: 0.3,
        duration: 0.3,
        ease: 'power2.inOut',
      })

      tl.resume()
    }

    /* --- Événements --- */
    carousel.addEventListener('mouseenter', onEnter)
    carousel.addEventListener('touchstart', onEnter)
    carousel.addEventListener('mouseleave', onLeave)
    carousel.addEventListener('touchend', onLeave)
    carousel.addEventListener('touchcancel', onLeave)

    carousel.addEventListener('click', () => {
      isOpen.value = true
      if (isOpen.value) {
        hugerSlide()
      } else {
        resetSlideSize()
      }
    })

    slideDisplayRef.value.addEventListener('click', () => {
      isOpen.value = false
      resetSlideSize()
    })
  })
})
</script>

<template>
  <section id="habits-section">
    <div class="container">
      <!-- TITRE + SOUS-TITRE -->
      <div class="content">
        <h2>
          Gardez les mêmes <span class="gradient-text">habitudes</span> dans un espace de gestion
          <span class="gradient-text">simple</span>
        </h2>

        <Transition
          name="fade"
          mode="out-in"
        >
          <h3
            :key="activeIndex"
            id="slide_title"
            v-html="slideTitles[activeIndex]"
          ></h3>
        </Transition>
      </div>

      <!-- ILLUSTRATION / CAROUSEL -->
      <div class="illustration">
        <div
          class="carousel"
          ref="carouselRef"
        >
          <Splide
            ref="splideRef"
            :options="opts"
            aria-label="Carrousel vertical"
          >
            <SplideSlide>
              <Messagerie
                class="slide-page-svg"
                title="Page messagerie"
                desc="Pages permettant à l'hôte de discuter avec les voyageurs."
              />
            </SplideSlide>
            <SplideSlide>
              <DashboardDetailLogement
                class="slide-page-svg"
                title="Page de gestion des réservations"
                desc="Page permettant de gérer et de visualiser différentes données sur les reservations (paiements, dates, statistiques, arrivée, etc)."
              />
            </SplideSlide>
            <SplideSlide>
              <AnnonceReservation
                class="slide-page-svg"
                title="Page de paiement"
                desc="Étape de paiement sur l'annonce mise en ligne par l'hôte. Le client peut payer de manière simple sécurisée par divers moyens (CB, Sepa, espèce avec acompte, etc)."
              />
            </SplideSlide>
            <SplideSlide>
              <Messagerie
                class="slide-page-svg"
                title="Page messagerie"
                desc="Page de gestion des messages de l'hôte"
              />
            </SplideSlide>
            <SplideSlide>
              <DashboardDetailLogement
                class="slide-page-svg"
                title="Page de gestion des réservations"
                desc="Page permettant de gérer et de visualiser différentes données sur les reservations (paiements, dates, statistiques, arrivée, etc)."
              />
            </SplideSlide>
          </Splide>

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
    <div
      ref="slideDisplayRef"
      class="slide-display"
    >
    </div>
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
