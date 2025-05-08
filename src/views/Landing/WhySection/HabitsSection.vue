<!-- File: src/views/Landing/WhySection/HabitsSection.vue -->

<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { Splide, SplideSlide } from '@splidejs/vue-splide'
import gsap from 'gsap'

// ASSETS
import DashboardDetailLogement from '@/components/svgs/images/DashboardDetailLogement.vue'
import AnnonceReservation from '@/components/svgs/images/AnnonceReservation.vue'

// REFS
const splideRef = ref<any>(null)
const lightRef = ref<HTMLSpanElement | null>(null)
const shadowRef = ref<HTMLSpanElement | null>(null)

const opts = {
    type: 'slide',
    direction: 'ttb',
    height: '90vh',

    // focus: 'center',
    perPage: 3,
    perMove: 1,
    gap: '2rem',

    arrows: false,
    pagination: false,
    drag: false,
}

onMounted(() => {
    nextTick(() => {
        const splide = splideRef.value?.splide as any
        const light = lightRef.value
        const shadow = shadowRef.value
        if (!splide || !light || !shadow) return

        const interval = 5 // secondes
        let forward = true

        // Animation et slide chainés
        const tl = gsap.timeline({ repeat: -1, paused: false })

        tl.to(light, { opacity: 0, duration: 1 }) // fade out
            .add(() => {
                const index = splide.index
                const last = splide.length - opts.perPage

                if (forward) {
                    if (index >= last) {
                        forward = false
                        splide.go('<')
                    } else {
                        splide.go('>')
                    }
                } else {
                    if (index <= 0) {
                        forward = true
                        splide.go('>')
                    } else {
                        splide.go('<')
                    }
                }
            })
            .to(light, {
                delay: .5,
                opacity: 1,
                duration: (interval * 1) / 3,
            })
            .to(light, { opacity: 1, duration: (interval * 2) / 3 }) // fade out en fin de cycle

        // Événements de pause / reprise au survol
        shadow.addEventListener('mouseenter', () => {

            gsap.to(shadow, {
                '--shadow-pos-x': '50%',
                '--shadow-size': '365% 130%',
                '--shadow-start': '25%',
                '--shadow-end': '40%',
                duration: .8,
                ease: 'power2.out',
            });

            gsap.to(light, {
                opacity: 0,
                duration: .4
            });

            setTimeout(() => {
                if (!shadow.matches(':hover')) return
                tl.pause();

                let activeSlide = document.querySelector('.splide__slide.is-visible.is-next');
                let otherSlides = document.querySelectorAll('.splide__slide.is-visible:not(.is-next)');

                gsap.to(activeSlide, {
                    scale: 1.5,
                    borderColor: 'rgba(252, 250, 250, 1)',
                    zIndex: 10,
                    duration: .3,
                    ease: 'power2.out',
                });
                gsap.to(otherSlides, {
                    scale: 1,
                    zIndex: 1,
                    opacity: .5,
                    duration: .3,
                    ease: 'power2.out',
                })
            }, 400);
        })

        shadow.addEventListener('mouseleave', () => {

            let activeSlide = document.querySelector('.splide__slide.is-visible.is-next');
            let otherSlides = document.querySelectorAll('.splide__slide.is-visible:not(.is-next)');

            gsap.to(shadow, {
                '--shadow-pos-x': '0%',
                '--shadow-size': '190% 100%',
                '--shadow-start': '20%',
                '--shadow-end': '55%',
                duration: .8,
                ease: 'power2.inOut',
            });
            gsap.to(activeSlide, {
                scale: 1,
                borderColor: 'rgba(252, 250, 250, 0)',
                zIndex: 1,
                duration: .3,
                ease: 'power2.out',
            })
            gsap.to(otherSlides, {
                scale: 1,
                zIndex: 1,
                opacity: 1,
                duration: .3,
                ease: 'power2.out',
            })
            gsap.to(light, {
                opacity: 1,
                duration: .4
            });

            setTimeout(() => { tl.resume() }, 400);
        })
    })
})
</script>


<template>
    <section id="habits-section">
        <div class="container">

            <div class="content">
                <div>
                    <h2>
                        Gardez les mêmes <span class="gradient-text">habitudes</span> dans un espace de gestion <span
                            class="gradient-text">simple</span>
                    </h2>
                    <p>
                        IndieHost crée <b>une adresse rien qu’à vous</b>, avec un thème qui reflète l’esprit de votre
                        lieu,
                        votre ton, votre univers.
                        <br><br>
                        Pas besoin d’un site compliqué pour avoir une page qui vous ressemble.
                    </p>
                </div>
            </div>

            <div class="illustration">
                <div class="carousel">
                    <Splide ref="splideRef" :options="opts" aria-label="Mes photos">
                        <SplideSlide>
                            <DashboardDetailLogement class="slide-page-svg" />
                        </SplideSlide>
                        <SplideSlide>
                            <AnnonceReservation class="slide-page-svg" />
                        </SplideSlide>
                        <SplideSlide>
                            <DashboardDetailLogement class="slide-page-svg" />
                        </SplideSlide>
                        <SplideSlide>
                            <AnnonceReservation class="slide-page-svg" />
                        </SplideSlide>
                    </Splide>
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