<!-- File: src/views/Landing/components/HeroSection/HeroSection.vue -->

<script setup lang="ts">
// DEPS
import gsap from 'gsap'
import { Search } from 'lucide-vue-next'
// ASSETS
import ShapesBgCroped from '@/components/svgs/images/ShapesBgCroped.vue'
// CONTENT
import type { HeroContent } from '@/views/Landing/types/content'
import { useLandingImport } from '@/views/Landing/composables/useLandingImport'
import { computed, onMounted, ref } from 'vue'
import { vp } from '@/utils/viewport'
import detectOS from '@/utils/detectOs'
import { useRouter } from 'vue-router'

const props = defineProps<{
  content: HeroContent
}>()

const sectionId = 'hero-section'
const router = useRouter()
const url = ref('')
const { submitUrl } = useLandingImport()
const isIosMobile = ref(typeof document !== 'undefined' && document.documentElement.classList.contains('is-ios') && !vp.lg.value)
const submitError = ref('')

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

function scrollToIntroTop() {
  const target = document.querySelector<HTMLElement>('#intro-section')
  if (!target) return

  const top = window.scrollY + target.getBoundingClientRect().top
  window.scrollTo({
    top: Math.max(0, top),
    behavior: 'smooth',
  })
}

function onSubmit(e?: Event) {
  e?.preventDefault()
  const trimmed = url.value.trim()
  if (!trimmed && vp.lg.value) {
    submitError.value = "Veuillez renseigner le lien Airbnb ou Booking de votre annonce pour lancer l'import automatique et créer votre site."
    return
  }

  submitError.value = ''
  submitUrl(trimmed)
  scrollToIntroTop()
}

function handleCreateSite() {
  submitError.value = ''
  submitUrl(url.value.trim())
  void router.push(props.content.secondaryCta.href || '/dashboard/editor/create')
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
</script>

<template>
  <section :id="sectionId">
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
          <form
            class="hero-form"
            @submit.prevent="onSubmit"
          >
            <div class="hero-search">
              <Search class="icon" />
              <input
                v-model="url"
                type="url"
                :placeholder="content.inputPlaceholder"
                autocomplete="url"
                @input="submitError = ''"
              />
              <div class="hero-search-action">
                <button type="submit">
                  <span v-html="content.primaryCta.label" />
                </button>
              </div>
            </div>
            <div class="cta">
              <div class="cta-primary-mobile">
                <button type="submit">
                  <span v-html="content.primaryCta.label" />
                </button>
              </div>
              <div class="cta-secondary">
                <button
                  type="button"
                  @click="handleCreateSite"
                >
                  <span
                    class="hero-secondary-cta-label"
                    v-html="content.secondaryCta.label"
                  />
                </button>
              </div>
            </div>
            <p
              v-if="submitError"
              class="hero-submit-error"
            >
              {{ submitError }}
            </p>
          </form>
        </div>
      </div>
      <div class="illustration">
        <div>
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
