<!-- File: src/views/Landing/_LandingPage.vue -->

<script setup lang="ts">
// DEPS
import { computed, nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
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
// COMPONENTS â€” above the fold : chargement synchrone (LCP critique)
import HeroSection from '@/views/Landing/components/HeroSection/HeroSection.vue'
import IntroSection from '@/views/Landing/components/IntroSection/IntroSection.vue'
import FeaturesSection from '@/views/Landing/components/FeaturesSection/FeaturesSection.vue'
import HowSection from '@/views/Landing/components/HowSection/HowSection.vue'
import UsageSection from '@/views/Landing/components/UsageSection/UsageSection.vue'
import ProofSection from '@/views/Landing/components/ProofSection/ProofSection.vue'
import StrengthsSection from '@/views/Landing/components/StrengthsSection/StrengthsSection.vue'
import PricingSection from '@/views/Landing/components/PricingSection/PricingSection.vue'
import JoinSection from '@/views/Landing/components/JoinSection/JoinSection.vue'
import FaqSection from '@/views/Landing/components/FaqSection/FaqSection.vue'
import FinalCtaSection from '@/views/Landing/components/FinalCtaSection/FinalCtaSection.vue'

const { content } = useLandingLocale()

if (vp.lg.value) {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
}

const os = ref<OSInfo | null>(null)
const osReady = detectOS().then((res) => {
  os.value = res
})
const isSafariLanding = ref(false)
const showBackToTop = ref(false)
type LandingTheme = 'dark' | 'light'
type LandingThemeMode = 'auto' | 'manual'
const LANDING_THEME_STORAGE_KEY = 'indiehost-landing-theme'
const LANDING_THEME_MODE_STORAGE_KEY = 'indiehost-landing-theme-mode'
const initialThemeState = resolveInitialLandingThemeState()
const landingTheme = ref<LandingTheme>(initialThemeState.theme)
const landingThemeMode = ref<LandingThemeMode>(initialThemeState.mode)
const isLightTheme = computed(() => landingTheme.value === 'light')
const lightHeroOpenProgress = ref(0)
const landingDynamicStyle = computed(() => ({
  '--light-hero-open': String(lightHeroOpenProgress.value),
}))
let colorSchemeMediaQuery: MediaQueryList | null = null
let onSystemThemeChange: (() => void) | null = null

function updateBackToTopVisibility() {
  if (typeof window === 'undefined') return
  showBackToTop.value = window.scrollY > 480
}

function updateLightHeroOpenProgress() {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    lightHeroOpenProgress.value = 0
    return
  }
  const maxScrollForOpen = 220
  const progress = window.scrollY / maxScrollForOpen
  lightHeroOpenProgress.value = Math.max(0, Math.min(1, progress))
}

function handleLandingScroll() {
  updateBackToTopVisibility()
  updateLightHeroOpenProgress()
}

function scrollToTop() {
  if (typeof window === 'undefined') return
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function applyLandingTheme(theme: LandingTheme) {
  landingTheme.value = theme
}

function getBrowserPreferredTheme(): LandingTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveInitialLandingThemeState(): {
  mode: LandingThemeMode
  theme: LandingTheme
} {
  if (typeof window === 'undefined') {
    return { mode: 'auto', theme: 'dark' }
  }
  const storedThemeMode = window.localStorage.getItem(LANDING_THEME_MODE_STORAGE_KEY)
  const storedTheme = window.localStorage.getItem(LANDING_THEME_STORAGE_KEY)
  if (
    storedThemeMode === 'manual' &&
    (storedTheme === 'light' || storedTheme === 'dark')
  ) {
    return { mode: 'manual', theme: storedTheme }
  }
  return { mode: 'auto', theme: getBrowserPreferredTheme() }
}

function syncThemeWithBrowserPreference() {
  if (landingThemeMode.value !== 'auto') return
  applyLandingTheme(getBrowserPreferredTheme())
}

function toggleLandingTheme() {
  const nextTheme: LandingTheme = landingTheme.value === 'dark' ? 'light' : 'dark'
  landingThemeMode.value = 'manual'
  applyLandingTheme(nextTheme)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANDING_THEME_STORAGE_KEY, nextTheme)
    window.localStorage.setItem(LANDING_THEME_MODE_STORAGE_KEY, 'manual')
  }
}

function detectSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent || ''
  const vendor = navigator.vendor || ''
  const isAppleVendor = /apple/i.test(vendor)
  const isSafariEngine = /safari/i.test(userAgent)
  const isOtherBrowser =
    /crios|chrome|android|fxios|firefox|edgios|edg|opr|opera/i.test(userAgent)

  return isAppleVendor && isSafariEngine && !isOtherBrowser
}

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

function releaseLandingScrollLockSafely() {
  forceReleaseScrollLock()
  requestAnimationFrame(() => forceReleaseScrollLock())
}

onMounted(() => {
  isSafariLanding.value = detectSafariBrowser()
  if (typeof window !== 'undefined') {
    colorSchemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    if (landingThemeMode.value === 'auto') {
      syncThemeWithBrowserPreference()
      window.localStorage.setItem(LANDING_THEME_MODE_STORAGE_KEY, 'auto')
    } else {
      window.localStorage.setItem(LANDING_THEME_MODE_STORAGE_KEY, 'manual')
      window.localStorage.setItem(LANDING_THEME_STORAGE_KEY, landingTheme.value)
    }

    onSystemThemeChange = () => syncThemeWithBrowserPreference()
    if (typeof colorSchemeMediaQuery.addEventListener === 'function') {
      colorSchemeMediaQuery.addEventListener('change', onSystemThemeChange)
    } else if ('addListener' in colorSchemeMediaQuery) {
      colorSchemeMediaQuery.addListener(onSystemThemeChange)
    }
  }
  handleLandingScroll()
  window.addEventListener('scroll', handleLandingScroll, { passive: true })
  document.documentElement.classList.add('force-scroll')
  document.body.classList.add('force-scroll')
  document.documentElement.classList.add('ios-landing-surface')
  document.body.classList.add('ios-landing-surface')
  if (isSafariLanding.value) {
    document.documentElement.classList.add('safari-landing-surface')
    document.body.classList.add('safari-landing-surface')
    document.documentElement.classList.add('safari-landing-lite')
    document.body.classList.add('safari-landing-lite')
  }

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

  // Failsafe: si un overlay a laisse un scroll-lock actif, on le libere sur la landing.
  releaseLandingScrollLockSafely()

  // if (vp.lg.value) {
  //   smoother = ScrollSmoother.create({
  //     wrapper: '#app',
  //     content: '#landing-page',
  //     smooth: 1.2,
  //     effects: true,
  //     // speed: 1,
  //   })
  // }
  // 1) Tape prÃ©cisÃ©ment les liens
  // const links = document.querySelectorAll<HTMLAnchorElement>('a[data-target]')
  // links.forEach((link) => {
  //   const handler = (e: Event) => {
  //     e.preventDefault()
  //     // 2) AccÃ¨s typÃ© Ã  dataset
  //     const selector = link.dataset.target
  //     if (!selector) return
  //     // 3) Cible typÃ©e
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

  // Attendre que detectOS() soit rÃ©solu avant de lancer sr()
  // sans Ã§a, sur iOS la Promise peut ne pas avoir rÃ©solu dans les 500ms
  // et sr() dÃ©marrerait quand mÃªme (animations GSAP inutiles sur iOS)
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
  window.removeEventListener('scroll', handleLandingScroll)
  if (colorSchemeMediaQuery && onSystemThemeChange) {
    if (typeof colorSchemeMediaQuery.removeEventListener === 'function') {
      colorSchemeMediaQuery.removeEventListener('change', onSystemThemeChange)
    } else if ('removeListener' in colorSchemeMediaQuery) {
      colorSchemeMediaQuery.removeListener(onSystemThemeChange)
    }
    onSystemThemeChange = null
  } else {
    onSystemThemeChange = null
  }
  if (colorSchemeMediaQuery) {
    colorSchemeMediaQuery = null
  }
  document.documentElement.classList.remove('force-scroll')
  document.body.classList.remove('force-scroll')
  document.documentElement.classList.remove('ios-landing-surface')
  document.body.classList.remove('ios-landing-surface')
  document.documentElement.classList.remove('safari-landing-surface')
  document.body.classList.remove('safari-landing-surface')
  document.documentElement.classList.remove('mobile-landing-lite')
  document.body.classList.remove('mobile-landing-lite')
  document.documentElement.classList.remove('ios-landing-lite')
  document.body.classList.remove('ios-landing-lite')
  document.documentElement.classList.remove('safari-landing-lite')
  document.body.classList.remove('safari-landing-lite')
  // if (vp.lg.value) {
  //   smoother.kill()
  // }
})
</script>

