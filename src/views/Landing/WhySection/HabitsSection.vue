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
    `Gérez vos réservations dans un <strong>espace intuitif</strong>`,            // index 0 – Messagerie
    `Vos voyageurs réservent <strong>simplement</strong> et en <strong>toute sécurité</strong>`,  // index 1 – Dashboard
    `Centralisez vos messages <strong>sans effort</strong>`, // index 2 – Annonce
    `Gérez vos réservations dans un <strong>espace intuitif</strong>`,            // index 3 – Messagerie (copie)
    `Vos voyageurs réservent <strong>simplement</strong> et en <strong>toute sécurité</strong>`,  // index 4 – Dashboard (copie)
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
}

onMounted(() => {
    document.documentElement.style.setProperty('--title-offset', '1')

    nextTick(() => {
        const carousel = carouselRef.value
        const splide = splideRef.value?.splide as any
        const light = lightRef.value
        const shadow = shadowRef.value
        if (!splide || !light || !shadow || !carousel) return

        const biggerSlide = () => {
            setTimeout(() => {
                if (!carousel.matches(':hover')) return
                const activeSlide = document.querySelector('.splide__slide.is-next')
                const otherSlides = document.querySelectorAll('.splide__slide:not(.is-next)')
                const title = document.getElementById('slide_title')

                gsap.to(title, {
                    translateX: '-2rem',
                    duration: .3,
                    ease: 'power2.out'
                })
                gsap.to(activeSlide, {
                    scale: 1.25,
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

        const resetSlideSize = () => {
            const activeSlide = document.querySelector('.splide__slide.is-next')
            const otherSlides = document.querySelectorAll('.splide__slide:not(.is-next)')
            const title = document.getElementById('slide_title')

            gsap.to(title, {
                translateX: '0rem',
                duration: .3,
                ease: 'power2.out'
            })
            gsap.to(activeSlide, {
                scale: 1,
                opacity: 1,
                zIndex: 1,
                borderColor: 'transparent',
                duration: .3
            })
            gsap.to(otherSlides, {
                scale: 1,
                opacity: 1,
                zIndex: 1,
                borderColor: 'transparent',
                duration: .3
            })
        }
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
                document.documentElement.style.setProperty('--title-offset', forward ? '1' : '-1')

                splide.on('moved', (newIdx: number) => {
                    resetSlideSize()
                    console.log('moved')
                    activeIndex.value = newIdx
                    biggerSlide()
                })
            })
            .to(light, {
                delay: .5,
                opacity: 1,
                duration: interval / 3
            })
            .to(light, {
                opacity: 1,
                duration: (interval * 2) / 3
            })

        /* --- Hover interactions --- */
        const onEnter = () => {
            gsap.to(shadow, {
                '--shadow-pos-x': '50%',
                '--shadow-size': '365% 75%',
                '--shadow-start': '35%',
                '--shadow-end': '50%',
                duration: .8,
                ease: 'power2.out',
            })
            gsap.to(light, { opacity: 0, duration: .4 })
            tl.pause()

            biggerSlide()
        }

        const onLeave = () => {
            resetSlideSize()
            gsap.to(light, {
                opacity: 1,
                duration: .4
            })

            setTimeout(() => {
                gsap.to(shadow, {
                    '--shadow-pos-x': '0%',
                    '--shadow-size': '175% 50%',
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
                    <h3 :key="activeIndex" id="slide_title" v-html="slideTitles[activeIndex]"></h3>
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
    transition: opacity 0.15s ease, top 0.15s ease !important;
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
