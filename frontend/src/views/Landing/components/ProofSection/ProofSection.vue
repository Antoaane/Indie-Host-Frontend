<!-- File: src/views/Landing/components/ProofSection/ProofSection.vue -->

<script setup lang="ts">
import type { ProofSectionContent } from '@/views/Landing/types/content'
import LandingVideo from '@/views/Landing/components/LandingVideo/LandingVideo.vue'

defineProps<{
  content: ProofSectionContent
}>()

const demoVideo = {
  webm: '/assets/media/videos/annonces.webm',
  mp4: '/assets/media/videos/annonces.mp4',
}
</script>

<template>
  <section id="proof-section">
    <div class="wrapper">
      <div class="title">
        <p
          data-sr
          data-sr-y="-20"
          class="eyebrow"
        >
          {{ content.eyebrow }}
        </p>
        <h2
          data-sr
          data-sr-y="-30"
          v-html="content.title"
        />
        <p
          v-if="content.subtitle"
          data-sr
          data-sr-y="30"
          class="subtitle"
        >
          {{ content.subtitle }}
        </p>
      </div>

      <div
        class="demo"
        data-sr
        data-sr-y="30"
      >
        <div class="demo-video">
          <LandingVideo
            v-if="demoVideo.webm || demoVideo.mp4"
            :webm="demoVideo.webm"
            :mp4="demoVideo.mp4"
            :label="content.demoVideoLabel"
          />
        </div>
        <p class="demo-caption">
          {{ content.demoVideoLabel }}
        </p>
      </div>

      <div class="metrics">
        <article
          v-for="(metric, index) in content.metrics"
          :key="metric.id"
          class="metric"
          data-sr
          data-sr-y="35"
          :data-sr-delay="index * 0.1"
        >
          <p class="value">{{ metric.value }}</p>
          <p class="label">{{ metric.label }}</p>
          <p
            v-if="metric.detail"
            class="detail"
          >
            {{ metric.detail }}
          </p>
        </article>
      </div>

      <div class="cards">
        <article
          v-for="(card, index) in content.cards"
          :key="card.id"
          class="card"
          data-sr
          data-sr-y="45"
          :data-sr-delay="index * 0.12"
        >
          <h3>{{ card.title }}</h3>
          <p>{{ card.description }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/ProofSection/proof-section.scss';
</style>
