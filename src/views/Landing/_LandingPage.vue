<!-- File: src/views/Landing/_LandingPage.vue -->

<script setup lang="ts">
// DEPS
import { defineAsyncComponent, onMounted, onBeforeUnmount, ref } from 'vue'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsap from 'gsap'
// UTILS
import { sr } from '@/utils/scrollReveal'
import { vp } from '@/utils/viewport'
import detectOS from '@/utils/detectOs'
// COMPONENTS
const HeroSection = defineAsyncComponent(() => import('./components/HeroSection/HeroSection.vue'))
const BenefitsSection = defineAsyncComponent(() => import('./components/BenefitsSection/BenefitsSection.vue'))
const HowSection = defineAsyncComponent(() => import('./components/HowSection/HowSection.vue'))
const HabitsSection = defineAsyncComponent(() => import('./components/HabitsSection/HabitsSection.vue'))
const FeaturesSection = defineAsyncComponent(() => import('./components/FeaturesSection/FeaturesSection.vue'))
const StrengthsSection = defineAsyncComponent(() => import('./components/StrengthsSection/StrengthsSection.vue'))
const UsageSection = defineAsyncComponent(() => import('./components/UsageSection/UsageSection.vue'))
const JoinSection = defineAsyncComponent(() => import('./components/JoinSection/JoinSection.vue'))
const FaqSection = defineAsyncComponent(() => import('./components/FaqSection/FaqSection.vue'))

if (vp.lg.value) {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
}

const os = ref<OSInfo | null>(null)
// pas d'await au top-level
detectOS().then((res) => {
  os.value = res
  console.log(res)
  console.log(os.value?.os)
})

// let smoother: ReturnType<typeof ScrollSmoother.create>

onMounted(() => {
  // if (vp.lg.value) {
  //   smoother = ScrollSmoother.create({
  //     wrapper: '#app',
  //     content: '#landing-page',
  //     smooth: 1.2,
  //     effects: true,
  //     // speed: 1,
  //   })
  // }
  // 1) Tape précisément les liens
  // const links = document.querySelectorAll<HTMLAnchorElement>('a[data-target]')
  // links.forEach((link) => {
  //   const handler = (e: Event) => {
  //     e.preventDefault()
  //     // 2) Accès typé à dataset
  //     const selector = link.dataset.target
  //     if (!selector) return
  //     // 3) Cible typée
  //     const target = document.querySelector<HTMLElement>(selector)
  //     if (!target) return
  //     // 4) Scroll via Smoother si dispo, sinon scroll natif
  //     // if (smoother) {
  //     //   // 3e param = position facultative (string/number) si tu veux affiner
  //     //   smoother.scrollTo(target, true)
  //     // } else {
  //     target.scrollIntoView({ behavior: 'smooth' })
  //     // }
  //   }
  //   // important: passive false si tu preventDefault
  //   link.addEventListener('click', handler, { passive: false })
  // })

  setTimeout(() => {
    if (os.value?.os === 'ios') return
    sr('[data-sr]')
  }, 500)
})

onBeforeUnmount(() => {
  // if (vp.lg.value) {
  //   smoother.kill()
  // }
})
</script>

<template>
  <!-- <VueLenis root> -->
  <main id="landing-page">
    <HeroSection />
    <BenefitsSection v-if="vp.lg.value" />
    <!-- <HabitsSection /> -->
    <FeaturesSection />
    <HowSection />
    <UsageSection />
    <!-- <HowSection /> -->
    <StrengthsSection />
    <JoinSection />
    <FaqSection />
  </main>
  <!-- </VueLenis> -->
</template>
