<!-- File: src/views/Landing/HeroSection/HeroSection.vue -->

<script setup lang="ts">
// ASSETS
import ShapesBgCroped from '@/components/svgs/images/ShapesBgCroped.vue'
// CONTENT
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/hero-section.json'

const section = rawContent as ItemSection
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
            :alt="section.items['image-1'].meta?.alt"
            class="hero-image"
          />
          <span></span>
        </div>
      </div>
    </div>
  </section>
</template>
