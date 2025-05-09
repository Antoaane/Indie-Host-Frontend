<!-- File: src/views/Landing/WhySection/HabitsSection.vue -->

<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { Splide, SplideSlide } from '@splidejs/vue-splide'
import gsap from 'gsap'

/* ---------------- ASSETS ---------------- */
import DashboardDetailLogement from '@/components/svgs/images/DashboardDetailLogement.vue'
import AnnonceReservation from '@/components/svgs/images/AnnonceReservation.vue'
import Messagerie from '@/components/svgs/images/Messagerie.vue'

/* ---------------- REFS ---------------- */
const carouselRef = ref<HTMLElement | null>(null)
const splideRef = ref<any>(null)
const lightRef = ref<HTMLSpanElement | null>(null)
const shadowRef = ref<HTMLSpanElement | null>(null)

/* ---------------- TITRES PAR SLIDE ---------------- */
const slideTitles = [
    'Centralisez vos messages sans effort',            // index 0 – Messagerie
    'Gérez vos réservations dans un espace intuitif',  // index 1 – Dashboard
    'Vos voyageurs réservent simplement et en sécurité', // index 2 – Annonce
    'Centralisez vos messages sans effort',            // index 3 – Messagerie (copie)
    'Gérez vos réservations dans un espace intuitif',  // index 4 – Dashboard (copie)
]
const activeIndex = ref(0)

/* ---------------- OPTIONS SPLIDE ---------------- */
const opts = {
    type: 'slide',
    direction: 'ttb',
    height: '80vh',
    perPage: 3,
    perMove: 1,
    gap: '2rem',
    arrows: false,
    pagination: false,
    drag: true,
}

onMounted(() => {
    nextTick(() => {
        const carousel = carouselRef.value
        const splide = splideRef.value?.splide as any
        const light = lightRef.value
        const shadow = shadowRef.value
        if (!splide || !light || !shadow || !carousel) return

        /* --- synchronise le <h3> à chaque mouvement du carrousel --- */
        splide.on('moved', (newIdx: number) => (activeIndex.value = newIdx))

        /* --- Animation GSAP cyclique --- */
        const interval = 3
        let forward = true

        const tl = gsap.timeline({ repeat: -1, paused: false })
        tl.to(light, { opacity: 0, duration: 1 })
            .add(() => {
                const idx = splide.index
                const last = splide.length - opts.perPage

                if (forward) {
                    idx >= last ? (forward = false, splide.go('<'))
                        : splide.go('>')
                } else {
                    idx <= 0 ? (forward = true, splide.go('>'))
                        : splide.go('<')
                }
            })
            .to(light, { delay: .5, opacity: 1, duration: interval / 3 })
            .to(light, { opacity: 1, duration: (interval * 2) / 3 })

        /* --- Hover interactions --- */
        const onEnter = () => {
            gsap.to(shadow, {
                '--shadow-pos-x': '50%',
                '--shadow-size': '365% 130%',
                '--shadow-start': '25%',
                '--shadow-end': '40%',
                duration: .8,
                ease: 'power2.out',
            })
            gsap.to(light, { opacity: 0, duration: .4 })
            tl.pause()

            setTimeout(() => {
                if (!carousel.matches(':hover')) return
                const activeSlide = document.querySelector('.splide__slide.is-visible.is-next')
                const otherSlides = document.querySelectorAll('.splide__slide.is-visible:not(.is-next)')
                const title = document.getElementById('slide_title')

                gsap.to(title, {
                    translateX: 0,
                    duration: .3,
                    ease: 'power2.out'
                })
                gsap.to(activeSlide, {
                    scale: 1.5,
                    borderColor: '#FCFAFA',
                    zIndex: 10,
                    duration: .3
                })
                gsap.to(otherSlides, {
                    opacity: .5,
                    duration: .3
                })
            }, 400)
        }

        const onLeave = () => {
            const activeSlide = document.querySelector('.splide__slide.is-visible.is-next')
            const otherSlides = document.querySelectorAll('.splide__slide.is-visible:not(.is-next)')
            const title = document.getElementById('slide_title')

            gsap.to(title, {
                translateX: '4rem',
                duration: .3,
                ease: 'power2.out'
            })
            gsap.to(activeSlide, {
                scale: 1,
                borderColor: 'transparent',
                zIndex: 1,
                duration: .3
            })
            gsap.to(otherSlides, {
                opacity: 1,
                duration: .3
            })
            gsap.to(light, {
                opacity: 1,
                duration: .4
            })

            setTimeout(() => {
                gsap.to(shadow, {
                    '--shadow-pos-x': '0%',
                    '--shadow-size': '190% 100%',
                    '--shadow-start': '20%',
                    '--shadow-end': '55%',
                    duration: .8,
                    ease: 'power2.inOut',
                })
                tl.resume()
            }, 400)
        }

        carousel.addEventListener('mouseenter', onEnter)
        carousel.addEventListener('mouseleave', onLeave)
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

                <Transition name="fade" mode="out-in">
                    <h3 :key="activeIndex" id="slide_title">
                        {{ slideTitles[activeIndex] }}
                    </h3>
                </Transition>
            </div>

            <!-- ILLUSTRATION / CAROUSEL -->
            <div class="illustration">
                <div class="carousel" ref="carouselRef">
                    <Splide ref="splideRef" :options="opts" aria-label="Carrousel vertical">
                        <SplideSlide>
                            <Messagerie class="slide-page-svg" />
                        </SplideSlide>
                        <SplideSlide>
                            <DashboardDetailLogement class="slide-page-svg" />
                        </SplideSlide>
                        <SplideSlide>
                            <AnnonceReservation class="slide-page-svg" />
                        </SplideSlide>
                        <SplideSlide>
                            <Messagerie class="slide-page-svg" />
                        </SplideSlide>
                        <SplideSlide>
                            <DashboardDetailLogement class="slide-page-svg" />
                        </SplideSlide>
                    </Splide>

                    <!-- EFFETS DE LUMIÈRE -->
                    <span id="shadow" ref="shadowRef">
                        <div id="light" ref="lightRef">
                            <span id="halo"></span>
                            <span id="line_1"></span>
                            <span id="line_2"></span>
                            <span id="line_3"></span>
                        </div>
                    </span>
                </div>
            </div>

        </div>
    </section>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.25s ease, top 0.25s ease;
}

.fade-enter-from {
    opacity: 0;
    top: 30px;
}

.fade-leave-to {
    opacity: 0;
    top: -30px;
}

.fade-enter-to,
.fade-leave-from {
    opacity: 1;
    top: 0;
}
</style>