<template>
  <!-- <VueLenis root> -->
  <main
    id="landing-page"
    :class="{ 'is-light-theme': isLightTheme }"
    :style="landingDynamicStyle"
  >
    <HeroSection :content="content.hero" :is-light-theme="isLightTheme" />
    <IntroSection :content="content.introSection" />
    <!-- Section Â« Tout est pour vous Â» dÃ©sactivÃ©e
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
    <ProofSection :content="content.proofSection" />
    <StrengthsSection :content="content.strengths" />
    <PricingSection :content="content.pricingSection" />
    <JoinSection
      :content="content.join"
      :slides="content.habits.slides"
    />
    <FaqSection :content="content.faq" />
    <FinalCtaSection :content="content.finalCtaSection" />
  </main>
  <button
    type="button"
    class="landing-theme-switch"
    :class="{ 'is-light': isLightTheme }"
    :aria-pressed="isLightTheme"
    :aria-label="isLightTheme ? 'Activer le thème sombre' : 'Activer le thème clair'"
    @click="toggleLandingTheme"
  >
    {{ isLightTheme ? 'Sombre' : 'Clair' }}
  </button>
  <button
    v-show="showBackToTop"
    type="button"
    class="landing-back-to-top"
    :class="{ 'is-light': isLightTheme }"
    aria-label="Revenir en haut de la page"
    @click="scrollToTop"
  >
    Haut
  </button>
  <!-- </VueLenis> -->
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/animations' as animations;

#landing-page {
  background: $secondary !important;
}

// Boutons flottants : décalés des zones système (encoche, barre d'accueil).
.landing-theme-switch {
  position: fixed;
  left: calc(clamp(0.9rem, 2.4vw, 1.4rem) + var(--safe-area-left));
  bottom: calc(clamp(0.9rem, 2.8vw, 1.6rem) + var(--safe-area-bottom));
  z-index: 70;
  border: 1px solid rgba($accent, 0.24);
  border-radius: 999px;
  padding: 0.48rem 0.72rem;
  background: rgba($secondary, 0.74);
  color: rgba($accent, 0.92);
  font-size: 0.84rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 8px 22px -16px rgba($dark, 0.9);
  cursor: pointer;
  @include animations.transition(animations.$duration-fast);
  @include animations.press();

  @include on-hover {
    transform: translateY(-2px);
    border-color: rgba($accent, 0.42);
    background: rgba($secondary, 0.9);
    color: $accent;

    @include animations.reduced-motion {
      transform: none;
    }
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }

  &:focus-visible {
    outline: 2px solid rgba($primary_gradiant_second, 0.7);
    outline-offset: 2px;
  }
}

#landing-page h2 strong,
#landing-page h3 strong {
  background: none;
  -webkit-background-clip: initial;
  background-clip: initial;
  -webkit-text-fill-color: $primary_gradiant_first;
  color: $primary_gradiant_first;
}

#landing-page.is-light-theme {
  background: $accent !important;
}

#landing-page.is-light-theme section {
  background: transparent !important;
  border-color: rgba($secondary, 0.12) !important;
}

