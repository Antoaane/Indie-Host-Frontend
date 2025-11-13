<!-- File: src/views/Landing/components/HowSection/HowSection.vue -->

<script setup lang="ts">
// UTILS
// import { vp } from '@/utils/viewport'
// import { sr } from '@/utils/scrollReveal'
import GradiantSeparator from '@/components/svgs/images/GradiantSeparator.vue'
// CONTENT
import type { HowContent } from '@/views/Landing/types/content'

const props = defineProps<{
  content: HowContent
}>()
</script>

<template>
  <section id="how-section">
    <GradiantSeparator
      class="gradiant-separator"
      title="Décoration du fond"
      desc="Formes géométriques décoratives"
    />
    <div class="wrapper">
      <div class="temp">
        <h2
          data-sr
          data-sr-y="-30"
          v-html="content.title"
        />
        <p
          data-sr
          data-sr-y="30"
          v-html="content.body"
        />
      </div>

    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/HowSection/how-section.scss';
</style>
