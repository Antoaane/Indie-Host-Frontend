<!-- File: src/views/Landing/components/HowSection/HowSection.vue -->

<script setup lang="ts">
// UTILS
// import { vp } from '@/utils/viewport'
// import { sr } from '@/utils/scrollReveal'
// ASSETS
import CustomDomain from '@/components/svgs/images/CustomDomain.vue'
import GradiantSeparator from '@/components/svgs/images/GradiantSeparator.vue'
// CONTENT
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/how-section.json'
import { onMounted } from 'vue'

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
        <h2
          data-sr
          data-sr-y="-30"
          v-html="section.items['title-1'].content"
        />
        <p
          data-sr
          data-sr-y="30"
          v-html="section.items['text-1'].content"
        />
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
              src="/assets/media/images/png/customization-image.png"
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
          src="/assets/media/images/png/customization-image.png"
          loading="lazy"
          alt="Customization"
        />
      </div> -->
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/HowSection/how-section.scss';
</style>
