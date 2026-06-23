<!-- File: src/views/Landing/components/HeroSection/HeroSection.vue -->

<script setup lang="ts">
// DEPS
import gsap from 'gsap'
// ASSETS
import ShapesBgCroped from '@/components/svgs/images/ShapesBgCroped.vue'
import { ArrowRight } from 'lucide-vue-next'
// CONTENT
import type { HeroContent } from '@/views/Landing/types/content'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { vp } from '@/utils/viewport'
import detectOS from '@/utils/detectOs'
import { useRouter } from 'vue-router'

const props = defineProps<{
  content: HeroContent
  isLightTheme?: boolean
}>()

const sectionId = 'hero-section'
const router = useRouter()
const isIosMobile = ref(typeof document !== 'undefined' && document.documentElement.classList.contains('is-ios') && !vp.lg.value)
let heroFloatTimeline: gsap.core.Timeline | null = null
let heroEntryComplete = false

function startHeroFloat() {
  if (!heroEntryComplete || heroFloatTimeline) return
  heroFloatTimeline = gsap.timeline({ repeat: -1 })
    .to(`#${sectionId} img`, { y: -11, duration: 3.0, ease: 'power1.inOut' })
    .to(`#${sectionId} img`, { y: -6,  duration: 1.8, ease: 'power1.inOut' })
    .to(`#${sectionId} img`, { y: -14, duration: 2.6, ease: 'power1.inOut' })
    .to(`#${sectionId} img`, { y: 0,   duration: 2.8, ease: 'power1.out'   })
}

function stopHeroFloat() {
  heroFloatTimeline?.kill()
  heroFloatTimeline = null
  gsap.set(`#${sectionId} img`, { y: 0 })
}

watch(() => props.isLightTheme, (isLight) => {
  if (isLight) startHeroFloat()
  else stopHeroFloat()
}, { immediate: true })
const heroCtaIconSize = 18
const heroMockupMouseStyle = ref({
  '--hero-mouse-x': '0px',
  '--hero-mouse-y': '0px',
})
const HERO_MOUSE_MAX_X_PX = 8
const HERO_MOUSE_MAX_Y_PX = 6

function setHeroMockupMouseOffset(x: number, y: number) {
  heroMockupMouseStyle.value = {
    '--hero-mouse-x': `${x.toFixed(2)}px`,
    '--hero-mouse-y': `${y.toFixed(2)}px`,
  }
}

function handleHeroMouseMove(event: MouseEvent) {
  if (!vp.lg.value) return
  const sectionEl = event.currentTarget as HTMLElement | null
  if (!sectionEl) return
  const rect = sectionEl.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return

  const relativeX = ((event.clientX - rect.left) / rect.width - 0.5) * 2
  const relativeY = ((event.clientY - rect.top) / rect.height - 0.5) * 2

  setHeroMockupMouseOffset(
    relativeX * HERO_MOUSE_MAX_X_PX,
    relativeY * HERO_MOUSE_MAX_Y_PX,
  )
}