#landing-page.is-light-theme,
#landing-page.is-light-theme p,
#landing-page.is-light-theme h1,
#landing-page.is-light-theme h2,
#landing-page.is-light-theme h3,
#landing-page.is-light-theme h4,
#landing-page.is-light-theme h5,
#landing-page.is-light-theme h6,
#landing-page.is-light-theme li,
#landing-page.is-light-theme small {
  color: $secondary !important;
}

#landing-page.is-light-theme .text-gradiant {
  background: none !important;
  -webkit-background-clip: initial !important;
  background-clip: initial !important;
  -webkit-text-fill-color: $primary_gradiant_first !important;
  color: $primary_gradiant_first !important;
}

#landing-page.is-light-theme h2 strong,
#landing-page.is-light-theme h3 strong {
  background: none !important;
  -webkit-background-clip: initial !important;
  background-clip: initial !important;
  -webkit-text-fill-color: $primary_gradiant_first !important;
  color: $primary_gradiant_first !important;
}

#landing-page.is-light-theme #hero-section h1 strong,
#landing-page.is-light-theme #hero-section .hero-counter {
  background: linear-gradient(87deg, $primary_gradiant_second 0%, $primary_gradiant_third 100%) !important;
  -webkit-background-clip: text !important;
  background-clip: text !important;
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
}

#landing-page.is-light-theme .metric,
#landing-page.is-light-theme .card,
#landing-page.is-light-theme .plan,
#landing-page.is-light-theme .pillar,
#landing-page.is-light-theme .form-container,
#landing-page.is-light-theme .faq-item,
#landing-page.is-light-theme .faq-collapse {
  background: rgba($secondary, 0.04) !important;
  border-color: rgba($secondary, 0.15) !important;
  box-shadow: 0 8px 22px -18px rgba($secondary, 0.3);
}

#landing-page.is-light-theme input,
#landing-page.is-light-theme textarea,
#landing-page.is-light-theme select {
  color: $secondary !important;
  border-color: rgba($secondary, 0.18) !important;
  background: rgba($secondary, 0.04) !important;
}

// Éléments dessinés pour le fond sombre (texte et bordure en $accent) :
// sans ces variantes, ils sont blanc sur blanc en thème clair.
#landing-page.is-light-theme .plan-cta.ghost,
#landing-page.is-light-theme .plan-toggle,
#landing-page.is-light-theme .plan-toggle-label,
#landing-page.is-light-theme .account-link a,
#landing-page.is-light-theme .teaser-badge,
#landing-page.is-light-theme .teaser-sep,
#landing-page.is-light-theme legend,
#landing-page.is-light-theme label span {
  color: $secondary !important;
}

#landing-page.is-light-theme .plan-cta.ghost,
#landing-page.is-light-theme .plan-toggle,
#landing-page.is-light-theme .teaser-badge {
  border-color: rgba($secondary, 0.18) !important;
  background: rgba($secondary, 0.04) !important;
}

#landing-page.is-light-theme #hero-section .hero-search {
  background: $accent !important;
}

#landing-page.is-light-theme #hero-section .hero-search input {
  background: $accent !important;
}

#landing-page.is-light-theme button,
#landing-page.is-light-theme [role='button'],
#landing-page.is-light-theme .cta a,
#landing-page.is-light-theme .plan-toggle {
  pointer-events: auto;
}

#landing-page.is-light-theme button *,
#landing-page.is-light-theme [role='button'] *,
#landing-page.is-light-theme .cta a *,
#landing-page.is-light-theme .plan-toggle * {
  color: inherit !important;
  stroke: currentColor !important;
}

.landing-back-to-top.is-light {
  border-color: rgba($secondary, 0.22);
  background: rgba($accent, 0.92);
  color: rgba($secondary, 0.9);
}

.landing-theme-switch.is-light {
  border-color: rgba($secondary, 0.2);
  background: rgba($accent, 0.92);
  color: rgba($secondary, 0.9);
}

