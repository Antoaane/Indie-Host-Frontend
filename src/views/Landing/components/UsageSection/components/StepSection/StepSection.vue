<!-- File: src/views/Landing/components/UsageSection/components/StepSection/StepSection.vue -->

<script setup lang="ts">
// DEPS
import type { Component } from 'vue'

// UTILS
import { vp } from '@/utils/viewport'

const props = defineProps<{
  /** Numéro (ou titre court) de l'étape à afficher. */
  step: number | string
  /** Titre principal de l'étape. */
  title: string
  /** Description courte accompagnant le titre. */
  description: string
  /** Composant Vue servant de vidéo. */
  video1?: string
  /** Composant Vue servant de vidéo fallback. */
  video2?: string
  /** Composant Vue servant d'illustration webp. */
  illustration1: Component | string
  /** Composant Vue servant d'illustration png. */
  illustration2: Component | string
  /** Titre de l'illustration. */
  illustrationTitle: string
  /** Description de l'illustration. */
  illustrationAlt: string
  /** Class de l'illustration. */
  illustrationClass?: string
}>()
</script>

<template>
  <section class="step-section">
    <div class="container">
      <!-- TITRE + SOUS-TITRE -->
      <div class="content">
        <span class="step">
          {{ props.step }}
        </span>
        <div>
          <h2 v-html="props.title" />
          <p
            v-if="vp.sm.value"
            v-html="props.description"
            class="description"
          />
        </div>
      </div>

      <!-- ILLUSTRATION -->
      <div class="illustration">
        <!-- Halo décoratif constant (change le src si besoin) -->
        <img
          class="halo-png"
          loading="lazy"
          src="/assets/media/images/png/halo1.png"
          alt="Décoration contextuelle"
        />
        <!-- Illustration passée en paramètre avec nom de classe {nom du fichier} -->
        <video
          v-if="props.video1 && props.video2"
          :class="[{ image: true }, props.illustrationClass]"
          autoplay
          loop
          muted
          playsinline
        >
          <source
            :src="props.video1"
            type="video/webm"
          />

          <source
            :src="props.video2"
            type="video/mp4"
          />

          <img
            :src="props.illustration1 as unknown as string"
            :alt="props.illustrationAlt || 'Feature image'"
            loading="lazy"
          />

          <img
            :src="props.illustration2 as unknown as string"
            :alt="props.illustrationAlt || 'Feature image'"
            loading="lazy"
          />
        </video>
        <img
          v-else-if="typeof props.illustration1 === 'string'"
          :class="[{ image: true }, props.illustrationClass]"
          loading="lazy"
          :src="props.illustration1"
          :onerror="`this.onerror=null; this.src='${props.illustration2}';`"
          :alt="props.illustrationTitle"
        />
        <component
          v-else
          :is="props.illustration1"
          class="image"
          :title="props.illustrationTitle"
          :desc="props.illustrationAlt"
          role="img"
        />
      </div>
      <div v-if="!vp.sm.value">
        <p
          class="description"
          v-html="props.description"
        />
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/UsageSection/components/StepSection/step-section.scss';
</style>
