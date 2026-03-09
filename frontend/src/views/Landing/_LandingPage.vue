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
import { forceReleaseScrollLock } from '@/components/overlays/scrollLock'
// CONTENT
import type { LandingContent } from '@/views/Landing/types/content'
import { useLandingLocale } from '@/views/Landing/composables/useLandingLocale'
// COMPONENTS — above the fold : chargement synchrone (LCP critique)
import HeroSection from '@/views/Landing/components/HeroSection/HeroSection.vue'
import IntroSection from '@/views/Landing/components/IntroSection/IntroSection.vue'
// Sections hors-fold : chargement asynchrone → réduit le JS parsé au premier rendu
// (critique sur iOS où le CPU est limité et le bundle JS bloque le thread principal)
const FeaturesSection  = defineAsyncComponent(() => import('./components/FeaturesSection/FeaturesSection.vue'))
const HowSection       = defineAsyncComponent(() => import('./components/HowSection/HowSection.vue'))
const UsageSection     = defineAsyncComponent(() => import('./components/UsageSection/UsageSection.vue'))
const StrengthsSection = defineAsyncComponent(() => import('./components/StrengthsSection/StrengthsSection.vue'))
// const JoinSection      = defineAsyncComponent(() => import('./components/JoinSection/JoinSection.vue'))
const FaqSection       = defineAsyncComponent(() => import('./components/FaqSection/FaqSection.vue'))

const { content } = useLandingLocale()

if (vp.lg.value) {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
}

const os = ref<OSInfo | null>(null)
const osReady = detectOS().then((res) => {
  os.value = res
})

// let smoother: ReturnType<typeof ScrollSmoother.create>

onMounted(() => {
  document.documentElement.classList.add('force-scroll')
  document.body.classList.add('force-scroll')

  // Failsafe: si un overlay a laissé un scroll-lock actif, on le libère sur la landing.
  // Sans ça, la page peut devenir impossible à scroller.
  forceReleaseScrollLock()
  // Certains scroll-locks (ou libs) réappliquent l'état sur le tick suivant.
  // On retente sur quelques frames pour stabiliser.
  requestAnimationFrame(() => forceReleaseScrollLock())
  setTimeout(() => forceReleaseScrollLock(), 0)
  setTimeout(() => forceReleaseScrollLock(), 250)

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

  // Attendre que detectOS() soit résolu avant de lancer sr()
  // sans ça, sur iOS la Promise peut ne pas avoir résolu dans les 500ms
  // et sr() démarrerait quand même (animations GSAP inutiles sur iOS)
  osReady.then(() => {
    if (os.value?.os?.toLowerCase().includes('ios') || os.value?.os === 'iPadOS') return
    setTimeout(() => sr('[data-sr]'), 500)
  })
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('force-scroll')
  document.body.classList.remove('force-scroll')
  // if (vp.lg.value) {
  //   smoother.kill()
  // }
})
</script>

<template>
  <!-- <VueLenis root> -->
  <main id="landing-page">
    <HeroSection :content="content.hero" />
    <IntroSection :content="content.introSection" />
    <!-- Section « Tout est pour vous » désactivée
    <BenefitsSection
      v-if="vp.lg.value"
      :content="content.benefits"
    />
    -->
    <FeaturesSection :items="content.features.items" />
    <HowSection :content="content.how" />
    <!-- <HabitsSection
    :content="content.habits"
    :slides="content.habits.slides"
    /> -->
    <UsageSection :steps="content.usage.steps" />
    <StrengthsSection :content="content.strengths" />
    <!-- JoinSection désactivée
    <JoinSection
      :content="content.join"
      :slides="content.habits.slides"
    />
    -->
    <FaqSection :content="content.faq" />
  </main>
  <!-- </VueLenis> -->
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;

#landing-page {
  background: $secondary !important;
}
</style>
