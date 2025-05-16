<!-- File: src/components/layouts/StepSection.vue -->

<script setup lang="ts">
import { isStringLiteral } from 'typescript'
import type { Component } from 'vue'

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
          <h2>
            {{ props.title }}
          </h2>
          <p>
            {{ props.description }}
          </p>
        </div>
      </div>

      <!-- ILLUSTRATION -->
      <div class="illustration">
        <!-- Halo décoratif constant (change le src si besoin) -->
        <img
          class="halo-png"
          src="@/assets/media/images/halo1.png"
          alt="Décoration contextuelle"
        />
        <!-- Illustration passée en paramètre -->
        <img
          v-if="typeof props.illustration === 'string'"
          class="image"
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
    </div>
  </section>
</template>