.landing-back-to-top {
  position: fixed;
  right: calc(clamp(0.9rem, 2.4vw, 1.4rem) + var(--safe-area-right));
  bottom: calc(clamp(0.9rem, 2.8vw, 1.6rem) + var(--safe-area-bottom));
  z-index: 70;
  border: 1px solid rgba($accent, 0.24);
  border-radius: 999px;
  padding: 0.48rem 0.72rem;
  background: rgba($secondary, 0.82);
  color: rgba($accent, 0.9);
  font-size: 0.84rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 8px 22px -16px rgba($dark, 0.9);
  cursor: pointer;
  @include animations.transition(animations.$duration-fast);
  @include animations.press();

  @include on-hover {
    transform: translateY(-2px);
    border-color: rgba($accent, 0.42);
    background: rgba($secondary, 0.94);
    color: $accent;

    @include animations.reduced-motion {
      transform: none;
    }
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }

  &:focus-visible {
    outline: 2px solid rgba($primary_gradiant_second, 0.7);
    outline-offset: 2px;
  }
}

html.is-ios.ios-landing-lite {
  scroll-behavior: auto;
}

html.safari-landing-surface,
body.safari-landing-surface,
body.safari-landing-surface #app,
body.safari-landing-surface main,
html.safari-landing-surface #landing-page,
body.safari-landing-surface #landing-page {
  background-color: $secondary !important;
}

html.safari-landing-surface #landing-page,
body.safari-landing-surface #landing-page {
  position: relative;
  isolation: isolate;
}

html.safari-landing-surface #landing-page::before,
body.safari-landing-surface #landing-page::before {
  content: '';
  position: fixed;
  inset: 0;
  background: $secondary;
  pointer-events: none;
  z-index: -1;
}

// Thème clair : les surfaces forcées en sombre (Safari, mobile allégé, iOS)
// suivent le thème, sinon le texte sombre du thème clair disparaît.
html:has(#landing-page.is-light-theme),
html:has(#landing-page.is-light-theme) body,
html:has(#landing-page.is-light-theme) #app,
html:has(#landing-page.is-light-theme) main,
html:has(#landing-page.is-light-theme) #landing-page,
html.mobile-landing-lite:has(#landing-page.is-light-theme) #landing-page > * {
  background-color: $accent !important;
}

html.safari-landing-surface #landing-page.is-light-theme::before {
  background: $accent;
}

html.safari-landing-lite #landing-page .text-gradiant,
html.safari-landing-lite #landing-page h1 strong,
html.safari-landing-lite #landing-page h2 strong,
html.safari-landing-lite #landing-page h3 strong,
html.safari-landing-lite #landing-page .hero-counter {
  background: none !important;
  -webkit-background-clip: initial !important;
  background-clip: initial !important;
  -webkit-text-fill-color: currentColor !important;
  color: $primary_gradiant_second !important;
}

html.safari-landing-lite #landing-page [class*='glass'],
html.safari-landing-lite #landing-page [class*='blur'],
html.safari-landing-lite #landing-page [class*='frosted'],
html.safari-landing-lite #landing-page [class*='halo'],
html.safari-landing-lite #landing-page [class*='glow'] {
  filter: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html.safari-landing-lite #landing-page *,
html.safari-landing-lite #landing-page *::before,
html.safari-landing-lite #landing-page *::after {
  text-shadow: none !important;
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

  // Les animations décoratives (keyframes, GSAP, filtres) sont coupées ; les
  // transitions d'interaction (pression, accordéons, menus) restent : elles ne
  // jouent qu'au toucher et n'animent que couleur, opacité ou transform.
  html.mobile-landing-lite #landing-page,
  html.mobile-landing-lite #landing-page *,
  html.mobile-landing-lite .layout-header {
    animation: none !important;
    scroll-behavior: auto !important;
  }

  // Exception : un spinner figé laisse croire que l'import est bloqué.
  html.mobile-landing-lite #landing-page .is-spinning {
    animation: intro-import-spin 0.9s linear infinite !important;
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
