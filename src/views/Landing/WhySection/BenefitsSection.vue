<!-- File: src/views/Landing/WhySection/BenefitsSection.vue -->

<script setup lang="ts">
// DEPS
import { computed, ref, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import CSSRulePlugin from 'gsap/CSSRulePlugin'

// ASSETS
import ShapesBg from '@/components/svgs/images/ShapesBg.vue'
import OtaBg from '@/components/svgs/images/OtaBg.vue'
import { icons } from '@/components/svgs'

/* ────────────────────────────
   Gestion des inputs
──────────────────────────────*/

const nights = ref(6)
const price = ref(130)
const total = computed(() => {
  return nights.value * price.value
})
const commissions = computed(() => {
  return Math.ceil(total.value * 0.2)
})

/* ────────────────────────────
   Animation timeline
──────────────────────────────*/

// Setup GSAP
gsap.registerPlugin(ScrollTrigger)
gsap.registerPlugin(CSSRulePlugin)
let tl_indieHost: gsap.core.Timeline | null = null
let tl_gains: gsap.core.Timeline | null = null

// Animation & Size variables
const longerSide = (100 * 80) / 180 // in percent
const shorterSide = (100 * 20) / 180 // in percent
const baseDuration = 0.75

onMounted(() => {
  tl_indieHost = gsap.timeline({
    paused: true,
  })

  tl_indieHost
    .addLabel('start')
    .to(
      '#indiehost',
      {
        width: `${longerSide + shorterSide}%`,
        ease: 'power2.inOut',
        duration: baseDuration * 3,
      },
      'start',
    )
    .to(
      '.gains',
      {
        '--gains-color': '0, 255, 166',
        ease: 'power2.out',
        delay: baseDuration * 3 * 0.64,
        duration: baseDuration * 1,
      },
      'start',
    )
    .to(
      '.gains>.losses',
      {
        width: '100%',
        opacity: '1',
        ease: 'power2.out',
        delay: baseDuration * 3 * 0.64,
        duration: baseDuration * 1,
      },
      'start',
    )
    .to(
      // block's after
      '.line',
      {
        transform: 'translateX(-50%) scaleX(1)',
        ease: 'power2.out',
        delay: baseDuration * 3 * 0.64,
        duration: baseDuration * 1,
      },
      'start',
    )
    .to(
      // block's after
      '#plusvalue',
      {
        transform: 'translateX(0%)',
        opacity: '1',
        ease: 'power2.out',
        delay: baseDuration * 3 * 0.64,
        duration: baseDuration * 1,
      },
      'start',
    )

  // ScrollTrigger : lance l’anim’ à l’entrée dans le viewport
  ScrollTrigger.create({
    trigger: '#benefits-section',
    start: 'top 10%', //
    once: true,
    onEnter: () => {
      tl_indieHost?.play()
    },
  })
})

onUnmounted(() => {
  tl_indieHost?.kill()
  ScrollTrigger.getAll().forEach((t) => t.kill())
})
</script>

<template>
  <section id="benefits-section">
    <div class="container">
      <h2 class="first-tite"> <span class="gradient-text">Tout</span> est pour <span class="gradient-text">vous</span> </h2>
    </div>

    <div class="animation">
      <div id="indiehost">
        <ShapesBg
          class="shapes-bg"
          title="Décoration du fond"
          desc="Formes géométriques décoratives"
        />

        <div class="ih-title-container">
          <component
            :is="icons.logoFull.dark"
            class="logo-full"
            title="IndieHost"
            desc="Logo de IndieHost, plateforme de gestion de locations saisonnières"
            role="img"
          />
        </div>

        <div class="ih-total">
          <p> {{ total }} € </p>
        </div>
      </div>
      <div id="ota">
        <OtaBg
          class="ota-bg"
          title="Décoration du fond"
          desc="Formes géométriques décoratives"
        />

        <div class="ota-title-container">
          <p class="ota-title"> Plateformes<br />traditionnelles </p>
        </div>

        <div class="ota-total">
          <div class="losses">
            <p> - {{ commissions }} € </p>
          </div>
          <div class="total">
            <p> {{ total - commissions }} € </p>
          </div>
        </div>
      </div>
      <div class="gains">
        <div class="advantages">
          <div class="block">
            <p>
              <span class="focus">20 %</span><br />
              <span class="unfocus">de commissions</span><br />
            </p>
            <p id="plusvalue">
              pour <span class="focus">vous</span><br />
              et vos locataires <br />
            </p>
            <!-- after -->
            <span class="line"></span>
          </div>
        </div>
        <div class="losses">
          <p> - 0 € </p>
        </div>
      </div>
    </div>

    <div class="container">
      <h2 class="second-title">
        Votre logement pourrait vous rapporter <span class="gradient-text">{{ commissions }} €</span> de <span class="gradient-text">plus</span>
      </h2>
      <p>
        <span>
          {{ nights }}
          <input
            type="number"
            v-model="nights"
          />
        </span>
        nuits |
        <span>
          {{ price }}
          <input
            type="number"
            v-model="price"
          />
        </span>
        €/nuit
      </p>
    </div>
  </section>
</template>
