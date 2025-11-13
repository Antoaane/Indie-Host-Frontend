<!-- File: src/views/Landing/components/HeroSection/HeroSection.vue -->

<script setup lang="ts">
// DEPS
import gsap from 'gsap'
// ASSETS
import ShapesBgCroped from '@/components/svgs/images/ShapesBgCroped.vue'
// CONTENT
import type { HeroContent } from '@/views/Landing/types/content'
import { onMounted } from 'vue'

const props = defineProps<{
  content: HeroContent
}>()

const sectionId = 'hero-section'

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
          <div class="cta">
            <a
              :href="content.primaryCta.href"
              :target="content.primaryCta.target"
              :rel="content.primaryCta.rel || (content.primaryCta.target === '_blank' ? 'noopener noreferrer' : undefined)"
              v-html="content.primaryCta.label"
            />
          </div>
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
