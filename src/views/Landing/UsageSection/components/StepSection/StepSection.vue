<!-- File: src/views/Landing/UsageSection/components/StepSection/StepSection.vue -->

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
  /** Composant Vue servant d'illustration (un SVG le plus souvent). */
  illustration: Component | string
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
          src="/assets/media/images/halo1.png"
          alt="Décoration contextuelle"
        />
        <!-- Illustration passée en paramètre avec nom de classe {nom du fichier} -->
        <img
          v-if="typeof props.illustration === 'string'"
          :class="[{ image: true }, props.illustrationClass]"
          :src="props.illustration"
          :alt="props.illustrationTitle"
        />
        <component
          v-else
          :is="props.illustration"
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
@use '@/views/Landing/UsageSection/components/StepSection/step-section.scss';
</style>
