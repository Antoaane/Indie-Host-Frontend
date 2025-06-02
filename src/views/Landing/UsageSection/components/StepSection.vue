<!-- File: src/views/Landing/UsageSection/components/StepSection.vue -->

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
          src="@/assets/media/images/halo1.png"
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
@use '@/assets/styles/variables/globals' as *;
@use '@/assets/styles/variables/effects' as effect;

div:has(> .step-section) {
  .step-section {
    .container {
      display: flex;
      flex-direction: column;
      gap: 1rem;

      @include gutters(padding, inline, 2);

      @include min-width(lg) {
        height: 100vh;
        padding-left: 5rem;

        flex-direction: row;
        align-items: center;
        justify-content: end;
        gap: 2rem;
      }

      .content {
        display: flex;
        // align-items: center;

        position: relative;

        border-left: 1px solid;

        @include gutters(padding, inline, 2);

        @include min-width(xs) {
          padding: 0 !important;
        }

        @include min-width(lg) {
          flex: 0.55 0;
          height: 100%;

          flex-direction: column;
          justify-content: center;
          align-items: end;

          border-image: linear-gradient(to bottom, rgba($accent, 1) 20%, rgba($accent, 0) 40%, rgba($accent, 0) 60%, rgba($accent, 1) 80%) 1 round;
        }

        .step {
          position: relative;
          // bottom: 1rem;

          font-family: 'Fustat', sans-serif;
          font-size: 3.5rem;
          font-weight: 900;

          background: linear-gradient(87deg, #da99ff 0%, #fabdcf 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;

          @include min-width(sm) {
            font-size: 5rem;
          }

          @include min-width(md) {
            font-size: 6rem;
          }

          @include min-width(lg) {
            margin: 0;

            position: absolute;
            top: 50%;
            left: 0;

            font-size: 8rem;

            transform: translate(-50%, -50%);
          }
        }

        & > div {
          padding-left: 1rem;

          display: flex;
          flex-direction: column;
          justify-content: center;

          @include min-width(sm) {
            padding-left: 2rem;
          }

          @include min-width(lg) {
            padding-inline: 4rem;
          }

          h2 {
            margin: 1rem 0;
            padding: 0 !important;
            @include h3-title($accent, false);
          }
        }
      }

      .illustration {
        width: 100vw;

        display: flex;
        overflow: visible;

        position: relative;

        @include min-width(lg) {
          flex: 0.45 0;
          width: 50vw;
          height: 100%;
        }

        .image {
          width: 100%;
          height: auto;

          position: relative;

          border-radius: 0.5rem;

          @include min-width(sm) {
            border-radius: 1.15rem;
          }

          @include min-width(lg) {
            width: auto;
            height: 70vh;

            position: absolute;
            top: 50%;
            left: 0;

            transform: translateY(-50%);
          }
        }

        .halo-png {
          width: 80vw;
          height: auto;

          position: absolute;
          top: 50%;

          transform: translate(-40%, -50%);

          pointer-events: none;

          @include min-width(lg) {
            width: auto;
            height: 100vh;
          }
        }

        &:has(.brochure) {
          margin: -25% 0;
          z-index: -1;
        }
      }
    }

    @include min-width(lg) {
      &:not(.no-halo) {
        .image {
          @include halo(md, true, $accent, 0.3);
        }
      }

      &:first-of-type {
        padding-top: 0;
        padding-bottom: 0;

        .content {
          border-image: linear-gradient(to bottom, rgba($accent, 0) 10%, rgba($accent, 1) 25%, rgba($accent, 0) 40%, rgba($accent, 0) 60%, rgba($accent, 1) 80%) 1 round;
        }
      }

      // not last and not first
      &:not(:first-of-type):not(:last-of-type) {
        padding-top: 0;
        padding-bottom: 0;
      }

      &:last-of-type {
        padding-top: 0;

        .content {
          border-image: linear-gradient(to bottom, rgba($accent, 1) 20%, rgba($accent, 0) 40%, rgba($accent, 0) 60%, rgba($accent, 1) 75%, rgba($accent, 0) 90%) 1 round;
        }
      }

      &:has(.brochure) {
        margin: 0 0;
        z-index: 0;
      }
    }

    .description {
      margin: 0;
      padding-top: 1rem;
      @include little-text($accent, false);
      @include gutters(padding, inline, 2);

      @include min-width(xs) {
        padding: 0 !important;
      }
    }
  }
}
</style>
