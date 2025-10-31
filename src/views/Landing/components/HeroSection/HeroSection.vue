<!-- File: src/views/Landing/components/HeroSection/HeroSection.vue -->

<script setup lang="ts">
// DEPS
import gsap from 'gsap'
// ASSETS
import ShapesBgCroped from '@/components/svgs/images/ShapesBgCroped.vue'
// CONTENT
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/hero-section.json'
import { onMounted } from 'vue'

const section = rawContent as ItemSection

onMounted(() => {
  gsap.from(`#${section.id} h1`, {
    x: -50,
    opacity: 0,
    delay: 0.25,
    duration: 1,
    ease: 'power2.inOut',
  })

  gsap.from(`#${section.id} p`, {
    x: -50,
    opacity: 0,
    delay: 0.4,
    duration: 1,
    ease: 'power2.inOut',
  })

  gsap.from(`#${section.id} img`, {
    x: 100,
    opacity: 0,
    delay: 0.25,
    duration: 1,
    ease: 'power2.inOut',
  })

  const cta = document.querySelector<HTMLElement>(`#${section.id} .cta`)
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
  <section :id="section.id">
    <ShapesBgCroped
      class="shapes-bg"
      title="Décoration du fond"
      desc="Formes géométriques décoratives"
    />
    <div class="container">
      <div class="content">
        <div>
          <h1 v-html="section.items['title-1'].content" />
          <p v-html="section.items['text-1'].content" />
          <div class="cta">
            <a
              :href="section.items['cta-1'].meta?.href"
              v-html="section.items['cta-1'].content"
            />
          </div>
        </div>
      </div>
      <div class="illustration">
        <div>
          <img
            :src="section.items['image-1'].content"
            :onerror="`this.onerror=null; this.src='${section.items['image-1'].fallback}';`"
            :alt="section.items['image-1'].meta?.alt"
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
