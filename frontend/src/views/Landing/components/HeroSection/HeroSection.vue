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
import { onMounted, ref } from 'vue'

const props = defineProps<{
  content: HeroContent
}>()

const sectionId = 'hero-section'
const url = ref('')
const { submitUrl } = useLandingImport()

function onSubmit(e?: Event) {
  e?.preventDefault()
  const trimmed = url.value.trim()
  submitUrl(trimmed)
  if (trimmed) {
    document.querySelector('#intro-section')?.scrollIntoView({ behavior: 'smooth' })
  } else {
    document.querySelector(props.content.primaryCta.href)?.scrollIntoView({ behavior: 'smooth' })
  }
}

onMounted(() => {
  gsap.from(`#${sectionId} h1`, {
    x: -50,
    opacity: 0,
    delay: 0.25,
    duration: 1,
    ease: 'power2.inOut',
  })

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
          <h1 v-html="content.title" />
          <p v-html="content.description" />
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
              />
              <div class="platform-logos">
                <img
                  src="/assets/media/icons/airbnb-logo.svg"
                  alt="Airbnb"
                  class="platform-logo"
                />
                <img
                  src="/assets/media/icons/booking-logo.svg"
                  alt="Booking.com"
                  class="platform-logo"
                />
              </div>
            </div>
            <div class="cta">
              <button type="submit">
                <span v-html="content.primaryCta.label" />
              </button>
            </div>
          </form>
        </div>
      </div>
      <div class="illustration">
        <div>
          <img
            fetchpriority="high"
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
