<!-- File: src/views/Landing/_LandingPage.vue -->

<script setup lang="ts">
// DEPS
import { nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
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
import FeaturesSection from '@/views/Landing/components/FeaturesSection/FeaturesSection.vue'
import HowSection from '@/views/Landing/components/HowSection/HowSection.vue'
import UsageSection from '@/views/Landing/components/UsageSection/UsageSection.vue'
import StrengthsSection from '@/views/Landing/components/StrengthsSection/StrengthsSection.vue'
import PricingSection from '@/views/Landing/components/PricingSection/PricingSection.vue'
import FaqSection from '@/views/Landing/components/FaqSection/FaqSection.vue'

const { content } = useLandingLocale()

if (vp.lg.value) {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
}

const os = ref<OSInfo | null>(null)
const osReady = detectOS().then((res) => {
  os.value = res
})

// let smoother: ReturnType<typeof ScrollSmoother.create>

function clearMotionStyles(root: ParentNode = document) {
  const selectors = [
    '#landing-page [data-sr]',
    '#hero-section h1',
    '#hero-section p',
    '#hero-section img',
    '#hero-section .cta',
    '.layout-header .navbar',
    '.layout-header .back-office-dock-nav',
  ]

  root.querySelectorAll<HTMLElement>(selectors.join(', ')).forEach((el) => {
    el.style.setProperty('transition', 'none', 'important')
    el.style.setProperty('animation', 'none', 'important')
    el.style.removeProperty('opacity')
    el.style.removeProperty('transform')
  })
}

function disableIphoneLandingAnimations() {
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
  gsap.killTweensOf('#landing-page *')
  clearMotionStyles()
  requestAnimationFrame(() => clearMotionStyles())
  setTimeout(() => clearMotionStyles(), 0)
  setTimeout(() => clearMotionStyles(), 250)
}

onMounted(() => {
  document.documentElement.classList.add('force-scroll')
  document.body.classList.add('force-scroll')
  document.documentElement.classList.add('ios-landing-surface')
  document.body.classList.add('ios-landing-surface')

  const isLandingMobile = !vp.lg.value
  if (isLandingMobile) {
    document.documentElement.classList.add('mobile-landing-lite')
    document.body.classList.add('mobile-landing-lite')
  }

  const isProbablyIosMobile = document.documentElement.classList.contains('is-ios') && !vp.lg.value
  if (isProbablyIosMobile || isLandingMobile) {
    document.documentElement.classList.add('ios-landing-lite')
    document.body.classList.add('ios-landing-lite')
    void nextTick().then(() => disableIphoneLandingAnimations())
  }

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
    if (!vp.lg.value || os.value?.os?.toLowerCase().includes('ios') || os.value?.os === 'iPadOS') {
      document.documentElement.classList.add('ios-landing-lite')
      document.body.classList.add('ios-landing-lite')
      void nextTick().then(() => disableIphoneLandingAnimations())
      return
    }
    document.documentElement.classList.remove('ios-landing-lite')
    document.body.classList.remove('ios-landing-lite')
    setTimeout(() => sr('[data-sr]'), 500)
  })
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('force-scroll')
  document.body.classList.remove('force-scroll')
  document.documentElement.classList.remove('ios-landing-surface')
  document.body.classList.remove('ios-landing-surface')
  document.documentElement.classList.remove('mobile-landing-lite')
  document.body.classList.remove('mobile-landing-lite')
  document.documentElement.classList.remove('ios-landing-lite')
  document.body.classList.remove('ios-landing-lite')
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
    <PricingSection />
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

html.is-ios.ios-landing-lite {
  scroll-behavior: auto;
}

@media (max-width: 1024px) {
  html.mobile-landing-lite,
  body.mobile-landing-lite,
  body.mobile-landing-lite #app,
  body.mobile-landing-lite main,
  html.mobile-landing-lite #landing-page,
  body.mobile-landing-lite #landing-page {
    background-color: $secondary !important;
  }

  html.mobile-landing-lite #landing-page > *,
  body.mobile-landing-lite #landing-page > * {
    background-color: $secondary !important;
  }

  html.mobile-landing-lite #landing-page,
  html.mobile-landing-lite #landing-page *,
  html.mobile-landing-lite .layout-header,
  html.mobile-landing-lite .layout-header * {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }

  html.mobile-landing-lite #landing-page [data-sr] {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }

  html.mobile-landing-lite #hero-section h1,
  html.mobile-landing-lite #hero-section p,
  html.mobile-landing-lite #hero-section img,
  html.mobile-landing-lite #hero-section .cta,
  html.mobile-landing-lite .layout-header .navbar,
  html.mobile-landing-lite .layout-header .back-office-dock-nav {
    opacity: 1 !important;
    transform: none !important;
  }

  html.is-ios.mobile-landing-lite #landing-page .text-gradiant,
  html.is-ios.mobile-landing-lite #landing-page h1 strong,
  html.is-ios.mobile-landing-lite #landing-page h2 strong,
  html.is-ios.mobile-landing-lite #landing-page h3 strong {
    background: none !important;
    -webkit-background-clip: initial !important;
    background-clip: initial !important;
    -webkit-text-fill-color: currentColor !important;
    color: $primary_gradiant_second !important;
  }

  html.mobile-landing-lite #landing-page .shapes-bg,
  html.mobile-landing-lite #landing-page .shapes-bg-circle,
  html.mobile-landing-lite #landing-page .gradiant-separator,
  html.mobile-landing-lite #landing-page .decorative,
  html.mobile-landing-lite #landing-page [class*='glow'],
  html.mobile-landing-lite #landing-page [class*='halo'] {
    display: none !important;
    filter: none !important;
  }

  html.mobile-landing-lite #landing-page *,
  html.mobile-landing-lite #landing-page *::before,
  html.mobile-landing-lite #landing-page *::after {
    text-shadow: none !important;
    filter: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
}
</style>
