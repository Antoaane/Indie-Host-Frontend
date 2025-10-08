<!-- File: src/views/Landing/components/CustomizationSection/CustomizationSection.vue -->

<script setup lang="ts">
// UTILS
import { vp } from '@/utils/viewport'
// ASSETS
import CustomDomain from '@/components/svgs/images/CustomDomain.vue'
import GradiantSeparator from '@/components/svgs/images/GradiantSeparator.vue'
// CONTENT
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/customization-section.json'

const section = rawContent as ItemSection
</script>

<template>
  <section :id="section.id">
    <GradiantSeparator
      class="gradiant-separator"
      title="Décoration du fond"
      desc="Formes géométriques décoratives"
    />
    <div class="container">
      <div class="temp">
        <h2>Comment ça marche ?</h2>
        <p>Notre volonté avec IndieHost est de favoriser l’autonomie dans la location en ligne courte durée pour vous et votre clientèle. De ce fait, nous remplaçons les commissions gourmandes des plateformes traditionnelles par un abonnement fixe raisonnable qui vous avantage.</p>
      </div>

      <!-- <div class="content">
        <div>
          <h2 v-html="section.items['title-1'].content" />
          <div
            class="illustration"
            v-if="!vp.lg.value"
          >
            <img
              class="customization-image"
              src="/assets/media/images/customization-image.png"
              loading="lazy"
              alt="Customization"
            />
          </div>
          <p v-html="section.items['text-1'].content" />
        </div>
      </div>
      <div
        class="illustration"
        v-if="vp.lg.value"
      >
        <img
          class="customization-image"
          src="/assets/media/images/customization-image.png"
          loading="lazy"
          alt="Customization"
        />
      </div> -->
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/CustomizationSection/customization-section.scss';
</style>