function handleHeroMouseLeave() {
  setHeroMockupMouseOffset(0, 0)
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

// Compteur animé : part de 20% et descend à 0% — désactivé sur mobile et Safari
const isSafari = ref(detectSafariBrowser())
const counterValue = ref(isSafari.value ? 0 : 20)
const isMobile = () => !vp.lg.value
const animatedTitle = computed(() => {
  // Sur mobile et Safari : titre brut avec "0%"
  if (isMobile() || isSafari.value) return props.content.title
  const displayValue = counterValue.value
  return props.content.title.replace(
    '<strong>0%</strong>',
    `<strong class="hero-counter">${displayValue}%</strong>`,
  )
})

function handleCreateSite() {
  void router.push(props.content.primaryCta.href || '/dashboard/editor/create')
}

function handleImportListing() {
  const target = document.querySelector<HTMLElement>('#intro-section')
  if (!target) return
  const top = window.scrollY + target.getBoundingClientRect().top
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}


onMounted(async () => {
  isSafari.value = detectSafariBrowser()
  if (!vp.lg.value || isSafari.value) {
    counterValue.value = 0
    return
  }

  const osInfo = await detectOS().catch(() => null)
  const normalizedOs = String(osInfo?.os ?? '').toLowerCase()
  isIosMobile.value = !vp.lg.value && (normalizedOs === 'ios' || normalizedOs === 'ipados')
  if (!vp.lg.value || isSafari.value) {
    counterValue.value = 0
    return
  }

  gsap.from(`#${sectionId} h1`, {
    x: -50,
    opacity: 0,
    delay: 0.25,
    duration: 1,
    ease: 'power2.inOut',
  })

  // Lancer le compteur après l'animation d'entrée du h1 — uniquement desktop (mobile = 0% fixe)
  if (vp.lg.value) {
    const proxy = { value: 20 }
    gsap.to(proxy, {
      value: 0,
      duration: 2.6,
      delay: 2,
      ease: 'power2.out',
      onUpdate() {
        counterValue.value = Math.round(proxy.value)
      },
    })
  } else {
    counterValue.value = 0
  }

  gsap.from(`#${sectionId} p`, {
    x: -50,
    opacity: 0,
    delay: 0.4,
    duration: 1,
    ease: 'power2.inOut',
  })

  gsap.from(`#${sectionId} img`, {
    x: 100,
    opacity: 0,
    delay: 0.25,
    duration: 1,
    ease: 'power2.inOut',
    clearProps: 'transform,opacity',
    onComplete() {
      const isLight = document.getElementById('landing-page')?.classList.contains('is-light-theme') ?? false
      if (isLight) startHeroFloat()
    },
  })

  const cta = document.querySelector<HTMLElement>(`#${sectionId} .cta`)
  const nav = document.querySelector<HTMLElement>('[class^="navbar-"]')

  nav?.style.setProperty('transition', 'none')
  nav?.style.setProperty('opacity', '0')
  nav?.style.setProperty('transform', 'translateY(-100px)')

  cta?.style.setProperty('transition', 'none')
  cta?.style.setProperty('opacity', '0')
  cta?.style.setProperty('transform', 'translateX(-20px)')

  setTimeout(() => {
    cta?.style.setProperty('transition', 'all 1s cubic-bezier(0.75, 0, 0.25, 1)')
    cta?.style.removeProperty('opacity')
    cta?.style.removeProperty('transform')

    nav?.style.setProperty('transition', 'all 1s cubic-bezier(0.75, 0, 0.25, 1)')
    nav?.style.removeProperty('opacity')
    nav?.style.removeProperty('transform')
  }, 650)
})

onBeforeUnmount(() => {
  handleHeroMouseLeave()
  stopHeroFloat()
})
</script>

<template>
  <section
    :id="sectionId"
    @mousemove="handleHeroMouseMove"
    @mouseleave="handleHeroMouseLeave"
  >
    <ShapesBgCroped
      class="shapes-bg"
      title="Décoration du fond"
      desc="Formes géométriques décoratives"
    />
    <div class="wrapper">
      <div class="content">
        <div>
          <h1 v-html="animatedTitle" />
          <p
            class="hero-desc hero-desc-mobile"
            v-html="content.description"
          />
          <p
            v-if="content.descriptionDesktop"
            class="hero-desc hero-desc-desktop"
            v-html="content.descriptionDesktop"
          />
          <div class="hero-form">
            <div class="cta">
              <div class="cta-primary">
                <button
                  type="button"
                  @click="handleCreateSite"
                >
                  <span v-html="content.primaryCta.label" />
                  <ArrowRight :size="heroCtaIconSize" />
                </button>
              </div>
              <div class="cta-secondary">
                <button
                  type="button"
                  @click="handleImportListing"
                >
                  <span
                    class="hero-secondary-cta-label"
                    v-html="content.secondaryCta.label"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="illustration">
        <div
          class="hero-mockup-shell"
          :style="heroMockupMouseStyle"
        >
          <img
            fetchpriority="high"
            decoding="async"
            width="960"
            height="1080"
            :src="content.images[0]?.webp"
            :onerror="content.images[0]?.png ? `this.onerror=null; this.src='${content.images[0]?.png}';` : undefined"
            :alt="content.images[0]?.alt"
            class="hero-image"
          />
          <span></span>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/HeroSection/hero-section.scss';
</style>
