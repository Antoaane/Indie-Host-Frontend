<!-- File: src/views/Landing/components/UsageSection/components/StepSection/StepSection.vue -->

<script setup lang="ts">
// DEPS
import { onMounted, ref, type Component } from 'vue'

// UTILS
import detectOS from '@/utils/detectOs'
import { vp } from '@/utils/viewport'
import LandingVideo from '@/views/Landing/components/LandingVideo/LandingVideo.vue'

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

const isIosMobile = ref(false)

onMounted(async () => {
  const osInfo = await detectOS().catch(() => null)
  const normalizedOs = String(osInfo?.os ?? '').toLowerCase()
  isIosMobile.value = !vp.lg.value && (normalizedOs === 'ios' || normalizedOs === 'ipados')
})
</script>

<template>
  <section class="step-section">
    <div class="wrapper">
      <!-- TITRE + SOUS-TITRE -->
      <div class="content">
        <span
          data-sr
          data-sr-x="-50"
          data-sr-delay="0.5"
          class="step"
        >
          {{ props.step }}
        </span>
        <div>
          <h2
            data-sr
            data-sr-x="-50"
            v-html="props.title"
          />
          <p
            data-sr
            data-sr-x="-50"
            data-sr-delay="0.35"
            v-if="vp.sm.value"
            v-html="props.description"
            class="description"
          />
        </div>
      </div>

      <!-- ILLUSTRATION -->
      <div
        data-sr
        data-sr-x="100"
        :data-sr-start="vp.lg.value ? 'top 50%' : 'top 100%'"
        data-sr-end="bottom 0%"
        class="illustration"
      >
        <!-- Halo décoratif constant (change le src si besoin) -->
        <img
          class="halo-png"
          loading="lazy"
          src="/assets/media/images/png/halo1.png"
          alt="Décoration contextuelle"
        />
        <!-- Illustration passée en paramètre avec nom de classe {nom du fichier} -->
        <LandingVideo
          v-if="props.video1 && props.video2 && !isIosMobile"
          :class="[{ image: true }, props.illustrationClass]"
          :webm="props.video1"
          :mp4="props.video2"
          :label="props.illustrationAlt || props.illustrationTitle"
        >
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
        </LandingVideo>
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
          data-sr
          data-sr-y="50"
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
